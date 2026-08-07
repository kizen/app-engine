/**
 * HTML shell for every generated page.
 *
 * Pages are emitted at varying depths (`index.html`, `examples/index.html`), so every asset and nav
 * href is prefixed with a per-page relative `base`. That keeps the output openable straight from the
 * filesystem over `file://` — no server and no absolute paths.
 */

import path from 'node:path';
import { escapeHtml } from './highlight.mjs';

const SITE_TITLE = 'Kizen Plugin Docs';

/** `../` repeated to climb from a page back to the output root. */
function baseFor(url) {
  const depth = url.split('/').length - 1;
  return '../'.repeat(depth);
}

function icon(name) {
  const paths = {
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8.5 8.5 0 019.5 4a7 7 0 1010.5 10.5z"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    arrowLeft: '<path d="M15 6l-6 6 6 6"/>',
    arrowRight: '<path d="M9 6l6 6-6 6"/>',
  };
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}

/** Sidebar: every group, with the current page marked. */
function renderNav(nav, currentPage, base) {
  return nav
    .map((group) => {
      const items = group.pages
        .map((page) => {
          const isCurrent = page.relPath === currentPage.relPath;
          const number = page.number !== null ? `<span class="nav-num">${page.number}</span>` : '';
          return (
            `<li><a class="nav-link${isCurrent ? ' is-current' : ''}" href="${base}${escapeHtml(page.url)}"` +
            `${isCurrent ? ' aria-current="page"' : ''}>${number}<span>${escapeHtml(page.label)}</span></a></li>`
          );
        })
        .join('');
      return (
        `<div class="nav-group"><h2 class="nav-group-title">${escapeHtml(group.title)}</h2>` +
        `<ul class="nav-list">${items}</ul></div>`
      );
    })
    .join('');
}

/**
 * On-this-page table of contents. h1 is the document title (rendered in the body) and h4 is rare and
 * too fine-grained to help, so only h2/h3 appear, with h3 nested under its h2.
 */
function renderToc(headings) {
  const entries = headings.filter((heading) => heading.depth === 2 || heading.depth === 3);
  if (entries.length < 2) return '';
  const items = entries
    .map(
      (heading) =>
        `<li class="toc-item toc-h${heading.depth}">` +
        `<a href="#${escapeHtml(heading.slug)}">${escapeHtml(heading.text)}</a></li>`,
    )
    .join('');
  return (
    `<nav class="toc" aria-labelledby="toc-title">` +
    `<h2 class="toc-title" id="toc-title">On this page</h2>` +
    `<ul class="toc-list">${items}</ul></nav>`
  );
}

function renderPager(page, base) {
  const link = (target, rel, label) => {
    if (!target) return '<span class="pager-slot"></span>';
    return (
      `<a class="pager-link pager-${rel}" href="${base}${escapeHtml(target.url)}">` +
      `${rel === 'prev' ? icon('arrowLeft') : ''}` +
      `<span class="pager-meta"><span class="pager-label">${label}</span>` +
      `<span class="pager-title">${escapeHtml(target.label)}</span></span>` +
      `${rel === 'next' ? icon('arrowRight') : ''}</a>`
    );
  };
  return (
    `<nav class="pager" aria-label="Previous and next page">` +
    `${link(page.prev, 'prev', 'Previous')}${link(page.next, 'next', 'Next')}</nav>`
  );
}

/** Renders one full page. */
export function renderPage({ page, nav, bodyHtml, headings, groupTitle, buildTime }) {
  const base = baseFor(page.url);
  const toc = renderToc(headings);
  const description = `${page.title} — part of the Kizen plugin developer documentation.`;
  const sourceName = path.posix.basename(page.relPath);

  return `<!doctype html>
<html lang="en" data-theme="auto">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(page.title)} · ${SITE_TITLE}</title>
<meta name="description" content="${escapeHtml(description)}">
<meta name="generator" content="site/build.mjs">
<link rel="stylesheet" href="${base}assets/app.css">
<link rel="icon" href="${base}assets/favicon.png" type="image/png">
<script>
/* Applies the saved theme before first paint so there is no flash of the wrong palette. */
(function(){try{var t=localStorage.getItem('kzn-docs-theme');if(t)document.documentElement.dataset.theme=t;}catch(e){}})();
</script>
</head>
<body>
<a class="skip-link" href="#main">Skip to content</a>

<header class="topbar">
  <button class="icon-btn nav-toggle" type="button" aria-label="Toggle navigation" aria-expanded="false" aria-controls="sidebar">${icon('menu')}</button>
  <a class="brand" href="${base}index.html" aria-label="${escapeHtml(SITE_TITLE)}">
    <img class="brand-mark" src="${base}assets/favicon.png" alt="" width="28" height="28" decoding="async">
    <span class="brand-text">${SITE_TITLE}</span>
  </a>
  <button class="search-trigger" type="button" data-search-open>
    ${icon('search')}<span class="search-trigger-text">Search docs</span><kbd class="search-kbd">/</kbd>
  </button>
  <button class="icon-btn theme-toggle" type="button" aria-label="Switch theme" data-theme-toggle>
    <span class="theme-icon theme-icon-light">${icon('sun')}</span>
    <span class="theme-icon theme-icon-dark">${icon('moon')}</span>
  </button>
</header>

<div class="layout">
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-inner">${renderNav(nav, page, base)}</div>
  </aside>
  <div class="sidebar-scrim" data-nav-close hidden></div>

  <main class="main" id="main">
    <div class="main-inner">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="${base}index.html">Docs</a>
        <span class="breadcrumb-sep" aria-hidden="true">/</span>
        <span>${escapeHtml(groupTitle)}</span>
      </nav>
      <article class="doc">${bodyHtml}</article>
      ${renderPager(page, base)}
      <footer class="doc-footer">
        <p>Generated from <code>${escapeHtml(sourceName)}</code> on ${escapeHtml(buildTime)}.
        Edit the markdown, not this page — run <code>npm run build</code> in <code>site/</code> to regenerate.</p>
      </footer>
    </div>
    ${toc}
  </main>
</div>

<div class="search-overlay" data-search-overlay hidden>
  <div class="search-panel" role="dialog" aria-modal="true" aria-label="Search documentation">
    <div class="search-field">
      ${icon('search')}
      <input class="search-input" type="search" placeholder="Search all ${escapeHtml(String(nav.reduce((n, g) => n + g.pages.length, 0)))} documents…" autocomplete="off" spellcheck="false" data-search-input aria-label="Search query">
      <button class="icon-btn search-close" type="button" data-search-close aria-label="Close search">${icon('close')}</button>
    </div>
    <div class="search-results" data-search-results aria-live="polite"></div>
    <div class="search-hint">
      <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>Enter</kbd> open</span><span><kbd>Esc</kbd> close</span>
    </div>
  </div>
</div>

<script>window.DOCS_BASE = ${JSON.stringify(base)};</script>
<script src="${base}assets/app.js" defer></script>
</body>
</html>
`;
}
