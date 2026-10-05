# Live stream embedding (Stream page)

Streams from Twitch, Kick and YouTube now play inside ArenaX in a watch modal
instead of only opening another tab. No database migration needed.

## Files
| File | Change |
|---|---|
| `src/utils/streamEmbed.js` (new) | Parses a stream URL into a validated `{platform, kind, id}`; unknown/odd URLs are link-out only |
| `src/controllers/streamController.js` | `GET /api/streams` adds an `embed` field per stream; `go-live` sets `platform` from the URL when recognised |
| `src/app.js` | **Only change:** CSP `frameSrc` was `'none'`, now allows `youtube-nocookie.com`, `player.twitch.tv`, `player.kick.com`. If your `app.js` has changed since this zip, apply just that edit by hand |
| `frontend/src/utils/streamEmbed.js` (new) | Builds the iframe URL from the validated id (Twitch `parent` = current hostname) |
| `frontend/src/pages/Stream.jsx` | Cards open a watch modal (Esc / click outside to close, "Open on <platform>" link); non-embeddable streams still open in a new tab |
| `tests/stream-embed.test.js` (new) | 7 pure unit tests, no DB needed |

## What embeds
- Twitch: `twitch.tv/<channel>`, `twitch.tv/videos/<id>`
- Kick: `kick.com/<channel>`
- YouTube: `watch?v=`, `youtu.be/`, `/live/<id>`, `/channel/UC…/live`
- Not embeddable (open on their own site): YouTube `@handle` links (needs the YouTube API to resolve), Facebook, TikTok, anything else

## Security
The raw URL is never put in an iframe. Only a regex-validated id is extracted and the
iframe host is chosen from a fixed allowlist (also enforced by the CSP). The iframe is sandboxed.

## Deploy
Copy files over repo, commit, push, restart API, let CI rebuild `frontend/dist`.
Twitch needs the site to be served over a real hostname (`arenax.io` or your hostingersite domain), which it is.

## Verified / not verified
- Verified: 7/7 parser tests pass (incl. lookalike hosts and injected ids); `vite build` passes; backend files pass syntax check.
- NOT verified: a real browser actually playing each platform's embed, and the CSP header against the running app. Please test one Twitch, one Kick and one YouTube link after deploy.
- Viewer counts are still whatever the streamer's client reports; embedding does not change that.
