import type { PrismaClient } from '@prisma/client';
import type { GoalBody, GoalPatch, DeriveBody } from './goals.schema';

export async function getGoals(prisma: PrismaClient, userId: string) {
  return prisma.goal.findMany({
    where: { userId },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
}

// Goal types that mirror into UserSettings, so DiaryPage/HistoryPage/PesoPage
// stay in sync regardless of whether the goal was set via wizard, derive, or
// manual add/edit in the Obiettivi page.
async function syncSettingsFromGoal(prisma: PrismaClient, userId: string, goal: { type: string; targetValue: number; baselineValue: number | null; targetDate: string | null; direction: string; status: string }) {
  if (goal.status === 'archived') return;
  const updates: Record<string, unknown> = {};
  switch (goal.type) {
    case 'daily_calories': updates.kcal = goal.targetValue; break;
    case 'macro_protein': updates.protein = goal.targetValue; break;
    case 'macro_carbs': updates.carbs = goal.targetValue; break;
    case 'macro_fat': updates.fat = goal.targetValue; break;
    case 'water_intake': updates.waterTarget = Math.round(goal.targetValue); break;
    case 'target_weight':
      updates.goalWeight = goal.targetValue;
      if (goal.baselineValue != null) updates.startWeight = goal.baselineValue;
      updates.goalDate = goal.targetDate ?? null;
      updates.weightObjective = goal.direction === 'reduce' ? 'dimagrimento' : goal.direction === 'reach' ? 'massa' : 'mantenimento';
      break;
    default:
      return;
  }
  await prisma.userSettings.upsert({
    where: { userId },
    create: { userId, ...updates },
    update: updates,
  });
}

export async function upsertGoal(prisma: PrismaClient, userId: string, id: string, data: GoalBody) {
  const goal = await prisma.goal.upsert({
    where: { id },
    create: { id, userId, ...data },
    update: { ...data },
  });
  await syncSettingsFromGoal(prisma, userId, goal);
  return goal;
}

export async function patchGoal(prisma: PrismaClient, userId: string, id: string, data: GoalPatch) {
  const result = await prisma.goal.updateMany({ where: { id, userId }, data });
  if (result.count === 0) return null;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (goal) await syncSettingsFromGoal(prisma, userId, goal);
  return goal;
}

export async function deleteGoal(prisma: PrismaClient, userId: string, id: string) {
  await prisma.goal.deleteMany({ where: { id, userId } });
}

// Derivation constants
const KCAL_PER_KG_FAT = 7700;
const FLOOR_KCAL = { male: 1500, female: 1200 };
const MAX_WEEKLY_RATE_PCT = 0.01;
const PROTEIN_PER_KG = { lose_weight: 2.0, maintain: 1.6, gain_muscle: 2.2, improve_fitness: 1.8 };
const DEFAULT_SURPLUS = 300;

function calcBMR(gender: string, weight: number, height: number, age: number): number {
  if (gender === 'female') return 10 * weight + 6.25 * height - 5 * age - 161;
  return 10 * weight + 6.25 * height - 5 * age + 5;
}

export function deriveGoals(params: DeriveBody & { userId: string }): GoalBody[] {
  const { primaryGoal, currentWeight, targetWeight, targetDate, height, age, gender, activityLevel, weeklyRate } = params;
  const w = currentWeight ?? 80;
  const h = height ?? 175;
  const a = age ?? 30;
  const g = gender ?? 'male';
  const al = activityLevel ?? 1.4;
  const today = new Date().toISOString().slice(0, 10);

  const bmr = calcBMR(g, w, h, a);
  const tdee = Math.round(bmr * al);

  const goals: GoalBody[] = [];
  const floor = FLOOR_KCAL[g as keyof typeof FLOOR_KCAL] ?? 1500;
  const maxRate = w * MAX_WEEKLY_RATE_PCT;

  // Weight target (outcome)
  if (targetWeight && primaryGoal !== 'improve_fitness') {
    goals.push({
      domain: 'weight_composition', type: 'target_weight', nature: 'outcome',
      direction: targetWeight < w ? 'reduce' : targetWeight > w ? 'reach' : 'maintain',
      title: primaryGoal === 'lose_weight' ? `Dimagrire a ${targetWeight} kg` : primaryGoal === 'gain_muscle' ? `Raggiungere ${targetWeight} kg` : `Mantenere ${targetWeight} kg`,
      targetValue: targetWeight, unit: 'kg', period: 'milestone',
      baselineValue: w, startDate: today, targetDate: targetDate ?? null,
      status: 'active',
    });
  }

  // Weekly rate (process)
  let rate = weeklyRate ?? (primaryGoal === 'lose_weight' ? -0.5 : primaryGoal === 'gain_muscle' ? 0.3 : 0);
  if (Math.abs(rate) > maxRate) rate = rate > 0 ? maxRate : -maxRate;
  if (rate !== 0) {
    goals.push({
      domain: 'weight_composition', type: 'weekly_weight_rate', nature: 'process',
      direction: rate < 0 ? 'reduce' : 'reach',
      title: `Ritmo settimanale ${rate > 0 ? '+' : ''}${rate} kg`,
      targetValue: rate, unit: 'kg', period: 'weekly',
      baselineValue: null, startDate: today, targetDate: null, status: 'active',
    });
  }

  // Daily calories (process)
  const deficit = rate < 0 ? Math.round(Math.abs(rate) * KCAL_PER_KG_FAT / 7) : rate > 0 ? DEFAULT_SURPLUS : 0;
  let dailyKcal = primaryGoal === 'lose_weight' ? tdee - deficit : primaryGoal === 'gain_muscle' ? tdee + deficit : tdee;
  if (dailyKcal < floor) dailyKcal = floor;

  goals.push({
    domain: 'nutrition', type: 'daily_calories', nature: 'process',
    direction: 'maintain', title: `Calorie giornaliere ${dailyKcal} kcal`,
    targetValue: dailyKcal, unit: 'kcal', period: 'daily',
    baselineValue: null, startDate: today, targetDate: null, status: 'active',
  });

  // Macros
  const protPerKg = PROTEIN_PER_KG[primaryGoal] ?? 1.6;
  const proteinG = Math.round(protPerKg * w);
  const proteinKcal = proteinG * 4;
  const fatKcal = Math.round(dailyKcal * 0.25);
  const fatG = Math.round(fatKcal / 9);
  const carbsKcal = dailyKcal - proteinKcal - fatKcal;
  const carbsG = Math.round(carbsKcal / 4);

  goals.push({
    domain: 'nutrition', type: 'macro_protein', nature: 'process', direction: 'reach',
    title: `Proteine ${proteinG}g`, targetValue: proteinG, unit: 'g', period: 'daily',
    baselineValue: null, startDate: today, targetDate: null, status: 'active',
  });
  goals.push({
    domain: 'nutrition', type: 'macro_carbs', nature: 'process', direction: 'maintain',
    title: `Carboidrati ${carbsG}g`, targetValue: carbsG, unit: 'g', period: 'daily',
    baselineValue: null, startDate: today, targetDate: null, status: 'active',
  });
  goals.push({
    domain: 'nutrition', type: 'macro_fat', nature: 'process', direction: 'maintain',
    title: `Grassi ${fatG}g`, targetValue: fatG, unit: 'g', period: 'daily',
    baselineValue: null, startDate: today, targetDate: null, status: 'active',
  });

  // Water
  goals.push({
    domain: 'nutrition', type: 'water_intake', nature: 'process', direction: 'reach',
    title: 'Acqua 8 bicchieri', targetValue: 8, unit: 'bicchieri', period: 'daily',
    baselineValue: null, startDate: today, targetDate: null, status: 'active',
  });

  // Workout frequency
  const freq = primaryGoal === 'improve_fitness' ? 4 : 3;
  goals.push({
    domain: 'training_strength', type: 'workout_frequency', nature: 'process', direction: 'reach',
    title: `Allenarsi ${freq}×/settimana`, targetValue: freq, unit: 'count', period: 'weekly',
    baselineValue: null, startDate: today, targetDate: null, status: 'active',
  });

  // Steps
  goals.push({
    domain: 'activity_movement', type: 'daily_steps', nature: 'process', direction: 'reach',
    title: '8.000 passi al giorno', targetValue: 8000, unit: 'steps', period: 'daily',
    baselineValue: null, startDate: today, targetDate: null, status: 'active',
  });

  return goals;
}
