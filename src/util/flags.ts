export const isFlagEnabled = (identifier: string): boolean => {
  const flag = localStorage.getItem(`kizen-flag-${identifier}`);

  return flag === 'true';
};
