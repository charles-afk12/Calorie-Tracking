# Food Tracker – deploy on Vercel

1. Put this folder in a GitHub repo (or run `npx vercel` inside it).
2. On vercel.com: Add New > Project > import the repo > Deploy.
3. In Project Settings > Environment Variables add:
   - ANTHROPIC_API_KEY = your key from console.anthropic.com
   - APP_PASSCODE = any password you choose (stops strangers using your key)
4. Redeploy. Open the site; the first AI action asks for the passcode.

## Web lookup (restaurant and branded foods)
"Search food" uses Claude web search for restaurant menu items and packaged or branded products
(for example Jollibee) and shows the source link. Home-cooked foods are estimated without searching.
If lookups fail, check that web search is enabled for your organization in the Anthropic Console.
Web search has a small per-search fee, so check Anthropic's pricing page.

Data is saved in each browser (localStorage), not on a server.
