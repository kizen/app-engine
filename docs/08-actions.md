# Record Actions (JavaScript)

**What this covers.** Plugin-provided JavaScript actions that run against a record: the
`config.json` and script contract, the context an action script receives, writing values back to
records, where actions appear (all of which is install-time association, not manifest), the
create-override mechanism that lets an action replace a native "Add Record" form, the UI available
inside an action, and the failure-mode doctrine.

**See also:** [worker runtime API](04-worker-runtime-api.md) ·
[platform API](05-platform-api.md) ·
[views, modals and forms](10-views-modals-forms.md) ·
[Agentic Workflow steps](07-automation-steps.md) ·
[errors and observability](15-errors-and-observability.md)

---

## Model

An action is a JavaScript script that runs in the browser, in a worker, with **record context**. It
appears in a record's action menu, optionally in the Perform Action menu, and can be wired to
replace an object's native record-creation form.

Publishing the plugin creates an action *template*. Nothing happens until a business **associates**
that template with an object — and that association, along with every option about where the action
shows up, is install-time host-side configuration. Your manifest cannot claim any of it. This is the
single most important thing to internalize about actions, and the cause of most "my action doesn't
appear" reports.

An action runs on the same worker runtime as blocks and toolbar items: no DOM, no
`addEventListener`, a brand-new worker per execution. UI comes from
[`dynamicPrompt` / `showViewInModal` / toasts](10-views-modals-forms.md).

---

## Directory layout

```
src/
  actions/
    <actionDirectory>/
      config.json      # required
      script.js        # required — the action body
```

There are no `eventScripts/` and no `styles.css` for an action. An action that needs interactive
markup opens a [view in a modal](10-views-modals-forms.md); the view owns the markup and its event
scripts.

---

## `config.json`

An action's config is three fields. Everything else about an action is decided at install time.

```json
{
  "name": "Sync Contact",
  "api_name": "sync_contact",
  "hint_object_name": "client_client"
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | Label shown in the record action menu. |
| `api_name` | api-name string | *effectively yes* | The action's stable key. |
| `hint_object_name` | string | no | Object api name to pre-select during install-time association. |

### `name`

The human label a user sees in the record's action menu and in Perform Action. Free text.

### `api_name`

The action's identity. It is half of the composite key `"{plugin_api_name}.{action_api_name}"` that
the host uses to resolve an action, and associations reference it as **plain text** — nothing
enforces referential integrity.

**Always set it explicitly.** Omitted, it is derived from the directory name by lowercasing it,
collapsing hyphen and whitespace runs to `_`, then dropping characters outside `[a-z0-9_]` — which
flattens camelCase, so `syncContact` becomes `synccontact`, and rewrites `sync-contact` to
`sync_contact`. Underscores survive, so `sync_contact` is left alone.

Renaming a published `api_name` silently dangles every existing association and any object whose
create-override points at the old key: nothing errors, the action just stops appearing. Treat it as
immutable once shipped.

### `hint_object_name`

An object api name (for example `client_client`, the contact object) used to **pre-select the
object** in the install-time association UI. It is a convenience for whoever installs the plugin;
it does not restrict the action to that object, does not create an association, and is not read at
run time.

---

## The script contract

`script.js` is a bare script body — no wrapper function, no exports. It runs inside an async IIFE,
so top-level `await` and top-level `return` are both valid.

```js
// Example Plugin · Action · Sync Contact

const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

const [record, readError] = await this.getWithErrors(
  `/records/${this.objectId}/${this.entityId}`,
);

if (readError) {
  this.showToast(`Could not read this record: ${describeError(readError)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}

// … do the work …

this.showToast("Synced.", { variant: "success" });
this.refreshEntity();
```

### Arguments an action script receives

An action's `this.args` is assembled by the host at invocation:

| Key | Source |
|---|---|
| the plugin's business config keys | spread from the install config |
| `pluginId` | the installed plugin's id |
| `objectId` | the object the action was invoked on |
| caller extras | additional keys the invoking surface supplies |

Three injected keys — `pluginId`, `__kizen_user_config`, and `__kizen_clean_config` — are engine
internals; filter them out if you enumerate `this.args`.

Read install configuration through `this.config` (business-level) and `this.userConfig`
(user-level), **not** through `this.args`. `this.args` is invocation context.

`this.config` is a read-only snapshot for the life of the run: a value you write with the platform
API during the action will not appear on `this.config` until the next worker load. Re-read it from
the API if you need to see your own write.

### Return value

For an action invoked from a record's action menu, the return value is **discarded**. Return early
to stop; there is nothing to hand back.

For an action wired as a **create override**, the return value is the contract — see
[Create override](#create-override-replacing-the-native-add-record-form).

### Re-entry

The host guards re-entry while an action is pending: clicking the menu item again during an
in-flight run does not start a second one. You do not need your own busy flag.

---

## Record context on `this`

An action sees up to **two** records: the record whose page you are on (the *host* record), and the
record the action was invoked against (the *action target*), which differs only when the action is
run from a related row.

| Member | Type | Meaning |
|---|---|---|
| `this.objectId` | string | Host object id. |
| `this.entityId` | string | Host record id. |
| `this.currentObject()` | `Promise<object>` | Host object detail — fields, related objects, categories. |
| `this.currentEntity()` | `Promise<object>` | Host record. |
| `this.actionObjectId` | string | Action-target object id — **empty** for a plain record action. |
| `this.actionEntityId` | string | Action-target record id — **empty** for a plain record action. |
| `this.actionEntity()` | `Promise<object>` | Action-target record. |
| `this.pluginApiName` | string | The **runtime** api name of this plugin. |
| `this.currentUser` | object | Everything nests under `.profile`. |
| `this.currentBusiness` | object | Includes `employee_id`, `client_object.id`, `timezone.name`. |

Two traps worth stating up front:

- **`this.currentUser.first_name` is always `undefined` — everything nests under `.profile`.**
  The shape is `{ profile: { id, full_name, first_name, last_name, email, phone, created,
  crm_client_id } }`, so the field you want is `this.currentUser.profile.first_name`.

  Once you are reading the right path, note that **an absent value is `""`, never `undefined`**:
  every field is built with `?? ''`. So `profile.first_name === undefined` is false even for a
  team member with no first name, and a presence check written that way always passes. Test for
  emptiness instead:

  ```js
  const { first_name: firstName } = this.currentUser.profile;
  const greeting = firstName ? `Hi ${firstName}` : "Hi there";
  ```

  This also means `undefined` at `profile.<field>` never signals "missing data" — it signals you
  misspelled the field name.
- **Never hardcode your plugin's api name.** Sandbox and preview builds publish under a suffixed
  api_name, so a literal is wrong there. Always use `this.pluginApiName`.

```js
// Which record am I actually acting on?
const hasActionTarget = Boolean(this.actionObjectId && this.actionEntityId);

const [hostEntity, targetEntity] = await Promise.all([
  this.currentEntity(),
  hasActionTarget ? this.actionEntity() : Promise.resolve(undefined),
]);
```

In a **relationship-add override**, `this.objectId` is the **related** object's id — the object the
new record will be created on, not the object whose page you are on.

---

## Reading and writing records

Actions use the tuple request helpers exclusively — `getWithErrors`, `postWithErrors`,
`patchWithErrors`, `deleteWithErrors` — which resolve `[result, error]` and never throw. See
[worker runtime API](04-worker-runtime-api.md). A relative URL targets the Kizen REST API
authenticated as the acting user; `this.getServiceUrl(service, path)` targets a declared service
through the proxy.

### Field write shapes: `{name, value}` vs `add_values`

Record writes take a `fields` array. Each entry names a field either by `name` (its api name) or by
`id`, and carries **one** of two value shapes:

| Shape | Effect |
|---|---|
| `{ name: "target", value: "…" }` | **Overwrite.** Replaces whatever the field currently holds. |
| `{ name: "joke_log", add_values: ["…"] }` | **Append.** Adds to a multi-value field without removing existing values. |

```js
const [, patchError] = await this.patchWithErrors(
  `/records/${this.objectId}/${this.entityId}`,
  {
    fields: [
      // Overwrite: replaces the current value.
      { name: "target", value: summary },
      // Append: adds to a multi-value field instead of replacing it.
      { name: "joke_log", add_values: [summary] },
    ],
  },
);

if (patchError) {
  this.showToast(`Could not save: ${describeError(patchError)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}

// Repaint the record page so the new values show.
this.refreshEntity();
```

`add_values` on a single-value field is not meaningful; use `value`.

Value formats by field type: dropdown takes the **option id**; relationship takes the **scalar
related-record id**; date takes `"YYYY-MM-DD"`; a files field takes an array of uploaded-file
UUIDs; a phone number accepts a bare `"+1312…"` string. Read-back is enveloped inconsistently —
a value may come back as a raw scalar, as `{value}`, or one level deeper — so unwrap defensively
when reading, even though writing is uniform. Full detail in [platform API](05-platform-api.md).

### Refreshing the UI after a write

A write does not repaint anything. Three methods do:

| Method | Effect |
|---|---|
| `this.refreshEntity()` | Repaint the current record page. |
| `this.refreshEntityForId(id)` | Repaint a specific record. |
| `this.refreshTimelineForId(id)` | Repaint a specific record's timeline. |

Call one after any write the user should see. Skipping this is why an action "didn't work" when it
actually did.

---

## Record lifecycle patterns

### Create

```js
const [created, createError] = await this.postWithErrors(
  `/records/${this.objectId}/add`,
  { fields: [{ name: "name", value: recordName }] },
);

if (createError || !created || created.id == null) {
  this.showToast(
    `Could not create the record: ${describeError(createError) ?? "no id returned"}`,
    { variant: "failure", autohide: false },
  );
  return;
}

const newRecordId = String(created.id);
```

`created.id` may not be a string; `String(...)` it. That coercion is required, not defensive
padding — the create-override contract below rejects a non-string.

### Look up before creating

`GET /records/{object}/lookup?identifier=…` matches on **email for the contact object** and on
**name for every other object**. Only a confirmed **404** justifies creating a record. Creating on
any other error — a 403, a network failure, an ambiguous 500 — is the classic duplicate-data bug:

```js
const [existing, lookupError] = await this.getWithErrors(
  `/records/${objectId}/lookup?identifier=${encodeURIComponent(identifier)}`,
);

if (lookupError) {
  // KizenRequestError carries no `.status` — read the upstream code, then the proxy's.
  const status = lookupError.upstreamStatus ?? lookupError.proxyStatus;

  if (status !== 404) {
    // Unreadable ≠ absent. Do not create.
    this.showToast(`Could not check for an existing record: ${describeError(lookupError)}`, {
      variant: "failure",
      autohide: false,
    });
    return;
  }
}

const recordId = existing?.id ? String(existing.id) : await createRecord();
```

The status read deserves a second look. `KizenRequestError` has **no `.status` property** — the
fields are `proxyStatus`, `upstreamStatus`, `upstreamResponse`, and the inherited `message`. Reading
`lookupError.status` yields `undefined`, `undefined !== 404` is true, and the guard swallows a
genuine 404 into the "unreadable" branch — so the record is never created and the action reports a
failure that did not happen. Read `upstreamStatus ?? proxyStatus` instead: relative-URL platform
calls populate `proxyStatus`, and proxied vendor calls report `proxyStatus: 200` with the real code
in `upstreamStatus`. See [`KizenRequestError`](04-worker-runtime-api.md#kizenrequesterror).

### Confirm before destroying

Confirm every destructive operation with a prompt before issuing it:

```js
const confirm = await this.dynamicPrompt({
  title: "Delete this record?",
  size: "small",
  confirmButton: { label: "Delete it", variant: "standard", color: "primary" },
  cancelButton: { label: "Keep it", variant: "text", color: "secondary" },
  content: [
    {
      type: "description",
      widthPercent: 100,
      content: `Delete "${recordName}"? This cannot be undone.`,
    },
  ],
});

if (confirm.canceled) return;

const [, deleteError] = await this.deleteWithErrors(`/records/${objectId}/${recordId}`);
```

Always guard `result.canceled` before touching `result.values` — a dismissed prompt has no values.

### Progress toasts

For a multi-step action, show a progress toast, then `clearToasts()` before showing the outcome so
the two do not stack:

```js
this.showToast("Creating record…", { variant: "success", autohide: true });
// … work …
this.clearToasts();
this.showToast(`Created "${recordName}".`, { variant: "success" });
```

---

## Where an action appears: install-time association

Publishing your plugin creates one action **template** per `src/actions/<dir>`. A template does
nothing on its own. A business connects it to an object with an **association**, and the
association carries the placement options.

**None of this lives in `kizen.json`.** There is no manifest field for it, and there is no way for a
plugin to claim a surface at publish time. The association is created either by the marketplace
Setup Assistant's action-mapping step during install, or by a direct API call.

A setup assistant can *list* the action api_names it wants mapped, which is what drives that step:

```json
// src/setupAssistant/assistant.json
{
  "actions": ["sync_contact", "add_contact"],
  "fields": [ … ]
}
```

The names in that array must match real action api_names — an unknown name fails the package build.
Listing an action here is what gets the association step to offer it; it still does not create the
association by itself.

### `include_perform_action`

A **boolean on the association**, set per (action template, object) pair when a business configures
the plugin — *not* a manifest field, and not something your `config.json` can request.

- `include_perform_action: false` (or absent): the action appears in the record's action menu only.
- `include_perform_action: true`: the action *additionally* appears in the **Perform Action** menu,
  grouped under Agentic Workflows.

This is what people mean by "the bulk action" flavor of a plugin action. One caveat worth knowing
before you design around it: Perform Action for plugin JavaScript actions is wired on the **record
detail page**. Multi-select bulk execution of plugin actions from a list page is not wired today —
write your action to operate on one record.

Because it is an install-time setting, the same action can be a plain record action for one
business and a Perform Action item for another. Write the script so it does not care which menu
launched it.

### Wiring an association from a script

An association can be created directly, which is how a plugin can offer a self-serve "wire me up"
button:

```
POST /external-integrations/browser-js-action-template-association
{
  "browser_js_action_template": { "api_name": "sync_contact", "plugin_app_api_name": "<runtime plugin api name>" },
  "custom_object": { "id": "<object id>" }
}
```

List the current associations with:

```
GET /external-integrations/business-plugin-apps/{identifier}/browser-js-action-template-associations
```

Two behaviors to code around:

- **Duplicates are rejected with a validation error whose message contains "already exists."** The
  machine-readable code is not on the wire, so match the text — and treat that specific rejection
  as **success**, which makes the write idempotent.
- **A read error is not proof of absence.** If listing associations fails, fall through to the
  create and let the duplicate check decide. Treating an unreadable list as "not associated" is
  safe; treating it as "already associated" silently skips the wiring.

```js
const [, createError] = await this.postWithErrors(ASSOC_URL, payload);

if (!createError) {
  associationState = "created";
} else if (/already exists/i.test(errorText(createError))) {
  // The uniqueness rejection confirms the row is already there.
  associationState = "exists";
} else {
  // Real failure.
}
```

Note `errorText` rather than `JSON.stringify`: **`Error.message` is a non-enumerable own property**,
so `JSON.stringify(err)` yields `"{}"` and drops the very text you are matching on. Any script that
branches on error text needs a normalizer that reads `.message` first:

```js
const errorText = (error) => {
  if (typeof error === "string") return error;
  if (!error) return "";
  let body = "";
  try {
    body = JSON.stringify(error);
  } catch {
    body = ""; // circular error object — .message below still carries the signal
  }
  return `${error.message ?? ""} ${body}`.trim();
};
```

---

## Create override: replacing the native "Add Record" form

An object can hand its record-creation flow to a plugin action. When wired, the object's "+ Add"
button — on the list page, and on relationship-field "add related record" controls — runs your
action instead of opening the native create form.

### The composite key

The setting is a custom-object setting named `actionOverrideCreate` (`action_override_create`
snake_case on the wire) whose value is the dot-separated composite:

```
"{plugin_api_name}.{action_api_name}"       e.g. "example_plugin.add_contact"
```

It is **not** a `kizen.json` field. It is set from the object builder's Record Actions section
("Create Record Form" / Add Record Flow), or written directly with
`PATCH /custom-objects/{id}` using the snake_case key. A key in any other format is not an error —
the host simply falls back to the native form.

### It takes two rows, and only one has obvious UI

A working create override requires **both** of:

1. **An association** between the action template and the object — the same
   `BrowserJSActionTemplateAssociation` described above. Publishing creates the app-level template;
   **installing does not create the association.** Only the marketplace Setup Assistant, or a
   direct API call, does.
2. **The object's `action_override_create`** set to the composite key.

**Missing (1) makes the override silently inert.** Without the association the template never
enters the object's action list, so the override string resolves to nothing and "+ Add" falls back
to the native form — with no error, no toast, and nothing in the console. If an override "isn't
running," check the association first; it is almost always the missing half.

Order matters when wiring programmatically: **create the association before writing the override**,
and make any readiness check verify both.

If you write `action_override_create` from a script, do it with no-clobber discipline: read the
object first, skip if it already points at your action, and refuse to overwrite a non-empty value
belonging to someone else. Read with `{ ignoreCache: true }` so you are not deciding on a stale
value:

```js
const [objectSettings] = await this.getWithErrors(`/custom-objects/${objectId}`, {
  ignoreCache: true,
});

const desired = `${this.pluginApiName}.${ACTION_API_NAME}`;
const current = objectSettings?.action_override_create ?? null;

if (current === desired) {
  // already ours — nothing to do
} else if (current) {
  // someone else owns this surface — report, do not overwrite
} else {
  await this.patchWithErrors(`/custom-objects/${objectId}`, {
    action_override_create: desired,
  });
}
```

### The return contract

The override script must **resolve with the created record's id as a non-empty string**. The host
then fetches its display name and completes the flow — inserting it into the relationship field, or
finishing the create.

- A non-empty **string** → the host links the record and continues.
- `undefined`, a bare `return`, or a non-string → the host **no-ops**. Nothing is linked, no error
  is shown.

That is why `String(created.id)` is mandatory rather than cosmetic: an id returned as a number is
silently ignored.

### Three ways to respond

```js
// Example Plugin · Action · Add Related Record  (create override)
//
// A create-override can respond three ways:
//   1. custom         — build the record yourself and return its id (the host links it)
//   2. native         — hand off to the native create modal, then return nothing
//   3. native related — hand off to the native modal, pre-linked to the host record
//
// In a relationship-add override, this.objectId is the RELATED object's id — the object the
// new record is created on.

const relatedObjectId = this.objectId;

const choice = await this.dynamicPrompt({
  title: "Add Related Record",
  size: "small",
  confirmButton: { label: "Continue", variant: "standard", color: "primary" },
  cancelButton: { label: "Cancel", variant: "text", color: "secondary" },
  content: [
    {
      type: "select",
      label: "How should we create it?",
      key: "method",
      required: true,
      placeholder: "Choose a path",
      widthPercent: 100,
      options: [
        { label: "Build it here and return the id", value: "custom" },
        { label: "Native create modal", value: "native" },
        { label: "Native create modal, pre-linked", value: "native_related" },
      ],
    },
  ],
});

if (choice.canceled) return;

// A select resolves to the whole {label, value} option object.
const method = choice.values.method.value;

if (method === "native") {
  await this.openCreateRecordModal(relatedObjectId);
  return; // handed off — no id to return
}

if (method === "native_related") {
  await this.openCreateRelatedRecordModal(relatedObjectId, this.entityId);
  return; // handed off — no id to return
}

const namePrompt = await this.dynamicPrompt({
  title: "Create Related Record",
  size: "small",
  confirmButton: { label: "Create", variant: "standard", color: "primary" },
  cancelButton: { label: "Cancel", variant: "text", color: "secondary" },
  content: [
    { type: "text", label: "Record name", key: "name", required: true, widthPercent: 100 },
  ],
});

if (namePrompt.canceled) return;

// dynamicPrompt text values are plain strings, not array-wrapped.
const name = namePrompt.values.name.trim();

this.showToast("Creating record…", { variant: "success", autohide: true });

const [created, error] = await this.postWithErrors(`/records/${relatedObjectId}/add`, {
  fields: [{ name: "name", value: name }],
});

if (error || !created || created.id == null) {
  this.clearToasts();
  this.showToast(
    `Could not create the record: ${describeError(error) ?? "no id returned"}`,
    { variant: "failure", autohide: false },
  );
  return; // returning nothing is the correct no-op on failure
}

this.clearToasts();

// THE CONTRACT: a non-empty string id. A number is silently ignored.
return String(created.id);
```

### Create override with a custom dialog

When the create form needs more than a couple of fields, keep the action as a **thin launcher** and
put the markup in a frameless view. The view closes itself with the new record's id; the action
converts that to the return value:

```js
// Example Plugin · Action · Add Contact  (create override, dialog-backed)

const result = await this.showViewInModal("addcontactdialog", {
  options: { frameless: true, size: "small" },
});

// Dismissed, canceled, or the view failed to create — leave the field alone.
if (!result || result.canceled) return;

const contactId = result.values?.contactId;

return contactId ? String(contactId) : undefined;
```

The view reports back with `this.closeModal({ contactId }, false)`, which surfaces as
`result.values.contactId`. A view is the right shape here rather than a nested prompt because the
host has a **single app-global modal slot** — a modal cannot open another modal.

### A create-override action can double as a normal action

Because a plain record action's return value is discarded, the same script can serve both roles:
create the record, and return its id at the end. Run from the action menu the id is dropped; run as
an override it completes the link.

---

## UI available inside an action

Actions get the record-detail worker context, which is the fullest UI surface a plugin script has.
All of the following work in an action, including in a create-override action:

| Method | Purpose |
|---|---|
| [`this.dynamicPrompt(config)`](10-views-modals-forms.md) | Quick modal form. Values are **plain scalars**; a select resolves to the whole `{label, value}` option. |
| [`this.showViewInModal(viewApiName, {args, options})`](10-views-modals-forms.md) | Open a named view as a modal. Form values are **array-wrapped**. |
| [`this.showToast(message, options)`](04-worker-runtime-api.md#thisshowtoastmessage-options) | Feedback. `variant: "success" \| "failure" \| "alert"`, `autohide`. |
| `this.clearToasts()` | Clear before replacing a progress toast. |
| `this.setIndicator("spinner" \| "block" \| "button" \| "none")` | Loading affordance; reset on cleanup. |
| `this.openWindow(url, target)` | Relative URL + non-`_blank` target = in-app SPA navigation. |
| `this.copyToClipboard(text)` | — |
| `this.uploadFile(blob, fileName?, isPublic?)` | Resolves file metadata including `id`. |
| `this.openCreateRecordModal(objectId)` | Hand off to the native create form. |
| `this.openCreateRelatedRecordModal(objectId, relatedEntityId)` | Native create form, pre-linked. |
| `this.communicate.runFrameScript(frameApiName, scriptName, args?)` | Drive a floating frame. |
| `this.communicate.runBlockScript(blockApiName, scriptId, args?)` | Drive a mounted block. |

`this.dynamicPrompt` is the current API; `this.prompt` is legacy — use `dynamicPrompt` for new work.
Their result shapes differ in a way that bites: `dynamicPrompt` values are plain scalars
(`result.values.name`), while `showViewInModal` form values are array-wrapped
(`result.values.formData.name[0]`). See [views, modals and forms](10-views-modals-forms.md).

`required: true` in a `dynamicPrompt` is **host-enforced** — the Confirm button is blocked. Do not
re-check it in the script.

---

## Failure-mode doctrine

Four ways an action failure can surface, in order of preference. The doctrine matters more here
than on most surfaces because two of the four route into platform monitoring. Full treatment in
[errors and observability](15-errors-and-observability.md).

### 1. Expected failure → failure toast, and return

The default for anything a user could cause or fix: an unreachable third party, a validation
rejection, a missing configuration. Sticky (`autohide: false`) so it is not missed, and with the
error *described* rather than dumped:

```js
const [result, error] = await this.getWithErrors(this.getServiceUrl("example_service", "/status"));

if (error) {
  this.showToast(`Could not reach the service: ${describeError(error)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}
```

Always normalize the error before putting it in a toast, or users see `[object Object]`:

```js
const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));
```

### 2. `this.onError(error)` — a caught platform problem

Reports a caught error to the host **without throwing**: the script keeps running and returns
normally. Use it only when you have caught an error and identified it as a problem with the Kizen
platform itself, not with your plugin or the user's setup.

```js
this.onError(new Error("Example Plugin: unexpected response shape from the records API."));
```

### 3. Uncaught `throw` — a genuine crash

Reserved for the genuinely unexpected. It crashes the script.

### The rule

`onError` and uncaught throws both land in platform monitoring and are **triaged by platform
engineering as platform issues**. Neither produces any user-facing surface — the user sees nothing
at all. So:

> Reserve `onError` and throws for real platform problems. Every expected failure gets a toast and
> a `return`.

An action that throws on a 404 from a third-party API raises a platform alert and tells the user
nothing.

### Degrade rather than tear down

Where an action does several things, let a non-essential failure log and continue instead of
aborting the whole run. Say what degraded in the success toast rather than pretending everything
worked.

### Diagnostics

`this.console.log` output reaches the browser console. Log the full payload and the normalized error
on any write failure so a live 400 is self-diagnosing:

```js
this.console.log(
  `Sync failed for object ${objectId}`,
  "payload:", JSON.stringify(payload),
  "error:", errorText(error),
);
```

Never log a value derived from a secret. A service-proxied response can echo the injected
`Authorization` header back at you.

---

## Complete worked example

An action that fetches data from a declared service, writes it back to the record with both write
shapes, and repaints the page.

`src/actions/syncSummary/config.json`:

```json
{
  "name": "Sync Summary",
  "api_name": "sync_summary",
  "hint_object_name": "client_client"
}
```

`src/actions/syncSummary/script.js`:

```js
// Example Plugin · Action · Sync Summary
//
// Fetches a summary from the example_service proxy service and writes it back to the current
// record: the latest value overwrites `summary`, and a copy is appended to the multi-value
// `summary_history` field.
//
// Expected failures are surfaced as sticky failure toasts and the script returns; nothing is
// thrown, because a throw would route to platform monitoring and show the user nothing.

// Normalize a *WithErrors error (string | Error | object) so a toast never shows "[object Object]".
const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

// Business-level install config, from the setup assistant. A select is stored as the whole
// {label, value} option, so read `.value`.
const detailLevel = this.config?.summaryDetail?.value ?? "short";

this.setIndicator("button");

const [summaryResponse, fetchError] = await this.getWithErrors(
  this.getServiceUrl("example_service", `/summaries/${this.entityId}?detail=${detailLevel}`),
);

if (fetchError) {
  this.showToast(`Could not fetch a summary: ${describeError(fetchError)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}

const summary = summaryResponse?.summary;

if (!summary) {
  this.showToast("The service returned no summary for this record.", {
    variant: "alert",
    autohide: false,
  });
  return;
}

const [, patchError] = await this.patchWithErrors(
  `/records/${this.objectId}/${this.entityId}`,
  {
    fields: [
      // Overwrite: replaces whatever `summary` currently holds.
      { name: "summary", value: summary },
      // Append: adds to a multi-value field instead of replacing it.
      { name: "summary_history", add_values: [summary] },
      { name: "summary_synced_at", value: new Date().toISOString() },
    ],
  },
);

if (patchError) {
  this.console.log(
    `Sync Summary — write failed for record ${this.entityId}`,
    "error:", describeError(patchError),
  );
  this.showToast(`Fetched the summary but could not save it: ${describeError(patchError)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}

this.showToast("Summary synced.", { variant: "success" });

// Repaint the record page so the new values show.
this.refreshEntity();
```

---

## Gotchas

- **Publishing does not associate.** Publishing creates the action template; **installing does not
  create the association**. Until a business associates the template with an object — via the
  marketplace Setup Assistant or the association endpoint — the action appears nowhere.
- **`include_perform_action` is not a manifest field.** It is a boolean on the (template, object)
  association, set at install time. Nothing in `config.json` or `kizen.json` can request it.
- **`actionOverrideCreate` is not a manifest field either.** It is a custom-object setting whose
  value is `"{plugin_api_name}.{action_api_name}"` — dot-separated, snake_case
  (`action_override_create`) on the wire.
- **A create override without an association is silently inert.** "+ Add" falls back to the native
  form with no error, no toast, nothing logged. Check the association before anything else.
- **Wire the association before writing the override**, and make readiness checks verify both rows.
- **The override must return a non-empty string.** `String(created.id)` — a number, `undefined`, or
  a bare `return` makes the host no-op with no error.
- **In a relationship-add override, `this.objectId` is the *related* object's id**, not the object
  whose page you are on.
- **Always set `api_name` explicitly.** The directory fallback preserves underscores but flattens
  camelCase, so `syncContact` becomes `synccontact` while `sync_contact` is left alone.
- **Renaming a published action api_name dangles every association** and any create-override key
  pointing at it — silently. Treat it as immutable once shipped.
- **Never hardcode your plugin api_name.** Sandbox and preview builds publish under a suffixed
  name; use `this.pluginApiName`.
- **`Error.message` is non-enumerable**, so `JSON.stringify(err)` yields `"{}"`. Any script that
  matches on error text (duplicate detection, for instance) must read `.message` first.
- **A read error is not proof of absence.** A failed association list, or a lookup that returns
  anything other than 404, means "unknown" — never "not there." Creating on an ambiguous error is
  the duplicate-record bug class.
- **`this.currentUser.first_name` is always undefined.** Everything nests under `.profile`. And on
  `.profile`, an absent value is `""` rather than `undefined` — check for emptiness, not for
  `undefined`.
- **`this.config` is stale within a run.** A value written during the action does not appear on
  `this.config` until the next worker load; re-read it from the API.
- **Install config is not `this.args`.** `this.args` is invocation context (plus the internal
  `pluginId` and `__kizen_user_config` keys); config lives on `this.config` / `this.userConfig`.
- **Config value shapes surprise people.** A select is stored as the whole `{label, value}`; an
  object picker as `{objectId, objectName}`; a field picker as `{fieldId, fieldName, …}` — and
  that is the field **id**, not its api name. Interpolating an object picker directly yields
  `/records/[object Object]/…`, which comes back as a confusing 403.
- **`dynamicPrompt` values are plain scalars; `showViewInModal` form values are array-wrapped.**
  Mixing the two conventions up is a silent `undefined`.
- **A select in `dynamicPrompt` resolves to the whole option object** — read `result.values.x.value`.
  An unpicked optional select is **absent** from `values`, not null.
- **Guard `result.canceled`** before reading any prompt or modal values.
- **A modal cannot open a modal.** The host has one app-global modal slot. Use a frameless view for
  anything multi-step.
- **Writes do not repaint.** Call `refreshEntity()` / `refreshEntityForId(id)` /
  `refreshTimelineForId(id)` after any write the user should see.
- **A thrown error or `this.onError` shows the user nothing** and routes into platform monitoring
  for triage as a platform issue. Expected failures get a sticky failure toast and a `return`.
- **Normalize errors before toasting** or users see `[object Object]`.
- **Bulk means the Perform Action menu on record detail.** Multi-select execution of plugin actions
  from a list page is not wired today — write the action for one record.
- **Nothing carries over between runs.** Every execution gets a brand-new worker; module scope and
  `this` do not survive. Round-trip state through `sessionData` if you need it.
