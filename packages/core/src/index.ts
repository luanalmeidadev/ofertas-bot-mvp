import type {
  DetectedOffer,
  NormalizedProduct,
  OfferDecision,
} from '@ofertas/shared';

export type OfferEngineConfig = {
  minDiscountPercent: number;
  minOfferScore: number;
};

export function calculateOfferScore(product: NormalizedProduct): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const discount = product.discountPercent ?? 0;
  if (discount >= 20) {
    score += Math.min(45, discount);
    reasons.push(`${discount}% de desconto`);
  }

  if ((product.rating ?? 0) >= 4.5) {
    score += 15;
    reasons.push('avaliacao alta');
  }

  if ((product.salesCount ?? 0) >= 1000) {
    score += 10;
    reasons.push('alto volume de vendas');
  }

  if ((product.commissionRate ?? 0) >= 5) {
    score += 15;
    reasons.push('boa comissao');
  }

  if (product.couponCode) {
    score += 15;
    reasons.push('possui cupom');
  }

  return { score: Math.min(100, score), reasons };
}

export class OfferEngine {
  constructor(private readonly config: OfferEngineConfig) {}

  evaluate(product: NormalizedProduct): DetectedOffer | null {
    const { score, reasons } = calculateOfferScore(product);
    const discount = product.discountPercent ?? 0;

    if (discount < this.config.minDiscountPercent && score < this.config.minOfferScore) {
      return null;
    }

    if (score < this.config.minOfferScore) {
      return null;
    }

    return { ...product, score, reasons };
  }
}

export function decideOffer(score: number): OfferDecision {
  if (score >= 85) return 'AUTO';
  if (score >= 55) return 'REVIEW';

  return 'REJECT';
}

export function renderOfferPost(offer: DetectedOffer, affiliateUrl: string): string {
  const before = offer.originalPrice ? `De: R$ ${offer.originalPrice.toFixed(2).replace('.', ',')}\n` : '';
  const coupon = offer.couponCode ? `\n🎟️ Cupom: ${offer.couponCode}\n` : '';

  return [
    '🔥 OFERTA ENCONTRADA!',
    '',
    offer.title,
    '',
    before.trimEnd(),
    `🔥 Por: R$ ${offer.currentPrice.toFixed(2).replace('.', ',')}`,
    offer.discountPercent ? `💰 ${offer.discountPercent}% OFF` : '',
    coupon.trim(),
    '',
    `🛒 Comprar: ${affiliateUrl}`,
    '',
    '⚠️ Preco e disponibilidade podem mudar.'
  ].filter(Boolean).join('\n');
}
