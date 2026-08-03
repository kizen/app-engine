/**
 * Tests for the site generator: `npm test` (or `node --test`).
 *
 * Every case here pins a property that a real bug violated, so the comments say what breaks if the
 * assertion fails rather than restating the assertion.
 *
 * Uses only node:test and node:assert — no test-runner dependency.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Slugger, slugify } from './lib/slug.mjs';
import { highlight, langLabel, normalizeLang } from './lib/highlight.mjs';
import { analyzeDoc, renderDoc } from './lib/markdown.mjs';
import { discoverDocs, outPathFor } from './lib/docs.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/* ------------------------------------------------------------------ slugs */

test('slugify matches GitHub, which does not collapse repeated separators', () => {
  // ~1,800 anchors in the corpus were authored against GitHub's rendering. Collapsing `--` to `-`
  // would be prettier and would break every one of them.
  const cases = [
    ['The CLI: `@kizenapps/cli`', 'the-cli-kizenappscli'],
    ['4. HTTP', '4-http'],
    ['1.4 `this.preserve`', '14-thispreserve'],
    ['Recipe 1 — New plugin skeleton', 'recipe-1--new-plugin-skeleton'],
    ['Blocks & CSS', 'blocks--css'],
    ['Views / Modals', 'views--modals'],
    ['5.8 `custom_object`', '58-custom_object'],
    ['2. `this.onError(error)` — a caught platform problem', '2-thisonerrorerror--a-caught-platform-problem'],
    ['Trailing spaces   ', 'trailing-spaces---'],
  ];
  for (const [input, expected] of cases) {
    assert.equal(slugify(input), expected, `slug for ${JSON.stringify(input)}`);
  }
});

test('Slugger dedups on the emitted slug, not the base', () => {
  // Keying on the base alone produced `foo, foo-1, foo-1` — a duplicate id, where an anchor to the
  // third heading silently scrolls to the second.
  const slugger = new Slugger();
  const got = ['Foo', 'Foo', 'Foo-1', 'Foo'].map((text) => slugger.slug(text));
  assert.deepEqual(got, ['foo', 'foo-1', 'foo-1-1', 'foo-2']);
  assert.equal(new Set(got).size, got.length, 'slugs must be unique within a document');
});

/* ----------------------------------------------------------- highlighting */

/** Recovers the original source from highlighted HTML, to prove nothing was added or dropped. */
function unhighlight(html) {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
}

test('highlighting never alters the code it renders', () => {
  const samples = [
    ['js', 'const { data } = await this.getWithErrors(`/records/${id}?x=1`);'],
    // A brace inside a string inside an interpolation: two independent scanner walks disagreed here,
    // ending the interpolation early and mis-colouring the rest of the line.
    ['js', 'const x = `value: ${cond ? "a}" : "b"}`;'],
    ['js', 'const y = `item-${i}}`;'],
    ['js', 'const z = `a${`b${c}d`}e`;'],
    // Unterminated constructs must not gain a synthetic closing character.
    ['js', 'const u = `abc${d'],
    ['js', 'const s = "unterminated'],
    ['js', '/* unclosed comment'],
    ['js', 'const re = /^ab+c$/gi; const n = 0x1f / 2;'],
    ['ts', 'function f<T extends object>(x: T): string | undefined { return undefined; }'],
    ['python', '@retry(3)\ndef run(inputs, outputs):\n    """doc"""\n    return None'],
    ['json', '{"api_name": "x", "n": -1.5e3, "ok": true, "z": null}'],
    ['css', ':root { --x: #fff; }\na::after { content: "→"; }'],
    ['bash', 'npx --yes @kizenapps/cli build # comment'],
    ['http', 'GET /api/objects?page=2 HTTP/1.1\nAuthorization: Bearer x'],
    ['html', '<div class="a" data-x=\'1\'>text</div>'],
    ['markdown', '# Title\n\n- item `code`\n\n| a | b |'],
  ];
  for (const [lang, source] of samples) {
    assert.equal(unhighlight(highlight(source, lang)), source, `${lang}: ${source.slice(0, 40)}`);
  }
});

test('highlighting escapes every HTML-significant character', () => {
  // The highlighter emits raw span markup, so an escaping gap here is an XSS hole in every page.
  const payload = '<script>alert("x")</script> & <img onerror=1> \'q\'';
  for (const lang of ['js', 'ts', 'python', 'json', 'css', 'bash', 'http', 'html', 'markdown', undefined]) {
    const html = highlight(payload, lang);
    // Strip the only markup the highlighter is permitted to emit. Nothing angle-bracketed may remain,
    // which is a stronger and less brittle check than pattern-matching for known-bad tags.
    const stripped = html.replace(/<span class="t-[a-z]">/g, '').replace(/<\/span>/g, '');
    assert.ok(!stripped.includes('<'), `${lang} emitted an unescaped <`);
    assert.ok(!stripped.includes('>'), `${lang} emitted an unescaped >`);
  }
});

test('deeply nested template literals do not overflow the stack', () => {
  // Unbounded recursion here took down the whole build, not one code block.
  for (const depth of [100, 5_000, 50_000]) {
    const source = '`' + '${`'.repeat(depth) + 'x' + '`}'.repeat(depth) + '`';
    assert.doesNotThrow(() => highlight(source, 'js'), `depth ${depth}`);
  }
});

test('pathological input terminates quickly', () => {
  // The scanner advances one character when no rule matches, so it can never stall.
  const inputs = ['"'.repeat(50_000), '/'.repeat(50_000), '${'.repeat(20_000), '`'.repeat(20_000)];
  for (const input of inputs) {
    const started = Date.now();
    highlight(input, 'js');
    assert.ok(Date.now() - started < 5_000, 'highlight should not hang');
  }
});

test('unknown fence languages degrade to escaped plain text', () => {
  assert.equal(normalizeLang('rust'), null);
  assert.equal(highlight('<b>x</b>', 'rust'), '&lt;b&gt;x&lt;/b&gt;');
  assert.equal(langLabel('rust'), 'RUST');
  assert.equal(langLabel('js'), 'JavaScript');
});

/* -------------------------------------------------------------- rendering */

function renderFixture(markdown, { relPath = 'a.md', others = {} } = {}) {
  const report = { badAnchors: [], unresolved: [], highlightFailures: [], counts: { pageLinks: 0, anchors: 0, external: 0 } };
  const page = { relPath, url: outPathFor(relPath) };
  const pageByRel = new Map([[relPath, page]]);
  const slugsByRel = new Map([[relPath, analyzeDoc(markdown).slugs]]);
  for (const [rel, slugs] of Object.entries(others)) {
    pageByRel.set(rel, { relPath: rel, url: outPathFor(rel) });
    slugsByRel.set(rel, new Set(slugs));
  }
  const analysis = analyzeDoc(markdown);
  const html = renderDoc(analysis, { page, pageByRel, slugsByRel, report });
  return { html, report, analysis };
}

test('markdown links to other docs become links to the generated pages', () => {
  const { html, report } = renderFixture('[x](02-getting-started.md#the-cli-kizenappscli)', {
    others: { '02-getting-started.md': ['the-cli-kizenappscli'] },
  });
  assert.match(html, /href="02-getting-started\.html#the-cli-kizenappscli"/);
  assert.equal(report.badAnchors.length, 0);
  assert.equal(report.counts.pageLinks, 1);
});

test('a README link resolves to its directory index', () => {
  const { html } = renderFixture('[x](examples/README.md)', { others: { 'examples/README.md': [] } });
  assert.match(html, /href="examples\/index\.html"/);
});

test('an anchor to a heading that does not exist is reported', () => {
  const { report } = renderFixture('# Real\n\n[x](#not-a-heading)');
  assert.equal(report.badAnchors.length, 1);
});

test('an empty link target produces no anchor and is reported', () => {
  // This previously emitted <a class="undefined" href="undefined"> while --strict still passed,
  // defeating the link-integrity guarantee the report exists to provide.
  const { html, report } = renderFixture('[text]()');
  assert.ok(!/href="undefined"/.test(html), 'must not emit href="undefined"');
  assert.ok(!/class="undefined"/.test(html), 'must not emit class="undefined"');
  assert.ok(!/<a\b/.test(html), 'must not emit an anchor at all');
  assert.equal(report.unresolved.length, 1);
});

test('unsafe URL schemes never become clickable hrefs', () => {
  for (const href of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:x']) {
    const { html, report } = renderFixture(`[click](${href})`);
    assert.ok(!/<a\b/.test(html), `${href} must not render an anchor`);
    assert.ok(!/javascript:|vbscript:|data:/i.test(html), `${href} must not appear as an href`);
    assert.equal(report.unresolved.length, 1, `${href} must be reported`);
  }
});

test('safe external schemes are still linked, and open in a new tab', () => {
  for (const href of ['https://example.com', 'http://example.com', 'mailto:a@b.c']) {
    const { html } = renderFixture(`[x](${href})`);
    assert.match(html, /class="link-external"/, href);
    assert.match(html, /rel="noopener noreferrer"/, href);
  }
});

test('headings nested in blockquotes and lists still get slugs and dedup', () => {
  // marked calls renderer.heading() for these, so a top-level-only analyze pass let them bypass the
  // document's Slugger: no TOC entry, no dedup, and a valid anchor to one reported as broken.
  const { html, analysis } = renderFixture('# Top\n\n> ## Quoted\n\n- ## Listed\n\n## Quoted\n');
  const slugs = analysis.headings.map((heading) => heading.slug);
  assert.deepEqual(slugs, ['top', 'quoted', 'listed', 'quoted-1']);
  assert.ok(analysis.slugs.has('quoted'), 'nested heading must be in the slug set');
  for (const slug of slugs) assert.ok(html.includes(`id="${slug}"`), `rendered id="${slug}"`);
  assert.ok(!/id="undefined"/.test(html));
});

test('an anchor to a heading inside a blockquote resolves', () => {
  const { report } = renderFixture('> ## Quoted\n\n[x](#quoted)');
  assert.equal(report.badAnchors.length, 0);
});

test('large tables are marked filterable and small ones are not', () => {
  const table = (rows) =>
    '| a | b |\n|---|---|\n' + Array.from({ length: rows }, (_, i) => `| ${i} | x |`).join('\n');
  assert.match(renderFixture(table(25)).html, /data-filterable/);
  assert.ok(!/data-filterable/.test(renderFixture(table(5)).html));
});

test('heading ids cannot break out of the id attribute', () => {
  const { html, analysis } = renderFixture('# a" onmouseover="alert(1)\n');
  const slug = analysis.headings[0].slug;
  assert.ok(!slug.includes('"'), 'slug must not contain a quote that could close the attribute');
  assert.ok(html.includes(`id="${slug}"`), 'id must round-trip');
  assert.ok(!/onmouseover="/.test(html), 'must not produce a live event-handler attribute');
});

test('raw HTML in source markdown is passed through, by design', () => {
  // Documents the trust model rather than asserting sanitization the generator does not do. marked
  // passes raw HTML through (as most static site generators do) and the corpus depends on it for
  // exactly one manual anchor. Pinned so that changing this is a deliberate decision, not a surprise.
  const { html } = renderFixture('<a id="manual-anchor"></a>\n\n## H\n');
  assert.match(html, /<a id="manual-anchor">/);
});

/* -------------------------------------------------------------- discovery */

test('discovery finds the corpus and orders it deterministically', async () => {
  const { pages, nav } = await discoverDocs(ROOT_DIR);
  assert.ok(pages.length >= 20, `expected the doc corpus, found ${pages.length}`);

  // site/ holds the generator itself and must never be published as documentation.
  assert.ok(!pages.some((page) => page.relPath.startsWith('site/')), 'site/ must be excluded');

  // The root README is the front door.
  assert.equal(pages.find((page) => page.relPath === 'README.md').url, 'index.html');

  // Running twice must give the same order, or prev/next links churn between builds.
  const again = await discoverDocs(ROOT_DIR);
  assert.deepEqual(again.pages.map((p) => p.relPath), pages.map((p) => p.relPath));

  // Every page lands in exactly one group, and numbered docs stay in numeric order.
  assert.equal(nav.reduce((total, group) => total + group.pages.length, 0), pages.length);
  const numbered = nav.find((group) => group.id === 'reference').pages.map((page) => page.number);
  assert.deepEqual(numbered, [...numbered].sort((a, b) => a - b), 'reference docs must be in numeric order');

  // prev/next must form one chain with no gaps.
  assert.equal(pages[0].prev, null);
  assert.equal(pages.at(-1).next, null);
  for (let i = 0; i < pages.length - 1; i++) {
    assert.equal(pages[i].next, pages[i + 1]);
    assert.equal(pages[i + 1].prev, pages[i]);
  }
});

test('outPathFor maps READMEs to directory indexes', () => {
  assert.equal(outPathFor('README.md'), 'index.html');
  assert.equal(outPathFor('examples/README.md'), 'examples/index.html');
  assert.equal(outPathFor('01-overview.md'), '01-overview.html');
  assert.equal(outPathFor('examples/kitchen_sink.md'), 'examples/kitchen_sink.html');
});

test('every heading slug in the real corpus is unique per document', async () => {
  // Duplicate ids make anchors ambiguous, and the corpus is the only input that actually matters.
  const { pages } = await discoverDocs(ROOT_DIR);
  for (const page of pages) {
    const { headings } = analyzeDoc(page.markdown);
    const slugs = headings.map((heading) => heading.slug);
    assert.equal(new Set(slugs).size, slugs.length, `duplicate slug in ${page.relPath}`);
  }
});
