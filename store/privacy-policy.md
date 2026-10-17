# Privacy Policy — CareCircle

Effective date: October 17, 2026
Contact: fabrod035@gmail.com
Company: Real Scripture Path Inc. — a faith-based company building apps that help solve huge problems in a broken world.

## 1. What the app does
CareCircle is a family caregiver coordination app. Invited family members share one care circle — medication schedules, appointments, tasks, notes, and prayer requests — so everyone stays on the same page when caring for a loved one.

## 2. What is transmitted
There are no accounts and no sign-in. The information you enter — circle name, member first names, medication names/dosages/schedules, appointment details, tasks, notes, and prayer requests — is sent to our own backend solely so invited family members with the same 6-character invite code see the same shared circle. It contains no email address, phone number, device identifier, or location, and is never linked to an advertising or user identity.

To deliver reminders, the app may register a push token with the device's push service. Local medication and appointment reminders are scheduled on your device.

Subscription purchases are processed by Apple and verified through RevenueCat. We never see or store your payment details.

## 3. Health information
CareCircle is a consumer family organizer, **not a HIPAA covered entity**, and we make no claim of HIPAA compliance. Health-adjacent information you enter (medications, appointments) is transmitted over HTTPS only, solely to operate the circle sync service, and is never sold or shared with anyone.

## 4. What stays on your device
Your invite code, display name, and scheduled reminder identifiers are cached on your device so you stay in your circle between launches. Deleting the app removes this local cache.

## 5. What we do NOT do
- No accounts, no sign-in, no contact collection.
- No analytics, tracking, or advertising SDKs.
- No sale, rental, or sharing of your information with anyone.
- No location tracking.

## 6. Third-party services
- **Render** (render.com) — hosts our backend, which processes the circle data described above only to operate the sync service.
- **RevenueCat** — verifies subscription status. Receives anonymized purchase receipts from Apple; no payment details reach us.
- **Apple Push Notification service / Expo push service** — delivers the push token used for reminders; used only if remote push is enabled.

## 7. Contact
Questions: fabrod035@gmail.com

---
IMPORTANT: this file and the `/privacy` route in `backend/server.js` must say
the same thing. Apple requires the Privacy Policy URL in App Store Connect to
be a REAL PAGE on your own domain (a GitHub blob URL was REJECTED).
Serve it at https://carecircle-app.onrender.com/privacy and re-check the live
page after every backend deploy.
