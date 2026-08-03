# Kitchen Sink v1.0.0

Exercises every surface the Kizen plugin engine supports: actions, Python automation steps, floating frames, pages, blocks, toolbar items, data adornments, object settings items, calendar sources, route scripts, views, and both setup assistants.

Built for two audiences. QA installs it to smoke-test engine changes across every surface, including deliberate failure paths. External developers read it as a working, commented reference for each capability.

Installation requires the developer program entitlement.

## Configuration (`kizen.json`)

```json
{
  "name": "Kitchen Sink",
  "version": "1.0.0",
  "published": true,
  "api_name": "kitchen_sink",
  "external_link": "https://developer.kizen.com",
  "description": "Exercises every surface the Kizen plugin engine supports: actions, Python automation steps, floating frames, pages, blocks, toolbar items, data adornments, object settings items, calendar sources, route scripts, views, and both setup assistants.\n\nBuilt for two audiences. QA installs it to smoke-test engine changes across every surface, including deliberate failure paths. External developers read it as a working, commented reference for each capability.\n\nInstallation requires the developer program entitlement.",
  "entry": "src/",
  "engine": "1.0.0",
  "release_notes_directory": "releaseNotes/",
  "release_branches": [
    "main"
  ],
  "release_environments": [
    "dev",
    "prod"
  ],
  "required_entitlement": "developer_program_member",
  "config_template": {},
  "base_config": {
    "secrets": [
      "api_key"
    ]
  },
  "services": [
    {
      "service_name": "google_user",
      "display_name": "Google (per user)",
      "auth_type": "oauth",
      "auth_level": "user",
      "required_entitlement": null,
      "base_service_url": "https://www.googleapis.com",
      "auth_credentials": {
        "client_id": "*****",
        "client_secret": "*****",
        "scopes": "*****",
        "authorize_url": "*****",
        "token_url": "*****",
        "content_type": "*****",
        "token_field_name": "*****",
        "default_token_expiry": "*****",
        "authorize_params": "*****"
      }
    },
    {
      "service_name": "google_business",
      "display_name": "Google (business-wide)",
      "auth_type": "oauth",
      "auth_level": "business",
      "required_entitlement": null,
      "base_service_url": "https://www.googleapis.com",
      "auth_credentials": {
        "client_id": "*****",
        "client_secret": "*****",
        "scopes": "*****",
        "authorize_url": "*****",
        "token_url": "*****",
        "content_type": "*****",
        "token_field_name": "*****",
        "default_token_expiry": "*****",
        "authorize_params": "*****"
      }
    },
    {
      "service_name": "echo_basic",
      "display_name": "Header Echo (basic token)",
      "auth_type": "basic_auth_token_provided",
      "auth_level": "global",
      "required_entitlement": null,
      "base_service_url": "https://hypothesis.sh/api/httptest",
      "auth_credentials": {
        "integration_secret_api_name": "*****"
      }
    },
    {
      "service_name": "dad_jokes",
      "display_name": "Dad Jokes (no auth)",
      "auth_type": "no_auth",
      "required_entitlement": null,
      "base_service_url": "https://icanhazdadjoke.com"
    }
  ]
}
```

## File Tree

```
├── releaseNotes/
│   └── 1.0.0.md
├── src/
│   ├── actions/
│   │   ├── dadJokeWriteback/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   ├── failureModes/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   ├── performActionDemo/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   ├── recordDataExplorer/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   ├── recordLifecycle/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   ├── relatedRecordContext/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   └── relationshipAddOverride/
│   │       ├── config.json
│   │       └── script.js
│   ├── automationSteps/
│   │   ├── allTypesRoundTrip/
│   │   │   ├── config.json
│   │   │   └── script.py
│   │   ├── dadJoke/
│   │   │   ├── config.json
│   │   │   └── script.py
│   │   ├── failOnPurpose/
│   │   │   ├── config.json
│   │   │   └── script.py
│   │   └── secretApiCall/
│   │       ├── config.json
│   │       └── script.py
│   ├── blocks/
│   │   ├── chartGroupBlock/
│   │   │   ├── eventScripts/
│   │   │   │   └── logContext.js
│   │   │   ├── config.json
│   │   │   ├── script.js
│   │   │   └── styles.css
│   │   ├── dashboardBlock/
│   │   │   ├── eventScripts/
│   │   │   │   ├── chain.js
│   │   │   │   ├── logContext.js
│   │   │   │   ├── refresh.js
│   │   │   │   └── simulateLoading.js
│   │   │   ├── config.json
│   │   │   ├── script.js
│   │   │   └── styles.css
│   │   ├── homepageBlock/
│   │   │   ├── eventScripts/
│   │   │   │   └── openView.js
│   │   │   ├── config.json
│   │   │   ├── script.js
│   │   │   └── styles.css
│   │   ├── pingBlock/
│   │   │   ├── eventScripts/
│   │   │   │   ├── receive.js
│   │   │   │   └── serve.js
│   │   │   ├── config.json
│   │   │   ├── script.js
│   │   │   └── styles.css
│   │   ├── pongBlock/
│   │   │   ├── eventScripts/
│   │   │   │   ├── receive.js
│   │   │   │   └── serve.js
│   │   │   ├── config.json
│   │   │   ├── script.js
│   │   │   └── styles.css
│   │   └── recordBlock/
│   │       ├── config.json
│   │       ├── script.js
│   │       └── styles.css
│   ├── calendarSources/
│   │   └── demo/
│   │       ├── calendars.js
│   │       ├── config.json
│   │       └── events.js
│   ├── dataAdornments/
│   │   ├── datetimeAdornment/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   └── phoneAdornment/
│   │       ├── config.json
│   │       └── script.js
│   ├── floatingFrames/
│   │   ├── iframeBridge/
│   │   │   ├── eventScripts/
│   │   │   │   └── notifyReceived.js
│   │   │   ├── config.json
│   │   │   ├── message.js
│   │   │   ├── script.js
│   │   │   └── trigger.svg
│   │   ├── iframeScoped/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   └── scriptWidget/
│   │       ├── eventScripts/
│   │       │   ├── collapse.js
│   │       │   ├── expand.js
│   │       │   ├── fetchJoke.js
│   │       │   ├── hide.js
│   │       │   ├── hideHeader.js
│   │       │   └── showHeader.js
│   │       ├── config.json
│   │       ├── script.js
│   │       └── styles.css
│   ├── objectSettingsItems/
│   │   └── inspectObject/
│   │       ├── config.json
│   │       └── script.js
│   ├── pages/
│   │   └── appPage/
│   │       ├── eventScripts/
│   │       │   ├── authorizeGoogle.js
│   │       │   └── greet.js
│   │       ├── config.json
│   │       ├── script.js
│   │       └── styles.css
│   ├── routeScripts/
│   │   ├── detailsGate/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   └── routeChangeLogger/
│   │       ├── config.json
│   │       └── script.js
│   ├── setupAssistant/
│   │   ├── googleCalendar/
│   │   │   ├── getFetchUrl.js
│   │   │   └── optionMapper.js
│   │   ├── googleCalendarEvents/
│   │   │   ├── getFetchUrl.js
│   │   │   └── optionMapper.js
│   │   └── assistant.json
│   ├── toolbarItems/
│   │   ├── authorizeService/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   ├── contextDump/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   ├── dataOut/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   ├── dynamicPromptTour/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   ├── modalLauncher/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   └── userConfigEditor/
│   │       ├── config.json
│   │       └── script.js
│   ├── userSetupAssistant/
│   │   ├── userGoogleCalendars/
│   │   │   ├── getFetchUrl.js
│   │   │   └── optionMapper.js
│   │   └── assistant.json
│   ├── views/
│   │   ├── formView/
│   │   │   ├── script.js
│   │   │   └── styles.css
│   │   ├── framelessView/
│   │   │   ├── eventScripts/
│   │   │   │   ├── cancel.js
│   │   │   │   └── submit.js
│   │   │   ├── script.js
│   │   │   └── styles.css
│   │   └── summaryView/
│   │       ├── script.js
│   │       └── styles.css
│   └── thumbnail.png
├── .gitignore
└── README.md
```

## Files

### `.gitignore`

```
.DS_Store
.kizenapp/
__pycache__/
*.pyc

```

### `README.md`

```markdown
# Kitchen Sink

A Kizen plugin that exercises every surface the plugin engine supports. It serves two
audiences:

- **QA** installs it once and can smoke-test every engine surface, including deliberate
  failure paths.
- **Plugin developers** can read it as a working, commented reference for each capability.
  Every artifact's comments document the engine contract it relies on — argument shapes,
  return-value rules, and the gotchas that aren't obvious from a first read.

Installation requires the developer program entitlement (`required_entitlement` in
kizen.json), so it only appears in businesses enrolled in the developer program.

## Repository layout

Each surface is a directory under `src/`, and each artifact is a directory inside it.
The common conventions:

- `config.json` declares the artifact (name, api_name, and per-surface options).
- `script.js` / `script.py` is the main script.
- `eventScripts/<name>.js` are handlers dispatched from `data-script="<name>"` attributes
  in rendered markup.
- `styles.css` is the artifact's stylesheet; the engine scopes it to the artifact's own
  markup at inject time, so plain selectors are safe.

JavaScript surfaces run in web workers with no DOM access. UI is painted with
`this.outputUI(markup)` or embedded with `this.outputIframe(url)`, and all interactivity
flows through `data-script` attributes — there is no `addEventListener`.

## Setup

1. **Install** the plugin from the marketplace (requires the developer program entitlement).
2. **Secret**: set the `api_key` integration secret. Any value works — it feeds the
   `echo_basic` service and the `secretApiCall` automation step, both of which call
   httptest (hypothesis.sh/api/httptest), which just echoes the resulting Authorization header back.
3. **Google OAuth**: the `google_user` and `google_business` services declare encrypted
   client credentials. The committed values are placeholders; the OAuth-dependent surfaces
   (authorize flows, calendar source, async selects) only work once real credentials are
   encrypted for this plugin and published.
4. **Setup assistant**: the business setup assistant saves the install config. Its feature
   toggles gate several surfaces (`enableFloatingFrames`, `enableAdornments`,
   `enableObjectSettingsItem`, `enableContextDump`, `enableBlocks`) via `when` conditions,
   so you can watch artifacts appear and disappear without code changes.

## Surfaces

### kizen.json — services and manifest

Declares four services, one per auth shape:

| Service           | auth_type                 | auth_level | Consumed by                                                                             |
| ----------------- | ------------------------- | ---------- | --------------------------------------------------------------------------------------- |
| `google_user`     | oauth                     | user       | authorizeService toolbar item, app page, user setup assistant                           |
| `google_business` | oauth                     | business   | calendar source, setup assistant async selects                                          |
| `echo_basic`      | basic_auth_token_provided | global     | performActionDemo action                                                                |
| `dad_jokes`       | no_auth                   | —          | dadJokeWriteback and failureModes actions, detailsGate route script, scriptWidget frame |

Also demonstrates `base_config.secrets`, top-level `required_entitlement`, and an install
config sourced entirely from the setup assistant (`config_template` is empty).

### Actions (`src/actions/`)

Scripts that run with record context from a record's action menu (or one of the override
surfaces below):

- **dadJokeWriteback** — record writeback: the overwrite shape (`{name, value}`) and the
  append shape (`{name, add_values}`), plus calling an external API through the service
  proxy with `this.getServiceUrl()`.
- **relationshipAddOverride** — replaces the standard "Add Record" modal on a relationship
  field. Documents the return-value contract: return the new record's id as a non-empty
  string, or undefined to do nothing.
- **performActionDemo** — the "Perform Action" menu surface, plus a
  `basic_auth_token_provided` service where the proxy injects the Authorization header
  server-side and the script never touches the secret.
- **failureModes** — always fails, in the mode you pick: handled service failure, handled
  Kizen API failure, or an uncaught exception.

### Automation steps (`src/automationSteps/`, Python)

Code steps a workflow author drops into an automation:

- **allTypesRoundTrip** — one input and output per supported `data_type` (all 10), logging
  the Python type each value deserializes to and passing it through unchanged.
- **secretApiCall** — reads the namespaced `api_key` secret, builds a Basic auth header,
  and demonstrates 429 retry with exponential backoff and Retry-After handling.
- **dadJoke** — the simplest possible step: one GET, one output.
- **failOnPurpose** — always fails: plain exception, unhandled HTTP error, or timeout.

Python steps call external APIs directly with `requests` — they have no access to the
`services[]` abstraction or the engine proxy. That's a JavaScript-surface capability.

### Blocks (`src/blocks/`)

Plugin-provided dashlets, one per block type plus a communication demo:

- **dashboardBlock** — the fully-specified reference: sizing config, `when` gating, styles,
  and event scripts that repaint in place and log the worker context.
- **homepageBlock** — opens one of this plugin's views with `showViewInModal` and reads the
  submitted form values back.
- **chartGroupBlock** — reads install config (`this.config.contextValue`) into its markup.
- **recordBlock** — minimal config, documenting the packager defaults.
- **pingBlock / pongBlock** — cross-block dispatch with
  `this.communicate.runBlockScript()`: place both on the same page and volley between them.
  Also demonstrates `sessionData` for state that survives remounts.

### Calendar source (`src/calendarSources/demo/`)

`calendars.js` lists Google calendars, `events.js` lists one calendar's events for a
requested range — both through the `google_business` service. Documents the host's
validated return schemas, all-day event detection, and the `activity_id` linkage for
events created by Kizen's own calendar sync.

### Data adornments (`src/dataAdornments/`)

Small icons the host renders next to matching field types on record detail pages:

- **phoneAdornment** (`field_type: "phonenumber"`) — logs the full args contract, then
  offers call (`tel:` with RFC 3966 extension handling) or copy-to-clipboard.
- **datetimeAdornment** (`field_type: "datetime"`) — parses the field value and shows a
  relative-time toast with the business timezone.

Adornment scripts run in the same worker as actions, and their return values are
discarded — to change the record, write through the API and call `refreshEntity()`.

### Floating frames (`src/floatingFrames/`)

Persistent, minimizable widgets anchored to a corner of the app:

- **scriptWidget** — a script-rendered frame (`outputUI`) with buttons for every
  frame-only context method: `hide`, `collapse`, `expand`, `hideHeader`, `showHeader`. The
  only `bottom-left-fixed` frame, which is why it demos `hideHeader`/`showHeader` (honored
  only on fixed frames). Fixed forces `minimized_style: "circle"` — the engine anchors a
  fixed frame to its minimized circle trigger, so a `bar`-style fixed frame would never
  reposition on resize — and its `minimized_config` sets the circle via a platform icon
  name (`window-restore`).
- **iframeScoped** — embeds an external page with an origin-scoped `allow` grant, and
  documents how permission delegation flows through the iframe proxy. Uses
  `minimized_style: "bar"`, valid here because it is non-fixed (`bottom-right`).
- **iframeBridge** — the two-way postMessage bridge: `message.js` receives what the framed
  page posts, relays it to an event script, and acks back down into the frame. Its
  `minimized_config` sets the circle from a bundled `customIconFile` instead of a platform
  icon name.

### Object settings items (`src/objectSettingsItems/`)

Entries added to an object's settings menu:

- **inspectObject** — an entry in the settings-gear dropdown on an object's Records page.
  Runs with object context only (no current record) and acts through side effects; its
  return value is discarded.

### Pages (`src/pages/appPage/`)

A routable full-page app page at `/plugins/kitchen_sink/app_page`, also exposed as a
toolbar entry (`is_toolbar_item`). Demonstrates query args on `this.args`, form and button
event scripts, and starting a user-level OAuth flow: `eventScripts/authorizeGoogle.js` calls
`this.authorize()`, which opens the flow in a new tab; the outcome shows on the plugin's
marketplace Authorization panel. (Page `callback.js` handlers are out of scope for this
plugin — they belong to iframe-embedded flows that end at `/plugins/callback`.)

### Route scripts (`src/routeScripts/`)

Scripts that run on navigation to a record detail page of the bound object:

- **routeChangeLogger** — the observer: empty `routes` (every detail tab), non-blocking,
  logs the navigation context (`previousRoute`, `currentRoute`, `this.location`).
- **detailsGate** — the gate: `routes: ["/details"]`, meant to be installed blocking.
  Demonstrates `releaseBlockingScript()` as an early release so the page paints before
  non-essential follow-up work finishes.

### Setup assistant (`src/setupAssistant/`)

`assistant.json` demonstrates every field type — descriptions (markdown and HTML),
containers, booleans, text with `validation_pattern`, number, single/multi selects, object
and field pickers, image, QR, and link — plus conditional visibility (`when`), a service
prerequisite step, and action association. The `googleCalendar` / `googleCalendarEvents`
directories back two async selects: options fetched live through the service proxy, with
`autoSelect` and `dependencies` behavior.

### User setup assistant (`src/userSetupAssistant/`)

The per-user counterpart: each user answers for themselves, and scripts read the values
from `this.userConfig`. Includes a `google_user` prerequisite and an async select that
fetches with the current user's token.

### Toolbar items (`src/toolbarItems/`)

Global toolbar entries that run a script on click:

- **modalLauncher** — the `showViewInModal` tour: framed vs. frameless modals, all three
  sizes, and chaining one modal's result into the next.
- **dynamicPromptTour** — every `dynamicPrompt` input type and the exact result shape each
  one returns.
- **authorizeService** — starts the `google_user` OAuth flow with `this.authorize()`.
- **contextDump** — logs everything a base worker context can see, and demonstrates `when`
  gating from install config.

### Views (`src/views/`)

Modal content opened with `showViewInModal` from any worker context:

- **formView** — a framed form: host chrome renders the buttons, runs native form
  validation, and collects the (array-wrapped) form data itself. No event scripts needed.
- **framelessView** — the opposite: the view owns its chrome and closes its own modal with
  `closeModal` from submit/cancel event scripts.
- **summaryView** — display-only; receives another modal's form data through `args` and
  renders raw vs. display values so the array-wrapping is visible.

## Failure paths

Negative-path coverage is deliberate and spread across surfaces: the **failureModes**
action (three JS failure modes), the **failOnPurpose** automation step (three Python
failure modes), and **secretApiCall**'s always-429 first call (retry exhaustion). Each one
documents how its failure surfaces in the UI or run history.

```

### `releaseNotes/1.0.0.md`

```markdown
Initial release of Kitchen Sink.

Kitchen Sink is a working reference for every surface the Kizen plugin engine supports. Each artifact demonstrates one capability or a small collection of capabilities that work together.

This version ships artifacts across all supported surfaces:

- Actions (record writeback, relationship add override, Perform Action menu)
- Python automation steps, including a round-trip of all data types and secret access with retry handling
- Blocks for dashboards, homepages, chart groups, and record pages, plus a cross-block communication demo
- A Google-backed calendar source
- Data adornments for phone and datetime fields
- Floating frames: script-rendered, origin-scoped iframe, and a two-way postMessage bridge
- An object settings item, a routable app page, and route scripts (one observer, one blocking gate)
- Toolbar items covering modals, dynamic prompts, service authorization, and a full context dump
- Framed, frameless, and display-only modal views
- Business and per-user setup assistants exercising every field type

Failure paths are deliberate: the failureModes action, the failOnPurpose automation step, and secretApiCall's retry exhaustion each show how an error surfaces in the UI or run history.

Installation requires the Kizen business to be a member of the developer program.

```

### `src/actions/dadJokeWriteback/config.json`

```json
{
  "name": "Dad Joke Writeback",
  "api_name": "dad_joke_writeback",
  "hint_object_name": "client_client"
}

```

### `src/actions/dadJokeWriteback/script.js`

```javascript
// Kitchen Sink App · Action · Dad Joke Writeback

// Fetches a dad joke via the api service configured for the app, and writes it back to the current record.

// Normalize a *WithErrors error (string | Error | object) so a toast never shows "[object Object]".
const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

const [jokeResponse, jokeError] = await this.getWithErrors(
  this.getServiceUrl("dad_jokes", "/"),
);

if (jokeError) {
  this.showToast(`Could not fetch a dad joke: ${describeError(jokeError)}`, {
    variant: "failure",
    autohide: false,
  });

  return;
}

const joke = jokeResponse?.joke ?? JSON.stringify(jokeResponse);

// The context gives the current object id and record (entity) id.
const [, patchError] = await this.patchWithErrors(
  `/records/${this.objectId}/${this.entityId}`,
  {
    fields: [
      // Overwrite: replaces whatever "target" currently holds.
      { name: "target", value: joke },
      // Append: adds to a multi-value field instead of replacing it.
      { name: "joke_log", add_values: [joke] },
    ],
  },
);

if (patchError) {
  this.showToast(
    `Fetched a joke but failed to save it: ${describeError(patchError)}`,
    {
      variant: "failure",
      autohide: false,
    },
  );
  return;
}

this.showToast("Wrote a fresh dad joke to this record.", {
  variant: "success",
});

// Refresh the entity page in the UI so the updated field value shows.
this.refreshEntity();

```

### `src/actions/failureModes/config.json`

```json
{
  "name": "Failure Modes Demo",
  "api_name": "failure_modes_demo",
  "hint_object_name": "client_client"
}

```

### `src/actions/failureModes/script.js`

```javascript
// Kitchen Sink App · Action · Failure Modes
//
// Always fails in the chosen mode to show how each kind of action failure surfaces in
// the UI:
//   service_error       — a handled failure calling an external service through the proxy
//                         (getWithErrors), surfaced as a sticky failure toast (autohide: false)
//   kizen_error         — a handled failure calling Kizen's own API (not an external service)
//   on_error            — a handled error reported via this.onError() without throwing; sits
//                         between a toast you compose yourself and a raw uncaught throw
//   uncaught_exception  — an unhandled JS exception, thrown with no try/catch around it, so
//                         you can see how the host surfaces a raw script crash
// (If a deliberately-failing endpoint ever succeeds instead, the script says so with a
// success toast rather than pretending it failed.)
//
// To try it: associate this action with any object and run it from a record's action menu.

const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

const result = await this.dynamicPrompt({
  title: "Failure Modes Demo",
  confirmButton: { label: "Run", variant: "standard" },
  cancelButton: { label: "Cancel", variant: "text" },
  size: "small",
  content: [
    {
      type: "description",
      widthPercent: 100,
      content: "Pick a failure mode. This action is designed to fail.",
    },
    {
      type: "select",
      label: "Failure Mode",
      key: "mode",
      required: true,
      placeholder: "Select a failure mode",
      widthPercent: 100,
      options: [
        {
          label: "Service call failure (handled, toast)",
          value: "service_error",
        },
        { label: "Kizen API failure (handled, toast)", value: "kizen_error" },
        {
          label: "Handled error via onError() (no throw)",
          value: "on_error",
        },
        {
          label: "Uncaught exception (unhandled)",
          value: "uncaught_exception",
        },
      ],
    },
  ],
});

if (result.canceled) {
  return;
}

// A select returns the whole selected option ({label, value}), not just the value.
const mode = result.values.mode.value;

if (mode === "service_error") {
  const [, error] = await this.getWithErrors(
    this.getServiceUrl("dad_jokes", "/this-endpoint-does-not-exist"),
  );

  const reason = describeError(error);

  this.showToast(
    reason
      ? `Service call failed as expected: ${reason}`
      : "Expected this call to fail, but it didn't.",
    { variant: reason ? "failure" : "success", autohide: false },
  );

  return;
}

if (mode === "kizen_error") {
  const [, error] = await this.getWithErrors(
    "/records/does-not-exist/lookup?identifier=nope",
  );

  const reason = describeError(error);

  this.showToast(
    reason
      ? `Kizen API call failed as expected: ${reason}`
      : "Expected this call to fail, but it didn't.",
    { variant: reason ? "failure" : "success", autohide: false },
  );

  return;
}

if (mode === "on_error") {
  // this.onError reports an error to the host WITHOUT throwing, so the script keeps running and
  // returns normally afterward. It sits between the two extremes above: more prominent than a
  // toast you compose yourself, but not the crash of an uncaught throw. Use it to surface a
  // failure you've caught and identified to be an issue with the Kizen platform itself - it will be
  // pushed to sentry as a platform-level error. Generally showing a toast is preferred.
  this.onError(
    new Error(
      "Kitchen Sink: handled error reported via this.onError (no throw).",
    ),
  );
  return;
}

if (mode === "uncaught_exception") {
  // Since this error isn't caught, it bubbles up to the host and lands in Kizen's monitoring
  // stack the same way as this.onError, but it is uncaught and will crash the script.
  throw new Error(
    "Kitchen Sink: deliberate uncaught exception (mode='uncaught_exception').",
  );
}

```

### `src/actions/performActionDemo/config.json`

```json
{
  "name": "Perform Action Demo — Ping Echo Service",
  "api_name": "perform_action_demo",
  "hint_object_name": "client_client"
}

```

### `src/actions/performActionDemo/script.js`

```javascript
// Kitchen Sink App · Action · Perform Action Demo
//
// Appears in the record-detail "Perform Action" menu when a business enables "include in Perform
// Action" on the association. Uses a basic_auth_token_provided service
// (echo_basic → httptest): /headers echoes the headers back to confirm it arrived.
// Needs a datetime field `last_perform_action_run`.

const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

const [echoed, error] = await this.getWithErrors(
  this.getServiceUrl("echo_basic", "/headers"),
);

if (error) {
  this.showToast(`Echo service call failed: ${describeError(error)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}

const authHeaderSeen = Boolean(echoed?.headers?.Authorization);

// Demo-only logging: these echoed headers include the secret-derived Authorization value.
// This is fine with a throwaway demo secret, but never log headers built from real credentials.
this.console.log(
  "httptest echoed headers:",
  echoed?.headers,
  "Authorization header present:",
  authHeaderSeen,
);

// The context exposes the object id and record (entity) id
const [, patchError] = await this.patchWithErrors(
  `/records/${this.objectId}/${this.entityId}`,
  {
    fields: [
      { name: "last_perform_action_run", value: new Date().toISOString() },
    ],
  },
);

if (patchError) {
  this.showToast(
    `Echo succeeded but saving the timestamp failed: ${describeError(patchError)}`,
    {
      variant: "failure",
      autohide: false,
    },
  );
  return;
}

this.showToast(
  authHeaderSeen
    ? "Pinged the echo service — the secret-derived Authorization header made it through the proxy."
    : "Pinged the echo service, but no Authorization header came back — check the api_key secret is configured.",
  { variant: authHeaderSeen ? "success" : "failure" },
);

// Reload the entity in the UI to show the updated values
this.refreshEntity();

```

### `src/actions/recordDataExplorer/config.json`

```json
{
  "name": "Record Data Explorer",
  "api_name": "record_data_explorer",
  "hint_object_name": "client_client"
}

```

### `src/actions/recordDataExplorer/script.js`

```javascript
// Kitchen Sink App · Action · Record Data Explorer

// getObjectDetail fetches the object model (with related_objects[]);
// getEntity fetches the record
const [object, entity] = await Promise.all([
  this.getObjectDetail(this.objectId),
  this.getEntity(this.objectId, this.entityId), // #getEntity — direct call
]);

if (!object || !entity) {
  this.showToast("Couldn't load this record's object or entity.", {
    variant: "failure",
    autohide: false,
  });
  return;
}

this.console.log("getObjectDetail():", object);
this.console.log("getEntity():", entity);
this.console.log("related_objects:", object.related_objects);

const fieldIds = Object.keys(entity.fields ?? {}).slice(0, 5);

const sampledValues = {};

for (const fieldId of fieldIds) {
  sampledValues[fieldId] = this.getFieldValue(entity, fieldId);
}

this.console.log("getFieldValue() sample (first 5 fields):", sampledValues);

const relationshipField = object.related_objects?.[0];

let firstRelatedEntityId;

if (relationshipField) {
  const related = await this.getRelatedEntitiesForField(
    this.objectId,
    this.entityId,
    relationshipField.field_id,
  );

  this.console.log(
    `getRelatedEntitiesForField(field ${relationshipField.field_id}):`,
    related,
  );

  firstRelatedEntityId = related?.[0]?.id;
} else {
  this.console.log(
    "No relationship fields on this object — skipping getRelatedEntitiesForField.",
  );
}

// Refreshes the entity in the UI so the latest data is displayed - can refresh any entity by ID
this.refreshEntityForId(this.entityId);

// Refreshes the timeline for the host entity (the one being viewed when the script is run)
this.refreshTimeline();

// Refreshes the timeline for a specific entity by ID
this.refreshTimelineForId(firstRelatedEntityId ?? this.entityId);

this.showToast(
  "Explored this record via the RecordDetail API and triggered refreshes. Details in the browser console.",
  { variant: "success" },
);

```

### `src/actions/recordLifecycle/config.json`

```json
{
  "name": "Record Lifecycle - Create then Delete",
  "api_name": "record_lifecycle",
  "hint_object_name": "client_client"
}

```

### `src/actions/recordLifecycle/script.js`

```javascript
// Kitchen Sink App · Action · Record Lifecycle

// Creates a record and then follows with a delete action, with confirmation

const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

const objectId = this.objectId;

// Duplicate names will throw an error on create.
const scratchName = `Kitchen Sink scratch ${Date.now()}`;

this.showToast("Creating a throwaway record…", {
  variant: "success",
  autohide: true,
});

const [created, createError] = await this.postWithErrors(
  `/records/${objectId}/add`,
  {
    fields: [{ name: "name", value: scratchName }],
  },
);

if (createError || !created || created.id == null) {
  this.clearToasts();

  this.showToast(
    `Could not create the record: ${describeError(createError) ?? "no id returned"}`,
    {
      variant: "failure",
      autohide: false,
    },
  );

  return;
}

const newRecordId = String(created.id);

this.clearToasts();

// Confirm before deleting - common pattern that shoud be followed before destructive actions.
const confirm = await this.dynamicPrompt({
  title: "Delete this record?",
  size: "small",
  confirmButton: { label: "Delete it", variant: "standard", color: "primary" },
  cancelButton: { label: "Keep it", variant: "text", color: "secondary" },
  content: [
    {
      type: "description",
      widthPercent: 100,
      content: `Created "${scratchName}" (id ${newRecordId}). Delete it now to finish the lifecycle demo?`,
    },
  ],
});

if (confirm.canceled) {
  this.showToast(
    `Kept "${scratchName}". Delete it manually if you don't want the scratch record.`,
    {
      variant: "success",
    },
  );
  return;
}

const [, deleteError] = await this.deleteWithErrors(
  `/records/${objectId}/${newRecordId}`,
);

if (deleteError) {
  this.showToast(
    `Created the record but couldn't delete it: ${describeError(deleteError)}`,
    {
      variant: "failure",
      autohide: false,
    },
  );
  return;
}

this.showToast("Created a record and deleted it — full lifecycle complete.", {
  variant: "success",
});

// Refresh so the page's blocks reflect the deletion.
this.refreshEntity();

```

### `src/actions/relatedRecordContext/config.json`

```json
{
  "name": "Related Record Context - Host vs Action Target",
  "api_name": "related_record_context",
  "hint_object_name": "client_client"
}

```

### `src/actions/relatedRecordContext/script.js`

```javascript
// Kitchen Sink App · Action · Related Record Context
//
// Demonstrates the two records an action can see:
//   HOST          - the record you're running the script from: this.objectId/entityId, this.currentObject()/currentEntity()
//   ACTION TARGET - the record the action was invoked against (a related row, when run from one):
//                   this.actionObjectId/actionEntityId, this.actionEntity()
//
// From a plain record action action-target ids are empty

this.console.log(
  "HOST objectId / entityId:",
  this.objectId,
  "/",
  this.entityId,
);

this.console.log(
  "ACTION-TARGET actionObjectId / actionEntityId:",
  this.actionObjectId,
  "/",
  this.actionEntityId,
);

const hasActionTarget = Boolean(this.actionObjectId && this.actionEntityId);

// Concurrently fetch the host entity and the action target entity (if present)
const [hostEntity, targetEntity] = await Promise.all([
  this.currentEntity(),
  hasActionTarget ? this.actionEntity() : Promise.resolve(undefined),
]);

this.console.log("currentEntity() [host]:", hostEntity);
this.console.log("actionEntity() [action target]:", targetEntity);

if (!hasActionTarget) {
  this.showToast(
    "No distinct action target, this was likely run against the host record itself. Invoke it from a related record's action to see the target diverge.",
    { variant: "success" },
  );
  return;
}

const targetLabel =
  targetEntity?.display_name ?? targetEntity?.name ?? this.actionEntityId;

this.showToast(
  `Host entity ${this.entityId} · action target "${targetLabel}" (${this.actionEntityId}). Full records are in the console.`,
  { variant: "success" },
);

```

### `src/actions/relationshipAddOverride/config.json`

```json
{
  "name": "Relationship Add Override - Create Related Record",
  "api_name": "relationship_add_override",
  "hint_object_name": "client_client"
}

```

### `src/actions/relationshipAddOverride/script.js`

```javascript
// Kitchen Sink App · Action · Relationship Add Override
//
// Replaces the standard "Add Record" modal on a relationship field. Activate it in the object
// settings wizard by setting an object's add record flow setting.
//
// Three ways an add-override can respond:
//   1. custom          - build the record yourself and return its id (the host links it)
//   2. native          - bail to Kizen's native create modal (this.openCreateRecordModal)
//   3. native_related  - bail to the native modal, pre-linked to the host entity
//                        (this.openCreateRelatedRecordModal)
//
// The script should return the ID of the newly created record, so that the Kizen UI can continue
// in the flow and create appropriate relationships as needed.

const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

const relatedObjectId = this.objectId;

// Choose the path. A select comes back as the full {label, value} option under result.values.<key>.
const choicePrompt = await this.dynamicPrompt({
  title: "Add Related Record",
  size: "small",
  confirmButton: { label: "Continue", variant: "standard", color: "primary" },
  cancelButton: { label: "Cancel", variant: "text", color: "secondary" },
  content: [
    {
      type: "description",
      widthPercent: 100,
      content:
        "Kitchen Sink demo of an Add-Record override. Pick how to create the related record: " +
        "build it here and return its id, or hand off to Kizen's native create modal.",
    },
    {
      type: "select",
      label: "How should we create it?",
      key: "method",
      required: true,
      placeholder: "Choose a path",
      widthPercent: 100,
      options: [
        { label: "Custom - build it here & return the id", value: "custom" },
        {
          label: "Native create modal (openCreateRecordModal)",
          value: "native",
        },
        {
          label: "Native related modal (openCreateRelatedRecordModal)",
          value: "native_related",
        },
      ],
    },
  ],
});

if (choicePrompt.canceled) {
  return;
}

const method = choicePrompt.values.method.value;

if (method === "native") {
  // Bail to the native create modal (needs only the object id).
  await this.openCreateRecordModal(relatedObjectId);

  // Since the script bailed out, there's no new record ID to return
  return;
}

if (method === "native_related") {
  // Same modal, pre-linked to a parent
  await this.openCreateRelatedRecordModal(relatedObjectId, this.entityId);

  // Since the script bailed out, there's no new record ID to return
  return;
}

const namePrompt = await this.dynamicPrompt({
  title: "Create Related Record",
  size: "small",
  confirmButton: {
    label: "Create & return",
    variant: "standard",
    color: "primary",
  },
  cancelButton: { label: "Cancel", variant: "text", color: "secondary" },
  content: [
    {
      type: "description",
      widthPercent: 100,
      content: "Creates a bare-minimum record on the related object.",
    },
    {
      type: "text",
      label: "Record name",
      key: "name",
      placeholder: "New record name",
      required: true,
      widthPercent: 100,
    },
  ],
});

if (namePrompt.canceled) {
  return;
}

const name = namePrompt.values.name.trim();

this.showToast("Creating record…", { variant: "success", autohide: true });

const [created, error] = await this.postWithErrors(
  `/records/${relatedObjectId}/add`,
  {
    fields: [{ name: "name", value: name }],
  },
);

if (error || !created || created.id == null) {
  this.clearToasts();

  this.showToast(
    `Could not create record: ${describeError(error) ?? "no id returned"}`,
    {
      variant: "failure",
      autohide: false,
    },
  );
  return;
}

const newRecordId = String(created.id);

this.clearToasts();

this.showToast(`Created "${name}" — linking it now.`, { variant: "success" });

// Return the recordID. If this script was run from a relationship field, the app handles creating the appropriate relationship.
return newRecordId;

```

### `src/automationSteps/allTypesRoundTrip/config.json`

```json
{
  "name": "All Types Round Trip",
  "plugin_description": "Kitchen Sink demo automation step covering every automation-step data_type the plugin engine supports.",
  "action_description": "Reads one input of each supported data_type, logs the Python type it deserialized to, and writes it straight back out on the matching output. Scalar types (string, number, boolean, date, datetime, uuid) round-trip unmodified. Reference types (employee, entity) and phone_number are asymmetric: the script sees a scalar (an id string / E.164 string), but the write path re-hydrates a record or re-validates — so the value only survives if it is a valid id/number for the target field.",
  "action_type": "kitchen_sink_all_types_round_trip",
  "runtime": "python 3.13",
  "inputs": [
    {
      "name": "input_string",
      "label": "String In",
      "data_type": "string",
      "required": true,
      "input_source": "object_field",
      "hint_field_name": "target",
      "hint_related_object_field_name": null,
      "script_alias": "input_string"
    },
    {
      "name": "input_email",
      "label": "Email In",
      "data_type": "email",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "email",
      "hint_related_object_field_name": null,
      "script_alias": "input_email"
    },
    {
      "name": "input_boolean",
      "label": "Boolean In",
      "data_type": "boolean",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "is_active",
      "hint_related_object_field_name": null,
      "script_alias": "input_boolean"
    },
    {
      "name": "input_number",
      "label": "Number In",
      "data_type": "number",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "amount",
      "hint_related_object_field_name": null,
      "script_alias": "input_number"
    },
    {
      "name": "input_date",
      "label": "Date In",
      "data_type": "date",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "start_date",
      "hint_related_object_field_name": null,
      "script_alias": "input_date"
    },
    {
      "name": "input_datetime",
      "label": "Datetime In",
      "data_type": "datetime",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "last_synced_at",
      "hint_related_object_field_name": null,
      "script_alias": "input_datetime"
    },
    {
      "name": "input_phone_number",
      "label": "Phone Number In",
      "data_type": "phone_number",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "business_phone",
      "hint_related_object_field_name": null,
      "script_alias": "input_phone_number"
    },
    {
      "name": "input_employee",
      "label": "Employee In",
      "data_type": "employee",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "owner",
      "hint_related_object_field_name": null,
      "script_alias": "input_employee"
    },
    {
      "name": "input_entity",
      "label": "Entity In",
      "data_type": "entity",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "related_contact",
      "hint_related_object_field_name": null,
      "script_alias": "input_entity"
    },
    {
      "name": "input_uuid",
      "label": "UUID In (variable)",
      "data_type": "uuid",
      "required": false,
      "input_source": "variable",
      "hint_field_name": "external_id",
      "hint_related_object_field_name": null,
      "script_alias": "input_uuid"
    }
  ],
  "outputs": [
    {
      "name": "output_string",
      "label": "String Out",
      "data_type": "string",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "target",
      "hint_related_object_field_name": null,
      "script_alias": "output_string",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    },
    {
      "name": "output_email",
      "label": "Email Out",
      "data_type": "email",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "email",
      "hint_related_object_field_name": null,
      "script_alias": "output_email",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    },
    {
      "name": "output_boolean",
      "label": "Boolean Out",
      "data_type": "boolean",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "is_active",
      "hint_related_object_field_name": null,
      "script_alias": "output_boolean",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    },
    {
      "name": "output_number",
      "label": "Number Out",
      "data_type": "number",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "amount",
      "hint_related_object_field_name": null,
      "script_alias": "output_number",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    },
    {
      "name": "output_date",
      "label": "Date Out",
      "data_type": "date",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "start_date",
      "hint_related_object_field_name": null,
      "script_alias": "output_date",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    },
    {
      "name": "output_datetime",
      "label": "Datetime Out",
      "data_type": "datetime",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "last_synced_at",
      "hint_related_object_field_name": null,
      "script_alias": "output_datetime",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    },
    {
      "name": "output_phone_number",
      "label": "Phone Number Out",
      "data_type": "phone_number",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "business_phone",
      "hint_related_object_field_name": null,
      "script_alias": "output_phone_number",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    },
    {
      "name": "output_employee",
      "label": "Employee Out",
      "data_type": "employee",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "owner",
      "hint_related_object_field_name": null,
      "script_alias": "output_employee",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    },
    {
      "name": "output_entity",
      "label": "Entity Out",
      "data_type": "entity",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "related_contact",
      "hint_related_object_field_name": null,
      "script_alias": "output_entity",
      "conflict_resolution": "update_if_blank",
      "create_field_options": false
    },
    {
      "name": "output_uuid",
      "label": "UUID Out",
      "data_type": "uuid",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "external_id",
      "hint_related_object_field_name": null,
      "script_alias": "output_uuid",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    }
  ]
}

```

### `src/automationSteps/allTypesRoundTrip/script.py`

```python
# Kitchen Sink App · Automation Step · All Types Round Trip
#
# Exercises every `data_type` an automation-step input/output supports (10 in total):
#     string | boolean | number | date | datetime | email | phone_number | employee | entity | uuid
#
# For each input the script:
#   1. reads the value
#   2. logs the Python type it deserialized to via outputs.log() — run the step once and read
#      the step's log to see exactly what your script receives for each type
#   3. writes it straight back out on the matching output, unmodified — chain this step into
#      itself in a workflow to confirm values survive the round trip byte-for-byte
#
# Reading optional inputs: an input the workflow author leaves unmapped is absent from
# `inputs` entirely — the attribute doesn't exist (it is not None), so plain attribute access
# raises AttributeError. Use getattr(inputs, name, None) for any input that isn't declared
# `required: true`. Only `input_string` is required here, so only it is read directly.
#
# `input_uuid` is wired with input_source="variable" (the rest use "object_field") to show
# that hint_field_name works for variables too: the automation builder pre-selects the
# variable with that name, just as it pre-selects a record field for object_field inputs.


def log_and_passthrough(type_name, value):
    outputs.log(f"{type_name}: value={value!r} python_type={type(value).__name__}")
    return value


outputs.output_string = log_and_passthrough("string", inputs.input_string)
outputs.output_email = log_and_passthrough("email", getattr(inputs, "input_email", None))
outputs.output_boolean = log_and_passthrough("boolean", getattr(inputs, "input_boolean", None))
outputs.output_number = log_and_passthrough("number", getattr(inputs, "input_number", None))
outputs.output_date = log_and_passthrough("date", getattr(inputs, "input_date", None))
outputs.output_datetime = log_and_passthrough("datetime", getattr(inputs, "input_datetime", None))
outputs.output_phone_number = log_and_passthrough("phone_number", getattr(inputs, "input_phone_number", None))
outputs.output_employee = log_and_passthrough("employee", getattr(inputs, "input_employee", None))
outputs.output_entity = log_and_passthrough("entity", getattr(inputs, "input_entity", None))
outputs.output_uuid = log_and_passthrough("uuid", getattr(inputs, "input_uuid", None))

outputs.log("All 10 data types round-tripped successfully.")

```

### `src/automationSteps/dadJoke/config.json`

```json
{
  "name": "Dad Joke",
  "plugin_description": "Kitchen Sink demo automation step. Fetches a random dad joke from a free API.",
  "action_description": "Calls icanhazdadjoke.com directly and writes a random dad joke to the target output.",
  "action_type": "kitchen_sink_dad_joke",
  "runtime": "python 3.13",
  "inputs": [],
  "outputs": [
    {
      "name": "target",
      "label": "Dad Joke",
      "data_type": "string",
      "required": true,
      "input_source": "object_field",
      "hint_field_name": "target",
      "hint_related_object_field_name": null,
      "script_alias": "target",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    }
  ]
}

```

### `src/automationSteps/dadJoke/script.py`

```python
# Kitchen Sink App · Automation Step · Dad Joke
#
# Directly fetches a dad joke from icanhazdadjoke.com and writes to to the target output

import requests

# Calling directly, not through the plugin-controlled proxy service
response = requests.get("https://icanhazdadjoke.com/", headers={"Accept": "text/plain"}, timeout=10)

if response.status_code != 200:
    raise Exception(f"Dad Joke API call failed: {response.status_code} - {response.text}")

outputs.target = response.text
outputs.log(f"Received joke: {response.text}")

```

### `src/automationSteps/failOnPurpose/config.json`

```json
{
  "name": "Fail On Purpose",
  "plugin_description": "Kitchen Sink demo automation step for exercising the negative path: this step always fails.",
  "action_description": "Always fails, in the mode you pick (raise, http_error, or timeout)",
  "action_type": "kitchen_sink_fail_on_purpose",
  "runtime": "python 3.13",
  "inputs": [
    {
      "name": "failure_mode",
      "label": "Failure Mode",
      "data_type": "string",
      "required": true,
      "input_source": "static_value",
      "allowed_values": ["raise", "http_error", "timeout"],
      "script_alias": "failure_mode"
    }
  ],
  "outputs": []
}

```

### `src/automationSteps/failOnPurpose/script.py`

```python
# Kitchen Sink App · Automation Step · Fail On Purpose
#
# Always fails, in one of three ways, providing a reliable negative-path fixture for
# code steps:
#
#   raise      - a plain, unhandled Python exception (the most common real-world failure)
#   http_error - an unhandled non-2xx response from a real HTTP call (httpbin.org/status/500)
#   timeout    - a network timeout (httpbin.org/delay/10 with a 2s client-side timeout)

import requests

mode = inputs.failure_mode

if mode == "raise":
    raise ValueError("Kitchen Sink: deliberate failure via a plain Python exception (failure_mode='raise').")

elif mode == "http_error":
    response = requests.get("https://httpbin.org/status/500", timeout=10)

    raise Exception(
        f"Kitchen Sink: deliberate failure via an unhandled non-2xx response "
        f"(failure_mode='http_error') - httpbin.org returned {response.status_code}."
    )

elif mode == "timeout":
    # httpbin.org/delay/10 sleeps 10s server-side; a 2s client timeout guarantees
    # requests.exceptions.Timeout instead of an actual 10s wait.
    requests.get("https://httpbin.org/delay/10", timeout=2)

else:
    # Reachable: allowed_values isn't enforced strictly, so any string can land here.
    raise ValueError(f"Kitchen Sink: unknown failure_mode {mode!r} — this branch itself is the failure.")

```

### `src/automationSteps/secretApiCall/config.json`

```json
{
  "name": "Secret API Call (429 Retry Demo)",
  "plugin_description": "Kitchen Sink demo automation step exercising the api_key integration secret end-to-end from Python.",
  "action_description": "Builds a Basic-auth Authorization header from the api_key integration secret and calls httptest (hypothesis.sh/api/httptest) directly with requests. Trips its always-429 status endpoint first to exercise exponential-backoff retry with Retry-After handling, then calls the header-echo endpoint to confirm the secret made it.",
  "action_type": "kitchen_sink_secret_api_call",
  "runtime": "python 3.13",
  "secrets": ["api_key"],
  "inputs": [],
  "outputs": [
    {
      "name": "echoed_auth_header",
      "label": "Echoed Authorization Header",
      "data_type": "string",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "target",
      "hint_related_object_field_name": null,
      "script_alias": "echoed_auth_header",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    }
  ]
}

```

### `src/automationSteps/secretApiCall/script.py`

```python
# Kitchen Sink App · Automation Step · Secret Api Call
#
# Proves the `api_key` integration secret (declared in kizen.json's base_config.secrets and in
# this step's config.json `secrets` list) is readable from a Python automation step and usable
# against a real external API — with a retry-with-backoff pattern for 429 rate limits.
#
# Secrets are read from the injected `secrets` dict under the namespaced key
# `<plugin_api_name>__<secret_name>`, even though config.json and kizen.json both declare the
# bare name "api_key".
#
#
# Two calls are made:
#   1. https://hypothesis.sh/api/httptest/status/429?Retry-After=2 - always returns 429 and echoes
#      the Retry-After query param back as a real response header, so this call exhausts MAX_RETRIES
#      and exercises the Retry-After-aware backoff in the step log. (If the endpoint ever omits the
#      header, call_with_retry falls back to exponential 2**attempt delays.)
#   2. https://hypothesis.sh/api/httptest/headers - echoes back every header it received, confirming
#      the secret-derived Authorization was passed properly.

import time

import requests

MAX_RETRIES = 3

auth_header = f"Basic {secrets['kitchen_sink__api_key']}"


def call_with_retry(url):
    attempt = 0    
    response = requests.get(url, headers={"Authorization": auth_header}, timeout=10)

    while response.status_code == 429 and attempt < MAX_RETRIES:
        attempt += 1
        retry_after = response.headers.get("Retry-After")
        delay = int(retry_after) if retry_after and retry_after.isdigit() else 2**attempt

        outputs.log(f"{url} -> 429; retry {attempt}/{MAX_RETRIES} after {delay}s")

        time.sleep(delay)

        response = requests.get(url, headers={"Authorization": auth_header}, timeout=10)
    return response


# 1. Trigger the rate-limit path so the backoff shows up in the step log.
rate_limited_response = call_with_retry("https://hypothesis.sh/api/httptest/status/429?Retry-After=2")

outputs.log(
    f"Rate-limit demo finished with status {rate_limited_response.status_code} "
    f"after exhausting {MAX_RETRIES} retries (httptest /status/429 always returns 429 by design)."
)

# 2. Make the "real" call and prove the secret made into the request
echo_response = call_with_retry("https://hypothesis.sh/api/httptest/headers")

if echo_response.status_code != 200:
    raise Exception(f"Unexpected status from httptest: {echo_response.status_code} - {echo_response.text}")

echoed_headers = echo_response.json().get("headers", {})

outputs.echoed_auth_header = echoed_headers.get("Authorization", "")

outputs.log(f"httptest echoed back Authorization header: {outputs.echoed_auth_header}")

```

### `src/blocks/chartGroupBlock/config.json`

```json
{
  "name": "Chart Group Block",
  "api_name": "chart_group_block",
  "min_w": 3,
  "max_w": 12,
  "min_h": 3,
  "max_h": 8,
  "recommended_height": 240,
  "types": ["charts"]
}

```

### `src/blocks/chartGroupBlock/eventScripts/logContext.js`

```javascript
// Kitchen Sink App · Block · Chart Group Block · logContext

this.console.log(
  "Chart Group block - location:",
  JSON.stringify(this.location),
);

this.console.log(
  "Chart Group block - install config:",
  JSON.stringify(this.config),
);

```

### `src/blocks/chartGroupBlock/script.js`

```javascript
// Kitchen Sink App · Block · Chart Group Block
//
// `types: ["charts"]` scopes this block to the Chart Group picker. It has no `when`, so it is
// always offered - compare this to the Dashboard and Homepage blocks, which the "Enable Blocks" toggle
// can hide them. It reads its install config directly (`this.config.contextValue`, set in the setup
// assistant) and interpolates it into the rendered markup.

this.outputUI(`
  <div class="ks-block">
    <div class="ks-block__header">
      <span class="ks-block__badge">CHART GROUP</span>
      <span class="ks-block__title">Chart Group Block</span>
    </div>
    <p class="ks-block__desc">
      Install config value <code>contextValue</code> is
      <strong>${this.config.contextValue}</strong>.
    </p>
    <div class="ks-block__actions">
      <button class="ks-block__btn" data-script="logContext">Log context</button>
    </div>
  </div>
`);

```

### `src/blocks/chartGroupBlock/styles.css`

```css
/* Kitchen Sink App · Block · Chart Group Block · styles */

/* Engine-scoped (@scope) at inject time - write plain selectors. Each block ships its own
 * styles.css; there is no cross-block shared stylesheet.
 */

.ks-block {
  /* Fill the resizable dashlet cell instead of sizing to content — the host drops this markup
   * into a full-width/height, overflow-auto container, so height:100% + border-box makes the
   * block track the grid cell as the admin resizes it. */
  height: 100%;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

.ks-block__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ks-block__badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #38bdf8;
  color: #0f172a;
}

.ks-block__title {
  font-weight: 600;
}

.ks-block__desc {
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
  color: #cbd5e1;
}

.ks-block__desc code {
  background: rgba(148, 163, 184, 0.2);
  padding: 1px 4px;
  border-radius: 3px;
}

.ks-block__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ks-block__btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
  font-size: 13px;
}

.ks-block__btn:hover {
  background: #7dd3fc;
}

```

### `src/blocks/dashboardBlock/config.json`

```json
{
  "name": "Dashboard Block",
  "api_name": "dashboard_block",
  "min_w": 3,
  "max_w": 12,
  "min_h": 3,
  "max_h": 10,
  "recommended_height": 320,
  "types": ["dashboards"],
  "when": "Boolean({{config.enableBlocks}})"
}

```

### `src/blocks/dashboardBlock/eventScripts/chain.js`

```javascript
// Kitchen Sink App · Block · Dashboard Block · chain
//
// this.runEventScript invokes a sibling event script from code (vs a data-script click). It
// returns void, so there is no result to wait on. The second arg reaches the target as its
// this.args (logContext logs it in this demo).

this.console.log(
  "chain: invoking the logContext event script via runEventScript…",
);

this.runEventScript("logContext", { triggeredBy: "chain", at: Date.now() });

```

### `src/blocks/dashboardBlock/eventScripts/logContext.js`

```javascript
// Kitchen Sink App · Block · Dashboard Block · logContext
//
// A block worker is a full plugin worker context. `this.location` (the partial window.location
// every plugin script gets), `this.config` (install config from the setup
// assistant), and `this.userConfig` (per-user config) are all available here - the same context
// actions and route scripts receive.

// this.args are whatever triggered this script passed in — empty on a plain button click, or the
// object handed over by runEventScript (see eventScripts/chain.js).
this.console.log("Dashboard block — args:", JSON.stringify(this.args));

this.console.log("Dashboard block — location:", JSON.stringify(this.location));

this.console.log(
  "Dashboard block — install config:",
  JSON.stringify(this.config),
);

this.console.log(
  "Dashboard block — user config:",
  JSON.stringify(this.userConfig),
);

```

### `src/blocks/dashboardBlock/eventScripts/refresh.js`

```javascript
// Kitchen Sink App · Block · Dashboard Block · refresh
//
// An event script can repaint the block by calling `outputUI` again. This swaps the rendered
// markup in place, even though each event-script run is its own fresh worker
// (no worker state is retained between runs; the repaint is driven purely by this outputUI call).
// The re-rendered markup keeps its own data-script buttons, so it can be triggered repeatedly.

this.outputUI(`
  <div class="ks-block">
    <div class="ks-block__header">
      <span class="ks-block__badge ks-block__badge--accent">REFRESHED</span>
      <span class="ks-block__title">Dashboard Block</span>
    </div>
    <p class="ks-block__desc">Repainted from an event script via <code>outputUI</code>.</p>
    <div class="ks-block__actions">
      <button class="ks-block__btn" data-script="simulateLoading">Simulate loading</button>
      <button class="ks-block__btn" data-script="refresh">Refresh again</button>
      <button class="ks-block__btn" data-script="chain">Chain → logContext</button>
      <button class="ks-block__btn" data-script="logContext">Log context</button>
    </div>
  </div>
`);

```

### `src/blocks/dashboardBlock/eventScripts/simulateLoading.js`

```javascript
// Kitchen Sink App · Block · Dashboard Block · simulateLoading
//
// setIndicator + wait together. setIndicator shows a loading affordance on the block ("none",
// "block", "button", "spinner"); The engine
// resets the indicator to "none" on cleanup, so there's nothing to turn off.

// Show a spinner over the block while we "work".
this.setIndicator("spinner");

// Pause so the spinner is visible (always await wait).
await this.wait(2000);

// Repaint; on return, cleanup clears the indicator.
this.outputUI(`
  <div class="ks-block">
    <div class="ks-block__header">
      <span class="ks-block__badge ks-block__badge--accent">DONE</span>
      <span class="ks-block__title">Dashboard Block</span>
    </div>
    <p class="ks-block__desc">
      Showed a <code>spinner</code> indicator for two seconds via <code>setIndicator</code> +
      <code>wait</code>, then repainted. The indicator cleared itself on cleanup.
    </p>
    <div class="ks-block__actions">
      <button class="ks-block__btn" data-script="simulateLoading">Simulate loading</button>
      <button class="ks-block__btn" data-script="refresh">Refresh in place</button>
      <button class="ks-block__btn" data-script="chain">Chain → logContext</button>
      <button class="ks-block__btn" data-script="logContext">Log context</button>
    </div>
  </div>
`);

```

### `src/blocks/dashboardBlock/script.js`

```javascript
// Kitchen Sink App · Block · Dashboard Block
//
// A block is a plugin-provided dashlet an admin drops onto a Dashboard, Homepage, Chart
// Group, or a record page. Which surfaces offer a given
// block is the `types` array in config.json — this one is `["dashboards"]`, so it only appears
// in the Dashboard block picker.
//
// The runtime is the same worker-rendered-DOM model as views and floating frames: script.js
// runs when the block mounts and paints markup with `this.outputUI(...)`. There is no DOM API in
// the worker, so interactivity is wired through `data-script="<name>"` attributes, each
// dispatched to the matching file under `eventScripts/`. An event script may itself call
// `this.outputUI(...)` to repaint the block in place (see eventScripts/refresh.js). Each run
// executes in its OWN fresh worker with a new context, so
// nothing stored on `this` carries across runs. What persists is the painted DOM (the last
// outputUI markup stays on screen) and any state you temporarily store through `this.sessionData` /
// `this.setSessionData`.
//
// Sizing (min_w/max_w/min_h/max_h in grid columns, recommended_height in px) is declared in
// config.json and enforced by the host grid; the script never positions itself. This block also
// carries `when: Boolean({{config.enableBlocks}})`, so turning the "Enable Blocks" setup-assistant
// toggle off removes it from the picker.

this.outputUI(`
  <div class="ks-block">
    <div class="ks-block__header">
      <span class="ks-block__badge">DASHBOARD</span>
      <span class="ks-block__title">Dashboard Block</span>
    </div>
    <p class="ks-block__desc">
      Rendered by <code>outputUI</code> and styled by <code>styles.css</code>. The buttons below
      dispatch to files under <code>eventScripts/</code>.
    </p>
    <div class="ks-block__actions">
      <button class="ks-block__btn" data-script="simulateLoading">Simulate loading</button>
      <button class="ks-block__btn" data-script="refresh">Refresh in place</button>
      <button class="ks-block__btn" data-script="chain">Chain → logContext</button>
      <button class="ks-block__btn" data-script="logContext">Log context</button>
    </div>
  </div>
`);

```

### `src/blocks/dashboardBlock/styles.css`

```css
/* Kitchen Sink App · Block · Dashboard Block · styles */

/*
 * The engine wraps a block's styles in `@scope { ... }` before injecting them, so these
 * selectors are already isolated to this block's rendered markup — write plain selectors, not
 * scoped or prefixed ones. (Blocks are packaged independently, so each block ships its own
 * styles.css; there is no shared-stylesheet mechanism across blocks.)
 */
.ks-block {
  /* Fill the resizable dashlet cell instead of sizing to content — the host drops this markup
   * into a full-width/height, overflow-auto container, so height:100% + border-box makes the
   * block track the grid cell as the admin resizes it. */
  height: 100%;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  font-family: system-ui, -apple-system, sans-serif;
}

.ks-block__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ks-block__badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #38bdf8;
  color: #0f172a;
}

.ks-block__badge--accent {
  background: #34d399;
}

.ks-block__title {
  font-weight: 600;
}

.ks-block__desc {
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
  color: #cbd5e1;
}

.ks-block__desc code {
  background: rgba(148, 163, 184, 0.2);
  padding: 1px 4px;
  border-radius: 3px;
}

.ks-block__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ks-block__btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
  font-size: 13px;
}

.ks-block__btn:hover {
  background: #7dd3fc;
}

```

### `src/blocks/homepageBlock/config.json`

```json
{
  "name": "Homepage Block",
  "api_name": "homepage_block",
  "min_w": 3,
  "max_w": 12,
  "min_h": 3,
  "max_h": 8,
  "recommended_height": 240,
  "types": ["homepages"],
  "when": "Boolean({{config.enableBlocks}})"
}

```

### `src/blocks/homepageBlock/eventScripts/openView.js`

```javascript
// Kitchen Sink App · Block · Homepage Block · openView
//
// showViewInModal takes the view's api_name. The result shape
// is { canceled, values, eventSource }; submitted form data is at result.values.formData, where
// every field is an array (FormData.getAll semantics). A single input is a one-element array,
// but a multi-value field like formView's "channels" checkbox group carries every checked value.
// Join, rather than index, or you silently drop all but the first (this matches summaryView's handling
// of the same shared view). A block is a full worker context - the same showViewInModal contract
// the Modal Launcher toolbar item uses.

const result = await this.showViewInModal("formview", {
  options: {
    title: "Homepage Block form",
    confirmButton: { label: "Submit" },
    cancelButton: { label: "Cancel" },
    size: "medium",
  },
});

if (result.canceled) {
  this.showToast("Modal canceled — nothing submitted.", { variant: "alert" });
  return;
}

const formData = result.values.formData;

const flattened = Object.fromEntries(
  Object.entries(formData).map(([key, values]) => [
    key,
    values.filter((value) => value !== "").join(", "),
  ]),
);

this.console.log(
  "Homepage block — submitted form data:",
  JSON.stringify(flattened),
);

this.showToast("Form submitted — see the console for values.", {
  variant: "success",
});

```

### `src/blocks/homepageBlock/script.js`

```javascript
// Kitchen Sink App · Block · Homepage Block
//
// `types: ["homepages"]` scopes this block to the Homepage picker. Its point is to show that a
// block worker can open one of this plugin's views in a modal with `showViewInModal` - the same
// primitive toolbar items and actions use - and read the submitted form values back. The launch
// and result handling live in eventScripts/openView.js.

this.outputUI(`
  <div class="ks-block">
    <div class="ks-block__header">
      <span class="ks-block__badge">HOMEPAGE</span>
      <span class="ks-block__title">Homepage Block</span>
    </div>
    <p class="ks-block__desc">
      Opens the <code>formview</code> view in a modal and logs what it returns.
    </p>
    <div class="ks-block__actions">
      <button class="ks-block__btn" data-script="openView">Open a form modal</button>
    </div>
  </div>
`);

```

### `src/blocks/homepageBlock/styles.css`

```css
/* Kitchen Sink App · Block · Homepage Block · styles */

/* Engine-scoped (@scope) at inject time — write plain selectors. Each block ships its own
 * styles.css; there is no cross-block shared stylesheet.
 */

.ks-block {
  /* Fill the resizable dashlet cell instead of sizing to content — the host drops this markup
   * into a full-width/height, overflow-auto container, so height:100% + border-box makes the
   * block track the grid cell as the admin resizes it. */
  height: 100%;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

.ks-block__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ks-block__badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #38bdf8;
  color: #0f172a;
}

.ks-block__title {
  font-weight: 600;
}

.ks-block__desc {
  font-size: 13px;
  line-height: 1.5;
  margin: 0 0 12px;
  color: #cbd5e1;
}

.ks-block__desc code {
  background: rgba(148, 163, 184, 0.2);
  padding: 1px 4px;
  border-radius: 3px;
}

.ks-block__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.ks-block__btn {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: #38bdf8;
  color: #0f172a;
  font-weight: 600;
  font-size: 13px;
}

.ks-block__btn:hover {
  background: #7dd3fc;
}

```

### `src/blocks/pingBlock/config.json`

```json
{
  "name": "Ping Block",
  "api_name": "ping_block",
  "min_w": 2,
  "max_w": 6,
  "min_h": 3,
  "max_h": 8,
  "recommended_height": 220,
  "types": ["dashboards", "homepages", "charts", "records"]
}

```

### `src/blocks/pingBlock/eventScripts/receive.js`

```javascript
// Kitchen Sink App · Block · Ping Block · receive
//
// Invoked when another surface serves at this block:
//   this.communicate.runBlockScript("ping_block", "receive", { from })
// The dispatched payload arrives on `this.args`. `setSessionData` merges into existing session
// state rather than replacing it, so the rally count and last color persist across hits.

const PALETTE = ["#f87171", "#facc15", "#4ade80", "#60a5fa", "#e879f9"];
const from = String(this.args.from ?? "unknown");
const rally = Number(this.sessionData?.pingRally ?? 0) + 1;
const lastColor = this.sessionData?.pingColor;
const choices = PALETTE.filter((color) => color !== lastColor);
const color = choices[Math.floor(Math.random() * choices.length)];

this.setSessionData({ pingRally: rally, pingColor: color });

this.console.log(`Ping block: hit by ${from} → rally ${rally}, ${color}`);

this.outputUI(`
  <div class="pp-card pp-card--hit" style="--pp-accent:${color}">
    <div class="pp-top">
      <span class="pp-badge">PING</span>
      <span class="pp-rally">Rally ${rally}</span>
    </div>
    <p class="pp-msg">Hit by <strong>${from}</strong> — serve back to Pong.</p>
    <button class="pp-btn" data-script="serve">Serve &rarr;</button>
  </div>
`);

```

### `src/blocks/pingBlock/eventScripts/serve.js`

```javascript
// Kitchen Sink App · Block · Ping Block · serve
//
// Hit the Pong block by invoking its `receive` event script via runBlockScript.

this.communicate.runBlockScript("pong_block", "receive", { from: "ping" });

```

### `src/blocks/pingBlock/script.js`

```javascript
// Kitchen Sink App · Block · Ping Block
//
// Half of a two-block volley demoing cross-block dispatch with
// this.communicate.runBlockScript(blockAPIName, scriptId, args). Place Ping and Pong on the same
// page, and runBlockScript posts a same-page window event, so the target must be mounted. "Serve"
// (eventScripts/serve.js) hits pong_block's `receive`; only the block that's hit repaints. Rally
// count and color live in sessionData, which survives between this block's runs.

const rally = Number(this.sessionData?.pingRally ?? 0);

const color = this.sessionData?.pingColor;

const inRally = rally > 0 && Boolean(color);

this.console.log(
  `Ping block: mount (${inRally ? `resumed at rally ${rally}` : "idle"})`,
);

this.outputUI(`
  <div class="pp-card ${inRally ? "pp-card--hit" : "pp-card--idle"}"${inRally ? ` style="--pp-accent:${color}"` : ""}>
    <div class="pp-top">
      <span class="pp-badge">PING</span>
      <span class="pp-rally">Rally ${rally}</span>
    </div>
    <p class="pp-msg">${inRally ? "Volleying with <strong>Pong</strong>." : "Idle — serve to hit <strong>Pong</strong>."}</p>
    <button class="pp-btn" data-script="serve">Serve &rarr;</button>
  </div>
`);

```

### `src/blocks/pingBlock/styles.css`

```css
/* Kitchen Sink App · Block · Ping Block · styles */

/* Engine-scoped (@scope) at inject time - write plain selectors. Each block ships its own
 * styles.css; there is no cross-block shared stylesheet. The hit state drives its accent from
 * the inline `--pp-accent` custom property set by eventScripts/receive.js.
 */

.pp-card {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 10px;
  background: #1e293b;
  color: #e2e8f0;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  border-left: 5px solid #475569;
}

.pp-card--hit {
  border-left-width: 8px;
  border-left-color: var(--pp-accent, #f97316);
  animation: pp-pop 220ms ease-out;
}

@keyframes pp-pop {
  from {
    transform: scale(0.98);
    opacity: 0.6;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.pp-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pp-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--pp-accent, #f97316);
  color: #0f172a;
}

.pp-rally {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.pp-msg {
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  color: #cbd5e1;
}

.pp-msg strong {
  color: #f8fafc;
}

.pp-btn {
  align-self: flex-start;
  margin-top: auto;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: var(--pp-accent, #f97316);
  color: #0f172a;
  font-weight: 600;
  font-size: 13px;
}

.pp-btn:hover {
  filter: brightness(1.1);
}

```

### `src/blocks/pongBlock/config.json`

```json
{
  "name": "Pong Block",
  "api_name": "pong_block",
  "min_w": 2,
  "max_w": 6,
  "min_h": 3,
  "max_h": 8,
  "recommended_height": 220,
  "types": ["dashboards", "homepages", "charts", "records"]
}

```

### `src/blocks/pongBlock/eventScripts/receive.js`

```javascript
// Kitchen Sink App · Block · Pong Block · receive
//
// Invoked when another surface serves at this block via
// this.communicate.runBlockScript("pong_block", "receive", { from })
// Payload on `this.args`. `setSessionData` merges, so the rally count and last color persist
// across hits; picks a fresh color, repaints, and offers a Serve button to volley back.

const PALETTE = ["#fb923c", "#a3e635", "#2dd4bf", "#818cf8", "#f472b6"];

const from = String(this.args.from ?? "unknown");
const rally = Number(this.sessionData?.pongRally ?? 0) + 1;
const lastColor = this.sessionData?.pongColor;
const choices = PALETTE.filter((color) => color !== lastColor);
const color = choices[Math.floor(Math.random() * choices.length)];

this.setSessionData({ pongRally: rally, pongColor: color });
this.console.log(`Pong block: hit by ${from} → rally ${rally}, ${color}`);

this.outputUI(`
  <div class="pp-card pp-card--hit" style="--pp-accent:${color}">
    <div class="pp-top">
      <span class="pp-badge">PONG</span>
      <span class="pp-rally">Rally ${rally}</span>
    </div>
    <p class="pp-msg">Hit by <strong>${from}</strong> — serve back to Ping.</p>
    <button class="pp-btn" data-script="serve">Serve &rarr;</button>
  </div>
`);

```

### `src/blocks/pongBlock/eventScripts/serve.js`

```javascript
// Kitchen Sink App · Block · Pong Block · serve
//
// Hit the Ping block by invoking its `receive` event script via runBlockScript.
// Reaches every mounted instance of ping_block on the page.

this.console.log("Pong block: serving → ping_block");

this.communicate.runBlockScript("ping_block", "receive", { from: "pong" });

```

### `src/blocks/pongBlock/script.js`

```javascript
// Kitchen Sink App · Block · Pong Block
//
// The other half of the volley (see the Ping block for the full contract). Place both blocks on
// the same page. Clicking "Serve" runs eventScripts/serve.js, which calls
// this.communicate.runBlockScript("ping_block", "receive", { from: "pong" }),
// hitting the Ping block's `receive` script. Only the block that is hit repaints.
// Restore prior state on mount (see the Ping block for the rationale): idle on first mount,
// resumed rally count + color on a same-session remount.

const rally = Number(this.sessionData?.pongRally ?? 0);
const color = this.sessionData?.pongColor;
const inRally = rally > 0 && Boolean(color);

this.console.log(
  `Pong block: mount (${inRally ? `resumed at rally ${rally}` : "idle"})`,
);

this.outputUI(`
  <div class="pp-card ${inRally ? "pp-card--hit" : "pp-card--idle"}"${inRally ? ` style="--pp-accent:${color}"` : ""}>
    <div class="pp-top">
      <span class="pp-badge">PONG</span>
      <span class="pp-rally">Rally ${rally}</span>
    </div>
    <p class="pp-msg">${inRally ? "Volleying with <strong>Ping</strong>." : "Idle — serve to hit <strong>Ping</strong>."}</p>
    <button class="pp-btn" data-script="serve">Serve &rarr;</button>
  </div>
`);

```

### `src/blocks/pongBlock/styles.css`

```css
/* Kitchen Sink App · Block · Pong Block · styles */

/* Engine-scoped (@scope) at inject time - write plain selectors. Each block ships its own
 * styles.css; there is no cross-block shared stylesheet. The hit state drives its accent from
 * the inline `--pp-accent` custom property set by eventScripts/receive.js.
 */

.pp-card {
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
  border-radius: 10px;
  background: #1e293b;
  color: #e2e8f0;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  border-left: 5px solid #475569;
}

.pp-card--hit {
  border-left-width: 8px;
  border-left-color: var(--pp-accent, #38bdf8);
  animation: pp-pop 220ms ease-out;
}

@keyframes pp-pop {
  from {
    transform: scale(0.98);
    opacity: 0.6;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.pp-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pp-badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 2px 8px;
  border-radius: 4px;
  background: var(--pp-accent, #38bdf8);
  color: #0f172a;
}

.pp-rally {
  font-size: 12px;
  font-weight: 600;
  color: #94a3b8;
}

.pp-msg {
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  color: #cbd5e1;
}

.pp-msg strong {
  color: #f8fafc;
}

.pp-btn {
  align-self: flex-start;
  margin-top: auto;
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  background: var(--pp-accent, #38bdf8);
  color: #0f172a;
  font-weight: 600;
  font-size: 13px;
}

.pp-btn:hover {
  filter: brightness(1.1);
}

```

### `src/blocks/recordBlock/config.json`

```json
{
  "name": "Record Block",
  "api_name": "record_block",
  "types": ["records"]
}

```

### `src/blocks/recordBlock/script.js`

```javascript
// Kitchen Sink App · Block · Record Block
//
// `types: ["records"]` targets the record-detail block surface, one of the four declared block
// types (homepages · dashboards · charts · records). It packages like any other block.

this.outputUI(`
  <div class="ks-block">
    <div class="ks-block__header">
      <span class="ks-block__badge">RECORD</span>
      <span class="ks-block__title">Record Block</span>
    </div>
    <p class="ks-block__desc">
      Minimal config: sizing and <code>when</code> omitted, so the packager applies default grid
      bounds (1–12) and the block is always offered.
    </p>
  </div>
`);

```

### `src/blocks/recordBlock/styles.css`

```css
/* Kitchen Sink App · Block · Record Block · styles */

.ks-block {
  /* Fill the resizable dashlet cell instead of sizing to content — the host drops this markup
   * into a full-width/height, overflow-auto container, so height:100% + border-box makes the
   * block track the grid cell as the admin resizes it. */
  height: 100%;
  box-sizing: border-box;
  padding: 16px;
  border-radius: 8px;
  background: #1e293b;
  color: #e2e8f0;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
}

.ks-block__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.ks-block__badge {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #38bdf8;
  color: #0f172a;
}

.ks-block__title {
  font-weight: 600;
}

.ks-block__desc {
  font-size: 13px;
  line-height: 1.5;
  margin: 0;
  color: #cbd5e1;
}

.ks-block__desc code {
  background: rgba(148, 163, 184, 0.2);
  padding: 1px 4px;
  border-radius: 3px;
}

```

### `src/calendarSources/demo/calendars.js`

```javascript
// Kitchen Sink App · Calendar Source · Demo · calendars
//
// One of a calendar source's two scripts: this lists the calendars a user can pick
// Returns (host-validated; discards a non-array, warns on bad fields):
//   Required per calendar: { id, name }
//   Optional: { description?, default? }  (default pre-selects)
//
// Lists every calendar on the google_business service (authorize it first). It's business-level;
// all users see the same account, and a real plugin usually wants a user-level service. No
// nextPageToken paging (fine for a demo).

const [data, errors] = await this.getWithErrors(
  this.getServiceUrl("google_business", "/calendar/v3/users/me/calendarList"),
);

// Fetch failed: log it for traceability and return an empty list so this source degrades to
// "no calendars" rather than tearing down. getWithErrors returns the error in the tuple, so
// there is nothing to catch.
if (errors) {
  const message =
    typeof errors === "string"
      ? errors
      : (errors?.message ?? JSON.stringify(errors));

  this.console.error(`Failed to list Google calendars: ${message}`);

  return [];
}

if (!Array.isArray(data?.items)) {
  this.console.error(
    `Failed to list Google calendars: unexpected response shape ${JSON.stringify(data)}`,
  );

  return [];
}

return data.items.map((calendar) => ({
  id: calendar.id,
  name: calendar.summary,
  description: calendar.description,
  default: calendar.primary || false,
}));

```

### `src/calendarSources/demo/config.json`

```json
{
  "name": "Kitchen Sink Demo Calendar",
  "api_name": "demo"
}

```

### `src/calendarSources/demo/events.js`

```javascript
// Kitchen Sink App · Calendar Source · Demo · events
//
// Lists one calendar's events for a date range. The host calls it per (calendar, range) pair, passing
// this.args.calendar = { calendar_id, range_start, range_end } (RFC3339 timestamps).
//
// Return per event (host-validated):
//   Required: { id, calendar_id, title, start_time, end_time } - times are epoch ms
//   Optional: { description?, url?, activity_id?, all_day?, busy? }
// this.formatDateForResponse(date) is just date.getTime().

const { calendar_id, range_start, range_end } = this.args.calendar;

// Google flags all-day events with a `date` (not `dateTime`) on start/end — there's no boolean.
const isAllDayEvent = (event) =>
  Boolean(
    !event.start.dateTime &&
    !event.end.dateTime &&
    event.start.date &&
    event.end.date,
  );

// Parse all-day dates as local midnight (createDateObject) so a DST boundary can't shift the day;
// timed events carry their own offset in dateTime.
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
    // Drop an unparseable event rather than fail the whole list; log it for traceability in the demo.
    this.console.warn(
      `Skipping event ${event.id} with unparseable start/end`,
      event,
    );
    return {};
  }
};

// No nextPageToken paging — fine for a demo; a production source should follow it.
const [data, errors] = await this.getWithErrors(
  this.getServiceUrl(
    "google_business",
    `/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events?timeMin=${encodeURIComponent(
      range_start,
    )}&timeMax=${encodeURIComponent(range_end)}&singleEvents=true`,
  ),
);

// Fetch failed: log it for traceability and return an empty list so this calendar degrades to
// "no events" rather than tearing down. getWithErrors returns the error in the tuple, so there
// is nothing to catch.
if (errors) {
  const message =
    typeof errors === "string"
      ? errors
      : (errors?.message ?? JSON.stringify(errors));

  this.console.error(
    `Failed to list events for calendar ${calendar_id}: ${message}`,
  );
  return [];
}

if (!Array.isArray(data?.items)) {
  this.console.error(
    `Failed to list events for calendar ${calendar_id}: unexpected response shape ${JSON.stringify(data)}`,
  );
  return [];
}

return (
  data.items
    // Skip Google's workingLocation entries — not real events.
    .filter((event) => event.eventType !== "workingLocation")
    .map((event) => {
      const { startDate, endDate } = parseEventBounds(event);

      if (!startDate || !endDate) {
        return null;
      }

      // Kizen-synced events can carry an iCalUID "{activityId}--…" — extract it to link back; absent
      // for events created directly in Google.
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
    .filter((event) => event !== null)
);

```

### `src/dataAdornments/datetimeAdornment/config.json`

```json
{
  "icon": "calendar",
  "color": "green",
  "tooltip": "Relative Time",
  "field_type": "datetime",
  "when": "Boolean({{config.enableAdornments}})"
}

```

### `src/dataAdornments/datetimeAdornment/script.js`

```javascript
// Kitchen Sink App · Data Adornment · Datetime Adornment
//
// Reads an adornment's field value and uses this.currentBusiness.timezone to produce a
// relative-time toast.

const target = new Date(this.args.value);

// this.parseDate splits a plain YYYY-MM-DD string into its [year, month, day] parts. The
// adornment value is a full ISO datetime (because it's datetime), so take the date portion
// first, so parseDate splits on "-" and would otherwise fold the time into the day part.
const [datePart] = this.args.value.split("T");

this.console.log("parseDate(datePart):", this.parseDate(datePart)); // e.g. ["2026", "07", "07"]

// Human relative description, rounded to the largest whole unit that fits.
const describeRelativeTime = (date, now = new Date()) => {
  const diffMs = date.getTime() - now.getTime();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) {
    return "right now";
  }

  const [amount, unit] =
    absMs < hour
      ? [Math.round(absMs / minute), "minute"]
      : absMs < day
        ? [Math.round(absMs / hour), "hour"]
        : [Math.round(absMs / day), "day"];

  const plural = amount === 1 ? unit : `${unit}s`;

  return diffMs < 0
    ? `${amount} ${plural} ago`
    : `${amount} ${plural} from now`;
};

// Naming the business timezone in the toast doubles as a quick check that
// this.currentBusiness.timezone is visible to the script.
this.showToast(
  `${describeRelativeTime(target)} (business timezone: ${this.currentBusiness.timezone.name})`,
  { variant: "success" },
);

```

### `src/dataAdornments/phoneAdornment/config.json`

```json
{
  "icon": "phone",
  "color": "blue",
  "tooltip": "Phone Field Actions",
  "field_type": "phonenumber",
  "when": "Boolean({{config.enableAdornments}})"
}

```

### `src/dataAdornments/phoneAdornment/script.js`

```javascript
// Kitchen Sink App · Data Adornment · Phone Adornment
//
// Shows the adornment args contract and drives `this.dynamicPrompt` from a click that isn't a
// toolbar item or action. A data adornment is the small icon the host renders next to any field
// whose type matches `field_type` in config.json (i.e. phonenumber here) on a record detail page.
// Clicking it runs this script. The host discards this script's return value. To change the
// record, write through the API (e.g. this.patchWithErrors) and call this.refreshEntity(). This
// demo is read-only.

// The complete args payload every adornment receives, logged on each click so the contract
// is easy to inspect in the browser console.
this.console.log("Data adornment args contract:", {
  value: this.args.value,
  fieldId: this.args.fieldId,
  fieldType: this.args.fieldType,
  objectId: this.args.objectId,
  entityId: this.args.entityId,
  isActivity: this.args.isActivity,
});

// `value` is the field's raw phone string. The host only renders an adornment when the field
// has a value.
const phoneValue = this.args.value;

// this.parsePhone strips "+" characters - not spaces, dashes, parens, or the "x" extension separator.
this.console.log("parsePhone(value):", this.parsePhone(phoneValue));

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

// A select returns the whole selected option ({label, value}), never just the bare value.
const action = result.values.action.value;

if (action === "call") {
  // Kizen phone fields append any extension after an "x" separator (e.g. "+12133734253x123").
  // Split that off first — sanitizing the whole string in one pass would delete the "x" and
  // silently concatenate the extension onto the main number. The extension then rides along
  // as the ";ext=" suffix that RFC 3966 defines for tel: URIs ("tel:+12133734253;ext=123").
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

### `src/floatingFrames/iframeBridge/config.json`

```json
{
  "name": "Iframe Bridge",
  "api_name": "iframe_bridge",
  "title": "Iframe Bridge",
  "header_color": "rgb(88, 28, 135)",
  "header_text_color": "rgb(255, 255, 255)",
  "default_position": "bottom-left",
  "minimized_style": "circle",
  "minimized_config": {
    "color": "rgb(88, 28, 135)",
    "customIconFile": "trigger.svg"
  },
  "height": 720,
  "width": 560,
  "when": "Boolean({{config.enableFloatingFrames}})"
}

```

### `src/floatingFrames/iframeBridge/eventScripts/notifyReceived.js`

```javascript
// Kitchen Sink App · Floating Frame · Iframe Bridge · notifyReceived
//
// eventScripts receive whatever object was passed as runFrameScript()'s third argument as
// `this.args`. Here, the { action, content } message.js relayed from the framed page.
//
// Empty strings are real payloads on this path (the harness posts content: "" when its input
// is blank), so filter on truthiness - `??` would pass "" through and render a bare toast.

const parts = [this.args.action, this.args.content].filter(Boolean);

this.showToast(`Frame received: ${parts.length ? parts.join(" · ") : "(empty message)"}`);

```

### `src/floatingFrames/iframeBridge/message.js`

```javascript
// Kitchen Sink App · Floating Frame · Iframe Bridge · message
//
// Runs whenever the framed page posts a message up through the proxy. The relayed payload
// always arrives as `this.args.eventData` — by the time this script runs the proxy's own
// envelope has already been unwrapped, so this is exactly what the framed page passed to
// `window.parent.postMessage(...)`, e.g. { action: "hypothesis-test", content: "<input>" }.
const eventData = this.args.eventData;

this.console.log(eventData);

// Dispatch to this same frame's own eventScript, which surfaces the message as a toast.
// runFrameScript's first argument is the receiving frame's api_name — it must match
// config.json's `api_name` (or the sanitized folder-name default, if that key is omitted).
// This message.js → eventScript hop is how a real integration reacts to what the framed page
// just said (e.g. a phone dialer routing an inbound event to call-handling logic).
this.communicate.runFrameScript("iframe_bridge", "notifyReceived", {
  action: eventData?.action,
  content: eventData?.content,
});

// Echo an acknowledgement down into the frame. The message-stream harness renders whatever it
// receives, so this ack appears inside the iframe itself — proving the bridge is two-way, not
// just an inbound-only relay.
this.communicate.sendMessageToOwnFrame(
  { action: "kitchen-sink-ack", receivedContent: eventData?.content },
  "*",
);

```

### `src/floatingFrames/iframeBridge/script.js`

```javascript
// Kitchen Sink App · Floating Frame · Iframe Bridge
//
// Embeds an external page with this.outputIframe(url).
// The embedded page displays incoming frame messages for debugging purposes.

this.outputIframe("https://hypothesis.sh/message-stream");

```

### `src/floatingFrames/iframeBridge/trigger.svg`

[Image file: src/floatingFrames/iframeBridge/trigger.svg]

### `src/floatingFrames/iframeScoped/config.json`

```json
{
  "name": "Iframe Scoped",
  "api_name": "iframe_scoped",
  "title": "Iframe Scoped",
  "header_color": "#1d4ed8",
  "header_text_color": "white",
  "default_position": "bottom-right",
  "minimized_style": "bar",
  "height": 640,
  "width": 480,
  "when": "Boolean({{config.enableFloatingFrames}})"
}

```

### `src/floatingFrames/iframeScoped/script.js`

```javascript
// Kitchen Sink App · Floating Frame · Iframe Scoped
//
// Embeds an external page with this.outputIframe(url, allow). The allow array is origin-scoped
// least-privilege: "microphone https://hypothesis.sh" grants mic to that origin with no
// re-delegation ("microphone *" would allow it). The scoped origin must exactly match the framed
// URL's origin, and the URL needs an explicit https scheme (the proxy rejects non-HTTPS).

this.outputIframe("https://hypothesis.sh/message-stream", [
  "microphone https://hypothesis.sh",
]);

```

### `src/floatingFrames/scriptWidget/config.json`

```json
{
  "name": "Script Widget",
  "api_name": "script_widget",
  "title": "Script Widget",
  "header_color": "teal",
  "header_text_color": "white",
  "default_position": "bottom-left-fixed",
  "minimized_style": "circle",
  "minimized_config": {
    "icon": "window-restore",
    "color": "teal"
  },
  "height": 420,
  "width": 320,
  "when": "Boolean({{config.enableFloatingFrames}})"
}

```

### `src/floatingFrames/scriptWidget/eventScripts/collapse.js`

```javascript
// Kitchen Sink App · Floating Frame · Script Widget · collapse
//
// Frame-only context method. Collapses the frame down to its minimized circle trigger without
// removing it from view. Contrast with hide(), which hides the frame entirely.

this.collapse();

```

### `src/floatingFrames/scriptWidget/eventScripts/expand.js`

```javascript
// Kitchen Sink App · Floating Frame · Script Widget · expand
//
// Frame-only context method - the inverse of collapse(); restores the frame to its full size.

this.expand();

```

### `src/floatingFrames/scriptWidget/eventScripts/fetchJoke.js`

```javascript
// Kitchen Sink App · Floating Frame · Script Widget · fetchJoke
//
// Same dad_jokes contract this plugin's actions and route scripts use: getServiceUrl() resolves
// the declared service, and getWithErrors() returns a [data, error] tuple instead of throwing

const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

const [jokeResponse, jokeError] = await this.getWithErrors(
  this.getServiceUrl("dad_jokes", "/"),
);

if (jokeError) {
  this.showToast(`Could not fetch a dad joke: ${describeError(jokeError)}`, {
    variant: "failure",
    autohide: false,
  });

  return;
}

this.showToast(jokeResponse?.joke ?? JSON.stringify(jokeResponse), {
  variant: "success",
});

```

### `src/floatingFrames/scriptWidget/eventScripts/hide.js`

```javascript
// Kitchen Sink App · Floating Frame · Script Widget · hide
//
// Frame-only context method - hides the whole floating frame (header + body). The minimized
// trigger stays visible by default so the frame can be reopened.

this.hide();

```

### `src/floatingFrames/scriptWidget/eventScripts/hideHeader.js`

```javascript
// Kitchen Sink App · Floating Frame · Script Widget · hideHeader
//
// Frame-only context method - removes the header bar (title + drag handle) while leaving the
// body content visible.

this.hideHeader();

```

### `src/floatingFrames/scriptWidget/eventScripts/showHeader.js`

```javascript
// Kitchen Sink App · Floating Frame · Script Widget · showHeader
//
// Frame-only context method - restores the header removed by hideHeader().

this.showHeader();

```

### `src/floatingFrames/scriptWidget/script.js`

```javascript
// Kitchen Sink App · Floating Frame · Script Widget
//
// A script-rendered frame paints markup with this.outputUI and wires interactivity through
// data-script buttons linked to handlers in eventScripts/. Five buttons each call one frame-only context method
// (hide/collapse/expand/hideHeader/showHeader). hideHeader/showHeader are honored only on fixed
// frames (default_position *-fixed - a non-fixed frame is dragged by its header) so this one is
// bottom-left-fixed. Fixed frames also require minimized_style "circle": the engine positions a
// fixed frame by anchoring it to its minimized circle trigger element, so a fixed frame with the
// "bar" style has nothing to anchor to and never repositions on browser resize. The sixth button
// reuses the dad_jokes service to show a frame is a full worker context. show() is called
// automatically, so nothing here explicitly needs to show the initial frame.

this.outputUI(`
  <div class="sw-widget">
    <p class="sw-lead">Frame chrome + dad_jokes demo</p>
    <div class="sw-buttons">
      <button class="sw-btn" data-script="hide">hide()</button>
      <button class="sw-btn" data-script="collapse">collapse()</button>
      <button class="sw-btn" data-script="expand">expand()</button>
      <button class="sw-btn" data-script="hideHeader">hideHeader()</button>
      <button class="sw-btn" data-script="showHeader">showHeader()</button>
      <button class="sw-btn sw-btn--accent" data-script="fetchJoke">Fetch a dad joke</button>
    </div>
  </div>
`);

```

### `src/floatingFrames/scriptWidget/styles.css`

```css
/* Kitchen Sink App · Floating Frame · Script Widget · styles */

.sw-widget {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.sw-lead {
  margin: 0;
  font-size: 13px;
  color: #475569;
}

.sw-buttons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sw-btn {
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #0f172a;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.sw-btn:hover {
  background: #eef2f7;
}

.sw-btn--accent {
  background: #0f766e;
  border-color: #0f766e;
  color: #ffffff;
}

.sw-btn--accent:hover {
  background: #0c5f59;
}

```

### `src/objectSettingsItems/inspectObject/config.json`

```json
{
  "label": "Inspect Object",
  "api_name": "inspect_object",
  "when": "Boolean({{config.enableObjectSettingsItem}})"
}

```

### `src/objectSettingsItems/inspectObject/script.js`

```javascript
// Kitchen Sink App · Object Settings Item · Inspect Object
//
// Appears in the settings dropdown on an object's Record list page. Runs in the record-detail
// worker with an object context only: this.objectId is set, this.entityId is empty, so
// this.currentObject() works but this.currentEntity() is undefined. The return value is discarded;
// act through side effects. Shown only when config's `when` (over {{config.*}}) is true; that
// result is the object-settings visibility guard. config.json reads { label, api_name, when }.

const object = await this.currentObject();

if (!object) {
  return;
}

// object-detail always carries object_name/entity_name/object_type plus fields/related_objects.
const fieldCount = object.fields.length;
const relatedCount = object.related_objects.length;

this.console.log("Inspected object:", object);

this.showToast(
  `${object.object_name} (record: "${object.entity_name}") — ${object.object_type}, ${fieldCount} field(s), ${relatedCount} related object(s).`,
  { variant: "success", autohide: false },
);

```

### `src/pages/appPage/config.json`

```json
{
  "name": "Kitchen Sink Page",
  "api_name": "app_page",
  "is_toolbar_item": true,
  "toolbar_icon": "globe",
  "toolbar_color": "#0ea5e9"
}

```

### `src/pages/appPage/eventScripts/authorizeGoogle.js`

```javascript
// Kitchen Sink App · Page · App Page · authorizeGoogle
//
// Fired on click of the "Authorize Google" button. this.authorize opens the service's OAuth
// authorization URL in a new tab. Optional
// successRedirectPath / errorRedirectPath become query params on that URL; omitted, both default
// to /marketplace/<plugin>/auth.
//
// The call is fire-and-forget: the flow finishes in the new tab, which the backend redirects to
// the success/error path. Nothing is delivered back to this page - check the marketplace
// Authorization panel (it refetches on window focus) for the outcome.
//
// This is a page-side consumer of the google_user (user-level OAuth) service declared in
// kizen.json.

this.authorize("google_user");

```

### `src/pages/appPage/eventScripts/greet.js`

```javascript
// Kitchen Sink App · Page · App Page · greet
//
// Fired on submit of the <form data-script="greet"> in script.js. Form values arrive
// array-wrapped, one array per field name ("your-name": ["Jane"]) - the same shape
// showViewInModal form results use. The name input is marked `required`, so the browser blocks
// an empty submit before this script runs.
//
// The field is "your-name", not "name": DOMPurify's clobbering protection strips name
// attributes whose value collides with a document/form property (see script.js).

const payload = this.args?.formData ?? {};

const first = (key) => payload[key]?.[0];

const name = first("your-name");
const mood = first("mood");

this.showToast(`Hello, ${name}! Logged as "${mood}".`, { variant: "success" });

```

### `src/pages/appPage/script.js`

```javascript
// Kitchen Sink App · Page · App Page
//
// A routable full-page app page at /plugins/kitchen_sink/app_page, also reachable from a global
// toolbar entry (note config.json's is_toolbar_item). It paints markup with this.outputUI from a worker
// (no DOM), so interactivity flows through data-script calling eventScripts/: <form data-script="greet">
// calls greet.js (fields on this.args.formData, array-wrapped)
//
// The authorizeGoogle button runs its defined event script. this.args is the URL query parsed to an
// object (?ref=email becomes { ref: "email" });
//
// The engine also injects internal keys, filtered below.
//
// Field-name gotcha: outputUI markup is sanitized with DOMPurify, whose DOM-clobbering
// protection strips any name/id attribute whose VALUE is a property of document or of a form
// element (name, id, action, method, title, length, ...). An <input name="name"> silently loses
// its name and never reaches formData - hence "your-name" below.

const INTERNAL_ARG_KEYS = new Set(["pluginId", "__kizen_user_config"]);

const queryArgs = Object.entries(this.args ?? {}).filter(
  ([key]) => !INTERNAL_ARG_KEYS.has(key),
);

const argsMarkup = queryArgs.length
  ? `<ul class="ks-args">${queryArgs
      .map(
        ([key, value]) =>
          `<li><code>${key}</code> = <code>${String(value)}</code></li>`,
      )
      .join("")}</ul>`
  : `<p class="ks-muted">No query parameters. Append <code>?ref=email</code> to the URL and reload to see them arrive as <code>this.args</code>.</p>`;

this.outputUI(`
  <div class="ks-page">
    <header class="ks-hero">
      <h1>Kitchen Sink Page</h1>
      <p>A routable plugin page rendered with <code>outputUI</code>. The worker has no live DOM, so
      every button and form below is wired through <code>data-script</code>.</p>
    </header>

    <section class="ks-card">
      <h2>Query arguments</h2>
      <p class="ks-muted">The page URL's query string arrives as <code>this.args</code>.</p>
      ${argsMarkup}
    </section>

    <section class="ks-card">
      <h2>Form &rarr; event script</h2>
      <p class="ks-muted">Submitting runs <code>eventScripts/greet.js</code> with the fields under
      <code>this.args.formData</code>.</p>
      <form class="ks-form" data-script="greet">
        <label>Your name
          <input name="your-name" type="text" placeholder="Jane" required />
        </label>
        <label>Mood
          <select name="mood">
            <option value="curious">Curious</option>
            <option value="delighted">Delighted</option>
            <option value="skeptical">Skeptical</option>
          </select>
        </label>
        <button type="submit">Greet me</button>
      </form>
    </section>

    <section class="ks-card">
      <h2>OAuth authorize</h2>
      <p class="ks-muted">Opens the Google authorization flow in a new tab. When the flow
      completes, that tab lands on the plugin's marketplace Authorization panel, which shows the
      result.</p>
      <button type="button" class="ks-btn" data-script="authorizeGoogle">Authorize Google</button>
    </section>
  </div>
`);

```

### `src/pages/appPage/styles.css`

```css
/* Kitchen Sink App · Page · App Page · styles */

/* Scoped by the engine at inject time (wrapped in @scope) — plain selectors are safe in modern browsers. */

.ks-page {
  max-width: 760px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  font-family:
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
  color: #0f172a;
}

.ks-hero {
  margin-bottom: 24px;
}

.ks-hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
  font-weight: 700;
}

.ks-hero p {
  margin: 0;
  color: #475569;
  line-height: 1.5;
}

.ks-card {
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  background: #ffffff;
}

.ks-card h2 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 600;
}

.ks-muted {
  margin: 0 0 12px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.5;
}

.ks-args {
  margin: 0;
  padding-left: 18px;
  line-height: 1.7;
}

code {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-size: 13px;
  background: #f1f5f9;
  padding: 1px 5px;
  border-radius: 4px;
}

.ks-form {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: flex-end;
}

.ks-form label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #334155;
}

.ks-form input,
.ks-form select {
  min-width: 200px;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 14px;
}

.ks-form button,
.ks-btn {
  padding: 9px 16px;
  border: none;
  border-radius: 8px;
  background: #0ea5e9;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.ks-form button:hover,
.ks-btn:hover {
  background: #0284c7;
}

```

### `src/routeScripts/detailsGate/config.json`

```json
{
  "name": "Details Tab Gate",
  "api_name": "details_gate",
  "hint_object_name": "client_client",
  "routes": ["/details"]
}

```

### `src/routeScripts/detailsGate/script.js`

```javascript
// Kitchen Sink App · Route Script · Details Gate
//
// A blocking, route-filtered route script (contrast the always-on, non-blocking routeChangeLogger).
// `routes: ["/details"]` is a regex list tested against the pathname, so it fires on the Details
// tab only. Whether a route script blocks the render is set at install time, not in config.
//
// The engine auto-releases the block when the script settles (return or throw), so no call is
// needed to avoid a hang. this.releaseBlockingScript() here releases early: it paints after the
// essential check, then runs non-essential work while the page is already visible.

// The gating check the page waits on. currentEntity() resolves the record (client/custom/pipeline);
// on failure it toasts and returns undefined (no throw).
const entity = await this.currentEntity();

// Essential check done — release so the page paints now; the rest runs while it's visible.
this.releaseBlockingScript();

if (!entity) {
  return;
}

// Non-essential follow-up, after the release. getWithErrors returns an error instead of throwing.
const [tip, tipError] = await this.getWithErrors(
  this.getServiceUrl("dad_jokes", "/"),
);

this.showToast(
  tipError
    ? `Details gate cleared for record ${this.entityId}.`
    : `Details gate cleared for record ${this.entityId}. Tip of the day: ${tip?.joke ?? ""}`,
  { variant: "success" },
);

```

### `src/routeScripts/routeChangeLogger/config.json`

```json
{
  "name": "Route Change Logger",
  "api_name": "route_change_logger",
  "hint_object_name": "client_client",
  "routes": []
}

```

### `src/routeScripts/routeChangeLogger/script.js`

```javascript
// Kitchen Sink App · Route Script · Route Change Logger
//
// Runs on every record-detail page of its bound object: a non-blocking observer with empty
// routes:[], which means "every tab" (contrast the filtered, blocking detailsGate). The engine
// hands it the navigation transition on this.args (previousRoute/currentRoute) plus this.location and the
// record ids. Has the record-detail context but no DOM; this.openWindow(url, target) can drive
// in-app nav for a relative url with a non-"_blank" target.

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

### `src/setupAssistant/assistant.json`

```json
{
  "services": [
    {
      "api_name": "google_business",
      "required": false,
      "prerequisite": true
    }
  ],
  "actions": [
    "dad_joke_writeback",
    "failure_modes_demo",
    "perform_action_demo"
  ],
  "fields": [
    {
      "type": "description",
      "key": "assistantIntro",
      "content": "This assistant demonstrates **every setup-assistant field type**. The values you save here become the plugin's install config: scripts read them as `this.config.<key>`, and artifact configs can gate themselves with `\"when\": \"Boolean({{config.<key>}})\"` conditions. Description fields like this one support **markdown**."
    },
    {
      "type": "container",
      "columns": 2,
      "label": "Feature Toggles",
      "key": "featureToggles",
      "fields": [
        {
          "type": "boolean",
          "label": "Enable Floating Frames",
          "key": "enableFloatingFrames",
          "default": true,
          "tooltip": "Reserved for the floating-frame surfaces of this plugin."
        },
        {
          "type": "boolean",
          "label": "Enable Data Adornments",
          "key": "enableAdornments",
          "default": true,
          "tooltip": "Reserved for the data-adornment surfaces of this plugin."
        },
        {
          "type": "boolean",
          "label": "Enable Object Settings Item",
          "key": "enableObjectSettingsItem",
          "default": true,
          "tooltip": "Reserved for the object-settings surface of this plugin."
        },
        {
          "type": "boolean",
          "label": "Enable Context Dump Toolbar Item",
          "key": "enableContextDump",
          "default": true,
          "tooltip": "Turn this off and the Context Dump toolbar item disappears — its config.json has a when-condition on this value."
        },
        {
          "type": "boolean",
          "label": "Enable Blocks",
          "key": "enableBlocks",
          "default": true,
          "tooltip": "Turn this off to hide the Dashboard and Homepage blocks from their pickers — both have a when-condition on this value. The Chart Group and Record blocks omit when, so they stay available."
        }
      ]
    },
    {
      "type": "description",
      "key": "contextDumpHiddenNote",
      "content": "<p style=\"color: #b45309;\">The <strong>Context Dump</strong> toolbar item is now hidden. This note is itself a demo: descriptions support HTML too, and any field can carry a <code>when</code> condition over other fields' values.</p>",
      "when": "{{enableContextDump}} === false"
    },
    {
      "type": "container",
      "columns": 2,
      "label": "Basic Inputs",
      "key": "basicInputs",
      "fields": [
        {
          "type": "text",
          "label": "Context Value",
          "key": "contextValue",
          "required": true,
          "default": "kitchen-sink-demo",
          "validation_pattern": "^[a-z0-9-]+$",
          "tooltip": "A demo string scripts read back as this.config.contextValue. Lowercase letters, digits, and dashes only (validation_pattern)."
        },
        {
          "type": "number",
          "label": "Demo Number",
          "key": "demoNumber",
          "required": false,
          "tooltip": "An optional number input. Left blank, the key is simply absent from the saved config."
        },
        {
          "type": "select",
          "label": "Demo Choice",
          "key": "demoChoice",
          "required": false,
          "placeholder": "Pick one",
          "options": [
            { "label": "Alpha", "value": "alpha" },
            { "label": "Beta", "value": "beta" },
            { "label": "Gamma", "value": "gamma" }
          ]
        },
        {
          "type": "select",
          "label": "Demo Multi-Choice",
          "key": "demoMultiChoice",
          "allow_multiple": true,
          "placeholder": "Pick any number",
          "options": [
            { "label": "One", "value": "one" },
            { "label": "Two", "value": "two" },
            { "label": "Three", "value": "three" }
          ]
        }
      ]
    },
    {
      "type": "boolean",
      "label": "Configure a Demo Object?",
      "key": "configureDemoObject",
      "default": false,
      "tooltip": "Unlocks the object and field pickers below — they need an object to pick fields from."
    },
    {
      "type": "custom_object",
      "label": "Demo Object",
      "key": "demoObjectId",
      "required": true,
      "when": "{{configureDemoObject}} === true",
      "match_hint": "client_client",
      "tooltip": "A Kizen object picker. match_hint pre-selects an object whose api_name matches, when one exists."
    },
    {
      "type": "container",
      "columns": 2,
      "label": "Field Pickers",
      "key": "fieldPickers",
      "when": "{{configureDemoObject}} === true",
      "fields": [
        {
          "type": "field",
          "label": "Demo Name Field",
          "key": "demoNameField",
          "required": false,
          "match_hint": "name",
          "object_id": "{{demoObjectId}}",
          "tooltip": "A single field picker, scoped to the demo object chosen above via object_id templating."
        },
        {
          "type": "field",
          "label": "Demo Fields (multi)",
          "key": "demoFields",
          "required": false,
          "allow_multiple": true,
          "object_id": "{{demoObjectId}}"
        }
      ]
    },
    {
      "type": "container",
      "columns": 2,
      "label": "Google Calendar (async selects)",
      "key": "googleCalendarSection",
      "fields": [
        {
          "type": "description",
          "key": "asyncSelectsIntro",
          "content": "These two selects fetch their options live through the `google_business` service proxy — authorize that service (the prerequisite step at the top of this assistant) before using them. The calendar select auto-picks when exactly one calendar comes back (`autoSelect`); the events select re-fetches whenever the calendar changes (`dependencies`)."
        },
        {
          "type": "select",
          "label": "Google Calendar",
          "key": "googleCalendar",
          "required": false,
          "autoSelect": true,
          "tooltip": "Options come from setupAssistant/googleCalendar/getFetchUrl.js + optionMapper.js."
        },
        {
          "type": "select",
          "label": "Calendar Events",
          "key": "googleCalendarEvents",
          "required": false,
          "allow_multiple": true,
          "dependencies": ["googleCalendar"],
          "tooltip": "Re-fetches when the calendar above changes. Falls back to the primary calendar when none is picked."
        }
      ]
    },
    {
      "type": "container",
      "columns": 3,
      "label": "Static Content",
      "key": "staticContent",
      "fields": [
        {
          "type": "image",
          "key": "demoImage",
          "src": "https://placehold.co/240x80/4f46e5/ffffff?text=Kitchen+Sink",
          "title": "Kitchen Sink demo image",
          "width": 240,
          "link": {
            "text": "Kizen",
            "href": "https://kizen.com"
          }
        },
        {
          "type": "qr",
          "key": "demoQr",
          "value": "/mobile-setup",
          "include": ["email", "business_id"],
          "size": 160
        },
        {
          "type": "link",
          "key": "demoLink",
          "text": "Kizen Documentation",
          "href": "https://docs.kizen.com"
        }
      ]
    }
  ]
}

```

### `src/setupAssistant/googleCalendar/getFetchUrl.js`

```javascript
// Kitchen Sink App · Setup Assistant · googleCalendar · getFetchUrl
//
// Builds the URL the host fetches this select's options from. Runs in the browser (not a
// worker), with `state` holding every assistant field's current value plus pluginApiName.
// The URL goes through the service proxy, so the google_business token is injected
// server-side. Authorize that service first, or this returns an auth error.

({ state }) => {
  return `/external-integrations/proxy/${state.pluginApiName}/google_business/calendar/v3/users/me/calendarList`;
};

```

### `src/setupAssistant/googleCalendar/optionMapper.js`

```javascript
// Kitchen Sink App · Setup Assistant · googleCalendar · optionMapper
//
// Maps the fetch response (on state.result) to select options. Google's calendarList
// nests the calendars under data.items.

({ state }) => {
  const calendars = state.result?.data?.items ?? [];

  return calendars.map((calendar) => {
    return {
      label: calendar.summary,
      value: calendar.id,
    };
  });
};

```

### `src/setupAssistant/googleCalendarEvents/getFetchUrl.js`

```javascript
// Kitchen Sink App · Setup Assistant · googleCalendarEvents · getFetchUrl
//
// A dependent async select: assistant.json declares dependencies: ["googleCalendar"], so
// the host re-runs this fetch whenever that field changes. Another field's value is read
// from state, and a picked select is a {label, value} option object, hence .value?.value.

({ state }) => {
  // Fall back to Google's "primary" calendar alias so the URL is valid before a
  // calendar has been picked.
  const calendarId = state.googleCalendar?.value?.value || "primary";

  return `/external-integrations/proxy/${
    state.pluginApiName
  }/google_business/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?maxResults=25`;
};

```

### `src/setupAssistant/googleCalendarEvents/optionMapper.js`

```javascript
// Kitchen Sink App · Setup Assistant · googleCalendarEvents · optionMapper

({ state }) => {
  const events = state.result?.data?.items ?? [];

  return events.map((event) => {
    return {
      // Events created without a title have no summary at all.
      label: event.summary || "(untitled event)",
      value: event.id,
    };
  });
};

```

### `src/thumbnail.png`

[Image file: src/thumbnail.png]

### `src/toolbarItems/authorizeService/config.json`

```json
{
  "api_name": "authorize_service",
  "label": "Authorize Google",
  "icon": "key",
  "color": "#dc2626"
}

```

### `src/toolbarItems/authorizeService/script.js`

```javascript
// Kitchen Sink App · Toolbar Item · Authorize Service
//
// Starts the OAuth flow for the google_user service (user-level token). this.authorize(service)
// opens the authorize endpoint in a new tab, with nothing to await. By
// default it redirects back to /marketplace/{plugin}/auth ({successRedirectPath, errorRedirectPath}
// override that). Afterward, this.getWithErrors(this.getServiceUrl("google_user", ...)) makes calls
// authorized using the token.

this.authorize("google_user");

this.showToast(
  "Google authorization opened in a new tab. Finish there, then come back.",
  { variant: "alert" },
);

```

### `src/toolbarItems/contextDump/config.json`

```json
{
  "api_name": "context_dump",
  "label": "Context Dump",
  "icon": "list-tree",
  "color": "#059669",
  "when": "Boolean({{config.enableContextDump}})"
}

```

### `src/toolbarItems/contextDump/script.js`

```javascript
// Kitchen Sink App · Toolbar Item · Context Dump
//
// Dumps what a toolbar-item script can see: the base worker context (business-level, no record
// context). Open the console before running. It also shows `when` gating. config.json's
// "when": "Boolean({{config.enableContextDump}})" hides the item when that setup-assistant toggle
// is off, with no code involved. (Artifact configs use {{config.<key>}}; assistant when-conditions
// use bare {{<key>}}.)

// Business-level install config (setup-assistant values).
this.console.log("config:", this.config);

// Per-user config (user setup assistant).
this.console.log("userConfig:", this.userConfig);

// Who is running the script, and where.
this.console.log("currentUser:", this.currentUser);
this.console.log("currentBusiness:", this.currentBusiness);

// this.location is a guarded partial window.location — reading a missing property throws.
this.console.log("location:", this.location);

// The Kizen app's base path — what relative this.getWithErrors/this.postWithErrors URLs resolve against.
this.console.log("applicationPath:", this.applicationPath);

this.showToast("Context dumped — open the browser console to inspect it.", {
  variant: "success",
});

```

### `src/toolbarItems/dataOut/config.json`

```json
{
  "api_name": "data_out",
  "label": "Data Out",
  "icon": "file-lines",
  "color": "#0d9488"
}

```

### `src/toolbarItems/dataOut/script.js`

```javascript
// Kitchen Sink App · Toolbar Item · Data Out
//
// Two "send data out" primitives, side by side:
//   uploadFile(blob, fileName?, isPublic?) - uploads a file to Kizen's file store and resolves its
//     metadata. It builds the Blob in the worker (workers have Blob/FileReader), so there's no file
//     input. isPublic defaults false.
//   postFormData(url, data, createNewTab?) - submits a classic HTML <form> POST to any URL, bypassing
//     the JSON helpers and the proxy. createNewTab defaults true.
//

const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

const result = await this.dynamicPrompt({
  title: "Data Out",
  size: "small",
  confirmButton: { label: "Run", variant: "standard", color: "primary" },
  cancelButton: { label: "Cancel", variant: "text", color: "secondary" },
  content: [
    {
      type: "description",
      widthPercent: 100,
      content:
        "Pick a primitive. Upload sends a file to Kizen; Form POST submits a form to an external URL (new tab).",
    },
    {
      type: "select",
      label: "Primitive",
      key: "mode",
      required: true,
      placeholder: "Choose one",
      widthPercent: 100,
      options: [
        { label: "Upload a file to Kizen (uploadFile)", value: "upload" },
        {
          label: "POST a form to an external URL (postFormData)",
          value: "form",
        },
      ],
    },
  ],
});

if (result.canceled) {
  return;
}

const mode = result.values.mode.value;

if (mode === "upload") {
  // Build a small text file in the worker.
  const blob = new Blob(
    [`Kitchen Sink upload at ${new Date().toISOString()}\n`],
    {
      type: "text/plain",
    },
  );

  try {
    // Upload a private file
    const uploaded = await this.uploadFile(
      blob,
      "kitchen-sink-demo.txt",
      false,
    );

    this.console.log("uploadFile() resolved with:", uploaded);

    this.showToast(
      "Uploaded a demo text file to Kizen — details in the console.",
      {
        variant: "success",
      },
    );
  } catch (error) {
    this.showToast(`Upload failed: ${describeError(error)}`, {
      variant: "failure",
      autohide: false,
    });
  }
  return;
}

// mode === "form": POST a form to httptest; it echoes back in a new tab (createNewTab defaults true).
try {
  await this.postFormData("https://hypothesis.sh/api/httptest/post", {
    source: "kitchen-sink",
    submittedAt: new Date().toISOString(),
  });

  this.showToast(
    "Submitted a form POST — check the new tab for httptest's echo.",
    {
      variant: "success",
    },
  );
} catch (error) {
  this.showToast(`Form POST failed: ${describeError(error)}`, {
    variant: "failure",
    autohide: false,
  });
}

```

### `src/toolbarItems/dynamicPromptTour/config.json`

```json
{
  "api_name": "dynamic_prompt_tour",
  "label": "Prompt Tour",
  "icon": "list-dropdown",
  "color": "#0891b2"
}

```

### `src/toolbarItems/dynamicPromptTour/script.js`

```javascript
// Kitchen Sink App · Toolbar Item · Dynamic Prompt Tour
//
// The `this.dynamicPrompt` catalog includes every input type
//
// dynamicPrompt content items are identified by `key`, and each value is returned under
// result.values.<key>. The select type is `select` (single or multi-select with allow_multiple.

const result = await this.dynamicPrompt({
  title: "Dynamic Prompt Tour",
  confirmButton: { label: "Submit", variant: "standard" },
  cancelButton: { label: "Cancel", variant: "text" },
  size: "medium",
  content: [
    {
      type: "description",
      widthPercent: 100,
      content:
        "One of every input type. Required fields (✱) are enforced by the host — " +
        "Submit won't proceed until they're filled, so scripts never re-check them.",
    },
    {
      // Text inputs yield result.values.full_name as a plain string ("Jane"), unlike
      // showViewInModal form fields, which are always array-wrapped (["Jane"]) to
      // account for an unknown number of fields or forms.
      type: "text",
      label: "Full name",
      key: "full_name",
      required: true,
      tooltip: "Text fields support required, tooltip, and placeholder.",
      placeholder: "e.g. Jane Smith",
      widthPercent: 100,
    },
    {
      type: "text",
      label: "Nickname",
      key: "nickname",
      default: "none",
      widthPercent: 100,
    },
    {
      type: "number",
      label: "Team size",
      key: "team_size",
      placeholder: "e.g. 12",
      widthPercent: 100,
    },
    {
      type: "boolean",
      label: "Subscribe to updates",
      key: "subscribed",
      default: true,
      widthPercent: 100,
    },
    {
      // Select result is the whole selected option object
      // ({label, value}), not just the value string. Useful for displaying chosen results later.
      type: "select",
      label: "Priority",
      key: "priority",
      required: true,
      placeholder: "Pick a priority",
      widthPercent: 100,
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    },
    {
      type: "select",
      label: "Region (optional)",
      key: "region",
      placeholder: "Leave me unpicked to see the absent-key case",
      widthPercent: 100,
      options: [
        { label: "North America", value: "na" },
        { label: "Europe", value: "eu" },
        { label: "Asia-Pacific", value: "apac" },
      ],
    },
    {
      // Multi-select (allow_multiple) gicen an array of option objects.
      type: "select",
      label: "Channels",
      key: "channels",
      allow_multiple: true,
      placeholder: "Pick any number",
      widthPercent: 100,
      options: [
        { label: "Email", value: "email" },
        { label: "Phone", value: "phone" },
        { label: "Slack", value: "slack" },
      ],
    },
  ],
});

if (result.canceled) {
  return;
}

const { values } = result;

this.console.log("dynamicPrompt raw result.values:", values);
this.console.log("text (plain string):", values.full_name);
this.console.log("text with default:", values.nickname);
this.console.log("number (Number, absent if blank):", values.team_size);
this.console.log("boolean:", values.subscribed);
this.console.log("select (whole option object):", values.priority);
this.console.log("optional select (absent if unpicked):", values.region);
this.console.log("multi-select (array of option objects):", values.channels);

const channelSummary = (values.channels ?? [])
  .map((option) => option.label)
  .join(", ");

this.showToast(
  `Hi ${values.full_name} — priority ${values.priority.label}, ` +
    `channels: ${channelSummary || "none"}. Full shapes are in the console.`,
  { variant: "success" },
);

```

### `src/toolbarItems/modalLauncher/config.json`

```json
{
  "api_name": "modal_launcher",
  "label": "Modal Launcher",
  "icon": "browser",
  "color": "#4f46e5"
}

```

### `src/toolbarItems/modalLauncher/script.js`

```javascript
// Kitchen Sink App · Toolbar Item · Modal Launcher
//
// The showViewInModal tour: opens a form view, then chains its result into a second modal
// (summaryView) by forwarding formData through args. It covers framed modals (host chrome validates
// and collects the form), frameless modals (frameless: true, the view owns its chrome and closes
// itself), sizes small/medium/large (400/900/1200px), and the result shape
// { canceled, values, eventSource }, with form data at result.values.formData and values
// array-wrapped. The view key is the view's api_name (folder name lowercased unless config.json
// overrides).

const choice = await this.dynamicPrompt({
  title: "Modal Launcher",
  confirmButton: { label: "Open", variant: "standard" },
  cancelButton: { label: "Cancel", variant: "text" },
  size: "small",
  content: [
    {
      type: "select",
      label: "Which form style?",
      key: "style",
      required: true,
      placeholder: "Pick a style",
      widthPercent: 100,
      options: [
        { label: "Framed — host chrome collects the form", value: "framed" },
        { label: "Frameless — the view owns its chrome", value: "frameless" },
      ],
    },
  ],
});

if (choice.canceled) {
  return;
}

// A select's value is the whole selected option ({label, value}), not just the value.
const style = choice.values.style.value;

const formResult =
  style === "framed"
    ? await this.showViewInModal("formview", {
        options: {
          title: "Framed form",
          confirmButton: { label: "Submit" },
          cancelButton: { label: "Never mind" },
          size: "medium",
        },
      })
    : await this.showViewInModal("framelessview", {
        options: { frameless: true, size: "small" },
      });

if (formResult.canceled) {
  this.showToast("Modal canceled — nothing to summarize.", {
    variant: "alert",
  });

  return;
}

// Forward the first modal's data into summaryView (reads this.args.formData). Its own result is
// ignored, it's display-only.
await this.showViewInModal("summaryview", {
  args: { formData: formResult.values.formData },
  options: {
    title: "What the modal returned",
    confirmButton: { label: "Done" },
    size: "large",
  },
});

```

### `src/toolbarItems/userConfigEditor/config.json`

```json
{
  "api_name": "user_config_editor",
  "label": "My Settings",
  "icon": "cog",
  "color": "#7c3aed"
}

```

### `src/toolbarItems/userConfigEditor/script.js`

```javascript
// Kitchen Sink App · Toolbar Item · User Config Editor
//
// Reads and writes this user's config with getUserConfig() / setUserConfig(), the read-write
// counterpart to the read-only this.userConfig getter (which reflects the user setup assistant).
// The bucket is per-user AND per-component, keyed by pluginComponentId under
// /employee/mine/configs/plugins/{pluginId}. setUserConfig shallow-merges, so you can update one
// key without clobbering the rest. Both require an installed plugin component.
//
// To make persistence obvious, this bumps a runCount each run and lets you edit a note.

const saved = (await this.getUserConfig()) ?? {};
const previousNote = typeof saved.note === "string" ? saved.note : "";
const previousRunCount =
  typeof saved.runCount === "number" ? saved.runCount : 0;

this.console.log("getUserConfig() returned:", saved);

const result = await this.dynamicPrompt({
  title: "My Settings",
  size: "small",
  confirmButton: { label: "Save", variant: "standard", color: "primary" },
  cancelButton: { label: "Cancel", variant: "text", color: "secondary" },
  content: [
    {
      type: "description",
      widthPercent: 100,
      content:
        `You've opened this ${previousRunCount} time(s) before. Saving bumps that counter and ` +
        `stores your note — both come back the next time you open it, because they live in your ` +
        `per-user config, not in this script.`,
    },
    {
      type: "text",
      label: "Note to yourself",
      key: "note",
      // Prefill with the saved value so an edit is a true read-modify-write, not a blank overwrite.
      default: previousNote,
      placeholder: "Anything — it persists across runs for you only",
      widthPercent: 100,
    },
  ],
});

if (result.canceled) {
  return;
}

const nextRunCount = previousRunCount + 1;

// Only pass changed keys — setUserConfig merges them into the existing bucket.
const mutation = await this.setUserConfig({
  note: result.values.note,
  runCount: nextRunCount,
});

this.console.log("setUserConfig() persisted; server returned:", mutation);

this.showToast(
  `Saved. Open count is now ${nextRunCount}. Reopen this item to see it read back.`,
  { variant: "success" },
);

```

### `src/userSetupAssistant/assistant.json`

```json
{
  "services": [
    {
      "api_name": "google_user",
      "required": false,
      "prerequisite": true
    }
  ],
  "fields": [
    {
      "type": "description",
      "key": "userAssistantIntro",
      "content": "Unlike the business setup assistant, each user answers this one for **themselves**. The values are user-scoped: scripts read them as `this.userConfig.<key>`, and one user's answers never affect another's. The `google_user` prerequisite above is the user-level OAuth counterpart to the business-level `google_business` service — each user connects their own Google account. (`required` is false here so setup stays completable before OAuth credentials are configured; a real plugin that can't function without the connection would set it to true.)"
    },
    {
      "type": "text",
      "label": "Display Nickname",
      "key": "userNickname",
      "required": false,
      "placeholder": "e.g. KJ",
      "tooltip": "A user-scoped scalar — read back as this.userConfig.userNickname."
    },
    {
      "type": "boolean",
      "label": "Enable My Calendars",
      "key": "enableUserCalendars",
      "default": true
    },
    {
      "type": "select",
      "label": "My Google Calendars",
      "key": "userGoogleCalendars",
      "required": false,
      "allow_multiple": true,
      "when": "Boolean({{enableUserCalendars}})",
      "tooltip": "Fetched through the google_user service proxy with your own token — authorize the service above first."
    }
  ]
}

```

### `src/userSetupAssistant/userGoogleCalendars/getFetchUrl.js`

```javascript
// Kitchen Sink App · User Setup Assistant · userGoogleCalendars · getFetchUrl
//
// Same async-select mechanism as the business assistant's googleCalendar field, but the
// proxy resolves google_user, a user-level OAuth service, so the request carries the
// current user's token and each user sees their own calendars.

({ state }) => {
  return `/external-integrations/proxy/${state.pluginApiName}/google_user/calendar/v3/users/me/calendarList`;
};

```

### `src/userSetupAssistant/userGoogleCalendars/optionMapper.js`

```javascript
// Kitchen Sink App · User Setup Assistant · userGoogleCalendars · optionMapper

({ state }) => {
  const calendars = state.result?.data?.items ?? [];

  return calendars.map((calendar) => {
    return {
      label: calendar.summary,
      value: calendar.id,
    };
  });
};

```

### `src/views/formView/script.js`

```javascript
// Kitchen Sink App · View · Form View
//
// A form view opened with host chrome via showViewInModal("formview", { options: {...} }). The
// host confirm button runs native validation on every <form> (required/type/etc.) and the script
// trusts it, then collects FormData.getAll() into result.values.formData with every value
// array-wrapped ("Jane" → ["Jane"]; two checked boxes → ["email","phone"]). No event script runs
// here, so this view has no eventScripts/, unlike framelessView. Run "Modal Launcher" → "Framed".

this.outputUI(`
<form class="fv-body">
  <div class="fv-field">
    <label class="fv-label" for="fv-full-name">Name</label>
    <input class="fv-input" type="text" id="fv-full-name" name="full-name" placeholder="Jane Smith" required />
  </div>

  <div class="fv-field">
    <label class="fv-label" for="fv-email">Email</label>
    <input class="fv-input" type="email" id="fv-email" name="email" placeholder="jane@example.com" />
  </div>

  <div class="fv-field">
    <label class="fv-label" for="fv-topic">Topic</label>
    <select class="fv-input" id="fv-topic" name="topic">
      <option value="question">Question</option>
      <option value="feedback">Feedback</option>
      <option value="bug-report">Bug report</option>
    </select>
  </div>

  <fieldset class="fv-field fv-fieldset">
    <legend class="fv-label">Contact channels</legend>
    <label class="fv-check"><input type="checkbox" name="channels" value="email" checked /> Email</label>
    <label class="fv-check"><input type="checkbox" name="channels" value="phone" /> Phone</label>
    <label class="fv-check"><input type="checkbox" name="channels" value="slack" /> Slack</label>
  </fieldset>

  <div class="fv-field">
    <label class="fv-label" for="fv-notes">Notes</label>
    <textarea class="fv-input fv-textarea" id="fv-notes" name="notes" placeholder="Anything else?"></textarea>
  </div>
</form>
`);

```

### `src/views/formView/styles.css`

```css
/* Kitchen Sink App · View · Form View · styles */

/* The engine scopes these styles to this view. */

.fv-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.fv-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fv-fieldset {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  margin: 0;
}

.fv-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.fv-check {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #0f172a;
}

.fv-input {
  font: inherit;
  font-size: 14px;
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #0f172a;
  background: #f9fafb;
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;
  box-sizing: border-box;
  width: 100%;
}

.fv-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  background: #ffffff;
}

.fv-textarea {
  resize: vertical;
  min-height: 90px;
}

```

### `src/views/framelessView/eventScripts/cancel.js`

```javascript
// Kitchen Sink App · View · Frameless View · cancel
//
// Runs when the footer's Cancel button is clicked. Resolve the modal with no values and
// canceled=true. The caller sees `result.canceled === true`, the same as a host-chrome cancel.

this.closeModal(undefined, true);

```

### `src/views/framelessView/eventScripts/submit.js`

```javascript
// Kitchen Sink App · View · Frameless View · submit
//
// Runs when the form submits (the footer's type="submit" button). Native validation has already
// passed by this point, since the browser handles required fields.
//
// Form values arrive on `this.args.formData`, keyed by input `name`, with every value
// array-wrapped (FormData.getAll semantics): {"display-name": ["Jane"], ...}. This passes the
// wrapped shape through untouched, and the caller (and summaryView) unwraps it.

this.closeModal({ formData: this.args.formData }, false);

```

### `src/views/framelessView/script.js`

```javascript
// Kitchen Sink App · View · Frameless View
//
// A form view for frameless: true. The host renders no chrome, so the view owns its header,
// footer, and buttons, and closes its own modal. Interactivity is wired via data-script (no DOM):
// the <form>'s data-script="submit" → eventScripts/submit.js (driven by the real submit button, so
// native validation runs first), and the cancel button's data-script="cancel" → cancel.js. Each
// closes the modal with this.closeModal(values, canceled). formView, by contrast, leans on host
// chrome to collect and close. Run "Modal Launcher" → "Frameless".

this.outputUI(`
<form class="flv-layout" data-script="submit">
  <div class="flv-header">
    <h2 class="flv-title">Frameless view</h2>
    <p class="flv-subtitle">No host chrome — this view owns its own header and buttons.</p>
  </div>

  <div class="flv-body">
    <div class="flv-field">
      <label class="flv-label" for="flv-display-name">Display name</label>
      <input class="flv-input" type="text" id="flv-display-name" name="display-name" placeholder="Jane Smith" required />
    </div>

    <div class="flv-field">
      <label class="flv-label" for="flv-message">Message</label>
      <textarea class="flv-input flv-textarea" id="flv-message" name="message" placeholder="Say something..."></textarea>
    </div>
  </div>

  <div class="flv-footer">
    <button class="flv-btn flv-btn--cancel" type="button" data-script="cancel">Cancel</button>
    <button class="flv-btn flv-btn--submit" type="submit">Submit</button>
  </div>
</form>
`);

```

### `src/views/framelessView/styles.css`

```css
/* Kitchen Sink App · View · Frameless View · styles */

/* The view supplies all of its own chrome: a header,
   scrollable body, and button footer, laid out as a full-height column. */

* {
  box-sizing: border-box;
}

.flv-layout {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  margin: 0;
  padding: 16px 0;
}

.flv-header {
  padding: 0 20px 12px;
  border-bottom: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.flv-title {
  margin: 0 0 4px 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1;
  color: #0f172a;
}

.flv-subtitle {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.flv-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.flv-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.flv-label {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}

.flv-input {
  font: inherit;
  font-size: 14px;
  padding: 9px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  color: #0f172a;
  background: #f9fafb;
  transition:
    border-color 120ms ease,
    box-shadow 120ms ease;
  width: 100%;
}

.flv-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
  background: #ffffff;
}

.flv-textarea {
  resize: vertical;
  min-height: 90px;
}

.flv-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px 0;
  border-top: 1px solid #e5e7eb;
  flex-shrink: 0;
}

.flv-btn {
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  transition: background-color 120ms ease;
}

.flv-btn--cancel {
  background: transparent;
  color: #64748b;
  border: 1px solid #e2e8f0;
}

.flv-btn--cancel:hover {
  background: #f8fafc;
}

.flv-btn--submit {
  background: #4f46e5;
  color: #ffffff;
}

.flv-btn--submit:hover {
  background: #4338ca;
}

```

### `src/views/summaryView/script.js`

```javascript
// Kitchen Sink App · View · Summary View
//
// A display-only view with no form and no event scripts. It demonstrates modal chaining: Modal
// Launcher opens a form view, then opens this one with the submitted data forwarded through args
// (read here on this.args). The table shows each field's raw value beside its display value so the
// array-wrapping is visible.

const formData = this.args?.formData ?? {};

// Escape submitted text — outputUI strips scripts, but raw < / & could still break the markup.
const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );

const rows = Object.entries(formData)
  .map(([name, values]) => {
    // Every value is an array (FormData.getAll); join to unwrap singles and multi-value fields alike.
    const display = values.filter((value) => value !== "").join(", ");

    return `
      <tr>
        <td class="sv-name">${escapeHtml(name)}</td>
        <td class="sv-raw"><code>${escapeHtml(JSON.stringify(values))}</code></td>
        <td class="sv-display">${display ? escapeHtml(display) : `<span class="sv-empty">empty</span>`}</td>
      </tr>`;
  })
  .join("");

this.outputUI(`
<div class="sv-body">
  <p class="sv-intro">
    Forwarded from the previous modal via <code>args.formData</code>. Note the raw column:
    every field is array-wrapped, even single inputs.
  </p>
  <table class="sv-table">
    <thead>
      <tr><th>Field</th><th>Raw value</th><th>Display value</th></tr>
    </thead>
    <tbody>
      ${rows || `<tr><td class="sv-empty" colspan="3">No form data was forwarded.</td></tr>`}
    </tbody>
  </table>
</div>
`);

```

### `src/views/summaryView/styles.css`

```css
/* Kitchen Sink App · View · Summary View · styles */

.sv-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

.sv-intro {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.sv-intro code,
.sv-raw code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  background: #f1f5f9;
  border-radius: 4px;
  padding: 1px 5px;
}

.sv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.sv-table th {
  text-align: left;
  font-weight: 600;
  color: #374151;
  padding: 8px 10px;
  border-bottom: 2px solid #e5e7eb;
}

.sv-table td {
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  color: #0f172a;
  vertical-align: top;
}

.sv-name {
  font-weight: 600;
  white-space: nowrap;
}

.sv-empty {
  color: #94a3b8;
  font-style: italic;
}

```
