const http = require('http');

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
      const { food } = JSON.parse(body);
      const { default: fetch } = await import('node-fetch');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: 'Sei un nutrizionista. Stima i macronutrienti del pasto descritto. Rispondi SOLO con JSON valido, nessun testo extra, nessun markdown. Struttura: {"name":"nome breve","kcal":numero,"protein":numero,"carbs":numero,"fat":numero,"satfat":numero,"fiber":numero,"ultra":boolean}. Arrotonda a interi tranne satfat e fiber (1 decimale).',
          messages: [{ role: 'user', content: food }]
        })
      });
      const data = await response.json();
      const text = data.content?.find(b => b.type === 'text')?.text || '{}';
      const macro = JSON.parse(text.replace(/```json|```/g, '').trim());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(macro));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Macro API attiva sulla porta ${PORT}`));
