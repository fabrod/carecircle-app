# App Privacy answers — CareCircle

Fill into App Store Connect → App Privacy when submitting. These answers are
honest for the actual codebase (v1.0.0): the app DOES sync circle data to its
own backend, so collection is "Yes" for the categories below — all for App
Functionality, none linked to identity, none used for tracking.

## Do you collect data from this app? → Yes

## Data types collected

### Health
- **What:** medication names, dosages, dose schedules, appointment details entered by the user.
- **Purpose:** App Functionality (the shared circle is the product).
- **Linked to the user:** No — no accounts, no email, no device ID; data is scoped to a 6-character invite code shared by invited family members only.
- **Used for tracking:** No.

### Other User Content
- **What:** circle name, member first names, tasks, notes, prayer requests.
- **Purpose:** App Functionality.
- **Linked to the user:** No (same invite-code scoping as above).
- **Used for tracking:** No.

### Identifiers → Device ID
- **What:** push token (only if the user grants notification permission; used for medication/appointment reminders).
- **Purpose:** App Functionality.
- **Linked to the user:** No.
- **Used for tracking:** No.

### Purchases
- **What:** subscription purchase history, verified through RevenueCat from Apple receipts.
- **Purpose:** App Functionality (entitlement checks for CareCircle Plus).
- **Linked to the user:** No.
- **Used for tracking:** No.
- Note: payment details are processed entirely by Apple. We never see card or billing info.

## Data NOT collected
Contact Info, Location, Contacts, User Content beyond the above, Browsing History,
Search History, Usage Data, Diagnostics, or any other category: **No**.

## Tracking
**No.** The app does not track users across apps or websites, and contains no
advertising or analytics SDKs.

## Third-party SDKs in the app binary
- **react-native-purchases (RevenueCat)** — verifies subscription status against Apple receipts. Receives anonymized purchase data; no payment details.
- **expo-notifications** — schedules local medication/appointment reminders on-device; registers a push token only if permission is granted.
- No analytics, advertising, or social SDKs.

## Backend (not in the binary, but disclosed)
Node/Express API on Render (https://carecircle-app.onrender.com) stores circle
data keyed by invite code solely to sync invited family members. No data is
sold, rented, or shared with anyone.
