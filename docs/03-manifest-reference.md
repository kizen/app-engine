# `kizen.json` Manifest Reference

**What this covers.** Every field of the plugin manifest (`kizen.json`), the artifact
directory convention under `entry` and each artifact's `config.json`, the `services` and
`base_config` blocks, multi-plugin manifests, `developer_business_id`, and the complete list
of validation rules that fail a build or a publish.

**See also:** [Getting started](02-getting-started.md) ·
[Auth, secrets & services](06-auth-secrets-services.md) ·
[Setup assistants](13-setup-assistants.md) ·
[Release & publish](16-release-and-publish.md) ·
[Gotchas](17-gotchas.md)

---

## 1. Shape and location

`kizen.json` sits at the **repository root** and is the only declarative file the platform
reads at the top level. It is either:

- a **single JSON object** — one plugin app in this repo, or
- a **JSON array of objects** — several plugin apps built from one repo (see
  [§9 Multi-plugin manifests](#9-multi-plugin-manifests)).

```ts
type ManifestFile = ManifestFileContent | ManifestFileContent[];
```

Two rules follow from how the manifest is processed:

1. **Artifacts are not declared in `kizen.json`.** Actions, Agentic Workflow steps, blocks,
   pages, views, frames, toolbar items, adornments, object settings items, route scripts and
   calendar sources are discovered by **directory convention** under the `entry` directory.
   Each artifact directory carries its own `config.json`. See
   [§7 Artifact directories](#7-artifact-directories-under-entry).
2. **Unknown top-level keys are passed through, not rejected.** The manifest object is spread
   into the publish payload, so keys the build tooling does not know about still reach the
   backend (this is how `external_link` and `required_entitlement` work). The flip side: a
   misspelled key is silently ignored — see [Gotchas](#gotchas).

### Minimal publishable manifest

The smallest manifest that builds and publishes. There is no "at least one artifact" rule;
you need the six required fields, a thumbnail, and at least one tracked file under `entry`.

```json
{
  "name": "Example Plugin",
  "api_name": "example_plugin",
  "version": "1.0.0",
  "description": "Demonstrates the minimum publishable manifest.",
  "engine": "1.0.0",
  "entry": "src/"
}
```

```
example-plugin/
├── kizen.json
└── src/
    └── thumbnail.png
```

### Representative full manifest

```json
{
  "name": "Example Plugin",
  "api_name": "example_plugin",
  "version": "2.3.0",
  "published": true,
  "description": "Syncs example records and exposes a dashboard block.\n\nRequires an Example account.",
  "external_link": "https://developer.example.com/kizen",
  "engine": "1.0.0",
  "entry": "src/",
  "release_notes_directory": "releaseNotes/",
  "release_branches": ["main"],
  "release_environments": ["dev", "prod"],
  "required_entitlement": null,
  "developer_business_id": {
    "integration": "00000000-0000-0000-0000-000000000001",
    "staging": "00000000-0000-0000-0000-000000000001",
    "go": "00000000-0000-0000-0000-000000000002",
    "fmo": "00000000-0000-0000-0000-000000000003"
  },
  "config_template": {},
  "base_config": {
    "secrets": ["api_key"]
  },
  "services": [
    {
      "service_name": "example_api",
      "display_name": "Example API",
      "auth_type": "basic_auth_token_provided",
      "auth_level": "global",
      "required_entitlement": null,
      "base_service_url": "https://api.example.com",
      "auth_credentials": {
        "integration_secret_api_name": "example_plugin__api_key"
      }
    }
  ]
}
```

---

## 2. Required fields

All six are required on every manifest entry. Missing or empty values fail the build with
`manifest/required-field`.

| Field | Type | Validation | Meaning |
|---|---|---|---|
| `name` | string | non-empty | Display name in the App Marketplace. |
| `api_name` | string | `/^[a-z_][a-z0-9_]+$/` | Permanent identity of the plugin app. |
| `version` | string | `\d+\.\d+\.\d+` | Published version; must strictly increase per release. |
| `description` | string | non-empty | Marketplace description. |
| `engine` | string | must equal `"1.0.0"` | Engine contract version (fixed value today). |
| `entry` | string | `/^[a-zA-Z][a-zA-Z0-9_\-/]*$/` | Directory holding all artifacts. |

### `name`

Free-form display string shown in the Marketplace listing and on the install card. Changing
it is a metadata-only change (patch bump).

### `api_name`

The plugin's stable identity. It keys the install row, the request proxy path
(`/external-integrations/proxy/{api_name}/{service_name}/...`), integration secret names
(`{api_name}__{secret}`), and JS action override keys (`{api_name}.{action_api_name}`).

Pattern: `/^[a-z_][a-z0-9_]+$/`

- lowercase letters, digits and underscores only — **no hyphens, no uppercase**;
- may start with a letter or `_`, never a digit;
- minimum two characters.

**`api_name` is effectively immutable.** Changing or removing it in a pull request is a hard
block in validation, because every business's stored state (installs, service authorizations,
action associations, wired Agentic Workflow steps) keys on it as plain text. Renaming a
published plugin means publishing a new plugin.

Never hardcode your own `api_name` inside scripts — preview builds publish under a suffixed
api_name. Read it from the runtime context instead (`this.pluginApiName`, see
[worker runtime](04-worker-runtime-api.md)).

### `version`

Strict three-part semver: `MAJOR.MINOR.PATCH`. Prerelease and build-metadata suffixes
(`1.2.0-rc.1`) are **not** accepted by the version format check.

- It must strictly increase against the base branch on every pull request.
- The backend rejects re-publishing a version that already exists for this plugin, so a direct
  push to a release branch cannot reuse a version either.
- The version also selects which release-notes file ships:
  `<release_notes_directory>/<version>.md`.
- `0.0.0` is reserved for preview/dev builds and is set by the pipeline, not by you.

Full discipline and the bump-size matrix live in
[Release & publish](16-release-and-publish.md).

### `description`

Marketplace body copy. Multiline is fine — embed `\n\n` for paragraphs. It also becomes the
`overall_description` shown alongside plugin-provided Agentic Workflow steps in some surfaces,
so keep it about the plugin, not about one feature.

### `engine`

Must be exactly `"1.0.0"`. The allowed-value list has a single entry; any other value fails
with `manifest/engine-version`.

This is a **frozen constant, not a capability selector.** The engine library itself is
versioned independently (currently 1.9.1) and nothing at runtime branches on this field. New
manifest or runtime capabilities never require an engine bump.

### `entry`

Directory containing every artifact, the thumbnail, and the optional schema bundle.
Convention is `"src/"`, but any path matching
`/^[a-zA-Z][a-zA-Z0-9_\-/]*$/` works — nested entries such as `"src/exampleApp/"` are
supported and are how one repo ships several plugins.

Prefix matching is **segment-aware**: an `entry` of `src` claims `src/...` but never
`src-legacy/...`.

---

## 3. Optional typed fields

| Field | Type | Default | Meaning |
|---|---|---|---|
| `published` | boolean | `true` at the backend | `true` = listed in the Marketplace; `false` = published but unlisted. |
| `release_notes_directory` | string | none | Directory holding `<version>.md` release-notes files. |
| `release_branches` | string[] | repo default branch | Branches whose pushes produce a real release. |
| `release_environments` | string[] | pipeline default | Environments to publish to; accepts aliases. |
| `config_template` | object | `{}` | Seed install config not sourced from a setup assistant. |
| `base_config` | object | `{}` | Baseline install config: secrets, service accounts, host flags. |
| `setup_assistant` | object | none | Business-level install wizard: a declarative form, or a plugin view. |
| `user_setup_assistant` | object | none | Per-user setup wizard: a declarative form, or a plugin view. |
| `services` | object[] | `[]` | External service declarations for the request proxy. |
| `developer_business_id` | string \| object | none | Business that owns dev/preview builds. |
| `block_loading_for_setup` | boolean | computed | Set by the packager; do not author. |

### `published`

Controls Marketplace listing of the published version.

- `true` — the plugin appears in the App Marketplace for businesses that pass the entitlement
  gate.
- `false` — the version is published and installable by direct reference, but never listed.
  Use it for plugins distributed to a specific business, and for the "dev" entry of a
  prod/dev pair in a multi-plugin manifest.

Preview builds always publish with `published: false`, regardless of what the manifest says.

### `release_notes_directory`

```json
{ "release_notes_directory": "releaseNotes/" }
```

At build time the packager looks for `<release_notes_directory>/<version>.md` — the file whose
name matches the **current** manifest version — and attaches its content as the version's
release notes. The notes are shown to admins in the Marketplace and become the body of the
tagged release created for the deploy.

No rule fails a build when the file is missing (the notes simply come out empty), but shipping
a version without notes is treated as an incomplete release. Write the file in the same commit
as the version bump. See
[Release & publish](16-release-and-publish.md).

Nothing reads notes files for older versions at build time; they stay in the repo as history
and are served from the backend's release-notes list.

### `release_branches`

```json
{ "release_branches": ["main"] }
```

Array of non-empty branch names. A push to a listed branch produces a real (non-preview)
release; a push to any other branch runs validation only and, when a pull request is open,
produces a preview build.

When the field is absent, the pipeline defaults it to the repository's default branch — which
is what most repos want, so omitting it is fine and common. In a multi-plugin manifest each
entry is filtered independently: only entries whose `release_branches` contain the pushed
branch are packaged and published for that push.

> Note the singular spelling trap: `release_branch` is **not** a field. Nothing reads it, so a
> manifest that uses it silently falls back to the default-branch behavior.

Production environments impose an additional constraint the manifest cannot override: a
release into `go`/`fmo` only happens from the default branch (`main`).

### `release_environments`

```json
{ "release_environments": ["dev", "prod"] }
```

Array of environment names. Two kinds of value are accepted:

| Kind | Values | Expands to |
|---|---|---|
| Concrete | `go`, `fmo`, `staging`, `integration`, `e2e-integration`, `e2e-staging`, `test1` | itself |
| Alias | `prod` | `go`, `fmo` |
| Alias | `dev` | `staging`, `integration` |
| Alias | `testing` | `e2e-integration`, `e2e-staging` |

`go` and `fmo` are the production environments; `staging` and `integration` are the
non-production ones. Aliases and concrete names can be mixed; the expanded set is deduplicated
before publishing, and the plugin is published once per concrete environment.

Any value outside the table above fails with `manifest/release-environments`.

When the field is absent the pipeline supplies a default appropriate to the deployer that
picked up the push (non-production environments for the development deployer, production for
the production deployer). Because the effective set is not always what the literal array says,
**never reason about "how many environments" from the raw array** — expand aliases first. This
matters for `developer_business_id` (below), which is validated against the expanded set.

### `config_template`

Untyped JSON object merged into the install config as a starting point for values that do not
come from a setup assistant.

```json
{
  "config_template": {
    "environment": "production",
    "summaryObject": {
      "objectFieldTemplate": {
        "subject": "{{entityName}} — call summary",
        "owner": "{{employeeId}}"
      }
    }
  }
}
```

Values land in the business install config and are readable from scripts the same way
assistant values are (`this.config.<key>`, and `{{config.<key>}}` in artifact `when`
conditions).

In practice most plugins ship `config_template: {}` and drive everything from the setup
assistant, which is the surface admins can actually edit. Treat `config_template` as a way to
seed static defaults for keys no assistant field owns.

### `base_config`

Untyped JSON object that becomes the plugin's baseline configuration at publish time. Unlike
`config_template`, several of its keys have real platform meaning.

| Key | Type | Meaning |
|---|---|---|
| `secrets` | string[] | Integration secrets this plugin declares. Required for any secret a service or an Agentic Workflow step references. |
| `integration_service_accounts` | `{api_name, display_name?}[]` | Service accounts to auto-create per install for external systems calling into Kizen. |
| `force_open_source` | boolean | Debug-only override of the open-source flag. Do not ship it. |

```json
{
  "base_config": {
    "secrets": ["api_key", "example_connection"],
    "integration_service_accounts": [
      { "api_name": "sync", "display_name": "Example Sync Account" }
    ]
  }
}
```

**`secrets`** — each entry becomes an integration secret named `{api_name}__{secret}` (so
`api_key` on `example_plugin` becomes `example_plugin__api_key`). The secret rows are created
empty when a business installs the plugin; an admin fills the values in the app. Scripts never
see the values directly for proxied services — the proxy injects them server-side — while
Agentic Workflow step code reads them as `secrets['example_plugin__api_key']`.

Publish-time validation enforces the declarations both ways:

- every secret named in an Agentic Workflow step's `secrets` array must appear in
  `base_config.secrets`;
- every `{{secret.KEY}}` token used inside `services[].auth_credentials` or
  `services[].base_service_url` must appear in `base_config.secrets`.

Entries must be unique, non-empty strings.

**`integration_service_accounts`** — creates a per-install service account named
`{api_name}__{suffix}` with its own API keys, for external systems that need to call the Kizen
API on this plugin's behalf. `api_name` must be at least two alphanumeric characters and
suffixes must not collide after normalization. Accounts are created idempotently on install,
upgrade and re-enable, remain editable, and are removed only when the plugin is uninstalled.

**`force_open_source`** — must be the literal boolean `true` to have any effect. The
open-source flag is normally derived from the source repository's visibility at publish time;
this key exists only for debugging that derivation. Never ship it.

**Computed additions.** The packager folds `setup_assistant`, `user_setup_assistant` and
`block_loading_for_setup` into `base_config` at package time, and adds `kzn_schema_file` /
`kzn_schema_etag` when the entry directory contains an `import.kzn`. Do not author those keys
by hand.

> Unverified: a few plugins carry additional `base_config` keys that host surfaces read as
> display hints (for example `forceEnable`, `disableDetailView`,
> `editConfigurationOverride`). They are not part of any validated contract; do not rely on
> them.

### `setup_assistant` / `user_setup_assistant`

Install wizards. `setup_assistant` runs once per business (values become
`this.config.<key>`); `user_setup_assistant` runs per user (values become
`this.userConfig.<key>`).

Both accept the same shape:

```ts
interface SetupAssistantConfig {
  view?: string;                       // a views/ api_name — replaces the declarative form
  fields?: SetupAssistantField[];      // the form
  actions?: string[];                  // action api_names surfaced as buttons
  services?: { api_name: string; required: boolean; prerequisite: boolean }[];
}
```

Each may be written **inline in `kizen.json`** or as a file at
`<entry>/setupAssistant/assistant.json` / `<entry>/userSetupAssistant/assistant.json`. When
both exist the **inline manifest field wins whole-object**: nothing is merged, and the file's
contents — including the per-field scripts its directory would otherwise contribute — are not
used. The directory itself is still scanned by validation, so leftover per-field scripts can
still raise `manifest/setup-assistant-orphaned-field-scripts`. An inline `null`, or no inline
key, falls through to the file; an empty or whitespace-only `assistant.json` is treated as
absent. The directory form is the more capable one: only it supports per-field async-select
scripts (`setupAssistant/<fieldKey>/getFetchUrl.js` and friends).

```json
{
  "setup_assistant": {
    "services": [{ "api_name": "example_api", "required": true, "prerequisite": true }],
    "actions": ["sync_record"],
    "fields": [
      { "type": "boolean", "key": "enableBlocks", "label": "Enable blocks", "default": true },
      { "type": "text", "key": "accountId", "label": "Account ID", "required": true }
    ]
  }
}
```

**`view`** — set it to a view's api_name and that view becomes the assistant; the declarative
form is not rendered at all.

```json
{
  "setup_assistant": { "view": "plugin_setup_form" }
}
```

- The value is a view's **resolved `api_name`** — the `api_name` from
  `<entry>/views/<dir>/config.json`, not the directory name. `views/businessSettings/` with
  `"api_name": "business_settings_form"` is referenced as `business_settings_form`.
- It must name a `views/` component. A `pages/` component fails with
  `manifest/setup-assistant-view-not-found` (which carries a distinct message for that case).
  The distinction is enforceable only at package time: views and pages compile into the same
  `routable_pages` collection, so nothing downstream can tell them apart.
- `view` is mutually exclusive with the declarative keys. A non-empty `fields`, a non-empty
  `actions`, or any `services` entry with `prerequisite: true` alongside it fails with
  `manifest/setup-assistant-view-conflict`. A `services` entry without `prerequisite: true` is
  already inert in either mode and does not conflict.
- Nothing renders the OAuth authorization step in view mode, which is why `prerequisite`
  conflicts: the view calls `this.authorize()` itself.
- `view: null` and `view: ""` are treated as absent and fall through to the declarative path.
- The packager passes the value through verbatim into `base_config.setup_assistant.view` /
  `base_config.user_setup_assistant.view`. There is no transform.

The view saves by calling `this.completeSetup()`. Writing one is covered in
[setup assistants](13-setup-assistants.md#12-view-based-setup-assistants).

Manifest-level facts worth knowing here:

- `actions` is a list of **action api_name strings**. Each must resolve to an action packaged
  from `<entry>/actions/`, or packaging fails with `structure/setup-assistant-action-ref`. The
  build expands each string into the full action definition inside `base_config`.
- `services[].api_name` is **not validated anywhere**. A typo silently removes the
  authorization prerequisite step instead of failing the build.
- Field-level content receives essentially no build-time validation — malformed assistants
  publish successfully and fail at runtime.

Field types, value shapes, async selects, the re-prompt behavior and host mount points are all
covered in [Setup assistants](13-setup-assistants.md). This page stops at the manifest
boundary.

### `services`

See [§5 The `services` block](#5-the-services-block).

### `developer_business_id`

See [§6 `developer_business_id`](#6-developer_business_id).

### `block_loading_for_setup`

Boolean, **computed by the packager — do not author it.** A hand-set value is overwritten with
the computed one, so writing `true` yourself does not make a plugin blocking. The flag tells the
host to resolve install config before evaluating conditions, so conditional artifacts do not
flicker or mis-evaluate at bootstrap.

A `when` on a **block, data adornment, Agentic Workflow step, toolbar item or calendar source**
is what makes a plugin "blocking". A `when` on a floating frame or an object settings item is
evaluated without blocking: frames appear after the app has loaded either way, and object
settings items sit in a sub-menu where a late evaluation causes no layout shift.

---

## 4. Untyped passthrough fields

These fields are not part of the packager's declared manifest type but are real, in wide use,
and survive to the publish payload because unknown keys are spread through.

### `external_link`

```json
{ "external_link": "https://developer.example.com/kizen" }
```

String URL shown with the Marketplace listing — your documentation, support page or product
site. Purely informational; nothing validates it.

### `required_entitlement`

```json
{ "required_entitlement": "developer_program_member" }
```

Nullable string naming a business entitlement key required to see and install the plugin. When
set, the backend enforces it at four points:

| Surface | Behavior without the entitlement |
|---|---|
| Marketplace listing | Plugin is filtered out — invisible, not just uninstallable. |
| Install | `400` rejection. |
| Installed-plugin listing / bootstrap | Plugin is omitted. |
| Direct install retrieve | `404`. |

Only the **latest published version's** value is evaluated. Consequences:

- publishing a newer version that drops `required_entitlement` makes the plugin visible to
  everyone again;
- publishing an older (lower semver) version that has an entitlement changes nothing;
- revoking a business's entitlement performs a full uninstall of that business's install
  asynchronously — OAuth tokens and event records are cleaned up. Revoked installs are not
  restored automatically if the gate is later removed.

Keys are free-form strings agreed with the platform; `developer_program_member` is the
developer-program gate.

A **separate, per-service** `required_entitlement` exists inside `services[]` and gates only
that service's proxy calls — see [§5](#5-the-services-block).

---

## 5. The `services` block

`services` declares external systems the plugin calls through the Kizen request proxy. The
proxy resolves the base URL and injects credentials server-side, so scripts never hold tokens.

Runtime usage — `this.getServiceUrl(serviceName, path)`, proxy semantics, the header allowlist,
OAuth authorization flows — is covered in
[Auth, secrets & services](06-auth-secrets-services.md). This section is the manifest contract.

### Service object fields

| Field | Type | Required | Meaning |
|---|---|---|---|
| `service_name` | string | yes | Identity used in the proxy path `/external-integrations/proxy/{plugin}/{service_name}/...`. |
| `display_name` | string | recommended | Label shown in the Marketplace authorization panel. |
| `auth_type` | enum | yes | One of the auth backends below. |
| `auth_level` | `"user"` \| `"business"` \| `"global"` | for authed types | Who authorizes and whose credentials are used. |
| `base_service_url` | string (https) | yes | Upstream origin the proxy prefixes to the request path. |
| `auth_credentials` | object | per `auth_type` | Credential material; shape depends on `auth_type`. |
| `required_entitlement` | string \| null | no | Entitlement gate for **this service's** proxy calls. |
| `scope` | `"user-account-only"` \| `"service-account-only"` | no | Restricts which caller identity may use the service. |
| `additional_service_urls` | string[] | no | Extra hosts callers may target via the proxy's alternate-host parameter. |

`auth_level` semantics:

- `user` — every user authorizes individually; the proxy uses the calling user's token.
- `business` — one authorization per business, used by everyone in it.
- `global` — no per-tenant authorization; a stored credential is used for all callers.

`scope` semantics: `service-account-only` restricts the service to the plugin's own service
account, i.e. Agentic Workflow step code only — browser worker surfaces get `403`.
`user-account-only` is the inverse (interactive users only). Unknown scope strings deny every
caller.

### `auth_type: "oauth"`

`auth_credentials` fields:

| Field | Type | Meaning |
|---|---|---|
| `client_id` | string \| encrypted envelope | OAuth client id. |
| `client_secret` | string \| encrypted envelope | OAuth client secret. |
| `scopes` | string | **Space-separated** scope string (not an array). |
| `authorize_url` | string | Provider authorization endpoint. |
| `token_url` | string | Provider token endpoint. |
| `content_type` | string | Token request encoding, e.g. `application/x-www-form-urlencoded`. |
| `token_field_name` | string | Field in the token response holding the access token, e.g. `access_token`. |
| `default_token_expiry` | number | Fallback lifetime in seconds when the provider omits one. |
| `authorize_params` | object | Extra query params on the authorize URL, e.g. `{"access_type": "offline", "prompt": "consent"}`. |
| `success_redirect_path` | string | Post-authorization redirect path. |
| `error_redirect_path` | string | Post-failure redirect path. |

```json
{
  "service_name": "example_user",
  "display_name": "Example (per user)",
  "auth_type": "oauth",
  "auth_level": "user",
  "required_entitlement": null,
  "base_service_url": "https://api.example.com",
  "auth_credentials": {
    "client_id": { "encrypted": true, "value": "<base64 envelope>" },
    "client_secret": { "encrypted": true, "value": "<base64 envelope>" },
    "scopes": "profile.read calendar.read",
    "authorize_url": "https://accounts.example.com/o/oauth2/v2/auth",
    "token_url": "https://oauth2.example.com/token",
    "content_type": "application/x-www-form-urlencoded",
    "token_field_name": "access_token",
    "default_token_expiry": 3600,
    "authorize_params": { "access_type": "offline", "prompt": "consent" }
  }
}
```

> The redirect-path fields are effectively inert in practice: every first-party caller of the
> authorize endpoint passes redirect targets as query parameters, and those take precedence.

Changing `client_id`, `client_secret` or scopes on a published service invalidates stored
tokens for that service and flips affected installs into an error state until users
re-authorize — treat it as a breaking change.

### `auth_type: "basic_auth_token_provided"`

A static stored token injected as `Authorization: Basic <token>`. The token lives in an
integration secret, so it never appears in the repository or in script scope.

```json
{
  "service_name": "example_api",
  "display_name": "Example API",
  "auth_type": "basic_auth_token_provided",
  "auth_level": "global",
  "required_entitlement": null,
  "base_service_url": "https://api.example.com",
  "auth_credentials": {
    "integration_secret_api_name": "example_plugin__api_key"
  }
}
```

`integration_secret_api_name` must be the **fully-qualified** secret name
(`{plugin_api_name}__{secret}`), and the bare secret name must be declared in
`base_config.secrets`.

### `auth_type: "no_auth"`

No credentials; the proxy forwards the request with no injected `Authorization`.

```json
{
  "service_name": "public_api",
  "display_name": "Public API (no auth)",
  "auth_type": "no_auth",
  "required_entitlement": null,
  "base_service_url": "https://api.example.com"
}
```

If the caller supplies an `X-Proxy-Authorization` header it is forwarded verbatim as
`Authorization` — which means the secret lives in the script. Prefer a stored-secret auth type
whenever the credential is not the end user's own.

### Other auth types

`basic_auth_token_exchange` (exchanges a stored basic credential for a bearer token),
`password_token_exchange` (live credential exchange per request, configurable header scheme)
and `private_key_jwt` are also dispatched by the proxy. Their credential shapes and trade-offs
are covered in [Auth, secrets & services](06-auth-secrets-services.md).

### Encrypted credential values

Any credential value inside `services` may be an **encrypted envelope** instead of a plaintext
string:

```json
{ "encrypted": true, "value": "<base64 ciphertext>" }
```

Produce envelopes with `npx --yes @kizenapps/cli encrypt` (from `@kizenapps/cli`), which returns the object
above for you to paste into `kizen.json`. The publish pipeline decrypts them server-side before
the plugin reaches any environment, so committing the ciphertext to a public repository is
safe.

Plaintext credential strings still function, but they are legacy: anyone with repository access
reads them. Encrypt every credential in a repo that is or may become public.

### `{{secret.KEY}}` templating

Inside `auth_credentials` and `base_service_url` you may reference a declared integration
secret by token:

```json
{
  "service_name": "tenant_api",
  "auth_type": "basic_auth_token_provided",
  "auth_level": "business",
  "base_service_url": "https://{{secret.account_host}}/api/v2",
  "auth_credentials": { "integration_secret_api_name": "example_plugin__api_token" }
}
```

Tokens are resolved per request from the installing business's integration secrets, which is
how one service definition serves per-tenant hosts. Every key used must appear in
`base_config.secrets`, or publish fails. An unresolvable token at request time surfaces as a
`400` from the proxy.

---

## 6. `developer_business_id`

Names the business that owns dev and preview builds of this plugin.

```json
{ "developer_business_id": "00000000-0000-0000-0000-000000000001" }
```

```json
{
  "developer_business_id": {
    "integration": "00000000-0000-0000-0000-000000000001",
    "staging": "00000000-0000-0000-0000-000000000002",
    "go": "00000000-0000-0000-0000-000000000003"
  }
}
```

**What it does.** A preview build (`version 0.0.0`, `published: false`) is not listed anywhere;
it is auto-installed into the developer business named here so the pull-request author can
exercise it. Publishing a `0.0.0` build requires this field, and a `0.0.0` build can only be
installed in that business.

**Shape rules.**

| Rule | Severity |
|---|---|
| Must be a non-empty string or an object of non-empty strings | error (`manifest/developer-business-id`) |
| Object keys must be **concrete** environments — alias keys (`dev`, `prod`) are rejected | error |
| A bare string with two or more resolved release environments | warning (`manifest/developer-business-id-environments`) |

The warning exists because a business id is meaningful in exactly one environment: a flat
string is sent verbatim to *every* environment you publish to, and in the others it points at
nothing. Whenever `release_environments` expands to more than one environment, use the object
form and give each environment its own id.

The validator checks environment-name validity only — it cannot check that the business exists.
A wrong-but-well-formed id fails at publish time, not at build time.

`developer_business_id` is not a credential; it stays in the manifest for public repositories.

---

## 7. Artifact directories under `entry`

Artifacts are discovered by directory name. Each artifact is one subdirectory holding a
`config.json` (required for every type except `views/`) plus reserved script filenames.
Filenames are the contract — `kizen.json` never names a script file, and scripts are never
imported or bundled: each file is a standalone script body.

```
src/                                  # = entry
├── thumbnail.png                     # required to publish, PNG only, this level only
├── import.kzn                        # optional schema bundle
├── actions/<name>/{config.json, script.js}
├── automationSteps/<name>/{config.json, script.py}
├── blocks/<name>/{config.json, script.js, styles.css, eventScripts/*.js}
├── calendarSources/<name>/{config.json, calendars.js, events.js}
├── dataAdornments/<name>/{config.json, script.js}
├── floatingFrames/<name>/{config.json, script.js, message.js, styles.css, eventScripts/*.js}
├── objectSettingsItems/<name>/{config.json, script.js}
├── pages/<name>/{config.json, script.js, callback.js, styles.css, eventScripts/*.js}
├── routeScripts/<name>/{config.json, script.js}
├── toolbarItems/<name>/{config.json, script.js}
├── views/<name>/{index.html | script.js, styles.css, eventScripts/*.js, config.json?}
├── setupAssistant/{assistant.json, <fieldKey>/<fn>.js}
└── userSetupAssistant/{assistant.json, <fieldKey>/<fn>.js}
```

| Directory | Packaged collection | `config.json` required | Docs |
|---|---|---|---|
| `actions/` | `js_action_templates` | yes | [08-actions.md](08-actions.md) |
| `automationSteps/` | `automation_action_configs` | yes | [07-automation-steps.md](07-automation-steps.md) |
| `blocks/` | `custom_blocks` | yes | [09-blocks.md](09-blocks.md) |
| `calendarSources/` | `calendar_sources` | yes | [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md) |
| `dataAdornments/` | `data_adornments` | yes | [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md) |
| `floatingFrames/` | `floating_frames` | yes | [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md) |
| `objectSettingsItems/` | `object_settings_menu_items` | yes | [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md) |
| `pages/` | `routable_pages` | yes | [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md) |
| `routeScripts/` | route scripts | yes | [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md) |
| `toolbarItems/` | `toolbar_items` | yes | [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md) |
| `views/` | `routable_pages` | no | [10-views-modals-forms.md](10-views-modals-forms.md) |
| `setupAssistant/`, `userSetupAssistant/` | folded into `base_config` | n/a | [13-setup-assistants.md](13-setup-assistants.md) |

Directories other than these are ignored — a `helpers/` or `docs/` folder under `entry` is
harmless.

### Artifact `api_name` resolution

Every artifact type except data adornments has an `api_name`.

1. If `config.json` sets `api_name`, that value is used.
2. Otherwise it is derived from the directory name: lowercased, `-` and whitespace runs
   collapsed to `_`, all other non-alphanumeric characters stripped.

The derivation is lossy where casing is concerned: it lowercases and so collapses camelCase, and
`archiveChildRecords` becomes `archivechildrecords`. **Underscores are preserved** — `zero_height`
stays `zero_height` — so a snake_case directory name survives the fallback intact.

**Always set `api_name` explicitly in `config.json`.** Derived or explicit, the result must
match `/^[a-z_][a-z0-9_]+$/` and must be unique among siblings in the same directory.

### `when` conditions

Seven artifact types may carry a `when` string in `config.json`: a JavaScript expression,
evaluated in an isolated worker after `{{...}}` interpolation, that decides whether the artifact
is available. Those types are **blocks, data adornments, floating frames, object settings items,
toolbar items, calendar sources and Agentic Workflow steps**.

```json
{ "when": "Boolean({{config.enableBlocks}}) && !{{userConfig.hideExtras}}" }
```

- Artifact conditions use **prefixed** references: `{{config.<key>}}` for business config,
  `{{userConfig.<key>}}` for user config. Both scopes can be composed in one expression.
- Setup-assistant field conditions use **bare** references (`{{someKey}}`) over sibling field
  values.
- A missing key interpolates to `null`, so a typo silently hides the artifact rather than
  erroring.
- Setup-assistant `default` values reach `when` evaluation before an admin ever saves, but they
  do **not** reach `this.config` at script runtime — only saved values do.
- An absent `when` means "always available".
- A `when` on a block, data adornment, toolbar item, calendar source or Agentic Workflow step
  sets `block_loading_for_setup: true` on the package. A `when` on a floating frame or an object
  settings item does not — see [`block_loading_for_setup`](#block_loading_for_setup).

**On `actions/`, `pages/`, `routeScripts/` and `views/` a `when` key is silently discarded.** The
packager reads a fixed set of keys from each of those `config.json` files and `when` is not among
them, so it never reaches the package, the backend or the host — and nothing warns you. Scope
those surfaces another way: an action through its install-time object association, a route script
through its object binding and `routes` regexes, and a page or view by gating whatever navigates
to it.

### `actions/<name>/`

Record-level JavaScript actions (Perform Action menu entries and create overrides).

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | Display name in the actions menu. |
| `api_name` | string | recommended | Action identity; part of the create-override key. |
| `hint_object_name` | string | no | Object api name to pre-select when a business associates the action. |

Files: `config.json`, `script.js` (minified at package time).

```json
{
  "name": "Sync Record",
  "api_name": "sync_record",
  "hint_object_name": "client_client"
}
```

Everything else about an action — which objects it is associated with, whether it appears in
the bulk Perform Action menu (`include_perform_action`), and whether it overrides an object's
create button (`action_override_create`) — is **install-time / host-side configuration, not
manifest configuration**. See [08-actions.md](08-actions.md).

### `automationSteps/<name>/`

Plugin-provided Agentic Workflow steps, written in Python.

| Authored key | Type | Meaning |
|---|---|---|
| `name` | string | Step name in the workflow builder. |
| `api_name` | string | Step identity (published as `action_step_api_name`). Set it explicitly. |
| `plugin_description` | string | Plugin-wide blurb (published as `overall_description`). |
| `action_description` | string | What this step does. |
| `action_type` | string | Legacy step type id; stored, never read at runtime. |
| `runtime` | string | `"python 3.13"` / `"python-3-13"` (also 3.12). Normalized at package time. |
| `secrets` | string[] | Bare secret names this step may read; each must be in `base_config.secrets`. |
| `inputs` | object[] | Input parameter declarations. |
| `outputs` | object[] | Output parameter declarations. |
| `when` | string | Availability condition over install config. |
| `step_history_template` | string | Optional template for the step's history line. |

Parameter entry shape: `{name, label, data_type, required, input_source, hint_field_name,
hint_related_object_field_name, script_alias}`; outputs add `conflict_resolution` and
`create_field_options`.

```json
{
  "name": "Fetch Example Record",
  "api_name": "fetch_example_record",
  "plugin_description": "Example Plugin steps.",
  "action_description": "Fetches a record from the Example API and writes the result back.",
  "action_type": "example_plugin_fetch_record",
  "runtime": "python 3.13",
  "secrets": ["api_key"],
  "inputs": [
    {
      "name": "external_id",
      "label": "External ID",
      "data_type": "string",
      "required": true,
      "input_source": "object_field",
      "hint_field_name": "external_id"
    }
  ],
  "outputs": [
    {
      "name": "status",
      "label": "Sync Status",
      "data_type": "string",
      "required": false,
      "input_source": "object_field",
      "hint_field_name": "sync_status",
      "conflict_resolution": "overwrite",
      "create_field_options": false
    }
  ]
}
```

Files: `config.json`, `script.py`. **`script.py` is shipped raw, not minified**, and a
`"script"` key in `config.json` is ignored — the file on disk always wins.

`data_type` must be a **variable** type, not a field type. The authoring surface, the runtime
contract, the `data_type` enum and conflict-resolution values are documented in
[07-automation-steps.md](07-automation-steps.md).

### `blocks/<name>/`

Embedded blocks for dashboards, homepages, chart groups and record pages.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | — | Display name in the block picker. |
| `api_name` | string | derived | Block identity; the target of `runBlockScript`. |
| `min_w` / `max_w` | number | 1 / 12 | Width bounds in grid columns. |
| `min_h` / `max_h` | number | 1 / 12 | Height bounds in grid rows. |
| `recommended_height` | number | — | Default rendered height in px. |
| `types` | string[] | — | Where the block may be placed: `homepages`, `dashboards`, `charts`, `records`. |
| `when` | string | — | Availability condition. |

```json
{
  "name": "Example Summary",
  "api_name": "example_summary",
  "min_w": 3,
  "max_w": 12,
  "min_h": 3,
  "max_h": 10,
  "recommended_height": 320,
  "types": ["dashboards"],
  "when": "Boolean({{config.enableBlocks}})"
}
```

Files: `config.json`, `script.js`, `styles.css`, `eventScripts/*.js`.

`records` places the block on record detail pages, where it renders in a fixed-height slot rather
than a resizable grid cell — see [record pages](09-blocks.md#record-pages) for the sizing rules.

### `calendarSources/<name>/`

Calendar feeds contributed to the Kizen calendar.

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Display name of the source. |
| `api_name` | string | Source identity. |
| `when` | string | Availability condition. |

Files: `config.json`, `calendars.js` (lists calendars), `events.js` (returns events for a
requested calendar and time range). There is no `script.js`.

```json
{ "name": "Example Calendars", "api_name": "example_calendars" }
```

### `dataAdornments/<name>/`

One-click actions rendered on every field of a given type.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `icon` | string | — | Platform icon name. |
| `customIconFile` | string | — | Filename of an SVG in the artifact directory; inlined as a data URI at package time. |
| `color` | string | — | Icon color (named CSS colors by convention). |
| `tooltip` | string | — | Hover text. |
| `field_type` | `"phonenumber"` \| `"date"` \| `"datetime"` | `phonenumber` | Which field type the adornment attaches to. |
| `when` | string | — | Availability condition. |

```json
{
  "icon": "phone",
  "color": "blue",
  "tooltip": "Call this number",
  "field_type": "phonenumber",
  "when": "Boolean({{config.enableAdornments}})"
}
```

Files: `config.json`, `script.js`.

Data adornments are the **only** artifact type with a required `config.json` and no
`api_name`.

### `floatingFrames/<name>/`

Persistent draggable or anchored overlays.

| Field | Type | Default | Meaning |
|---|---|---|---|
| `name` | string | — | Internal name. |
| `api_name` | string | lowercased dir name | Frame identity; target of `runFrameScript`. |
| `title` | string | — | Header title. |
| `default_position` | `"bottom-left"` \| `"bottom-right"` \| `"bottom-left-fixed"` \| `"bottom-right-fixed"` | `bottom-right` | Initial anchor. `*-fixed` frames cannot be dragged. |
| `header_color` / `header_text_color` | string | — | Header colors (hex, rgb() or named). |
| `height` / `width` | number | — | Frame size in px. |
| `minimized_style` | `"bar"` \| `"circle"` \| `"none"` | `circle` | Minimized presentation. |
| `minimized_config` | object | — | `{icon, color}` or `{customIconFile, color}` for the minimized trigger. |
| `match` | string[] | — | Pathname regex allowlist: non-empty means the frame is hidden unless one matches. |
| `ignore` | string[] | — | Pathname regexes to hide on; merged with platform defaults (login, settings, embed routes). |
| `html` | string | — | Static markup alternative to a script-rendered body. |
| `when` | string | — | Availability condition. |

```json
{
  "name": "Example Widget",
  "api_name": "example_widget",
  "title": "Example",
  "header_color": "#0f766e",
  "header_text_color": "white",
  "default_position": "bottom-right-fixed",
  "minimized_style": "circle",
  "minimized_config": { "icon": "window-restore", "color": "teal" },
  "height": 420,
  "width": 320,
  "when": "Boolean({{config.enableFrames}})"
}
```

Files: `config.json`, `script.js`, `message.js` (handles messages posted up from an embedded
iframe; packaged as `message_handler`), `styles.css`, `eventScripts/*.js`, plus any
`customIconFile` asset.

**Validation rule:** a fixed `default_position` requires `minimized_style: "circle"` (or the
field omitted). Fixed + `bar`/`none` fails the build with
`structure/fixed-frame-minimized-style`, because the circle trigger *is* the fixed anchor.

### `objectSettingsItems/<name>/`

Entries in the settings menu of a custom object's records page.

| Field | Type | Meaning |
|---|---|---|
| `label` | string | Menu entry text. |
| `api_name` | string | Item identity. |
| `when` | string | Availability condition — the only visibility gate. |

```json
{
  "label": "Inspect Object",
  "api_name": "inspect_object",
  "when": "Boolean({{config.enableObjectTools}})"
}
```

Files: `config.json`, `script.js` — and only those two. No `styles.css`, no `eventScripts/`,
no icon or ordering options.

Note the naming split: the directory is `objectSettingsItems/`, the published collection is
`object_settings_menu_items`.

### `pages/<name>/`

Full-page embedded content routable at `/plugins/{plugin_api_name}/{page_api_name}`.

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Page title. |
| `api_name` | string | Page identity and URL segment. |
| `is_toolbar_item` | boolean | Also project the page into the toolbar; clicking navigates (it does not run a script). |
| `toolbar_icon` | string | Icon for that toolbar entry. |
| `toolbar_color` | string | Color for that toolbar entry. |

```json
{
  "name": "Example Console",
  "api_name": "example_console",
  "is_toolbar_item": true,
  "toolbar_icon": "globe",
  "toolbar_color": "#0ea5e9"
}
```

Files: `config.json`, `script.js`, `callback.js` (OAuth/callback landing script for the
iframe-page flow), `styles.css`, `eventScripts/*.js`.

Pages authored here always package as script-type routable pages. HTML-type pages come from
`views/`.

### `routeScripts/<name>/`

Scripts that fire on navigation within an object's record-detail routes.

| Field | Type | Meaning |
|---|---|---|
| `name` | string | Display name. |
| `api_name` | string | Script identity. |
| `hint_object_name` | string | Object api name to pre-select at association time. |
| `routes` | string[] | Pathname regexes; empty array means every detail route of the bound object. |

```json
{
  "name": "Details Tab Gate",
  "api_name": "details_gate",
  "hint_object_name": "client_client",
  "routes": ["/details"]
}
```

Files: `config.json`, `script.js`. Object binding and blocking behavior are install-time
settings.

### `toolbarItems/<name>/`

Buttons in the Kizen toolbar that run a script on click.

| Field | Type | Meaning |
|---|---|---|
| `api_name` | string | Item identity. |
| `label` | string | Button label. |
| `icon` | string | Platform icon name. |
| `color` | string | Icon color (hex by convention here). |
| `when` | string | Availability condition. |

```json
{
  "api_name": "open_example",
  "label": "Open Example",
  "icon": "browser",
  "color": "#4f46e5"
}
```

Files: `config.json`, `script.js`.

### `views/<name>/`

Reusable UI units rendered in modals (and, when routed, as HTML pages).

| Field | Type | Meaning |
|---|---|---|
| `api_name` | string | View identity — the argument to `showViewInModal`. |
| `name` | string | Display name. |

`config.json` is **optional** here (the only artifact type where it is). Without it, the
`api_name` is derived from the directory name — which is exactly when the lossy derivation
bites, so write the config anyway.

Files: `index.html` **or** `script.js` (an `index.html` produces an HTML-type page; a
`script.js` produces a script-type page), `styles.css`, `eventScripts/*.js`.

Views and pages are packaged into the **same** collection, so a view and a page may not share
a name — that fails with `structure/duplicate-component-name`.

### `eventScripts/<handler>.js`

Any surface that renders markup can dispatch to event scripts. Rendered elements carrying
`data-script="handler"` bind their click (buttons) or submit (forms) to
`eventScripts/handler.js` in the same artifact directory. Event scripts are separate,
isolated script bodies — there is no shared module scope between them. See
[11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md).

### `thumbnail.png`

A single PNG at the **first level** under `entry` (`src/thumbnail.png`).

- Required to publish. A build succeeds without it; the publish then hard-fails.
- `.png` only, exactly one — a second thumbnail anywhere under `entry` fails packaging with
  `structure/duplicate-thumbnail`.
- Nested paths such as `src/images/thumbnail.png` are silently ignored.
- No dimension validation; square 256×256 or 512×512 is conventional.

### `import.kzn`

Optional Kizen schema bundle at the first level under `entry`, installed alongside the plugin
so a business gets the objects and fields the plugin expects.

- Must be binary (a zip); a text file fails with `structure/kzn-binary`.
- Exactly one allowed (`structure/duplicate-kzn`).
- At publish it is uploaded and referenced from `base_config` as `kzn_schema_file` /
  `kzn_schema_etag` — do not author those keys.

---

## 8. What the build produces

Useful mental model when debugging a publish: the packager reads `kizen.json`, walks `entry`,
and emits one deployable object per manifest entry:

- every top-level manifest key, spread through as-is;
- `base_config` with `setup_assistant`, `user_setup_assistant` and `block_loading_for_setup`
  folded in, plus schema-file references when `import.kzn` exists;
- `artifacts.*` — one collection per artifact directory, each entry carrying its config fields
  plus its script bodies inline (JS minified, Python raw, CSS and HTML as authored);
- `releaseNotes` — the content of `<release_notes_directory>/<version>.md`, if present;
- `thumbnail` — the uploaded image reference.

Running `npx --yes @kizenapps/cli build` locally writes this same structure to a gitignored `.kizenapp/`
directory, so you can inspect exactly what a publish would send.

---

## 9. Multi-plugin manifests

A top-level array publishes several independent plugin apps from one repository.

```json
[
  {
    "name": "Example Sync",
    "api_name": "example_sync",
    "version": "1.4.0",
    "description": "Syncs records with the Example API.",
    "engine": "1.0.0",
    "entry": "src/exampleSync/",
    "release_notes_directory": "releaseNotes/exampleSync/",
    "release_environments": ["prod"]
  },
  {
    "name": "Example Inbox",
    "api_name": "example_inbox",
    "version": "1.1.2",
    "published": false,
    "description": "Adds an Example inbox block.",
    "engine": "1.0.0",
    "entry": "src/exampleInbox/",
    "release_notes_directory": "releaseNotes/exampleInbox/",
    "release_environments": ["dev"]
  }
]
```

Rules and consequences:

- Each entry is a **complete manifest** — all required fields, its own `entry`, its own
  version, its own release targets.
- `api_name` must be unique across the array (`manifest/duplicate-api-name`).
- Entries may point at the same `entry` directory (a prod/dev pair of the same plugin
  differing only in `api_name`, `published` and `release_environments`) or at separate ones
  (unrelated small plugins in one repo).
- Version discipline is enforced **per entry, matched by `api_name`** — a release that touches
  only one plugin still requires that plugin's version to increase, and only that one.
- On a push, only entries whose `release_branches` include the pushed branch are packaged.
- Release-notes lookup is per entry: give each plugin its own `release_notes_directory` unless
  they genuinely share version numbers.

---

## 10. Validation rules

Two gates fail a plugin: the packager's rule set (build time, before anything is sent) and the
backend's publish validation. Warnings never fail a build.

### Build-time rules

| Rule | Severity | Trigger |
|---|---|---|
| `manifest/missing` | error | No `kizen.json` at the repository root. |
| `manifest/parse` | error | `kizen.json` is not valid JSON. |
| `manifest/shape` | error | A manifest entry is not a JSON object. |
| `manifest/required-field` | error | `version`, `api_name`, `name`, `description`, `engine` or `entry` missing/empty — or an optional field present with the wrong type. |
| `manifest/version-format` | error | `version` is not `\d+.\d+.\d+`. |
| `manifest/api-name-format` | error | `api_name` fails `/^[a-z_][a-z0-9_]+$/`. |
| `manifest/engine-version` | error | `engine` is not `"1.0.0"`. |
| `manifest/entry-path` | error | `entry` fails `/^[a-zA-Z][a-zA-Z0-9_\-/]*$/`. |
| `manifest/release-notes-directory-path` | error | `release_notes_directory` fails the same path pattern. |
| `manifest/release-branches` | error | Not an array of non-empty strings. |
| `manifest/release-environments` | error | Not an array, or contains an unknown environment/alias. |
| `manifest/developer-business-id` | error | Wrong shape, alias keys in the object form, or an empty id. |
| `manifest/developer-business-id-environments` | **warning** | Flat string id with two or more resolved release environments. |
| `manifest/duplicate-api-name` | error | Two entries in a multi-plugin manifest share an `api_name`. |
| `manifest/setup-assistant-shape` | error | An inline `setup_assistant` / `user_setup_assistant` is not a JSON object, or its `view` is present and not a string. |
| `manifest/setup-assistant-parse` | error | `assistant.json` is not valid JSON, or parses to something that is not an object. |
| `manifest/setup-assistant-view-conflict` | error | `view` is set alongside a non-empty `fields`, a non-empty `actions`, or a service with `prerequisite: true`. |
| `manifest/setup-assistant-view-not-found` | error | `view` matches no view in the plugin; a distinct message when the name matches a `pages/` component instead. |
| `manifest/setup-assistant-orphaned-field-scripts` | **warning** | `view` is set but the assistant directory still ships per-field scripts, which are silently ignored. |
| `manifest/setup-assistant-disabled-keys-ignored` | **warning** | `base_config.disabled_keys` is non-empty while at least one assistant on the plugin is view-based. |
| `structure/missing-config` | error | An artifact directory has no `config.json` (all types except `views/`). |
| `structure/config-content` | error | `config.json` is empty. |
| `structure/config-parse` | error | `config.json` is not valid JSON. |
| `structure/api-name-format` | error | An artifact `api_name` — explicit or derived from the directory name — fails the api_name pattern. |
| `structure/duplicate-api-name` | error | Two artifacts in the same directory resolve to the same `api_name`. |
| `structure/duplicate-component-name` | error | The same name is used under both `pages/` and `views/`. |
| `structure/fixed-frame-minimized-style` | error | Floating frame with a `*-fixed` position and `minimized_style` other than `circle`. |
| `structure/kzn-binary` | error | `import.kzn` is not binary. |
| `structure/duplicate-kzn` | error | More than one `import.kzn` under `entry`. |
| `structure/duplicate-thumbnail` | error | More than one `thumbnail.png` under `entry`. |
| `structure/setup-assistant-action-ref` | error | `setup_assistant.actions` names an action that is not packaged. |

`manifest/setup-assistant-disabled-keys-ignored` is a warning rather than an error because
[`disabled_keys`](13-setup-assistants.md#95-base_configdisabled_keys) lives at
`base_config.disabled_keys` — outside either assistant — and the host applies the same array to both. A plugin with one view-based and one declarative assistant
still legitimately needs it; remove it only once no assistant on the plugin is declarative.

Run these locally with `npx --yes @kizenapps/cli build` before pushing. The local CLI can lag the pipeline's
rule set by a release, so a clean local build is a strong signal but not a guarantee.

### Version-discipline rules (pull requests)

| Rule | Trigger |
|---|---|
| `version/not-increased` | An entry's `version` is not strictly greater than the same `api_name`'s version on the base branch. |
| `version/api-name-changed` | An `api_name` present on the base branch is missing from the head branch. |

Skipped when there is no associated pull request, when the base `kizen.json` cannot be read, or
for non-semver versions.

### Publish-time failures

Errors the backend raises that no local build catches:

| Failure | Cause |
|---|---|
| Thumbnail required | No `thumbnail.png` at the first level under `entry`. |
| Duplicate version | A non-`0.0.0` version already exists for this plugin. |
| Dev build must be unlisted | `version` is `0.0.0` without `published: false`. |
| Missing developer business | A preview/dev build without `developer_business_id`. |
| Undeclared step secret | An Agentic Workflow step lists a secret absent from `base_config.secrets`. |
| Undeclared secret token | A `{{secret.KEY}}` token in `services` references a secret absent from `base_config.secrets`. |
| Invalid `base_config.secrets` | Not a list of unique non-empty strings. |
| Invalid service accounts | `integration_service_accounts` entries with short api_names or colliding suffixes. |
| Service validation | A `services` entry fails auth-shape validation for its `auth_type`. |
| Undecryptable secret | An encrypted envelope cannot be decrypted with the plugin's current key. |
| Publish entitlement | The publishing business lacks developer-program membership, or the repository is not allow-listed for it. |

There is **no JSON Schema for `kizen.json`**, and no editor-level validation. The rules above
are the whole contract.

### Type declarations vs. runtime reality

`@kizenapps/packager` exports TypeScript types for the manifest and packaged artifacts. They
are useful for tooling but **narrower than what the platform accepts**, so do not treat a type
error as a build failure:

- `ManifestFileContent` omits `external_link` and `required_entitlement`, both of which are
  real and required in practice.
- `SetupAssistantConfig`/`SetupAssistantField` omit the `qr`, `image` and `link` field types
  and about twenty real props (`required`, `tooltip`, `match_hint`, `dependencies`,
  `validation_pattern`, async-select script hooks, …) plus the `services` key. The engine's
  runtime field type is the real vocabulary.
- `AutomationStep.outputs[].conflict_resolution` omits values the platform accepts (for
  example `update_if_blank`).
- Nothing validates Agentic Workflow step `inputs`/`outputs` at build time — mistakes there
  surface at publish or when an admin saves the workflow.

---

## Gotchas

- **Unknown manifest keys are silently accepted.** There is no "unknown field" error, so
  `release_branch` (singular) or a typo'd `base_config` key does nothing and reports nothing.
  Diff your manifest against this page when behavior is missing.
- **`api_name` is permanent.** Business state keys on it as plain text. Changing it hard-fails
  validation; the only "rename" is publishing a new plugin.
- **Never hardcode your `api_name` in scripts.** Preview builds publish under a suffixed
  api_name, so hardcoded proxy paths and install-config URLs 404 in previews. Use the runtime
  value.
- **Directory-derived artifact `api_name`s are lossy.** camelCase is flattened, hyphen and
  whitespace runs collapse to `_`, and everything else outside `[a-z0-9_]` is dropped
  (underscores survive). Always set `api_name` explicitly in every `config.json`.
- **`views/` and `pages/` share a namespace.** Same name in both is a build error, even though
  they are different directories.
- **Fixed frames need a circle.** `default_position: "*-fixed"` with `minimized_style: "bar"`
  or `"none"` fails the build — the circle trigger is the fixed anchor.
- **Thumbnail placement is unforgiving.** It must be `<entry>/thumbnail.png`, exactly one, PNG.
  Nested copies are ignored silently and the failure only appears at publish.
- **A flat `developer_business_id` with multiple environments is a warning, not an error.** The
  build passes and the publish half-works: the id is valid in one environment and meaningless
  in the others. Use the per-environment object form.
- **`setup_assistant` in `kizen.json` beats `assistant.json` on disk, whole-object.** Nothing
  is merged: if you add the directory form to a manifest that still has an inline block, the
  file's contents are unused, per-field scripts included. Only an inline `null` or an absent
  key falls through to the file.
- **A setup-assistant `view` names an api_name, not a directory.** `views/businessSettings/`
  whose `config.json` sets `"api_name": "business_settings_form"` must be referenced as
  `business_settings_form`; the directory name fails with
  `manifest/setup-assistant-view-not-found`.
- **`disabled_keys` has no effect on what a view-based assistant saves.** It lives at
  `base_config.disabled_keys`, outside either assistant, and a view-based assistant ignores it.
  Leaving it non-empty warns with `manifest/setup-assistant-disabled-keys-ignored`; drop it
  once no assistant on the plugin is declarative.
- **`services[].api_name` referenced from a setup assistant is unvalidated.** A typo silently
  drops the authorization prerequisite instead of failing the build.
- **Setup-assistant `default` values are visible to `when` conditions but not to
  `this.config`.** Until an admin saves the assistant, scripts read `undefined` for keys that
  appear to have defaults.
- **A missing `{{config.key}}` resolves to `null`.** Artifacts silently disappear rather than
  erroring — a renamed config key is a silent outage.
- **`config_template` is inert once a setup assistant exists.** Do not expect it to override or
  seed assistant-owned keys.
- **`base_config.force_open_source` is a debug flag.** Open-source status is derived from
  repository visibility; shipping the flag misreports your plugin.
- **`engine` is not a version selector.** It must be `"1.0.0"`; bumping it fails the build and
  buys nothing.
- **Plaintext credentials in `services` are readable by anyone with repo access.** Encrypt
  them with `npx --yes @kizenapps/cli encrypt`; the pipeline decrypts server-side.
- **`.kizenapp/` is local build state and must stay gitignored.** It contains a browser profile
  used by the local runner, not just build output.
