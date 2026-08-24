## Kizen App Engine

The runtime that powers plugin apps on the Kizen developer platform. It executes plugin JavaScript
inside sandboxed Web Workers and brokers everything that crosses the worker boundary — network
requests, rendered UI, modals, toasts, navigation, and file uploads.

**If you are writing a plugin,** you want the [plugin developer
documentation](https://kizen.github.io/app-engine/) (source under [`docs/`](docs/README.md)) and the
`@kizenapps/cli` app builder. The engine is what your plugin runs _on_ — you do not install it
yourself.

**If you are embedding the engine in a host application,** that is what the rest of this README
covers.

### Installation

```
pnpm add @kizenapps/engine
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

The engine has two halves:

- **Worker side** — the `this.*` API a plugin script calls. Fully documented in [`docs/`](docs/README.md); nothing to configure here.
- **Host side** — a React provider plus hooks, which is what you integrate.

The host side is deliberately unopinionated about your UI. You supply primitives — how to navigate,
how to show a toast, how to open a modal, how to make an authenticated request — and the engine
adapts them to the stable API that plugins are written against. That indirection is the point: a
plugin written once runs in any host that satisfies this contract.

#### Context Provider

Wrap your application in `AppEngineProvider`.

**Required props**

| Prop                        | Type                                                                  | Purpose                                                                                         |
| --------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `user`                      | `{ id, crm_client_id }`                                               | The signed-in user.                                                                             |
| `teamMember`                | `{ id, full_name, first_name, last_name, email, phone, created }`     | Team-member profile, exposed to plugins as `this.currentUser.profile`.                          |
| `business`                  | `{ id }`                                                              | The active business/tenant.                                                                     |
| `appPath`                   | `string`                                                              | Your API base path.                                                                             |
| `onNavigate`                | `(path: string, options?: { replace?: boolean }) => void`             | Hand off to your router.                                                                        |
| `performRequest`            | `(method, url, payload?, options?) => Promise<{ data } \| undefined>` | Your authenticated HTTP client. Every plugin `this.get/post/patch/delete` is routed through it. |
| `showToast`                 | `({ message, variant?, autohide? }) => void`                          | Your toast implementation.                                                                      |
| `clearToasts`               | `() => void`                                                          | Dismiss all toasts.                                                                             |
| `monitoringExceptionHelper` | `(error: Error, extra: { extra }) => void`                            | Where uncaught plugin errors are reported.                                                      |
| `modal`                     | `{ showing, show, showPrompt, onConfirm, onHide }`                    | Your confirm/prompt modal primitives.                                                           |
| `children`                  | render prop                                                           | See the render-prop table below.                                                                |

**Optional props**

| Prop                   | Type                                                           | Notes                                                           |
| ---------------------- | -------------------------------------------------------------- | --------------------------------------------------------------- |
| `clientObject`         | `{ id, objectName }`                                           | Contextual record object, when there is one.                    |
| `bootstrapPlugins`     | `{ id, api_name }[]`                                           | Plugins to bootstrap on mount. Defaults to `[]`.                |
| `userConfigs`          | `{ config, api_name }[]`                                       | Per-user plugin config. Defaults to `[]`.                       |
| `onCompleteSetup`      | `(pluginApiName, payload, options?) => Promise<unknown>`       | Persist a plugin's setup-assistant result.                      |
| `createFileId`         | `() => string`                                                 | Required only if plugins upload files.                          |
| `performFileUpload`    | `(args) => Promise<unknown>`                                   | Required only if plugins upload files.                          |
| `getPendingCacheCount` | `(search: string) => number`                                   | Lets the engine wait on your in-flight cache writes.            |
| `invalidateCache`      | `(category: 'timeline' \| 'entity', entityId: string) => void` | Called when a plugin mutates a record.                          |
| `hideFramesOnModal`    | `boolean`                                                      | Hide floating frames while a modal is open. Defaults to `true`. |
| `t`                    | `(s: string) => string`                                        | Translation function. Omit for English.                         |

**A minimal integration**

```tsx
import { AppEngineProvider } from '@kizenapps/engine/react';
import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';

const AppProvider = ({ user, teamMember, business, children }) => {
  const navigate = useNavigate();

  const onNavigate = useCallback(
    (path: string, options?: { replace?: boolean }) => {
      navigate(path, { replace: Boolean(options?.replace) });
    },
    [navigate],
  );

  return (
    <AppEngineProvider
      user={user}
      teamMember={teamMember}
      business={business}
      appPath={API_BASE_PATH}
      onNavigate={onNavigate}
      performRequest={myApiClient.request}
      showToast={myToast.show}
      clearToasts={myToast.clearAll}
      monitoringExceptionHelper={reportError}
      modal={myConfirmModal}
    >
      {({ showLoadingIndicator, showPluginModal, pluginApiName, derivedModalState }) => (
        <>
          {showLoadingIndicator ? <YourSpinner /> : null}
          {children}
          {showPluginModal ? (
            <YourPluginModal modalState={derivedModalState} pluginApiName={pluginApiName} />
          ) : null}
        </>
      )}
    </AppEngineProvider>
  );
};
```

**The render prop**

The engine tells you _when_ to render something and _what_ to render it for; you supply the
component. Alongside the modal callbacks it passes:

| Key                                                                                                                                                | Meaning                                                                               |
| -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `showLoadingIndicator`                                                                                                                             | A blocking plugin script is running.                                                  |
| `hasFinishedBootstrapping`                                                                                                                         | All bootstrapped plugins have loaded.                                                 |
| `waitingOnRouteScript`                                                                                                                             | A route script is still resolving.                                                    |
| `hiddenByModal`                                                                                                                                    | Floating frames are hidden behind a modal.                                            |
| `showPluginModal`, `pluginApiName`, `derivedModalState`                                                                                            | Render a plugin-owned modal.                                                          |
| `showCreateRecordModal`, `createRecordModalObjectId`, `handleCreateRecordComplete`                                                                 | A plugin asked for a record-creation modal. Call the handler with the created record. |
| `showCreateRelatedRecordModal`, `createRelatedRecordModalObjectId`, `createRelatedRecordModalRelatedEntityId`, `handleCreateRelatedRecordComplete` | Same, for a related record.                                                           |
| `handleShowModal`, `handleShowCreateRecordModal`, `handleShowCreateRelatedRecordModal`, `closeCurrentModal`                                        | Imperative modal controls.                                                            |

#### Running Scripts

Hooks are provided for each surface a plugin script can run on. The generic one:

```tsx
import { useGenericAppCustomScript } from '@kizenapps/engine/react';

const ScriptButton = ({ plugin, pluginScript }) => {
  const [executeInline, { pending }] = useGenericAppCustomScript({
    plugin,
    onError: (e) => {
      myToast.show({
        message: `Script could not be executed: ${e?.message}`,
        variant: 'failure',
      });
    },
  });

  return <button onClick={() => executeInline(pluginScript)} disabled={pending} />;
};
```

Surface-specific equivalents are exported from `@kizenapps/engine/react` — `useAppPage`,
`useCustomBlock`, `useFloatingFrame`, `useRecordDetailCustomScript`,
`useCalendarSourceCustomScript`, and others.

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

### Development

This repo uses pnpm.

```
pnpm install
pnpm build         # extract translations, bundle with tsup, verify worker bundles
pnpm test          # unit tests
pnpm typecheck
pnpm lint
pnpm format:check
```

`pnpm build` finishes by running `scripts/check-worker-bundles.js`, which fails the build if a
worker bundle pulls in code that must never run inside a worker (`localStorage`, React, and
similar) or if the worker chunks exceed their size budget.

The plugin developer documentation lives in [`docs/`](docs/README.md) and publishes to GitHub Pages
on merge to `main`. Its static-site generator is a standalone project under `docs/site`, with its
own lockfile and tests.

### License

Licensed under the GNU General Public License, version 3. See [LICENSE.md](LICENSE.md) for the full
text.

This matches the other published Kizen developer platform packages, `@kizenapps/cli` and
`@kizenapps/packager`. Note that the plugins themselves are licensed separately, under GPL 2.0.
