# Submission checklist — CareCircle

Order of operations, from the proven Resale Scanner run (2026-10-15), adapted
for a subscription app with push notifications.

## Code & repo
- [x] app.json / eas.json / package.json / backend filled in (bundle ID com.fabrod.carecircle — Apple locks it FOREVER after first submission)
- [ ] Secrets via Secure Vault / EAS secrets only — never pasted in chat, never in the app. This includes the RevenueCat public SDK key.
- [ ] Code pushed to GitHub (public repo under fabrod, e.g. fabrod/carecircle-app)

## RevenueCat + IAP (DO BEFORE BUILDING FOR REVIEW)
- [ ] App Store Connect → create auto-renewable subscription group "CareCircle Plus" with TWO products: monthly ($7.99) and annual ($59.99)
- [ ] RevenueCat dashboard → create project, add iOS app, attach App Store Connect API key, create `carecircle_plus` entitlement, link both products
- [ ] EAS secrets → set `EXPO_PUBLIC_REVENUECAT_API_KEY` to the real RevenueCat **public** SDK key (overrides the `REVENUECAT_KEY_GOES_HERE` placeholder in eas.json — the placeholder must NEVER ship)
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

## Build & submit (user's Mac)
- [ ] `npm install` → `eas login` → `eas build --platform ios --profile production` (answer prompts per PLAYBOOK.md; notification permission prompt appears on first launch)
- [ ] `eas submit --platform ios` → pick finished build → generate ASC API key (ADMIN)
- [ ] TestFlight processes (5–10 min); own apps appear automatically — no invite code needed
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
- [ ] `.env` with `EXPO_PUBLIC_API_URL=https://carecircle-app.onrender.com` (else the app tries localhost)
- [ ] Push notifications need a physical device (Expo Go) — simulator cannot receive push tokens; local scheduled notifications can be tested in Expo Go
