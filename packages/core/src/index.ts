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

function generateOfferHook(offer: DetectedOffer): string {
  const text = `${offer.title} ${offer.category ?? ''}`.toLowerCase();

  if (text.includes('air fryer')) {
    return '🍟 Air Fryer nesse preço? A dieta que lute 😂🔥';
  }

  if (
    text.includes('fone') ||
    text.includes('headphone') ||
    text.includes('earbuds')
  ) {
    return '🎧 Pra quem tava precisando de fone novo, olha esse achado! 👀🔥';
  }

  if (text.includes('ssd')) {
    return '💻 Tá faltando espaço no PC? Olha o preço desse SSD 👀🔥';
  }

  if (
    text.includes('tenis') ||
    text.includes('tênis')
  ) {
    return '👟 Achadinho pra renovar o tênis sem judiar do bolso 🔥';
  }

  if (
    text.includes('cozinha') ||
    text.includes('casa')
  ) {
    return '🏠 Achadinho útil pra casa com preço bom de verdade 👀';
  }

  if ((offer.discountPercent ?? 0) >= 40) {
    return `🚨 EITA! ${offer.discountPercent}% OFF nisso aqui 👀🔥`;
  }

  return '🔥 Olha esse achadinho que apareceu agora! 👀';
}

export function renderOfferPost(
  offer: DetectedOffer,
  affiliateUrl: string,
): string {
  const oldPrice = offer.originalPrice
    ? `De ~R$ ${offer.originalPrice.toFixed(2).replace('.', ',')}~`
    : '';

  const discount = offer.discountPercent
    ? `🔥 ${offer.discountPercent}% OFF`
    : '';

  const coupon = offer.couponCode
    ? `🎟️ Cupom: ${offer.couponCode}`
    : '';

  return [
    generateOfferHook(offer),
'',
`*${offer.title}*`,
    '',
    oldPrice,
    `Por *R$ ${offer.currentPrice.toFixed(2).replace('.', ',')}* 🔥`,
    discount,
    '',
    coupon,
    coupon ? '' : null,
    '👉 Pegar promoção:',
    affiliateUrl,
    '',
    '⚠️ Preço pode mudar a qualquer momento.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}
