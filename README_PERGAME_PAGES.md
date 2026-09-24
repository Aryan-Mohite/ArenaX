# Per-game landing pages (/games/:slug)

Adds 11 dedicated, SEO-targeted pages — one per game in `data/games.json` —
each with a unique title, meta description, intro copy, "why compete" points,
FAQ (with FAQPage/VideoGame/BreadcrumbList structured data), and live
tournament/team-finder counts layered on client-side.

## Files in this package (all repo-mirrored paths — copy over the matching file)

```
frontend/src/pages/GamePage.jsx        NEW — the page itself
frontend/src/data/games.js             NEW — static per-game content (titles,
                                        FAQs, "why compete" copy). Deliberately
                                        static, not fetched from the API — see
                                        the comment at the top of the file for
                                        why (react-snap's CI runner has no DB
                                        access, so prerendering needs this to
                                        be synchronous).
frontend/src/components/GameCard.jsx   MODIFIED — cards on /games now link to
                                        /games/:slug via a real <Link> (an
                                        actual <a> tag), so crawlers can
                                        discover the new pages by following
                                        internal links, not just via sitemap.
frontend/src/App.jsx                   MODIFIED — adds the /games/:slug route
frontend/package.json                  MODIFIED — adds all 11 game paths to
                                        react-snap's prerender include list.
                                        Skipping this step would mean the new
                                        pages exist but never get prerendered
                                        — same empty-shell problem as before.
src/app.js                             MODIFIED — sitemap.xml now includes
                                        all 11 /games/:slug URLs, read
                                        directly from data/games.json (no DB
                                        dependency for these entries)
```

## How to apply

Copy each file from this package over the matching path in your repo (same
relative structure), then:

```bash
git add frontend/src/pages/GamePage.jsx frontend/src/data/games.js \
        frontend/src/components/GameCard.jsx frontend/src/App.jsx \
        frontend/package.json src/app.js
git commit -m "feat: add per-game SEO landing pages (/games/:slug)"
git push
```

This will trigger the prerender workflow automatically. All 11 new pages
will be prerendered along with everything else.

## What to verify after it deploys

1. Visit `https://arenax.io/games/valorant` (or any slug) — should show a
   dedicated page, not the generic homepage/Games listing.
2. `view-source:https://arenax.io/games/valorant` — title tag should read
   "Valorant Tournaments & Team Finder | ArenaX", not the generic homepage
   title.
3. `https://arenax.io/sitemap.xml` — should now list 11 `/games/<slug>` URLs.
4. After confirming, request indexing for a few of these in Google Search
   Console (URL Inspection → Request Indexing) to speed up initial crawl —
   don't wait for organic re-crawl.

## Known limitation (documented on purpose, not a bug)

The "Browse {Game} Tournaments" / "Find {Game} Teammates" buttons currently
link to the general `/tournament` and `/teamfinder` pages rather than a
pre-filtered view (e.g. `/tournament?game=valorant`), because those pages
don't currently read a game filter from the URL — only from in-page filter
UI state. This is a good phase-2 improvement (better UX, slightly better
internal linking signal) but wasn't required to ship the SEO landing pages
themselves, so it was left out of this package to keep the diff focused.
Happy to build that next if useful.

## Slug list (must match data/games.json exactly)

```
valorant, counter-strike, league-of-legends, dota-2, apex-legends,
fortnite, warzone, pubg-battlegrounds, battlegrounds-mobile-india,
free-fire, cod-mobile
```
