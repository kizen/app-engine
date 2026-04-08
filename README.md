## Kizen App Engine

The core app engine for the Kizen developer platform for running plugin apps in web workers.

### Installation

```
yarn add @kizenapps/engine
```

### Usage With Vite

The app engine is designed to work with consumers that use Vite, and ships with a vite plugin to do so. This plugin is important for web workers being bundled correctly by the consuming application.

In your `vite.config.ts`:

```ts
import { appEnginePlugin } from '@kizenapps/engine/vite';

export default defineConfig({
  plugins: [appEnginePlugin()],

  // The rest of your config
});
```

### Engine Usage

Your app needs to be wrapped in the `AppEngineProvider`. This provider gives the internal components access to the worker runner, network requests, and other consumer-specific features, and adapts your application's common UI components like modals and toasts to a common API that plugins can use.

#### Context Provider

```tsx
import { AppEngineProvider } from '@kizenapps/engine/react';
import { useHistory } from 'react-router-dom';
import PluginContext from 'contexts/Plugins';

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
