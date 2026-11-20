import { SetMetadata } from '@nestjs/common';

export const REQUIRE_ENTITLEMENT_KEY = 'require_entitlement';

/**
 * Declares that a controller route or class requires the gym organization
 * to possess an active entitlement for the specified feature key.
 */
export const RequireEntitlement = (featureKey: string) =>
  SetMetadata(REQUIRE_ENTITLEMENT_KEY, featureKey);
