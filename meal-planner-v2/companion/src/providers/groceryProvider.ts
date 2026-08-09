import type {
  GroceryCart,
  ProductSearchPage,
  ProviderCapabilities,
} from '../contracts/grocery.js';

/**
 * Prompt 1 deliberately exposes read operations only. Mutation methods will live in a separate,
 * confirmation-aware interface after the cart-write release gate is approved.
 */
export interface GroceryProvider {
  readonly id: string;
  getCapabilities(): Promise<ProviderCapabilities>;
  searchProducts(query: string, page?: number): Promise<ProductSearchPage>;
  getCart(): Promise<GroceryCart>;
}
