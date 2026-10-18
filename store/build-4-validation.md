# CareCircle 1.0.0 (4) — startup fix

October 18, 2026

## Changes

- Register the native `main` application in `index.js` instead of pointing at an unregistered component.
- Keep startup recoverable after storage errors and time out API requests after 25 seconds.
- Use the hosted HTTPS API by default and preserve saved invite codes on temporary server failures.
- Skip native App Store purchase setup in Expo Go; standalone builds still configure RevenueCat.
- Lock the SDK 54 dependency tree, add a standalone Release simulator profile, and increment production build numbers automatically.

## Verified

- `npm test`: 16 passing startup, request, and purchase configuration regression tests.
- `npm run export:ios`: production Hermes bundle exported successfully.
- Installed dependencies match Expo SDK 54's local compatibility map.
- SDK 54 Expo Go: created a synthetic circle and opened all six tabs and the plans screen.
- Standalone simulator Release build 1.0.0 (3): launched with Metro stopped, joined the synthetic circle, and opened all six tabs and the plans screen.
- Signed production build 1.0.0 (4): EAS build finished successfully; App Store Connect upload finished successfully.

## Artifacts

- [Crash fix commit](https://github.com/fabrod/carecircle-app/commit/c76d469)
- [Standalone simulator build](https://expo.dev/accounts/fabrod/projects/carecircle/builds/5715071f-ff6c-42c3-9bd1-e6f03c5c834e)
- [Production build 4](https://expo.dev/accounts/fabrod/projects/carecircle/builds/48b25c77-6c37-42c7-b14a-ddb72b19af73)
- [Successful App Store Connect submission](https://expo.dev/accounts/fabrod/projects/carecircle/submissions/253f033a-ef00-47eb-a122-b97cf5cb637f)

## Device checks

After Apple processes build 4, install it through TestFlight and confirm launch,
circle restore, and notification permissions on a physical iPhone. Subscription
purchase and restore require configured App Store/RevenueCat products and an
Apple sandbox account; no purchase was made during this validation.
