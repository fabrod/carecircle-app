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
the real key as an EAS secret `EXPO_PUBLIC_REVENUECAT_API_KEY` (never commit it).

## Tech
- Expo SDK 52 · React Native · React Navigation bottom tabs
- `lib/purchases.js` — RevenueCat: configure, status, offerings, purchase, restore
- `lib/notifications.js` — push token registration + local dose/visit reminders
- `backend/server.js` — Express circle-sync API (in-memory store for MVP —
  **move to a real DB before scaling**), `/health`, `/privacy`, `/terms`
- Push: `expo-notifications` (+ `expo-device`); RevenueCat Expo config plugin in app.json

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
