# Real Scripture Path Inc. — App Shipping Playbook

Proven 2026-10-15 with Resale Scanner (code → "Submitted for review" in one day).
Rule: agent does ALL setup/config; user runs terminal commands, EAS builds, and App Store Connect forms on their Mac.

## Stack
- **App:** Expo React Native (SDK 52) + EAS cloud build. No Mac needed for compilation.
- **Backend (when server-side keys are needed):** Node/Express on Render. API keys live in backend env vars, NEVER in the app.
- **GitHub:** public repo under fabrod. Agent uploads via live browser (user's GitHub login in Secure Vault).
- **Secrets:** API keys via Secure Vault only. Tokens pasted in chat are scrubbed by the runtime and never reach tools.

## Mac-side flow (user runs these)
```
git clone <repo> && cd <repo>
npm install
npm install -g eas-cli
eas login                      # free Expo account
eas build --platform ios --profile production
# prompts: create EAS project (y) · encryption exempt (y) · log in to Apple (y —
# Apple ID + iCloud password; 2FA via SMS is more reliable than device) ·
# generate distribution certificate (y) · generate provisioning profile (y)
eas submit --platform ios       # "Select a build from EAS" → pick finished build →
# generate App Store Connect API key (y, ADMIN) → uploaded
```
Then: TestFlight (5–10 min processing) → fill listing in App Store Connect → submit for review (1–3 days). Auto-release goes live on approval.

**TestFlight for your own apps:** builds appear automatically in the TestFlight app under
your own Apple ID — no invitation code, no invite email needed. Just install the free
TestFlight app from the App Store and wait ~5–10 min after the submission finishes.

**If Apple pauses review under Guideline 2.1 "Information Needed":** they want (1) a
screen recording on a physical iPhone from launch through the typical flow, plus written
answers on purpose/audience, setup, external services, regional differences, and regulated
industries. Template: `store/app-review-response-2.1.md` — paste the answers into the
resolution reply AND the App Review Information Notes field.

## Backend deploy (Render)
New Web Service → repo → **Start = `node server.js`** (NOT App.js), set env var(s) for API keys.
User verifies Render email to activate account.

**Monorepo rule (learned 2026-10-16 — a swapped package.json broke a deploy):** when the
repo holds the app AND `backend/` together, do NOT rely on the Root Directory setting —
leave it EMPTY and use explicit paths instead:
- Build Command: `npm install --prefix backend`
- Start Command: `node backend/server.js`
(For a standalone backend repo, Root Directory = `backend` + `npm install` + `node server.js` still works.)

**After ANY batch GitHub web upload, verify each file's actual contents** via
`raw.githubusercontent.com` before deploying — the browser upload once silently swapped
root `package.json` with `backend/package.json`, and the Render build installed the wrong
packages until it was caught.

## The 5 eas.json/app.json gotchas (baked into this template — never re-debug)
1. `bundleIdentifier` does NOT go in eas.json build profiles — EAS rejects it. It lives ONLY in `app.json` (`expo.ios.bundleIdentifier`). Apple locks it permanently after first submission.
2. `babel.config.js` with `babel-preset-expo` is REQUIRED (+ `babel-preset-expo` in devDependencies) — missing it kills the Bundle JavaScript phase.
3. `expo-asset` must be in dependencies whenever the app references image assets — missing it fails Bundle JavaScript with "The required package `expo-asset` cannot be found".
4. Set `build.production.ios.image: "latest"` — Apple requires Xcode 26+ for submissions (since 2026-04-28); the EAS default image had Xcode 16, which Apple rejects.
5. `submit.production.ios.appleId` = user's Apple ID (fabioanel@me.com).

## App Store Connect (the 5 listing blockers hit 2026-10-15, all resolved)
1. **Content Rights Information** (App Information): declare third-party content if the app shows it; confirm rights via providers' terms.
2. **Primary category:** pick one.
3. **App Privacy questionnaire:** answer honestly (e.g. No collection, No tracking when everything is on-device).
4. **Privacy Policy URL:** must be a REAL PAGE on your own domain — Apple rejected a GitHub blob URL. Serve `/privacy` from the backend (`https://<your-app>.onrender.com/privacy`).
5. **Pricing and Availability:** pick a price tier (Free = tier 0).
Plus: age rating questionnaire (answer No to everything → 4+), subtitle (30 chars, good for ASO), copyright = LLC name, screenshots in the **App Previews and Screenshots tab (NOT the Header tab)**, no iPad/iPhone Duo screenshots needed for iPhone-only apps, no new build needed for listing changes. Then Submit for Review; auto-release goes live 1–3 days after approval.

## Assets
- 1024px icon, splash, adaptive icon → `assets/`
- 3 screenshots at **1179×2556** in `store/screenshots/` (Apple's 2026 slots accept 1179×2556 / 2556×1179 / 1206×2622 / 2622×1206 — the old 1290×2796 size is rejected as invalid)

## Local dev on the Mac
```
npx expo start
```
Real iPhone: install Expo Go, scan the QR (needed for camera features). Simulator: press `i` (needs Xcode; fine except camera).
Create `.env` with `EXPO_PUBLIC_API_URL=https://<your-app>.onrender.com` so the app talks to the live backend (without it, it tries localhost).

## Accounts
- Apple ID: fabioanel@me.com (Apple Developer account)
- Support email: fabrod035@gmail.com
