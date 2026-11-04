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
  const model = process.env.MODEL || 'gemini-3.8-flash';
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  const call = async (cfg) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 45000);
    try {
      return await fetch(url, {
        method: 'POST',
        signal: ctl.signal,
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: cfg })
      });
    } finally { clearTimeout(timer); }
  };
  const base = { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 8192 };
  let r;
  try {
    // Gemini 3 models think a lot by default, which is slow. Ask for low thinking; retry plain if rejected.
    r = await call(/^gemini-3/.test(model) ? { ...base, thinkingConfig: { thinkingLevel: 'low' } } : base);
    if (r.status === 400 && /^gemini-3/.test(model)) r = await call(base);
  } catch (e) {
    return res.status(504).json({ error: 'timeout', detail: 'Google took too long or could not be reached' });
  }
  if (!r.ok) {
    let msg = '';
    try { msg = ((await r.json()).error || {}).message || ''; } catch (e) {}
    return res.status(r.status === 429 ? 429 : 502).json({ error: 'upstream', detail: ('Google ' + r.status + ': ' + msg).slice(0, 200) });
  }
  const d = await r.json();
  const t = (((d.candidates || [])[0] || {}).content || {}).parts;
  const text = (t || []).map(p => p.text || '').join('\n');
  const out = extractJson(text);
  if (!out) return res.status(502).json({ error: 'parse', detail: 'unreadable model reply' });
  if (Array.isArray(out.results)) out.results.forEach(x => { x.src = 'estimate'; x.url = ''; });
  return res.status(200).json(out);
};
