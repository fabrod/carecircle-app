/**
 * lib/purchases.js — RevenueCat wiring (react-native-purchases).
 *
 * Handles all StoreKit complexity for the CareCircle Plus subscription
 * ($7.99/mo or $59.99/yr, 14-day free trial, one subscription per family circle).
 *
 * API KEY: read from EXPO_PUBLIC_REVENUECAT_API_KEY. The real key is set via
 * EAS secrets / Secure Vault before the production build — NEVER hardcode it
 * here or commit it to the repo. eas.json ships a placeholder on purpose.
 *
 * TODO before App Store submission:
 *  1. Create the IAP products in App Store Connect (auto-renewable subscription
 *     group, monthly + annual).
 *  2. Create matching products + the `carecircle_plus` entitlement in the
 *     RevenueCat dashboard and attach the App Store Connect API key there.
 *  3. Set the real RevenueCat public SDK key as an EAS secret
 *     (EXPO_PUBLIC_REVENUECAT_API_KEY) — it overrides the eas.json placeholder.
 * Until then, subscription checks safely return { active: false } and the
 * paywall explains purchases aren't enabled in the build yet.
 */

import { Platform } from 'react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

export const ENTITLEMENT_ID = 'carecircle_plus'; // must match RevenueCat dashboard
export const PLACEHOLDER_KEY = 'REVENUECAT_KEY_GOES_HERE';

let configured = false;

export function getRevenueCatKey() {
  return process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';
}

export function isPurchasesConfigured() {
  return configured;
}

export async function configurePurchases() {
  const key = getRevenueCatKey();
  if (!key || key === PLACEHOLDER_KEY) {
    console.log('[purchases] No RevenueCat key — skipping configure (IAP setup TODO).');
    return false;
  }
  try {
    if (__DEV__) {
      await Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }
    await Purchases.configure({ apiKey: key });
    configured = true;
    console.log('[purchases] configured');
    return true;
  } catch (e) {
    console.warn('[purchases] configure failed:', e?.message || e);
    return false;
  }
}

/** { active: boolean } — true when the carecircle_plus entitlement is active. */
export async function getSubscriptionStatus() {
  if (!configured) return { active: false, source: 'unconfigured' };
  try {
    const info = await Purchases.getCustomerInfo();
    const active = !!info.entitlements.active[ENTITLEMENT_ID];
    return { active, source: 'revenuecat' };
  } catch (e) {
    console.warn('[purchases] getCustomerInfo failed:', e?.message || e);
    return { active: false, source: 'error' };
  }
}

/** RevenueCat offerings (packages for monthly/annual), or null if unavailable. */
export async function getOfferings() {
  if (!configured) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current || null;
  } catch (e) {
    console.warn('[purchases] getOfferings failed:', e?.message || e);
    return null;
  }
}

/** Purchase a RevenueCat package. Returns true if the entitlement is now active. */
export async function purchasePackage(pkg) {
  const { customerInfo } = await Purchases.purchasePackage(pkg);
  return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
}

/** Restore previous purchases. Returns { active } and whether anything changed. */
export async function restorePurchases() {
  if (!configured) return { active: false, restored: false };
  try {
    const info = await Purchases.restorePurchases();
    return { active: !!info.entitlements.active[ENTITLEMENT_ID], restored: true };
  } catch (e) {
    console.warn('[purchases] restore failed:', e?.message || e);
    return { active: false, restored: false, error: e?.message || 'Restore failed' };
  }
}

/** Present RevenueCat's native paywall UI (optional alternative to our screen). */
export async function presentPaywall() {
  // Kept as an option; the app uses its own PaywallScreen for brand control.
  // const { default: RevenueCatUI } = await import('react-native-purchases-ui');
  // return RevenueCatUI.presentPaywall();
  throw new Error('Native RevenueCat paywall not wired — using in-app PaywallScreen.');
}

export const STORE_URLS = {
  privacy: 'https://carecircle-app.onrender.com/privacy',
  terms: 'https://carecircle-app.onrender.com/terms',
};
