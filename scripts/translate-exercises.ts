import fs from 'fs';
import path from 'path';
import https from 'https';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('Set ANTHROPIC_API_KEY env var');
  process.exit(1);
}

const METADATA_PATH = process.argv[2] || path.resolve(__dirname, '../../movekit/metadata/metadata.json');
const OUTPUT_PATH = path.resolve(__dirname, '../data/translations-it.json');

interface ExerciseMeta {
  slug: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  instructions: string[];
  commonMistakes: string[];
  benefits: string[];
  useCases: string[];
  tags: string[];
}

function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) { reject(new Error(parsed.error.message)); return; }
          resolve(parsed.content?.[0]?.text ?? '');
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const SYSTEM_PROMPT = `You are a professional fitness content translator specializing in Italian gym terminology.
Translate the following exercise data from English to Italian.
Use proper Italian fitness terminology (e.g., "bench press" → "distensioni su panca", "squat" → "squat" or "accosciata").
For tags, generate Italian search terms a gym user would type.
Return ONLY valid JSON matching the exact input structure. No markdown, no explanation.`;

async function translateBatch(exercises: ExerciseMeta[]): Promise<Record<string, any>> {
  const input = exercises.map(e => ({
    slug: e.slug,
    name: e.name,
    shortDescription: e.shortDescription,
    longDescription: e.longDescription,
    instructions: e.instructions,
    commonMistakes: e.commonMistakes,
    benefits: e.benefits,
    tags: e.tags,
  }));

  const userPrompt = `Translate these ${exercises.length} exercises to Italian. Return a JSON array with the same structure, same order, keeping the "slug" unchanged as identifier:\n\n${JSON.stringify(input, null, 2)}`;

  const response = await callClaude(SYSTEM_PROMPT, userPrompt);
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('No JSON array in response');
  const parsed: any[] = JSON.parse(jsonMatch[0]);

  const result: Record<string, any> = {};
  for (const item of parsed) {
    result[item.slug] = {
      name: item.name,
      shortDescription: item.shortDescription,
      longDescription: item.longDescription,
      instructions: item.instructions,
      commonMistakes: item.commonMistakes,
      benefits: item.benefits,
      tags: item.tags,
    };
  }
  return result;
}

async function main() {
  const raw = fs.readFileSync(METADATA_PATH, 'utf-8');
  const metadata: ExerciseMeta[] = JSON.parse(raw);
  console.log(`Loaded ${metadata.length} exercises`);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  let translations: Record<string, any> = {};
  if (fs.existsSync(OUTPUT_PATH)) {
    translations = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`Resuming: ${Object.keys(translations).length} already translated`);
  }

  const remaining = metadata.filter(e => !translations[e.slug]);
  console.log(`Remaining: ${remaining.length}`);

  const BATCH_SIZE = 8;
  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    const slugs = batch.map(b => b.slug).join(', ');
    console.log(`Translating batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(remaining.length / BATCH_SIZE)}: ${slugs.slice(0, 80)}...`);

    try {
      const result = await translateBatch(batch);
      Object.assign(translations, result);
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(translations, null, 2));
      console.log(`  ✓ ${Object.keys(translations).length}/${metadata.length} done`);
    } catch (err) {
      console.error(`  ✗ Batch failed:`, err);
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(translations, null, 2));
      console.log('  Progress saved. Re-run to resume.');
      await new Promise(r => setTimeout(r, 5000));
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\nTranslation complete: ${OUTPUT_PATH}`);
}

main().catch(console.error);
