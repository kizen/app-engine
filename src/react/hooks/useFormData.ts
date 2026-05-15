import { useImperativeHandle, type ForwardedRef } from 'react';

export type CollectedFormData = Record<string, FormDataEntryValue>;

export interface ModalCustomContentHandle {
  collectFormData: () => CollectedFormData;
}

export const useRegisterFormDataCollection = (
  ref: ForwardedRef<ModalCustomContentHandle>,
  collectFormData: () => CollectedFormData,
): void => {
  useImperativeHandle(ref, () => ({ collectFormData }), [collectFormData]);
};
