export interface OdaProductMapping {
  ingredientKey: string;
  productId: string;
  productName: string;
  packSize: string;
  lastConfirmedAt: string;
}

export interface OdaCartPreviewLine {
  shoppingItemId: string;
  productId: string;
  productName: string;
  quantity: number;
  confidence: 'exact' | 'preferred' | 'needs-review';
}

// The local MVP deliberately has no implementation. A future hosted edition should
// implement this contract server-side and require confirmation before applyCartPreview.
export interface OdaConnector {
  previewCart(shoppingWeek: string): Promise<OdaCartPreviewLine[]>;
  applyCartPreview(lines: OdaCartPreviewLine[]): Promise<{ cartUrl: string }>;
}
