import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { groceryCartSchema, productSearchPageSchema } from '../src/contracts/grocery.js';
import { FakeGroceryProvider } from '../src/providers/fakeGroceryProvider.js';

function readFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(import.meta.dirname, 'fixtures', name), 'utf8')) as unknown;
}

describe('grocery provider contracts', () => {
  it('accepts the anonymised product and cart fixtures', async () => {
    const products = productSearchPageSchema.parse(readFixture('products.json'));
    const cart = groceryCartSchema.parse(readFixture('cart.json'));
    const provider = new FakeGroceryProvider({ products, cart });

    await expect(provider.searchProducts('milk')).resolves.toMatchObject({ query: 'milk' });
    await expect(provider.getCart()).resolves.toEqual(cart);
  });

  it('rejects a product response with an invalid price', () => {
    const fixture = readFixture('products.json') as Record<string, unknown>;
    const items = fixture.items as Array<Record<string, unknown>>;
    items[0].priceNok = -1;
    expect(() => productSearchPageSchema.parse(fixture)).toThrow();
  });

  it('returns cloned data so callers cannot mutate provider state', async () => {
    const provider = new FakeGroceryProvider();
    const first = await provider.getCart();
    first.items[0].quantity = 99;
    const second = await provider.getCart();
    expect(second.items[0].quantity).toBe(1);
  });
});
