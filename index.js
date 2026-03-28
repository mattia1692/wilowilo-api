const http = require('http');

const MACRO_SYSTEM = 'Sei un nutrizionista. Stima i macronutrienti del pasto descritto. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"name":"nome breve","kcal":numero,"protein":numero,"carbs":numero,"fat":numero,"satfat":numero,"fiber":numero,"ultra":boolean}. Arrotonda a interi tranne satfat e fiber (1 decimale). "ultra" è true per cibi ultra-processati.';

const SUGGEST_SYSTEM = 'Sei un nutrizionista esperto. Ti vengono dati i macro rimanenti da raggiungere oggi. Suggerisci 3 opzioni di pasto o spuntino concrete e realistiche che aiutino a raggiungere quei valori. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"suggestions":[{"name":"nome pasto","description":"descrizione breve e concreta","kcal":numero,"protein":numero,"carbs":numero,"fat":numero}]}';

const PLAN_SYSTEM = 'Sei un nutrizionista esperto. Ti vengono forniti obiettivi calorici e/o di macronutrienti, più eventuali preferenze o esclusioni alimentari. Suggerisci 3 pasti concreti e realistici che rispettino quei valori. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"suggestions":[{"name":"nome pasto","description":"descrizione dettagliata con ingredienti e grammature","kcal":numero,"protein":numero,"carbs":numero,"fat":numero}]}';

async function callClaude(system, userMessage, apiKey) {
  const { default: fetch } = await import('node-fetch');
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 800,
      system,
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  const data = await response.json();
  const text = data.content?.find(b => b.type === 'text')?.text || '{}';
  return JSON.parse(text.replace(/```json|```/g, '').trim());
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(200); res.end('OK - Macro API attiva'); return; }

  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      const apiKey = process.env.ANTHROPIC_API_KEY;
      let result;

      if (payload.type === 'suggest') {
        const { remaining } = payload;
        const msg = `Macro rimanenti da raggiungere oggi:
- Calorie: ${remaining.kcal} kcal
- Proteine: ${remaining.protein}g
- Carboidrati: ${remaining.carbs}g
- Grassi: ${remaining.fat}g
Suggerisci 3 pasti o spuntini concreti e semplici da preparare.`;
        result = await callClaude(SUGGEST_SYSTEM, msg, apiKey);
      } else if (payload.type === 'plan') {
        const { kcal, protein, carbs, fat, notes } = payload;
        let msg = `Obiettivi per il pasto:\n- Calorie: ${kcal} kcal`;
        if (protein) msg += `\n- Proteine: ${protein}g`;
        if (carbs)   msg += `\n- Carboidrati: ${carbs}g`;
        if (fat)     msg += `\n- Grassi: ${fat}g`;
        if (notes)   msg += `\n\nPreferenze / esclusioni: ${notes}`;
        msg += '\n\nSuggerisci 3 pasti concreti che rispettino questi obiettivi.';
        result = await callClaude(PLAN_SYSTEM, msg, apiKey);
      } else {
        result = await callClaude(MACRO_SYSTEM, payload.food, apiKey);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Macro API attiva sulla porta ${PORT}`));
