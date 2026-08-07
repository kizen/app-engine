# Worker runtime API (`this.*`)

**What this covers:** the complete reference for the worker runtime context — the execution
model, the per-script-kind context/args matrix, and every `this.*` member with its signature.
Every JavaScript surface of a plugin — page, view, block, floating frame, action, adornment,
route script, object settings item, toolbar item, calendar source, and every event script —
is a bare script body executed inside a Web Worker with `this` bound to that context object.

**See also:** [platform API endpoints](05-platform-api.md) · [auth, secrets, services](06-auth-secrets-services.md) ·
[views, modals, forms](10-views-modals-forms.md) · [output UI, iframes, frames](11-output-ui-iframes-frames.md) ·
[navigation and communication](14-navigation-and-communication.md) ·
[errors and observability](15-errors-and-observability.md) · [gotchas](17-gotchas.md)

---

## 1. Execution model

### 1.1 One fresh worker per script run

Each script execution spawns a **brand-new Web Worker** with a **brand-new context object**.
There are four worker builds, selected by the surface that started the script:

| Worker | Context class | Used by |
|---|---|---|
| `genericPlugin` | base context | pages, views, blocks, toolbar items, page callbacks, their event scripts |
| `recordDetail` | base + record-detail methods | actions, route scripts, data adornments, object settings items |
| `floatingFramePlugin` | base + frame-control methods | floating frame scripts, frame message handlers, their event scripts |
| `calendarSource` | base, with UI/record methods disabled | `calendars` and `events` calendar-source scripts |

Consequences that shape how plugin code must be written:

- **Nothing on `this` survives between runs.** The main script and its event scripts do not
  share a context. Two invocations of the same event script do not share a context.
  `this.myCache = …` in one script is invisible everywhere else.
- **There is no module system.** The body is compiled as a function, so `import` and
  `require` are unavailable, and there is no file the scripts can share. Helper functions
  must be defined inside each script that uses them; duplicating a small `esc()` or
  `describeError()` helper across scripts is the correct, intended pattern — not a smell to
  refactor away.
- **What does persist:** the painted DOM from the last [`this.outputUI()`](#thisoutputuimarkup-options)
  (a repaint swaps it in place), `this.sessionData` (per browser session, per plugin), the
  per-user config store behind [`getUserConfig`/`setUserConfig`](#thisgetuserconfig), business
  config, and anything you wrote to the backend.

### 1.2 How the script body is wrapped

The raw body is compiled into an async function bound to the context. The effective shape is:

```js
// conceptual — this is what the engine builds around your script body
const console = this.console;            // the host-bridged console shadows the global
let __result;
try {
  __result = await (async () => {
    /* YOUR SCRIPT BODY */
  })();
} catch (ex) {
  this.onError(ex);                      // a throw is caught here, then cleanup runs
} finally {
  this.__cleanup(__result);              // posts DONE {result, preserve}
}
```

What follows from that wrapper:

- **Top-level `await` works.** No IIFE needed.
- **Top-level `return` works** and is the script's result value. Only some script kinds use
  the result (calendar sources, create-override actions — see the matrix in §2); for the rest
  the value is discarded.
- **`console` inside a script is the bridged `this.console`**, not the worker global.
- **A `throw` does not escape.** It aborts the remaining statements of your script, is
  reported through `this.onError`, and the run still completes from the host's point of
  view. See [errors and observability](15-errors-and-observability.md).
- **A syntax error is reported, not thrown.** If the body fails to compile, the engine runs a
  fallback that reports `The script has a syntax error and could not be parsed`. Nothing else
  in the script runs.
- `__setup` / `__cleanup` are engine-internal and throw if a script calls them.

### 1.3 Worker identity, rerun, and termination

A worker id is derived from the plugin api name, the surface api name, an optional
`worker_key` (for example a block's placement/instance id), a hash of the script body, and a
hash of the args.

- Starting a script whose id matches a currently-running worker **terminates the previous
  worker first**. This is why a block whose args or config change restarts cleanly instead of
  running twice.
- Changing the script body or the args produces a *different* identity, so the old worker is
  not terminated by the new one — they are different workers.
- After a run completes the worker is terminated, **unless `this.preserve = true`**.

### 1.4 `this.preserve`

```ts
this.preserve: boolean   // setter/getter, default false
```

Setting `this.preserve = true` keeps the worker alive after the script's promise resolves.
Use it when the script has started something that must keep running after the top-level body
returns (for example, a long-lived iframe bridge). Two caveats:

- The per-worker GET cache (§4.3) also stays alive, so relative GETs keep serving their first
  response for the life of the worker.
- A preserved worker is only reclaimed when a rerun with the same identity terminates it, or
  the page unloads.

### 1.5 No engine timeout

The engine imposes **no execution timeout on scripts**. A script that never settles simply
keeps its worker alive until a same-identity rerun terminates it or the page unloads. Two
places do have internal timers: `refreshEntityForId` gives up waiting after 30 seconds, and
third-party script readiness polling has its own cap. Neither bounds your script.

For a `blocking: true` route script this matters: app render waits for the script to settle.
It releases on normal completion *and* on a thrown error, so only a never-settling script can
hang the page.

### 1.6 The host bridge

Every `this.*` call that touches the outside world is a JSON `postMessage` to the host page,
correlated by id. Promise-returning members therefore **only resolve when the host answers**.
If the embedding host does not implement a given capability, the call may resolve with a
neutral value rather than reject (for example, modal calls resolve `{canceled: true}` when no
modal handler is wired), and [`postFormData`](#thispostformdataurl-data-createnewtab) rejects with
no reason at all. [`installThirdPartyScript`](#thisinstallthirdpartyscriptscripturl) is the
opposite trap: it never rejects, resolving `undefined` on failure after routing the error to a
fixed `onError` — so a failed install reads as a success unless you check the return value.

---

## 2. Script kinds: context and args

Every script kind is a **bare body** — there are no per-kind function signatures. What differs
is the context class, the args, and whether the return value is read.

| Script kind | Context | Args it receives (plus `pluginId`, `__kizen_user_config`) | Return value |
|---|---|---|---|
| Page script (`pages/<name>/script.js`) | base | URL query params merged with the page's configured `args` | discarded |
| Page callback (`pages/<name>/callback.js`) | base | the callback query object posted by the iframe | discarded |
| View script (`views/<name>/script.js`) | base | `config.args` passed to `showViewInModal` — **these replace the injected business config**, so `this.config` is `{}` unless you forward it yourself | discarded |
| Block script (`blocks/<name>/script.js`) | base (`worker_key` = block instance id) | block config `args` merged under host-supplied instance args (dashboards pass filters/object id) | discarded |
| Event script (`eventScripts/<name>.js`) | same class as its owning surface | caller args merged over the surface's own args; form submits add `formData` | discarded |
| Toolbar item script | base | none beyond the injected keys | discarded |
| Action script (`actions/<name>/script.js`) | record detail | action args | create-override actions **must return the new record id as a non-empty string**; otherwise discarded |
| Route script (`routeScripts/<name>/script.js`) | record detail | `{previousRoute, currentRoute}`; context carries `entityId`/`objectId` | discarded |
| Data adornment script | record detail | `{value, fieldId, fieldType, objectId, entityId, isActivity}` | discarded |
| Object settings item script | record detail with `objectId` only (`entityId` is empty, `currentEntity()` resolves undefined) | none beyond the injected keys | discarded |
| Floating frame script (`floatingFrames/<name>/script.js`) | floating frame | frame config `args` | discarded |
| Frame message handler (`message.js`) | floating frame | frame `args` plus `eventData` (the unwrapped message payload) | discarded |
| Calendar `calendars` script | calendar source | the plugin's business config | **required**: array of `{id, name, description?}` |
| Calendar `events` script | calendar source | business config plus `calendar: {calendar_id, range_start, range_end}` | **required**: array of `{id, calendar_id, title, start_time, end_time, …}` with epoch-ms times |

Two keys are always injected into `this.args` by the host: `pluginId` (the installed plugin's
id, used by [`getUserConfig`](#thisgetuserconfig)) and `__kizen_user_config`. Setup-assistant
flows add `__kizen_clean_config`, `__kizen_setup_assistant_values`, and
`__kizen_setup_assistant_hash`. Read config through the [`this.config`](#thisconfig) /
[`this.userConfig`](#thisuserconfig) getters rather than reaching into those keys.

---

## 3. Context data members

### `this.args`

```ts
this.args: { pluginId?: string; __kizen_clean_config?: unknown; __kizen_user_config?: unknown } & Record<string, unknown>
```

The parsed args object for this run. The host serializes args to a JSON string and the worker
parses it; **invalid JSON silently becomes `{}`**. Values arriving from form submits are
array-wrapped (`FormData.getAll` semantics).

```js
const ref = this.args.ref;                       // ?ref=email on a page URL
const name = this.args.formData?.["your-name"]?.[0]?.trim();
```

### `this.config`

```ts
this.config: Record<string, unknown>   // read-only Proxy over the injected business config
```

The plugin's **business-level** clean config — what a business admin set in the setup
assistant, plus anything written to the plugin's business config. Unknown keys return
`undefined` rather than throwing. Typed as `unknown` values, so cast at the read site.

Value shapes per setup-assistant field type:

| Field type | Shape read from `this.config` |
|---|---|
| `boolean` | raw boolean |
| `text` | string |
| `number` | number; **absent** when the author left it blank |
| `select` | the whole option object `{label, value}` — read `.value` |
| `select` with `allow_multiple` | array of option objects |
| `custom_object` | `{objectId, objectName}` — read `.objectId` |
| `field` | `{fieldId, fieldName, objectId, objectName}` (array when `allow_multiple`); note it is the field **id**, not api name |

```js
const objectId = this.config?.targetObject?.objectId;
const mode = this.config?.mode?.value ?? "default";
```

`this.config` is a snapshot taken when the worker started. A value you just wrote to business
config will not appear until the next run — re-read it over HTTP if you need it fresh.

> A view opened through `showViewInModal` with `config.args` gets those args **in place of**
> the injected business config, so `this.config` is `{}` inside the view and its event
> scripts. Forward it explicitly: `showViewInModal("myview", { args: { config: this.config } })`.

### `this.userConfig`

```ts
this.userConfig: Record<string, unknown>   // read-only Proxy over the injected per-user config
```

The already-loaded per-user config (user setup assistant values). Same value shapes as
`this.config`. For read/write access to the per-component user config store, use
[`getUserConfig`](#thisgetuserconfig) / [`setUserConfig`](#thissetuserconfigconfig).

**`{}` is ambiguous, and you cannot disambiguate it.** The host fetches each plugin's per-user
config separately from the main bootstrap, and when that fetch fails it catches the error and
substitutes `{ config: {} }`. Your script then sees `this.userConfig === {}` — structurally
identical to a user who simply has not filled the assistant out yet. No error flag is injected
alongside it, and none exists to read.

The practical consequence: **do not treat empty user config as proof the user is unconfigured** if
the difference is expensive. Prompting someone to re-enter settings they already saved, because a
transient fetch failed, is the failure this produces. Where it matters, re-read the config
explicitly with [`getUserConfig`](#thisgetuserconfig), which performs its own request and lets you
tell a failure from a genuine blank.

The user is not left completely in the dark — the host shows a failure toast ("There was a problem
loading installed apps") and reports to monitoring for anything other than 401/403/404. But that
signal reaches the *user*, not your script. Note also that this fetch is **not retried**: the
error is caught inside the query function, so the host's retry policy never engages.

### `this.currentUser`

```ts
this.currentUser: { profile: {
  id: string;              // the team-member id
  full_name: string; first_name: string; last_name: string;
  email: string; phone: string; created: string;
  crm_client_id: string;
} }
```

**Everything nests under `.profile`.** `this.currentUser.first_name` is always `undefined`.
Missing values default to empty strings, so check for `""`, not `null`.

```js
const who = this.currentUser?.profile?.first_name || this.currentUser?.profile?.email;
```

### `this.currentBusiness`

```ts
this.currentBusiness: { id: string } | undefined
```

The typed contract is `{ id }`. At runtime the object also carries `employee_id`,
`client_object.id`, `timezone.name`, and `entitlements` — widely used, but outside the typed
contract, so guard them.

```js
const clientObjectId = this.currentBusiness?.client_object?.id;
const tz = this.currentBusiness?.timezone?.name;   // present at runtime, not in the typed contract
```

### `this.applicationPath`

```ts
this.applicationPath: string
```

The API base path the host is running against. Useful for building absolute links; do **not**
use it to branch on environment by substring matching — model environments with services,
config, or entitlements instead.

### `this.location`

```ts
this.location: { host, hash, href, origin, pathname, search, port, protocol }
```

A snapshot of the host page location taken when the worker started. It is a Proxy that
**throws** on any property that is not in the list above (`Property X is not available on
location object for plugin apps`). `JSON.stringify(this.location)` works.

```js
const params = new URLSearchParams(this.location.search);
```

### `this.pluginApiName`

```ts
this.pluginApiName: string
```

The plugin's api name **as installed**. Preview/sandbox builds publish under a suffixed api
name, so always build proxy and business-config URLs from this value — never from a hardcoded
literal.

```js
const url = `/external-integrations/business-plugin-apps/${this.pluginApiName}`;
```

### `this.sessionData`

```ts
this.sessionData: Record<string, unknown>
```

An in-memory bucket scoped to the **plugin** (every surface of the plugin on the page shares
it), held in host state. It does not survive a tab reload. It is a **construction-time
snapshot**: a script never observes its own write within the same run, so re-reading
`this.sessionData` after `setSessionData` is dead code.

### `this.tempPromptState`

```ts
this.tempPromptState: Record<string, unknown>
```

A scratch object on the context, used by dynamic prompt flows to carry state between the
prompt's serialized field callbacks. It is per-run like everything else on `this`.

### `this.debug`

```ts
this.debug: boolean   // setter
```

Turns on engine logging for this run (script body, execution time) and makes
[`onError`](#thisonerrorerror) hit a `debugger` statement. Never ship `this.debug = true`.

---

## 4. HTTP

### 4.1 Two request modes, chosen by the URL

| URL form | Path taken | Auth | Notes |
|---|---|---|---|
| starts with `/` | bridged to the host's authenticated Kizen API client | **acts as the signed-in user** — the worker holds no credentials | GETs are cached per worker; requests carry `X-Request-Type: kizen-ui-scripting-api` (except `patch`) |
| anything else (absolute) | plain `fetch` from inside the worker | none injected | ordinary CORS rules apply; JSON body/response assumed |

External APIs that need credentials should go through the service proxy — build the URL with
[`getServiceUrl`](#thisgetserviceurlservicename-path), which returns a **relative** URL, so it
travels the first row of that table and the backend injects the service's credentials
server-side. See [auth, secrets, services](06-auth-secrets-services.md).

### 4.2 Options and return shapes

```ts
interface RequestOptions {
  headers?: Record<string, string>;
  ignoreCache?: boolean;     // relative GET only — bypass the per-worker cache
  returnErrors?: boolean;    // resolve [data, error] instead of reporting and resolving undefined
  credentials?: 'include';   // absolute URLs only
}

type RequestResponse           = Promise<unknown | undefined>;
type RequestWithErrorsResponse = Promise<[unknown | null, KizenRequestError | null]>;
```

Two families of methods over the same transport:

- **Plain variants** (`get`, `post`, `patch`, `delete`): on failure they call
  [`this.onError`](#thisonerrorerror) internally and resolve **`undefined`**. The caller
  cannot tell "failed" from "succeeded with an empty body", and the failure is reported to
  platform monitoring whether or not it was your fault.
- **`*WithErrors` variants**: resolve a `[data, error]` tuple and never report anything
  themselves. **This is the recommended form for all new code.** See
  [errors and observability](15-errors-and-observability.md#5-the-witherrors-tuple-convention).

`{returnErrors: true}` on a plain variant is exactly what the `*WithErrors` wrapper does.

### 4.3 The relative-GET cache

Relative GET responses are memoized in a per-worker `Map` keyed by URL, **with no expiry** —
the same URL returns the first response for the life of the worker. Only `get` caches; POST,
PATCH and DELETE never do. Because each run gets a fresh worker, the cache is normally
short-lived — but with `this.preserve = true` it lives as long as the worker does.

Pass `{ignoreCache: true}` whenever a read must reflect a write you just made:

```js
const [object] = await this.getWithErrors(`/custom-objects/${objectId}`, { ignoreCache: true });
```

### `this.get(url, options?)`

```ts
get(url: string, options?: RequestOptions): Promise<unknown | undefined>
```

GET. Relative URLs go to the Kizen API and are cached (§4.3); absolute URLs are a direct
`fetch`. On failure: reports through `onError` and resolves `undefined`. Prefer
[`getWithErrors`](#thisgetwitherrorsurl-options).

### `this.getWithErrors(url, options?)`

```ts
getWithErrors(url: string, options?: RequestOptions): Promise<[unknown | null, KizenRequestError | null]>
```

GET returning a `[data, error]` tuple; never throws, never reports on its own.

```js
const [records, error] = await this.getWithErrors(
  `/records/example_object/lookup?identifier=${encodeURIComponent(email)}`,
);
if (error) {
  this.showToast(`Lookup failed: ${error.message}`, { variant: "failure", autohide: false });
  return;
}
```

### `this.post(url, body?, options?)`

```ts
post(url: string, body?: unknown, options?: RequestOptions): Promise<unknown | undefined>
```

POST with a JSON body. Adds `X-Request-Type: kizen-ui-scripting-api` on relative URLs. On
failure: reports and resolves `undefined`.

### `this.postWithErrors(url, body, options?)`

```ts
postWithErrors(url: string, body: unknown, options?: RequestOptions): Promise<[unknown | null, KizenRequestError | null]>
```

```js
const [created, error] = await this.postWithErrors(`/records/example_object/add`, {
  fields: [{ name: "name", value: "Example record" }],
});
if (error) { /* handle */ }
```

### `this.patch(url, body?, options?)`

```ts
patch(url: string, body?: unknown, options?: RequestOptions): Promise<unknown | undefined>
```

PATCH with a JSON body. On failure: reports and resolves `undefined`.

> `patch` is the one Kizen-bound verb that does **not** add the
> `X-Request-Type: kizen-ui-scripting-api` header — it passes `options.headers` through
> untouched. Nothing in the platform requires that header today, but do not rely on its
> presence when reasoning about PATCH traffic.

### `this.patchWithErrors(url, body, options?)`

```ts
patchWithErrors(url: string, body: unknown, options?: RequestOptions): Promise<[unknown | null, KizenRequestError | null]>
```

```js
const [, error] = await this.patchWithErrors(`/records/${this.objectId}/${this.entityId}`, {
  fields: [
    { name: "example_field", value: nextValue },      // overwrite
    { name: "example_log", add_values: [nextValue] }, // append to a multi-value field
  ],
});
```

### `this.delete(url, options?)`

```ts
delete(url: string, options?: RequestOptions): Promise<unknown | undefined>
```

DELETE. A `204 No Content` resolves with a null body. On failure: reports and resolves
`undefined`.

### `this.deleteWithErrors(url, options?)`

```ts
deleteWithErrors(url: string, options?: RequestOptions): Promise<[unknown | null, KizenRequestError | null]>
```

Resolves `[null, null]` on a successful `204` — a null data half is **not** an error signal;
always branch on the error half.

### There is no `this.put`

The transport supports PUT and the host wires a handler for it, but **no public `this.put`
method is exposed**. Use `patch`/`patchWithErrors`; if an external API genuinely requires PUT,
call it as an absolute URL with the worker's global `fetch`, or model it as a service and let
the proxy forward the verb.

### `KizenRequestError`

```ts
class KizenRequestError extends Error {
  proxyStatus: number;         // status of the Kizen request itself
  upstreamStatus?: number;     // status the external service returned, when proxied
  upstreamResponse?: unknown;  // parsed upstream body, when available
  message: string;             // upstreamResponse.error.message, else `Request failed with status code N`
}
```

The error half of every relative-URL tuple is a real `KizenRequestError` instance,
reconstructed inside the worker after crossing the message boundary. The two-status split
matters: when a call through the service proxy reaches the external system and *it* fails, the
proxy call itself succeeded — you get `proxyStatus: 200` with the real failure in
`upstreamStatus`. See
[proxy vs upstream status](15-errors-and-observability.md#6-kizenrequesterror-proxy-vs-upstream-status).

Absolute-URL requests do not produce a `KizenRequestError`; a non-OK response throws
`{status, statusText, body}` (surfacing in the error half of a `*WithErrors` tuple). Normalize
before display — `Error.message` is non-enumerable, so `JSON.stringify(err)` yields `"{}"`.

### `this.postFormData(url, data, createNewTab?)`

```ts
postFormData(url: string, data: Record<string, unknown>, createNewTab?: boolean): Promise<void>
```

Builds a real hidden `<form method="POST">` host-side, one hidden input per key (values are
coerced to strings), and submits it. `createNewTab` defaults to `true`. This is the escape
hatch for vendor SSO endpoints that require a browser form POST rather than JSON — it does not
go through the service proxy and sends no Kizen headers.

Resolves `undefined` on success; **rejects with no reason on failure**, so wrap it if you need
to distinguish.

```js
const [token, error] = await this.getWithErrors(this.getServiceUrl("example_service", "/sso-token"));
if (error) { this.showToast(`SSO unavailable: ${error.message}`, { variant: "failure" }); return; }
await this.postFormData("https://vendor.example.com/sso", { Token: token.value }, true);
```

### `this.uploadFile(blob, fileName?, isPublic?)`

```ts
uploadFile(blob: Blob, fileName?: string, isPublic?: boolean): Promise<{ id: string } & Record<string, unknown>>
```

Base64-encodes the blob in the worker and hands it to the host, which performs the Kizen file
upload. Resolves with the uploaded file's metadata — `id` is the file UUID you write into a
`files` field. `isPublic` defaults to `false`. Workers have `Blob`, `FileReader`, and `fetch`,
so downloading then uploading works.

Not available in calendar-source scripts (throws). Also unavailable if the host does not
implement file uploads.

```js
const response = await fetch(recordingUrl);
const blob = await response.blob();
const uploaded = await this.uploadFile(blob, "recording.mp3", false);
await this.patchWithErrors(`/records/${this.objectId}/${this.entityId}`, {
  fields: [{ name: "example_attachment", value: [uploaded.id] }],
});
```

---

## 5. Services and authorization

### `this.getServiceUrl(serviceName, path)`

```ts
getServiceUrl(serviceName: string, path: string): string
```

Returns `/external-integrations/proxy/{pluginApiName}/{serviceName}{path}` — a **relative**
URL, so passing it to `get*/post*/patch*/delete*` routes the call through the Kizen backend
proxy, which resolves the service's `base_service_url` and injects credentials server-side.
The worker never sees tokens or secrets, and there is no secrets API in the worker runtime.

```js
const [profile, error] = await this.getWithErrors(
  this.getServiceUrl("example_service", "/v1/me"),
);
```

Only two caller headers survive the proxy (`Content-Type`, and the passthrough authorization
slot used by `no_auth` services); everything else — including `Accept` — is replaced. See
[auth, secrets, services](06-auth-secrets-services.md).

### `this.authorize(serviceName, config?)`

```ts
authorize(serviceName: string, config?: {
  successRedirectPath?: string;
  errorRedirectPath?: string;
}): void
```

Starts the OAuth flow for one of the plugin's declared services by opening the authorize URL
**in a new tab**. It is fire-and-forget: it returns `void`, and the outcome is not observable
from the script. Redirect paths default to `/marketplace/{pluginApiName}/auth`.

```js
this.authorize("example_service");
this.showToast("Finish authorizing in the new tab, then reload this page.", { variant: "alert" });
```

Because the flow lands in a different tab, a page `callback.js` script can never fire from
`authorize()` — do not pair the two.

---

## 6. Persisted state

### `this.setSessionData(update)`

```ts
setSessionData(update: Record<string, unknown>): void
```

Shallow-merges `update` into the plugin's session bucket. Throws if given a non-object or an
array. Fire-and-forget — the write lands host-side and is visible to the *next* script run,
not to the rest of the current one.

**The merge is top-level only.** Writing `{filters: {status: true}}` replaces the whole
`filters` object. Because concurrent workers each spread their own stale snapshot, hand-merging
nested maps is racy; give each independent fact its own top-level key and let the engine's
shallow merge compose concurrent writes:

```js
// good — independent top-level keys, race-free
this.setSessionData({ selectedRecordId: id });
this.setSessionData({ lastRefreshedAt: Date.now() });

// racy — two overlapping workers each rewrite the whole map
this.setSessionData({ ui: { ...this.sessionData.ui, selectedRecordId: id } });
```

Session data is memory-only: it does not survive a tab reload, and it is shared by every
surface of the same plugin on the page.

### `this.getUserConfig()`

```ts
getUserConfig(): Promise<Record<string, unknown>>
```

Reads the **per-employee, per-plugin-component** config bucket (`GET
/employee/mine/configs/plugins/{pluginId}`, cache bypassed) and returns the slice belonging to
the current component, or `{}`. Throws if the script is not associated with a plugin and a
component.

The component key is derived host-side from the plugin api name and the surface api name, so
each surface has its own bucket — a block and a toolbar item of the same plugin do not share
user config.

### `this.setUserConfig(config)`

```ts
setUserConfig(config: Record<string, unknown>): Promise<unknown>
```

Read-merges `config` into this component's bucket and POSTs the whole config map back.

```js
const current = await this.getUserConfig();
await this.setUserConfig({ ...current, collapsed: true });
```

There is no ETag or locking on this write — it is read-modify-write, so two surfaces writing
concurrently can lose one of the updates. There is no `setBusinessConfig`; business-level
config is written with a wholesale-replace PATCH against the plugin's own business-config
endpoint (see [platform API](05-platform-api.md)).

---

## 7. Modals and prompts (signatures)

Full UX contracts — validation, framed vs frameless chrome, result unwrapping, the
single-modal-slot rule, multi-step wizards — live in
[views, modals, and forms](10-views-modals-forms.md). This section is the signature reference.

### `this.dynamicPrompt(config)`

```ts
dynamicPrompt(config: {
  title?: string;
  size?: 'small' | 'medium' | 'large';        // 400 / 900 / 1200 px
  confirmButton?: { label: string; variant?: 'text' | 'standard'; color?: string };
  cancelButton?:  { label: string; variant?: 'text' | 'standard'; color?: string };
  registerUtils?: Record<string, (...args: unknown[]) => unknown>;
  content: Array<{
    type: 'description' | 'text' | 'number' | 'select' | 'boolean' | 'spacer' | 'container';
    key: string;                              // result key (NOT `id`)
    content?: string;                         // for type: 'description' (markdown or HTML)
    label?: string; placeholder?: string; tooltip?: string;
    required?: boolean;                       // host-enforced
    default?: unknown;
    widthPercent?: 50 | 100;
    columns?: number;                         // for type: 'container'
    height?: number;                          // for type: 'spacer'
    validation_pattern?: string;              // for type: 'text'
    options?: Array<{ label: string; value: unknown }>;
    allow_multiple?: boolean;
    autoSelect?: boolean;                     // select: auto-pick a lone option
    when?: string;                            // expression over other keys
    dependencies?: string[];
    typeahead?: boolean;
    fetchMethod?: 'GET' | 'POST';
    getFetchUrl?:  (ctx: { state; args; utils }) => string;
    optionMapper?: (ctx: { state; args; utils }) => Array<{ label: string; value: unknown }>;
    getHeaders?:   (ctx: { state; args; utils }) => Record<string, string>;
    getBody?:      (ctx: { state; args; utils }) => unknown;
    fields?: unknown[];                       // for type: 'container'
  }>;
}): Promise<{ canceled: boolean; values: Record<string, unknown> }>
```

The current prompt API. The four field callbacks are **serialized to strings** by the engine
and evaluated host-side, so they must be self-contained — they cannot close over variables
from your script. `registerUtils` is the supported way to hand them helpers.

Result values arrive cleaned per field type: `text` is a plain string (**not** array-wrapped,
unlike `showViewInModal` form data), `number` is a number and is **absent** when blank,
`select` resolves to the whole `{label, value}` option object (an array of them with
`allow_multiple`) and is absent when nothing was picked.

```js
const result = await this.dynamicPrompt({
  title: "Pick a mode",
  size: "small",
  confirmButton: { label: "Run", variant: "standard" },
  cancelButton: { label: "Cancel", variant: "text" },
  content: [
    { type: "description", widthPercent: 100, content: "Choose how to run." },
    {
      type: "select", key: "mode", label: "Mode", required: true, widthPercent: 100,
      options: [{ label: "Fast", value: "fast" }, { label: "Thorough", value: "thorough" }],
    },
  ],
});
if (result.canceled) return;
const mode = result.values.mode.value;   // select → whole option object
```

`required: true` is enforced by the host — re-checking it in the script is an anti-pattern.

### `this.prompt(config)`

```ts
prompt(config: {
  title?: string;
  viewId?: string; args?: Record<string, unknown>;
  confirmButton?: ButtonConfig; cancelButton?: ButtonConfig;
  content?: ModalBlock[];        // blocks keyed by `id`; dropdowns use type: 'dropdown'
  frameless?: boolean;
  size?: 'small' | 'medium' | 'large';
}): Promise<{ canceled: boolean; values?: Record<string, unknown> }>
```

**Legacy.** Older key names (`id` instead of `key`, `dropdown` instead of `select`) and
`required` is documentation-only — not enforced. Existing plugins still use it; new code should
use [`dynamicPrompt`](#thisdynamicpromptconfig).

### `this.showViewInModal(id, config?)`

```ts
showViewInModal(id: string, config?: {
  args?: Record<string, unknown>;
  options?: {
    title?: string;
    confirmButton?: { label: string; variant?: 'text' | 'standard'; color?: string };
    cancelButton?:  { label: string; variant?: 'text' | 'standard'; color?: string };
    frameless?: boolean;
    size?: 'small' | 'medium' | 'large';   // 400 / 900 / 1200 px
  };
}): Promise<{ canceled: boolean; values?: Record<string, unknown>; eventSource?: string }>
```

Opens one of the plugin's packaged views in the host modal. `id` is the view's `api_name`.

- **Args must nest under `config.args`.** Args placed beside `options` are silently dropped.
- A framed view's confirm button runs native form validation and collects form data itself;
  values arrive **array-wrapped** at `result.values.formData`.
- A frameless view owns its chrome and resolves whatever it passed to
  [`closeModal`](#thisclosemodalvalues-canceled).
- Not available in calendar-source scripts (throws).

```js
const result = await this.showViewInModal("example_view", {
  args: { config: this.config },
  options: { title: "Add a record", size: "medium", confirmButton: { label: "Save" } },
});
if (result.canceled) return;
const name = (result.values?.formData?.["your-name"] ?? []).join(", ");
```

Full contract: [views, modals, and forms](10-views-modals-forms.md#thisshowviewinmodalid-config).

### `this.closeModal(values?, canceled?)`

```ts
closeModal(values?: Record<string, unknown>, canceled?: boolean): void
```

Fire-and-forget. Closes the currently open modal and resolves the pending
`showViewInModal` promise with `{canceled: canceled ?? false, values: values ?? {}, eventSource: 'script'}`.
Called from inside the modal's view or one of its event scripts. Not available in
calendar-source scripts.

```js
// eventScripts/submit.js inside a frameless view
this.closeModal({ formData: this.args.formData }, false);
```

### `this.openCreateRecordModal(objectId)`

```ts
openCreateRecordModal(objectId: string): Promise<unknown>
```

Opens the native Kizen "create record" UI for an object and resolves with the created-record
payload from the host. Wired only on record-detail and floating-frame surfaces; on generic and
calendar surfaces the host handler is a no-op.

### `this.openCreateRelatedRecordModal(objectId, relatedEntityId)`

```ts
openCreateRelatedRecordModal(objectId: string, relatedEntityId: string): Promise<unknown>
```

Same, pre-linked to an existing record — the native path a relationship-add override falls
back to.

---

## 8. Output (signatures)

Sanitization rules, the `data-script` interactivity model, frame-proxy behavior and CSS
environment live in [output UI, iframes, and frames](11-output-ui-iframes-frames.md).

### `this.outputUI(markup, options?)`

```ts
outputUI(markup: string, options?: { useDevMode?: boolean; __dangerouslySkipProxy?: boolean }): void
```

Sanitizes an HTML string host-side (DOMPurify, plus `<iframe>` support with proxy rewriting)
and sets it as the innerHTML of the surface's output region. **Replaces** whatever was there.
Fire-and-forget: it returns `void`, and there is no callback when the paint lands.

There is no DOM in the worker and `<script>` tags are stripped, so all interactivity comes from
`data-script="<eventScriptName>"` attributes on buttons and forms.

```js
this.outputUI(`
  <div class="card">
    <h2>Example</h2>
    <form data-script="save">
      <input type="text" name="your-name" required />
      <button type="submit">Save</button>
    </form>
  </div>
`);
```

### `this.outputIframe(url, allow?, sandbox?, options?)`

```ts
outputIframe(
  url: string,
  allow?: string[],      // filtered to microphone, speaker-selection, autoplay, camera, display-capture, hid
  sandbox?: string[],    // filtered to allow-popups, allow-scripts, allow-same-origin
  options?: { useDevMode?: boolean; __dangerouslySkipProxy?: boolean },
): void
```

Embeds a URL in the surface's output region, routed through the plugin frame proxy by default.
`url` must include the scheme and must be HTTPS. Script completion is deferred until the iframe
fires `load`, so the surface's loading state clears when the frame is really up.

```js
this.outputIframe("https://example.com/widget", ["microphone https://example.com"]);
```

### `this.outputView(viewId, args?)` — not supported

```ts
outputView(viewId: string, args?: Record<string, unknown>): void
```

Relays a request to render a packaged view inline in the output region. **The host does not
implement the receiving end, so this silently does nothing.** Use
[`showViewInModal`](#thisshowviewinmodalid-config) to show a view, or paint the same markup
with [`outputUI`](#thisoutputuimarkup-options).

---

## 9. Navigation

Full navigation semantics — the relative-URL requirement, session-key handoff, and what
survives a cross-origin hop — are in
[navigation and communication](14-navigation-and-communication.md).

### `this.openWindow(url, target?, context?)`

```ts
openWindow(url: string, target?: string, context?: unknown): void
```

The only navigation primitive. There is no `navigate` or `redirect` method.

- **Relative URL + `target !== '_blank'`** → in-app SPA navigation (history push).
- **Relative URL + `_blank` + same origin** → new tab that inherits the navigation context.
- **Anything absolute or cross-origin** → plain `window.open` with `noopener noreferrer`; any
  `context` is **silently dropped**.

`context` (engine 1.8.0 and later) is an arbitrary JSON-serializable payload stored under a
minted session key that is appended to the URL as `?session_data_key=…`; the destination page
reads it with the engine's navigation-context helpers. Values that `JSON.stringify` cannot
represent are dropped, and circular references throw in the worker.

```js
this.openWindow(`/custom-objects/${objectId}/${entityId}`, "_self");
this.openWindow("tel:+15555550123");
```

---

## 10. Running other scripts

### `this.runEventScript(scriptName, args?)`

```ts
runEventScript(scriptName: string, args?: Record<string, unknown>): void
```

Runs one of the current surface's own `eventScripts/<name>.js` in a **new worker**, with
`args` merged over the surface's own args. Fire-and-forget — it returns `void` and you cannot
await the result or observe failure.

Works from main scripts as well as event scripts, which enables the **single-painter**
convention: the mount script paints a loading shell and delegates to one `render` event script
that owns all markup; every state-changing script re-enters `render` when it is done.

```js
this.setIndicator("spinner");
this.runEventScript("render", { page: 1 });
```

### `this.communicate.runBlockScript(blockAPIName, scriptId, args?)`

```ts
communicate.runBlockScript(blockAPIName: string, scriptId: string, args?: Record<string, string | number>): void
```

Runs an event script on a **block of the same plugin** mounted on the same page (engine 1.7 and
later). Every mounted instance of that block runs the script; if the block is not mounted it
is a harmless no-op. Fire-and-forget.

The args type says scalars, but the payload is JSON round-tripped, so nested objects and arrays
survive intact — validate their shape on receipt.

### `this.communicate.runFrameScript(frameAPIName, scriptId, args?)`

```ts
communicate.runFrameScript(frameAPIName: string, scriptId: string, args?: Record<string, string | number>): void
```

Same, targeting a floating frame's event script. This is how adornments, actions, and object
settings items drive a frame.

```js
this.communicate.runFrameScript("example_frame", "dialNumber", { phoneNumber: this.args.value });
```

### `this.communicate.sendMessageToOwnFrame(payload, path)`

```ts
communicate.sendMessageToOwnFrame(payload: unknown, path: string): void
```

Posts a message **down** into the plugin's own iframe (the one created by `outputIframe` or an
iframe surface), through the proxy bridge. `path` is the target origin (`"*"` is accepted).
Fire-and-forget.

Dispatch semantics for all three, including who receives what and same-plugin scoping, are in
[navigation and communication](14-navigation-and-communication.md).

---

## 11. Toasts, indicators, clipboard, and utilities

### `this.showToast(message, options?)`

```ts
showToast(message: string, options?: {
  variant?: 'alert' | 'failure' | 'success';   // default 'success'
  autohide?: boolean;                          // default true
}): void
```

The primary user-facing feedback channel, and the correct destination for **expected**
failures. Host-styled; the plugin controls only the message, variant, and stickiness.

```js
this.showToast("Saved.", { variant: "success" });
this.showToast(`Could not reach the service: ${error.message}`, { variant: "failure", autohide: false });
this.showToast("Canceled — nothing was submitted.", { variant: "alert" });
```

Convention: sticky (`autohide: false`) failure toasts so the user can read the reason;
autohiding success toasts; `alert` for neutral information.

### `this.clearToasts()`

```ts
clearToasts(): void
```

Clears all toasts. Used to replace a progress toast with its outcome.

```js
this.showToast("Creating record…", { variant: "alert", autohide: false });
// …work…
this.clearToasts();
this.showToast("Record created.", { variant: "success" });
```

### `this.setIndicator(indicator?)`

```ts
setIndicator(indicator?: 'none' | 'block' | 'button' | 'spinner'): void
```

Drives the host's loading chrome for this surface: `block` blocks app interaction, `button`
shows a busy button, `spinner` shows an inline spinner, `none` clears it. The engine resets the
indicator to `'none'` when the script completes, so you rarely need to clear it yourself.

### `this.copyToClipboard(text)`

```ts
copyToClipboard(text: string): void
```

Writes to the system clipboard host-side. Fire-and-forget; a clipboard failure is reported
through `onError` by the host, not returned to you. Pair it with a toast so the user sees
something happened.

### `this.wait(ms)`

```ts
wait(ms: number): Promise<void>
```

A promise-based `setTimeout`. Always `await` it. Useful for backoff between retries and for
pacing UI demos.

### `this.console`

```ts
this.console: { log; warn; error; info; debug }   // (...args: unknown[]) => void
```

A bridge to the host page console — the plain `console` identifier inside a script body already
refers to it. Arguments are serialized across the worker boundary with special handling for
`undefined`, bigint, symbol, function, `Error`, `Date`, `RegExp`, and circular references, and
the bridge never throws into plugin code.

Use it liberally on write failures: logging the full payload plus the error is what makes a
live 400 self-diagnosing.

### `this.onError(error?)`

```ts
onError(error?: unknown): void
```

Reports an error to the host **without stopping the script**. Only `error.message` crosses the
worker boundary — structured error data is lost.

Reports raised this way (and by any uncaught throw) are treated as **platform** faults and
triaged by Kizen platform engineering, and they produce no useful user-facing surface. Reserve
them for failures you have identified as genuine platform problems; route expected failures to
[`showToast`](#thisshowtoastmessage-options). Doctrine and examples:
[errors and observability](15-errors-and-observability.md).

### `this.releaseBlockingScript()`

```ts
releaseBlockingScript(): void
```

Releases the app render that a `blocking: true` route script is holding, **before** the script
finishes — for the case where an essential check is done but non-essential work continues. Only
route scripts have a host handler for it; elsewhere it is a no-op.

Blocking route scripts release automatically when the script settles, on success *and* on a
thrown error, so this is never needed as a hang guard.

### `this.refreshEntityForId(id?)`

```ts
refreshEntityForId(id?: string): Promise<true> | undefined
```

Invalidates the host's cached record data for `id` and waits for the refetch to settle. Called
without an `id`, it returns `undefined` synchronously and does nothing.

It resolves `true` once the cache is idle. **After the 30-second timeout it rejects — it does not
resolve `false`.** The rejection carries no reason at all: the value you catch is `undefined`, not
an `Error`, so `err.message` throws and `String(err)` reads `"undefined"`. Write the guard for a
valueless rejection:

```js
try {
  await this.refreshEntityForId(this.entityId);
} catch {
  // Timed out after 30s. There is no error object to inspect.
  this.showToast("The record may be showing stale values — reload the page.", {
    variant: "alert",
  });
}
```

An unhandled rejection here is not cosmetic: it surfaces as an unexplained `undefined` rejection
with no stack pointing at your script. Requires the host to implement cache invalidation; without
it the call is a no-op.

### `this.refreshTimelineForId(id?)`

```ts
refreshTimelineForId(id?: string): void
```

Invalidates the record timeline cache for `id`. Fire-and-forget.

### `this.installThirdPartyScript(scriptUrl)`

```ts
installThirdPartyScript(scriptUrl: string): Promise<{ call: (...params: unknown[]) => void } | undefined>
```

Installs an allowlisted third-party widget script into the host page and resolves a handle
whose `.call(...)` invokes the widget's global entry point host-side. **Only Freshworks and
Intercom widget URLs are allowed**; anything else reports
`Third party script … could not be installed.` and resolves `undefined`. Scripts are installed
once per URL and reused. Not available in calendar-source scripts.

Two failure modes the return value does not tell you about:

- **A resolved handle does not mean the widget is ready.** After the script tag loads, the host
  polls for the widget's global for a bounded number of attempts. If the global never appears the
  host still reports success (with an internal `matched: false`) and you still get a live handle —
  so `.call(...)` can no-op against a widget that never initialized. If the widget exposes its own
  readiness signal, wait on that rather than trusting the resolve.
- **The call can hang forever.** The promise settles only when the injected script tag fires
  `onload` or `onerror`. A URL that produces neither (some blocked or stalled network conditions)
  leaves the promise pending with no timeout. Do not `await` it on a path that must complete —
  race it against your own timeout if the surface has to stay responsive.

### `this.parseDate(date)`

```ts
parseDate(date: string): string[]
```

Splits a `YYYY-MM-DD` string on `-` and returns the parts as strings. No validation — it is a
naive split, not a parser.

### `this.parsePhone(phone)`

```ts
parsePhone(phone: string): string
```

Strips a leading `+`. Nothing else. Kizen serializes phone extensions with an `x`
(`+15555550123x123`), so split on the first `x` before doing anything numeric with the value.

### `this.createDateObject(dateString)`

```ts
createDateObject(dateString: string): Date
```

Strictly parses `YYYY-MM-DD` into a **local-midnight** `Date` and throws on any other format.
Use it for all-day dates so they do not shift a day under UTC parsing; use `new Date(value)`
for timestamps that carry a time and offset.

### `this.formatDateForResponse(date)`

```ts
formatDateForResponse(date: Date): number
```

Converts a `Date` to **epoch milliseconds** — the format calendar `events` scripts must return
for `start_time` and `end_time`.

---

## 12. Record-detail context

Available in actions, route scripts, data adornments, and object settings items.

### `this.objectId` / `this.entityId`

```ts
this.objectId: string    // the custom object the surface is bound to
this.entityId: string    // the record currently in context ('' when there is none)
```

On an object settings item, `entityId` is empty. In a relationship-add override, `objectId` is
the **related** object's id, not the host record's object.

### `this.actionObjectId` / `this.actionEntityId`

```ts
this.actionObjectId: string
this.actionEntityId: string
```

The action *target* when the run was triggered from a related row or an Agentic Workflow action.
Empty for a plain record action.

### `this.currentObject()`

```ts
currentObject(): Promise<Record<string, unknown> | undefined>
```

Fetches the detail payload for `this.objectId`. Reliably present fields: `id`, `object_type`
(`'standard' | 'pipeline'`), `entity_name`, `object_name`, `name`, `is_custom`, `description`,
`fetch_url`, `related_objects[]`, `field_categories[]`, `fields[]` (each with `id`, `name`,
`display_name`, `field_type`, `order`). `owner`, `access`, and `record_layouts` can be null —
guard those specifically.

### `this.currentEntity()`

```ts
currentEntity(): Promise<Record<string, unknown> | undefined>
```

Resolves the record identified by `this.objectId` / `this.entityId`, using the right endpoint
family for the object type. Returns `undefined` when there is no record in context (object
settings items).

### `this.actionEntity()`

```ts
actionEntity(): Promise<Record<string, unknown> | undefined>
```

Same, for `this.actionObjectId` / `this.actionEntityId`.

### `this.getEntity(objectId, entityId)`

```ts
getEntity(objectId: string, entityId: string): Promise<Record<string, unknown> | undefined>
```

Fetches any record, routing automatically to the client, pipeline, or custom-object endpoint
based on the object.

### `this.getObjectDetail(id)`

```ts
getObjectDetail(id: string): Promise<Record<string, unknown> | undefined>
```

Fetches an arbitrary object's detail payload — `currentObject()` for an object other than the
one in context.

### `this.getFieldValue(entity, fieldId)`

```ts
getFieldValue(entity: Record<string, unknown>, fieldId: string): unknown
```

Reads `entity.fields[fieldId].value`. Convenience only — record read-back envelopes are
inconsistent (raw scalar, `{value}`, or one level deeper), so unwrap defensively when the
shape matters.

### `this.getRelatedEntitiesForField(objectId, entityId, fieldId)`

```ts
getRelatedEntitiesForField(objectId: string, entityId: string, fieldId: string): Promise<Record<string, unknown>[]>
```

Fetches every record linked through a relationship field.

```js
const related = await this.getRelatedEntitiesForField(this.objectId, this.entityId, fieldId);
this.showToast(`${related.length} linked records.`, { variant: "alert" });
```

### `this.refreshEntity()`

```ts
refreshEntity(): void
```

Calls `refreshEntityForId(this.entityId)` and **discards the returned promise**. Call it after
writing to the record in context so the page repaints with the new values.

Two consequences follow from that discard. You cannot await it — `await this.refreshEntity()`
resolves immediately and tells you nothing about whether the refetch finished. And because
`refreshEntityForId` rejects on its 30-second timeout, the dropped promise becomes an
**unhandled rejection** whenever the refresh times out: an `undefined` rejection with no stack,
attributed to nothing in particular.

When you need to know the refresh landed — or simply want to keep the console clean — call
`refreshEntityForId(this.entityId)` yourself and handle it:

```js
try {
  await this.refreshEntityForId(this.entityId);
} catch {
  // Refresh timed out; the page may still show stale values.
}
```

### `this.refreshTimeline()`

```ts
refreshTimeline(): void
```

`refreshTimelineForId(this.entityId)`.

---

## 13. Floating-frame context

Available only in floating-frame scripts, their message handler, and their event scripts.

### `this.show(config?)`

```ts
show(config?: { showTrigger?: boolean }): void
```

Shows the frame. **The engine calls `show()` automatically once the frame's script starts**, so
a frame reveals itself — never call it for the initial paint. `showTrigger` also shows the
minimized trigger element.

### `this.hide(config?)`

```ts
hide(config?: { hideTrigger?: boolean }): void
```

Hides the frame; `hideTrigger: true` also hides the minimized trigger, removing the plugin from
the screen entirely.

### `this.expand()` / `this.collapse()`

```ts
expand(): void
collapse(): void
```

Toggle the minimized state. Calling `collapse()` at the top of a frame script is how a frame
boots minimized.

### `this.hideHeader()` / `this.showHeader()`

```ts
hideHeader(): void
showHeader(): void
```

Show or hide the frame's title bar. **These take effect only on fixed-position frames**
(`default_position` ending in `-fixed`); non-fixed frames are dragged by their header, so the
calls are silent no-ops there.

```js
this.collapse();
this.hideHeader();
this.outputIframe("https://example.com/widget");
```

---

## 14. Calendar-source context

Calendar `calendars` and `events` scripts run in a restricted context. These methods exist but
**throw "not supported in calendar source scripts"** when called:

`uploadFile`, `installThirdPartyScript`, `refreshEntityForId`, `openCreateRecordModal`,
`openCreateRelatedRecordModal`, `showViewInModal`, `closeModal`.

They throw at **call time**, not parse time — a calendar script that touches one of them
compiles fine and fails mid-run. `prompt` and `dynamicPrompt` remain wired, but a calendar
source runs inside a data query, so blocking it on a modal is a bad idea in practice.

Everything else — HTTP helpers, `getServiceUrl`, `console`, `formatDateForResponse`,
`createDateObject`, `sessionData` — works normally. See
[routes, calendars, adornments, settings](12-routes-calendars-adornments-settings.md) for the
return schemas.

---

## Gotchas

- **Nothing survives on `this`.** Every run is a new worker and a new context. Cross-script
  state goes through `sessionData`, user/business config, hidden form inputs, or the backend.
- **No imports, no shared helpers.** Duplicating a small helper into every script that needs it
  is the intended pattern, not a smell.
- **`this.put` does not exist** even though the transport supports PUT. Use `patch`.
- **`patch` omits the `X-Request-Type` header** that the other Kizen-bound verbs add.
- **Plain `get/post/patch/delete` resolve `undefined` on failure** *and* report the failure to
  platform monitoring. Use the `*WithErrors` variants.
- **`deleteWithErrors` resolves `[null, null]` on 204** — a null data half is not an error.
- **Relative GETs are cached for the life of the worker with no expiry.** Pass
  `{ignoreCache: true}` for any read-after-write, and remember `preserve = true` extends the
  cache's life indefinitely.
- **`this.config` and `this.userConfig` are run-start snapshots.** A value you just wrote will
  not appear until the next run; re-read it over HTTP.
- **A view opened with `config.args` loses `this.config`** — the args replace the injected
  business config. Forward `config: this.config` through args if the view needs it.
- **`showViewInModal` args must nest under `config.args`**; args placed beside `options` are
  silently dropped.
- **`dynamicPrompt` values are plain scalars; `showViewInModal` form values are array-wrapped.**
  Opposite conventions, and both bite.
- **`dynamicPrompt` field callbacks are serialized** — they cannot close over your script's
  variables. Pass helpers through `registerUtils`.
- **Modal calls resolve `{canceled: true}` when no modal handler is wired**, which is
  indistinguishable from a real user cancel.
- **`this.outputView` is not supported end-to-end** — it silently does nothing.
- **`this.location` throws on any property outside its snapshot list.**
- **`this.currentUser` nests everything under `.profile`**, and empty values are `""`, not null.
- **`setSessionData` merges top-level keys only**, and hand-spreading nested maps races across
  overlapping workers. One top-level key per independent fact.
- **`setUserConfig` is read-modify-write with no locking** — concurrent writers can lose data.
- **`openWindow` drops `context` for absolute or cross-origin URLs**, silently: navigation
  works, the payload does not arrive.
- **`runEventScript` / `communicate.*` are fire-and-forget** — no result, no failure signal.
- **`postFormData` rejects with no reason** on failure.
- **`installThirdPartyScript` never rejects** — it resolves `undefined` and reports the failure
  through a fixed `onError`, so failure reads as success. Check the returned handle before using it.
- **Calendar-source capability holes throw at call time**, not at parse time.
- **There is no execution timeout.** A script that never settles keeps its worker alive until a
  same-identity rerun kills it.
