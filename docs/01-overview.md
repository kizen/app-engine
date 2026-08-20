# Kizen Plugin Platform — Overview

**What this covers:** the mental model for Kizen plugins — what a plugin is, how its scripts
execute (web workers, the host bridge, the frame proxy), the full catalog of surfaces a plugin
can extend, the publish/install lifecycle, how configuration flows into scripts, and the
security model. Start here, then go to [02-getting-started.md](02-getting-started.md) to build
one.

**See also:** [02-getting-started.md](02-getting-started.md) ·
[03-manifest-reference.md](03-manifest-reference.md) ·
[04-worker-runtime-api.md](04-worker-runtime-api.md) · [glossary.md](glossary.md) ·
[README.md](README.md) (doc index)

> This doc set is the source of truth for building Kizen plugins. For general platform
> documentation (environments, auth headers, the public REST API reference), use the Kizen
> docs MCP.

---

## What a plugin is

A Kizen plugin ("plugin app") is a git repo that packages three kinds of things:

1. **A manifest** — `kizen.json` at the repo root. It carries the plugin's identity
   (`api_name`, `name`, `version`), marketplace metadata, external `services` declarations
   (OAuth/API credentials the proxy uses), `base_config` (declared secrets and baseline
   config), and the optional `setup_assistant` / `user_setup_assistant` definitions.
   `kizen.json` may also be a JSON **array** of manifests — one repo publishing several
   plugins. Full field reference: [03-manifest-reference.md](03-manifest-reference.md).
2. **Artifact directories** — everything else a plugin does is declared by **directory
   convention** under the manifest's `entry` directory (conventionally `src/`), *not* listed
   in the manifest. Each artifact is a directory holding a `config.json` plus scripts with
   reserved filenames (`script.js`, `script.py`, `eventScripts/<name>.js`, `styles.css`,
   `message.js`, `callback.js`, `calendars.js`, `events.js`, `index.html`). The directory
   name determines the surface: `blocks/`, `actions/`, `automationSteps/`, `floatingFrames/`,
   `pages/`, `views/`, `toolbarItems/`, `dataAdornments/`, `objectSettingsItems/`,
   `routeScripts/`, `calendarSources/`, `setupAssistant/`, `userSetupAssistant/`.
3. **Scripts** — bare script bodies (JavaScript for browser surfaces, Python for
   Agentic Workflow steps). There is no module system, no bundler, no `package.json`: each
   script file is a self-contained body that the platform wraps and executes. JavaScript
   scripts are minified at package time; Python step scripts ship verbatim.

Publishing packages the repo (`@kizenapps/packager` does validation + packaging; the publish
pipeline runs on every push — see [16-release-and-publish.md](16-release-and-publish.md)) and
creates an immutable **version** of the plugin in each target environment. Businesses then
**install** the plugin from the Marketplace; each install is a per-business record (the
"business plugin app") carrying that business's configuration. `published: true` lists the
plugin publicly in the Marketplace; `published: false` publishes it unlisted
(install-by-URL/dev use).

---

## Execution architecture: workers and the host bridge

Plugin JavaScript never runs on the page's main thread and never touches the DOM. The engine
(`@kizenapps/engine`, currently 1.9.1 — note the manifest `engine` field is a fixed `"1.0.0"`,
see [03-manifest-reference.md](03-manifest-reference.md)) runs every script in a dedicated
**web worker**:

```
┌────────────────────────── Kizen host app (browser) ──────────────────────────┐
│  surface mount / click / route change                                        │
│        │                                                                     │
│        ▼                                                                     │
│  WorkerManager ── spawns one isolated Web Worker per script execution        │
│        ▲   │            (script body wrapped in an async function,          │
│        │   │             `this` = the worker context API)                    │
│        │   ▼                                                                 │
│   JSON postMessage bridge: this.get/post…, outputUI, showToast, prompts,    │
│   navigation, session data — every `this.*` call is a message the host      │
│   executes and answers                                                       │
│        │                                                                     │
│        ▼                                                                     │
│  outputUI → sanitized HTML into the surface's output region                  │
│  outputIframe → <iframe> routed through the frame proxy                      │
│         (https://plugin-assets.kizen.com / plugin-assets.kizen.dev)          │
└──────────────────────────────────────────────────────────────────────────────┘
```

The load-bearing consequences:

- **Every execution is a fresh worker.** Nothing on `this`, and no closure/module state,
  survives between a script and its event scripts, or between two runs. State persists only
  in the painted DOM, `this.sessionData` (in-memory, per plugin, per browser session), user
  config, or the backend. Event scripts are isolated units — there are no shared helper
  modules; duplicating small helpers per script is the correct pattern.
- **All I/O goes through the bridge.** `this.*` methods (`getWithErrors`, `showToast`,
  `dynamicPrompt`, `openWindow`, …) are JSON `postMessage` calls the host executes.
  Relative-URL HTTP calls are authenticated Kizen API requests made by the host as the
  acting user; absolute URLs are plain `fetch` from the worker. Full API:
  [04-worker-runtime-api.md](04-worker-runtime-api.md).
- **UI is paint-only.** `this.outputUI(markup)` replaces the surface's output region with
  DOMPurify-sanitized HTML (`<script>` tags and inline handlers are stripped). Interactivity
  comes exclusively from `data-script="<name>"` attributes wiring clicks/submits to
  `eventScripts/<name>.js` — each invocation again a fresh worker. See
  [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md).
- **Iframes go through the frame proxy.** `this.outputIframe(url, allow?)` (and iframe-type
  pages) embed third-party content via a dedicated proxy origin
  (`plugin-assets.kizen.com` / `plugin-assets.kizen.dev`). The proxy isolates third-party
  content from the Kizen origin, sandboxes the inner frame, scopes device permissions
  (microphone, camera, …) per plugin, and normalizes the postMessage channel: messages from
  the framed page arrive attributed with your `plugin_api_name`, and floating-frame
  `message.js` handlers receive them as `this.args.eventData`. See
  [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md).
- **Python is different.** Agentic Workflow steps (`automationSteps/`) do not run in the
  browser at all — they execute server-side in an isolated runtime, authenticated as a
  per-plugin service account, with injected `inputs` / `outputs` / `secrets` / `kizen`
  builtins. See [07-automation-steps.md](07-automation-steps.md).
- **Everything hangs off one bootstrap call, and its failure is silent.** The host loads every
  enabled install — config, user config, and all artifact definitions — from a single
  `GET /external-integrations/bootstrap`. What that call returns is what renders; there is no
  per-surface fallback. See below.

### When bootstrap fails, your plugin does not exist

The bootstrap fetch is retried a few times and then **swallowed**. The failure is not thrown to an
error boundary, not toasted, and not reported to monitoring — the query settles into an ignored
error state and the plugin map defaults to `{}`.

Every downstream surface list is derived from that map, so all of them become empty at once:
toolbar items, floating frames, adornments, calendar sources, route scripts, blocks, and workflow
steps. Nothing renders, and nothing says why.

Worse, the host is *confident* about it. The loading flag reports "fetched", so consumers commit to
the empty result rather than staying in a loading state, and they explain it wrongly:

- A placed dashlet renders "This block is no longer available. The app that created it may not be
  enabled."
- Navigating to a plugin page shows **"Plugin Not Found — Error code: 404."**

Both messages describe an uninstalled plugin. Neither is true; the plugin is installed and enabled,
and one HTTP request failed. When a user reports that a plugin "disappeared" or was "uninstalled,"
check the network tab for a failed `bootstrap` call before investigating the install.

This is also why there is no partial-degradation story to design against: you cannot detect the
condition from inside a script, because your scripts never run.

---

## Surface catalog

Every surface below is declared as a directory under `entry` (see
[02-getting-started.md](02-getting-started.md#repo-anatomy) for the tree).

Most, but **not all**, can carry a `when` clause gating them on install config. Seven surfaces
read `when`: blocks, floating frames, data adornments, toolbar items, Agentic Workflow steps, object
settings items, and calendar sources. The rest do not: **actions, pages, views, and route scripts**
have no `when` at all, and a `when` key in one of their `config.json` files is ignored silently
rather than rejected. Gate those from inside the script instead.

### Agentic Workflow steps — [07-automation-steps.md](07-automation-steps.md)
Python steps that appear in the Agentic Workflow builder like native steps. Each declares
typed `inputs`/`outputs` (mapped to record fields, variables, or static values by the
workflow builder), optional `secrets`, and a `script.py` executed server-side per workflow
run. This is how plugins participate in backend Agentic Workflows.

### Actions — [08-actions.md](08-actions.md)
Per-record JavaScript ("JS actions") run from a record's action menus with full record
context (`this.objectId`, `this.entityId`, `currentEntity()`). Businesses associate an action
with objects at install time; associations can add it to the bulk **Perform Action** menu
(`include_perform_action`) or make it the object's create-record override
(`action_override_create` — the script returns the created record's id as a string). Both of
those switches are install-time/host-side settings, not manifest fields.

### Blocks — [09-blocks.md](09-blocks.md)
Custom content blocks ("dashlets") placeable on dashboards, homepages, chart groups, and
record layouts (`types: ["dashboards" | "homepages" | "charts" | "records"]`). The host
renders **no card chrome** — transparent, borderless, shadowless (unless the user toggles
drop shadow), clipped by `overflow: hidden` — so blocks paint their own card.

### Views and pages — [10-views-modals-forms.md](10-views-modals-forms.md)
Routable pages (`pages/`) are full-screen surfaces at `/plugins/{plugin_api_name}/{api_name}`
(script, HTML, or iframe type; optionally projected into the toolbar). Views (`views/`) are
the same underlying artifact, packaged for use as modal content via
`this.showViewInModal(viewApiName, …)` — the primary way plugins collect form input.
`this.outputView(viewId)` is **not supported** end-to-end; use `showViewInModal` instead.

### Floating frames — [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)
Persistent, draggable/pinnable overlay windows (dialers, chat widgets). Script-rendered or
iframe-embedded, with a `message.js` handler for messages posted by the framed page,
`match`/`ignore` route patterns, minimized styles, and frame-only controls
(`hide/show/expand/collapse/hideHeader/showHeader`).

### Toolbar items — [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)
Global navigation entries (icon + label) that run a script on click (no record context).
Routable pages can also project themselves into the toolbar with `is_toolbar_item: true` —
those navigate instead of running a script.

### Data adornments — [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)
One-click icons rendered next to every populated field of a configured `field_type`
(`phonenumber`, `date`, `datetime`) on record pages. The script receives
`{value, fieldId, fieldType, objectId, entityId}`; its return value is discarded — mutate via
the API and `this.refreshEntity()`.

### Object settings items — [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)
Menu entries appended to an object's settings dropdown on its records page. Run with
`this.objectId` (no entity context).

### Calendar sources — [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)
External calendars merged into the Kizen calendar. Two scripts: `calendars.js` returns the
pickable calendar list; `events.js` returns events (epoch-ms times) per calendar and date
range — typically fetching through a user-level OAuth service.

### Route scripts — [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)
Scripts fired on navigation to a bound object's record-detail routes (optionally filtered by
route regexes). Can be installed as **blocking** — the page holds rendering until the script
settles or calls `this.releaseBlockingScript()` — for fetch-and-merge-on-navigation patterns.

### Setup assistants — [13-setup-assistants.md](13-setup-assistants.md)
Configuration wizards: `setup_assistant` (business-level, shown at install) and
`user_setup_assistant` (per-user). Usually **declarative** — a field list the host renders, with
text, select (static or async-fetched), object and field pickers, booleans, images, QR codes and
links, `when` visibility expressions, service-authorization prerequisite steps and action-to-object
mapping. Either slot can instead name a **view** the plugin ships, which draws its own setup UI and
saves it with `this.completeSetup()`; the host then renders no chrome, no OAuth step and no Save
button.

---

## Plugin lifecycle

1. **Author** — write `kizen.json` + artifact directories. Iterate locally with the
   `@kizenapps/cli` CLI (`npx --yes @kizenapps/cli <command>`): build/validate, and render surfaces against the real
   engine without publishing. See [02-getting-started.md](02-getting-started.md).
2. **Validate** — every push runs manifest + structure validation (packager rules: required
   fields, api_name format, per-artifact config requirements) as CI checks; PRs additionally
   enforce version discipline. Failures block. Rule catalog:
   [03-manifest-reference.md](03-manifest-reference.md) and
   [16-release-and-publish.md](16-release-and-publish.md).
3. **Preview** — opening a PR creates a **preview build** per environment: version forced to
   `0.0.0`, `published: false`, and the `api_name` suffixed with a preview/branch marker. It
   installs into your developer business (`developer_business_id`) for real-environment
   testing; closing the PR deletes it. See
   [16-release-and-publish.md](16-release-and-publish.md).
4. **Publish** — pushing to a release branch publishes a real version to the manifest's
   release environments. The version must strictly increase on every release (PR check, and
   the backend rejects duplicate versions), and every release should ship a matching
   `releaseNotes/<version>.md` (attached as the release body). Versions are immutable once
   published.
5. **Install** — a business admin installs from the Marketplace. Install creates the
   per-business record, records `installed_version`, runs setup tasks (creates empty
   integration secrets for `base_config.secrets`, per-plugin service accounts as needed), and
   launches the setup assistant.
6. **Configure** — setup-assistant answers become the business config; user setup assistants
   write per-user config; admins fill integration-secret values. Reconfiguration happens any
   time from the plugin's Marketplace details page.
7. **Upgrade (auto-tracked)** — an install automatically tracks the **latest minor/patch
   release within its installed major version**; publishing `1.2.3` upgrades every `1.x`
   install on next load. **Major** versions require an explicit upgrade action by the
   business. Version-bump semantics: [16-release-and-publish.md](16-release-and-publish.md).
8. **Uninstall / disable** — disabling preserves the install's config (re-enabling re-runs
   setup tasks and re-prompts the setup assistant only if its definition changed). Secret
   values survive uninstall/reinstall. If a plugin is gated by `required_entitlement`,
   revoking the entitlement uninstalls it and cleans up OAuth tokens asynchronously.

---

## How configuration flows

```
setup_assistant fields ──(admin answers at install)──▶ business config
user_setup_assistant fields ──(each user answers)────▶ user config
                                                        │
                        injected into every script run  ▼
                                    this.config.<key> / this.userConfig.<key>
```

- The business setup assistant writes its processed values into the install's config (the
  clean values live under the reserved key `__kizen_clean_config`); every script run receives
  them read-only as `this.config`. User setup assistants populate `this.userConfig` the same
  way. Value shapes are per field type (a `select` is the whole `{label, value}` object; a
  `custom_object` is `{objectId, objectName}`; a `field` picker is `{fieldId, fieldName,
  objectId, objectName}`) — see [13-setup-assistants.md](13-setup-assistants.md).
- **`when` clauses** on artifacts (`"Boolean({{config.enableBlocks}})"`,
  `"!{{userConfig.hideWidget}}"`) are evaluated against the same config and silently hide the
  artifact when false. Inside a setup assistant, `when` uses bare `{{key}}`; on artifacts it
  uses the `config.`/`userConfig.` prefixes.
- Scripts can read/write the business config directly via
  `GET|PATCH /external-integrations/business-plugin-apps/{identifier}` — but the PATCH is a
  **wholesale replacement** (read-modify-write required, or sibling keys including the setup
  assistant's values are dropped). To write *setup* config specifically, prefer
  `this.completeSetup(payload)`, which preserves the sibling keys and stamps the hash for you. The
  setup assistant is re-shown on enable only when its definition hash differs from the stored one.
  See
  [13-setup-assistants.md](13-setup-assistants.md) and
  [05-platform-api.md](05-platform-api.md).
- Agentic Workflow steps don't see `this.config`; the workflow builder can wire a
  `business_plugin_config` input that injects the clean config as a JSON string, and steps
  read declared `secrets` — see [07-automation-steps.md](07-automation-steps.md).
- `config_template` in the manifest seeds the raw install config for plugins that don't use a
  setup assistant; with an assistant it is effectively inert (ship `{}`).

---

## Security model in brief

Details: [06-auth-secrets-services.md](06-auth-secrets-services.md) and
[15-errors-and-observability.md](15-errors-and-observability.md).

- **Sandboxed execution.** Browser scripts run in web workers: no DOM, no cookies, no direct
  page access. Every capability is an explicit, host-mediated bridge call.
- **Sanitized output.** All `outputUI`/HTML-surface markup passes through DOMPurify; scripts
  and inline event handlers never reach the page. Third-party embeds are confined to proxied,
  sandboxed iframes on a separate origin with per-plugin permission scoping.
- **Treat script code as public.** Plugin scripts execute in end users' browsers (and
  open-source plugins publish their repos). Never put secrets in script bodies.
- **Credentials are injected server-side.** External APIs are called through the Kizen proxy
  (`/external-integrations/proxy/{plugin}/{service}/…`); the proxy resolves the declared
  service, injects and refreshes OAuth tokens or stored secrets, and forwards only a strict
  header allowlist. Scripts and Python steps never see tokens. Secret values inside
  `kizen.json` (e.g. OAuth `client_secret`) should be encrypted envelopes produced by
  `npx --yes @kizenapps/cli encrypt` (`{"encrypted": true, "value": "…"}`); plaintext values still function
  but are legacy and discouraged.
- **No inbound HTTP surface.** Plugins cannot register endpoints; external systems push data
  into Kizen only through the authenticated ingestion endpoints (Agentic Workflow webhook
  triggers, the Webhook SmartConnector, records upsert — see
  [05-platform-api.md](05-platform-api.md)). The only unauthenticated route in the plugin
  subsystem is the OAuth redirect callback, which cannot deliver data to plugin code.
- **Identity.** Relative-URL calls from browser workers run **as the acting user** (their
  permissions apply). Python steps run as a per-plugin service account. Entitlements
  (`required_entitlement`) gate marketplace visibility and install per business.

---

## Where each topic lives

| Doc | Owns |
|---|---|
| [02-getting-started.md](02-getting-started.md) | repo anatomy, `@kizenapps/cli` CLI, dev loop, hello world |
| [03-manifest-reference.md](03-manifest-reference.md) | every `kizen.json` field, artifact config.json fields, validation rules |
| [04-worker-runtime-api.md](04-worker-runtime-api.md) | every `this.*` method signature and semantics |
| [05-platform-api.md](05-platform-api.md) | Kizen REST endpoints plugins call |
| [06-auth-secrets-services.md](06-auth-secrets-services.md) | services, OAuth, secrets, the proxy |
| [07-automation-steps.md](07-automation-steps.md) / [08-actions.md](08-actions.md) | step and action contracts |
| [09-blocks.md](09-blocks.md) / [10-views-modals-forms.md](10-views-modals-forms.md) / [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md) | UI surfaces |
| [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md) | route scripts, calendar sources, adornments, settings items |
| [13-setup-assistants.md](13-setup-assistants.md) | setup assistant schema and config persistence |
| [14-navigation-and-communication.md](14-navigation-and-communication.md) | openWindow, navigation context, cross-surface communication |
| [15-errors-and-observability.md](15-errors-and-observability.md) | error doctrine (toast vs onError vs throw) |
| [16-release-and-publish.md](16-release-and-publish.md) | versioning, preview builds, publish pipeline |
| [17-gotchas.md](17-gotchas.md) / [18-recipes.md](18-recipes.md) | aggregated gotchas; end-to-end recipes |
| [glossary.md](glossary.md) / [method-index.md](method-index.md) | vocabulary; method → doc anchor map |

---

## Gotchas

- **Fresh worker per run** — never keep state on `this` or in closures across event scripts;
  use `sessionData`, the painted DOM, or the backend.
  ([04-worker-runtime-api.md](04-worker-runtime-api.md))
- **`this.outputView(viewId)` is not supported** by the host — use
  `this.showViewInModal(viewId)`.
  ([10-views-modals-forms.md](10-views-modals-forms.md))
- **Manifest `engine` must be exactly `"1.0.0"`** even though the runtime engine is newer —
  it's a fixed-value field today. ([03-manifest-reference.md](03-manifest-reference.md))
- **Prose says "Agentic Workflow", field names say `automation`** — the user-facing product
  term and the technical identifiers (`automationSteps/`, `automation_action_configs`)
  deliberately differ. ([glossary.md](glossary.md#agentic-workflow))
- **Business-config writes are wholesale** — always read-modify-write
  `business-plugin-apps/{identifier}` or you drop the setup assistant's stored values.
  ([13-setup-assistants.md](13-setup-assistants.md))
- **Never hardcode your plugin's `api_name` in scripts** — preview builds publish under a
  suffixed api_name; use `this.pluginApiName`.
  ([16-release-and-publish.md](16-release-and-publish.md))
