# Assets

Drop in before the first EAS production build:
- `icon.png` — 1024×1024, no transparency (App Store icon)
- `splash.png` — splash screen image
- `adaptive-icon.png` — Android foreground (1024×1024)

`expo-asset` is already in `package.json` dependencies — it is REQUIRED
whenever the app references image assets (missing it breaks the Bundle
JavaScript build phase).

# Screenshots → store/screenshots/
3 screenshots at **1179×2556** (Apple's 2026 slots accept 1179×2556 /
2556×1179 / 1206×2622 / 2622×1206 — the old 1290×2796 size is REJECTED as
invalid). Upload them in the **App Previews and Screenshots tab**, not the
Header tab, in App Store Connect.
