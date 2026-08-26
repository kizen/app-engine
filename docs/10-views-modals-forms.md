# Views, Modals & Forms

**What this covers:** the plugin UI surfaces that live in a modal or on a routable page — views and pages (one shared collection), `showViewInModal` and its full options contract, submittable forms and form-data collection, the frameless multi-step wizard pattern, `dynamicPrompt` (including cascading async/typeahead selects), the legacy `prompt`, and `closeModal`.

**See also:** [worker runtime API](04-worker-runtime-api.md) for every `this.*` method's base semantics · [blocks](09-blocks.md) · [outputUI, sanitization, iframes and the frame proxy](11-output-ui-iframes-frames.md) · [route scripts and other artifacts](12-routes-calendars-adornments-settings.md) · [setup assistants](13-setup-assistants.md) (shares the field renderer with `dynamicPrompt`) · [navigation & communication](14-navigation-and-communication.md) · [errors & observability](15-errors-and-observability.md).

---

## Views and pages

### Views vs pages — one shared collection

`src/views/` and `src/pages/` both compile into the plugin's single **routable-pages collection**. There is no separate "views" list in the packaged bundle — a *view* is simply a routable page you open as modal content, and a *page* is one the user can navigate to directly. Consequences:

- `this.showViewInModal(id)` resolves `id` against the combined collection by `api_name` — it can open anything declared under `views/` **or** `pages/`.
- `api_name`s must be unique across views *and* pages (duplicate names fail packaging with `structure/duplicate-api-name`).
- Only entries authored under `pages/` get a route and can appear in the toolbar; entries under `views/` are reachable only through `showViewInModal`.
- Neither views nor pages can be `when`-gated — a `when` in either `config.json` is discarded at package time, silently. Conditional visibility applies to blocks, data adornments, floating frames, object settings items, toolbar items, calendar sources and Agentic Workflow steps, never to the `routable_pages` collection. Gate whatever navigates to a page instead.

### Directory layout and `config.json`

```
src/
  views/<folderName>/
    script.js            # paints the view (this.outputUI)
    styles.css           # optional; engine-scoped to this artifact's markup
    eventScripts/<n>.js  # optional; data-script handlers
    config.json          # optional
  pages/<folderName>/
    config.json          # REQUIRED (packaging fails without it)
    script.js
    styles.css           # optional
    eventScripts/<n>.js  # optional
    callback.js          # optional; see below
```

Keys the packager reads (anything else is silently ignored):

| Surface | Key | Type | Required | Meaning |
|---|---|---|---|---|
| views | `api_name` | string | no | Defaults to the sanitized folder name. **Set it explicitly** — the sanitizer lowercases, collapsing camelCase (`formView` → `formview`, though underscores are preserved), and `showViewInModal` must match this string exactly. |
| views | `name` | string | no | Display name. |
| pages | `api_name` | string | no | Same default/sanitization caveat as views. |
| pages | `name` | string | no | Display name (defaults to the raw directory name). |
| pages | `is_toolbar_item` | boolean | no | Projects the page into the global toolbar. Clicking the toolbar entry **navigates** to the page — it does not run a script. |
| pages | `toolbar_icon` | string | no | Icon from the platform icon set (`npx --yes @kizenapps/cli icons`). |
| pages | `toolbar_color` | string | no | Hex color for the toolbar icon. |

The `pages/` reader emits script-type pages only (a `script.js` painted via `outputUI`). A page can still *embed* an iframe at runtime with [`this.outputIframe(url)`](11-output-ui-iframes-frames.md) — that's the supported route to iframe content on a page.

### Routable pages — `/plugins/{plugin_api_name}/{page_api_name}`

Every page is routable at `/plugins/{plugin_api_name}/{page_api_name}` inside the Kizen app (rendered with the navigation bar, full remaining viewport height). Contract:

- The page's `script.js` runs **once on mount** in a fresh worker with the base worker context (no record context).
- `this.args` = URL query-string parameters (parsed flat: `?ref=email` → `{ref: "email"}`) merged with the page's configured args — configured args win over query params — plus the injected `pluginId` and `__kizen_user_config` keys.
- Unknown plugin/page combinations render the host's in-app 404.
- Re-navigating with different query params is a different worker identity (args are part of the worker id), so the script re-runs.

### `callback.js` — page callback script

A file named `callback.js` next to a page's `script.js` declares a **callback handler** for iframe flows:

- **Trigger:** an iframe rendered *inside the page* (e.g. via `this.outputIframe`) posts a `kizen:plugin_callback` message to its parent. The host route `/plugins/callback` (public, unauthenticated, no navigation chrome) exists exactly for this: point an external redirect flow back at `{origin}/plugins/callback?any=params`, and that page posts the message upward with its query string.
- **Contract:** `callback.js` runs as an ordinary worker script; `this.args` is the flat query-string object from the callback URL. Proxy envelopes are unwrapped by the host before dispatch, so the args arrive clean.
- **Constraint — `this.authorize()` never triggers `callback.js`.** `authorize()` opens the OAuth flow in a **new tab**, and `postMessage` does not cross tabs. Delivery requires the callback page to load in an iframe that is a child of the plugin page's own tab. If you need to observe an `authorize()` outcome, poll the service's authorization state instead (see [auth & services](06-auth-secrets-services.md)); the marketplace Authorization panel does the same.

### View/page args and the business config

At load time the host stamps `args: plugin.business_config` onto every declared surface — a view's or page's baseline args **are the plugin's business config**, which is why `this.config` (a Proxy over `args.__kizen_clean_config`) works inside view scripts.

**Args passed to a modal merge over that baseline.** Opening a view with `showViewInModal(id, {args})` merges the passed args on top of the injected business config, so inside the view — and inside its event scripts — `this.config` stays populated while `this.args` carries what the opener sent:

```js
await this.showViewInModal("myview", {
  args: { invoice: invoiceId },
  options: { frameless: true, size: "medium" },
});
// inside the view: this.config.<key> for plugin config, this.args.invoice for the passed value
```

Passed args win on a key collision, so the only way to lose the business config is to send a reserved `__kizen_*` key yourself. Don't.

---

## Modals

### The modal slot — FIFO queue, no nesting

The host has exactly **one** app-global modal slot. Modal requests (`showViewInModal`, `dynamicPrompt`, `prompt`, create-record modals) go into a FIFO queue; the next queued config shows when the current modal hides. Nesting is impossible:

- Opening modal B *after* modal A resolves is fine — sequential chaining works (see the round-trip example below).
- `await`ing a second modal **from inside a script while the first modal is still open** deadlocks: B queues behind A, and A never closes because its script is waiting on B.
- Multi-step UIs therefore use **one** view that repaints itself (the wizard pattern below), never a modal stack.

Floating frames auto-hide behind open modals by default.

### `this.showViewInModal(id, config?)`

Shows a packaged view (or page) in the host modal.

```ts
showViewInModal(
  id: string,                       // the view's api_name
  config?: {
    args?: Record<string, unknown>; // becomes the view script's this.args (merged over the business config — see above)
    options?: {
      title?: string;
      confirmButton?: { label: string; variant?: 'text' | 'standard'; color?: string };
      cancelButton?:  { label: string; variant?: 'text' | 'standard'; color?: string };
      frameless?: boolean;          // strip ALL host chrome (title + both buttons)
      size?: 'small' | 'medium' | 'large';
    };
  }
): Promise<{ canceled: boolean; values: Record<string, unknown>; eventSource?: 'button' | 'close' | 'script' }>
```

| Option | Meaning |
|---|---|
| `title` | Modal header text. Ignored when `frameless`. |
| `confirmButton` | Label/styling for the host confirm button. Confirm triggers form collection (below). Ignored when `frameless`. |
| `cancelButton` | Label/styling for the host cancel button. Cancel resolves `{canceled: true}`. Ignored when `frameless`. |
| `frameless` | `true` strips title *and* both buttons before the config reaches the host — all-or-nothing chrome suppression. The view owns its entire UI and must close itself via `this.closeModal()`. |
| `size` | Modal width: `small` = **400px**, `medium` = **900px**, `large` = **1200px**. Default **`medium`**. (`dynamicPrompt` is the one that defaults to `small` — the two modals have different defaults, so do not carry an assumption across from one to the other.) |

- **Args must nest under `config.args`.** Keys placed top-level beside `options` are silently dropped: `showViewInModal("v", { foo: 1 })` delivers no `foo`.
- The view renders full-bleed inside the modal body (zero padding) — the view supplies its own padding.
- The view's type determines rendering: script views paint via `outputUI`; iframe content works too (the host shows a loading state until the frame-proxy reports loaded).
- Available from every worker context **except calendar-source scripts**, where it throws (`showViewInModal`/`closeModal` are not supported there). It works fine from record actions, including create-override actions.
- The declared TypeScript return type (`{canceled, result?, error?}`) is stale. The **runtime** resolution shape is `{ canceled, values, eventSource }`:
  - Framed view confirmed: `values = { formData: Record<string, FormDataEntryValue[]> }` (array-wrapped — see below).
  - Frameless view: `values` is whatever the view passed to `closeModal(values, canceled)`.
  - Canceled (host cancel button, close icon, or `closeModal(_, true)`): `{ canceled: true }`; `eventSource` is `'button'`, `'close'`, or `'script'` respectively.

### Framed views — host chrome and submittable forms

With host chrome (the default), the **host confirm button does all the form work**; the view needs zero event scripts:

1. Confirm scans the rendered view for every `<form>` element.
2. Runs native constraint validation (`checkValidity()` / `reportValidity()`): `required`, `type="email"`, `pattern`, `<select required>` with a disabled placeholder, etc. Validation failure keeps the modal open and shows the browser's native validity UI.
3. On success, collects each form with `FormData` and resolves the promise with `{ canceled: false, values: { formData } }`.

Form-data collection rules (these apply identically to `data-script` form submits — see [event dispatch](11-output-ui-iframes-frames.md)):

- **Every value is array-wrapped** (`FormData.getAll` semantics): a single text input yields `["Jane"]`, two checked checkboxes named `channels` yield `["email", "phone"]`. `formData` is `Record<string, FormDataEntryValue[]>`.
- An empty-but-present text input is `[""]` — **truthy**. Check `formData.key?.[0]?.trim()`.
- An unchecked checkbox group is **absent** from the map entirely.
- Multiple forms in one view are merged into one flat map; the same key across forms — last form wins.
- Prefer joining multi-value fields over indexing `[0]`, which silently drops all but the first value: `(formData.channels ?? []).join(", ")`.
- The host confirm never runs a view's submit event script. A `data-script` submit handler only fires on a real form submission (a `type="submit"` button inside the view — the frameless pattern).
- Style validation errors with `:user-invalid`, not `:invalid`, so fields don't flash red before the user touches them.

**Field naming rules.** View markup passes through DOMPurify, whose DOM-clobbering protection **silently strips** any `name`/`id` attribute whose *value* collides with a `document` or `<form>` property: `<input name="name">`, `name="action"`, `name="submit"`, `name="title"`, `name="method"`, `name="target"`, `name="elements"`, `name="style"`, … lose the attribute, never reach FormData, and produce `undefined` with no error anywhere. Rule: **never use a bare DOM-property word as a field name — prefix or hyphenate** (`contact-name`, `bs-title`; no DOM property contains a hyphen). Full sanitization contract: [11 — outputUI & sanitization](11-output-ui-iframes-frames.md).

### Frameless views (`frameless: true`)

The host renders no chrome at all; the view owns its header, footer, buttons, and lifecycle:

- Submit path: a `<form data-script="submit">` driven by a real `type="submit"` button — so native validation runs first — whose event script ends with `this.closeModal(values, false)`.
- Cancel path: a plain `type="button"` with `data-script="cancel"` whose event script calls `this.closeModal(undefined, true)`.
- Anything the view passes as `values` arrives verbatim at the opener's `result.values` (not nested under `formData` unless you put it there).

### `this.closeModal(values?, canceled?)`

```ts
closeModal(values?: unknown, canceled?: boolean): void   // fire-and-forget
```

Closes the currently open modal from **any script of the same plugin** — typically a `data-script` handler inside the modal view, but a block or frame script can dismiss a modal too. Resolves the pending `showViewInModal` promise with `{ canceled: canceled ?? false, values: values ?? {}, eventSource: 'script' }`. Calling it with no modal open is a no-op.

### Worked example — framed form modal round-trip

View `src/views/feedbackform/script.js` (no `eventScripts/` needed — host chrome collects everything):

```js
// Painted once when the modal opens. Host confirm runs native validation
// (required, type=email) and collects FormData itself.
this.outputUI(`
<form class="ff-body">
  <label for="ff-name">Name</label>
  <input type="text" id="ff-name" name="contact-name" required />

  <label for="ff-email">Email</label>
  <input type="email" id="ff-email" name="contact-email" />

  <fieldset>
    <legend>Channels</legend>
    <label><input type="checkbox" name="channels" value="email" checked /> Email</label>
    <label><input type="checkbox" name="channels" value="phone" /> Phone</label>
  </fieldset>

  <label for="ff-notes">Notes</label>
  <textarea id="ff-notes" name="notes"></textarea>
</form>
`);
```

Opener (any non-calendar script — toolbar item, block event script, action):

```js
const result = await this.showViewInModal("feedbackform", {
  options: {
    title: "Send feedback",
    confirmButton: { label: "Submit" },
    cancelButton: { label: "Never mind" },
    size: "medium",
  },
});

if (result.canceled) {
  this.showToast("Feedback canceled — nothing submitted.", { variant: "alert" });
  return;
}

// Every value is array-wrapped. Join multi-value fields; unwrap singles.
const formData = result.values.formData;
const name = formData["contact-name"]?.[0]?.trim();
const channels = (formData.channels ?? []).join(", ");

const [, err] = await this.postWithErrors("/records/feedback_feedback/add", {
  fields: [
    { name: "name", value: name },
    { name: "channels", value: channels },
    { name: "notes", value: formData.notes?.[0] ?? "" },
  ],
});
if (err) {
  this.showToast(`Could not save feedback: ${err.message}`, { variant: "failure", autohide: false });
  return;
}
this.showToast(`Thanks, ${name}!`);
```

Chaining a second modal is just another sequential `await` — forward data through `args`:

```js
await this.showViewInModal("summaryview", {
  args: { formData },                       // the summary view reads this.args.formData
  options: { title: "What you submitted", confirmButton: { label: "Done" }, size: "large" },
});
```

### Worked example — frameless multi-step wizard (the repaint pattern)

There is one modal slot, so a wizard is **one frameless view that repaints itself**. Steps are event scripts; each repaint re-emits the accumulated state as hidden inputs so the next submit carries it forward.

Rules that make this work:

- Every step is a `<form data-script="...">`; form values (including hidden inputs) arrive on the event script's `this.args.formData`, array-wrapped.
- The clicked submit button's own `name`/`value` is **never** captured (`new FormData(form)` runs without the submitter) — you cannot encode "which button" on the submit button. Give **Back its own `<form data-script>`** carrying the same hidden inputs; a bare button click would lose all state.
- Escape every interpolated value (`esc()` below). Event scripts are isolated workers with no shared modules — duplicate the helper into each script; that is the correct pattern, not a smell.
- DOMPurify drops a `value` attribute whose decoded content contains a complete tag (`<script>…</script>`), even correctly escaped — don't round-trip tag-tolerant free text through hidden inputs; carry those values in `this.sessionData` instead.
- On a failed final write, **don't close** — repaint the previous step with the same formData so the user can retry.

`src/views/signupwizard/script.js` — mount delegates to the step-1 painter (single-painter convention):

```js
this.outputUI(`<div class="wiz"><p>Loading…</p></div>`);
this.runEventScript("step1");
```

`src/views/signupwizard/eventScripts/step1.js`:

```js
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Repainted by "Back" with prior values on this.args.formData; empty on first paint.
const prior = this.args.formData ?? {};
const name = prior["contact-name"]?.[0] ?? "";
const email = prior["contact-email"]?.[0] ?? "";

this.outputUI(`
<form class="wiz" data-script="step2">
  <h2>New signup — step 1 of 2</h2>
  <label>Name <input type="text" name="contact-name" value="${esc(name)}" required /></label>
  <label>Email <input type="email" name="contact-email" value="${esc(email)}" required /></label>
  <footer>
    <button type="button" data-script="cancel">Cancel</button>
    <button type="submit">Next</button>
  </footer>
</form>
`);
```

`eventScripts/step2.js` — re-emit step-1 state as hidden inputs; Back is its own form:

```js
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const fd = this.args.formData ?? {};
const name = fd["contact-name"]?.[0] ?? "";
const email = fd["contact-email"]?.[0] ?? "";
const hidden = `
  <input type="hidden" name="contact-name" value="${esc(name)}" />
  <input type="hidden" name="contact-email" value="${esc(email)}" />`;

this.outputUI(`
<div class="wiz">
  <h2>Confirm — step 2 of 2</h2>
  <p>Create signup for <strong>${esc(name)}</strong> (${esc(email)})?</p>
  <footer>
    <form data-script="step1">${hidden}<button type="submit">&larr; Back</button></form>
    <form data-script="finish">${hidden}<button type="submit">Create</button></form>
  </footer>
</div>
`);
```

`eventScripts/finish.js` — create, retry-in-place on failure, close on success:

```js
const fd = this.args.formData ?? {};
const name = fd["contact-name"]?.[0]?.trim();
const email = fd["contact-email"]?.[0]?.trim();

const [created, err] = await this.postWithErrors("/records/signup_signup/add", {
  fields: [
    { name: "name", value: name },
    { name: "email", value: email },
  ],
});

if (err) {
  this.showToast(`Create failed: ${err.message}`, { variant: "failure", autohide: false });
  // Don't close — repaint the confirm step in place so the user can retry.
  this.runEventScript("step2", { formData: fd });
  return;
}

this.closeModal({ recordId: String(created.id) }, false);
```

`eventScripts/cancel.js`:

```js
this.closeModal(undefined, true);
```

Opener:

```js
const result = await this.showViewInModal("signupwizard", {
  options: { frameless: true, size: "medium" },
});
if (!result.canceled) {
  this.showToast(`Signup ${result.values.recordId} created.`);
}
```

### `this.dynamicPrompt(config)`

The quick-modal primitive: a host-rendered form described entirely by config, no view required. **This is the current prompt API** — see the legacy `prompt` note below.

```ts
dynamicPrompt(config: {
  title?: string;
  size?: 'small' | 'medium' | 'large';           // 400 / 900 / 1200 px; default small
  confirmButton?: { label: string; variant?: 'text' | 'standard'; color?: string };
  cancelButton?:  { label: string; variant?: 'text' | 'standard'; color?: string };
  registerUtils?: Record<string, Function>;      // helpers available to field callbacks as `utils`
  content: DynamicPromptField[];
}): Promise<{ canceled: boolean; values: Record<string, unknown> }>
```

Fields are keyed by `key`; each answered field returns under `result.values.<key>`. The content renderer is shared with [setup assistants](13-setup-assistants.md), including host-enforced validation.

**Field catalog** (common props on every input field: `key`, `label`, `required`, `tooltip`, `placeholder`, `default`, `widthPercent: 50 | 100`, `when`, `dependencies`):

| `type` | Config | Result value |
|---|---|---|
| `description` | `content` (markdown/HTML string), `widthPercent`, `when` | — (display only) |
| `container` | `label?`, `columns?`, nested `fields` | — (grouping) |
| `spacer` | `height`, `widthPercent` | — (layout) |
| `text` | `default`, `placeholder`, `validation_pattern?` | **Plain string** — NOT array-wrapped (unlike `showViewInModal` formData). Host validates non-blankness for `required` but submits the raw untrimmed string — trim as normalization, not validation. |
| `number` | `default`, `placeholder` | `Number`; the key is **absent** from `values` when left blank. |
| `boolean` | `default` | `boolean`. |
| `select` (static) | `options: [{label, value}]`, `allow_multiple?`, `autoSelect?` | The **whole selected option object** `{label, value}` — read `values.key.value`. Multi-select: an array of option objects. An unpicked optional select is **absent** from `values`, not `null`. |
| `select` (async) | omit `options`; add `fetchMethod`, `getFetchUrl`, `optionMapper`, `getHeaders?`, `getBody?`, `typeahead?`, `dependencies?`, `autoSelect?` | Same shapes as static select; `value` can be any JSON your `optionMapper` produced. |

- `required: true` **is host-enforced** — Confirm is blocked until the field is filled. Script-side re-checks of required dynamicPrompt fields are an anti-pattern.
- `when` is an expression string over the *other field values* using bare `{{key}}` templating, e.g. `"Boolean({{brand_name}}?.value)"` (note: bare `{{key}}`, not the `{{config.key}}` scope used by artifact configs).
- `dependencies: ["otherKey"]` resets and re-fetches this field when the named field changes.
- `autoSelect: true` eagerly picks a lone option.
- **Always guard `result.canceled` before reading `values`.**
- Unlike `showViewInModal`, `dynamicPrompt` (and `prompt`) remain available in calendar-source workers.

**Async select callbacks are serialized functions.** `getFetchUrl`, `optionMapper`, `getHeaders`, and `getBody` are stringified in the worker and executed host-side as self-invoking snippets receiving `({ state, args, utils })`:

- They **cannot close over script variables** — anything they need must arrive through `state` (field values), `utils`, or be inlined in the function body.
- `registerUtils: { helperA, helperB }` makes those functions available as `utils.helperA(...)` inside every callback (the utils themselves are serialized too — same no-closure rule).
- `state` holds every field's current value; `state.search` is the live typeahead query (when `typeahead: true`); `state.result` in `optionMapper` is the parsed JSON body of the most recent `getFetchUrl` fetch.
- Return `""` from `getFetchUrl` to skip fetching (e.g. before a dependency is picked).
- The raw prompt values are post-processed per field type before your script sees them, which is why results come back as clean scalars/objects.

### Worked example — cascading typeahead selects

A two-stage cascade (searchable product → dependent variant), the pattern behind search-and-pick actions:

```js
const result = await this.dynamicPrompt({
  title: "Pick a product",
  size: "medium",
  confirmButton: { label: "Add", variant: "standard" },
  cancelButton: { label: "Cancel", variant: "text" },
  registerUtils: {
    getBaseUrl: () => "https://api.example.com/catalog",
    titleCase: (s) =>
      s.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "),
  },
  content: [
    {
      type: "select",
      key: "product",
      label: "Search products",
      required: true,
      typeahead: true,                    // drives state.search as the user types
      fetchMethod: "GET",
      getFetchUrl: ({ state, utils }) => {
        if (!state.search) return "";     // "" = skip the fetch until there's a query
        return `${utils.getBaseUrl()}/search?q=${encodeURIComponent(state.search)}&limit=50`;
      },
      optionMapper: ({ state, utils }) =>
        (state.result?.items ?? []).map((item) => ({
          label: utils.titleCase(item.name),
          value: item,                    // value may be any JSON — carry the whole row forward
        })),
      getHeaders: () => ({ "Content-Type": "application/json" }),
    },
    {
      type: "select",
      key: "variant",
      label: "Variant",
      required: true,
      when: "Boolean({{product}}?.value)",   // hidden until a product is picked
      dependencies: ["product"],             // reset + refetch when the product changes
      autoSelect: true,                      // auto-pick when only one variant exists
      fetchMethod: "GET",
      getFetchUrl: ({ state, utils }) => {
        const product = state.product?.value?.value;   // picked option → its `value` payload
        if (!product) return "";
        return `${utils.getBaseUrl()}/products/${encodeURIComponent(product.id)}/variants`;
      },
      optionMapper: ({ state }) =>
        (state.result?.variants ?? []).map((v) => ({ label: v.sku, value: v })),
    },
    { type: "number", key: "qty", label: "Quantity", required: true, placeholder: "e.g. 3" },
  ],
});

if (result.canceled) return;

const product = result.values.product.value;   // whole option object → .value payload
const variant = result.values.variant.value;
const qty = result.values.qty;                 // plain Number
```

Kizen APIs work in these callbacks too — build proxy URLs by hand (`/external-integrations/proxy/{pluginApiName}/{service}/...`); the callbacks run host-side, so `this.getServiceUrl` is not available inside them.

### `this.prompt(config)` — legacy

`prompt` is the predecessor of `dynamicPrompt` and is **superseded — use `dynamicPrompt` in all new code**. Differences to recognize when reading older scripts:

- Items are keyed by `id`, not `key`; the select type is `"dropdown"` (with `multiselect` and `defaultValue`), not `"select"` (with `allow_multiple` and `default`).
- `required` is documentation-only in `prompt` — nothing enforces it.
- No `registerUtils` / typeahead machinery, and no per-field-type result cleaning.
- Do **not** carry `type: "dropdown"` into `dynamicPrompt` — dynamicPrompt has no result-cleaning case for it and the value is **silently dropped**. Use `type: "select"`.

### `this.openCreateRecordModal(objectId)` / `this.openCreateRelatedRecordModal(objectId, relatedEntityId)`

Open Kizen's own native create-record modal (queued through the same single modal slot) and resolve with the created-record payload. Only record-detail and floating-frame contexts have the related-record variant fully wired. Signature details and context availability: [04 — worker runtime API](04-worker-runtime-api.md).

### The `{canceled: true}` ambiguity

`prompt`, `dynamicPrompt`, and `showViewInModal` all resolve `{canceled: true}` **immediately** when the hosting surface has no modal handler wired — indistinguishable from a user cancel. In the Kizen app every standard surface has the handler; you can hit this in embedded/headless hosts or unusual mount points. If a prompt appears to "cancel itself instantly", suspect the host wiring, not your config.

### `this.outputView(viewId, args?)` — unsupported

The engine defines `outputView` (render a packaged view inline into the output region), but the host does not handle the relay — the call **silently no-ops**. Do not use it. The working alternative for showing a named view is `this.showViewInModal(viewId)`; for inline UI, paint with [`this.outputUI(markup)`](11-output-ui-iframes-frames.md).

### Toasts

`this.showToast(message, {variant, autohide})` and `this.clearToasts()` are the lightweight notification channel that pairs with every modal flow (cancel notices, progress, failure with `autohide: false`). Full signatures and defaults: [04 — worker runtime API](04-worker-runtime-api.md#thisshowtoastmessage-options).

---

## Gotchas

- **Args placed beside `options` are silently dropped** — opener data must nest under `config.args`: `showViewInModal(id, { args: {...}, options: {...} })`.
- **`showViewInModal`'s TS return type is stale** — runtime resolves `{canceled, values, eventSource}`; framed form data is at `result.values.formData`, not `result.result`.
- **Form values are array-wrapped everywhere forms are collected** (`showViewInModal` confirm and `data-script` submits); **`dynamicPrompt` values are plain** — the two APIs are opposites. Don't index `[0]` on multi-value fields, and don't expect arrays from prompts.
- **DOMPurify name-clobbering**: form fields named `name`, `title`, `action`, `submit`, `method`, `target`, `id`, `style`, … silently lose the attribute and vanish from formData. Hyphenate (`contact-name`). ([11](11-output-ui-iframes-frames.md))
- **DOMPurify value-attribute drop**: a `value` attribute whose decoded content contains a complete tag is stripped even when escaped — carry tag-tolerant text through `sessionData`, not hidden inputs.
- **One modal slot** — awaiting a modal from inside an open modal's script deadlocks (FIFO queue, no nesting). Wizards repaint one frameless view.
- **The submitter button is never in formData** — encode wizard navigation as separate `<form data-script>`s per action, each re-emitting the hidden-input state.
- **Empty text input is `[""]` (truthy); unpicked checkbox groups and unpicked optional selects/blank numbers are absent** — guard for both shapes.
- **`required` is enforced in `dynamicPrompt` but not in legacy `prompt`**; re-checking dynamicPrompt required fields in script is dead code.
- **`type: "dropdown"` inside `dynamicPrompt` silently drops the value** — the current type name is `"select"`.
- **Async-select callbacks are serialized** — no closures; pass helpers through `registerUtils` and data through `state`.
- **`callback.js` never fires from `this.authorize()`** — new tab, no cross-tab postMessage; it only works for iframe flows inside the page's own tab.
- **`showViewInModal`/`closeModal` throw in calendar-source scripts**; `dynamicPrompt`/`prompt` still work there.
- **`{canceled: true}` can mean "no modal handler wired", not just user cancel.**
- **`this.outputView` silently no-ops** — use `showViewInModal`.
- **View `api_name` defaults to the sanitized folder name** (lowercased, so camelCase collapses; underscores are preserved) — set it explicitly in `config.json`, and match it exactly in `showViewInModal`.
