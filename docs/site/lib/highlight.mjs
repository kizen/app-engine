/**
 * Build-time syntax highlighter.
 *
 * Covers exactly the fence languages the docs actually use (verified by scanning the corpus):
 * json, js, ts, javascript, python, css, markdown, md, http, bash, jsonc, html.
 *
 * Chosen over highlight.js because the output is pre-rendered — shipping a ~100KB grammar bundle to
 * colour code that is already static would be pure waste. Design goal is "never visibly wrong"
 * rather than exhaustive: comments, strings and keywords are the tokens a reader's eye relies on, so
 * those are precise, and anything unrecognised falls through to plain text instead of being guessed.
 *
 * Token classes are single letters to keep the emitted HTML small across ~1,200 code blocks:
 *   c comment · s string · n number · k keyword · b builtin/literal · f function · t type
 *   p property/key · d decorator · v variable/interpolation · g tag · a attribute · u punctuation
 */

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ESCAPES[char]);
}

function wrap(type, text) {
  const escaped = escapeHtml(text);
  // 'ws' and 'id' are structural, not semantic — emitting spans for them would double the HTML.
  return type === 'ws' || type === 'id' ? escaped : `<span class="t-${type}">${escaped}</span>`;
}

/** Tokens that mean a following `/` is division, not the start of a regex literal. */
function endsValue(prev) {
  if (!prev) return false;
  if (prev.t === 'id' || prev.t === 'n' || prev.t === 't' || prev.t === 'p') return true;
  if (prev.t === 'b' && prev.text !== 'typeof' && prev.text !== 'void') return true;
  return prev.t === 'u' && /[)\]]$/.test(prev.text);
}

const JS_KEYWORDS = new Set(
  ('as async await break case catch class const continue debugger default delete do else export ' +
   'extends finally for from function get if import in instanceof let new of return set static ' +
   'switch throw try typeof var void while with yield')
    .split(' '),
);

const TS_KEYWORDS = new Set(
  ('abstract asserts declare enum implements infer interface is keyof namespace override private ' +
   'protected public readonly satisfies type')
    .split(' '),
);

const TS_TYPES = new Set(
  'any bigint boolean never number object string symbol unknown void'.split(' '),
);

const JS_LITERALS = new Set('true false null undefined NaN Infinity this super arguments'.split(' '));

const PY_KEYWORDS = new Set(
  ('and as assert async await break class continue def del elif else except finally for from ' +
   'global if import in is lambda nonlocal not or pass raise return try while with yield match case')
    .split(' '),
);

const PY_LITERALS = new Set('True False None self cls'.split(' '));

const PY_BUILTINS = new Set(
  ('abs all any bool bytes dict enumerate float format getattr hasattr int isinstance len list map ' +
   'max min open print range repr reversed round set setattr sorted str sum super tuple type zip ' +
   'Exception ValueError TypeError KeyError RuntimeError')
    .split(' '),
);

const BASH_KEYWORDS = new Set(
  ('if then else elif fi for while do done case esac in function return export local read echo cd ' +
   'set unset source exit')
    .split(' '),
);

/**
 * Bound on nested template literals / interpolations.
 *
 * Both the scanner and the highlighter recurse for `` `${`${…}`}` ``. Without a ceiling, deeply
 * nested input (pasted minified or generated JS) overflows the stack, and since the caller in
 * markdown.mjs renders inside the build loop that would abort the entire site build, not one block.
 * Past this depth the remainder is emitted as plain string text, which is a cosmetic loss.
 */
const MAX_TEMPLATE_DEPTH = 24;

/** Advances past a quoted string starting at `i`, stopping at a newline for unterminated ones. */
function skipQuoted(code, i) {
  const quote = code[i++];
  while (i < code.length) {
    if (code[i] === '\\') { i += 2; continue; }
    if (code[i] === quote) return i + 1;
    if (code[i] === '\n') return i;
    i++;
  }
  return i;
}

/**
 * Finds the `}` that closes an interpolation opened at `start`, skipping over nested braces, quoted
 * strings, and nested template literals. Returns `code.length` if it is never closed.
 */
function findInterpolationEnd(code, start, depth) {
  let i = start;
  let braces = 0;
  while (i < code.length) {
    const char = code[i];
    if (char === '\\') { i += 2; continue; }
    if (char === '{') { braces++; i++; continue; }
    if (char === '}') {
      if (braces === 0) return i;
      braces--;
      i++;
      continue;
    }
    if (char === '"' || char === "'") { i = skipQuoted(code, i); continue; }
    if (char === '`') {
      const nested = depth < MAX_TEMPLATE_DEPTH ? scanTemplate(code, i, depth + 1) : null;
      i += nested ? nested.length : 1;
      continue;
    }
    i++;
  }
  return code.length;
}

/**
 * Scans one complete template literal starting at `pos`, returning its length and its segments.
 *
 * This is the single source of truth for template structure: both the length used to advance the
 * scanner and the segments used to colour the literal come from here. An earlier version measured
 * length and emitted spans with two separate walks, and they disagreed whenever an interpolation
 * contained a braced string (`` `${cond ? "a}" : "b"}` ``) — the emit walk ended the interpolation at
 * the brace inside the string and mis-coloured everything after it.
 */
function scanTemplate(code, pos, depth = 0) {
  if (code[pos] !== '`') return null;
  const parts = [];
  let literalStart = pos + 1;
  let i = pos + 1;

  while (i < code.length) {
    const char = code[i];
    if (char === '\\') { i += 2; continue; }
    if (char === '`') {
      if (i > literalStart) parts.push({ type: 'lit', start: literalStart, end: i });
      return { length: i - pos + 1, parts, terminated: true };
    }
    if (char === '$' && code[i + 1] === '{') {
      if (i > literalStart) parts.push({ type: 'lit', start: literalStart, end: i });
      const exprStart = i + 2;
      const exprEnd = findInterpolationEnd(code, exprStart, depth);
      // `closed` guards against emitting a `}` the source never had, for `` `abc${d `` .
      const closed = code[exprEnd] === '}';
      parts.push({ type: 'expr', start: exprStart, end: exprEnd, closed });
      i = closed ? exprEnd + 1 : exprEnd;
      literalStart = i;
      continue;
    }
    i++;
  }
  // Unterminated — colour the remainder rather than dropping it.
  if (code.length > literalStart) parts.push({ type: 'lit', start: literalStart, end: code.length });
  return { length: code.length - pos, parts, terminated: false };
}

/** Length of the template literal at `pos`, for the scanner rule. */
function matchTemplate(code, pos) {
  return scanTemplate(code, pos)?.length ?? 0;
}

/**
 * Highlights a template literal, recursing into `${…}` so interpolated expressions stay readable.
 * Re-scans the already-matched text with the same `scanTemplate`, so segment boundaries are identical
 * to those used to measure its length.
 */
function emitTemplate(text, lang, depth) {
  const scan = scanTemplate(text, 0, depth);
  if (!scan) return escapeHtml(text);

  let out = wrap('s', '`');
  for (const part of scan.parts) {
    const body = text.slice(part.start, part.end);
    if (part.type === 'lit') {
      out += wrap('s', body);
    } else {
      const inner = depth >= MAX_TEMPLATE_DEPTH ? escapeHtml(body) : highlight(body, lang, depth + 1);
      const close = part.closed ? '<span class="t-v">}</span>' : '';
      out += `<span class="t-v">\${</span>${inner}${close}`;
    }
  }
  if (scan.terminated) out += wrap('s', '`');
  return out;
}

const WHITESPACE = { t: 'ws', r: /\s+/y };

function jsGrammar(lang, depth) {
  const isTs = lang === 'ts';
  return [
    WHITESPACE,
    { t: 'c', r: /\/\*[\s\S]*?(?:\*\/|$)/y },
    { t: 'c', r: /\/\/[^\n]*/y },
    { t: 's', match: matchTemplate, emit: (text) => emitTemplate(text, lang, depth) },
    { t: 's', r: /"(?:[^"\\\n]|\\.)*"?/y },
    { t: 's', r: /'(?:[^'\\\n]|\\.)*'?/y },
    { t: 's', r: /\/(?:\[(?:[^\]\\\n]|\\.)*\]|[^/\\\n[])+\/[dgimsuy]*/y, after: (prev) => !endsValue(prev) },
    { t: 'n', r: /\b(?:0[xX][\da-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?)n?\b/y },
    { t: 'd', r: /@[A-Za-z_$][\w$]*/y },
    {
      t: 'id',
      r: /[A-Za-z_$][\w$]*/y,
      emit(text, _m, ctx) {
        if (JS_KEYWORDS.has(text) || (isTs && TS_KEYWORDS.has(text))) return wrap('k', text);
        if (JS_LITERALS.has(text)) return wrap('b', text);
        if (isTs && TS_TYPES.has(text)) return wrap('t', text);
        if (ctx.prev?.t === 'u' && ctx.prev.text.endsWith('.')) return wrap('p', text);
        if (/^\s*\(/.test(ctx.rest)) return wrap('f', text);
        if (/^[A-Z][\w$]*$/.test(text)) return wrap('t', text);
        // A bare identifier before `:` inside a literal is an object key.
        if (/^\s*:/.test(ctx.rest) && !isTs) return wrap('p', text);
        return escapeHtml(text);
      },
    },
    { t: 'u', r: /(?:=>|\?\?=?|\.\.\.|[-+*/%&|^!<>=]=?=?|[{}()[\];,.:?]|&&|\|\|)/y },
  ];
}

const GRAMMARS = {
  js: (lang, depth) => jsGrammar('js', depth),
  ts: (lang, depth) => jsGrammar('ts', depth),

  json: (lang) => [
    WHITESPACE,
    ...(lang === 'jsonc' ? [{ t: 'c', r: /\/\/[^\n]*/y }, { t: 'c', r: /\/\*[\s\S]*?(?:\*\/|$)/y }] : []),
    { t: 'p', r: /"(?:[^"\\]|\\.)*"(?=\s*:)/y },
    { t: 's', r: /"(?:[^"\\]|\\.)*"?/y },
    { t: 'n', r: /-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/y },
    { t: 'b', r: /\b(?:true|false|null)\b/y },
    { t: 'u', r: /[{}[\],:]/y },
  ],

  python: () => [
    WHITESPACE,
    { t: 'c', r: /#[^\n]*/y },
    { t: 's', r: /[rbfuRBFU]{0,2}"""[\s\S]*?(?:"""|$)/y },
    { t: 's', r: /[rbfuRBFU]{0,2}'''[\s\S]*?(?:'''|$)/y },
    { t: 's', r: /[rbfuRBFU]{0,2}"(?:[^"\\\n]|\\.)*"?/y },
    { t: 's', r: /[rbfuRBFU]{0,2}'(?:[^'\\\n]|\\.)*'?/y },
    { t: 'd', r: /@[A-Za-z_][\w.]*/y },
    { t: 'n', r: /\b(?:0[xX][\da-fA-F_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?j?)\b/y },
    {
      t: 'id',
      r: /[A-Za-z_][\w]*/y,
      emit(text, _m, ctx) {
        if (PY_KEYWORDS.has(text)) return wrap('k', text);
        if (PY_LITERALS.has(text)) return wrap('b', text);
        // `def foo` / `class Foo` — name the definition, not the keyword.
        if (ctx.prev?.t === 'k' && (ctx.prev.text === 'def' || ctx.prev.text === 'class')) return wrap('f', text);
        if (ctx.prev?.t === 'u' && ctx.prev.text.endsWith('.')) return wrap('p', text);
        if (PY_BUILTINS.has(text)) return wrap('b', text);
        if (/^\s*\(/.test(ctx.rest)) return wrap('f', text);
        if (/^[A-Z][\w]*$/.test(text)) return wrap('t', text);
        return escapeHtml(text);
      },
    },
    { t: 'u', r: /(?:\*\*=?|\/\/=?|[-+*/%&|^!<>=]=?|[{}()[\];,.:@])/y },
  ],

  css: () => [
    WHITESPACE,
    { t: 'c', r: /\/\*[\s\S]*?(?:\*\/|$)/y },
    { t: 'k', r: /@[\w-]+/y },
    { t: 's', r: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/y },
    { t: 'n', r: /#[\da-fA-F]{3,8}\b/y },
    { t: 'n', r: /-?\b\d*\.?\d+(?:%|[a-zA-Z]{1,4})?\b/y },
    { t: 'b', r: /!important\b/y },
    { t: 'v', r: /--[\w-]+/y },
    { t: 'p', r: /[a-zA-Z-]+(?=\s*:)/y },
    { t: 'f', r: /[\w-]+(?=\()/y },
    { t: 't', r: /::?[a-zA-Z-]+/y },
    { t: 'd', r: /\.[\w-]+|#[\w-]+|\[[^\]\n]*\]/y },
    { t: 'g', r: /\b[a-zA-Z][\w-]*\b/y },
    { t: 'u', r: /[{}();,:>+~*]/y },
  ],

  http: () => [
    WHITESPACE,
    { t: 'k', r: /^(?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/my },
    { t: 'b', r: /\bHTTP\/[\d.]+\b/y },
    { t: 'p', r: /^[A-Za-z][A-Za-z-]*(?=:)/my },
    { t: 's', r: /"(?:[^"\\\n]|\\.)*"?/y },
    { t: 'n', r: /\b\d+\b/y },
    { t: 'u', r: /[:/?&=]/y },
  ],

  bash: () => [
    WHITESPACE,
    { t: 'c', r: /#[^\n]*/y },
    { t: 's', r: /"(?:[^"\\]|\\.)*"?/y },
    { t: 's', r: /'[^']*'?/y },
    { t: 'v', r: /\$\{[^}\n]*\}|\$[\w@*#?$!]+/y },
    { t: 'b', r: /(?:^|\s)--?[\w-]+/y },
    {
      t: 'id',
      r: /[A-Za-z_][\w.-]*/y,
      emit: (text) => (BASH_KEYWORDS.has(text) ? wrap('k', text) : escapeHtml(text)),
    },
    { t: 'u', r: /[|&;()<>{}=]/y },
  ],

  markdown: () => [
    { t: 'k', r: /^#{1,6} [^\n]*/my },
    { t: 'c', r: /^```[\s\S]*?(?:^```|$)/my },
    { t: 's', r: /`[^`\n]+`/y },
    { t: 'b', r: /\*\*[^*\n]+\*\*|__[^_\n]+__/y },
    { t: 't', r: /\[[^\]\n]*\]\([^)\n]*\)/y },
    { t: 'd', r: /^\s*(?:[-*+]|\d+\.) /my },
    { t: 'p', r: /^> ?[^\n]*/my },
    { t: 'u', r: /^\|[^\n]*/my },
    { t: 'ws', r: /\s+/y },
  ],

  html: () => [
    { t: 'c', r: /<!--[\s\S]*?(?:-->|$)/y },
    { t: 'c', r: /<!DOCTYPE[^>\n]*>/iy },
    { t: 'g', r: /<\/?[a-zA-Z][\w-]*/y },
    { t: 's', r: /"(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?/y },
    { t: 'a', r: /[a-zA-Z-]+(?==)/y },
    { t: 'u', r: /[=/>]/y },
    { t: 'ws', r: /\s+/y },
  ],
};

/** Fence aliases → grammar keys. Anything absent renders as plain, unhighlighted text. */
const ALIASES = {
  javascript: 'js', js: 'js', jsx: 'js', mjs: 'js',
  typescript: 'ts', ts: 'ts', tsx: 'ts',
  json: 'json', jsonc: 'jsonc',
  python: 'python', py: 'python',
  css: 'css',
  markdown: 'markdown', md: 'markdown',
  http: 'http',
  bash: 'bash', sh: 'bash', shell: 'bash', console: 'bash',
  html: 'html', xml: 'html',
};

export function normalizeLang(lang) {
  return ALIASES[String(lang || '').trim().toLowerCase()] ?? null;
}

/** Human-facing label shown in each code block's header. */
const LABELS = {
  js: 'JavaScript', ts: 'TypeScript', json: 'JSON', jsonc: 'JSONC', python: 'Python',
  css: 'CSS', markdown: 'Markdown', http: 'HTTP', bash: 'Shell', html: 'HTML',
};

export function langLabel(lang) {
  const key = normalizeLang(lang);
  if (key) return LABELS[key] ?? key;
  const raw = String(lang || '').trim();
  return raw ? raw.toUpperCase() : '';
}

/**
 * Highlights `code` for `lang`, returning HTML. Unknown languages return escaped plain text, so an
 * unrecognised fence degrades to readable rather than broken.
 *
 * `depth` is internal: it tracks recursion through template-literal interpolations.
 */
export function highlight(code, lang, depth = 0) {
  const key = normalizeLang(lang);
  if (!key) return escapeHtml(code);

  const grammarKey = key === 'jsonc' ? 'json' : key;
  const rules = GRAMMARS[grammarKey](key, depth);
  const text = String(code);
  let out = '';
  let pos = 0;
  let prev = null;

  scan: while (pos < text.length) {
    for (const rule of rules) {
      if (rule.after && !rule.after(prev)) continue;

      let matched;
      let match = null;
      if (rule.match) {
        const length = rule.match(text, pos);
        if (!length) continue;
        matched = text.slice(pos, pos + length);
      } else {
        rule.r.lastIndex = pos;
        match = rule.r.exec(text);
        if (!match || match.index !== pos || !match[0]) continue;
        matched = match[0];
      }

      const ctx = { prev, rest: text.slice(pos + matched.length) };
      out += rule.emit ? rule.emit(matched, match, ctx) : wrap(rule.t, matched);
      if (rule.t !== 'ws') prev = { t: rule.t, text: matched };
      pos += matched.length;
      continue scan;
    }
    // No rule matched this position: emit one character and advance, so the scanner can never hang.
    out += escapeHtml(text[pos]);
    pos++;
  }
  return out;
}
