# Google Calendar v2.0.1

Create Events in Google Calendar for Date and Date Time fields

## Configuration (`kizen.json`)

```json
{
  "name": "Google Calendar",
  "version": "2.0.1",
  "api_name": "google_calendar",
  "description": "Create Events in Google Calendar for Date and Date Time fields",
  "release_branches": [
    "main"
  ],
  "release_environments": [
    "dev",
    "prod"
  ],
  "entry": "src/",
  "engine": "1.0.0",
  "release_notes_directory": "releaseNotes/",
  "config_template": {},
  "base_config": {},
  "services": [
    {
      "service_name": "personal",
      "display_name": "Google Calendar",
      "auth_type": "oauth",
      "auth_level": "user",
      "required_entitlement": null,
      "base_service_url": "https://www.googleapis.com",
      "auth_credentials": {
        "client_id": "*****",
        "client_secret": "*****",
        "scopes": "*****",
        "authorize_url": "*****",
        "token_url": "*****",
        "content_type": "*****",
        "token_field_name": "*****",
        "default_token_expiry": "*****",
        "authorize_params": "*****",
        "success_redirect_path": "*****",
        "error_redirect_path": "*****"
      }
    }
  ]
}
```

## File Tree

```
├── releaseNotes/
│   ├── 1.0.0.md
│   ├── 1.0.1.md
│   ├── 1.0.11.md
│   ├── 1.0.17.md
│   ├── 1.0.18.md
│   ├── 1.0.2.md
│   ├── 1.0.3.md
│   ├── 1.0.4.md
│   ├── 1.0.5.md
│   ├── 1.0.7.md
│   ├── 1.0.8.md
│   ├── 1.0.9.md
│   ├── 2.0.0.md
│   └── 2.0.1.md
├── src/
│   ├── calendarSources/
│   │   └── personal/
│   │       ├── calendars.js
│   │       ├── config.json
│   │       └── events.js
│   ├── dataAdornments/
│   │   ├── date/
│   │   │   ├── config.json
│   │   │   └── script.js
│   │   └── datetime/
│   │       ├── config.json
│   │       └── script.js
│   ├── setupAssistant/
│   │   ├── enabledBusinessCalendars/
│   │   │   ├── getFetchUrl.js
│   │   │   └── optionMapper.js
│   │   └── assistant.json
│   ├── userSetupAssistant/
│   │   ├── enabledUserCalendars/
│   │   │   ├── getFetchUrl.js
│   │   │   └── optionMapper.js
│   │   └── assistant.json
│   └── thumbnail.png
├── .gitignore
└── README.md
```

## Files

### `.gitignore`

```
.DS_Store
.kizenapp/

```

### `README.md`

```markdown
# Google Calendar Plugin

### Overview

This plugin connects Kizen to Google Calendar. It has two independent features:

1. **Add to Google Calendar** — a data adornment on Date and Date/Time fields that opens a pre-filled "create event" link in Google Calendar for that field's value.
2. **Personal Calendar Sync** — lets each user connect their own Google account via OAuth so their Google Calendar events show up on the scheduled activities calendar dashlet alongside their Kizen activities.

Both features are enabled by default and can be toggled independently by business administrators.

---

### Prerequisites

- A Google Cloud project with the Google Calendar API enabled, and an OAuth client ID/secret configured under the `personal` service in [kizen.json](kizen.json)
- Users must have a Google account to connect (Personal Calendar Sync only)

---

### Feature 1: Add to Google Calendar

Adds a calendar icon adornment next to any Date or Date/Time field ([src/dataAdornments/date](src/dataAdornments/date), [src/dataAdornments/datetime](src/dataAdornments/datetime)). Clicking it opens `calendar.google.com` in a new window with the event pre-filled:

- **Title** — built from the related object/record name, and the activity name if the field belongs to a scheduled activity
- **Details** — a link back to the record (or scheduled activity) in Kizen
- **Date/time** — the field's value; Date fields create an all-day event, Date/Time fields create a 30-minute event
- **Timezone** — the business's configured timezone

This does not require OAuth — it only builds a URL and opens Google's own event-creation page.

**Business setup:** In the business-level plugin config, toggle **Enable Data Adornment** (`enableAdornments`, default `true`). Disabling it removes the adornment for all users of the business.

---

### Feature 2: Personal Calendar Sync

Lets a user OAuth into their own Google account so their calendar events appear on the scheduled activities calendar dashlet.

- [src/calendarSources/personal/calendars.js](src/calendarSources/personal/calendars.js) lists the user's Google calendars (`GET /calendar/v3/users/me/calendarList`), filtered down to the calendars the user has enabled.
- [src/calendarSources/personal/events.js](src/calendarSources/personal/events.js) fetches events for a given calendar and date range (`GET /calendar/v3/calendars/{calendar_id}/events`) and maps them into Kizen's event shape (title, description, start/end time, all-day flag, busy/free, attendees, link). Events created by Kizen's own scheduled activities (identified by a `--` in the Google `iCalUID`) are tagged with their originating `activity_id` so they aren't duplicated on the dashlet.

**Business setup:** Toggle **Enable External Calendars** (`enableExternalCalendars`, default `true`) in the business-level plugin config. Disabling it removes the feature for all users of the business.

**User setup:** Each user connects their own Google account from their plugin settings (OAuth, `personal` service — see [kizen.json](kizen.json)). Once connected, they choose:

- **Enable All Calendars** (`enableAllCalendars`, default `true`) — sync every calendar the user has access to
- **Enabled Calendars** (`enabledUserCalendars`) — when "Enable All Calendars" is off, an explicit multi-select list of which calendars to sync

A user's calendar selection and connection are private to that user — other users of the business do not get access to those calendars.

**OAuth scopes requested:** `userinfo.email`, `userinfo.profile`, `calendar.readonly`, `calendar.calendars.readonly`, `calendar.events.readonly`, `calendar.events.public.readonly` (read-only — the plugin never writes to a user's Google Calendar).

---

### Configuration Reference

| Level    | Key                     | Type    | Default | Description                                                                 |
| -------- | ----------------------- | ------- | ------- | ----------------------------------------------------------------------------- |
| Business | `enableAdornments`      | boolean | `true`  | Show the "Add to Google Calendar" icon on Date/Date-Time fields             |
| Business | `enableExternalCalendars` | boolean | `true`  | Allow users to connect their Google account and sync calendars              |
| User     | `enableExternalCalendars` | boolean | `true`  | This user's opt-in to sync their calendars (shown when the business setting above is on) |
| User     | `enableAllCalendars`    | boolean | `true`  | Sync all of the user's calendars instead of a specific selection            |
| User     | `enabledUserCalendars`  | select (multi) | — | Which calendars to sync, when "Enable All Calendars" is off                 |

---

### Release Notes

See [releaseNotes/](releaseNotes/) for the version history, or [releaseNotes/2.0.0.md](releaseNotes/2.0.0.md) for the most recent major update (business-level toggle for the adornment, and per-user Google Calendar sync on the scheduled activities dashlet).

```

### `releaseNotes/1.0.0.md`

```markdown
Release notes for version 1.0.0

```

### `releaseNotes/1.0.1.md`

```markdown
Migrated scripts from django admin

```

### `releaseNotes/1.0.11.md`

```markdown
separate out date and date time adornments

```

### `releaseNotes/1.0.17.md`

```markdown
remove special characters when building event name that Google Calendar couldn't handle

```

### `releaseNotes/1.0.18.md`

```markdown
- Separated out date and datetime adornments
- Filter special characters in Kizen field display names, custom object names, and activity names

```

### `releaseNotes/1.0.2.md`

```markdown
updated script to simplify branching logic

```

### `releaseNotes/1.0.3.md`

```markdown
readd date adornment

```

### `releaseNotes/1.0.4.md`

```markdown
remove date adornment for now, date fields will be supported in kizen via datetime due to bug

```

### `releaseNotes/1.0.5.md`

```markdown
fix go env base url

```

### `releaseNotes/1.0.7.md`

```markdown
add date adornment after duplicate adornment fix

```

### `releaseNotes/1.0.8.md`

```markdown
remove date adornment temporarily for prod deploy

```

### `releaseNotes/1.0.9.md`

```markdown
Prepare plugin for production release

```

### `releaseNotes/2.0.0.md`

```markdown
Version 2.0 of the Google Calendar app brings a number of major new features and improvements:

- At the business level, app administrators can now choose to enable or disable the "add to calendar" icon.
- Events from Google Calendar can now be displayed on your scheduled activities calendar dashlet for scheduling assistance.
  - Users can OAuth with their individual Google accounts to see their own calendars on the scheduled activities calendar dashlet.
  - The Google Calendar integration is enabled by default for existing calendar dashlets, but can be disabled at the business level by app administrators.

```

### `releaseNotes/2.0.1.md`

```markdown
- Improvements to the Google OAuth service

```

### `src/calendarSources/personal/calendars.js`

```javascript
const allCalendarsEnabled = this.userConfig.enableAllCalendars ?? true; // Default to true
const calendarFilterList =
  this.userConfig.enabledUserCalendars?.map((calendar) => calendar.value) || [];

const [data, errors] = await this.getWithErrors(
  this.getServiceUrl("personal", "/calendar/v3/users/me/calendarList"),
);

if (errors) {
  return [];
}

return data.items
  .map((calendar) => ({
    id: calendar.id,
    description: calendar.description,
    name: calendar.summary,
    default: calendar.primary || false,
  }))
  .filter((calendar) => {
    if (allCalendarsEnabled) {
      return true;
    }

    if (calendarFilterList.includes(calendar.id)) {
      return true;
    }

    return false;
  });

```

### `src/calendarSources/personal/config.json`

```json
{
  "name": "Google Calendar - Employee",
  "api_name": "personal",
  "when": "Boolean({{userConfig.enableExternalCalendars}}) && Boolean({{config.enableExternalCalendars}})"
}

```

### `src/calendarSources/personal/events.js`

```javascript
const { range_start, range_end, calendar_id } = this.args.calendar;

// An all-day event from google will have a start and end date, but not
// a start or end datetime.
const isAllDayEvent = (event) => {
  return Boolean(
    !event.start.dateTime &&
    !event.end.dateTime &&
    event.start.date &&
    event.end.date,
  );
};

// The date bounds need to be parsed in the user's timezone if they are an all-day event,
// otherwise we get a full timestamp that can be parsed as-is.
const parseDateBounds = (event) => {
  let startDate;
  let endDate;

  try {
    if (isAllDayEvent(event)) {
      startDate = this.createDateObject(event.start.date);
      endDate = this.createDateObject(event.end.date);
    } else {
      startDate = new Date(event.start.dateTime);
      endDate = new Date(event.end.dateTime);
    }
  } catch (ex) {}

  return { startDate, endDate };
};

const [data, errors] = await this.getWithErrors(
  this.getServiceUrl(
    "personal",
    `/calendar/v3/calendars/${encodeURIComponent(calendar_id)}/events?timeMin=${encodeURIComponent(
      range_start,
    )}&timeMax=${encodeURIComponent(range_end)}&singleEvents=true`,
  ),
);

if (errors) {
  return [];
}

return data.items
  .filter((event) => {
    return event.eventType !== "workingLocation";
  })
  .map((event) => {
    const { startDate, endDate } = parseDateBounds(event);

    if (!startDate || !endDate) {
      return null;
    }

    // If the iCalUID has a "--" in it, try to extract an activity ID.
    // This is how the calendar plugin will create events for scheduled activities.
    const activityId = event.iCalUID?.includes("--")
      ? event.iCalUID.split("--")[0]
      : undefined;

    return {
      id: event.id,
      activity_id: activityId,
      calendar_id,
      title: event.summary,
      description: event.description,
      start_time: this.formatDateForResponse(startDate),
      end_time: this.formatDateForResponse(endDate),
      all_day: isAllDayEvent(event),
      // Transparency is how google indicates free/busy
      busy: event.transparency !== "transparent",
      url: event.htmlLink,
      attendees:
        event.attendees
          ?.filter((attendee) => attendee.responseStatus === "accepted")
          .map((attendee) => attendee.email) ?? [],
    };
  })
  .filter((event) => event !== null);

```

### `src/dataAdornments/date/config.json`

```json
{
  "icon": "calendar",
  "color": "blue",
  "tooltip": "Create Google Event",
  "field_type": "date",
  "when": "Boolean({{config.enableAdornments}})"
}

```

### `src/dataAdornments/date/script.js`

```javascript
const toGoogleCalendarTimeRange = (
  input,
  isAllDay = false,
  durationInMinutes = 30
) => {
  const formatDateToGoogle = (dt) =>
    dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const formatDateOnly = (dt) =>
    dt.toISOString().slice(0, 10).replace(/-/g, "");

  if (typeof input === "string") {
    const startDate = new Date(input);

    if (isAllDay) {
      const endDate = new Date(startDate.getTime() + 86400000); // Add 24 hours
      return `${formatDateOnly(startDate)}/${formatDateOnly(endDate)}`;
    } else {
      const endDate = new Date(startDate.getTime() + durationInMinutes * 60000);
      return `${formatDateToGoogle(startDate)}/${formatDateToGoogle(endDate)}`;
    }
  }

  if (input && typeof input === "object" && typeof input.label === "string") {
    const [month, day, year] = input.label.split("/");
    const startDate = new Date(`${year}-${month}-${day}T00:00:00`);
    const endDate = new Date(startDate.getTime() + 86400000);
    return `${formatDateOnly(startDate)}/${formatDateOnly(endDate)}`;
  }

  throw new Error("Date Value invalid");
};

const buildEventName = (record, object, fieldId) => {
  const recordFields = Object.values(record.fields ?? {}) ?? [];
  const fieldName = recordFields.find(
    (field) => field.id === fieldId
  )?.display_name;

  let recordName = recordFields.find(
    (field) => field.name === "display_name"
  )?.value;

  if (!recordName && recordFields.length) {
    recordName = `${
      recordFields.find((field) => field.name === "first_name")?.value
    } ${recordFields.find((field) => field.name === "last_name")?.value}`;
  }

  if (!recordName && !fieldName && !object.object_name && !object.name) {
    return "";
  }

  if (record.activityId) {
    const recordNameResult = (recordName || record.display_name || "").replace(
      /[^a-zA-Z0-9 _-]/g,
      ""
    );
    const objectNameResult = (object.object_name || object.name || "").replace(
      /[^a-zA-Z0-9 _-]/g,
      ""
    );
    return `${objectNameResult}+Activity${
      recordNameResult ? "+-+" + recordNameResult : ""
    }`;
  }
  const objectNameResult = (object.object_name || object.name || "").replace(
    /[^a-zA-Z0-9 _-]/g,
    ""
  );
  const recordNameResult = (recordName || "").replace(/[^a-zA-Z0-9 _-]/g, "");
  const fieldNameResult = (fieldName || "").replace(/[^a-zA-Z0-9 _-]/g, "");
  return `${objectNameResult}${
    recordNameResult ? "+-+" + recordNameResult : ""
  }${fieldNameResult ? "+-+" + fieldNameResult : ""}`;
};

const getAppBaseUrl = () => {
  if (this.applicationPath.includes("integration")) {
    return "https://v2.integration.kizen.dev";
  } else if (this.applicationPath.includes("staging")) {
    return "https://v2.staging.kizen.com";
  } else if (this.applicationPath.includes("go")) {
    return "https://go.kizen.com";
  }
  return "https://fmo.kizen.com";
};

const buildEventDetails = (record, object, activityId) => {
  const baseUrl = getAppBaseUrl();
  if (!object.id || !baseUrl) {
    return "";
  } else if (
    activityId &&
    object.id === this.currentBusiness.client_object.id &&
    record.id
  ) {
    return `View activity in Kizen: ${baseUrl}/client/${record.id}/details?view_scheduled_activity_id=${activityId}`;
  } else if (activityId && record.id) {
    return `View activity in Kizen: ${baseUrl}/custom-objects/${object.id}/${record.id}/details?view_scheduled_activity_id=${activityId}`;
  } else if (activityId) {
    return "";
  } else if (object.id === this.currentBusiness.client_object.id) {
    return `View record in Kizen: ${baseUrl}/client/${record.id}/details`;
  }
  return `View record in Kizen: ${baseUrl}/custom-objects/${object.id}/${record.id}/details`;
};

const getRecordUrl = (
  objectId = "",
  recordId = "",
  fieldNames = "",
  fieldIds = ""
) =>
  `/records/${objectId}/${recordId}?field_names=${fieldNames}&field_ids=${fieldIds}`;
const getObjectUrl = (objectId = "") => `/custom-objects/${objectId}`;
const getActivtyUrl = (activityId = "") => `/activities/${activityId}`;
const getActivityFieldUrl = (objectId = "", fieldId = "") =>
  `/activities/${objectId}/fields/${fieldId}`;

const getScheduledActivityUrl = (activityId) =>
  `/activities/scheduled-activity/${activityId}`;

let record;
let activity = { name: "" };
let object = this.args.objectId
  ? await this.get(getObjectUrl(this.args.objectId))
  : {};

if (this.args.activityId) {
  const scheduledActivity = await this.get(
    getScheduledActivityUrl(this.args.activityId)
  );
  if (scheduledActivity) {
    activity = (await this.get(
      getActivtyUrl(scheduledActivity.activity_object.id)
    )) ?? { name: "" };
    object = {
      ...object,
      object_name: activity?.name || "",
    };
  }

  switch (this.args.fieldId) {
    case "due_datetime":
      record = {
        id: this.args.entityId,
        display_name: "Due Date",
      };
      break;
    case "due_datetime_my_time":
      record = { id: this.args.entityId, display_name: "Due Date" };
      break;
    case "original_due_datetime":
      record = { id: this.args.entityId, display_name: "Original Due Date" };
      break;
    default:
      const fetchedRecord =
        this.args.objectId && this.args.entityId
          ? (await this.get(
              getRecordUrl(
                this.args.objectId,
                this.args.entityId,
                "name",
                this.args.fieldId
              )
            )) ?? {}
          : {};
      record = fetchedRecord;
      break;
  }
  record = { ...record, activityId: this.args.activityId };
} else {
  record =
    (await this.get(
      getRecordUrl(
        this.args.objectId,
        this.args.entityId,
        "name",
        this.args.fieldId
      )
    )) ?? {};
}

const isAllDayEvent = this.args.fieldType === "date";
const dateRange = toGoogleCalendarTimeRange(this.args.value, isAllDayEvent);
const eventName = buildEventName(record, object, this.args.fieldId);
const eventDetails = buildEventDetails(record, object, this.args.activityId);

this.openWindow(
  `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventName}&details=${eventDetails}&dates=${dateRange}&ctz=${this.currentBusiness.timezone.name}`
);

```

### `src/dataAdornments/datetime/config.json`

```json
{
  "icon": "calendar",
  "color": "blue",
  "tooltip": "Create Google Event",
  "field_type": "datetime",
  "when": "Boolean({{config.enableAdornments}})"
}

```

### `src/dataAdornments/datetime/script.js`

```javascript
const toGoogleCalendarTimeRange = (
  input,
  isAllDay = false,
  durationInMinutes = 30
) => {
  const formatDateToGoogle = (dt) =>
    dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const formatDateOnly = (dt) =>
    dt.toISOString().slice(0, 10).replace(/-/g, "");

  if (typeof input === "string") {
    const startDate = new Date(input);

    if (isAllDay) {
      const endDate = new Date(startDate.getTime() + 86400000); // Add 24 hours
      return `${formatDateOnly(startDate)}/${formatDateOnly(endDate)}`;
    } else {
      const endDate = new Date(startDate.getTime() + durationInMinutes * 60000);
      return `${formatDateToGoogle(startDate)}/${formatDateToGoogle(endDate)}`;
    }
  }

  if (input && typeof input === "object" && typeof input.label === "string") {
    const [month, day, year] = input.label.split("/");
    const startDate = new Date(`${year}-${month}-${day}T00:00:00`);
    const endDate = new Date(startDate.getTime() + 86400000);
    return `${formatDateOnly(startDate)}/${formatDateOnly(endDate)}`;
  }

  throw new Error("Date Value invalid");
};

const buildEventName = (record, object, fieldId) => {
  const recordFields = Object.values(record.fields ?? {}) ?? [];
  const fieldName = recordFields.find(
    (field) => field.id === fieldId
  )?.display_name;

  let recordName = recordFields.find(
    (field) => field.name === "display_name"
  )?.value;

  if (!recordName && recordFields.length) {
    recordName = `${
      recordFields.find((field) => field.name === "first_name")?.value
    } ${recordFields.find((field) => field.name === "last_name")?.value}`;
  }

  if (!recordName && !fieldName && !object.object_name && !object.name) {
    return "";
  }

  if (record.activityId) {
    const recordNameResult = (recordName || record.display_name || "").replace(
      /[^a-zA-Z0-9 _-]/g,
      ""
    );
    const objectNameResult = (object.object_name || object.name || "").replace(
      /[^a-zA-Z0-9 _-]/g,
      ""
    );
    return `${objectNameResult}+Activity${
      recordNameResult ? "+-+" + recordNameResult : ""
    }`;
  }
  const objectNameResult = (object.object_name || object.name || "").replace(
    /[^a-zA-Z0-9 _-]/g,
    ""
  );
  const recordNameResult = (recordName || "").replace(/[^a-zA-Z0-9 _-]/g, "");
  const fieldNameResult = (fieldName || "").replace(/[^a-zA-Z0-9 _-]/g, "");
  return `${objectNameResult}${
    recordNameResult ? "+-+" + recordNameResult : ""
  }${fieldNameResult ? "+-+" + fieldNameResult : ""}`;
};

const getAppBaseUrl = () => {
  if (this.applicationPath.includes("integration")) {
    return "https://v2.integration.kizen.dev";
  } else if (this.applicationPath.includes("staging")) {
    return "https://v2.staging.kizen.com";
  } else if (this.applicationPath.includes("go")) {
    return "https://go.kizen.com";
  }
  return "https://fmo.kizen.com";
};

const buildEventDetails = (record, object, activityId) => {
  const baseUrl = getAppBaseUrl();
  if (!object.id || !baseUrl) {
    return "";
  } else if (
    activityId &&
    object.id === this.currentBusiness.client_object.id &&
    record.id
  ) {
    return `View activity in Kizen: ${baseUrl}/client/${record.id}/details?view_scheduled_activity_id=${activityId}`;
  } else if (activityId && record.id) {
    return `View activity in Kizen: ${baseUrl}/custom-objects/${object.id}/${record.id}/details?view_scheduled_activity_id=${activityId}`;
  } else if (activityId) {
    return "";
  } else if (object.id === this.currentBusiness.client_object.id) {
    return `View record in Kizen: ${baseUrl}/client/${record.id}/details`;
  }
  return `View record in Kizen: ${baseUrl}/custom-objects/${object.id}/${record.id}/details`;
};

const getRecordUrl = (
  objectId = "",
  recordId = "",
  fieldNames = "",
  fieldIds = ""
) =>
  `/records/${objectId}/${recordId}?field_names=${fieldNames}&field_ids=${fieldIds}`;
const getObjectUrl = (objectId = "") => `/custom-objects/${objectId}`;
const getActivtyUrl = (activityId = "") => `/activities/${activityId}`;
const getActivityFieldUrl = (objectId = "", fieldId = "") =>
  `/activities/${objectId}/fields/${fieldId}`;

const getScheduledActivityUrl = (activityId) =>
  `/activities/scheduled-activity/${activityId}`;

let record;
let activity = { name: "" };
let object = this.args.objectId
  ? await this.get(getObjectUrl(this.args.objectId))
  : {};

if (this.args.activityId) {
  const scheduledActivity = await this.get(
    getScheduledActivityUrl(this.args.activityId)
  );
  if (scheduledActivity) {
    activity = (await this.get(
      getActivtyUrl(scheduledActivity.activity_object.id)
    )) ?? { name: "" };
    object = {
      ...object,
      object_name: activity?.name || "",
    };
  }

  switch (this.args.fieldId) {
    case "due_datetime":
      record = {
        id: this.args.entityId,
        display_name: "Due Date",
      };
      break;
    case "due_datetime_my_time":
      record = { id: this.args.entityId, display_name: "Due Date" };
      break;
    case "original_due_datetime":
      record = { id: this.args.entityId, display_name: "Original Due Date" };
      break;
    default:
      const fetchedRecord =
        this.args.objectId && this.args.entityId
          ? (await this.get(
              getRecordUrl(
                this.args.objectId,
                this.args.entityId,
                "name",
                this.args.fieldId
              )
            )) ?? {}
          : {};
      record = fetchedRecord;
      break;
  }
  record = { ...record, activityId: this.args.activityId };
} else {
  record =
    (await this.get(
      getRecordUrl(
        this.args.objectId,
        this.args.entityId,
        "name",
        this.args.fieldId
      )
    )) ?? {};
}

const isAllDayEvent = this.args.fieldType === "date";
const dateRange = toGoogleCalendarTimeRange(this.args.value, isAllDayEvent);
const eventName = buildEventName(record, object, this.args.fieldId);
const eventDetails = buildEventDetails(record, object, this.args.activityId);

this.openWindow(
  `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${eventName}&details=${eventDetails}&dates=${dateRange}&ctz=${this.currentBusiness.timezone.name}`
);

```

### `src/setupAssistant/assistant.json`

```json
{
  "services": [],
  "fields": [
    {
      "type": "description",
      "content": "Disabling data adornments or external calendars will disable them for all users of the business.",
      "key": "businessConfigDescription"
    },
    {
      "type": "boolean",
      "label": "Enable Data Adornment",
      "key": "enableAdornments",
      "default": true
    },
    {
      "type": "boolean",
      "label": "Enable External Calendars",
      "key": "enableExternalCalendars",
      "default": true
    }
  ]
}

```

### `src/setupAssistant/enabledBusinessCalendars/getFetchUrl.js`

```javascript
({ state }) => {
  return `/external-integrations/proxy/${
    state.pluginApiName
  }/primary/calendar/v3/users/me/calendarList`;
};

```

### `src/setupAssistant/enabledBusinessCalendars/optionMapper.js`

```javascript
({ state }) => {
  const data = state.result?.data?.items || [];

  return data.map((calendar) => {
    return {
      label: calendar.summary,
      value: calendar.id,
    };
  });
};

```

### `src/thumbnail.png`

[Image file: src/thumbnail.png]

### `src/userSetupAssistant/assistant.json`

```json
{
  "services": [
    {
      "api_name": "personal",
      "required": true,
      "prerequisite": true
    }
  ],
  "fields": [
    {
      "type": "boolean",
      "label": "Enable External Calendars",
      "key": "enableExternalCalendars",
      "default": true
    },
    {
      "type": "boolean",
      "label": "Enable All Calendars",
      "key": "enableAllCalendars",
      "default": true,
      "when": "Boolean({{enableExternalCalendars}})"
    },
    {
      "type": "description",
      "key": "allCalendarsDescription",
      "content": "All calendars you are authorized to access will be available to you. Other users will not have access to your calendars.",
      "when": "Boolean({{enableAllCalendars}}) && Boolean({{enableExternalCalendars}})"
    },
    {
      "type": "description",
      "key": "selectCalendarsDescription",
      "content": "Select specific calendars to enable in the plugin. Other users will not have access to these calendars.",
      "when": "!Boolean({{enableAllCalendars}}) && Boolean({{enableExternalCalendars}})"
    },
    {
      "type": "select",
      "label": "Enabled Calendars",
      "key": "enabledUserCalendars",
      "required": false,
      "allow_multiple": true,
      "when": "Boolean({{enableExternalCalendars}}) && !Boolean({{enableAllCalendars}})"
    }
  ]
}

```

### `src/userSetupAssistant/enabledUserCalendars/getFetchUrl.js`

```javascript
({ state }) => {
  return `/external-integrations/proxy/${
    state.pluginApiName
  }/personal/calendar/v3/users/me/calendarList`;
};

```

### `src/userSetupAssistant/enabledUserCalendars/optionMapper.js`

```javascript
({ state }) => {
  const data = state.result?.data?.items || [];

  return data.map((calendar) => {
    return {
      label: calendar.summary,
      value: calendar.id,
    };
  });
};

```
