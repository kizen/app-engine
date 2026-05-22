// These helpers can be used in a worker context, so we avoid inflating the worker bundle
// by keeping them in a separate file from assistant.ts

export const getActionContainerKey = (actionApiName: string): string => {
  return `action__container__${actionApiName}`;
};

export const getActionFieldKey = (actionApiName: string): string => {
  return `action__${actionApiName}`;
};

const getActionMenuKey = (actionApiName: string): string => {
  return `action__menu__${actionApiName}`;
};

export const getActionMenuHeadingKey = (actionApiName: string): string => {
  return `action__menuheading__${actionApiName}`;
};

export const getActionMenuFieldKey = (actionApiName: string, objectId: string): string => {
  return `${getActionMenuKey(actionApiName)}_${objectId}`;
};

export const isActionMenuFieldKey = (key: string): boolean => {
  return key.startsWith(`action__menu__`);
};

export const isActionFieldKey = (key: string): boolean => {
  return key.startsWith(`action__`);
};

export const splitActionMenuFieldKey = (
  key: string,
): { actionApiName: string; objectId: string } => {
  if (!isActionMenuFieldKey(key)) {
    return { actionApiName: '', objectId: '' };
  }

  const suffix = key.slice(`action__menu__`.length);
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
