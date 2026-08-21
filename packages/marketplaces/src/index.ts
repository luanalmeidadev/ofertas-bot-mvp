import fs from 'node:fs/promises';
import type {
  MarketplaceSlug,
  NormalizedProduct,
} from '@ofertas/shared';

export interface MarketplaceProvider {
  readonly marketplace: MarketplaceSlug;
  getDeals(): Promise<NormalizedProduct[]>;
  generateAffiliateLink(
    product: NormalizedProduct,
  ): Promise<string>;
}

export class ShopeeCsvProvider implements MarketplaceProvider {
  readonly marketplace = 'SHOPEE' as const;

  constructor(
    private readonly csvPath: string,
  ) {}

  async getDeals(): Promise<NormalizedProduct[]> {
    const csv = await fs.readFile(this.csvPath, 'utf8');

    const lines = csv
      .split(/\r?\n/)
      .filter(Boolean);

    const [, ...rows] = lines;

    return rows.map((line: string) => {
      const columns = this.parseCsvLine(line);

      const [
        itemId,
        itemName,
        price,
        sales,
        sellerName,
        commissionRate,
        commission,
        productLink,
        offerLink,
      ] = columns;

      if (
        !itemId ||
        !itemName ||
        !price ||
        !sales ||
        !sellerName ||
        !commissionRate ||
        !commission ||
        !productLink ||
        !offerLink
      ) {
        throw new Error(
          `Linha inválida no CSV da Shopee: ${line}`,
        );
      }

      return {
        marketplace: 'SHOPEE',
        externalId: itemId,
        title: itemName,
        sellerName,
        productUrl: productLink,
        currentPrice: this.parseNumber(price),
        salesCount: this.parseSales(sales),
        commissionRate: this.parsePercent(commissionRate),
        commissionValue: this.parseCurrency(commission),
        metadata: {
          offerLink,
        },
      };
    });
  }

  async generateAffiliateLink(
    product: NormalizedProduct,
  ): Promise<string> {
    const offerLink =
      product.metadata?.offerLink;

    if (
      typeof offerLink !== 'string' ||
      !offerLink
    ) {
      throw new Error(
        `Offer Link não encontrado para ${product.externalId}`,
      );
    }

    return offerLink;
  }

  private parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        insideQuotes = !insideQuotes;
        continue;
      }

      if (char === ',' && !insideQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current.trim());

    return result;
  }

  private parseNumber(value: string): number {
    return Number(
      value
        .replace(/\./g, '')
        .replace(',', '.'),
    );
  }

  private parsePercent(value: string): number {
    return Number(
      value.replace('%', '').trim(),
    );
  }

  private parseCurrency(value: string): number {
    return Number(
      value
        .replace('R$', '')
        .trim()
        .replace(/\./g, '')
        .replace(',', '.'),
    );
  }

  private parseSales(value: string): number {
    const normalized = value
      .toLowerCase()
      .replace(/\s/g, '');

    if (normalized.includes('mi+')) {
      return (
        Number(
          normalized
            .replace('mi+', '')
            .replace(',', '.'),
        ) * 1_000_000
      );
    }

    if (normalized.includes('mil+')) {
      return (
        Number(
          normalized
            .replace('mil+', '')
            .replace(',', '.'),
        ) * 1_000
      );
    }

    return Number(
      normalized.replace(/\D/g, ''),
    );
  }
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
    {
      marketplace: 'SHOPEE',
      externalId: 'shp-007',
      title: 'Caixa de som Bluetooth portátil',
      category: 'Eletronicos',
      productUrl: 'https://example.test/shopee/shp-007',
      currentPrice: 129.9,
      originalPrice: 249.9,
      discountPercent: 48,
      rating: 4.8,
      salesCount: 5400,
      commissionRate: 7,
      couponCode: 'SOM20',
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
    {
      marketplace: 'MERCADO_LIVRE',
      externalId: 'mlb-004',
      title: 'Aspirador vertical 2 em 1',
      category: 'Casa',
      productUrl: 'https://example.test/ml/mlb-004',
      currentPrice: 179.9,
      originalPrice: 239.9,
      discountPercent: 25,
      rating: 4.6,
      salesCount: 1500,
      commissionRate: 5,
    },
  ];
}

  async generateAffiliateLink(product: NormalizedProduct): Promise<string> {
    return `${product.productUrl}?matt_tool=mock-ml`;
  }
}
