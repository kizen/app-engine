# Agentic Workflow Steps (Python code steps)

**What this covers.** How a plugin declares its own Agentic Workflow steps: the authoring
`config.json` schema field by field, the authored→packaged rename map, the complete `data_type`
enum and its Python/wire encodings, the inputs/outputs contract, what the workflow builder user
sees, and the Python runtime contract (`inputs`, `outputs`, `secrets`, `kizen`) including the
`kizen.api` client, secrets namespacing, retry patterns, database-connector patterns, and how a
step fails cleanly.

**See also:** [manifest reference](03-manifest-reference.md) ·
[platform API](05-platform-api.md) ·
[auth, secrets and services](06-auth-secrets-services.md) ·
[record actions](08-actions.md) ·
[errors and observability](15-errors-and-observability.md) ·
[release and publish](16-release-and-publish.md)

---

## Model

A plugin-provided step is a Python script plus a declaration of its inputs and outputs. Publishing
the plugin registers it; from then on it appears in the Agentic Workflow builder's action picker
alongside native steps, and a workflow author maps each declared input to a record field, a
workflow variable, or a static value, and each declared output to a field or variable.

Steps run **server-side**, in a sandboxed Python container — not in the browser worker that runs
[blocks](09-blocks.md), [actions](08-actions.md), and the other JavaScript surfaces. There is no
`this`, no DOM, no toasts, no modals. The only I/O a step has is its declared inputs and outputs,
its granted secrets, outbound HTTP, and the injected `kizen` client.

Only Python steps exist. There is no JavaScript workflow step; JavaScript on records is a
[record action](08-actions.md), which is a different surface with different wiring.

---

## Directory layout

```
src/
  automationSteps/
    <stepDirectory>/
      config.json      # the step declaration — required
      script.py        # the step body — required
```

Steps are discovered by directory convention. They are **not** listed anywhere in `kizen.json`.
(The `actions` array inside a setup assistant is for [record actions](08-actions.md), not steps.)

`script.py` is packaged **verbatim** — unlike JavaScript surfaces, Python step bodies are not
minified. Comments and formatting survive into the published step, so in-file comments are a
legitimate place to document the step's contract.

---

## `config.json` — step-level fields

Full example, referenced field by field below:

```json
{
  "name": "Send Notification",
  "api_name": "send_notification",
  "plugin_description": "Example Plugin — messaging integration for Agentic Workflows.",
  "action_description": "Posts a plain-text message to the given channel using the connected workspace. Channels may be given by name (#general) or by id.",
  "action_type": "example_plugin_send_notification",
  "runtime": "python 3.13",
  "secrets": ["api_key"],
  "when": "Boolean({{config.enableNotifications}})",
  "inputs": [
    {
      "name": "channel",
      "label": "Channel",
      "hint": "Use #channel-name to look up by name, or a channel id for direct delivery.",
      "data_type": "string",
      "required": true,
      "input_source": "variable",
      "hint_field_name": "channel",
      "hint_related_object_field_name": null,
      "script_alias": "channel"
    },
    {
      "name": "message",
      "label": "Message",
      "data_type": "string",
      "required": true,
      "input_source": "variable",
      "script_alias": "message"
    }
  ],
  "outputs": [
    {
      "name": "delivered_at",
      "label": "Delivered At",
      "data_type": "datetime",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "last_notified_at",
      "hint_related_object_field_name": null,
      "script_alias": "delivered_at",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    }
  ]
}
```

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | Human label in the builder's action picker. |
| `api_name` | api-name string | *effectively yes* | The step's stable identity. Falls back to a sanitized directory name if omitted. |
| `plugin_description` | string | no | Plugin-level blurb shown above the action picker. |
| `action_description` | string | no | Shown once this action is selected. |
| `action_type` | api-name string | no | Stored, never read at runtime. Inert. |
| `runtime` | string | no | Python runtime selector. Normalized at package time. |
| `secrets` | string[] | no | Integration secret names this step may read. |
| `when` | expression string | no | Gates whether the step is offered, against install config. |
| `step_history_template` | string | no | **Dropped by the packager** — authoring it in `config.json` has no effect. |
| `script` | string | no | **Ignored.** The packager always reads `script.py` from disk. |
| `inputs` | object[] | yes (may be `[]`) | Declared inputs — see [parameter reference](#parameter-reference-inputs-and-outputs). |
| `outputs` | object[] | yes (may be `[]`) | Declared outputs — same shape plus two output-only fields. |

### `name`

The label a workflow author sees in the action picker after choosing your plugin. Free text; make
it a verb phrase describing what the step does ("Send Notification", "Read Data"), not the plugin
name — the plugin name is already shown.

### `api_name`

The step's real primary key. After publish, a step is resolved by the pair
`(plugin app, action_step_api_name)`, and that pair is the only uniqueness constraint. Everything
downstream — the wired step inside a saved workflow, config lookup at run time — keys on it.

**Always set it explicitly.** When omitted, the packager derives it from the directory name by
lowercasing it, collapsing hyphen and whitespace runs to `_`, then dropping characters outside
`[a-z0-9_]`. That collapses camelCase — `sendNotification` becomes `sendnotification` — and turns
`send-notification` into `send_notification`. Underscores are preserved, so `send_notification`
comes through unchanged. The reason to set it anyway is that a later directory rename silently
changes the key — and the key is the step's primary identity.

Renaming a published `api_name` is a breaking change: existing workflows that reference the old
name hard-fail at run time with a "config not found" error. Treat it as immutable once shipped
(see [release and publish](16-release-and-publish.md)).

### `plugin_description`

Packaged as `overall_description`. Despite living on each step, it is displayed **once**, above
the action picker, as the plugin-level description. The builder uses the first action's value.

Consequence: give every step in a plugin the *same* `plugin_description`, describing the plugin.
Putting step-specific text here means the blurb shown depends on which step happens to be first.

### `action_description`

The per-step description, shown after the workflow author selects this action. This is the field
that should carry step-specific detail: what it does, what the inputs mean, what it writes.

This is the highest-leverage documentation surface a step has — it is the only text the workflow
author reads before wiring the step up. Use it to state input semantics and any asymmetry (for
example, that a reference-typed value only survives a round trip if it is a valid id for the
target field).

### `action_type`

An api-name string. It is stored at publish time and validated in the admin, but **nothing reads
it at runtime**. It is inert. Set it to something readable and unique-ish
(`example_plugin_send_notification`) and do not build anything on it.

### `runtime`

Selects the Python runtime. Two runtimes exist: **Python 3.13** and **Python 3.12**.

**Omitting `runtime` gives you Python 3.12, not the newer one** — the packager's fallback is
`python-3-12`, applied both when the field is absent and when `config.json` itself is missing. If
you want 3.13 you have to ask for it; a step that "just works" on your machine and inexplicably
lacks a 3.13 feature in production is usually a step with no `runtime` set.

The authored string is normalized at package time by replacing spaces and dots with hyphens, so
all of these produce the same packaged value:

| Authored `runtime` | Packaged `script_runtime` |
|---|---|
| `"python 3.13"` | `"python-3-13"` |
| `"python-3-13"` | `"python-3-13"` |
| `"python 3.12"` | `"python-3-12"` |
| `"python-3-12"` | `"python-3-12"` |

There is no allowed-runtimes enum at package time — a string naming a runtime that does not exist
(for example `"python 3.7"`) packages cleanly and is rejected at publish. Prefer the hyphenated
form `"python-3-13"` so the authored value matches the packaged value exactly.

### `secrets`

An array of **bare** integration-secret names this step is allowed to read:

```json
"secrets": ["api_key", "connection_json"]
```

Each name must also appear in the manifest's `base_config.secrets` — publish rejects a step
secret that is not a subset of the plugin's declared secrets. See
[auth, secrets and services](06-auth-secrets-services.md).

Declaring a secret here is what gets its **value** into the step's `secrets` dict at run time. A
secret the plugin declares but this step does not list is not readable from this step.

Inside the script the key is namespaced — see [Secrets](#secrets-inside-a-step).

### `when`

A template expression over install config that gates whether the step is offered at all:

```json
"when": "Boolean({{config.enableNotifications}})"
```

Same scoping rules as other artifact configs: `{{config.key}}` for business-level setup-assistant
values and `{{userConfig.key}}` for user-level ones. (Setup-assistant-internal `when` expressions
use bare `{{key}}` — a different scope; see [setup assistants](13-setup-assistants.md).)

Any `when` anywhere in the plugin makes the host load install config before evaluating
visibility. That is expected, not a defect.

A missing config key resolves to null, so the expression evaluates false and the step silently
disappears from the picker. Setup-assistant `default` values reach `when` evaluation but do **not**
reach `this.config`/the runtime — do not rely on a default to keep a step visible if the user never
saved the assistant.

### `step_history_template`

The publish API accepts this as an optional step-level string — but **the packager never reads it**,
so a value in `config.json` is dropped during packaging and never reaches the publish payload.
There is no authoring path to it from a plugin repo today, and no template syntax to document.
Setting it is harmless and inert — and since no authored value can reach the backend, its
rendering semantics in workflow run history are moot from a plugin's point of view.

### `script`

**Ignored.** A `"script"` key in `config.json` is not a filename override and not an inline script
body — the packager unconditionally reads `script.py` from the step directory. Some existing
configs carry `"script": "script.py"`; it is decoration.

---

## Authored → packaged rename map

Three fields are renamed on the way from your `config.json` into the published step definition.
This matters when reading platform-side documentation, publish payloads, or the workflow-builder
API, which all use the packaged names.

| Authored `config.json` | Packaged / stored | Notes |
|---|---|---|
| `api_name` | `action_step_api_name` | The real key. Falls back to the sanitized directory name. |
| `plugin_description` | `overall_description` | Plugin-level, shown above the action picker. |
| `runtime` (`"python 3.13"`) | `script_runtime` (`"python-3-13"`) | Spaces and dots → hyphens. |
| `action_description` | `action_description` | Unchanged. |
| `action_type` | `action_type` | Unchanged, and inert. |
| `secrets` | `secrets` | Unchanged. |
| `when` | `when` | Unchanged. |
| `inputs` / `outputs` | `inputs` / `outputs` | Pass through unchanged. |
| `script.py` file content | `script` | Raw, unminified. |

The packaged collection itself is `automation_action_configs`.

### Load-bearing vs inert authored fields

| Field | Status |
|---|---|
| `api_name` | **Load-bearing.** The unique key; everything resolves through it. |
| `name`, `action_description` | **Load-bearing** for the builder UI. |
| `plugin_description` | Load-bearing, but plugin-scoped in effect — see above. |
| `runtime` | **Load-bearing.** Selects the interpreter. |
| `secrets` | **Load-bearing.** Gates what the `secrets` dict contains. |
| `inputs[].name`, `outputs[].name` | **Load-bearing.** These are the runtime accessors. |
| `data_type` | **Load-bearing.** Drives serialization and the builder's field/variable dropdown. |
| `required` | **Load-bearing.** Pre-execution validation refuses to run with a required input unmapped or null. |
| `input_source`, `hint_field_name` | Load-bearing for builder ergonomics only; not for runtime. |
| `conflict_resolution`, `create_field_options` | **Load-bearing** on outputs at write-back time. |
| `action_type` | **Inert.** Stored, never read. |
| `script_alias` | **Inert.** A fossil of an abandoned design; the runtime binds by `name`. |
| `allowed_values` | **Inert as enforcement.** Documentation only — see below. |
| `output_target` | **Phantom.** Silently dropped at publish; use `input_source` on outputs too. |
| `script` | **Ignored.** `script.py` is always read from disk. |

---

## Parameter reference (`inputs` and `outputs`)

Inputs and outputs share one shape. Outputs add `conflict_resolution` and `create_field_options`;
both are **rejected on inputs**.

```json
{
  "name": "channel",
  "label": "Channel",
  "hint": "Use #channel-name to look up by name, or a channel id for direct delivery.",
  "data_type": "string",
  "required": true,
  "input_source": "object_field",
  "hint_field_name": "channel",
  "hint_related_object_field_name": null,
  "script_alias": "channel",
  "allowed_values": ["general", "alerts"],
  "default": true
}
```

### `name`

**The runtime accessor.** `inputs.<name>` reads an input; `outputs.<name> = value` writes an
output. Must be an api-name-shaped string (lowercase, underscores).

Output names are validated on write-back: assigning to a name that is not a declared output raises
inside the runtime and fails the step.

### `label`

What the workflow author sees next to the mapping control in the builder. Free text.

### `hint`

Optional help text rendered with the field in the builder. Use it to state format expectations the
label cannot carry ("Use `#channel-name` to look up by name, or a channel id for direct delivery").

### `data_type`

The variable type of the value. See [`data_type` reference](#data_type-reference) — this is the
field most likely to be set wrong, because the valid values are **variable** type names, not
custom-field type names.

### `required`

Boolean, default `false`.

- On an **input**: pre-execution validation refuses to run the step when a required input is
  unmapped or resolves to null, and the builder blocks saving the workflow with it unmapped. A
  required input is therefore guaranteed present in the script — read it directly with
  `inputs.<name>`.
- On an **output**: marks the mapping as mandatory in the builder. It does not force your script
  to assign the output.

### `input_source`

Where the value comes from (inputs) or goes to (outputs). Publishable values:

| Value | Meaning |
|---|---|
| `variable` | A workflow variable. |
| `object_field` | A field on the record the workflow is running against. |
| `related_object_field` | A field on a related record. |
| `static_value` | A literal the workflow author types in the builder. |

`input_source` is used for **both** inputs and outputs — outputs use the same key, not
`output_target`.

One more source exists in the builder but cannot be pre-declared: `business_plugin_config`. When a
workflow author picks it, the platform injects the plugin's install config as a **JSON string**
under that input's `name` (the cleaned config, when present). Your script must `json.loads` it.

### `allowed_values`

An array of literals intended to constrain a `static_value` input.

**It is dropped at publish and never reaches the builder.** Publishing accepts a fixed field set
for step parameters — `name`, `label`, `data_type`, `required`, `input_source`,
`hint_field_name`, `hint_related_object_field_name`, `script_alias`, `conflict_resolution`,
`create_field_options` — and silently discards anything else. `allowed_values` is not on that list,
so it is stripped server-side without a warning: the workflow author sees a free-text control, not
a picker, and nothing validates their input against your list.

Keep it in `config.json` if it documents intent for the next maintainer, but do not design around
it. The value your script receives is whatever the author typed, so the unexpected-value branch is
not an edge case — it is the normal path:

```python
mode = inputs.failure_mode

if mode == "retry":
    ...
elif mode == "skip":
    ...
else:
    # Reachable: nothing constrains this value at any layer.
    raise ValueError(f"Unknown mode {mode!r}. Expected 'retry' or 'skip'.")
```

### `default`

Intended to pre-fill the builder's mapping control (most often on a `boolean` static-value input).

**It is dropped at publish too**, by the same fixed field set described above. It does not pre-fill
the builder, and it does not substitute a value at run time for an input the author left empty. An
input you expected to default to `True` arrives as whatever the empty control produced.

If a step needs a default, apply it in the script:

```python
retry_on_conflict = inputs.retry_on_conflict
if retry_on_conflict is None:
    retry_on_conflict = True
```

### `hint_field_name`

The **auto-mapping** hook, and the reason well-authored steps feel pre-configured.

When the workflow author selects your action, the builder walks your declared inputs and outputs
and, for each one carrying a `hint_field_name`, looks for a field on the workflow's object whose
**api name** matches, and pre-populates the mapping. It works for `variable` sources too — the
builder pre-selects the variable with that name.

Two properties to design around:

1. **Matching is by canonical api name.** `"hint_field_name": "email"` pre-maps to a field whose
   api name is `email`. Pick the names a typical business actually uses (`name`, `email`,
   `mobile_phone`), not your internal vocabulary.
2. **There is no type check on the hint.** The pre-fill happens whether or not the field's type is
   compatible with your `data_type`. A wrong `data_type` therefore *looks* fine when the hint
   happens to match a field, and only fails later — at workflow save — with
   `"X" is not a valid choice`. The manual dropdown, by contrast, does enforce variable-type
   compatibility, which is why the same step can work when mapped by hand and break when
   auto-mapped.

### `hint_related_object_field_name`

The related-object counterpart of `hint_field_name`, used with
`input_source: "related_object_field"`. Set it to `null` when unused; keeping the key present with
an explicit `null` is the house style.

### `script_alias`

**Vestigial.** A fossil of an abandoned JavaScript-runtime design. The Python runtime binds
`inputs.<name>` by the parameter's `name` and never consults `script_alias`. A mismatched or
absent `script_alias` is harmless.

Existing configs set it to the same value as `name`. Keep doing that for consistency, and never
write a script that expects the alias to be the accessor.

### `conflict_resolution` (outputs only)

How the write-back reconciles with the field's current value.

| Value | Effect |
|---|---|
| `overwrite` | Replace whatever is there. |
| `update_if_blank` | Write only when the field is currently empty. |
| `add_only` | Add to a multi-value field without removing existing values. |
| `remove_only` | Remove the given values from a multi-value field. |
| `overwrite_except_null` | Replace, except that a null output leaves the field untouched. |

The builder surfaces `overwrite`, `update_if_blank`, and `add_only`. The other two are accepted by
the platform.

### `create_field_options` (outputs only)

Boolean. When `true`, writing a value that does not match an existing dropdown option **creates**
the option rather than failing. Default `false`.

Leave it `false` unless the step's whole purpose is to seed an option list from an external system
— a typo in an upstream feed becomes a permanent dropdown option otherwise.

### `output_target` — do not use

A phantom field. Some published configs carry `"output_target": "object_field"` on outputs; it is
**silently dropped at publish**. The real key on outputs is `input_source`, exactly as on inputs.
An output declared with only `output_target` and no `input_source` publishes without complaint and
is missing its source declaration.

---

## `data_type` reference

`data_type` names a **variable** type, not a custom-field type. The authoritative publishable enum
is ten values:

```
string | boolean | number | date | datetime | email | phone_number | employee | entity | uuid
```

Plus `file`, used in production for document-processing steps (see below).

### Wire encoding

Values cross the boundary into the runtime as a tagged envelope, `{"t": <type code>, "v": <value>}`,
and are rebuilt into typed Python objects before your script runs. You never handle the envelope
directly, but the type codes explain what you receive:

| `data_type` | Type code | Python type on `inputs` | Write-back expectation |
|---|---|---|---|
| `string` | `s` | `str` | Any string. |
| `boolean` | `b` | `bool` | `True` / `False`. |
| `number` | `n` | `int` or `float` | Numeric; use this for integer, decimal, and money fields alike. |
| `date` | `d` | `datetime.date` | A `date`, or `"YYYY-MM-DD"`. |
| `datetime` | `dt` | `datetime.datetime` | A `datetime`, or an ISO 8601 string. |
| `email` | `em` | `str` | Re-validated as an email on write. |
| `phone_number` | `p` | `str`, E.164 (`"+13125550142"`) | Re-validated on write; an invalid number fails the write, not the script. |
| `employee` | `e` | `uuid.UUID` | A team-member id. |
| `entity` | `e<object_id>` | `uuid.UUID` (the record id) | A valid record id **for the target field's object**. |
| `uuid` | `u` | `uuid.UUID` | A UUID. |
| `file` | `f` | `KizenFile` (see below) | Uploaded-file id(s). |
| *typed array* | `a[...]` | `list` of the element type | Multi-value fields. |
| *untyped list* | `l` | `list` | — |
| *field option* | `o<object_id,field_id>` | `FieldOption` (see below) | Option id or name. |

Note the near-collision between `employee` and `entity`: `employee` is the bare code `e`, while
`entity` is the *parameterized* `e<object_id>`. They are distinguished by the angle brackets, not
by the letter.

### Scalar vs reference types — the asymmetry to design for

`string`, `boolean`, `number`, `date`, `datetime`, and `uuid` round-trip unmodified: what you read
is what you can write back.

`employee`, `entity`, and `phone_number` are **asymmetric**. On the read side your script sees a
plain scalar — an id, or an E.164 string. On the write side the platform re-hydrates a record or
re-validates the number, so the value only survives if it is a valid id or number *for the target
field*. Writing an `entity` id belonging to a different object than the destination relationship
field expects fails at write-back, after your script has already succeeded.

A practical consequence for `employee`: an id is rarely what an external system wants. Resolve it:

```python
resp = kizen.api.get(f"/team/{inputs.owner}")
resp.raise_for_status()
owner_email = resp.json().get("email")
```

### `file` and `KizenFile`

`data_type: "file"` binds to a file field. Field values arrive as `KizenFile` objects with:

| Attribute | Meaning |
|---|---|
| `url` | A **presigned** download URL, valid for roughly 10 minutes. |
| `name` | Original file name. |
| `size` | Size in bytes. |
| `content_type` | MIME type. |

A multi-value file field arrives as a list; index it, or iterate.

Behavior and limits to design around:

- **The presigned URL is short-lived.** Download at the top of the step. Do not stash a URL in an
  output and expect a later step to fetch it — by then it may be expired.
- **Download it with plain `requests`, not through the proxy.** Presigned URLs carry their
  credentials in the query string and reject an added `Authorization` header, so a CDN download
  must bypass any proxy or authenticated session.
- **Everything is in memory.** The container gives you 1 GB of RAM and a `/tmp` that is wiped
  before every execution. Read into `io.BytesIO`, process, upload, and drop the buffer. Multiple
  multi-megabyte PDFs held simultaneously is how these steps hit an out-of-memory kill, which
  surfaces as a step error with no traceback.
- **Writing a file output** means writing uploaded-file id(s), not bytes — the value format for a
  file field is a list of file UUIDs.
- `data_type: "files"` (plural) is a **custom-field** type name, not a variable type. It does not
  work — see below.

```python
import io
import requests
import pypdf

source = inputs.document          # KizenFile
outputs.log(f"Downloading {source.name} ({source.size} bytes, {source.content_type})")

resp = requests.get(source.url, timeout=30)
resp.raise_for_status()

reader = pypdf.PdfReader(io.BytesIO(resp.content))
outputs.page_count = len(reader.pages)
```

### `FieldOption`

Dropdown-style values deserialize to a `FieldOption` object with `name`, `order`, and `code`. It is
UUID-compatible, so it interpolates and compares as the option id where an id is expected — but
when you want the human-readable label, read `.name`:

```python
state_label = inputs.state.name       # dropdown option label
```

Do not assume a bare string from a dropdown-backed input.

### `Stage`

Pipeline stage values deserialize to a `Stage` object:

| Attribute | Meaning |
|---|---|
| `name` | Stage name. |
| `order` | Position in the pipeline. |
| `status` | `open`, `won`, or `lost`. |
| `percentage_chance_to_close` | Numeric probability. |

### Types that publish but break

Custom-**field** type names are the single most common `data_type` mistake. `files`, `integer`,
`decimal`, `money`, and `text` all publish without error — the value is stored as free text — and
then fail in one of two ways:

1. The builder's field dropdown for that parameter shows **"No Options"**, because no variable type
   matches.
2. Saving the workflow fails with `"X" is not a valid choice`.

Use `number` for integer, decimal, and money; `string` for text.

`files` is genuinely blocked rather than merely mis-typed: a parameter cannot express "is a list",
so a multi-value file field needs a string-array variable rather than a `files` parameter.

There is effectively **no client-side validation** of step configs — a bad `data_type` survives
packaging and publishing and surfaces only when a workflow author tries to save. Test every new
step by wiring it into a workflow and saving, not just by publishing.

---

## What the workflow builder user sees

Understanding the builder UI is what separates a step that feels native from one that feels like a
form to fill in.

1. **Plugin description.** Your `plugin_description` (as `overall_description`) is rendered above
   the action picker — once, plugin-wide.
2. **Action select.** Every step your plugin publishes, by `name`, that passes its `when` gate.
3. **Action description.** Once an action is selected, its `action_description` appears.
4. **Pre-configured input and output lists.** This is the key difference from a generic code step:
   the input and output rows are **fixed**. The workflow author maps each declared row to a field,
   a variable, or a static value — they cannot add rows, delete rows, or rename them. Your
   `config.json` *is* the form.
5. **Auto-mapping on selection.** The moment the action is picked, the host tries to pre-populate
   every mapping by matching `hint_field_name` / `hint_related_object_field_name` against the
   workflow object's field names. Good hints mean the step arrives already wired.
6. **Script and runtime are copied at selection time.** The step snapshots `script_runtime` when
   the author picks the action; the script body itself is resolved from the currently-published
   plugin config at run time, never from user input. A workflow author cannot edit your Python.

Validation blocks saving the workflow on:

- a required input left unmapped,
- a mapped field or secret that has since been deleted,
- **the plugin no longer being installed** — the step renders "The Plugin is no longer available"
  and is marked invalid. Uninstalling a plugin therefore invalidates every workflow step that used
  it; it does not silently no-op.

Removing or renaming a published step is the destructive change here: existing workflow steps
referencing it hard-fail at run time with a config-not-found error. Adding a step, or adding an
optional input, is safe.

---

## The Python runtime contract

### Execution environment

- **Runtimes:** Python 3.13 and Python 3.12 (**3.12 is the packager's default when `runtime` is
  omitted**).
- **Isolation:** each execution runs in a fresh container with `/tmp` wiped beforehand, and the
  user code runs in a subprocess.
- **Memory:** 1 GB. An out-of-memory kill is surfaced as a step error.
- **Execution time:** the hard ceiling is **55 seconds**. Past it the execution environment kills
  the step outright — your code gets no exception, no chance to clean up, and no control over the
  message the workflow records. Design to about **30 seconds** instead. That is not the limit, it
  is the working target: it leaves a full retry's worth of headroom inside the real ceiling, so a
  single slow upstream call or one `Retry-After` sleep does not push the run into the kill. A step
  that cannot finish in 30 seconds should do less per run.

- **Identity:** the step runs as the **plugin's own service account** for that business — a
  non-human employee, authenticated by a short-lived signed API key. That service account is the
  actor recorded on timeline events your step causes.
- **Pre-installed packages** beyond the standard library: `requests`, `psycopg`, `pymysql`,
  `oracledb`, `sqlalchemy`, `paramiko`, `pypdf`, `fpdf2`, `lxml`, `numpy`, `msgpack`, `pyjwt`,
  `bcrypt`, `pytz`, `dateutil`, `tzdata`. There is no way to add a dependency; a step that needs
  something else must call it over HTTP or fall back to the standard library (`http.client` keeps
  a step zero-dependency).

### Injected globals

The script body is `exec`'d with four names already bound. They are runtime-injected, so linters
will report them as undefined — those warnings are expected and safe to ignore.

| Global | Type | Purpose |
|---|---|---|
| `inputs` | typed object | Declared inputs, as attributes. |
| `outputs` | validating object | Declared outputs, as assignable attributes, plus `log()`. |
| `secrets` | `dict[str, str]` | Granted integration secrets, namespaced. |
| `kizen` | client | `kizen.api` — the authenticated Kizen HTTP client. |

There is no `main()` and no entry-point convention: the module body *is* the step. Top-level
statements execute in order.

### `inputs`

Attribute access on a typed object built from your declared parameters.

**An unmapped optional input is absent, not `None`.** Plain attribute access raises
`AttributeError`. Read every non-required input defensively:

```python
channel = inputs.channel                                 # required: read directly
tag = getattr(inputs, "connection_secret_tag", None)     # optional: always getattr
```

This is the one place where a defensive read is correct rather than redundant — the attribute
genuinely does not exist.

### `outputs`

Assign attributes to write results back:

```python
outputs.delivered_at = datetime.now(timezone.utc)
outputs.message_id = str(response_body["ts"])
```

The object validates names: assigning to an undeclared output raises and fails the step. Outputs
are written back **after** the script completes successfully — a step that raises writes nothing,
even for outputs it had already assigned. There are no partial writes.

Each written value goes through the destination's `conflict_resolution`, under a plugin timeline
initiator.

### `outputs.log(message)`

Appends to the step's run log, visible in the workflow's execution history alongside the resolved
inputs, the outputs, and a summary of the HTTP requests the step made.

Limits: **8 KB per message, 100 KB total per execution.** Overflow is discarded silently — a step
that logs a full API response per loop iteration will lose the log lines that actually mattered.

```python
outputs.log(f"Resolved channel {channel!r} to id {channel_id}")
```

Log identifiers and status codes, never secret values. Log content is stored in run history and
visible to anyone who can view the workflow.

### HTTP request logging

Outbound HTTP is tracked automatically and summarized in the run history: request count, plus
per-request detail for the **first 100 requests**, with the request body truncated at 8 KB, the
response body at 1 KB, and headers redacted. This is free instrumentation — a step that mysteriously
fails against a third-party API can usually be diagnosed from run history without adding a single
log line.

### `secrets` (inside a step)

`secrets` is a flat dict, keyed by the **namespaced** name
`{plugin_api_name}__{secret_name}` — even though both `kizen.json` and the step's `config.json`
declare the bare name:

```json
// config.json declares the bare name
"secrets": ["api_key"]
```

```python
# the runtime key is namespaced
auth_header = f"Basic {secrets['example_plugin__api_key']}"
```

Hardcoding the full key is fine when the plugin's `api_name` is fixed. When the same source is
published under more than one `api_name` (per-environment variants, sandbox builds that suffix the
api_name), match on the suffix instead:

```python
key = next((k for k in secrets if k.endswith("connection_json")), None)
if not key:
    raise ValueError("No connection_json secret is configured for this plugin.")
connection_raw = secrets[key]
```

Secret values are obfuscated in the step's error output, but nothing stops your own `outputs.log`
from leaking one. Never log a secret, and never echo a response that reflects your credentials
back.

---

## `kizen.api` — calling Kizen and declared services

`kizen.api` is a pre-authenticated HTTP client injected into every step. It is a thin wrapper over
a `requests` session whose headers already carry the plugin service account's business id, user id,
and signed API key. You never handle credentials.

### Methods

```python
kizen.api.get(path, params=None, headers=None, **kwargs)
kizen.api.post(path, data=None, json=None, headers=None, **kwargs)
kizen.api.patch(path, data=None, json=None, headers=None, **kwargs)
kizen.api.put(path, data=None, json=None, headers=None, **kwargs)
kizen.api.delete(path, **kwargs)
kizen.api.head(path, **kwargs)
kizen.api.options(path, **kwargs)
```

Because it is a `requests` session, the usual keyword arguments (`timeout`, `params`, `data`,
`json`, `headers`) work as you expect.

### Response object

Every method returns a real `requests.Response`:

| Member | Meaning |
|---|---|
| `.ok` | `True` for 2xx. |
| `.status_code` | Integer status. |
| `.headers` | Response headers (this is where `Retry-After` lives). |
| `.json()` | Parsed body. |
| `.text` | Raw body — the thing to include in an error message. |
| `.content` | Raw bytes. |
| `.raise_for_status()` | Raises on non-2xx. |

Nothing raises automatically on a non-2xx: `kizen.api` returns the response and leaves the decision
to you.

### Relative paths → the Kizen REST API

A path starting with `/` is resolved against the platform API base, so worker code calls exactly
the same public REST API documented in [platform API](05-platform-api.md) — authenticated as the
plugin's service account:

```python
# read a team member
resp = kizen.api.get(f"/team/{inputs.owner}")

# update a record
resp = kizen.api.patch(
    f"/records/example_object/{record_id}",
    json={"fields": [{"name": "example_plugin_status", "value": "active"}]},
)

# search
resp = kizen.api.post(
    "/records/example_object/search",
    json={"field_names": ["name", "email"], "query": [...]},
)
```

Absolute URLs pass through unchanged, but there is no reason to send one — use plain `requests` for
external hosts so the authenticated session is never pointed at a third party.

### Service-proxy paths → your declared services

Python steps **can** call the plugin's declared `services[]` through the generic proxy. Build the
path by hand — there is no `getServiceUrl` helper in Python — and the proxy resolves it against the
service's `base_service_url` and injects auth server-side:

```python
BASE_URL = "/external-integrations/proxy/example_plugin/example_service"

resp = kizen.api.post(
    f"{BASE_URL}/messages",
    json={"channel": channel_id, "text": inputs.message},
)
```

The shape is `/external-integrations/proxy/{plugin_api_name}/{service_name}/{remaining path}`;
everything after the service name is appended to the service's base URL.

Proxy behavior a Python step must handle:

- **The proxy wraps the upstream response.** The upstream payload is nested — extract it:
  `body = resp.json().get("body") or {}`.
- **A disconnected OAuth service returns HTTP 503** from the proxy. That is a configuration
  problem, not a transient one: raise with a message telling the user to reconnect the integration
  in the plugin's setup assistant.
- **API-level errors can hide behind HTTP 200.** Several vendors always return 200 and put the real
  outcome in the body. Check the body's own success flag, not just `resp.ok`.
- **The proxy sends exactly three headers upstream, and none of them are yours.** It forwards
  `Accept: application/json` (forced, not dropped — you cannot negotiate a different response
  content type), the injected `Authorization`, and on `POST`/`PUT`/`PATCH`/`DELETE` with a body,
  `Content-Type: application/json`. Your own headers do not survive, **including `Content-Type`**:
  the body is re-serialized as JSON regardless of what you asked for. A vendor endpoint that only
  accepts `application/x-www-form-urlencoded` cannot be called through the proxy with a form body
  — call it with plain `requests` instead, or have the vendor accept JSON.
- **Service scope.** A service declared `scope: "service-account-only"` can be called *only* by
  plugin code steps (the plugin service account); JavaScript surfaces get 403. The inverse,
  `user-account-only`, blocks code steps. See
  [auth, secrets and services](06-auth-secrets-services.md).

### `kizen.api` vs bare `requests`

| Target | Use |
|---|---|
| The Kizen REST API | `kizen.api` with a relative path. |
| A service declared in `services[]` | `kizen.api` with a proxy path. |
| A public or unauthenticated external API | plain `requests`. |
| An external API whose credential is a plugin secret | plain `requests`, injecting the secret yourself. |
| A presigned CDN URL | plain `requests` — an added `Authorization` header breaks it. |

Never mix the two for the same host.

---

## Rate limits and retries

Three graduated patterns, in increasing order of rigor. Pick the simplest one that fits the API you
are calling, and remember the whole step shares one execution budget: a sleep is spent from the
same seconds your HTTP calls need, against a 55-second hard ceiling.

### 1. Retry loop with `Retry-After` and exponential fallback

For an API that returns a plain integer `Retry-After`:

```python
import time
import requests

MAX_RETRIES = 3
auth_header = f"Basic {secrets['example_plugin__api_key']}"


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
```

### 2. Budget-aware single retry

The version to prefer when the upstream can ask for a long wait. It retries **once**, and only if
the requested wait fits the execution budget; otherwise it fails fast with a message the workflow
owner can act on:

```python
import time

MAX_SLEEP_SECONDS = 20   # keep well inside the step's execution budget


def request_with_retry(method, url, **kwargs):
    """Call the proxy, retrying once on 429 when Retry-After fits the budget."""
    try:
        resp = method(url, **kwargs)
    except Exception as exc:
        raise Exception(
            "Example Plugin error: service_unavailable — the proxy is unreachable. "
            f"Check the integration connection in the plugin setup assistant. ({exc})"
        )

    if resp.status_code == 429:
        retry_after = resp.headers.get("Retry-After")
        if not retry_after or int(retry_after) > MAX_SLEEP_SECONDS:
            raise Exception(
                "Example Plugin error: rate_limited — the API rate limit was reached. "
                f"Retry after {retry_after or 'unknown'} seconds."
            )
        time.sleep(int(retry_after))
        resp = method(url, **kwargs)

    if not resp.ok:
        detail = resp.json().get("error", "") if resp.content else ""
        raise Exception(
            f"Example Plugin error: proxy_error — HTTP {resp.status_code} from the proxy"
            f"{f': {detail}' if detail else ''}"
        )

    # The proxy wraps the upstream payload.
    return resp.json().get("body") or {}
```

Call it by passing the bound method: `request_with_retry(kizen.api.post, url, json=payload)`.

### 3. RFC-2822-aware `Retry-After`

`Retry-After` may legally be an HTTP-date rather than a number. Handle both:

```python
import time
from email.utils import parsedate_to_datetime
from datetime import datetime, timezone

DEFAULT_RETRY_DELAY = 1


def parse_retry_after(value):
    """Parse Retry-After (seconds or HTTP-date) into a delay in seconds."""
    if value is None:
        return DEFAULT_RETRY_DELAY
    try:
        return int(value)
    except (ValueError, TypeError):
        pass
    try:
        retry_at = parsedate_to_datetime(value)
        delay = (retry_at - datetime.now(timezone.utc)).total_seconds()
        return max(delay, DEFAULT_RETRY_DELAY)
    except Exception:
        return DEFAULT_RETRY_DELAY
```

### Helpers are per-step, by design

Steps are isolated units. There is no shared module, no import path between steps, and no way to
factor a helper out of one `script.py` into another. **Copying `request_with_retry` into every step
in a plugin is the correct pattern**, not a smell — the only factoring available is local functions
inside one file.

---

## Database-connector steps

A recurring shape: a plugin whose whole job is to run SQL against a customer's database. The
pattern below is worth copying wholesale.

### One JSON secret, optionally keyed by environment

Rather than four secrets for host/port/user/password, declare **one** secret holding a JSON
document. That also gives you a free multi-environment mechanism: the document is either flat, or
nested by environment tag, and an optional `connection_secret_tag` input selects the nesting key.

```json
// flat
{ "host": "db.example.com", "port": 5432, "user_name": "reporting", "password": "…" }

// keyed by environment
{
  "production_db": { "host": "…", "port": 5432, "user_name": "…", "password": "…" },
  "staging_db":    { "host": "…", "port": 5432, "user_name": "…", "password": "…" }
}
```

`connection_secret_tag` is **not** a manifest or platform field — it is a conventional input name.
Declare it as an optional `string` input.

### Normalize smart quotes before parsing

Users paste connection JSON out of documents and chat clients, which substitute curly quotes.
`json.loads` rejects them with an unhelpful error. Translate first:

```python
SMART_QUOTE_MAP = str.maketrans({
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "‘": "'", "’": "'", "‛": "'",
})
connection = json.loads(raw_secret.translate(SMART_QUOTE_MAP))
```

### Split read and write into two steps, and guard the read

A read step and a write step are separate published steps with separate api_names. The read step
rejects anything that is not a `SELECT`, both with a regex pre-check and by forcing the session
read-only; the write step deliberately has no guardrail.

The regex is a **guardrail, not a security boundary** — the query text is executed verbatim, so a
step that takes a query from a workflow variable is by construction an arbitrary-SQL surface. Say
so in the `action_description`, restrict the database user's grants, and never assemble SQL from
record data.

### Complete read step

`src/automationSteps/dbRead/config.json`:

```json
{
  "name": "Read Data",
  "api_name": "db_read",
  "plugin_description": "Example database connector.",
  "action_description": "Connects to the configured database and runs a read-only query. SELECT only — write statements are rejected. With Return Single Value on, the query must return exactly one row and one column.",
  "action_type": "example_plugin_db_read",
  "runtime": "python-3-13",
  "secrets": ["connection_json"],
  "inputs": [
    { "name": "database", "label": "Database", "data_type": "string", "required": true, "input_source": "static_value", "script_alias": "database" },
    { "name": "query", "label": "Query", "data_type": "string", "required": true, "input_source": "variable", "script_alias": "query" },
    { "name": "return_single_value", "label": "Return Single Value", "data_type": "boolean", "required": true, "input_source": "static_value", "default": true, "script_alias": "return_single_value" },
    { "name": "connection_secret_tag", "label": "Connection Secret Tag", "data_type": "string", "required": false, "input_source": "static_value", "script_alias": "connection_secret_tag" }
  ],
  "outputs": [
    { "name": "result", "label": "Result", "data_type": "string", "required": true, "input_source": "variable", "script_alias": "result", "conflict_resolution": "overwrite", "create_field_options": false }
  ]
}
```

`src/automationSteps/dbRead/script.py`:

```python
# Example Plugin · Agentic Workflow Step · Read Data
#
# Runs a read-only query against the database described by the connection_json secret.
# The secret is either a flat {host, port, user_name, password} document or a map of
# those documents keyed by environment tag, selected with the connection_secret_tag input.

import json
import re

import psycopg
from psycopg.rows import dict_row

WRITE_STATEMENT = r"^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|CALL|DO)\b"
REQUIRED_KEYS = ("host", "port", "user_name", "password")

SMART_QUOTE_MAP = str.maketrans({
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "‘": "'", "’": "'", "‛": "'",
})


def load_connection():
    """Resolve the connection document, tolerating smart quotes and the nested-by-tag shape."""
    key = next((k for k in secrets if k.endswith("connection_json")), None)
    if not key:
        raise ValueError("No connection_json secret is configured for this plugin.")

    document = json.loads(secrets[key].translate(SMART_QUOTE_MAP))

    tag = getattr(inputs, "connection_secret_tag", None)
    if tag:
        if tag not in document:
            raise ValueError(f"Connection Secret Tag {tag!r} is not present in the connection secret.")
        document = document[tag]

    missing = [k for k in REQUIRED_KEYS if k not in document]
    if missing:
        raise ValueError(f"The connection secret is missing required key(s): {', '.join(missing)}")

    return document


connection_info = load_connection()
query = inputs.query

# Guardrail: reject obvious write statements before opening a connection. The session is also
# forced read-only below — neither is a substitute for restricting the database user's grants.
if re.match(WRITE_STATEMENT, query, re.IGNORECASE):
    raise ValueError("Write statements are not allowed by this step. Use the Write Data step.")

outputs.log(f"Connecting to {connection_info['host']}:{connection_info['port']}/{inputs.database}")

try:
    with psycopg.connect(
        host=connection_info["host"],
        port=connection_info["port"],
        dbname=inputs.database,
        user=connection_info["user_name"],
        password=connection_info["password"],
        row_factory=dict_row,
        connect_timeout=10,
    ) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY")
            cursor.execute("SET default_transaction_read_only = on")
            cursor.execute(query)
            rows = cursor.fetchall()

            if not rows:
                outputs.log("Query returned no rows.")
                outputs.result = ""
            elif inputs.return_single_value:
                if len(rows) != 1 or len(rows[0]) != 1:
                    raise ValueError(
                        "Return Single Value is on, but the query returned "
                        f"{len(rows)} row(s) and {len(rows[0]) if rows else 0} column(s)."
                    )
                outputs.result = str(next(iter(rows[0].values())))
            else:
                outputs.log(f"Query returned {len(rows)} row(s).")
                outputs.result = str(rows)

except psycopg.Error as exc:
    raise ValueError(f"Database error: {exc}")
```

**The stringification limitation is real and worth stating in your `action_description`.** Because
a parameter cannot express a list or a structured value, multi-row results come back as the Python
`repr` of a list of dicts in a single string output. Downstream steps have to parse that. Prefer
`return_single_value` mode, or a query that already aggregates to one value, whenever the result
feeds another step.

---

## Failing cleanly

**Raising is how a step fails.** There is no error callback, no toast, no partial success. An
uncaught exception marks the step failed, writes no outputs, and puts the message and traceback in
the workflow's run history — which is what the workflow owner reads when they investigate.

That makes the exception message a user-facing string. Write it accordingly:

```python
# Bad — the reader learns nothing.
raise Exception(resp.text)

# Good — what failed, why, and what to do.
raise Exception(
    f"Example Plugin error: channel_not_found — no channel named '#{name}' exists. "
    "Check the name, and make sure the bot has been invited to private channels."
)
```

Conventions that make run history readable:

- **Prefix with the plugin and a machine-ish code**, then a human sentence:
  `"Example Plugin error: {code} — {what the user should do}"`.
- **Wrap connection failures with the remedy.** A proxy 503 means the integration is disconnected;
  say "reconnect the integration in the plugin setup assistant," not "503."
- **Validate at the boundary, not everywhere.** Check external API responses and secret documents;
  do not re-check what the platform already guarantees (a `required: true` input is present).
- **Distinguish hard from soft failures deliberately.** A step that does three things can raise on
  the essential one and `outputs.log` a warning for a cosmetic one. Decide per operation, and say
  which is which in the `action_description`.
- **Do not swallow.** A bare `except: pass` turns a failed step into a successful one that wrote
  nothing — the worst outcome, because the workflow continues on stale data.

The three failure shapes worth being able to recognize in run history:

```python
# 1. Explicit raise — the common, intentional failure.
raise ValueError("Example Plugin: start page must be at least 1.")

# 2. Unhandled non-2xx — check and raise with the status and body.
response = requests.get(url, timeout=10)
if not response.ok:
    raise Exception(f"Example Plugin: upstream returned {response.status_code} — {response.text[:500]}")

# 3. Network timeout — always pass an explicit timeout; without one a hung
#    connection burns the whole execution budget and the step dies with no message.
requests.get(url, timeout=10)
```

Always pass `timeout=` to every outbound call. It is the difference between a step that fails in
ten seconds with a clear timeout error and one that is killed mid-flight with nothing useful in the
log.

---

## Complete worked example

A step that calls a declared OAuth service through the proxy, resolves a channel by name, posts a
message, and writes the delivery timestamp back to a record field.

`src/automationSteps/sendNotification/config.json`:

```json
{
  "name": "Send Notification",
  "api_name": "send_notification",
  "plugin_description": "Example Plugin — messaging integration for Agentic Workflows.",
  "action_description": "Posts a plain-text message to a channel using the connected workspace. Channels may be given by name (#general) or by id. Writes the delivery timestamp back to the record.",
  "action_type": "example_plugin_send_notification",
  "runtime": "python-3-13",
  "inputs": [
    {
      "name": "channel",
      "label": "Channel",
      "hint": "Use #channel-name to look up by name, or a channel id for direct delivery.",
      "data_type": "string",
      "required": true,
      "input_source": "variable",
      "script_alias": "channel"
    },
    {
      "name": "message",
      "label": "Message",
      "data_type": "string",
      "required": true,
      "input_source": "variable",
      "script_alias": "message"
    },
    {
      "name": "notify_owner",
      "label": "Notify Record Owner",
      "data_type": "employee",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "owner",
      "hint_related_object_field_name": null,
      "script_alias": "notify_owner"
    }
  ],
  "outputs": [
    {
      "name": "delivered_at",
      "label": "Delivered At",
      "data_type": "datetime",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "last_notified_at",
      "hint_related_object_field_name": null,
      "script_alias": "delivered_at",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    },
    {
      "name": "message_id",
      "label": "Message Id",
      "data_type": "string",
      "required": false,
      "input_source": "variable",
      "script_alias": "message_id",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    }
  ]
}
```

`src/automationSteps/sendNotification/script.py`:

```python
# Example Plugin · Agentic Workflow Step · Send Notification
#
# Posts a message to a channel through the example_service proxy service. Auth is injected
# server-side by the proxy; this script never sees a token.
#
# Optional inputs are read with getattr — an input the workflow author left unmapped is
# absent from `inputs` entirely (AttributeError, not None).

import time
from datetime import datetime, timezone

BASE_URL = "/external-integrations/proxy/example_plugin/example_service"
MAX_SLEEP_SECONDS = 20


def call_service(method, path, **kwargs):
    """Call the service through the proxy, retrying once on 429, and unwrap the payload."""
    url = f"{BASE_URL}{path}"
    try:
        resp = method(url, **kwargs)
    except Exception as exc:
        raise Exception(
            "Example Plugin error: service_unavailable — the integration proxy is unreachable. "
            f"Check the workspace connection in the plugin setup assistant. ({exc})"
        )

    if resp.status_code == 429:
        retry_after = resp.headers.get("Retry-After")
        if not retry_after or not retry_after.isdigit() or int(retry_after) > MAX_SLEEP_SECONDS:
            raise Exception(
                "Example Plugin error: rate_limited — the API rate limit was reached. "
                f"Retry after {retry_after or 'unknown'} seconds."
            )
        outputs.log(f"429 from {path}; sleeping {retry_after}s before one retry.")
        time.sleep(int(retry_after))
        resp = method(url, **kwargs)

    if resp.status_code == 503:
        raise Exception(
            "Example Plugin error: not_connected — the workspace is not connected. "
            "Reconnect the integration from the plugin's setup assistant."
        )

    if not resp.ok:
        raise Exception(
            f"Example Plugin error: proxy_error — HTTP {resp.status_code} from the proxy: "
            f"{resp.text[:500]}"
        )

    # The proxy nests the upstream response under "body".
    return resp.json().get("body") or {}


def resolve_channel_id(name):
    """Resolve a channel name (without the leading #) to its id, paging through results."""
    cursor = None
    while True:
        params = {"limit": 200, "exclude_archived": "true"}
        if cursor:
            params["cursor"] = cursor

        body = call_service(kizen.api.get, "/channels.list", params=params)
        if not body.get("ok"):
            code = body.get("error", "unknown_error")
            raise Exception(f"Example Plugin error listing channels: {code}")

        for channel in body.get("channels", []):
            if channel.get("name") == name:
                return channel["id"]

        cursor = body.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break

    raise Exception(
        f"Example Plugin error: channel_not_found — no channel named '#{name}' exists. "
        "Check the name, and make sure the bot has been invited to private channels."
    )


# --- main -------------------------------------------------------------------

channel_input = inputs.channel
channel_id = (
    resolve_channel_id(channel_input.lstrip("#"))
    if channel_input.startswith("#")
    else channel_input
)

text = inputs.message

# An `employee` input arrives as a team-member id (uuid.UUID). Resolve it to something the
# external system understands before sending it.
owner_id = getattr(inputs, "notify_owner", None)
if owner_id:
    owner_resp = kizen.api.get(f"/team/{owner_id}")
    if owner_resp.ok:
        owner_email = owner_resp.json().get("email")
        if owner_email:
            text = f"{text}\n(owner: {owner_email})"
    else:
        outputs.log(f"Could not resolve owner {owner_id}: HTTP {owner_resp.status_code} — sending without it.")

body = call_service(
    kizen.api.post,
    "/messages.post",
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    data={"channel": channel_id, "text": text},
)

# This API always returns HTTP 200 — success lives in the body.
if not body.get("ok"):
    code = body.get("error", "unknown_error")
    raise Exception(f"Example Plugin error: {code} — the message was not delivered.")

outputs.delivered_at = datetime.now(timezone.utc)
outputs.message_id = str(body.get("ts", ""))
outputs.log(f"Delivered message {outputs.message_id} to channel {channel_id}.")
```

---

## Gotchas

- **An unmapped optional input is absent, not `None`.** `inputs.optional_thing` raises
  `AttributeError`. Use `getattr(inputs, "optional_thing", None)` for every non-required input.
- **`data_type` takes variable type names, not field type names.** `files`, `integer`, `decimal`,
  `money`, and `text` publish without error, then show "No Options" in the builder's field dropdown
  and fail at workflow save with `"X" is not a valid choice`. Use `number` and `string`.
- **`hint_field_name` prefills with no type check.** A wrong `data_type` looks correct when the
  hint happens to match a field name and only breaks at save time — which is why the same step can
  work when mapped by hand and fail when auto-mapped.
- **Always set `api_name` explicitly.** The directory-name fallback lowercases, so `sendNotification`
  collapses to `sendnotification` (underscores themselves are preserved), and a later directory
  rename silently changes the step's primary key.
- **`script_alias` is not the accessor.** The runtime binds by `name`. A script written against
  `script_alias` will not find its input.
- **`action_type` is dead.** Stored, admin-validated, never read.
- **`output_target` is silently dropped.** Outputs use `input_source`, same as inputs.
- **A `"script"` key in `config.json` is ignored.** `script.py` is always read from disk.
- **`allowed_values` is not enforced.** Any string can reach a `static_value` input; always handle
  the else branch.
- **`plugin_description` is plugin-wide, not per-step.** The builder shows one value above the
  action picker. Keep it identical across every step and put step detail in `action_description`.
- **Secrets are namespaced at runtime.** `config.json` declares `"api_key"`; the script reads
  `secrets["example_plugin__api_key"]`. Suffix-match when the api_name varies across environments
  or sandbox builds.
- **A secret must be listed in the step's `secrets` array**, not just in `base_config.secrets`, to
  appear in the step's `secrets` dict.
- **The proxy wraps the upstream response.** `resp.json()["body"]` holds the real payload; a
  disconnected OAuth service returns 503; and some vendors report failure inside a HTTP 200 body,
  so check the body's own success flag.
- **The proxy forwards only `Content-Type`.** `Accept` and every other request header is dropped
  and replaced — you cannot negotiate a response format through it.
- **Outputs are all-or-nothing.** A step that raises writes no outputs, including ones it already
  assigned. There are no partial writes.
- **Assigning an undeclared output name raises** and fails the step.
- **`outputs.log` silently truncates.** 8 KB per message and 100 KB per execution; overflow is
  discarded. Logging a full response per loop iteration loses the lines that mattered.
- **Budget the whole step, sleeps included.** The hard ceiling is 55 seconds and 1 GB; design to
  30 seconds so a retry fits. Cap any `Retry-After` sleep well below the budget and fail fast with
  an actionable message rather than sleeping into a kill.
- **Always pass `timeout=`.** A call without one can consume the execution budget and die with no
  usable error.
- **File presigned URLs expire in about 10 minutes** and reject an added `Authorization` header.
  Download at the top of the step, with plain `requests`.
- **No shared helpers between steps.** Each `script.py` is an isolated unit; duplicating a retry
  helper into every step is the correct pattern, not a smell.
- **Uninstalling a plugin invalidates every workflow step that used it** ("The Plugin is no longer
  available"), and a removed or renamed step api_name hard-fails at run time with a
  config-not-found error. Additive changes are safe; removals and renames are breaking.
- **There is essentially no build-time validation of step configs.** Errors surface at publish or
  at workflow save. Always wire a new step into a real workflow and save it before calling it done.
