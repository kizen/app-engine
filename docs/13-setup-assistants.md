# Setup Assistants

What this covers: the two configuration wizards a plugin can ship — `setup_assistant`
(business-level, answered once per business) and `user_setup_assistant` (answered by every user for
themselves) — where each renders, every field type and prop, how answers land in install config, how
that config reaches scripts and `when` clauses, and how to write config back from a script.

Each slot can be authored two ways: as a **declarative field list**, which the host renders for you
(§2–§11), or as a **view** the plugin ships, which draws its own UI and saves itself
([§12](#12-view-based-setup-assistants)). The declarative form is the default and the right answer
for most plugins; reach for a view when the setup flow needs something the field renderer cannot
express.

See also: [manifest reference](03-manifest-reference.md), [worker runtime API](04-worker-runtime-api.md),
[platform API](05-platform-api.md), [auth, secrets & services](06-auth-secrets-services.md),
[actions](08-actions.md), [views, modals & forms](10-views-modals-forms.md),
[routes, calendars, adornments & settings](12-routes-calendars-adornments-settings.md),
[release & publish](16-release-and-publish.md).

---

## 1. The two assistants at a glance

| | `setup_assistant` | `user_setup_assistant` |
|---|---|---|
| Scope | One set of answers per business | One set of answers per user |
| Who answers | An admin with marketplace-manage permission | Each user, for themselves |
| Read in scripts as | `this.config.<key>` | `this.userConfig.<key>` |
| `when` clause prefix on artifacts | `{{config.<key>}}` | `{{userConfig.<key>}}` |
| Authored at | `src/setupAssistant/assistant.json` or inline `kizen.json` `setup_assistant` | `src/userSetupAssistant/assistant.json` or inline `kizen.json` `user_setup_assistant` |
| Storage | Business plugin-app `config` | Per-user plugin config, under `config.user_config` |
| Blocking install step | Yes — shown on enable when the config hash changed | No — never blocks install |
| `actions` (record-action ↔ object mapping) | Supported | **Not supported** (see [Gotchas](#17-gotchas)) |
| `services` prerequisite step | Supported | Supported |
| `view` instead of `fields` ([§12](#12-view-based-setup-assistants)) | Supported | Supported |

Both use the identical schema and the identical renderer. Everything in §5–§8 applies to both unless
noted.

A plugin may ship one, both, or neither. An assistant-only plugin (no actions, no steps, no UI
surfaces) is a legitimate shape — for example, a plugin whose whole job is to capture an object/field
mapping that other plugins' `when` clauses consume, or to display a QR code that enrolls a mobile app.

---

## 2. Declaring an assistant

Two authoring styles, same result:

**Directory style** (required if you use per-field scripts):

```
src/
  setupAssistant/
    assistant.json
    <fieldKey>/
      getFetchUrl.js
      optionMapper.js
  userSetupAssistant/
    assistant.json
```

**Inline style** — put the same object at `setup_assistant` / `user_setup_assistant` in `kizen.json`:

```json
{
  "api_name": "example_plugin",
  "name": "Example Plugin",
  "version": "1.4.0",
  "engine": "1.0.0",
  "entry": "src/",
  "setup_assistant": {
    "fields": [{ "type": "boolean", "key": "enableBlocks", "label": "Enable Blocks", "default": true }]
  }
}
```

**The inline manifest field wins.** If `kizen.json` declares `setup_assistant`, `src/setupAssistant/assistant.json`
is ignored entirely — including its per-field script files. Pick one style per assistant.

At package time both assistants are folded into `base_config` (`base_config.setup_assistant`,
`base_config.user_setup_assistant`) in the published payload. You do not write them into `base_config`
yourself.

### `assistant.json` shape

```jsonc
{
  "services": [{ "api_name": "example_business", "required": false, "prerequisite": true }],
  "actions": ["sync_record", "push_note"],
  "fields": [ /* … */ ]
}
```

| Key | Type | Required | Meaning |
|---|---|---|---|
| `fields` | `AssistantField[]` | no | The form. Rendered top to bottom. §5 |
| `actions` | `string[]` | no | Record-action api_names to expose as an object-mapping step. §4 |
| `services` | `{api_name, required, prerequisite}[]` | no | OAuth prerequisite step. §3 |
| `view` | string | no | A `views/` component's api_name to render **instead of** `fields`. Mutually exclusive with `fields`, `actions`, and a `prerequisite: true` service. [§12](#12-view-based-setup-assistants) |

---

## 3. `services` — the authorization prerequisite step

```json
"services": [
  { "api_name": "example_business", "required": true, "prerequisite": true }
]
```

| Field | Type | Meaning |
|---|---|---|
| `api_name` | string | Must match a `service_name` in the manifest's `services[]`. Only services with `auth_type: "oauth"` produce a step. |
| `prerequisite` | boolean | `true` renders the authorize step at the top of the assistant. `false` (or omitted) renders nothing. |
| `required` | boolean | `true` puts the service in the *required* set: until it authorizes cleanly, every field below is rendered disabled, so setup cannot be completed. `false` renders the same authorize UI but leaves the form usable. |

The step polls plugin OAuth events while the assistant is open (a connect flow opens in another tab
and must be reflected when the user returns). An error event on an **optional** prerequisite service
disables only the *dynamic* (async-option) fields — because those fields fetch through that service's
proxy — while static fields stay editable. An error on a **required** service disables everything.

Set `required: false` while OAuth client credentials are still placeholders; otherwise nobody can
finish setup on that build.

> Nothing validates `services[].api_name` at package or publish time. A typo silently produces no
> step at all — the assistant renders as if the service were never declared, and dynamic fields fail
> at fetch time with a proxy auth error.

See [auth, secrets & services](06-auth-secrets-services.md) for the service declarations these names
point at.

---

## 4. `actions` — the record-action ↔ object mapping step

`actions` is a list of **action api_names as strings** in the authored file:

```json
"actions": ["sync_record", "push_note"]
```

At package time each string is resolved to the packaged action object (`{api_name, name, hint_object_name?}`,
plus the minified script) and embedded into `base_config.setup_assistant.actions`. **A name that does
not resolve to a packaged action fails packaging** with `structure/setup-assistant-action-ref`. This
is the only structural validation performed against a **declarative** assistant's contents — nothing
checks field types, prop names, or `services[].api_name`. The view-based form is validated more
strictly ([§12.5](#125-packaging-validation)).

The step renders, per action, a container labelled with the action's `name` containing:

1. A **multi-select object picker** — "Link to the following object(s)". If the action's `config.json`
   declares `hint_object_name`, that object is pre-selected by api_name (the same inference as
   `match_hint`, §5.8).
2. Per linked object, a **boolean** — "Show in the entity action menu". This is the association's
   `include_perform_action` flag: on, the action appears in that object's Perform Action menus
   (single-record and bulk); off, the action template is associated but hidden from those menus.

On save the host reconciles associations against what the picker says: it deletes and re-adds
association rows as needed, because the backend enforces uniqueness per (action template, object).

These answers do **not** land in `__kizen_clean_config`. They are internal assistant keys prefixed
`__kizen__action__` / `__kizen__actionmenu__` that the save routine peels off and turns into
association writes. Nothing readable via `this.config` comes out of this step.

`include_perform_action` and the "+ Add" create-record override (`action_override_create`) are
install-time/host-side settings, not `kizen.json` fields — see [actions](08-actions.md) for the script
return contracts and for how to create associations yourself from a script.

---

## 5. Field types

Every field is an object with at minimum `key` and `type`. `key` must be unique across the whole
assistant, including inside containers — it is the config key scripts read back.

### 5.0 Props common to all field types

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `key` | string | packager + engine + renderer | Unique field id **and** the config key. Changing it is a breaking config migration. |
| `type` | enum | packager + engine + renderer | One of the 11 types below. An unrecognized value renders an "invalid block" placeholder, not an error. |
| `label` | string | packager + engine + renderer | Visible label. Ignored by `description`, `qr`, `image`. |
| `when` | string | packager + engine + renderer | Visibility expression over other assistant keys. §6 |
| `tooltip` | string | engine + renderer | Info icon / label hint next to the label. Not on `description`, `container`, `qr`, `image`, `link`. |
| `required` | boolean | engine + renderer | Blocks save when the field is visible and empty. §5.0.1 |
| `default` | string \| boolean \| number | packager + engine + renderer | Pre-filled value. Typed `string` in both type packages but booleans/numbers work and are used. |
| `placeholder` | string | packager + engine + renderer | Empty-state text on input fields. **Overridden by `default` on `text`/`number`** — those render `default` as the placeholder when set. |
| `allow_multiple` | boolean | packager + engine + renderer | Multi-select. Meaningful on `select`, `field`, `custom_object`. |
| `validation_pattern` | string | engine + renderer | Regex the value must match on save. §5.0.1 |
| `dependencies` | string[] | engine + renderer | Keys this field's options derive from; changing any of them resets and re-fetches this field. §7 |

`type`-specific props are listed per type below.

#### 5.0.1 Validation

Validation runs once, on save (there is no per-keystroke validation):

- Fields whose `when` currently evaluates false are **excluded** from validation entirely.
- `required: true` + empty ⇒ `This field is required`. "Empty" is type-aware: no id for
  `custom_object`, no field id for `field`, whitespace-only for `text`, `NaN`/blank for `number`,
  empty array for any `allow_multiple` variant, `false` for `boolean`.
- `validation_pattern` is compiled with `new RegExp(...)` and tested against the value (falling back
  to `default`, then `""`). Failure message: `Value must match the pattern <pattern>`. Only checked
  when `required` passed — a field with both gets the required message first.
- `required` on a `boolean` means "must be checked".

---

### 5.1 `description`

Static copy. Produces no config value.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `content` | string | packager + engine + renderer | Markdown **or** raw HTML. Rendered to HTML; external links are not force-rewritten. |
| `when` | string | packager + engine + renderer | Conditional copy — a `description` can appear only when another answer makes it relevant. |

```json
{
  "type": "description",
  "key": "intro",
  "content": "Values saved here become the plugin's install config: scripts read them as `this.config.<key>`, and artifact configs gate themselves with `\"when\": \"Boolean({{config.<key>}})\"`."
}
```

```json
{
  "type": "description",
  "key": "toolbarHiddenNote",
  "content": "<p style=\"color:#b45309;\">The <strong>Reports</strong> toolbar item is now hidden.</p>",
  "when": "{{enableReports}} === false"
}
```

---

### 5.2 `container`

Layout grouping. Produces no config value of its own; its children do.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `columns` | number | packager + engine + renderer | Grid columns for the children. Default `1`. Values `1`–`4` are what the layout is built for. |
| `fields` | `AssistantField[]` | packager + engine + renderer | Children. Containers nest. |
| `label` | string | packager + engine + renderer | Section heading. Omit for an unlabelled grid. |
| `when` | string | packager + engine + renderer | Hides the whole section. **AND-ed into each child's own `when`** for validation, so required children inside a hidden section are correctly skipped. |

```json
{
  "type": "container",
  "columns": 2,
  "label": "Feature Toggles",
  "key": "featureToggles",
  "fields": [
    { "type": "boolean", "key": "enableBlocks", "label": "Enable Blocks", "default": true },
    { "type": "boolean", "key": "enableReports", "label": "Enable Reports", "default": true }
  ]
}
```

---

### 5.3 `boolean`

Checkbox. Saved value: raw `true` / `false`.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `default` | boolean | packager + engine + renderer | Initial state. Absent ⇒ `false`. |
| `tooltip` | string | engine + renderer | Info icon beside the label. |
| `required` | boolean | engine + renderer | Must be checked to save. |
| `expanded`, `expandedLabel`, `indentLevel` | boolean / string / number | renderer only | Alternate stacked layout. Undeclared in both type packages; used by the built-in action-mapping step. Avoid in authored assistants. |

```json
{
  "type": "boolean",
  "label": "Enable Blocks",
  "key": "enableBlocks",
  "default": true,
  "tooltip": "Turn this off to hide the dashboard blocks — both have a when-condition on this value."
}
```

---

### 5.4 `text`

Single-line string. Saved value: the string.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `default` | string | packager + engine + renderer | Pre-filled value. Also used as the placeholder text. No `{{}}` interpolation. |
| `placeholder` | string | packager + engine + renderer | Only visible when `default` is absent. |
| `required` | boolean | engine + renderer | |
| `validation_pattern` | string | engine + renderer | Regex, checked on save. |
| `tooltip` | string | engine + renderer | |

```json
{
  "type": "text",
  "label": "Context Value",
  "key": "contextValue",
  "required": true,
  "default": "example-default",
  "validation_pattern": "^[a-z0-9-]+$",
  "tooltip": "Lowercase letters, digits and dashes only."
}
```

Saving with an empty value and a `default` present stores the `default` — a `text` field with a
`default` can never be blank in config.

---

### 5.5 `number`

Numeric input. Saved value: a `Number`.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `default` | number | packager + engine + renderer | Pre-filled; also the placeholder. |
| `placeholder` | string | packager + engine + renderer | |
| `required` | boolean | engine + renderer | |
| `tooltip` | string | engine + renderer | |
| `validation_pattern` | string | engine + renderer | Applies to the raw string. |

Left blank, **the key is absent from the saved config** — not `0`, not `null`. Read it defensively:
`const limit = this.config.pageSize ?? 50;`

---

### 5.6 `select` (static options)

Dropdown. Saved value: the whole `{label, value}` option object, or an array of them when
`allow_multiple`.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `options` | `{label, value}[]` | packager + engine + renderer | Static option list. Presence of `options` alone does not make the select dynamic. |
| `allow_multiple` | boolean | packager + engine + renderer | Multi-select; value becomes an array. |
| `placeholder` | string | packager + engine + renderer | |
| `required` | boolean | engine + renderer | |
| `tooltip` | string | engine + renderer | |
| `default` | string | packager + engine + renderer | Raw fallback value when nothing is selected. |

```json
{
  "type": "select",
  "label": "Sync Mode",
  "key": "syncMode",
  "placeholder": "Pick one",
  "options": [
    { "label": "Full", "value": "full" },
    { "label": "Incremental", "value": "incremental" }
  ]
}
```

Read it as `this.config.syncMode?.value` — **not** `this.config.syncMode`. Interpolating the whole
object into a URL yields `[object Object]`.

---

### 5.7 `select` (dynamic / async options)

A select becomes dynamic when it declares **`getFetchUrl` or `optionMapper`** — normally via sibling
script files (§8). Omit `options`.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `getFetchUrl` | string (function source) | engine + renderer | Builds the options URL. Injected by the packager from `<key>/getFetchUrl.js`. |
| `optionMapper` | string (function source) | engine + renderer | Maps the response to `{label, value}[]`. From `<key>/optionMapper.js`. |
| `getContextUrl` | string (function source) | engine + renderer | Optional pre-fetch. Its response is cached per field and exposed to the other scripts as `state.context`. From `<key>/getContextUrl.js`. |
| `getHeaders` | string (function source) | engine + renderer | Returns a headers object. **Only used for absolute (non-`/`) URLs** — proxy-relative calls always go through the authenticated app client. From `<key>/getHeaders.js`. |
| `getBody` | string (function source) | engine + renderer | Returns a JSON body. Only used when `fetchMethod` is `POST` **and** the URL is absolute. From `<key>/getBody.js`. |
| `fetchMethod` | `'GET' \| 'POST'` | engine + renderer | HTTP method for both the context and options fetches. Default `GET`. |
| `typeahead` | boolean | engine + renderer | Refetch on debounced search input instead of once on open; the current search text is available to the scripts. |
| `autoSelect` | boolean | engine + renderer | When exactly one option comes back and the field is empty, select it automatically. Ignored for `typeahead` selects. |
| `dependencies` | string[] | engine + renderer | Keys that invalidate this field. §7 |
| `allow_multiple`, `placeholder`, `required`, `tooltip` | | as above | |

Behavior worth knowing:

- Options are fetched **lazily**, when the dropdown opens, and cached per (field, state) combination —
  reopening does not refetch unless a dependency changed.
- If `optionMapper` is absent, the raw response must already be an array of `{label, value}`;
  anything else is treated as a fetch failure and the options list ends up empty.
- Options-fetch failures render an empty dropdown silently. Only a **context**-fetch failure raises a
  visible toast (`Error fetching options for <label>: <message>`).
- A dynamic field is disabled while an optional prerequisite OAuth service is in an error state.

---

### 5.8 `custom_object`

Kizen object picker. Saved value: `{ objectId, objectName }`.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `match_hint` | string | engine + renderer | Object **api_name**. On first render the assistant looks the object up and pre-selects it when it exists. `client_client` resolves to the business's contact object without a lookup. |
| `allow_multiple` | boolean | packager + engine + renderer | Renders a multi-picker — but see the [Gotchas](#17-gotchas): multi-select does not survive into `this.config`. |
| `required`, `tooltip`, `placeholder`, `when` | | as above | |

```json
{
  "type": "custom_object",
  "label": "Sync Object",
  "key": "syncObjectId",
  "required": true,
  "match_hint": "client_client",
  "tooltip": "match_hint pre-selects an object whose api_name matches, when one exists."
}
```

Read as `this.config.syncObjectId.objectId`. The inference also re-runs when a `when` clause flips a
previously hidden `custom_object` field into view and it has no value yet.

---

### 5.9 `field`

Kizen field picker, scoped to an object. Saved value:
`{ fieldId, fieldName, objectId, objectName }` (array when `allow_multiple`).

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `object_id` | string | packager + engine + renderer | The object to pick fields from. Either a literal object id, or `"{{someKey}}"` referencing a **`custom_object`** field in the same assistant. |
| `match_hint` | string | engine + renderer | Field **name**. Pre-selects the matching field on the resolved object. |
| `allow_multiple` | boolean | packager + engine + renderer | Value becomes an array of the same shape. |
| `required`, `tooltip`, `placeholder`, `when` | | as above | |

```json
{
  "type": "field",
  "label": "Email Field",
  "key": "emailField",
  "match_hint": "email",
  "object_id": "{{syncObjectId}}"
}
```

`{{...}}` in `object_id` is **not** the expression worker — it is a direct state lookup that only
resolves keys whose type is `custom_object`. Pointing it at a `text` or `select` key silently yields
no object and the picker stays empty.

Note the saved value carries the field **id**, not the field api_name.

---

### 5.10 `image`

Static image. Produces no config value.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `src` | string | engine + renderer | Image URL or `data:` URI. |
| `title` | string | engine + renderer | Used as both `alt` and the hover title. |
| `width` | number | engine + renderer | Pixels. |
| `height` | number | engine + renderer | Pixels. With neither `width` nor `height` the image renders at `100%` width, auto height; with one of them the other becomes `auto`. `max-width: 100%` is always applied. |
| `link` | `{href, text}` | engine + renderer | Wraps the image in an anchor opening in a new tab; `text` becomes the anchor title. |
| `include` | `IncludeOption[]` | engine + renderer | Appends identity query params to `link.href`. §5.13 |

```json
{
  "type": "image",
  "key": "storeBadge",
  "src": "data:image/png;base64,iVBORw0KGgo…",
  "title": "Get the mobile app",
  "width": 240,
  "link": { "text": "Download", "href": "https://example.com/app" }
}
```

---

### 5.11 `qr`

Renders a QR code. Produces no config value.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `value` | string | engine + renderer | The encoded URL. **Always forced to an absolute URL** — a relative `"/mobile-setup"` becomes `<app origin>/mobile-setup`, because the code is scanned on another device. Absolute `http://`, `https://`, and registered app schemes are left alone. |
| `include` | `IncludeOption[]` | engine + renderer | Identity params appended to the encoded URL. §5.13 |
| `size` | number | engine + renderer | Pixel size of the rendered code. Default `128`. |

```json
{
  "type": "qr",
  "key": "mobileEnrollment",
  "value": "/mobile-setup",
  "include": ["email", "business_id"],
  "size": 160
}
```

---

### 5.12 `link`

Text hyperlink. Produces no config value.

| Prop | Type | Recognized by | Meaning |
|---|---|---|---|
| `href` | string | engine + renderer | Target. **Not** forced absolute — relative in-app links work. |
| `text` | string | engine + renderer | Link text. |
| `include` | `IncludeOption[]` | engine + renderer | Identity params appended to `href`. §5.13 |

```json
{ "type": "link", "key": "docsLink", "text": "Setup Documentation", "href": "https://docs.example.com" }
```

Opens in a new tab with `rel="noopener noreferrer"`.

---

### 5.13 `include` — identity params on `qr`, `image.link`, and `link`

`include` is an array drawn from `'email' | 'name' | 'business_id' | 'user_id' | 'base_url'`. Each
entry appends a query param of the same name, resolved from the viewing user's session:

| Value | Resolves to |
|---|---|
| `email` | The viewing user's email |
| `name` | The viewing user's full name |
| `business_id` | The current business id |
| `user_id` | The viewing user's id |
| `base_url` | The current app origin |

Params are appended before any `#fragment`, joined with `&` if the URL already has a query string.
This is how a QR code hands a mobile app everything it needs to call back into the right business as
the right user without a separate pairing step.

---

## 6. `when` inside the assistant

`when` is a JavaScript expression string with `{{key}}` placeholders referring to **other fields in
the same assistant, unprefixed**. It is evaluated in an isolated worker, on every state change, for
every field that declares one.

The substitution is **textual**: each `{{key}}` is replaced with `JSON.stringify(value)` of that
field's current value, or the literal `null` when the field has no value. The resulting string is
compiled as `return <expression>;`. Consequences:

- `"{{enableReports}} === false"` works, and is `false` when the field was never touched (`null !== false`).
- For "is it on", prefer truthiness: `"Boolean({{enableReports}})"`.
- Strings interpolate as quoted literals, so `"{{mode}} === 'full'"` works.
- Objects interpolate as JSON literals, so a `select` needs `"{{syncMode}}?.value === 'full'"` and a
  `custom_object` needs `"Boolean({{syncObjectId}})"` (its raw in-assistant shape is `{id, objectName}`).
- Any expression is legal: `"Boolean({{a}}) && !{{b}}"`.

A field whose `when` is false is hidden, skipped by validation, and — critically — **its value is not
saved** (§9.1).

Container `when` clauses are AND-ed into their children for validation purposes, so you do not need to
repeat the parent condition on every child.

> Inside the assistant, keys are bare: `{{enableReports}}`. On artifact configs, the same values are
> addressed with a scope prefix: `{{config.enableReports}}` / `{{userConfig.enableReports}}`. Mixing
> them up is the single most common setup-assistant mistake.

---

## 7. `dependencies` — cascading fields

`dependencies: ["otherKey"]` declares that this field's options derive from another field. When the
named field changes:

1. Every field that depends on it — directly **or transitively** — has its value reset.
2. Its dynamic options cache is invalidated, so the next open refetches.

Dependency chains are followed to arbitrary depth: if `c` depends on `b` and `b` depends on `a`, then
changing `a` resets both `b` and `c`. Self-references are ignored.

### Worked cascading example: region → warehouse → bin

`src/setupAssistant/assistant.json` (excerpt):

```json
{
  "services": [{ "api_name": "inventory_api", "required": false, "prerequisite": true }],
  "fields": [
    {
      "type": "container",
      "columns": 3,
      "label": "Inventory Location",
      "key": "inventoryLocation",
      "fields": [
        {
          "type": "select",
          "label": "Region",
          "key": "region",
          "required": true,
          "autoSelect": true,
          "tooltip": "Auto-selects when the account only has one region."
        },
        {
          "type": "select",
          "label": "Warehouse",
          "key": "warehouse",
          "required": true,
          "dependencies": ["region"]
        },
        {
          "type": "select",
          "label": "Default Bin",
          "key": "bin",
          "dependencies": ["warehouse"]
        }
      ]
    }
  ]
}
```

`src/setupAssistant/region/getFetchUrl.js`:

```js
({ state }) =>
  `/external-integrations/proxy/${state.pluginApiName}/inventory_api/v1/regions`;
```

`src/setupAssistant/region/optionMapper.js`:

```js
({ state }) =>
  (state.result?.data?.regions ?? []).map((region) => ({
    label: region.display_name,
    value: region.code,
  }));
```

`src/setupAssistant/warehouse/getFetchUrl.js`:

```js
({ state }) => {
  // Guard the dependent fetch so the URL is still valid before a region is picked.
  const region = state.region?.value?.value || "all";

  return `/external-integrations/proxy/${state.pluginApiName}/inventory_api/v1/warehouses?region=${encodeURIComponent(region)}`;
};
```

`src/setupAssistant/warehouse/optionMapper.js`:

```js
({ state }) =>
  (state.result?.data?.warehouses ?? []).map((w) => ({ label: w.name, value: w.id }));
```

`src/setupAssistant/bin/getFetchUrl.js`:

```js
({ state }) => {
  const warehouseId = state.warehouse?.value?.value;

  if (!warehouseId) {
    // No warehouse yet — return a request that yields an empty list rather than a bad URL.
    return `/external-integrations/proxy/${state.pluginApiName}/inventory_api/v1/bins?warehouse=none`;
  }

  return `/external-integrations/proxy/${state.pluginApiName}/inventory_api/v1/bins?warehouse=${encodeURIComponent(warehouseId)}`;
};
```

`src/setupAssistant/bin/optionMapper.js`:

```js
({ state }) => (state.result?.data?.bins ?? []).map((b) => ({ label: b.label, value: b.id }));
```

Changing the region clears both the warehouse and the bin; changing the warehouse clears only the bin.

---

## 8. Per-field scripts

A sibling directory named **exactly the field's `key`** may contain up to five `.js` files, each
attached to that field:

| File | Attached prop | Returns | Runs |
|---|---|---|---|
| `getFetchUrl.js` | `getFetchUrl` | string (URL) | Before the options request |
| `optionMapper.js` | `optionMapper` | `{label, value}[]` | After the options response |
| `getContextUrl.js` | `getContextUrl` | string (URL) | Once per field, before `getFetchUrl` |
| `getHeaders.js` | `getHeaders` | headers object | Before an **absolute**-URL request |
| `getBody.js` | `getBody` | body object | Before an absolute-URL `POST` |

Rules:

- **Arrow-function expressions only.** The packager wraps the file's source into a self-invoking call
  of the form `(<yourFunction>)({ state, args, utils })`. A file containing statements, a named
  function declaration, or an `export` will not package into anything runnable. Leading `//` comments
  are fine; a single trailing `;` and trailing newline are stripped.
- Destructure `{ state }` — that is the only argument you need. `args` is always `{}` for assistant
  scripts and `utils` is an empty object.
- Files are matched by directory name to field `key`, including keys **nested inside containers**.
- Files in a directory that matches no field key are ignored silently.
- These scripts run **in the browser page rendering the assistant, not in a worker**. There is no
  `this`, no `this.getServiceUrl`, no worker API at all — so none of the `this.*` calls shown in §13
  or §16 (which are ordinary artifact scripts) are available here, and conversely `state` exists only
  in these five files. Build proxy URLs by hand:
  `/external-integrations/proxy/${state.pluginApiName}/<service_name>/<path>` — byte-identical to what
  `this.getServiceUrl` produces in a worker.
- A URL starting with `/` goes through the app's authenticated client (session cookies, business
  headers, and — for proxy paths — server-side token injection). Any other URL is a plain browser
  `fetch`, subject to CORS, with no Kizen credentials.

### The `state` object

| Key | Available in | Value |
|---|---|---|
| `<fieldKey>` | all | That field's current value store, e.g. `{type: 'select', value: {label, value}}`. Read a picked select as `state.someKey?.value?.value`. |
| `pluginApiName` | all | The plugin's `api_name` — always use this rather than a literal, since preview builds get a suffixed api_name. |
| `context` | `getFetchUrl`, `getHeaders`, `getBody`, `optionMapper` | The `getContextUrl` response, cached per field. |
| `result` | `optionMapper` | The options response. Proxy-relative calls resolve to an axios-style envelope, so the payload is under `.data`. |
| `search` | typeahead selects | The debounced search text. |

---

## 9. Where assistant answers land

### 9.1 Save mechanics (both scopes)

On save the assistant:

1. Validates every **currently visible** field (§5.0.1). Any error blocks the save entirely.
2. Collects only the visible fields' keys. Values for keys that were never touched are materialized
   as empty (`[]` for `allow_multiple`, otherwise undefined).
3. Splits out `__kizen__action__*` / `__kizen__actionmenu__*` keys into association writes (§4).
4. Produces three sibling keys and merges them over the existing config object:

| Key | Contents |
|---|---|
| `__kizen_setup_assistant_values` | The raw value stores, keyed by field key — what re-populates the form next time it opens. |
| `__kizen_clean_config` | The normalized values scripts actually read. §9.3 |
| `__kizen_setup_assistant_hash` | A hash of the **assistant definition** (not the answers). §10 |

**A field hidden by `when` at save time has its key removed from both stores.** Toggling a feature off
and saving does not leave a stale value behind — it deletes it. Toggling it back on restores the
field's `default`, not the previous answer.

### 9.2 Storage per scope

- **Business:** `PATCH` on the business plugin-app record, `config` object — the same object
  `config_template` seeds at install. Read/write require the marketplace view/manage permissions.
- **User:** written to the current user's plugin config under `config.user_config`, with the identical
  three-key structure nested inside it.

### 9.3 Clean value shapes — what scripts read

| Field type | `this.config.<key>` / `this.userConfig.<key>` |
|---|---|
| `boolean` | `true` \| `false` |
| `text` | `string` (falls back to `default` when blank) |
| `number` | `Number`. **Key absent** when blank or unparseable. |
| `select` | `{label, value}` — or `{label, value}[]` when `allow_multiple` |
| `custom_object` | `{objectId, objectName}` |
| `field` | `{fieldId, fieldName, objectId, objectName}` — array when `allow_multiple` |
| `description`, `container`, `qr`, `image`, `link` | never present — these types produce no value |

A key whose value did not clean successfully is simply absent. `this.config` is a proxy that returns
`undefined` for unknown keys, so `this.config.neverSet` never throws.

### 9.4 Gating artifacts with `when`

Seven artifact types (blocks, floating frames, toolbar items, data adornments, object settings
items, calendar sources, Agentic Workflow steps) may carry a `when` expression in `config.json`
referencing both scopes. Actions, pages, route scripts and views cannot — a `when` on one of those
is discarded at package time without a warning:

```json
{
  "api_name": "reports_toolbar_item",
  "label": "Reports",
  "when": "Boolean({{config.enableReports}}) && Boolean({{userConfig.showReportsForMe}})"
}
```

Mechanics:

- `{{config.x}}` and `{{userConfig.x}}` are rewritten to the flat state keys `config__x` /
  `userConfig__x`, then evaluated by the same expression worker as assistant `when` clauses.
- The state is built from `__kizen_clean_config` for each scope, so the values are the **clean** shapes
  in §9.3 — note `custom_object` is `{objectId, objectName}` here versus `{id, objectName}` inside the
  assistant.
- Keys that have no saved value fall back to the field's `default` from the assistant definition. This
  is what makes `default: true` toggles work before anyone has run setup.
- An **absent** `when` means always enabled.
- All `when` expressions across all enabled plugins are evaluated in parallel at bootstrap, and
  re-evaluated in the background when a plugin is enabled later.
- A `when` on a block, data adornment, toolbar item, calendar source or Agentic Workflow step
  sets `block_loading_for_setup` on the published manifest; a `when` on a floating frame or an
  object settings item does not.
- A `false` result does not disable the artifact visibly — it is **filtered out of every collection**,
  so it simply is not there. Debug a "missing" surface by checking its `when` first.

Views are not feature-flag filtered and cannot be `when`-gated — see
[views, modals & forms](10-views-modals-forms.md).

### 9.5 `base_config.disabled_keys`

An optional array of assistant field keys in `base_config`:

```json
{ "base_config": { "secrets": ["api_key"], "disabled_keys": ["enableLegacyFrame"] } }
```

Listed keys render **disabled** (read-only) in the assistant, and when artifact `when` clauses are
evaluated the key is forced to `false` for `boolean` fields and `undefined` for everything else —
regardless of what is stored. Use it to hard-off a feature for a release without deleting the field
and breaking existing configs.

---

## 10. Re-prompt on config-hash change

Every save stamps `__kizen_setup_assistant_hash` — a hash of the **serialized assistant definition**
that produced those answers.

When a business enables the plugin, the host compares that stored hash against a fresh hash of the
plugin's current `base_config.setup_assistant`:

- **Equal** ⇒ the blocking install modal is skipped. The plugin just turns on.
- **Different, or nothing stored** ⇒ the assistant opens as a blocking modal that must be completed or
  dismissed.

Behavioral consequences:

- The comparison only happens on **enable**. Opening the Configure panel always renders the assistant
  regardless of hash.
- The hash covers the whole assistant object — fields, actions, services, labels, tooltips, ordering.
  **Any** edit to the assistant, however cosmetic, re-prompts every business on their next enable.
  This is the intended mechanism for "we added a required setting, go answer it."
- Re-prompting shows the assistant pre-populated from `__kizen_setup_assistant_values`, so existing
  answers are preserved; the user confirms and the new hash is stamped.
- The user assistant has no such gate — it never blocks, and is reached from the plugin's User
  Settings panel.
- A [view-based assistant](#12-view-based-setup-assistants) is gated by the same hash. Its definition
  is the whole assistant object — for a view-only slot that is just `{"view": "..."}`, so the hash
  changes when you point it at a different view, but *not* when you change what the view renders.
  Shipping new questions inside an existing setup view does not re-prompt anyone.
- `this.completeSetup()` stamps the hash for you ([§12.3](#123-completing-setup)). A plugin that
  configures itself some other way — an action writing business config through a raw PATCH — must
  write a matching `__kizen_setup_assistant_hash` itself, or the install modal reappears on every
  enable.

Uninstalling (disabling) a plugin does **not** clear its config — re-enabling with an unchanged
assistant goes straight through with the old answers intact.

---

## 11. Where each assistant renders

### 11.1 Business install flow

Enabling a plugin from the Marketplace creates (first time) or re-enables (subsequently) the business
plugin-app record, then runs a post-enable chain:

1. **Schema import step**, if the plugin ships a schema bundle that has not been imported or skipped
   for this business. This is a blocking modal step ahead of the assistant.
2. **Setup assistant**, if `setup_assistant` exists and the hash differs (§10). Rendered as a blocking
   modal with, in order: the OAuth prerequisite step for **required** services, the action-mapping
   step, then "App Configuration" (your `fields`), then Save.
3. **Secrets collection.** If the manifest declares `base_config.secrets`, the host looks for that
   plugin's integration secrets that are still empty and **chains an edit modal for each one**. This
   runs after the assistant, in the same enable flow. Users without secret-edit permission get a
   "someone else must fill these in" modal instead; users without even view permission always get it,
   since emptiness cannot be checked.

So the full first-run experience for a plugin with all three is: import → assistant → secret 1 →
secret 2 → done. See [auth, secrets & services](06-auth-secrets-services.md) for how those secrets are
named (`<plugin_api_name>__<secret_name>`) and consumed.

### 11.2 Marketplace detail panels

The plugin's detail page carries panels: Details, **Configure**, **User Settings**, Versions,
Authorization.

- **Configure** renders `setup_assistant` inline (all prerequisite services shown, not just required
  ones) with an inline Save. Editing here never re-runs the secrets chain. Businesses with the
  advanced-configuration permission can instead edit the raw config JSON; setting
  `base_config.user_configurable: false` hides the config panel from customers entirely.
- **User Settings** renders `user_setup_assistant` inline against the current user's own config. Every
  user sees this panel for themselves.

### 11.3 Plugin-triggered modals

The same field renderer backs `dynamicPrompt` modals raised from scripts, which is why several field
types feel familiar there. That surface has its own value contract (plain values, not the array
wrapping of view forms) — see [views, modals & forms](10-views-modals-forms.md).

Everything in §11.1 and §11.2 describes where the *declarative* renderer appears. A view-based
assistant occupies the same four surfaces, with different chrome —
see [§12.2](#122-what-the-host-provides--and-what-it-does-not).

---

## 12. View-based setup assistants

Point an assistant slot at one of the plugin's own views and the declarative renderer steps aside
entirely: the view draws the whole setup experience and persists it by calling
[`this.completeSetup()`](#123-completing-setup). Everything the field renderer gives you for free —
layout, validation, the OAuth step, the object-mapping step, the Save button — becomes the view's
job.

Use it when setup genuinely does not fit a flat form: a multi-step wizard, a flow whose next question
depends on a remote call, a live preview of what the plugin will do, an approval or connection-test
gate. Prefer the declarative form otherwise. A view is materially more code, and it opts out of the
one thing the declarative path is very good at — being impossible to get subtly wrong.

### 12.1 Declaring one

Set `view` to a view's api_name, in either authoring style:

```json
{
  "setup_assistant": { "view": "plugin_setup_form" },
  "user_setup_assistant": { "view": "plugin_user_setup_form" }
}
```

The two slots are independent — a plugin may ship a view for one and a declarative field list for the
other.

| Rule | Detail |
|---|---|
| Value | The view's **resolved `api_name`**, from `src/views/<dir>/config.json` — not the directory name. `views/businessSettings/` declaring `api_name: business_settings_form` is referenced as `business_settings_form`. |
| Must be a view | A `pages/` component is rejected, even though pages and views are otherwise near-identical. |
| Mutually exclusive with | A non-empty `fields`, a non-empty `actions`, and any `services` entry with `prerequisite: true`. A `services` entry without `prerequisite` is inert either way and does not conflict. |
| Treated as absent | `null` and `""`. Both fall through to the declarative path. |
| Per-field scripts | Ignored. Field scripts are only injected into a declarative field list. |

`view` passes through packaging verbatim into `base_config.setup_assistant.view`.

### 12.2 What the host provides — and what it does not

The view occupies the same four surfaces as the declarative renderer (§11), with almost no chrome
around it:

| | Declarative | View-based |
|---|---|---|
| Install/enable modal | Titled modal, host Save/Confirm footer | **Frameless** modal, fixed at 900px wide. No header, no footer, no close button. |
| Configure / User Settings panels | Inline form with an inline Save | Rendered inline, bleeding to the card edges |
| OAuth prerequisite step | Rendered from `services` | **Not rendered.** The view calls `this.authorize()` itself — after checking the service isn't already connected (a proxy call returning 503 means "not connected", see [06](06-auth-secrets-services.md#503--not-connected)). |
| Action ↔ object mapping step | Rendered from `actions` | Not rendered. The view creates associations itself if it needs them — see [actions](08-actions.md). |
| Save button | Supplied by the host | **Supplied by the view.** Its `completeSetup()` call is the save. |
| Validation | Host-enforced per field | The view's own. |

What the host still does:

- Shows a loading indicator while the view's worker boots, and reserves a minimum height so the
  modal does not collapse.
- Closes the modal after a successful `completeSetup()` (§12.3).
- Honors Escape and backdrop click, which is the **cancel path** — nothing is written and nothing is
  stamped. There is no confirm-on-dirty guard, so a half-finished setup is discarded silently. If
  that matters, keep the view's own state recoverable rather than trying to block the dismissal.
- Still runs a blocking schema-import step **ahead** of the view, exactly as it does for a
  declarative assistant (§11.1).

The modal cannot choose its own width — unlike `showViewInModal`, the setup surface is always the
900px size. Design for that.

A view-based assistant also cannot be conditionally hidden. Views aren't feature-flag filtered and
take no `when` clause — most other artifact types declare one, but views and pages do not — so
nothing can gate the setup surface on config or flags. If setup needs to branch, branch inside the
view.

### 12.3 Completing setup

```ts
completeSetup(payload: Record<string, unknown>, options?: { level?: 'business' | 'user' }): Promise<void>
```

`payload` is the **clean config** — ordinary plugin-shaped keys, exactly what scripts will later read
as `this.config.<key>` / `this.userConfig.<key>`. The host wraps it as `__kizen_clean_config`, stamps
`__kizen_setup_assistant_hash`, and writes it to the business record or to the user's
`config.user_config` depending on the level. You never write those reserved key names yourself.

```js
// src/views/pluginSetupForm/eventScripts/save.js
const formData = this.args?.formData;

// A click landing on the form's own padding runs this handler with no form data.
// Without this guard the call below saves an empty config over a good one.
if (!formData) {
  return;
}

try {
  await this.completeSetup({
    accountSlug: formData.accountSlug?.[0] ?? '',
    syncMode: formData.syncMode?.[0] ?? 'incremental',
    enableReports: formData.enableReports?.[0] === 'true',
  });
} catch (error) {
  // Scripts run in a worker with no DOM, so there is no inline error to render.
  this.showToast('Could not save setup. Please try again.', { variant: 'failure' });
}
```

Rules that follow from how the write works:

- **The payload replaces `__kizen_clean_config` wholesale.** Any key that was there before and is
  absent from the payload is gone. A view that edits one setting must still send every key the
  plugin's other surfaces read — spread the current config and override:
  `await this.completeSetup({ ...this.config, apiKey: next })`. Remember `this.config` is a
  load-time snapshot, so a long-lived wizard should build the payload from its own state, not from a
  stale proxy.
- **Sibling `__kizen_*` keys survive.** The host re-reads the stored record and merges, so the
  answer store, schema-import bookkeeping, and any `config_template` keys are preserved. This is what
  makes it safer than the hand-rolled PATCH in [§13.3](#133-writing-business-config-from-a-script).
- **Call it exactly once, at the end.** A successful call closes the setup modal. In a multi-step
  view, calling it at step 2 of 5 shuts the modal on a user who is not finished. Persist intermediate
  state some other way if you need to.
- **`options.level` is for calls made off the setup surface.** While a setup surface is live the host
  resolves the level from that surface and ignores what you pass, so a setup view never needs it —
  and an author who hardcodes the wrong one cannot misroute the write. It defaults to `'business'`
  everywhere else.
- **The business-level write fails if the plugin has never been installed** for that business. There
  is no record to merge into.
- After a successful write the host refetches the plugin's artifacts and feature flags, so surfaces
  gated by a `when` clause on the values just collected appear without a page reload (§9.4).

Errors: the returned promise **rejects** if `payload` is not a plain object (`null`, an array, or a
class instance are all rejected), and also if the write fails or the host wired no handler. Nothing
throws synchronously, so an un-awaited call fails silently. Full signature
notes, including which surfaces expose it, are in the
[worker runtime API](04-worker-runtime-api.md).

> `completeSetup` is not limited to setup views — it is available on ordinary surfaces too, which is
> how a plugin re-opens its own configuration from a block or toolbar item. That reach has a sharp
> edge: **every** call stamps the setup hash, so a stray call from a non-setup surface suppresses the
> install-time prompt on the next enable (§10).

### 12.4 Reading existing config in a setup view

A setup view is an ordinary view. It receives the plugin's business config as args, so
`this.config` and `this.userConfig` work normally and are the right way to prefill the form on a
re-run.

It receives nothing else: no level, no "this is setup" flag, no indication of which surface it is on.
A view used both as a setup surface and as a toolbar item has to infer that itself — usually from
whether `this.config` is already populated.

### 12.5 Packaging validation

Unlike the declarative form, the view-based form is checked at package time (§4). Six rules:

| Rule | Severity | Fires when |
|---|---|---|
| `manifest/setup-assistant-view-conflict` | error | `view` set alongside a non-empty `fields`, a non-empty `actions`, or a `prerequisite: true` service |
| `manifest/setup-assistant-view-not-found` | error | `view` matches no view in the plugin — with a distinct message when the name matches a `pages/` component |
| `manifest/setup-assistant-shape` | error | An inline assistant is not a JSON object, or `view` is present but not a string |
| `manifest/setup-assistant-parse` | error | `assistant.json` is not valid JSON, or parses to a non-object |
| `manifest/setup-assistant-orphaned-field-scripts` | warning | `view` is set but the assistant directory still ships per-field scripts |
| `manifest/setup-assistant-disabled-keys-ignored` | warning | `base_config.disabled_keys` is non-empty while any assistant on the plugin is view-based |

Two of these are worth understanding rather than just fixing:

- **`disabled_keys` is a warning, not an error.** It lives at `base_config.disabled_keys`, outside
  either assistant, and the host applies the same array to both — so a plugin with one view-based
  and one declarative assistant still legitimately needs it (§9.5). It simply has no effect on what a
  view saves. Remove it once no assistant on the plugin is declarative.
- **The view-versus-page rule is only enforceable here.** Views and pages compile into a single
  `routable_pages` collection in the published payload, so nothing downstream can tell them apart.
  If this check does not run, pointing `view` at a page fails at render time instead, with no useful
  message.

### 12.6 Local testing

The local viewer has no install flow, so it does not emulate the setup hash or the
re-prompt-on-enable behavior. A view that never calls `completeSetup` therefore looks fine locally
and re-prompts forever once published. Check the published behavior before shipping — see
[getting started](02-getting-started.md) for the current state of local setup-view support.

---

## 13. How config reaches scripts

### 13.1 Browser surfaces (JS)

Every browser artifact config is stamped at load time with `args = <the plugin's business config>`.
That is the whole business config object, so:

- `this.args.<key>` reads **top-level** business-config keys — the ones a `config_template` seeds, or
  that a script wrote directly.
- `this.config.<key>` reads assistant answers — a read-only proxy over `this.args.__kizen_clean_config`.
- `this.userConfig.<key>` reads user-assistant answers — a proxy over the reserved
  `__kizen_user_config.__kizen_clean_config` arg every host injects.

```js
// src/blocks/summary/script.js
const objectId = this.config.syncObjectId?.objectId;
const mode = this.config.syncMode?.value ?? "incremental";
const nickname = this.userConfig.displayNickname;

if (!objectId) {
  this.showToast("Finish app setup first.", { variant: "alert" });
  return;
}
```

Both proxies are **read-only and snapshot-in-time**: a value written during this run does not appear
until the next worker load. Prefill UI from a fresh read instead (§13.3).

`this.userConfig` (user-assistant answers) is a different store from
`this.getUserConfig()` / `this.setUserConfig()` (per-component scratch state) — see
[worker runtime API](04-worker-runtime-api.md).

### 13.2 Python Agentic Workflow steps

Python steps do not receive `this.config`. To read business config in a step, the workflow builder
maps an input to the business-plugin-config source, which arrives as a JSON string under that input's
name. See [Agentic Workflow steps](07-automation-steps.md).

### 13.3 Writing business config from a script

For **setup** config, use [`this.completeSetup()`](#123-completing-setup) — it writes the same store
the assistant does, preserves the sibling `__kizen_*` keys, and stamps the hash. Everything below is
for the rest of the business config: arbitrary top-level keys a plugin maintains at runtime, which
have no dedicated helper (there is no `setBusinessConfig`) and are written with a plain platform
call:

```
GET   /external-integrations/business-plugin-apps/{identifier}
PATCH /external-integrations/business-plugin-apps/{identifier}
```

`identifier` may be the record UUID or the plugin api_name — **always build it from
`this.pluginApiName`**, never a literal, because preview builds carry a suffixed api_name and a
hardcoded one 404s.

**PATCH replaces the `config` object wholesale.** There is no server-side merge and no validation.
Read, modify, write:

```js
// Add one key without destroying the assistant's stores.
const url = `/external-integrations/business-plugin-apps/${this.pluginApiName}`;

// ignoreCache is required: relative GETs are memoized for the worker's lifetime, and a
// read-modify-write built on a cached config silently writes back stale values.
const [current, readError] = await this.getWithErrors(url, { ignoreCache: true });
if (readError) {
  this.showToast("Could not read app configuration.", { variant: "failure" });
  return;
}

const [, writeError] = await this.patchWithErrors(url, {
  config: {
    ...(current?.config ?? {}),
    lastSyncedAt: new Date().toISOString(),
  },
});

if (writeError) {
  this.showToast("Could not save app configuration.", { variant: "failure" });
}
```

Rules that follow from wholesale replacement:

- Spread the **freshly read** config every time. Re-read immediately before the PATCH; a config read
  at the top of a long-running script is stale by the time you write it.
- Prefer one merged PATCH per batch of changes over several sequential ones.
- The config row exists only after install. Both GET and PATCH 404 against a business that has never
  installed the plugin — a script cannot create it.
- Reading requires the marketplace view permission; writing requires the manage permission.
- **Do not co-write keys the assistant owns.** The assistant regenerates `__kizen_clean_config` from
  its own `__kizen_setup_assistant_values` on the next save, silently discarding anything a script put
  there. Keep script-written keys disjoint from assistant field keys — or write both stores.

See [platform API](05-platform-api.md) for the endpoint shapes and the `*WithErrors` convention.

---

## 14. Which layer recognizes which prop

Three layers touch an assistant field, and they do not agree:

| Layer | What it is | What it does with fields |
|---|---|---|
| **Packager type** (`SetupAssistantField` in `@kizenapps/packager`) | Compile-time TypeScript only | Nothing at runtime. Knows 8 types and 11 props. |
| **Engine type** (`AssistantField` in `@kizenapps/engine`) | Compile-time TypeScript only | Nothing at runtime. Knows 11 types and ~30 props. |
| **Renderer** (the Kizen app's assistant UI) | Actually renders the form | The authority. Reads exactly the props documented per type above. |

**The practical rule: the runtime set is what renders; untyped props pass through packaging
untouched.** The packager's assistant pipeline is untyped internally — it spreads each field object,
injects any matching per-field scripts, and emits it. It performs **no field-level validation
whatsoever**. A field with a misspelled prop, an unknown `type`, or a prop from a newer engine
packages and publishes cleanly and fails (or silently no-ops) at render time.

Concretely, as of engine 1.8.0:

- Types `qr`, `image`, and `link` render, and are in the engine type, but are **missing from the
  packager type**. They are in everyday use.
- Props `getFetchUrl`, `optionMapper`, `getHeaders`, `getBody`, `getContextUrl`, `fetchMethod`,
  `typeahead`, `autoSelect`, `required`, `tooltip`, `dependencies`, `validation_pattern`, `match_hint`,
  `src`, `link`, `title`, `width`, `height`, `href`, `text`, `size`, `value`, and `include` all render
  but are **missing from the packager type**. (The packager *injects* the five script props itself yet
  does not declare them.)
- `services` is in the engine config type and is honored by the renderer, but is absent from the
  packager config type. It passes through untyped.
- `actions` is deliberately different per layer: `string[]` when you author it, expanded to
  `{api_name, name, hint_object_name?}[]` at package time, which is what the renderer consumes. **Do
  not author objects.**

Consequence for tooling: typechecking your authored `assistant.json` against the packager's exported
types will produce false errors on `qr`/`image`/`link`/`tooltip`/`required` and most other props.
Don't. Validate against the engine's `AssistantField` if you want types at all.

This authored-type-lags-runtime pattern is not unique to assistants — Agentic Workflow step outputs are the
same story, where the packager's `conflict_resolution` union omits `update_if_blank` even though the
workflow builder offers `overwrite`, `update_if_blank`, `add_only`, `remove_only`, and
`overwrite_except_null`. Treat every packager type as advisory. See
[Agentic Workflow steps](07-automation-steps.md).

---

## 15. Complete example — business setup assistant

`src/setupAssistant/assistant.json`:

```json
{
  "services": [
    { "api_name": "example_business", "required": false, "prerequisite": true }
  ],
  "actions": ["sync_record", "push_note"],
  "fields": [
    {
      "type": "description",
      "key": "intro",
      "content": "Configure **Example Plugin** for this business. These answers become the install config: scripts read them as `this.config.<key>`, and artifact configs gate themselves with `\"when\": \"Boolean({{config.<key>}})\"`."
    },
    {
      "type": "container",
      "columns": 2,
      "label": "Feature Toggles",
      "key": "featureToggles",
      "fields": [
        {
          "type": "boolean",
          "label": "Enable Dashboard Blocks",
          "key": "enableBlocks",
          "default": true,
          "tooltip": "Both dashboard blocks carry a when-condition on this value."
        },
        {
          "type": "boolean",
          "label": "Enable Reports Toolbar Item",
          "key": "enableReports",
          "default": true
        }
      ]
    },
    {
      "type": "description",
      "key": "reportsHiddenNote",
      "content": "<p style=\"color:#b45309;\">The <strong>Reports</strong> toolbar item is hidden while this is off.</p>",
      "when": "{{enableReports}} === false"
    },
    {
      "type": "container",
      "columns": 2,
      "label": "Connection",
      "key": "connection",
      "fields": [
        {
          "type": "text",
          "label": "Account Slug",
          "key": "accountSlug",
          "required": true,
          "validation_pattern": "^[a-z0-9-]+$",
          "placeholder": "acme-corp",
          "tooltip": "Lowercase letters, digits and dashes only."
        },
        {
          "type": "number",
          "label": "Page Size",
          "key": "pageSize",
          "placeholder": "50",
          "tooltip": "Left blank, the key is absent from config and the script falls back to 50."
        },
        {
          "type": "select",
          "label": "Sync Mode",
          "key": "syncMode",
          "required": true,
          "placeholder": "Pick one",
          "options": [
            { "label": "Full", "value": "full" },
            { "label": "Incremental", "value": "incremental" }
          ]
        },
        {
          "type": "select",
          "label": "Notify On",
          "key": "notifyOn",
          "allow_multiple": true,
          "placeholder": "Pick any number",
          "options": [
            { "label": "Success", "value": "success" },
            { "label": "Failure", "value": "failure" },
            { "label": "Partial", "value": "partial" }
          ]
        }
      ]
    },
    {
      "type": "boolean",
      "label": "Map Records to a Kizen Object?",
      "key": "configureMapping",
      "default": false,
      "tooltip": "Unlocks the object and field pickers — they need an object to pick fields from."
    },
    {
      "type": "custom_object",
      "label": "Sync Object",
      "key": "syncObjectId",
      "required": true,
      "when": "{{configureMapping}} === true",
      "match_hint": "client_client"
    },
    {
      "type": "container",
      "columns": 2,
      "label": "Field Mapping",
      "key": "fieldMapping",
      "when": "{{configureMapping}} === true",
      "fields": [
        {
          "type": "field",
          "label": "Email Field",
          "key": "emailField",
          "required": true,
          "match_hint": "email",
          "object_id": "{{syncObjectId}}"
        },
        {
          "type": "field",
          "label": "Extra Fields to Sync",
          "key": "extraFields",
          "allow_multiple": true,
          "object_id": "{{syncObjectId}}"
        }
      ]
    },
    {
      "type": "container",
      "columns": 2,
      "label": "Remote Workspace",
      "key": "remoteWorkspace",
      "fields": [
        {
          "type": "description",
          "key": "asyncNote",
          "content": "These selects fetch live through the `example_business` service proxy — authorize it above first."
        },
        {
          "type": "select",
          "label": "Workspace",
          "key": "workspace",
          "autoSelect": true,
          "tooltip": "Auto-selects when exactly one workspace comes back."
        },
        {
          "type": "select",
          "label": "Channels",
          "key": "channels",
          "allow_multiple": true,
          "dependencies": ["workspace"],
          "tooltip": "Re-fetches whenever the workspace changes."
        }
      ]
    },
    {
      "type": "container",
      "columns": 3,
      "label": "Resources",
      "key": "resources",
      "fields": [
        {
          "type": "image",
          "key": "brandMark",
          "src": "https://cdn.example.com/brand-240x80.png",
          "title": "Example Plugin",
          "width": 240,
          "link": { "text": "Example", "href": "https://example.com" }
        },
        {
          "type": "qr",
          "key": "mobileEnrollment",
          "value": "/mobile-setup",
          "include": ["email", "business_id"],
          "size": 160
        },
        {
          "type": "link",
          "key": "docsLink",
          "text": "Setup Documentation",
          "href": "https://docs.example.com/example-plugin"
        }
      ]
    }
  ]
}
```

`src/setupAssistant/workspace/getFetchUrl.js`:

```js
({ state }) =>
  `/external-integrations/proxy/${state.pluginApiName}/example_business/v1/workspaces`;
```

`src/setupAssistant/workspace/optionMapper.js`:

```js
({ state }) =>
  (state.result?.data?.workspaces ?? []).map((w) => ({ label: w.name, value: w.id }));
```

`src/setupAssistant/channels/getFetchUrl.js`:

```js
({ state }) => {
  const workspaceId = state.workspace?.value?.value || "default";

  return `/external-integrations/proxy/${state.pluginApiName}/example_business/v1/workspaces/${encodeURIComponent(workspaceId)}/channels`;
};
```

`src/setupAssistant/channels/optionMapper.js`:

```js
({ state }) =>
  (state.result?.data?.channels ?? []).map((c) => ({
    label: c.display_name || "(unnamed channel)",
    value: c.id,
  }));
```

Reading it back from any browser surface:

```js
const slug = this.config.accountSlug;                   // "acme-corp"
const pageSize = this.config.pageSize ?? 50;            // absent when blank
const mode = this.config.syncMode?.value;               // "full"
const notify = (this.config.notifyOn ?? []).map((o) => o.value); // ["failure"]
const objectId = this.config.syncObjectId?.objectId;    // uuid
const emailFieldId = this.config.emailField?.fieldId;   // uuid, not api_name
const channelIds = (this.config.channels ?? []).map((c) => c.value);
```

Gating an artifact on it, in `src/toolbarItems/reports/config.json`:

```json
{
  "api_name": "reports",
  "label": "Reports",
  "icon": "chart-bar",
  "when": "Boolean({{config.enableReports}})"
}
```

---

## 16. Complete example — user setup assistant

`src/userSetupAssistant/assistant.json`:

```json
{
  "services": [
    { "api_name": "example_user", "required": false, "prerequisite": true }
  ],
  "fields": [
    {
      "type": "description",
      "key": "userIntro",
      "content": "Each user answers this for **themselves**. Values are user-scoped: scripts read them as `this.userConfig.<key>`, and one user's answers never affect another's. `example_user` is the user-level OAuth counterpart to the business-level `example_business` service — each user connects their own account."
    },
    {
      "type": "text",
      "label": "Display Nickname",
      "key": "displayNickname",
      "placeholder": "e.g. KJ",
      "tooltip": "A user-scoped scalar, read back as this.userConfig.displayNickname."
    },
    {
      "type": "boolean",
      "label": "Show Reports Toolbar Item For Me",
      "key": "showReportsForMe",
      "default": true
    },
    {
      "type": "select",
      "label": "My Calendars",
      "key": "myCalendars",
      "allow_multiple": true,
      "when": "Boolean({{showReportsForMe}})",
      "tooltip": "Fetched through the example_user proxy with your own token — authorize the service above first."
    }
  ]
}
```

`src/userSetupAssistant/myCalendars/getFetchUrl.js`:

```js
// Identical mechanism to the business assistant, but the proxy resolves a user-level
// service, so the request carries the current user's token and each user sees their own data.
({ state }) =>
  `/external-integrations/proxy/${state.pluginApiName}/example_user/v1/calendars`;
```

`src/userSetupAssistant/myCalendars/optionMapper.js`:

```js
({ state }) =>
  (state.result?.data?.calendars ?? []).map((c) => ({ label: c.name, value: c.id }));
```

Reading and double-gating — a surface that requires both a business toggle and the user's own opt-in,
in `src/toolbarItems/reports/config.json`:

```json
{
  "api_name": "reports",
  "label": "Reports",
  "when": "Boolean({{config.enableReports}}) && Boolean({{userConfig.showReportsForMe}})"
}
```

```js
// src/toolbarItems/reports/script.js
const nickname = this.userConfig.displayNickname ?? this.currentUser.profile.first_name;
const calendarIds = (this.userConfig.myCalendars ?? []).map((c) => c.value);
```

---

## 17. Gotchas

- **`when` scoping is inconsistent by design.** Inside an assistant: bare `{{key}}`. On artifact
  configs: `{{config.key}}` / `{{userConfig.key}}`. Using the assistant form on an artifact makes the
  expression resolve to `null` and the artifact silently disappears.
- **`when` is textual substitution, not variable binding.** `{{key}}` becomes the JSON literal of the
  value; an unset key becomes `null`. `"{{flag}} === false"` is false for an untouched field — write
  `"Boolean({{flag}})"` or `"!{{flag}}"`.
- **A hidden field's value is deleted on save.** Fields whose `when` is false are excluded from the
  saved key set entirely. Flipping a toggle off, saving, then flipping it back on gives you the
  field's `default`, not the prior answer.
- **`select` values are objects.** `this.config.mode` is `{label, value}`. Interpolating it into a URL
  yields `[object Object]`. Always read `.value`.
- **`custom_object` values are objects too, and the key name differs by context.** In config it is
  `{objectId, objectName}`; inside the assistant's own `when` expressions the raw shape is
  `{id, objectName}`. Interpolating the object into a records URL produces
  `/records/[object Object]/...`, which the API rejects in a way that reads like a permissions error.
- **`allow_multiple` on `custom_object` does not round-trip.** The picker renders and the raw store
  holds an array, but the clean-config normalizer has no array branch for this type — `this.config.<key>`
  comes back as `{objectId: undefined, objectName: undefined}`. Use several single-object pickers, or
  keep multi-object linking to the built-in `actions` step. (`field` *does* handle arrays correctly.)
- **`field` values carry the field id, not the api_name.** Resolve names via the object detail if you
  need them.
- **`object_id: "{{someKey}}"` only resolves `custom_object` keys.** Pointing it at a `text` or
  `select` key yields nothing and the field picker stays empty with no error.
- **A blank `number` is an absent key**, not `0` and not `null`. Always `??` a fallback.
- **A `text` field with a `default` can never be blank** — saving empty stores the default.
- **`actions` only works on the business assistant.** The packager expands the string list into action
  objects for `setup_assistant` only; the same list on `user_setup_assistant` passes through as raw
  strings and the mapping step renders nothing usable. Also: the referenced api_names must resolve, or
  packaging fails with `structure/setup-assistant-action-ref`.
- **Nothing validates `services[].api_name`.** A typo silently removes the entire OAuth prerequisite
  gate — setup looks complete while every proxy call fails.
- **The assistant gets essentially zero packaging validation.** Unknown `type` values render an
  "invalid block" placeholder; misspelled props are ignored. Both publish cleanly. Test the rendered
  assistant, don't trust the build.
- **Any edit to the assistant re-prompts every business on next enable**, because the hash covers the
  whole definition including labels and ordering. That is the feature; just know a typo fix in a
  tooltip triggers it.
- **A non-declarative setup path must stamp `__kizen_setup_assistant_hash` itself**, or the install
  modal reappears on every enable.
- **Business config PATCH replaces the whole `config` object.** Forgetting to spread the existing
  config wipes `__kizen_setup_assistant_values`, `__kizen_clean_config`, and the hash — which
  re-prompts everyone and loses every answer.
- **Don't co-write assistant keys from a script.** The next assistant save regenerates
  `__kizen_clean_config` from its own value store and discards anything else. Keep script keys
  disjoint.
- **`this.config` is stale within a run.** It is a snapshot of the args the worker loaded with; a value
  you just PATCHed will not appear until the next load. Prefill UI from a fresh GET.
- **`this.config` is empty inside a view opened with args**, because passed args replace the injected
  business config. Pass `config: this.config` through the args by hand. Event scripts inherit the same
  limitation — see [views, modals & forms](10-views-modals-forms.md).
- **Per-field scripts run in the browser, not a worker.** No `this`, no `this.getServiceUrl`. Build
  `/external-integrations/proxy/${state.pluginApiName}/<service>/<path>` by hand, and always use
  `state.pluginApiName` — preview builds suffix the api_name and a hardcoded literal 404s.
- **Per-field script files must be arrow-function expressions.** Statements, function declarations, or
  `export` produce a file that packages but cannot run.
- **Guard dependent async selects.** `getFetchUrl` runs before the parent field is picked; return a
  valid URL (with a sentinel or a safe default) or the request errors and the dropdown is empty.
- **Options-fetch failures are silent** — an empty dropdown, no toast. Only a `getContextUrl` failure
  toasts. Check the network tab when a dynamic select renders empty.
- **`getHeaders` / `getBody` are ignored for proxy-relative URLs.** They only apply to absolute URLs
  fetched directly by the browser, which then carry no Kizen credentials and are subject to CORS.
- **Inline `kizen.json` `setup_assistant` silently wins over `src/setupAssistant/assistant.json`** —
  including discarding that directory's per-field scripts. Don't keep both.
- **Changing a field `key` is a breaking migration.** Existing businesses lose the answer, and every
  artifact `when` clause referencing the old key (case-sensitively) starts resolving to the field
  `default`.

View-based assistants ([§12](#12-view-based-setup-assistants)) add their own:

- **`completeSetup` replaces the clean config wholesale.** It preserves sibling `__kizen_*` keys but
  not clean-config keys you omit, so a view that edits one setting still has to send every key the
  plugin's other surfaces read.
- **Every `completeSetup` call stamps the setup hash, from any surface.** A call from a block or
  toolbar item suppresses the install-time prompt on the next enable just as effectively as a real
  setup run.
- **An unguarded submit handler can save a blank payload.** A click landing on a form's own padding
  runs the handler with no `this.args.formData`; without a guard the view writes an empty config and
  stamps the hash. Guard with `const formData = this.args?.formData; if (!formData) return;`.
- **Calling `completeSetup` mid-wizard closes the modal.** The host treats a successful call as
  completion. Call it once, at the end.
- **`view` takes a view's api_name, not its directory name**, and a `pages/` component is rejected.
- **A setup view can't be conditionally hidden.** Views aren't feature-flag filtered and take no
  `when` clause, so there is no gating the setup surface on config or flags — branch inside the
  view instead.
- **Setup views get no host chrome and no host Save.** No header, no footer, no close button, no
  OAuth step, fixed 900px width — and Escape or a backdrop click discards everything silently.
