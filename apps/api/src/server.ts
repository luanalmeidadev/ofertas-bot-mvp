import Fastify from 'fastify';
import { offerQueue } from './queue.js';
import { prisma } from '@ofertas/database';
import {
  OfferEngine,
  decideOffer,
  renderOfferPost,
} from '@ofertas/core';

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

app.get('/health', async () => ({
  ok: true,
}));

// IMPORTA E ANALISA OFERTAS

app.post('/offers/import', async () => {
  let imported = 0;
  let detected = 0;

  for (const provider of providers) {
    const marketplace = await prisma.marketplace.findUniqueOrThrow({
      where: {
        slug: provider.marketplace,
      },
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

      // Não cria novamente a mesma oferta nas últimas 24 horas.
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

      if (decision === 'REJECT') {
        continue;
      }

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
          decision,
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

// PUBLICA AUTOMATICAMENTE OFERTAS COM DECISÃO AUTO

app.post('/offers/publish-auto', async () => {
  const channel = await prisma.channel.findFirstOrThrow({
    where: {
      name: 'Ofertas Gerais',
      status: 'ACTIVE',
    },
  });

  const offers = await prisma.offer.findMany({
    where: {
      status: 'NEW',
      decision: 'AUTO',
    },
    orderBy: {
      detectedAt: 'asc',
    },
  });

  for (const [index, offer] of offers.entries()) {
  const baseDelay = index * channel.minIntervalSeconds * 1000;

  const jitter =
    Math.floor(Math.random() * 90) * 1000;

  const delay = baseDelay + jitter;

    await offerQueue.add(
      'publish-offer',
      {
        offerId: offer.id,
        channelId: channel.id,
      },
      {
        jobId: `offer-${offer.id}-${channel.id}`,
        delay,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    await prisma.offer.update({
      where: {
        id: offer.id,
      },
      data: {
        status: 'QUEUED',
      },
    });
  }

  return {
    queued: offers.length,
    intervalSeconds: channel.minIntervalSeconds,
  };
});

const port = Number(
  process.env.API_PORT ?? 3333,
);

await app.listen({
  port,
  host: '0.0.0.0',
});