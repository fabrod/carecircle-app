# App Review response — Guideline 2.1 (Information Needed)

Prefilled for CareCircle (2026-10-17). Paste the answers into the App Store
Connect resolution reply AND into the Notes field of App Review Information.

---

## 1. Screen recording
Record on a PHYSICAL iPhone via Control Center → Screen Recording, with the TestFlight
build installed (no simulator — Apple wants a real device). Keep it under ~2 minutes.
Shot list:
1. Launch the app (splash → onboarding), create a circle ("Mom's Care Team")
2. Copy the invite code; show the Circle tab with members
3. Meds tab: add a medication, tap dose circles to check off
4. Visits tab: add an appointment; Tasks tab: add and assign a task; Notes: post an update
5. Prayer tab: share a prayer request, tap 🙏 "prayed"
6. Show the paywall (from Circle tab → View plans): monthly/annual options, Restore Purchases, Privacy Policy + Terms of Use links

Flows that do NOT exist (no need to demonstrate): no accounts/login (invite codes only),
no public user-generated content, no web views.

## 2. App purpose and target audience
CareCircle is a family caregiver coordination hub. It lets invited family members share
one care circle — medication schedules, appointments, tasks, notes, and prayer requests —
so everyone stays on the same page when caring for an aging loved one. Target audience:
adult children and relatives coordinating elder care across households. The problem it
solves: tens of millions of families coordinate care over chaotic group chats — missed
doses, forgotten appointments, duplicated effort, and caregiver burnout. CareCircle
replaces the chaos with one shared hub plus dose/visit reminders. It is built by
Real Scripture Path Inc., a faith-based company; the app serves everyone and includes
an optional prayer feature and daily caregiver scripture encouragement.

## 3. Setup and access instructions
No account, login, or setup required. On first launch: create a circle (enter a circle
name + your first name — a 6-character invite code is generated) or join with a code.
The app requests notification permission (used only for medication dose reminders and
1-hour appointment reminders, scheduled locally on-device). Main flow: Circle tab shows
the invite code + members; Meds/Visits/Tasks/Notes/Prayer tabs manage the shared lists;
everything syncs instantly to invited family members. No demo credentials needed —
there is no login. To test multi-member sync, install the TestFlight build on a second
device and join with the same invite code.

## 4. External services
- Render (https://carecircle-app.onrender.com) — our own Node/Express backend; stores circle data keyed by invite code solely to sync invited family members; also serves the privacy policy and terms pages. No API keys involved.
- RevenueCat (react-native-purchases SDK) — verifies CareCircle Plus subscription status against Apple receipts. No payment details reach us; Apple processes all payments.
- Apple Push Notification service — delivers the push token if the user grants notification permission; reminders themselves are scheduled locally on-device.

## 5. Regional differences
None. The app functions consistently across all regions.

## 6. Regulated industry / protected material
CareCircle is a consumer family organizer, NOT a medical device, and does not provide
medical advice — the app states this on the Meds tab and in the Terms. It is NOT a
HIPAA covered entity and makes no claim of HIPAA compliance. Scripture verses shown
in the app are from the King James Version (public domain).
