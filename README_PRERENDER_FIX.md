# Prerender Auto-Deploy Fix - Setup Instructions

## What was broken

Your frontend already had everything needed for prerendering (react-snap
config in frontend/package.json, the hydrateRoot/createRoot logic in
main.jsx) - it just never ran. build:frontend only did `vite build`,
never `npm run prerender`. Result: every page Googlebot's first-pass crawler
saw was the empty CSR shell, not real content. Confirmed via Search Console:
zero impressions on /tournament, /teamfinder, /games in 90 days.

Puppeteer (which react-snap uses to run headless Chrome) can't reliably run
on Hostinger's own Node build step - no system Chromium libraries there.
Since you deploy via GitHub auto-deploy (push then Hostinger builds), there's
no manual "build locally, upload dist" step in your workflow either.

## The fix

1. .github/workflows/prerender-deploy.yml - new GitHub Actions
   workflow. On every push to main, it builds the frontend, runs
   `npm run prerender` (react-snap, full Chromium support on GitHub's
   runners), then commits the finished frontend/dist/ back to main.

2. scripts/build-frontend.js + updated package.json -
   build:frontend now runs this script instead of `vite build` directly.
   It checks: if frontend/dist/index.html already exists (committed by
   CI), skip rebuilding - don't let Hostinger's plain vite build
   overwrite the good prerendered HTML with the empty shell again. If it's
   missing (fresh clone), fall back to a normal build so the app still runs.

3. .gitignore - frontend/dist/ is no longer ignored, since it needs
   to be committed by CI for Hostinger to pick up.

## What you need to do

One-time GitHub setting (required, or the Action can't push its commit):
- Go to your repo, then Settings -> Actions -> General -> Workflow permissions
- Select "Read and write permissions"
- Save

Then just merge these files into your repo as-is (paths already match
your repo structure) and push to main.

## What happens after you push

1. Your push to main triggers two things: Hostinger's own auto-deploy
   (builds immediately with whatever frontend/dist state currently exists)
   and the new GitHub Action (starts prerendering in parallel).
2. The GitHub Action finishes a minute or two later and pushes a second
   commit containing the real prerendered frontend/dist/.
3. That second commit triggers Hostinger's auto-deploy again. This time
   scripts/build-frontend.js finds the prerendered dist already there and
   skips rebuilding - Hostinger just serves it.
4. End state: every page in reactSnap.include (home, /games, /tournament,
   /teamfinder, /communities, /stream, /about, /faq, /blog + posts, /terms,
   /privacy, /login, /register) is served as real static HTML with the
   correct title/description/JSON-LD already baked in - no JS execution
   required to see it.

Net effect: there's a brief window (a couple minutes) after each push
where the live site is running the non-prerendered fallback build. That's
expected and harmless - it self-corrects once the Action's commit lands.

## How to verify it actually worked

Don't use browser dev tools (that shows the JS-rendered DOM either way).
Use View Page Source (Ctrl+U / Cmd+Option+U), or:

```bash
curl -s https://arenax.io/tournament | grep -o '<title>.*</title>'
```

If prerendering is live, you'll see the real per-page title
(e.g. "Free Esports Tournaments - Join Now | ArenaX") directly in the raw
HTML, not just an empty root div.

After confirming, go to Google Search Console -> URL Inspection, test
/tournament, /teamfinder, /games, and request indexing for each.
