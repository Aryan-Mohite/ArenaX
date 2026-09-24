# llms.txt, sitemap.xml, robots.txt — status check

## sitemap.xml — no changes needed
Already dynamic and already correct. It reads `BLOG_SLUGS` (updated when we
added the 6 new posts) and `data/games.json` (used since the per-game pages
package) automatically, so it already includes all 10 blog posts and all 11
`/games/:slug` URLs with no further edits required.

## robots.txt — no changes needed
Doesn't reference individual pages, games, or posts — just crawl rules and
the sitemap/llms.txt pointers. Nothing about it goes stale as content is
added.

## llms.txt — updated (this is the only file in this package)
This one *was* stale: it still listed only 6 games and the original 4 blog
posts, and had no mention of the new `/games/:slug` pages at all — meaning
AI crawlers reading llms.txt (which is the whole point of the file) had no
way to discover 11 real pages that now exist.

Changes:
- `Supported Games` now lists all 11 games instead of 6
- `Games (/games)` section now mentions the per-game landing pages exist
- New `## Game Pages (/games/<slug>)` section — explicit URL for all 11
  per-game pages, since llms.txt crawlers work best with directly listed
  URLs rather than having to infer a pattern
- `Blog (/blog)` section now lists all 10 posts instead of 4

## File in this package

```
src/app.js   MODIFIED — only the llms.txt route handler content changed
```

## How to apply

```bash
git add src/app.js
git commit -m "docs: update llms.txt with all 11 games and 10 blog posts"
git push
```

This triggers the prerender workflow (harmless — llms.txt is a backend
route, not part of the prerendered frontend, but the workflow runs on any
push to main regardless).

## Verify after deploy

`https://arenax.io/llms.txt` — should show 11 games and 10 blog posts, plus
the new Game Pages section with all 11 URLs listed.
