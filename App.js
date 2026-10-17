/**
 * CareCircle — family caregiver coordination hub (Real Scripture Path Inc.)
 *
 * Tabs: Circle (invite code + members + daily caregiver verse) · Meds (shared med
 *       list + dose check-offs) · Visits (appointments) · Tasks (assignable to-dos)
 *       Notes (shared feed) · Prayer (prayer requests + praise reports)
 *
 * Built by Real Scripture Path Inc., a faith-based company helping solve huge
 * problems in a broken world. The app serves everyone; its heart is faith.
 * Access model: no accounts — a 6-character invite code identifies the family
 * circle. Circle state syncs through our backend (PUT full state).
 *
 * Monetization: 14-day free trial, then CareCircle Plus subscription via
 * RevenueCat ($7.99/mo or $59.99/yr, one subscription covers the whole circle).
 * IAP products must be created in App Store Connect + RevenueCat dashboard
 * before submission (see lib/purchases.js TODO).
 *
 * Health data note: CareCircle is a consumer family organizer, NOT a HIPAA
 * covered entity. Do NOT claim HIPAA compliance anywhere. Health-adjacent data
 * (meds, visits) travels over HTTPS only and is never sold or shared.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert,
  ActivityIndicator, RefreshControl, Modal, KeyboardAvoidingView,
  Platform, Linking, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import {
  configurePurchases, getSubscriptionStatus, getOfferings,
  purchasePackage, restorePurchases, isPurchasesConfigured, STORE_URLS,
} from './lib/purchases';
import {
  registerForPushNotifications, scheduleDoseReminders, cancelDoseReminders,
  scheduleAppointmentReminder, cancelAppointmentReminder,
} from './lib/notifications';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';
const TRIAL_DAYS = 14;
const MAX_MEMBERS = 8;

const CODE_KEY = '@carecircle:code';
const NAME_KEY = '@carecircle:member';
const TRIAL_KEY = '@carecircle:trialStart';

const C = {
  bg: '#FAF7F2',
  card: '#FFFFFF',
  primary: '#5B8A72',
  primaryDark: '#476E5B',
  primarySoft: '#E8F0EB',
  text: '#2E3A33',
  muted: '#7C8B82',
  border: '#E7E1D5',
  danger: '#C0564D',
  gold: '#B97F1F',
  white: '#FFFFFF',
};

async function api(path, method = 'GET', body) {
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* non-JSON */ }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmtDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}`;
}
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}
function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

// ---------------------------------------------------------------------------
// UI primitives (large touch targets, generous spacing — seniors use this)
// ---------------------------------------------------------------------------

function Btn({ title, onPress, variant = 'primary', disabled, style }) {
  const bg =
    variant === 'primary' ? C.primary
    : variant === 'dark' ? C.primaryDark
    : variant === 'danger' ? C.danger
    : variant === 'ghost' ? 'transparent'
    : C.primarySoft;
  const fg = variant === 'ghost' ? C.primaryDark : variant === 'soft' ? C.primaryDark : C.white;
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.75}
      style={[styles.btn, { backgroundColor: bg, opacity: disabled ? 0.55 : 1 }, style]}
    >
      <Text style={[styles.btnText, { color: fg }]}>{title}</Text>
    </TouchableOpacity>
  );
}

function Field({ label, ...props }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={C.muted}
        autoCapitalize="sentences"
        {...props}
      />
    </View>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function EmptyState({ icon, title, hint }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {!!hint && <Text style={styles.emptyHint}>{hint}</Text>}
    </View>
  );
}

function Sheet({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.sheet}>
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={styles.sheetClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function ScreenShell({ children, onRefresh, refreshing }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.screenBody}
        refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={C.primary} /> : undefined}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Onboarding — create or join a circle
// ---------------------------------------------------------------------------

function OnboardingScreen({ onDone }) {
  const [mode, setMode] = useState('create'); // 'create' | 'join'
  const [circleName, setCircleName] = useState('');
  const [code, setCode] = useState('');
  const [memberName, setMemberName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const name = memberName.trim();
    if (!name) return Alert.alert('Almost there', 'Please enter your first name.');
    setBusy(true);
    try {
      let circle;
      if (mode === 'create') {
        const cname = circleName.trim();
        if (!cname) { setBusy(false); return Alert.alert('Circle name', 'Give your circle a name, e.g. "Mom\u2019s Care Team".'); }
        circle = await api('/api/circle', 'POST', { name: cname, memberName: name });
      } else {
        const c = code.trim().toUpperCase();
        if (!c) { setBusy(false); return Alert.alert('Invite code', 'Enter the 6-character invite code.'); }
        circle = await api('/api/circle/join', 'POST', { code: c, memberName: name });
      }
      await AsyncStorage.setItem(CODE_KEY, circle.code);
      await AsyncStorage.setItem(NAME_KEY, name);
      registerForPushNotifications(); // best-effort, non-blocking
      onDone(circle, name);
    } catch (e) {
      Alert.alert('Could not connect', e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.screenBody, { justifyContent: 'center', flexGrow: 1 }]} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>🤝</Text>
        <Text style={styles.h1}>CareCircle</Text>
        <Text style={styles.sub}>One shared hub for everyone caring for your loved one — meds, visits, tasks, notes, and prayer, in one calm place.</Text>

        <View style={styles.modeRow}>
          {['create', 'join'].map((m) => (
            <TouchableOpacity
              key={m}
              onPress={() => setMode(m)}
              style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
            >
              <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                {m === 'create' ? 'Create a circle' : 'Join with code'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Card>
          {mode === 'create' ? (
            <Field label="Circle name" placeholder="Mom's Care Team" value={circleName} onChangeText={setCircleName} />
          ) : (
            <Field label="Invite code" placeholder="ABC123" value={code} onChangeText={(t) => setCode(t.toUpperCase())} autoCapitalize="characters" maxLength={6} />
          )}
          <Field label="Your first name" placeholder="Sarah" value={memberName} onChangeText={setMemberName} />
          {busy
            ? <ActivityIndicator color={C.primary} style={{ marginTop: 12 }} />
            : <Btn title={mode === 'create' ? 'Create circle' : 'Join circle'} onPress={submit} style={{ marginTop: 8 }} />}
        </Card>
        <Text style={styles.fine}>Built with care by Real Scripture Path Inc., a faith-based company. No accounts, no passwords — the 6-character invite code is how family joins. Free for {TRIAL_DAYS} days.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Paywall
// ---------------------------------------------------------------------------

const PLAN_FALLBACK = [
  { id: 'monthly', title: 'Monthly', price: '$7.99', per: '/month', pkg: null },
  { id: 'annual', title: 'Annual', price: '$59.99', per: '/year', pkg: null, tag: 'BEST VALUE' },
];

function PaywallScreen({ mode, trialDaysLeft, onClose, onSubscribed }) {
  const [offering, setOffering] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const configured = isPurchasesConfigured();

  useEffect(() => {
    getOfferings().then(setOffering).catch(() => {});
  }, []);

  const plans = offering?.availablePackages?.length
    ? offering.availablePackages.map((p) => ({
        id: p.identifier,
        title: p.packageType === 'ANNUAL' ? 'Annual' : p.packageType === 'MONTHLY' ? 'Monthly' : p.product.title,
        price: p.product.priceString,
        per: p.packageType === 'ANNUAL' ? '/year' : p.packageType === 'MONTHLY' ? '/month' : '',
        tag: p.packageType === 'ANNUAL' ? 'BEST VALUE' : null,
        pkg: p,
      }))
    : PLAN_FALLBACK;

  const buy = async (plan) => {
    if (!configured || !plan.pkg) {
      return Alert.alert(
        'Purchases not enabled yet',
        'Subscriptions activate before launch. Your 14-day free trial covers everything for now.'
      );
    }
    setBusyId(plan.id);
    try {
      const ok = await purchasePackage(plan.pkg);
      if (ok) {
        const s = await getSubscriptionStatus();
        if (s.active) { onSubscribed(); return; }
      }
      Alert.alert('Hmm', 'The purchase did not complete. No charge was made.');
    } catch (e) {
      if (!/cancel/i.test(e?.message || '')) Alert.alert('Purchase failed', e?.message || 'Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const restore = async () => {
    if (!configured) {
      return Alert.alert('Purchases not enabled yet', 'Restore will work once subscriptions are live.');
    }
    setRestoring(true);
    try {
      const r = await restorePurchases();
      if (r.active) { onSubscribed(); }
      else Alert.alert('No purchases found', r.error || 'No active CareCircle subscription on this Apple ID.');
    } finally {
      setRestoring(false);
    }
  };

  const open = (url) => Linking.openURL(url).catch(() => {});

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right', 'bottom']}>
      <ScrollView contentContainerStyle={[styles.screenBody, { flexGrow: 1 }]}>
        {mode === 'browse' && (
          <TouchableOpacity onPress={onClose} hitSlop={12} style={{ alignSelf: 'flex-end', padding: 8 }}>
            <Text style={styles.sheetClose}>✕</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.h1}>CareCircle Plus</Text>
        <Text style={styles.sub}>
          {mode === 'locked'
            ? 'Your free trial has ended. Subscribe to keep your whole family circle in sync.'
            : trialDaysLeft > 0
              ? `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} left in your free trial.`
              : 'One subscription covers your entire family circle.'}
        </Text>

        <Card>
          {[
            'Whole family circle — up to 8 members, one price',
            'Unlimited medications, visits, tasks & notes',
            'Medication dose reminders for everyone',
            'Appointment reminders 1 hour before',
            'Syncs instantly across all devices',
          ].map((b) => (
            <View key={b} style={styles.benefitRow}>
              <Text style={styles.benefitCheck}>✓</Text>
              <Text style={styles.benefitText}>{b}</Text>
            </View>
          ))}
        </Card>

        {plans.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => buy(p)}
            disabled={busyId !== null}
            style={[styles.planCard, p.tag && styles.planCardBest]}
          >
            {p.tag && <Text style={styles.planTag}>{p.tag}</Text>}
            <View style={styles.planRow}>
              <Text style={styles.planTitle}>{p.title}</Text>
              <Text style={styles.planPrice}>{p.price}<Text style={styles.planPer}>{p.per}</Text></Text>
            </View>
            {busyId === p.id && <ActivityIndicator color={C.primary} style={{ marginTop: 8 }} />}
          </TouchableOpacity>
        ))}

        <Btn title={restoring ? 'Restoring…' : 'Restore Purchases'} variant="ghost" onPress={restore} disabled={restoring} />

        <View style={styles.linkRow}>
          <TouchableOpacity onPress={() => open(STORE_URLS.privacy)}><Text style={styles.link}>Privacy Policy</Text></TouchableOpacity>
          <Text style={styles.linkDot}>·</Text>
          <TouchableOpacity onPress={() => open(STORE_URLS.terms)}><Text style={styles.link}>Terms of Use</Text></TouchableOpacity>
        </View>
        <Text style={styles.fine}>
          14-day free trial, then $7.99/month or $59.99/year. Payment is charged to your Apple ID at
          confirmation. Subscriptions auto-renew unless cancelled at least 24 hours before the end of
          the current period. Manage or cancel anytime in App Store account settings.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Circle tab
// ---------------------------------------------------------------------------

function CircleScreen({ circle, memberName, trialDaysLeft, subActive, onShowPlans, onLeave, onRefresh, refreshing }) {
  const copyCode = async () => {
    await Clipboard.setStringAsync(circle.code);
    Alert.alert('Copied', 'Invite code copied — text it to your family.');
  };
  const verse = verseOfTheDay();

  return (
    <ScreenShell onRefresh={onRefresh} refreshing={refreshing}>
      <Text style={styles.h2}>{circle.name}</Text>
      <Text style={styles.sub}>Everyone with the invite code sees the same meds, visits, tasks, notes & prayers.</Text>

      <Card style={styles.verseCard}>
        <Text style={styles.verseLabel}>A VERSE FOR CAREGIVERS</Text>
        <Text style={styles.verseText}>“{verse.text}”</Text>
        <Text style={styles.verseRef}>— {verse.ref} (KJV)</Text>
      </Card>

      <Card style={styles.codeCard}>
        <Text style={styles.codeLabel}>INVITE CODE</Text>
        <Text style={styles.code}>{circle.code}</Text>
        <Btn title="Copy code" variant="soft" onPress={copyCode} style={{ marginTop: 12 }} />
      </Card>

      <Text style={styles.sectionTitle}>Members ({circle.members.length}/{MAX_MEMBERS})</Text>
      {circle.members.map((m, i) => (
        <Card key={`${m.name}-${i}`} style={styles.rowCard}>
          <Text style={styles.avatar}>{m.name.charAt(0).toUpperCase()}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{m.name}{m.name === memberName ? ' (you)' : ''}</Text>
            <Text style={styles.rowSub}>Joined {fmtDateTime(m.joinedAt)}</Text>
          </View>
        </Card>
      ))}

      <Card>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>{subActive ? 'CareCircle Plus active' : 'Free trial'}</Text>
            <Text style={styles.rowSub}>
              {subActive ? 'Thank you for supporting the circle.' : `${trialDaysLeft} day${trialDaysLeft === 1 ? '' : 's'} remaining`}
            </Text>
          </View>
          <Btn title={subActive ? 'Manage' : 'View plans'} variant="soft" onPress={onShowPlans} />
        </View>
      </Card>

      <Btn title="Leave circle" variant="ghost" onPress={onLeave} style={{ marginTop: 8 }} />
      <Text style={styles.fine}>CareCircle is a family organizer, not a medical device. It does not provide medical advice — always follow your clinician's instructions.</Text>
    </ScreenShell>
  );
}

// ---------------------------------------------------------------------------
// Meds tab
// ---------------------------------------------------------------------------

function MedsScreen({ circle, memberName, mutate, onRefresh, refreshing }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [times, setTimes] = useState(2);
  const [notes, setNotes] = useState('');
  const [remind, setRemind] = useState(true);

  const today = todayStr();
  const taken = (medId, slot) => circle.doses.some((d) => d.medId === medId && d.date === today && d.slot === slot);

  const toggleDose = (med, slot) => {
    mutate((c) => {
      const existing = c.doses.find((d) => d.medId === med.id && d.date === today && d.slot === slot);
      const doses = existing
        ? c.doses.filter((d) => d.id !== existing.id)
        : [...c.doses, { id: uid(), medId: med.id, date: today, slot, by: memberName, at: new Date().toISOString() }];
      return { ...c, doses };
    });
  };

  const addMed = () => {
    const n = name.trim();
    if (!n) return Alert.alert('Medication name', 'Enter the medication name.');
    const med = { id: uid(), name: n, dosage: dosage.trim(), timesPerDay: times, notes: notes.trim() };
    mutate((c) => ({ ...c, meds: [...c.meds, med] }));
    if (remind) scheduleDoseReminders(med);
    setName(''); setDosage(''); setTimes(2); setNotes(''); setRemind(true);
    setShowAdd(false);
  };

  const deleteMed = (med) => {
    Alert.alert('Remove medication?', `"${med.name}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        cancelDoseReminders(med.id);
        mutate((c) => ({ ...c, meds: c.meds.filter((m) => m.id !== med.id), doses: c.doses.filter((d) => d.medId !== med.id) }));
      } },
    ]);
  };

  return (
    <ScreenShell onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.rowBetween}>
        <Text style={styles.h2}>Medications</Text>
        <Btn title="+ Add" onPress={() => setShowAdd(true)} style={{ paddingHorizontal: 18 }} />
      </View>
      <Text style={styles.sub}>Tap a circle to check off each dose. Everyone sees it instantly.</Text>

      {circle.meds.length === 0 && (
        <EmptyState icon="💊" title="No medications yet" hint="Add the first one — the whole circle will see it." />
      )}
      {circle.meds.map((med) => (
        <Card key={med.id}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{med.name}</Text>
              {!!med.dosage && <Text style={styles.rowSub}>{med.dosage} · {med.timesPerDay}×/day</Text>}
              {!med.dosage && <Text style={styles.rowSub}>{med.timesPerDay}×/day</Text>}
              {!!med.notes && <Text style={styles.noteText}>{med.notes}</Text>}
            </View>
            <TouchableOpacity onPress={() => deleteMed(med)} hitSlop={12} style={{ padding: 8 }}>
              <Text style={styles.delete}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.slotRow}>
            {Array.from({ length: med.timesPerDay }).map((_, i) => {
              const done = taken(med.id, i);
              return (
                <TouchableOpacity
                  key={i}
                  onPress={() => toggleDose(med, i)}
                  style={[styles.slot, done && styles.slotDone]}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.slotText, done && styles.slotTextDone]}>{done ? '✓' : `${i + 1}`}</Text>
                </TouchableOpacity>
              );
            })}
            <Text style={styles.slotHint}>Today</Text>
          </View>
        </Card>
      ))}

      <Text style={styles.fine}>CareCircle is not a medical device and does not provide medical advice. Always follow your clinician's instructions.</Text>

      <Sheet visible={showAdd} onClose={() => setShowAdd(false)} title="Add medication">
        <Field label="Medication name *" placeholder="Lisinopril" value={name} onChangeText={setName} />
        <Field label="Dosage" placeholder="10 mg" value={dosage} onChangeText={setDosage} />
        <Text style={styles.fieldLabel}>Times per day</Text>
        <View style={styles.stepper}>
          <TouchableOpacity onPress={() => setTimes(Math.max(1, times - 1))} style={styles.stepBtn}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
          <Text style={styles.stepVal}>{times}×</Text>
          <TouchableOpacity onPress={() => setTimes(Math.min(4, times + 1))} style={styles.stepBtn}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
        </View>
        <Field label="Notes" placeholder="With breakfast" value={notes} onChangeText={setNotes} />
        <TouchableOpacity onPress={() => setRemind(!remind)} style={styles.checkRow}>
          <Text style={[styles.checkbox, remind && styles.checkboxOn]}>{remind ? '✓' : ''}</Text>
          <Text style={styles.checkLabel}>Remind me at dose times</Text>
        </TouchableOpacity>
        <Btn title="Save medication" onPress={addMed} style={{ marginTop: 16 }} />
      </Sheet>
    </ScreenShell>
  );
}

// ---------------------------------------------------------------------------
// Visits tab
// ---------------------------------------------------------------------------

function VisitsScreen({ circle, mutate, onRefresh, refreshing }) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [who, setWho] = useState('');
  const [notes, setNotes] = useState('');

  const sorted = [...circle.appointments].sort((a, b) =>
    `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const today = todayStr();
  const upcoming = sorted.filter((a) => a.date >= today);
  const past = sorted.filter((a) => a.date < today).reverse();

  const addAppt = () => {
    const t = title.trim();
    if (!t) return Alert.alert('Title', 'Give the visit a title, e.g. "Dr. Patel — checkup".');
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) {
      return Alert.alert('Date format', 'Use YYYY-MM-DD, e.g. 2026-10-24.');
    }
    if (time && !/^\d{1,2}:\d{2}$/.test(time.trim())) {
      return Alert.alert('Time format', 'Use 24-hour HH:MM, e.g. 14:30.');
    }
    const appt = {
      id: uid(), title: t,
      date: date.trim(), time: time.trim(),
      location: location.trim(), who: who.trim(), notes: notes.trim(),
    };
    mutate((c) => ({ ...c, appointments: [...c.appointments, appt] }));
    scheduleAppointmentReminder(appt);
    setTitle(''); setDate(''); setTime(''); setLocation(''); setWho(''); setNotes('');
    setShowAdd(false);
  };

  const deleteAppt = (appt) => {
    Alert.alert('Remove visit?', `"${appt.title}" will be removed for everyone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        cancelAppointmentReminder(appt.id);
        mutate((c) => ({ ...c, appointments: c.appointments.filter((a) => a.id !== appt.id) }));
      } },
    ]);
  };

  const renderAppt = (a, dim) => (
    <Card key={a.id} style={dim && { opacity: 0.6 }}>
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{a.title}</Text>
          <Text style={styles.rowSub}>🗓 {a.date ? fmtDate(a.date) : 'No date'}{a.time ? ` · ${a.time}` : ''}</Text>
          {!!a.location && <Text style={styles.rowSub}>📍 {a.location}</Text>}
          {!!a.who && <Text style={styles.rowSub}>🚗 {a.who} taking them</Text>}
          {!!a.notes && <Text style={styles.noteText}>{a.notes}</Text>}
        </View>
        <TouchableOpacity onPress={() => deleteAppt(a)} hitSlop={12} style={{ padding: 8 }}>
          <Text style={styles.delete}>✕</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <ScreenShell onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.rowBetween}>
        <Text style={styles.h2}>Visits</Text>
        <Btn title="+ Add" onPress={() => setShowAdd(true)} style={{ paddingHorizontal: 18 }} />
      </View>
      <Text style={styles.sub}>Doctor visits and care appointments. Reminders fire 1 hour before.</Text>

      {sorted.length === 0 && (
        <EmptyState icon="🗓️" title="No visits scheduled" hint="Add the next appointment so nobody misses it." />
      )}
      {upcoming.length > 0 && <Text style={styles.sectionTitle}>Upcoming</Text>}
      {upcoming.map((a) => renderAppt(a, false))}
      {past.length > 0 && <Text style={styles.sectionTitle}>Past</Text>}
      {past.map((a) => renderAppt(a, true))}

      <Sheet visible={showAdd} onClose={() => setShowAdd(false)} title="Add visit">
        <Field label="Title *" placeholder="Dr. Patel — checkup" value={title} onChangeText={setTitle} />
        <Field label="Date" placeholder="2026-10-24 (YYYY-MM-DD)" value={date} onChangeText={setDate} keyboardType="numbers-and-punctuation" />
        <Field label="Time" placeholder="14:30 (24-hour)" value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" />
        <Field label="Location" placeholder="Riverside Clinic" value={location} onChangeText={setLocation} />
        <Field label="Who's taking them?" placeholder="Sarah" value={who} onChangeText={setWho} />
        <Field label="Notes" placeholder="Bring insurance card" value={notes} onChangeText={setNotes} />
        <Btn title="Save visit" onPress={addAppt} style={{ marginTop: 16 }} />
      </Sheet>
    </ScreenShell>
  );
}

// ---------------------------------------------------------------------------
// Tasks tab
// ---------------------------------------------------------------------------

function TasksScreen({ circle, mutate, onRefresh, refreshing }) {
  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');

  const sorted = [...circle.tasks].sort((a, b) => {
    if (!!a.done !== !!b.done) return a.done ? 1 : -1;
    return (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
  });

  const toggle = (t) => mutate((c) => ({
    ...c, tasks: c.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)),
  }));

  const addTask = () => {
    const t = title.trim();
    if (!t) return Alert.alert('Task', 'Describe the task.');
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate.trim())) {
      return Alert.alert('Date format', 'Use YYYY-MM-DD, e.g. 2026-10-24.');
    }
    mutate((c) => ({ ...c, tasks: [...c.tasks, { id: uid(), title: t, assignee: assignee.trim(), dueDate: dueDate.trim(), done: false }] }));
    setTitle(''); setAssignee(''); setDueDate('');
    setShowAdd(false);
  };

  const deleteTask = (t) => {
    mutate((c) => ({ ...c, tasks: c.tasks.filter((x) => x.id !== t.id) }));
  };

  return (
    <ScreenShell onRefresh={onRefresh} refreshing={refreshing}>
      <View style={styles.rowBetween}>
        <Text style={styles.h2}>Tasks</Text>
        <Btn title="+ Add" onPress={() => setShowAdd(true)} style={{ paddingHorizontal: 18 }} />
      </View>
      <Text style={styles.sub}>Who's doing what, by when. Assign it, get it done.</Text>

      {sorted.length === 0 && (
        <EmptyState icon="✅" title="Nothing to do" hint="Add the first task — pick up prescriptions, schedule a visit…" />
      )}
      {sorted.map((t) => (
        <Card key={t.id} style={t.done && { opacity: 0.65 }}>
          <View style={styles.taskRow}>
            <TouchableOpacity onPress={() => toggle(t)} style={[styles.checkbox, t.done && styles.checkboxOn]} hitSlop={8}>
              <Text style={[styles.checkText, t.done && styles.checkTextOn]}>{t.done ? '✓' : ''}</Text>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, t.done && styles.strike]}>{t.title}</Text>
              <Text style={styles.rowSub}>
                {[t.assignee ? `👤 ${t.assignee}` : null, t.dueDate ? `📅 ${fmtDate(t.dueDate)}` : null].filter(Boolean).join('  ') || 'No assignee'}
              </Text>
            </View>
            <TouchableOpacity onPress={() => deleteTask(t)} hitSlop={12} style={{ padding: 8 }}>
              <Text style={styles.delete}>✕</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ))}

      <Sheet visible={showAdd} onClose={() => setShowAdd(false)} title="Add task">
        <Field label="Task *" placeholder="Pick up prescriptions" value={title} onChangeText={setTitle} />
        <Field label="Assign to" placeholder="Sarah" value={assignee} onChangeText={setAssignee} />
        <Field label="Due date" placeholder="2026-10-24 (YYYY-MM-DD)" value={dueDate} onChangeText={setDueDate} keyboardType="numbers-and-punctuation" />
        <Btn title="Save task" onPress={addTask} style={{ marginTop: 16 }} />
      </Sheet>
    </ScreenShell>
  );
}

// ---------------------------------------------------------------------------
// Notes tab
// ---------------------------------------------------------------------------

function NotesScreen({ circle, memberName, mutate, onRefresh, refreshing }) {
  const [text, setText] = useState('');

  const post = () => {
    const t = text.trim();
    if (!t) return;
    mutate((c) => ({
      ...c,
      notes: [{ id: uid(), text: t, author: memberName, createdAt: new Date().toISOString() }, ...c.notes].slice(0, 1000),
    }));
    setText('');
  };

  return (
    <ScreenShell onRefresh={onRefresh} refreshing={refreshing}>
      <Text style={styles.h2}>Notes</Text>
      <Text style={styles.sub}>How's Mom today? Share updates the whole circle should see.</Text>

      <Card>
        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="Mom seemed tired today…"
          placeholderTextColor={C.muted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <Btn title="Post update" onPress={post} style={{ marginTop: 10 }} />
      </Card>

      {circle.notes.length === 0 && (
        <EmptyState icon="📝" title="No updates yet" hint="Post the first one — small observations help everyone." />
      )}
      {circle.notes.map((n) => (
        <Card key={n.id}>
          <Text style={styles.noteBody}>{n.text}</Text>
          <Text style={styles.noteMeta}>{n.author} · {timeAgo(n.createdAt)}</Text>
        </Card>
      ))}
    </ScreenShell>
  );
}

// ---------------------------------------------------------------------------
// Prayer tab — family prayer requests for the care recipient + praise reports
// ---------------------------------------------------------------------------

function PrayerScreen({ circle, memberName, mutate, onRefresh, refreshing }) {
  const [text, setText] = useState('');

  const addPrayer = () => {
    const t = text.trim();
    if (!t) return;
    mutate((c) => ({
      ...c,
      prayers: [
        { id: uid(), text: t, author: memberName, createdAt: new Date().toISOString(), prayedBy: [], answered: false },
        ...(c.prayers || []),
      ].slice(0, 500),
    }));
    setText('');
  };

  const togglePrayed = (p) => {
    mutate((c) => ({
      ...c,
      prayers: (c.prayers || []).map((x) => {
        if (x.id !== p.id) return x;
        const has = (x.prayedBy || []).includes(memberName);
        return { ...x, prayedBy: has ? x.prayedBy.filter((n) => n !== memberName) : [...(x.prayedBy || []), memberName] };
      }),
    }));
  };

  const toggleAnswered = (p) => {
    mutate((c) => ({
      ...c,
      prayers: (c.prayers || []).map((x) => (x.id === p.id ? { ...x, answered: !x.answered } : x)),
    }));
  };

  const deletePrayer = (p) => {
    mutate((c) => ({ ...c, prayers: (c.prayers || []).filter((x) => x.id !== p.id) }));
  };

  const prayers = circle.prayers || [];
  const open = prayers.filter((p) => !p.answered);
  const answered = prayers.filter((p) => p.answered);

  const renderPrayer = (p) => {
    const iPrayed = (p.prayedBy || []).includes(memberName);
    return (
      <Card key={p.id} style={p.answered && styles.answeredCard}>
        <Text style={styles.noteBody}>{p.text}</Text>
        <Text style={styles.noteMeta}>{p.author} · {timeAgo(p.createdAt)}</Text>
        <View style={[styles.rowBetween, { marginTop: 12 }]}>
          <TouchableOpacity
            onPress={() => togglePrayed(p)}
            style={[styles.prayBtn, iPrayed && styles.prayBtnOn]}
            activeOpacity={0.7}
          >
            <Text style={[styles.prayBtnText, iPrayed && styles.prayBtnTextOn]}>
              🙏 {(p.prayedBy || []).length} prayed
            </Text>
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <TouchableOpacity onPress={() => toggleAnswered(p)} hitSlop={10} style={{ padding: 8 }}>
              <Text style={[styles.answeredToggle, p.answered && styles.answeredToggleOn]}>
                {p.answered ? '★ Answered' : '☆ Mark answered'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => deletePrayer(p)} hitSlop={10} style={{ padding: 8 }}>
              <Text style={styles.delete}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>
        {(p.prayedBy || []).length > 0 && (
          <Text style={styles.prayedBy}>Prayed by {(p.prayedBy || []).join(', ')}</Text>
        )}
      </Card>
    );
  };

  return (
    <ScreenShell onRefresh={onRefresh} refreshing={refreshing}>
      <Text style={styles.h2}>Prayer</Text>
      <Text style={styles.sub}>Lift up your loved one together. Tap 🙏 when you've prayed.</Text>

      <Card>
        <TextInput
          style={[styles.input, styles.noteInput]}
          placeholder="Praying for Mom's surgery on Thursday…"
          placeholderTextColor={C.muted}
          value={text}
          onChangeText={setText}
          multiline
        />
        <Btn title="Share prayer request" onPress={addPrayer} style={{ marginTop: 10 }} />
      </Card>

      {prayers.length === 0 && (
        <EmptyState icon="🙏" title="No prayer requests yet" hint="Share the first one — there is strength in praying together." />
      )}
      {open.length > 0 && <Text style={styles.sectionTitle}>Prayer requests</Text>}
      {open.map(renderPrayer)}
      {answered.length > 0 && <Text style={styles.sectionTitle}>Answered — praise reports 🙌</Text>}
      {answered.map(renderPrayer)}
    </ScreenShell>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------

const Tab = createBottomTabNavigator();
const TAB_ICONS = { Circle: '👥', Meds: '💊', Visits: '🗓️', Tasks: '✅', Notes: '📝', Prayer: '🙏' };

// Caregiver encouragement — KJV (public domain). Rotates daily on the Circle tab.
const VERSES = [
  { text: 'Bear ye one another\u2019s burdens, and so fulfil the law of Christ.', ref: 'Galatians 6:2' },
  { text: 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.', ref: 'Isaiah 40:31' },
  { text: 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.', ref: 'Matthew 11:28' },
  { text: 'My grace is sufficient for thee: for my strength is made perfect in weakness.', ref: '2 Corinthians 12:9' },
  { text: 'God is our refuge and strength, a very present help in trouble.', ref: 'Psalm 46:1' },
  { text: 'I can do all things through Christ which strengtheneth me.', ref: 'Philippians 4:13' },
  { text: 'Be strong and of a good courage… for the LORD thy God is with thee whithersoever thou goest.', ref: 'Joshua 1:9' },
];
function verseOfTheDay() {
  const now = new Date();
  const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
  return VERSES[dayOfYear % VERSES.length];
}

export default function App() {
  const [booted, setBooted] = useState(false);
  const [circle, setCircle] = useState(null);
  const [memberName, setMemberName] = useState('');
  const [trialDaysLeft, setTrialDaysLeft] = useState(TRIAL_DAYS);
  const [trialExpired, setTrialExpired] = useState(false);
  const [subActive, setSubActive] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const circleRef = useRef(null);
  circleRef.current = circle;

  const persist = useCallback(async (next) => {
    try {
      await api(`/api/circle/${next.code}`, 'PUT', next);
    } catch (e) {
      console.warn('[sync] failed:', e.message);
    }
  }, []);

  const mutate = useCallback((fn) => {
    const next = fn(circleRef.current);
    if (!next) return;
    setCircle(next);
    persist(next);
  }, [persist]);

  const refresh = useCallback(async () => {
    const code = await AsyncStorage.getItem(CODE_KEY);
    if (!code) return;
    setRefreshing(true);
    try {
      const fresh = await api(`/api/circle/${code}`);
      setCircle(fresh);
    } catch (e) {
      console.warn('[refresh] failed:', e.message);
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Trial clock: starts on first launch, 14 days.
  const checkTrial = useCallback(async () => {
    let start = await AsyncStorage.getItem(TRIAL_KEY);
    if (!start) {
      start = new Date().toISOString();
      await AsyncStorage.setItem(TRIAL_KEY, start);
    }
    const days = (Date.now() - new Date(start).getTime()) / 86400000;
    setTrialDaysLeft(Math.max(0, Math.ceil(TRIAL_DAYS - days)));
    setTrialExpired(days >= TRIAL_DAYS);
  }, []);

  useEffect(() => {
    (async () => {
      await checkTrial();
      await configurePurchases();
      const s = await getSubscriptionStatus();
      setSubActive(s.active);
      const code = await AsyncStorage.getItem(CODE_KEY);
      const name = await AsyncStorage.getItem(NAME_KEY);
      if (code && name) {
        try {
          const c = await api(`/api/circle/${code}`);
          setCircle(c);
          setMemberName(name);
          registerForPushNotifications(); // best-effort
        } catch (e) {
          console.warn('[boot] circle load failed:', e.message);
          // Stale code (e.g. server restarted — MVP uses in-memory store)
          await AsyncStorage.removeItem(CODE_KEY);
        }
      }
      setBooted(true);
    })();
  }, [checkTrial]);

  const leave = () => {
    Alert.alert('Leave circle?', 'You will need the invite code to rejoin.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: async () => {
        await AsyncStorage.removeItem(CODE_KEY);
        setCircle(null);
      } },
    ]);
  };

  const onSubscribed = async () => {
    const s = await getSubscriptionStatus();
    setSubActive(s.active);
    setShowPlans(false);
    if (s.active) Alert.alert('Welcome to Plus 🎉', 'Your whole circle is covered.');
  };

  if (!booted) {
    return (
      <SafeAreaView style={[styles.screen, styles.center]}>
        <ActivityIndicator size="large" color={C.primary} />
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  const locked = !!circle && trialExpired && !subActive;

  if (!circle) {
    return (
      <>
        <OnboardingScreen onDone={(c, name) => { setCircle(c); setMemberName(name); }} />
        <StatusBar style="auto" />
      </>
    );
  }

  if (locked || showPlans) {
    return (
      <>
        <PaywallScreen
          mode={locked ? 'locked' : 'browse'}
          trialDaysLeft={trialDaysLeft}
          onClose={() => setShowPlans(false)}
          onSubscribed={onSubscribed}
        />
        <StatusBar style="auto" />
      </>
    );
  }

  const screenProps = { circle, memberName, mutate, onRefresh: refresh, refreshing };

  return (
    <>
      <NavigationContainer>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: C.primary,
            tabBarInactiveTintColor: C.muted,
            tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
            tabBarStyle: { height: 68, paddingBottom: 10, paddingTop: 6, backgroundColor: C.card, borderTopColor: C.border },
            tabBarIcon: () => <Text style={{ fontSize: 23 }}>{TAB_ICONS[route.name]}</Text>,
          })}
        >
          <Tab.Screen name="Circle">
            {() => <CircleScreen {...screenProps} trialDaysLeft={trialDaysLeft} subActive={subActive} onShowPlans={() => setShowPlans(true)} onLeave={leave} />}
          </Tab.Screen>
          <Tab.Screen name="Meds">{() => <MedsScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="Visits">{() => <VisitsScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="Tasks">{() => <TasksScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="Notes">{() => <NotesScreen {...screenProps} />}</Tab.Screen>
          <Tab.Screen name="Prayer">{() => <PrayerScreen {...screenProps} />}</Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  screenBody: { padding: 20, paddingBottom: 40 },
  h1: { fontSize: 34, fontWeight: '800', color: C.text, marginTop: 8 },
  h2: { fontSize: 26, fontWeight: '800', color: C.text },
  sub: { fontSize: 16, color: C.muted, marginTop: 6, marginBottom: 16, lineHeight: 22 },
  brand: { fontSize: 56, textAlign: 'center' },
  card: {
    backgroundColor: C.card, borderRadius: 18, padding: 18, marginBottom: 14,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#3A4A40', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: C.muted, textTransform: 'uppercase', letterSpacing: 1, marginTop: 10, marginBottom: 10 },
  btn: { borderRadius: 14, paddingVertical: 15, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', minHeight: 54 },
  btnText: { fontSize: 17, fontWeight: '700' },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 15, fontWeight: '600', color: C.text, marginBottom: 8 },
  input: {
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: C.text, minHeight: 54,
  },
  noteInput: { minHeight: 90, textAlignVertical: 'top' },
  empty: { alignItems: 'center', paddingVertical: 36 },
  emptyIcon: { fontSize: 44, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  emptyHint: { fontSize: 15, color: C.muted, marginTop: 6, textAlign: 'center' },
  fine: { fontSize: 13, color: C.muted, textAlign: 'center', marginTop: 16, lineHeight: 19 },
  modeRow: { flexDirection: 'row', backgroundColor: C.primarySoft, borderRadius: 14, padding: 4, marginVertical: 18 },
  modeBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  modeBtnActive: { backgroundColor: C.white, shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 16, fontWeight: '600', color: C.muted },
  modeBtnTextActive: { color: C.primaryDark },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rowCard: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  rowSub: { fontSize: 15, color: C.muted, marginTop: 3, lineHeight: 21 },
  avatar: {
    width: 46, height: 46, borderRadius: 23, backgroundColor: C.primarySoft,
    color: C.primaryDark, fontSize: 20, fontWeight: '800', textAlign: 'center',
    lineHeight: 46, marginRight: 14, overflow: 'hidden',
  },
  codeCard: { alignItems: 'center', backgroundColor: C.primarySoft, borderColor: C.primarySoft },
  verseCard: { backgroundColor: '#FFFDF6', borderColor: '#EADFC3' },
  verseLabel: { fontSize: 12, fontWeight: '800', color: C.gold, letterSpacing: 1.5, marginBottom: 8 },
  verseText: { fontSize: 17, color: C.text, lineHeight: 25, fontStyle: 'italic' },
  verseRef: { fontSize: 14, color: C.muted, marginTop: 8, fontWeight: '600' },
  prayBtn: {
    backgroundColor: C.primarySoft, borderRadius: 20, paddingVertical: 10, paddingHorizontal: 16,
    borderWidth: 1, borderColor: C.border, minHeight: 44, justifyContent: 'center',
  },
  prayBtnOn: { backgroundColor: C.primary, borderColor: C.primary },
  prayBtnText: { fontSize: 15, fontWeight: '700', color: C.primaryDark },
  prayBtnTextOn: { color: C.white },
  prayedBy: { fontSize: 13, color: C.muted, marginTop: 8, fontStyle: 'italic' },
  answeredCard: { backgroundColor: '#FFFDF6', borderColor: C.gold },
  answeredToggle: { fontSize: 14, color: C.muted, fontWeight: '600' },
  answeredToggleOn: { color: C.gold, fontWeight: '800' },
  codeLabel: { fontSize: 13, fontWeight: '700', color: C.muted, letterSpacing: 2 },
  code: { fontSize: 44, fontWeight: '800', color: C.primaryDark, letterSpacing: 8, marginTop: 6 },
  delete: { fontSize: 18, color: C.muted },
  noteText: { fontSize: 15, color: C.text, marginTop: 6, lineHeight: 21, fontStyle: 'italic' },
  noteBody: { fontSize: 17, color: C.text, lineHeight: 24 },
  noteMeta: { fontSize: 14, color: C.muted, marginTop: 8 },
  slotRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  slot: {
    width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', marginRight: 10, backgroundColor: C.bg,
  },
  slotDone: { backgroundColor: C.primary, borderColor: C.primary },
  slotText: { fontSize: 17, fontWeight: '700', color: C.muted },
  slotTextDone: { color: C.white },
  slotHint: { fontSize: 14, color: C.muted, marginLeft: 4 },
  stepper: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  stepBtn: {
    width: 54, height: 54, borderRadius: 27, backgroundColor: C.primarySoft,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 26, color: C.primaryDark, fontWeight: '700' },
  stepVal: { fontSize: 20, fontWeight: '800', color: C.text, marginHorizontal: 20, minWidth: 48, textAlign: 'center' },
  checkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  checkbox: {
    width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, marginRight: 12,
  },
  checkboxOn: { backgroundColor: C.primary, borderColor: C.primary },
  checkText: { fontSize: 18, color: C.muted },
  checkTextOn: { color: C.white, fontWeight: '800' },
  checkLabel: { fontSize: 16, color: C.text },
  taskRow: { flexDirection: 'row', alignItems: 'center' },
  strike: { textDecorationLine: 'line-through', color: C.muted },
  benefitRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  benefitCheck: { fontSize: 18, color: C.primary, fontWeight: '800', marginRight: 10 },
  benefitText: { fontSize: 16, color: C.text, flex: 1, lineHeight: 22 },
  planCard: { backgroundColor: C.card, borderRadius: 16, padding: 18, marginBottom: 12, borderWidth: 2, borderColor: C.border },
  planCardBest: { borderColor: C.primary, backgroundColor: C.primarySoft },
  planTag: { fontSize: 12, fontWeight: '800', color: C.white, backgroundColor: C.gold, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8, letterSpacing: 1 },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  planTitle: { fontSize: 19, fontWeight: '700', color: C.text },
  planPrice: { fontSize: 22, fontWeight: '800', color: C.primaryDark },
  planPer: { fontSize: 15, fontWeight: '500', color: C.muted },
  linkRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 18 },
  link: { fontSize: 15, color: C.primary, fontWeight: '600' },
  linkDot: { fontSize: 15, color: C.muted, marginHorizontal: 10 },
  sheet: { flex: 1, backgroundColor: C.bg },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  sheetTitle: { fontSize: 20, fontWeight: '800', color: C.text },
  sheetClose: { fontSize: 22, color: C.muted, fontWeight: '600' },
  sheetBody: { padding: 20, paddingBottom: 40 },
});
