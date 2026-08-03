/* ==========================================================================
   Kizen Plugin Docs — client behaviour

   Hand-written, no framework and no dependencies. Everything degrades: with JS
   disabled the pages, navigation, and anchors all still work — only search,
   filtering, copy buttons, and the mobile drawer need this file.
   ========================================================================== */

(function () {
  'use strict';

  var BASE = window.DOCS_BASE || '';
  var THEME_KEY = 'kzn-docs-theme';
  var SIDEBAR_SCROLL_KEY = 'kzn-docs-sidebar-scroll';
  var MAX_RESULTS = 40;

  var root = document.documentElement;

  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $$(selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"]/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char];
    });
  }

  /* ---------------------------------------------------------------- Theme */

  function prefersDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  function initTheme() {
    var toggle = $('[data-theme-toggle]');
    if (!toggle) return;
    toggle.addEventListener('click', function () {
      // Resolve "auto" to whatever is on screen right now, so one click always flips what you see.
      var current = root.dataset.theme;
      var effective = current === 'light' || current === 'dark' ? current : prefersDark() ? 'dark' : 'light';
      var next = effective === 'dark' ? 'light' : 'dark';
      root.dataset.theme = next;
      try { localStorage.setItem(THEME_KEY, next); } catch (error) { /* private mode: session-only */ }
    });
  }

  /* ------------------------------------------------------- Mobile sidebar */

  function initSidebar() {
    var sidebar = $('#sidebar');
    var toggle = $('.nav-toggle');
    var scrim = $('.sidebar-scrim');
    if (!sidebar || !toggle) return;

    // The nav toggle is only rendered on narrow screens, where the sidebar is a modal drawer. On wide
    // screens it's permanent page furniture, so moving or trapping focus there would be wrong.
    function isDrawer() { return getComputedStyle(toggle).display !== 'none'; }

    function focusables() {
      return $$('a[href], button', sidebar).filter(function (el) { return el.offsetParent !== null; });
    }

    function setOpen(open) {
      sidebar.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (scrim) scrim.hidden = !open;
      if (!isDrawer()) return;
      if (open) {
        var first = focusables()[0];
        if (first) first.focus();
      } else {
        toggle.focus();
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(!sidebar.classList.contains('is-open'));
    });
    if (scrim) scrim.addEventListener('click', function () { setOpen(false); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && sidebar.classList.contains('is-open')) setOpen(false);
    });

    // Keep Tab inside the open drawer; without this, focus walks into the content hidden behind it.
    sidebar.addEventListener('keydown', function (event) {
      if (event.key !== 'Tab' || !sidebar.classList.contains('is-open') || !isDrawer()) return;
      var items = focusables();
      if (items.length === 0) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    // Each page is a full load, which would reset the long sidebar to the top on every click.
    var inner = $('.sidebar-inner');
    if (!inner) return;
    try {
      var saved = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
      if (saved) sidebar.scrollTop = parseInt(saved, 10) || 0;
    } catch (error) { /* ignore */ }

    var current = $('.nav-link.is-current');
    // Only auto-scroll to the active item if restoring didn't already bring it into view.
    if (current) {
      var box = current.getBoundingClientRect();
      var frame = sidebar.getBoundingClientRect();
      if (box.top < frame.top || box.bottom > frame.bottom) {
        current.scrollIntoView({ block: 'center' });
      }
    }
    window.addEventListener('beforeunload', function () {
      try { sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(sidebar.scrollTop)); } catch (error) { /* ignore */ }
    });
  }

  /* --------------------------------------------------------- Copy buttons */

  function initCopyButtons() {
    $$('[data-copy]').forEach(function (button) {
      button.addEventListener('click', function () {
        var block = button.closest('.code-block');
        var code = block && $('code', block);
        if (!code) return;

        var done = function () {
          button.textContent = 'Copied';
          button.classList.add('is-copied');
          setTimeout(function () {
            button.textContent = 'Copy';
            button.classList.remove('is-copied');
          }, 1600);
        };
        var fail = function () {
          button.textContent = 'Press ⌘C';
          setTimeout(function () { button.textContent = 'Copy'; }, 1600);
        };

        // textContent is the original source: the highlighter only adds inline spans.
        var text = code.textContent;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(done, fail);
          return;
        }
        // clipboard API needs a secure context, which file:// is not.
        var area = document.createElement('textarea');
        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.appendChild(area);
        area.select();
        try { document.execCommand('copy') ? done() : fail(); } catch (error) { fail(); }
        document.body.removeChild(area);
      });
    });
  }

  /* --------------------------------------------------------- Table filter */

  function initTableFilters() {
    $$('.table-wrap').forEach(function (wrap) {
      var table = $('table', wrap);
      if (!table) return;

      // Horizontal scrolling belongs on an inner element so a sticky filter row can sit above it.
      var scroll = document.createElement('div');
      scroll.className = 'table-scroll';
      wrap.insertBefore(scroll, table);
      scroll.appendChild(table);

      if (!wrap.hasAttribute('data-filterable')) return;

      var rows = $$('tbody tr', table);
      var row = document.createElement('div');
      row.className = 'table-filter-row';
      var input = document.createElement('input');
      input.type = 'search';
      input.className = 'table-filter';
      input.placeholder = 'Filter ' + rows.length + ' rows…';
      input.setAttribute('aria-label', 'Filter table rows');
      var count = document.createElement('span');
      count.className = 'table-filter-count';
      count.textContent = rows.length + ' rows';
      row.appendChild(input);
      row.appendChild(count);
      wrap.insertBefore(row, scroll);

      var empty = document.createElement('div');
      empty.className = 'table-empty';
      empty.textContent = 'No matching rows.';
      empty.hidden = true;
      wrap.appendChild(empty);

      // Cache lowercased row text once; re-reading textContent per keystroke is O(rows × chars).
      var haystacks = rows.map(function (tr) { return tr.textContent.toLowerCase(); });

      input.addEventListener('input', function () {
        var query = input.value.trim().toLowerCase();
        var shown = 0;
        for (var i = 0; i < rows.length; i++) {
          var match = !query || haystacks[i].indexOf(query) !== -1;
          rows[i].hidden = !match;
          if (match) shown++;
        }
        count.textContent = query ? shown + ' of ' + rows.length : rows.length + ' rows';
        empty.hidden = shown !== 0;
      });
    });
  }

  /* ------------------------------------------------------------ TOC state */

  function initToc() {
    var links = $$('.toc-item a');
    if (links.length === 0) return;

    var bySlug = {};
    links.forEach(function (link) {
      bySlug[decodeURIComponent(link.getAttribute('href').slice(1))] = link;
    });
    var headings = $$('.doc-heading[id]').filter(function (heading) { return bySlug[heading.id]; });
    if (headings.length === 0) return;

    var active = null;
    function setActive(heading) {
      var link = heading && bySlug[heading.id];
      if (link === active) return;
      if (active) active.classList.remove('is-active');
      if (link) link.classList.add('is-active');
      active = link || null;
    }

    // Pick the last heading whose top is above the reading line — more stable than reacting to
    // whichever heading an IntersectionObserver happens to fire for.
    var line = 0;
    function recompute() {
      line = (parseFloat(getComputedStyle(root).getPropertyValue('--topbar-h')) || 56) + 24;
    }
    var scheduled = false;
    function onScroll() {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(function () {
        scheduled = false;
        var found = null;
        for (var i = 0; i < headings.length; i++) {
          if (headings[i].getBoundingClientRect().top <= line) found = headings[i];
          else break;
        }
        // Above the first heading: highlight nothing rather than guessing.
        setActive(found || (window.scrollY < 40 ? null : headings[0]));
      });
    }
    recompute();
    window.addEventListener('resize', recompute);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* --------------------------------------------------------------- Search */

  var search = {
    index: null,
    loading: null,
    hits: [],
    cursor: 0,
    overlay: null,
    input: null,
    results: null,
    lastFocus: null,
  };

  /** Loads the index by script injection — works over file://, where fetch() is blocked. */
  function loadIndex() {
    if (search.index) return Promise.resolve(search.index);
    if (search.loading) return search.loading;
    search.loading = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = BASE + 'search-index.js';
      script.onload = function () {
        search.index = window.__DOCS_INDEX__ || { pages: [], sections: [] };
        resolve(search.index);
      };
      script.onerror = function () { reject(new Error('Could not load the search index.')); };
      document.head.appendChild(script);
    });
    return search.loading;
  }

  function terms(query) {
    return query.toLowerCase().split(/[^a-z0-9_.$]+/).filter(function (term) { return term.length > 1; });
  }

  /**
   * Scores a section against the query terms. Every term must appear somewhere (AND), then matches
   * in a heading count far more than matches in body text, and shallower headings win ties.
   */
  function score(section, page, list, phrase) {
    var heading = section.h.toLowerCase();
    var text = section.t.toLowerCase();
    var title = page.t.toLowerCase();
    var total = 0;

    for (var i = 0; i < list.length; i++) {
      var term = list[i];
      var inHeading = heading.indexOf(term);
      var inText = text.indexOf(term);
      var inTitle = title.indexOf(term);
      if (inHeading === -1 && inText === -1 && inTitle === -1) return 0;

      if (inHeading !== -1) {
        total += 40;
        if (inHeading === 0) total += 25;
        if (new RegExp('\\b' + term.replace(/[.$]/g, '\\$&')).test(heading)) total += 15;
      }
      if (inTitle !== -1) total += 8;
      if (inText !== -1) total += 6;
    }

    if (phrase.length > 2) {
      if (heading.indexOf(phrase) !== -1) total += 90;
      else if (text.indexOf(phrase) !== -1) total += 30;
    }
    if (heading === phrase) total += 150;
    total += section.d === 1 ? 12 : section.d === 2 ? 6 : 0;
    return total;
  }

  /**
   * Builds a snippet with matched terms wrapped in <mark>.
   *
   * Match positions are found in the RAW text and escaping happens around them. Highlighting escaped
   * HTML instead would corrupt entities — searching "gt" matched inside `&gt;` and split it, rendering
   * a literal `&gt;` — and needs a regex per term over the whole string.
   */
  function snippet(section, list) {
    var text = section.t;
    if (!text) return '';
    var lower = text.toLowerCase();
    var at = -1;
    for (var i = 0; i < list.length && at === -1; i++) at = lower.indexOf(list[i]);
    var start = at > 90 ? at - 60 : 0;
    var slice = text.slice(start, start + 240);
    var lead = start > 0 ? '…' : '';
    var tail = start + 240 < text.length ? '…' : '';

    var sliceLower = slice.toLowerCase();
    var ranges = [];
    list.forEach(function (term) {
      var from = 0;
      var found;
      while ((found = sliceLower.indexOf(term, from)) !== -1) {
        ranges.push([found, found + term.length]);
        from = found + term.length;
      }
    });
    if (ranges.length === 0) return escapeHtml(lead + slice + tail);

    ranges.sort(function (a, b) { return a[0] - b[0] || b[1] - a[1]; });
    // Merge overlapping ranges so two terms sharing characters yield one <mark>, not nested tags.
    var merged = [ranges[0]];
    for (var j = 1; j < ranges.length; j++) {
      var last = merged[merged.length - 1];
      if (ranges[j][0] <= last[1]) last[1] = Math.max(last[1], ranges[j][1]);
      else merged.push(ranges[j]);
    }

    var html = escapeHtml(lead);
    var pos = 0;
    merged.forEach(function (range) {
      html += escapeHtml(slice.slice(pos, range[0]));
      html += '<mark>' + escapeHtml(slice.slice(range[0], range[1])) + '</mark>';
      pos = range[1];
    });
    return html + escapeHtml(slice.slice(pos)) + escapeHtml(tail);
  }

  function runQuery(query) {
    var list = terms(query);
    var phrase = query.trim().toLowerCase();
    if (list.length === 0) return [];

    var index = search.index;
    var hits = [];
    for (var i = 0; i < index.sections.length; i++) {
      var section = index.sections[i];
      var page = index.pages[section.p];
      if (!page) continue;
      var value = score(section, page, list, phrase);
      if (value > 0) hits.push({ section: section, page: page, value: value });
    }
    hits.sort(function (a, b) { return b.value - a.value; });
    return hits.slice(0, MAX_RESULTS).map(function (hit) {
      var url = BASE + hit.page.u + (hit.section.d > 1 ? '#' + encodeURIComponent(hit.section.s) : '');
      return { url: url, heading: hit.section.h, crumb: hit.page.l, snippet: snippet(hit.section, list) };
    });
  }

  function renderResults(query) {
    if (!query.trim()) {
      search.results.innerHTML = '<p class="search-empty">Search headings and body text across every document.</p>';
      search.hits = [];
      return;
    }
    search.hits = runQuery(query);
    if (search.hits.length === 0) {
      search.results.innerHTML = '<p class="search-empty">No matches for “' + escapeHtml(query) + '”.</p>';
      return;
    }
    search.cursor = 0;
    search.results.innerHTML = search.hits
      .map(function (hit, i) {
        return (
          '<a class="search-hit' + (i === 0 ? ' is-active' : '') + '" href="' + escapeHtml(hit.url) + '">' +
          '<span class="search-hit-top">' +
          '<span class="search-hit-heading">' + escapeHtml(hit.heading) + '</span>' +
          '<span class="search-hit-crumb">' + escapeHtml(hit.crumb) + '</span>' +
          '</span>' +
          (hit.snippet ? '<span class="search-hit-snippet">' + hit.snippet + '</span>' : '') +
          '</a>'
        );
      })
      .join('');
  }

  function moveCursor(delta) {
    var nodes = $$('.search-hit', search.results);
    if (nodes.length === 0) return;
    nodes[search.cursor] && nodes[search.cursor].classList.remove('is-active');
    search.cursor = (search.cursor + delta + nodes.length) % nodes.length;
    var next = nodes[search.cursor];
    next.classList.add('is-active');
    next.scrollIntoView({ block: 'nearest' });
  }

  function openSearch() {
    search.lastFocus = document.activeElement;
    search.overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    search.input.focus();
    search.input.select();
    loadIndex().then(
      function () { renderResults(search.input.value); },
      function () {
        search.results.innerHTML = '<p class="search-empty">Search index unavailable — rebuild the site.</p>';
      },
    );
  }

  function closeSearch() {
    search.overlay.hidden = true;
    document.body.style.overflow = '';
    if (search.lastFocus && search.lastFocus.focus) search.lastFocus.focus();
  }

  function initSearch() {
    search.overlay = $('[data-search-overlay]');
    search.input = $('[data-search-input]');
    search.results = $('[data-search-results]');
    if (!search.overlay || !search.input || !search.results) return;

    $$('[data-search-open]').forEach(function (button) { button.addEventListener('click', openSearch); });
    $$('[data-search-close]').forEach(function (button) { button.addEventListener('click', closeSearch); });
    search.overlay.addEventListener('click', function (event) {
      if (event.target === search.overlay) closeSearch();
    });

    var timer = null;
    search.input.addEventListener('input', function () {
      // Debounced: a scan over ~1,200 sections per keystroke is wasteful while still typing.
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (search.index) renderResults(search.input.value);
      }, 90);
    });

    search.input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') { event.preventDefault(); moveCursor(1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); moveCursor(-1); }
      else if (event.key === 'Enter') {
        var active = $('.search-hit.is-active', search.results);
        if (active) { event.preventDefault(); window.location.href = active.href; }
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !search.overlay.hidden) { event.preventDefault(); closeSearch(); }

      if (!search.overlay.hidden) return;
      var target = event.target;
      var typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (typing) return;

      if (event.key === '/') { event.preventDefault(); openSearch(); }
      else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); openSearch(); }
    });
  }

  /* ----------------------------------------------------------------- Boot */

  function init() {
    initTheme();
    initSidebar();
    initCopyButtons();
    initTableFilters();
    initToc();
    initSearch();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
