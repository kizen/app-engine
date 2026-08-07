# Route Scripts, Calendar Sources, Data Adornments & Object Settings Menu Items

What this covers: the four plugin surfaces that hook into existing Kizen pages rather than
rendering their own region — scripts that fire on record-page navigation (route scripts), scripts
that feed external events into the Kizen calendar (calendar sources), per-field quick actions on
record pages (data adornments), and entries in an object's settings menu (object settings menu
items). Each section is self-contained: declaration files, config fields, script contract, args,
constraints, and a complete runnable example.

See also: [manifest reference](03-manifest-reference.md) · [worker runtime API](04-worker-runtime-api.md) ·
[platform API](05-platform-api.md) · [auth, secrets & services](06-auth-secrets-services.md) ·
[views & modals](10-views-modals-forms.md) · [navigation & communication](14-navigation-and-communication.md) ·
[errors & observability](15-errors-and-observability.md).

## Surface comparison

| Surface | Declared where | Script kind | Context type | Typical use |
|---|---|---|---|---|
| Route scripts | `src/routeScripts/<dir>/` (`config.json` + `script.js`) | One script, auto-runs on record-page navigation | Record-detail worker (`entityId`, `objectId`, `currentEntity()`, full `this.*` API) | Gate or prepare record detail pages; log navigation; in-app redirects |
| Calendar sources | `src/calendarSources/<dir>/` (`config.json` + `calendars.js` + `events.js`) | Two data scripts returning schema-validated arrays | Calendar-source worker — base context with UI/record methods **disabled** (they throw) | Surface an external calendar's events inside the Kizen calendar |
| Data adornments | `src/dataAdornments/<dir>/` (`config.json` + `script.js`) | One script, runs when the user clicks the adornment icon | Record-detail worker (full record + modal API) | Per-field quick actions: click-to-dial, copy, scheduling, relative time |
| Object settings menu items | `src/objectSettingsItems/<dir>/` (`config.json` + `script.js`) | One script, runs when the user clicks the menu entry | Record-detail worker with `objectId` only (no entity context) | Object-level utilities: inspection, seeding, self-serve wiring tools |

All four run as ordinary worker scripts: a bare script body executed in a Web Worker with `this`
bound to the worker context — no DOM, no `import`, top-level `await` and top-level `return`
allowed. See [worker runtime API](04-worker-runtime-api.md) for the execution model.

## `when` gating on these surfaces

Calendar sources, data adornments, and object settings menu items all accept an optional `when`
field in their `config.json`: a JavaScript expression string evaluated against the plugin's
installed configuration. When it evaluates falsy, the artifact **silently disappears** from the UI
(no error, no placeholder).

- Placeholders: `{{config.<key>}}` reads the business setup-assistant config;
  `{{userConfig.<key>}}` reads the per-user setup-assistant config. Both scopes compose:
  `"Boolean({{config.x}}) && !{{userConfig.y}}"`.
- Placeholders are substituted with the JSON-serialized value before evaluation, so wrap in
  `Boolean(...)` for toggles and compare explicitly for other types:
  `"Boolean({{config.enableAdornments}})"`, `"{{config.mode}} === 'advanced'"`.
- Keys are the setup-assistant field keys, case-sensitive. Note this scoping differs from
  setup-assistant-internal `when` expressions, which use bare `{{key}}` — see
  [setup assistants](13-setup-assistants.md).
- Declaring any `when` anywhere in the plugin makes the host load the plugin's config before
  evaluating conditions (a packaged `block_loading_for_setup` flag) — expected behavior, not a bug.

**Route scripts are the exception: they have no `when` field.** The packager reads only `name`,
`api_name`, `hint_object_name`, and `routes` from a route script's `config.json`, and the runtime
route-script config carries no `when`. Scope a route script through its install-time object
binding and its `routes` regexes instead.

---

## Route scripts

A route script runs automatically when the user navigates to (or between) record detail pages of
one custom object. It is the only surface that can **block** page rendering until it finishes.

### Declaration & directory layout

```
src/routeScripts/<dirName>/
  config.json     # required
  script.js       # the script body
```

Only these two files are read. Route scripts have no `styles.css`, no `eventScripts/`, and render
no UI region of their own (they can still open toasts and modals through the worker API).

```json
{
  "name": "Details Tab Gate",
  "api_name": "details_gate",
  "hint_object_name": "client_client",
  "routes": ["/details"]
}
```

### `name` (route script)

| field | type | required | meaning |
|---|---|---|---|
| `name` | string | no | Display name shown wherever the host lists the plugin's route scripts. **Falls back to the directory name** when omitted — unlike `api_name`, the raw directory name is used verbatim, not sanitized. Set it anyway: `detailsGate` is not a label. |

### `api_name` (route script)

| field | type | required | meaning |
|---|---|---|---|
| `api_name` | string | no (defaults from directory name) | Stable identifier. The packager fallback lowercases the directory name, collapsing camelCase (`detailsGate` → `detailsgate`) while preserving underscores, so **always set it explicitly**. |

### `hint_object_name`

| field | type | required | meaning |
|---|---|---|---|
| `hint_object_name` | string | no | The api name of a custom object (e.g. `client_client` for Contacts) used to **pre-select** the object during install-time association. A hint only — the actual object binding is chosen at install time. |

### `routes`

| field | type | required | meaning |
|---|---|---|---|
| `routes` | string[] | no | List of **regular expressions tested against the pathname**. Empty array (or omitted) = the script fires on *every* record-detail page of the bound object. Non-empty = at least one regex must match (e.g. `["/details"]` fires only on the Details tab). |

### Install-time settings: `blocking` and the object binding

Two things route scripts need are deliberately **not** in `config.json` — they're configured when
a business installs and associates the plugin:

- **Object binding** — which custom object's record pages the script watches
  (`hint_object_name` only pre-selects it).
- **`blocking`** — whether the script holds page rendering (see below).

At runtime the resolved config the engine receives looks like:

```ts
interface RouteScriptConfig {
  id: string;
  api_name: string;
  name: string;
  blocking: boolean;                       // install-time choice
  routes?: string[];                       // authored regex list
  script: string;                          // authored script body
  custom_object: { id: string; name: string; object_name: string }; // install-time binding
}
```

### What routes fire a route script

The host watches every pathname change and runs a route script when the new pathname is a record
detail page of the script's bound object:

- **Contacts (client object)**: `/client/{entityId}/...`
- **Custom objects (standard and pipeline)**: `/custom-objects/{objectId}/{entityId}...`

plus, if `routes` is non-empty, at least one of its regexes matches the pathname. Navigating
between tabs of the same record is a pathname change and re-fires matching scripts. Each firing
spawns a **fresh worker** — nothing on `this` survives between runs (use
[`this.sessionData`](04-worker-runtime-api.md) for cross-run state).

### Script args and context

Route scripts run in the record-detail worker context, so the full record API is available
(`this.currentEntity()`, `this.currentObject()`, `this.getEntity(...)`, `this.refreshEntity()`,
modals, toasts, HTTP helpers — see [worker runtime API](04-worker-runtime-api.md)).

| on `this.args` / context | type | meaning |
|---|---|---|
| `this.args.previousRoute` | string | The in-app pathname the user came from. **Empty on a deep link or refresh** (there was no in-app page to come from). |
| `this.args.currentRoute` | string | The pathname that triggered the script. |
| `this.entityId` | string | The record id parsed from the route. |
| `this.objectId` | string | The object id (the bound object). |
| `this.args.pluginId` | string | Installed plugin app id (injected into every script). |
| `this.location` | object | Snapshot of the host window location (`pathname`, `search`, `hash`, …). |

The plugin's business config is available as `this.config` and per-user config as
`this.userConfig`, as on every surface.

### Blocking scripts and `this.releaseBlockingScript()`

When a route script's install-time `blocking` flag is true, the host **holds app rendering** for
the destination page until the script releases it. Two release paths:

1. **Automatic — the script settles.** The engine's wrapper releases the block when the script
   finishes, on normal return **and** on a thrown error alike (the cleanup runs unconditionally).
   You never need a guard call "in case the script fails"; only a script that never settles (e.g.
   an `await` that never resolves) hangs the page.
2. **Early — `this.releaseBlockingScript()`.** Call it as soon as the essential check is done so
   the page paints while non-essential trailing work continues.

```ts
this.releaseBlockingScript(): void
```

Route scripts are the **only** surface where this method is wired; calling it from any other
script kind is a no-op.

### Use cases

- **Navigation observers** — analytics, audit logging, warming caches for the record being opened.
- **Blocking gates** — verify a precondition (record state, external system status) before the
  page paints; release early, then finish slow work in the background.
- **In-app redirects** — there is no `redirect()`/`navigate()` method; use
  `this.openWindow(relativeUrl, "_self")`, which performs SPA navigation for a relative URL with a
  non-`_blank` target. See [navigation](14-navigation-and-communication.md).
- **Driving other surfaces** — e.g. `this.communicate.runFrameScript("dialer", "showForRecord", { entityId: this.entityId })`
  to point a floating frame at the record just opened.

### Constraints

- Fire only on **record detail pages of the bound object** — never on list pages, dashboards,
  settings, or plugin pages.
- One object binding per route script; watching two objects means declaring two route scripts.
- No `when` gating (see above).
- No UI region: output goes through toasts, modals, or other surfaces.
- A blocking script should do the minimum before releasing — every millisecond before release is
  a blank page for the user.

### Complete example — non-blocking observer

`src/routeScripts/routeChangeLogger/config.json`:

```json
{
  "name": "Route Change Logger",
  "api_name": "route_change_logger",
  "hint_object_name": "client_client",
  "routes": []
}
```

`src/routeScripts/routeChangeLogger/script.js`:

```js
// Non-blocking observer. Empty routes:[] means "every record-detail tab" of the
// bound object. The engine hands the navigation transition to this.args.

// previousRoute is empty on a direct link or refresh (no in-app page to come from).
const { previousRoute, currentRoute } = this.args;

const arrivedByInAppNav = Boolean(previousRoute);

// this.location mirrors window.location for the worker.
const { search, hash } = this.location;
const extras = [search, hash].filter(Boolean).join(" ");

const arrival = arrivedByInAppNav
  ? `navigated here from ${previousRoute}`
  : "opened this record directly (deep link or refresh)";

this.showToast(
  `Route script saw record ${this.entityId} on object ${this.objectId}: ${arrival}` +
    (extras ? ` — url extras: ${extras}` : "") +
    ` (now at ${currentRoute}).`,
  { variant: "alert" },
);
```

### Complete example — blocking gate with early release

`src/routeScripts/detailsGate/config.json`:

```json
{
  "name": "Details Tab Gate",
  "api_name": "details_gate",
  "hint_object_name": "client_client",
  "routes": ["/details"]
}
```

`src/routeScripts/detailsGate/script.js` (installed with `blocking: true`):

```js
// A blocking, route-filtered route script. routes: ["/details"] is a regex list
// tested against the pathname, so this fires on the Details tab only. Whether a
// route script blocks the render is set at install time, not in config.json.
//
// The engine auto-releases the block when the script settles (return or throw),
// so no call is needed to avoid a hang. releaseBlockingScript() here releases
// EARLY: the page paints after the essential check, then non-essential work
// continues while it's already visible.

// The gating check the page waits on.
const entity = await this.currentEntity();

// Essential check done — release so the page paints now.
this.releaseBlockingScript();

if (!entity) {
  return;
}

// Non-essential follow-up, after the release.
const [status, statusError] = await this.getWithErrors(
  this.getServiceUrl("status_service", `/records/${this.entityId}/status`),
);

this.showToast(
  statusError
    ? `Details gate cleared for record ${this.entityId}.`
    : `Details gate cleared for record ${this.entityId}. Status: ${status?.state ?? "unknown"}`,
  { variant: "success" },
);
```

---

## Calendar sources

A calendar source feeds events from an external system into the Kizen calendar. It has **two data
scripts** — one lists the calendars a user can enable, the other lists one calendar's events for a
date range. Both must `return` arrays matching a host-validated schema. Calendar scripts run
headless in a dedicated calendar-source worker whose UI and record methods are disabled.

### Declaration & directory layout

```
src/calendarSources/<dirName>/
  config.json     # { name, api_name, when? }
  calendars.js    # → calendars_script
  events.js       # → events_script
```

```json
{
  "name": "Example Calendar",
  "api_name": "example_calendar",
  "when": "Boolean({{userConfig.enableExternalCalendars}}) && Boolean({{config.enableExternalCalendars}})"
}
```

At runtime the engine consumes:

```ts
interface CalendarSourceConfig {
  name: string;
  calendars_script: string;   // calendars.js body
  events_script: string;      // events.js body
  when?: string;
}
```

### `name` (calendar source)

| field | type | required | meaning |
|---|---|---|---|
| `name` | string | yes | The source's display name in the calendar UI. Calendar sources are **sorted alphabetically by name** by the host — you cannot control ordering. |

### `api_name` (calendar source)

| field | type | required | meaning |
|---|---|---|---|
| `api_name` | string | no (defaults from directory name) | Stable identifier. Set it explicitly (the directory-name fallback lowercases, collapsing camelCase; underscores are preserved). |

### `when` (calendar source)

| field | type | required | meaning |
|---|---|---|---|
| `when` | string | no | Expression over `{{config.*}}` / `{{userConfig.*}}`; falsy hides the whole source from the calendar UI. Typical pattern: gate on a per-user toggle so each employee opts in (`"Boolean({{userConfig.enableExternalCalendars}})"`). |

### `calendars_script` contract (`calendars.js`)

Runs when the host builds the calendar picker (and re-runs via the host's query cache). Its job:
list the calendars the current user may enable.

**Args**: the plugin's business config (so `this.config` and `this.userConfig` work normally),
plus the standard injected keys (`pluginId`, user config). No `calendar` key.

**Return** (a top-level `return` of an array is required — the return value *is* the data):

```ts
type CalendarsResult = Array<{
  id: string;           // required — stable calendar id; passed back to events_script
  name: string;         // required — display name in the picker
  description?: string;
  default?: boolean;    // pre-selects this calendar in the picker
}>;
```

The host runs a schema check on the returned array — but **the check reports; it does not filter.**
Validation is wrapped in a `try`/`catch` that routes the failure to `onError` and then returns the
result unchanged, so a malformed entry is handed to the calendar UI exactly as your script produced
it. There is no rejection step and no quarantine: what you return is what renders.

Treat the schema as an alarm, not a guard. **Your script is the only filter**, so drop bad entries
before returning them rather than assuming the host will:

```js
// `raw` is the array your fetch produced — e.g. the vendor's calendar list:
const [raw] = await this.getWithErrors(
  this.getServiceUrl("example_service", "/calendars"),
);

const calendars = raw
  .filter((c) => c && typeof c.id === "string" && typeof c.name === "string")
  .map((c) => ({ id: c.id, name: c.name, description: c.description }));

return calendars;
```

### `events_script` contract (`events.js`)

Called **once per (enabled calendar, visible date range) pair**. Its job: return that calendar's
events inside the range.

**Args**: the plugin's business config plus:

```ts
this.args.calendar = {
  calendar_id: string;   // the id your calendars_script returned
  range_start: string;   // RFC 3339 with UTC offset, e.g. "2026-07-27T00:00:00-05:00"
  range_end: string;     // RFC 3339 with UTC offset
};
```

`range_start` / `range_end` are **day boundaries in the requesting user's timezone**, formatted
with the user's UTC offset. Pass them through to upstream APIs verbatim (URL-encoded) — do not
reparse or reformat them.

**Return** (schema-validated array):

```ts
type EventsResult = Array<{
  id: string;            // required — stable event id
  calendar_id: string;   // required — echo this.args.calendar.calendar_id
  title: string;         // required
  start_time: number;    // required — epoch MILLISECONDS
  end_time: number;      // required — epoch MILLISECONDS
  description?: string;
  url?: string;          // link out to the event in the external system
  activity_id?: string;  // links the event to a Kizen activity (see production lessons)
  all_day?: boolean;
  busy?: boolean;
}>;
```

`start_time` / `end_time` are **epoch-millisecond numbers**, not ISO strings.
[`this.formatDateForResponse(date)`](04-worker-runtime-api.md) is the sanctioned converter — it is
exactly `date.getTime()`.

Production sources also attach an `attendees` array of e-mail strings (attendees whose response
status is accepted, plus the organizer).

`attendees` is **not part of the engine's validated event schema** — the schema declares `id`,
`calendar_id`, `title`, `start_time` and `end_time` as required, and `description`, `url`,
`activity_id`, `all_day` and `busy` as optional. Nothing else is described.

That does not stop you emitting it. Because validation neither filters nor strips (see above), the
engine hands your event objects to the calendar UI verbatim, extra keys included. Treat `attendees`
as a convention some sources follow rather than a supported field: nothing validates its shape, and
nothing guarantees a given surface renders it.

### Error handling: 503 → auth error, everything else → `[]`

Two rules govern calendar-source failures:

1. **HTTP 503 from a proxied service call is treated as an authorization error for the source.**
   The Kizen service proxy returns 503 when the service's OAuth connection is missing or
   disconnected, and the engine classifies that as "this source needs re-authorization" rather
   than a data failure.

   **The detection happens at the network bridge, not in your script's error path.** The host
   installs a network-error hook that inspects every failed request the worker makes and flips the
   source's auth-error flag on a 503 — so it fires even when your script catches the error and
   returns `[]`. You cannot suppress the re-authorization prompt by swallowing the failure, and you
   do not need to re-raise it to trigger one.

2. **Degrade to an empty array for everything else.** On any other fetch or parse failure, log
   via `this.console.error(...)` and `return []` so the source shows "no events"/"no calendars"
   instead of tearing down the whole calendar. Never throw for expected upstream flakiness — a
   thrown error is reported as a *platform* problem (see
   [errors & observability](15-errors-and-observability.md)). Apply the same doctrine per-item:
   drop an unparseable event (log it) rather than failing the whole list.

### Unsupported context methods (they THROW)

The calendar-source worker is a data-only context. These methods are stubbed to **throw
`"...not supported in calendar source scripts"` at call time** (not at parse time — the script
runs fine until it hits the call):

- `this.uploadFile(...)`
- `this.installThirdPartyScript(...)`
- `this.refreshEntityForId()` / entity refresh
- `this.openCreateRecordModal(...)` / `this.openCreateRelatedRecordModal(...)`
- `this.showViewInModal(...)` / `this.closeModal(...)`

`this.prompt` / `this.dynamicPrompt` remain technically wired, but calendar scripts run headless
while the calendar renders — do not open UI from them. Everything else in the base worker API
(HTTP helpers, `getServiceUrl`, `console`, date helpers, session data) works normally — see
[worker runtime API](04-worker-runtime-api.md).

### Production lessons

- **All-day events & DST.** Detect all-day per provider (Google: `start.date` present and
  `start.dateTime` absent; Microsoft Graph: `event.isAllDay`). Parse the all-day *date* with
  [`this.createDateObject("YYYY-MM-DD")`](04-worker-runtime-api.md) — it builds a **local-midnight**
  `Date`, so a DST boundary can never shift the day. Parse timed events with
  `new Date(dateTime)` (the timestamp carries its own offset).
- **Timezone discipline.** Never hand-assemble timestamps without an offset. Graph quirk: a
  `dateTime` with no offset and `timeZone === "UTC"` must get a `Z` appended before parsing, or
  `new Date(...)` reads it as local time.
- **`activity_id` from iCalUID.** Events that Kizen itself synced into the external calendar carry
  an iCalUID of the form `"{activityId}--…"`. Split on `"--"` and populate `activity_id` so the
  Kizen calendar links the event back to its activity instead of showing a duplicate:
  `const activityId = event.iCalUID?.includes("--") ? event.iCalUID.split("--")[0] : undefined;`
- **User-assistant-driven calendar filtering.** Let each user pick which calendars appear via a
  user setup assistant (a boolean `enableAllCalendars` plus a multi-select of calendars), and
  filter inside `calendars.js`. Multi-select config values are `{label, value}` option objects —
  map `.value`.
- **Token refresh is entirely proxy-side.** For `oauth` services the script never sees, stores, or
  refreshes tokens — every request goes through `this.getServiceUrl(service, path)` and the
  backend proxy injects and refreshes credentials. There is no token code to write. Use a
  **user-level** service (`auth_level: "user"`) so each employee's own account backs their
  calendars. See [auth, secrets & services](06-auth-secrets-services.md).
- **`busy` mapping.** Providers model free/busy differently — Google: `transparency !== "transparent"`;
  Graph: `showAs !== "free"`. Filter out non-events (Google `eventType === "workingLocation"`,
  Graph `showAs === "workingElsewhere"`).
- **Pagination.** Follow the provider's paging token (`nextPageToken` etc.) in production; a busy
  calendar exceeds one page and unpaged results silently drop events.

### Complete example — a calendar source with both scripts

A source backed by the Google Calendar API through a user-level OAuth service declared as
`personal` in `kizen.json` `services[]` (see [auth, secrets & services](06-auth-secrets-services.md)).

`src/calendarSources/personal/config.json`:

```json
{
  "name": "Example Calendar",
  "api_name": "personal",
  "when": "Boolean({{userConfig.enableExternalCalendars}})"
}
```

`src/calendarSources/personal/calendars.js`:

```js
// Lists the calendars the current user can enable.
// Required per calendar: { id, name }. Optional: { description?, default? } (default pre-selects).

// Per-user filtering from the user setup assistant. Multi-select values are
// {label, value} option objects — map .value.
const allCalendarsEnabled = this.userConfig.enableAllCalendars ?? true;
const calendarFilterList =
  this.userConfig.enabledUserCalendars?.map((calendar) => calendar.value) || [];

const [data, errors] = await this.getWithErrors(
  this.getServiceUrl("personal", "/calendar/v3/users/me/calendarList"),
);

// Fetch failed: log for traceability and return an empty list so this source
// degrades to "no calendars" instead of tearing down the calendar.
if (errors) {
  const message =
    typeof errors === "string" ? errors : (errors?.message ?? JSON.stringify(errors));
  this.console.error(`Failed to list calendars: ${message}`);
  return [];
}

// Validate the external response at the boundary.
if (!Array.isArray(data?.items)) {
  this.console.error(
    `Failed to list calendars: unexpected response shape ${JSON.stringify(data)}`,
  );
  return [];
}

return data.items
  .map((calendar) => ({
    id: calendar.id,
    name: calendar.summary,
    description: calendar.description,
    default: calendar.primary || false,
  }))
  .filter(
    (calendar) => allCalendarsEnabled || calendarFilterList.includes(calendar.id),
  );
```

`src/calendarSources/personal/events.js`:

```js
// Lists one calendar's events for a date range. Called per (calendar, range) pair.
// this.args.calendar = { calendar_id, range_start, range_end } (RFC 3339 with offset).
//
// Return per event: required { id, calendar_id, title, start_time, end_time } —
// times are epoch ms; this.formatDateForResponse(date) is date.getTime().
// Optional: { description?, url?, activity_id?, all_day?, busy? }.

const { calendar_id, range_start, range_end } = this.args.calendar;

// Google flags all-day events with a `date` (not `dateTime`) on start/end.
const isAllDayEvent = (event) =>
  Boolean(
    !event.start.dateTime && !event.end.dateTime && event.start.date && event.end.date,
  );

// Parse all-day dates as local midnight (createDateObject) so a DST boundary can't
// shift the day; timed events carry their own offset in dateTime.
const parseEventBounds = (event) => {
  try {
    if (isAllDayEvent(event)) {
      return {
        startDate: this.createDateObject(event.start.date),
        endDate: this.createDateObject(event.end.date),
      };
    }
    return {
      startDate: new Date(event.start.dateTime),
      endDate: new Date(event.end.dateTime),
    };
  } catch (ex) {
    // Drop an unparseable event rather than failing the whole list.
    this.console.warn(`Skipping event ${event.id} with unparseable start/end`, event);
    return {};
  }
};

// A production source should also follow nextPageToken.
const [data, errors] = await this.getWithErrors(
  this.getServiceUrl(
    "personal",
    `/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events?timeMin=${encodeURIComponent(
      range_start,
    )}&timeMax=${encodeURIComponent(range_end)}&singleEvents=true`,
  ),
);

// Degrade to "no events" on failure (a proxy 503 also marks the source unauthorized).
if (errors) {
  const message =
    typeof errors === "string" ? errors : (errors?.message ?? JSON.stringify(errors));
  this.console.error(`Failed to list events for calendar ${calendar_id}: ${message}`);
  return [];
}

if (!Array.isArray(data?.items)) {
  this.console.error(
    `Failed to list events for calendar ${calendar_id}: unexpected response shape ${JSON.stringify(data)}`,
  );
  return [];
}

return data.items
  // Skip Google's workingLocation entries — not real events.
  .filter((event) => event.eventType !== "workingLocation")
  .map((event) => {
    const { startDate, endDate } = parseEventBounds(event);
    if (!startDate || !endDate) {
      return null;
    }

    // Kizen-synced events carry an iCalUID "{activityId}--…" — extract it to link
    // back to the activity; absent for events created directly in the provider.
    const activityId = event.iCalUID?.includes("--")
      ? event.iCalUID.split("--")[0]
      : undefined;

    return {
      id: event.id,
      calendar_id,
      activity_id: activityId,
      title: event.summary,
      description: event.description,
      start_time: this.formatDateForResponse(startDate),
      end_time: this.formatDateForResponse(endDate),
      all_day: isAllDayEvent(event),
      // Google represents free/busy as "transparency"; "transparent" means free.
      busy: event.transparency !== "transparent",
      url: event.htmlLink,
    };
  })
  .filter((event) => event !== null);
```

---

## Data adornments

A data adornment is a small icon button the host renders next to record fields of a given type.
Clicking it runs the adornment's script with the field's value and record context — the standard
way to add per-field quick actions like click-to-dial, copy, or scheduling.

### Declaration & directory layout

```
src/dataAdornments/<dirName>/
  config.json     # required — icon, color, tooltip, field_type, when?
  script.js       # runs on click
```

```json
{
  "icon": "phone",
  "color": "blue",
  "tooltip": "Phone Field Actions",
  "field_type": "phonenumber",
  "when": "Boolean({{config.enableAdornments}})"
}
```

Note there is **no `name` or `api_name`** — an adornment is identified by its plugin and
`field_type`. Its per-user config bucket (for `getUserConfig()`/`setUserConfig()`) is keyed
`{plugin_api_name}-{field_type}`.

The runtime shape the engine consumes:

```ts
interface DataAdornmentConfig {
  field_type: 'phonenumber' | 'date' | 'datetime';
  script: string;
  config: { icon: string; color: string; tooltip: string; customIcon?: string };
  when?: string;
}
```

### `field_type`

| field | type | required | meaning |
|---|---|---|---|
| `field_type` | `"phonenumber"` \| `"date"` \| `"datetime"` | yes | Which Kizen field type gets adorned. These three are the only supported values. Every field of that type on record detail pages (and inline table field cells) shows the adornment — you cannot target one specific field from config; branch on `this.args.fieldId` in the script if needed. |

### `icon`

| field | type | required | meaning |
|---|---|---|---|
| `icon` | string | yes (unless `customIcon`) | Icon name from the platform icon set — `npx --yes @kizenapps/cli icons` prints the authoritative list. |

### `color`

| field | type | required | meaning |
|---|---|---|---|
| `color` | string | yes | Icon color. Named CSS colors by convention (`"blue"`, `"green"`). |

### `tooltip`

| field | type | required | meaning |
|---|---|---|---|
| `tooltip` | string | yes | Hover tooltip on the icon button; also the row label when adornments collapse into the overflow menu. |

### `customIcon` / `customIconFile`

| field | type | required | meaning |
|---|---|---|---|
| `customIcon` | string | no | A `data:image/...` URL used instead of `icon`. Rendered at ≤14px — keep the artwork legible that small. `customIconFile` in `config.json` names an asset file in the artifact directory that the packager inlines as the data URL. |

### `when` (data adornment)

| field | type | required | meaning |
|---|---|---|---|
| `when` | string | no | Expression over `{{config.*}}` / `{{userConfig.*}}`; falsy removes the adornment everywhere. |

### Where adornments render

- **Record detail pages**: next to every field input whose type matches `field_type`, and in
  inline table field cells (e.g. phone numbers in related-record tables).
- **Only when the field has a value.** An empty field renders no adornment — your script can rely
  on `this.args.value` being non-empty.
- **One adornment on a field type** → a standalone icon button with a tooltip.
  **Multiple adornments on the same field type** (from any plugins) → a three-dot **"Field
  Actions" overflow menu** listing each adornment by tooltip. Design the icon and tooltip to work
  in both presentations.

### Args contract

```ts
this.args = {
  value: unknown;        // the field's current value — never null/empty (see shapes below)
  fieldId: string;
  fieldType: string;     // matches config field_type
  objectId: string;
  entityId: string;
  isActivity: boolean;   // true when the field belongs to an activity, not a record
  pluginId: string;      // standard injected key
  // ...plus the standard __kizen user-config injection
};
```

**`value` shapes are per `field_type`:**

| `field_type` | `this.args.value` |
|---|---|
| `phonenumber` | Raw phone string. Kizen serializes extensions with an `x` separator: `"+15555550123x123"`. |
| `date` | May arrive as a `{label}` option object (the only field type that does). |
| `datetime` | Always an **ISO 8601 string** (values cross the worker boundary as JSON). |

### Script capabilities

Adornment scripts run in the **record-detail worker** with the full action API:
`this.dynamicPrompt`, `this.showViewInModal`, `this.showToast`, `this.openWindow`,
`this.copyToClipboard`, proxied service requests via `this.getServiceUrl`, Kizen API calls,
`this.refreshEntity()` / `this.refreshTimeline()`, and cross-surface dispatch
(`this.communicate.runFrameScript(...)` — e.g. a 3-line adornment that tells a dialer floating
frame to dial `this.args.value`). See [worker runtime API](04-worker-runtime-api.md).

**The script's return value is discarded.** Adornments are fire-and-forget: to change the record,
write through the [platform API](05-platform-api.md) and call
[`this.refreshEntity()`](04-worker-runtime-api.md#thisrefreshentity) so the page repaints.

### Complete example — phone adornment

`src/dataAdornments/phoneAdornment/config.json`:

```json
{
  "icon": "phone",
  "color": "blue",
  "tooltip": "Phone Field Actions",
  "field_type": "phonenumber",
  "when": "Boolean({{config.enableAdornments}})"
}
```

`src/dataAdornments/phoneAdornment/script.js`:

```js
// Runs when the user clicks the phone icon next to any phonenumber field.
// The host discards this script's return value; act through side effects.

// `value` is the field's raw phone string. The host only renders an adornment
// when the field has a value.
const phoneValue = this.args.value;

const result = await this.dynamicPrompt({
  title: "Phone Field Actions",
  confirmButton: { label: "Run", variant: "standard" },
  cancelButton: { label: "Cancel", variant: "text" },
  size: "small",
  content: [
    {
      type: "description",
      widthPercent: 100,
      content: `Field value: ${phoneValue}`,
    },
    {
      type: "select",
      label: "Action",
      key: "action",
      required: true,
      placeholder: "Choose an action",
      widthPercent: 100,
      options: [
        { label: "Call number", value: "call" },
        { label: "Copy to clipboard", value: "copy" },
      ],
    },
  ],
});

if (result.canceled) {
  return;
}

// A select returns the whole selected option ({label, value}), never the bare value.
const action = result.values.action.value;

if (action === "call") {
  // Kizen phone fields append any extension after an "x" separator
  // (e.g. "+15555550123x123"). Split that off first — sanitizing the whole string
  // in one pass would delete the "x" and silently fuse the extension onto the
  // number. The extension rides along as RFC 3966's ";ext=" suffix.
  const [mainPart, extPart = ""] = phoneValue.toLowerCase().split("x", 2);
  const digits = mainPart.replace(/[^\d+]/g, "");
  const extension = extPart.replace(/\D/g, "");

  this.openWindow(`tel:${digits}${extension ? `;ext=${extension}` : ""}`);
  return;
}

if (action === "copy") {
  this.copyToClipboard(phoneValue);
  this.showToast("Phone number copied to clipboard.", { variant: "success" });
}
```

A minimal cross-surface variant — an adornment that drives a dialer floating frame:

```js
// src/dataAdornments/dial/script.js
this.communicate.runFrameScript("dialer", "dialNumber", {
  phoneNumber: this.args.value,
});
```

---

## Object settings menu items

An object settings menu item adds an entry to the settings (gear) dropdown on an object's records
list page. Clicking it runs a script with the object's context — no record, no UI region.

### Declaration & directory layout

```
src/objectSettingsItems/<dirName>/
  config.json     # { label, api_name?, when? }
  script.js       # runs on click
```

Only these two files are read — no `styles.css`, no `eventScripts/`, and no icon, color, order, or
args options. **Naming split to know**: the source directory is `objectSettingsItems/`, but the
packaged artifact/backend field is `object_settings_menu_items`.

```json
{
  "label": "Inspect Object",
  "api_name": "inspect_object",
  "when": "Boolean({{config.enableObjectSettingsItem}})"
}
```

The runtime shape the engine consumes:

```ts
interface ObjectSettingsMenuItemConfig {
  api_name: string;
  label: string;
  script: string;
  when?: string;
}
```

### `label`

| field | type | required | meaning |
|---|---|---|---|
| `label` | string | yes | Menu entry text. The host **sorts plugin items alphabetically by label** — ordering is not configurable. |

### `api_name` (object settings menu item)

| field | type | required | meaning |
|---|---|---|---|
| `api_name` | string | no (defaults from directory name) | Stable identifier; set it explicitly. |

### `when` (object settings menu item)

| field | type | required | meaning |
|---|---|---|---|
| `when` | string | no | The item's **single visibility gate**: shown iff the expression evaluates truthy (empty/omitted = always shown). Expression over `{{config.*}}` / `{{userConfig.*}}`. |

### Where they appear

In the settings gear dropdown on **custom-object records list pages and the Contacts page**,
appended after the built-in entries (Object Settings / Customize Fields / Object History / View
API Docs). The item appears for every object the user can view — the script receives whichever
object's page it was clicked on; branch on the object in the script if the tool only applies to
some objects.

### Script contract

Runs in the **record-detail worker with object context only**:

| context | value |
|---|---|
| `this.objectId` | The object whose settings menu was used. |
| `this.entityId` | Empty string — there is no current record. `this.currentEntity()` resolves `undefined`; never depend on an entity. |
| `await this.currentObject()` | Works — `GET /custom-objects/{objectId}/detail`. |
| return value | **Discarded.** Act through side effects (toasts, modals, API writes, `communicate.*`). |

`this.currentObject()` reliably includes: `id`, `object_type` (`'standard'` \| `'pipeline'`),
`entity_name`, `object_name`, `name`, `is_custom`, `description`, `fetch_url`,
`related_objects[]`, and `field_categories[]` / `fields[]` (each field: `id`, `name`,
`display_name`, `field_type`, `order`). `owner`, `access`, and `record_layouts` can be `null` —
guard those only.

Everything else in the record-detail worker API is available: modals (`dynamicPrompt`,
`showViewInModal`), toasts, HTTP helpers, services, cross-surface dispatch. Typical uses:
object-level inspection/reporting, seeding or migrating data for the object, self-serve wiring
tools (e.g. creating an action association), or pre-seeding another surface
(`this.communicate.runFrameScript("chat", "sendUserMessage", { message })`).

### Complete example — inspect the current object

`src/objectSettingsItems/inspectObject/config.json`:

```json
{
  "label": "Inspect Object",
  "api_name": "inspect_object",
  "when": "Boolean({{config.enableObjectSettingsItem}})"
}
```

`src/objectSettingsItems/inspectObject/script.js`:

```js
// Appears in the settings dropdown on an object's records list page. Runs in the
// record-detail worker with an OBJECT context only: this.objectId is set,
// this.entityId is empty, so currentObject() works but currentEntity() is
// undefined. The return value is discarded; act through side effects.

const object = await this.currentObject();

if (!object) {
  return;
}

// Object detail always carries object_name/entity_name/object_type plus
// fields/related_objects.
const fieldCount = object.fields.length;
const relatedCount = object.related_objects.length;

this.console.log("Inspected object:", object);

this.showToast(
  `${object.object_name} (record: "${object.entity_name}") — ${object.object_type}, ` +
    `${fieldCount} field(s), ${relatedCount} related object(s).`,
  { variant: "success", autohide: false },
);
```

---

## Gotchas

**Route scripts**

- `blocking` and the object binding are **install-time settings**, not `config.json` fields —
  `hint_object_name` only pre-selects the object.
- The block **always** releases when the script settles — normal return and thrown error alike.
  `this.releaseBlockingScript()` is only for releasing *early*; using it as a hang-guard is
  redundant. Only a never-settling script hangs the page.
- `previousRoute` is empty on a deep link or refresh — don't assume in-app navigation.
- Route scripts have **no `when` field** — the only surface here without config gating.
- There is no `navigate()`/`redirect()` method; in-app redirect =
  `this.openWindow(relativeUrl, "_self")`.

**Calendar sources**

- `start_time`/`end_time` are **epoch-millisecond numbers** — an ISO string fails schema
  validation. `this.formatDateForResponse(date)` is the converter.
- Both scripts must **`return`** their arrays (top-level `return`); the return value is the data.
- Degrade to `[]` on failure — a thrown error is triaged as a platform problem; an empty array is
  "no events". A proxy **503 means the OAuth connection is disconnected** and flags the source as
  unauthorized.
- The blocked context methods (`uploadFile`, `showViewInModal`, `closeModal`,
  `openCreateRecordModal`, `openCreateRelatedRecordModal`, `installThirdPartyScript`,
  `refreshEntity`) **throw at call time**, not parse time — a code path you didn't test can still
  crash the script.
- Parse all-day dates with `this.createDateObject(...)` (local midnight, DST-safe); parse timed
  events with `new Date(dateTime)`. Appending/assuming UTC on all-day dates shifts them a day for
  half the world.
- Extract `activity_id` from iCalUID (`"{activityId}--…"`) or Kizen-synced events show up twice.
- Sources without pagination silently drop events on busy calendars.

**Data adornments**

- The script's **return value is discarded** — change records via the API +
  `this.refreshEntity()`.
- The adornment renders **only when the field has a value**; `this.args.value` is never
  null/empty.
- Phone extensions ride after an `x` (`"+15555550123x123"`) — a naive
  `replace(/[^\d+]/g, "")` fuses the extension onto the number. Split on the first `x`, emit RFC
  3966 `;ext=`.
- `value` shape varies by `field_type`: `datetime` is always an ISO string; only `date` can hand
  you a `{label}` option object.
- Multiple adornments on one field type collapse into a three-dot overflow menu — the `tooltip`
  becomes the menu label, so write it as an action ("Call this number"), not a noun.
- No `name`/`api_name` in config: one adornment per `(plugin, field_type)` identity; its user
  config bucket is keyed `{plugin_api_name}-{field_type}`.

**Object settings menu items**

- `this.entityId` is empty and `this.currentEntity()` is `undefined` — object context only.
- Source directory `objectSettingsItems/` vs packaged field `object_settings_menu_items` — don't
  let the mismatch derail searches.
- Items are sorted alphabetically by `label`; ordering is not configurable.
- Return value discarded — act through side effects.

**Shared**

- A falsy `when` makes an artifact **silently disappear** — no error, no placeholder. When "my
  surface is missing," check the `when` expression and its config keys (case-sensitive) first.
- Artifact `when` uses `{{config.key}}` / `{{userConfig.key}}` scoping — bare `{{key}}` (the
  setup-assistant-internal form) silently never matches here.
- Always set `api_name` explicitly where the surface supports it: the directory-name fallback
  lowercases, collapsing camelCase (`detailsGate` → `detailsgate`); underscores are preserved.
