import type { PrismaClient } from '@prisma/client';
import type { ExerciseListQuery } from './exercises.schema';

interface TranslationFields {
  name: string;
  shortDescription: string;
  longDescription: string;
  instructions: string[];
  commonMistakes: string[];
  benefits: string[];
  tags: string[];
}

function getTranslation(translations: any, lang: string): TranslationFields | null {
  if (!translations || typeof translations !== 'object') return null;
  return translations[lang] ?? translations['en'] ?? null;
}

export async function listExercises(prisma: PrismaClient, query: ExerciseListQuery) {
  const { q, muscle, equipment, movement, difficulty, lang, limit, offset } = query;

  const where: any = {};
  if (muscle) where.primaryMuscles = { has: muscle };
  if (equipment) where.equipment = { has: equipment };
  if (movement) where.movementPattern = { has: movement };
  if (difficulty) where.difficulty = difficulty;
  if (q) {
    const lower = q.toLowerCase();
    where.OR = [
      { name: { contains: lower, mode: 'insensitive' } },
      { tags: { has: lower } },
      { slug: { contains: lower, mode: 'insensitive' } },
    ];
  }

  const [exercises, total] = await Promise.all([
    prisma.exercise.findMany({ where, orderBy: { name: 'asc' }, take: limit, skip: offset }),
    prisma.exercise.count({ where }),
  ]);

  return {
    exercises: exercises.map(e => {
      const t = getTranslation(e.translations, lang);
      return {
        slug: e.slug,
        name: t?.name ?? e.name,
        primaryMuscles: e.primaryMuscles,
        secondaryMuscles: e.secondaryMuscles,
        equipment: e.equipment,
        movementPattern: e.movementPattern,
        difficulty: e.difficulty,
        posterUrl: e.posterUrl,
        shortDescription: t?.shortDescription ?? '',
      };
    }),
    total,
  };
}

export async function getExerciseBySlug(prisma: PrismaClient, slug: string, lang: string) {
  const e = await prisma.exercise.findUnique({ where: { slug } });
  if (!e) return null;

  const t = getTranslation(e.translations, lang);
  return {
    slug: e.slug,
    name: t?.name ?? e.name,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
    equipment: e.equipment,
    movementPattern: e.movementPattern,
    difficulty: e.difficulty,
    durationSeconds: e.durationSeconds,
    posterUrl: e.posterUrl,
    videoUrl: e.videoUrl,
    shortDescription: t?.shortDescription ?? '',
    longDescription: t?.longDescription ?? '',
    instructions: t?.instructions ?? [],
    commonMistakes: t?.commonMistakes ?? [],
    benefits: t?.benefits ?? [],
  };
}

export async function getExerciseMatchIndex(prisma: PrismaClient, lang: string) {
  const exercises = await prisma.exercise.findMany({
    select: { slug: true, name: true, tags: true, translations: true, videoUrl: true, posterUrl: true },
    orderBy: { name: 'asc' },
  });

  return exercises.map(e => {
    const t = getTranslation(e.translations, lang);
    return {
      slug: e.slug,
      name: t?.name ?? e.name,
      tags: [...(t?.tags ?? []), ...e.tags],
      videoUrl: e.videoUrl,
      posterUrl: e.posterUrl,
    };
  });
}
