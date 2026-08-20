import IORedis from 'ioredis';
import { Queue, Worker } from 'bullmq';
import { prisma } from '@ofertas/database';
import { renderOfferPost } from '@ofertas/core';
import { MockChannelAdapter } from '@ofertas/channels';

const connection = new IORedis(
  process.env.REDIS_URL ?? 'redis://localhost:6379',
  {
    maxRetriesPerRequest: null,
  },
);

export const offerQueue = new Queue('offer-publication', {
  connection,
});

const channelAdapter = new MockChannelAdapter();

new Worker(
  'offer-publication',
  async (job) => {
    const { offerId, channelId } = job.data as {
      offerId: string;
      channelId: string;
    };

    const offer = await prisma.offer.findUniqueOrThrow({
      where: { id: offerId },
      include: {
        product: {
          include: {
            marketplace: true,
          },
        },
      },
    });

    if (offer.status === 'PUBLISHED') {
      return;
    }

    const affiliateUrl =
      offer.affiliateUrl ?? offer.product.productUrl;

    const content = renderOfferPost(
      {
        marketplace: offer.product.marketplace.slug as
          | 'SHOPEE'
          | 'MERCADO_LIVRE',

        externalId: offer.product.externalId,
        title: offer.product.title,
        category: offer.product.category ?? undefined,
        sellerName: offer.product.sellerName ?? undefined,
        productUrl: offer.product.productUrl,
        imageUrl: offer.product.imageUrl ?? undefined,
        currentPrice: Number(offer.currentPrice),

        originalPrice: offer.originalPrice
          ? Number(offer.originalPrice)
          : undefined,

        discountPercent:
          offer.discountPercent ?? undefined,

        rating: offer.product.rating
          ? Number(offer.product.rating)
          : undefined,

        salesCount:
          offer.product.salesCount ?? undefined,

        commissionRate: offer.commissionRate
          ? Number(offer.commissionRate)
          : undefined,

        commissionValue: offer.commissionValue
          ? Number(offer.commissionValue)
          : undefined,

        couponCode: offer.couponCode ?? undefined,
        score: offer.score,
        reasons: [],
      },
      affiliateUrl,
    );

    const publication = await prisma.publication.create({
      data: {
        offerId,
        channelId,
        content,
        imageUrl: offer.product.imageUrl,
        scheduledAt: new Date(job.timestamp + job.delay),
        status: 'PROCESSING',
      },
    });

    const result = await channelAdapter.sendOffer({
      text: content,
      imageUrl: offer.product.imageUrl ?? undefined,
    });

    await prisma.publication.update({
      where: { id: publication.id },
      data: {
        status: result.ok ? 'PUBLISHED' : 'FAILED',
        publishedAt: result.ok ? new Date() : null,
        errorMessage: result.error ?? null,
      },
    });

    if (!result.ok) {
      throw new Error(result.error ?? 'Falha ao publicar oferta');
    }

    await prisma.offer.update({
      where: { id: offerId },
      data: {
        status: 'PUBLISHED',
      },
    });

    await prisma.eventLog.create({
      data: {
        entityId: offerId,
        event: 'PUBLICATION_SENT',
        metadata: {
          publicationId: publication.id,
          externalMessageId: result.externalMessageId,
        },
      },
    });
  },
  {
    connection,
    concurrency: 1,
  },
);