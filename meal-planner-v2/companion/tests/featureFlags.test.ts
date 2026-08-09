import { describe, expect, it } from 'vitest';
import { resolveFeatureFlags } from '../src/config/featureFlags.js';

describe('feature flags', () => {
  it('keeps every external integration feature off by default', () => {
    expect(resolveFeatureFlags({})).toEqual({
      odaLiveReadOnly: false,
      odaCartWrites: false,
      odaOrderImport: false,
      homeStock: false,
    });
  });

  it('enables only explicitly true flags', () => {
    expect(
      resolveFeatureFlags({
        FAMILY_TABLE_ODA_LIVE_READ_ONLY: 'true',
        FAMILY_TABLE_ODA_CART_WRITES: 'false',
      }),
    ).toMatchObject({ odaLiveReadOnly: true, odaCartWrites: false });
  });

  it('rejects ambiguous flag values', () => {
    expect(() => resolveFeatureFlags({ FAMILY_TABLE_ODA_CART_WRITES: 'yes' })).toThrow();
  });
});
