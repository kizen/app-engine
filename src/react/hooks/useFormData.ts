import { useImperativeHandle, type ForwardedRef } from 'react';

export type CollectedFormData = Record<string, FormDataEntryValue>;

export interface CollectedFormDataResponse {
  data: CollectedFormData;
  ready: boolean;
}

export interface ModalCustomContentHandle {
  collectFormData: () => CollectedFormDataResponse;
}

export const useRegisterFormDataCollection = (
  ref: ForwardedRef<ModalCustomContentHandle>,
  collectFormData: () => CollectedFormDataResponse,
): void => {
  useImperativeHandle(ref, () => ({ collectFormData }), [collectFormData]);
};
