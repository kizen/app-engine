/**
 * Document discovery, ordering, and sidebar grouping.
 *
 * Everything here is derived from the filesystem so that adding a markdown file under docs/ is the
 * only step needed to get it into the site. Nothing is enumerated by hand.
 */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/** Directories that never contain publishable docs. */
const IGNORED_DIRS = new Set(['site', 'node_modules', '.git', '.github']);

/**
 * Sidebar groups, in display order. The first group whose `match` accepts a path wins, so ordering
 * matters: `start` claims `01-`/`02-` before `reference` can take them by number.
 *
 * The final group matches everything, which is what keeps discovery honest — a new file always
 * lands somewhere visible instead of being silently dropped.
 */
const GROUPS = [
  {
    id: 'start',
    title: 'Start here',
    match: (rel) => ['README.md', '01-overview.md', '02-getting-started.md'].includes(rel),
    order: ['README.md', '01-overview.md', '02-getting-started.md'],
  },
  {
    id: 'reference',
    title: 'Reference',
    // Any numbered doc. New `19-*.md` files slot into numeric position with no config change.
    match: (rel) => /^\d+-/.test(rel),
  },
  {
    id: 'lookup',
    title: 'Lookup',
    match: (rel) => ['glossary.md', 'method-index.md'].includes(rel),
    order: ['method-index.md', 'glossary.md'],
  },
  {
    id: 'examples',
    title: 'Examples',
    match: (rel) => rel.startsWith('examples/'),
    order: ['examples/README.md', 'examples/kitchen_sink.md', 'examples/google_calendar.md'],
  },
  { id: 'more', title: 'More', match: () => true },
];

async function walk(dir, rootDir, found = []) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      await walk(absolute, rootDir, found);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) {
      found.push(path.relative(rootDir, absolute));
    }
  }
  return found;
}

/** First `# h1` in the file, which every doc in this corpus has; filename is the fallback. */
function extractTitle(markdown, relPath) {
  const match = markdown.match(/^#\s+(.+?)\s*$/m);
  if (!match) return path.basename(relPath, '.md');
  // Strip inline code/emphasis markers so the title is usable in <title> and nav.
  return match[1].replace(/[`*_]/g, '').trim();
}

/**
 * A short nav label. Numbered docs carry a `NN-` prefix that is useful for ordering but noisy in the
 * sidebar, and their h1 is often longer than the filename concept.
 */
function navLabel(relPath, title) {
  const base = path.basename(relPath, '.md');
  if (base === 'README') {
    return relPath === 'README.md' ? 'Overview' : title;
  }
  return title;
}

/** Source markdown path → generated HTML path. `README.md` becomes its directory's `index.html`. */
export function outPathFor(relPath) {
  return /(?:^|\/)README\.md$/i.test(relPath)
    ? relPath.replace(/README\.md$/i, 'index.html')
    : relPath.replace(/\.md$/i, '.html');
}

function numericPrefix(relPath) {
  const match = path.basename(relPath).match(/^(\d+)-/);
  return match ? Number(match[1]) : null;
}

function assignGroup(relPath) {
  return GROUPS.find((group) => group.match(relPath)) ?? GROUPS.at(-1);
}

/**
 * Builds the comparator for pages *within* one group.
 *
 * Bound to its group rather than deriving the order list from `a.group`: reading it off the left
 * operand made the comparator asymmetric across groups (`cmp(x, y)` and `cmp(y, x)` could both return
 * -1), which is only harmless while every caller sorts a single group's list. Taking the group as a
 * parameter makes that precondition structural instead of a convention.
 */
function comparatorFor(group) {
  const order = group.order;
  return function comparePages(a, b) {
    if (order) {
      const ai = order.indexOf(a.relPath);
      const bi = order.indexOf(b.relPath);
      // Files named in `order` come first, in that order; the rest keep alphabetical order after them.
      if (ai !== -1 || bi !== -1) {
        if (ai === -1) return 1;
        if (bi === -1) return -1;
        if (ai !== bi) return ai - bi;
      }
    }
    if (a.number !== null && b.number !== null && a.number !== b.number) return a.number - b.number;
    if (a.number !== null && b.number === null) return -1;
    if (a.number === null && b.number !== null) return 1;
    return a.relPath.localeCompare(b.relPath);
  };
}

/**
 * Reads every markdown file under `rootDir` and returns the page registry plus grouped nav.
 *
 * `pages` is in final reading order, which is what prev/next navigation and the search index use.
 */
export async function discoverDocs(rootDir) {
  const relPaths = (await walk(rootDir, rootDir)).sort();

  const pages = await Promise.all(
    relPaths.map(async (relPath) => {
      const markdown = await readFile(path.join(rootDir, relPath), 'utf8');
      const title = extractTitle(markdown, relPath);
      const group = assignGroup(relPath).id;
      return {
        relPath,
        markdown,
        title,
        label: navLabel(relPath, title),
        group,
        number: numericPrefix(relPath),
        // Output mirrors the source tree so relative links between docs keep working, with each
        // README becoming its directory's index.html — that makes `[examples/](examples/)` resolve
        // without special-casing directory links at render time.
        url: outPathFor(relPath),
      };
    }),
  );

  const byGroup = new Map(GROUPS.map((group) => [group.id, []]));
  for (const page of pages) byGroup.get(page.group).push(page);
  for (const group of GROUPS) byGroup.get(group.id).sort(comparatorFor(group));

  const ordered = GROUPS.flatMap((group) => byGroup.get(group.id));
  ordered.forEach((page, index) => {
    page.prev = ordered[index - 1] ?? null;
    page.next = ordered[index + 1] ?? null;
  });

  const nav = GROUPS
    .map((group) => ({ id: group.id, title: group.title, pages: byGroup.get(group.id) }))
    .filter((group) => group.pages.length > 0);

  return { pages: ordered, nav };
}

/** The page treated as the site's front door. */
export function findHomePage(pages) {
  return pages.find((page) => page.relPath === 'README.md') ?? pages[0];
}
