# Method & Identifier Index

**What this covers:** a flat A–Z lookup from any name you might grep for — `this.*` methods, `communicate.*` methods, `kizen.json` manifest fields, artifact `config.json` fields, REST endpoints, Python `kizen.api` methods, setup-assistant field types, and platform identifiers — to the doc section that owns it. Link labels are file numbers (see the legend). Where a name has per-surface headings in several docs, every location is listed.

**See also:** [README.md](README.md) for reading order · [glossary](glossary.md) for definitions · [17-gotchas.md](17-gotchas.md) for the consolidated trap list · [examples/](examples/README.md) for real call sites in complete plugin source.

## By task

| Task | Go to |
|---|---|
| Understand the platform / execution model | [01-overview.md](01-overview.md) |
| Set up a repo, run the dev loop | [02-getting-started.md](02-getting-started.md) |
| Write or validate `kizen.json` | [03-manifest-reference.md](03-manifest-reference.md) |
| Look up a `this.*` signature | [04-worker-runtime-api.md](04-worker-runtime-api.md) |
| Call the Kizen REST API | [05-platform-api.md](05-platform-api.md) (endpoint shapes) + [04 §4 HTTP](04-worker-runtime-api.md#4-http) (JS helpers) |
| Call an external API / hold a credential / OAuth | [06-auth-secrets-services.md](06-auth-secrets-services.md) |
| Build an Agentic Workflow step (Python) | [07-automation-steps.md](07-automation-steps.md) |
| Add a record action or create override | [08-actions.md](08-actions.md) |
| Render UI | blocks: [09-blocks.md](09-blocks.md) · modals/forms: [10-views-modals-forms.md](10-views-modals-forms.md) · outputUI/iframes/frames: [11-output-ui-iframes-frames.md](11-output-ui-iframes-frames.md) |
| Route scripts, calendar sources, adornments, settings items | [12-routes-calendars-adornments-settings.md](12-routes-calendars-adornments-settings.md) |
| Ship an install-time config wizard | [13-setup-assistants.md](13-setup-assistants.md) |
| Navigate or pass data between surfaces | [14-navigation-and-communication.md](14-navigation-and-communication.md) |
| Decide `throw` vs `onError` vs `showToast` | [15-errors-and-observability.md](15-errors-and-observability.md) |
| Release a version | [16-release-and-publish.md](16-release-and-publish.md) |
| Debug something weird | [17-gotchas.md](17-gotchas.md) |
| Copy a working end-to-end build | [18-recipes.md](18-recipes.md) |
| Read a whole real plugin / find live call sites | [examples/](examples/README.md) — [kitchen_sink.md](examples/kitchen_sink.md) (every surface) · [google_calendar.md](examples/google_calendar.md) (production OAuth + calendar source) |

## Link legend

01 [overview](01-overview.md) · 02 [getting started](02-getting-started.md) · 03 [manifest](03-manifest-reference.md) · 04 [worker runtime](04-worker-runtime-api.md) · 05 [platform API](05-platform-api.md) · 06 [auth & services](06-auth-secrets-services.md) · 07 [workflow steps](07-automation-steps.md) · 08 [actions](08-actions.md) · 09 [blocks](09-blocks.md) · 10 [views & modals](10-views-modals-forms.md) · 11 [output UI & frames](11-output-ui-iframes-frames.md) · 12 [routes/calendars/adornments/settings](12-routes-calendars-adornments-settings.md) · 13 [setup assistants](13-setup-assistants.md) · 14 [navigation & communication](14-navigation-and-communication.md) · 15 [errors](15-errors-and-observability.md) · 16 [release](16-release-and-publish.md) · glossary [glossary.md](glossary.md)

## A–Z index

| Identifier | Kind | Where |
|---|---|---|
| `action_description` | step config field | [07](07-automation-steps.md#action_description) |
| `this.actionEntity()` | `this.*` method | [04](04-worker-runtime-api.md#thisactionentity) |
| `this.actionObjectId` / `this.actionEntityId` | `this.*` data member | [04](04-worker-runtime-api.md#thisactionobjectid--thisactionentityid) |
| `actionOverrideCreate` (`action_override_create`) | install-time association setting | [08](08-actions.md#create-override-replacing-the-native-add-record-form) · [glossary](glossary.md#action_override_create) |
| `actions/<name>/` | artifact directory | [03](03-manifest-reference.md#actionsname) · [08](08-actions.md#directory-layout) |
| `actions` step (assistant) | assistant section | [13](13-setup-assistants.md#4-actions--the-record-action--object-mapping-step) |
| `action_type` | step config field | [07](07-automation-steps.md#action_type) |
| `POST /api/activities` | REST endpoint | [05](05-platform-api.md#post-apiactivities) |
| `GET /api/activities` | REST endpoint | [05](05-platform-api.md#get-apiactivities) |
| `POST /api/activities/{activity_identifier}/log-activity` | REST endpoint | [05](05-platform-api.md#post-apiactivitiesactivity_identifierlog-activity) |
| `POST /api/activities/{activity_identifier}/responses` | REST endpoint | [05](05-platform-api.md#post-apiactivitiesactivity_identifierresponses) |
| `GET /api/activities/logged/{id}` | REST endpoint | [05](05-platform-api.md#get-apiactivitiesloggedid) |
| `POST /api/activities/scheduled-activity` | REST endpoint | [05](05-platform-api.md#post-apiactivitiesscheduled-activity) |
| `GET /api/activities/scheduled-activity` | REST endpoint | [05](05-platform-api.md#get-apiactivitiesscheduled-activity) |
| `GET\|PUT\|PATCH\|DELETE /api/activities/scheduled-activity/{id}` | REST endpoint | [05](05-platform-api.md#getputpatchdelete-apiactivitiesscheduled-activityid) |
| `PATCH /api/activities/scheduled-activity/{id}/notes` | REST endpoint | [05](05-platform-api.md#patch-apiactivitiesscheduled-activityidnotes) |
| `POST /api/activities/scheduled-activity/search` | REST endpoint | [05](05-platform-api.md#post-apiactivitiesscheduled-activitysearch) |
| `add_values` | record field-write shape | [08](08-actions.md#field-write-shapes-name-value-vs-add_values) · [05](05-platform-api.md#post-apirecordsobjectadd) |
| `additional_service_urls` | service field | [06](06-auth-secrets-services.md#field-additional_service_urls-and-the-full_domain-query-param) |
| Agentic Workflow | vocabulary | [glossary](glossary.md#agentic-workflow) · [07](07-automation-steps.md) |
| `allowed_values` | step parameter field | [07](07-automation-steps.md#allowed_values) |
| `api_name` (manifest / per artifact) | manifest & artifact config field | [03](03-manifest-reference.md#api_name) · [03](03-manifest-reference.md#artifact-api_name-resolution) · [07](07-automation-steps.md#api_name) · [08](08-actions.md#api_name) · [09](09-blocks.md#api_name) · [12](12-routes-calendars-adornments-settings.md#api_name-route-script) · [12](12-routes-calendars-adornments-settings.md#api_name-calendar-source) · [12](12-routes-calendars-adornments-settings.md#api_name-object-settings-menu-item) · [glossary](glossary.md#api_name) |
| `this.applicationPath` | `this.*` data member | [04](04-worker-runtime-api.md#thisapplicationpath) |
| `this.args` | `this.*` data member | [04](04-worker-runtime-api.md#thisargs) |
| `assistant.json` | assistant config file | [13](13-setup-assistants.md#assistantjson-shape) |
| `GET /api/auth/bootstrap` | REST endpoint | [05](05-platform-api.md#get-apiauthbootstrap) |
| `auth_credentials` | service field | [06](06-auth-secrets-services.md#field-auth_credentials) · [03](03-manifest-reference.md#service-object-fields) |
| `auth_level` | service field | [06](06-auth-secrets-services.md#field-auth_level) |
| `this.authorize(serviceName, config?)` | `this.*` method | [04](04-worker-runtime-api.md#thisauthorizeservicename-config) · [06](06-auth-secrets-services.md#thisauthorizeservicename-config) |
| `auth_type: "basic_auth_token_exchange"` / `"private_key_jwt"` | service field | [06](06-auth-secrets-services.md#auth_type-basic_auth_token_exchange-and-auth_type-private_key_jwt) |
| `auth_type: "basic_auth_token_provided"` | service field | [03](03-manifest-reference.md#auth_type-basic_auth_token_provided) · [06](06-auth-secrets-services.md#auth_type-basic_auth_token_provided) |
| `auth_type: "no_auth"` | service field | [03](03-manifest-reference.md#auth_type-no_auth) · [06](06-auth-secrets-services.md#auth_type-no_auth) |
| `auth_type: "oauth"` | service field | [03](03-manifest-reference.md#auth_type-oauth) · [06](06-auth-secrets-services.md#auth_type-oauth-with-auth_level-user) · [06](06-auth-secrets-services.md#auth_type-oauth-with-auth_level-business) |
| `auth_type: "password_token_exchange"` | service field | [06](06-auth-secrets-services.md#auth_type-password_token_exchange) |
| `GET\|POST /api/automations/{automation_identifier}/webhook/{webhook_name}` | REST endpoint | [05](05-platform-api.md#getpost-apiautomationsautomation_identifierwebhookwebhook_name) |
| `automationSteps/<name>/` | artifact directory | [03](03-manifest-reference.md#automationstepsname) · [07](07-automation-steps.md#directory-layout) |
| `base_config` | manifest field | [03](03-manifest-reference.md#base_config) · [glossary](glossary.md#base_config) |
| `base_config.disabled_keys` | manifest field | [13](13-setup-assistants.md#95-base_configdisabled_keys) |
| `base_config.secrets` | manifest field | [06](06-auth-secrets-services.md#declaring-secrets-base_configsecrets) · [16](16-release-and-publish.md#9-secrets-in-the-release-flow) |
| `base_service_url` | service field | [06](06-auth-secrets-services.md#field-base_service_url) |
| `blocking` (route script, install-time) | install-time association setting | [12](12-routes-calendars-adornments-settings.md#install-time-settings-blocking-and-the-object-binding) |
| `block_loading_for_setup` | manifest field | [03](03-manifest-reference.md#block_loading_for_setup) |
| `blocks/<name>/` | artifact directory | [03](03-manifest-reference.md#blocksname) · [09](09-blocks.md#declaring-a-block) |
| `boolean` (assistant field type) | assistant field type | [13](13-setup-assistants.md#53-boolean) |
| Business config | concept | [05](05-platform-api.md#8-plugin-business-configuration) · [glossary](glossary.md#business-config) |
| `GET /api/business/mine` | REST endpoint | [05](05-platform-api.md#get-apibusinessmine) |
| `PATCH /api/business/mine` | REST endpoint | [05](05-platform-api.md#patch-apibusinessmine) |
| Business plugin app | concept | [glossary](glossary.md#business-plugin-app) · [05](05-platform-api.md#get-apiexternal-integrationsbusiness-plugin-appsidentifier) |
| `calendarSources/<name>/` | artifact directory | [03](03-manifest-reference.md#calendarsourcesname) · [12](12-routes-calendars-adornments-settings.md#declaration--directory-layout-1) |
| `calendars_script` (`calendars.js`) | calendar-source config field | [12](12-routes-calendars-adornments-settings.md#calendars_script-contract-calendarsjs) |
| `callback.js` (page callback script) | file convention | [10](10-views-modals-forms.md#callbackjs--page-callback-script) |
| `this.clearToasts()` | `this.*` method | [04](04-worker-runtime-api.md#thiscleartoasts) |
| `POST /api/client` | REST endpoint | [05](05-platform-api.md#post-apiclient) |
| `GET /api/client/custom-object` | REST endpoint | [05](05-platform-api.md#get-apiclientcustom-object) |
| `this.closeModal(values?, canceled?)` | `this.*` method | [04](04-worker-runtime-api.md#thisclosemodalvalues-canceled) · [10](10-views-modals-forms.md#thisclosemodalvalues-canceled) |
| `color` (data adornment) | adornment config field | [12](12-routes-calendars-adornments-settings.md#color) |
| `this.config` | `this.*` data member | [04](04-worker-runtime-api.md#thisconfig) |
| `this.completeSetup(payload, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thiscompletesetuppayload-options) · [13](13-setup-assistants.md#123-completing-setup) |
| `config_template` | manifest field | [03](03-manifest-reference.md#config_template) · [glossary](glossary.md#config_template) |
| `conflict_resolution` (outputs only) | step parameter field | [07](07-automation-steps.md#conflict_resolution-outputs-only) |
| `connection_secret_tag` | input convention | [06](06-auth-secrets-services.md#the-connection_secret_tag-input-convention) |
| `this.console` | `this.*` data member | [04](04-worker-runtime-api.md#thisconsole) |
| `GET /api/constants/currencies` | REST endpoint | [05](05-platform-api.md#get-apiconstantscurrencies) |
| `container` (assistant field type) | assistant field type | [13](13-setup-assistants.md#52-container) |
| `this.copyToClipboard(text)` | `this.*` method | [04](04-worker-runtime-api.md#thiscopytoclipboardtext) |
| `this.createDateObject(dateString)` | `this.*` method | [04](04-worker-runtime-api.md#thiscreatedateobjectdatestring) |
| `create_field_options` (outputs only) | step parameter field | [07](07-automation-steps.md#create_field_options-outputs-only) |
| `this.currentBusiness` | `this.*` data member | [04](04-worker-runtime-api.md#thiscurrentbusiness) |
| `this.currentEntity()` | `this.*` method | [04](04-worker-runtime-api.md#thiscurrententity) |
| `this.currentObject()` | `this.*` method | [04](04-worker-runtime-api.md#thiscurrentobject) |
| `this.currentUser` | `this.*` data member | [04](04-worker-runtime-api.md#thiscurrentuser) |
| `customIcon` / `customIconFile` | adornment config field | [12](12-routes-calendars-adornments-settings.md#customicon--customiconfile) |
| `custom_object` (assistant field type) | assistant field type | [13](13-setup-assistants.md#58-custom_object) |
| `POST /api/custom-objects` | REST endpoint | [05](05-platform-api.md#post-apicustom-objects) |
| `GET /api/custom-objects` | REST endpoint | [05](05-platform-api.md#get-apicustom-objects) |
| `GET /api/custom-objects/{identifier}` | REST endpoint | [05](05-platform-api.md#get-apicustom-objectsidentifier) |
| `DELETE /api/custom-objects/{object_id}` | REST endpoint | [05](05-platform-api.md#delete-apicustom-objectsobject_id) |
| `GET /api/custom-objects/{object_id}/categories` | REST endpoint | [05](05-platform-api.md#get-apicustom-objectsobject_idcategories) |
| `GET /api/custom-objects/{object_id}/detail` | REST endpoint | [05](05-platform-api.md#get-apicustom-objectsobject_iddetail) |
| `GET /api/custom-objects/{object_id}/fields` | REST endpoint | [05](05-platform-api.md#get-apicustom-objectsobject_idfields) |
| `POST /api/custom-objects/{object_id}/fields` | REST endpoint | [05](05-platform-api.md#post-apicustom-objectsobject_idfields) |
| `PATCH /api/custom-objects/{object_id}/fields/{field_id}` | REST endpoint | [05](05-platform-api.md#patch-apicustom-objectsobject_idfieldsfield_id) |
| `DELETE /api/custom-objects/{object_id}/fields/{field_id}` | REST endpoint | [05](05-platform-api.md#delete-apicustom-objectsobject_idfieldsfield_id) |
| `POST /api/custom-objects/{object_id}/fields/{field_id}/options` | REST endpoint | [05](05-platform-api.md#post-apicustom-objectsobject_idfieldsfield_idoptions) |
| `POST /api/custom-objects/{object_id}/fields/search` (also settings-search, references) | REST endpoint | [05](05-platform-api.md#post-apicustom-objectsobject_idfieldssearch--fieldssettings-search--get-fieldsfield_idreferences) |
| `GET /api/custom-objects/settings-search` | REST endpoint | [05](05-platform-api.md#get-apicustom-objectssettings-search) |
| Dashlet chrome contract (`dashletStyleConfig.dropShadow`) | concept | [09](09-blocks.md#the-dashlet-chrome-contract--paint-your-own-card) |
| `dataAdornments/<name>/` | artifact directory | [03](03-manifest-reference.md#dataadornmentsname) · [12](12-routes-calendars-adornments-settings.md#declaration--directory-layout-2) |
| `data-script` (event dispatch attribute) | identifier | [11](11-output-ui-iframes-frames.md#data-script-event-dispatch) · [glossary](glossary.md#data-script) |
| `data_type` | step parameter field | [07](07-automation-steps.md#data_type) · [07](07-automation-steps.md#data_type-reference) |
| `this.debug` | `this.*` data member | [04](04-worker-runtime-api.md#thisdebug) |
| `default_position` | frame config field | [11](11-output-ui-iframes-frames.md#default_position) |
| `default` (step parameter) | step parameter field | [07](07-automation-steps.md#default) |
| `kizen.api.delete(path, **kwargs)` | Python `kizen.api` | [07](07-automation-steps.md#methods) · [07](07-automation-steps.md#response-object) |
| `this.delete(url, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thisdeleteurl-options) |
| `this.deleteWithErrors(url, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thisdeletewitherrorsurl-options) |
| `dependencies` (cascading assistant fields) | assistant config | [13](13-setup-assistants.md#7-dependencies--cascading-fields) |
| `description` (assistant field type) | assistant field type | [13](13-setup-assistants.md#51-description) |
| `description` (manifest) | manifest field | [03](03-manifest-reference.md#description) |
| `developer_business_id` | manifest field | [03](03-manifest-reference.md#developer_business_id) · [03](03-manifest-reference.md#6-developer_business_id) · [glossary](glossary.md#developer-business) |
| `this.dynamicPrompt(config)` | `this.*` method | [04](04-worker-runtime-api.md#thisdynamicpromptconfig) · [10](10-views-modals-forms.md#thisdynamicpromptconfig) · [glossary](glossary.md#dynamicprompt) |
| `GET\|POST /api/employee/mine/configs/plugins/{plugin_id}` | REST endpoint | [05](05-platform-api.md#getpost-apiemployeemineconfigspluginsplugin_id) |
| Encrypted secret envelope (`{"encrypted": true, ...}`) | concept | [06](06-auth-secrets-services.md#the-envelope-format) · [06](06-auth-secrets-services.md#4-encrypted-manifest-secrets) |
| `engine` | manifest field | [03](03-manifest-reference.md#engine) · [glossary](glossary.md#engine) |
| Entitlement | concept | [16](16-release-and-publish.md#7-entitlement-gating) · [glossary](glossary.md#entitlement) |
| `entry` | manifest field | [03](03-manifest-reference.md#entry) · [03](03-manifest-reference.md#7-artifact-directories-under-entry) · [glossary](glossary.md#entry-directory) |
| `esc()` (HTML escaping discipline) | identifier | [11](11-output-ui-iframes-frames.md#esc-discipline) |
| `eventScripts/<handler>.js` | file convention | [03](03-manifest-reference.md#eventscriptshandlerjs) · [glossary](glossary.md#event-script) |
| `events_script` (`events.js`) | calendar-source config field | [12](12-routes-calendars-adornments-settings.md#events_script-contract-eventsjs) |
| `this.expand()` / `this.collapse()` (floating frame) | `this.*` method | [04](04-worker-runtime-api.md#thisexpand--thiscollapse) |
| `GET /api/external-integrations/bootstrap` | REST endpoint | [05](05-platform-api.md#get-apiexternal-integrationsbootstrap) |
| `GET /api/external-integrations/business-plugin-apps/{identifier}` | REST endpoint | [05](05-platform-api.md#get-apiexternal-integrationsbusiness-plugin-appsidentifier) |
| `PATCH /api/external-integrations/business-plugin-apps/{identifier}` | REST endpoint | [05](05-platform-api.md#patch-apiexternal-integrationsbusiness-plugin-appsidentifier) · [13](13-setup-assistants.md#133-writing-business-config-from-a-script) |
| `GET /api/external-integrations/business-plugin-apps/{identifier}/services/{service_name}/authorize` | REST endpoint | [06](06-auth-secrets-services.md#get-apiexternal-integrationsbusiness-plugin-appsidentifierservicesservice_nameauthorize) |
| `POST /api/external-integrations/business-plugin-apps/{identifier}/services/{service_name}/logout` | REST endpoint | [06](06-auth-secrets-services.md#post-apiexternal-integrationsbusiness-plugin-appsidentifierservicesservice_namelogout) |
| `GET /api/external-integrations/oauth/callback` | REST endpoint | [06](06-auth-secrets-services.md#get-apiexternal-integrationsoauthcallback) |
| `ANY /api/external-integrations/proxy/{plugin_api_name}/{service_name}/{path}` | REST endpoint | [05](05-platform-api.md#any-apiexternal-integrationsproxyplugin_api_nameservice_namepath) · [06](06-auth-secrets-services.md#any-apiexternal-integrationsproxyplugin_api_nameservice_namepath) |
| `external_link` | manifest field | [03](03-manifest-reference.md#external_link) |
| `field` (assistant field type) | assistant field type | [13](13-setup-assistants.md#59-field) |
| `FieldOption` | step data type | [07](07-automation-steps.md#fieldoption) |
| `field_type` (data adornment) | adornment config field | [12](12-routes-calendars-adornments-settings.md#field_type) |
| `file` / `KizenFile` | step data type | [07](07-automation-steps.md#file-and-kizenfile) |
| `floatingFrames/<name>/` | artifact directory | [03](03-manifest-reference.md#floatingframesname) · [11](11-output-ui-iframes-frames.md#declaring-a-floating-frame) |
| `this.formatDateForResponse(date)` | `this.*` method | [04](04-worker-runtime-api.md#thisformatdateforresponsedate) |
| `frameless` (modal option) | modal option | [10](10-views-modals-forms.md#frameless-views-frameless-true) · [10](10-views-modals-forms.md#thisshowviewinmodalid-config) |
| Frame proxy (`plugin-assets.kizen.com` / `plugin-assets.kizen.dev`) | concept | [11](11-output-ui-iframes-frames.md#the-frame-proxy) · [glossary](glossary.md#frame-proxy) |
| `full_domain` (proxy query param) | query param | [06](06-auth-secrets-services.md#field-additional_service_urls-and-the-full_domain-query-param) |
| `this.getEntity(objectId, entityId)` | `this.*` method | [04](04-worker-runtime-api.md#thisgetentityobjectid-entityid) |
| `this.getFieldValue(entity, fieldId)` | `this.*` method | [04](04-worker-runtime-api.md#thisgetfieldvalueentity-fieldid) |
| `this.getObjectDetail(id)` | `this.*` method | [04](04-worker-runtime-api.md#thisgetobjectdetailid) |
| `kizen.api.get(path, params=None, headers=None, **kwargs)` | Python `kizen.api` | [07](07-automation-steps.md#methods) · [07](07-automation-steps.md#response-object) |
| `this.getRelatedEntitiesForField(objectId, entityId, fieldId)` | `this.*` method | [04](04-worker-runtime-api.md#thisgetrelatedentitiesforfieldobjectid-entityid-fieldid) |
| `this.getServiceUrl(serviceName, path)` | `this.*` method | [04](04-worker-runtime-api.md#thisgetserviceurlservicename-path) · [06](06-auth-secrets-services.md#thisgetserviceurlservicename-path) |
| `this.get(url, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thisgeturl-options) |
| `this.getUserConfig()` | `this.*` method | [04](04-worker-runtime-api.md#thisgetuserconfig) |
| `this.getWithErrors(url, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thisgetwitherrorsurl-options) |
| `kizen.api.head(path, **kwargs)` | Python `kizen.api` | [07](07-automation-steps.md#methods) · [07](07-automation-steps.md#response-object) |
| `this.hide(config?)` (floating frame) | `this.*` method | [04](04-worker-runtime-api.md#thishideconfig) |
| `this.hideHeader()` / `this.showHeader()` (floating frame) | `this.*` method | [04](04-worker-runtime-api.md#thishideheader--thisshowheader) |
| `hint` | step parameter field | [07](07-automation-steps.md#hint) |
| `hint_field_name` | step parameter field | [07](07-automation-steps.md#hint_field_name) |
| `hint_object_name` | artifact config field | [08](08-actions.md#hint_object_name) · [12](12-routes-calendars-adornments-settings.md#hint_object_name) |
| `hint_related_object_field_name` | step parameter field | [07](07-automation-steps.md#hint_related_object_field_name) |
| `icon` (data adornment) | adornment config field | [12](12-routes-calendars-adornments-settings.md#icon) |
| `image` (assistant field type) | assistant field type | [13](13-setup-assistants.md#510-image) |
| `import.kzn` | file convention | [03](03-manifest-reference.md#importkzn) |
| `include` (identity params on `qr` / `image.link` / `link`) | assistant field prop | [13](13-setup-assistants.md#513-include--identity-params-on-qr-imagelink-and-link) |
| `include_perform_action` | install-time association setting | [08](08-actions.md#include_perform_action) · [glossary](glossary.md#include_perform_action) |
| `input_source` | step parameter field | [07](07-automation-steps.md#input_source) |
| `inputs` (Python step global) | Python step global | [07](07-automation-steps.md#inputs) |
| `this.installThirdPartyScript(scriptUrl)` | `this.*` method | [04](04-worker-runtime-api.md#thisinstallthirdpartyscriptscripturl) |
| `GET /api/integration-secrets` | REST endpoint | [05](05-platform-api.md#get-apiintegration-secrets) |
| `POST /api/integration-secrets` | REST endpoint | [05](05-platform-api.md#post-apiintegration-secrets) · [06](06-auth-secrets-services.md#setting-secret-values-apiintegration-secrets) |
| Integration secrets | concept | [05](05-platform-api.md#10-integration-secrets) · [06](06-auth-secrets-services.md#3-secrets) · [glossary](glossary.md#integration-secret) |
| `GET /api/integration-secrets/{id}` | REST endpoint | [05](05-platform-api.md#get-apiintegration-secretsid) |
| `PUT /api/integration-secrets/{id}` | REST endpoint | [05](05-platform-api.md#put-apiintegration-secretsid) · [06](06-auth-secrets-services.md#setting-secret-values-apiintegration-secrets) |
| `DELETE /api/integration-secrets/{id}` | REST endpoint | [05](05-platform-api.md#delete-apiintegration-secretsid) |
| `is_toolbar_item` | page config field | [11](11-output-ui-iframes-frames.md#page-navigation-mode--is_toolbar_item-on-a-page) · [03](03-manifest-reference.md#pagesname) · [10](10-views-modals-forms.md#directory-layout-and-configjson) |
| `kizen.api` | Python `kizen.api` | [07](07-automation-steps.md#kizenapi--calling-kizen-and-declared-services) · [glossary](glossary.md#kizenapi) |
| `__kizen_clean_config` | reserved config key | [04](04-worker-runtime-api.md#thisargs) · [13](13-setup-assistants.md#93-clean-value-shapes--what-scripts-read) · [05](05-platform-api.md#patch-apiexternal-integrationsbusiness-plugin-appsidentifier) |
| `kizen.json` | manifest (file) | [03](03-manifest-reference.md) · [02](02-getting-started.md#kizenjson) · [glossary](glossary.md#kizenjson) |
| `KizenRequestError` | error class | [04](04-worker-runtime-api.md#kizenrequesterror) · [15](15-errors-and-observability.md#6-kizenrequesterror-proxy-vs-upstream-status) |
| `__kizen_setup_assistant_values` | reserved config key | [13](13-setup-assistants.md#91-save-mechanics-both-scopes) · [05](05-platform-api.md#patch-apiexternal-integrationsbusiness-plugin-appsidentifier) |
| `__kizen_user_config` | reserved config key | [04](04-worker-runtime-api.md#thisargs) · [13](13-setup-assistants.md#131-browser-surfaces-js) |
| `label` (step parameter / settings item) | artifact config field | [07](07-automation-steps.md#label) · [12](12-routes-calendars-adornments-settings.md#label) |
| `link` (assistant field type) | assistant field type | [13](13-setup-assistants.md#512-link) |
| `this.location` | `this.*` data member | [04](04-worker-runtime-api.md#thislocation) |
| `manifest/setup-assistant-*` (validation rules) | validation rule | [13](13-setup-assistants.md#125-packaging-validation) · [03](03-manifest-reference.md) |
| `match` / `ignore` (floating frame) | frame config field | [11](11-output-ui-iframes-frames.md#match-ignore) |
| `message_handler` (`message.js`) | artifact config field | [11](11-output-ui-iframes-frames.md#message_handler-routing) · [03](03-manifest-reference.md#floatingframesname) |
| `minimized_style` / `minimized_config` | frame config field | [11](11-output-ui-iframes-frames.md#minimized_style-minimized_config) |
| `min_w` / `max_w` / `min_h` / `max_h` | block config field | [09](09-blocks.md#min_w-max_w-min_h-max_h) |
| Modal slot (FIFO, no nesting) | concept | [10](10-views-modals-forms.md#the-modal-slot--fifo-queue-no-nesting) |
| `money_options` | field option | [05](05-platform-api.md#money_options) |
| Multi-plugin manifests | manifest concept | [03](03-manifest-reference.md#9-multi-plugin-manifests) |
| `name` (manifest / artifact config) | manifest & artifact config field | [03](03-manifest-reference.md#name) · [07](07-automation-steps.md#name) · [08](08-actions.md#name) · [09](09-blocks.md#name) · [12](12-routes-calendars-adornments-settings.md#name-route-script) · [12](12-routes-calendars-adornments-settings.md#name-calendar-source) |
| Navigation context | concept | [14](14-navigation-and-communication.md#navigation-context-since-engine-180) · [glossary](glossary.md#navigation-context) |
| `npx --yes @kizenapps/cli` (the CLI) | CLI | [02](02-getting-started.md#the-cli-kizenappscli) · [glossary](glossary.md#cli-kizenappscli) |
| `npx --yes @kizenapps/cli encrypt` | CLI command | [06](06-auth-secrets-services.md#the-encrypt-command) |
| `npx --yes @kizenapps/cli report` | CLI command | [02](02-getting-started.md#the-cli-kizenappscli) · [examples](examples/README.md#regenerating) |
| `number` (assistant field type) | assistant field type | [13](13-setup-assistants.md#55-number) |
| OAuth callback (only unauthenticated inbound path) | concept | [06](06-auth-secrets-services.md#6-the-oauth-callback) · [05](05-platform-api.md#11-inbound-ingestion) |
| `this.objectId` / `this.entityId` | `this.*` data member | [04](04-worker-runtime-api.md#thisobjectid--thisentityid) |
| `objectSettingsItems/<name>/` | artifact directory | [03](03-manifest-reference.md#objectsettingsitemsname) · [12](12-routes-calendars-adornments-settings.md#declaration--directory-layout-3) |
| `this.onError(error?)` | `this.*` method | [04](04-worker-runtime-api.md#thisonerrorerror) · [15](15-errors-and-observability.md#3-thisonerrorerror--reports-without-stopping) · [08](08-actions.md#2-thisonerrorerror--a-caught-platform-problem) |
| `this.openCreateRecordModal(objectId)` | `this.*` method | [04](04-worker-runtime-api.md#thisopencreaterecordmodalobjectid) · [10](10-views-modals-forms.md#thisopencreaterecordmodalobjectid--thisopencreaterelatedrecordmodalobjectid-relatedentityid) |
| `this.openCreateRelatedRecordModal(objectId, relatedEntityId)` | `this.*` method | [04](04-worker-runtime-api.md#thisopencreaterelatedrecordmodalobjectid-relatedentityid) · [10](10-views-modals-forms.md#thisopencreaterecordmodalobjectid--thisopencreaterelatedrecordmodalobjectid-relatedentityid) |
| `this.openWindow(url, target?, context?)` | `this.*` method | [04](04-worker-runtime-api.md#thisopenwindowurl-target-context) · [14](14-navigation-and-communication.md#thisopenwindowurl-target-context) |
| `kizen.api.options(path, **kwargs)` | Python `kizen.api` | [07](07-automation-steps.md#methods) · [07](07-automation-steps.md#response-object) |
| `this.outputIframe(url, allow?, sandbox?, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thisoutputiframeurl-allow-sandbox-options) · [11](11-output-ui-iframes-frames.md#thisoutputiframeurl-allow-sandbox-options) |
| `outputs.log(message)` | Python step global | [07](07-automation-steps.md#outputslogmessage) |
| `outputs` (Python step global) | Python step global | [07](07-automation-steps.md#outputs) |
| `output_target` (do not use) | step parameter field | [07](07-automation-steps.md#output_target--do-not-use) |
| `this.outputUI(markup, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thisoutputuimarkup-options) · [11](11-output-ui-iframes-frames.md#thisoutputuimarkup-options) |
| `this.outputView(viewId, args?)` (unsupported) | `this.*` method | [04](04-worker-runtime-api.md#thisoutputviewviewid-args--not-supported) · [10](10-views-modals-forms.md#thisoutputviewviewid-args--unsupported) · [11](11-output-ui-iframes-frames.md#thisoutputviewviewid-args--unsupported) |
| `pages/<name>/` | artifact directory | [03](03-manifest-reference.md#pagesname) · [10](10-views-modals-forms.md#directory-layout-and-configjson) |
| Pagination | convention | [05](05-platform-api.md#pagination) |
| `this.parseDate(date)` | `this.*` method | [04](04-worker-runtime-api.md#thisparsedatedate) |
| `this.parsePhone(phone)` | `this.*` method | [04](04-worker-runtime-api.md#thisparsephonephone) |
| `kizen.api.patch(path, data=None, json=None, headers=None, **kwargs)` | Python `kizen.api` | [07](07-automation-steps.md#methods) · [07](07-automation-steps.md#response-object) |
| `this.patch(url, body?, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thispatchurl-body-options) |
| `this.patchWithErrors(url, body, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thispatchwitherrorsurl-body-options) |
| `POST /api/permission-group` | REST endpoint | [05](05-platform-api.md#post-apipermission-group) |
| `this.pluginApiName` | `this.*` data member | [04](04-worker-runtime-api.md#thispluginapiname) |
| `{plugin_api_name}__{secret_name}` (secret naming) | naming convention | [06](06-auth-secrets-services.md#secret-storage-plugin_api_name__secret_name) |
| `plugin_description` | step config field | [07](07-automation-steps.md#plugin_description) |
| `/plugins/{plugin_api_name}/{page_api_name}` (page route) | URL convention | [10](10-views-modals-forms.md#routable-pages--pluginsplugin_api_namepage_api_name) |
| `this.postFormData(url, data, createNewTab?)` | `this.*` method | [04](04-worker-runtime-api.md#thispostformdataurl-data-createnewtab) |
| `kizen.api.post(path, data=None, json=None, headers=None, **kwargs)` | Python `kizen.api` | [07](07-automation-steps.md#methods) · [07](07-automation-steps.md#response-object) |
| `this.post(url, body?, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thisposturl-body-options) |
| `this.postWithErrors(url, body, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thispostwitherrorsurl-body-options) |
| `this.preserve` | `this.*` data member | [04](04-worker-runtime-api.md#14-thispreserve) |
| Preview build | concept | [16](16-release-and-publish.md#3-preview-builds) · [glossary](glossary.md#preview-build) |
| `this.prompt(config)` (legacy) | `this.*` method | [04](04-worker-runtime-api.md#thispromptconfig) · [10](10-views-modals-forms.md#thispromptconfig--legacy) · [glossary](glossary.md#prompt-legacy) |
| `published` | manifest field | [03](03-manifest-reference.md#published) |
| `this.put` (does not exist) | `this.*` method | [04](04-worker-runtime-api.md#there-is-no-thisput) |
| `kizen.api.put(path, data=None, json=None, headers=None, **kwargs)` | Python `kizen.api` | [07](07-automation-steps.md#methods) · [07](07-automation-steps.md#response-object) |
| `qr` (assistant field type) | assistant field type | [13](13-setup-assistants.md#511-qr) |
| Rate limits & retries | convention | [05](05-platform-api.md#rate-limits) · [07](07-automation-steps.md#rate-limits-and-retries) · [15](15-errors-and-observability.md#8-retries-and-rate-limits) |
| `recommended_height` | block config field | [09](09-blocks.md#recommended_height) |
| `POST /api/records/{object}/add` | REST endpoint | [05](05-platform-api.md#post-apirecordsobjectadd) |
| `GET /api/records/{object}/lookup` | REST endpoint | [05](05-platform-api.md#get-apirecordsobjectlookup) |
| `GET /api/records/{object}/{record_id}` | REST endpoint | [05](05-platform-api.md#get-apirecordsobjectrecord_id) |
| `PATCH\|PUT /api/records/{object}/{record_id}` | REST endpoint | [05](05-platform-api.md#patch-apirecordsobjectrecord_id--put-apirecordsobjectrecord_id) |
| `DELETE /api/records/{object}/{record_id}` | REST endpoint | [05](05-platform-api.md#delete-apirecordsobjectrecord_id) |
| `PATCH /api/records/{object}/{record_id}/move` | REST endpoint | [05](05-platform-api.md#patch-apirecordsobjectrecord_idmove) |
| `PATCH /api/records/{object}/{record_id}/unarchive` | REST endpoint | [05](05-platform-api.md#patch-apirecordsobjectrecord_idunarchive) |
| `POST /api/records/{object}/search` | REST endpoint | [05](05-platform-api.md#post-apirecordsobjectsearch) |
| `POST /api/records/{object}/upsert` | REST endpoint | [05](05-platform-api.md#post-apirecordsobjectupsert) · [05](05-platform-api.md#records-upsert-as-an-ingestion-path) |
| `this.refreshEntity()` | `this.*` method | [04](04-worker-runtime-api.md#thisrefreshentity) |
| `this.refreshEntityForId(id?)` | `this.*` method | [04](04-worker-runtime-api.md#thisrefreshentityforidid) |
| `this.refreshTimeline()` | `this.*` method | [04](04-worker-runtime-api.md#thisrefreshtimeline) |
| `this.refreshTimelineForId(id?)` | `this.*` method | [04](04-worker-runtime-api.md#thisrefreshtimelineforidid) |
| `this.releaseBlockingScript()` | `this.*` method | [04](04-worker-runtime-api.md#thisreleaseblockingscript) · [12](12-routes-calendars-adornments-settings.md#blocking-scripts-and-thisreleaseblockingscript) |
| `release_branches` | manifest field | [03](03-manifest-reference.md#release_branches) · [16](16-release-and-publish.md#2-targeting-branches-and-environments) |
| `release_environments` | manifest field | [03](03-manifest-reference.md#release_environments) · [16](16-release-and-publish.md#2-targeting-branches-and-environments) |
| `release_notes_directory` | manifest field | [03](03-manifest-reference.md#release_notes_directory) |
| `releaseNotes/<version>.md` | file convention | [16](16-release-and-publish.md#releasenotesversionmd) · [03](03-manifest-reference.md#release_notes_directory) · [glossary](glossary.md#release-notes) |
| `required_entitlement` | manifest & service field | [03](03-manifest-reference.md#required_entitlement) · [06](06-auth-secrets-services.md#field-required_entitlement-per-service) · [16](16-release-and-publish.md#7-entitlement-gating) |
| `required` (step parameter) | step parameter field | [07](07-automation-steps.md#required) |
| `routeScripts/<name>/` | artifact directory | [03](03-manifest-reference.md#routescriptsname) · [12](12-routes-calendars-adornments-settings.md#declaration--directory-layout) |
| `routes` (route script) | route-script config field | [12](12-routes-calendars-adornments-settings.md#routes) |
| `this.communicate.runBlockScript(blockAPIName, scriptId, args?)` | `communicate.*` method | [04](04-worker-runtime-api.md#thiscommunicaterunblockscriptblockapiname-scriptid-args) · [14](14-navigation-and-communication.md#thiscommunicaterunblockscriptblockapiname-scriptid-args) · [09](09-blocks.md#cross-block-communication-runblockscript) |
| `this.runEventScript(scriptName, args?)` | `this.*` method | [04](04-worker-runtime-api.md#thisruneventscriptscriptname-args) · [14](14-navigation-and-communication.md#thisruneventscriptscriptname-args) |
| `this.communicate.runFrameScript(frameAPIName, scriptId, args?)` | `communicate.*` method | [04](04-worker-runtime-api.md#thiscommunicaterunframescriptframeapiname-scriptid-args) · [14](14-navigation-and-communication.md#thiscommunicaterunframescriptframeapiname-scriptid-args) |
| `runtime` | step config field | [07](07-automation-steps.md#runtime) |
| `scope` (service caller restriction) | service field | [06](06-auth-secrets-services.md#field-scope-caller-identity-restriction) |
| `script_alias` | step parameter field | [07](07-automation-steps.md#script_alias) |
| `script` (step config) | step config field | [07](07-automation-steps.md#script) |
| `{{secret.KEY}}` templating | service field syntax | [03](03-manifest-reference.md#secretkey-templating) · [06](06-auth-secrets-services.md#secretkey-templating-in-service-config) |
| `secrets` (Python step global) | Python step global | [07](07-automation-steps.md#secrets-inside-a-step) · [06](06-auth-secrets-services.md#reading-secrets-python-steps-only) |
| `secrets` (step config) | step config field | [07](07-automation-steps.md#secrets) |
| `select` (dynamic / async options) | assistant field type | [13](13-setup-assistants.md#57-select-dynamic--async-options) |
| `select` (static options) | assistant field type | [13](13-setup-assistants.md#56-select-static-options) |
| `this.communicate.sendMessageToOwnFrame(payload, targetOrigin)` | `communicate.*` method | [04](04-worker-runtime-api.md#thiscommunicatesendmessagetoownframepayload-path) · [14](14-navigation-and-communication.md#thiscommunicatesendmessagetoownframepayload-targetorigin) |
| Service account | concept | [glossary](glossary.md#service-account) |
| `service_name` | service field | [06](06-auth-secrets-services.md#field-service_name) |
| `services` | manifest field | [03](03-manifest-reference.md#services) · [03](03-manifest-reference.md#5-the-services-block) · [06](06-auth-secrets-services.md#the-services-array) · [glossary](glossary.md#service) |
| `services` step (assistant) | assistant section | [13](13-setup-assistants.md#3-services--the-authorization-prerequisite-step) |
| `this.sessionData` | `this.*` data member | [04](04-worker-runtime-api.md#thissessiondata) · [14](14-navigation-and-communication.md#thissessiondata--thissetsessiondataupdate--communication-semantics) · [glossary](glossary.md#session-data) |
| `session_data_key` (navigation-context query param) | identifier | [14](14-navigation-and-communication.md#navigation-context-since-engine-180) |
| `this.setIndicator(indicator?)` | `this.*` method | [04](04-worker-runtime-api.md#thissetindicatorindicator) |
| `this.setSessionData(update)` | `this.*` method | [04](04-worker-runtime-api.md#thissetsessiondataupdate) · [14](14-navigation-and-communication.md#thissessiondata--thissetsessiondataupdate--communication-semantics) |
| `setup_assistant` | manifest field | [03](03-manifest-reference.md#setup_assistant--user_setup_assistant) · [13](13-setup-assistants.md#2-declaring-an-assistant) · [glossary](glossary.md#setup-assistant) |
| `setup_assistant.view` / `user_setup_assistant.view` | manifest field | [03](03-manifest-reference.md#setup_assistant--user_setup_assistant) · [13](13-setup-assistants.md#121-declaring-one) |
| Setup-assistant hash / re-prompt | concept | [13](13-setup-assistants.md#10-re-prompt-on-config-hash-change) · [glossary](glossary.md#setup-assistant-hash) |
| `this.setUserConfig(config)` | `this.*` method | [04](04-worker-runtime-api.md#thissetuserconfigconfig) |
| `this.show(config?)` (floating frame) | `this.*` method | [04](04-worker-runtime-api.md#thisshowconfig) |
| `this.showToast(message, options?)` | `this.*` method | [04](04-worker-runtime-api.md#thisshowtoastmessage-options) · [15](15-errors-and-observability.md#4-thisshowtoast--the-channel-for-expected-failures) |
| `this.showViewInModal(id, config?)` | `this.*` method | [04](04-worker-runtime-api.md#thisshowviewinmodalid-config) · [10](10-views-modals-forms.md#thisshowviewinmodalid-config) |
| Single-painter convention | concept | [09](09-blocks.md#the-single-painter-convention) · [14](14-navigation-and-communication.md#pattern--single-painter-orchestration) |
| `POST /api/smart-connectors/{connector_identifier}/webhook` | REST endpoint | [05](05-platform-api.md#post-apismart-connectorsconnector_identifierwebhook) |
| `Stage` | step data type | [07](07-automation-steps.md#stage) |
| `step_history_template` | step config field | [07](07-automation-steps.md#step_history_template) |
| `GET /api/team` | REST endpoint | [05](05-platform-api.md#get-apiteam) |
| `GET /api/team/{employee_id}` | REST endpoint | [05](05-platform-api.md#get-apiteamemployee_id) |
| `POST /api/team/search` | REST endpoint | [05](05-platform-api.md#post-apiteamsearch) |
| `GET /api/team/typeahead` | REST endpoint | [05](05-platform-api.md#get-apiteamtypeahead) |
| `this.tempPromptState` | `this.*` data member | [04](04-worker-runtime-api.md#thistemppromptstate) |
| `text` (assistant field type) | assistant field type | [13](13-setup-assistants.md#54-text) |
| `thumbnail.png` | file convention | [03](03-manifest-reference.md#thumbnailpng) · [glossary](glossary.md#thumbnail) |
| `title` / `header_color` / `header_text_color` (floating frame) | frame config field | [11](11-output-ui-iframes-frames.md#title-header_color-header_text_color) |
| `toolbar_icon` / `toolbar_color` | page config field | [11](11-output-ui-iframes-frames.md#page-navigation-mode--is_toolbar_item-on-a-page) · [10](10-views-modals-forms.md#directory-layout-and-configjson) |
| `toolbarItems/<name>/` | artifact directory | [03](03-manifest-reference.md#toolbaritemsname) · [11](11-output-ui-iframes-frames.md#script-execution-mode--srctoolbaritems) |
| `tooltip` (data adornment) | adornment config field | [12](12-routes-calendars-adornments-settings.md#tooltip) |
| `types` (block) | block config field | [09](09-blocks.md#types) |
| `this.uploadFile(blob, fileName?, isPublic?)` | `this.*` method | [04](04-worker-runtime-api.md#thisuploadfileblob-filename-ispublic) |
| `this.userConfig` | `this.*` data member | [04](04-worker-runtime-api.md#thisuserconfig) |
| `user_setup_assistant` | manifest field | [03](03-manifest-reference.md#setup_assistant--user_setup_assistant) · [13](13-setup-assistants.md#2-declaring-an-assistant) · [glossary](glossary.md#user-setup-assistant) |
| `version` | manifest field | [03](03-manifest-reference.md#version) · [16](16-release-and-publish.md#how-big-a-bump) · [glossary](glossary.md#version) |
| `views/<name>/` | artifact directory | [03](03-manifest-reference.md#viewsname) · [10](10-views-modals-forms.md#directory-layout-and-configjson) |
| View-based setup assistant | concept | [13](13-setup-assistants.md#12-view-based-setup-assistants) · [glossary](glossary.md#view-based-setup-assistant) |
| `this.wait(ms)` | `this.*` method | [04](04-worker-runtime-api.md#thiswaitms) |
| `when` | artifact config field / gating clause | [03](03-manifest-reference.md#when-conditions) · [07](07-automation-steps.md#when) · [09](09-blocks.md#when) · [11](11-output-ui-iframes-frames.md#when) · [12](12-routes-calendars-adornments-settings.md#when-gating-on-these-surfaces) · [13](13-setup-assistants.md#6-when-inside-the-assistant) · [glossary](glossary.md#when-clause) |
| `width` / `height` (floating frame) | frame config field | [11](11-output-ui-iframes-frames.md#width-height) |
| `*WithErrors` tuple convention | convention | [15](15-errors-and-observability.md#5-the-witherrors-tuple-convention) |
| Worker (execution model) | concept | [04](04-worker-runtime-api.md#1-execution-model) · [glossary](glossary.md#worker) |
