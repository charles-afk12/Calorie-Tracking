# Food Tracker – deploy on Vercel (free Gemini version)

1. Get a free key: go to aistudio.google.com, sign in with Google, click "Get API key", create one, copy it.
2. Put this folder in a GitHub repo (or run `npx vercel` inside it) and import it on vercel.com.
3. In Project Settings > Environment Variables add:
   - GEMINI_API_KEY = your Google AI Studio key
   - APP_PASSCODE = any password you choose (stops strangers using your key)
   - MODEL = (optional) a different Gemini model, e.g. gemini-3.5-flash-lite, if the default is rate limited or unavailable
4. Redeploy (Deployments > ... > Redeploy). Open the site; the first AI action asks for the passcode.

Notes
- The free tier is rate limited, and Google may use free-tier requests to improve its products.
- Search shows AI estimates only (no live web lookup in this version).
- extras/ask-claude.js is the Claude version with web lookup. To use it later, replace api/ask.js with it and set ANTHROPIC_API_KEY instead.
- Data is saved in each browser (localStorage), not on a server.
