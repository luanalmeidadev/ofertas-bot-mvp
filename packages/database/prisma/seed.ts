import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({
  path: path.resolve(process.cwd(), '../../.env'),
});

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL não está definida.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

async function main() {
  await prisma.marketplace.upsert({
    where: { slug: 'SHOPEE' },
    update: {},
    create: {
      name: 'Shopee',
      slug: 'SHOPEE',
    },
  });

  await prisma.marketplace.upsert({
    where: { slug: 'MERCADO_LIVRE' },
    update: {},
    create: {
      name: 'Mercado Livre',
      slug: 'MERCADO_LIVRE',
    },
  });

  const channels = [
    {
      name: 'Ofertas Gerais',
      type: 'MOCK',
    },
    {
      name: 'Ofertas Shopee',
      type: 'MOCK',
      marketplaceFilter: 'SHOPEE',
    },
    {
      name: 'Ofertas Mercado Livre',
      type: 'MOCK',
      marketplaceFilter: 'MERCADO_LIVRE',
    },
  ];

  for (const channel of channels) {
    const exists = await prisma.channel.findFirst({
      where: { name: channel.name },
    });

    if (!exists) {
      await prisma.channel.create({
        data: channel,
      });
    }
  }

  console.log('Seed concluído.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });