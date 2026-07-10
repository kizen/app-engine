## Kizen App Engine

The core app engine for the Kizen developer platform for running plugin apps in web workers.

### Installation

```
yarn add @kizenapps/engine
```

#### Usage With Vite

The app engine is designed to work with consumers that use Vite, and ships with a vite plugin to do so. This plugin is important for web workers being bundled correctly by the consuming application.

In your `vite.config.ts`:

```ts
import { appEnginePlugin } from '@kizenapps/engine/vite';

export default defineConfig({
  plugins: [appEnginePlugin()],

  // The rest of your config
});
```

#### Localization

The app engine includes some text that can be localized if needed. These messages are mostly limited to error handling currently. Localization is done using `i18next`. At build time `translation.json` is created with the strings that need to be translated. If the consuming app is also using `i18next`, and the `package.json` has a script to extract translations, you can append the engine's `merge-translations` command:

```json
{
  "scripts": {
    "extract-translations": "i18next && npx @kizenapps/engine merge-translations"
  }
}
```

In order for translated strings to appear, you'll need to pass the app's translation function to the `AppEngineProvider`. You can disable localization by leaving off this prop, and all text will appear in the default english language.

### Engine Usage

Your app needs to be wrapped in the `AppEngineProvider`. This provider gives the internal components access to the worker runner, network requests, and other consumer-specific features, and adapts your application's common UI components like modals and toasts to a common API that plugins can use.

#### Context Provider

```tsx
import { AppEngineProvider } from '@kizenapps/engine/react';
import { useHistory } from 'react-router-dom';
import PluginContext from 'contexts/Plugins';
import { useTranslation } from 'react-i18next';

const AppProvider = ({ user, teamMember, business, clientObject }) => {
  const history = useHistory();

  const onNavigate = useCallback(
    (path: string, args?: { replace?: boolean }) => {
      if (args?.replace) {
        history.replace(path);
      } else {
        history.push(path);
      }
    },
    [history],
  );

  const [showToast, , clearToasts] = useToast();

  const [integrationModalProps, , integrationModalTriggerProps] = useModal({});

  const { onConfirm, show, onHide } = integrationModalProps;
  const { show: showPrompt, showing } = integrationModalTriggerProps;

    const { t } = useTranslation();


  return (
    <AppEngineProvider
      user={user}
      teamMember={teamMember}
      business={business}
      clientObject={clientObject}
      onNavigate={onNavigate}
      monitoringExceptionHelper={onError}
      showToast={showToast}
      clearToasts={clearToasts}
      modal={{
        showing,
        show,
        onConfirm,
        onHide,
        showPrompt,
      }}
      performRequest={performKizenRequest}
      appPath={import.meta.env.VITE_API_BASE_PATH}
      bootstrapPlugins={pluginApps}
      performFileUpload={FileService.upload}
      getPendingCacheCount={getPendingCacheCount}
      invalidateCache={invalidateCache}
      t={t}
    >
      {({
        handleCreateRecordComplete,
        handleCreateRelatedRecordComplete,
        showCreateRecordModal,
        showCreateRelatedRecordModal,
        createRecordModalObjectId,
        createRelatedRecordModalObjectId,
        createRelatedRecordModalRelatedEntityId,
        showLoadingIndicator,
        hasFinishedBootstrapping,
        derivedModalState,
        showPluginModal,
        pluginApiName,
        ...rest
      }) => {
        return (
          <PluginContext.Provider
            value={{
              isFetched: hasFetchedBootstrap,
              isLoading,
              pluginNames,
              floatingFrames: isLoading ? [] : floatingFrames,
              routablePages,
              dataAdornments,
              calendarSources,
              refetch,
              fullRefetch,
              installedPluginAPINamesToIds,
              plugins: data,
              toolbarItems,
              toolbarItemsByFullId,
              routeScripts,
              automationSteps: isLoading ? [] : automationSteps,
              objectSettingsMenuItems,
              userConfigsByApiName,
              featureFlags,
              refetchFeatureFlags,
              featureFlagsLoading: !hasCalculatedFeatureFlags && !hasFinishedBootstrapping,
              businessPluginAppsByApiName,
              ...rest,
            }}
          >
            {showLoadingIndicator ? <StyledLoader loading /> : null}
            {children}
            {showPluginModal ? (
              <PluginModal modalState={derivedModalState} pluginApiName={pluginApiName} />
            ) : null}
            {showCreateRecordModal ? (
              <Suspense fallback={null}>
                <CreateRecordModal
                  objectId={createRecordModalObjectId}
                  onComplete={handleCreateRecordComplete}
                />
              </Suspense>
            ) : null}
            {showCreateRelatedRecordModal ? (
              <Suspense fallback={null}>
                <CreateRelatedRecordModal
                  objectId={createRelatedRecordModalObjectId}
                  relatedEntityId={createRelatedRecordModalRelatedEntityId}
                  onComplete={handleCreateRelatedRecordComplete}
                />
              </Suspense>
            ) : null}
          </PluginContext.Provider>
        );
      }}
    </PluginEngineProvider>
  );
};
```

#### Running Scripts

```tsx
import { useGenericPluginCustomScript } from '@kizenapps/engine/react';
import { useToast } from 'components/ToastProvider';

const ScriptButton = ({ pluginScript }: { pluginScript: string }) => {
  const [showToast] = useToast();

  const [executeInline, { pending: inlinePending }] = useGenericPluginCustomScript({
    onError: (e) => {
      showToast({
        message: `Script could not be executed: ${e?.message}`,
        variant: 'failure',
      });
    },
    plugin: item,
  });

  return <button onClick={() => executeInline(pluginScript)} disabled={inlinePending} />;
};
```

#### Worker Runner

Some worker calls are coordinated using `@tanstack/react-query`. If your consumer app also uses react-query, the app engine will use your existing query provider. If you aren't already using react-query, the engine provider will be wrapped in its own query context and no additional action is needed.

### Script Return Values

Scripts can return values from the worker thread. Awaiting the execute function returned from a plugin runner script will yield the value that the worker thread returned.

### Navigation Context

A script can hand a JSON payload to the page it navigates to — for example, to open a custom object page with an unsaved filter already applied. The engine stores the payload in `sessionStorage`, appends a `session_data_key` query param to the target URL, and lets the destination page read it back.

Context only applies to **in-app** (same-origin, relative) navigations. Both targets are supported:

- **`'_self'`** navigates the current tab via the host router.
- **`'_blank'`** opens a new tab. The browser copies the current tab's `sessionStorage` into the new one at open time, so the payload rides along. (This is why the engine opens context-carrying `_blank` tabs without `noopener`/`noreferrer` — that copy only happens while the opener relationship is intact. It is restricted to same-origin URLs so `window.opener` is never exposed cross-origin.)

**External / cross-origin** navigations ignore context entirely and keep the secure `noopener noreferrer` defaults. The reader helpers are **main-thread only** — workers cannot read this state.

#### Passing context from a script

Pass the payload as the third argument to `openWindow`. It is serialized with `JSON.stringify`: circular references and `BigInt` values throw synchronously, while functions, `undefined`, and symbols are silently dropped (standard `JSON.stringify` behavior).

```js
// Same tab:
this.openWindow('/custom-objects/leads/records', '_self', {
  unsavedFilter: {
    /* ...payload */
  },
});

// New tab — same payload, copied into the new tab's sessionStorage:
this.openWindow('/custom-objects/leads/records', '_blank', {
  unsavedFilter: {
    /* ...payload */
  },
});
```

#### Reading context in React

`useAppNavigationContext` takes the current URL (feed it from your router) and returns the payload plus a `clear` callback. Clear it once applied so a back-nav or refresh doesn't reapply stale context.

```tsx
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppNavigationContext } from '@kizenapps/engine/react';

const RecordsPage = () => {
  const { pathname, search } = useLocation();
  const [navContext, clearNavContext] = useAppNavigationContext(`${pathname}${search}`);

  useEffect(() => {
    if (!navContext) return;

    applyUnsavedFilter(navContext.unsavedFilter);

    clearNavContext();
  }, [navContext, clearNavContext]);

  return null;
};
```

#### Reading context outside React

The package root exports plain helpers that all take an explicit URL. `consumeNavigationContext` reads and clears in one call:

```ts
import {
  consumeNavigationContext, // read + clear (default choice)
  readNavigationContext, // read only
  clearNavigationContext, // clear only
} from '@kizenapps/engine';

const context = consumeNavigationContext(window.location.href);

if (context?.unsavedFilter) {
  applyUnsavedFilter(context.unsavedFilter);
}
```
