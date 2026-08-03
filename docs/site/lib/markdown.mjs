/**
 * Markdown → HTML, in two phases.
 *
 * Phase 1 (`analyzeDoc`) lexes a document and computes its heading slugs. Phase 2 (`renderDoc`)
 * renders to HTML. They're split because link rewriting needs to know the heading slugs of *other*
 * documents in order to verify that the ~620 hand-authored cross-document anchors actually land
 * somewhere. Rendering a page in isolation could only guess.
 *
 * Both phases share one token tree, and slugs are keyed by token object identity, so the slug a
 * heading gets during analysis is provably the same one it renders with.
 */

import path from 'node:path';
import { marked } from 'marked';
import { Slugger, slugify } from './slug.mjs';
import { escapeHtml, highlight, langLabel, normalizeLang } from './highlight.mjs';

/** Tables at least this tall get a client-side filter box. method-index.md has 314 rows. */
const FILTERABLE_TABLE_ROWS = 20;

/** Section body text stored in the search index, per heading. Enough for a snippet and matching. */
const SEARCH_TEXT_LIMIT = 1200;

/** Recursively extracts readable plain text from a marked token tree. */
function plainText(tokens = []) {
  let out = '';
  for (const token of tokens) {
    switch (token.type) {
      case 'text':
      case 'codespan':
      case 'html':
        out += token.tokens ? plainText(token.tokens) : token.text ?? '';
        break;
      case 'escape':
        out += token.text ?? '';
        break;
      case 'br':
        out += ' ';
        break;
      case 'image':
        out += token.text ?? '';
        break;
      default:
        if (token.tokens) out += plainText(token.tokens);
        else if (typeof token.text === 'string') out += token.text;
        break;
    }
  }
  return out;
}

/** Plain text for a block-level token, used to build searchable section bodies. */
function blockText(token) {
  switch (token.type) {
    case 'space':
    case 'hr':
      return '';
    case 'code':
      return token.text ?? '';
    case 'table': {
      const cells = [...token.header, ...token.rows.flat()];
      return cells.map((cell) => plainText(cell.tokens)).join(' ');
    }
    case 'list':
      return token.items.map((item) => plainText(item.tokens)).join(' ');
    default:
      return token.tokens ? plainText(token.tokens) : token.text ?? '';
  }
}

function collapse(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/** Box-drawing and arrow glyphs used by the ASCII architecture diagrams in several docs. */
const DIAGRAM_GLYPHS = /[│┌┐└┘├┤┬┴┼─━┃║╔╗╚╝╠╣╦╩╬▼▲◄►◀▶↓↑←→]/g;

/**
 * Normalizes text for the search index only — rendered page content is untouched.
 *
 * Sections containing ASCII diagrams or wide tables collapse into runs of pipes and arrows that make
 * a result snippet unreadable ("| | | ▼ | | JSON postMessage bridge…"), so the drawing characters and
 * leftover standalone separators are dropped. Words are preserved, so identifiers stay searchable.
 */
function searchText(text) {
  return text
    .replace(DIAGRAM_GLYPHS, ' ')
    .replace(/(?:^|(?<=\s))[|+=_-]{2,}(?=\s|$)/g, ' ')
    .replace(/(?:^|(?<=\s))\|(?=\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Yields block tokens in the order `marked.parser()` will render them, descending into the two
 * containers that can hold a heading: blockquotes and list items.
 *
 * A flat top-level pass would miss those nested headings — the parser still calls `renderer.heading()`
 * for them, so they would bypass this document's `Slugger` entirely, taking their dedup with them and
 * leaving a valid hand-authored anchor to one of them reported as broken.
 */
function* walkBlocks(tokens) {
  for (const token of tokens) {
    yield token;
    if (token.type === 'blockquote' && token.tokens) {
      yield* walkBlocks(token.tokens);
    } else if (token.type === 'list' && token.items) {
      for (const item of token.items) {
        if (item.tokens) yield* walkBlocks(item.tokens);
      }
    }
  }
}

/** Containers whose text arrives via their children, so counting them too would double up. */
const CONTAINER_TOKENS = new Set(['blockquote', 'list']);

/**
 * Lexes one document, assigning every heading a GitHub-compatible slug and splitting the body into
 * per-heading sections for the search index.
 */
export function analyzeDoc(markdown) {
  const tokens = marked.lexer(markdown);
  const slugger = new Slugger();
  const slugByToken = new Map();
  const headings = [];
  const sections = [];

  let current = null;
  const pushSection = () => {
    if (current) {
      current.text = searchText(current.parts.join(' ')).slice(0, SEARCH_TEXT_LIMIT);
      delete current.parts;
      sections.push(current);
    }
  };

  for (const token of walkBlocks(tokens)) {
    if (token.type === 'heading') {
      const text = collapse(plainText(token.tokens));
      const slug = slugger.slug(text);
      slugByToken.set(token, slug);
      headings.push({ depth: token.depth, text, slug });
      pushSection();
      current = { slug, heading: text, depth: token.depth, parts: [] };
      continue;
    }
    if (current && !CONTAINER_TOKENS.has(token.type)) {
      const text = blockText(token);
      if (text) current.parts.push(text);
    }
  }
  pushSection();

  return { tokens, slugByToken, headings, sections, slugs: new Set(headings.map((h) => h.slug)) };
}

function splitHash(href) {
  const index = href.indexOf('#');
  if (index === -1) return [href, ''];
  return [href.slice(0, index), decodeURIComponent(href.slice(index + 1))];
}

/** Anything with a scheme or protocol-relative prefix is not a path into this site. */
const HAS_SCHEME = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

/**
 * Schemes allowed to become a real `href`. Everything else — `javascript:`, `data:`, `vbscript:` —
 * is rendered as inert text, so a malicious or mistaken link in source markdown cannot become a
 * clickable script URL in the generated site.
 */
const SAFE_SCHEME = /^(?:https?:|mailto:|tel:|\/\/)/i;

/**
 * Resolves one markdown link href against the site:
 *
 *   1. absolute/protocol URL      → external
 *   2. `#frag`                    → same-page anchor (fragment validated)
 *   3. `foo.md` / `foo.md#frag`   → sibling page (page and fragment validated)
 *   4. `dir/`                     → that directory's README page
 *   5. anything else              → kept as authored, and reported as unresolved
 *
 * Step 5 deliberately does not try to be clever. Rewriting an unresolvable link into something else
 * (inline code, a guessed anchor) would hide an authoring mistake; leaving it intact and naming it in
 * the build report surfaces it instead. Note that repo paths such as `[kizen.json](kizen.json)` in the
 * generated example reports sit inside ```markdown fences, so they are code and never arrive here.
 */
function resolveHref(href, ctx) {
  const raw = String(href || '').trim();
  if (!raw) {
    ctx.report.unresolved.push({ from: ctx.page.relPath, href: '(empty)', reason: 'link has no target' });
    return { kind: 'text' };
  }
  if (HAS_SCHEME.test(raw)) {
    if (SAFE_SCHEME.test(raw)) return { kind: 'external', href: raw };
    ctx.report.unresolved.push({ from: ctx.page.relPath, href: raw, reason: 'unsafe URL scheme' });
    return { kind: 'text' };
  }

  const [rawPath, hash] = splitHash(raw);
  const dir = path.posix.dirname(ctx.page.relPath);

  if (!rawPath) {
    ctx.report.counts.anchors++;
    if (hash && !ctx.analysis.slugs.has(hash)) {
      ctx.report.badAnchors.push({ from: ctx.page.relPath, href: raw, reason: 'no such heading on this page' });
    }
    return { kind: 'anchor', href: `#${hash}` };
  }

  const target = path.posix.normalize(path.posix.join(dir, rawPath));
  // Link to the page's real output URL, so the README → index.html rewrite is honoured in one place.
  const hrefTo = (page) => (path.posix.relative(dir, page.url) || './') + (hash ? `#${hash}` : '');

  if (/\.md$/i.test(target)) {
    const page = ctx.pageByRel.get(target);
    if (page) {
      ctx.report.counts.pageLinks++;
      if (hash) {
        ctx.report.counts.anchors++;
        if (!ctx.slugsByRel.get(target)?.has(hash)) {
          ctx.report.badAnchors.push({ from: ctx.page.relPath, href: raw, reason: `no heading "#${hash}" in ${target}` });
        }
      }
      return { kind: 'page', href: hrefTo(page), page };
    }
    ctx.report.unresolved.push({ from: ctx.page.relPath, href: raw, reason: 'no such document' });
    return { kind: 'raw', href: raw };
  }

  const asIndex = path.posix.join(target.replace(/\/+$/, ''), 'README.md');
  const indexPage = ctx.pageByRel.get(asIndex);
  if (indexPage) {
    ctx.report.counts.pageLinks++;
    return { kind: 'page', href: hrefTo(indexPage), page: indexPage };
  }

  ctx.report.unresolved.push({ from: ctx.page.relPath, href: raw, reason: 'not a document in this site' });
  return { kind: 'raw', href: raw };
}

/** Builds a marked Renderer bound to one page's rendering context. */
function createRenderer(ctx) {
  const renderer = new marked.Renderer();
  const { slugByToken } = ctx.analysis;

  renderer.heading = function heading(token) {
    const depth = token.depth;
    const slug = slugByToken.get(token) ?? slugify(collapse(plainText(token.tokens)));
    const inner = this.parser.parseInline(token.tokens);
    return (
      `<h${depth} id="${escapeHtml(slug)}" class="doc-heading">` +
      `<span class="doc-heading-text">${inner}</span>` +
      `<a class="doc-heading-anchor" href="#${escapeHtml(slug)}" aria-label="Link to this section">#</a>` +
      `</h${depth}>\n`
    );
  };

  renderer.code = function code({ text, lang }) {
    const known = normalizeLang(lang);
    const label = langLabel(lang);
    let body;
    try {
      body = highlight(text, lang);
    } catch (error) {
      // One pathological code block must not abort the build. Fall back to plain escaped text and
      // name the file in the report so the failure is visible rather than silent.
      ctx.report.highlightFailures.push({
        from: ctx.page.relPath,
        href: `${label || 'plain'} block`,
        reason: error.message,
      });
      body = escapeHtml(text);
    }
    // The copy button reads the <code> element's textContent, which is the original source, so the
    // raw text is never duplicated into a data- attribute.
    return (
      `<figure class="code-block"${known ? ` data-lang="${escapeHtml(known)}"` : ''}>` +
      `<figcaption class="code-bar">` +
      `<span class="code-lang">${escapeHtml(label)}</span>` +
      `<button class="code-copy" type="button" data-copy>Copy</button>` +
      `</figcaption>` +
      `<pre class="code-pre"><code>${body}</code></pre>` +
      `</figure>\n`
    );
  };

  renderer.table = function table(token) {
    const inner = marked.Renderer.prototype.table.call(this, token);
    const rows = token.rows.length;
    const filterable = rows >= FILTERABLE_TABLE_ROWS;
    // The filter input itself is added by app.js so the markup lives in exactly one place.
    return (
      `<div class="table-wrap"${filterable ? ` data-filterable data-rows="${rows}"` : ''}>` +
      inner +
      `</div>\n`
    );
  };

  renderer.link = function link(token) {
    const resolved = resolveHref(token.href, ctx);
    const inner = this.parser.parseInline(token.tokens);
    const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';

    if (resolved.kind === 'external') {
      ctx.report.counts.external++;
      return `<a class="link-external" href="${escapeHtml(resolved.href)}"${title} target="_blank" rel="noopener noreferrer">${inner}</a>`;
    }
    if (resolved.kind === 'text') {
      // No usable target. Render the label with no anchor so nothing is clickable, rather than
      // emitting an <a> with an empty or unsafe href.
      return `<span class="link-unresolved" title="Link target could not be resolved">${inner}</span>`;
    }
    const CLASSES = { page: 'link-page', anchor: 'link-anchor', raw: 'link-unresolved' };
    return `<a class="${CLASSES[resolved.kind]}" href="${escapeHtml(resolved.href)}"${title}>${inner}</a>`;
  };

  return renderer;
}

/** Renders an analyzed document to HTML. */
export function renderDoc(analysis, ctx) {
  const renderer = createRenderer({ ...ctx, analysis });
  return marked.parser(analysis.tokens, { renderer, gfm: true, breaks: false });
}
