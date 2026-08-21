import Fastify from 'fastify';
import { offerQueue } from './queue.js';
import { prisma } from '@ofertas/database';
import {
  OfferEngine,
  decideOffer,
} from '@ofertas/core';

import {
  MockMercadoLivreProvider,
  ShopeeCsvProvider,
} from '@ofertas/marketplaces';

const app = Fastify({ logger: true });

const engine = new OfferEngine({
  minDiscountPercent: Number(
    process.env.MIN_DISCOUNT_PERCENT ?? 20,
  ),
  minOfferScore: Number(
    process.env.MIN_OFFER_SCORE ?? 55,
  ),
});

const shopeeCsvPath = process.env.SHOPEE_CSV_PATH;

if (!shopeeCsvPath) {
  throw new Error('SHOPEE_CSV_PATH não está definido.');
}

const providers = [
  new ShopeeCsvProvider(shopeeCsvPath),
  new MockMercadoLivreProvider(),
];

/**
 * HEALTH
 */
app.get('/health', async () => ({
  ok: true,
}));

/**
 * IMPORTA E ANALISA OFERTAS
 */
app.post('/offers/import', async () => {
  let imported = 0;
  let detected = 0;

  for (const provider of providers) {
    const marketplace =
      await prisma.marketplace.findUniqueOrThrow({
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

      // Evita publicar novamente o mesmo produto
      // dentro de uma janela de 24 horas.
      const recentOffer =
        await prisma.offer.findFirst({
          where: {
            productId: product.id,
            detectedAt: {
              gte: new Date(
                Date.now() - 24 * 60 * 60 * 1000,
              ),
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

/**
 * COLOCA OFERTAS AUTO NA FILA
 */
app.post('/offers/publish-auto', async () => {
  const channel =
    await prisma.channel.findFirstOrThrow({
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

  const [startHour, startMinute] = (
    channel.allowedStartTime ?? '08:00'
  )
    .split(':')
    .map(Number);

  const [endHour, endMinute] = (
    channel.allowedEndTime ?? '23:00'
  )
    .split(':')
    .map(Number);

  const start = new Date(now);
  start.setHours(
    startHour,
    startMinute,
    0,
    0,
  );

  const end = new Date(now);
  end.setHours(
    endHour,
    endMinute,
    0,
    0,
  );

  let baseStart = now;

  if (now < start) {
    baseStart = start;
  } else if (now > end) {
    baseStart = new Date(start);
    baseStart.setDate(
      baseStart.getDate() + 1,
    );
  }

  const scheduled: Array<{
    offerId: string;
    scheduledAt: string;
  }> = [];

  for (
    const [index, offer]
    of offers.entries()
  ) {
    const batch = Math.floor(
      index / channel.maxPostsPerHour,
    );

    const position =
      index % channel.maxPostsPerHour;

    const hourDelay =
      batch * 60 * 60 * 1000;

    const intervalDelay =
      position *
      channel.minIntervalSeconds *
      1000;

    const jitter =
      Math.floor(Math.random() * 90) *
      1000;

    const scheduledAt = new Date(
      baseStart.getTime() +
        hourDelay +
        intervalDelay +
        jitter,
    );

    if (
      scheduledAt > end &&
      baseStart.getDate() ===
        now.getDate()
    ) {
      const tomorrow = new Date(start);

      tomorrow.setDate(
        tomorrow.getDate() + 1,
      );

      scheduledAt.setTime(
        tomorrow.getTime() +
          hourDelay +
          intervalDelay +
          jitter,
      );
    }

    const delay = Math.max(
      0,
      scheduledAt.getTime() -
        Date.now(),
    );

    scheduled.push({
      offerId: offer.id,
      scheduledAt:
        scheduledAt.toISOString(),
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
    intervalSeconds:
      channel.minIntervalSeconds,
    maxPostsPerHour:
      channel.maxPostsPerHour,

    window: {
      start:
        channel.allowedStartTime,
      end:
        channel.allowedEndTime,
    },

    scheduled,
  };
});

/**
 * LISTA OFERTAS EM REVIEW
 */
app.get('/offers/review', async () => {
  const offers =
    await prisma.offer.findMany({
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

    marketplace:
      offer.product.marketplace.slug,

    title:
      offer.product.title,

    imageUrl:
      offer.product.imageUrl,

    currentPrice:
      Number(offer.currentPrice),

    originalPrice:
      offer.originalPrice
        ? Number(offer.originalPrice)
        : null,

    discountPercent:
      offer.discountPercent,

    score:
      offer.score,

    couponCode:
      offer.couponCode,

    detectedAt:
      offer.detectedAt,
  }));
});

/**
 * APROVA OFERTA REVIEW
 */
app.post(
  '/offers/:id/approve',
  async (request, reply) => {
    const { id } =
      request.params as {
        id: string;
      };

    const offer =
      await prisma.offer.findUnique({
        where: {
          id,
        },
      });

    if (!offer) {
      return reply
        .code(404)
        .send({
          error:
            'Oferta não encontrada.',
        });
    }

    if (
      offer.status !== 'NEW' ||
      offer.decision !== 'REVIEW'
    ) {
      return reply
        .code(400)
        .send({
          error:
            'Oferta não está aguardando revisão.',
        });
    }

    const updated =
      await prisma.offer.update({
        where: {
          id,
        },

        data: {
          decision: 'AUTO',
        },
      });

    await prisma.eventLog.create({
      data: {
        entityId: id,
        event: 'OFFER_APPROVED',

        metadata: {
          previousDecision:
            'REVIEW',

          newDecision:
            'AUTO',
        },
      },
    });

    return {
      id: updated.id,
      approved: true,
    };
  },
);

/**
 * FILA BULLMQ
 */
app.get('/queue', async () => {
  const jobs =
    await offerQueue.getJobs([
      'waiting',
      'delayed',
      'active',
      'failed',
    ]);

  const items =
    await Promise.all(
      jobs.map(async (job) => {
        const state =
          await job.getState();

        const offer =
          await prisma.offer.findUnique({
            where: {
              id: job.data.offerId,
            },

            include: {
              product: {
                include: {
                  marketplace: true,
                },
              },
            },
          });

        return {
          id: job.id,
          state,
          offerId:
            job.data.offerId,

          product:
            offer?.product.title ??
            'Produto não encontrado',

          marketplace:
            offer?.product.marketplace
              .slug ?? null,

          scheduledAt:
            new Date(
              job.timestamp +
                job.delay,
            ).toISOString(),
        };
      }),
    );

  return items;
});

/**
 * HISTÓRICO DE PUBLICAÇÕES
 */
app.get(
  '/publications',
  async () => {
    const publications =
      await prisma.publication.findMany({
        include: {
          offer: {
            include: {
              product: true,
            },
          },

          channel: true,
        },

        orderBy: {
          createdAt: 'desc',
        },

        take: 50,
      });

    return publications.map(
      (publication) => ({
        id:
          publication.id,

        product:
          publication.offer.product
            .title,

        channel:
          publication.channel.name,

        status:
          publication.status,

        scheduledAt:
          publication.scheduledAt,

        publishedAt:
          publication.publishedAt,

        createdAt:
          publication.createdAt,
      }),
    );
  },
);

/**
 * INICIA OAUTH MERCADO LIVRE
 */
app.get(
  '/auth/mercadolivre',
  async (_request, reply) => {
    const clientId =
      process.env.ML_CLIENT_ID;

    const redirectUri =
      process.env.ML_REDIRECT_URI;

    if (
      !clientId ||
      !redirectUri
    ) {
      return reply
        .status(500)
        .send({
          error:
            'Mercado Livre OAuth não configurado',
        });
    }

    const authorizationUrl =
      new URL(
        'https://auth.mercadolivre.com.br/authorization',
      );

    authorizationUrl.searchParams.set(
      'response_type',
      'code',
    );

    authorizationUrl.searchParams.set(
      'client_id',
      clientId,
    );

    authorizationUrl.searchParams.set(
      'redirect_uri',
      redirectUri,
    );

    return reply.redirect(
      authorizationUrl.toString(),
    );
  },
);

/**
 * CALLBACK OAUTH MERCADO LIVRE
 */
app.get(
  '/auth/mercadolivre/callback',
  async (request, reply) => {
    const { code } =
      request.query as {
        code?: string;
      };

    const clientId =
      process.env.ML_CLIENT_ID;

    const clientSecret =
      process.env.ML_CLIENT_SECRET;

    const redirectUri =
      process.env.ML_REDIRECT_URI;

    if (!code) {
      return reply
        .status(400)
        .send({
          error:
            'Código de autorização não recebido',
        });
    }

    if (
      !clientId ||
      !clientSecret ||
      !redirectUri
    ) {
      return reply
        .status(500)
        .send({
          error:
            'Mercado Livre OAuth não configurado',
        });
    }

    const response = await fetch(
      'https://api.mercadolibre.com/oauth/token',
      {
        method: 'POST',

        headers: {
          'Content-Type':
            'application/x-www-form-urlencoded',
        },

        body: new URLSearchParams({
          grant_type:
            'authorization_code',

          client_id:
            clientId,

          client_secret:
            clientSecret,

          code,

          redirect_uri:
            redirectUri,
        }),
      },
    );

    const data =
      await response.json();

    if (!response.ok) {
      return reply
        .status(response.status)
        .send(data);
    }

    const tokenData =
      data as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        user_id?: number;
      };

    if (
      !tokenData.access_token
    ) {
      return reply
        .status(500)
        .send({
          error:
            'Access token não recebido',
        });
    }

    /**
     * VALIDA TOKEN
     */
    const userResponse =
      await fetch(
        'https://api.mercadolibre.com/users/me',
        {
          headers: {
            Authorization:
              `Bearer ${tokenData.access_token}`,
          },
        },
      );

    const user =
      await userResponse.json();

    if (!userResponse.ok) {
      return reply
        .status(
          userResponse.status,
        )
        .send({
          error:
            'Falha ao validar token',

          details:
            user,
        });
    }

    /**
     * TESTA HIGHLIGHTS / MAIS VENDIDOS
     */
    const highlightResponse = await fetch(
  'https://api.mercadolibre.com/highlights/MLB/category/MLB432825',
  {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
    },
  },
);

const highlightData = await highlightResponse.json() as {
  content?: Array<{
    id: string;
    position: number;
    type: string;
  }>;
};

return {
  ok: true,
  message: 'Mercado Livre conectado e token validado.',

  user: {
    nickname: (user as { nickname?: string }).nickname,
  },

  highlightTest: {
    status: highlightResponse.status,
    ok: highlightResponse.ok,
    count: highlightData.content?.length ?? 0,
    firstItems: highlightData.content?.slice(0, 5) ?? [],
    error: highlightResponse.ok ? null : highlightData,
  },
};
  },
);

const port = Number(
  process.env.API_PORT ?? 3333,
);

await app.listen({
  port,
  host: '0.0.0.0',
});