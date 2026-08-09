import { z } from 'zod';

export const providerCapabilitiesSchema = z
  .object({
    productSearch: z.boolean(),
    cartRead: z.boolean(),
    orderHistory: z.boolean(),
  })
  .strict();

export const groceryProductSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    subtitle: z.string(),
    priceNok: z.number().nonnegative().nullable(),
    unitPriceNok: z.number().nonnegative().nullable(),
    unitPriceUnit: z.string(),
    availability: z.enum(['available', 'unavailable', 'unknown']),
  })
  .strict();

export const productSearchPageSchema = z
  .object({
    query: z.string(),
    page: z.number().int().positive(),
    hasMore: z.boolean(),
    items: z.array(groceryProductSchema),
  })
  .strict();

export const groceryCartItemSchema = z
  .object({
    productId: z.string().min(1),
    name: z.string().min(1),
    quantity: z.number().int().nonnegative(),
    linePriceNok: z.number().nonnegative().nullable(),
  })
  .strict();

export const groceryCartSchema = z
  .object({
    items: z.array(groceryCartItemSchema),
    totalNok: z.number().nonnegative().nullable(),
  })
  .strict();

export type ProviderCapabilities = z.infer<typeof providerCapabilitiesSchema>;
export type GroceryProduct = z.infer<typeof groceryProductSchema>;
export type ProductSearchPage = z.infer<typeof productSearchPageSchema>;
export type GroceryCart = z.infer<typeof groceryCartSchema>;

export interface ApiEnvelope<T> {
  data: T | null;
  error: { code: string; message: string } | null;
  meta: { version: string };
}
