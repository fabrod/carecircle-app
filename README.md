# CareCircle — family caregiver coordination hub

Real Scripture Path Inc. · App #2 · Built with the proven Expo/EAS playbook.

A faith-based company helping solve huge problems in a broken world: CareCircle
brings families together in one calm, shared hub — meds, visits, tasks, notes,
and prayer — when caring for an aging loved one.

## Product

- **Circle**: create a family circle (6-char invite code) or join with a code; member list; daily caregiver verse (KJV, public domain)
- **Meds**: shared medication list, dose check-offs, local dose reminders
- **Visits**: shared appointments, 1-hour-before reminders
- **Tasks**: assignable to-dos with due dates
- **Notes**: shared timestamped updates feed
- **Prayer**: prayer requests, "🙏 prayed" counter, answered/ testimonies

No accounts — invite codes are the access model. No auth anywhere.

## Monetization

Free download, 14-day free trial, then **CareCircle Plus** subscription via
RevenueCat (react-native-purchases): **$7.99/month or $59.99/year**, one
subscription covers the whole circle (up to 8 members). Paywall UI is in
`App.js` (`PaywallScreen`); wiring in `lib/purchases.js`.

**Before App Store submission:** create the IAP products in App Store Connect,
wire them in the RevenueCat dashboard (`carecircle_plus` entitlement), and set
`EXPO_PUBLIC_REVENUECAT_API_KEY` in the EAS `production` environment to the
RevenueCat **public iOS SDK key**. This value is bundled into the app; use plain
text or sensitive visibility and do not put a placeholder in `eas.json`.
RevenueCat private API keys and App Store Connect credentials belong only in
server-side services or the build/submission credential store.

## Tech

- Expo SDK 54 · React Native 0.81.5 · React 19.1.0 · React Navigation bottom tabs
- `index.js` — registers the app with Expo's `registerRootComponent`
- `lib/purchases.js` — RevenueCat: configure, status, offerings, purchase, restore
- `lib/notifications.js` — push token registration + local dose/visit reminders
- `backend/server.js` — Express circle-sync API (in-memory store for MVP —
  **move to a real DB before scaling**), `/health`, `/privacy`, `/terms`
- Notifications: `expo-notifications` plugin in `app.json`, plus `expo-device`

## Verify and build iOS

Install the locked dependencies and run the startup regression checks and iOS
bundle export:

```sh
npm ci
npm test
npm run export:ios
```

Create a standalone Release build for the iOS simulator, then install the
finished build using its EAS build ID:

```sh
npm run build:simulator
eas build:run --platform ios --id <simulator-build-id>
```

Cold-launch the app and verify circle creation/joining and the main tabs. This
profile embeds its JavaScript bundle and does not require Metro. A simulator
build cannot be uploaded to TestFlight; use the production profile for devices:

```sh
npm run build:ios
eas submit --platform ios --profile production --id <production-build-id>
```

Production builds increment the local `ios.buildNumber` automatically. The crash
fix release is **1.0.0 (4)**; check the value updated by EAS before committing it
or creating another production build. Submission targets
the existing App Store Connect app **6824046016**, bundle ID
`com.fabrod.carecircle`. After upload, wait for Apple's processing and verify the
new build on a physical iPhone through TestFlight before selecting it for review.

## Health data

Consumer family organizer — **NOT a HIPAA covered entity**. Never claim HIPAA
compliance. Health-adjacent data goes over HTTPS only, never sold/shared.
The app is not a medical device and gives no medical advice (stated in-app).

## Deploy (Render, monorepo)

Root Directory empty · Build `npm install --prefix backend` · Start `node backend/server.js`
→ https://carecircle-app.onrender.com · `/privacy` + `/terms` must stay in sync
with `store/privacy-policy.md` and `store/terms-of-use.md`.

## Store

Materials in `store/`: listing copy, privacy answers (honest: collection YES for
Health / Other User Content / Device ID / Purchases — App Functionality, not
linked, not tracking), submission checklist, 2.1 review response (prefilled).

Full shipping playbook: `PLAYBOOK.md`
