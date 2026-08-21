export type MarketplaceSlug = 'SHOPEE' | 'MERCADO_LIVRE';

export type NormalizedProduct = {
  marketplace: MarketplaceSlug;
  externalId: string;
  title: string;
  category?: string;
  sellerName?: string;
  productUrl: string;
  imageUrl?: string;
  currentPrice: number;
  originalPrice?: number;
  discountPercent?: number;
  rating?: number;
  salesCount?: number;
  commissionRate?: number;
  commissionValue?: number;
  couponCode?: string;
  metadata?: Record<string, unknown>;
};

export type DetectedOffer = NormalizedProduct & {
  score: number;
  reasons: string[];
};

export type OfferDecision = 'AUTO' | 'REVIEW' | 'REJECT';