import type { PrismaClient } from '@prisma/client';
import type { ActivityBody } from './activity.schema';

// ── Activity type catalogue (mirrors types.ts on the frontend) ────────────────
// Used to build the AI system prompt so Claude picks from the same keys.
const ACTIVITY_KEYS = [
  { key: 'camminata',    keywords: 'camminare, passeggiata, camminata, walk' },
  { key: 'jogging',      keywords: 'jogging, footing, corsa leggera' },
  { key: 'corsa',        keywords: 'corsa, running, correre, run' },
  { key: 'bici',         keywords: 'bici, bicicletta, ciclismo, bike' },
  { key: 'spinning',     keywords: 'spinning, cyclette, indoor bike, bici indoor' },
  { key: 'nuoto',        keywords: 'nuoto, piscina, vasca, swim, nuotare' },
  { key: 'ellittica',    keywords: 'ellittica, elliptical' },
  { key: 'saltacorda',   keywords: 'corda, saltacorda, jump rope, salto corda' },
  { key: 'canottaggio',  keywords: 'canottaggio, rowing, rower, vogare' },
  { key: 'yoga',         keywords: 'yoga' },
  { key: 'pilates',      keywords: 'pilates' },
  { key: 'danza',        keywords: 'danza, zumba, ballo, ballare, dance, aerobica' },
  { key: 'stretching',   keywords: 'stretching, allungamento, mobilità, defaticamento' },
  { key: 'pesi',         keywords: 'pesi, palestra, gym, sollevamento, muscolazione, sala pesi' },
  { key: 'squat',        keywords: 'squat' },
  { key: 'panca',        keywords: 'panca, bench press, distensioni' },
  { key: 'stacchi',      keywords: 'stacchi, deadlift' },
  { key: 'trazioni',     keywords: 'trazioni, pull-up, pullup, sbarra, lat machine' },
  { key: 'flessioni',    keywords: 'flessioni, push-up, piegamenti' },
  { key: 'kettlebell',   keywords: 'kettlebell' },
  { key: 'circuit',      keywords: 'circuit, circuito, circuit training' },
  { key: 'crossfit',     keywords: 'crossfit, wod, functional fitness' },
  { key: 'functional',   keywords: 'functional, funzionale, trx, calistenia' },
  { key: 'boxe',         keywords: 'boxe, kickboxing, pugilato, sacco, muay thai' },
  { key: 'arti_marziali', keywords: 'karate, judo, taekwondo, krav maga, jujitsu, mma' },
  { key: 'calcio',       keywords: 'calcio, football, pallone, soccer' },
  { key: 'basket',       keywords: 'basket, pallacanestro' },
  { key: 'tennis',       keywords: 'tennis' },
  { key: 'padel',        keywords: 'padel' },
  { key: 'pallavolo',    keywords: 'pallavolo, volleyball, volley' },
  { key: 'rugby',        keywords: 'rugby' },
  { key: 'badminton',    keywords: 'badminton' },
  { key: 'squash',       keywords: 'squash' },
  { key: 'pattinaggio',  keywords: 'pattinaggio, pattini, ghiaccio' },
  { key: 'golf',         keywords: 'golf' },
  { key: 'trekking',     keywords: 'trekking, escursione, montagna, sentiero, hiking' },
  { key: 'mtb',          keywords: 'mtb, mountain bike, bici sterrato' },
  { key: 'arrampicata',  keywords: 'arrampicata, scalata, climbing, boulder' },
  { key: 'sci',          keywords: 'sci, sciare, slalom, pista da sci' },
  { key: 'sci_fondo',    keywords: 'sci fondo, fondo, sci nordico' },
  { key: 'surf',         keywords: 'surf, windsurf, tavola' },
  { key: 'kayak',        keywords: 'kayak, canoa' },
  { key: 'generico',     keywords: 'sport, esercizio, allenamento generico' },
];

const ACTIVITY_SYSTEM = `Sei un assistente per il fitness. Analizza la descrizione in italiano di un'attività fisica e estrai i parametri strutturati.

Tipi di attività disponibili (usa ESATTAMENTE uno di questi key):
${ACTIVITY_KEYS.map((a) => `- "${a.key}" (${a.keywords})`).join('\n')}

Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown.
Struttura:
{
  "type": "key_attività",
  "duration": numero_intero_minuti_o_null,
  "intensity": "leggera" | "media" | "intensa"
}

Regole:
- Scegli sempre il tipo più specifico; usa "generico" solo se non riesci a identificare l'attività
- Se la durata non è menzionata, metti duration: null
- Per l'intensità usa "media" come default se non specificata; "leggera" per camminate/yoga/stretching descritti senza sforzo; "intensa" per sessioni descritte come dure, a tutta, competitive
- Non includere altri campi oltre ai tre indicati`;

async function callClaudeActivity(userMessage: string): Promise<{ type: string; duration: number | null; intensity: 'leggera' | 'media' | 'intensa' }> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY || '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      system: ACTIVITY_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json() as { content?: { type: string; text: string }[] };
  const text = data.content?.find((b) => b.type === 'text')?.text || '{}';
  const parsed = JSON.parse(text.replace(/```json|```/g, '').trim()) as Record<string, unknown>;
  const validKeys = ACTIVITY_KEYS.map((a) => a.key);
  const type = validKeys.includes(String(parsed.type)) ? String(parsed.type) : 'generico';
  const duration = typeof parsed.duration === 'number' ? Math.max(1, Math.round(parsed.duration)) : null;
  const intensity = (['leggera', 'media', 'intensa'] as const).includes(parsed.intensity as 'leggera' | 'media' | 'intensa')
    ? (parsed.intensity as 'leggera' | 'media' | 'intensa')
    : 'media';
  return { type, duration, intensity };
}

export async function aiAnalyzeActivity(text: string) {
  return callClaudeActivity(text);
}

export async function upsertActivity(prisma: PrismaClient, userId: string, id: string, body: ActivityBody) {
  return prisma.activity.upsert({
    where: { id },
    create: { id, userId, ...body },
    update: { userId, ...body },
  });
}

export async function deleteActivity(prisma: PrismaClient, userId: string, id: string) {
  await prisma.activity.deleteMany({ where: { id, userId } });
}

export async function getActivities(prisma: PrismaClient, userId: string) {
  return prisma.activity.findMany({
    where: { userId },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, date: true, time: true, type: true, name: true,
      icon: true, color: true, duration: true, intensity: true,
      distance: true, kcal: true, addToBudget: true, exercises: true,
    },
  });
}
