#!/usr/bin/env node
/**
 * Builds the static documentation site from the markdown in docs/.
 *
 *   cd docs/site && npm install && npm run build     → docs/site/dist/
 *
 * The generator is the only place the site is defined; there is no hand-maintained page, nav entry,
 * or search index. Adding a markdown file under docs/ and rebuilding is the whole workflow.
 *
 * Flags:
 *   --strict   exit non-zero if any internal link or anchor fails to resolve (for CI)
 */

import { cp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import { discoverDocs, findHomePage, outPathFor } from './lib/docs.mjs';
import { analyzeDoc, renderDoc } from './lib/markdown.mjs';
import { renderPage } from './lib/templates.mjs';

const SITE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SITE_DIR, '..');
const OUT_DIR = path.join(SITE_DIR, 'dist');
const ASSETS_DIR = path.join(SITE_DIR, 'assets');

const strict = process.argv.includes('--strict');

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  const started = performance.now();

  // `marked` is a required devDependency; fail with an actionable message rather than a stack trace.
  try {
    await import('marked');
  } catch {
    console.error('\n  Missing dependencies. Run:\n\n    cd docs/site && npm install\n');
    process.exit(1);
  }

  const { pages, nav } = await discoverDocs(ROOT_DIR);
  if (pages.length === 0) {
    console.error('No markdown files found in docs/.');
    process.exit(1);
  }

  const groupTitleById = new Map(nav.map((group) => [group.id, group.title]));

  // Phase 1 — analyze every document, so link rewriting can validate cross-document anchors.
  const analyses = new Map();
  for (const page of pages) analyses.set(page.relPath, analyzeDoc(page.markdown));

  const pageByRel = new Map(pages.map((page) => [page.relPath, page]));
  const slugsByRel = new Map(pages.map((page) => [page.relPath, analyses.get(page.relPath).slugs]));
  const report = {
    badAnchors: [],
    unresolved: [],
    highlightFailures: [],
    counts: { pageLinks: 0, anchors: 0, external: 0 },
  };

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const buildTime = new Date().toISOString().slice(0, 10);
  let totalHtml = 0;

  // Phase 2 — render.
  for (const page of pages) {
    const analysis = analyses.get(page.relPath);
    const bodyHtml = renderDoc(analysis, { page, pageByRel, slugsByRel, report });
    const html = renderPage({
      page,
      nav,
      bodyHtml,
      headings: analysis.headings,
      groupTitle: groupTitleById.get(page.group) ?? '',
      buildTime,
    });
    const target = path.join(OUT_DIR, page.url);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, html, 'utf8');
    totalHtml += Buffer.byteLength(html);
  }

  // The home page is docs/README.md, emitted as index.html by `outPathFor`.
  const home = findHomePage(pages);
  if (outPathFor(home.relPath) !== 'index.html') {
    console.warn(`  ! No README.md at docs/ — "${home.relPath}" is not the site index.`);
  }

  // Search index. Keys are terse because this file is dominated by repetition across ~1,200 sections.
  const pageIndex = pages.map((page) => ({
    u: page.url,
    t: page.title,
    l: page.label,
    g: groupTitleById.get(page.group) ?? '',
  }));
  const sections = [];
  pages.forEach((page, pageNumber) => {
    for (const section of analyses.get(page.relPath).sections) {
      sections.push({ p: pageNumber, s: section.slug, h: section.heading, d: section.depth, t: section.text });
    }
  });
  // Emitted as JS, not JSON, and injected as a <script> on first search use. `fetch()` of a local
  // JSON file is blocked by CORS under file://, so this is what keeps the built site openable
  // straight off disk while still loading the index lazily.
  const searchJson = JSON.stringify({ pages: pageIndex, sections });
  await writeFile(
    path.join(OUT_DIR, 'search-index.js'),
    `window.__DOCS_INDEX__=${searchJson};\n`,
    'utf8',
  );

  await cp(ASSETS_DIR, path.join(OUT_DIR, 'assets'), { recursive: true });

  // Reporting.
  const brokenCount = report.badAnchors.length + report.unresolved.length;
  const show = (label, items, limit = 12) => {
    if (items.length === 0) return;
    console.log(`\n  ${label} (${items.length}):`);
    for (const item of items.slice(0, limit)) {
      console.log(`    ${item.from} → ${item.href}${item.reason ? `  (${item.reason})` : ''}`);
    }
    if (items.length > limit) console.log(`    … and ${items.length - limit} more`);
  };

  const elapsed = Math.round(performance.now() - started);
  const assetFiles = await readdir(ASSETS_DIR);

  const { pageLinks, anchors, external } = report.counts;

  console.log(`\n  Kizen Plugin Docs — built in ${elapsed}ms`);
  console.log(`  ${pages.length} pages · ${sections.length} sections · ${assetFiles.length} assets`);
  console.log(`  HTML ${formatBytes(totalHtml)} · search index ${formatBytes(Buffer.byteLength(searchJson))}`);
  console.log(`  Links: ${pageLinks} cross-document · ${anchors} anchors · ${external} external`);
  console.log(`  Output: ${path.relative(process.cwd(), OUT_DIR) || OUT_DIR}`);

  show('Broken anchors', report.badAnchors);
  show('Unresolved links', report.unresolved);
  // Rendered as plain text instead of aborting the build, but never silently.
  show('Code blocks that failed to highlight', report.highlightFailures);

  if (brokenCount === 0) {
    console.log(`\n  All ${pageLinks + anchors} internal links and anchors resolve.\n`);
  } else if (strict) {
    console.error(`\n  ${brokenCount} unresolved internal link(s) — failing because --strict was passed.\n`);
    process.exit(1);
  } else {
    console.log(`\n  ${brokenCount} unresolved internal link(s). Run with --strict to fail the build.\n`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
