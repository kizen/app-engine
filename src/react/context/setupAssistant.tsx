import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type SetStateAction,
} from 'react';
import type { UnknownJSON } from '../../types/common.js';
import type {
  AssistantConfigAction,
  AssistantField,
  MatchSetupAssistantField,
  SetupAssistantConfig,
} from '../../types/modals.js';

interface TemplateAssociation {
  custom_object: {
    id?: string;
    object_name?: string;
  };
  browser_js_action_template: AssistantConfigAction;
  include_perform_action?: boolean;
}

import { getAllNestedInputsFromConfig, getFieldFromAction } from '../../workers/util.js';
import { useAppState } from './appState.js';
import { runExpression } from '../../run.js';
import { getActionFieldKey, getActionMenuFieldKey } from '../../util/assistantKeys.js';

interface SetupAssistantContextValue {
  state: Record<string, unknown>;
  setState: (
    stateUpdate: SetStateAction<Record<string, UnknownJSON>> | Record<string, UnknownJSON>,
  ) => void;
  interpolateValue: (accessor: string) => unknown;
  getNestedFields: () => AssistantField[];
  reInferFieldsForObject: (objectKey: string, forceObjectId?: string) => Promise<void>;
  inferencePending: boolean;
  evaluateExpression: (expression: string, key: string) => Promise<unknown>;
  shouldHideField: (key: string) => boolean;
  shouldDisableField: (key: string) => boolean;
  expressionsIdle: boolean;
  getFieldErrorState: (
    key: string,
  ) => { message: string | undefined; showMessage: boolean; error: boolean } | undefined;
  validateForm: () => Promise<{ isValid: boolean; includedKeys: string[] }>;
  waitingExpressionCount: number;
  initialExpressionsPending: boolean;
  flattenedFields: AssistantField[];
  flattenedFieldsByKey: Record<string, AssistantField>;
  afterFieldChange: (key: string) => void;
  registerFieldResetter: (key: string, resetFn: () => void) => void;
  disabledKeys: string[];
}

export const SetupAssistantContext = createContext<SetupAssistantContextValue | null>(null);

const SetupAssistantProvider = SetupAssistantContext.Provider;

const getUsableValue = (type: string, value?: UnknownJSON): unknown => {
  if (type === 'custom_object') {
    // allow_multiple objects hold an array of matches in state
    if (Array.isArray(value)) {
      return (value as UnknownJSON[])[0]?.id;
    }

    return value?.id;
  }
};

/*
 * Returns the state key referenced by an accessor like "{{some_key}}", or undefined when the
 * value is a literal.
 */
export const getStateAccessorKey = (accessor: string): string | undefined => {
  if (accessor.startsWith('{{') && accessor.endsWith('}}')) {
    return accessor.slice(2, -2).trim();
  }

  return undefined;
};

/*
 * Take values like "{{some_key}}" and replace in the actual value from state
 */
const interpolateValueFromState = (
  accessor: string,
  consideredState: Record<string, UnknownJSON>,
): unknown => {
  const stateKey = getStateAccessorKey(accessor);

  if (stateKey !== undefined) {
    return getUsableValue(
      consideredState[stateKey]?.type as string,
      consideredState[stateKey]?.value as UnknownJSON,
    );
  }

  return accessor;
};

const doesValueExist = (field: AssistantField, value?: { value?: UnknownJSON }): boolean => {
  if (field.type === 'custom_object') {
    if (field.allow_multiple) {
      const consideredValue = (value?.value ?? []) as unknown[];
      return consideredValue.length > 0;
    }

    return Boolean(value?.value?.id);
  } else if (field.type === 'field') {
    if (field.allow_multiple) {
      const consideredValue = (value?.value ?? []) as unknown[];

      return consideredValue.length > 0;
    }

    return Boolean(value?.value?.value);
  } else if (field.type === 'text') {
    const consideredValue = (value?.value ?? '') as string;

    return Boolean(consideredValue.trim());
  } else if (field.type === 'number') {
    const parsed = Number(value?.value);

    return Boolean(value?.value) && !isNaN(parsed);
  } else if (field.type === 'select') {
    if (field.allow_multiple) {
      const consideredValue = (value?.value ?? []) as unknown[];

      return consideredValue.length > 0;
    }

    return Boolean(value?.value?.value);
  } else if (field.type === 'boolean') {
    return Boolean(value?.value);
  }

  return false;
};

const getNestedObjectsFromConfig = (config: SetupAssistantConfig): MatchSetupAssistantField[] => {
  const objects = (config.fields ?? []).filter(
    (entry): entry is AssistantField => entry.type === 'custom_object',
  );
  const containers = (config.fields ?? []).filter((entry) => entry.type === 'container');

  const recursiveObjects = containers.flatMap((container) => {
    return getNestedObjectsFromConfig(container as SetupAssistantConfig);
  });

  const actionObjects = config.actions?.filter((action) => action.hint_object_name) ?? [];

  return [
    ...objects,
    ...recursiveObjects,
    ...actionObjects.map((action) => {
      return {
        ...getFieldFromAction(action),
        match_hint: action.hint_object_name ?? '',
      };
    }),
  ];
};

const getNestedFieldsFromConfig = (config: SetupAssistantConfig): AssistantField[] => {
  const objects = (config.fields ?? []).filter((entry) => entry.type === 'field');
  const containers = (config.fields ?? []).filter((entry) => entry.type === 'container');

  const recursiveFields = containers.flatMap((container) =>
    getNestedFieldsFromConfig(container as SetupAssistantConfig),
  );

  return [...objects, ...recursiveFields] as AssistantField[];
};

interface CustomObjectDetails {
  id: string;
  objectName: string;
  fields: { id: string; name: string; displayName: string }[];
}

interface InferredObjectMatch {
  id: string;
  objectName: string;
}

export const resolveInferredObjectId = ({
  objectIdAccessor,
  forceObjectId,
  resolvedObjects,
  state,
}: {
  objectIdAccessor: string;
  forceObjectId?: string | undefined;
  resolvedObjects?: Record<string, InferredObjectMatch> | undefined;
  state: Record<string, UnknownJSON>;
}): string | undefined => {
  if (forceObjectId !== undefined) {
    return forceObjectId;
  }

  const accessorKey = getStateAccessorKey(objectIdAccessor);

  if (accessorKey !== undefined) {
    const resolvedObjectId = resolvedObjects?.[accessorKey]?.id;

    if (resolvedObjectId !== undefined) {
      return resolvedObjectId;
    }
  }

  return interpolateValueFromState(objectIdAccessor, state) as string | undefined;
};

export const SetupAssistantController = ({
  children,
  config,
  value,
  onStateChange,
  disabledKeys,
  templateAssociationsByActionApiName,
  getObjectByAPIName,
  getCustomObjectDetails,
}: {
  children: React.ReactNode;
  config: SetupAssistantConfig;
  value?: Record<string, UnknownJSON>;
  onStateChange?: (state: Record<string, unknown>) => void;
  templateAssociationsByActionApiName?: Record<string, TemplateAssociation[]>;
  disabledKeys?: string[];
  getObjectByAPIName: (
    apiName: string,
  ) => Promise<{ id: string; object_name: string }[] | undefined>;
  getCustomObjectDetails: (objectId: string) => Promise<CustomObjectDetails>;
}): ReactNode => {
  const [_rawState, _setState] = useState(value ?? {});

  const flattenedFields = useMemo(() => {
    return getAllNestedInputsFromConfig(config);
  }, [config]);

  const defaultState = useMemo(() => {
    const defaultValues = flattenedFields.reduce((acc: Record<string, UnknownJSON>, field) => {
      return {
        ...acc,
        [field.key]: {
          type: field.type,
          value: field.default,
        },
      };
    }, {});

    return defaultValues;
  }, [flattenedFields]);

  const state = useMemo(() => {
    const actionTemplateMenuPartialState: Record<string, unknown> = {};

    const actionTemplatePartialState = Object.entries(
      templateAssociationsByActionApiName ?? {},
    ).reduce((acc: Record<string, unknown>, [actionApiName, associations]) => {
      const actionFieldKey = getActionFieldKey(actionApiName);

      const associatedObjects = associations.map((assoc) => {
        return {
          id: assoc.custom_object.id ?? '',
          objectName: assoc.custom_object.object_name ?? 'Unknown Object',
        };
      });

      if (associatedObjects.length > 0 && associations.length > 0 && associations[0]) {
        acc[actionFieldKey] = {
          type: 'custom_object',
          value: associatedObjects,
          config: getFieldFromAction(associations[0].browser_js_action_template),
        };

        associations.forEach((assoc) => {
          if (assoc.include_perform_action && assoc.custom_object.id) {
            actionTemplateMenuPartialState[
              getActionMenuFieldKey(actionApiName, assoc.custom_object.id)
            ] = {
              type: 'boolean',
              value: true,
            };
          }
        });
      }

      return acc;
    }, {});

    const stateValues = {
      ...actionTemplatePartialState,
      ...actionTemplateMenuPartialState,
      ..._rawState,
    };

    disabledKeys?.forEach((key) => {
      if (stateValues[key]) {
        stateValues[key] = undefined;
      }
    });

    return stateValues as Record<string, UnknownJSON>;
  }, [_rawState, templateAssociationsByActionApiName, disabledKeys]);

  const hasRunInference = useRef(Boolean(value));

  const inferenceState = useRef({});
  const [inferencePending, setInferencePending] = useState(!value);
  const [waitingExpressions, setWaitingExpressions] = useState<Record<string, boolean>>({});
  const [expressionResults, setExpressionResults] = useState<Record<string, boolean>>({});
  const [expressionsIdle, setExpressionsIdle] = useState(false);
  const idleTimer = useRef<number | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [expressionsStarted, setExpressionsStarted] = useState(false);

  const [initialExpressionsPending, setInitialExpressionsPending] = useState(true);

  const fieldResetterRef = useRef<Record<string, () => void>>({});

  /*
   * Each field can register a reset function, that when called will clear the field value.
   * This allows each field type to control what actions need to happen in order to fully
   * reset itself.
   */
  const registerFieldResetter = useCallback((key: string, resetFn: () => void) => {
    fieldResetterRef.current[key] = resetFn;
  }, []);

  /*
   * We need to maintain a copy of the state outside the render cycle for inferring fields choices based on
   * the hint name. For functional updates the ref is only assigned when React runs the updater, so a
   * value just queued may not be readable here yet - pass it forward explicitly instead.
   */
  const setState = useCallback(
    (stateUpdate: SetStateAction<Record<string, UnknownJSON>> | Record<string, UnknownJSON>) => {
      if (typeof stateUpdate === 'function') {
        _setState((prev) => {
          const result = stateUpdate(prev);
          inferenceState.current = result;

          onStateChange?.(result);

          return result;
        });
      } else {
        inferenceState.current = stateUpdate;
        _setState(stateUpdate);
        onStateChange?.(stateUpdate);
      }

      setErrors({});
    },
    [onStateChange],
  );

  const interpolateValue = useCallback(
    (accessor: string) => {
      return interpolateValueFromState(accessor, state);
    },
    [state],
  );

  const { clientObject } = useAppState();

  const getPotentialMatch = useCallback(
    async (api_name: string) => {
      if (api_name === 'client_client' && clientObject) {
        return [
          {
            id: clientObject.id,
            object_name: clientObject.objectName,
          },
        ];
      }

      const potentialMatch = await getObjectByAPIName(api_name);

      return potentialMatch;
    },
    [clientObject, getObjectByAPIName],
  );

  /*
   * If there is a match_hint for an object, we can try to infer the object by its API name
   * and set it automatically. Returns the matches keyed by assistant field key.
   */
  const handleInferObjects = useCallback(async (): Promise<Record<string, InferredObjectMatch>> => {
    const objectsToInfer = getNestedObjectsFromConfig(config);
    const matchedObjects: Record<string, InferredObjectMatch> = {};

    for (const inferrableObject of objectsToInfer) {
      if (!inferrableObject.match_hint) {
        continue;
      }

      const potentialMatch = await getPotentialMatch(inferrableObject.match_hint);

      if (potentialMatch?.[0]) {
        const value = {
          id: potentialMatch[0].id,
          objectName: potentialMatch[0].object_name,
        };

        matchedObjects[inferrableObject.key] = value;

        setState((prev) => {
          const result = {
            ...prev,
            [inferrableObject.key]: {
              type: 'custom_object',
              value: inferrableObject.allow_multiple ? [value] : value,
            },
          };

          return result;
        });
      }
    }

    return matchedObjects;
  }, [config, setState, getPotentialMatch]);

  const getInferrableFields = useCallback(() => {
    return getNestedFieldsFromConfig(config);
  }, [config]);

  /*
   * Similar to handleInferObjects, but for fields. Can either take an objectId as forceObjectId, or
   * look it up in the state based on additional references. objectIdFilter can be used to only
   * run the inference on fields for a particular object key. resolvedObjects carries object matches
   * from the same inference pass, keyed by assistant field key.
   */
  const handleInferFields = useCallback(
    async (
      objectIdFilter?: string,
      forceObjectId?: string,
      resolvedObjects?: Record<string, InferredObjectMatch>,
    ) => {
      const fieldsToInfer = getInferrableFields();

      const objectResults: Record<string, CustomObjectDetails> = {};
      for (const inferrableField of fieldsToInfer) {
        if (!inferrableField.object_id) {
          continue;
        }

        if (objectIdFilter && getStateAccessorKey(inferrableField.object_id) !== objectIdFilter) {
          continue;
        }

        const objectId = resolveInferredObjectId({
          objectIdAccessor: inferrableField.object_id,
          forceObjectId,
          resolvedObjects,
          state: inferenceState.current,
        });

        if (!objectId) {
          continue;
        }

        if (!objectResults[objectId]) {
          try {
            objectResults[objectId] = await getCustomObjectDetails(objectId);
          } catch {
            // Swallow error fetching object, since the user can recover by picking a different one
          }
        }

        const objectDetail = objectResults[objectId];

        if (objectDetail) {
          const fieldMatch = objectDetail.fields.find((f) => f.name === inferrableField.match_hint);

          if (fieldMatch) {
            setState((prev) => {
              const result = {
                ...prev,
                [inferrableField.key]: {
                  type: 'field',
                  value: {
                    value: fieldMatch.id,
                    label: fieldMatch.displayName,
                  },
                  associatedObject: {
                    id: objectId,
                    name: objectDetail.objectName,
                  },
                },
              };

              return result;
            });
          }
        }
      }
    },
    [getInferrableFields, setState, getCustomObjectDetails],
  );

  const handleReinferObjectByKey = useCallback(
    async (key: string) => {
      const objectsToInfer = getNestedObjectsFromConfig(config);

      const matchingObject = objectsToInfer.find((obj) => obj.key === key);

      if (matchingObject?.match_hint) {
        let matchedObjectId = '';
        let potentialMatch;

        try {
          potentialMatch = await getPotentialMatch(matchingObject.match_hint);
        } catch (ex) {
          console.warn('Failed to re-infer object for key:', key, ex);
          return;
        }

        const match = potentialMatch?.[0];

        if (match) {
          matchedObjectId = match.id;

          setState((prev) => {
            const result = {
              ...prev,
              [key]: {
                type: 'custom_object',
                value: {
                  id: match.id,
                  objectName: match.object_name,
                },
              },
            };

            return result;
          });

          if (matchedObjectId) {
            void handleInferFields(key, matchedObjectId);
          }
        }
      }
    },
    [config, setState, handleInferFields, getPotentialMatch],
  );

  const handleConfigInference = useCallback(async () => {
    try {
      const inferredObjects = await handleInferObjects();

      await handleInferFields(undefined, undefined, inferredObjects);
    } catch (ex) {
      // Swallow errors looking up the matches, since the user can recover by picking manually.
      console.warn('Failed to infer setup assistant config:', ex);
    } finally {
      // Must always clear, otherwise the host keeps the assistant behind its blocking loader.
      setInferencePending(false);
    }
  }, [handleInferObjects, handleInferFields]);

  const getNestedFields = useCallback(() => {
    return getNestedFieldsFromConfig(config);
  }, [config]);

  const reInferFieldsForObject = useCallback(
    (objectKey: string, forceObjectId?: string) => {
      return handleInferFields(objectKey, forceObjectId);
    },
    [handleInferFields],
  );

  const resetIdleTimeout = useCallback(() => {
    if (idleTimer.current) {
      clearTimeout(idleTimer.current);
      idleTimer.current = null;
    }

    idleTimer.current = setTimeout(() => {
      setExpressionsIdle(true);
    }, 500);
  }, []);

  const evaluateExpression = useCallback(
    async (expression: string, key: string) => {
      resetIdleTimeout();
      setWaitingExpressions((prev) => ({ ...prev, [key]: true }));
      setExpressionsStarted(true);

      const result = await runExpression(expression, {
        ...defaultState,
        ...state,
      });

      setExpressionResults((prev) => {
        if (prev[key] === false && typeof result === 'boolean' && result) {
          // Key became true from false state, so we re-infer the object if it's not set
          if (!state[key]) {
            void handleReinferObjectByKey(key);
          }
        }
        return { ...prev, [key]: result };
      });
      setWaitingExpressions((prev) => ({ ...prev, [key]: false }));

      return result;
    },
    [state, resetIdleTimeout, handleReinferObjectByKey, defaultState],
  );

  if (!hasRunInference.current) {
    hasRunInference.current = true;
    void handleConfigInference();
  }

  const shouldHideField = useCallback(
    (key: string) => {
      if (expressionResults[key] === false) {
        return true;
      }

      return false;
    },
    [expressionResults],
  );

  const shouldDisableField = useCallback(
    (key: string) => {
      if (waitingExpressions[key] === true) {
        return true;
      }

      return false;
    },
    [waitingExpressions],
  );

  const getFieldErrorState = useCallback(
    (key: string) => {
      if (errors[key]) {
        return {
          message: errors[key],
          showMessage: true,
          error: true,
        };
      }
    },
    [errors],
  );

  const whenClauses = useMemo(() => {
    const sectionClauses = (config.fields ?? [])
      .filter((entry) => entry.type === 'container')
      .map((c) => c.when);

    const fieldClauses = flattenedFields.map((f) => f.when);

    return [...sectionClauses, ...fieldClauses].filter(Boolean);
  }, [config, flattenedFields]);

  const flattenedFieldsByKey = useMemo(() => {
    return flattenedFields.reduce((acc: Record<string, AssistantField>, field) => {
      acc[field.key] = field;
      return acc;
    }, {});
  }, [flattenedFields]);

  const getAdditionalDeps = useCallback(
    (dep: string, results: Set<string>, visited: Set<string>) => {
      results.add(dep);
      const depField = flattenedFieldsByKey[dep];

      if (depField?.dependencies?.length) {
        depField.dependencies.forEach((d: string) => {
          if (!visited.has(d)) {
            visited.add(d);
            getAdditionalDeps(d, results, visited);
          }
        });
      }
    },
    [flattenedFieldsByKey],
  );

  /*
   * Follow dependency chains to find all fields that depend on a given field, either directly
   * or indirectly (i.e. a field that depends on a field that depends on the changed field).
   * This allows us to reset all dependent fields when a field changes.
   */
  const flattenedFieldsWithDependencies = useMemo(() => {
    const fields = flattenedFields.map((field) => {
      const depsResultSet = new Set<string>();
      const deps = field.dependencies ?? [];
      const visited = new Set<string>();

      deps.forEach((dep: string) => {
        getAdditionalDeps(dep, depsResultSet, visited);
      });

      return {
        ...field,
        dependencies: Array.from(depsResultSet),
      };
    });

    return fields;
  }, [flattenedFields, getAdditionalDeps]);

  /*
   * Called during the state update when a field value changes to check the dependent fields
   * and call their reset functions
   */
  const afterFieldChange = useCallback(
    (key: string) => {
      const dependentFields = flattenedFieldsWithDependencies.filter((f) => {
        if (f.dependencies.length === 0) {
          return false;
        }

        return f.dependencies.includes(key) && f.key !== key;
      });

      dependentFields.forEach((field) => {
        fieldResetterRef.current[field.key]?.();
      });
    },
    [flattenedFieldsWithDependencies],
  );

  const validateForm = useCallback(async () => {
    const processedFields = await Promise.all(
      flattenedFields.map(async (field) => {
        if (!field.when) {
          return field;
        }

        const isVisible = await runExpression(field.when, {
          ...defaultState,
          ...state,
        });

        return isVisible ? field : null;
      }),
    );

    const fieldsToCheck = processedFields.filter(Boolean);

    let errorCount = 0;

    for (const field of fieldsToCheck) {
      if (field && field.required && !doesValueExist(field, state[field.key])) {
        setErrors((prev) => ({
          ...prev,
          [field.key]: 'This field is required',
        }));

        errorCount++;
      } else if (field?.validation_pattern) {
        const isValid = new RegExp(field.validation_pattern).test(
          (state[field.key]?.value ?? field.default ?? '') as string,
        );

        if (!isValid) {
          setErrors((prev) => ({
            ...prev,
            [field.key]: `Value must match the pattern ${field.validation_pattern ?? ''}`,
          }));
          errorCount++;
        }
      } else {
        if (field) {
          setErrors((prev) => ({
            ...prev,
            [field.key]: undefined,
          }));
        }
      }
    }

    return {
      isValid: errorCount === 0,
      includedKeys: fieldsToCheck.map((f) => f?.key).filter((k): k is string => Boolean(k)),
    };
  }, [state, flattenedFields, defaultState]);

  useEffect(() => {
    resetIdleTimeout();
  }, [resetIdleTimeout]);

  const waitingExpressionCount = Object.values(waitingExpressions).filter(Boolean).length;

  if (!expressionsStarted && whenClauses.length === 0) {
    setExpressionsStarted(true);
  }

  if (expressionsStarted && initialExpressionsPending && waitingExpressionCount === 0) {
    setInitialExpressionsPending(false);
  }

  return (
    <SetupAssistantProvider
      value={{
        state,
        setState,
        interpolateValue,
        getNestedFields,
        reInferFieldsForObject,
        inferencePending,
        evaluateExpression,
        shouldHideField,
        shouldDisableField,
        expressionsIdle,
        getFieldErrorState,
        validateForm,
        waitingExpressionCount,
        initialExpressionsPending,
        flattenedFields,
        flattenedFieldsByKey,
        afterFieldChange,
        registerFieldResetter,
        disabledKeys: disabledKeys ?? [],
      }}
    >
      {children}
    </SetupAssistantProvider>
  );
};

export const useSetupAssistant = (): SetupAssistantContextValue => {
  const context = useContext(SetupAssistantContext);

  if (!context) {
    throw new Error('useSetupAssistant must be used within a SetupAssistantController');
  }

  return context;
};
