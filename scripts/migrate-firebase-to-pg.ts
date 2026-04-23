#!/usr/bin/env tsx
/**
 * Phase 3 — Migrate wilowilo user data from Firebase RTDB to PostgreSQL.
 *
 * Usage (two modes):
 *
 *   Mode A — read directly from Firebase RTDB REST API:
 *     FIREBASE_DB_URL=https://... FIREBASE_TOKEN=<idToken|dbSecret> \
 *     DATABASE_URL=postgresql://... \
 *     tsx scripts/migrate-firebase-to-pg.ts --uid <firebaseUid> --email <user@email.com>
 *
 *   Mode B — read from a Firebase Console JSON export:
 *     DATABASE_URL=postgresql://... \
 *     tsx scripts/migrate-firebase-to-pg.ts --uid <firebaseUid> --email <user@email.com> --file firebase-export.json
 *
 * The script is idempotent — safe to run multiple times (upserts everywhere).
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const get = (flag: string) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : undefined; };

const uid = get('--uid');
const email = get('--email');
const filePath = get('--file');

if (!uid || !email) {
  console.error('Usage: tsx scripts/migrate-firebase-to-pg.ts --uid <uid> --email <email> [--file export.json]');
  process.exit(1);
}

// ── Firebase RTDB types (matching the old firebaseService.ts structure) ───────

interface FoodItem {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  satfat: number;
  fiber: number;
  quantity: number;
  unit: string;
  ultra?: boolean;
  [key: string]: unknown;
}

interface TrackerData {
  today?: {
    date: string;
    items: Record<string, FoodItem[]>;
    hunger?: number | null;
    mood?: number | null;
    water?: number | null;
  };
  history?: Record<string, {
    date?: string;
    items: Record<string, FoodItem[]>;
    hunger?: number | null;
    mood?: number | null;
    water?: number | null;
  }>;
  weight?: Record<string, { date: string; weight: number }>;
  checkpoints?: Record<string, { id?: string; date: string; targetWeight: number; label?: string }>;
  startWeight?: number;
  my_foods?: Record<string, { id?: string; name: string; brand?: string; per100g: Record<string, number>; createdAt?: string }>;
  targets?: { kcal?: number; protein?: number; carbs?: number; fat?: number; satfat?: number; fiber?: number; waterTarget?: number };
  meals?: string[];
  sheetsUrl?: string;
  lang?: string;
  weightHidden?: boolean;
  wizardCompleted?: boolean;
  goalWeight?: number;
}

// ── Read tracker data ─────────────────────────────────────────────────────────

async function readFromRTDB(): Promise<TrackerData> {
  const dbUrl = process.env.FIREBASE_DB_URL;
  const token = process.env.FIREBASE_TOKEN;
  if (!dbUrl || !token) {
    throw new Error('Set FIREBASE_DB_URL and FIREBASE_TOKEN env vars for direct RTDB read.');
  }
  const url = `${dbUrl}/users/${uid}/macro_tracker.json?auth=${token}`;
  console.log(`Fetching: ${dbUrl}/users/${uid}/macro_tracker.json`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Firebase RTDB error ${res.status}: ${await res.text()}`);
  const data = await res.json() as TrackerData | null;
  if (!data) throw new Error('No data found at RTDB path. Check uid and token.');
  return data;
}

function readFromExport(fp: string): TrackerData {
  const abs = path.resolve(fp);
  console.log(`Reading export from: ${abs}`);
  const raw = fs.readFileSync(abs, 'utf-8');
  const json = JSON.parse(raw) as Record<string, unknown>;

  // Full DB export structure: { users: { [uid]: { macro_tracker: {...} } } }
  // or partial export: { macro_tracker: {...} }
  // or already the tracker data directly
  const users = json['users'] as Record<string, unknown> | undefined;
  if (users && users[uid!]) {
    const userNode = users[uid!] as Record<string, unknown>;
    return (userNode['macro_tracker'] ?? userNode) as TrackerData;
  }
  const tracker = json['macro_tracker'];
  if (tracker) return tracker as TrackerData;
  // Assume it's already the tracker root
  return json as TrackerData;
}

// ── Main migration ────────────────────────────────────────────────────────────

async function main() {
  const tracker = filePath ? readFromExport(filePath) : await readFromRTDB();

  console.log('\n── Data summary ─────────────────────────────────────────');
  console.log('today:', tracker.today ? tracker.today.date : 'none');
  console.log('history days:', Object.keys(tracker.history ?? {}).length);
  console.log('weight entries:', Object.keys(tracker.weight ?? {}).length);
  console.log('checkpoints:', Object.keys(tracker.checkpoints ?? {}).length);
  console.log('custom foods:', Object.keys(tracker.my_foods ?? {}).length);
  console.log('has targets:', !!tracker.targets);
  console.log('────────────────────────────────────────────────────────\n');

  const prisma = new PrismaClient();

  try {
    // 1. Upsert User
    await prisma.user.upsert({
      where: { id: uid! },
      update: { email: email! },
      create: { id: uid!, email: email! },
    });
    console.log(`✓ User ${email} (${uid})`);

    // 2. Upsert settings
    const t = tracker.targets ?? {};
    await prisma.userSettings.upsert({
      where: { userId: uid! },
      update: {
        kcal:            t.kcal        ?? 0,
        protein:         t.protein     ?? 0,
        carbs:           t.carbs       ?? 0,
        fat:             t.fat         ?? 0,
        satfat:          t.satfat      ?? 0,
        fiber:           t.fiber       ?? 0,
        waterTarget:     t.waterTarget ?? 8,
        meals:           Array.isArray(tracker.meals) ? tracker.meals : [],
        sheetsUrl:       tracker.sheetsUrl       ?? '',
        lang:            tracker.lang            ?? 'it',
        weightHidden:    tracker.weightHidden    ?? false,
        wizardCompleted: tracker.wizardCompleted ?? false,
        startWeight:     tracker.startWeight     ?? null,
        goalWeight:      tracker.goalWeight      ?? null,
      },
      create: {
        userId:          uid!,
        kcal:            t.kcal        ?? 0,
        protein:         t.protein     ?? 0,
        carbs:           t.carbs       ?? 0,
        fat:             t.fat         ?? 0,
        satfat:          t.satfat      ?? 0,
        fiber:           t.fiber       ?? 0,
        waterTarget:     t.waterTarget ?? 8,
        meals:           Array.isArray(tracker.meals) ? tracker.meals : [],
        sheetsUrl:       tracker.sheetsUrl       ?? '',
        lang:            tracker.lang            ?? 'it',
        weightHidden:    tracker.weightHidden    ?? false,
        wizardCompleted: tracker.wizardCompleted ?? false,
        startWeight:     tracker.startWeight     ?? null,
        goalWeight:      tracker.goalWeight      ?? null,
      },
    });
    console.log('✓ UserSettings');

    // 3. DiaryDay — today + history
    const diaryDays: { date: string; items: Record<string, FoodItem[]>; hunger?: number | null; mood?: number | null; water?: number | null }[] = [];

    if (tracker.today?.date) {
      diaryDays.push({
        date:   tracker.today.date,
        items:  tracker.today.items  ?? {},
        hunger: tracker.today.hunger ?? null,
        mood:   tracker.today.mood   ?? null,
        water:  tracker.today.water  ?? null,
      });
    }

    if (tracker.history) {
      for (const [dateKey, day] of Object.entries(tracker.history)) {
        if (!day) continue;
        diaryDays.push({
          date:   day.date ?? dateKey,   // date stored in value or as key
          items:  day.items  ?? {},
          hunger: day.hunger ?? null,
          mood:   day.mood   ?? null,
          water:  day.water  ?? null,
        });
      }
    }

    let diaryCount = 0;
    for (const day of diaryDays) {
      if (!day.date) continue;
      await prisma.diaryDay.upsert({
        where: { userId_date: { userId: uid!, date: day.date } },
        update: {
          items:  day.items  as object,
          hunger: day.hunger ?? null,
          mood:   day.mood   ?? null,
          water:  day.water  ?? null,
        },
        create: {
          userId: uid!,
          date:   day.date,
          items:  day.items  as object,
          hunger: day.hunger ?? null,
          mood:   day.mood   ?? null,
          water:  day.water  ?? null,
        },
      });
      diaryCount++;
    }
    console.log(`✓ DiaryDays: ${diaryCount}`);

    // 4. WeightEntries
    let weightCount = 0;
    if (tracker.weight) {
      for (const [dateKey, entry] of Object.entries(tracker.weight)) {
        if (!entry?.weight) continue;
        const date = entry.date ?? dateKey;
        await prisma.weightEntry.upsert({
          where: { userId_date: { userId: uid!, date } },
          update: { weight: entry.weight },
          create: { userId: uid!, date, weight: entry.weight },
        });
        weightCount++;
      }
    }
    console.log(`✓ WeightEntries: ${weightCount}`);

    // 5. WeightCheckpoints
    let cpCount = 0;
    if (tracker.checkpoints) {
      for (const [cpId, cp] of Object.entries(tracker.checkpoints)) {
        if (!cp?.date || !cp?.targetWeight) continue;
        const id = cp.id ?? cpId;
        await prisma.weightCheckpoint.upsert({
          where: { id },
          update: { date: cp.date, targetWeight: cp.targetWeight, label: cp.label ?? null },
          create: { id, userId: uid!, date: cp.date, targetWeight: cp.targetWeight, label: cp.label ?? null },
        });
        cpCount++;
      }
    }
    console.log(`✓ WeightCheckpoints: ${cpCount}`);

    // 6. CustomFoods
    let foodCount = 0;
    if (tracker.my_foods) {
      for (const [foodId, food] of Object.entries(tracker.my_foods)) {
        if (!food?.name || !food?.per100g) continue;
        const id = food.id ?? foodId;
        const createdAt = food.createdAt ? new Date(food.createdAt) : new Date();
        await prisma.customFood.upsert({
          where: { id },
          update: { name: food.name, brand: food.brand ?? null, per100g: food.per100g as object },
          create: { id, userId: uid!, name: food.name, brand: food.brand ?? null, per100g: food.per100g as object, createdAt },
        });
        foodCount++;
      }
    }
    console.log(`✓ CustomFoods: ${foodCount}`);

    console.log('\n✅ Migration complete!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('\n❌ Migration failed:', err);
  process.exit(1);
});
