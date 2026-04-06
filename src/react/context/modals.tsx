import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import type {
  CreateRecordModalQueue,
  CreateRelatedRecordModalQueue,
  ModalCancelEventSource,
  ModalConfig,
  ModalQueue,
} from '../../types/modals.js';
import type { UnknownJSON } from '../../types/common.js';

interface ModalsContextValue {
  modalState: {
    props: {
      show: boolean;
      onConfirm: (values: UnknownJSON) => void;
      onHide: (eventSource: ModalCancelEventSource, ...args: unknown[]) => void;
    };
  };
  showModal: (config: ModalConfig, cb: () => void) => void;
  showCreateRecordModal: (objectId: string, cb: (result: UnknownJSON) => void) => void;
  showCreateRelatedRecordModal: (
    objectId: string,
    relatedEntityId: string,
    cb: (result: UnknownJSON) => void,
  ) => void;
  onCreateRecordComplete: (result: UnknownJSON) => void;
  onCreateRelatedRecordComplete: (result: UnknownJSON) => void;
}

export interface ExposedModals {
  handleShowModal: ModalsContextValue['showModal'];
  handleShowCreateRecordModal: ModalsContextValue['showCreateRecordModal'];
  handleShowCreateRelatedRecordModal: ModalsContextValue['showCreateRelatedRecordModal'];
  derivedModalState: ModalsContextValue['modalState'] & {
    config: ModalConfig;
  };
  handleCreateRecordComplete: (result: UnknownJSON) => void;
  handleCreateRelatedRecordComplete: (result: UnknownJSON) => void;
  showCreateRecordModal: boolean;
  createRecordModalObjectId: string;
  showCreateRelatedRecordModal: boolean;
  showPluginModal: boolean;
  pluginApiName: string;
  createRelatedRecordModalObjectId: string;
  createRelatedRecordModalRelatedEntityId: string;
}

export interface ModalWrapperContextArgs {
  showing: boolean;
  show: boolean;
  showPrompt: () => void;
  onConfirm: () => void;
  onHide: (...args: unknown[]) => void;
  children: (modals: ExposedModals) => ReactNode;
}

const ModalsContext = createContext<ModalsContextValue | null>(null);

export const ModalsWrapper: FC<ModalWrapperContextArgs> = ({
  children,
  showing,
  showPrompt,
  show,
  onConfirm,
  onHide,
}) => {
  const [modalQueue, setModalQueue] = useState<ModalQueue>([]);
  const [createRecordModalQueue, setCreateRecordModalQueue] = useState<CreateRecordModalQueue>([]);
  const [createRelatedRecordModalQueue, setCreateRelatedRecordModalQueue] =
    useState<CreateRelatedRecordModalQueue>([]);

  const configRef = useRef<ModalConfig | undefined>(undefined);
  const cbRef = useRef<((...args: unknown[]) => void) | undefined>(undefined);

  const handleShowModal = useCallback((config: ModalConfig, cb: () => void) => {
    setModalQueue((prev) => [...prev, { config, cb }]);
  }, []);

  const handleShowCreateRecordModal = useCallback(
    (objectId: string, cb: (result: UnknownJSON) => void) => {
      setCreateRecordModalQueue((prev) => [...prev, { objectId, cb }]);
    },
    [],
  );

  const handleShowCreateRelatedRecordModal = useCallback(
    (objectId: string, relatedEntityId: string, cb: (result: UnknownJSON) => void) => {
      setCreateRelatedRecordModalQueue((prev) => [...prev, { objectId, relatedEntityId, cb }]);
    },
    [],
  );

  const handleCreateRecordComplete = useCallback(
    (result: UnknownJSON) => {
      const current = createRecordModalQueue[0];
      current?.cb(result);
      setCreateRecordModalQueue((prev) => prev.slice(1));
    },
    [createRecordModalQueue],
  );

  const handleCreateRelatedRecordComplete = useCallback(
    (result: UnknownJSON) => {
      const current = createRelatedRecordModalQueue[0];
      current?.cb(result);
      setCreateRelatedRecordModalQueue((prev) => prev.slice(1));
    },
    [createRelatedRecordModalQueue],
  );

  useEffect(() => {
    if (modalQueue.length > 0 && !showing) {
      configRef.current = modalQueue[0]?.config;
      cbRef.current = modalQueue[0]?.cb;
      showPrompt();
    }
  }, [modalQueue, showing, showPrompt]);

  const completeModal = useCallback(() => {
    configRef.current = undefined;
    cbRef.current = undefined;
    setModalQueue((prev) => prev.slice(1));
  }, []);

  const derivedModalState = useMemo(() => {
    return {
      props: {
        show,
        onConfirm: (values: UnknownJSON) => {
          onConfirm();
          if (cbRef.current) {
            cbRef.current({ canceled: false, values });
          }
          completeModal();
        },
        onHide: (eventSource: ModalCancelEventSource, ...args: unknown[]) => {
          onHide(...args);
          if (cbRef.current) {
            cbRef.current({ canceled: true, values: {}, eventSource });
          }
          completeModal();
        },
      },
      config: configRef.current ?? {},
    };
  }, [onConfirm, onHide, show, completeModal]);

  return (
    <ModalsContext.Provider
      value={{
        modalState: derivedModalState,
        showModal: handleShowModal,
        showCreateRecordModal: handleShowCreateRecordModal,
        showCreateRelatedRecordModal: handleShowCreateRelatedRecordModal,
        onCreateRecordComplete: handleCreateRecordComplete,
        onCreateRelatedRecordComplete: handleCreateRelatedRecordComplete,
      }}
    >
      {children({
        showPluginModal: derivedModalState.props.show,
        pluginApiName: derivedModalState.config.pluginApiName ?? '',
        handleShowModal,
        handleShowCreateRecordModal: handleShowCreateRecordModal,
        handleShowCreateRelatedRecordModal: handleShowCreateRelatedRecordModal,
        derivedModalState,
        handleCreateRecordComplete,
        handleCreateRelatedRecordComplete,
        showCreateRecordModal: createRecordModalQueue.length > 0,
        createRecordModalObjectId: createRecordModalQueue[0]?.objectId ?? '',
        showCreateRelatedRecordModal: createRelatedRecordModalQueue.length > 0,
        createRelatedRecordModalObjectId: createRelatedRecordModalQueue[0]?.objectId ?? '',
        createRelatedRecordModalRelatedEntityId:
          createRelatedRecordModalQueue[0]?.relatedEntityId ?? '',
      })}
    </ModalsContext.Provider>
  );
};

export const useModals = (): ModalsContextValue => {
  const context = useContext(ModalsContext);

  if (!context) {
    throw new Error('useModals must be used within a ModalsWrapper');
  }

  return context;
};
