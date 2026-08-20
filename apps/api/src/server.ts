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

  const now = new Date();

  const [startHour, startMinute] = (channel.allowedStartTime ?? '08:00')
    .split(':')
    .map(Number);

  const [endHour, endMinute] = (channel.allowedEndTime ?? '23:00')
    .split(':')
    .map(Number);

  const start = new Date(now);
  start.setHours(startHour, startMinute, 0, 0);

  const end = new Date(now);
  end.setHours(endHour, endMinute, 0, 0);

  let baseStart = now;

  if (now < start) {
    baseStart = start;
  } else if (now > end) {
    baseStart = new Date(start);
    baseStart.setDate(baseStart.getDate() + 1);
  }

  const scheduled: Array<{
  offerId: string;
  scheduledAt: string;
  }> = [];

  for (const [index, offer] of offers.entries()) {
  const batch = Math.floor(index / channel.maxPostsPerHour);
  const position = index % channel.maxPostsPerHour;

  const hourDelay = batch * 60 * 60 * 1000;

  const intervalDelay =
    position * channel.minIntervalSeconds * 1000;

  const jitter =
    Math.floor(Math.random() * 90) * 1000;

  const scheduledAt = new Date(
      baseStart.getTime() + hourDelay + intervalDelay + jitter,
    );

    if (scheduledAt > end && baseStart.getDate() === now.getDate()) {
      const tomorrow = new Date(start);
      tomorrow.setDate(tomorrow.getDate() + 1);

      scheduledAt.setTime(
        tomorrow.getTime() + hourDelay + intervalDelay + jitter,
      );
    }

    const delay = Math.max(
      0,
      scheduledAt.getTime() - Date.now(),
    );

    scheduled.push({
      offerId: offer.id,
      scheduledAt: new Date(Date.now() + delay).toISOString(),
    });

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
        removeOnComplete: true,
        removeOnFail: false,
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
    maxPostsPerHour: channel.maxPostsPerHour,
    window: {
      start: channel.allowedStartTime,
      end: channel.allowedEndTime,
    },
    scheduled,
  };
});

app.get('/offers/review', async () => {
  const offers = await prisma.offer.findMany({
    where: {
      status: 'NEW',
      decision: 'REVIEW',
    },
    include: {
      product: {
        include: {
          marketplace: true,
        },
      },
    },
    orderBy: {
      detectedAt: 'desc',
    },
  });

  return offers.map((offer) => ({
    id: offer.id,
    marketplace: offer.product.marketplace.slug,
    title: offer.product.title,
    imageUrl: offer.product.imageUrl,
    currentPrice: Number(offer.currentPrice),
    originalPrice: offer.originalPrice
      ? Number(offer.originalPrice)
      : null,
    discountPercent: offer.discountPercent,
    score: offer.score,
    couponCode: offer.couponCode,
    detectedAt: offer.detectedAt,
  }));
});

app.post('/offers/:id/approve', async (request, reply) => {
  const { id } = request.params as { id: string };

  const offer = await prisma.offer.findUnique({
    where: { id },
  });

  if (!offer) {
    return reply.code(404).send({
      error: 'Oferta não encontrada.',
    });
  }

  if (offer.status !== 'NEW' || offer.decision !== 'REVIEW') {
    return reply.code(400).send({
      error: 'Oferta não está aguardando revisão.',
    });
  }

  const updated = await prisma.offer.update({
    where: { id },
    data: {
      decision: 'AUTO',
    },
  });

  await prisma.eventLog.create({
    data: {
      entityId: id,
      event: 'OFFER_APPROVED',
      metadata: {
        previousDecision: 'REVIEW',
        newDecision: 'AUTO',
      },
    },
  });

  return {
    id: updated.id,
    approved: true,
  };
});

const port = Number(
  process.env.API_PORT ?? 3333,
);

await app.listen({
  port,
  host: '0.0.0.0',
});