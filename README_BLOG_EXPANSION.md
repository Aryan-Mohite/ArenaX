# Blog expansion — 4 posts → 10 posts

Adds 6 new posts on top of the existing 4, targeting the specific keyword
gaps from the SEO strategy (esports team finder, free esports tournaments
India, per-game comparisons that cross-link to the new /games/:slug pages,
tournament format education, battle royale cluster, esports career content).

## Files in this package

```
frontend/src/data/blogPosts.js   MODIFIED — 6 new posts appended
frontend/src/pages/BlogPost.jsx  MODIFIED — renderer extended to support
                                  h3, ul (bullet lists), and cta (internal
                                  link cards) block types, used by the new
                                  posts for better structure and internal
                                  linking to /tournament, /teamfinder, and
                                  the per-game pages
src/app.js                       MODIFIED — BLOG_SLUGS list updated so the
                                  6 new posts appear in sitemap.xml
frontend/package.json            MODIFIED — 6 new post URLs added to
                                  react-snap's prerender include list
```

## New posts

| Slug | Targets |
|---|---|
| `esports-team-finder-guide` | "esports team finder" |
| `free-esports-tournaments-india-2026` | "esports tournaments" + India |
| `valorant-vs-cs2-which-tactical-shooter-to-compete-in` | comparison search intent, links to `/games/valorant` + `/games/counter-strike` |
| `how-esports-tournament-brackets-work` | "tournament bracket" education, evergreen |
| `battle-royale-esports-guide-bgmi-free-fire-pubg` | BGMI/Free Fire/PUBG cluster, links to those game pages |
| `how-to-start-esports-career-in-india` | "esports career India" — broad, shareable, good backlink magnet |

## How to apply

```bash
git add frontend/src/data/blogPosts.js frontend/src/pages/BlogPost.jsx \
        src/app.js frontend/package.json
git commit -m "feat: add 6 new blog posts, extend renderer for lists/CTAs"
git push
```

Triggers the prerender workflow automatically — all 6 new posts will be
prerendered and crawlable on deploy.

## Verify after deploy

1. `https://arenax.io/blog` — should show 10 posts total.
2. `https://arenax.io/blog/esports-team-finder-guide` (or any new slug) —
   check title/meta are unique, and the bullet lists + internal link cards
   render correctly.
3. `https://arenax.io/sitemap.xml` — should list all 10 `/blog/<slug>` URLs.
4. Request indexing for the 6 new URLs in GSC rather than waiting for
   organic re-crawl.
