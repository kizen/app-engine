const globals = globalThis as unknown as Record<string, unknown>;

globals.__PKG_VERSION__ ??= '0.0.0-test';
globals.__LOCAL_PROXY_ORIGIN__ ??= '';
