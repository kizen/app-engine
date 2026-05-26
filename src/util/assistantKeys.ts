// These helpers can be used in a worker context, so we avoid inflating the worker bundle
// by keeping them in a separate file from assistant.ts

const KIZEN_ACTION_PREFIX = '__kizen__action__';
const KIZEN_ACTION_MENU_PREFIX = '__kizen__actionmenu__';
const KIZEN_ACTION_MENU_HEADING_PREFIX = '__kizen__actionmenuheading__';
const KIZEN_ACTION_CONTAINER_PREFIX = '__kizen__actioncontainer__';

export const getActionContainerKey = (actionApiName: string): string => {
  return `${KIZEN_ACTION_CONTAINER_PREFIX}${actionApiName}`;
};

export const getActionFieldKey = (actionApiName: string): string => {
  return `${KIZEN_ACTION_PREFIX}${actionApiName}`;
};

const getActionMenuKey = (actionApiName: string): string => {
  return `${KIZEN_ACTION_MENU_PREFIX}${actionApiName}`;
};

export const getActionMenuHeadingKey = (actionApiName: string): string => {
  return `${KIZEN_ACTION_MENU_HEADING_PREFIX}${actionApiName}`;
};

export const getActionMenuFieldKey = (actionApiName: string, objectId: string): string => {
  return `${getActionMenuKey(actionApiName)}_${objectId}`;
};

export const isActionMenuFieldKey = (key: string): boolean => {
  return key.startsWith(KIZEN_ACTION_MENU_PREFIX);
};

export const isActionFieldKey = (key: string): boolean => {
  return key.startsWith(KIZEN_ACTION_PREFIX);
};

export const splitActionFieldKey = (key: string): string => {
  if (!isActionFieldKey(key)) {
    return '';
  }

  return key.slice(KIZEN_ACTION_PREFIX.length);
};

export const splitActionMenuFieldKey = (
  key: string,
): { actionApiName: string; objectId: string } => {
  if (!isActionMenuFieldKey(key)) {
    return { actionApiName: '', objectId: '' };
  }

  const suffix = key.slice(KIZEN_ACTION_MENU_PREFIX.length);
  const lastUnderscore = suffix.lastIndexOf('_');

  if (lastUnderscore === -1) {
    return { actionApiName: '', objectId: '' };
  }

  const apiName = suffix.slice(0, lastUnderscore);
  const objectId = suffix.slice(lastUnderscore + 1);

  return {
    actionApiName: apiName,
    objectId,
  };
};
