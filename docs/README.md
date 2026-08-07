# Kizen Plugin Developer Documentation

**What this covers:** this directory is the source of truth for building Kizen plugins. It is
written for coding agents: full contracts, TypeScript signatures, request/response shapes, and
runnable generic examples — self-sufficient, with no dependency on platform source code. The only
external reference is the **Kizen docs MCP**, for general platform documentation (environments,
auth headers, the public API beyond what plugins need).

**See also:** [method-index.md](method-index.md) for name → section lookup · [glossary.md](glossary.md) for vocabulary · [17-gotchas.md](17-gotchas.md) for the consolidated trap list · [examples/](examples/README.md) for complete real plugin source.

**Running the CLI:** every CLI command in these docs is invoked with npx, exactly as written —
nothing to install first. (`create` is the one that needs an interactive terminal.)

```
npx --yes @kizenapps/cli <command>    # create · build · dev · encrypt · report · icons
```

See [02-getting-started.md](02-getting-started.md#the-cli-kizenappscli).

## How to navigate

- **First time here:** read [01-overview.md](01-overview.md) (mental model), then
  [02-getting-started.md](02-getting-started.md) (repo, the `@kizenapps/cli` CLI, hello world), then the
  doc for the surface you're building (see the file map below).
- **Looking something up:** go straight to [method-index.md](method-index.md) — a flat A–Z table
  from any method, manifest field, endpoint, or identifier to its owning section. Every API method
  and field has its own heading, so anchors are grep-able and stable.
- **Want to see it done, not described:** [examples/](examples/README.md) holds the complete source
  of two shipping plugins. The numbered docs teach one contract at a time; the examples show whole
  working repos. Grep them for a method to find real call sites.
- **Safety net:** scan the relevant section of [17-gotchas.md](17-gotchas.md) before and after
  building any surface. Every reference doc also ends with a local Gotchas section; in
  [18-recipes.md](18-recipes.md) each recipe carries its own "What can go wrong" footer, collected
  in that file's Gotchas section.

## File map

| File | Owns |
|---|---|
| [01-overview.md](01-overview.md) | The mental model: what a plugin is, worker/host-bridge execution, the full surface catalog, publish/install lifecycle, config flow, security model. |
| [02-getting-started.md](02-getting-started.md) | The on-ramp: repo layout, the CLI (`npx --yes @kizenapps/cli`), the dev loop, a minimal hello-world plugin, first-release checklist. |
| [03-manifest-reference.md](03-manifest-reference.md) | Every `kizen.json` field, the artifact directory convention under `entry` and each artifact's `config.json`, `services` and `base_config`, multi-plugin manifests, all build/publish validation rules. |
| [04-worker-runtime-api.md](04-worker-runtime-api.md) | The complete `this.*` reference: execution model, per-script-kind context/args matrix, and every method with its signature. |
| [05-platform-api.md](05-platform-api.md) | Kizen REST endpoint shapes — objects, fields, records, activities, business settings, teams, plugin config, integration secrets — plus pagination, errors, rate limits, and the three inbound ingestion paths. |
| [06-auth-secrets-services.md](06-auth-secrets-services.md) | Every way a plugin reaches an external system or holds a credential: the `services` array, the generic proxy, integration secrets, `npx --yes @kizenapps/cli encrypt` envelopes, direct external calls, the OAuth callback. |
| [07-automation-steps.md](07-automation-steps.md) | Agentic Workflow steps (Python): step `config.json` schema, the `data_type` enum, inputs/outputs, the Python runtime (`inputs`, `outputs`, `secrets`, `kizen.api`), retries, DB-connector patterns. |
| [08-actions.md](08-actions.md) | JavaScript record actions: config and script contract, record context, write-back, install-time association (`include_perform_action`), the create-override mechanism. |
| [09-blocks.md](09-blocks.md) | Blocks (dashlets): declaration, render surfaces and container, the paint-your-own-card chrome contract, CSS environment, script runtime, cross-block communication, chart techniques. |
| [10-views-modals-forms.md](10-views-modals-forms.md) | Views and pages, `showViewInModal` and its options, submittable forms, the frameless wizard pattern, `dynamicPrompt`, legacy `prompt`, `closeModal`. |
| [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md) | Putting pixels on screen: `outputUI` sanitization and `data-script`, `outputIframe` and the frame proxy, the unsupported `outputView`, floating frames, toolbar items. |
| [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md) | The four hook-in surfaces: route scripts, calendar sources, data adornments, object settings menu items. |
| [13-setup-assistants.md](13-setup-assistants.md) | The two declarative config wizards (`setup_assistant`, `user_setup_assistant`): every field type and prop, where answers land, how config reaches scripts, re-prompt on hash change. |
| [14-navigation-and-communication.md](14-navigation-and-communication.md) | Moving the user (`openWindow`, navigation context, the relative-URL rule) and moving data between surfaces (`runBlockScript`, `runFrameScript`, `sendMessageToOwnFrame`, `sessionData`). |
| [15-errors-and-observability.md](15-errors-and-observability.md) | The failure doctrine: `throw` vs `this.onError` vs `showToast`, the `*WithErrors` tuple convention, `KizenRequestError`, retries, what you can and cannot observe at runtime. |
| [16-release-and-publish.md](16-release-and-publish.md) | Repo commit → installed version: version bump + release notes, branch/environment targeting, preview builds, the pipeline, publish-side errors, install/upgrade semantics. |
| [17-gotchas.md](17-gotchas.md) | Every known trap and silent-failure mode, one line each, grouped by topic, linked back to the owning doc. The safety net. |
| [18-recipes.md](18-recipes.md) | Six complete adaptable builds: plugin skeleton, OAuth integration, DB-connector step pair, block-driven modal wizard, calendar source, record action with write-back. |
| [glossary.md](glossary.md) | Canonical vocabulary, one definition per term, cross-linked. Use these exact terms; several have legacy synonyms the docs deliberately avoid. |
| [method-index.md](method-index.md) | Flat A–Z lookup: every method, manifest field, config field, endpoint, and identifier → owning doc + anchor. Plus a by-task routing table. |
| [examples/](examples/README.md) | Complete unedited source of two shipping plugins, generated by `npx --yes @kizenapps/cli report`: **kitchen sink** (every surface, ~5,150 lines) and **Google Calendar** (a production OAuth + calendar-source integration). Includes a bundled MCP server for clients that can't read the repo off disk. |

## Start here for common tasks

- **Create a new plugin from scratch** — [02-getting-started.md](02-getting-started.md), then copy
  [Recipe 1](18-recipes.md#recipe-1--new-plugin-skeleton).
- **Integrate an external API (OAuth or token)** — [06-auth-secrets-services.md](06-auth-secrets-services.md),
  worked end-to-end in [Recipe 2](18-recipes.md#recipe-2--oauth-service-integration).
- **Add a Python step to Agentic Workflows** — [07-automation-steps.md](07-automation-steps.md);
  DB-connector variant in [Recipe 3](18-recipes.md#recipe-3--database-connector-agentic-workflow-step).
- **Build UI (dashlet, modal, wizard, iframe)** — [09-blocks.md](09-blocks.md) →
  [10-views-modals-forms.md](10-views-modals-forms.md) → [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md);
  wizard pattern in [Recipe 4](18-recipes.md#recipe-4--block--modal-wizard).
- **Read/write Kizen records from plugin code** — [05-platform-api.md](05-platform-api.md) for
  endpoint shapes, [04-worker-runtime-api.md](04-worker-runtime-api.md#4-http) for the JS helpers.
- **Ship a release** — [16-release-and-publish.md](16-release-and-publish.md): always bump
  `version` *and* add `releaseNotes/<version>.md` in the same commit.
- **See a whole working plugin** — [examples/kitchen_sink.md](examples/kitchen_sink.md) implements
  every surface in one repo; [examples/google_calendar.md](examples/google_calendar.md) is a
  production OAuth + calendar-source integration. Useful as the concrete counterpart to any recipe
  in [18-recipes.md](18-recipes.md).
