# Submission checklist — CareCircle

Order of operations, from the proven Resale Scanner run (2026-10-15), adapted
for a subscription app with push notifications.

## Code & repo

- [x] app.json / eas.json / package.json / backend filled in (bundle ID com.fabrod.carecircle — Apple locks it FOREVER after first submission)
- [x] Expo SDK 54, React Native 0.81.5, and React 19.1.0 configured; `index.js` registers the app through `registerRootComponent`
- [ ] Private API keys and account credentials stay in server-side services or the build/submission credential store; never bundle private keys in the app
- [ ] Run `npm ci`, `npm test`, and `npm run export:ios`
- [ ] Code pushed to GitHub (public repo under fabrod, e.g. fabrod/carecircle-app)

## RevenueCat + IAP (DO BEFORE BUILDING FOR REVIEW)

- [ ] App Store Connect → create auto-renewable subscription group "CareCircle Plus" with TWO products: monthly ($7.99) and annual ($59.99)
- [ ] RevenueCat dashboard → create project, add iOS app, attach App Store Connect API key, create `carecircle_plus` entitlement, link both products
- [ ] EAS `production` environment → set `EXPO_PUBLIC_REVENUECAT_API_KEY` to the real RevenueCat **public iOS SDK key**, with plain text or sensitive visibility. This value is bundled into the app. Keep `eas.json` free of placeholder definitions that would override it.
- [ ] In a TestFlight build: buy the subscription in Apple's sandbox, confirm the paywall unlocks, test Restore Purchases

## Backend (Render)

- [ ] New Web Service → repo → monorepo settings: Root Directory EMPTY, Build = `npm install --prefix backend`, Start = `node backend/server.js`
- [ ] After any batch GitHub web upload: verify each file's real contents via raw.githubusercontent.com (package.json swaps have happened)
- [ ] User verifies Render email to activate account
- [ ] `/health` returns `{ok:true}`
- [ ] `/privacy` serves the REAL policy — open it in a browser and READ it; must match store/privacy-policy.md
- [ ] `/terms` serves the REAL terms — must match store/terms-of-use.md (Apple REQUIRES this URL for auto-renewable subscriptions)
- [ ] NOTE: MVP uses an in-memory store — circles are lost on server restart/redeploy. Move to a real DB before scaling.

## Assets

- [ ] 1024px icon, splash, adaptive icon in `assets/` (sage-green brand, NOT the Scripture Path terracotta)
- [ ] 3+ screenshots at 1179×2556 in `store/screenshots/` (Circle tab, Meds tab, Prayer tab)

## Build & submit

- [ ] `eas login` → `npm run build:simulator` → wait for the standalone simulator Release build to finish
- [ ] Install with `eas build:run --platform ios --id <simulator-build-id>`; cold-launch without Metro and verify circle creation/joining and all tabs
- [ ] Confirm the RevenueCat production environment variable is configured, then run `npm run build:ios`
- [ ] Confirm the production build number exceeds the previous uploaded build. The crash fix release is **1.0.0 (4)**. Local versioning with `autoIncrement: true` updates `app.json` during each production build creation; commit that updated value.
- [ ] Submit that exact device build with `eas submit --platform ios --profile production --id <production-build-id>` to existing App Store Connect app **6824046016**
- [ ] Wait for App Store Connect processing, install the new TestFlight build on a physical iPhone, and verify cold launch, create/join, tabs, reminder permissions, purchase, and restore
- [ ] Select the verified new build in App Store Connect before submitting for review
- [ ] If Apple pauses review under Guideline 2.1: record the screen recording + paste answers from store/app-review-response-2.1.md into the resolution reply AND App Review Information Notes

## App Store Connect listing (the blockers)

- [ ] Content Rights Information declared: no third-party content (KJV verses are public domain)
- [ ] Primary category: Lifestyle
- [ ] App Privacy questionnaire answered (store/app-privacy-answers.md) — collection YES for Health / Other User Content / Device ID / Purchases, all App Functionality, not linked, not tracking
- [ ] Privacy Policy URL = https://carecircle-app.onrender.com/privacy (real page, verified live)
- [ ] Terms of Use URL = https://carecircle-app.onrender.com/terms (real page, verified live — REQUIRED for subscriptions)
- [ ] Pricing and Availability: FREE download + in-app auto-renewable subscriptions (set up in the IAP section, not Pricing)
- [ ] Age rating 4+, subtitle "Family Caregiver Organizer", copyright = Real Scripture Path Inc.
- [ ] Screenshots uploaded in App Previews and Screenshots tab
- [ ] Submit for Review (auto-release on)

## Local dev

- [ ] For a custom backend, set `EXPO_PUBLIC_API_URL` in a gitignored `.env`; preview and production build profiles use `https://carecircle-app.onrender.com`
- [ ] Use a native development build with `expo-dev-client` for native SDK development; `npm start` runs Metro
- [ ] Verify push tokens and purchase/restore on a physical iPhone with a native build. Test local reminders in the standalone simulator build; simulator push-token registration is skipped.
