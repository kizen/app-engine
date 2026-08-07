# Auth, Secrets, and External Services

What this covers: every way a plugin reaches a system outside Kizen and every way it holds a
credential — the `services` array in `kizen.json`, the server-side generic proxy (`getServiceUrl` →
`/external-integrations/proxy/...`), business-level integration secrets, encrypted manifest
secrets produced by `npx --yes @kizenapps/cli encrypt`, direct external calls with no declared service, and the
OAuth callback. The governing rule: **plugin code never holds a service credential.** Tokens and
stored secrets are injected server-side by the proxy; script code sees only URLs.

See also: [manifest reference](03-manifest-reference.md) for where `services` sits in `kizen.json`,
[worker runtime API](04-worker-runtime-api.md#thisgetserviceurlservicename-path) for the `this.*`
method signatures, [platform API](05-platform-api.md) for Kizen REST shapes and the
integration-secrets endpoints, [Agentic Workflow steps](07-automation-steps.md) for the Python
`secrets` / `kizen.api` runtime, [release and publish](16-release-and-publish.md) for what publish
validates.

---

## 1. Services in `kizen.json`

### The `services` array

`services` is a top-level array of service declarations in `kizen.json`. Each entry defines one
external host + one auth strategy, and becomes one addressable segment of the proxy URL. The
packager passes the array through untyped (it is `Record<string, unknown>[]`), so **nothing
validates a service declaration locally** — mistakes surface at publish time (server-side
`validate_services`) or at the first proxy call.

```json
{
  "api_name": "example_plugin",
  "name": "Example Plugin",
  "version": "1.4.0",
  "engine": "1.0.0",
  "entry": "src",
  "base_config": { "secrets": ["api_key"] },
  "services": [
    { "service_name": "public_api", "auth_type": "no_auth", "base_service_url": "https://api.example.com" }
  ]
}
```

Common fields across every `auth_type`:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `service_name` | string | yes | API identity. Becomes the `{service_name}` segment of the proxy URL. Use `snake_case`. |
| `display_name` | string | recommended | Human label shown in install/marketplace UI and OAuth connect screens. |
| `auth_type` | enum | yes | One of `no_auth`, `basic_auth_token_provided`, `basic_auth_token_exchange`, `password_token_exchange`, `oauth`, `private_key_jwt`. |
| `auth_level` | `"global" \| "business" \| "user"` | for credentialed types | Who the credential belongs to. See below. |
| `scope` | `"user-account-only" \| "service-account-only"` | no | Restricts which caller identity may use the proxy for this service. Omit to allow both. |
| `required_entitlement` | string \| null | no | Business entitlement key required to call this service through the proxy. |
| `base_service_url` | string (URL) | yes | Upstream origin (and optional path prefix) the proxy appends to. |
| `additional_service_urls` | string[] | no | Extra upstream origins reachable via `?full_domain=`. |
| `auth_credentials` | object | per `auth_type` | Credential material and provider endpoints. Stripped from every client-facing response. |

### Field: `service_name`

The proxy URL is built literally from this value:
`/external-integrations/proxy/{plugin_api_name}/{service_name}/{path}`. Renaming a service in a
new version is a **breaking change** for every script that hardcoded the old name, and it orphans
any OAuth tokens stored under the old name (an upgrade clears events for removed services).

### Field: `auth_level`

| Value | Who holds the credential | Typical use |
|---|---|---|
| `global` | One credential for every business, shipped in the manifest or in a secret. | Vendor-wide API keys, partner credentials owned by the plugin author. |
| `business` | One connection per installed business; an admin authorizes once. | Business-wide integrations driven by agentic workflow steps. |
| `user` | Each employee authorizes their own account. | Surfaces that must act as the signed-in user (calendars, personal mailboxes). |

`business`-level OAuth authorization requires the marketplace-manage permission; `user`-level
authorization requires only an authenticated employee.

### Field: `scope` (caller-identity restriction)

Enforced by the proxy's access policy on every request:

- `service-account-only` — only the plugin's **own** service account may call. This is the
  worker-side lockdown: plugin-packaged Python steps run as that service account and pass; generic
  code steps (which run as the Agentic Workflow service account) and any interactive JS surface get 403.
- `user-account-only` — the inverse: interactive callers pass, service accounts are blocked.
- Omitted — both identities may call.
- Any other string — **denies everything**. There is no "unknown means allow" fallback.

Use `service-account-only` on services that back Agentic Workflow steps holding privileged credentials,
so a browser surface can never be coaxed into proxying through them.

### Field: `required_entitlement` (per service)

A string entitlement key. If set, the proxy access policy rejects the call unless the calling
business holds that entitlement. This is distinct from the **top-level** `required_entitlement` in
`kizen.json`, which gates install and hides the plugin from the marketplace listing for
non-entitled businesses. `null` and `""` are both "no gate".

Per-service entitlements are the supported way to ship environment-specific service pairs — see
[Multi-environment services](#multi-environment-services).

### Field: `base_service_url`

The upstream origin the proxy resolves against. The request path after
`/proxy/{plugin}/{service}/` is appended to it. Include a trailing path segment if the vendor
namespaces its API (`https://api.example.com/v2/`); the proxy concatenates, so be deliberate about
trailing slashes.

`base_service_url` supports `{{secret.KEY}}` templating (see below), which is how per-business
hosts are handled for vendors that give every tenant its own subdomain.

### Field: `additional_service_urls` and the `?full_domain=` query param

A proxy caller may pass `?full_domain=https://other.example.com` to target an alternate host. The
proxy accepts it only when the registrable domain matches `base_service_url` or one of
`additional_service_urls`, and the subdomain passes the service's `sub_domain_regex_validation`.
Anything else is rejected. Use it for vendors with per-tenant subdomains under one registrable
domain; do not use it as a general-purpose URL escape hatch.

### Field: `auth_credentials`

Provider endpoints plus credential material. Two guarantees:

1. **Never returned to a client.** Every serializer that emits a service payload strips
   `auth_credentials` (a safe-field allowlist governs what survives). Browser code and worker code
   cannot read it, by design.
2. **Values may be encrypted envelopes.** Any string value inside `auth_credentials` may be
   replaced with `{"encrypted": true, "value": "<base64>"}` — see
   [Encrypted manifest secrets](#4-encrypted-manifest-secrets).

### `{{secret.KEY}}` templating in service config

Inside `auth_credentials` values and `base_service_url`, the token `{{secret.KEY}}` is replaced
per-request with the value of the business-level integration secret declared as `KEY`. `KEY`
matches `[a-zA-Z0-9_]+` and is the **bare** name as listed in `base_config.secrets` — not the
namespaced runtime name.

```json
{
  "base_config": { "secrets": ["tenant_host", "api_token"] },
  "services": [
    {
      "service_name": "tenant_api",
      "display_name": "Tenant API",
      "auth_type": "no_auth",
      "auth_level": "global",
      "base_service_url": "https://{{secret.tenant_host}}.example.com/api/v1/"
    }
  ]
}
```

Rules:
- Publish rejects the plugin if a `{{secret.KEY}}` token references a secret not listed in
  `base_config.secrets`.
- At request time, an **unresolved** secret (declared but never filled in by an admin) makes the
  proxy return **HTTP 400**. That is the signature of "installed but not configured".

### `auth_type: "no_auth"`

The proxy adds no credential. It forwards the caller's `X-Proxy-Authorization` header verbatim as
the upstream `Authorization` header, and nothing else.

```json
{
  "service_name": "public_api",
  "display_name": "Public API (no auth)",
  "auth_type": "no_auth",
  "required_entitlement": null,
  "base_service_url": "https://api.example.com"
}
```

Two legitimate uses:

1. **Genuinely unauthenticated upstreams** — no header at all.
2. **Script-supplied tokens** — the script obtained a token some other way (a
   `password_token_exchange` companion service, a Python step reading a secret) and passes it:

```js
// JS worker: token minted by a separate auth service, then used against the data service
const [data, err] = await this.getWithErrors(
  this.getServiceUrl("public_api", "/v2/quotes/12345"),
  { headers: { "X-Proxy-Authorization": `Bearer ${sessionToken}` } }
);
```

With `no_auth`, **the credential lives in script memory**. Prefer a credentialed `auth_type` when
one fits; use `no_auth` + `X-Proxy-Authorization` only when the token is short-lived and minted
per-run.

### `auth_type: "basic_auth_token_provided"`

The proxy reads a stored integration secret and emits `Authorization: Basic <secret-value>`. The
script never sees the secret — this is the zero-exposure static-credential shape.

```json
{
  "service_name": "vendor_api",
  "display_name": "Vendor API (static token)",
  "auth_type": "basic_auth_token_provided",
  "auth_level": "global",
  "required_entitlement": null,
  "base_service_url": "https://api.example.com/v1/",
  "auth_credentials": {
    "integration_secret_api_name": "example_plugin__api_key"
  }
}
```

`integration_secret_api_name` must be the **fully namespaced** secret name
(`{plugin_api_name}__{secret_name}`), even though `base_config.secrets` lists the bare name
(`"api_key"`). Getting this wrong is a silent misconfiguration until the first call fails.

The emitted scheme is fixed at `Basic`. **A stored secret sent under a custom scheme
(`Authorization: ApiKey <key>`, or a non-`Authorization` header like `X-Api-Key`) is not
achievable with this auth type today.** If the vendor requires a custom scheme, the options are:
a Python step that reads the secret and calls the vendor with `requests` directly (see
[§5](#5-calling-external-apis-without-a-declared-service)), or a `no_auth` service with the script
supplying `X-Proxy-Authorization`.

> Unverified: some manifests in the wild declare `basic_auth_token_provided` with
> `auth_credentials: { "token-field-name": "x-api-key", "token": "..." }`, apparently intending a
> custom header. This shape is not part of the verified backend contract and is not documented as
> supported. It also commits a live token to the repo in plaintext. Do not copy it.

### `auth_type: "oauth"` with `auth_level: "user"`

Each employee authorizes their own account. The proxy stores one token per (install, service,
employee) and attaches `Authorization: Bearer <token>`, refreshing it server-side when expired.

```json
{
  "service_name": "provider_user",
  "display_name": "Provider (per user)",
  "auth_type": "oauth",
  "auth_level": "user",
  "required_entitlement": null,
  "base_service_url": "https://api.provider.example.com",
  "auth_credentials": {
    "client_id": { "encrypted": true, "value": "<base64 envelope>" },
    "client_secret": { "encrypted": true, "value": "<base64 envelope>" },
    "scopes": "profile.read calendar.read",
    "authorize_url": "https://auth.provider.example.com/oauth2/authorize",
    "token_url": "https://auth.provider.example.com/oauth2/token",
    "content_type": "application/x-www-form-urlencoded",
    "token_field_name": "access_token",
    "default_token_expiry": 3600,
    "authorize_params": { "access_type": "offline", "prompt": "consent" }
  }
}
```

OAuth `auth_credentials` fields:

| Field | Type | Required | Meaning |
|---|---|---|---|
| `client_id` | string \| envelope | yes | OAuth client id. |
| `client_secret` | string \| envelope | yes | OAuth client secret. Encrypt it. |
| `scopes` | string | yes | **Space-separated** scope string, not an array. |
| `authorize_url` | string | yes | Provider's authorization endpoint. |
| `token_url` | string | yes | Provider's token endpoint (used for both exchange and refresh). |
| `content_type` | string | recommended | Content type for the token request, e.g. `application/x-www-form-urlencoded`. |
| `token_field_name` | string | recommended | Field in the token response holding the access token, e.g. `access_token`. |
| `default_token_expiry` | number (seconds) | no | Fallback lifetime when the provider omits `expires_in`. |
| `authorize_params` | object | no | Extra query params merged into the authorize URL. `{"access_type": "offline", "prompt": "consent"}` is what makes providers issue a refresh token. |
| `success_redirect_path` | string | no | Post-callback redirect on success. See the caveat below. |
| `error_redirect_path` | string | no | Post-callback redirect on failure. See the caveat below. |

**Refresh tokens:** if the provider only issues a refresh token when explicitly asked, set it in
`authorize_params`. Without a refresh token, every user re-authorizes when the access token
expires, and the failure mode is a 503 mid-workflow.

**The redirect-path fields are a fallback, not dead config.** The resolver tries three sources in
order and takes the first that validates:

1. the `success_redirect_path` / `error_redirect_path` **query param** on the authorize request;
2. the identically-named field in the manifest's `auth_credentials`;
3. the platform's configured default redirect.

Because every first-party caller passes the query params, the manifest values usually go unused —
but they are the safety net for any authorize request that omits them, which makes them worth
setting for a service users might connect from somewhere you did not write.

One subtlety: a path only "wins" if it passes validation, which accepts a string starting with `/`
and containing no `//`. An **invalid** query param does not error; it falls through to the manifest
value, and then to the default. A redirect that silently lands somewhere unexpected is usually a
malformed path, not a missing one. Pass paths through
[`this.authorize()`](#thisauthorizeservicename-config) for the common case.

### `auth_type: "oauth"` with `auth_level: "business"`

One connection per business, authorized once by an admin. The token is shared by every caller in
that business — including the plugin's service account, which is what makes this the auth level
for Agentic Workflow steps.

```json
{
  "service_name": "provider_business",
  "display_name": "Provider (business-wide)",
  "auth_type": "oauth",
  "auth_level": "business",
  "scope": "service-account-only",
  "required_entitlement": null,
  "base_service_url": "https://api.provider.example.com",
  "auth_credentials": {
    "client_id": { "encrypted": true, "value": "<base64 envelope>" },
    "client_secret": { "encrypted": true, "value": "<base64 envelope>" },
    "scopes": "chat.write files.read",
    "authorize_url": "https://auth.provider.example.com/oauth2/authorize",
    "token_url": "https://auth.provider.example.com/oauth2/token",
    "content_type": "application/x-www-form-urlencoded",
    "token_field_name": "access_token"
  }
}
```

A business-level OAuth service may declare `extra_auth_fields` to collect additional values during
the connect flow. When it does, the platform derives an **implicit extra secret** for the service,
stored under the api_name `{plugin_api_name}__{service_name}_extra_auth`. You do not list it in
`base_config.secrets`; it is added to the plugin's secret set automatically.

`extra_auth_fields` is a **`list[str]`** — plain field *names*, not field descriptor objects:

```json
"auth_credentials": {
  "extra_auth_fields": ["tenant_id", "region"]
}
```

Those names are not read from `auth_credentials` itself. At token time the platform loads the
derived secret, JSON-parses its value, and picks out exactly the listed keys — any name absent from
the stored JSON is skipped rather than sent as null. The selected pairs are merged into the **token
request body**, on both the initial authorization-code exchange and every subsequent refresh.

They are never added to the authorize URL, which is built only from `response_type`, `redirect_uri`,
`state`, `client_id`, `scope`, and `authorize_params`. If a provider needs an extra value at
*authorize* time, `authorize_params` is the field for it — `extra_auth_fields` will not do it.

### Dual user + business OAuth (the two-service pattern)

When a plugin needs both "act as the business" and "act as the signed-in user" against the same
provider, declare **two services** against the same `base_service_url` with different
`auth_level`s, different `scopes`, and usually different `scope` restrictions:

```json
"services": [
  {
    "service_name": "provider_business",
    "display_name": "Provider (business)",
    "auth_type": "oauth",
    "auth_level": "business",
    "scope": "service-account-only",
    "base_service_url": "https://api.provider.example.com",
    "auth_credentials": { "scopes": "meetings.write users.read", "...": "..." }
  },
  {
    "service_name": "provider_user",
    "display_name": "Provider (my account)",
    "auth_type": "oauth",
    "auth_level": "user",
    "scope": "user-account-only",
    "base_service_url": "https://api.provider.example.com",
    "auth_credentials": { "scopes": "calendar.read", "...": "..." }
  }
]
```

Why this split is not optional:

- **Agentic Workflow steps cannot use a `user`-level service.** They execute as the plugin's service
  account, which has no per-employee token. A `user`-level service reached from a step fails
  authorization.
- **Interactive surfaces that must show the employee's own data cannot use a `business`-level
  service** — they would show the admin's connected account to everyone.
- Keep the business service's scope list minimal and admin-appropriate; keep the user service's
  scope list to exactly what the interactive surface reads.

### `auth_type: "password_token_exchange"`

The proxy performs a live username/password exchange against `auth_url` on each call, then applies
the returned token to the upstream request. Use it for partner APIs that issue session tokens from
static credentials.

```json
{
  "service_name": "partner_auth",
  "display_name": "Partner API Auth",
  "auth_type": "password_token_exchange",
  "auth_level": "global",
  "required_entitlement": null,
  "base_service_url": "https://api.partner.example.com/v2/",
  "auth_credentials": {
    "auth_url": "https://api.partner.example.com/v2/authenticate",
    "username": "{{secret.partner_username}}",
    "password": { "encrypted": true, "value": "<base64 envelope>" },
    "content_type": "application/json",
    "payload": {},
    "token_field_name": "token",
    "credential_placement": "body",
    "proxy_request_token_prefix": "raw"
  }
}
```

| Field | Meaning |
|---|---|
| `auth_url` | Endpoint that exchanges credentials for a token. |
| `username` / `password` | Static credentials. Encrypt the password or source it from a secret template. |
| `content_type` | Content type of the exchange request. |
| `payload` | Extra body fields merged into the exchange request. |
| `token_field_name` | Field in the exchange response holding the token. |
| `credential_placement` | Where the credentials go in the exchange request: `body` or `header`. Choosing `header` **requires `auth_request_prefix`** (`basic`, `bearer`, …) — an unrecognized prefix fails the exchange with an "Invalid auth_request_prefix" error rather than falling back. |
| `proxy_request_token_prefix` | How the token is applied upstream: `raw` (bare value), or a scheme prefix such as `bearer` / `basic` / `token`. |

The exchange result is **cached for 60 seconds**, so an expensive `auth_url` costs one round trip
per minute rather than one per request. A failed exchange yields an empty token, which is falsy and
therefore not cached — failures retry immediately instead of sticking for a minute.

Two properties of that cache are worth knowing before you pick this auth type:

- **The cache is scoped per plugin and service, not per business.** This auth type is meant for a
  service whose credentials are genuinely global — one vendor account behind the whole plugin — and
  is the wrong choice for anything per-tenant. If each business must present its own credentials,
  use `oauth` with `auth_level: "business"`, or `private_key_jwt`, both of which cache per business.
- **The 60-second TTL is fixed** and ignores any `expires_in` the provider returns. A token with a
  one-hour lifetime is still re-exchanged every minute.

Pairing an exchange service with a separate `no_auth` data service (script mints the token once,
then sends it as `X-Proxy-Authorization`) trades zero secret exposure for one round trip; both
patterns are in use.

### `auth_type: "basic_auth_token_exchange"` and `auth_type: "private_key_jwt"`

Both exist in the proxy's backend dispatch. `basic_auth_token_exchange` exchanges stored basic
credentials for a token and emits `Authorization: Bearer <token>`. `private_key_jwt` performs a
signed-JWT client assertion flow — the pattern for backend-service integrations where each business
supplies its own private key (store the key as a per-business integration secret; a single shared
key would authenticate every business as the same client, which providers reject).

#### `basic_auth_token_exchange` — `auth_credentials`

| field | required | meaning |
|---|---|---|
| `auth_url` | yes | The token-exchange endpoint. |
| `username` | yes | Basic-auth username for the exchange request. |
| `password` | yes | Basic-auth password. Source it from a secret template. |
| `content_type` | yes | Must be `application/json` or the form content type — other values are rejected at publish. |
| `payload` | yes (may be empty) | Extra body fields merged into the exchange request. The key must be present; `null` is a validation error, so use `{}` rather than omitting it. |
| `token_field_name` | yes | The field in the exchange response that holds the token. |

Five of the six are read with a bare lookup at run time, so a missing key is a hard failure rather
than a default — `payload` is the only one read defensively.

#### `private_key_jwt` — `auth_credentials`

| field | required | default |
|---|---|---|
| `pvt_key` | yes | — Literal `\n` sequences are normalized to real newlines, so a key pasted as a single JSON line works. |
| `alg` | yes | — One of `RS256`, `RS384`, `RS512`, `ES256`, `ES384`, `ES512`. |
| `iss` | yes | — |
| `token_endpoint` | yes | — |
| `sub` | no | falls back to `iss` |
| `aud` | no | falls back to `token_endpoint` |
| `grant_type` | no | `client_credentials` (also accepts the JWT-bearer grant URN) |
| `assertion_lifetime_seconds` | no | `300` |
| `token_field_name` | no | `access_token` |
| `scope` | no | omitted from the token request entirely when unset |
| `kid` | no | added to the JWT header only when truthy |
| `x5c` | no | added to the JWT header only when truthy |
| `extra_claims` | no | `{}`, merged into the JWT claims |
| `extra_payload` | no | `{}`, merged into the token request body |

Only `pvt_key`, `iss`, `token_endpoint` and `alg` are required at publish.

**Token caching differs sharply between the two**, and it matters for multi-tenant plugins.
`private_key_jwt` caches per business — the key includes the business id, and the TTL tracks the
provider's own `expires_in` (minus a 60-second safety margin, floored at 30 seconds). The
`basic_auth_token_exchange` family does not: see the note on the shared 60-second cache under
[`password_token_exchange`](#auth_type-password_token_exchange) above, which inherits the same
implementation.

### Multi-environment services

Three patterns, in decreasing order of preference:

1. **Entitlement-gated service pairs** (recommended). Declare `api_dev` and `api_prod`; put
   `required_entitlement: "example_plugin_env"` on the dev entry. The script picks the segment
   from the entitlement value:

   ```js
   const env = this.currentBusiness?.entitlements?.example_plugin_env || "prod";
   const url = this.getServiceUrl(`api_${env}`, "/v1/resources");
   ```

   The entitlement does double duty: it selects the environment and it prevents non-entitled
   businesses from reaching the non-production host at all.

2. **Entitlement-keyed config map in script.** The script scans `this.currentBusiness.entitlements`
   for a key present in a `CONFIG.ENVIRONMENTS` map. Same idea, more script-side branching.

3. **`connection_secret_tag` inside a JSON secret** — for database connectors and anything else
   where the "environment" is a connection string rather than a host. See
   [§3](#the-connection_secret_tag-input-convention).

Never branch on the application hostname (`applicationPath.includes("staging")`). It couples the
plugin to deployment topology and breaks silently on new environments.

---

## 2. The generic proxy

### `this.getServiceUrl(serviceName, path)`

```ts
getServiceUrl(serviceName: string, path: string): string
```

Returns the **relative** URL `/external-integrations/proxy/{pluginApiName}/{serviceName}{path}`,
where `path` carries its own leading slash. Because the result is relative, the worker's HTTP
helpers route it through the Kizen backend rather than issuing a cross-origin `fetch` — which is
exactly what lets the server inject credentials.

Pass `path` with a leading slash (`"/v1/me"`), the form used throughout these docs. The helper does
insert the separator for you when the path lacks one, so `"v1/me"` resolves identically — but the
leading-slash form is what the reference signature describes, and it reads the same as the vendor's
own API documentation.

```js
const [payload, error] = await this.getWithErrors(
  this.getServiceUrl("vendor_api", "/customers/42")
);
if (error) {
  // An unreachable vendor is an expected outcome, not a plugin defect — tell the user.
  this.showToast("Could not reach the vendor. Try again in a moment.", { variant: "failure" });
  return;
}
```

A proxy call failing is a normal operational condition: the vendor is down, the token expired, the
business never connected. Report it with `showToast` so the user can act. Reserve
[`this.onError`](15-errors-and-observability.md) for defects you want in platform monitoring —
routing every expected vendor failure there buries real bugs in noise and leaves the user staring
at a surface that did nothing.

Full signature and error semantics: [worker runtime API](04-worker-runtime-api.md#thisgetserviceurlservicename-path).

### `ANY /api/external-integrations/proxy/{plugin_api_name}/{service_name}/{path}`

All HTTP verbs. The path remainder is appended to the service's `base_service_url`.

Request handling, in order:

1. **Caller must be authenticated.** The proxy is not an anonymous relay.
2. **Install must exist and be enabled.** A disabled or uninstalled plugin is rejected.
3. **`required_entitlement`** on the service (if set) must be held by the business.
4. **`scope`** must admit the caller identity (see [§1](#field-scope-caller-identity-restriction)).
5. **Auth injection** by `auth_type` — stored token, exchange, or passthrough.
6. **Secret templates** in `auth_credentials` / `base_service_url` are resolved. Unresolved ⇒ 400.

The proxy resolves the plugin as the latest active version within the installed major, so a
minor-version republish changes proxy behavior for existing installs without an explicit upgrade.

### Response envelope

The proxy **always returns HTTP 200** when it succeeded in making the outbound call, with the
upstream response wrapped:

```json
{
  "status_code": 404,
  "response_headers": { "content-type": "application/json" },
  "body": { "error": "not found" }
}
```

HTTP 400 from the proxy itself means the outbound request could not be built (unresolved secret,
bad `full_domain`, malformed service config).

Consequences for script code:

- **Python:** unwrap explicitly — `body = resp.json().get("body") or {}`. `resp.ok` being true
  says nothing about the upstream call.
- **JS workers:** the engine unwraps for you and raises a `KizenRequestError` when the upstream
  status is ≥ 400, carrying `proxyStatus: 200` and the real `upstreamStatus`. Read `upstreamStatus`,
  not `proxyStatus`, when branching on vendor errors. See
  [errors and observability](15-errors-and-observability.md).
- Some vendors return HTTP 200 with an error body (`{"ok": false, ...}`). Neither layer can detect
  that; check the vendor's own success flag.

### Header allowlist

The proxy forwards exactly **two** caller headers upstream:

| Caller header | Becomes upstream |
|---|---|
| `x-proxy-authorization` | `Authorization` |
| `content-type` | `Content-Type` |

Everything else is dropped, and `Accept: application/json` is forced. Practical consequences:

- You cannot negotiate a non-JSON response through the proxy. Vendors that key off `Accept`
  (CSV, XML, `text/plain`) will not honor it. Fetch those payloads outside the proxy, or use a
  vendor query param if one exists.
- Custom vendor headers (`X-Api-Version`, `X-Request-Id`, tenant headers) do not survive. If the
  vendor requires one, the proxy cannot serve that endpoint.
- `X-Proxy-Authorization` is meaningful **only** for `no_auth` services. On credentialed auth types
  the injected credential wins.

### 503 = not connected

A proxy call against an OAuth service with no usable stored token returns **HTTP 503**. Treat it as
"the user or admin has not connected this service," never as a transient outage — do not retry it.

- Calendar-source scripts specifically interpret a 503 from the proxy as an auth error.
- For `auth_level: "user"` services, a proxy call also fails when the calling employee has never
  completed authorization, even though other employees in the business have.

The correct response to a 503 is to surface a connect affordance:

```js
const [data, error] = await this.getWithErrors(this.getServiceUrl("provider_user", "/me"));
if (error?.upstreamStatus === 503 || error?.proxyStatus === 503) {
  this.showToast("Connect your Provider account to continue.", { variant: "failure" });
  this.authorize("provider_user");
  return;
}
```

### `this.authorize(serviceName, config?)`

```ts
authorize(
  serviceName: string,
  config?: { successRedirectPath?: string; errorRedirectPath?: string }
): void
```

Opens the provider's authorize page in a **new browser tab**. It is fire-and-forget and returns
`void` — the script cannot observe whether the user completed, cancelled, or failed the flow. The
host opens
`{appPath}/external-integrations/business-plugin-apps/{identifier}/services/{service_name}/authorize`
with the redirect paths as query params; defaults are `/marketplace/{plugin_api_name}/auth`.

Because the outcome is unobservable:

- Do not `await` it or chain logic on it.
- Re-check connectivity on the next user interaction (a cheap authenticated call to the service,
  503 ⇒ still disconnected) rather than assuming success.
- Setup assistants express the requirement declaratively instead — a service prerequisite step
  blocks progress until the service is connected:

  ```json
  { "services": [{ "api_name": "provider_business", "required": true, "prerequisite": true }] }
  ```

  See [setup assistants](13-setup-assistants.md).

### `GET /api/external-integrations/business-plugin-apps/{identifier}/services/{service_name}/authorize`

Starts the OAuth flow and redirects to the provider. `{identifier}` accepts the install UUID or the
plugin api_name (the engine sends the api_name). Permission: business-level services require the
marketplace-manage permission; user-level services require only an authenticated employee.

### `POST /api/external-integrations/business-plugin-apps/{identifier}/services/{service_name}/logout`

Deletes the stored token for that service. For `auth_level: "user"` this clears the calling
employee's token; for `business` it disconnects the whole business. Same permission split as
`authorize`.

### Tokens are never exposed to plugin code

There is no secrets API and no token API in the engine. Stored OAuth tokens
live server-side only; the proxy's OAuth backend retrieves them, refreshes them under a row lock
when expired, and attaches them to the outbound request. Serializers strip `auth_credentials` from
every service payload returned to a client. **No plugin code path can read an access token, a
refresh token, or a stored service secret.** If your design needs the raw token, the design is
wrong for this platform.

### Token invalidation on publish and upgrade

Each stored OAuth token records a hash of the service's `auth_credentials` at the time it was
issued. When you publish a version that becomes the latest in its major — or when a business
upgrades — tokens whose credential hash no longer matches are invalidated.

What an author observes after republishing with changed service config:

- Change `client_id`, `client_secret`, `token_url`, `scopes`, or any other `auth_credentials`
  value ⇒ **every existing connection for that service is dropped**, business-wide and per-user.
  Every affected business/user must re-authorize. Agentic Workflow steps that ran fine yesterday
  start returning 503.
- Change only `display_name`, `base_service_url`, `scope`, or `required_entitlement` ⇒ tokens
  survive (the hash covers `auth_credentials`).
- Adding a scope counts as a credentials change **and** requires re-consent at the provider
  anyway. Announce scope changes in `releaseNotes/<version>.md`.
- Removing a service from the manifest clears its events on upgrade; the service disappears from
  the install.

Treat any `auth_credentials` edit as a user-visible migration, not a config tweak.

### Python Agentic Workflow steps can use the proxy

Python code steps reach declared services through the injected `kizen` client. There is no
`getServiceUrl` helper in Python — build the path yourself:

```python
BASE = "/external-integrations/proxy/example_plugin/provider_business"

resp = kizen.api.post(
    f"{BASE}/v1/messages",
    headers={"Content-Type": "application/x-www-form-urlencoded"},
    data={"channel": channel_id, "text": message},
)
if resp.status_code == 503:
    raise ValueError("Provider is not connected. Connect it from the plugin's setup assistant.")

envelope = resp.json()
body = envelope.get("body") or {}
if not body.get("ok"):
    raise ValueError(f"Provider rejected the request: {body.get('error')}")
```

`kizen.api` is a pre-authenticated session that already carries the plugin service account's
credentials; it exposes `get/post/patch/put/delete` and returns `requests.Response`-shaped objects.
Because steps run as the **plugin's service account**, a service marked
`scope: "service-account-only"` is reachable from Python and from nowhere else — and a service with
`auth_level: "user"` is *not* reachable from Python at all.

Full step runtime contract: [Agentic Workflow steps](07-automation-steps.md).

---

## 3. Secrets

### Declaring secrets: `base_config.secrets`

```json
{
  "base_config": {
    "secrets": ["api_key", "connection_json"]
  }
}
```

A list of unique, non-empty bare names. This is the complete set of secrets the plugin may use.
Publish validation rejects the package if:

- an Agentic Workflow step's own `secrets` array names something not in `base_config.secrets`;
- a `{{secret.KEY}}` template in `services[]` references something not in `base_config.secrets`.

### Secret storage: `{plugin_api_name}__{secret_name}`

Plugin secrets are ordinary business-level integration secrets. Their api_name is the plugin's
api_name, two underscores, the declared name:

| Declared in manifest | Stored / read as |
|---|---|
| `api_key` in plugin `example_plugin` | `example_plugin__api_key` |
| `connection_json` in plugin `example_plugin` | `example_plugin__connection_json` |

The two-underscore separator is literal and load-bearing. Use the namespaced form in
`auth_credentials.integration_secret_api_name` and when reading `secrets[...]` in Python; use the
bare form in `base_config.secrets`, in a step's `secrets` list, and in `{{secret.KEY}}`.

### Rows are created empty at install, then the enable flow prompts

Installing the plugin runs a setup task that creates one integration-secret row per declared
secret, with an **empty value**, bound to the install.

Values do not stay empty by default. The first-enable flow finishes by looking for this plugin's
integration secrets that are still empty and **chaining an edit modal for each one**, after the
schema import and the setup assistant — so the normal first run is import → assistant → secret 1 →
secret 2 → done. See
[the business install flow](13-setup-assistants.md#111-business-install-flow) for the full
ordering.

Two gaps in that safety net are worth designing around, because both leave a row empty with no
further prompt:

- **The user lacks secret-edit permission.** They get a "someone else must fill these in" modal
  instead of the editors, and the enable completes with the secrets still blank. (A user without
  even view permission always gets that modal, since emptiness cannot be checked.)
- **The secret arrived later, or the value was cleared.** The chain runs on the enable flow, and
  only there. A secret added in a subsequent plugin version, or a value an admin later blanks from
  the Configure panel, produces no new prompt — Configure-panel edits do not re-run the chain. The
  one way back into it is a full disable → re-enable cycle, which fires the chain again.

In both cases the failure surfaces at proxy or step time, long after enable. Until the values are
filled in:

- `basic_auth_token_provided` services send an empty credential and the vendor 401s;
- `{{secret.KEY}}` templates fail to resolve and the proxy returns **400**;
- Python steps read an empty string, not `None`.

Validate secret presence at the top of any step that depends on one, and fail with a message that
names the secret and where to set it.

Uninstalling **does not delete** secret values — rows are detached from the install and survive.
Reinstalling rebinds the existing rows by (business, api_name), so values persist across
uninstall/reinstall cycles. Rotating a compromised credential requires editing or deleting the
secret, not reinstalling the plugin.

### Reading secrets: Python steps only

In a Python Agentic Workflow step, `secrets` is an injected dict keyed by the **namespaced** name:

```python
api_key = secrets["example_plugin__api_key"]
```

If the plugin's api_name varies between environments, match by suffix instead of hardcoding the
prefix:

```python
key = next((k for k in secrets if k.endswith("__api_key")), None)
if key is None:
    raise ValueError("api_key secret is not configured for this plugin.")
api_key = secrets[key]
```

A step only receives the secrets listed in its own `config.json` `secrets` array — declaring a
secret in `base_config.secrets` makes it *exist*, not *visible to every step*.

**JavaScript surfaces cannot read secrets.** There is no secrets API in the engine. A JS worker's
only access to a stored secret is indirect, through a service whose auth type injects it
server-side. If a browser surface appears to need a secret value, the work belongs in a Python step
or behind a service.

### Setting secret values: `/api/integration-secrets`

Admin/tooling surface for filling in values. Requires the manage-integration-secrets permission
(READ to list, WRITE to create/update, REMOVE to delete). Business-scoped; always paginated.

| Field | Type | Direction | Notes |
|---|---|---|---|
| `id` | uuid | read | |
| `value` | string | **write-only** | Never returned by any endpoint. |
| `description` | string | read/write | **Required.** Also the source of a derived `api_name` on create. |
| `obfuscated_value` | string | **read-only** | `first2 + 19 asterisks + last2` when length ≥ 14, otherwise 23 asterisks. |
| `api_name` | string | write on create | Optional on create; derived from `description` if omitted. |
| `business_plugin_app` | object | read-only | Light embed of the owning install. |
| `created` / `updated` / `created_by` / `updated_by` | — | read | |

Safe call shapes (see [platform API](05-platform-api.md#post-apiintegration-secrets) for the full
endpoint reference):

```http
GET /api/integration-secrets?search=example_plugin
```

```http
PUT /api/integration-secrets/{id}
Content-Type: application/json

{ "value": "the-new-secret-value", "description": "Example Plugin API key" }
```

Rules that will bite you:

- **`PATCH` is disabled.** Updates are full `PUT`.
- **Never resend `api_name` on update.** The uniqueness check does not exclude the record being
  updated, so a `PUT` that echoes the record's own `api_name` returns a **500**. Send only the
  fields you are changing plus the required `description`.
- Values are write-only. There is no read-back — you cannot diff, verify, or migrate a value by
  reading it. Only `obfuscated_value` comes back, and it is enough to confirm the first/last two
  characters and nothing more.

### The JSON-document-in-one-secret pattern

For a connection that needs several values (host, port, user, password, warehouse, schema…),
declare **one** secret holding a JSON document rather than one secret per field. Fewer rows for an
admin to fill in, atomic updates, and no partial-configuration state.

```json
{
  "host": "db.example.com",
  "port": 3306,
  "user_name": "kizen_reader",
  "password": "..."
}
```

```python
import json

raw = secrets["example_plugin__connection_json"]
if not raw:
    raise ValueError("connection_json secret is not configured.")
conn = json.loads(raw)

for required in ("host", "port", "user_name", "password"):
    if required not in conn:
        raise ValueError(f"connection secret is missing required key: {required}")
```

Derive anything else you need (a base URL, an account identifier) from the document rather than
adding another secret.

### The `connection_secret_tag` input convention

For plugins that must reach several instances of the same system (production and staging
databases, multiple tenants), nest the JSON document by an author-chosen tag and let the workflow
builder select the tag **per step** via an ordinary optional string input named
`connection_secret_tag`.

```json
{
  "production_db": { "host": "db.example.com",        "port": 3306, "user_name": "...", "password": "..." },
  "staging_db":    { "host": "db-stage.example.com",  "port": 3306, "user_name": "...", "password": "..." }
}
```

Step `config.json`:

```json
{
  "name": "connection_secret_tag",
  "label": "Connection Secret Tag",
  "data_type": "string",
  "required": false,
  "script_alias": "connection_secret_tag"
}
```

Step script:

```python
document = json.loads(raw)

tag = getattr(inputs, "connection_secret_tag", None)
if tag:
    if tag not in document:
        raise ValueError(f"Connection secret tag '{tag}' not found in the connection secret.")
    conn = document[tag]
else:
    # No tag supplied: the document is flat, not nested by environment.
    conn = document
```

**`connection_secret_tag` is a plugin-side convention, not a platform concept.** The server knows
nothing about it — it is a normal step input, and the whole JSON blob is a single integration
secret. Nothing enforces the name; keeping it consistent across your steps is what makes it useful.
Supporting both the flat and nested shapes (as above) lets a single-environment business skip the
nesting entirely.

Because the tag is a step input, it is chosen when the workflow is built — the same step type can
target production in one workflow and staging in another with no second install and no second
secret.

### Normalize smart quotes before parsing JSON secrets

Admins paste connection JSON from documents, chat clients, and word processors, all of which
substitute typographic quotes. `json.loads` rejects them with an opaque parse error that looks like
a plugin bug. Normalize first:

```python
SMART_QUOTE_MAP = str.maketrans({
    "“": '"',  # left double
    "”": '"',  # right double
    "„": '"',  # double low-9
    "‟": '"',  # double high-reversed-9
    "‘": "'",  # left single
    "’": "'",  # right single
    "‛": "'",  # single high-reversed-9
})

document = json.loads(raw.translate(SMART_QUOTE_MAP))
```

Do this in every step that parses a JSON secret. It costs one line and removes the single most
common "the plugin is broken" support report for connector plugins.

---

## 4. Encrypted manifest secrets

Manifests are committed to source control, and some of them are public. Any secret value inside
`kizen.json` should be an **encrypted envelope** rather than plaintext.

### The `encrypt` command

```
npx --yes @kizenapps/cli encrypt [options]

  -a, --api-name <name>     plugin api_name the secret belongs to (defaults to kizen.json in cwd)
  -v, --value <value>       plaintext secret value to encrypt
  -s, --stage <stage>       which encryption keys to use: dev or prod (default: prod)
  -o, --out <path>          also write the encrypted envelope to a file
  -c, --credentials <path>  path to a credentials JSON file
      --remote              encrypt via the hosted encryption service instead of on-machine
```

Envelopes are **per plugin api_name** — an envelope produced for one plugin cannot be decrypted for
another. Run it inside the plugin directory so `api_name` is picked up automatically.

Interactive (TTY) run prompts for the value and copies the envelope to the clipboard:

```
$ npx --yes @kizenapps/cli encrypt
```

Non-interactive run (CI, or piping). **Pipe the secret via stdin rather than `--value`** — `--value`
puts the plaintext in the process list:

```
$ printf %s "$CLIENT_SECRET" | npx --yes @kizenapps/cli encrypt --api-name example_plugin > secret.json
```

`--stage` defaults to `prod`. Pass `--stage dev` only when the plugin is published to a development
environment; an envelope encrypted for the wrong stage will not decrypt at publish time.

### The envelope format

```json
{ "encrypted": true, "value": "<base64 string>" }
```

The object replaces the string it stands in for. Nothing else about the surrounding structure
changes — the publish pipeline decrypts server-side before the value reaches any environment, so
runtime behavior is identical to plaintext.

### Where envelopes go

Any secret-bearing string inside `services[].auth_credentials`:

```json
{
  "service_name": "provider_business",
  "auth_type": "oauth",
  "auth_level": "business",
  "base_service_url": "https://api.provider.example.com",
  "auth_credentials": {
    "client_id": { "encrypted": true, "value": "<base64 envelope from npx --yes @kizenapps/cli encrypt>" },
    "client_secret": { "encrypted": true, "value": "<base64 envelope from npx --yes @kizenapps/cli encrypt>" },
    "scopes": "chat.write files.read",
    "authorize_url": "https://auth.provider.example.com/oauth2/authorize",
    "token_url": "https://auth.provider.example.com/oauth2/token"
  }
}
```

Encrypt `client_secret` always; `client_id` is worth encrypting too when the provider treats it as
semi-sensitive. Encrypt `password` on `password_token_exchange` services. Non-secret fields
(`scopes`, `authorize_url`, `token_url`, `base_service_url`) stay plaintext — encrypting them buys
nothing and makes the manifest unreadable in review.

Envelopes belong in `kizen.json` only. **Do not** put them in step scripts, block configs, or any
artifact `config.json`; nothing decrypts those.

### Plaintext is legacy

Plaintext secret values in `kizen.json` still function — the publish pipeline accepts them. They
are discouraged, and in a public repo they are a live credential leak. Rotate at the provider and
re-encrypt any plaintext secret you inherit; changing the value republishes as an
`auth_credentials` change, which invalidates existing OAuth connections (see
[token invalidation](#token-invalidation-on-publish-and-upgrade)) — plan the rotation accordingly.

### What changing an envelope means

Re-encrypting the *same* plaintext produces a *different* envelope (fresh data key and IV). The
credentials hash is computed over the stored `auth_credentials`, so gratuitously re-encrypting an
unchanged secret still reads as a credentials change and still drops existing connections. Encrypt
once; do not re-run `npx --yes @kizenapps/cli encrypt` as a routine step.

---

## 5. Calling external APIs without a declared service

### Absolute-URL `fetch` from a JS worker

Worker HTTP helpers dispatch on the first character of the URL: a leading `/` goes to the Kizen
backend, anything else is a plain `fetch` from the worker. So an absolute URL bypasses the proxy
entirely.

```js
// Deliberate direct call to a public API — no service declared, no credentials involved.
const [items, error] = await this.getWithErrors("https://api.example.com/v1/top-items");
```

This is appropriate when **all** of the following hold:

- the endpoint needs no credential (or the credential is inherently public);
- the response is JSON;
- the host sends permissive CORS headers — the request originates from the worker, so normal
  browser CORS applies and a missing `Access-Control-Allow-Origin` fails the call;
- you do not need the request to run from a Python step.

Use a declared service instead whenever: a credential is involved, the vendor requires an origin
allowlist, or the same call must work from both a JS surface and a Python step.

### `requests` from a Python step

Python steps have full network access and the `requests` package. Reading a secret and calling the
vendor directly is legitimate — and unavoidable for vendors the proxy cannot serve (custom auth
schemes, non-JSON responses, custom headers).

```python
api_key = secrets["example_plugin__api_key"]

resp = requests.get(
    "https://api.example.com/v1/resources",
    headers={"Authorization": f"ApiKey {api_key}"},
    timeout=10,
)
resp.raise_for_status()
data = resp.json()
```

Do not mix approaches for one host: either the proxy owns the credential for a host, or the step
does. Splitting them means two places to rotate.

### PAT and Bearer patterns

Personal access tokens and long-lived bearer tokens are stored as integration secrets and applied
in a Python step:

```python
resp = requests.post(
    f"https://{conn['account']}.vendor.example.com/api/v2/statements",
    headers={
        "Authorization": f"Bearer {conn['pat']}",
        "X-Vendor-Token-Type": "ACCESS_TOKEN",
        "Content-Type": "application/json",
    },
    json={"statement": query},
    timeout=30,
)
```

Operational notes worth surfacing to the admin who configures the secret, because they generate
most support traffic:

- PATs expire. Many vendors default to a short lifetime (days or weeks) with a longer maximum. A
  silently-expired token looks identical to a misconfigured one — include the vendor's error text
  in the exception you raise.
- Vendor network policies frequently reject the call before auth is even evaluated. When the vendor
  distinguishes them, say so in the error message.
- Tokens are usually shown once at creation. There is no read-back from Kizen either, so a lost
  token means minting a new one at the vendor.

### Presigned URLs and CDN downloads must bypass the proxy

Presigned download URLs carry their credential in the query string and are typically rejected by
CDNs if an `Authorization` header is present — which the proxy would add. Fetch them directly:

```python
import urllib.request

with urllib.request.urlopen(presigned_url, timeout=30) as response:
    payload = response.read()
```

The presigned URL itself usually comes from a proxied API call. Proxy the call that mints the URL;
do not proxy the download.

### Anti-patterns

1. **Hand-rolled OAuth.** Implementing authorize/callback/refresh in plugin code is not supported
   and not possible — plugins have no inbound HTTP surface to receive a callback (see
   [§6](#6-the-oauth-callback)), and there is nowhere to persist a refresh token. Declare an
   `oauth` service.
2. **Plaintext OAuth client secrets in `kizen.json`.** Legacy. Encrypt them ([§4](#4-encrypted-manifest-secrets)).
3. **Vendor tokens committed in `auth_credentials`.** A committed token is a leaked token. Use a
   secret plus `integration_secret_api_name` or `{{secret.KEY}}`.
4. **Packing multiple values into a delimited string secret** (`business:user:key`). Use a JSON
   document ([§3](#the-json-document-in-one-secret-pattern)).
5. **Rebuilding an authenticated Kizen client inside a Python step** with hand-assembled
   `X-BUSINESS-ID` / `X-USER-ID` / `X-API-KEY` headers against a hardcoded host. `kizen.api` is
   injected, pre-authenticated, and environment-correct.
6. **Hardcoded environment switchboards** keyed on hostname. Use per-service entitlements.
7. **Interpolating step input directly into SQL** in a database connector. Inputs arrive verbatim
   from the workflow builder; a read step should at minimum reject write/DDL keywords, and a write
   step should be documented as privileged.

---

## 6. The OAuth callback

### `GET /api/external-integrations/oauth/callback`

The **only** unauthenticated plugin-adjacent route on the platform. It exists so OAuth providers
have a redirect target.

Behavior:

- Accepts only `code`, `state`, `error`, and `error_description` query params.
- Requires a pre-seeded server-side entry keyed by `state`, created when the authorize flow
  started. The entry is **single-use** — it is deleted on consumption, so a replayed callback URL
  does nothing.
- Exchanges the code for tokens, stores them server-side, and issues a 302 redirect to the success
  or error path.
- It cannot deliver a payload to plugin code. There is no body handling and no plugin dispatch.

### Plugins have no other inbound HTTP

There is no plugin webhook route, no plugin-scoped ingest token, and no unauthenticated plugin POST
endpoint. External systems push data into Kizen through the **authenticated** ingestion surfaces —
the agentic-workflow webhook trigger, the Webhook SmartConnector, or records upsert — using ordinary
Kizen credentials, and a workflow or connector then does the plugin-specific work. Full endpoint
contracts: [platform API](05-platform-api.md).

Design implication: a plugin that needs to react to an external event is built as
*external system → authenticated Kizen ingestion → agentic workflow → plugin step*, never as
*external system → plugin*.

---

## Gotchas

- **Nothing validates `services` locally.** The packager passes the array through untyped. A typo in
  `auth_type` or a missing `token_url` surfaces at publish or at the first proxy call.
- **`integration_secret_api_name` takes the namespaced name** (`example_plugin__api_key`) while
  `base_config.secrets` and `{{secret.KEY}}` take the bare name (`api_key`). Mixing them up fails
  silently until a call is made.
- **The two-underscore separator is literal.** `{plugin_api_name}__{secret_name}`, not one
  underscore, not a dot.
- **Secrets are created empty at install; the enable flow prompts once, and only once.** The
  first-enable chain opens an edit modal for each empty secret — but a user without secret-edit
  permission skips the chain, and a secret added in a later version (or a value cleared afterward)
  is never re-prompted. Unfilled secrets then produce a proxy **400** (unresolved `{{secret.KEY}}`)
  or an empty credential and a vendor 401. Validate presence at the top of every step.
- **Uninstall does not delete secret values.** Rows detach and are rebound on reinstall.
  Reinstalling is not a credential reset.
- **`PATCH /api/integration-secrets/{id}` does not exist** — updates are full `PUT`. And **resending
  the record's own `api_name` on that `PUT` returns 500.** Omit `api_name` on update.
- **Secret values are write-only.** No read-back, no diff, no verification beyond
  `obfuscated_value`'s first-two/last-two characters.
- **The proxy always returns 200 when it reached upstream.** Python callers must unwrap
  `resp.json()["body"]` and check the real `status_code`; a vendor 500 arrives as a 200.
- **Proxy 400 ≠ your request was malformed.** It usually means an unresolved secret template or a
  rejected `full_domain`.
- **Proxy 503 = not connected.** Never retry it; prompt for authorization.
- **User-level OAuth is per employee.** One employee connecting does not connect the others; each
  gets their own 503 until they authorize.
- **Only two caller headers survive the proxy** (`x-proxy-authorization`, `content-type`), and
  `Accept: application/json` is forced. Non-JSON responses and custom vendor headers are
  unreachable through the proxy.
- **`X-Proxy-Authorization` only does anything on `no_auth` services** — and it means the credential
  is sitting in script memory.
- **`basic_auth_token_provided` can only emit `Authorization: Basic <value>`.** Custom schemes and
  custom header names are not supported by that auth type.
- **`this.authorize()` is fire-and-forget `void`.** You cannot await it or learn the outcome; poll
  by making a call and checking for 503, or use a setup-assistant prerequisite step.
- **`success_redirect_path` / `error_redirect_path` in the manifest are effectively ignored** —
  query params from the caller take precedence. Pass them to `this.authorize()`.
- **Changing any `auth_credentials` value on publish disconnects every existing connection** for
  that service. Re-encrypting an unchanged secret counts, because the envelope changes.
- **Adding an OAuth scope requires every business and user to re-authorize.** Put it in the release
  notes.
- **Renaming a `service_name` breaks every script that references it** and orphans its stored
  tokens.
- **`auth_level: "user"` services are unreachable from Python steps** (steps run as the plugin
  service account). Ship a paired `business`-level service.
- **An unknown `scope` string denies every caller.** There is no permissive fallback.
- **JS surfaces cannot read secrets at all** — no secrets API exists in the engine. Push
  secret-dependent work into a Python step or behind a service.
- **Smart quotes break JSON secrets.** Normalize `“ ” ‘ ’` before `json.loads`.
- **`connection_secret_tag` is a naming convention, not a platform feature.** Nothing enforces it;
  support both the flat and tag-nested document shapes.
- **Presigned CDN URLs must bypass the proxy** — the injected `Authorization` header gets them
  rejected.
- **Absolute-URL `fetch` from a worker is subject to normal CORS.** A vendor without permissive
  CORS headers is only reachable via a service or a Python step.
- **`npx --yes @kizenapps/cli encrypt --value` leaks the plaintext into the process list.** Pipe it on stdin.
- **`npx --yes @kizenapps/cli encrypt` defaults to `--stage prod`.** An envelope encrypted for the wrong stage
  will not decrypt at publish.
- **Envelopes are bound to one plugin api_name.** They do not transfer between plugins.
