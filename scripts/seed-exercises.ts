import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const R2_BASE_URL = process.env.R2_PUBLIC_URL || 'https://pub-wilowilo-exercises.r2.dev';

async function main() {
  const metadataPath = process.argv[2] || path.resolve(__dirname, '../../movekit/metadata/metadata.json');
  const translationsPath = process.argv[3] || path.resolve(__dirname, '../data/translations-it.json');

  const metadata: any[] = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
  console.log(`Loaded ${metadata.length} exercises from metadata`);

  let translationsIt: Record<string, any> = {};
  if (fs.existsSync(translationsPath)) {
    translationsIt = JSON.parse(fs.readFileSync(translationsPath, 'utf-8'));
    console.log(`Loaded ${Object.keys(translationsIt).length} Italian translations`);
  } else {
    console.log('No Italian translations file found, seeding English only');
  }

  const prisma = new PrismaClient();

  let created = 0;
  let updated = 0;

  for (const ex of metadata) {
    const translations: Record<string, any> = {
      en: {
        name: ex.name,
        shortDescription: ex.shortDescription,
        longDescription: ex.longDescription,
        instructions: ex.instructions,
        commonMistakes: ex.commonMistakes,
        benefits: ex.benefits,
        tags: ex.tags,
      },
    };

    if (translationsIt[ex.slug]) {
      translations.it = translationsIt[ex.slug];
    }

    const data = {
      name: ex.name,
      primaryMuscles: ex.primaryMuscles ?? [],
      secondaryMuscles: ex.secondaryMuscles ?? [],
      equipment: ex.equipment ?? [],
      movementPattern: ex.movementPattern ?? [],
      difficulty: ex.difficulty ?? 'intermediate',
      durationSeconds: ex.durationSeconds ?? 0,
      tags: ex.tags ?? [],
      translations,
      posterUrl: `${R2_BASE_URL}/v1/posters/${ex.slug}.webp`,
      videoUrl: `${R2_BASE_URL}/v1/videos/${ex.slug}.mp4`,
    };

    const result = await prisma.exercise.upsert({
      where: { slug: ex.slug },
      create: { slug: ex.slug, ...data },
      update: data,
    });

    if (result.createdAt.getTime() === result.createdAt.getTime()) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`\nSeed complete: ${metadata.length} exercises processed`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
