import Fastify from 'fastify';
import { prisma } from '@ofertas/database';
import { OfferEngine, decideOffer } from '@ofertas/core';
import {
  MockMercadoLivreProvider,
  MockShopeeProvider,
} from '@ofertas/marketplaces';

const app = Fastify({ logger: true });

const engine = new OfferEngine({
  minDiscountPercent: Number(process.env.MIN_DISCOUNT_PERCENT ?? 20),
  minOfferScore: Number(process.env.MIN_OFFER_SCORE ?? 55),
});

const providers = [
  new MockShopeeProvider(),
  new MockMercadoLivreProvider(),
];

app.get('/health', async () => ({ ok: true }));

app.post('/offers/import', async () => {
  let imported = 0;
  let detected = 0;

  for (const provider of providers) {
    const marketplace = await prisma.marketplace.findUniqueOrThrow({
      where: { slug: provider.marketplace },
    });

    const products = await provider.getDeals();

    for (const item of products) {
      const product = await prisma.product.upsert({
        where: {
          marketplaceId_externalId: {
            marketplaceId: marketplace.id,
            externalId: item.externalId,
          },
        },

        update: {
          title: item.title,
          category: item.category,
          sellerName: item.sellerName,
          productUrl: item.productUrl,
          imageUrl: item.imageUrl,
          currentPrice: item.currentPrice,
          originalPrice: item.originalPrice,
          discountPercent: item.discountPercent,
          rating: item.rating,
          salesCount: item.salesCount,
          commissionRate: item.commissionRate,
          commissionValue: item.commissionValue,
          lastSeenAt: new Date(),
        },

        create: {
          marketplaceId: marketplace.id,
          externalId: item.externalId,
          title: item.title,
          category: item.category,
          sellerName: item.sellerName,
          productUrl: item.productUrl,
          imageUrl: item.imageUrl,
          currentPrice: item.currentPrice,
          originalPrice: item.originalPrice,
          discountPercent: item.discountPercent,
          rating: item.rating,
          salesCount: item.salesCount,
          commissionRate: item.commissionRate,
          commissionValue: item.commissionValue,
        },
      });

      imported++;

      const offer = engine.evaluate(item);

      if (!offer) {
        continue;
      }

      const recentOffer = await prisma.offer.findFirst({
        where: {
          productId: product.id,
          detectedAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        orderBy: {
          detectedAt: 'desc',
        },
      });

      if (recentOffer) {
        continue;
      }

      const decision = decideOffer(offer.score);

      const affiliateUrl =
        await provider.generateAffiliateLink(item);

      await prisma.offer.create({
        data: {
          productId: product.id,
          currentPrice: item.currentPrice,
          originalPrice: item.originalPrice,
          discountPercent: item.discountPercent,
          commissionRate: item.commissionRate,
          commissionValue: item.commissionValue,
          affiliateUrl,
          couponCode: item.couponCode,
          score: offer.score,
          status: 'NEW',
        },
      });

      await prisma.eventLog.create({
        data: {
          entityId: product.id,
          event: 'OFFER_DETECTED',
          metadata: {
            marketplace: provider.marketplace,
            score: offer.score,
            decision,
            reasons: offer.reasons,
          },
        },
      });

      detected++;
    }
  }

  return {
    imported,
    detected,
  };
});

const port = Number(process.env.API_PORT ?? 3333);

await app.listen({
  port,
  host: '0.0.0.0',
});