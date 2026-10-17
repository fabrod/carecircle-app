/**
 * CareCircle backend — family circle sync API.
 *
 * Why this exists: family members share one circle (medications, visits,
 * tasks, notes) across devices. The app talks to these endpoints; there
 * are no accounts — a 6-character invite code is the access model for MVP.
 *
 * NOTE (MVP): circles live in an in-memory Map. A production release must
 * move this to a real database (data is lost on server restart / redeploy).
 *
 * Render deploy settings (monorepo: app + backend/ in one repo):
 *   Root Directory = (empty) · Build = `npm install --prefix backend`
 *   Start = `node backend/server.js`
 */

const express = require('express');
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json({ limit: '1mb' }));

// ---------------------------------------------------------------------------
// In-memory store (MVP). Replace with a real DB before scaling.
// ---------------------------------------------------------------------------
const circles = new Map();

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function makeCode() {
  let code;
  do {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
  } while (circles.has(code));
  return code;
}

function blankCircle(code, name) {
  const now = new Date().toISOString();
  return {
    code,
    name: String(name || '').slice(0, 80),
    members: [],        // [{ name, joinedAt }]
    meds: [],           // [{ id, name, dosage, timesPerDay, notes }]
    doses: [],          // [{ id, medId, date: 'YYYY-MM-DD', slot, by, at }]
    appointments: [],   // [{ id, title, date, time, location, who, notes }]
    tasks: [],          // [{ id, title, assignee, dueDate, done }]
    notes: [],          // [{ id, text, author, createdAt }]
    prayers: [],        // [{ id, text, author, createdAt, prayedBy: [names], answered }]
    createdAt: now,
    updatedAt: now,
  };
}

function getCircleOr404(req, res) {
  const circle = circles.get(String(req.params.code || '').toUpperCase());
  if (!circle) {
    res.status(404).json({ error: 'Circle not found. Check the invite code.' });
    return null;
  }
  return circle;
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// --- Circles ----------------------------------------------------------------
app.post('/api/circle', (req, res) => {
  const name = String(req.body?.name || '').trim();
  const memberName = String(req.body?.memberName || '').trim();
  if (!name) return res.status(400).json({ error: 'Circle name is required.' });
  if (!memberName) return res.status(400).json({ error: 'Your name is required.' });
  const code = makeCode();
  const circle = blankCircle(code, name);
  circle.members.push({ name: memberName.slice(0, 40), joinedAt: new Date().toISOString() });
  circles.set(code, circle);
  res.status(201).json(circle);
});

app.post('/api/circle/join', (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase();
  const memberName = String(req.body?.memberName || '').trim();
  if (!code) return res.status(400).json({ error: 'Invite code is required.' });
  if (!memberName) return res.status(400).json({ error: 'Your name is required.' });
  const circle = circles.get(code);
  if (!circle) return res.status(404).json({ error: 'Circle not found. Check the invite code.' });
  const clean = memberName.slice(0, 40);
  if (!circle.members.some((m) => m.name.toLowerCase() === clean.toLowerCase())) {
    circle.members.push({ name: clean, joinedAt: new Date().toISOString() });
    circle.updatedAt = new Date().toISOString();
  }
  res.json(circle);
});

app.get('/api/circle/:code', (req, res) => {
  const circle = getCircleOr404(req, res);
  if (circle) res.json(circle);
});

// Full-state sync: the app is the source of truth for its edits and pushes
// the whole circle. Code is immutable; unknown top-level keys are dropped.
app.put('/api/circle/:code', (req, res) => {
  const circle = getCircleOr404(req, res);
  if (!circle) return;
  const body = req.body || {};
  const pick = (v, fallback) => (Array.isArray(v) ? v : fallback);
  circle.name = String(body.name || circle.name).slice(0, 80);
  circle.members = pick(body.members, circle.members).slice(0, 50);
  circle.meds = pick(body.meds, circle.meds).slice(0, 200);
  circle.doses = pick(body.doses, circle.doses).slice(0, 2000);
  circle.appointments = pick(body.appointments, circle.appointments).slice(0, 500);
  circle.tasks = pick(body.tasks, circle.tasks).slice(0, 500);
  circle.notes = pick(body.notes, circle.notes).slice(0, 1000);
  circle.prayers = pick(body.prayers, circle.prayers).slice(0, 500);
  circle.updatedAt = new Date().toISOString();
  res.json(circle);
});

// --- Privacy policy (public page for the App Store listing) ------------------
// Apple REJECTED a GitHub blob URL. This route must serve the real policy
// at https://carecircle-app.onrender.com/privacy. Keep it in sync with
// store/privacy-policy.md.
app.get('/privacy', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Privacy Policy — CareCircle</title>
<style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1a2e}h1{font-size:28px}h2{font-size:20px;margin-top:28px}ul{padding-left:20px}</style>
</head><body>
<h1>Privacy Policy — CareCircle</h1>
<p><strong>Effective date:</strong> October 17, 2026<br><strong>Contact:</strong> fabrod035@gmail.com<br><strong>Company:</strong> Real Scripture Path Inc.</p>
<p>CareCircle is a family caregiver coordination app: invited family members share one care circle with medication schedules, appointments, tasks, and notes so everyone stays on the same page when caring for a loved one.</p>
<h2>1. What the app collects</h2>
<p>There are no accounts and no sign-in. The information you enter — circle name, member first names, medication names/dosages/schedules, appointment details, tasks, notes, and prayer requests — is sent to our own backend solely so invited family members with the same 6-character invite code see the same shared circle. It contains no email address, phone number, device identifier, or location, and is never linked to an advertising or user identity.</p>
<h2>2. Health information</h2>
<p>CareCircle is a consumer family organizer, <strong>not a HIPAA covered entity</strong>, and we make no claim of HIPAA compliance. Health-adjacent information you enter (medications, appointments) is transmitted over HTTPS only, solely to operate the circle sync service, and is never sold or shared with anyone.</p>
<h2>3. What stays on your device</h2>
<p>Your invite code and display name are cached on your device so you stay in your circle between launches. Deleting the app removes this local cache.</p>
<h2>4. What we do NOT do</h2>
<ul>
<li>No accounts, no sign-in, no contact collection.</li>
<li>No analytics, tracking, or advertising SDKs.</li>
<li>No sale, rental, or sharing of your information with anyone.</li>
<li>No location tracking.</li>
</ul>
<h2>5. Third-party services</h2>
<p>Our backend is hosted on Render (render.com), which processes the circle data described above only to operate the sync service. Subscription purchases are processed by Apple and verified through RevenueCat — we never see your payment details. No other third-party service receives your information.</p>
<h2>6. Contact</h2>
<p>Questions: fabrod035@gmail.com</p>
</body></html>`);
});

// --- Terms of Use (required by Apple for auto-renewable subscriptions) --------
// Served at https://carecircle-app.onrender.com/terms. Keep in sync with
// store/terms-of-use.md.
app.get('/terms', (_req, res) => {
  res.type('html').send(`<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Terms of Use — CareCircle</title>
<style>body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;line-height:1.6;color:#1a1a2e}h1{font-size:28px}h2{font-size:20px;margin-top:28px}ul{padding-left:20px}</style>
</head><body>
<h1>Terms of Use — CareCircle</h1>
<p><strong>Effective date:</strong> October 17, 2026<br><strong>Provider:</strong> Real Scripture Path Inc.<br><strong>Contact:</strong> fabrod035@gmail.com</p>
<p>These Terms of Use ("Terms") govern your use of the CareCircle mobile app. By downloading or using CareCircle, you agree to these Terms.</p>
<h2>1. The service</h2>
<p>CareCircle is a family caregiver coordination app from Real Scripture Path Inc., a faith-based company. It lets invited family members share one care circle — medication schedules, appointments, tasks, notes, and prayer requests — so everyone stays on the same page when caring for a loved one.</p>
<h2>2. Not medical advice; not a HIPAA covered entity</h2>
<p>CareCircle is a consumer organization tool, <strong>not a medical device</strong>, and does not provide medical advice, diagnosis, or treatment. Always follow your clinician's instructions and consult a qualified healthcare professional with any medical questions. CareCircle is <strong>not a HIPAA covered entity</strong> and makes no claim of HIPAA compliance.</p>
<h2>3. Subscriptions</h2>
<ul>
<li><strong>CareCircle Plus</strong> is an auto-renewable subscription: <strong>$7.99/month</strong> or <strong>$59.99/year</strong>. One subscription covers the whole family circle (up to 8 members).</li>
<li><strong>Free trial:</strong> new users receive a 14-day free trial. Any unused portion of a free trial is forfeited when a subscription is purchased, where applicable.</li>
<li><strong>Billing:</strong> payment is charged to your Apple ID at confirmation of purchase.</li>
<li><strong>Auto-renewal:</strong> the subscription renews automatically unless auto-renew is turned off at least 24 hours before the end of the current period. Your account is charged for renewal within 24 hours prior to the end of the current period.</li>
<li><strong>Managing / cancelling:</strong> you can manage or cancel your subscription anytime in your device's App Store account settings (Settings &gt; Apple ID &gt; Subscriptions).</li>
<li><strong>Restoring:</strong> use "Restore Purchases" in the app to re-activate a subscription on a new device with the same Apple ID.</li>
</ul>
<h2>4. Acceptable use</h2>
<p>Use CareCircle to coordinate care for your family with kindness. Do not misuse the service, attempt to disrupt it, or use it for any unlawful purpose. Invite codes are for your family circle — do not share them publicly.</p>
<h2>5. Your content</h2>
<p>You retain ownership of what you enter (notes, prayer requests, etc.). You grant Real Scripture Path Inc. only the limited right to store and sync it between members of your circle so the app works.</p>
<h2>6. Availability</h2>
<p>We aim to keep CareCircle reliable but do not guarantee uninterrupted service. Features may change as we improve the app.</p>
<h2>7. Limitation of liability</h2>
<p>To the maximum extent permitted by law, Real Scripture Path Inc. is not liable for indirect, incidental, or consequential damages arising from your use of the app. The app is provided "as is".</p>
<h2>8. Changes to these Terms</h2>
<p>We may update these Terms; continued use of the app after changes means you accept them. The current version is always at this URL.</p>
<h2>9. Contact</h2>
<p>Questions: fabrod035@gmail.com</p>
</body></html>`);
});

app.listen(PORT, () => console.log(`carecircle backend listening on ${PORT}`));
