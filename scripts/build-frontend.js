// SEO ADD (prerender pipeline): Smart frontend build step.
//
// Why this exists: react-snap (prerendering) needs headless Chromium, which
// Hostinger's Node.js build environment can't reliably run. So prerendering
// happens in GitHub Actions instead (see .github/workflows/prerender-deploy.yml),
// which commits the finished frontend/dist/ (with real per-route HTML) back
// to main. When Hostinger's auto-deploy then pulls main and runs
// `npm install` -> postinstall -> build:frontend, we do NOT want it to
// re-run `vite build` from scratch, because a plain Vite build would
// overwrite the good prerendered HTML with the empty CSR shell again.
//
// So: if a prerendered dist is already present (the normal case on
// Hostinger, since CI already built it), skip rebuilding. If it's missing
// (first-time clone, or working locally without having pulled the CI
// commit yet), fall back to a normal Vite build so the app still runs.

import { existsSync } from "fs";
import { execSync } from "child_process";

const distIndex = "frontend/dist/index.html";

if (existsSync(distIndex)) {
  console.log(
    "[build:frontend] Prerendered frontend/dist already present (built by CI) — skipping rebuild."
  );
  process.exit(0);
}

console.log(
  "[build:frontend] No frontend/dist found — running a plain Vite build as a fallback. " +
    "Note: this build will NOT be prerendered. The next push to main will trigger CI " +
    "to prerender and commit the real dist."
);

execSync("cd frontend && npm install --include=dev && npm run build", {
  stdio: "inherit",
});
