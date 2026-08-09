import {
  groceryCartSchema,
  productSearchPageSchema,
  providerCapabilitiesSchema,
  type GroceryCart,
  type ProductSearchPage,
  type ProviderCapabilities,
} from '../contracts/grocery.js';
import type { GroceryProvider } from './groceryProvider.js';

const DEFAULT_PRODUCTS: ProductSearchPage = {
  query: 'chicken breast',
  page: 1,
  hasMore: false,
  items: [
    {
      id: 'oda-demo-101',
      name: 'Chicken breast fillets',
      subtitle: 'Approx. 580 g',
      priceNok: 94.9,
      unitPriceNok: 163.62,
      unitPriceUnit: 'kg',
      availability: 'available',
    },
    {
      id: 'oda-demo-102',
      name: 'Diced chicken breast',
      subtitle: '400 g',
      priceNok: 74.9,
      unitPriceNok: 187.25,
      unitPriceUnit: 'kg',
      availability: 'available',
    },
  ],
};

const DEFAULT_CART: GroceryCart = {
  items: [{ productId: 'oda-demo-900', name: 'Whole milk', quantity: 1, linePriceNok: 24.9 }],
  totalNok: 24.9,
};

export interface FakeProviderData {
  capabilities?: ProviderCapabilities;
  products?: ProductSearchPage;
  cart?: GroceryCart;
}

export class FakeGroceryProvider implements GroceryProvider {
  readonly id = 'fake-oda';
  private readonly capabilities: ProviderCapabilities;
  private readonly products: ProductSearchPage;
  private readonly cart: GroceryCart;

  constructor(data: FakeProviderData = {}) {
    this.capabilities = providerCapabilitiesSchema.parse(
      data.capabilities ?? { productSearch: true, cartRead: true, orderHistory: false },
    );
    this.products = productSearchPageSchema.parse(data.products ?? DEFAULT_PRODUCTS);
    this.cart = groceryCartSchema.parse(data.cart ?? DEFAULT_CART);
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return structuredClone(this.capabilities);
  }

  async searchProducts(query: string, page = 1): Promise<ProductSearchPage> {
    const result = structuredClone(this.products);
    return { ...result, query, page };
  }

  async getCart(): Promise<GroceryCart> {
    return structuredClone(this.cart);
  }
}
