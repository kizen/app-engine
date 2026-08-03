# Kizen Platform REST API (from plugin code)

What this covers: the Kizen REST endpoints your plugin code actually calls — custom objects,
fields, records, activities, business settings, teams, plugin business config, and integration
secrets — plus the conventions (paths, pagination, errors, rate limits) that apply to all of them,
and the three authenticated paths external systems use to push data into Kizen. Every endpoint gets
its own heading so it can be grepped by path.

See also:
- [Worker runtime API](04-worker-runtime-api.md) — the `this.get*/post*/patch*/delete*` helper
  semantics, caching, and error tuples used by JavaScript surfaces.
- [Auth, secrets & services](06-auth-secrets-services.md) — the service proxy, OAuth, and how
  secret values reach your code.
- [Agentic Workflow steps](07-automation-steps.md) — the Python code-step runtime and the
  `kizen.api` client.
- [Errors & observability](15-errors-and-observability.md) — what to do with a failed request.

---

## 1. Two callers, one API

Plugin code reaches the same public REST API from two runtimes. The endpoints are identical; the
transport, the identity, and the resulting permission filtering are not.

| | JavaScript surfaces (workers) | Python Agentic Workflow code steps |
|---|---|---|
| Client | `this.get` / `this.getWithErrors` / `this.post…` etc. | `kizen.api.get/post/patch/put/delete/head/options` |
| Selector | any URL starting with `/` is routed to the Kizen API | any path starting with `/` is joined to the Kizen API base |
| Identity | the signed-in employee (host session) | the plugin's own service account |
| Permissions | whatever that employee can see | service-account scope, business-scoped |
| `PUT` available | **no** (`this.put` does not exist) | yes |
| Auth headers | added by the host | added by `kizen.api` |

### Path prefix rule

Endpoint headings in this document use the full server path (`/api/records/{object}/add`) because
that is the canonical route. **In plugin code you omit the `/api` prefix** — both clients prepend
it for you.

```js
// JavaScript worker
const [record, error] = await this.getWithErrors(
  `/records/example_object/${recordId}`,
);
```

```python
# Python code step
resp = kizen.api.get(f"/records/example_object/{record_id}")
```

Absolute URLs bypass the Kizen client entirely: in a worker they become a plain `fetch` from the
worker, and in Python `kizen.api` passes them through unauthenticated by Kizen. Use relative paths
for Kizen and the [service proxy](06-auth-secrets-services.md) for third-party APIs.

### Authentication

You never assemble credentials yourself.

- **JavaScript workers**: the host bridge performs the request inside the authenticated app
  session. Requests also carry `X-Request-Type: kizen-ui-scripting-api` for `get`, `post` and
  `delete` — see the [worker runtime notes](04-worker-runtime-api.md) for the `patch` exception.
- **Python code steps**: `kizen.api` wraps a session pre-loaded with `X-API-KEY`, `X-USER-ID` and
  `X-BUSINESS-ID`. The API key is a short-lived signed key minted for that step run (default TTL
  10 minutes) bound to one business and to the plugin's service account. You cannot mint,
  read, or extend it, and it is valid only for the business the step is executing in.
  Cross-business calls are impossible.

Python steps run as the plugin's own service account rather than as a person, so they are not
subject to the per-user permission filtering that applies to worker calls. Worker calls inherit the
signed-in user's permissions, which means the *same endpoint can return fewer rows in a worker than
in a step*. Never treat an empty worker result as proof a record does not exist — see
[Gotchas](#gotchas).

### Trailing slashes

The API router is configured without trailing slashes. `GET /api/records/example_object` is
correct; `GET /api/records/example_object/` is not.

---

## 2. Conventions

### Pagination

Paginated list endpoints take `page` and `page_size` query params and return:

```json
{
  "count": 137,
  "next": "https://<host>/api/custom-objects?page=2",
  "previous": null,
  "results": [ ... ],
  "errors": []
}
```

| Fact | Value |
|---|---|
| Default page size | 100 |
| Maximum `page_size` | 1000 |
| Plugin-app list & release notes page size | 20 |
| `errors` non-empty | the response is returned as **HTTP 400**, not 200 |

Two variants exist and the difference matters:

- **With count** (custom objects, integration secrets, most business lists): the envelope above.
- **Default paginator** (used by several other lists): **omits `count`** — it fetches
  `page_size + 1` rows to decide whether `next` exists. Do not compute totals from these.

Some heavy lists are **not paginated at all** and return a bare JSON array: object fields, field
categories, and `GET /api/team` in its default mode. Passing `page_size` to `GET /api/team`
switches it into paginated mode.

When following `next` from a worker, remember the helpers re-prepend `/api`; strip the origin and
the leading `/api` from `next` before passing it back to `this.get`.

### Error response shape

Single-detail errors are normalized to:

```json
{ "detail": "Not found.", "code": "not_found" }
```

Two codes are easy to conflate, and they mean different things:

| Code | Status | What it means |
|---|---|---|
| `not_found` | 404 | The addressed resource does not exist. This is the generic lookup miss you branch on after a `GET`. |
| `does_not_exist` | 400 | A *referenced* id in a request body did not resolve — a relation or foreign-key validation failure. The resource you addressed was fine; something you pointed it at was not. |

Branching on `does_not_exist` to detect a missing record is a common miss: a `GET` for an absent
record never carries it.

Field validation errors come back keyed by field name:

```json
{ "object_name": ["This field is required."] }
```

Endpoints opting into detailed errors return per-field objects instead:

```json
{ "name": [{ "message": "Enter a valid value.", "code": "invalid" }] }
```

Record write endpoints use a **positional** envelope keyed to the `fields` array you submitted —
entry *n* of the response `fields` array describes entry *n* of your request, and is `{}` when that
entry was accepted:

```json
{
  "non_field_errors": ["..."],
  "fields": [ {}, { "value": ["..."] }, {} ]
}
```

Common `code` values you should branch on: `conflict`, `does_not_exist`, `forbidden_field_write`,
`invalid_identifier`, `limit_exceeded`, `max_fields_exceeded`, `max_objects_exceeded`,
`payload_exceeded`, `permission_required`, `required`, `unique`.

Notable statuses:

| Status | Meaning in this API |
|---|---|
| 400 | validation failure, or a paginated response with a non-empty `errors` array |
| 403 | permission denied — including per-field write permission (`forbidden_field_write`) |
| 404 | not found **or** not visible to the caller |
| 409 | `conflict` — concurrent archive/write on the same record |
| 500 | see the decimal-cap and integration-secret gotchas below |

JSON is rendered with an orjson-based renderer and **decimals are serialized as strings**. Parse
money and decimal values accordingly.

Every response carries `X-Request-ID`; include it when reporting a platform problem.

### Rate limits

Design against these platform limits:

- Hard quotas: 500 custom objects per business, 500 fields per object.
- Record write locking (409 on concurrent conflict).
- Agentic Workflow trigger dedup throttling (see [webhook trigger](#getpost-apiautomationsautomation_identifierwebhookwebhook_name)).
- A 250 KB body cap on the Webhook SmartConnector, and a 50 MB body ceiling platform-wide.
- Code-step execution and logging caps — see [Agentic Workflow steps](07-automation-steps.md).

Client-side 429 handling is still required, because **calls you make through the service proxy hit
third-party rate limits**. The proxy returns HTTP 200 wrapping the upstream status, so a 429 from
the upstream service arrives as `body`/`status_code` inside the envelope rather than as a failed
request. See [auth, secrets & services](06-auth-secrets-services.md) for the envelope shape and
retry patterns.

---

## 3. Custom objects

Custom objects are the schema layer: an object owns fields, and records are instances of an object.

### `POST /api/custom-objects`

Creates a custom object. Slow and side-effect heavy — it also provisions a default field category,
default fields, pipeline stages, admin permissions, and a default dashboard.

Request body:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `object_name` | string | yes | Plural display name, e.g. `"Support Tickets"` |
| `entity_name` | string | yes | Singular display name, e.g. `"Support Ticket"` |
| `object_type` | `"standard"` \| `"pipeline"` | yes | Immutable after create |
| `has_commerce_data` | boolean | yes | Enables commerce/value tracking columns |
| `default_on_activities` | boolean | yes | Whether the object is preselected on activities |
| `pipeline` | object | only when `object_type == "pipeline"` | Stage definitions |
| `name` | string | no | The api-name column — **do not send it**, see below |
| `description` | string (≤500) | no | |
| `meta` | object | no | Free-form metadata |
| `related_objects` | array | no | `{related_object, relation_type, rollup_timeline, rollup_leadsources, field_id?}` |
| `rollup_related_leadsources` | boolean | no | |
| `quick_filtering_enabled` | boolean | no | |
| `action_override_create` | UUID/null | no | Create-action override wiring |
| `track_entity_value` | boolean | no | Provisions a real money field `entity_value` |
| `include_percentage_to_close` | boolean | no | Pipeline forecasting |
| `use_ai_to_update_percentage` | boolean | no | |
| `ai_confidence_threshold` | number | no | One of `0.8`, `0.9`, `0.95` |
| `reasons_lost` / `reasons_disqualified` | array | pipeline only | |
| `allow_on_forms` | boolean | no | |
| `default_color` | string | no | Defaults to `#085BEE` |
| `default_icon` | string | no | Defaults to `bars-light` |

`association_source*` keys are silently ignored on create.

Response `201` with the full object representation, including the read-only extras `id`,
`is_custom`, `fetch_url`, `number_of_records`, `owner`, `access`, `entity_access`, `created`,
`record_layouts`.

#### The `name` field — omit it and capture what the server derives

Custom objects have no `api_name` field. The api-name-like column is **`name`**, and it is
**server-derived when you omit it**: `slugify(object_name)` with `-` replaced by `_`, plus a random
suffix only when the slug collides with a reserved word or an existing name (soft-deleted objects
included).

Writing `name` explicitly is a **staff-only field write**. A plugin service account or an ordinary
employee gets `403` with code `forbidden_field_write`. Reference code that sends `name` and
appears to work is running under a staff account and will not work for you.

The safe pattern is: omit `name`, then persist the `name` the server assigned.

```python
resp = kizen.api.post("/custom-objects", json={
    "object_name": "Example Widgets",
    "entity_name": "Example Widget",
    "object_type": "standard",
    "has_commerce_data": False,
    "default_on_activities": False,
})
resp.raise_for_status()
created = resp.json()
object_api_name = created["name"]   # e.g. "example_widgets" — store this
object_id = created["id"]
```

If you do supply `name` (staff contexts only) it must match `^[a-zA-Z0-9_-]+$`, must not be a UUID,
must not start or end with `_`/`-`, must not be a reserved word, and must be unique per business
including soft-deleted rows.

#### Soft-delete tombstones rename

Archiving an object renames its `name` to `{name}_discarded_{timestamp}`. That is why re-creating
an object with the same `object_name` usually gets the clean slug back rather than a suffixed one —
but it is not guaranteed, which is the reason you must store the returned `name` instead of
recomputing the slug yourself.

#### Quota

Exceeding 500 objects per business returns `400` with code `max_objects_exceeded`.

### `GET /api/custom-objects`

Paginated list (with `count`), plus a top-level `access: {edit}` key alongside the standard
envelope.

| Query param | Meaning |
|---|---|
| `custom_only` | **Defaults to `true`** — pass `false` to include standard objects |
| `name` | Exact api-name filter |
| `object_name` | Display-name filter |
| `is_custom` | boolean |
| `object_type` | `standard` \| `pipeline` |
| `default_on_activities` | boolean |
| `allow_relations` | boolean |
| `search` | Fuzzy over object and entity name |
| `ordering` | Sort field |
| `page`, `page_size` | Pagination |

The list serializer is minimal — use the detail route when you need field metadata.

### `GET /api/custom-objects/{identifier}`

`identifier` is the object UUID **or** its `name`. Returns the full object plus
`browser_js_actions`, `browser_route_scripts`, and `custom_actions` (the plugin artifacts wired to
this object).

This route is the reliable way to resolve an api-name to an id. Prefer it over
`settings-search` when you know the exact name.

### `GET /api/custom-objects/settings-search`

Search objects by `?name=` for settings UIs.

> This route is **permission-filtered**. An empty result means "not visible to this employee", not
> "does not exist". Never use an empty `settings-search` response as evidence to create a new
> object — fall through to `GET /api/custom-objects/{name}` and treat only a `404` as confirmation.

### `GET /api/custom-objects/{object_id}/detail`

Returns the object together with its field metadata, which gives you the field api-name → field-id
map needed to write records by id.

> Unverified: the exact response envelope of this route is not documented here. Treat
> `GET /api/custom-objects/{object_id}/fields` as the authoritative source for field metadata.

### `GET /api/custom-objects/{object_id}/categories`

Returns a **bare array** (unpaginated) of field categories, each with `id` and `name`. You need a
category UUID to create a field. A freshly provisioned contact object has exactly one category.

### `GET /api/client/custom-object`

Returns the business's contact (client) object, including `undeletable_fields` — a map keyed by
field api-name whose values include the field `id`. This is how you resolve contact field ids
without hardcoding them.

Workers can also read the client object id from the injected business context rather than making
this call; see [worker runtime](04-worker-runtime-api.md).

### `DELETE /api/custom-objects/{object_id}`

Archives (soft-deletes) the object; it does not hard-delete.

- Returns `405` for non-custom (standard) objects.
- Returns `400` with code `custom_object_archive_blocked` when the object still has active records
  or protected references.
- Archive relationship-*owning* objects before their targets, otherwise the protected reference
  blocks the delete.

---

## 4. Fields

### `GET /api/custom-objects/{object_id}/fields`

**Unpaginated** — returns a plain JSON array. Results are permission-filtered per employee, and
each field is annotated with `access` and `ui_default_value`.

Per-field read shape:

| Field | Type | Meaning |
|---|---|---|
| `id` | UUID | Field id — the key used in record `fields` maps |
| `name` | string | Field api-name |
| `display_name` | string | Human label |
| `field_type` | string | See the type list below |
| `category` | UUID | Field category |
| `is_required`, `is_read_only`, `is_hidden`, `is_deletable` | boolean | |
| `meta`, `properties` | object | Type-specific extras |
| `options` | array | Choice options, `{id, code, name}` |
| `relation` | object | Relationship configuration |
| `rating` | object | Rating configuration |
| `phonenumber_options` | object | |
| `money_options` | object | See below |
| `decimal_options` | object | `{min_value, max_value, …}` |
| `ui_default_value` | any | |
| `allow_on_forms` | boolean | |
| `access` | object | Caller's permission on this field |

### `POST /api/custom-objects/{object_id}/fields`

Creates a field.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `field_type` | string | yes | One of the types listed below |
| `display_name` | string | yes | Human label |
| `category` | UUID | **yes** | Field category id — nominally optional, actually rejected when missing |
| `name` | string | no | Api-name; **server-derived from `display_name` when omitted** |
| `is_required` | boolean | no | |
| `allow_multiple` | boolean | no | For `files`, multi-select types |
| `relation` | object | when `field_type == "relationship"` | |
| `money_options` | object | when `field_type == "money"` | |
| `rating` | object | when `field_type == "rating"` | |
| `decimal_options` | object | no | For `decimal` |
| `allow_on_forms` | boolean | no | |

`field_type` values: `checkbox`, `checkboxes`, `choices`, `date`, `datetime`, `decimal`,
`dropdown`, `dynamictags`, `email`, `files`, `integer`, `longtext`, `money`, `phonenumber`,
`radio`, `rating`, `relationship`, `selector`, `status`, `team_selector`, `text`, `timezone`,
`wysiwyg`, `yesnomaybe`.

Types confirmed to work end-to-end through this API: `text`, `dropdown`, `decimal`, `integer`,
`date`, `datetime`, `relationship`, `money`, `files`.

`name` derivation mirrors the object rule: `slugify(display_name)` with `-` → `_`, and a numeric
retry suffix on collision. Capture `created["name"]` rather than recomputing it.

Quota: 500 fields per object; exceeding it returns `400` code `max_fields_exceeded`.

#### `money_options`

Required for `money` fields despite being nominally optional — omitting it fails validation.

| Field | Type | Access | Meaning |
|---|---|---|---|
| `id` | UUID | read-only | |
| `currency` | string | write | ISO currency code; defaults to `"USD"` |
| `symbol` | string | read-only | Derived from `currency` |

```json
{ "field_type": "money", "display_name": "Contract Value",
  "category": "…", "money_options": { "currency": "USD" } }
```

There is exactly one `money_options` per money field, and the currency is a property of the
*field*, not of each value. See [business settings](#get-apibusinessmine) for where to source a
sensible default currency.

#### Reserved and constrained field facts

- **`status` is a reserved field api-name** → `400`. Prefix generic nouns:
  `example_plugin_status`, `ticket_status`. The same caution applies to any short generic noun; a
  reserved-word collision on an auto-derived name silently produces a suffixed name instead.
- **`decimal_options.max_value` above `999999.99` returns HTTP 500.** That is the real ceiling —
  six digits before the decimal point, two after. Larger values pass request validation and are
  rejected later at write time, which is why the failure surfaces as a 500 rather than a 400. Use
  `integer` or a string field if you need a wider range.
- **Dropdown options cannot be created inline.** Creating the field with a non-empty `options`
  array (or an empty one) is rejected. Create the field first, then add options one at a time —
  see below.
- **Relationship fields** require `relation: {related_object, related_category, relation_type,
  related_name}`. `relation_type: "primary"` is the common case. The reverse field is auto-created.
  Two relationship fields pointing at the same related object need **distinct `related_name`
  values**.
- **`files` is the attachment/photo type.** There is no dedicated image type. Values are arrays of
  uploaded-file UUIDs; set `allow_multiple: true` for more than one.

### `POST /api/custom-objects/{object_id}/fields/{field_id}/options`

Adds a single option to a choice-style field. Body: `{"name": "Option label"}`.

Call it once per option. Duplicate names are rejected case-insensitively.

> Never `PATCH` the field's `options` array to add an option — that is a **destructive replace**
> and drops options that existing records reference.

### `PATCH /api/custom-objects/{object_id}/fields/{field_id}`

Updates field metadata (`display_name`, `is_required`, `is_hidden`, `category`, type-specific
sub-objects). `field_type` is effectively immutable once records carry values.

### `DELETE /api/custom-objects/{object_id}/fields/{field_id}`

Deletes the field. Returns an error for fields marked non-deletable (undeletable system fields on
standard objects).

### `POST /api/custom-objects/{object_id}/fields/search` · `fields/settings-search` · `GET fields/{field_id}/references`

Search variants over the same field set, and a references route reporting where a field is used
(Agentic Workflows, layouts, other objects). `references` is the way to check whether a delete would be
blocked before attempting it.

---

## 5. Records

`{object}` in every route below is a custom object UUID **or** its `name` (api-name). Both resolve
identically.

### `POST /api/records/{object}/add`

Creates a record. Note the `/add` suffix — a bare `POST /api/records/{object}` is not the create
route.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `fields` | array | yes | Field entries, see below |
| `unarchive` | `"prompt"` \| `"unarchive"` \| `"overwrite"` | no | What to do if an archived record matches |

Each `fields` entry is `{id?  \| name?, value? \| add_values? \| remove_values?}`:

| Key | Meaning |
|---|---|
| `id` | Field UUID |
| `name` | Field api-name — use one of `id` or `name`, not both |
| `value` | Replace the field's value |
| `add_values` | Append to a multi-value field |
| `remove_values` | Remove from a multi-value field |

Set the record's display name with the `name` **field** entry: `{"name": "name", "value": "…"}`.

Write value formats:

| Field type | Write value |
|---|---|
| `text`, `longtext`, `email` | string |
| `integer`, `decimal` | number |
| `money` | number (currency comes from the field) |
| `date` | `"YYYY-MM-DD"` |
| `datetime` | ISO 8601 string |
| `dropdown`, `radio`, `choices` | the **option id** |
| `checkboxes`, `dynamictags` | array of option ids |
| `relationship` | the related **record id** as a scalar |
| `files` | array of uploaded-file UUIDs |
| `phonenumber` | bare E.164 string, e.g. `"+13125550100"` |
| `timezone` | tz identifier string, e.g. `"America/Chicago"` |
| `team_selector` | employee UUID |

```js
const [created, error] = await this.postWithErrors(
  "/records/example_widgets/add",
  {
    fields: [
      { name: "name", value: "Widget A" },
      { name: "example_plugin_status", value: statusOptionId },
      { name: "owner_contact", value: contactRecordId },
    ],
  },
);
if (error) { /* see 15-errors-and-observability.md */ }
```

Errors: an unknown field name yields code `does_not_exist`; a field the caller cannot write yields
`permission_required` / `forbidden_field_write`. The response error envelope is positional over the
`fields` array you sent.

Response `201`:

```json
{
  "id": "…",
  "display_name": "Widget A",
  "fields": {
    "<field_id>": {
      "id": "<field_id>",
      "name": "example_plugin_status",
      "field_type": "dropdown",
      "display_name": "Status",
      "value": { "id": "…", "code": null, "name": "Open" }
    }
  },
  "access": { "view": true, "edit": true, "remove": true },
  "action": "created"
}
```

`action` is `created`, `unarchived`, or (on upsert) `updated`.

### `GET /api/records/{object}/{record_id}`

Retrieves one record.

| Query param | Meaning |
|---|---|
| `field_ids` | Restrict the returned `fields` map to these field ids |
| `field_names` | Restrict by api-name |
| `all_fields` | Return every field |

Response is the record detail shape: `{id, object_type, client_info, access, fields: {…}}`.

Canonical read encodings inside `fields`:

| Value kind | Shape |
|---|---|
| Choice option | `{id, code, name}` |
| Contact relation | `{id, first_name, last_name, email}` |
| Record relation | `{id, name}` |
| Multi-value over the summarization threshold | `value_summary: {count}` instead of `value` |

> Read-back envelopes are not uniform. A given value may arrive as a raw scalar, as `{value: …}`,
> or one level deeper. Unwrap defensively rather than indexing blindly.

### `GET /api/records/{object}/lookup`

Finds a single record by its identifying column. This is **not** a field-value search.

| Query param | Type | Required | Meaning |
|---|---|---|---|
| `identifier` | string | yes | The value to match |
| `field_ids` | csv | no | Restrict returned fields |
| `field_names` | csv | no | Restrict returned fields |
| `all_fields` | boolean | no | **Defaults to `true` on this route** |

Matching semantics — these are the load-bearing details:

- For **contact/client objects** the identifier is matched against the **`email` column**.
- For **standard and pipeline objects** it is matched against the **`name` column**.
- The match is **exact and case-sensitive**. There is no normalization, no trimming, no `iexact`.
  `"Widget A"` will not find `"widget a"`.
- Missing `identifier` → `400` code `required`. No match → `404`. Match without permission → `403`.

This differs from [upsert](#post-apirecordsobjectupsert), which uses a case-**in**sensitive
`__iexact` match on the same columns. If you look up with `lookup` and create on `404`, and another
path upserts with different casing, you will create duplicates.

```python
resp = kizen.api.get("/records/example_widgets/lookup", params={"identifier": "Widget A"})
if resp.status_code == 404:
    # confirmed absent — safe to create
    ...
elif resp.ok:
    record = resp.json()
else:
    raise RuntimeError(f"lookup failed: {resp.status_code} {resp.text}")
```

> Only a confirmed `404` justifies a create. Creating on any other error — a timeout, a 403, a 500
> — is the classic duplicate-data bug in Kizen plugins.

> Unverified: some plugin code passes `?light=true` to this route. It is not part of the verified
> parameter set; use `field_names` to trim the payload instead.

A nested variant exists at `GET /api/custom-objects/{object_id}/entity-records/lookup` for standard
objects, and it takes **`?name=`** rather than `?identifier=`. Prefer the `/records/` route.

### `PATCH /api/records/{object}/{record_id}` · `PUT /api/records/{object}/{record_id}`

Updates a record. `PATCH` is what plugin code uses (JavaScript workers have no `this.put`).

| Field | Type | Required | Meaning |
|---|---|---|---|
| `fields` | array | yes | Same entry shape as `add` |
| `archived_conflict` | `"overwrite"` | no | Proceed when the record was archived concurrently |

| Query param | Meaning |
|---|---|
| `return_all_fields` | `true` returns every field; otherwise only the fields you wrote plus `updated` |

Concurrent archive during the write returns **`409` with code `conflict`**.

```python
kizen.api.patch(f"/records/example_widgets/{record_id}", json={
    "fields": [{"name": "example_plugin_status", "value": option_id}],
})
```

### `DELETE /api/records/{object}/{record_id}`

Soft-deletes (archives) the record. Returns `204` with no body. In JavaScript, `deleteWithErrors`
resolves `[null, null]` on a successful 204.

> When deleting in bulk, **refetch page 1 after each batch** rather than walking pages forward —
> each delete shifts the paging window and a forward walk silently skips records.

### `PATCH /api/records/{object}/{record_id}/unarchive`

Restores a soft-deleted record.

### `PATCH /api/records/{object}/{record_id}/move`

Moves a pipeline record to another stage. Body: `{"stage_id": "<uuid>"}`.

The current stage is *read* from the record's `fields` map under the `stage` field, whose value is
`{id, name, status, order}` — it is not a top-level record property.

### `POST /api/records/{object}/search`

Paginated, filterable record search. This is the general-purpose query endpoint.

Body:

| Field | Type | Meaning |
|---|---|---|
| `field_names` | string[] | Field api-names to return — the response is narrowed to exactly these |
| `field_ids` | UUID[] | Same, by id |
| `query` | array | Filter groups, see below |
| `and` | boolean | Whether filter groups combine with AND |
| `search_within_field_names` / `search_within_field_ids` | array | Restrict free-text search to these fields |

Query params (**not** body keys — this trips people up):

| Query param | Meaning |
|---|---|
| `page`, `page_size` | Pagination; `page_size` is honored up to 1000 |
| `ordering` | Sort |
| `search` | Free-text over the record's calculated search text |
| `group_id`, `in_group_ids`, `not_in_group_ids` | Group scoping |

Filter shape inside `query`:

```json
{
  "query": [
    { "filters": [
        { "type": "fields_v2",
          "field": "\"custom\"::<field_id>",
          "value": "Open",
          "condition": "=" }
    ] }
  ]
}
```

Response: `{count, next, previous, results, errors}` where each row is
`{id, fields: {<field_id>: {name, value}}}`.

Because the response is keyed by field **id** but narrowed by field **name**, read values like
this:

```js
const statusField = Object.values(row.fields)
  .find((f) => f.name === "example_plugin_status");
```

Fields you did not request are absent — if you need `stage`, list `"stage"` explicitly in
`field_names`.

### `POST /api/records/{object}/upsert`

Match-or-create in one call. Also the endpoint external systems use for ingestion — see
[inbound ingestion](#11-inbound-ingestion).

| Field | Type | Required | Meaning |
|---|---|---|---|
| `lookup_value` | string | yes | The value to match on |
| `fields` | array | no | Same entry shape as `add`; the lookup field is auto-injected if absent |
| `oncreate_unarchive` | `"prompt"` \| `"unarchive"` \| `"overwrite"` | no | Behavior when the match is archived |
| `onupdate_archived_conflict` | `"overwrite"` | no | Behavior on a concurrent archive |

**The match key is fixed and not configurable:**

- contact/client objects → `email__iexact`
- all other objects → `name__iexact`
- first match wins

Response `200` with `"action": "updated"`, or `201` with `"action": "created"` or `"unarchived"`.
The envelope is the standard write response (`id`, `display_name`, `fields`, `access`).
`?return_all_fields=true` returns every field.

### `POST /api/client`

Creates a contact with a flat body rather than a `fields` array. Accepts `email`, `first_name`,
`last_name`, `birthday` (`YYYY-MM-DD`), `timezone`, `email_status` (e.g. `"opted_in"`).

Contact creation through `POST /api/records/client_client/add` with **name-keyed** field entries
can return `403`. The proven creation path when you need the `fields` form is:

1. `GET /api/client/custom-object`
2. read `undeletable_fields.<api_name>.id` for each field you want to set
3. `POST /api/records/{client_object_id}/add` with **field ids** and `unarchive: "prompt"`

Updates are unaffected — `PATCH /api/records/client_client/{id}` with name-keyed entries works
normally. Prefer the `mobile_phone` field over `home_phone`; only `mobile_phone` is guaranteed
undeletable.

### File values

Uploading a file from a JavaScript worker is a runtime helper, not a REST call — see
[`this.uploadFile`](04-worker-runtime-api.md). From outside a browser session (Python steps), the
flow is three calls: request a presigned POST, submit the multipart form with the **file part last**
and capture the ETag, then `POST /api/s3/success?source=field_value` as
**`application/x-www-form-urlencoded`**. Sending that last call as JSON yields an empty POST and
fails silently. The response `{id}` is the file UUID you write into a `files` field.

---

## 6. Activities

Kizen has two activity concepts and they behave very differently through the API.

- **Activity object** — the *type* (e.g. "Discovery Call"). Has a `name` and an `api_name`.
- **Scheduled activity** — a future/assigned to-do. Full CRUD, listable, searchable.
- **Logged activity** — the immutable "this happened" record. **Retrieve-only. There is no list
  route.**

### `POST /api/activities`

Creates an activity object (type). Body: `{"name": …, "api_name": …, "description": …}`.

### `GET /api/activities`

Paginated list of activity objects.

> There is **no `api_name` filter** on this list. To find an activity type by api-name, raise
> `page_size` (honored up to 1000) and match client-side.

### `POST /api/activities/scheduled-activity`

Schedules an activity.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `activity_object_id` | UUID | one of the two | Activity type by id — **create-only** |
| `activity_object_name` | string | one of the two | Activity type by api-name — **create-only** |
| `due_datetime` | ISO datetime | yes | |
| `original_due_datetime` | ISO datetime | no | Preserved across reschedules |
| `employee_id` | UUID | no | Assignee |
| `role_id` | UUID | no | Assign to a role instead of a person |
| `note` | string | no | |
| `mentions` | UUID[] | no | Employees mentioned |
| `notify_mentioned` | boolean | no | Defaults to `false` |
| `notifications` | array | no | `[{type, time_amount, time_unit}]` reminders |
| `associated_entities` | array | no | `[{custom_object_id \| custom_object: {id\|name}, entity_id \| entity: {id\|name}}]` |

Response `201`:

```json
{
  "id": "…",
  "note": "…",
  "due_datetime": "2026-08-01T15:00:00Z",
  "original_due_datetime": "2026-08-01T15:00:00Z",
  "completed_at": null,
  "logged_activity_id": null,
  "created": "…",
  "activity_object": { "id": "…", "name": "Discovery Call", "api_name": "discovery_call",
                       "association_mode": "…", "calendar_sync_duration": 30 },
  "employee": { "id": "…", "display_name": "…", "email": "…", "picture": null },
  "role": null,
  "mentions": [],
  "associated_entities": [],
  "notifications": [],
  "access": { "view": true, "edit": true, "remove": true }
}
```

### `GET /api/activities/scheduled-activity`

Paginated list. Filters: `search`, `from_date`, `to_date`, `employee_ids`, `role_ids`,
`assigned_to_me`, `completed`, `ordering`.

This route makes scheduled activities **probeable** — you can ask "did I already schedule this?"
before creating one, which is exactly what logged activities cannot do.

**`activity_name` is a real filter.** Passing it scopes the list to one activity type by api-name.
It is **mutually exclusive with `activity_id`** — sending both is an error ("Only one of
`activity_id` and `activity_name` must be set"), not a silent precedence rule. Use `activity_name`
when you know the api-name you declared and not the generated id, which is the normal case for
plugin code.

### `GET|PUT|PATCH|DELETE /api/activities/scheduled-activity/{id}`

Standard detail CRUD. `activity_object_id` / `activity_object_name` are create-only and cannot be
changed on update.

### `PATCH /api/activities/scheduled-activity/{id}/notes`

Updates just the note text.

### `POST /api/activities/scheduled-activity/search`

Search variant with the same filter vocabulary as the list route, taken in the body.

### `POST /api/activities/{activity_identifier}/log-activity`

Logs an activity occurrence. `activity_identifier` is the activity object UUID **or** its api-name.

| Field | Type | Required | Meaning |
|---|---|---|---|
| `related_objects` | array | **yes** (may be `[]`) | `[{custom_object: UUID, entity_id: UUID}]` |
| `notes` | string | no | |
| `scheduled_activity_id` | UUID | no | Completes that scheduled activity |
| `mentions` | UUID[] | no | |
| `fields` | array | no | `[{id, value}]` for the activity's own fields |

Constraints:

- **One entity per custom object.** A duplicate `custom_object` in `related_objects` is a `400`.
- A disabled activity type is a `400`.
- An association-mode mismatch (e.g. relating an object the activity is not configured for) is a
  `400`.
- Missing required visible activity fields is a `400`.

Response `201` echoes `id`, `notes`, `related_objects`, `scheduled_activity_id`, `mentions`,
`fields`.

### `GET /api/activities/logged/{id}`

Retrieves one logged activity. Response: `id`, `notes`, `activity_object`, `associated_entities`,
`logged_at`, `logged_by`, `completed_at`, `completed_by`, `scheduled_activity_id`, `mentions`,
`fields`.

> **`GET /api/activities/logged` does not exist and returns 404.** The logged-activity endpoint is
> retrieve-only.

### `POST /api/activities/{activity_identifier}/responses`

The **only** way to enumerate logged activities: a paginated list of logged-activity records for
one activity type.

Because there is no general list route, a "did I already log this?" guard cannot be a read of the
logged activities. Persist your own flag (on the record, or in plugin business config) and re-read
it fresh immediately before the `log-activity` POST.

---

## 7. Business settings

### `GET /api/business/mine`

Returns the current business. Pass `?v2=true` for the newer serializer, which is what the app
itself consumes.

| Field | Type | Meaning |
|---|---|---|
| `id` | UUID | Business id |
| `name` | string | |
| `country` | string | **ISO 3166-1 alpha-2** — `"US"`, not `"United States"`. Defaults to `"US"` |
| `phone_default_region` | string | Default region for parsing/formatting bare phone numbers |
| `timezone` | **object** | Serialized as an object, not a bare string — read its identifier field |
| `entitlements` | object | Feature entitlement map |
| `address`, `phone`, `reply_to_email`, … | | Standard business profile fields |

Two traps worth stating plainly:

- **`timezone` is an object.** Interpolating it into a string gives you `[object Object]`.
- **There is no `date_format` field.** Derive display formatting from `country` /
  `phone_default_region`, or ask the user in your plugin's config.

### `PATCH /api/business/mine`

Updates the business. Use `?v2=true` to match the read serializer. `PUT` on this route is coerced
to a partial update, so both verbs behave the same way.

`country` must be the ISO alpha-2 code.

### `GET /api/constants/currencies`

**Currency is not a business setting** — there is no `currency` field on the business. The
supported currency list comes from this constants endpoint:

```json
[["USD", "US Dollar", "$"], ["EUR", "Euro", "€"], ["GBP", "British Pound", "£"]]
```

Each entry is `[code, name, symbol]`. Use it to populate a currency picker and to feed
[`money_options.currency`](#money_options).

### `GET /api/auth/bootstrap`

Returns the signed-in employee and the same business payload as `/business/mine`. Plugin code uses
it mainly as the fallback for "who am I": `team.id` is the current employee id.

Workers should read the employee id from the injected business context first and only fall back to
this call; see [worker runtime](04-worker-runtime-api.md).

---

## 8. Plugin business configuration

Your plugin's per-business configuration lives on its install row, not in the manifest. The
manifest declares the shape; this endpoint holds the values.

### `GET /api/external-integrations/business-plugin-apps/{identifier}`

`identifier` is the install UUID **or** the plugin api-name.

> Always build the path from the runtime-provided plugin api-name, never from a hardcoded string.
> Preview and development builds suffix the api-name, and a hardcoded literal `404`s in exactly the
> environments you use for testing.

Response includes `id`, `plugin_app` (the embedded published version), `parent_plugin_app_id`,
`config`, `created`, `updated`, `installed_version`, `status` (`OK`/`ERROR`), `error_count`,
`notification_count`, `disabled`.

Inside `config`:

| Key | Meaning |
|---|---|
| `__kizen_clean_config` | The resolved runtime config values your scripts read |
| `__kizen_setup_assistant_values` | Raw setup-assistant answers |
| `__kizen_setup_assistant_hash` | Hash gating the setup-assistant re-prompt |
| *(your own keys)* | Anything else you have written |

Reading requires the marketplace view permission; writing requires the marketplace manage
permission.

**The row exists only after install.** In a business where the plugin is not installed, both `GET`
and `PATCH` return `404` — you cannot create the config from a script.

### `PATCH /api/external-integrations/business-plugin-apps/{identifier}`

| Field | Type | Meaning |
|---|---|---|
| `config` | object | **Wholesale replacement** of the config object |
| `disabled` | boolean | Enable/disable the install |

> **`config` writes are a wholesale replace. There is no server-side merge and no validation.**
> Sending `{"config": {"my_key": 1}}` deletes `__kizen_clean_config`,
> `__kizen_setup_assistant_values`, `__kizen_setup_assistant_hash`, and every other key. Losing the
> assistant hash makes the setup assistant re-prompt on every enable; losing the clean config
> breaks every script that reads `this.config`.

The required pattern is read-modify-write, with the read as fresh as possible:

```js
// Read fresh immediately before writing — never reuse a value from earlier in the run.
const path = `/external-integrations/business-plugin-apps/${this.pluginApiName}`;
const [install, readError] = await this.getWithErrors(path, { ignoreCache: true });
if (readError) return;

const [, writeError] = await this.patchWithErrors(path, {
  config: { ...install.config, example_plugin_last_sync: new Date().toISOString() },
});
```

Concurrency rules that follow from the wholesale-replace semantics:

- Re-read immediately before every `PATCH`. A config read at the top of a long-running script is
  already stale.
- For batch writes, do **one** merged `PATCH` rather than several — each additional write is
  another chance to clobber a sibling.
- For batch writes also filter your computed entries down to keys not already present in the fresh
  state. The fresh read protects other people's keys; the collision filter protects yours.
- If your plugin also ships a setup assistant, do **not** write keys the assistant owns. The
  assistant regenerates `__kizen_clean_config` from its own values on its next save and will
  overwrite you. Use disjoint keys, or write both stores.

Also note that `this.config` in a worker is a read-only snapshot of the args injected at worker
start. A value you just `PATCH`ed will not appear there until the next worker load — prefill UI
from a fresh `GET`. See [setup assistants](13-setup-assistants.md) and
[worker runtime](04-worker-runtime-api.md).

### `GET|POST /api/employee/mine/configs/plugins/{plugin_id}`

Per-employee, per-plugin configuration. In JavaScript prefer the runtime helpers
[`getUserConfig()` / `setUserConfig()`](04-worker-runtime-api.md) — `setUserConfig` performs the
read-merge-write for you. There is no `setBusinessConfig` equivalent; business config goes through
the `PATCH` above.

---

## 9. Teams & employees

### `GET /api/team`

`/api/team` and `/api/employee` are the same endpoint. Lists employees.

| Query param | Meaning |
|---|---|
| `detail=light` | Slim serializer |
| `v2=true` | V2 serializer |
| `page_size` | Passing it switches the route into paginated mode |
| `search` | Also switches to paginated mode |

Defaults: **unpaginated bare array**, service accounts excluded from the results.

> **Visibility collapse.** When the caller lacks the *all team members* permission in the teams
> section, this list silently returns **only the caller's own employee row**. It is not a `403` —
> you get a well-formed 200 with one element. A plugin that builds an assignee picker from this
> route will show a one-person dropdown for most non-admin users and look broken.

This is the permission model working as the business configured it, not a bug to route around: a
user who cannot see the full team in Kizen should not see it through your plugin either. Design for
it — render the single-row case deliberately rather than letting it look like a loading failure,
and where a surface genuinely needs the full roster, have the business grant the *all team members*
permission to the roles that need it.

Role listing is filtered by the parallel *all roles* permission and collapses the same way.

### `GET /api/team/{employee_id}`

Retrieves one employee by UUID. This is how Python steps turn an `employee` input (which arrives as
a bare id) into an email address.

```python
member = kizen.api.get(f"/team/{inputs.assignee}").json()
email = member["email"]
```

### `POST /api/team/search`

Body-driven employee search.

### `GET /api/team/typeahead`

Typeahead-shaped list, unpaginated by default — it returns the whole matching set unless you pass paging params. This route is row-scoped and collapses along with `GET
/api/team`.

---

## 10. Integration secrets

Secret *values* are set by administrators, not by plugin code, and are delivered to your code
server-side — Python steps get them in the `secrets` dict; services get them substituted into
request credentials by the proxy. See [auth, secrets & services](06-auth-secrets-services.md).

This API exists for plugin tooling and setup flows that need to create or update a secret row.

A plugin's declared secrets are ordinary business-level integration secrets with the api-name
**`{plugin_api_name}__{secret_name}`**, created empty at install time.

### `GET /api/integration-secrets`

Paginated list (with `count`).

| Query param | Meaning |
|---|---|
| `search` | Single search over obfuscated value, description, and plugin name |
| `ordering` | Sort |
| `page`, `page_size` | Pagination |

Results are business-scoped automatically.

| Field | Type | Access | Meaning |
|---|---|---|---|
| `id` | UUID | read | |
| `value` | string | **write-only** | Never returned in any response |
| `obfuscated_value` | string | read-only | First 2 chars + 19 stars + last 2 chars when the value is ≥14 chars; otherwise 23 stars |
| `description` | string | **required** | Human label; also the source of the derived `api_name` |
| `api_name` | string | write on create | Optional; derived from `description` when omitted |
| `business_plugin_app` | object | read-only | Light embed of the owning install, when bound |
| `created_by`, `updated_by` | object | read-only | |
| `created`, `updated` | datetime | read-only | |

Permissions: the *manage integration secrets* settings key — READ to list/retrieve, WRITE to
create/update, REMOVE to delete.

### `GET /api/integration-secrets/{id}`

Retrieves one secret. `value` is never present; you get `obfuscated_value` only. **There is no way
to read a secret's plaintext back through this API.**

### `POST /api/integration-secrets`

Creates a secret.

```json
{ "description": "Example Plugin API key", "value": "…", "api_name": "example_plugin__api_key" }
```

`description` is required. `api_name` is optional and derived from `description` when omitted.

### `PUT /api/integration-secrets/{id}`

Updates a secret. **`PATCH` is disabled on this endpoint** — the allowed methods exclude it, so
partial updates are not available and you must send the full representation.

Two consequences for plugin code:

- JavaScript workers **cannot call this endpoint at all**. There is no `this.put`, and `PATCH` is
  rejected server-side. Do secret updates from a Python code step, or from the admin UI.
- **Do not resend `api_name`.** The uniqueness check does not exclude the record being updated, and
  it raises the wrong exception class, so a `PUT` that echoes the record's own `api_name` returns
  **HTTP 500** rather than a validation error.

The safe call shape omits `api_name` entirely:

```python
resp = kizen.api.put(f"/integration-secrets/{secret_id}", json={
    "description": "Example Plugin API key",
    "value": new_value,
    # no "api_name" — echoing it back 500s
})
resp.raise_for_status()
```

### `DELETE /api/integration-secrets/{id}`

Deletes the secret row. Requires the REMOVE level of the manage-integration-secrets permission.

Note that uninstalling a plugin detaches its secrets rather than deleting them, so values survive
an uninstall/reinstall cycle.

---

## 11. Inbound ingestion

### Plugins have no inbound HTTP surface

**You cannot register an endpoint that an external system POSTs to.** There is no plugin-scoped
ingest URL, no per-plugin webhook token, and no unauthenticated plugin route. A plugin's
server-side footprint is outbound only: the service proxy, the OAuth callback, and Python code
steps.

The single unauthenticated route in the plugin subsystem is the OAuth callback. It accepts only
`code`, `state`, and `error` query parameters, requires a pre-seeded single-use state entry, and
responds with a redirect. It cannot be used to push data into a plugin.

If your integration needs an external system to push data into Kizen, it must authenticate as a
Kizen caller and use one of the three platform paths below. All three take the standard credential
headers (`X-API-Key` / `X-User-ID` / `X-Business-ID`, static or signed). Authentication is
credential-based, so treat those headers as secrets on the sending side: keep them in a secret
manager rather than in source or CI config, issue them to a dedicated integration user, and rotate
them if they may have been exposed.

### `GET|POST /api/automations/{automation_identifier}/webhook/{webhook_name}`

Triggers an Agentic Workflow. Real-time, per-event, and returns an execution handle. This is the
best fit when the external system can authenticate and you want immediate processing.

`automation_identifier` is the workflow UUID or api-name. `webhook_name` is the hook configured on
the workflow.

| Aspect | Contract |
|---|---|
| Auth | **Required.** Unauthenticated calls get `401`. The URL itself contains no token |
| Method | Pinned per hook to GET **or** POST; a mismatch is `405` |
| Workflow state | Must be active, else `400` |
| Permissions | Non-global workflows additionally require record read permission, else `403` |
| Body | Arbitrary JSON, XML, form-encoded, or text. For GET, a body is synthesized from the query string |
| Record targeting | Query param or body, first match wins: `record_id` (UUID), `record_name` (non-contact objects only), `record_email` (contact objects only). **Required unless the workflow is global** |
| Extraction | Configured JSONPath extractors pull values into the workflow's user data. Optional `meta_body_content` / `meta_query_string` metadata keys |

Response `200`:

```json
{ "execution_id": "…", "automation_id": "example_workflow" }
```

`execution_id` is **`null`** when the trigger dedup throttle suppressed the run. The throttle keys
on business + workflow + record + payload hash over a configurable window (0.1 s to 48 h). Treat
`null` as "accepted, deduplicated", not as an error.

Creating *new* records through this path requires a global workflow with a create-related-entity
step; a non-global workflow needs an existing record to target.

### `POST /api/smart-connectors/{connector_identifier}/webhook`

Pushes a payload into a Webhook SmartConnector. Batch-shaped and asynchronous — best for
high-volume contact upserts, worst for anything needing an immediate result.

| Aspect | Contract |
|---|---|
| Auth | Required, plus the Smart Connectors section permission |
| Content type | Anything — the body is taken raw |
| Body cap | **250 KB.** Larger payloads are rejected |
| Encoding | Must be valid UTF-8 |
| Connector state | Must be a webhook-type connector past setup |
| Response | **`201` with an empty body — no execution id, no record id** |

Processing is windowed: the payload is buffered, batched into a window between 30 seconds and 3
hours, and then run through the connector's SQL step, where the body is exposed as a `webhooks`
virtual table with the payload parsed as JSON. Matching rules decide create vs update (defaults:
no match → create, single match → update, multiple matches → next rule).

Consequences you must design around: there is **no synchronous confirmation**, no per-call error
surface, and a mandatory SQL transformation step. A caller cannot tell whether its payload produced
a record.

### Records upsert as an ingestion path

The simplest ingestion path when the external system knows the target object and the match key
suits it. `POST /api/records/{object}/upsert` is documented in full
[above](#post-apirecordsobjectupsert). For ingestion
purposes the key facts are:

- Match is fixed: `email__iexact` for contacts, `name__iexact` for everything else. There is no
  configurable match key and no multi-field matching.
- Synchronous — you get `200`/`201`, the `action`, and the record id back immediately.
- Per-field write permissions apply to the calling credential.

### Choosing between them

| Need | Use |
|---|---|
| Immediate result, arbitrary logic | Webhook trigger |
| High volume, contact upsert, tolerant of delay | Webhook SmartConnector |
| Simple create-or-update against a known match key | Records upsert |
| Anything requiring the *plugin* to receive the call | Not possible — restructure the integration |

---

## 12. Other endpoints plugin code uses

### `POST /api/permission-group`

Creates a permission group: `{"name": "…"}`. Admin-callable. Listing permission groups is open to
any authenticated caller.

### `GET /api/external-integrations/bootstrap`

Returns every enabled install for the business keyed by plugin api-name, with `name`, `thumbnail`,
`base_config`, `business_config`, `employee_config`, `version`, `installed_version`, `upgradeable`,
`catalogs`, and the browser artifact lists. This is the browser entry point, not something worker
or step code needs — your own config is available more cheaply from
[`business-plugin-apps/{identifier}`](#get-apiexternal-integrationsbusiness-plugin-appsidentifier).

### `POST /api/external-integrations/browser-js-action-template-association`

Associates one of your published action templates with a custom object, which is what makes the
action appear in that object's menus. Publishing creates the template; **installing does not create
the association** — only the Setup Assistant or a direct call does. See
[actions](08-actions.md#wiring-an-association-from-a-script).

```json
{
  "browser_js_action_template": { "api_name": "sync_contact", "plugin_app_api_name": "example_plugin" },
  "custom_object": { "id": "<object id>" },
  "include_perform_action": true
}
```

- `custom_object` accepts **either** `id` or `name` (at least one is required). The `name` lookup is
  scoped to your business; the `id` lookup is not.
- `include_perform_action` is optional and also surfaces the action in the object's Perform Action
  menu.
- **The 201 body echoes your request and contains no `id`.** If you need the association's id, read
  the list endpoint below rather than the create response.
- **A duplicate returns `400`** with `{"non_field_errors": ["Browser JS Template Association for
  this custom object/js action template already exists."]}`. The machine-readable code is not in
  the body, so match the text — and treat the rejection as success, which makes the write
  idempotent.
- Other `400`s: the plugin is not installed for the business, the template api_name is unknown, or
  the custom object is unknown. `403` without Marketplace permission.

Only `create` and `destroy` exist; `DELETE .../{id}` removes an association, and list/retrieve/
update on this route return `405`.

### `GET /api/external-integrations/business-plugin-apps/{identifier}/browser-js-action-template-associations`

Lists the associations for one install. `identifier` accepts the install's UUID **or** the plugin
api-name.

**Not paginated, and not a bare array** — the payload nests under `associations`:

```json
{
  "associations": [
    {
      "id": "<association id>",
      "include_perform_action": false,
      "browser_js_action_template": { "id": "…", "api_name": "sync_contact", "name": "Sync Contact", "hint_object_name": "contact" },
      "custom_object": { "id": "…", "name": "contact", "object_name": "Contact", "entity_name": "Contact" }
    }
  ]
}
```

An empty result is `{"associations": []}`. Associations whose template no longer exists for the
plugin are **silently dropped from the list** rather than reported, so a missing row can mean the
template was renamed rather than that the association was never created.

`POST` to this same path also creates an association, with a flatter body
(`{"template_api_name": "…", "custom_object": {"id": "…"}}`) and a more useful response —
`201 {"id": "<association id>"}`.

### `PATCH /api/custom-objects/{id}` — `action_override_create`

Hands an object's record-creation flow to a plugin action. The field is a nullable string
(`max_length=512`) on the custom object, writable through the standard object update:

```json
{ "action_override_create": "example_plugin.sync_contact" }
```

The value is the dot-separated composite `{plugin_api_name}.{action_api_name}` — the same key the
host builds when matching an action, so the separator is a dot here even though secret api-names
use a double underscore elsewhere. A business-local (non-plugin) action uses an empty prefix:
`".my_action"`.

**Nothing validates the value's format.** There are no choices, no regex, no referential check —
any string within the length limit is accepted and round-trips verbatim. A malformed or dangling
key is not an error; the host simply falls back to the native create form, silently. Send `null` to
clear it.

An override also requires the association above to exist. See
[create override](08-actions.md#create-override-replacing-the-native-add-record-form) for the
ordering rules and the no-clobber discipline for writing this field.

### `ANY /api/external-integrations/proxy/{plugin_api_name}/{service_name}/{path}`

The outbound service proxy. Covered in [auth, secrets & services](06-auth-secrets-services.md); the
only thing to note here is that it is reachable from **both** runtimes — JavaScript workers build
the URL with `this.getServiceUrl(service, path)`, and Python steps call it through `kizen.api` with
the same relative path.

```python
BASE = "/external-integrations/proxy/example_plugin/example_service"
resp = kizen.api.post(f"{BASE}/v1/messages", json={"text": "hello"})
body = resp.json().get("body") or {}   # the proxy wraps the upstream response
```

---

## Gotchas

- **`/api` is a path prefix, not something you type.** Both `this.*` helpers and `kizen.api`
  prepend it. Writing `/api/records/...` in plugin code produces `/api/api/records/...`.
- **No trailing slashes.** The router is configured without them.
- **Workers and steps see different data.** Worker calls run as the signed-in employee; Python
  steps run as the plugin's service account. Permission-filtered endpoints return different results
  in each. Never treat an empty worker result as confirmed absence.
- **`lookup` is exact and case-sensitive; `upsert` is case-insensitive.** Mixing the two produces
  duplicates. `lookup` matches the `email` column for contacts and the `name` column for everything
  else — it is not a field search.
- **Only a confirmed `404` justifies a create.** Creating after a timeout, a `403`, or a `500` is
  the duplicate-data bug class.
- **`POST /api/custom-objects` with an explicit `name` is staff-only** → `403`
  `forbidden_field_write`. Omit it and store the server-derived `created["name"]`.
- **Archived objects are renamed to `{name}_discarded_{timestamp}`**, so a recomputed slug may or
  may not match. Store the returned name.
- **`category` is required when creating a field** even though it reads as optional. Fetch it from
  `GET /api/custom-objects/{id}/categories`.
- **`money_options` is required for money fields.** Currency lives on the field, not the value, and
  the valid codes come from `GET /api/constants/currencies` — the business has no currency setting.
- **`decimal_options.max_value` above `999999.99` returns HTTP 500.** Larger values pass request validation and are rejected at write time.
- **`status` is a reserved field api-name** → `400`. Prefix generic nouns.
- **Never PATCH a field's `options` array to add an option** — it is a destructive replace. Use
  `POST fields/{id}/options`, one option per call.
- **`GET /api/activities/logged` does not exist.** Logged activities are retrieve-by-id only;
  enumerate with `POST /api/activities/{identifier}/responses`, and keep your own idempotency flag.
- **`log-activity` accepts at most one entity per custom object** in `related_objects`.
- **`business.timezone` is an object, not a string**, and there is no `date_format` field.
  `country` is ISO alpha-2.
- **Plugin business config `PATCH` is a wholesale replace.** Read fresh, spread, then write — or
  you delete `__kizen_clean_config` and the setup-assistant hash and cause a re-prompt loop.
- **`this.config` is stale within a run.** A value you just PATCHed appears only on the next worker
  load.
- **`GET /api/team` silently collapses to one row** without the all-team-members permission. Use
  `POST /api/team/search`, `GET /api/team/{id}`, or call from a Python step.
- **`GET /api/team` is unpaginated by default** and excludes service accounts.
- **`PATCH` is disabled on `/api/integration-secrets`, and JavaScript workers have no `this.put`** —
  secret updates must come from a Python step or the admin UI.
- **A `PUT` to `/api/integration-secrets/{id}` that echoes the record's own `api_name` returns
  HTTP 500.** Omit `api_name` on update.
- **Object field lists are unpaginated**; most other lists cap `page_size` at 1000 and default
  to 100. A paginated response with a non-empty `errors` array arrives as HTTP 400.
- **`POST /api/records/{object}/search` takes `page_size` as a query param, not a body key**, and
  narrows the response to exactly the `field_names` you request — including `stage`.
- **Record read values are inconsistently enveloped** (raw scalar, `{value}`, or one level deeper)
  and `fields` may be keyed by field id. Unwrap defensively.
- **Deleting in bulk shifts the paging window.** Refetch page 1 after each batch.
- **`settings-search` results are permission-filtered.** Empty ≠ absent.
- **Proxied external calls still hit third-party 429s**, and the proxy returns HTTP 200 wrapping
  the upstream status, so a 429 will not look like a failed request. Handle `Retry-After`
  explicitly.
- **Plugins have no inbound HTTP surface.** If a design requires an external system to call your
  plugin directly, the design is wrong — route it through the webhook trigger, a Webhook
  SmartConnector, or records upsert.
