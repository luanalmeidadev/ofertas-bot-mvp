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
      couponCode: 'OFERTA10',
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
      salesCount: 320,
    },
    {
      marketplace: 'SHOPEE',
      externalId: 'shp-003',
      title: 'Air Fryer 5L digital',
      category: 'Eletrodomesticos',
      productUrl: 'https://example.test/shopee/shp-003',
      currentPrice: 299.9,
      originalPrice: 499.9,
      discountPercent: 40,
      rating: 4.9,
      salesCount: 8300,
      commissionRate: 8,
      couponCode: 'AIR50',
    },
    {
      marketplace: 'SHOPEE',
      externalId: 'shp-004',
      title: 'Kit de potes hermeticos',
      category: 'Casa',
      productUrl: 'https://example.test/shopee/shp-004',
      currentPrice: 79.9,
      originalPrice: 109.9,
      discountPercent: 27,
      rating: 4.6,
      salesCount: 1800,
      commissionRate: 3,
    },
    {
      marketplace: 'SHOPEE',
      externalId: 'shp-005',
      title: 'Cabo USB-C 2 metros',
      category: 'Acessorios',
      productUrl: 'https://example.test/shopee/shp-005',
      currentPrice: 24.9,
      originalPrice: 27.9,
      discountPercent: 11,
      rating: 4.2,
      salesCount: 150,
    },
    {
      marketplace: 'SHOPEE',
      externalId: 'shp-006',
      title: 'Smartwatch AMOLED com GPS',
      category: 'Eletronicos',
      productUrl: 'https://example.test/shopee/shp-006',
      currentPrice: 189.9,
      originalPrice: 349.9,
      discountPercent: 46,
      rating: 4.8,
      salesCount: 6200,
      commissionRate: 7,
      couponCode: 'WATCH20',
    },
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
      commissionRate: 5,
    },
    {
      marketplace: 'MERCADO_LIVRE',
      externalId: 'mlb-002',
      title: 'SSD NVMe 1TB',
      category: 'Informatica',
      productUrl: 'https://example.test/ml/mlb-002',
      currentPrice: 329.9,
      originalPrice: 479.9,
      discountPercent: 31,
      rating: 4.8,
      salesCount: 4100,
      commissionRate: 6,
      couponCode: 'TECH20',
    },
    {
      marketplace: 'MERCADO_LIVRE',
      externalId: 'mlb-003',
      title: 'Tenis casual masculino',
      category: 'Moda',
      productUrl: 'https://example.test/ml/mlb-003',
      currentPrice: 199.9,
      originalPrice: 249.9,
      discountPercent: 20,
      rating: 4.5,
      salesCount: 1100,
      commissionRate: 2,
    },
  ];
}

  async generateAffiliateLink(product: NormalizedProduct): Promise<string> {
    return `${product.productUrl}?matt_tool=mock-ml`;
  }
}
