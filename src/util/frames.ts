export const FRAME_PROXY_DOMAIN_DEV = 'plugin-assets.kizen.dev';
export const FRAME_PROXY_DOMAIN_PROD = 'plugin-assets.kizen.com';

export const frameProxyDomains = [FRAME_PROXY_DOMAIN_DEV, FRAME_PROXY_DOMAIN_PROD];

export const isFrameProxyOrigin = (origin: string): boolean =>
  frameProxyDomains.some((domain) => origin === `https://${domain}`);

export interface FrameProxyEnvelope<T = unknown> {
  plugin_api_name: string;
  source_url: string;
  event: 'message' | 'loaded' | 'error';
  data?: T;
  error?: string;
  _kizen_proxy_nonce: string;
}

export type UnwrappedProxyMessage = { handled: true; data: unknown } | { handled: false };

export const unwrapProxyMessage = (event: MessageEvent): UnwrappedProxyMessage => {
  const data: unknown = event.data;

  // Messages pass through as-is that aren't from the proxy
  if (!isFrameProxyOrigin(event.origin)) {
    return { handled: true, data };
  }

  const envelope = data as FrameProxyEnvelope;

  if (typeof data !== 'object' || data === null || envelope.event !== 'message') {
    return { handled: false };
  }

  return { handled: true, data: envelope.data };
};

export const allowedAllowFields = [
  'microphone',
  'speaker-selection',
  'autoplay',
  'camera',
  'display-capture',
  'hid',
];

export const allowedSandboxValues = ['allow-popups', 'allow-scripts', 'allow-same-origin'];

const defaultOptions = {
  useDevMode: false,
  __dangerouslySkipProxy: false,
};

export type BuildIframeURLWithProxyOptions = Partial<typeof defaultOptions>;

export const buildIframeURLWithProxy = (
  originalURL: string,
  options: BuildIframeURLWithProxyOptions = defaultOptions,
  allowString = '',
): {
  url: string;
  isUsingProxy: boolean;
} => {
  const { useDevMode, __dangerouslySkipProxy } = options;

  let url = '';

  if (__dangerouslySkipProxy) {
    url = originalURL;
  } else {
    try {
      const parsed = new URL(originalURL);

      if (frameProxyDomains.includes(parsed.hostname)) {
        url = originalURL;
      } else {
        const proxyDomain = useDevMode ? FRAME_PROXY_DOMAIN_DEV : FRAME_PROXY_DOMAIN_PROD;

        url = `https://${proxyDomain}?url=${encodeURIComponent(originalURL)}&allow=${encodeURIComponent(allowString)}`;
      }
    } catch (ex) {
      console.warn(
        `Failed to parse URL: ${originalURL}. Apps should not attempt to display invalid URLs. Error: ${(ex as Error).message}`,
      );

      url = '';
    }
  }

  const isUsingProxy =
    url.startsWith(`https://${FRAME_PROXY_DOMAIN_DEV}`) ||
    url.startsWith(`https://${FRAME_PROXY_DOMAIN_PROD}`);

  return {
    url,
    isUsingProxy,
  };
};

export const filterAllowList = (allow: string[]): string[] => {
  const parsedAllowList = allow.filter((allowEntry) => {
    return allowedAllowFields.some((allowedField) => allowEntry.startsWith(allowedField));
  });

  return parsedAllowList;
};

export const filterSandboxList = (sandbox: string[]): string[] => {
  const parsedSandboxList = sandbox.filter((sandboxEntry) =>
    allowedSandboxValues.includes(sandboxEntry),
  );

  return parsedSandboxList;
};

export const getParentFrameAllowParam = (): string => {
  const values = allowedAllowFields.map((field) => {
    return `${field} *`;
  });

  return values.join('; ');
};
