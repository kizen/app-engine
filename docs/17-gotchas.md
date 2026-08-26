# Gotchas — the consolidated trap list

What this covers: every known trap, quirk, and silent-failure mode in the Kizen plugin platform,
in one place, grouped by topic. Each entry states the trap in one line, explains why it happens
and what to do instead, and links to the doc that owns the full contract. This file is the safety
net — scan the relevant section before and after building any surface.

See also: [18-recipes.md](18-recipes.md) for end-to-end worked examples,
[04-worker-runtime-api.md](04-worker-runtime-api.md) for `this.*` contracts,
[15-errors-and-observability.md](15-errors-and-observability.md) for the error-handling doctrine.

---

## Manifest & packaging

- **The manifest `engine` field must be exactly `"1.0.0"` — it is a fixed value, not a version choice.**
  The packager validates against an exact-match allowlist of `['1.0.0']`, and nothing at runtime
  branches on it. The engine library itself is at 1.9.1; do not try to express engine requirements
  through this field. → [03-manifest-reference.md](03-manifest-reference.md)

- **`kizen.json` can be a top-level JSON array (multi-plugin repo) — parse and tool accordingly.**
  Each entry is a full manifest and needs a unique `api_name` (error `manifest/duplicate-api-name`)
  and its own `entry` directory. Scripts that assume a single object break on these repos.
  → [03-manifest-reference.md](03-manifest-reference.md)

- **Artifacts are discovered by directory convention under `entry`, never declared in `kizen.json`.**
  The manifest holds only plugin-level fields (services, setup assistants, base_config). Adding an
  array of blocks/actions to the manifest does nothing; create `src/<surface>/<name>/` directories
  with the reserved filenames instead. → [03-manifest-reference.md](03-manifest-reference.md)

- **Reserved filenames are the contract — a misspelled script filename is silently ignored.**
  `script.js`, `script.py`, `config.json`, `styles.css`, `message.js`, `callback.js`,
  `calendars.js`, `events.js`, `index.html`, `eventScripts/<name>.js`. The manifest never names a
  script file; only these names are read. → [03-manifest-reference.md](03-manifest-reference.md)

- **Directory-derived api_names collapse camelCase — always set `api_name` explicitly in `config.json`.**
  The fallback sanitizer lowercases the directory name, collapses hyphen and whitespace runs to
  `_`, then drops characters outside `[a-z0-9_]`: `archiveChildRecords` becomes api_name
  `archivechildrecords`, and `archive-child-records` becomes `archive_child_records`. Underscores
  are preserved, so a snake_case directory like `zero_height` survives unchanged — it is camelCase
  directories that produce a name you did not expect. Anything that references the artifact by api_name
  (`showViewInModal`, `runBlockScript`, associations) then fails to resolve.
  → [03-manifest-reference.md](03-manifest-reference.md)

- **Views compile into `routable_pages` — page and view names must be unique across BOTH `pages/` and `views/`.**
  A duplicate fails packaging (`structure/duplicate-component-name`). Views also cannot carry a
  `when` condition (they are not in the flag-gated artifact list) — gate the surfaces that *open*
  the view instead. → [03-manifest-reference.md](03-manifest-reference.md)

- **`dataAdornments/` config.json takes no `api_name` — it is the only config-required directory without one.**
  Its identity is the directory + `field_type`. Don't add one expecting it to matter.
  → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **The source directory is `objectSettingsItems/` but the packaged artifact key is `object_settings_menu_items`.**
  Remember the naming split when reading publish payloads, bundle output, or API responses.
  → [03-manifest-reference.md](03-manifest-reference.md)

- **`thumbnail.png` is build-optional but publish-required, and its location is strict.**
  It must sit at the first path segment under `entry` (`src/thumbnail.png`); a nested
  `src/images/thumbnail.png` is silently ignored and publish then fails with "Thumbnail is
  required for publishing". PNG only, exactly one. → [16-release-and-publish.md](16-release-and-publish.md)

- **`release_branch` (singular) is not a field — a real-world typo trap.**
  Nothing reads it; the plugin silently gets the default `release_branches` (the repo's default
  branch). The field is `release_branches` (plural, array). → [03-manifest-reference.md](03-manifest-reference.md)

- **A flat string `developer_business_id` is sent verbatim to EVERY release environment.**
  A business id exists in only one environment, so a flat id + multiple release environments
  publishes into environments where the business doesn't exist (packager warning
  `manifest/developer-business-id-environments`). Use the per-environment object form keyed by
  *concrete* environment names — alias keys (`dev`, `prod`) are rejected there.
  → [03-manifest-reference.md](03-manifest-reference.md)

- **Never reason about raw `release_environments` entries — aliases expand.**
  `prod` → go + fmo; `dev` → staging + integration; `testing` → e2e-integration + e2e-staging.
  Counting entries or matching strings without expanding through the alias map gives wrong
  answers. → [03-manifest-reference.md](03-manifest-reference.md)

- **`config_template` is effectively vestigial once a setup assistant exists.**
  Prefer sourcing install config from the setup assistant; ship `config_template: {}` unless you
  have a specific reason (static config with no assistant). → [03-manifest-reference.md](03-manifest-reference.md)

- **A `when` condition flips `block_loading_for_setup: true` — but only from 5 of the 7 surfaces that accept `when`.**
  Blocks, data adornments, toolbar items, Agentic Workflow steps and calendar sources set the flag.
  **Floating frames and object settings items accept `when` and do NOT set it** — so a plugin whose
  only conditions live on those two surfaces ships with `block_loading_for_setup: false`, and their
  conditions are evaluated against config that may not have loaded yet. When the flag is set the
  behavior is expected, not a bug: the host holds artifact loading until install config exists.
  Don't set the flag manually. → [03-manifest-reference.md](03-manifest-reference.md)

- **A fixed-position floating frame requires `minimized_style: "circle"`.**
  The fixed anchor IS the circle trigger element; with `bar` or `none` every fixed-positioning
  path silently no-ops and the frame's position freezes. The packager build-errors on this
  combination (`structure/fixed-frame-minimized-style`).
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **Packager TypeScript types are advisory; the engine runtime types are the authority.**
  The packager's setup-assistant field type is missing `qr`/`image`/`link` and ~20 real props;
  its `conflict_resolution` enum omits `update_if_blank`. Typechecking authored JSON against
  `@kizenapps/packager` produces false errors on valid manifests. → [03-manifest-reference.md](03-manifest-reference.md)

- **An Agentic Workflow step's `"script"` key in `config.json` is ignored — the packager always reads `script.py` from disk.**
  Embedding source in config does nothing. → [07-automation-steps.md](07-automation-steps.md)

- **The local tool is `@kizenapps/cli`, run as `npx --yes @kizenapps/cli <command>` — there is no `kizen` CLI for plugin development.**
  Commands: `create`, `build`, `dev`, `encrypt`, `report`, `icons`. Pass `--yes` so npx's install
  prompt can't hang the command in CI or a non-interactive shell. It writes gitignored local
  state to `.kizenapp/`. → [02-getting-started.md](02-getting-started.md)

- **`create` is an interactive terminal UI with no flags — it cannot run unattended.**
  Without a real TTY it exits non-zero with `Raw mode is not supported on the current
  process.stdin` and scaffolds nothing, so agents and CI jobs should build the repo layout
  directly instead of shelling out to `create`. The other commands need no TTY.
  → [02-getting-started.md](02-getting-started.md#the-cli-kizenappscli)

- **`.kizenapp/` must stay gitignored — it can contain an embedded browser profile with real credentials.**
  A stray `git add .` on a repo missing the ignore rule leaks cookies/login data. The CLI adds the
  ignore entry itself; verify it before committing. → [02-getting-started.md](02-getting-started.md)

- **Toolbar, adornment, and minimized-circle icons come from the platform icon set only.**
  `npx --yes @kizenapps/cli icons` is the authoritative list; arbitrary icon names silently fail to
  render (adornments/frames can use `customIconFile` → inlined `data:image/` URI instead).
  → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **A `when` on an action, page, route script or view is silently discarded at package time.**
  Only blocks, data adornments, floating frames, object settings items, toolbar items, calendar
  sources and Agentic Workflow steps support conditions. The packager reads a fixed key set from
  the other four and drops `when` with no error and no warning, so the artifact ships
  unconditionally enabled and looks exactly like an expression that evaluated true.
  → [03-manifest-reference.md](03-manifest-reference.md#when-conditions)

- **Two data adornments on the same `field_type` cannot be gated independently.** Because an
  adornment's identity is its `field_type` rather than an `api_name`, the host keys evaluated
  conditions by `field_type` too — so same-type adornments in one plugin share a single result and
  the last one evaluated wins for all of them. Give them one shared `when`, or fold them into a
  single adornment.
  → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md#when-data-adornment)

## Workers & HTTP

- **Every script execution is a brand-new worker — nothing on `this`, module scope, or closures survives.**
  Not between a main script and its event scripts, not between two event-script runs, not across
  `runEventScript`. What persists: the painted DOM from the last `outputUI`, `sessionData`,
  user config, and the backend. → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **Event scripts are isolated units — there are no shared helper modules, and there is no `import`/`require`.**
  Script bodies are compiled with `AsyncFunction`; duplicating small helpers (an `esc()` or
  `describeError()`) across scripts is the correct, unavoidable pattern, not a smell.
  → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **Relative GETs are cached forever within a worker — there is no TTL.**
  `this.get`/`getWithErrors` memoize per-URL for the worker's lifetime; with `this.preserve = true`
  the cache lives across event turns. Pass `{ ignoreCache: true }` whenever a fresh read matters
  (config re-reads, readiness checks, read-modify-write cycles).
  → [04-worker-runtime-api.md](04-worker-runtime-api.md#thisgeturl-options)

- **Bare HTTP helpers resolve `undefined` on failure after routing the error away — use the `*WithErrors` tuple helpers exclusively.**
  `this.get/post/patch/delete` call `this.onError` internally and resolve `undefined`; the caller
  can't branch on failure. `getWithErrors` etc. return `[data, error]` and never throw. DELETE
  resolves `[null, null]` on 204. → [15-errors-and-observability.md](15-errors-and-observability.md)

- **There is no `this.put`.**
  The transport supports PUT but no public wrapper exists. Use PATCH endpoints, or restructure the
  call. → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **`this.patch` does not add the `X-Request-Type: kizen-ui-scripting-api` header the other verbs add.**
  A quirk to know about when anything server-side keys on that header. → [04-worker-runtime-api.md](04-worker-runtime-api.md#thispatchurl-body-options)

- **`this.args` is parsed from a JSON string — invalid JSON silently becomes `{}`.**
  If your args mysteriously vanish, check that every caller passes JSON-serializable values.
  → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **There is no engine-imposed execution timeout — a hung script keeps its worker alive indefinitely.**
  Only a rerun of the same worker identity terminates it. Never await something that can hang
  without a bound. → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **Worker identity hashes the script body AND args — changing either creates a different worker.**
  Re-running the same identity force-terminates the previous instance; this is how "restart on
  config change" works, and why two invocations with different args can run concurrently.
  → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **`this.preserve = true` keeps the worker (and its GET cache) alive after completion — a debugging tool, not a production pattern.**
  It leaks memory and makes stale-cache bugs likely. → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **Scripts run inside an async IIFE — top-level `await` and top-level `return` are valid, but `node --check` rejects them.**
  Syntax-check a script body with `new Function('return (async function(){\n' + body + '\n});')`
  instead of node's file checker. → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **`this.currentUser` nests everything under `.profile` — `this.currentUser.first_name` is always `undefined`.**
  Read `this.currentUser.profile.first_name`; string fields default to `''`, not null.
  → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **`this.location` throws on any property outside its snapshot set.**
  It is a Proxy over host/hash/href/origin/pathname/search/port/protocol; reading anything else
  throws (JSON.stringify works via a toJSON special case). → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **`this.currentBusiness.timezone.name` works but is outside the typed contract — the declared type has only `{ id }`.**
  Extra fields (`employee_id`, `client_object.id`, `timezone.name`) are real today; be aware they
  could tighten. → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **When the proxy succeeds but the upstream fails, the error carries `proxyStatus: 200` plus the real `upstreamStatus`.**
  Branch on `error.upstreamStatus` for external-service failures, not `proxyStatus`.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **`postFormData` rejects with no reason on failure.**
  Wrap it in try/catch and produce your own error message. → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **`installThirdPartyScript` never rejects — a failed install reads as a success.**
  It routes the failure to a fixed `onError` and resolves `undefined`, so try/catch catches
  nothing. Check the returned handle before calling `.call(...)` on it.
  → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **`installThirdPartyScript` is allowlisted to exactly two vendors' widget URLs (Freshworks and Intercom).**
  Any other URL reports an error and resolves `undefined`. It is not a general script loader.
  → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **`setUserConfig` is read-modify-write with no locking — concurrent writers can clobber each other.**
  Keep per-user config writes coarse and infrequent; don't fan out parallel writes.
  → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **Workers have a real global `fetch()` for absolute URLs — but no auth injection and normal CORS apply.**
  Public APIs work without declaring a service; anything needing credentials must go through the
  service proxy. → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **A failed `/external-integrations/bootstrap` makes EVERY plugin silently absent — and the host blames the install.**
  The error is retried, then swallowed: not thrown, not toasted, not reported to monitoring. The
  plugin map defaults to `{}`, so every surface list empties at once. Because the host still
  reports "fetched", consumers commit to the empty result and explain it wrongly — dashlets say
  "This block is no longer available", plugin pages say "Plugin Not Found — Error code: 404".
  Both describe an uninstalled plugin; neither is true. Check the network tab before investigating
  an install. Your scripts never run, so this is undetectable from inside a plugin.
  → [01-overview.md](01-overview.md)

- **A failed per-user config load degrades `this.userConfig` to `{}` — indistinguishable from "not configured yet".**
  The host catches the error and substitutes `{config: {}}`; no error flag is injected, and none
  exists to read. Don't treat empty user config as proof the user never configured the plugin if
  acting on that is expensive (re-prompting for settings they already saved). Use
  `getUserConfig()` for an explicit re-read that can fail visibly. Note this fetch is **not
  retried** — the catch lives inside the query function, so the retry policy never engages.
  → [04-worker-runtime-api.md](04-worker-runtime-api.md)

## Error handling & observability

- **Thrown errors and `this.onError` route to platform monitoring and are triaged as PLATFORM issues.**
  Reserve them for genuine platform problems. Expected/user-level failures get a
  `showToast({ variant: "failure", autohide: false })` and a `return` — a throw raises a platform
  alert.
  → [15-errors-and-observability.md](15-errors-and-observability.md)

- **`this.onError` transmits only `error.message` — all structured error data is lost at the worker boundary.**
  Serialize anything you need into the message string. → [15-errors-and-observability.md](15-errors-and-observability.md)

- **`this.onError` does not stop the script — only `throw` aborts remaining statements.**
  A script that reports an error then keeps mutating data is a common bug. `return` after
  reporting. → [15-errors-and-observability.md](15-errors-and-observability.md)

- **`Error.message` is non-enumerable — `JSON.stringify(err)` yields `"{}"`.**
  Normalize before display: `typeof e === "string" ? e : e?.message ?? JSON.stringify(e)`.
  This also bites any script matching error text for control flow. → [15-errors-and-observability.md](15-errors-and-observability.md)

- **A thrown error still "completes" the script from the host's perspective — `runScript` resolves `undefined`, and blocking route scripts release.**
  Failure is not a hang; don't build hang-guards around throws. → [15-errors-and-observability.md](15-errors-and-observability.md)

## Platform API

- **Business plugin config PATCH is a WHOLESALE REPLACE — no server-side merge, no validation.**
  `PATCH /external-integrations/business-plugin-apps/{identifier}` replaces the whole `config` blob.
  Always read fresh (`ignoreCache: true`), spread the existing config, overwrite only your keys —
  otherwise you drop `__kizen_setup_assistant_values`/`__kizen_setup_assistant_hash` and every
  sibling key. → [05-platform-api.md](05-platform-api.md)

- **Business plugin config cannot be created from a script — the row exists only after install.**
  Before install (or in a sandbox without one), both GET and PATCH 404, and a business-level
  `completeSetup` rejects for the same reason — there is no stored record to merge into.
  → [05-platform-api.md](05-platform-api.md)

- **Never hardcode your plugin's api_name in scripts — preview builds publish under a suffixed api_name.**
  Hardcoded literals 404 in preview deployments. Always build URLs from `this.pluginApiName`
  (workers) or `state.pluginApiName` (setup-assistant scripts). → [05-platform-api.md](05-platform-api.md)

- **`POST /custom-objects` with a `name` (api-name) key is staff-only — non-staff get 403 with code `forbidden_field_write`.**
  Omit `name` and capture the server-derived `created.name` (slugified `object_name`) from the
  response, then persist it for later lookups. Example code that sends `name` only works on staff
  accounts. → [05-platform-api.md](05-platform-api.md)

- **Logged activities have NO list route — `GET /api/activities/logged` is a 404.**
  Only `GET /api/activities/logged/{id}` exists. To enumerate, use
  `POST /api/activities/{identifier}/responses` (paginated). A "did I already log this?" guard
  must be a stored flag re-read fresh before the POST. → [05-platform-api.md](05-platform-api.md)

- **`GET /api/activities` has no api_name filter.**
  Bump `page_size` (honored to 1000) and match client-side. → [05-platform-api.md](05-platform-api.md)

- **`lookup` matches one fixed column, exactly and case-sensitively — and only a confirmed 404 justifies a create.**
  `GET /records/{obj}/lookup?identifier=` matches email for the contacts object, name for others.
  Creating a record after an ambiguous error (403/500/timeout) is the duplicate-data bug class.
  Note `upsert` matches case-insensitively (`__iexact`) — different semantics.
  → [05-platform-api.md](05-platform-api.md)

- **Contact (client-object) CREATION by field name can 403 — create with field IDs + `unarchive`, update by name.**
  Proven path: `GET /client/custom-object` → use `undeletable_fields.<api_name>.id` → POST with
  field ids and `unarchive: "prompt"`. `PATCH /records/client_client/{id}` by name works fine.
  → [05-platform-api.md](05-platform-api.md)

- **`page_size` for record search is a query parameter, not a body key.**
  `POST /records/{obj}/search?page_size=100` with `field_names` in the body. The response narrows
  fields to exactly the requested api names — include `"stage"` explicitly if you need it.
  → [05-platform-api.md](05-platform-api.md)

- **Field values read back with inconsistent envelopes — unwrap defensively.**
  A value may be a raw scalar, `{value}`, or `{id, name}` one level nested; `record.fields` may be
  an array or an object keyed by field id; dropdown values arrive as option id, option name, or
  object. Normalize before comparing. → [05-platform-api.md](05-platform-api.md)

- **Write value formats are strict: dropdown = option id, relationship = scalar related-record id, date = `"YYYY-MM-DD"`.**
  Files are arrays of uploaded-file UUIDs; phone numbers accept bare E.164. Wrong shapes fail with
  misleading validation errors. → [05-platform-api.md](05-platform-api.md)

- **Dropdown field options: create the field WITHOUT options, then POST options one at a time — never PATCH options.**
  An empty options array is rejected on create, and PATCHing options is a destructive replace.
  Duplicate option names are rejected case-insensitively. → [05-platform-api.md](05-platform-api.md)

- **Field creation traps: `category` is required, `money` requires `money_options`, api_name `status` is reserved, `decimal_options.max_value` above 999999.99 → HTTP 500.**
  List categories via `GET /custom-objects/{id}/categories` (a fresh client object has exactly
  one). Prefer prefixed api_names for generic nouns. → [05-platform-api.md](05-platform-api.md)

- **`settings-search` results are permission-filtered — an empty result never proves absence.**
  Fall through to `GET /custom-objects/{apiName}` before concluding an object doesn't exist.
  → [05-platform-api.md](05-platform-api.md)

- **The employee list is silently scoped to the caller when the `all_team_members` permission is NONE.**
  `GET /api/team` returns only the caller's own row — no 403, no signal. Retrieve-by-UUID and
  `POST /team/search` are not scoped. → [05-platform-api.md](05-platform-api.md)

- **No trailing slashes — the API router does not redirect them.**
  `/api/records/my_object/add`, never `/api/records/my_object/add/`. → [05-platform-api.md](05-platform-api.md)

- **Business settings: `country` is ISO alpha-2, and currency is NOT a business setting.**
  `PATCH /business/mine?v2=true` takes `"US"`, not `"United States"`; there is no `date_format`
  field; currencies come from `GET /api/constants/currencies`. → [05-platform-api.md](05-platform-api.md)

- **Integration-secret updates: PATCH is disabled, and re-sending the record's own `api_name` on PUT causes a 500.**
  Update with full PUT and omit `api_name`. `value` is write-only and never returned.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **Plugins have NO inbound HTTP surface — no registerable endpoint for external POSTs.**
  Only the OAuth callback is unauthenticated, and it can't carry data into a plugin. External
  systems push data through the authenticated ingestion endpoints: the Agentic Workflow webhook
  trigger, the Webhook SmartConnector (250 KB cap, async), or records upsert (contacts match on
  email only). All three require Kizen credentials. → [05-platform-api.md](05-platform-api.md)

- **Delete-all loops must refetch page 1 after each batch.**
  Deletions shift the paging window; iterating pages forward skips records. → [05-platform-api.md](05-platform-api.md)

## Setup assistants & install config

- **`when` expression scoping differs by location: artifact configs use `{{config.key}}` / `{{userConfig.key}}`; setup-assistant fields use bare `{{key}}`.**
  Mixing them up makes conditions silently evaluate against `undefined` and artifacts vanish.
  → [13-setup-assistants.md](13-setup-assistants.md)

- **Config value shapes from `this.config` / `this.userConfig` are per-field-type — several are objects, not scalars.**
  `select` = the whole `{label, value}` option (read `.value`); `custom_object` =
  `{objectId, objectName}` (read `.objectId` — interpolating the object yields
  `/records/[object Object]/...`, which surfaces as a fake 403); `field` picker =
  `{fieldId, fieldName, objectId, objectName}` (note: field *id*, not api_name); `number` is
  absent entirely when left blank. → [13-setup-assistants.md](13-setup-assistants.md)

- **`this.config` is a construction-time snapshot — stale within a run.**
  A value you just PATCHed won't appear until the next worker launch. Prefill UI from a fresh
  GET of the business plugin config, not from `this.config`. → [13-setup-assistants.md](13-setup-assistants.md)

- **Setup-assistant `services[].api_name` is validated nowhere — a typo silently disables the whole OAuth prerequisite step.**
  Double-check the string against `services[].service_name` in the manifest. Also leave
  `required: false` while OAuth credentials are placeholders, or setup hard-blocks.
  → [13-setup-assistants.md](13-setup-assistants.md)

- **Async-select companion scripts run in the BROWSER marketplace page, not a worker.**
  No `this.getServiceUrl` — hand-build `/external-integrations/proxy/${state.pluginApiName}/{service}/...`.
  Guard dependent fetches with a fallback so the URL is valid before the parent field is picked.
  → [13-setup-assistants.md](13-setup-assistants.md)

- **The install modal re-prompt is skipped only when `__kizen_setup_assistant_hash` matches — any non-declarative config write must maintain it.**
  If your code writes config outside the assistant and doesn't preserve the hash sibling, users
  get re-prompted on every enable (or, conversely, your changes get clobbered on the assistant's
  next save — keep keys disjoint). → [13-setup-assistants.md](13-setup-assistants.md)

- **Assistant `actions` entries must reference real action api_names or packaging fails.**
  `structure/setup-assistant-action-ref` throws at transform time; stale lists copied from other
  repos are a known failure. → [13-setup-assistants.md](13-setup-assistants.md)

- **Renaming setup-assistant field keys breaks every `when` clause and script read that referenced them.**
  Keys are case-sensitive and resolve to nothing when missing (artifact silently hides). Migrating
  config requires preserving exact keys. → [13-setup-assistants.md](13-setup-assistants.md)

- **Setup-assistant `default` values drive `when`-clause visibility pre-configuration, but do NOT reach `this.config` at script runtime.**
  A script reading a key the user never saved gets `undefined` even though the artifact was
  visible. Default defensively in the script. → [13-setup-assistants.md](13-setup-assistants.md)

- **Unknown assistant field types silently render an invalid block.**
  There is essentially zero packager validation of assistant fields; malformed assistants publish
  and fail at runtime. The valid types are: `custom_object, description, container, field, text,
  number, select, boolean, qr, image, link`. → [13-setup-assistants.md](13-setup-assistants.md)

- **`completeSetup(payload)` REPLACES `__kizen_clean_config` wholesale — every key missing from the payload is gone.**
  The host assigns it directly: `{ ...existingConfig, __kizen_clean_config: payload }`. A view that
  edits one setting must still send every key the plugin depends on, including keys other surfaces of
  the same plugin read. Build the full object — `await this.completeSetup({ ...this.config, apiKey: next })`
  — remembering `this.config` is a load-time snapshot.
  → [13-setup-assistants.md](13-setup-assistants.md#12-view-based-setup-assistants)

- **Every `completeSetup` call stamps `__kizen_setup_assistant_hash`, and nothing checks which surface called it.**
  The hash covers the assistant definition, so stamping it suppresses the install-time setup prompt
  on the next enable — including after a version bump that changed the assistant. A plugin that
  calls `completeSetup` from a block or toolbar item without actually running setup stops prompting
  for setup. → [13-setup-assistants.md](13-setup-assistants.md#12-view-based-setup-assistants)

- **`options.level` is only ignored while a setup surface is live — off-surface the caller's value wins.**
  The host resolves the level from the live setup surface, which is why a setup view can't misroute
  its own write. That protection doesn't extend to a block or toolbar item: there the passed level is
  honored (defaulting to `'business'` when absent), so a stray call can write the wrong scope on top
  of suppressing the setup prompt.
  → [13-setup-assistants.md](13-setup-assistants.md#127-best-practices)

- **An unguarded form-submit handler can `completeSetup` a blank payload — wiping the config AND suppressing the prompt.**
  Click-path dispatch supplies no `this.args.formData`, so a click landing on a
  `<form data-script=…>` element's own padding or grid gaps runs the handler with `formData`
  undefined. A setup view that reads the form data and passes it to `completeSetup` then writes an
  empty clean config and stamps the hash: the plugin's config is wiped and it stops prompting for
  setup. Every submit handler needs `const formData = this.args?.formData; if (!formData) return;`
  before it builds a payload. → [13-setup-assistants.md](13-setup-assistants.md#12-view-based-setup-assistants)

- **`completeSetup` does not write `__kizen_setup_assistant_values` — the raw answer store the declarative renderer repopulates its form from.**
  On a plugin that has both a declarative assistant and a `completeSetup` caller, the next
  declarative save regenerates the clean config from that untouched values store and discards what
  `completeSetup` wrote. This isn't a supported combination: whichever style owns a level owns that
  level's config, so keep to one writer per level.
  → [13-setup-assistants.md](13-setup-assistants.md#127-best-practices)

- **A multi-step setup view must call `completeSetup` exactly once, at its terminal step.**
  A successful call fires the host's completion callback, which closes the setup modal — a
  mid-wizard call slams the modal shut on an unfinished user.
  → [13-setup-assistants.md](13-setup-assistants.md#12-view-based-setup-assistants)

- **`base_config.disabled_keys` has no effect on what a view-based assistant saves.**
  It only filters the values a declarative field list writes. The packager emits a warning when the
  two are combined. → [13-setup-assistants.md](13-setup-assistants.md#12-view-based-setup-assistants)

- **Views aren't feature-flag filtered and take no `when` clause — so a setup view can't be conditionally hidden.**
  Most other artifact types declare `when`; views and pages do not. If setup needs to branch on
  config or flags, branch inside the view.
  → [13-setup-assistants.md](13-setup-assistants.md#12-view-based-setup-assistants)

## UI output & sanitization

- **DOMPurify strips `name`/`id` attributes whose VALUE collides with a `document` or `<form>` property — silently.**
  `<input name="name">` (also `action`, `title`, `submit`, `method`, `target`, `elements`,
  `style`, …) loses its attribute, never reaches FormData, and `formData.name` is `undefined` with
  no error anywhere. Never use a bare DOM-property word as a field name; prefix or hyphenate
  (`your-name` — no DOM property contains a hyphen). → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **A second, separate DOMPurify rule drops the whole `value` ATTRIBUTE when the decoded value contains a complete tag.**
  Even correctly-escaped `&lt;script&gt;…&lt;/script&gt;` in a hidden input's `value` blanks the
  attribute on repaint. Ordinary values (`O'Brien`, `a < b`, `Jane <jane@example.com>`) round-trip fine.
  Don't round-trip tag-tolerant free text through `value` attributes — carry it in `sessionData`.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **`<script>` tags, inline event handlers, and `javascript:` URLs are stripped from `outputUI` markup.**
  There is no DOM API in the worker either. All interactivity flows through
  `data-script="<name>"` → `eventScripts/<name>.js`, or an embedded iframe messaging back.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **`data-script` click dispatch reads the EXACT hit-tested element — no ancestor traversal.**
  A `<span>` or `<svg>` child inside a `data-script` button swallows the click into nothing.
  Convention: `data-script` buttons contain text only. → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **Never apply `[data-script] > * { pointer-events: none; }` as a blanket rule — it bricks every `data-script` form.**
  Inputs and submit buttons inside such forms become unclickable, silent no-ops.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **Clicking a `data-script` form's padding fires the handler with NO `formData`.**
  Keep `data-script` forms tight around their controls and guard handlers for a missing
  `formData`. → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **Per-element payloads must ride in per-item `<form>`s with hidden inputs — the click path carries only static args.**
  Complex payloads: `encodeURIComponent(JSON.stringify(obj))` — not `btoa`, which throws on
  non-Latin-1. → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **Form submission never captures the submitter button's name/value.**
  You can't encode "which button was clicked" on submit buttons; use separate forms or hidden
  inputs per action. → [10-views-modals-forms.md](10-views-modals-forms.md)

- **`outputIframe` URLs need an explicit `https://` scheme — bare hostnames yield a blank frame.**
  With the proxy on, `new URL()` throws and the frame gets an empty src; the proxy also rejects
  non-HTTPS targets with an error overlay. → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md#thisoutputiframeurl-allow-sandbox-options)

- **Vendor cookies inside a proxied frame are third-party cookies — the session that works standalone can fail framed.**
  `SameSite=None; Secure` is the baseline requirement everywhere; adding `Partitioned` (CHIPS) is
  the forward-compatible best practice. Safari blocks third-party cookies with no escape hatch, so
  test there and design a cookie-less fallback (token in the frame URL or via postMessage). Also:
  passing a `sandbox` list without `allow-same-origin` gives the frame subtree an opaque origin and
  kills cookies outright. Nothing in the Kizen pipeline touches `Set-Cookie`.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md#cookies-the-vendor-session-that-works-standalone-and-fails-framed)

- **In proxy mode your `allow` list scopes the INNER frame — and origin-scoped grants must exactly match the framed origin.**
  The parent iframe always carries the fixed ceiling; your list travels via `&allow=`. A bare
  `microphone` expands to `'src'`, which only covers the proxy origin — write `microphone *` or
  `microphone https://exact.origin`. Empty allow = no powerful features regardless of ceiling.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **If the framed page navigates to a different origin, the proxy bridge breaks permanently (`ORIGIN_MISMATCH`).**
  Messages stop flowing for the life of the frame; there is no recovery except re-rendering the
  iframe. → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **`__dangerouslySkipProxy` gives up the message bridge, plugin attribution, and origin pinning.**
  Proxied embedding is the documented pattern; skip it only for content that genuinely cannot ride
  the proxy, and know that no postMessage envelope/unwrapping applies.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **App-page `iframe_url` embedding passes NO permissions at all — device access requires `outputIframe`.**
  Page-type iframes are proxied for basic embedding only; microphone/camera/etc. must come from a
  script surface calling `this.outputIframe(url, allow)`. → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **`this.outputView(viewId)` is NOT supported end-to-end — the host ignores the message.**
  The engine sends the relay but no host renders it; it silently no-ops. The working way to render
  a packaged view is `this.showViewInModal(viewId)`. To swap inline content, repaint with
  `outputUI`. → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **Floating-frame `hideHeader()`/`showHeader()` work ONLY on fixed-position frames.**
  Non-fixed frames are dragged by their header, so the calls silently no-op there.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **Floating frames auto-`show()` after their script starts — never call `show()` for the initial paint.**
  A frame is hidden until its script runs; the engine reveals it itself. Explicit `show()` is for
  re-revealing after `hide()`. → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **A floating frame's `message_handler` receives ALL window messages, but only `event === 'message'` proxy envelopes.**
  Proxy `loaded`/`error` envelopes are routed to dedicated hooks and never reach `message.js`;
  non-proxy messages pass through raw. Always shape-check `this.args.eventData`.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **Toolbar/menu ordering is host-controlled — items are sorted alphabetically by label.**
  You cannot control ordering of toolbar items, object-settings items, calendar sources, or blocks
  in pickers. → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **A toolbar item removed while the plugin is disabled comes back on re-enable — UNLESS someone saved the toolbar meanwhile.**
  Items are filtered out of a saved layout at render time while the plugin is off, so re-enabling
  normally restores them. But the toolbar builder loads the already-filtered list into its editing
  state, so any save performed while the plugin is disabled persists a layout with your item
  deleted — permanently. Re-enabling does not re-inject it; the user must drag it back from the
  left column. Same for toolbar templates re-saved while disabled.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **There is no way to push a toolbar item to all users by default.**
  A newly installed plugin's toolbar item appears in nobody's toolbar; defaults are only injected
  into never-modified layouts and contain no plugin entries. The only bulk path is an admin
  applying a toolbar **template**, which overwrites each recipient's whole toolbar. Don't rely on
  the toolbar as the discovery surface for a new feature.
  → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md)

- **A `when`-disabled or uninstalled artifact silently disappears from the UI.**
  No error, no placeholder (record-layout blocks collapse entirely). When debugging a missing
  surface, check the `when` clause against actual saved config keys first.
  → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

## Modals, prompts & forms

- **`showViewInModal` args must nest under `config.args` — top-level args are silently dropped.**
  `this.showViewInModal("myview", { args: {...}, options: {...} })`, never
  `showViewInModal("myview", {...args})`. → [10-views-modals-forms.md](10-views-modals-forms.md#thisshowviewinmodalid-config)

- **`showViewInModal` resolves `{canceled, values, eventSource}` at runtime — the TypeScript type (`{canceled, result?, error?}`) is stale.**
  Read `result.values`, and always guard `result.canceled` first. → [10-views-modals-forms.md](10-views-modals-forms.md)

- **Form values from views are ALWAYS array-wrapped; `dynamicPrompt` values are plain — the two result shapes are opposites.**
  `showViewInModal` formData uses `FormData.getAll` semantics: `"Jane"` → `["Jane"]`, an
  empty-but-present text input is `[""]` (truthy!), an unchecked checkbox group is absent. Unwrap
  with `formData.key?.[0]?.trim()` or join multi-values — indexing `[0]` silently drops extra
  values. `dynamicPrompt` values are plain scalars (`result.values.key`), selects are the whole
  `{label, value}` option object, and unset selects / blank numbers are ABSENT from `values`.
  → [10-views-modals-forms.md](10-views-modals-forms.md)

- **Multiple forms in one view merge into one flat formData map — same key across forms, last form wins.**
  Namespace input names per form if a view holds several. → [10-views-modals-forms.md](10-views-modals-forms.md)

- **There is exactly ONE app-global modal slot — a modal opening another modal deadlocks/queues.**
  Multi-step wizards are ONE frameless view that repaints itself via `outputUI`: steps are event
  scripts, state rides in hidden inputs re-emitted on every repaint, and "Back" must be its own
  `<form data-script>` carrying the accumulated hidden inputs (a plain button click loses state).
  → [10-views-modals-forms.md](10-views-modals-forms.md)

- **The host Confirm button on a framed form view never runs your submit event script.**
  It runs native constraint validation (`required`, `type=email`, `pattern`) and collects all
  forms itself. Framed form views need zero eventScripts; a submit event script fires only on a
  real form submission (the frameless pattern with a `type="submit"` button).
  → [10-views-modals-forms.md](10-views-modals-forms.md)

- **`frameless: true` strips ALL host chrome — the view must close itself with `this.closeModal(values, canceled)`.**
  Title, confirm, and cancel buttons are removed at the engine level (all-or-nothing). Wire your
  own footer buttons via `data-script`. → [10-views-modals-forms.md](10-views-modals-forms.md)

- **`this.prompt` is legacy — use `this.dynamicPrompt`, and use the current key names.**
  Items are keyed by `key` (legacy used `id`) and dropdowns are `type: "select"` (the legacy
  `"dropdown"` type has no result-cleaning case in `dynamicPrompt` — its value is silently
  dropped). → [10-views-modals-forms.md](10-views-modals-forms.md#thisdynamicpromptconfig)

- **`dynamicPrompt` callbacks cannot close over your script's scope — they are serialized to strings.**
  `getFetchUrl`/`optionMapper`/`getHeaders`/`getBody` are stringified and executed elsewhere with
  `({ state, args, utils })`. Share helpers through `registerUtils` and data through `args`, never
  through captured variables. → [10-views-modals-forms.md](10-views-modals-forms.md)

- **`required: true` IS host-enforced in `dynamicPrompt` — script-side re-checks are dead code.**
  The host blocks Confirm on blank required fields (it submits the raw untrimmed string — trim as
  normalization, not validation). Legacy `prompt`'s `required` was documentation-only.
  → [10-views-modals-forms.md](10-views-modals-forms.md)

- **`prompt`/`showViewInModal` resolve `{canceled: true}` when the host has no modal handler — indistinguishable from a user cancel.**
  On surfaces where modals aren't wired (rare), you cannot tell "canceled" from "unsupported".
  → [10-views-modals-forms.md](10-views-modals-forms.md)

- **`openCreateRelatedRecordModal` is wired only on record-detail and floating-frame surfaces.**
  Generic and calendar surfaces pass a no-op handler. → [04-worker-runtime-api.md](04-worker-runtime-api.md)

- **In a wizard's final write step, don't close the modal on failure — repaint the previous step so the user can retry.**
  `this.runEventScript("<prevStep>", { formData })` repaints in place; for partial-cascade
  failures, rewrite the repainted state to reference already-created records first.
  → [10-views-modals-forms.md](10-views-modals-forms.md)

- **Style form validation with `:user-invalid`, not `:invalid`.**
  `:invalid` flashes required fields red before the user has touched them.
  → [10-views-modals-forms.md](10-views-modals-forms.md)

## Blocks & CSS

- **Plugin blocks get NO host card chrome — transparent background, no border, no radius, no shadow — and are clipped by `overflow: hidden`.**
  Blocks must paint their own card, and inset it so a self-painted shadow isn't clipped
  (e.g. `margin: 4px; height: calc(100% - 8px)` with a tight shadow). The only host-provided
  shadow is the dashlet settings' drop-shadow toggle (rendered as a CSS `filter: drop-shadow`).
  → [09-blocks.md](09-blocks.md)

- **The host injects a global `* { font-size: 10px; line-height: 1 }` reset — em/rem are useless in plugin markup.**
  Set explicit px `font-size` (and usually `line-height`) on everything. SVG `<text>` with px
  sizes inside a scaled `viewBox` escapes the reset (it measures in user units) — the standard
  trick for chart labels that scale. Iframe surfaces are immune (separate document).
  → [09-blocks.md](09-blocks.md)

- **Blocks use `styles.css` mapped to a `styles` key; pages/views/frames use `css`.**
  Same mechanism, different key names — both are wrapped in a CSS `@scope { ... }` block, so write
  plain selectors; plugin CSS can't leak out, but host globals cascade in. → [09-blocks.md](09-blocks.md)

- **Dashboard/homepage blocks get NO record context — parse ids from the URL if you need them.**
  Dashboard blocks receive `{dateFilter, teamFilter, objectId}`; only record-surface blocks
  receive `{objectId, entityId}`. → [09-blocks.md](09-blocks.md)

- **An empty or missing `types` array puts the block in EVERY picker (dashboards, homepages, charts, records).**
  Set `types` deliberately. On record layouts the block renders at a fixed height
  (`recommended_height`, default 300px), not grid-resizable space. → [09-blocks.md](09-blocks.md)

- **Grid size constraints are re-derived from the block definition on every load — never stored.**
  Publishing new `min_w/max_w/min_h/max_h` retroactively changes resize limits on existing
  dashlets. → [09-blocks.md](09-blocks.md)

- **Keep one painter per block: a single `render` event script owns all markup.**
  The mount script paints a loading shell and delegates with `this.runEventScript("render")`;
  every state-changing event script re-enters the same painter. Volatile state rides in
  `sessionData`. Two painters drift. → [09-blocks.md](09-blocks.md)

- **Zero-progress arcs with round line-caps paint a stray dot — omit the arc entirely at zero.**
  Chart trap in SVG donut/progress rings. Also avoid referenced gradient defs in strokes (fragile
  in modals) — use solid strokes with CSS drop-shadow glows. → [09-blocks.md](09-blocks.md)

## Navigation & communication

- **Navigation context rides ONLY on relative URLs — absolute/cross-origin navigation silently drops the payload.**
  `this.openWindow(url, target, context)` stores context in sessionStorage and appends
  `?session_data_key=`; the mechanism requires `url.startsWith('/')`. Navigation still happens for
  other URLs — the context just never arrives. → [14-navigation-and-communication.md](14-navigation-and-communication.md#thisopenwindowurl-target-context)

- **There is no `navigate`/`redirect` method — in-app SPA navigation is `this.openWindow(relativeUrl, "_self")`.**
  Relative URL + target ≠ `_blank` routes through the host router; everything else is a real
  `window.open`. → [14-navigation-and-communication.md](14-navigation-and-communication.md)

- **Navigation context uses `JSON.stringify` semantics — circular refs and BigInt THROW in the worker; functions/undefined/symbols silently vanish.**
  Keep context payloads plain JSON. Also: `?session_data_key=` lingers in the address bar after
  the destination consumes the context. → [14-navigation-and-communication.md](14-navigation-and-communication.md)

- **`callback.js` can NEVER fire from `this.authorize()` on a script page.**
  Callback delivery requires the `/plugins/callback` helper page to load inside an iframe that is
  a child of the plugin-page tab (the iframe-type-page flow); `authorize()` opens a NEW TAB, and
  postMessage never crosses tabs. The authorize flow's completion signal is the marketplace
  Authorization panel (it polls), not your callback script.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **Cross-plugin dispatch does not exist — `runBlockScript`/`runFrameScript` are same-plugin, same-page only.**
  Recipient matching requires the same plugin; a dispatch to an unmounted target is a harmless
  no-op (no error, no queue). → [14-navigation-and-communication.md](14-navigation-and-communication.md)

- **`runBlockScript` runs the event script in EVERY mounted instance of the target block.**
  If the same block is placed three times on a page, the handler runs three times. Make handlers
  idempotent or key off instance state. → [14-navigation-and-communication.md](14-navigation-and-communication.md#thiscommunicaterunblockscriptblockapiname-scriptid-args)

- **`runFrameScript`/`runBlockScript` args are typed as flat scalars but JSON round-trip arbitrary objects.**
  Objects work fine (the payload is stringified and merged into the target's `this.args`) —
  shape-check on receipt anyway. → [14-navigation-and-communication.md](14-navigation-and-communication.md)

- **`setSessionData` shallow-merges TOP-LEVEL keys only — writing `{myMap: {k: true}}` REPLACES `myMap`.**
  And hand-spreading nested maps is racy across overlapping workers (each spreads its own stale
  snapshot; last write wins wholesale). Correct pattern: one top-level session key per independent
  fact — the engine's top-level merge then composes concurrent writes race-free.
  → [14-navigation-and-communication.md](14-navigation-and-communication.md)

- **`this.sessionData` is a construction-time snapshot of OTHER workers' writes — but it does reflect your own.**
  `setSessionData` updates the worker's local snapshot synchronously before posting, so re-reading
  `this.sessionData` after your own write in the same run works. What you will not see is a write
  another worker made after your run began; for that, the value is frozen at construction. Session
  data is plugin-scoped, memory-only, and does NOT survive a tab reload.
  → [14-navigation-and-communication.md](14-navigation-and-communication.md)

- **When blocks sync via broadcast + persisted snapshot, never gate the live broadcast on completeness/validity.**
  Broadcast exactly what the sender renders; gate only the persistence. Gating the broadcast makes
  receivers permanently miss "incomplete" (but rendered) states.
  → [14-navigation-and-communication.md](14-navigation-and-communication.md)

## Services, auth & secrets

- **Secrets are declared bare but read namespaced: `secrets["<plugin_api_name>__<secret_name>"]`.**
  A step declaring `"secrets": ["api_key"]` reads `secrets["example_plugin__api_key"]`. For repos
  whose api_name varies by environment, suffix-match:
  `next((k for k in secrets if k.endswith("api_key")), None)`. → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **The generic proxy WRAPS the upstream response — always unwrap `body`.**
  The proxy returns HTTP 200 with `{status_code, response_headers, body}`; from Python extract
  `body = resp.json().get("body") or {}` and check `status_code` yourself. Some APIs additionally
  hide errors behind HTTP 200 in their own envelope — check the vendor's ok-flag too.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **A disconnected/unauthorized OAuth service returns HTTP 503 from the proxy.**
  Treat 503 as "not connected — send the admin/user to authorize", not as a transient outage.
  Calendar sources treat a 503 as an auth error automatically. → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **The proxy forwards exactly TWO caller headers upstream: `X-Proxy-Authorization` → `Authorization`, and `Content-Type`.**
  Everything else — including `Accept` — is dropped and replaced with `Accept: application/json`.
  You cannot negotiate content types through the proxy. → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **`no_auth` services forward the caller's `X-Proxy-Authorization` verbatim — the secret is script-side.**
  Unlike every other auth type, the credential lives in (and is visible to) your script. Prefer
  `basic_auth_token_provided` with an integration secret so the proxy injects it server-side.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **A static stored secret with a custom Authorization scheme (e.g. `Authorization: ApiKey <key>`) is not expressible today.**
  `basic_auth_token_provided` always emits `Basic <token>`. If the vendor needs a custom scheme,
  the current options are a `no_auth` service + script-side header, or a token-exchange auth type
  if the vendor supports it. → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **Encrypt manifest secrets with `npx --yes @kizenapps/cli encrypt` — plaintext values still work but are legacy and discouraged.**
  The envelope `{"encrypted": true, "value": "<base64>"}` goes anywhere a secret lives in
  `kizen.json` (e.g. `services[].auth_credentials.client_secret`); the publish pipeline decrypts
  server-side. Note `npx --yes @kizenapps/cli encrypt` targets production keys by default — pass `--stage dev`
  explicitly for dev-key encryption. → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **Changing a service's OAuth credentials or scopes invalidates stored tokens — every business/user must re-authorize.**
  Credential changes flip installs to ERROR until re-auth; base-URL changes are seamless. Plan
  scope additions as a re-auth event. → [16-release-and-publish.md](16-release-and-publish.md)

- **`{{secret.KEY}}` templates in `services[]` that reference an unfilled/undeclared secret make the proxy return 400.**
  Every templated key must exist in `base_config.secrets` and hold a value for the business.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **Scripts never see OAuth tokens, and there is NO secrets API in browser workers.**
  Token storage/refresh is entirely server-side behind the proxy. Secrets are readable only inside
  Python Agentic Workflow steps (the `secrets` dict). A JS surface that needs an authed external
  call must go through a declared service. → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **Relative-URL worker requests run as the ACTING USER — there is no plugin service identity in the browser.**
  `this.get("/records/...")` uses the signed-in user's permissions; a plugin's service-account
  identity exists only for Python steps. Design permission expectations accordingly.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **Service `scope` restricts callers by identity class — the wrong caller gets 403.**
  `service-account-only` allows only the plugin's own service account (Python steps);
  `user-account-only` is the inverse (browser surfaces). Unknown scope strings deny everyone.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **Manifest-level `success_redirect_path`/`error_redirect_path` on services are effectively dead config.**
  First-party callers pass redirect paths as query params, which take precedence. Set redirects at
  the `this.authorize(serviceName, {successRedirectPath, errorRedirectPath})` call site.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **`this.authorize()` is fire-and-forget void — the outcome is unobservable from the script.**
  It opens the authorize URL in a new tab and resolves nothing. Poll your own "connected" signal
  (e.g. a cheap proxied GET that 503s when disconnected) or rely on the marketplace Authorization
  panel. → [06-auth-secrets-services.md](06-auth-secrets-services.md#thisauthorizeservicename-config)

- **Presigned/CDN download URLs must BYPASS the proxy.**
  Some CDNs reject requests carrying an injected `Authorization` header. Fetch presigned URLs
  directly (plain `fetch` in workers, `urllib`/`requests` without the proxy in Python).
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

- **Per-account-URL providers (each tenant has its own base URL) don't fit a static `base_service_url`.**
  Services are declared once per fixed base URL. For per-install hosts, put connection details in
  a JSON integration secret (the DB-connector pattern) or declare one service per known host.
  → [06-auth-secrets-services.md](06-auth-secrets-services.md)

## Calendar sources

- **Calendar schema validation REPORTS but does not FILTER — malformed entries render anyway.**
  The host's schema check is wrapped in a try/catch that routes the failure to `onError` and then
  returns your array unchanged, so a bad entry reaches the calendar UI regardless. Filter
  invalid entries in your own script. Calendars: `[{id, name, description?, default?}]`. Events:
  `[{id, calendar_id, title, start_time, end_time, description?, url?, activity_id?, all_day?,
  busy?, attendees?}]`.
  → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **Event times are epoch-millisecond NUMBERS, not ISO strings.**
  Use `this.formatDateForResponse(date)` (= `date.getTime()`). ISO strings fail validation.
  → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **All-day dates must be parsed as LOCAL midnight — `new Date("YYYY-MM-DD")` parses as UTC and shifts a day across DST/timezones.**
  Use `this.createDateObject(dateStr)` for date-only values; use `new Date(dateTime)` only for
  full timestamps with offsets. This is the #1 source of off-by-one-day calendar bugs.
  → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **On any fetch error, log and `return []` — degrade to "no events" instead of tearing the source down.**
  A thrown error breaks the whole calendar list for the user. → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **The calendar worker blocks UI-ish APIs at CALL time, not parse time.**
  `uploadFile`, `installThirdPartyScript`, `refreshEntityForId`, `openCreateRecordModal`,
  `openCreateRelatedRecordModal`, `showViewInModal`, `completeSetup` all **reject** with "not
  supported in calendar source scripts" — so an un-awaited call fails silently. `closeModal` alone
  throws synchronously. `prompt`/`dynamicPrompt` remain available. → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **The query range (`range_start`/`range_end`) is day boundaries in the USER's timezone, with offsets.**
  Formatted `yyyy-MM-dd'T'HH:mm:ssXXX`. Pass them through to the provider encoded
  (`encodeURIComponent`), don't re-derive boundaries. → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **Multi-select user-config values are `{label, value}` option objects — map `.value` before comparing to provider ids.**
  A calendar filter list built from raw option objects never matches anything.
  → [13-setup-assistants.md](13-setup-assistants.md)

- **Follow the provider's pagination in production sources.**
  Demo sources that ignore `nextPageToken`-style cursors silently drop events on busy calendars.
  → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

## Agentic Workflow steps & actions

- **An unmapped optional input is ABSENT from `inputs` — attribute access raises `AttributeError`, it is not `None`.**
  Always `getattr(inputs, "name", None)` for optional inputs. → [07-automation-steps.md](07-automation-steps.md)

- **`data_type` must be a VARIABLE type, not a field type — wrong values publish fine and then break the builder.**
  The valid enum (10 values): `string, boolean, number, date, datetime, email, phone_number,
  employee, entity, uuid`. Field-type names (`text`, `integer`, `decimal`, `money`, `files`)
  publish without error, render a broken field dropdown ("No Options"), and fail at Agentic
  Workflow save with `"X" is not a valid choice`. Use `number` for numerics; `files` is genuinely
  unsupported as a step param. → [07-automation-steps.md](07-automation-steps.md)

- **`allowed_values` on static inputs is stripped server-side at publish and never reaches the builder.**
  The workflow author sees a free-text control, not a picker, and nothing validates their input
  against your list. Scripts must handle out-of-set values explicitly.
  → [07-automation-steps.md](07-automation-steps.md)

- **`default` on a step input is dropped at publish too.**
  Same fixed field set. It does not pre-fill the builder's control and does not substitute a value
  at run time, so an input you expected to default arrives as whatever the empty control produced.
  Apply defaults in the script. → [07-automation-steps.md](07-automation-steps.md)

- **The authored `api_name` (published as `action_step_api_name`) is the step's real identity — `action_type` is dead and `script_alias` is vestigial.**
  Steps resolve by `(plugin_app, action_step_api_name)`. The Python runtime binds `inputs.<name>`
  by the param's `name`, never `script_alias`; a mismatched alias is harmless, a renamed
  `api_name` breaks every wired workflow. → [07-automation-steps.md](07-automation-steps.md)

- **`output_target` is a phantom key — silently dropped at publish.**
  `input_source` is used for both inputs and outputs. → [07-automation-steps.md](07-automation-steps.md)

- **`employee`/`entity` inputs arrive as bare id scalars (UUIDs), not objects.**
  A team-member input arrives as `uuid.UUID`; resolve details via
  `kizen.api.get(f"/team/{id}")`. `phone_number` arrives as an E.164 string.
  → [07-automation-steps.md](07-automation-steps.md)

- **Step execution is hard time-limited (55 s / 1 GB) — size retry budgets to fit inside it.**
  55 seconds is the platform's hard kill, not a target: design to roughly **30 seconds** so a
  retry still has room. Cap any single `Retry-After` sleep and raise with an actionable message
  instead of blowing the budget. → [07-automation-steps.md](07-automation-steps.md)

- **Python steps CAN call declared plugin services — through the proxy path, not a helper.**
  `kizen.api.post("/external-integrations/proxy/<plugin_api_name>/<service_name>/<path>", ...)`.
  There is no `getServiceUrl` in Python. → [07-automation-steps.md](07-automation-steps.md)

- **`business_plugin_config` is a builder-selectable input source you cannot pre-declare.**
  It isn't in the publish enum; at runtime it injects the clean config as a JSON STRING under the
  input's name — `json.loads` it. → [07-automation-steps.md](07-automation-steps.md)

- **`connection_secret_tag` is a plugin-side convention, not a platform field.**
  It's an ordinary step input whose value selects a nested key inside a JSON-valued secret.
  Server-side, the whole JSON blob is one integration secret. → [07-automation-steps.md](07-automation-steps.md)

- **Users paste secrets from rich-text docs — normalize smart quotes before `json.loads`.**
  Translate `“ ” ‘ ’ ‚ „` to straight quotes or JSON parsing fails on visually-correct input.
  → [07-automation-steps.md](07-automation-steps.md)

- **DB steps execute `inputs.query` verbatim — SQL injection is the caller's problem, and read/write must be split.**
  Give the read step a regex guardrail
  (`^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|CALL|DO)\b`) plus a
  session-level read-only mode; document that the write step has no guardrail.
  → [07-automation-steps.md](07-automation-steps.md)

- **Minor/patch republishes auto-apply to RUNNING workflows; majors require explicit upgrade.**
  Step config resolves to the latest version within the installed major at read time. A removed or
  renamed step hard-fails at run with "config not found"; most other drift (stale inputs, type
  changes) is silent. → [16-release-and-publish.md](16-release-and-publish.md)

- **A raised exception's message is exactly what the workflow run history shows — make it actionable.**
  Prefix with the vendor and tell the user what to check ("Check your workspace connection in the
  plugin setup assistant"). → [07-automation-steps.md](07-automation-steps.md)

- **JS action `config.json` is only `{name, api_name, hint_object_name}` — everything else is install-time association config.**
  `include_perform_action` (adds the action to Perform Action menus) lives on the
  action-template↔object association created at install/setup time; `hint_object_name` merely
  pre-selects the object. Neither is a `kizen.json` field. → [08-actions.md](08-actions.md)

- **A create-override needs TWO rows — the object setting alone is silently inert.**
  (a) an action-template↔object association (created by the marketplace Setup Assistant or
  `POST /external-integrations/browser-js-action-template-association`), and (b) the object's
  `action_override_create` set to the composite key `"{plugin_api_name}.{action_api_name}"`
  (dot-separated). Missing (a) means "+ Add" silently falls back to the native form with no error.
  Wrong key format = same silent fallback. → [08-actions.md](08-actions.md)

- **The create-override script must return the new record's id as a NON-EMPTY STRING.**
  `return String(created.id)`. A non-string result is ignored and a bare return no-ops — the host
  links nothing. Also handle the bail-out path: `await this.openCreateRecordModal(objectId)` then
  return `undefined` to fall back to the native form. → [08-actions.md](08-actions.md)

- **Duplicate association creates are rejected with a message containing "already exists." — match the text and treat as success.**
  The error `code` is not on the wire. Idempotent wiring scripts must string-match (and remember
  `Error.message` doesn't survive `JSON.stringify`). → [08-actions.md](08-actions.md)

- **In a relationship-add override, `this.objectId` is the RELATED object's id, not the host record's.**
  Host-record context is `this.entityId`/host ids; the action-target ids (`actionObjectId`/
  `actionEntityId`) are empty when invoked as a plain record action. → [08-actions.md](08-actions.md)

- **Bulk "Perform Action" for plugin JS actions is only wired on the record DETAIL page today.**
  List-page multi-select bulk execution of plugin actions is not wired in the host. Don't promise
  list-page bulk behavior. → [08-actions.md](08-actions.md)

- **A data adornment's return value is DISCARDED.**
  Adornments are fire-and-forget: mutate via the API, then `this.refreshEntity()` to repaint. Any
  reference code reading an adornment's return value is wrong. → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **Adornment `value` shapes are per-field_type — and a `datetime` value is always an ISO 8601 string.**
  The icon only renders when the field has a value, so `value` is never null/empty; the
  `{label}` option-object shape occurs only for `field_type: "date"`. Defensive shape-checks for
  impossible shapes are vestigial. → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **Phone extensions serialize with an `x` suffix (`+15555550123x123`) — a naive digit-strip fuses the extension onto the number.**
  Split on the first `x` and emit RFC 3966: `tel:+15555550123;ext=123`.
  → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **Object-settings items run with `objectId` only — `currentEntity()` is undefined.**
  `entityId` is coerced to `''`; don't depend on an entity. The return value is discarded here
  too. → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

- **Route scripts: `blocking: true` ALWAYS releases when the script settles — `releaseBlockingScript()` is only for releasing EARLY.**
  Normal return and thrown error both release (the engine's cleanup runs unconditionally). Using
  `releaseBlockingScript` as a hang-guard is redundant; only a never-settling script hangs the
  page. Note `blocking` and the object binding are install-time settings, not `config.json`
  fields. → [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md)

## Release & publish

- **Every release push must bump `kizen.json` `version` AND add `releaseNotes/<version>.md` — together, in the same commit.**
  The version must strictly increase versus the base branch (PR check), the backend rejects
  duplicate versions (400), and the notes file matching the version becomes the marketplace/release
  body. Treat the notes file as required practice even though the packager doesn't enforce it.
  → [16-release-and-publish.md](16-release-and-publish.md)

- **Changing or removing a plugin's `api_name` in a PR is hard-blocked — it is the plugin's permanent identity.**
  Renaming an action/step api_name is nearly as bad: associations and wired workflows key on it as
  plain text and dangle silently. → [16-release-and-publish.md](16-release-and-publish.md)

- **Publish is a wholesale replace — a new immutable version row, no diff/upsert.**
  Non-`0.0.0` versions are immutable; the `0.0.0` dev version is delete-and-recreate (a
  destructive overwrite of the previous dev build). → [16-release-and-publish.md](16-release-and-publish.md)

- **Preview (PR) deploys mutate identity: version forced to `0.0.0`, `published: false`, api_name suffixed per branch.**
  This is why hardcoded api_names 404 in previews and why preview installs are unlisted.
  → [16-release-and-publish.md](16-release-and-publish.md)

- **`published: false` does not mean private — it means unlisted.**
  The plugin is still published and installable by URL/api_name; it just doesn't appear in the
  marketplace listing. → [16-release-and-publish.md](16-release-and-publish.md)

- **`required_entitlement` gates visibility, not just installs.**
  Non-entitled businesses don't see the plugin in the marketplace at all; installs 400; direct
  retrieval 404s; revoking the entitlement triggers a full async uninstall. Only the latest
  published version's value is evaluated. → [16-release-and-publish.md](16-release-and-publish.md)

- **Installs auto-track minor/patch releases within the installed major — a "small" release ships instantly to every install.**
  There is no gradual rollout. Anything behavior-changing belongs in a major (which requires each
  business to explicitly upgrade). → [16-release-and-publish.md](16-release-and-publish.md)

- **`base_config.force_open_source` is a debugging flag — never ship it.**
  Open-source status is derived from the source repository's visibility at publish time.
  → [16-release-and-publish.md](16-release-and-publish.md)

- **Treat `kizen.json` as sensitive whenever any plaintext secret remains in it.**
  Artifact scripts run client-side and should be treated as open source; the manifest's
  `services[]` credentials are the exception. Encrypt them (`npx --yes @kizenapps/cli encrypt`) before making a
  repo public, and audit the FULL git history — a clean HEAD is not a clean repo; rotate anything
  ever committed. → [16-release-and-publish.md](16-release-and-publish.md)

- **Open-sourced Kizen plugins conventionally ship GPL-2.0 — don't default to MIT/Apache.**
  The ecosystem convention is copyleft, so derivative plugins stay open; match it unless you have
  a reason not to. → [16-release-and-publish.md](16-release-and-publish.md)
