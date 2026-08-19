import type { MarketplaceSlug, NormalizedProduct } from '@ofertas/shared';

export interface MarketplaceProvider {
  readonly marketplace: MarketplaceSlug;
  getDeals(): Promise<NormalizedProduct[]>;
  generateAffiliateLink(product: NormalizedProduct): Promise<string>;
}

export class MockShopeeProvider implements MarketplaceProvider {
  readonly marketplace = 'SHOPEE' as const;

  async getDeals(): Promise<NormalizedProduct[]> {
    return [
      {
        marketplace: 'SHOPEE',
        externalId: 'shp-001',
        title: 'Fone Bluetooth TWS com estojo carregador',
        category: 'Eletronicos',
        sellerName: 'Loja Demo',
        productUrl: 'https://example.test/shopee/shp-001',
        currentPrice: 59.9,
        originalPrice: 119.9,
        discountPercent: 50,
        rating: 4.8,
        salesCount: 12400,
        commissionRate: 7,
        couponCode: 'OFERTA10'
      },
      {
        marketplace: 'SHOPEE',
        externalId: 'shp-002',
        title: 'Organizador modular para cozinha',
        category: 'Casa',
        productUrl: 'https://example.test/shopee/shp-002',
        currentPrice: 42.9,
        originalPrice: 49.9,
        discountPercent: 14,
        rating: 4.4,
        salesCount: 320
      }
    ];
  }

  async generateAffiliateLink(product: NormalizedProduct): Promise<string> {
    return `${product.productUrl}?aff_id=mock-shopee`;
  }
}

export class MockMercadoLivreProvider implements MarketplaceProvider {
  readonly marketplace = 'MERCADO_LIVRE' as const;

  async getDeals(): Promise<NormalizedProduct[]> {
    return [
      {
        marketplace: 'MERCADO_LIVRE',
        externalId: 'mlb-001',
        title: 'Smart Plug Wi-Fi compativel com assistentes de voz',
        category: 'Casa Inteligente',
        productUrl: 'https://example.test/ml/mlb-001',
        currentPrice: 69.9,
        originalPrice: 99.9,
        discountPercent: 30,
        rating: 4.7,
        salesCount: 2500,
        commissionRate: 5
      }
    ];
  }

  async generateAffiliateLink(product: NormalizedProduct): Promise<string> {
    return `${product.productUrl}?matt_tool=mock-ml`;
  }
}
