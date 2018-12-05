import { UserFavoritesEffect } from '../effects/user-favorites-effect';
import { endpointSchemaKey } from '../helpers/entity-factory';
/**
 * A user favorite blueprint. Can be used to fetch the full entity from a particular endpoint.
 */

export class UserFavorite {
  public guid: string;
  constructor(
    public endpointId: string,
    public endpointType: string,
    public entityId?: string,
    /*
    entityType should correspond to a type in the requestData part of the store.
  */
    public entityType?: string,
  ) {
    this.guid = UserFavoritesEffect.buildFavoriteStoreEntityGuid(this);
  }
}

export class UserFavoriteEndpoint extends UserFavorite {
  constructor(
    public endpointId: string
  ) {
    super(
      endpointId,
      endpointSchemaKey
    );
  }
}