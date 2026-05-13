import DOMPurify, { type RemovedAttribute, type RemovedElement } from 'dompurify';
import { useMemo } from 'react';

type Removed = RemovedAttribute | RemovedElement;

export const getPluginSafeHTML = (
  html?: string,
): { html: string; error: Error | null; removed: Removed[] } => {
  if (!html) {
    return { html: '', error: null, removed: [] };
  }

  try {
    const cleanHtml = DOMPurify.sanitize(html, {
      ADD_TAGS: ['iframe'],
      ADD_ATTR: [
        'allow',
        'allowfullscreen',
        'frameborder',
        'scrolling',
        'src',
        'srcdoc',
        'sandbox',
        'name',
        'loading',
        'width',
        'height',
        'title',
      ],
    });

    return { html: cleanHtml, error: null, removed: DOMPurify.removed };
  } catch (err) {
    return { html: '', error: err as Error, removed: [] };
  }
};

export const usePluginSafeHTML = (
  html?: string,
): { html: string; error: Error | null; removed: Removed[] } => {
  return useMemo(() => getPluginSafeHTML(html), [html]);
};
