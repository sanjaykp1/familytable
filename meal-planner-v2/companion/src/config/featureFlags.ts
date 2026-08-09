import { z } from 'zod';

const booleanFlag = z
  .enum(['true', 'false'])
  .optional()
  .transform((value) => value === 'true');

const environmentFlagsSchema = z.object({
  FAMILY_TABLE_ODA_LIVE_READ_ONLY: booleanFlag,
  FAMILY_TABLE_ODA_CART_WRITES: booleanFlag,
  FAMILY_TABLE_ODA_ORDER_IMPORT: booleanFlag,
  FAMILY_TABLE_HOME_STOCK: booleanFlag,
});

export interface FeatureFlags {
  odaLiveReadOnly: boolean;
  odaCartWrites: boolean;
  odaOrderImport: boolean;
  homeStock: boolean;
}

export function resolveFeatureFlags(environment: NodeJS.ProcessEnv = process.env): FeatureFlags {
  const parsed = environmentFlagsSchema.parse(environment);
  return {
    odaLiveReadOnly: parsed.FAMILY_TABLE_ODA_LIVE_READ_ONLY,
    odaCartWrites: parsed.FAMILY_TABLE_ODA_CART_WRITES,
    odaOrderImport: parsed.FAMILY_TABLE_ODA_ORDER_IMPORT,
    homeStock: parsed.FAMILY_TABLE_HOME_STOCK,
  };
}
