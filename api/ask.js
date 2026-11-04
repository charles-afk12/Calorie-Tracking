// Vercel serverless function (Google Gemini version).
// Sends the prompt (and optional photo) to Gemini and returns the JSON the app asks for.
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
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'config', detail: 'GEMINI_API_KEY is not set in Vercel' });
  const { prompt, image } = req.body || {};
  if (!prompt || typeof prompt !== 'string' || prompt.length > 4000) return res.status(400).json({ error: 'bad' });
  const parts = [];
  if (image) {
    if (image.length > 3000000) return res.status(413).json({ error: 'big' });
    parts.push({ inline_data: { mime_type: 'image/jpeg', data: image } });
  }
  parts.push({ text: prompt + '\n\nYou cannot browse the web. If a field asks for src, always use "estimate" and leave url empty. Respond with JSON only.' });
  const model = process.env.MODEL || 'gemini-2.5-flash';
  let r;
  try {
    r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 4096 }
      })
    });
  } catch (e) { return res.status(502).json({ error: 'upstream', detail: 'could not reach Google' }); }
  if (!r.ok) {
    let msg = '';
    try { msg = ((await r.json()).error || {}).message || ''; } catch (e) {}
    return res.status(r.status === 429 ? 429 : 502).json({ error: 'upstream', detail: msg.slice(0, 160) });
  }
  const d = await r.json();
  const t = (((d.candidates || [])[0] || {}).content || {}).parts;
  const text = (t || []).map(p => p.text || '').join('\n');
  const out = extractJson(text);
  if (!out) return res.status(502).json({ error: 'parse', detail: 'unreadable model reply' });
  if (Array.isArray(out.results)) out.results.forEach(x => { x.src = 'estimate'; x.url = ''; });
  return res.status(200).json(out);
};
