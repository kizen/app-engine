export const FRAME_PROXY_DOMAIN_DEV = 'plugin-assets.kizen.dev';
export const FRAME_PROXY_DOMAIN_PROD = 'plugin-assets.kizen.com';

export const frameProxyDomains = [FRAME_PROXY_DOMAIN_DEV, FRAME_PROXY_DOMAIN_PROD];

const defaultOptions = {
  useDevMode: false,
  __dangerouslySkipProxy: false,
};

export type BuildIframeURLWithProxyOptions = Partial<typeof defaultOptions>;

export const buildIframeURLWithProxy = (
  originalURL: string,
  options: BuildIframeURLWithProxyOptions = defaultOptions,
): string => {
  const { useDevMode, __dangerouslySkipProxy } = options;

  if (__dangerouslySkipProxy) {
    return originalURL;
  }

  try {
    const parsed = new URL(originalURL);

    if (frameProxyDomains.includes(parsed.hostname)) {
      return originalURL;
    }

    const proxyDomain = useDevMode ? FRAME_PROXY_DOMAIN_DEV : FRAME_PROXY_DOMAIN_PROD;

    return `https://${proxyDomain}?url=${encodeURIComponent(originalURL)}`;
  } catch (ex) {
    console.warn(
      `Failed to parse URL: ${originalURL}. Apps should not attempt to display invalid URLs. Error: ${(ex as Error).message}`,
    );

    return '';
  }
};
