/**
 * lib/notifications.js — push token registration + local reminders.
 *
 * CareCircle's core value is "don't miss a dose / don't miss a visit", so
 * reminders are local scheduled notifications (work offline, no server needed).
 *
 * - registerForPushNotifications(): asks permission, returns the Expo push
 *   token, caches it on-device. The token is kept for future remote push;
 *   MVP sends nothing to the backend (TODO when server-driven alerts land).
 * - scheduleDoseReminders(med): daily repeats at sensible default slots based
 *   on timesPerDay (1→8:00a, 2→8:00a/6:00p, 3→+1:00p, 4→+9:00p).
 * - scheduleAppointmentReminder(appt): one local notification 1 hour before.
 * - cancel* helpers clean up when a med/visit is edited or deleted.
 *
 * All scheduling is best-effort and wrapped in try/catch — the app works
 * fine with notifications denied.
 */

import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const TOKEN_KEY = '@carecircle:pushToken';
const idsKey = (kind, id) => `@carecircle:notif:${kind}:${id}`;

// Sensible default dose slots by doses-per-day
const DOSE_SLOTS = ['08:00', '13:00', '18:00', '21:00'];

async function setupAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'CareCircle reminders',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
  }
}

export async function registerForPushNotifications() {
  try {
    await setupAndroidChannel();
    if (!Device.isDevice) {
      console.log('[notifications] push tokens need a physical device');
      return null;
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') {
      console.log('[notifications] permission not granted');
      return null;
    }
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    await AsyncStorage.setItem(TOKEN_KEY, token);
    // TODO: POST token to backend when remote (server-driven) push lands.
    return token;
  } catch (e) {
    console.warn('[notifications] registration failed:', e?.message || e);
    return null;
  }
}

async function saveIds(kind, id, ids) {
  await AsyncStorage.setItem(idsKey(kind, id), JSON.stringify(ids));
}

async function loadIds(kind, id) {
  try {
    return JSON.parse((await AsyncStorage.getItem(idsKey(kind, id))) || '[]');
  } catch {
    return [];
  }
}

async function cancelIds(kind, id) {
  const ids = await loadIds(kind, id);
  for (const nid of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(nid);
    } catch {
      /* already gone */
    }
  }
  await AsyncStorage.removeItem(idsKey(kind, id));
}

const DAILY = Notifications.SchedulableTriggerInputTypes?.DAILY || 'daily';
const DATE = Notifications.SchedulableTriggerInputTypes?.DATE || 'date';

/** Schedule daily dose reminders for a med. med: { id, name, dosage, timesPerDay } */
export async function scheduleDoseReminders(med) {
  try {
    await cancelIds('med', med.id);
    const count = Math.min(Math.max(parseInt(med.timesPerDay, 10) || 1, 1), 4);
    const ids = [];
    for (let i = 0; i < count; i++) {
      const [hour, minute] = DOSE_SLOTS[i].split(':').map(Number);
      const nid = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Medication reminder',
          body: `Time for ${med.name}${med.dosage ? ` (${med.dosage})` : ''}`,
          data: { kind: 'dose', medId: med.id, slot: i },
        },
        trigger: { type: DAILY, hour, minute },
      });
      ids.push(nid);
    }
    await saveIds('med', med.id, ids);
    return ids;
  } catch (e) {
    console.warn('[notifications] dose schedule failed:', e?.message || e);
    return [];
  }
}

export async function cancelDoseReminders(medId) {
  await cancelIds('med', medId);
}

/**
 * Schedule a reminder 1 hour before an appointment.
 * appt: { id, title, date: 'YYYY-MM-DD', time: 'HH:MM' (24h) or '' }
 */
export async function scheduleAppointmentReminder(appt) {
  try {
    await cancelIds('appt', appt.id);
    if (!appt.date || !appt.time) return null;
    const [h, m] = appt.time.split(':').map(Number);
    if (Number.isNaN(h)) return null;
    const [y, mo, d] = appt.date.split('-').map(Number);
    const at = new Date(y, (mo || 1) - 1, d || 1, h, m || 0, 0);
    at.setHours(at.getHours() - 1);
    if (at.getTime() <= Date.now()) return null; // already passed
    const nid = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Upcoming visit',
        body: `${appt.title} in 1 hour${appt.location ? ` — ${appt.location}` : ''}`,
        data: { kind: 'appointment', apptId: appt.id },
      },
      trigger: { type: DATE, date: at },
    });
    await saveIds('appt', appt.id, [nid]);
    return nid;
  } catch (e) {
    console.warn('[notifications] appointment schedule failed:', e?.message || e);
    return null;
  }
}

export async function cancelAppointmentReminder(apptId) {
  await cancelIds('appt', apptId);
}
