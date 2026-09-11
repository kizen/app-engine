# Getting Started: Repo, CLI, and a First Plugin

**What this covers:** the practical on-ramp — the canonical repo layout, the
`@kizenapps/cli` CLI, the local/preview development loop, a minimal-but-complete hello-world
plugin (manifest + one block + one action), and the first-release checklist.

**See also:** [01-overview.md](01-overview.md) (mental model) ·
[03-manifest-reference.md](03-manifest-reference.md) (every manifest field) ·
[16-release-and-publish.md](16-release-and-publish.md) (publish pipeline & versioning) ·
[18-recipes.md](18-recipes.md) (larger worked examples)

---

## Repo anatomy

A plugin repo has no build tooling — no `package.json`, no bundler, no imports. The publish
pipeline reads raw files; the directory layout *is* the declaration:

```
plugin-example/
├── kizen.json                  # manifest (single object, or an array — see below)
├── README.md                   # developer docs (recommended)
├── releaseNotes/
│   └── 1.0.0.md                # user-facing marketplace notes, one file per version
├── .kizenapp/                  # local CLI state — auto-gitignored, never commit
└── src/                        # = manifest "entry"; the directory name is your choice
    ├── thumbnail.png           # required to publish; PNG, at the entry root
    ├── import.kzn              # optional Kizen schema bundle installed with the plugin
    ├── actions/<name>/         #   each artifact = a directory with config.json + scripts
    │   ├── config.json
    │   └── script.js
    ├── automationSteps/<name>/{config.json, script.py}
    ├── blocks/<name>/{config.json, script.js, styles.css, eventScripts/<n>.js}
    ├── pages/<name>/{config.json, script.js, callback.js?, styles.css?, eventScripts/}
    ├── views/<name>/{script.js | index.html, styles.css?, eventScripts/, config.json?}
    ├── floatingFrames/<name>/{config.json, script.js, message.js?, styles.css?, eventScripts/}
    ├── toolbarItems/<name>/{config.json, script.js}
    ├── dataAdornments/<name>/{config.json, script.js}
    ├── objectSettingsItems/<name>/{config.json, script.js}
    ├── routeScripts/<name>/{config.json, script.js}
    ├── calendarSources/<name>/{config.json, calendars.js, events.js}
    ├── setupAssistant/{assistant.json, <fieldKey>/<fn>.js}
    └── userSetupAssistant/{assistant.json, <fieldKey>/<fn>.js}
```

Rules that matter:

- **Scripts are referenced by location, never by name.** `kizen.json` never points at a
  script file; the directory plus reserved filenames (`script.js`, `script.py`, `message.js`,
  `callback.js`, `calendars.js`, `events.js`, `styles.css`, `index.html`,
  `eventScripts/<handler>.js`) are the contract.
- **`config.json` is required** for every artifact directory except `views/`. An artifact's
  `api_name` defaults to a sanitized form of its directory name (lowercased, hyphen/whitespace
  runs collapsed to `_`, every other character outside `[a-z0-9_]` dropped) — **always set
  `api_name` explicitly** so the derived name never surprises you. Per-artifact config fields: [03-manifest-reference.md](03-manifest-reference.md).
- `eventScripts/<name>.js` files are the handlers behind `data-script="<name>"` attributes in
  markup you paint with `outputUI` ([11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)).
- `styles.css` is scoped by the engine to the artifact's own markup — plain selectors are
  safe.
- `src/thumbnail.png` must sit at the first path level under `entry` (a nested
  `src/images/thumbnail.png` is silently ignored). Build succeeds without it; **publish
  fails** without it.
- `.kizenapp/` holds local CLI state (packaged bundle, credential profile, a Python venv for
  running steps locally, a local browser profile). The CLI adds it to `.gitignore`
  automatically — keep it ignored.

**Multi-plugin repos:** `kizen.json` may be a top-level JSON *array* of manifest objects,
each with a unique `api_name` and its own `entry` directory — one repo publishing several
plugins (or prod/dev variants of one). See
[03-manifest-reference.md](03-manifest-reference.md).

---

## The CLI (`@kizenapps/cli`)

The local tool is **`@kizenapps/cli`** (there is no "kizen" CLI for plugin development). Always
invoke it with npx:

```
npx --yes @kizenapps/cli <command>
```

Nothing needs installing first. `--yes` suppresses npx's own "install this package?" prompt, so
fetching the package can't stall a non-interactive shell. Every command in these docs is written in
this form; run them as-is.

One caveat for unattended runs: **`create` is an interactive terminal UI and takes no flags**, so it
needs a real TTY. Without one it exits non-zero with `Raw mode is not supported on the
current process.stdin` and scaffolds nothing — build the [repo layout](#repo-anatomy) by hand instead.
The other commands need no TTY.

Global credentials live in `~/.kizenappbuilder`; per-repo state in `.kizenapp/`.

| Command | What it does for you |
|---|---|
| `npx --yes @kizenapps/cli create` | **Interactive — needs a TTY.** Scaffolds a new plugin: `kizen.json` (version `1.0.0`, `entry: "src/"`, `releaseNotes/` wired), an empty `src/`, and `releaseNotes/`. No artifact templates — add directories yourself. |
| `npx --yes @kizenapps/cli build` | Validates and packages the repo locally with `@kizenapps/packager` — the same rules CI runs — and writes the packaged result to `.kizenapp/bundle.json` (exactly what would be published). Run it before every push to catch `manifest/*` and `structure/*` errors early. |
| `npx --yes @kizenapps/cli dev` | Local dev runner: renders your artifacts against the real engine without publishing, so you can exercise blocks, views, frames, prompts, and run Python Agentic Workflow steps locally (it provisions a venv under `.kizenapp/`). |
| `npx --yes @kizenapps/cli encrypt` | Produces the `{"encrypted": true, "value": "<base64>"}` envelope for a secret value (OAuth `client_secret`, etc.) to paste into `kizen.json`. Defaults to production keys; pass `--stage dev` when targeting dev environments. See [06-auth-secrets-services.md](06-auth-secrets-services.md). |
| `npx --yes @kizenapps/cli icons` | Prints the platform icon set — the authoritative list of valid `icon` values for toolbar items, adornments, and minimized frame triggers. |
| `npx --yes @kizenapps/cli report` | Dumps the whole plugin — manifest, file tree, and full source of every file except `kizen.json` (shown separately) and `LICENSE` — into a self-contained reference. Writes **two** files: the `.html` you name with `-o` (a human viewer) and a `.md` sibling with the same basename (what agents read). Defaults to `~/.kizenappbuilder/examples/<api_name>.{html,md}`. `services[].auth_credentials` values are masked to `*****` and `developer_business_id` is dropped; **nothing else is redacted**. Two reports generated this way are committed under [examples/](examples/README.md). |

---

## The dev loop

1. **Edit → `npx --yes @kizenapps/cli build`.** Local validation is the fast feedback: manifest errors,
   missing `config.json`, bad api_names, duplicate names all fail here with stable rule ids.
2. **`npx --yes @kizenapps/cli dev`** to render and click through surfaces locally against the real engine.

   The viewer has no install flow, so it never emulates the setup-assistant hash or the
   re-prompt-on-enable behavior that
   [view-based setup assistants](13-setup-assistants.md#12-view-based-setup-assistants) depend on.
   Forgetting to call `completeSetup` therefore produces **no local symptom** — the published
   plugin just re-prompts for setup forever.
3. **Push a branch and open a PR → preview build.** Pushes to non-release branches run
   validation only. Opening a PR creates a **preview deployment** in each target environment:
   - version forced to `0.0.0` (never bump versions for preview pushes),
   - `published: false` (installable but unlisted),
   - `api_name` suffixed with a preview/branch marker (so it can't collide with the real
     plugin — and why scripts must use `this.pluginApiName` instead of a hardcoded api_name),
   - installed into your `developer_business_id` business; the PR gets a comment linking each
     environment's marketplace entry.
   Merging or closing the PR deletes the preview. Full mechanics:
   [16-release-and-publish.md](16-release-and-publish.md).
4. **Merge to the release branch** to publish a real version (checklist below).

Preview builds require `developer_business_id` in the manifest — the business (per
environment) that owns dev installs. See
[03-manifest-reference.md](03-manifest-reference.md).

---

## Hello world: manifest + one block + one action

A complete, publishable plugin with a dashboard block and a record action. Six files plus a
thumbnail:

```
plugin-example/
├── kizen.json
├── releaseNotes/1.0.0.md
└── src/
    ├── thumbnail.png
    ├── blocks/helloBlock/
    │   ├── config.json
    │   ├── script.js
    │   ├── styles.css
    │   └── eventScripts/refresh.js
    └── actions/helloAction/
        ├── config.json
        └── script.js
```

### `kizen.json`

```json
{
  "name": "Example Plugin",
  "api_name": "example_plugin",
  "version": "1.0.0",
  "description": "A minimal example: one dashboard block and one record action.",
  "engine": "1.0.0",
  "entry": "src/",
  "release_notes_directory": "releaseNotes/",
  "published": false,
  "developer_business_id": { "go": "<your-developer-business-id>" }
}
```

`engine` is always the literal `"1.0.0"`. `published: false` keeps the plugin unlisted while
you develop. Every other field: [03-manifest-reference.md](03-manifest-reference.md).

### `src/blocks/helloBlock/config.json`

```json
{
  "name": "Hello Block",
  "api_name": "hello_block",
  "types": ["dashboards", "homepages"],
  "min_w": 3,
  "max_w": 12,
  "min_h": 3,
  "max_h": 10,
  "recommended_height": 320
}
```

### `src/blocks/helloBlock/script.js`

The block worker has no DOM access — it paints with `this.outputUI`, and the button's
`data-script="refresh"` wires clicks to `eventScripts/refresh.js`:

```js
const name = this.currentUser?.profile?.first_name || "there";
this.outputUI(`
  <div class="hello-card">
    <h2>Hello, ${name}</h2>
    <p>Painted at ${new Date().toLocaleTimeString()}</p>
    <button data-script="refresh">Refresh</button>
  </div>
`);
```

### `src/blocks/helloBlock/eventScripts/refresh.js`

Each event script runs in a fresh worker; repainting is just calling `outputUI` again:

```js
const name = this.currentUser?.profile?.first_name || "there";
this.outputUI(`
  <div class="hello-card">
    <h2>Hello again, ${name}</h2>
    <p>Refreshed at ${new Date().toLocaleTimeString()}</p>
    <button data-script="refresh">Refresh</button>
  </div>
`);
```

### `src/blocks/helloBlock/styles.css`

The host renders no card chrome for plugin blocks and clips with `overflow: hidden`, and a
global `font-size: 10px` reset leaks in — so paint your own card, inset it, and set explicit
font sizes ([09-blocks.md](09-blocks.md)):

```css
.hello-card {
  margin: 4px;
  height: calc(100% - 8px);
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
  padding: 16px;
  font-size: 14px;
  line-height: 1.4;
}
.hello-card h2 { font-size: 18px; margin: 0 0 8px; }
.hello-card button { font-size: 13px; }
```

### `src/actions/helloAction/config.json`

```json
{
  "name": "Say Hello",
  "api_name": "say_hello",
  "hint_object_name": "client_client"
}
```

`hint_object_name` pre-selects which object the action associates with when a business
installs the plugin; the actual association (and whether it appears in the Perform Action
menu) is install-time configuration, not manifest ([08-actions.md](08-actions.md)).

### `src/actions/helloAction/script.js`

Actions run in a record-detail worker with the current record's context. Use the
`*WithErrors` tuple helpers for all HTTP ([04-worker-runtime-api.md](04-worker-runtime-api.md),
[15-errors-and-observability.md](15-errors-and-observability.md)):

```js
const entity = await this.currentEntity();
if (!entity) {
  this.showToast("No record context available.", { variant: "failure", autohide: false });
  return;
}
this.showToast(`Hello from ${this.pluginApiName}: record ${entity.id}`, {
  variant: "success",
});
```

### `releaseNotes/1.0.0.md`

```md
Initial release: a hello-world dashboard block and a per-record "Say Hello" action.
```

### Run it

- `npx --yes @kizenapps/cli build` — must pass clean.
- `npx --yes @kizenapps/cli dev` — render the block and click Refresh locally.
- Push a branch, open a PR — install the preview build in your developer business, place the
  block on a dashboard, and associate the action with an object from the plugin's setup
  screen.

Where to grow from here: give the block real data via `this.getWithErrors` and
`POST /records/{object}/search` ([05-platform-api.md](05-platform-api.md)); make the action
write back with `this.patchWithErrors` + `this.refreshEntity()`
([08-actions.md](08-actions.md)); collect input with `this.dynamicPrompt` or a modal view
([10-views-modals-forms.md](10-views-modals-forms.md)); add a setup assistant
([13-setup-assistants.md](13-setup-assistants.md)).

---

## First release checklist

Full pipeline detail: [16-release-and-publish.md](16-release-and-publish.md).

1. **Bump `version` in `kizen.json`.** Versions must strictly increase on every release — a
   PR that doesn't bump fails validation, and the backend rejects re-publishing an existing
   version. Bump sizing guidance (what counts as major/minor/patch) is in
   [16-release-and-publish.md](16-release-and-publish.md).
2. **Add `releaseNotes/<version>.md`** matching the new version exactly. Treat it as required
   in every release commit — it becomes the marketplace-visible notes and the release body.
3. **`src/thumbnail.png` exists** (publish hard-fails without it).
4. **Secrets are encrypted.** Any secret value in `kizen.json` (e.g. `services[]` OAuth
   `client_secret`) should be an `npx --yes @kizenapps/cli encrypt` envelope, not plaintext
   ([06-auth-secrets-services.md](06-auth-secrets-services.md)).
5. `npx --yes @kizenapps/cli build` passes clean.
6. Merge/push to the release branch. Production environments publish only from the default
   branch.

---

## Gotchas

- **Always set `api_name` in artifact `config.json`s** — directory-derived api_names lowercase
  everything (`helloBlock` → `helloblock`) and collapse hyphens/whitespace to `_`
  (`team-pulse` → `team_pulse`), which bites anything that references the artifact by name. ([03-manifest-reference.md](03-manifest-reference.md))
- **`thumbnail.png` is build-optional but publish-required**, and only counted at the entry
  root. ([16-release-and-publish.md](16-release-and-publish.md))
- **Don't bump versions on preview/PR pushes** — previews always deploy as `0.0.0`; version
  bumps belong to release merges. ([16-release-and-publish.md](16-release-and-publish.md))
- **No shared helper modules** — each script (including every event script) is an isolated
  body; copy small helpers per script rather than trying to import.
  ([04-worker-runtime-api.md](04-worker-runtime-api.md))
- **Never commit `.kizenapp/`** — it contains local credential/profile state; verify it stays
  gitignored before a repo is made public.
- **A stray `release_branch` (singular) key is silently ignored** — the field is
  `release_branches`; typos don't error, they just get defaults.
  ([03-manifest-reference.md](03-manifest-reference.md))
