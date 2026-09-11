# Glossary

**What this covers:** canonical vocabulary for the Kizen plugin platform — one crisp
definition per term, cross-linked to the doc that owns the detail. Use these exact terms;
several have legacy or internal synonyms that the docs deliberately avoid.

**See also:** [01-overview.md](01-overview.md) (mental model) ·
[method-index.md](method-index.md) (method name → doc anchor)

## Canonical platform vocabulary

Prose uses the user-facing terms on the left; code identifiers and API fields often still use
the legacy names on the right. Both refer to the same thing.

| User-facing term | Legacy / code identifier |
|---|---|
| Agentic Workflow | `automation` (e.g. `automationSteps/`, `automation_action_configs`) |
| Record | `entity` (e.g. `entityId`, `entity-records`) |
| Object | `object` / `custom_object` |
| Custom Field | `field` |
| Contact | `client` (e.g. `client_client`, `/client` endpoints) |

---

### Action

A per-record JavaScript artifact (`actions/<name>/`) run from a record's action menus with
record context (`this.objectId`, `this.entityId`). Also called a **JS action** or **Browser
JS action** (backend model: `browser_js_action_template`). Publishing creates the template;
a business associates it with objects at install time. Owner: [08-actions.md](08-actions.md).

### action_override_create

A custom-object setting (not a manifest field) holding the composite key
`"{plugin_api_name}.{action_api_name}"`. It rewires the object's create-record flows ("+ Add"
buttons, relationship-field add) to run a plugin [action](#action) instead of the native
form; the action must return the created record's id as a non-empty string. Inert without a
matching action↔object association. Owner: [08-actions.md](08-actions.md).

### Agentic Workflow

Kizen's workflow-automation engine — the user-facing term (never "automation" in prose).
Plugins extend it with [code steps](#code-step). Technical identifiers keep the `automation`
spelling. Owner: [07-automation-steps.md](07-automation-steps.md).

### api_name

The stable machine identity of a plugin or artifact: lowercase snake_case matching
`^[a-z_][a-z0-9_]+$`. The plugin-level `api_name` is permanent (changing it is publish-
blocked); artifact api_names default to a sanitized directory name unless set explicitly in
`config.json` — always set them. Owner: [03-manifest-reference.md](03-manifest-reference.md).

### Artifact

One deployable component of a plugin — a block, action, Agentic Workflow step, floating frame,
page, view, toolbar item, adornment, object settings item, route script, or calendar source.
Declared by directory convention under the [entry directory](#entry-directory), each with its
own `config.json`. (Sometimes called "extension points".) Owner:
[01-overview.md](01-overview.md#surface-catalog).

### base_config

Manifest object carrying baseline install configuration — most importantly
`secrets: [string]`, the declaration of the plugin's [integration secrets](#integration-secret).
At publish time the setup-assistant definitions are folded into it. Owner:
[03-manifest-reference.md](03-manifest-reference.md).

### Block

A custom content block (`blocks/<name>/`) placeable on dashboards, homepages, chart groups,
and record layouts — when placed on a dashboard it is a **dashlet**. The host provides no
card chrome; blocks paint their own. Owner: [09-blocks.md](09-blocks.md).

### Bootstrap

`GET /external-integrations/bootstrap` — the host app's load-time fetch of every enabled
plugin install: config, user config, and all artifact definitions. What the bootstrap
returns is what renders. Owner: [05-platform-api.md](05-platform-api.md).

### Business config

The per-business install configuration, stored on the [business plugin app](#business-plugin-app)
and produced by the business [setup assistant](#setup-assistant) (clean values under the
reserved `__kizen_clean_config` key). Scripts read it as `this.config.<key>`; writes go
through `PATCH /external-integrations/business-plugin-apps/{identifier}` and are **wholesale
replacement** (read-modify-write required). Contrast [user config](#user-config). Owner:
[13-setup-assistants.md](13-setup-assistants.md).

### Business plugin app

The per-business install record of a plugin (abbreviated **BPA**): which version is
installed, the [business config](#business-config), enabled/disabled state, and OAuth/secret
bindings. Created on install; disabling preserves it. Owner:
[05-platform-api.md](05-platform-api.md).

### Calendar source

An artifact (`calendarSources/<name>/`) merging an external calendar into Kizen: `calendars.js`
returns the pickable calendar list, `events.js` returns events (epoch-ms times) per calendar
and date range. Owner:
[12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md).

### CLI (`@kizenapps/cli`)

The local plugin CLI, run as `npx --yes @kizenapps/cli <command>`. Commands: `create`, `build`,
`dev`, `encrypt`, `report`, `icons`. Writes gitignored local state to `.kizenapp/`. There is no
"kizen" CLI for plugin development.
Owner: [02-getting-started.md](02-getting-started.md#the-cli-kizenappscli).

### Code step

A plugin-provided Agentic Workflow step (`automationSteps/<name>/`): a Python script
(`script.py`) plus a `config.json` declaring typed inputs/outputs and secrets. Runs
server-side as the plugin's [service account](#service-account), with injected `inputs`,
`outputs`, `secrets`, and [`kizen`](#kizenapi) builtins. Also "automation step" / "plugin
code step". Owner: [07-automation-steps.md](07-automation-steps.md).

### config_template

Manifest object seeding the raw install config for plugins that don't use a setup assistant.
With a setup assistant present it is effectively inert — ship `{}`. Owner:
[03-manifest-reference.md](03-manifest-reference.md).

### Contact

The built-in person Object (the "client object"; internal name `client_client`). Contacts
have special API behavior (email-based lookup, dedicated `/client` endpoints). Owner:
[05-platform-api.md](05-platform-api.md).

### Data adornment

A one-click icon (`dataAdornments/<name>/`) rendered next to every populated field of a
configured `field_type` (`phonenumber`, `date`, `datetime`) on record pages; clicking runs
its script with `{value, fieldId, fieldType, objectId, entityId, isActivity}` args. Return value
is discarded.
Owner: [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md).

### data-script

The interactivity mechanism for painted HTML: an element attribute
(`<button data-script="refresh">`, `<form data-script="submit">`) wiring clicks/submits to
the artifact's `eventScripts/<name>.js`. There is no `addEventListener` in plugin UI. Owner:
[11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md).

### Developer business

The Kizen business (per environment) that owns a plugin's dev builds, set via the manifest's
`developer_business_id`. [Preview builds](#preview-build) auto-install there. Owner:
[03-manifest-reference.md](03-manifest-reference.md).

### dynamicPrompt

`this.dynamicPrompt(config)` — the current quick-modal primitive for collecting input from a
script (fields, async/typeahead selects, validation). Returns `{canceled, values}` with
**plain scalar** values (not array-wrapped — unlike [view](#view) form data). Supersedes the
legacy [`prompt`](#prompt-legacy). Owner: [10-views-modals-forms.md](10-views-modals-forms.md).

### Engine

`@kizenapps/engine` — the runtime that executes plugin scripts in web workers and bridges
them to the host app. Currently 1.9.1; note the manifest `engine` field is the fixed value
`"1.0.0"` and does not select an engine version. Owner:
[04-worker-runtime-api.md](04-worker-runtime-api.md).

### Entitlement

A per-business feature key (`business.entitlements`). A plugin's top-level
`required_entitlement` gates marketplace visibility and install; a service-level
`required_entitlement` gates a single service (commonly used for dev/prod service pairs).
Revoking a plugin-gating entitlement uninstalls the plugin. Owner:
[03-manifest-reference.md](03-manifest-reference.md) and
[06-auth-secrets-services.md](06-auth-secrets-services.md).

### Entry directory

The directory named by the manifest's `entry` field (conventionally `src/`) containing all
artifact directories, the [thumbnail](#thumbnail), and optional `import.kzn`. Owner:
[02-getting-started.md](02-getting-started.md#repo-anatomy).

### Event script

A script in an artifact's `eventScripts/` directory, invoked by [`data-script`](#data-script)
interactions, `this.runEventScript(name, args)`, or cross-surface
`communicate.runBlockScript`/`runFrameScript`. Each invocation runs in a **fresh worker** —
event scripts share no in-memory state with their caller. Owner:
[04-worker-runtime-api.md](04-worker-runtime-api.md).

### Floating frame

A persistent, draggable or corner-pinned overlay window (`floatingFrames/<name>/`) — script-
rendered or iframe-embedded — with route-based visibility (`match`/`ignore`), minimized
styles, a `message.js` handler for messages from its iframe, and frame-only controls
(`hide/show/expand/collapse`). Owner:
[11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md).

### Frame proxy

The dedicated origin (`https://plugin-assets.kizen.com`, dev:
`https://plugin-assets.kizen.dev`) through which all plugin iframes are routed. It isolates
third-party content from the Kizen origin, sandboxes the inner frame, scopes device
permissions per plugin, and wraps upward postMessages in an attributed envelope. Owner:
[11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md).

### include_perform_action

A boolean on an action↔object **association** (install-time, not a manifest field). When
true, the action appears in the object's [Perform Action](#perform-action) menu. Owner:
[08-actions.md](08-actions.md).

### Integration secret

A business-level named secret value, filled in by an admin after install. Plugin secrets are
declared in `base_config.secrets` and read at runtime under the namespaced api_name
`{plugin_api_name}__{secret_name}` (Python: `secrets["example_plugin__api_key"]`). Values
are write-only through the API (only an obfuscated form is readable). Owner:
[06-auth-secrets-services.md](06-auth-secrets-services.md).

### kizen.api

The pre-authenticated HTTP client injected into Python [code steps](#code-step):
`kizen.api.get/post/patch/put/delete(path)` calls the Kizen REST API (relative paths) as the
plugin's service account — including [proxy](#proxy) paths, so Python steps can call declared
[services](#service). Owner: [07-automation-steps.md](07-automation-steps.md).

### kizen.json

The plugin manifest at the repo root: identity, version, marketplace metadata, `entry`,
`services`, `base_config`, setup assistants, release targeting. May be a single object or an
array (multi-plugin repo). Artifacts are *not* listed in it — they're discovered by
directory. Owner: [03-manifest-reference.md](03-manifest-reference.md).

### Marketplace

The in-app catalog where businesses discover, install, configure, upgrade, and uninstall
plugins (also "App Marketplace"). `published: true` lists a plugin; entitlement-gated plugins
are invisible to non-entitled businesses. Owner: [16-release-and-publish.md](16-release-and-publish.md).

### Navigation context

A JSON payload carried across in-app navigation via
`this.openWindow(url, target, context)` (engine ≥1.8.0): stored in sessionStorage and keyed
by a `session_data_key` URL param. Only rides on **relative** URLs. Owner:
[14-navigation-and-communication.md](14-navigation-and-communication.md).

### Object

A data table in Kizen (Contacts is a special built-in Object; others are custom, of type
`standard` or `pipeline`). Identified by UUID or name/api-name in API paths. Records are its
rows. Owner: [05-platform-api.md](05-platform-api.md).

### Object settings item

A menu entry (`objectSettingsItems/<name>/`) appended to an object's settings dropdown on its
records page; its script runs with `this.objectId` and no record context. Backend field name:
`object_settings_menu_items`. Owner:
[12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md).

### onError

`this.onError(error)` — the worker's channel for reporting a defect to platform monitoring. A
thrown error is routed here automatically by the script wrapper. Reserve it for genuine bugs:
expected operational failures (an unreachable vendor, an unconfigured business, a 404) should
surface to the user via `showToast` instead, or real defects drown in noise. Your message never
reaches the user either way: depending on the surface they may see a generic host failure toast
(record-detail JS actions do this) or nothing at all. Owner:
[15-errors-and-observability.md](15-errors-and-observability.md).

### outputUI

`this.outputUI(markup, options?)` — the paint primitive for every non-iframe plugin surface. It
replaces the surface's output region with DOMPurify-sanitized HTML; `<script>` tags and inline
event handlers are stripped. Interactivity comes only from [`data-script`](#data-script)
attributes, never `addEventListener`. The painted DOM is one of the few things that survives
between a script and its event scripts. Owner:
[11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md).

### Page

A routable full-screen surface (`pages/<name>/`) served at
`/plugins/{plugin_api_name}/{page_api_name}` — script-rendered, static HTML, or an iframe
embed — optionally projected into the toolbar (`is_toolbar_item`). Pages and [views](#view)
package into the same underlying artifact type and share a name space; the difference is
where they render (a routed URL vs. modal content). Owner:
[10-views-modals-forms.md](10-views-modals-forms.md).

### Perform Action

The action menu on records ("Perform Action") where associated plugin [actions](#action)
appear when their association sets [`include_perform_action`](#include_perform_action).
Owner: [08-actions.md](08-actions.md).

### Plugin app

The installable unit itself — manifest + artifacts, published as versions and installed by
businesses (each install a [business plugin app](#business-plugin-app)). "Plugin" in these
docs always means a plugin app. Owner: [01-overview.md](01-overview.md).

### Preview build

The PR-driven sandbox deployment: version `0.0.0`, `published: false`, api_name suffixed
with a preview/branch marker, auto-installed in the [developer business](#developer-business),
deleted when the PR closes. The reason scripts must use `this.pluginApiName` rather than a
hardcoded api_name. Owner: [16-release-and-publish.md](16-release-and-publish.md).

### prompt (legacy)

`this.prompt(config)` — the older static modal API. Superseded by
[`dynamicPrompt`](#dynamicprompt); documented only for reading existing code. Owner:
[10-views-modals-forms.md](10-views-modals-forms.md).

### `*WithErrors` convention

The tuple-returning half of the worker's HTTP helpers: `getWithErrors`, `postWithErrors`,
`patchWithErrors`, `deleteWithErrors`. Each resolves `[data, error]` instead of throwing, where
`error` is a [`KizenRequestError`](04-worker-runtime-api.md#kizenrequesterror) or `null`. The plain
variants (`get`, `post`, …) swallow failures — they resolve `undefined` and report to monitoring,
giving the script no way to branch. **Prefer the `*WithErrors` form for anything whose failure you
intend to handle.** Owner: [04-worker-runtime-api.md](04-worker-runtime-api.md#4-http).

### Proxy

The Kizen generic proxy: `/external-integrations/proxy/{plugin_api_name}/{service_name}/{path}`
(built with `this.getServiceUrl`). It resolves the declared [service](#service), injects and
refreshes credentials server-side, forwards only an allowlisted header set, and wraps the
upstream response in `{status_code, response_headers, body}`. A disconnected OAuth service
returns 503. Owner: [06-auth-secrets-services.md](06-auth-secrets-services.md).

### Record

A row in an [Object](#object) (internal/legacy name: entity). CRUD via
`/records/{object}/…`. Owner: [05-platform-api.md](05-platform-api.md).

### Release notes

`releaseNotes/<version>.md` — the user-facing marketplace notes for a version, packaged when
the filename matches the manifest version. Add one in every release commit alongside the
version bump. Owner: [16-release-and-publish.md](16-release-and-publish.md).

### Route script

A script (`routeScripts/<name>/`) fired on navigation to a bound object's record-detail
routes, optionally regex-filtered, receiving `{previousRoute, currentRoute}` and record
context. Can be installed as blocking (page waits for it to settle or
`releaseBlockingScript()`). Owner:
[12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md).

### Service

A declared external API in the manifest's `services[]`: `service_name`, `base_service_url`,
an `auth_type` (`oauth`, `basic_auth_token_provided`, `password_token_exchange`, `no_auth`,
…), and an `auth_level` (`global` | `business` | `user`). Scripts reach it through the
[proxy](#proxy); credentials never reach plugin code. Owner:
[06-auth-secrets-services.md](06-auth-secrets-services.md).

### Service account

A non-human employee identity. Each plugin with code steps gets a per-plugin service account that
its steps run as; plugins can also declare integration service accounts via `base_config`.
Browser-worker relative-URL calls do *not* use it — they run as the acting user. Owner:
[06-auth-secrets-services.md](06-auth-secrets-services.md).

### Session data

`this.sessionData` / `this.setSessionData(update)` — an in-memory, plugin-scoped state bucket
shared by all of a plugin's surfaces on the page for the life of the browser session (not
persisted across reloads). Shallow-merges top-level keys. The sanctioned way to carry state
between isolated script runs. Owner: [04-worker-runtime-api.md](04-worker-runtime-api.md).

### Setup assistant

The install/configuration wizard (`setup_assistant` in the manifest or
`setupAssistant/assistant.json`). Usually declarative: typed fields, `when` visibility
expressions, async selects, service-authorization prerequisites, and action mapping. Its answers
become the
[business config](#business-config). Also "configuration assistant". A plugin may instead point
`setup_assistant.view` at a packaged view — see
[view-based setup assistant](#view-based-setup-assistant). Owner:
[13-setup-assistants.md](13-setup-assistants.md).

### Setup assistant hash

`__kizen_setup_assistant_hash` — a hash of the assistant definition stored alongside the
config. The install/enable flow re-prompts the assistant only when the current definition's
hash differs, i.e. when the assistant changed. Custom config writers must preserve (or set)
it, and every `completeSetup` call stamps it regardless of which surface called.
Owner: [13-setup-assistants.md](13-setup-assistants.md).

### Thumbnail

`thumbnail.png` at the entry root — the plugin's marketplace image. PNG only, exactly one,
required to publish (not to build). Owner: [16-release-and-publish.md](16-release-and-publish.md).

### Toolbar item

A global navigation entry (`toolbarItems/<name>/` — icon, label, color) that runs its script
on click with business-level context (no record). Distinct from a [page](#page) projected
into the toolbar, which navigates instead. Owner:
[11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md).

### User config

Per-user, per-plugin configuration: the [user setup assistant](#user-setup-assistant)'s
answers, read as `this.userConfig.<key>`. A separate per-user, per-component bucket is
available programmatically via `this.getUserConfig()` / `this.setUserConfig()`. Contrast
[business config](#business-config). Owner: [13-setup-assistants.md](13-setup-assistants.md)
and [04-worker-runtime-api.md](04-worker-runtime-api.md).

### User setup assistant

`user_setup_assistant` — same schema as the [setup assistant](#setup-assistant), but each
user answers for themselves (User Settings tab); values land in [user config](#user-config).
Commonly paired with user-level OAuth services. `user_setup_assistant.view` selects the
[view-based](#view-based-setup-assistant) form instead. Owner:
[13-setup-assistants.md](13-setup-assistants.md).

### Version

The plugin's semver in the manifest. Must strictly increase per release; published versions
are immutable. **Upgrade auto-tracking:** installs automatically follow the latest
minor/patch within their installed major; majors require an explicit upgrade by the
business. `0.0.0` is reserved for dev/preview builds. Owner:
[16-release-and-publish.md](16-release-and-publish.md).

### View

A packaged UI surface (`views/<name>/`, script or `index.html`) rendered as **modal content**
via `this.showViewInModal(viewApiName, {args, options})` — framed (host confirm/cancel
buttons collect form data, values array-wrapped) or frameless (the view owns its chrome and
calls `this.closeModal`). Same artifact family as [pages](#page); names must be unique across
both directories. Owner: [10-views-modals-forms.md](10-views-modals-forms.md).

### View-based setup assistant

A [setup assistant](#setup-assistant) rendered as a plugin [view](#view) instead of a
declarative field list — `setup_assistant.view` / `user_setup_assistant.view` naming a
`views/` component's api_name (engine ≥1.9.0, packager ≥0.5.0). The view saves its answers by
calling `this.completeSetup(payload, options?)`, which replaces `__kizen_clean_config`
wholesale and stamps the [setup assistant hash](#setup-assistant-hash). Owner:
[13-setup-assistants.md](13-setup-assistants.md#12-view-based-setup-assistants).

### when clause

A JS expression string gating visibility on config: on artifacts,
`"Boolean({{config.key}}) && !{{userConfig.other}}"`; inside setup assistants, bare
`{{key}}`. Evaluated in an isolated expression worker; false silently hides the artifact or
field. Accepted on seven surfaces — blocks, floating frames, data adornments, toolbar items,
Agentic Workflow steps, object settings items, calendar sources — and **not** on actions, pages/views,
or route scripts, where the key is ignored. Owner:
[03-manifest-reference.md](03-manifest-reference.md) and
[13-setup-assistants.md](13-setup-assistants.md).

### Worker

The isolated web worker each script execution runs in, with `this` bound to a **worker
context** (base, record-detail, floating-frame, or calendar-source context — each exposing a
different `this.*` surface). One fresh worker per run; terminated on completion unless
preserved. Owner: [04-worker-runtime-api.md](04-worker-runtime-api.md).

---

## Gotchas

- **Say "Agentic Workflow," type `automation`** — prose and UI use the product term; every
  code identifier (`automationSteps/`, `automation_action_configs`, `/api/automations/…`)
  keeps the legacy spelling. ([07-automation-steps.md](07-automation-steps.md))
- **"Views" and "pages" are one artifact type with one shared name space** — a duplicate name
  across `views/` and `pages/` fails packaging.
  ([03-manifest-reference.md](03-manifest-reference.md))
- **Directory names ≠ backend field names** — `objectSettingsItems/` packages as
  `object_settings_menu_items`, `actions/` as `js_action_templates`, `pages/`+`views/` as
  `routable_pages`. Search both spellings.
  ([03-manifest-reference.md](03-manifest-reference.md))
- **Three APIs sound like "user config" but they address only two stores** —
  `this.userConfig` (user setup-assistant values) vs `getUserConfig()`/`setUserConfig()` (a
  per-component read-write bucket); those two are not the same data.
  `completeSetup(payload, { level: 'user' })` writes the setup-assistant store — the one
  `this.userConfig` reads — and never the scratch bucket.
  ([04-worker-runtime-api.md](04-worker-runtime-api.md),
  [13-setup-assistants.md](13-setup-assistants.md#12-view-based-setup-assistants))
- **`include_perform_action` and `action_override_create` are not manifest fields** — they
  live on install-time associations and object settings respectively.
  ([08-actions.md](08-actions.md))
