import { describe, expect, it } from 'vitest';
import {
  createIngredientAliasRegistry,
  createStockLedger,
  matchIngredientToStock,
} from './ingredientMatching';
import type { HomeStockItem } from './types';

function stock(
  id: string,
  name: string,
  quantity: number | null,
  unit: string,
): HomeStockItem {
  return {
    id,
    name,
    kind: 'food',
    category: 'pantry',
    location: 'Cupboard',
    frozen: false,
    quantity,
    unit,
    planningPriority: 'normal',
    archived: false,
    updatedAt: '2026-08-10T08:00:00.000Z',
  };
}

describe('shared ingredient matching', () => {
  it('normalizes case and whitespace and resolves tomato/tomatoes through an explicit alias', () => {
    const result = matchIngredientToStock(
      { name: '  TOMATO  ', quantity: 2, unit: '' },
      [stock('tomatoes', ' tomatoes ', 2, '')],
    );

    expect(result).toMatchObject({
      classification: 'alias',
      matchKind: 'alias',
      canonicalIngredient: { id: 'tomato', name: 'tomato' },
      totalConfirmedQuantity: 2,
      remainingRequirement: 0,
      reasonCode: null,
    });

    const unrelatedPlural = matchIngredientToStock(
      { name: 'bean', quantity: 1, unit: 'g' },
      [stock('beans', 'beans', 1, 'g')],
    );
    expect(unrelatedPlural.classification).toBe('unmatched');
  });

  it.each([
    ['g', 1_000, 'kg', 1],
    ['kg', 1, 'g', 1_000],
    ['ml', 1_000, 'l', 1],
    ['l', 1, 'ml', 1_000],
  ])('converts %s requirements from %s stock exactly', (requestedUnit, requested, stockUnit, available) => {
    const result = matchIngredientToStock(
      { name: 'ingredient', quantity: requested, unit: requestedUnit },
      [stock('stock', 'ingredient', available, stockUnit)],
    );

    expect(result).toMatchObject({
      classification: 'exact',
      totalConfirmedQuantity: requested,
      remainingRequirement: 0,
      reasonCode: null,
    });
    expect(result.allocations[0]).toMatchObject({
      allocatedQuantity: requested,
      stockQuantity: available,
    });
  });

  it('aggregates compatible rows and returns deterministic per-row allocations', () => {
    const inventory = [
      stock('first', 'tomatoes', 0.25, 'kg'),
      stock('second', 'tomato', 400, 'g'),
    ];
    const result = matchIngredientToStock(
      { name: 'tomato', quantity: 600, unit: 'g' },
      inventory,
    );

    expect(result.classification).toBe('alias');
    expect(result.allocations).toEqual([
      expect.objectContaining({ stockItemId: 'first', allocatedQuantity: 250, stockQuantity: 0.25 }),
      expect.objectContaining({ stockItemId: 'second', allocatedQuantity: 350, stockQuantity: 350 }),
    ]);
    expect(result.totalConfirmedQuantity).toBe(600);
    expect(result.remainingRequirement).toBe(0);

    const remainder = matchIngredientToStock(
      { name: 'tomato', quantity: 50, unit: 'g' },
      inventory,
      result.remainingStockLedger,
    );
    expect(remainder.allocations).toEqual([
      expect.objectContaining({ stockItemId: 'second', allocatedQuantity: 50 }),
    ]);
  });

  it.each([
    ['can', 'cans'],
    ['bag', 'bags'],
    ['bunch', 'bunches'],
    ['piece', 'pieces'],
    ['pack', 'packs'],
    ['g', 'ml'],
  ])('does not infer a conversion from %s to %s', (requestedUnit, stockUnit) => {
    const result = matchIngredientToStock(
      { name: 'tomato', quantity: 1, unit: requestedUnit },
      [stock('stock', 'tomato', 1, stockUnit)],
    );

    expect(result).toMatchObject({
      classification: 'review',
      requiresReview: true,
      reasonCode: 'incompatible-unit',
      totalConfirmedQuantity: 0,
      remainingRequirement: 1,
      allocations: [],
    });
  });

  it('returns stable review results for ambiguous aliases and unknown stock quantities', () => {
    const registry = createIngredientAliasRegistry([
      { id: 'kidney-bean', name: 'kidney bean', aliases: ['red bean'] },
      { id: 'adzuki-bean', name: 'adzuki bean', aliases: ['red bean'] },
    ]);
    const ambiguous = matchIngredientToStock(
      { name: 'red bean', quantity: 100, unit: 'g' },
      [stock('kidney', 'kidney bean', 100, 'g')],
      undefined,
      registry,
    );
    expect(ambiguous).toMatchObject({
      classification: 'review',
      reasonCode: 'ambiguous-alias',
      allocations: [],
    });

    const unknown = matchIngredientToStock(
      { name: 'tomato', quantity: 100, unit: 'g' },
      [stock('tomato', 'tomato', null, 'g')],
    );
    expect(unknown).toMatchObject({
      classification: 'review',
      reasonCode: 'unknown-stock-quantity',
      allocations: [],
    });

    const unknownRequirement = matchIngredientToStock(
      { name: 'tomato', quantity: null, unit: 'g' },
      [stock('tomato', 'tomato', 100, 'g')],
    );
    expect(unknownRequirement).toMatchObject({
      classification: 'review',
      reasonCode: 'unknown-required-quantity',
      allocations: [],
    });
  });

  it('applies confirmed partial coverage without mutating stock or the input ledger', () => {
    const inventory = [stock('tomato', 'tomato', 250, 'g')];
    const ledger = createStockLedger(inventory);
    const before = new Map(ledger);
    const result = matchIngredientToStock(
      { name: 'tomato', quantity: 300, unit: 'g' },
      inventory,
      ledger,
    );

    expect(result).toMatchObject({
      classification: 'exact',
      reasonCode: 'insufficient-stock',
      totalConfirmedQuantity: 250,
      remainingRequirement: 50,
    });
    expect(ledger).toEqual(before);
    expect(inventory[0].quantity).toBe(250);
  });
});
