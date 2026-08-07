# Output UI, Iframes, and Frame Surfaces

**What this covers:** How plugin scripts put pixels on screen: `outputUI` (sanitized HTML into a host-provided region) and its `data-script` interactivity contract, `outputIframe` and the frame proxy (`plugin-assets.kizen.com` / `plugin-assets.kizen.dev`) with its postMessage bridge, the unsupported `outputView`, floating frames, and toolbar items.

**See also:** [worker runtime API](04-worker-runtime-api.md) for the rest of the `this.*` surface (network helpers, `preserve`, `setIndicator`, `runEventScript`) · [blocks](09-blocks.md) for the dashlet container these contracts render into · [views, modals & forms](10-views-modals-forms.md) for `showViewInModal` and `dynamicPrompt` · [navigation & communication](14-navigation-and-communication.md) for `openWindow`, `sendMessageToOwnFrame`, `runFrameScript`/`runBlockScript`, and `sessionData`.

---

## `this.outputUI(markup, options?)`

```ts
outputUI(markup: string, options?: { useDevMode?: boolean }): void
```

Renders an HTML string into the surface's output region. The host sanitizes the markup (below) and assigns it via `innerHTML` — each call **replaces** all prior output in the region. It is a plain HTML string: no templating, no React, no `<script>`.

| param | type | meaning |
|---|---|---|
| `markup` | string | Raw HTML. Build it with template literals; escape every interpolated value (see [`esc()` discipline](#esc-discipline)). |
| `options.useDevMode` | boolean | Route any `<iframe>`s inside the markup through the dev frame proxy (`plugin-assets.kizen.dev`) instead of production. |

There is a second option, `__dangerouslySkipProxy`, which embeds iframe URLs directly instead of through the frame proxy. It bypasses the origin isolation, permission scoping, and message attribution the proxy provides; proxied embedding is the only supported pattern — don't use it.

Available on every worker surface except calendar sources. Where the output lands:

- **Script-type surfaces** (pages, blocks, floating frames, script toolbar items while a page is showing): the surface's dedicated output `<div>`.
- **HTML-type pages/views**: the static HTML is rendered first; `outputUI` writes into an adjacent output div next to it.
- **Views in modals**: the modal body (see [10](10-views-modals-forms.md)).

### Sanitization

Markup passes through DOMPurify before it reaches the DOM:

- **Default DOMPurify config**, plus `ADD_TAGS: ['iframe']` and `ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'sandbox', 'name', 'loading', 'width', 'height', 'title']`.
- What survives: the default DOMPurify allowlist — semantic HTML, inline `style` attributes, inline SVG, images including `data:` URIs — plus iframes.
- What is stripped: `<script>` tags, inline event handlers (`onclick=`, `onload=`, …), and `javascript:` URLs. Interactivity therefore comes **exclusively** from [`data-script`](#data-script-event-dispatch) attributes or an embedded iframe messaging back through the [frame proxy bridge](#the-frame-proxy).
- Every `<iframe src>` in the markup is rewritten through the frame proxy: the original `allow` attribute travels to the proxy as its `&allow=` parameter, the iframe's `name` is force-set to your `plugin_api_name`, and the element itself receives the full device-permission ceiling so the proxy can re-delegate downward (see [Permissions-Policy model](#permissions-policy-model)).

Two sanitizer behaviors bite silently:

#### The `name`/`id` attribute-clobbering gotcha

DOMPurify's DOM-clobbering protection (`SANITIZE_DOM`, on by default) strips any `name` or `id` attribute whose **value** collides with a property of `document` or of a `<form>` element. `<input name="name">` silently loses its `name` attribute — it never reaches `FormData`, so `this.args.formData.name` is `undefined`, with no error anywhere. Other clobbering values include `action`, `submit`, `title`, `method`, `target`, `elements`, `style`, `id`, `length`, `location`.

**Rule: never use a bare DOM-property word as a form field name; prefix or hyphenate.** No DOM property contains a hyphen, so `your-name`, `contact-email`, `np-title` are always safe.

#### The `value`-attribute strip gotcha

Separately, DOMPurify drops the entire `value` **attribute** when its decoded value contains a complete tag (e.g. `<script>alert(1)</script>`) — *even when correctly escaped*. Ordinary punctuation round-trips fine (`O'Brien`, `Jane <jane@example.com>`, `a < b`), so the blast radius is small — but hidden inputs carrying serialized wizard state can silently blank. Don't round-trip tag-tolerant free text through `value` attributes; carry that state in `sessionData` instead.

---

## `data-script` event dispatch

Adding `data-script="<name>"` to an element in `outputUI` markup (or a surface's static HTML) binds it to the event script `eventScripts/<name>.js` of the same surface. Two events are dispatched; both are ignored while another script of the surface is still pending.

### Click

A click runs the named event script with the surface's standard args (business config, `pluginId`, …) — **no event payload**. Dispatch reads the **exact hit-tested element**; there is no `closest()`/ancestor traversal. Consequences:

- A `<span>`, `<svg>`, or any child element inside a `data-script` button **swallows the click** — nothing runs. Convention: `data-script` buttons contain **text only**.
- Do **not** work around this with `[data-script] > * { pointer-events: none; }` applied broadly — inside a `data-script` *form* it makes every input and submit button unclickable (silent no-ops). If you must neutralize children, scope it to specific non-form buttons.
- Clicking a `data-script` **form's padding** fires the click path — the handler runs with **no `formData`**. Keep `data-script` forms visually tight and guard handlers: `if (!this.args.formData) return;`.

### Form submit

`<form data-script="name">` intercepts submission: the host always calls `preventDefault()`, collects the form, and runs the event script with `this.args.formData` added:

- **Every value is array-wrapped** (`FormData.getAll` semantics), including single inputs: `{ "your-name": ["Jane"] }`. An empty-but-present text input is `[""]` — truthy! Check `formData.key?.[0]?.trim()`. An unchecked checkbox group is **absent** entirely. Prefer joining multi-value fields over indexing `[0]`.
- The **submitter is not captured** — the clicked submit button's own `name`/`value` never appears in `formData`. You cannot encode "which button" on submit buttons; use separate forms (or separate `data-script` names) per action.
- Native constraint validation runs first when the dispatch comes from a real `type="submit"` button (`required`, `type="email"`, `pattern`, …). Style validation errors with `:user-invalid` (not `:invalid`) so fields don't flash red before the user touches them.
- Multiple forms in one region merge into one flat map on collection paths that gather all forms (modal confirm); the last form wins on key collisions — keep field names unique per view.

### Per-element payloads

The click path carries no per-element data, so **payloads ride in forms**: render a small `<form data-script="handler">` per item with hidden inputs. For complex payloads use `encodeURIComponent(JSON.stringify(obj))` — not `btoa`, which throws on non-Latin-1 characters — and decode in the handler. Values still arrive array-wrapped.

<a id="esc-discipline"></a>
### `esc()` discipline

Everything interpolated into `outputUI` markup — API responses, config values, user input echoed back — must be escaped or it becomes markup (at best mangled by the sanitizer, at worst clobbering attributes). Event scripts are isolated (no shared modules), so the helper is duplicated per script by design:

```js
const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
```

### Complete example: a working `data-script` form

A page/block script painting a note form, and the event script that handles it.

```js
// script.js — paint the form. Field names are hyphenated (never bare DOM-property
// words like "name" or "title" — the sanitizer strips those).
this.outputUI(`
  <form class="note-form" data-script="saveNote">
    <label class="note-label" for="note-author">Author</label>
    <input id="note-author" name="note-author" required placeholder="Your name" />

    <label class="note-label" for="note-body">Note</label>
    <textarea id="note-body" name="note-body" required rows="3"></textarea>

    <label class="note-check">
      <input type="checkbox" name="note-pin" value="yes" /> Pin this note
    </label>

    <button type="submit" class="note-submit">Save note</button>
  </form>
`);
```

```js
// eventScripts/saveNote.js
const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

// Guard: a click on the form's padding dispatches with no formData.
const formData = this.args.formData;
if (!formData) return;

// Values are array-wrapped; an empty text input is [""] (truthy) — trim the first entry.
const author = formData["note-author"]?.[0]?.trim();
const body = formData["note-body"]?.[0]?.trim();
const pinned = Boolean(formData["note-pin"]); // unchecked checkbox is absent entirely
if (!author || !body) return; // native `required` already blocked real submits

const [, error] = await this.postWithErrors("/records/example_notes/add", {
  fields: [
    { name: "name", value: `Note from ${author}` },
    { name: "body", value: body },
    { name: "pinned", value: pinned },
  ],
});
if (error) {
  const describeError = (e) =>
    typeof e === "string" ? e : (e?.message ?? JSON.stringify(e));
  this.showToast(`Could not save note: ${describeError(error)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}

this.showToast("Note saved");
this.outputUI(`
  <div class="note-form">
    <p class="note-done">Saved a note from <strong>${esc(author)}</strong>.</p>
    <button type="button" class="note-submit" data-script="reset">Add another</button>
  </div>
`);
```

---

## `this.outputIframe(url, allow?, sandbox?, options?)`

```ts
outputIframe(
  url: string,
  allow?: string[],     // device-feature grants, optionally origin-scoped
  sandbox?: string[],   // sandbox tokens for the plugin-level iframe
  options?: { useDevMode?: boolean },
): void
```

Embeds an external page in an `<iframe>` that **replaces** the surface's entire output region. The URL is rewritten through the [frame proxy](#the-frame-proxy); the host creates the element with `border: none; width: 100%; height: 100%` and `name` set to your `plugin_api_name`.

| param | rules |
|---|---|
| `url` | Must be absolute **with the `https://` scheme** (`https://widget.example.com`, not `widget.example.com`). A bare host fails URL parsing and produces a blank frame; the proxy also rejects non-HTTPS targets with an error overlay. |
| `allow` | Filtered to six device features (prefix match): `microphone`, `speaker-selection`, `autoplay`, `camera`, `display-capture`, `hid`. Each entry is a feature name optionally followed by an origin: `"microphone https://widget.example.com"` grants only that origin; `"microphone *"` grants any origin in the frame. Anything else in the list is dropped. Empty/omitted = no powerful features. |
| `sandbox` | Filtered to three tokens: `allow-popups`, `allow-scripts`, `allow-same-origin`. Empty/omitted = the plugin-level iframe is unsandboxed (the proxy's inner frame is always hard-sandboxed regardless — see below). |
| `options.useDevMode` | Target the dev proxy origin (`plugin-assets.kizen.dev`). |

Grant least privilege, origin-scoped:

```js
this.outputIframe("https://widget.example.com/panel", [
  "microphone https://widget.example.com",
]);
```

The origin in an origin-scoped grant must **exactly match the framed URL's origin** or the browser denies the feature. Note that a bare feature name (`"microphone"`) expands to the default allowlist `'src'`, which inside the proxy covers only the proxy origin — not your actual content. Always write either an explicit origin or `*`.

**Completion and `preserve`:** the script's completion signal (and the surface's loading state) is deferred until the iframe fires its `load` event. The engine forwards the [`preserve`](04-worker-runtime-api.md#14-thispreserve) flag with the iframe request; setting `this.preserve = true` before calling `outputIframe` keeps the worker from being terminated when the script finishes.

What that flag buys you is narrower than it looks. It keeps **this** worker alive — along with its in-memory GET cache and any pending callbacks it owns. It does **not** make the worker's state readable by later event scripts. Nothing on `this` crosses a script boundary: every event script runs in a fresh context, so `this.myCache` set by the main script is invisible to the `onClick` handler that fires afterward ([why](04-worker-runtime-api.md#11-one-fresh-worker-per-script-run)). Reaching for `preserve` to "keep state for later event scripts" produces a worker that lives forever and still cannot share anything.

The two channels that genuinely carry state forward are:

- **`sessionData`** — `this.setSessionData({ key: value })` writes, `this.sessionData` reads. Top-level keys only, scoped to the surface. This is the real answer for "the main script computed something the event script needs."
- **the painted DOM** — markup from the last `outputUI()` persists, so a `data-` attribute on a rendered element is readable by the event script that fires from it.

`preserve` is a resource-lifetime switch, and [17-gotchas.md](17-gotchas.md) is right to call it a debugging tool rather than a production pattern.

On full plugin pages the host additionally waits for the proxy's `loaded`/`error` envelope (native iframe `onload` fires when only the proxy shell has loaded), with a 30-second fallback ceiling on the loading state.

---

## The frame proxy

Every plugin-embedded iframe — `outputIframe`, `<iframe>`s inside `outputUI` markup, and iframe-type pages — is routed through a dedicated proxy origin:

- Production: `https://plugin-assets.kizen.com`
- Development: `https://plugin-assets.kizen.dev`

URL format: `https://plugin-assets.kizen.com?url=<encoded target URL>&allow=<encoded allow string>`. Already-proxied and invalid URLs short-circuit (invalid → empty `src` plus a console warning).

Why it exists: third-party content runs on a dedicated origin, isolated from the Kizen app origin's cookies and DOM; the postMessage channel is normalized with plugin attribution and a nonce; and the host can grant device permissions per plugin without giving arbitrary sites a direct embed on the app origin.

### Proxy page requirements

- Refuses to run top-level (must itself be framed).
- Requires `?url=` and rejects non-HTTPS targets.
- Requires a non-empty iframe `name` — the engine sets it to your `plugin_api_name`, and it becomes the attribution on every relayed message. (If you hand-write proxied iframes in `outputUI` markup, the sanitizer stamps `name` for you.)
- The **inner frame** (your content) is always hard-sandboxed with: `allow-forms allow-modals allow-orientation-lock allow-pointer-lock allow-popups allow-popups-to-escape-sandbox allow-presentation allow-scripts allow-same-origin`. Anything not in that list (e.g. top-navigation) is unavailable to framed content, regardless of your `sandbox` argument.
- The `?allow=` parameter is dropped verbatim onto the inner frame's `allow` attribute — this is where your requested feature grants actually take effect.

### Requirements on the framed site

- **HTTPS only.**
- **Framing must be permitted.** The framed page loads inside the proxy origin, which itself sits inside the Kizen app — and CSP `frame-ancestors` is checked against every ancestor. A site that sends `X-Frame-Options: DENY` or a restrictive `frame-ancestors` will not render. If the site sets `frame-ancestors`, it must include both the proxy origin and the Kizen app origin (in production both are covered by `https://*.kizen.com`).
- **The page must not navigate itself to a different origin** (see origin pinning below).

### Cookies: the vendor session that works standalone and fails framed

This is the most common "it works when I open the URL directly, but the frame shows a login screen"
report, and it is not a Kizen bug — nothing in the pipeline touches cookies.

Your content sits **two frames deep**: the vendor page inside the proxy origin
(`plugin-assets.kizen.com`), which is itself inside the Kizen app origin. Every cookie the vendor
sets is therefore a **third-party cookie** from the browser's point of view. The frame proxy is a
static page with no server component — it does not rewrite `Set-Cookie`, does not add attributes,
and cannot repair a cookie the browser refused. Neither does the plugin API proxy, which is a JSON
proxy that returns upstream headers as data in a response body rather than re-emitting them.

What the browser does with that third-party cookie is **not uniform**, and it moved recently:
Chrome abandoned its plan to deprecate third-party cookies outright (April 2025), so a plain
`SameSite=None; Secure` cookie still works in a default Chrome profile. Safari blocks third-party
cookies unconditionally and does **not** treat `Partitioned` as an escape hatch. So there is no
single attribute string that makes vendor sessions work everywhere.

Practical guidance:

- **`SameSite=None; Secure` is the baseline everywhere.** Without `SameSite=None` the cookie is not
  sent on a cross-site subresource request at all — this is where a default-`Lax` session cookie
  fails first — and `Secure` is mandatory whenever `SameSite=None` is set. A vendor that cannot set
  these two cannot be framed with an authenticated session, full stop.
- **Adding `Partitioned` (CHIPS) is the forward-compatible best practice.**

  ```
  Set-Cookie: session=…; SameSite=None; Secure; Partitioned
  ```

  Where it is honored, the cookie lands in a jar keyed to the embedding top-level site. That keeps
  the cookie working as browsers tighten defaults, at the cost of a per-top-site session.
- **Test in Safari specifically.** No attribute combination rescues the session there. If Safari is
  in scope, design for a cookie-less path from the start — most vendors document one, typically a
  token in the frame URL or handed in via postMessage after load. See
  [`sendMessageToOwnFrame`](14-navigation-and-communication.md) and the SSO-token pattern in
  [04](04-worker-runtime-api.md).

Two consequences worth designing around:

- **A logged-in user may not be logged in inside the frame.** Where the cookie is partitioned it is
  a different jar, so the vendor sees a fresh, unauthenticated visitor even when the user has an
  active session in another tab. Content that assumes an existing ambient session needs its own
  in-frame sign-in or a token you hand it.
- **The failure is silent and looks like your bug.** The browser drops the cookie without a console
  error the framed page can act on; the vendor simply behaves as if the user never signed in. If a
  vendor integration renders a login screen only inside Kizen, check the `Set-Cookie` attributes
  and the browser before anything else.

**A platform trap on top of all this:** if you pass a `sandbox` list to
[`outputIframe`](#thisoutputiframeurl-allow-sandbox-options) that omits `allow-same-origin`, the
engine applies your tokens to the plugin-level iframe verbatim and the whole subtree — proxy shell
and vendor page alike — gets an **opaque origin**. Cookies are then unavailable to every frame
inside it, regardless of what the vendor sets. Either omit `sandbox` entirely (unsandboxed
plugin-level frame; the proxy's inner frame is hard-sandboxed either way) or make sure
`allow-same-origin` is in the list.

If the vendor cannot meet the baseline and offers no token-based path, framing their authenticated
content is not viable — drive their API through a
[declared service and the proxy](06-auth-secrets-services.md) and paint the result yourself.

### Permissions-Policy model

Permissions Policy delegation is strictly top-down, so the grant happens in two hops:

1. The **parent iframe** (proxy shell) always receives the fixed ceiling: `microphone *; speaker-selection *; autoplay *; camera *; display-capture *; hid *`.
2. Your `allow` array travels as `?allow=` and lands on the **inner frame** — that is where scoping happens. Origin-scoped grants must match the framed origin exactly; `*` permits re-delegation to nested origins; an empty allow means no powerful features regardless of the ceiling.

### The message bridge

**Upward (framed page → plugin):** the framed page calls `window.parent.postMessage(payload, "*")`; the proxy wraps it in an envelope before relaying to the app:

```ts
interface FrameProxyEnvelope {
  plugin_api_name: string;              // from the iframe's name attribute
  source_url: string;                   // the framed page's URL
  event: "message" | "loaded" | "error";
  data?: unknown;                       // the payload, for event: "message"
  error?: string;                       // e.g. "ORIGIN_MISMATCH", for event: "error"
  _kizen_proxy_nonce: string;           // per-frame nonce minted by the proxy
}
```

The engine unwraps envelopes before delivery: only `event: "message"` envelopes reach your `message_handler` script (as `this.args.eventData` — the exact payload the page posted). `loaded`/`error` envelopes are consumed by host loading/error handling and never reach plugin scripts. Non-proxy-origin messages pass through untouched.

**Downward (plugin → framed page):** payloads sent via [`this.communicate.sendMessageToOwnFrame(payload, targetOrigin)`](14-navigation-and-communication.md) pass through the proxy **verbatim** — no wrapper — targeted at the expected inner origin. The framed page receives exactly what you posted.

**Origin pinning:** the proxy pins the inner frame to the original target origin. If the framed page navigates to a **different origin**, the bridge posts an `event: "error"` envelope with `error: "ORIGIN_MISMATCH"` and **breaks permanently** for that frame — no further messages relay in either direction until the frame is re-rendered. Multi-origin flows (e.g. an OAuth dance that bounces across domains) cannot keep a live bridge; end such flows back on the original origin or treat the bridge as one-way.

The host also broadcasts route changes into every plugin iframe as `kizen-route-change` postMessages — see [14](14-navigation-and-communication.md).

### `message_handler` routing

Surfaces that own an iframe can declare a `message_handler` script (for floating frames, the file `message.js` in the frame's directory). It is subscribed to **all** window `message` events — not just your own frame's — excluding self-posted messages and Stripe's `js.stripe.com`. Proxy envelopes are unwrapped first; the handler runs as a normal worker script with `this.args = { ...surfaceArgs, eventData }`.

Because the handler hears every message on the page, **shape-check `eventData` before acting**: match on a discriminant your framed page sends (`if (this.args.eventData?.source !== "example-widget") return;`).

---

## `this.outputView(viewId, args?)` — unsupported

```ts
outputView(viewId: string, args?: Record<string, unknown>): void   // DO NOT USE
```

The engine defines `outputView` (render a packaged view inline into the output region), but the host does not implement the receiving side — the relay message is silently ignored. Calling it no-ops with no error.

**Use [`this.showViewInModal(viewId, config?)`](10-views-modals-forms.md) instead** — it is the supported way to render a named view, and it works from every non-calendar worker context. For inline composition, paint the shared markup with `outputUI` (the single-painter pattern in [09](09-blocks.md#the-single-painter-convention)).

---

## Floating frames

A floating frame is a draggable, minimizable window that floats over the app — the home for persistent widgets (dialers, chat, players).

### Declaring a floating frame

```
src/floatingFrames/<frameDir>/
  config.json        # REQUIRED
  script.js          # main script — runs on mount, typically calls outputUI or outputIframe
  message.js         # optional → the frame's message_handler
  eventScripts/      # data-script handlers + runFrameScript targets
  styles.css         # optional, engine-scoped
  <customIcon>.svg   # optional minimized-circle icon asset (inlined as a data: URL)
```

`config.json`:

```json
{
  "name": "Support Widget",
  "api_name": "support_widget",
  "title": "Support",
  "width": 320,
  "height": 420,
  "default_position": "bottom-right",
  "header_color": "#0f172a",
  "header_text_color": "#ffffff",
  "minimized_style": "bar",
  "match": ["/client/", "/custom-objects/"],
  "when": "Boolean({{config.enableSupportWidget}})"
}
```

### `title`, `header_color`, `header_text_color`

Unlike blocks, floating frames **do** get host chrome: a container with `border-radius: 4px`, a soft shadow, `overflow: hidden`, and a **40px header bar** showing the (truncated) `title`, a drag handle, and a minimize/expand button. `header_color` / `header_text_color` style the bar (defaults white/black). Frames stack above app content, including date/time pickers, and automatically hide behind open modals.

### `width`, `height`

Pixels. Defaults: width 300, height 600. Height is clamped to the viewport minus the 40px header. The content area below the header is yours; script-rendered content should still set explicit px font sizes (host CSS leaks into non-iframe frame content exactly as it does into [blocks](09-blocks.md#the-css-environment)).

### `default_position`

`"bottom-left" | "bottom-right" | "bottom-right-fixed" | "bottom-left-fixed"`.

- Non-fixed frames are draggable by the header. Position (and minimized state) persist **per employee**, keyed by quadrant plus offsets, so the frame repositions sensibly on window resize and restores across sessions.
- `*-fixed` positions **disable dragging** and pin the frame to its minimized-circle trigger. **Fixed positioning requires `minimized_style: "circle"`** — the fixed anchor *is* the circle trigger. With `bar`/`none`, every fixed-positioning path silently no-ops and the frame's position freezes; the packager rejects this combination at build time (`structure/fixed-frame-minimized-style`). **Omitting `minimized_style` on a fixed frame is valid** — the validator only fires when the field is present and set to something other than `circle`, and an omitted value defaults to `circle` anyway.

### `minimized_style`, `minimized_config`

`"bar"` — minimizes to a bar. `"circle"` (**default**) — minimizes to a fixed circular trigger pinned bottom-left/bottom-right. `"none"` — no visible minimized affordance (renders as a hidden circle-type).

The packager resolves this field by allowlist: `bar`, `circle` and `none` pass through, and **anything else — including a missing value or a typo — becomes `circle`**. A frame that sets `minimized_style: "Bar"` gets a circle, silently, because the check is case-sensitive.

`minimized_config`: `{ "icon": "<platform-icon-name>", "color": "<color>" }` or `{ "customIconFile": "trigger.svg" }` (the file is inlined as a `data:image/` URL at package time). Icon names come from the platform icon set — `npx --yes @kizenapps/cli icons` lists them. Defaults: icon `action-drag-handle`, color `blue`.

### `match`, `ignore`

Route visibility, tested against the app pathname:

- `match`: a regex **allowlist** — when non-empty, the frame is hidden unless at least one regex matches the current pathname.
- `ignore`: extra regexes merged with baked-in default ignore patterns (login, personal-settings, embed, and builder routes are always ignored).

### `when`

Same conditional-enablement contract as [blocks](09-blocks.md#when): `{{config.key}}` / `{{userConfig.key}}`, silently hidden when false.

### Frame context methods

Frame scripts run in the floating-frame worker context, which adds to the base API:

```ts
this.hide(config?: { hideTrigger?: boolean }): void   // hide the frame (and optionally its minimized trigger)
this.show(config?: { showTrigger?: boolean }): void
this.expand(): void                                    // un-minimize
this.collapse(): void                                  // minimize
this.hideHeader(): void                                // FIXED frames only — silent no-op otherwise
this.showHeader(): void                                // FIXED frames only
```

- **A frame auto-shows when its script starts** — the engine calls `show()` after setup, and the frame is hidden until then. Never call `show()` for the initial paint; call `hide()` early if the frame should start hidden, or `collapse()` (+ `hideHeader()` on fixed frames) to start minimized.
- `hideHeader()`/`showHeader()` only work on fixed frames because non-fixed frames are dragged by their header.

### Messaging and cross-surface control

- `message.js` (the `message_handler`) runs whenever the framed page posts upward — payload on `this.args.eventData`, pre-unwrapped ([routing rules above](#message_handler-routing)).
- Other surfaces of the same plugin drive the frame with [`this.communicate.runFrameScript(frameApiName, scriptId, args?)`](14-navigation-and-communication.md) — e.g. a data adornment sending a phone number to a dialer frame. On record routes the dispatched args are augmented with the current `objectId`/`entityId`.
- Reply down into the iframe with [`this.communicate.sendMessageToOwnFrame(payload, targetOrigin)`](14-navigation-and-communication.md).

### Example: an iframe frame with a message bridge

`src/floatingFrames/supportWidget/config.json` — as above. Then:

```js
// script.js — embed the widget with least-privilege, origin-scoped permissions.
this.outputIframe("https://widget.example.com/panel", [
  "microphone https://widget.example.com",
]);
```

```js
// message.js — runs on every window message (any origin). The proxy envelope is already
// unwrapped: this.args.eventData is exactly what the page posted. Shape-check first.
const eventData = this.args.eventData;
if (eventData?.source !== "example-widget") return;

switch (eventData.type) {
  case "call-ended":
    // Hop to an event script for the heavy lifting (fresh worker, full API).
    this.communicate.runFrameScript("support_widget", "logCall", {
      durationSeconds: eventData.duration,
      contactPhone: eventData.phone,
    });
    // Acknowledge down into the iframe (payload arrives verbatim).
    this.communicate.sendMessageToOwnFrame(
      { source: "example_plugin", type: "ack", id: eventData.id },
      "https://widget.example.com",
    );
    break;
  case "minimize-request":
    this.collapse();
    break;
}
```

```js
// eventScripts/logCall.js — a normal worker script with the full API.
const [, error] = await this.postWithErrors("/records/example_calls/add", {
  fields: [
    { name: "name", value: `Call ${new Date().toISOString()}` },
    { name: "duration_seconds", value: Number(this.args.durationSeconds) || 0 },
  ],
});
if (error) {
  this.showToast("Could not log the call.", { variant: "failure", autohide: false });
  return;
}
this.showToast("Call logged");
```

---

## Toolbar items

Two distinct mechanisms put a plugin entry in the global toolbar. Both are alphabetized among other items (you can't control order), can be renamed (display name only) by admins in the toolbar builder, and disappear silently when the plugin is uninstalled or `when`-disabled.

### Script-execution mode — `src/toolbarItems/`

```json
{ "api_name": "quick_report", "label": "Quick Report", "icon": "globe", "color": "#0ea5e9", "when": "Boolean({{config.enableReports}})" }
```

| field | type | required | meaning |
|---|---|---|---|
| `api_name` | string | recommended | Stable identifier. |
| `label` | string | yes | Toolbar text. |
| `icon` | string | no | Platform icon name (`npx --yes @kizenapps/cli icons`). |
| `color` | string | no | Hex color. |
| `when` | string | no | Conditional enablement (`{{config.*}}`/`{{userConfig.*}}`). |

Clicking runs `script.js` **inline** — no navigation happens. The script gets the base worker context (business-level: `this.config`, `this.userConfig`, `this.currentUser`, `this.currentBusiness`, `this.location`; **no record context**) and typically opens a [modal](10-views-modals-forms.md), paints nothing, or [navigates itself](14-navigation-and-communication.md) via `this.openWindow`.

### Page-navigation mode — `is_toolbar_item` on a page

A routable page (`src/pages/<dir>/config.json`) can project itself into the toolbar:

```json
{ "name": "Console", "api_name": "console", "is_toolbar_item": true, "toolbar_icon": "globe", "toolbar_color": "#0ea5e9" }
```

Clicking **navigates** to `/plugins/{plugin_api_name}/{page_api_name}` — it does **not** run a script on click; the page's own script runs when the page mounts. Use this mode when the destination is a full page; use a script toolbar item when the click should act in place.

### Lifecycle: how a toolbar item is lost permanently

A toolbar item is not shown by right — it is shown only if it survives a render-time filter against
each user's **saved toolbar layout**. That layout is per employee, and the filter drops any item
whose plugin is not currently in the enabled-plugin map. Two facts follow, and the second is the
one that costs people their configuration.

**Disabling a plugin hides its items; re-enabling brings them back — usually.** The saved layout
still contains the item while the plugin is disabled; it is merely filtered out at render time. Flip
the plugin back on and it reappears.

**Unless someone saved the toolbar in the meantime — then it is gone for good.** The toolbar builder
loads the *already-filtered* list into its editing state, so while the plugin is disabled the
builder genuinely does not know your item exists. Any save from that screen persists a layout with
your item deleted. Re-enabling the plugin does **not** restore it: nothing re-injects plugin items
into a saved layout. The item returns only to the builder's left column, as something the user must
drag back in by hand.

The same applies to toolbar **templates**: re-saving a template while a plugin is disabled strips
that plugin's items from the template permanently.

**There is no way to push a toolbar item to all users by default.** A newly installed plugin's
toolbar item lands in nobody's toolbar automatically — the default-items list contains no plugin
entries, and defaults are only injected into layouts the user has never modified. The only bulk
mechanism is an admin applying a **toolbar template** to users or roles, which replaces each
recipient's toolbar wholesale rather than adding one item to it.

Practical consequence for plugin authors: **do not treat the toolbar as a discoverable entry point
for a new feature.** Users have to add it themselves, or an admin has to overwrite everyone's
toolbar. If a feature must be findable on install, give it a surface that renders without per-user
opt-in — a block, an adornment, or a record action.

---

## Gotchas

- **`outputView` is a silent no-op.** The host never implemented it. Use `showViewInModal`.
- **Sanitizer clobbering:** form fields named after DOM properties (`name`, `action`, `title`, `submit`, `method`, `target`, `id`, …) lose the attribute silently and vanish from `formData`. Hyphenate every field name.
- **Sanitizer value-strip:** a `value` attribute whose decoded content contains a complete tag is dropped even when escaped — don't round-trip tag-tolerant text through hidden-input values; use `sessionData`.
- **`data-script` clicks are exact-target.** Child elements swallow clicks — buttons contain text only. And never apply `[data-script] > * { pointer-events: none }` broadly: it bricks every `data-script` form.
- **Form values are always array-wrapped**, empty inputs are `[""]` (truthy), unchecked checkboxes are absent, and the submit button's own name/value is never captured.
- **A click on a `data-script` form's padding runs the handler with no `formData`** — guard for it.
- **`outputIframe` needs a full `https://` URL.** A bare hostname produces a blank frame (URL parse failure); HTTP targets get a proxy error overlay.
- **Origin-scoped `allow` grants must exactly match the framed origin**, and a bare feature name effectively grants nothing useful inside the proxy — write `"feature https://origin"` or `"feature *"`.
- **The proxy bridge breaks permanently on cross-origin navigation** (`ORIGIN_MISMATCH`). Framed flows must stay on one origin to keep messaging alive.
- **The framed site must allow framing** — restrictive `frame-ancestors`/`X-Frame-Options` on the target site means a blank frame you cannot fix from the plugin side.
- **`message_handler` hears every window message**, not just yours — always shape-check `eventData` on a discriminant before acting. `loaded`/`error` proxy envelopes never reach it.
- **Frames auto-show on script start.** Don't call `show()` on mount; call `hide()`/`collapse()` early if you want a different initial state.
- **`hideHeader()`/`showHeader()` are fixed-frame-only** silent no-ops elsewhere; and `default_position: *-fixed` requires `minimized_style: "circle"` (build-time error otherwise).
- **Page-mode toolbar items don't run a script on click** — they navigate. If you need click-time logic, ship a script toolbar item.
- **Interactivity survives sanitization only as `data-script`.** `<script>` tags and inline handlers are stripped; anything dynamic beyond that belongs in an iframe talking over the bridge.
