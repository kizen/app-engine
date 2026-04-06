import type { PartialCustomObject, PartialEntity } from '../types/common.js';
import type { WorkerContextArgs } from '../types/contexts.js';
import { BaseWorkerContext } from './BaseWorkerContext.js';

const isPipelineObject = (obj: PartialCustomObject): boolean => {
  return obj.object_type === 'pipeline' || obj.fetch_url === 'pipeline';
};

export class RecordDetailWorkerContext extends BaseWorkerContext {
  public objectId: string | undefined;
  public entityId: string | undefined;
  public actionObjectId: string | undefined;
  public actionEntityId: string | undefined;

  constructor({
    objectId,
    entityId,
    actionObjectId,
    actionEntityId,
    ...rest
  }: WorkerContextArgs & {
    objectId?: string;
    entityId?: string;
    actionObjectId?: string;
    actionEntityId?: string;
  }) {
    super(rest);

    this.objectId = objectId;
    this.entityId = entityId;
    this.actionObjectId = actionObjectId;
    this.actionEntityId = actionEntityId;
    this.runnerType = 'recordDetail';
  }

  async currentObject(): Promise<unknown> {
    if (this.objectId) {
      return this.getObjectDetail(this.objectId);
    }
  }

  async currentEntity(): Promise<unknown> {
    if (this.entityId && this.objectId) {
      return this.getEntity(this.objectId, this.entityId);
    }
  }

  async actionEntity(): Promise<unknown> {
    if (this.actionEntityId && this.actionObjectId) {
      return this.getEntity(this.actionObjectId, this.actionEntityId);
    }
  }

  getFieldValue(entity: PartialEntity, fieldId: string): unknown {
    return entity.fields?.[fieldId]?.value;
  }

  private async getClientEntity(entityId: string): Promise<unknown> {
    const result = await this.get(`/client/${entityId}`);

    return result;
  }

  protected isClientObject(objectId: string): boolean {
    return objectId === this.clientObject?.id;
  }

  async getEntity(objectId: string, entityId: string): Promise<unknown> {
    try {
      if (this.isClientObject(objectId)) {
        return await this.getClientEntity(entityId);
      }

      const model = (await this.get(`/custom-objects/${objectId}`)) as PartialCustomObject;

      if (isPipelineObject(model)) {
        return await this.getPipelineEntity(objectId, entityId);
      }

      return await this.getCustomEntity(objectId, entityId);
    } catch (ex: unknown) {
      this.onError(ex as Error);
    }
  }

  async getRelatedEntitiesForField(
    objectId: string,
    entityId: string,
    fieldId: string,
  ): Promise<unknown[]> {
    try {
      const entity = (await this.getEntity(objectId, entityId)) as PartialEntity;

      const field = entity.fields?.[fieldId];

      if (!field) {
        this.onError(new Error(`Field not found for ID ${fieldId}`));
        return [];
      }

      const object = await this.getObjectDetail(objectId);

      const relatedObject = object?.related_objects?.find((o) => o.field_id === field.id);

      if (!relatedObject) {
        this.onError(new Error('Related object not found'));
        return [];
      }

      const relationships = await Promise.all(
        field.value
          .map((value) => {
            if (value.id === undefined) {
              return null;
            }

            return this.getEntity(relatedObject.related_object, value.id);
          })
          .filter((promise) => promise !== null),
      );

      const result = relationships.filter(Boolean);

      return result;
    } catch (ex: unknown) {
      this.onError(ex as Error);
    }

    return [];
  }

  private async getPipelineEntity(objectId: string, entityId: string): Promise<unknown> {
    const result = await this.get(`/pipelines/${objectId}/entity-records/${entityId}`);

    return result;
  }

  private async getCustomEntity(objectId: string, entityId: string): Promise<unknown> {
    const result = await this.get(`/custom-objects/${objectId}/entity-records/${entityId}`);

    return result;
  }

  async getObjectDetail(id: string): Promise<PartialCustomObject | undefined> {
    try {
      const result = await this.get(`/custom-objects/${id}/detail`);

      return result as PartialCustomObject;
    } catch (ex: unknown) {
      this.onError(ex as Error);
    }
  }

  public refreshTimeline(): void {
    this.refreshTimelineForId(this.entityId);
  }

  public refreshEntity(): void {
    this.refreshEntityForId(this.entityId);
  }
}
