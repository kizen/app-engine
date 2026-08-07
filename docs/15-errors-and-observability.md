# Errors and observability

**What this covers:** how failures behave in the plugin worker runtime, and which of the three
failure channels — `throw`, `this.onError`, `this.showToast` — belongs to which kind of failure.
Also: the `*WithErrors` tuple convention, the shape of request errors, retry patterns, and exactly
what a plugin author can and cannot see at runtime.

**See also:** [worker runtime API](04-worker-runtime-api.md) · [platform API](05-platform-api.md) ·
[auth, secrets, services](06-auth-secrets-services.md) ·
[Agentic Workflow steps](07-automation-steps.md) · [gotchas](17-gotchas.md)

---

## 1. The doctrine in one table

| Situation | Channel | What the user sees | Where it lands |
|---|---|---|---|
| Expected failure: bad input, service disconnected, upstream 4xx, nothing found, user canceled | `this.showToast(msg, {variant: 'failure', autohide: false})` then `return` | a readable failure toast | nowhere else |
| A failure you have identified as a **Kizen platform** defect, where the script can still finish usefully | `this.onError(err)` | a host failure toast, no message you control | platform monitoring, triaged as a platform issue |
| A genuinely unexpected crash — invariants broken, state you cannot recover from | uncaught `throw` | a host failure toast, script stops | platform monitoring, triaged as a platform issue |

The rule behind the table: **errors reported through `onError` or an uncaught throw are routed
to Kizen's monitoring stack and triaged by platform engineering as platform faults.** A plugin
that reports its own expected failures that way generates platform alerts for another team, and
gives the user no actionable message in exchange. Reserve both channels for real
platform problems; everything a user could plausibly cause or fix gets a toast.

```js
// expected failure — the service is not connected yet
const [data, error] = await this.getWithErrors(this.getServiceUrl("example_service", "/v1/items"));
if (error) {
  this.showToast(`Could not reach the example service: ${describeError(error)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}
```

---

## 2. `throw` — aborts the script

The engine wraps every script body in `try { … } catch (ex) { this.onError(ex) } finally { cleanup }`.
So a `throw` from anywhere in your script:

1. **Stops the rest of your script.** No statement after the throw point runs.
2. Is reported through `onError`, i.e. into platform monitoring, with only `error.message`
   surviving the worker boundary.
3. Still **completes the run** from the host's point of view — cleanup runs, the loading
   indicator resets, the run's result is `undefined`.

Because the `finally` is unconditional, a `blocking: true` route script releases app render on a
thrown error exactly as it does on normal completion. A hung page can only come from a script
that never settles, not from one that throws.

There is no way to catch a throw *outside* your script or attach a handler to it — if you want
control, catch it yourself.

## 3. `this.onError(error?)` — reports without stopping

```ts
onError(error?: unknown): void
```

Posts an error report to the host and **keeps running**. The next statement executes. That is
the whole difference from a throw.

Only `error.message` crosses the worker boundary. Custom fields, `cause`, stack traces, and
error subclasses are all lost — the host receives `{message}` and nothing else. If context
matters, put it in the message, or log the structure with `this.console.log` first:

```js
this.console.log("Unexpected object detail shape", { objectId, payload });
this.onError(new Error(`example_plugin: object ${objectId} detail is missing fields[]`));
```

With `this.debug = true`, `onError` additionally hits a `debugger` statement — useful while
developing, never in shipped code.

## 4. `this.showToast` — the channel for expected failures

```ts
showToast(message: string, options?: { variant?: 'alert' | 'failure' | 'success'; autohide?: boolean }): void
```

Conventions worth following:

- Failure toasts are **sticky** (`autohide: false`) and carry a *described* reason, so the user
  can read and act on it.
- Success confirmations autohide.
- `variant: 'alert'` is the neutral/informational tone ("Canceled — nothing was submitted").
- Replace a progress toast rather than stacking: `clearToasts()` then the outcome toast.

### Normalize the error before you display it

The error half of a tuple can be a `KizenRequestError`, a plain object from an absolute-URL
fetch, or a string. Two traps make naive display go wrong: `String(err)` on an object yields
`[object Object]`, and **`Error.message` is non-enumerable, so `JSON.stringify(err)` yields
`"{}"`**. Read `.message` first, and guard the stringify (circular errors throw):

```js
const describeError = (error) => {
  if (typeof error === "string") return error;
  if (error?.message) return error.message;
  try {
    return error ? JSON.stringify(error) : null;
  } catch {
    return null;
  }
};
```

This helper appears verbatim in every script that needs it — event scripts cannot share modules,
so copying it is correct (see [worker runtime API](04-worker-runtime-api.md#11-one-fresh-worker-per-script-run)).

The same trap bites control flow, not just display: matching on error *text* (for example
treating a "…already exists." validation message as success for an idempotent create) must read
`.message`, never a stringified error.

---

## 5. The `*WithErrors` tuple convention

**Use `getWithErrors` / `postWithErrors` / `patchWithErrors` / `deleteWithErrors` exclusively in
new code.**

```ts
type RequestWithErrorsResponse = Promise<[unknown | null, KizenRequestError | null]>;
```

The plain variants (`get`, `post`, `patch`, `delete`) do two unhelpful things on failure: they
call `this.onError` internally — so an ordinary upstream 404 becomes a platform-monitoring
report — and they resolve **`undefined`**, so the caller cannot distinguish a failure from a
successful empty response. The tuple variants never throw, never report, and hand you the
decision.

The canonical shape of a call site:

```js
const [record, error] = await this.getWithErrors(`/records/example_object/${recordId}`);
if (error) {
  this.showToast(`Could not load the record: ${describeError(error)}`, {
    variant: "failure",
    autohide: false,
  });
  return;
}
// `record` is trustworthy from here
```

Notes that decide real branches:

- **`deleteWithErrors` resolves `[null, null]` on a 204.** A null data half is not a failure
  signal — always branch on the error half.
- The tuple form works for absolute URLs too, but the error there is the raw
  `{status, statusText, body}` object thrown by the fetch path, not a `KizenRequestError`.
- `{ignoreCache: true}` matters for correctness after a write, because relative GETs are cached
  for the life of the worker.

## 6. `KizenRequestError`: proxy vs upstream status

```ts
class KizenRequestError extends Error {
  proxyStatus: number;         // status of the Kizen-side request
  upstreamStatus?: number;     // status the external service returned, when the call was proxied
  upstreamResponse?: unknown;  // parsed upstream body, when available
  message: string;             // upstreamResponse.error.message, else `Request failed with status code N`
}
```

Errors from relative-URL calls are real `KizenRequestError` instances, reconstructed inside the
worker after crossing the message boundary — `instanceof` works and `.message` is populated.

The two-status split is the part that surprises people. When you call an external system through
[`getServiceUrl`](04-worker-runtime-api.md#thisgetserviceurlservicename-path), there are two
hops: worker → Kizen proxy, and proxy → external service. If the proxy reached the service and
the *service* failed, the Kizen-side request succeeded:

| Situation | `proxyStatus` | `upstreamStatus` |
|---|---|---|
| Kizen API call failed (permissions, bad path, validation) | the real 4xx/5xx | absent |
| Proxied call, external service returned 404/429/500 | `200` | the real upstream status |
| Proxied call, the service is not authorized/connected | `503` | absent |

So branch on `upstreamStatus ?? proxyStatus` when you care about the external system's answer,
and treat a proxy `503` as "this service is not connected" rather than as an outage:

```js
const [data, error] = await this.getWithErrors(this.getServiceUrl("example_service", "/v1/items"));
if (error) {
  const status = error.upstreamStatus ?? error.proxyStatus;
  const message =
    error.proxyStatus === 503
      ? "The Example service is not connected. Authorize it in the plugin setup, then try again."
      : `Example service request failed (${status}): ${describeError(error)}`;
  this.showToast(message, { variant: "failure", autohide: false });
  return;
}
```

A further wrinkle worth handling for chatty APIs: some services return HTTP 200 with an
error flag in the body. A successful tuple is not proof of success — check the payload's own
status field where the vendor has one.

## 7. Calendar sources: 503 becomes an auth error, and degrade to `[]`

Calendar-source scripts run inside a data query, and two behaviors are specific to them:

- **A 503 from the proxy is interpreted by the host as an authorization failure for that
  source**, and the calendar surfaces it as "needs authorization" rather than as a generic
  error. You do not need to detect it yourself — but do not mask it by catching and returning
  something else.
- **Return `[]` rather than throwing when a fetch fails.** A calendar source that throws tears
  down its part of the calendar; one that returns an empty array degrades to "no events" and
  leaves the rest of the calendar working. Log the reason with `this.console` on the way out.

```js
const [payload, error] = await this.getWithErrors(
  this.getServiceUrl("example_service", `/v1/calendars/${this.args.calendar.calendar_id}/events`),
);
if (error) {
  this.console.warn("example_plugin: event fetch failed, returning no events", describeError(error));
  return [];
}
return (payload?.items ?? []).map(toKizenEvent);
```

The return value is schema-validated by the host. An event whose `start_time`/`end_time` are not
epoch-ms numbers, or a calendar entry missing `id`/`name`, fails validation for the whole
result — see [routes, calendars, adornments, settings](12-routes-calendars-adornments-settings.md).

## 8. Retries and rate limits

### In a worker script

The engine imposes no execution timeout, but a user is watching, so keep retry budgets small and
show progress. `this.wait(ms)` is the sleep primitive.

```js
const MAX_RETRIES = 3;

const fetchWithRetry = async (url) => {
  for (let attempt = 0; ; attempt += 1) {
    const [data, error] = await this.getWithErrors(url, { ignoreCache: true });
    if (!error) return [data, null];

    const status = error.upstreamStatus ?? error.proxyStatus;
    const retryable = status === 429 || (status >= 500 && status !== 503);
    if (!retryable || attempt >= MAX_RETRIES) return [null, error];

    await this.wait(2 ** attempt * 1000);
  }
};
```

Points that matter:

- Read the rate-limit status from `upstreamStatus` first — a proxied 429 arrives with
  `proxyStatus: 200`.
- `503` from the proxy means "not authorized", not "busy" — retrying it never helps.
- The relative-GET cache would otherwise serve the first failed attempt forever within a
  preserved worker; `{ignoreCache: true}` keeps retries real.
- Give the user a sticky toast when the budget is exhausted, not silence.

### In a Python Agentic Workflow step

Steps are killed at a **55-second hard ceiling**, so retry logic must fit inside it — and the
design target is about **30 seconds**, which leaves a retry's worth of headroom before the kill.
Honor `Retry-After` when it is present and small, and raise with an actionable message rather than
sleeping past the budget. `Retry-After` can be an integer number of seconds or an HTTP date —
handle both if the vendor uses dates.

```python
import time, requests

MAX_RETRIES = 3
RETRY_AFTER_CAP_SECONDS = 50

def call_with_retry(url, headers):
    response = requests.get(url, headers=headers, timeout=10)
    attempt = 0
    while response.status_code == 429 and attempt < MAX_RETRIES:
        attempt += 1
        header = response.headers.get("Retry-After")
        delay = int(header) if header and header.isdigit() else 2 ** attempt
        if delay > RETRY_AFTER_CAP_SECONDS:
            raise RuntimeError(
                f"Example service is rate limited for {delay}s — re-run this workflow later."
            )
        outputs.log(f"{url} -> 429; retry {attempt}/{MAX_RETRIES} after {delay}s")
        time.sleep(delay)
        response = requests.get(url, headers=headers, timeout=10)
    return response
```

In a step, a **raised exception is the user-facing error surface** — it is what the workflow run
history shows. Raise with a prefixed, actionable message (`"Example service error: 401 — reconnect
the service in plugin setup"`), and use `outputs.log(...)` for the breadcrumbs. See
[Agentic Workflow steps](07-automation-steps.md).

---

## 9. Failures that are silent unless you look for them

| Failure | How it presents | What to do |
|---|---|---|
| Plain `get/post/patch/delete` failing | resolves `undefined`, reports to platform monitoring | use `*WithErrors` |
| `deleteWithErrors` on 204 | `[null, null]` | branch on the error half only |
| Script syntax error | the run reports "The script has a syntax error and could not be parsed"; nothing else runs | syntax-check bodies allowing top-level `await`/`return` |
| `runEventScript` / `communicate.runBlockScript` / `runFrameScript` | fire-and-forget `void`; a missing target or a failing target script is a no-op | have the target report its own outcome (toast, session data) |
| `postFormData` | rejects with **no reason** on failure | wrap in try/catch and compose your own message |
| `installThirdPartyScript` | **never rejects** — resolves `undefined` and reports the failure through a fixed `onError`, so try/catch catches nothing | branch on the returned handle being falsy, not on a throw |
| `this.authorize` | returns `void`; success/failure happens in another tab | tell the user what to do next; do not wait on it |
| `this.copyToClipboard` | clipboard failure is reported host-side, not returned | pair with a toast so the user gets feedback |
| `outputView` | not implemented end-to-end; silently does nothing | use `showViewInModal` or paint with `outputUI` |
| Modal calls with no host modal handler | resolve `{canceled: true}` | indistinguishable from a real cancel — do not infer failure from it |
| `openWindow` with a `context` payload on an absolute URL | navigates, payload silently dropped | keep context-carrying navigation relative |
| `refreshEntityForId` after its 30s timeout | **rejects** with `undefined` — no `Error`, no message | catch it bare; do not read `.message` off the caught value |
| `refreshEntity` (the no-arg form) | returns `void` and discards the inner promise, so a timeout becomes an unhandled rejection | call `refreshEntityForId(this.entityId)` and handle it when you care |
| A form field named for a DOM property (`name="name"`) | the attribute is stripped by sanitization; the value never reaches `formData` | prefix or hyphenate field names |

---

## 10. What you can and cannot observe at runtime

**You can:**

- Write to the host page console with `this.console.log/warn/error/info/debug`. Values are
  serialized across the worker boundary with handling for `undefined`, bigint, symbol, function,
  `Error`, `Date`, `RegExp`, and circular references, and the bridge never throws into your code.
  This is the primary debugging instrument — log the full request payload alongside the error on
  every write failure so a live 400 diagnoses itself.
- Inspect the error half of every `*WithErrors` tuple, including `proxyStatus`,
  `upstreamStatus`, and `upstreamResponse`.
- Set `this.debug = true` during development for engine-side logging of the script body and
  execution time, plus a `debugger` break on `onError`.
- Surface state to the user yourself with toasts, `setIndicator`, and painted output.
- Persist breadcrumbs across runs in `sessionData` (per browser session) or user config
  (durable) when you need to observe a multi-run flow.

**You cannot:**

- Read back anything you reported through `onError` or a throw. There is no runtime API for a
  plugin's own error history, and only `error.message` ever left the worker.
- See a stack trace across the worker boundary.
- Observe whether a fire-and-forget call (`runEventScript`, `communicate.*`, `outputUI`,
  `authorize`, `refreshTimelineForId`) actually did anything.
- Attach a global error or unhandled-rejection handler — there is no `addEventListener` in the
  script context, and the engine's wrapper owns the top-level catch.
- Time out a hung call yourself except by racing it against `this.wait(ms)`; the engine will not
  do it for you.
- Rely on state living on `this` between runs to correlate events — every run is a fresh worker
  ([execution model](04-worker-runtime-api.md#1-execution-model)).

---

## 11. `notify_plugin_developer_on_failure` — not what the name promises

If you go looking for a way to learn that a customer's workflow step is failing, you will find this
flag. **It will not tell you.** The name is misleading in a way worth spelling out, because
designing around it produces a monitoring gap you think you have covered.

**What it actually is.** A boolean on the workflow step record — not a manifest field, not
something your plugin declares or controls. The *customer* sets it per step instance while building
their workflow. It defaults to `false`.

**Who it notifies.** The employee at the **customer's own business** who enabled the plugin. The
lookup resolves the install record's "enabled by" employee, and that field is populated at install
time from whoever clicked enable. There is no reference anywhere in that path to the plugin's
developer business. **A plugin author at a different business receives nothing.**

**What it sends.** Not a bespoke developer report — the generic automation-owner failure email,
subject `Step "<step type>" Failed on Agentic Workflow "<name>"`. The step name is the generic type
label, not your action's name, and the body carries links to the workflow and its failed executions
with **no traceback and no error detail**.

**When it is suppressed.** Debug-mode runs never notify. There is a shared **24-hour throttle keyed
on the step**, so one email per step per day regardless of how many executions fail — and the
throttle is shared with the automation-owner email, so whichever fires first consumes the window
for both.

### What this means for you

There is currently **no mechanism by which a plugin author learns that a customer's step is
failing.** Nothing is emailed, pushed, or exposed to another business. Plan accordingly:

- **Make the failure message self-sufficient.** The error text you raise is what the customer sees
  in run history, and it is the entire diagnostic surface. Prefix it with the plugin and a stable
  code — `"Example Plugin error: bad_credentials — reconnect the service in Setup"` — so a support
  ticket arrives already diagnosed.
- **Instrument on your own side** if you need failure visibility: have the step report to a service
  you control before raising. That is an outbound call from the step, subject to the same execution
  budget as everything else.
- **Do not tell customers to enable the flag so you get alerted.** They will enable it, receive the
  email themselves, and assume you were notified too.

---

## Gotchas

- **`onError` and uncaught throws are platform-fault channels.** They are triaged by Kizen
  platform engineering and give the user nothing actionable. Expected failures get a toast.
- **`onError` does not stop the script**; a `throw` does. Mixing them up produces scripts that
  keep running after a fatal condition, or that abort on a recoverable one.
- **Only `error.message` crosses the worker boundary.** Structured error data is lost — put what
  matters in the message or log it first.
- **`Error.message` is non-enumerable**, so `JSON.stringify(err)` yields `"{}"`. Read `.message`
  first, in display *and* in any text-matching control flow.
- **Plain HTTP helpers report to platform monitoring on your behalf** and then resolve
  `undefined`. That is two problems in one call. Use `*WithErrors`.
- **A proxied upstream failure carries `proxyStatus: 200`.** Branch on
  `upstreamStatus ?? proxyStatus`.
- **Proxy `503` means the service is not authorized**, not that it is overloaded — retrying is
  pointless, and for calendar sources the host already reads it as an auth failure.
- **HTTP 200 is not proof of success** for services that report errors in the response body.
- **Calendar sources must degrade, not throw** — return `[]` and log.
- **Python steps are killed at 55 seconds** (design to 30 so a retry fits); a retry sleep that
  runs past the ceiling converts a rate-limit into a timeout. Raise with an actionable message
  instead.
- **A blocking route script always releases**, on success and on throw alike; only a
  never-settling script hangs the page.
- **`{canceled: true}` from a modal can mean "no modal handler was wired"**, not "the user
  canceled".
- **The engine has no execution timeout.** Nothing rescues a script awaiting a promise that never
  resolves.
