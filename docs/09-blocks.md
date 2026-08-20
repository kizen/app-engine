# Blocks (Dashlets)

**What this covers:** Plugin blocks — the dashlets a Kizen admin places on Dashboards, Homepages, Chart Groups, and record-page layouts. Declaration (`config.json`), where blocks render and in what container, the dashlet chrome contract (you paint your own card), the CSS environment, the block script runtime model, cross-block communication, and chart techniques that survive the host font reset.

**See also:** [worker runtime API](04-worker-runtime-api.md) for every `this.*` method available inside block scripts · [output UI & sanitization](11-output-ui-iframes-frames.md) for the `outputUI`/`data-script` contract blocks render through · [navigation & communication](14-navigation-and-communication.md) for `runBlockScript`, `sessionData`, and cross-surface dispatch semantics · [views & modals](10-views-modals-forms.md) for opening modals from a block.

---

## Declaring a block

Blocks are declared by directory convention under your manifest's `entry` directory:

```
src/blocks/<blockDir>/
  config.json        # declaration (name, api_name, sizing, surfaces, when)
  script.js          # main script — runs when the block mounts
  eventScripts/      # handlers for data-script="<name>" and runBlockScript targets
    <name>.js
  styles.css         # optional; scoped by the engine to this block's markup
```

A complete `config.json`:

```json
{
  "name": "Team Pulse",
  "api_name": "team_pulse",
  "types": ["dashboards", "homepages"],
  "min_w": 3,
  "max_w": 12,
  "min_h": 3,
  "max_h": 10,
  "recommended_height": 320,
  "when": "Boolean({{config.enableBlocks}})"
}
```

Always set `api_name` explicitly. When omitted, the packager derives it from the directory name by lowercasing it, collapsing hyphen and whitespace runs to `_`, then dropping characters outside `[a-z0-9_]` (`teamPulse` → `teampulse`, `team-pulse` → `team_pulse`; underscores are preserved), which rarely matches what you want to reference from `runBlockScript`.

### `name`

| field | type | required | meaning |
|---|---|---|---|
| `name` | string | yes | Display name. Shown in the block picker and used as the dashlet's display name in host menus (plugin blocks have no editable dashlet title). Blocks are sorted alphabetically by name in pickers — you cannot control ordering. |

### `api_name`

| field | type | required | meaning |
|---|---|---|---|
| `api_name` | string | recommended (defaults from directory name) | Stable identifier. This is the first argument other scripts pass to `this.communicate.runBlockScript(blockApiName, ...)`. Use lowercase letters, digits, and underscores. |

### `types`

| field | type | required | meaning |
|---|---|---|---|
| `types` | `("homepages" \| "dashboards" \| "charts" \| "records")[]` | no | Which surfaces offer this block in their picker. **Empty or missing means the block appears on all surfaces.** |

- `dashboards` — the Dashboards grid.
- `homepages` — the Homepages grid.
- `charts` — Chart Groups on record list pages; chart-group placements pass the group's `objectId` in args.
- `records` — record detail page layouts (fixed-height slot, see [record pages](#record-pages) below).

### `min_w`, `max_w`, `min_h`, `max_h`

| field | type | required | meaning |
|---|---|---|---|
| `min_w` / `max_w` | number (grid columns) | no | Horizontal resize limits on grid surfaces. Packager defaults: `min_w: 1`, `max_w: 12`. |
| `min_h` / `max_h` | number (grid rows) | no | Vertical resize limits. Packager defaults: `min_h: 1`, `max_h: 12`. |

**All four are hard-capped at 12 by the platform**, and all four have a floor of 1 — the publish
endpoint validates every one of them against the same 1–12 range and rejects the whole publish if
any value falls outside it. A block cannot be taller than 12 grid rows, so `max_h: 24` is not a
larger block, it is a failed publish. When the packager sees a missing or zero-ish value it fills
in `1` for the minimums and `12` for the maximums.

Constraints are **not stored** in the placed dashlet — the host re-derives them from your block definition on every load, so publishing a new version with different limits retroactively changes resize limits on existing placements. New dashlets are created at `min_w × min_h`.

### `recommended_height`

| field | type | required | meaning |
|---|---|---|---|
| `recommended_height` | number (px) | no | Suggested pixel height. On **record pages** this becomes the block's fixed height (default `300` when absent). Grid surfaces size by rows instead. |

### `when`

| field | type | required | meaning |
|---|---|---|---|
| `when` | string (expression) | no | Conditional enablement. Evaluated against install config: `{{config.key}}` reads the business setup-assistant value, `{{userConfig.key}}` reads the user-level value (internally rewritten to `config__key` / `userConfig__key`). Both scopes compose: `"Boolean({{config.x}}) && !{{userConfig.y}}"`. |

When the expression is false the block **silently disappears**: it's filtered out of pickers, and already-placed dashlets show "This block is no longer available…" (record-layout placements collapse to nothing). There is no error or author-visible signal — if your block vanished after an install-config change, check its `when` first. Declaring a `when` on a block sets the package's `block_loading_for_setup: true` (the host loads config before evaluating conditions) — expected, not a bug.

---

## Where blocks render

### Grid surfaces (Dashboards, Homepages, Chart Groups)

The block renders inside a grid dashlet. Args passed to the script (merged over your plugin's business config, which is always present in `this.args`):

| arg | shape | surface |
|---|---|---|
| `dateFilter` | `{ start, end }` | dashboards/homepages — the dashboard-level date filter |
| `teamFilter` | `{ teamMembers, roles }` | dashboards/homepages — the dashboard-level team filter |
| `objectId` | string (uuid) | chart groups — the group's object |

Changing a dashboard filter changes the block's args, which changes the worker identity — the block script **re-runs with the new args**. Design the script as a pure "fetch + paint" so filter changes are free repaints.

The hover-revealed dashlet menu (edit/duplicate/delete controls) floats **over the block's top-right corner** with a transparent background and `z-index` above your content. Leave that corner visually quiet or your UI will fight the controls.

### Record pages

Record detail layouts have a plugin-block slot. Container: `position: relative; width: 100%; height: <recommended_height ?? 300>px; overflow: hidden` — a **fixed height**, not grid-resizable. Args: `{ objectId, entityId }` in `this.args`.

Record-page blocks still run in the generic worker with the base context — they do **not** get the record-detail methods (`this.currentEntity()`, `this.objectId`, etc.). Fetch the record yourself from the `objectId`/`entityId` args using [`this.getWithErrors`](04-worker-runtime-api.md) against the record endpoints in [05-platform-api.md](05-platform-api.md).

### The container

The block's script markup is rendered into a bare `<div style="height:100%;width:100%">` handed to the worker, with your scoped `<style>` as a sibling. While plugin bootstrap is still hydrating, an opaque white loader overlays the block area. That div is all you get — everything visible is yours to paint.

---

## The dashlet chrome contract — paint your own card

The host supplies **no card chrome** for plugin blocks. Verified current behavior:

- **Background: transparent.** No white card behind your content.
- **Border: none. Border radius: none.**
- **Shadow: none by default.** The only shadow the host will ever draw is when the dashlet was placed with the "Enable drop shadow" toggle on (stored per-dashlet as `fe_extra_info.dashletStyleConfig.dropShadow`), rendered as `filter: drop-shadow(0 18px 26px rgba(0,0,0,0.06))` on the card. Drop shadow off means genuinely no shadow.
- **`overflow: hidden` clips everything** at the dashlet boundary — including any shadow *you* paint at the very edge.

That toggle is the **only** style setting exposed to the admin for a plugin block; dashboard-wide dashlet style settings do not apply to plugin blocks.

Consequence: **paint your own card, and inset it** so a self-painted shadow isn't clipped:

```css
.card {
  margin: 4px;
  height: calc(100% - 8px);
  box-sizing: border-box;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18); /* tight shadow that fits in the 4px inset */
}
```

Keep the shadow's blur/offset within the inset margin. If you want to match native dashlets, the platform's border radii are 2/4/8px (tiny/small/standard); native dashlet cards use white backgrounds.

---

## The CSS environment

Three host realities every block must design around:

1. **A global reset leaks in.** The host app injects `* { font-family: 'Proxima Nova', sans-serif; font-size: 10px; line-height: 1; }`. Every element in your block inherits `font-size: 10px` and `line-height: 1` unless you override it. `em`/`rem` units are useless (the base is 10px and the reset re-stamps every element anyway). **Discipline: explicit `px` `font-size` and `line-height` on everything that shows text.**
2. **Your `styles.css` is scoped, host CSS is not.** The engine wraps your stylesheet in a CSS `@scope { ... }` block tied to your block's container — write plain selectors (`.card`, `button`) without fear of leaking out. But host globals still cascade *in*, which is why the reset above reaches you.
3. **Element defaults cascade in too.** The host app ships a global CSS framework reset, so bare HTML elements inside your block are restyled before your CSS ever runs. This is separate from the font reset and catches people who assume plain markup renders like plain markup.

The inherited rules most likely to surprise you:

| What you write | What you actually get |
|---|---|
| any element | `box-sizing: border-box` |
| `<a>` | `color: #007bff`, **no underline** (underline only on hover) — links come out host-blue, not in your palette |
| `<h1>`–`<h6>` | `margin-top: 0`, `margin-bottom: .5rem` — plus `font-weight: 500` from the host's typography styles (not the reset), so headings render lighter than the browser's bold default |
| `<p>` | `margin-top: 0`, `margin-bottom: 1rem` |
| `<ul>` / `<ol>` | `margin-top: 0`, `margin-bottom: 1rem` — note the browser's default `padding-left` **survives**, so lists stay indented |
| `<table>` | `border-collapse: collapse` |
| `<label>` | `display: inline-block`, `margin-bottom: .5rem` |
| `<button>`, `<input>`, `<select>`, `<textarea>` | `font-family/size/line-height: inherit`, `margin: 0`; buttons additionally get `border-radius: 0` and a `-webkit-appearance: button` |
| `<img>` | `vertical-align: middle`, `border-style: none` |

These reach your markup for a mundane reason: nothing of yours competes with them. `@scope` proximity favors your rules wherever you actually write one, so a bare `<a>` or `<h2>` with no matching selector in your `styles.css` simply keeps the host value. **Set the properties you care about rather than assuming a default** — most visibly link color and heading margins, which are the two that make a hand-written card look subtly wrong.

Iframe-type embeds (via `outputIframe`) are separate documents and fully isolated from host CSS — see [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md).

---

## Block script runtime model

Blocks are worker-rendered DOM, the same model as pages and floating frames:

- `script.js` runs in a Web Worker when the block mounts. There is no `document`, no `addEventListener`, no DOM API. UI is painted with `this.outputUI(markup)` (sanitized HTML — full contract in [11](11-output-ui-iframes-frames.md#thisoutputuimarkup-options)); interactivity is wired exclusively through `data-script="<name>"` attributes dispatching to `eventScripts/<name>.js`.
- **Every script run is a fresh worker.** Nothing on `this` (or closure scope) survives between the mount script and its event scripts, or between two event-script runs. What persists: the painted DOM from the last `outputUI` (repaints swap in place) and state explicitly written to `sessionData`.
- **Event scripts are isolated units** — there are no shared helper modules. Duplicating a small helper (`esc()`, `describeError()`) across event scripts is the correct pattern, not a smell.
- Each **placed instance** of a block gets its own worker identity (the instance id is the worker key), so two copies of the same block on one page run independently. The mount script is deduped by a stable hash of plugin + block + script + args, so React re-renders don't re-execute it; args changes do.
- `this.setSessionData(update)` shallow-merges **top-level keys only** into a plugin-scoped, memory-only bucket shared by every surface of your plugin on the page; `this.sessionData` is a construction-time snapshot (a script never sees its own write within the same run). Use one top-level key per independent fact so concurrent writers compose. Full semantics in [14](14-navigation-and-communication.md).
- Loading affordances: `this.setIndicator("spinner" | "block" | "button" | "none")` drives the host loading chrome; the engine resets it to `"none"` when the script finishes. See [04](04-worker-runtime-api.md).
- Errors: expected failures get `this.showToast(msg, { variant: "failure", autohide: false })` and a graceful partial render; reserve `throw`/`this.onError` for genuine platform problems — see [errors & observability](15-errors-and-observability.md).

### Config value shapes inside block scripts

`this.config` (business setup-assistant values) and `this.userConfig` (user-level values) deliver **typed shapes, not raw strings**:

| assistant field type | value shape on `this.config` / `this.userConfig` |
|---|---|
| `boolean` | raw boolean |
| `text` | string |
| `number` | `Number` — key **absent** if the field was left blank |
| `select` | the whole `{ label, value }` option object — read `.value` |
| `custom_object` | `{ objectId, objectName }` — read `.objectId` (interpolating the object itself yields `/records/[object Object]/...`, which surfaces as a fake 403) |
| `field` picker | `{ fieldId, fieldName, objectId, objectName }` (array when `allow_multiple`; note it's the field **id**, not api_name) |

```js
const intensity = this.config?.themeIntensity?.value ?? "default"; // select
const objectId = this.config?.pinnedObjectId?.objectId;            // custom_object
const callSign =
  this.userConfig?.callSign || this.currentUser?.profile?.first_name || "Friend";
// currentUser nests under .profile; missing values default to "" (falsy), so || chains work.
```

### The single-painter convention

For any block with more than one event script, keep the markup in **exactly one** event script (conventionally `render`); the mount script paints a lightweight loading state and delegates, and every state-changing event script re-enters the painter:

```js
// script.js — mount: paint a shell, delegate to the single painter
this.outputUI(`<div class="card card--loading">Loading…</div>`);
this.runEventScript("render", { reason: "mount" });
```

```js
// eventScripts/refresh.js — a state-changing script never paints; it re-enters render
this.setSessionData({ lastRefreshed: Date.now() });
this.runEventScript("render", { reason: "refresh" });
```

This guarantees one copy of the markup, one place where config/session state is read, and repaint-in-place behavior everywhere. Volatile state rides in `sessionData`.

---

## Cross-block communication: `runBlockScript`

`this.communicate.runBlockScript(blockApiName, scriptId, args?)` runs a named event script on another block of the **same plugin** mounted on the **same page**. It's a fire-and-forget window event: every mounted instance of the target block runs `eventScripts/<scriptId>.js` with `args` on `this.args`; if the target isn't mounted it's a harmless no-op. Args are typed as scalars but arbitrary JSON objects round-trip fine. Full semantics (recipient matching, same-plugin rule, args transport) in [14-navigation-and-communication.md](14-navigation-and-communication.md).

The canonical shape is a ping/pong volley — two blocks that hit each other's `receive` script:

```js
// blocks/ping_block/eventScripts/serve.js — hit the other block
this.communicate.runBlockScript("pong_block", "receive", { from: "ping" });
```

```js
// blocks/pong_block/eventScripts/receive.js — payload arrives on this.args; repaint in place
const from = String(this.args.from ?? "unknown");
const rally = Number(this.sessionData?.pongRally ?? 0) + 1;
this.setSessionData({ pongRally: rally });
this.outputUI(`
  <div class="card">
    <p class="msg">Hit by <strong>${from}</strong> — rally ${rally}.</p>
    <button class="btn" data-script="serve">Serve back</button>
  </div>
`);
```

Broadcast design rule: when blocks sync via broadcast plus a persisted snapshot, never gate the live broadcast on completeness or validity — broadcast exactly what the sender renders, and gate only the persistence. Gating the broadcast is how "the other block stopped updating" bugs happen.

---

## Charts in blocks

There are no chart libraries in the worker — charts are inline SVG strings passed through `outputUI` (inline SVG survives sanitization). Two techniques matter:

### SVG `viewBox` scaling — text that dodges the font reset

A px `font-size` on an SVG `<text>` element inside a scaled `viewBox` is measured in **viewBox user units**, not CSS pixels. Labels inside the SVG therefore scale with the chart as the dashlet resizes *and* escape the host's `* { font-size: 10px }` reset. Style SVG text with `fill`, `text-anchor: middle`, `dominant-baseline: central` — never with HTML overlays.

```html
<svg viewBox="0 0 120 120" role="img" aria-label="Completion 72%">
  <circle cx="60" cy="60" r="48" fill="none" stroke="#e2e8f0" stroke-width="10"/>
  <circle cx="60" cy="60" r="48" fill="none" stroke="#4f46e5" stroke-width="10"
    stroke-linecap="round" transform="rotate(-90 60 60)"
    stroke-dasharray="301.6" stroke-dashoffset="84.4"/>
  <text x="60" y="60" font-size="26" font-weight="700" fill="#1e293b"
    text-anchor="middle" dominant-baseline="central">72%</text>
</svg>
```

Donut/gauge notes: `stroke-dasharray` = circumference (2πr), `stroke-dashoffset` = circumference × (1 − progress), `rotate(-90 …)` starts the arc at 12 o'clock — and **omit the arc element entirely at zero progress**, because a round line-cap paints a stray dot even at zero length.

### `preserveAspectRatio="none"` sparklines

For a line that stretches to fill whatever slot the dashlet gives it, draw into a fixed logical `viewBox` and let it distort:

```js
const buildSparkline = (values) => {
  const W = 100, H = 30, PAD = 2;
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / span) * (H - PAD * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  });
  return `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"
         style="width:100%;height:40px;display:block">
      <path d="${pts.join(" ")}" fill="none" stroke="#4f46e5"
            stroke-width="1.5" vector-effect="non-scaling-stroke"/>
    </svg>`;
};
```

Use solid strokes (referenced gradient `<defs>` are fragile when markup is re-sanitized into modals); add glow with CSS `filter: drop-shadow(...)` instead.

Data for chart blocks comes from the platform API, typically `POST /records/{objectId}/search` — see [platform API](05-platform-api.md).

---

## Complete example: a self-painting block card

A dashboard/homepage block for a plugin with `api_name: example_plugin` that paints its own inset card, survives the font reset, renders a donut, and repaints via the single-painter convention.

`src/blocks/teamPulse/config.json`

```json
{
  "name": "Team Pulse",
  "api_name": "team_pulse",
  "types": ["dashboards", "homepages"],
  "min_w": 3,
  "max_w": 8,
  "min_h": 3,
  "max_h": 8,
  "recommended_height": 300
}
```

`src/blocks/teamPulse/script.js`

```js
// Mount: shell + delegate. All markup lives in eventScripts/render.js.
this.outputUI(`<div class="tp-card tp-card--loading">Loading team pulse…</div>`);
this.runEventScript("render", { reason: "mount" });
```

`src/blocks/teamPulse/eventScripts/render.js`

```js
// Single painter. Event scripts are isolated — helpers like esc() are duplicated
// per script by design.
const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const objectId = this.config?.pulseObject?.objectId; // custom_object config value
let total = null;
if (objectId) {
  const [data, error] = await this.postWithErrors(`/records/${objectId}/search`, {
    field_names: ["name"],
  });
  if (error) {
    // Non-fatal: render the card without the count.
    this.console.warn("Team Pulse: search failed", error);
  } else {
    total = data?.count ?? data?.results?.length ?? null;
  }
}

const goal = Number(this.config?.pulseGoal) || 100;
const progress = total === null ? 0 : Math.min(total / goal, 1);
const R = 48;
const C = 2 * Math.PI * R;
const refreshedAt = this.sessionData?.tpRefreshedAt;

this.outputUI(`
  <div class="tp-card">
    <div class="tp-head">
      <span class="tp-title">Team Pulse</span>
      <button class="tp-btn" data-script="refresh">Refresh</button>
    </div>
    <div class="tp-body">
      <svg class="tp-donut" viewBox="0 0 120 120" role="img"
           aria-label="Progress toward goal">
        <circle cx="60" cy="60" r="${R}" fill="none" stroke="#e2e8f0" stroke-width="12"/>
        ${
          progress > 0
            ? `<circle cx="60" cy="60" r="${R}" fill="none" stroke="#4f46e5"
                 stroke-width="12" stroke-linecap="round" transform="rotate(-90 60 60)"
                 stroke-dasharray="${C.toFixed(1)}"
                 stroke-dashoffset="${(C * (1 - progress)).toFixed(1)}"/>`
            : "" /* zero progress: omit the arc — a round cap would paint a dot */
        }
        <text x="60" y="60" font-size="24" font-weight="700" fill="#1e293b"
              text-anchor="middle" dominant-baseline="central">
          ${total === null ? "—" : esc(total)}
        </text>
      </svg>
      <p class="tp-note">
        ${total === null ? "Pick an object in the plugin settings." : `of a ${esc(goal)} goal`}
      </p>
    </div>
    ${refreshedAt ? `<p class="tp-stamp">Refreshed ${esc(new Date(refreshedAt).toLocaleTimeString())}</p>` : ""}
  </div>
`);
```

`src/blocks/teamPulse/eventScripts/refresh.js`

```js
this.setSessionData({ tpRefreshedAt: Date.now() });
this.runEventScript("render", { reason: "refresh" });
```

`src/blocks/teamPulse/styles.css`

```css
/* Engine-scoped at inject time — plain selectors are safe. */

/* The host gives no card chrome and clips at the dashlet edge (overflow: hidden).
 * Inset the card 4px so its shadow isn't clipped, and keep the shadow tight. */
.tp-card {
  margin: 4px;
  height: calc(100% - 8px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 14px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}

/* The host reset stamps font-size: 10px / line-height: 1 on every element —
 * every text element gets explicit px values. */
.tp-title { font-size: 14px; line-height: 20px; font-weight: 700; color: #1e293b; }
.tp-note  { font-size: 12px; line-height: 16px; color: #64748b; margin: 8px 0 0; }
.tp-stamp { font-size: 10px; line-height: 14px; color: #94a3b8; margin: auto 0 0; }

.tp-head { display: flex; align-items: center; justify-content: space-between; }
.tp-body { flex: 1; display: flex; flex-direction: column; align-items: center; min-height: 0; }
.tp-donut { width: 100%; max-width: 140px; height: auto; flex: 1; min-height: 0; }

/* data-script buttons contain text only — child elements swallow the click. */
.tp-btn {
  font-size: 12px;
  line-height: 16px;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: #4f46e5;
  color: #ffffff;
  cursor: pointer;
}
.tp-card--loading {
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 16px;
  color: #64748b;
}
```

---

## Gotchas

- **No host card chrome.** Plugin dashlets are transparent, borderless, radiusless, shadowless (unless the per-dashlet drop-shadow toggle is on), and clipped by `overflow: hidden`. Paint your own card and inset it (`margin: 4px; height: calc(100% - 8px)`) with a tight shadow, or your shadow gets clipped at the edge.
- **The 10px font reset.** Host CSS stamps `* { font-family; font-size: 10px; line-height: 1 }` onto every element. Set explicit px `font-size` and `line-height` everywhere; `em`/`rem` are useless. SVG `<text>` with px sizes inside a scaled `viewBox` is the escape hatch for chart labels.
- **`when`-disabled blocks vanish silently.** No error, no log — the block just disappears from pickers and placed dashlets show an unavailable message. Check the expression and its `{{config.key}}`/`{{userConfig.key}}` scoping (bare `{{key}}` is setup-assistant-internal syntax and won't resolve here).
- **Fresh worker per run.** No state on `this` or in closures survives between scripts. Persist through `sessionData` (memory-only, plugin-scoped, top-level shallow merge; your own write is invisible until the next run) or hidden inputs in the painted DOM.
- **Blocks get no record context objects.** Even on record pages, blocks run with the base worker context; `objectId`/`entityId` arrive as plain args and there is no `this.currentEntity()`. On dashboards/homepages there is no record at all — parse ids from `this.location` if you need them.
- **Args changes re-run the script.** Dashboard date/team filter changes create a new worker identity and re-execute your mount script. Keep it idempotent.
- **`runBlockScript` requires a mounted, same-plugin, same-page target** — otherwise it's a silent no-op. It hits *every* mounted instance of the target block.
- **The dashlet hover menu overlays your top-right corner.** Don't put critical controls there.
- **Zero-progress donut arcs paint a dot.** With `stroke-linecap: round`, omit the progress arc element entirely at zero.
- **`data-script` buttons: text only.** A `<span>`/`<svg>` child swallows the click (dispatch reads the exact hit-tested element — see [11](11-output-ui-iframes-frames.md#data-script-event-dispatch)).
- **Sizing constraints are re-derived every load.** Changing `min_w`/`max_h`/etc. in a new plugin version retroactively changes resize limits for already-placed dashlets.
