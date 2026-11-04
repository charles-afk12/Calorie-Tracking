// Vercel serverless function: sends the prompt (and optional photo) to Claude and returns JSON.
// When web=true, Claude may use web search (for restaurant and branded foods).
function extractJson(t) {
  const last = t.lastIndexOf('}');
  for (let i = t.indexOf('{'); i !== -1 && i < last; i = t.indexOf('{', i + 1)) {
    try { return JSON.parse(t.slice(i, last + 1)); } catch (e) {}
  }
  return null;
}
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const pass = process.env.APP_PASSCODE;
  if (pass && req.headers['x-pass'] !== pass) return res.status(401).json({ error: 'auth' });
  const { prompt, image, web } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length > 4000) return res.status(400).json({ error: 'bad' });
  const content = [];
  if (image) {
    if (image.length > 3000000) return res.status(413).json({ error: 'big' });
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } });
  }
  content.push({ type: 'text', text: prompt });
  const body = {
    model: process.env.MODEL || 'claude-sonnet-5-5',
    max_tokens: web ? 2500 : 1000,
    messages: [{ role: 'user', content }]
  };
  if (web) body.tools = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }];
  let r;
  try {
    r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body)
    });
  } catch (e) { return res.status(502).json({ error: 'upstream' }); }
  if (!r.ok) return res.status(502).json({ error: 'upstream' });
  const d = await r.json();
  const t = (d.content || []).filter(c => c.type === 'text').map(c => c.text || '').join('\n');
  const out = extractJson(t);
  if (!out) return res.status(502).json({ error: 'parse' });
  // Only keep a "from web" label if the URL really came from the search results.
  const urls = [];
  (d.content || []).forEach(c => { if (c.type === 'web_search_tool_result' && Array.isArray(c.content)) c.content.forEach(x => x && x.url && urls.push(x.url)); });
  if (Array.isArray(out.results)) out.results.forEach(x => {
    const ok = x.src === 'web' && typeof x.url === 'string' && urls.some(u => u === x.url || u.startsWith(x.url) || x.url.startsWith(u));
    if (!ok) { x.src = 'estimate'; x.url = ''; }
  });
  return res.status(200).json(out);
};
