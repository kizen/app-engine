# Recipes — End-to-End Worked Examples

**What this covers:** six complete, adaptable builds that exercise the platform's main surfaces
together — a publishable skeleton, an OAuth service integration, a database-connector Agentic
Workflow step pair, a block-driven modal wizard, a calendar source, and a record action with
write-back. Every recipe is self-contained: directory tree, `kizen.json` fragments, full
`config.json` files and scripts, and a "What can go wrong" footer into the reference docs.

**See also:** [02-getting-started.md](02-getting-started.md) (the minimal hello world these
recipes grow from) · [17-gotchas.md](17-gotchas.md) (the consolidated trap list every footer
links into) · each recipe names its owning reference doc inline.

All recipes use the plugin api_name `example_plugin`. Everything shown is real, runnable code —
adjust names, objects, and vendor endpoints to your integration.

---

## Recipe 1 — New plugin skeleton

A complete, publishable plugin: manifest, one dashboard block that follows the dashlet chrome
contract, release notes, thumbnail. This is the starting point every other recipe extends.

Owning references: [02-getting-started.md](02-getting-started.md) ·
[03-manifest-reference.md](03-manifest-reference.md) · [09-blocks.md](09-blocks.md) ·
[16-release-and-publish.md](16-release-and-publish.md).

### Directory tree

```
plugin-example/
├── kizen.json
├── releaseNotes/
│   └── 1.0.0.md
└── src/
    ├── thumbnail.png                 # required to publish; PNG at the entry root
    └── blocks/statusCard/
        ├── config.json
        ├── script.js
        ├── eventScripts/
        │   ├── render.js             # the single painter
        │   └── refresh.js
        └── styles.css
```

Scaffold with `npx --yes @kizenapps/cli create`, then add the block directory —
`create` produces no artifact templates.

### `kizen.json`

```json
{
  "name": "Example Plugin",
  "api_name": "example_plugin",
  "version": "1.0.0",
  "description": "A status card block for dashboards and homepages.",
  "engine": "1.0.0",
  "entry": "src/",
  "release_notes_directory": "releaseNotes/",
  "published": false,
  "developer_business_id": { "go": "<your-developer-business-id>" }
}
```

- `engine` is always the literal `"1.0.0"` — a fixed value, not the current engine version.
- `published: false` keeps the plugin installable but unlisted while you develop.
- `developer_business_id` is a **per-environment map**; it is what preview (PR) builds install
  into. Full field reference: [03-manifest-reference.md](03-manifest-reference.md).

### `src/blocks/statusCard/config.json`

```json
{
  "name": "Status Card",
  "api_name": "status_card",
  "types": ["dashboards", "homepages"],
  "min_w": 3,
  "max_w": 8,
  "min_h": 3,
  "max_h": 8,
  "recommended_height": 300
}
```

Always set `api_name` explicitly — the directory-name fallback lowercases, collapsing camelCase
(`statusCard` → `statuscard`); underscores themselves are preserved.

### `src/blocks/statusCard/script.js`

Blocks are worker-rendered: no DOM, UI painted with `this.outputUI`, clicks wired through
`data-script` attributes. The mount script paints a shell and delegates to a single painter
(the [single-painter convention](09-blocks.md#the-single-painter-convention)):

```js
// Mount: shell + delegate. All markup lives in eventScripts/render.js.
this.outputUI(`<div class="sc-card sc-card--loading">Loading status…</div>`);
this.runEventScript("render", { reason: "mount" });
```

### `src/blocks/statusCard/eventScripts/render.js`

```js
// Single painter. Event scripts are isolated workers — small helpers like esc()
// are duplicated per script by design; there are no shared modules.
const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const name = this.currentUser?.profile?.first_name || "there";
const refreshedAt = this.sessionData?.scRefreshedAt;

this.outputUI(`
  <div class="sc-card">
    <div class="sc-head">
      <span class="sc-title">Status</span>
      <button class="sc-btn" data-script="refresh">Refresh</button>
    </div>
    <p class="sc-note">Hello, ${esc(name)} — everything is running.</p>
    ${
      refreshedAt
        ? `<p class="sc-stamp">Refreshed ${esc(new Date(refreshedAt).toLocaleTimeString())}</p>`
        : ""
    }
  </div>
`);
```

### `src/blocks/statusCard/eventScripts/refresh.js`

```js
// State-changing scripts never paint; they record state and re-enter the painter.
this.setSessionData({ scRefreshedAt: Date.now() });
this.runEventScript("render", { reason: "refresh" });
```

### `src/blocks/statusCard/styles.css`

The dashlet chrome contract ([09-blocks.md](09-blocks.md#the-dashlet-chrome-contract--paint-your-own-card)):
the host renders **no card chrome** for plugin blocks — transparent background, no border, no
radius, no shadow (unless the per-dashlet drop-shadow toggle is on) — and clips everything with
`overflow: hidden`. A host global reset also stamps `font-size: 10px; line-height: 1` on every
element. So: paint your own card, inset it so your shadow isn't clipped, and set explicit px
font sizes everywhere.

```css
/* Engine-scoped to this block's markup — plain selectors are safe. */
.sc-card {
  margin: 4px;                      /* inset so the self-painted shadow isn't clipped */
  height: calc(100% - 8px);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 14px;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);   /* tight shadow that fits the 4px inset */
}

/* The host reset leaks in — explicit px font-size/line-height on every text element. */
.sc-title { font-size: 14px; line-height: 20px; font-weight: 700; color: #1e293b; }
.sc-note  { font-size: 13px; line-height: 18px; color: #475569; margin: 10px 0 0; }
.sc-stamp { font-size: 10px; line-height: 14px; color: #94a3b8; margin: auto 0 0; }

.sc-head { display: flex; align-items: center; justify-content: space-between; }

/* data-script buttons must contain text only — a child element swallows the click. */
.sc-btn {
  font-size: 12px;
  line-height: 16px;
  padding: 4px 10px;
  border: none;
  border-radius: 4px;
  background: #4f46e5;
  color: #ffffff;
  cursor: pointer;
}
.sc-card--loading {
  align-items: center;
  justify-content: center;
  font-size: 12px;
  line-height: 16px;
  color: #64748b;
}
```

### `releaseNotes/1.0.0.md`

```md
Initial release: a Status Card block for dashboards and homepages.
```

### Ship it

1. `npx --yes @kizenapps/cli build` — must pass clean.
2. `npx --yes @kizenapps/cli dev` — render the block and click Refresh locally.
3. Push a branch, open a PR — the preview build (version forced to `0.0.0`, suffixed api_name)
   installs into your developer business.
4. Merge to the release branch to publish. Work through the
   [release checklist](16-release-and-publish.md#10-release-checklist) first — version bumped,
   `releaseNotes/<version>.md` added, thumbnail present, secrets encrypted.

### What can go wrong

- Derived api_names, missing `thumbnail.png`, version-bump failures, `.kizenapp/` leaks:
  [17-gotchas.md — Manifest & packaging](17-gotchas.md#manifest--packaging) and
  [17-gotchas.md — Release & publish](17-gotchas.md#release--publish).
- Clipped shadows, the 10px font reset, `data-script` buttons that stop working:
  [17-gotchas.md — Blocks & CSS](17-gotchas.md#blocks--css); full contract in
  [09-blocks.md](09-blocks.md#gotchas).

---

## Recipe 2 — OAuth service integration

A block that reads the signed-in user's profile from an external provider through a declared
OAuth service. The plugin never sees a token: the server-side proxy injects and refreshes
credentials. The recipe covers the service declaration (with encrypted credential envelopes),
`getServiceUrl` proxy calls, the `authorize()` connect flow, and the 503-disconnected contract.

Owning reference: [06-auth-secrets-services.md](06-auth-secrets-services.md). Method signatures:
[04-worker-runtime-api.md](04-worker-runtime-api.md#thisgetserviceurlservicename-path).

### Directory tree

```
plugin-example/
├── kizen.json                        # + services[], version bumped to 1.1.0
├── releaseNotes/
│   └── 1.1.0.md                      # required — the bump selects this file
└── src/
    └── blocks/providerProfile/
        ├── config.json
        ├── script.js
        ├── eventScripts/
        │   ├── render.js
        │   └── connect.js
        └── styles.css                # card chrome as in Recipe 1 (omitted here)
```

### `kizen.json` — the service declaration

A **user-level** OAuth service: each employee authorizes their own account, and the proxy stores
one token per (install, service, employee). Encrypt `client_secret` (and ideally `client_id`)
with `npx --yes @kizenapps/cli encrypt` — plaintext works but is legacy, and in a public repo it is a live
credential leak:

```json
{
  "name": "Example Plugin",
  "api_name": "example_plugin",
  "version": "1.1.0",
  "description": "Shows your connected provider profile on a dashboard.",
  "engine": "1.0.0",
  "entry": "src/",
  "release_notes_directory": "releaseNotes/",
  "services": [
    {
      "service_name": "provider_user",
      "display_name": "Provider (my account)",
      "auth_type": "oauth",
      "auth_level": "user",
      "scope": "user-account-only",
      "required_entitlement": null,
      "base_service_url": "https://api.provider.example.com",
      "auth_credentials": {
        "client_id": { "encrypted": true, "value": "<base64 envelope>" },
        "client_secret": { "encrypted": true, "value": "<base64 envelope>" },
        "scopes": "profile.read",
        "authorize_url": "https://auth.provider.example.com/oauth2/authorize",
        "token_url": "https://auth.provider.example.com/oauth2/token",
        "content_type": "application/x-www-form-urlencoded",
        "token_field_name": "access_token",
        "default_token_expiry": 3600,
        "authorize_params": { "access_type": "offline", "prompt": "consent" }
      }
    }
  ]
}
```

- Produce each envelope with `printf %s "$SECRET" | npx --yes @kizenapps/cli encrypt --api-name example_plugin`
  (stdin, never `--value`; `--stage dev` for dev environments). Envelopes are bound to this
  plugin's api_name.
- `scopes` is a **space-separated string**, not an array.
- `authorize_params` with `access_type: offline` / `prompt: consent` is what makes providers
  issue a refresh token — without one, every user re-authorizes when the access token expires
  and the failure mode is a mid-session 503.
- `scope: "user-account-only"` blocks the plugin's service account (Python steps) from this
  service — appropriate, since a per-employee token means nothing to a workflow. A plugin that
  also needs to act business-wide declares a **second** service with `auth_level: "business"`
  and `scope: "service-account-only"` against the same host (the
  [two-service pattern](06-auth-secrets-services.md#dual-user--business-oauth-the-two-service-pattern)).
- Changing any `auth_credentials` value in a later release — including re-encrypting an
  unchanged secret — **disconnects every existing connection**. Encrypt once; announce scope
  changes in release notes.

### `src/blocks/providerProfile/config.json`

```json
{
  "name": "Provider Profile",
  "api_name": "provider_profile",
  "types": ["dashboards", "homepages"],
  "min_w": 3,
  "max_w": 8,
  "min_h": 3,
  "max_h": 8,
  "recommended_height": 300
}
```

### `src/blocks/providerProfile/script.js`

```js
this.outputUI(`<div class="pp-card pp-card--loading">Loading profile…</div>`);
this.runEventScript("render", { reason: "mount" });
```

### `src/blocks/providerProfile/eventScripts/render.js`

`getServiceUrl` returns the **relative** proxy URL
(`/external-integrations/proxy/example_plugin/provider_user/...`), which routes the request
through the Kizen backend so it can inject the stored token. A proxy **503 means "this user has
not connected the service"** — never a transient outage. Do not retry it; paint a connect
affordance instead:

```js
const esc = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const [profile, error] = await this.getWithErrors(
  this.getServiceUrl("provider_user", "/v1/me"),
);

if (error) {
  // 503 from the proxy = no usable stored token for this employee. Other employees
  // being connected does not help — user-level tokens are per employee.
  if (error.upstreamStatus === 503 || error.proxyStatus === 503) {
    this.outputUI(`
      <div class="pp-card">
        <p class="pp-note">Connect your Provider account to see your profile here.</p>
        <button class="pp-btn" data-script="connect">Connect Provider</button>
      </div>
    `);
    return;
  }

  // Any other failure is an expected upstream problem: branch on upstreamStatus
  // (the vendor's real status), not proxyStatus (200 whenever the proxy reached it).
  this.console.warn("Provider Profile: fetch failed", error);
  this.outputUI(`
    <div class="pp-card">
      <p class="pp-note">Could not reach Provider (HTTP ${esc(error.upstreamStatus ?? "?")}).</p>
      <button class="pp-btn" data-script="render">Try again</button>
    </div>
  `);
  return;
}

this.outputUI(`
  <div class="pp-card">
    <div class="pp-head">
      <span class="pp-title">${esc(profile?.display_name ?? "Connected")}</span>
      <button class="pp-btn" data-script="render">Refresh</button>
    </div>
    <p class="pp-note">${esc(profile?.email ?? "")}</p>
  </div>
`);
```

### `src/blocks/providerProfile/eventScripts/connect.js`

`this.authorize(serviceName)` opens the provider's authorize page **in a new tab** and returns
`void` — the outcome is not observable from the script. Do not `await` it or chain logic on it;
re-check connectivity on the next interaction by making a call and looking for 503:

```js
this.authorize("provider_user");

this.showToast("Finish connecting in the new tab, then check the connection.", {
  variant: "alert",
});

// Repaint with a re-check affordance. "Check connection" simply re-enters render:
// if the user completed the flow, the /v1/me call now succeeds; if not, 503 again
// and the connect card comes back.
this.outputUI(`
  <div class="pp-card">
    <p class="pp-note">Waiting for you to finish authorizing in the other tab…</p>
    <button class="pp-btn" data-script="render">Check connection</button>
  </div>
`);
```

A setup assistant can express the same requirement declaratively — a service prerequisite step
blocks progress until the service is connected
(`{ "services": [{ "api_name": "provider_user", "required": true, "prerequisite": true }] }`,
see [13-setup-assistants.md](13-setup-assistants.md)).

### `releaseNotes/1.1.0.md`

This recipe bumps `version` to `1.1.0`, and the version selects its release-notes file by name —
so `releaseNotes/1.1.0.md` has to exist or the release checklist fails at publish:

```md
Adds a Provider Profile block backed by a user-level OAuth service. Each user connects their own
provider account from the block.
```

### Proxy behavior to design around

- **The proxy always returns HTTP 200 when the outbound call was made**, wrapping the upstream
  response. JS workers get this unwrapped automatically: a failing upstream raises a
  `KizenRequestError` with `proxyStatus: 200` and the real `upstreamStatus`. Branch on
  `upstreamStatus`.
- **Only two caller headers survive** (`Content-Type`, and `X-Proxy-Authorization` on `no_auth`
  services); `Accept: application/json` is forced. Custom vendor headers and non-JSON responses
  are unreachable through the proxy.
- **No plugin code path can read a token or stored secret** — there is no secrets API in the
  worker. If a design needs the raw token, the design is wrong for this platform.

### What can go wrong

- Unfilled secrets (proxy 400), token invalidation on republish, `service_name` renames,
  per-employee 503s, header stripping:
  [17-gotchas.md — Services, auth & secrets](17-gotchas.md#services-auth--secrets); full
  contract in [06-auth-secrets-services.md](06-auth-secrets-services.md#gotchas).
- `authorize()` never triggers a page `callback.js` (new tab, no cross-tab postMessage):
  [10-views-modals-forms.md](10-views-modals-forms.md#gotchas).

---

## Recipe 3 — Database-connector Agentic Workflow step

A read/write step pair that runs SQL against a customer database described by a single JSON
secret, with an optional `connection_secret_tag` input for multi-environment documents, a
read-only guardrail on the read step, and a budget-aware retry.

Owning reference: [07-automation-steps.md](07-automation-steps.md). Secrets:
[06-auth-secrets-services.md](06-auth-secrets-services.md#3-secrets).

### Directory tree

```
plugin-example/
├── kizen.json                        # + base_config.secrets
└── src/
    └── automationSteps/
        ├── dbRead/
        │   ├── config.json
        │   └── script.py
        └── dbWrite/
            ├── config.json
            └── script.py
```

Steps are discovered by directory convention — nothing lists them in `kizen.json`. They run
server-side in a sandboxed Python container (no `this`, no UI); the only I/O is declared
inputs/outputs, granted secrets, outbound HTTP, and the injected `kizen` client. The platform's
hard ceiling is **55 seconds and 1 GB**; design to about **30 seconds** so a retry fits.

### `kizen.json` fragment — one JSON secret

```json
{
  "base_config": { "secrets": ["connection_json"] }
}
```

Declare **one** secret holding a JSON document, not one secret per field. Installing creates the
row **empty**; an admin fills it via integration secrets. The document is either flat, or nested
by an author-chosen environment tag:

```json
// flat
{ "host": "db.example.com", "port": 5432, "user_name": "reporting", "password": "…" }

// keyed by environment — selected per step with the connection_secret_tag input
{
  "production_db": { "host": "db.example.com",       "port": 5432, "user_name": "…", "password": "…" },
  "staging_db":    { "host": "db-stage.example.com", "port": 5432, "user_name": "…", "password": "…" }
}
```

`connection_secret_tag` is a **plugin-side convention, not a platform concept** — an ordinary
optional string input. Because it is chosen when the workflow is built, the same step type can
target production in one workflow and staging in another with one install and one secret.

### `src/automationSteps/dbRead/config.json`

```json
{
  "name": "Read Data",
  "api_name": "db_read",
  "plugin_description": "Example database connector.",
  "action_description": "Connects to the configured database and runs a read-only query. SELECT only — write statements are rejected; use Write Data to modify rows. With Return Single Value on, the query must return exactly one row and one column. Multi-row results are returned as a single stringified value.",
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

Config rules that bite: `data_type` takes **variable** type names (`number`, `string` — never
`integer`/`decimal`/`text`, which publish cleanly and then fail at workflow save); the step's
`secrets` array lists the **bare** name and must be a subset of `base_config.secrets`;
`plugin_description` is shown once plugin-wide, so keep it identical across both steps and put
step detail in `action_description`.

### `src/automationSteps/dbRead/script.py`

```python
# Example Plugin · Agentic Workflow Step · Read Data
#
# Runs a read-only query against the database described by the connection_json secret.
# The secret is a flat {host, port, user_name, password} document, or a map of those
# documents keyed by environment tag (selected with the connection_secret_tag input).

import json
import re
import time

import psycopg
from psycopg.rows import dict_row

WRITE_STATEMENT = r"^\s*(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|COPY|CALL|DO)\b"
REQUIRED_KEYS = ("host", "port", "user_name", "password")

# Admins paste connection JSON out of documents and chat clients, which substitute
# curly quotes; json.loads rejects them with an opaque error. Normalize first.
SMART_QUOTE_MAP = str.maketrans({
    "“": '"', "”": '"', "„": '"', "‟": '"',
    "‘": "'", "’": "'", "‛": "'",
})


def load_connection():
    """Resolve the connection document, tolerating smart quotes and the tag-nested shape."""
    # Suffix-match the namespaced key ({plugin_api_name}__connection_json) so preview
    # builds, which suffix the plugin api_name, still find it.
    key = next((k for k in secrets if k.endswith("connection_json")), None)
    if not key or not secrets[key]:
        raise ValueError(
            "Example Plugin error: not_configured — the connection_json secret is empty. "
            "Set it under the plugin's integration secrets."
        )

    document = json.loads(secrets[key].translate(SMART_QUOTE_MAP))

    # Optional inputs are ABSENT (AttributeError), not None — always getattr.
    tag = getattr(inputs, "connection_secret_tag", None)
    if tag:
        if tag not in document:
            raise ValueError(
                f"Example Plugin error: bad_tag — tag {tag!r} is not in the connection secret."
            )
        document = document[tag]

    missing = [k for k in REQUIRED_KEYS if k not in document]
    if missing:
        raise ValueError(
            f"Example Plugin error: bad_secret — missing key(s): {', '.join(missing)}"
        )
    return document


def connect_with_retry(conn_info, database):
    """One retry on a transient connect failure, sized well inside the 30s budget."""
    for attempt in (1, 2):
        try:
            return psycopg.connect(
                host=conn_info["host"],
                port=conn_info["port"],
                dbname=database,
                user=conn_info["user_name"],
                password=conn_info["password"],
                row_factory=dict_row,
                connect_timeout=10,
            )
        except psycopg.OperationalError as exc:
            if attempt == 2:
                raise ValueError(
                    f"Example Plugin error: connect_failed — could not reach the database "
                    f"({exc}). Check the connection secret and network access."
                )
            outputs.log(f"Connect attempt {attempt} failed ({exc}); retrying once.")
            time.sleep(2)


connection_info = load_connection()
query = inputs.query                          # required inputs are guaranteed present

# Guardrail: reject obvious write statements before opening a connection. The session
# is also forced read-only below. Neither is a security boundary — the query text runs
# verbatim, so this step is by construction an arbitrary-SELECT surface; restrict the
# database user's grants.
if re.match(WRITE_STATEMENT, query, re.IGNORECASE):
    raise ValueError(
        "Example Plugin error: write_rejected — write statements are not allowed here. "
        "Use the Write Data step."
    )

outputs.log(f"Connecting to {connection_info['host']}:{connection_info['port']}/{inputs.database}")

try:
    with connect_with_retry(connection_info, inputs.database) as connection:
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
                        "Example Plugin error: shape_mismatch — Return Single Value is on, "
                        f"but the query returned {len(rows)} row(s) and "
                        f"{len(rows[0]) if rows else 0} column(s)."
                    )
                outputs.result = str(next(iter(rows[0].values())))
            else:
                outputs.log(f"Query returned {len(rows)} row(s).")
                # A string output cannot express structure: multi-row results are the
                # stringified list of dicts, and downstream steps must parse it. Prefer
                # return_single_value or an aggregating query when feeding another step.
                outputs.result = str(rows)

except psycopg.Error as exc:
    raise ValueError(f"Example Plugin error: database_error — {exc}")
```

### `src/automationSteps/dbWrite/config.json`

```json
{
  "name": "Write Data",
  "api_name": "db_write",
  "plugin_description": "Example database connector.",
  "action_description": "Runs a write statement (INSERT/UPDATE/DELETE) against the configured database and commits it. This step is privileged and has no guardrail — the statement runs verbatim as the configured database user. Outputs the affected row count.",
  "action_type": "example_plugin_db_write",
  "runtime": "python-3-13",
  "secrets": ["connection_json"],
  "inputs": [
    { "name": "database", "label": "Database", "data_type": "string", "required": true, "input_source": "static_value", "script_alias": "database" },
    { "name": "statement", "label": "Statement", "data_type": "string", "required": true, "input_source": "variable", "script_alias": "statement" },
    { "name": "connection_secret_tag", "label": "Connection Secret Tag", "data_type": "string", "required": false, "input_source": "static_value", "script_alias": "connection_secret_tag" }
  ],
  "outputs": [
    { "name": "rows_affected", "label": "Rows Affected", "data_type": "number", "required": false, "input_source": "variable", "script_alias": "rows_affected", "conflict_resolution": "overwrite", "create_field_options": false }
  ]
}
```

### `src/automationSteps/dbWrite/script.py`

Steps are isolated units — there are no shared modules, so `load_connection`,
`connect_with_retry`, and `SMART_QUOTE_MAP` are **copied verbatim** from the read step. That
duplication is the correct pattern, not a smell.

```python
# Example Plugin · Agentic Workflow Step · Write Data
#
# Privileged: the statement runs verbatim. The split into a guarded read step and an
# unguarded write step is deliberate — the action_description says so, and the real
# control is the database user's grants.

import json
import time

import psycopg

# ... load_connection(), connect_with_retry(), SMART_QUOTE_MAP: copied from dbRead ...

connection_info = load_connection()

try:
    with connect_with_retry(connection_info, inputs.database) as connection:
        with connection.cursor() as cursor:
            cursor.execute(inputs.statement)
            outputs.rows_affected = cursor.rowcount
        connection.commit()
except psycopg.Error as exc:
    raise ValueError(f"Example Plugin error: database_error — {exc}")

outputs.log(f"Statement affected {outputs.rows_affected} row(s).")
```

### Failure and retry doctrine

- **Raising is how a step fails** — no outputs are written (all-or-nothing), and the message
  lands in the workflow's run history as user-facing text. Prefix with the plugin and a code:
  `"Example Plugin error: {code} — {what to do}"`.
- **Budget the whole step, sleeps included.** Retries sleep from the same budget the query needs —
  a 55-second hard ceiling, which is why the design target is 30. Cap any retry wait well below it
  and fail fast with an actionable message.
  For HTTP-based steps the equivalent is the budget-aware `Retry-After` retry in
  [07-automation-steps.md](07-automation-steps.md#rate-limits-and-retries).
- **Always pass explicit timeouts** (`connect_timeout=10` above; `timeout=` on every `requests`
  call) — a hung connection otherwise burns the budget and dies with no usable error.

### What can go wrong

- Absent optional inputs, wrong `data_type` names, namespaced secret keys, stringified outputs,
  renamed step api_names breaking saved workflows:
  [17-gotchas.md — Agentic Workflow steps & actions](17-gotchas.md#agentic-workflow-steps--actions);
  full contract in [07-automation-steps.md](07-automation-steps.md#gotchas).
- Empty secrets at install, smart quotes, the two-underscore namespacing:
  [17-gotchas.md — Services, auth & secrets](17-gotchas.md#services-auth--secrets).

---

## Recipe 4 — Block + modal wizard

A dashboard block that launches a frameless multi-step wizard in a modal, collects form input
across steps, creates a record, and repaints itself with the result. Demonstrates block → modal
orchestration, the one-modal-slot repaint pattern, the array-wrapped form round-trip, and
sequential modal chaining.

Owning references: [10-views-modals-forms.md](10-views-modals-forms.md) (modals, forms,
wizard pattern) · [09-blocks.md](09-blocks.md) (block orchestration).

### Directory tree

```
plugin-example/
└── src/
    ├── blocks/signupLauncher/
    │   ├── config.json
    │   ├── script.js
    │   ├── eventScripts/
    │   │   ├── render.js
    │   │   └── launch.js             # opens the wizard, awaits the result
    │   └── styles.css                # card chrome as in Recipe 1 (omitted here)
    └── views/signupwizard/
        ├── config.json
        ├── script.js
        ├── eventScripts/
        │   ├── step1.js
        │   ├── step2.js
        │   ├── finish.js
        │   └── cancel.js
        └── styles.css
```

Views live under `src/views/` and are reachable only through `showViewInModal` — they share one
routable-pages collection with `src/pages/`, so `api_name`s must be unique across both.

### Why one view, not a modal stack

The host has exactly **one** app-global modal slot with a FIFO queue. `await`ing a second modal
while the first is still open deadlocks (B queues behind A; A's script is waiting on B). So a
multi-step UI is **one frameless view that repaints itself** — steps are event scripts, and
accumulated state rides forward as hidden inputs.

### `src/views/signupwizard/config.json`

```json
{ "name": "Signup Wizard", "api_name": "signupwizard" }
```

Set the view's `api_name` explicitly — `showViewInModal` must match it exactly, and the
directory-name fallback lowercases, collapsing camelCase (underscores are preserved).

### `src/views/signupwizard/script.js`

```js
this.outputUI(`<div class="wiz"><p>Loading…</p></div>`);
this.runEventScript("step1");
```

### `src/views/signupwizard/eventScripts/step1.js`

```js
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Repainted by "Back" with prior values on this.args.formData; empty on first paint.
// Every collected form value is ARRAY-WRAPPED (FormData.getAll semantics) — index [0]
// for single-value fields.
const prior = this.args.formData ?? {};
const name = prior["contact-name"]?.[0] ?? "";
const email = prior["contact-email"]?.[0] ?? "";

// Field names must never be bare DOM-property words ("name", "title", "action", …) —
// DOMPurify's clobbering protection silently strips them. Hyphenate.
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

A real `type="submit"` button drives the `data-script` submit, so native constraint validation
(`required`, `type="email"`) runs before the event script fires.

### `src/views/signupwizard/eventScripts/step2.js`

The clicked submit button's own `name`/`value` is never captured — you cannot encode "which
button" on the submitter. Back is therefore **its own `<form data-script>`** carrying the same
hidden inputs; a bare button click would lose all state:

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

One DOMPurify caveat: a `value` attribute whose decoded content contains a complete tag is
stripped even when escaped — carry tag-tolerant free text through `sessionData`, not hidden
inputs.

### `src/views/signupwizard/eventScripts/finish.js`

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

// closeModal resolves the opener's showViewInModal promise with these values.
this.closeModal({ recordId: String(created.id) }, false);
```

### `src/views/signupwizard/eventScripts/cancel.js`

```js
this.closeModal(undefined, true);
```

### `src/blocks/signupLauncher/eventScripts/launch.js` — the orchestrating block

```js
const result = await this.showViewInModal("signupwizard", {
  options: { frameless: true, size: "medium" },     // 900px; frameless = the view owns all chrome
});

if (result.canceled) {
  this.runEventScript("render", { reason: "canceled" });
  return;
}

// Frameless views resolve with exactly what they passed to closeModal — not formData.
this.setSessionData({ lastSignupId: result.values.recordId });
this.showToast(`Signup ${result.values.recordId} created.`, { variant: "success" });

// Sequential chaining is fine — the first modal has closed. Args must nest under
// config.args (top-level keys beside options are silently dropped), and passed args
// REPLACE the view's injected business config: forward this.config by hand if the
// view needs it.
await this.showViewInModal("summaryview", {
  args: { config: this.config, recordId: result.values.recordId },
  options: { title: "What you created", confirmButton: { label: "Done" }, size: "small" },
});

this.runEventScript("render", { reason: "created" });
```

(`script.js` and `render.js` follow Recipe 1's shell + single-painter shape, with a
`data-script="launch"` button on the card; `config.json` follows Recipe 1 with
`"api_name": "signup_launcher"`. `summaryview` is a second declared view — a plain
`src/views/summaryview/script.js` that paints `this.args.recordId` — omitted from the tree for
brevity.)

### The value conventions, side by side

| API | Result shape |
|---|---|
| `showViewInModal` (framed confirm, or `data-script` form submit) | **Array-wrapped** (`FormData.getAll` semantics): `values.formData["contact-name"]?.[0]?.trim()`; an empty-but-present text input is `[""]`, which is **truthy**; unchecked checkbox groups are absent entirely. Prefer joining multi-value fields — `(formData.channels ?? []).join(", ")` — over indexing `[0]`, which silently drops the rest |
| `showViewInModal` (frameless) | Verbatim: whatever the view passed to `closeModal(values, canceled)` |
| `dynamicPrompt` | **Plain scalars**: `values.name` is a string; a select is the whole `{label, value}` option object |

Mixing these up is a silent `undefined`. For a form of one or two fields, skip the view entirely
and use [`this.dynamicPrompt`](10-views-modals-forms.md#thisdynamicpromptconfig).

### What can go wrong

- Dropped top-level args, wiped `this.config`, modal deadlock, the missing submitter button,
  DOMPurify name-clobbering, array-vs-plain value confusion:
  [17-gotchas.md — Modals, prompts & forms](17-gotchas.md#modals-prompts--forms); full contract
  in [10-views-modals-forms.md](10-views-modals-forms.md#gotchas).
- Sanitization surprises in painted markup:
  [17-gotchas.md — UI output & sanitization](17-gotchas.md#ui-output--sanitization).

---

## Recipe 5 — Calendar source

Feeds an external provider's calendars and events into the Kizen calendar through a user-level
OAuth service. Two data scripts return schema-validated arrays; times are epoch milliseconds;
all-day events are parsed DST-safely; every failure degrades to an empty array.

Owning reference:
[12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md#calendar-sources).
Service declaration: [06-auth-secrets-services.md](06-auth-secrets-services.md).

### Directory tree

```
plugin-example/
├── kizen.json                        # + services[] (user-level OAuth, as in Recipe 2)
└── src/
    └── calendarSources/personal/
        ├── config.json
        ├── calendars.js              # → calendars_script
        └── events.js                 # → events_script
```

The service is Recipe 2's `provider_user` declaration with calendar scopes
(`"scopes": "calendar.read"`). **`auth_level: "user"` is the right level** — each employee's own
account backs their calendars. Token storage and refresh are entirely proxy-side; there is no
token code to write.

### `src/calendarSources/personal/config.json`

```json
{
  "name": "Example Calendar",
  "api_name": "personal",
  "when": "Boolean({{userConfig.enableExternalCalendars}})"
}
```

Gating `when` on a `{{userConfig.*}}` toggle lets each employee opt in from the user setup
assistant. A falsy `when` makes the source silently disappear from the calendar UI.

### The calendar-source worker is data-only

Both scripts run headless. `showViewInModal`, `closeModal`, `openCreateRecordModal`,
`refreshEntity`, `uploadFile`, and `installThirdPartyScript` **throw at call time** in this
context. HTTP helpers, `getServiceUrl`, `console`, and the date helpers all work normally.
Each script must end with a **top-level `return`** of its array — the return value *is* the
data, and a non-array return is discarded.

### `src/calendarSources/personal/calendars.js`

```js
// Lists the calendars the current user can enable in the Kizen calendar picker.
// Required per calendar: { id, name }. Optional: { description?, default? }.

// Per-user filtering from the user setup assistant. Multi-select config values are
// {label, value} option objects — map .value.
const allCalendarsEnabled = this.userConfig.enableAllCalendars ?? true;
const enabledIds =
  this.userConfig.enabledUserCalendars?.map((option) => option.value) || [];

const [data, error] = await this.getWithErrors(
  this.getServiceUrl("provider_user", "/v1/calendars"),
);

// Degrade, never throw: a thrown error is triaged as a PLATFORM problem, while [] is
// simply "no calendars". A proxy 503 additionally marks the source as needing
// re-authorization — the engine classifies it as an auth error, not a data failure.
if (error) {
  const message =
    typeof error === "string" ? error : (error?.message ?? JSON.stringify(error));
  this.console.error(`Example Calendar: failed to list calendars: ${message}`);
  return [];
}

// Validate the external response at the boundary.
if (!Array.isArray(data?.calendars)) {
  this.console.error(
    `Example Calendar: unexpected calendars response shape ${JSON.stringify(data)}`,
  );
  return [];
}

return data.calendars
  .map((calendar) => ({
    id: calendar.id,
    name: calendar.display_name,
    description: calendar.description,
    default: calendar.is_primary || false,      // pre-selects in the picker
  }))
  .filter((calendar) => allCalendarsEnabled || enabledIds.includes(calendar.id));
```

### `src/calendarSources/personal/events.js`

Called once per (enabled calendar, visible date range) pair. `this.args.calendar` carries
`{ calendar_id, range_start, range_end }` — the range bounds are RFC 3339 strings with the
requesting user's UTC offset. **Pass them upstream verbatim (URL-encoded); never reparse or
reformat them.**

Event `start_time`/`end_time` must be **epoch-millisecond numbers** — an ISO string fails
schema validation. `this.formatDateForResponse(date)` is the sanctioned converter (it is
exactly `date.getTime()`).

```js
// Provider event shape assumed here: { id, subject, body_preview, web_url, is_all_day,
// start: { date? | date_time? }, end: { date? | date_time? }, show_as, ical_uid }.
// Adjust the field mapping to your vendor.

const { calendar_id, range_start, range_end } = this.args.calendar;

// All-day events carry a bare date; timed events carry a date_time with its own offset.
const isAllDayEvent = (event) =>
  Boolean(event.is_all_day || (event.start?.date && !event.start?.date_time));

// DST discipline: parse all-day DATES with this.createDateObject("YYYY-MM-DD") — it
// builds a LOCAL-midnight Date, so a DST boundary can never shift the day. Parse timed
// events with new Date(date_time); the timestamp carries its own offset. Never
// hand-assemble a timestamp without an offset.
const parseEventBounds = (event) => {
  try {
    if (isAllDayEvent(event)) {
      return {
        startDate: this.createDateObject(event.start.date),
        endDate: this.createDateObject(event.end.date),
      };
    }
    return {
      startDate: new Date(event.start.date_time),
      endDate: new Date(event.end.date_time),
    };
  } catch (ex) {
    // Drop one unparseable event (logged) rather than failing the whole list.
    this.console.warn(`Example Calendar: skipping event ${event.id} — bad start/end`, event);
    return {};
  }
};

// Page through results — a busy calendar exceeds one page, and unpaged results
// silently drop events.
const events = [];
let pageToken = "";

do {
  const query =
    `from=${encodeURIComponent(range_start)}&to=${encodeURIComponent(range_end)}` +
    (pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : "");

  const [data, error] = await this.getWithErrors(
    this.getServiceUrl(
      "provider_user",
      `/v1/calendars/${encodeURIComponent(calendar_id)}/events?${query}`,
    ),
  );

  // Degrade to "no events" on any failure (a proxy 503 also flags the source
  // as unauthorized — see the doctrine in calendars.js).
  if (error) {
    const message =
      typeof error === "string" ? error : (error?.message ?? JSON.stringify(error));
    this.console.error(
      `Example Calendar: failed to list events for ${calendar_id}: ${message}`,
    );
    return [];
  }

  if (!Array.isArray(data?.events)) {
    this.console.error(
      `Example Calendar: unexpected events response shape ${JSON.stringify(data)}`,
    );
    return [];
  }

  events.push(...data.events);
  pageToken = data.next_page_token || "";
} while (pageToken);

return events
  .map((event) => {
    const { startDate, endDate } = parseEventBounds(event);
    if (!startDate || !endDate) {
      return null;
    }

    // Events Kizen itself synced into the provider carry an iCalUID of the form
    // "{activityId}--…". Populate activity_id so the Kizen calendar links the event
    // back to its activity instead of showing a duplicate.
    const activityId = event.ical_uid?.includes("--")
      ? event.ical_uid.split("--")[0]
      : undefined;

    return {
      id: event.id,                                   // required
      calendar_id,                                    // required — echo the arg
      title: event.subject,                           // required
      start_time: this.formatDateForResponse(startDate),  // required — epoch ms
      end_time: this.formatDateForResponse(endDate),       // required — epoch ms
      description: event.body_preview,
      url: event.web_url,
      activity_id: activityId,
      all_day: isAllDayEvent(event),
      busy: event.show_as !== "free",                 // map your vendor's free/busy model
    };
  })
  .filter((event) => event !== null);
```

### What can go wrong

- ISO strings where epoch ms is required, missing top-level `return`, throwing instead of
  degrading, UI methods that throw at call time, all-day/DST day shifts, unpaged event drops:
  [17-gotchas.md — Calendar sources](17-gotchas.md#calendar-sources); full contract in
  [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md#gotchas).
- 503 = disconnected OAuth (per-employee for user-level services):
  [17-gotchas.md — Services, auth & secrets](17-gotchas.md#services-auth--secrets).

---

## Recipe 6 — Record action with write-back

A JavaScript action in a record's action menu: it prompts the user, writes the result back to
the record with both field write shapes (`value` overwrite and `add_values` append), and
repaints the page. Ends with the create-override variant — the same action wired to replace an
object's native "Add Record" form.

Owning reference: [08-actions.md](08-actions.md). Prompt semantics:
[10-views-modals-forms.md](10-views-modals-forms.md#thisdynamicpromptconfig).

### Directory tree

```
plugin-example/
└── src/
    └── actions/logOutcome/
        ├── config.json
        └── script.js
```

Actions have no `eventScripts/` and no `styles.css` — interactive markup belongs in a view
opened with `showViewInModal`.

### `src/actions/logOutcome/config.json`

```json
{
  "name": "Log Outcome",
  "api_name": "log_outcome",
  "hint_object_name": "client_client"
}
```

That is the whole config. **Where the action appears is install-time association, not
manifest**: publishing creates a template; a business associates it with an object (via the
marketplace Setup Assistant's action-mapping step or the association endpoint), and the
association carries placement options like `include_perform_action`. Nothing in `kizen.json`
can claim a surface. `hint_object_name` only pre-selects the object during association.

### `src/actions/logOutcome/script.js`

```js
// Example Plugin · Action · Log Outcome
//
// Prompts for an outcome, overwrites the record's `latest_outcome` field, appends a
// stamped copy to the multi-value `outcome_history` field, and repaints the page.
// Expected failures get a sticky failure toast and a return — never a throw, which
// would route to platform monitoring and show the user nothing.

// Normalize a *WithErrors error so a toast never shows "[object Object]".
const describeError = (error) =>
  typeof error === "string"
    ? error
    : (error?.message ?? (error ? JSON.stringify(error) : null));

const entity = await this.currentEntity();
if (!entity) {
  this.showToast("No record context available.", { variant: "failure", autohide: false });
  return;
}

const result = await this.dynamicPrompt({
  title: "Log Outcome",
  size: "small",
  confirmButton: { label: "Save", variant: "standard", color: "primary" },
  cancelButton: { label: "Cancel", variant: "text", color: "secondary" },
  content: [
    {
      type: "select",
      key: "outcome",
      label: "Outcome",
      required: true,
      widthPercent: 100,
      options: [
        { label: "Connected", value: "connected" },
        { label: "Left voicemail", value: "voicemail" },
        { label: "No answer", value: "no_answer" },
      ],
    },
    { type: "text", key: "note", label: "Note", widthPercent: 100 },
  ],
});

// Always guard canceled before touching values.
if (result.canceled) return;

// dynamicPrompt values are PLAIN (not array-wrapped): a text field is a string, and a
// select resolves to the whole {label, value} option object — read .value.
const outcome = result.values.outcome.value;
const note = (result.values.note ?? "").trim();

const stamped = `${new Date().toISOString()} — ${outcome}${note ? `: ${note}` : ""}`;

const [, patchError] = await this.patchWithErrors(
  `/records/${this.objectId}/${this.entityId}`,
  {
    fields: [
      // Overwrite: replaces whatever latest_outcome currently holds.
      { name: "latest_outcome", value: outcome },
      // Append: adds to the multi-value field without removing existing values.
      { name: "outcome_history", add_values: [stamped] },
    ],
  },
);

if (patchError) {
  this.console.log(
    `Log Outcome — write failed for record ${this.entityId}`,
    "error:", describeError(patchError),
  );
  this.showToast(`Could not save the outcome: ${describeError(patchError)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}

this.showToast("Outcome logged.", { variant: "success" });

// A write does not repaint anything. This is the line people forget — skipping it is
// why an action "didn't work" when it actually did.
this.refreshEntity();
```

Notes on the contract:

- The `fields` array names fields by api `name` (or `id`); each entry carries **one** of
  `value` (overwrite) or `add_values` (append to a multi-value field).
- The return value of a menu-invoked action is **discarded**; the host also guards re-entry
  while a run is pending, so no busy flag is needed.
- Never hardcode the plugin api_name — preview builds publish under a suffixed name; use
  `this.pluginApiName` wherever the name is needed.

### Variant — the same action as a create override

An object can hand its "+ Add Record" flow to a plugin action. The differences are small:

1. **Wiring (install-time, two rows).** The action template must be *associated* with the
   object, **and** the object's `action_override_create` setting must hold the composite key
   `"{plugin_api_name}.{action_api_name}"` (e.g. `example_plugin.log_outcome`). Neither is a
   manifest field; missing the association makes the override **silently inert** — "+ Add"
   falls back to the native form with no error anywhere.
2. **Return contract.** The script must resolve with the created record's id as a **non-empty
   string** — `return String(created.id);`. A number, `undefined`, or a bare `return` makes the
   host no-op silently (which is also the correct response on failure or cancel).
3. **Context shift.** In a relationship-add override, `this.objectId` is the **related**
   object's id — the object the new record is created on, not the page's object.

Because a plain action's return value is discarded, one script can serve both roles: create the
record, `this.refreshEntity()`, and end with `return String(created.id)` — the menu drops the
id, the override uses it to link the record. Full mechanics, the three response modes
(custom / native modal / native pre-linked), and the no-clobber wiring pattern:
[08-actions.md](08-actions.md#create-override-replacing-the-native-add-record-form).

### What can go wrong

- Publishing ≠ associating, silent create-override no-ops, `String(id)` coercion, stale
  `this.config`, `refreshEntity` omissions, dynamicPrompt vs formData value shapes:
  [17-gotchas.md — Agentic Workflow steps & actions](17-gotchas.md#agentic-workflow-steps--actions);
  full contract in [08-actions.md](08-actions.md#gotchas).
- Prompt/modal traps (canceled guard, option objects, one modal slot):
  [17-gotchas.md — Modals, prompts & forms](17-gotchas.md#modals-prompts--forms).

---

## Gotchas

Each recipe carries its own **What can go wrong** section, immediately after the code, covering
the traps specific to that surface. They are collected here for scanning:

| Recipe | What can go wrong |
|---|---|
| 1 — New plugin skeleton | [Derived api_names, missing thumbnail, version bumps, `.kizenapp/` leaks](#what-can-go-wrong) |
| 2 — OAuth service integration | [Proxy 200-wrapping, 503-means-unauthorized, per-user token scope](#what-can-go-wrong-1) |
| 3 — Database-connector Agentic Workflow step | [Execution budget, secret validation, explicit timeouts](#what-can-go-wrong-2) |
| 4 — Block + modal wizard | [formData array-wrapping, one modal slot, canceled guards](#what-can-go-wrong-3) |
| 5 — Calendar source | [Epoch-ms times, local-midnight all-day dates, degrade-don't-throw](#what-can-go-wrong-4) |
| 6 — Record action with write-back | [Publishing ≠ associating, `String(id)` coercion, stale `this.config`](#what-can-go-wrong-5) |

The cross-cutting trap list — every surface, grouped by topic — is
[17-gotchas.md](17-gotchas.md). Read the relevant section there before and after building
anything; these per-recipe notes are the subset that bites in the specific shape shown above.
