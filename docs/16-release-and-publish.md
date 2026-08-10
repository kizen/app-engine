# Release & Publish

**What this covers.** How a change in a plugin repository becomes an installed version: the
release commit (version bump + release notes), branch and environment targeting, preview
builds, what the automated pipeline does, the publish-side errors you can hit, and how
installs pick up new versions.

**See also:** [Manifest reference](03-manifest-reference.md) ·
[Auth, secrets & services](06-auth-secrets-services.md) ·
[Agentic Workflow steps](07-automation-steps.md) ·
[Gotchas](17-gotchas.md)

---

## 1. The release commit

Every commit that reaches a release branch is a release. There is no separate "publish" step
you run — pushing is publishing. That makes two things mandatory in the same commit as your
code change:

1. **Bump `version` in `kizen.json`.** It must strictly increase against the base branch.
2. **Add `<release_notes_directory>/<version>.md`** describing what changed.

```
example-plugin/
├── kizen.json                 # "version": "1.4.0"
└── releaseNotes/
    ├── 1.3.0.md
    └── 1.4.0.md               # written in the same commit as the bump
```

The version bump is enforced by the automated pull-request check
(`version/not-increased`); the release-notes file is not enforced by any rule, but a version
published without notes shows admins an empty entry in the Marketplace's release history and
produces an empty tagged release. Treat both as required.

### `releaseNotes/<version>.md`

The build looks up the file whose name matches the **current** manifest version inside
`release_notes_directory`. A file named anything else is ignored, and a version with no
matching file publishes with empty notes.

Write for the admin installing or upgrading the plugin, not for your team:

```markdown
# 1.4.0

**Added**
- Dashboard block showing open Example records for the current user.
- Setup assistant field to pick which Example account to sync.

**Changed**
- The sync step now retries rate-limited requests instead of failing the workflow.

**Upgrade notes**
- Re-open App Settings and pick an Example account; the sync step is inactive until you do.
```

Older notes files stay in the repository. The backend serves the full history per plugin,
newest first, so admins can read what changed across the versions they skipped.

### How big a bump?

The rules below are the recommended contract. Only the strict-increase check and the
`api_name` block are enforced today; everything else is discipline that keeps installs from
breaking.

The principle: a change is **breaking** when business-stored state — service authorizations,
integration secret references, wired Agentic Workflow steps, action associations — points at a
resource shape the author can no longer fix on the business's behalf.

| Change | Bump |
|---|---|
| Plugin `api_name` change | Not allowed — hard block |
| Remove a service; change its `auth_type` or credentials; rename it | **major** |
| Add a service | minor |
| Change a service's `base_service_url` | patch |
| Rename a declared secret | **major** |
| Add or remove a declared secret | minor |
| Remove an Agentic Workflow step; remove an input/output; change a parameter's `data_type`; add a required input | **major** |
| Add a step; add an optional input | minor |
| Change a step's runtime or script body | patch |
| Remove or rename a JS action | **major** (associations key on api_name and dangle silently) |
| Add, remove or rename other artifacts | minor |
| Edit an artifact script only | patch |
| Rename a setup-assistant config key, change its type, or add a required field | **major** |
| Add an optional config field, or remove one | minor |
| Add `required_entitlement` | minor |
| Change or remove `required_entitlement` | patch |
| Manifest metadata (`name`, `description`, `external_link`, thumbnail) | patch |

Why major matters mechanically: installs auto-track minor and patch releases within the major
they installed, but a new major sits untouched until an admin explicitly upgrades
([§6](#6-install-and-upgrade-semantics)).

---

## 2. Targeting: branches and environments

Two manifest fields decide where a push lands. Both are optional and both have defaults —
see [manifest reference](03-manifest-reference.md#release_branches).

```json
{
  "release_branches": ["main"],
  "release_environments": ["dev", "prod"]
}
```

**`release_branches`** — pushes to a listed branch produce a real release. Pushes to any other
branch run validation only, and produce a preview build when a pull request is open. Omitted,
it defaults to the repository's default branch.

**`release_environments`** — where the release publishes. Aliases expand:
`prod` → `go` + `fmo`; `dev` → `staging` + `integration`;
`testing` → `e2e-integration` + `e2e-staging`. Each concrete environment is published
independently and reports its own result.

Two constraints the manifest cannot override:

- Publishing into production (`go`, `fmo`) only happens from the repository's default branch.
- Environments are fully isolated. A plugin published to `integration` does not exist in `go`;
  business ids, OAuth registrations and integration secret values are per environment. This is
  why `developer_business_id` takes a per-environment map.

In a multi-plugin manifest, branch filtering is per entry: only entries whose
`release_branches` include the pushed branch are packaged for that push.

---

## 3. Preview builds

Open a pull request from a non-release branch and the pipeline publishes a **preview build**
you can install and exercise before merging.

What the pipeline forces, regardless of your manifest:

| Property | Preview value |
|---|---|
| `version` | `0.0.0` |
| `published` | `false` (never listed in the Marketplace) |
| `api_name` | your api_name plus a suffix derived from the branch name |
| `name` | your name plus a `Preview (<branch>)` suffix |
| Environment filtering | skipped — the preview goes to the manifest's environments regardless of branch |

Consequences worth planning for:

- **`developer_business_id` is required.** Preview builds are auto-installed into that
  business; without the field the preview deploy fails. Use the per-environment object form.
- **The api_name is not yours.** Anything that hardcodes the plugin's api_name — a proxy path
  built by hand, an install-config URL, a create-override key — breaks in previews. Always
  build those from the runtime api_name (`this.pluginApiName`).
- **Do not bump the version per push.** Preview versions are always `0.0.0`; bump once, in the
  commit that will merge.
- **`0.0.0` is delete-and-recreate.** Each preview publish deletes the previous `0.0.0` build
  of that api_name and recreates it. It is a destructive overwrite by design — never point a
  real business at a `0.0.0` build.
- Previews are torn down when the pull request is merged or closed.

The pipeline posts the resulting install locations back on the pull request, one row per
environment.

---

## 4. What the pipeline does

You observe it as a set of checks on each push and, on release branches, as tagged releases.
Behaviorally, per push:

1. **Validate.** The manifest and every artifact `config.json` are validated against the rule
   set in [manifest reference §10](03-manifest-reference.md#10-validation-rules). On a pull
   request this also compares against the base branch: each plugin's `version` must strictly
   increase and no `api_name` may disappear or change. Script bodies are not inspected here —
   malformed scripts fail at runtime, not in validation. `assistant.json` is parsed and
   shape-checked (`manifest/setup-assistant-parse`, `manifest/setup-assistant-shape`), but its
   field content is not.
2. **Build.** JavaScript artifact scripts are minified; Python step scripts are shipped
   verbatim; CSS, HTML and icon assets are inlined (custom icon files become data URIs).
3. **Package.** Manifest defaults are applied, the entry directory is walked, artifacts are
   collected by directory convention, `<release_notes_directory>/<version>.md` is attached,
   and the thumbnail (plus optional `import.kzn`) is prepared for upload. Manifest entries
   whose `release_branches` do not include the pushed branch are dropped.
4. **Decrypt secrets.** Every `{"encrypted": true, "value": ...}` envelope in the manifest is
   decrypted centrally, and the result is reported as its own check so a stale envelope is
   visible before publish. Individual environments never hold decryption keys.
5. **Publish per environment.** Aliases expand to concrete environments; each gets the
   thumbnail and schema bundle uploaded, then the plugin version itself. Each environment
   reports success or failure independently — one environment can fail while others succeed.
6. **Tag a release.** On non-preview deploys a tagged release is created per plugin and
   environment, with the packaged release notes as the body.

A failed check leaves nothing half-published: publishing is per environment and per version,
and a version that fails validation is never sent.

### The local equivalent

`npx --yes @kizenapps/cli build` runs the same packaging locally and writes the result to a gitignored
`.kizenapp/` directory, so you can inspect the exact payload before pushing. Run it before
every release commit. Its rule set can lag the pipeline's by a release, so a clean local build
is a strong signal, not a guarantee.

That lag matters for the setup-assistant `view` key: the six rules that validate a view-based
assistant (`manifest/setup-assistant-view-conflict`, `-view-not-found`, `-shape`, `-parse`,
`-orphaned-field-scripts` and `-disabled-keys-ignored`) require `@kizenapps/packager` 0.5.0, so
a build on an older packager reports none of them. They are listed with their triggers in
[manifest reference §10](03-manifest-reference.md#10-validation-rules).

---

## 5. Publish-side validation you can hit

These failures come from the backend, after a clean build:

| Error | Cause | Fix |
|---|---|---|
| Duplicate version | A non-`0.0.0` version already exists for this plugin. Published versions are immutable — there is no re-publish. | Bump and add a new notes file. |
| `api_name` changed | The `api_name` on the base branch is missing from your branch. | Restore it; publish a new plugin if you truly need a rename. |
| Thumbnail required | No `thumbnail.png` at the first level under `entry`. | Add exactly one PNG at `<entry>/thumbnail.png`. |
| Dev build must be unlisted | `version` is `0.0.0` without `published: false`. | Let the pipeline own `0.0.0`; do not author it. |
| Missing developer business | Preview or `0.0.0` build without `developer_business_id`. | Add the field, per-environment form. |
| Undeclared secret | A step's `secrets` entry, or a `{{secret.KEY}}` token in `services`, is not in `base_config.secrets`. | Declare it in `base_config.secrets`. |
| Service validation failed | A `services` entry's `auth_credentials` do not satisfy its `auth_type`. | See [auth, secrets & services](06-auth-secrets-services.md). |
| Secret decryption failed | An encrypted envelope no longer decrypts under the plugin's current key. | Re-run `npx --yes @kizenapps/cli encrypt` and commit the fresh envelope. |
| Publish not permitted | The publishing business lacks developer-program membership, or this repository is not allow-listed for it. | See [§8](#8-developer-program-requirements). |

Publishing is version-scoped and additive: each publish creates a new version row with fresh
configuration. There is no diff or upsert — the published version wholly describes the plugin
at that version.

---

## 6. Install and upgrade semantics

### Version tracking

A business installs a plugin and its install records an `installed_version`. From then on:

- The install **auto-tracks the latest active minor/patch within the installed major.** Publish
  `1.4.1` and every business on a `1.x` install resolves to it on the next read — no admin
  action, no upgrade prompt.
- **A new major is opt-in.** Publishing `2.0.0` leaves `1.x` installs on `1.x`; an admin must
  explicitly upgrade.
- Configuration is resolved at read time from the currently-resolved version, which is why
  minor/patch republishes reach running Agentic Workflows immediately.

### What a republish changes underneath a business

| Change | Effect on existing installs |
|---|---|
| Edited step script or runtime | Applied on the next run of the step. |
| Removed or renamed Agentic Workflow step | Workflows referencing it hard-fail at run time ("config not found"). |
| Removed a step input that a workflow supplies | Silently ignored; the value is dropped. |
| Added a required step input | Caught when the workflow is validated/saved. |
| Changed a service's OAuth credentials | Stored tokens are invalidated; the install flips to an error state until re-authorization. |
| Changed a service's `base_service_url` | Seamless — the next proxied call uses the new host. |
| Removed a service | Events scoped to that service's resource path are cleared asynchronously. |
| Renamed a config key | Old value is orphaned; `{{config.<newKey>}}` resolves to `null` and gated artifacts silently disappear. |
| Removed a declared secret | The stored secret value persists; nothing reads it. |
| Added a declared secret or service account | Created empty on the next install, upgrade or re-enable. |

Most drift is silent. The pattern to internalize: **removals and renames break quietly,
additions are safe.**

### Enable, disable, uninstall

- **Disable** stops the plugin's artifacts from loading and suspends its service accounts.
  Re-enabling re-runs the install-time setup tasks and unsuspends them.
- **Uninstall** is a soft removal. The business's install row and its stored configuration are
  retained rather than purged, and integration secret values are detached from the install
  first so they survive and are re-bound if the plugin is reinstalled. Admins do not have to
  re-enter credentials after a reinstall.
- Auto-created integration service accounts are removed only on uninstall.

---

## 7. Entitlement gating

A manifest-level `required_entitlement` (see
[manifest reference §4](03-manifest-reference.md#required_entitlement)) restricts the plugin to
businesses that hold a named entitlement:

| Surface | Without the entitlement |
|---|---|
| Marketplace listing | The plugin is filtered out entirely — invisible, not merely uninstallable. |
| Install | Rejected with `400`. |
| Installed-plugin listing and bootstrap | Omitted. |
| Direct retrieval of the install | `404`. |

Release-relevant behavior:

- **Only the latest published version's value is evaluated.** Publishing a newer version that
  drops the gate makes the plugin visible to every business immediately. Publishing an *older*
  version with a gate changes nothing.
- **Revocation performs a full uninstall** of the affected business's install, asynchronously —
  OAuth tokens and event records are cleaned up. Restoring the entitlement later does not
  restore the install; the business must reinstall.
- Adding a gate to a published plugin is a minor bump; changing or removing it is a patch.

Per-service `required_entitlement` is a different, narrower mechanism: it gates only proxy
calls to that one service, leaving the rest of the plugin installed and working. Use it for
optional integrations behind a paid add-on.

---

## 8. Developer-program requirements

Publishing at all — including preview builds — requires the publishing business to be enrolled
in the developer program and authorized for the repository the push came from; a publish from an
unauthorized repository is rejected.

For your own plugin's *installers*, the analogous author-side control is
`required_entitlement: "developer_program_member"` in the manifest, which restricts installs
of the plugin to businesses in the developer program. Reference and sample plugins ship with
that gate so they never appear in ordinary Marketplace listings.

Dev builds specifically:

- `version 0.0.0` must be `published: false`.
- `developer_business_id` is required, and the `0.0.0` build is installable **only** in that
  business.
- Each `0.0.0` publish replaces the previous one for that api_name.

---

## 9. Secrets in the release flow

Credential values inside `services[].auth_credentials` may be committed as encrypted
envelopes:

```json
{
  "client_secret": { "encrypted": true, "value": "<base64 ciphertext>" }
}
```

Author flow:

```bash
npx --yes @kizenapps/cli encrypt            # returns {"encrypted": true, "value": "..."} to paste into kizen.json
npx --yes @kizenapps/cli encrypt --stage dev   # target non-production keys
```

`npx --yes @kizenapps/cli encrypt` defaults to production keys; `--stage dev` is the explicit override for
plugins that only publish to non-production environments. Envelopes encrypted for the wrong
stage fail the pipeline's decryption check with a clear error rather than publishing broken
credentials.

The pipeline decrypts centrally before publishing, so no environment holds key material and
the ciphertext is safe in a public repository. Plaintext values still function but are legacy:
anyone with repository access can read them.

If a re-encryption is ever needed, the decryption check fails first — re-run `npx --yes @kizenapps/cli encrypt`
and commit the new envelope.

---

## 10. Release checklist

Before pushing to a release branch:

- [ ] `kizen.json` `version` bumped, sized per the [bump matrix](#how-big-a-bump).
- [ ] `releaseNotes/<version>.md` written for admins, filename matching the new version exactly.
- [ ] `npx --yes @kizenapps/cli build` clean.
- [ ] No new or renamed `api_name` on the plugin itself.
- [ ] Removed or renamed artifacts, steps, config keys or secrets accounted for — major bump,
      or restore the old name.
- [ ] New secrets declared in `base_config.secrets`; new `{{secret.KEY}}` tokens too.
- [ ] `thumbnail.png` still present at `<entry>/thumbnail.png`.
- [ ] Encrypted credential envelopes current for the stage you publish to.
- [ ] Preview build exercised in the developer business (install, run each changed surface).

---

## Gotchas

- **Pushing to a release branch is publishing.** There is no staging step, no manual promote,
  and no unpublish. A mistake is fixed by publishing a higher version.
- **Published versions are immutable.** Re-pushing the same version is rejected. Every fix,
  however small, needs a new version and a new notes file.
- **`0.0.0` is destructive.** Each preview publish replaces the previous dev build. Never
  install a `0.0.0` build anywhere that matters.
- **Preview builds suffix your api_name.** Anything hardcoding the plugin api_name works on
  `main` and silently fails in previews. Use the runtime value everywhere.
- **Renaming breaks silently; removing breaks loudly.** A renamed config key hides gated
  artifacts with no error; a removed Agentic Workflow step fails workflows at run time.
- **Minor/patch releases reach every install immediately.** There is no per-business rollout,
  so a bad patch is live everywhere on the same major within minutes.
- **A release-notes file whose name does not match the version is invisible.** No warning; the
  version simply publishes with empty notes.
- **Changing OAuth client credentials logs everyone out.** Stored tokens are invalidated and
  installs flip to an error state until each business (or user) re-authorizes.
- **Removing `required_entitlement` exposes the plugin to everyone at once**, and previously
  revoked installs are not restored.
- **One environment can fail while others succeed.** Read every per-environment result, not
  just the overall check status.
- **A flat `developer_business_id` publishes the same id to every environment** — valid in one,
  meaningless in the rest. Use the per-environment map.
- **`.kizenapp/` must stay gitignored.** It holds local build state and a browser profile used
  by the local runner; committing it leaks more than build output.
