# Sharing Code Between Scripts

**What this covers:** importing plain JavaScript helpers into a script from another file in the
same plugin, using normal relative ESM `import`/`export` syntax. The packager folds the imported
code into each script at build time, so the published artifact is unchanged: one self-contained
script body, exactly what ships today. Requires `@kizenapps/packager` 0.7.0+ (bundled by
`npx --yes @kizenapps/cli build`/`dev` and the release pipeline).

**See also:** [repo anatomy](02-getting-started.md#repo-anatomy) for where shared files live on
disk · [execution model](04-worker-runtime-api.md#1-execution-model) for how a script body is
wrapped and why nothing on `this` survives between runs · [session data](04-worker-runtime-api.md)
for the sanctioned way to share state across runs · [gotchas](17-gotchas.md) for the consolidated
trap list.

---

## The problem this solves

Every script — a block, an action, an event script, any artifact's `script.js` — is compiled and
run as an isolated function body ([execution model](04-worker-runtime-api.md#1-execution-model)).
Before this feature, that meant no file a script could share with another: a small `esc()` or
`describeError()` helper, or a wrapper around a repeated fetch call, had to be copy-pasted into
every script that needed it. That constraint hasn't gone away at runtime — it's still true that
each script executes as a standalone body with no module loader. What's new is that you no longer
have to author it that way: the packager now does the copy-pasting for you, at build time, from
real ESM source.

## What changes for existing plugins

Two rules land in `@kizenapps/packager` 0.7.0 that fire even in a plugin that never writes an
`import` — because the packager now parses every script to check for imports and exports, not
just the ones that opt in:

- **An `export` statement anywhere in a component script is a build error**
  (`imports/script-export`). Only a shared file may `export`; a `blocks/`, `actions/`, etc. script
  never could.
- **Dynamic `import()` and `import.meta` anywhere in a plugin script are build errors**
  (`imports/unsupported-import`).

Neither of these ever worked at runtime. The engine compiles a script body with `new Function`,
which throws a `SyntaxError` on a top-level `export` and has no module to resolve a dynamic
`import()` against — there's no bundler or loader inside the worker. Before 0.7.0 either one broke
the script at runtime, silently or with an opaque syntax error; from 0.7.0 the packager catches
both at build time instead, with a diagnostic naming the file. A plugin that has never contained
either construct is unaffected.

## Writing shared code

Put plain JavaScript in a `.js` file under the plugin's `entry` directory, outside any artifact
directory, and export the pieces you want to reuse with named exports:

```js
// src/lib/kizenApi.js
const BASE = 'https://app.kizen.com/api';

export const fetchContact = async (id) =>
  (await fetch(`${BASE}/contacts/${id}`)).json();
```

Import it from a script with a normal relative import:

```js
// src/actions/foo/script.js
import { fetchContact } from '../../lib/kizenApi.js';

const contact = await fetchContact(this.args.id);
return { contact };
```

At build time the packager resolves the import, inlines the shared file's body into an IIFE ahead
of the script, and rewrites the import into a destructure off its return value. What ships is
conceptually:

```js
const { fetchContact } = (() => {
  const BASE = 'https://app.kizen.com/api';
  const fetchContact = async (id) =>
    (await fetch(`${BASE}/contacts/${id}`)).json();
  return { fetchContact };
})();

const contact = await fetchContact(this.args.id);
return { contact };
```

Authors never write this — it's what the engine and runtime receive. **They never see an
`import`.** A script that doesn't import anything is packaged byte-for-byte as it is today; shared
code changes nothing about a plugin that doesn't use it.

No config is involved: nothing in `kizen.json` or any `config.json` declares a shared file. Because
the imports are real ESM syntax, your IDE resolves them on its own — go-to-definition and
autocomplete on `fetchContact` work without any project setup.

### Where shared code can live

Anywhere under `entry` that is **not** an artifact directory. The reserved artifact directories are
`blocks/`, `actions/`, `pages/`, `views/`, `floatingFrames/`, `routeScripts/`, `toolbarItems/`,
`objectSettingsItems/`, `dataAdornments/`, `calendarSources/`, `automationSteps/`,
`setupAssistant/`, and `userSetupAssistant/` ([repo anatomy](02-getting-started.md#repo-anatomy)).
Anything else — `src/lib/`, `src/components/`, `src/foo/`, a file directly under `src/` — is fair
game. The convention is `src/lib/`; use it unless you have a reason not to.

A shared file can import other shared files, as long as neither lives inside an artifact
directory. A cycle between shared files is a build error only once some script actually imports
into it; a cyclic pair (or chain) that no script imports gets the unused-file warning instead, not
a cycle error (see [Build-time errors](#build-time-errors)).

### Import and export rules

Only one shape of import is supported:

```js
import { a, b as c } from './relative/path.js';
```

- The specifier must be relative (`./` or `../`) and include the `.js` extension.
- Only named imports. `{ a, b as c }` — aliasing is fine.

**Not supported** (build error):

- Default imports (`import x from './y.js'`)
- `import { default as x } from './y.js'` — same reason as a default import: there's no
  `export default` for it to bind to
- Namespace imports (`import * as ns from './y.js'`)
- Side-effect imports (`import './y.js'`)
- Dynamic `import()` and `import.meta` — build errors in every plugin script, not just ones that
  import shared code (see [What changes for existing plugins](#what-changes-for-existing-plugins))
- Bare package specifiers (`import { x } from 'some-package'`) — there is no `node_modules`
  resolution; only files inside the plugin's own `entry` directory are reachable

A shared file's exports are equally narrow — only named exports:

```js
export const fetchContact = async (id) => /* ... */;
export function describeError(err) { /* ... */ }
export { helperA, helperB as helperC };
```

**Not supported** (build error):

- `export default`
- `export { x as default }` — the same restriction, spelled as a named export
- Re-exports (`export { a } from './other.js'`, `export * from './other.js'`)
- Top-level `await` in a shared file

A shared file's internals stay private — only the names you import enter the importing script's
scope. A script can declare its own `const BASE = ...` without colliding with a shared file's
`BASE`; they're separate closures folded into the same function body.

That privacy is about *names*, not *execution*: the packager inlines the shared file's whole body
into every importer, so every top-level statement in it runs for every importer, whether or not
that statement produced a name you imported.

```js
// src/lib/kizen.js
export const CONFIG_ENDPOINT = `${this.pluginApiName}/config`; // runs in every importer
export const UNREADABLE = () => { /* ... */ };
```

A script that writes `import { UNREADABLE } from '../lib/kizen.js'` still evaluates
`CONFIG_ENDPOINT`'s template literal — and touches `this.pluginApiName` doing it — before any of
the script's own code runs, even though it never imported `CONFIG_ENDPOINT`. Keep a shared file's
top-level statements pure and cheap: no side effects, nothing that can throw, no expensive work
outside a function body; put real work inside the exported functions instead. And because every
importer pays for evaluating every top-level statement in the file regardless of which exports it
uses, don't pile unrelated helpers into one shared file — split by concern once any one of them has
non-trivial top-level cost.

`this` inside a shared file is the importing script's `this` — the same worker context. A shared
helper can call `this.get(...)`, read `this.config`, etc., exactly as if that code were written
directly in the script. See the [`this.*` reference](04-worker-runtime-api.md) for what's
available on which surface.

## What's not currently supported

- Default exports or re-exports from a shared file
- Helpers placed inside a component (artifact) directory — importing another artifact's
  `script.js`, or a file dropped inside `blocks/<name>/`, `actions/<name>/`, etc., is a build error
- Imports that reach outside the plugin's `entry` directory — there is no sharing between plugins
  in a multi-plugin repo today
- Imports in setup-assistant field scripts (see below)

None of these are planned as "coming soon" in this feature — they're just out of scope for it.

### Setup-assistant field scripts can't import

`setupAssistant/<key>/*.js` and `userSetupAssistant/<key>/*.js` files are function expressions, not
script bodies ([setup assistants](13-setup-assistants.md)), and imports are not supported there. An
`import` in one of these files is a build error.

## Shared state is per script, not shared

Importing a value from a shared file does **not** create shared runtime state. The packager folds
the shared file's code into each importing script independently — every script gets its own copy
of the shared file's module scope, fresh on every run.

```js
// src/lib/counter.js
let count = 0;
export const increment = () => ++count;
```

If two scripts both `import { increment } from '../lib/counter.js'`, they are **not** incrementing
the same counter. Each script's build gets its own `let count = 0`, and every run of a script
starts that closure over from scratch anyway — nothing on `this` or in module scope survives
between runs ([execution model](04-worker-runtime-api.md#1-execution-model)). A shared file is a
template for code, not a place to put state.

The same fold-in also means an exported binding is captured once, not live. The generated wrapper
destructures the shared file's return object into the script's scope at fold time, so importing a
mutable `let` gets you its value as of that read — not a reference that updates when the shared
file's own code mutates it later:

```js
export let count = 0;
export const bump = () => { count++; };
// import { count, bump } from './counter.js'
bump(); count; // still 0 — count was read once at fold time
```

Export functions (or an object) instead of a mutable `let`, and read state through a getter
(`export const getCount = () => count;`) if a caller needs the current value.

For anything that must actually persist or be visible across scripts or runs, use the existing
mechanisms: [`this.sessionData`/`this.setSessionData`](04-worker-runtime-api.md) for in-memory
state shared across a plugin's surfaces for the life of the browser session, or
[business/user config](13-setup-assistants.md) for anything that must survive a reload.

## Build-time errors

All of this is caught locally (`npx --yes @kizenapps/cli build`) and by the same validation on the
pull-request check — never at runtime, because the engine never sees an import to fail on:

| Problem | Result |
|---|---|
| Importing a path that does not exist | Build error, naming the importing script and the missing path |
| Importing a name the target file doesn't export | Build error — no silent `undefined` |
| A shared file that fails to parse (a syntax error), reached by an import | Build error (`imports/module-parse`) |
| An import cycle between shared files that a script imports into | Build error |
| Importing another artifact's `script.js`, or any file inside a component directory | Build error |
| A shared file (or a cyclic cluster of them) that no script imports | Build warning, not an error |
| `export` anywhere in a component script | Build error (`imports/script-export`) — see [What changes for existing plugins](#what-changes-for-existing-plugins) |
| Dynamic `import()` / `import.meta` anywhere in a plugin script | Build error (`imports/unsupported-import`) |

## Strict-mode parsing

A script that contains an `import` is parsed as an ES module, which is strict mode. Sloppy-mode-only
syntax in that script — a legacy octal literal (`010`), `with`, duplicate function parameter names —
is a build error (`imports/script-parse`), whose message explains that the script is parsed as an
ES module because it imports, and names the failing construct. The same rule catches duplicate
bindings: importing `val` and also declaring `const val` (or `let val`, `function val`) in the same
script is a duplicate-declaration error, for the same reason a real ES module can't bind the same
name twice. A script with no imports is parsed exactly as it is today and is unaffected.

## IDE support and the top-level `return` caveat

The imports are real ESM syntax, so a plain editor setup — `allowJs`, no special config — resolves
them with go-to-definition and autocomplete, and produces no diagnostics on the import lines
appearing above the script's top-level `await`, top-level `return`, or references to `this`
([execution model](04-worker-runtime-api.md#12-how-the-script-body-is-wrapped)).

If a repo opts into stricter JS checking — `checkJs` in `tsconfig.json`/`jsconfig.json`, or a
`// @ts-check` comment — the checker will flag a script's top-level `return` as `TS1108: A 'return'
statement can only be used within a function body`. That's the checker enforcing normal module
semantics on a file the engine executes as a function body; it isn't specific to shared code, and
it isn't a plugin bug. Either don't opt into `checkJs` for script files, or ignore `TS1108` there.

---

## Gotchas

- **A shared `let`/`const` is not shared state.** The shared file is folded into each importing
  script separately, so every script gets its own copy of its module scope, and every run starts
  fresh. Use `sessionData` or config for anything that must persist or be visible elsewhere. →
  [Shared state is per script, not shared](#shared-state-is-per-script-not-shared)
- **Top-level `await` in a shared file is a build error**, even though it's allowed in a script
  body itself. Do the async work inside an exported function instead. →
  [Import and export rules](#import-and-export-rules)
- **Any `import` makes that script strict-mode-parsed (`imports/script-parse`).** Legacy
  sloppy-only syntax (octal literals, `with`, duplicate parameter names) in a script that imports
  something becomes a build error, and so does importing `val` while also declaring `const val` —
  a duplicate binding, same as a real ES module. → [Strict-mode parsing](#strict-mode-parsing)
- **`checkJs`/`@ts-check` flags every script's top-level `return` as `TS1108`.** That's the checker,
  not a plugin problem — scripts are executed as function bodies, not modules, regardless of
  whether they import anything. → [IDE support and the top-level `return` caveat](#ide-support-and-the-top-level-return-caveat)
- **Importing another artifact's `script.js`, or a helper file inside a component directory, is a
  build error.** Put shared code somewhere that isn't one of the reserved artifact directories —
  `src/lib/` is the convention. → [Where shared code can live](#where-shared-code-can-live)
- **`export`, dynamic `import()`, and `import.meta` are build errors in every plugin script now —
  not just ones using shared code.** A plugin that never touches shared code can still hit
  `imports/script-export` or `imports/unsupported-import` if it happened to contain either
  construct; neither ever worked at runtime. →
  [What changes for existing plugins](#what-changes-for-existing-plugins)
- **An import cycle only errors once a script imports into it.** A cyclic pair of shared files
  that no script reaches gets the unused-file warning, not a cycle error. →
  [Where shared code can live](#where-shared-code-can-live)
- **A shared file with a syntax error is a build error (`imports/module-parse`) once a script
  imports it.** → [Build-time errors](#build-time-errors)
- **The whole shared file's top-level code runs in every importer, not just the exports it
  imported.** Only the imported names enter the script's scope, but every top-level statement in
  the shared file still executes for every importer — keep it pure and cheap, and split unrelated
  helpers into separate files if any one has non-trivial top-level cost. →
  [Import and export rules](#import-and-export-rules)
