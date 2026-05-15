type SerializedMarker =
  | { __kzConsole: 'undefined' }
  | { __kzConsole: 'bigint'; value: string }
  | { __kzConsole: 'symbol'; value: string }
  | { __kzConsole: 'function'; name: string }
  | { __kzConsole: 'error'; name: string; message: string; stack?: string | undefined }
  | { __kzConsole: 'date'; value: string }
  | { __kzConsole: 'regexp'; value: string }
  | { __kzConsole: 'circular' }
  | { __kzConsole: 'unserializable'; reason: string };

const UNSERIALIZABLE = (reason: string): SerializedMarker => ({
  __kzConsole: 'unserializable',
  reason,
});

const safeToString = (value: unknown): string => {
  try {
    return String(value);
  } catch {
    return '[unserializable]';
  }
};

const isMarker = (value: unknown): value is SerializedMarker =>
  typeof value === 'object' &&
  value !== null &&
  '__kzConsole' in (value as Record<string, unknown>);

const serialize = (value: unknown, seen: WeakSet<object>): unknown => {
  try {
    if (value === undefined) {
      return { __kzConsole: 'undefined' } satisfies SerializedMarker;
    }

    if (value === null) {
      return null;
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'bigint') {
      return { __kzConsole: 'bigint', value: value.toString() } satisfies SerializedMarker;
    }

    if (typeof value === 'symbol') {
      return { __kzConsole: 'symbol', value: value.toString() } satisfies SerializedMarker;
    }

    if (typeof value === 'function') {
      return {
        __kzConsole: 'function',
        name: value.name || 'anonymous',
      } satisfies SerializedMarker;
    }

    if (value instanceof Error) {
      let name = 'Error';
      let message = '';
      let stack: string | undefined;

      try {
        name = value.name;
      } catch {
        /* ignore */
      }

      try {
        message = value.message;
      } catch {
        /* ignore */
      }

      try {
        stack = value.stack;
      } catch {
        /* ignore */
      }

      return { __kzConsole: 'error', name, message, stack } satisfies SerializedMarker;
    }
    if (value instanceof Date) {
      try {
        return { __kzConsole: 'date', value: value.toISOString() } satisfies SerializedMarker;
      } catch {
        return UNSERIALIZABLE('invalid Date');
      }
    }
    if (value instanceof RegExp) {
      return { __kzConsole: 'regexp', value: safeToString(value) } satisfies SerializedMarker;
    }

    if (seen.has(value as object)) {
      return { __kzConsole: 'circular' } satisfies SerializedMarker;
    }

    seen.add(value as object);

    if (Array.isArray(value)) {
      const arr: unknown[] = [];

      for (const item of value) {
        try {
          arr.push(serialize(item, seen));
        } catch {
          arr.push(UNSERIALIZABLE('threw during read'));
        }
      }
      return arr;
    }

    const out: Record<string, unknown> = {};

    let keys: string[] = [];

    try {
      keys = Object.keys(value as Record<string, unknown>);
    } catch {
      return UNSERIALIZABLE('cannot enumerate keys');
    }

    for (const k of keys) {
      try {
        out[k] = serialize((value as Record<string, unknown>)[k], seen);
      } catch {
        out[k] = UNSERIALIZABLE('threw during read');
      }
    }
    return out;
  } catch {
    return UNSERIALIZABLE('serialization failed');
  }
};

export const serializeConsoleArg = (value: unknown): unknown => {
  try {
    return serialize(value, new WeakSet());
  } catch {
    return UNSERIALIZABLE('serialization failed');
  }
};

const REGEXP_PATTERN = /^\/(.*)\/([gimsuy]*)$/;

export const deserializeConsoleArg = (value: unknown): unknown => {
  try {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map(deserializeConsoleArg);

    if (isMarker(value)) {
      switch (value.__kzConsole) {
        case 'undefined':
          return undefined;
        case 'bigint':
          try {
            return BigInt(value.value);
          } catch {
            return value.value;
          }
        case 'symbol':
          return value.value;
        case 'function':
          return `[Function: ${value.name}]`;
        case 'error': {
          const err = new Error(value.message);
          err.name = value.name;
          if (value.stack) err.stack = value.stack;
          return err;
        }
        case 'date':
          return new Date(value.value);
        case 'regexp': {
          const match = REGEXP_PATTERN.exec(value.value);
          if (!match) return value.value;
          try {
            return new RegExp(match[1] ?? '', match[2]);
          } catch {
            return value.value;
          }
        }
        case 'circular':
          return '[Circular]';
        case 'unserializable':
          return `[Unserializable: ${value.reason}]`;
      }
    }

    const out: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = deserializeConsoleArg(v);
    }
    return out;
  } catch {
    return '[Unserializable]';
  }
};
