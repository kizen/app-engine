# Navigation & Cross-Surface Communication

**What this covers:** moving the user (`this.openWindow`, in-app SPA navigation, the navigation-context mechanism and its relative-URL rule) and moving data between plugin surfaces (`runEventScript`, `communicate.runBlockScript` / `runFrameScript` / `sendMessageToOwnFrame`, `sessionData`, route-change fan-out to iframes).

**See also:** [worker runtime API](04-worker-runtime-api.md) for base `this.*` semantics and worker lifecycle · [views & modals](10-views-modals-forms.md) · [outputUI, iframes & the frame proxy](11-output-ui-iframes-frames.md) for the iframe message envelope · [route scripts](12-routes-calendars-adornments-settings.md) for reacting to navigation · [errors & observability](15-errors-and-observability.md).

---

## Navigation

### `this.openWindow(url, target?, context?)`

The **only** navigation method — there is no `this.navigate` or `this.redirect`. It covers same-tab SPA navigation, new tabs, external links, and protocol URLs, with an optional context payload.

```ts
openWindow(
  url: string,
  target: string = '_blank',        // note the default — in-app navigation requires an explicit non-_blank target
  context?: unknown                 // optional JSON payload delivered via the navigation-context mechanism
): void
```

Behavior is decided by three branches. "Relative" means literally `url.startsWith('/')`:

| # | Condition | What happens | Context payload |
|---|---|---|---|
| 1 | Relative URL **and** `target !== '_blank'` (e.g. `'_self'`) | In-app SPA navigation through the host router — no page reload, React state (and therefore `sessionData`) survives. | Stored in `sessionStorage` under a minted key and `?session_data_key=<key>` appended to the URL. |
| 2 | Relative URL **and** `target === '_blank'` **and** a context was passed (same-origin) | `window.open` **without** `noopener`/`noreferrer`, so the browser clones `sessionStorage` into the new tab; the opener's copy of the context entry is then removed. | Travels via the cloned `sessionStorage` copy (see the race caveat below). |
| 3 | Everything else — absolute URLs, cross-origin, protocol URLs, or `_blank` without context | Plain `window.open(url, target, 'noopener noreferrer')`. | **Silently dropped.** Navigation works; the payload never arrives. No error, no warning. |

Practical forms:

```js
// In-app navigation (SPA route push — the common case):
this.openWindow(`/client/${created.id}/details`, "_self");

// New tab to an external site:
this.openWindow("https://example.com/docs", "_blank");

// Protocol URLs work too (e.g. from a phone-number adornment):
this.openWindow(`tel:+13125550100;ext=12`);
```

Related mechanisms owned by other docs: `this.postFormData(url, data, createNewTab?)` performs a real hidden-form POST navigation ([04](04-worker-runtime-api.md)); `this.authorize(serviceName)` opens the OAuth flow in a new tab ([06](06-auth-secrets-services.md)).

### Navigation context (since engine 1.8.0)

The third `openWindow` argument carries an arbitrary JSON payload to the destination — e.g. a pre-built filter for a records list, or "where did this navigation come from" metadata.

**Mechanism.** The engine serializes the payload with `JSON.stringify`, stores it in the host's `sessionStorage` under a minted key `kizen-app-context-<uuid>`, and appends `?session_data_key=<key>` to the navigation URL (which is normalized to `pathname + search + hash` — relative by construction). The destination looks up the key and reads the payload back out of `sessionStorage`.

```js
this.openWindow("/custom-objects/leads/records", "_self", {
  unsavedFilter: {
    operator: "and",
    conditions: [{ field: "stage", comparator: "equals", value: "new" }],
  },
  source: "example_plugin/lead_triage",
  openedAt: new Date().toISOString(),
});
```

#### The relative-URL requirement

Context rides **only on relative URLs** (`url.startsWith('/')`). An absolute URL — even one pointing at the same Kizen origin spelled out in full — falls through to plain `window.open` and the context is **silently dropped**. Cross-origin destinations can never receive context. If a context payload "isn't arriving", check the URL shape first.

#### `_blank` and the sessionStorage-clone race

For branch 2 (relative + `_blank` + context), delivery relies on the browser behavior that a same-origin tab opened *without* `noopener` receives a **copy of the opener's `sessionStorage`** at open time. The engine deletes the opener's copy of the entry synchronously after `window.open` returns. This is inherently best-effort:

- It only works in real browsers that perform the storage clone for same-origin opens.
- Because the opener's copy is deleted immediately, there is no retry — if the clone didn't happen (popup blocked and re-opened by the user, non-standard embedder, etc.), the context is gone.
- Same-tab navigation (branch 1) has no such race — prefer `'_self'` when you control the UX.

#### Serialization rules

The payload goes through `JSON.stringify` **in the worker, before any navigation happens**:

- Circular references and `BigInt` values **throw in your script** — no navigation occurs.
- Functions, `undefined`, and symbols are **silently dropped** per normal JSON semantics.

#### Reading context at the destination

- **Host-rendered destinations** (Kizen's own app pages — records lists, record details, etc.) read the context on the host side. Hosts built with `@kizenapps/engine` use the `useAppNavigationContext(url)` React hook or the exported `readNavigationContext` / `consumeNavigationContext` / `clearNavigationContext` functions. Whether a given host page honors a particular payload shape (e.g. an `unsavedFilter`) is up to that page.
- Keys are validated: only `session_data_key` values with the `kizen-app-context-` prefix are ever read, so a crafted URL cannot exfiltrate arbitrary `sessionStorage` entries.
- `?session_data_key=` **lingers in the address bar** after the context is applied — consuming clears the storage entry, not the URL. Don't treat its presence as "context still pending".
- **Plugin pages cannot read the payload.** A [plugin page](10-views-modals-forms.md#routable-pages--pluginsplugin_api_namepage_api_name) does receive `session_data_key` as a query param in `this.args` (query params merge into page args), but worker scripts have no `sessionStorage` access and no `this.*` reader exists for navigation context. To carry data to your own plugin page, use one of:
  - plain query params on the page URL — they arrive parsed in `this.args`: `this.openWindow("/plugins/example_plugin/report?invoice=" + id, "_self")`;
  - `this.setSessionData(...)` before a **same-tab** navigation — sessionData is plugin-scoped host React state and survives SPA navigation (not a new tab, not a reload).

### Worked example — navigation with context

A record action that jumps to a pre-filtered list, with a fallback for the payload-less case:

```js
// Action script: "Show open orders for this account".
const entity = await this.currentEntity();
const accountName = this.getFieldValue(entity, this.config.accountField?.fieldId);

// Same-tab, relative URL → SPA push + context delivery (branch 1, no race).
this.openWindow("/custom-objects/orders/records", "_self", {
  unsavedFilter: {
    operator: "and",
    conditions: [
      { field: "account", comparator: "equals", value: accountName },
      { field: "status", comparator: "equals", value: "open" },
    ],
  },
  source: "example_plugin/show_open_orders",
});
```

New-tab variant (accepts the clone race):

```js
this.openWindow("/custom-objects/orders/records", "_blank", { …same payload… });
```

What must be true for the payload to arrive: the URL starts with `/`; the payload is JSON-serializable; and (for `_blank`) the browser cloned `sessionStorage` into the new tab. If any condition fails, the user still lands on the page — just without the context.

---

## Cross-surface communication

### What persists between scripts

Every script execution — main scripts, event scripts, `runEventScript` targets, `runBlockScript` targets — runs in a **brand-new worker** with a fresh context. Nothing on `this`, and no module/closure scope, survives between the main script and its event scripts, between two event-script runs, or across dispatch calls. There are also **no shared helper modules** — each script file is compiled in isolation; duplicating small helpers (`esc()`, error describers) across event scripts is the correct pattern.

What *does* persist, and where:

| State | Scope | Survives |
|---|---|---|
| The painted DOM from the last `outputUI` | per surface instance | repaints swap in place; survives between that surface's script runs |
| `this.sessionData` | per **plugin** (all surfaces share it), per browser session | script runs and SPA navigation; **not** tab reload or new tabs |
| `this.userConfig` / `getUserConfig()`/`setUserConfig()` | per user, per plugin component | persisted server-side |
| Business plugin config (`this.config`, business-plugin-apps endpoint) | per business | persisted server-side |
| Hidden form inputs in painted markup | per painted view | until the next repaint (the [wizard pattern](10-views-modals-forms.md#worked-example--frameless-multi-step-wizard-the-repaint-pattern)) |

Worker identity hashes on plugin + artifact + `worker_key` + script body + args — changing args or script creates a new identity and terminates the previous worker. Full lifecycle: [04 — worker runtime API](04-worker-runtime-api.md).

### `this.runEventScript(scriptName, args?)`

```ts
runEventScript(scriptName: string, args?: Record<string, unknown>): void   // fire-and-forget
```

Runs a named entry from the **same surface's** `event_scripts` (i.e. `eventScripts/<scriptName>.js`) in a fresh worker. `args` are merged over the surface's own args to form the target's `this.args`. Fire-and-forget — no return value, no completion signal.

Callable from main scripts as well as event scripts, which enables the **single-painter** convention (below). It is also the retry primitive inside modal wizards (`this.runEventScript("step2", { formData })` repaints in place).

### `this.communicate.runBlockScript(blockAPIName, scriptId, args?)`

```ts
communicate.runBlockScript(
  blockAPIName: string,               // target block's api_name (same plugin)
  scriptId: string,                   // name of an entry in the target block's event_scripts
  args?: Record<string, string | number>   // see the type note below — objects round-trip fine
): void                               // fire-and-forget
```

Cross-surface dispatch into a **block**: posts a same-page window event; **every mounted instance** of the target block on the current page runs `event_scripts[scriptId]` in a fresh worker with `args` merged into `this.args`. Available since engine 1.7.

- **Same page, same plugin only.** The host stamps the recipient with your plugin's identity — there is no cross-plugin dispatch. If the target block isn't mounted on the current page, the call is a harmless silent no-op.
- **Type note:** `args` is *typed* as `Record<string, string | number>`, but the payload is JSON-serialized and merged into the target's args untouched — **arbitrary JSON objects and arrays round-trip fine** despite the type. Shape-check on receipt anyway, as with any message boundary.
- Only the *hit* block repaints (if its event script paints); other surfaces are untouched.

### `this.communicate.runFrameScript(frameAPIName, scriptId, args?)`

```ts
communicate.runFrameScript(
  frameAPIName: string,               // target floating frame's api_name (same plugin)
  scriptId: string,                   // entry in the frame's event_scripts
  args?: Record<string, string | number>   // same JSON round-trip note as runBlockScript
): void                               // fire-and-forget
```

Dispatch into a **floating frame** from any worker surface — this is how data adornments, actions, and object-settings items drive a frame (e.g. a phone adornment telling a dialer frame to dial). The target frame runs `event_scripts[scriptId]` with `{...frame args, ...args}`; when the current route is a record detail page, the host also injects the matched `objectId`/`entityId` into the args. Same-page/same-plugin/no-op-if-hidden semantics match `runBlockScript`.

```js
// Data adornment (field_type: "phonenumber") — three lines to drive a frame:
this.communicate.runFrameScript("dialer", "dialNumber", { phoneNumber: this.args.value });
```

### `this.communicate.sendMessageToOwnFrame(payload, targetOrigin)`

```ts
communicate.sendMessageToOwnFrame(payload: unknown, targetOrigin: string): void
```

Posts a message **down into the plugin's own iframe** (the one rendered by `outputIframe` / an iframe surface), addressed by the plugin's frame id. Parent→child payloads are forwarded **verbatim** through the frame proxy (no envelope), so the framed page receives exactly what you posted via a normal `message` event listener.

The **upward** direction (framed page → plugin script) is the frame's `message.js` handler / floating-frame `message_handler`, where the unwrapped payload arrives as `this.args.eventData`. The proxy wraps upward messages in an envelope — full contract in [11 — iframe messaging & the frame proxy](11-output-ui-iframes-frames.md).

```js
// floatingFrames/widget/message.js — the framed page posted something up:
const eventData = this.args.eventData;            // exactly what the page posted
if (eventData?.type === "widget-ready") {
  this.communicate.sendMessageToOwnFrame({ type: "init", user: this.currentUser.profile.email }, "*");
}
```

### `this.sessionData` / `this.setSessionData(update)` — communication semantics

Method reference lives in [04](04-worker-runtime-api.md); the rules that matter when using it as the shared-state channel between surfaces:

- **Plugin-scoped**: every surface of the plugin on the page reads the same bucket. Memory-only host React state — survives SPA navigation, not reload or new tabs.
- `setSessionData` **shallow-merges top-level keys only**: writing `{myMap: {k: true}}` REPLACES the whole `myMap`. It throws on non-object/array input.
- **A script does see its own writes.** `setSessionData` merges the update into the worker's own snapshot *synchronously*, before posting it to the host, so re-reading `this.sessionData` later in the same run returns what you just wrote. What it does **not** see is a write made by a *different* worker after this one started — that snapshot is fixed at construction time.
- Hand-spreading nested maps is **racy across overlapping workers** (each spreads its own stale snapshot; last host write wins wholesale). Correct pattern: **one top-level key per independent fact** — the engine's top-level merge then composes concurrent writes race-free.

### Pattern — ping/pong across blocks

Two blocks volleying via `runBlockScript`, with rally state in `sessionData`. Block `status_ping` (`src/blocks/statusPing/`):

```js
// script.js — mount paints from sessionData (fresh worker; only sessionData persists)
const rally = Number(this.sessionData?.pingRally ?? 0);
this.outputUI(`
  <div class="pp-card">
    <span>PING — rally ${rally}</span>
    <button data-script="serve">Serve &rarr;</button>
  </div>
`);
```

```js
// eventScripts/serve.js — hit the other block's `receive` event script
this.communicate.runBlockScript("status_pong", "receive", { from: "ping" });
```

```js
// eventScripts/receive.js — invoked by the other block; payload arrives on this.args
const from = String(this.args.from ?? "unknown");
const rally = Number(this.sessionData?.pingRally ?? 0) + 1;
this.setSessionData({ pingRally: rally });     // top-level key; merges, race-free
this.outputUI(`
  <div class="pp-card pp-card--hit">
    <span>PING — rally ${rally} (hit by ${from})</span>
    <button data-script="serve">Serve &rarr;</button>
  </div>
`);
```

`status_pong` mirrors it with the block names swapped. Both blocks must be mounted on the same page; only the block that is hit repaints.

**Broadcast design rule:** when blocks sync via broadcast plus a persisted snapshot, never gate the *live* broadcast on completeness or validity — broadcast exactly what the sender renders, and gate only the *persistence*. Gating the broadcast leaves receivers stale whenever the sender's state is "incomplete".

### Pattern — single-painter orchestration

Keep each surface's markup in exactly **one** event script (conventionally `render`):

- The mount script paints a loading shell and delegates: `this.runEventScript("render")`.
- Every state-changing event script updates `sessionData` (or the backend) and then re-enters `render` — it never paints its own variant of the markup.
- Cross-surface, an orchestrating "hub" block drives sibling surfaces with `runBlockScript(target, "render", args)` / `runFrameScript(...)`, so each surface still has a single painter.

This eliminates markup drift between N repaint sites and makes "repaint after any change" one line.

### Route-change fan-out to plugin iframes

On every host route change, the host broadcasts into **every plugin iframe** on the page (pages, blocks, floating frames, `outputIframe` embeds):

```ts
// received inside the framed page as a normal message event:
{ action: 'kizen-route-change', location: { host, hash, href, origin, pathname, search, port, protocol } }
```

- Delivery is deduped by location (one message per actual change), targeted at each frame's own origin, and passes through the frame proxy verbatim.
- Listen inside your framed page with `window.addEventListener('message', ...)` and filter on `event.data?.action === 'kizen-route-change'`.
- This is the iframe-side counterpart of route scripts: use it when the *embedded page* needs to know where the user navigated (e.g. a dialer showing the current record).

### Route scripts (pointer)

Worker scripts that fire on record-detail route changes — with `{previousRoute, currentRoute}` args, record context, and optional render-blocking (`blocking: true`, `this.releaseBlockingScript()`) — are the other navigation-reaction mechanism. Full contract: [12 — route scripts](12-routes-calendars-adornments-settings.md).

### Iframe message envelope (pointer)

Upward messages from proxied iframes arrive wrapped in a `FrameProxyEnvelope` (`{plugin_api_name, source_url, event, data, ...}`); only `event: 'message'` envelopes reach your `message.js`/`message_handler` scripts, and origin changes inside the frame break the bridge permanently. Full contract, including the permissions/`allow` model: [11 — iframes & the frame proxy](11-output-ui-iframes-frames.md).

---

## Gotchas

- **`openWindow`'s default target is `'_blank'`** — in-app SPA navigation requires an explicit non-`_blank` target: `this.openWindow(url, "_self")`.
- **Context is silently dropped on absolute/cross-origin URLs** — navigation succeeds, the payload just never arrives. Context requires `url.startsWith('/')`.
- **A circular or BigInt context payload throws in your script before any navigation happens.** Functions/`undefined`/symbols inside the payload are silently dropped.
- **`_blank` context delivery is a best-effort sessionStorage clone** — the opener's copy is deleted immediately after `window.open` returns; prefer `'_self'` when possible.
- **`?session_data_key=` stays in the address bar** after the context is consumed — clearing removes the storage entry, not the URL param.
- **Plugin page scripts can't read navigation context** (workers have no `sessionStorage`); carry data to your own pages via query params (they land in `this.args`) or same-tab `sessionData`.
- **All dispatch is fire-and-forget** — `runEventScript`, `runBlockScript`, `runFrameScript` return nothing and give no completion signal; results must flow back via another dispatch, `sessionData`, or the backend.
- **`runBlockScript` runs the target script in *every* mounted instance** of that block on the page — design event scripts to be idempotent per instance.
- **Same page, same plugin only** — there is no cross-plugin dispatch, and an unmounted target is a silent no-op (nothing queues).
- **`communicate.*` args are typed as scalar maps but JSON round-trips arbitrary objects** — objects/arrays work; shape-check on receipt.
- **`sessionData` writes ARE visible to the writing run** (the local snapshot updates synchronously) but writes from *other* workers are not — the snapshot is fixed at construction. Merge is **top-level-only** — one top-level key per independent fact; never hand-spread nested maps across overlapping workers.
- **No shared helper modules exist between scripts** — duplicate small helpers per event script; coordinate through messages and args, not imports.
- **Never gate live broadcasts on completeness** — broadcast what the sender renders; gate only persistence.
