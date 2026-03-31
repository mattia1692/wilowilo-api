const http = require('http');
const admin = require('firebase-admin');

// ── Firebase Admin (verifica ID token) ───────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  // Se non hai GOOGLE_APPLICATION_CREDENTIALS, usa project ID + Database Auth Override
  projectId: 'macro-tracker-d62a1',
});

// ── Rate limiting in-memory (per uid, max 30 req/ora) ────────────────────────
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 60 * 1000; // 1 ora
const ratemap = new Map();
function checkRate(uid) {
  const now = Date.now();
  let entry = ratemap.get(uid);
  if (!entry || now - entry.ts > RATE_WINDOW) {
    entry = { ts: now, count: 0 };
  }
  entry.count++;
  ratemap.set(uid, entry);
  return entry.count <= RATE_LIMIT;
}

// Cleanup ratemap ogni ora
setInterval(() => {
  const now = Date.now();
  for (const [uid, entry] of ratemap) {
    if (now - entry.ts > RATE_WINDOW) ratemap.delete(uid);
  }
}, RATE_WINDOW);

// ── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://macro-pwa.pages.dev',
  'https://wilowilo.pages.dev',
  'http://localhost:5173',
  'http://localhost:4173',
];
function setCORS(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');
}

// ── Claude ────────────────────────────────────────────────────────────────────
const MACRO_SYSTEM = 'Sei un nutrizionista. Stima i macronutrienti del pasto descritto. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"name":"nome breve","kcal":numero,"protein":numero,"carbs":numero,"fat":numero,"satfat":numero,"fiber":numero,"ultra":boolean}. Arrotonda a interi tranne satfat e fiber (1 decimale). "ultra" è true per cibi ultra-processati.';
const SUGGEST_SYSTEM = 'Sei un nutrizionista esperto. Ti vengono dati i macro rimanenti da raggiungere oggi. Suggerisci 3 opzioni di pasto o spuntino concrete e realistiche che aiutino a raggiungere quei valori. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"suggestions":[{"name":"nome pasto","description":"descrizione breve e concreta","kcal":numero,"protein":numero,"carbs":numero,"fat":numero}]}';
const PLAN_SYSTEM = 'Sei un nutrizionista esperto. Ti vengono forniti obiettivi calorici e/o di macronutrienti, più eventuali preferenze o esclusioni alimentari. Suggerisci 3 pasti concreti e realistici che rispettino quei valori. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"suggestions":[{"name":"nome pasto","description":"descrizione dettagliata con ingredienti e grammature","kcal":numero,"protein":numero,"carbs":numero,"fat":numero}]}';

async function callClaude(system, userMessage) {
  const { default: fetch } = await import('node-fetch');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });
  const data = await response.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCORS(req, res);

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (req.method !== 'POST') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('wilowilo API attiva');
    return;
  }

  // ── Auth: verifica Firebase ID token ───────────────────────────────────────
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!idToken) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Autenticazione richiesta' }));
    return;
  }

  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Token non valido o scaduto' }));
    return;
  }

  // ── Rate limit ─────────────────────────────────────────────────────────────
  if (!checkRate(uid)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Troppe richieste. Riprova tra un\'ora.' }));
    return;
  }

  // ── Body ───────────────────────────────────────────────────────────────────
  let body = '';
  req.on('data', chunk => { body += chunk; if (body.length > 8192) req.destroy(); });
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      let result;

      if (payload.type === 'suggest') {
        const { remaining } = payload;
        const msg = `Macro rimanenti da raggiungere oggi:
- Calorie: ${remaining.kcal} kcal
- Proteine: ${remaining.protein}g
- Carboidrati: ${remaining.carbs}g
- Grassi: ${remaining.fat}g
Suggerisci 3 pasti o spuntini concreti e semplici da preparare.`;
        result = await callClaude(SUGGEST_SYSTEM, msg);
      } else if (payload.type === 'plan') {
        const { kcal, protein, carbs, fat, notes } = payload;
        let msg = `Obiettivi per il pasto:\n- Calorie: ${kcal} kcal`;
        if (protein) msg += `\n- Proteine: ${protein}g`;
        if (carbs)   msg += `\n- Carboidrati: ${carbs}g`;
        if (fat)     msg += `\n- Grassi: ${fat}g`;
        if (notes)   msg += `\n\nPreferenze / esclusioni: ${notes}`;
        msg += '\n\nSuggerisci 3 pasti concreti che rispettino questi obiettivi.';
        result = await callClaude(PLAN_SYSTEM, msg);
      } else {
        if (!payload.food || typeof payload.food !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Campo food mancante' }));
          return;
        }
        result = await callClaude(MACRO_SYSTEM, payload.food.slice(0, 500));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Errore interno' }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`wilowilo API attiva sulla porta ${PORT}`));
