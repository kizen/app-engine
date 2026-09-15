# Sharing Code Between Scripts

**What this covers:** importing plain JavaScript helpers into a plugin script from another file in
the same plugin, using ordinary relative ESM `import`/`export` syntax. The packager folds the
imported code into each script at build time, so what ships is unchanged: one self-contained
script body per artifact, exactly the shape the engine has always run. Requires
`@kizenapps/packager` 0.7.0+ (bundled by `npx --yes @kizenapps/cli build`/`dev` and the release
pipeline).

**See also:** [repo anatomy](02-getting-started.md#repo-anatomy) for where shared files live on
disk · [execution model](04-worker-runtime-api.md#1-execution-model) for how a script body is
wrapped and why nothing on `this` survives between runs · [session data](14-navigation-and-communication.md#thissessiondata--thissetsessiondataupdate--communication-semantics)
for the sanctioned way to share *state* across runs · [validation rules](03-manifest-reference.md#10-validation-rules)
for the full rule table · [gotchas](17-gotchas.md#sharing-code) for the consolidated trap list.

---

## Quick reference

The whole feature in one block. Everything below elaborates on these lines.

```js
// src/lib/format.js            ← any .js under entry, outside every artifact directory
export const money = (cents) => `$${(cents / 100).toFixed(2)}`;
export function esc(text) { /* … */ }

// src/blocks/invoice/eventScripts/render.js
import { money, esc } from '../../../lib/format.js';   // relative, ends in .js, named only
this.outputUI(`<p>${esc(name)}: ${money(total)}</p>`);
```

- **Where:** shared files go anywhere under `entry` that is not an artifact directory. Convention: `src/lib/`.
- **Syntax:** `import { a, b as c } from './relative/path.js'` and named `export`s only. No default,
  namespace, side-effect, or dynamic imports; no `export default`, re-exports, or `export *`.
- **Shape at runtime:** each importing script receives its own copy of the shared file's code, folded
  in ahead of the script body. Nothing is loaded at runtime; the engine never sees an `import`.
- **State:** a shared file's top-level variables are **per script, per run** — never shared between
  scripts. Persist through `this.sessionData` or config, not module scope.
- **`this`:** inside a shared file, `this` is the importing script's worker context, so
  `this.getWithErrors(...)`, `this.config`, `this.args` all work.
- **Top level of a shared file:** no `await`, no `return`; keep it pure and cheap — every statement
  in it runs in every importer.
- **Errors are build-time:** every mistake below fails `npx --yes @kizenapps/cli build` and the PR
  check with an `imports/*` rule id. Nothing about shared code can fail at runtime.
- **Setup-assistant field scripts cannot import** (`setupAssistant/<key>/*.js`).
- **Import-free plugins are untouched:** a script with no `import` packages byte-for-byte as before.

## The problem this solves

Every script — a block, an action, an event script, any artifact's `script.js` — is compiled and
run as an isolated function body inside a fresh Web Worker
([execution model](04-worker-runtime-api.md#1-execution-model)). There is no module loader in that
worker, so a small `esc()` or `describeError()` helper, or a wrapper around a repeated fetch call,
used to be copy-pasted into every script that needed it. Real plugins showed the cost: one plugin
carried 47 copies of `esc()` in three drifting variants and four different implementations of the
same `fmtDuration()`.

The runtime constraint has not changed — each script still executes as a standalone body. What
changed is that you no longer have to *author* it that way. The packager does the copying for you,
at build time, from real ESM source, so a helper has exactly one definition in the repo and your
IDE resolves it like any other module.

## Writing shared code

Put plain JavaScript in a `.js` file under the plugin's `entry` directory, outside every artifact
directory, and export what you want to reuse with named exports:

```js
// src/lib/kizenApi.js
const BASE = '/api';

const describe = (err) => err?.message ?? String(err);

export const fetchContact = async (id) => {
  const [contact, err] = await this.getWithErrors(`${BASE}/client/${id}`);

  if (err) {
    throw new Error(`Contact ${id}: ${describe(err)}`);
  }

  return contact;
};
```

Import it from a script with a normal relative import:

```js
// src/actions/summarize/script.js
import { fetchContact } from '../../lib/kizenApi.js';

const contact = await fetchContact(this.entityId);

return { contact };
```

Nothing declares the shared file anywhere — not `kizen.json`, not any `config.json`. The import
statement is the whole declaration, and because it is real ESM syntax your editor resolves it with
no project setup: go-to-definition and autocomplete on `fetchContact` just work.

### What the packager ships

At build time the packager resolves the import, wraps the shared file's body in an immediately
invoked arrow function that returns its exports, hoists that wrapper above the script, and rewrites
the import into a destructure of the wrapper's result. Conceptually, the action above ships as:

```js
const __lib_kizenApi = (() => {
  const BASE = '/api';
  const describe = (err) => err?.message ?? String(err);
  const fetchContact = async (id) => { /* … */ };
  return { fetchContact };
})();

const { fetchContact } = __lib_kizenApi;

const contact = await fetchContact(this.entityId);

return { contact };
```

Then the whole thing is minified like any other script. Three consequences fall out of this shape
and explain most of the rules below:

1. **Privacy of names.** `BASE` and `describe` stay inside the wrapper. The script can declare its
   own `const BASE` without colliding, and only the names between `import {` and `}` enter its
   scope.
2. **One copy per importing script.** Each script's build gets its own wrapper. Two scripts
   importing the same file do not share the wrapper's variables (see
   [Shared state is per script](#shared-state-is-per-script-not-shared)).
3. **Import bindings are hoisted, like ESM.** The destructures are emitted at the top of the
   compiled body regardless of where the `import` line sits, so a hoisted `function` declared
   above the import can call an imported helper. Grouping imports at the top is still the
   readable convention.

A shared file can import other shared files. Each distinct file is emitted once per script, in
dependency order, so a "diamond" (script imports `a` and `b`, both of which import `c`) evaluates
`c` once for that script.

### Where shared code can live

Anywhere under `entry` that is **not** an artifact directory. The reserved artifact directories are
`blocks/`, `actions/`, `pages/`, `views/`, `floatingFrames/`, `routeScripts/`, `toolbarItems/`,
`objectSettingsItems/`, `dataAdornments/`, `calendarSources/`, `automationSteps/`,
`setupAssistant/`, and `userSetupAssistant/` ([repo anatomy](02-getting-started.md#repo-anatomy)).
Anything else — `src/lib/`, `src/lib/demo/`, `src/shared/`, a file directly under `src/` — is a
shared-file location. Use `src/lib/` unless you have a reason not to.

Three things cannot be imported, each a build error:

- **A file inside an artifact directory** — another artifact's `script.js`, or a helper dropped
  into `blocks/<name>/helpers.js`. Component scripts are compiled and shipped on their own
  (`imports/component-script`). Move the helper out to `src/lib/`.
- **A file outside `entry`** — including another plugin's files in a multi-plugin repo
  (`imports/outside-entry`). Each plugin shares only within its own entry directory. Two plugins
  that need the same helper keep two copies, or share one entry directory (two manifest entries may
  point at the same `entry`; one entry may not be nested inside another — `manifest/nested-entry`).
- **A package name** — `import { x } from 'lodash'`. There is no `node_modules` resolution
  (`imports/bad-specifier`).

### Import and export rules

Exactly one import shape is supported:

```js
import { a, b as c } from './relative/path.js';
```

- The specifier is relative (`./` or `../`) and includes the `.js` extension.
- Only named imports; aliasing with `as` is fine.

Not supported (build error, `imports/unsupported-import` unless noted):

| Form | Why |
|---|---|
| `import x from './y.js'` | No default exports exist to bind to. |
| `import { default as x } from './y.js'` | Same restriction, spelled as a named import. |
| `import * as ns from './y.js'` | Namespace objects are not emitted. |
| `import './y.js'` | A shared file only runs when a binding is imported from it. |
| `import { "string name" as x }` | Bindings are identifiers. |
| `import('./y.js')` | Imports are compiled away; nothing exists to resolve at runtime. |
| `import.meta` | A script is a function body, not a module; it has no metadata. |
| `import { x } from 'pkg'` | `imports/bad-specifier` — only files inside `entry` resolve. |

A shared file's exports are equally narrow — named exports only:

```js
export const fetchContact = async (id) => { /* … */ };
export function describeError(err) { /* … */ }
export class Cache { /* … */ }
export { helperA, helperB as helperC };
```

Not supported (build error, `imports/unsupported-export`):

| Form | Why |
|---|---|
| `export default …` | Deferred; the anonymous forms would lose hoisting under the rewrite. |
| `export { x as default }` | Same restriction, spelled as a named export. |
| `export { a } from './other.js'` / `export * from './other.js'` | Import the names and export them yourself. |
| `export { x as "string name" }` | Exports are identifiers. |
| `export const __proto__ = …` (any spelling) | The export surface is an object literal, where a `__proto__` key sets the prototype instead of defining a property. Rename it. |

### The top level of a shared file

Because the file's body becomes a wrapper function, two statements that are legal in a component
script are errors in a shared file:

- **Top-level `await`** (`imports/top-level-await`). The wrapper is synchronous so every import
  site stays synchronous. Put the `await` inside an exported `async` function and call it from the
  script.
- **Top-level `return`** (`imports/top-level-return`). The wrapper's return value *is* the export
  surface, so a stray `return` replaces it and every import comes back `undefined`. Move the
  `return` inside a function.

And one thing that is legal but costly: **every top-level statement in a shared file runs in every
importer**, whether or not it produced a name that importer asked for. Privacy is about *names*, not
*execution*.

```js
// src/lib/kizen.js
export const CONFIG_ENDPOINT = `/api/plugins/${this.pluginApiName}/config`;   // runs in every importer
export const UNREADABLE = 'unreadable';
```

A script that imports only `UNREADABLE` still evaluates `CONFIG_ENDPOINT`'s template — and touches
`this.pluginApiName` doing it — before any of its own code runs. Keep a shared file's top level
pure and cheap: constants, function and class definitions, nothing that can throw, no I/O. Put real
work inside the exported functions. If one helper has non-trivial top-level cost, give it its own
file rather than piling it in with unrelated helpers.

### `this` inside a shared file

`this` in a shared file is the importing script's `this` — the same worker context, because the
wrapper is an arrow function and inherits it. A shared helper can call `this.getWithErrors(...)`,
read `this.config` or `this.args`, paint with `this.outputUI(...)`, exactly as if the code were
written in the script. Two cautions:

- What is *on* `this` depends on the surface that imported the file
  ([per-script-kind matrix](04-worker-runtime-api.md#2-script-kinds-context-and-args)). A helper
  that reads `this.entityId` works from an action and returns `undefined` from a block. Write
  shared helpers against the smallest context you expect, or pass what they need as arguments.
- Plain `function` declarations (not arrows) inside a shared file get their own `this` when called,
  same as anywhere in JavaScript. Use arrows, or pass the context explicitly.

## Shared state is per script, not shared

Importing a value from a shared file does **not** create shared runtime state. Each importing
script receives its own copy of the shared file's module scope, and every run of that script
starts it from scratch — the same rule that already governs everything else in a worker
([execution model](04-worker-runtime-api.md#11-one-fresh-worker-per-script-run)).

```js
// src/lib/counter.js
let count = 0;
export const increment = () => ++count;
```

If a block's `script.js` and its `eventScripts/click.js` both import `increment`, they are not
incrementing the same counter: each script has its own `let count = 0`, re-created on every run. A
shared file is a template for code, not a place to put state. For anything that must persist or be
visible across scripts or runs, use
[`this.sessionData` / `this.setSessionData`](14-navigation-and-communication.md#thissessiondata--thissetsessiondataupdate--communication-semantics)
for the browser session, or [business/user config](13-setup-assistants.md) for anything that must
survive a reload.

### Exported bindings are snapshots, not live bindings

This is the one place the feature deliberately differs from real ESM, and the packager warns about
it. The importing script destructures the wrapper's return object once, when the wrapper runs. An
exported `let` that the shared file later reassigns does not update in the importer:

```js
// src/lib/state.js
export let count = 0;
export const bump = () => ++count;
export const read = () => count;

// script.js
import { count, bump, read } from '../../lib/state.js';
bump();
bump();
return { imported: count, live: read() };   // { imported: 0, live: 2 }
```

The packager reports `imports/mutable-export` (a **warning**) on `count`: it is exported, it is a
`let`/`var`/`function`/`class` binding, and something reachable from an export reassigns it after
initialization. The fix is the pattern in `read()` — keep the mutable binding private and export a
function that reads it. A `const` holding an object is not flagged: object mutation is shared by
reference and behaves as expected within the script.

## What changes for existing plugins

The packager now parses every plugin script to check for imports and exports, so a handful of
rules fire even in a plugin that never writes an `import`:

- **`export` anywhere in a component script** is a build error (`imports/script-export`). Only a
  shared file may export.
- **Dynamic `import()` and `import.meta` anywhere in a plugin script** are build errors
  (`imports/unsupported-import`).
- **References to browser-page or Node.js globals** — `window`, `document`, `localStorage`,
  `alert`, `require`, and friends — are build errors (`runtime/unavailable-global`). This is not
  about imports at all; it landed in the same release because the packager now has a parse of every
  script to check against. See [worker globals](04-worker-runtime-api.md#1-execution-model) and
  [gotchas](17-gotchas.md#workers--http).

None of these ever worked at runtime — the engine compiles a script body with `new AsyncFunction`,
which rejects a top-level `export`, has no module to resolve `import()` against, and runs in a Web
Worker with no `window`. Before 0.7.0 each one broke the script at runtime, silently or with an
opaque syntax error; now the build names the file and line. A plugin free of all three constructs
is unaffected, and its packaged output is byte-identical to the previous release's.

### Setup-assistant field scripts cannot import

`setupAssistant/<key>/*.js` and `userSetupAssistant/<key>/*.js` are arrow-function *expressions*
that the packager wraps into a self-invoking call and the engine evaluates in the expression worker
([setup assistants](13-setup-assistants.md#8-per-field-scripts)) — not script bodies. An `import` in
one of them is a build error (`imports/assistant-script`). Inline what they need; they are meant
to be one expression long.

## Migrating a plugin with duplicated helpers

The feature pays off most on an existing plugin whose scripts each carry their own copy of the
same helpers. A migration that went smoothly on a 50-file plugin:

1. **Inventory the copies first.** Grep for the helper's name and diff the bodies. Byte-identical
   copies are safe to consolidate. Copies that have drifted (`String(s)` vs `String(s ?? "")`) are
   different behavior — unifying them changes rendered output, so either pick one deliberately or
   leave them.
2. **Move identical copies into `src/lib/<concern>.js`** — `html.js` for `esc()`, `kizen.js` for
   endpoint constants and response helpers — and replace each copy with an import. Keep files small
   and by concern, because every importer evaluates the whole file.
3. **Leave helpers that close over per-script constants.** A `paintWorking()` whose body is
   identical but reads a per-file `TITLE` can't move without becoming a parameterized function;
   do that as a separate refactor.
4. **Build, then diff `.kizenapp/bundle.json`.** Only the scripts you edited should change; every
   other packaged script is byte-identical. That is the check that nothing leaked.
5. **Watch for `imports/mutable-export` warnings** — a helper that kept per-file state in a
   top-level `let` needs the getter pattern once it is shared.

### A prompt for handing the migration to an agent

Paste this into a coding agent opened at the plugin repo root. It encodes the steps above and the
two checkpoints that matter: the inventory review before anything moves, and the bundle diff as
proof that nothing else changed.

````markdown
Refactor this Kizen plugin to share code between scripts using the packager's import/export support.

## Context you need first

Read `19-sharing-code-between-scripts.md` from the Kizen plugin developer docs before touching
anything. The short version:

- Plugin scripts run as isolated bodies in Web Workers. There is no runtime module system.
- A script may `import { name } from '../../lib/file.js'` from a plain `.js` file under the
  manifest `entry` directory (normally `src/`) that is NOT inside an artifact directory
  (`blocks/`, `actions/`, `pages/`, `views/`, `floatingFrames/`, `routeScripts/`, `toolbarItems/`,
  `objectSettingsItems/`, `dataAdornments/`, `calendarSources/`, `automationSteps/`,
  `setupAssistant/`, `userSetupAssistant/`). Convention is `src/lib/`.
- The packager inlines the shared file into every importer at build time. This shares CODE, not
  STATE: a shared file's top-level `let` is per script, per run. Exported bindings are snapshots.
- Named imports and named exports only. Relative specifiers ending in `.js`. No default,
  namespace, side-effect, or dynamic imports; no `export default`, re-exports, or `export *`.
- No top-level `await` or `return` in a shared file. Every top-level statement in a shared file
  runs in every importer, so keep it to constants and function/class definitions.
- `this` inside a shared file is the importing script's worker context.
- Setup-assistant per-field scripts (`setupAssistant/<key>/*.js`) and Python steps
  (`automationSteps/*/script.py`) cannot import. Leave them alone.
- Requires `@kizenapps/packager` 0.7.0+, which `npx --yes @kizenapps/cli build` bundles.

## Procedure

1. **Baseline.** Run `npx --yes @kizenapps/cli build` and copy `.kizenapp/bundle.json` to
   `/tmp/bundle-before.json`. If the build fails, stop and report — do not refactor a broken build.

2. **Inventory duplicated code.** Search every `.js` under `entry` for functions and constants
   defined in more than one file (helpers like `esc`, `describeError`, `fmtDate`, endpoint
   constants, header builders). For each name, group the copies by exact body text. Produce a
   table: name, number of copies, number of distinct variants, files. Show me this table and wait
   for my go-ahead before moving anything.

3. **Consolidate only byte-identical copies.** For each name whose copies are all identical:
   - Create or extend a shared file under `src/lib/`, one file per concern (`html.js` for
     escaping/markup helpers, `kizen.js` for endpoint constants and response helpers, `format.js`
     for dates/money/strings, etc.). Export with `export const` / `export function`.
   - Replace every copy with `import { name } from '<relative path>/lib/<file>.js'` at the top of
     the script, and delete the local definition.
   - Do not touch names whose copies differ, even trivially (`String(s)` vs `String(s ?? "")`).
     Divergent copies are different behavior; list them in your report as follow-ups instead.
   - Do not move a helper that reads a per-file constant or variable from its enclosing script
     (e.g. `paintWorking()` using a file-local `TITLE`). Turning it into a parameterized function
     is a separate refactor.
   - Do not move a helper that keeps state in a top-level `let` unless you also convert readers to
     an exported getter. A reassigned exported `let` produces `imports/mutable-export`.

4. **Keep shared files pure.** Nothing in a shared file's top level may do I/O, throw, `await`,
   `return`, or read `this` outside a function body. If a constant needs `this` (for example an
   endpoint built from `this.pluginApiName`), export a function that builds it.

5. **Verify.**
   - `npx --yes @kizenapps/cli build` must pass with zero errors.
   - Diff `.kizenapp/bundle.json` against `/tmp/bundle-before.json`. Every script whose source you
     did NOT edit must be byte-identical. Scripts you did edit should differ only by the inlined
     helper. Any other difference is a bug — investigate before continuing.
   - Ensure no `.js` file under `src/lib/` (or any other shared location) is left unimported.
   - If the plugin has `npx --yes @kizenapps/cli dev` surfaces you can render, render one block or
     view that imports a helper and confirm it paints.

6. **Do not** bump `version` or add release notes unless I ask; this refactor is behavior-neutral.
   Do not create branches or commit.

## Report

When finished, give me: the inventory table; the shared files created and what each exports;
files changed count and copies removed; the divergent-variant names you deliberately left with
their file lists; the bundle diff summary (N scripts changed, all others identical); and any
`imports/*` warnings the PR check will raise (the CLI prints errors only, so call these out).
````

## Diagnostics

Everything is caught locally by `npx --yes @kizenapps/cli build` and by the same validation on the
pull-request check; the message names the file and the 1-based `line:column`. Errors fail the
build; warnings do not.

| Rule | Severity | Trigger | Fix |
|---|---|---|---|
| `imports/bad-specifier` | error | Specifier is not a relative path ending in `.js` (a package name, an absolute path, a missing extension). | Use `./` or `../` and include `.js`. |
| `imports/unsupported-import` | error | Default, namespace, side-effect, or string-named import; `import { default as x }`; dynamic `import()`; `import.meta`. | Use `import { a, b as c }` from a static relative path. |
| `imports/outside-entry` | error | The resolved path is outside the plugin's `entry` directory. | Move the file under `entry`. |
| `imports/missing-file` | error | The resolved path is not a file in the plugin. | Create it, or fix the specifier. |
| `imports/component-script` | error | The target is inside an artifact directory. | Move the shared code to `src/lib/`. |
| `imports/missing-export` | error | The target does not export the imported name. The message lists what it does export. | Fix the name, or add `export` to the declaration. |
| `imports/unsupported-export` | error | `export default`, `export { x as default }`, a re-export, `export *`, a string export name, or `__proto__` as an export name. | Use plain named exports. |
| `imports/top-level-await` | error | `await` (or `for await`) at the top level of a shared file. | Move it into an exported `async` function. |
| `imports/top-level-return` | error | `return` at the top level of a shared file. | Move it into a function. |
| `imports/mutable-export` | **warning** | An exported `let`/`var`/`function`/`class` is reassigned after initialization by code reachable from an export, so importers read a stale snapshot. | Keep the binding private; export a getter. |
| `imports/script-export` | error | `export` in a component script. | Move the code to a shared file, or delete the `export`. |
| `imports/assistant-script` | error | `import` in a setup-assistant field script. | Inline the code. |
| `imports/module-parse` | error | A shared file that some script imports fails to parse as JavaScript. | Fix the syntax error (the message includes acorn's). |
| `imports/script-parse` | error | A script that imports something fails to parse as an ES module — strict mode. See [Strict-mode parsing](#strict-mode-parsing). | Fix the construct the message names. |
| `imports/cycle` | error | Shared files that a script imports into import each other in a cycle. The message prints the chain. | Move the code they share into a third file neither imports. |
| `imports/unused-module` | **warning** | A shared file no script imports. It ships nothing. | Import it, or delete it. |

Two behaviors of the table worth knowing:

- **Errors are independent.** A missing file in one script does not suppress a missing export in
  another; each importer is checked on its own, and a script with an error still lets every other
  script compile.
- **A cycle only errors once a script imports into it.** A cyclic pair of shared files that no
  script reaches gets `imports/unused-module` on each file instead.

## Strict-mode parsing

A script that contains an `import` is *parsed* as an ES module, which is strict mode. Sloppy-only
syntax in that script — a legacy octal literal (`010`), `with`, duplicate function parameter names —
is a build error (`imports/script-parse`) whose message names the construct. The same rule catches
duplicate bindings: importing `val` and also declaring `const val` (or `let val`, `function val`)
in the same script is a duplicate-declaration error, exactly as in a real ES module. A script with
no imports is parsed as before and is unaffected.

Parsing strict does not make the code *run* strict. The engine compiles every script body with
`new AsyncFunction`, which is sloppy, and the minifier strips a top-level `"use strict"` directive
in any case — so a plain `function` inside a shared file that reads `this` gets the worker global,
not `undefined`, and an assignment to an undeclared name creates a global instead of throwing. Use
arrow functions and declare your variables; the packager's `runtime/unavailable-global` rule catches
the most common accidental global (`window = …`) at build time.

## IDE support and the top-level `return` caveat

The imports are real ESM syntax, so a plain editor setup — `allowJs`, no special config — resolves
them with go-to-definition and autocomplete, and produces no diagnostics on import lines appearing
above the script's top-level `await`, top-level `return`, or references to `this`
([how the body is wrapped](04-worker-runtime-api.md#12-how-the-script-body-is-wrapped)).

If a repo opts into stricter JS checking — `checkJs` in `tsconfig.json`/`jsconfig.json`, or a
`// @ts-check` comment — the checker flags a script's top-level `return` as `TS1108: A 'return'
statement can only be used within a function body`. That is the checker enforcing module semantics
on a file the engine executes as a function body; it is not specific to shared code and not a
plugin bug. Either leave `checkJs` off for script files, or ignore `TS1108` there.

---

## Gotchas

- **A shared file's `let`/`const` is not shared state.** Every importing script gets its own copy
  of the module scope, and every run starts fresh. Use `sessionData` or config for anything that
  must persist or be visible elsewhere. →
  [Shared state is per script](#shared-state-is-per-script-not-shared)
- **An exported `let` is a snapshot (`imports/mutable-export`).** `bump()` inside the shared file
  changes the shared file's `count`; the importer's `count` stays what it was at import. Export a
  getter. → [Exported bindings are snapshots](#exported-bindings-are-snapshots-not-live-bindings)
- **The whole shared file's top level runs in every importer**, not just the exports it asked for.
  Keep it pure and cheap; split files by concern. →
  [The top level of a shared file](#the-top-level-of-a-shared-file)
- **Top-level `await` and top-level `return` are build errors in a shared file**, though both are
  fine in a script body. Move them into functions. →
  [The top level of a shared file](#the-top-level-of-a-shared-file)
- **`this` in a shared helper is whatever surface imported it.** `this.entityId` exists in an
  action and not in a block. Pass context as arguments when a helper spans surfaces. →
  [`this` inside a shared file](#this-inside-a-shared-file)
- **Any `import` makes that script strict-mode-parsed (`imports/script-parse`).** Legacy octal
  literals, `with`, duplicate parameter names, and importing `val` while also declaring `const val`
  all become build errors in a script that imports. → [Strict-mode parsing](#strict-mode-parsing)
- **Importing another artifact's `script.js`, or a helper file inside an artifact directory, is a
  build error.** Shared code lives outside every artifact directory — `src/lib/` by convention. →
  [Where shared code can live](#where-shared-code-can-live)
- **`export`, dynamic `import()`, and `import.meta` are build errors in every plugin script**, not
  just ones using shared code. Neither ever worked at runtime. →
  [What changes for existing plugins](#what-changes-for-existing-plugins)
- **`__proto__` cannot be an export name.** The export surface is an object literal; a `__proto__`
  key there sets the prototype and the export silently vanishes. →
  [Import and export rules](#import-and-export-rules)
- **A cycle only errors once a script imports into it**; an unreached cyclic pair gets the
  unused-module warning instead. → [Diagnostics](#diagnostics)
- **Setup-assistant field scripts cannot import.** They are single expressions evaluated in the
  expression worker, not script bodies. →
  [Setup-assistant field scripts cannot import](#setup-assistant-field-scripts-cannot-import)
- **`checkJs`/`@ts-check` flags every script's top-level `return` as `TS1108`.** That is the
  checker, not a plugin problem. →
  [IDE support and the top-level `return` caveat](#ide-support-and-the-top-level-return-caveat)
- **`npx --yes @kizenapps/cli build` prints errors, not warnings.** `imports/mutable-export` and
  `imports/unused-module` surface on the pull-request check; a clean local build is not evidence of
  zero warnings. → [Diagnostics](#diagnostics)
