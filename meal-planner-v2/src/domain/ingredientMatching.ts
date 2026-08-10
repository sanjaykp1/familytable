import type { HomeStockItem } from './types';

const ATOMIC_SCALE = 1_000_000;

export interface CanonicalIngredient {
  id: string;
  name: string;
}

export interface CanonicalIngredientDefinition extends CanonicalIngredient {
  aliases: readonly string[];
}

export interface IngredientAliasRegistry {
  readonly definitions: readonly CanonicalIngredientDefinition[];
  readonly byName: ReadonlyMap<string, readonly CanonicalIngredient[]>;
}

export type IngredientUnitFamily = 'mass' | 'volume' | 'exact';
export type IngredientMatchKind = 'exact' | 'alias' | 'unmatched';
export type IngredientReviewReasonCode =
  | 'ambiguous-alias'
  | 'unknown-required-quantity'
  | 'unknown-stock-quantity'
  | 'incompatible-unit';
export type IngredientMatchReasonCode =
  | IngredientReviewReasonCode
  | 'no-name-match'
  | 'insufficient-stock'
  | null;

/** Quantities are stored as integer millionths of the unit family's stable base unit. */
export type StockLedger = ReadonlyMap<string, number | null>;

export interface IngredientStockAllocation {
  stockItemId: string;
  stockItemName: string;
  matchKind: Exclude<IngredientMatchKind, 'unmatched'>;
  /** Quantity expressed in the requested ingredient unit. */
  allocatedQuantity: number;
  requestedUnit: string;
  /** Quantity consumed from the stock row, expressed in that row's own unit. */
  stockQuantity: number;
  stockUnit: string;
  /** Integer millionths of g, ml, or the unchanged exact unit. */
  baseQuantity: number;
}

interface IngredientMatchBase {
  canonicalIngredient: CanonicalIngredient | null;
  matchKind: IngredientMatchKind;
  requestedName: string;
  requestedQuantity: number | null;
  requestedUnit: string;
  unitFamily: IngredientUnitFamily;
  allocations: IngredientStockAllocation[];
  matchedStockItemIds: string[];
  totalConfirmedQuantity: number;
  remainingRequirement: number | null;
  remainingStockLedger: StockLedger;
  requiresReview: boolean;
  reasonCode: IngredientMatchReasonCode;
}

export interface ExactIngredientMatch extends IngredientMatchBase {
  classification: 'exact';
  canonicalIngredient: CanonicalIngredient;
  matchKind: 'exact';
  requiresReview: false;
  reasonCode: 'insufficient-stock' | null;
}

export interface AliasIngredientMatch extends IngredientMatchBase {
  classification: 'alias';
  canonicalIngredient: CanonicalIngredient;
  matchKind: 'alias';
  requiresReview: false;
  reasonCode: 'insufficient-stock' | null;
}

export interface UnmatchedIngredientMatch extends IngredientMatchBase {
  classification: 'unmatched';
  canonicalIngredient: CanonicalIngredient;
  matchKind: 'unmatched';
  allocations: [];
  requiresReview: false;
  reasonCode: 'no-name-match';
}

export interface ReviewIngredientMatch extends IngredientMatchBase {
  classification: 'review';
  requiresReview: true;
  reasonCode: IngredientReviewReasonCode;
  allocations: [];
}

export type IngredientMatchResult =
  | ExactIngredientMatch
  | AliasIngredientMatch
  | UnmatchedIngredientMatch
  | ReviewIngredientMatch;

export interface IngredientMatchRequest {
  name: string;
  quantity: number | null;
  unit: string;
}

interface UnitDescriptor {
  normalized: string;
  family: IngredientUnitFamily;
  baseFactor: number;
}

interface NameResolution {
  normalized: string;
  canonical: CanonicalIngredient | null;
  candidates: readonly CanonicalIngredient[];
  ambiguous: boolean;
}

interface NameMatchedStock {
  item: HomeStockItem;
  matchKind: Exclude<IngredientMatchKind, 'unmatched'>;
}

export function normalizeIngredientText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function createIngredientAliasRegistry(
  definitions: readonly CanonicalIngredientDefinition[],
): IngredientAliasRegistry {
  const byName = new Map<string, CanonicalIngredient[]>();

  for (const definition of definitions) {
    const canonical = { id: definition.id, name: normalizeIngredientText(definition.name) };
    const names = new Set([definition.name, ...definition.aliases].map(normalizeIngredientText));
    for (const name of names) {
      const candidates = byName.get(name) ?? [];
      if (!candidates.some((candidate) => candidate.id === canonical.id)) {
        candidates.push(canonical);
      }
      byName.set(name, candidates);
    }
  }

  return { definitions, byName };
}

export const DEFAULT_INGREDIENT_ALIAS_REGISTRY = createIngredientAliasRegistry([
  { id: 'tomato', name: 'tomato', aliases: ['tomatoes'] },
]);

function resolveName(name: string, registry: IngredientAliasRegistry): NameResolution {
  const normalized = normalizeIngredientText(name);
  const registered = registry.byName.get(normalized) ?? [];
  if (registered.length > 1) {
    return { normalized, canonical: null, candidates: registered, ambiguous: true };
  }
  if (registered.length === 1) {
    return { normalized, canonical: registered[0], candidates: registered, ambiguous: false };
  }
  const literal = { id: `literal:${normalized}`, name: normalized };
  return { normalized, canonical: literal, candidates: [literal], ambiguous: false };
}

function describeUnit(unit: string): UnitDescriptor {
  const normalized = normalizeIngredientText(unit);
  if (normalized === 'g') return { normalized, family: 'mass', baseFactor: 1 };
  if (normalized === 'kg') return { normalized, family: 'mass', baseFactor: 1_000 };
  if (normalized === 'ml') return { normalized, family: 'volume', baseFactor: 1 };
  if (normalized === 'l') return { normalized, family: 'volume', baseFactor: 1_000 };
  return { normalized, family: 'exact', baseFactor: 1 };
}

function compatibleUnits(left: UnitDescriptor, right: UnitDescriptor): boolean {
  if (left.family !== right.family) return false;
  return left.family !== 'exact' || left.normalized === right.normalized;
}

function toBaseQuantity(quantity: number, unit: UnitDescriptor): number {
  return Math.round(Math.max(0, quantity) * unit.baseFactor * ATOMIC_SCALE);
}

function fromBaseQuantity(baseQuantity: number, unit: UnitDescriptor): number {
  return Number((baseQuantity / (unit.baseFactor * ATOMIC_SCALE)).toFixed(6));
}

export function createStockLedger(homeStockItems: readonly HomeStockItem[]): StockLedger {
  return new Map(
    homeStockItems
      .filter((item) => item.kind === 'food' && !item.archived)
      .map((item) => [
        item.id,
        item.quantity === null ? null : toBaseQuantity(item.quantity, describeUnit(item.unit)),
      ] as const),
  );
}

function unchangedLedger(ledger: StockLedger): StockLedger {
  return new Map(ledger);
}

function reviewResult(
  request: IngredientMatchRequest,
  requestUnit: UnitDescriptor,
  canonicalIngredient: CanonicalIngredient | null,
  matchKind: IngredientMatchKind,
  matchedStockItemIds: string[],
  reasonCode: IngredientReviewReasonCode,
  ledger: StockLedger,
): ReviewIngredientMatch {
  return {
    classification: 'review',
    canonicalIngredient,
    matchKind,
    requestedName: request.name,
    requestedQuantity: request.quantity,
    requestedUnit: request.unit,
    unitFamily: requestUnit.family,
    allocations: [],
    matchedStockItemIds,
    totalConfirmedQuantity: 0,
    remainingRequirement: request.quantity,
    remainingStockLedger: unchangedLedger(ledger),
    requiresReview: true,
    reasonCode,
  };
}

/**
 * Reconciles one ingredient need against active food stock without mutating either input.
 * Only g/kg and ml/l share base units; every other unit is compatible by exact text only.
 */
export function matchIngredientToStock(
  request: IngredientMatchRequest,
  homeStockItems: readonly HomeStockItem[],
  ledger: StockLedger = createStockLedger(homeStockItems),
  registry: IngredientAliasRegistry = DEFAULT_INGREDIENT_ALIAS_REGISTRY,
): IngredientMatchResult {
  const requestUnit = describeUnit(request.unit);
  const requestName = resolveName(request.name, registry);
  const activeStock = homeStockItems.filter((item) => item.kind === 'food' && !item.archived);

  if (requestName.ambiguous) {
    const ambiguousIds = activeStock
      .filter((item) => {
        const resolution = resolveName(item.name, registry);
        return resolution.candidates.some((candidate) =>
          requestName.candidates.some((requested) => requested.id === candidate.id),
        );
      })
      .map((item) => item.id);
    return reviewResult(
      request,
      requestUnit,
      null,
      'unmatched',
      ambiguousIds,
      'ambiguous-alias',
      ledger,
    );
  }

  const nameMatches: NameMatchedStock[] = [];
  const ambiguousStockIds: string[] = [];
  for (const item of activeStock) {
    const normalizedStockName = normalizeIngredientText(item.name);
    if (normalizedStockName === requestName.normalized) {
      nameMatches.push({ item, matchKind: 'exact' });
      continue;
    }

    const stockName = resolveName(item.name, registry);
    if (stockName.ambiguous) {
      if (stockName.candidates.some((candidate) => candidate.id === requestName.canonical?.id)) {
        ambiguousStockIds.push(item.id);
      }
      continue;
    }
    if (stockName.canonical?.id === requestName.canonical?.id) {
      nameMatches.push({ item, matchKind: 'alias' });
    }
  }

  const matchedStockItemIds = [
    ...nameMatches.map(({ item }) => item.id),
    ...ambiguousStockIds,
  ];
  const resolvedMatchKind: IngredientMatchKind = nameMatches.length
    ? nameMatches.every((match) => match.matchKind === 'exact')
      ? 'exact'
      : 'alias'
    : 'unmatched';

  if (ambiguousStockIds.length) {
    return reviewResult(
      request,
      requestUnit,
      requestName.canonical,
      resolvedMatchKind,
      matchedStockItemIds,
      'ambiguous-alias',
      ledger,
    );
  }

  if (request.quantity === null) {
    return reviewResult(
      request,
      requestUnit,
      requestName.canonical,
      resolvedMatchKind,
      matchedStockItemIds,
      'unknown-required-quantity',
      ledger,
    );
  }

  if (!nameMatches.length) {
    return {
      classification: 'unmatched',
      canonicalIngredient: requestName.canonical!,
      matchKind: 'unmatched',
      requestedName: request.name,
      requestedQuantity: request.quantity,
      requestedUnit: request.unit,
      unitFamily: requestUnit.family,
      allocations: [],
      matchedStockItemIds: [],
      totalConfirmedQuantity: 0,
      remainingRequirement: request.quantity,
      remainingStockLedger: unchangedLedger(ledger),
      requiresReview: false,
      reasonCode: 'no-name-match',
    };
  }

  const compatible = nameMatches.filter(({ item }) =>
    compatibleUnits(requestUnit, describeUnit(item.unit)),
  );
  if (compatible.length !== nameMatches.length) {
    return reviewResult(
      request,
      requestUnit,
      requestName.canonical,
      resolvedMatchKind,
      matchedStockItemIds,
      'incompatible-unit',
      ledger,
    );
  }

  if (compatible.some(({ item }) => (ledger.has(item.id) ? ledger.get(item.id) : item.quantity) === null)) {
    return reviewResult(
      request,
      requestUnit,
      requestName.canonical,
      resolvedMatchKind,
      matchedStockItemIds,
      'unknown-stock-quantity',
      ledger,
    );
  }

  const nextLedger = new Map(ledger);
  const allocations: IngredientStockAllocation[] = [];
  const requestedBaseQuantity = toBaseQuantity(request.quantity, requestUnit);
  let remainingBaseQuantity = requestedBaseQuantity;

  for (const match of compatible) {
    if (remainingBaseQuantity === 0) break;
    const stockUnit = describeUnit(match.item.unit);
    const available = nextLedger.has(match.item.id)
      ? nextLedger.get(match.item.id)
      : match.item.quantity === null
        ? null
        : toBaseQuantity(match.item.quantity, stockUnit);
    if (available === null || available === undefined || available <= 0) continue;
    const allocatedBaseQuantity = Math.min(available, remainingBaseQuantity);
    nextLedger.set(match.item.id, available - allocatedBaseQuantity);
    remainingBaseQuantity -= allocatedBaseQuantity;
    allocations.push({
      stockItemId: match.item.id,
      stockItemName: match.item.name,
      matchKind: match.matchKind,
      allocatedQuantity: fromBaseQuantity(allocatedBaseQuantity, requestUnit),
      requestedUnit: request.unit,
      stockQuantity: fromBaseQuantity(allocatedBaseQuantity, stockUnit),
      stockUnit: match.item.unit,
      baseQuantity: allocatedBaseQuantity,
    });
  }

  const totalConfirmedQuantity = fromBaseQuantity(
    requestedBaseQuantity - remainingBaseQuantity,
    requestUnit,
  );
  const remainingRequirement = fromBaseQuantity(remainingBaseQuantity, requestUnit);
  const reasonCode = remainingBaseQuantity > 0 ? 'insufficient-stock' as const : null;
  const shared = {
    canonicalIngredient: requestName.canonical!,
    requestedName: request.name,
    requestedQuantity: request.quantity,
    requestedUnit: request.unit,
    unitFamily: requestUnit.family,
    allocations,
    matchedStockItemIds,
    totalConfirmedQuantity,
    remainingRequirement,
    remainingStockLedger: nextLedger,
    requiresReview: false as const,
    reasonCode,
  };

  return resolvedMatchKind === 'exact'
    ? { ...shared, classification: 'exact', matchKind: 'exact' }
    : { ...shared, classification: 'alias', matchKind: 'alias' };
}
