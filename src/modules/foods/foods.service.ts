import type { PrismaClient } from '@prisma/client';
import type { CustomFoodBody } from './foods.schema';

// ── Custom foods (personal food database) ──────────────────────────────────────

export async function getCustomFoods(prisma: PrismaClient, userId: string) {
  return prisma.customFood.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function upsertCustomFood(
  prisma: PrismaClient,
  userId: string,
  id: string,
  body: CustomFoodBody,
) {
  return prisma.customFood.upsert({
    where: { id },
    create: { id, userId, ...body },
    update: { ...body },
  });
}

export async function deleteCustomFood(prisma: PrismaClient, userId: string, id: string) {
  await prisma.customFood.deleteMany({ where: { id, userId } });
}

// ── Wilo Foods API proxy ───────────────────────────────────────────────────────

const WFA_URL = process.env.WILO_FOODS_API_URL || 'https://wilo-foods-api-production.up.railway.app';
const WFA_KEY = process.env.WILO_FOODS_API_KEY || '';
const WFA_TIMEOUT = 6000;

const wfaCache = new Map<string, { data: unknown[]; ts: number }>();
const WFA_CACHE_TTL = 5 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of wfaCache) if (now - v.ts > WFA_CACHE_TTL) wfaCache.delete(k);
}, 10 * 60 * 1000);

interface WfaFood {
  display_name?: string;
  name: string;
  brand?: string;
  energy_kcal?: number;
  proteins_g?: number;
  carbs_g?: number;
  fats_g?: number;
  saturated_fats_g?: number;
  fiber_g?: number;
  is_verified?: boolean;
  source?: string;
}

function wfaToOff(food: WfaFood) {
  return {
    product_name_it: food.display_name || food.name,
    product_name: food.name,
    brands: food.brand || undefined,
    nutriments: {
      'energy-kcal_100g': food.energy_kcal ?? 0,
      'proteins_100g': food.proteins_g ?? 0,
      'carbohydrates_100g': food.carbs_g ?? 0,
      'fat_100g': food.fats_g ?? 0,
      'saturated-fat_100g': food.saturated_fats_g ?? 0,
      'fiber_100g': food.fiber_g ?? 0,
    },
    unique_scans_n: food.is_verified ? 100000 : (food.source === 'crea' ? 80000 : 10000),
  };
}

export async function wfaFetch(path: string): Promise<WfaFood[]> {
  const cached = wfaCache.get(path);
  if (cached && Date.now() - cached.ts < WFA_CACHE_TTL) return cached.data as WfaFood[];

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), WFA_TIMEOUT);
  try {
    const res = await fetch(`${WFA_URL}${path}`, {
      headers: { 'X-API-Key': WFA_KEY },
      signal: ac.signal,
    });
    if (!res.ok) return [];
    const json = await res.json() as { data?: unknown };
    const result: WfaFood[] = Array.isArray(json.data)
      ? json.data as WfaFood[]
      : (json.data ? [json.data as WfaFood] : []);
    wfaCache.set(path, { data: result, ts: Date.now() });
    return result;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function searchFoods(q: string) {
  const enc = encodeURIComponent(q.trim());
  const foods = await wfaFetch(`/v1/foods/search?q=${enc}&limit=30`);
  return { products: foods.map(wfaToOff) };
}

export async function searchFoodsExtended(q: string) {
  const enc = encodeURIComponent(q.trim());
  const foods = await wfaFetch(`/v1/foods/search/extended?q=${enc}&limit=30`);
  return { products: foods.map(wfaToOff) };
}

export async function lookupBarcode(barcode: string) {
  const foods = await wfaFetch(`/v1/foods/barcode/${barcode}`);
  return { products: foods.map(wfaToOff) };
}

// ── Claude AI ─────────────────────────────────────────────────────────────────

const PHOTO_SYSTEM = 'Sei un nutrizionista. Analizza la foto del piatto e identifica tutti gli alimenti visibili. Stima i macronutrienti per ciascun alimento separatamente in base alle porzioni visibili. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"items":[{"name":"nome breve","grams":numero,"kcal":numero,"protein":numero,"carbs":numero,"fat":numero,"satfat":numero,"fiber":numero,"ultra":boolean}]}. "grams" è la grammatura stimata della porzione; i valori nutrizionali si riferiscono a quella grammatura. Arrotonda tutti i valori a interi tranne satfat e fiber (1 decimale). "ultra" è true per cibi ultra-processati. Se non riesci a identificare alcun alimento, restituisci {"items":[]}.';

const MACRO_SYSTEM ='Sei un nutrizionista. Scomponi il pasto descritto nei suoi alimenti principali e stima i macronutrienti per ciascuno separatamente. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"items":[{"name":"nome breve","grams":numero,"kcal":numero,"protein":numero,"carbs":numero,"fat":numero,"satfat":numero,"fiber":numero,"ultra":boolean}]}. "grams" è la grammatura stimata della porzione; i valori nutrizionali si riferiscono a quella grammatura. Arrotonda tutti i valori a interi tranne satfat e fiber (1 decimale). "ultra" è true per cibi ultra-processati. Se il pasto è un unico alimento indivisibile, restituisci un array con un solo elemento.';
const SUGGEST_SYSTEM = 'Sei un nutrizionista esperto. Ti vengono dati i macro rimanenti da raggiungere oggi. Suggerisci 3 opzioni di pasto o spuntino concrete e realistiche che aiutino a raggiungere quei valori. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"suggestions":[{"name":"nome pasto","description":"descrizione breve e concreta","kcal":numero,"protein":numero,"carbs":numero,"fat":numero}]}';
const PLAN_SYSTEM = 'Sei un nutrizionista esperto. Ti vengono forniti obiettivi calorici e/o di macronutrienti, più eventuali preferenze o esclusioni alimentari. Suggerisci 3 pasti concreti e realistici che rispettino quei valori. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"suggestions":[{"name":"nome pasto","description":"descrizione dettagliata con ingredienti e grammature","kcal":numero,"protein":numero,"carbs":numero,"fat":numero}]}';

async function callClaude(system: string, userMessage: string): Promise<unknown> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json() as { content?: { type: string; text: string }[] };
  const text = data.content?.find((b) => b.type === 'text')?.text || '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export async function aiAnalyze(food: string) {
  return callClaude(MACRO_SYSTEM, food);
}

export async function aiAnalyzeUnified(
  food: string | undefined,
  images: { base64: string; mediaType: string }[] | undefined,
) {
  const hasImages = images && images.length > 0;
  const hasText = food && food.trim().length > 0;

  let userContent: unknown;
  if (hasImages) {
    const blocks: unknown[] = images.map((img) => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mediaType, data: img.base64 },
    }));
    blocks.push({
      type: 'text',
      text: hasText
        ? `Analizza le foto e il seguente pasto: ${food}`
        : 'Analizza le foto e stima i valori nutrizionali degli alimenti visibili.',
    });
    userContent = blocks;
  } else {
    userContent = food!;
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: MACRO_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  const data = await response.json() as { content?: { type: string; text: string }[] };
  const text = data.content?.find((b) => b.type === 'text')?.text || '{"items":[]}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export async function aiAnalyzePhoto(image: string, mediaType: string) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: PHOTO_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
          { type: 'text', text: 'Analizza questa foto e stima i valori nutrizionali degli alimenti visibili.' },
        ],
      }],
    }),
  });
  const data = await response.json() as { content?: { type: string; text: string }[] };
  const text = data.content?.find((b) => b.type === 'text')?.text || '{"items":[]}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

export async function aiSuggest(remaining: { kcal: number; protein: number; carbs: number; fat: number }) {
  const msg = `Macro rimanenti da raggiungere oggi:\n- Calorie: ${remaining.kcal} kcal\n- Proteine: ${remaining.protein}g\n- Carboidrati: ${remaining.carbs}g\n- Grassi: ${remaining.fat}g\nSuggerisci 3 pasti o spuntini concreti e semplici da preparare.`;
  return callClaude(SUGGEST_SYSTEM, msg);
}

export async function aiPlan(params: { kcal: number; protein?: number; carbs?: number; fat?: number; notes?: string }) {
  let msg = `Obiettivi per il pasto:\n- Calorie: ${params.kcal} kcal`;
  if (params.protein) msg += `\n- Proteine: ${params.protein}g`;
  if (params.carbs) msg += `\n- Carboidrati: ${params.carbs}g`;
  if (params.fat) msg += `\n- Grassi: ${params.fat}g`;
  if (params.notes) msg += `\n\nPreferenze / esclusioni: ${params.notes}`;
  msg += '\n\nSuggerisci 3 pasti concreti che rispettino questi obiettivi.';
  return callClaude(PLAN_SYSTEM, msg);
}

// ── AI rate limit (in-memory, per userId) ─────────────────────────────────────

const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 60 * 1000;
const ratemap = new Map<string, { ts: number; count: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [uid, entry] of ratemap) {
    if (now - entry.ts > RATE_WINDOW) ratemap.delete(uid);
  }
}, RATE_WINDOW);

export function checkAiRate(userId: string): boolean {
  const now = Date.now();
  let entry = ratemap.get(userId);
  if (!entry || now - entry.ts > RATE_WINDOW) entry = { ts: now, count: 0 };
  entry.count++;
  ratemap.set(userId, entry);
  return entry.count <= RATE_LIMIT;
}
