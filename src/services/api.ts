import type {
  FoodItem,
  ExerciseItem,
  UserProfile,
  SavedFood,
  SavedRecipe,
  MealTemplate,
  WeekPlan,
  UserStats,
  WeightRecord,
  MealType,
  BodyMeasurement,
  ProgressPhoto,
  DailyHabitLog,
  CravingLog,
  NonScaleVictory,
  PantryItem,
  FriendRecord,
  SharedRecipeRecord,
  CommunityPost,
  CommunityReply,
  ReportedPostRecord
} from '../types/index.js';
import { standaloneFetch } from './standaloneBackend.js';
import { getClientDeviceFingerprint, timingSafeEqualString } from '../utils/validation.js';

function getDeviceMetadata() {
  const fp = getClientDeviceFingerprint();
  return {
    ...fp,
    rawFingerprint: `${fp.userAgent}|${fp.screenSize}|${fp.timezone}|${fp.language}|${fp.platform}`,
    deviceName: fp.platform || 'Web Browser'
  };
}

const TOKEN_KEY = 'forkcount_session_token';
const OLD_TOKEN_KEY = 'caloriq_session_token';
const GUEST_KEY = 'forkcount_guest_id';
const OLD_GUEST_KEY = 'caloriq_guest_id';
const OFFLINE_QUEUE_KEY = 'forkcount_offline_queue';
const OLD_OFFLINE_QUEUE_KEY = 'caloriq_offline_queue';
const CLIENT_USERS_KEY = 'forkcount_client_users';
const OLD_CLIENT_USERS_KEY = 'caloriq_client_users';
const USER_EMAIL_KEY = 'forkcount_user_email';
const OLD_USER_EMAIL_KEY = 'caloriq_user_email';
export const DEV_DEVICE_KEY = 'forkcount_dev_device';
export const OLD_DEV_DEVICE_KEY = 'calory_dev_device';

export function getBrowserDevSignature(): string {
  if (typeof navigator === 'undefined') return 'server';
  return `${navigator.userAgent || ''}::${navigator.platform || ''}`;
}

export function getStoredDevDeviceRecord(): {
  matchesBrowser: boolean;
  deviceToken: string;
  browserSig: string;
} | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEV_DEVICE_KEY) || localStorage.getItem(OLD_DEV_DEVICE_KEY);
    if (raw === null) return null;
    const currentSig = getBrowserDevSignature();
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          matchesBrowser: true,
          deviceToken: String(parsed.deviceToken || 'dev_trusted_device'),
          browserSig: currentSig
        };
      }
    } catch {
      // Plain string stored in localStorage
    }
    return {
      matchesBrowser: true,
      deviceToken: raw || 'dev_trusted_device',
      browserSig: currentSig
    };
  } catch {
    return null;
  }
}

interface ClientUserRecord {
  userId: string;
  email: string;
  passwordHash: string;
  createdAt: number;
}

function hashClientPassword(password: string): string {
  let h1 = 0xdeadbeef ^ password.length;
  let h2 = 0x41c6ce57 ^ password.length;
  const salted = `forkcount_client_${password}`;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function getEmptyClientProfile(name: string = '', username: string = ''): UserProfile {
  return {
    name,
    username,
    age: 0,
    gender: '',
    heightCm: 0,
    fitnessLevel: '',
    currentWeightKg: 0,
    goalWeightKg: 0,
    dailyActivity: '',
    goalSpeed: '',
    unitSystem: 'metric',
    pinnedWhy: '',
    themeMode: 'dark',
    streakFreezesUsed: [],
    waterReminderEnabled: false,
    mealReminderEnabled: false,
    streakOptIn: true,
    waterChallengeJoined: false
  };
}

function getClientUsers(): Record<string, ClientUserRecord> {
  try {
    const raw = localStorage.getItem(CLIENT_USERS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveClientUsers(users: Record<string, ClientUserRecord>) {
  localStorage.setItem(CLIENT_USERS_KEY, JSON.stringify(users));
}

interface QueuedRequest {
  id: string;
  endpoint: string;
  method: string;
  body?: any;
  timestamp: number;
}

class ApiService {
  private token: string | null = null;
  private sse: EventSource | null = null;
  private syncListeners: Array<() => void> = [];
  private saveStatusListeners: Array<(status: 'saved' | 'saving' | 'error') => void> = [];
  private conflictListeners: Array<(date?: string) => void> = [];
  private activeSaves = 0;
  private lastLocalMutationAt = 0;
  private tabId = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  constructor() {
    if (typeof localStorage !== 'undefined') {
      const savedEmail = localStorage.getItem(USER_EMAIL_KEY) || localStorage.getItem(OLD_USER_EMAIL_KEY);
      const savedTok =
        localStorage.getItem(TOKEN_KEY) ||
        localStorage.getItem(OLD_TOKEN_KEY) ||
        sessionStorage.getItem(TOKEN_KEY) ||
        sessionStorage.getItem(OLD_TOKEN_KEY);
      const hasDevDevice =
        localStorage.getItem(DEV_DEVICE_KEY) !== null || localStorage.getItem(OLD_DEV_DEVICE_KEY) !== null;
      const isBrokenDevGuest =
        savedTok === 'usr_caloriq_1b085' ||
        savedTok === 'usr_caloriq_a3c1a' ||
        savedTok === 'usr_caloriq_guest' ||
        savedTok === 'guest_1b0855e1-da9d-44ec-9164-cc628775ff48' ||
        savedTok === 'guest_a3c1aeb5-270f-494b-9b94-4d5b505e8d5f' ||
        savedEmail === 'caloriq_1b085' ||
        savedEmail === 'caloriq_a3c1a' ||
        savedEmail === 'caloriq_guest' ||
        savedEmail === 'housefly';

      if (hasDevDevice || isBrokenDevGuest) {
        if (!hasDevDevice) {
          const devRec = JSON.stringify({
            username: 'housefly',
            deviceToken: `dev_${Date.now().toString(36)}`,
            browserSig: getBrowserDevSignature(),
            lockedAt: Date.now()
          });
          localStorage.setItem(DEV_DEVICE_KEY, devRec);
          localStorage.setItem(OLD_DEV_DEVICE_KEY, devRec);
        }
        localStorage.setItem(TOKEN_KEY, 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18');
        localStorage.setItem(OLD_TOKEN_KEY, 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18');
        localStorage.setItem(USER_EMAIL_KEY, 'housefly');
        localStorage.setItem(OLD_USER_EMAIL_KEY, 'housefly');
        localStorage.removeItem(GUEST_KEY);
        localStorage.removeItem(OLD_GUEST_KEY);
      }
    }
    const savedToken =
      localStorage.getItem(TOKEN_KEY) ||
      localStorage.getItem(OLD_TOKEN_KEY) ||
      sessionStorage.getItem(TOKEN_KEY) ||
      sessionStorage.getItem(OLD_TOKEN_KEY);
    this.token = savedToken && savedToken !== 'undefined' && savedToken !== 'null' ? savedToken : null;
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.flushOfflineQueue();
      });
      window.addEventListener('storage', (e) => {
        if ((e.key === 'forkcount_last_mutation' || e.key === 'caloriq_last_mutation') && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue);
            if (parsed.tabId !== this.tabId && parsed.token && timingSafeEqualString(parsed.token, this.token)) {
              this.notifyConflict(parsed.date);
            }
          } catch {
            // ignore
          }
        }
      });
    }
  }

  getToken(): string | null {
    return this.token;
  }

  setToken(token: string, isGuest: boolean, _rememberMe: boolean = true) {
    if (!token || token === 'undefined' || token === 'null') return;
    this.token = token;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(OLD_TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(OLD_TOKEN_KEY);
    if (isGuest) {
      localStorage.setItem(GUEST_KEY, token);
      localStorage.setItem(OLD_GUEST_KEY, token);
    } else {
      localStorage.removeItem(GUEST_KEY);
      localStorage.removeItem(OLD_GUEST_KEY);
    }
    this.initSse();
  }

  getGuestId(): string | null {
    return localStorage.getItem(GUEST_KEY) || localStorage.getItem(OLD_GUEST_KEY);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(OLD_TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(OLD_TOKEN_KEY);
    localStorage.removeItem(GUEST_KEY);
    localStorage.removeItem(OLD_GUEST_KEY);
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
  }

  logout() {
    if (this.token && !this.token.startsWith('guest_')) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'X-Device-Meta': JSON.stringify(getDeviceMetadata())
        },
        body: JSON.stringify({ deviceMeta: getDeviceMetadata() })
      }).catch(() => {});
    }
    localStorage.removeItem(USER_EMAIL_KEY);
    localStorage.removeItem(OLD_USER_EMAIL_KEY);
    this.clearToken();
  }

  endGuestSession() {
    // Keep guest data on the device; only end the active session view
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_EMAIL_KEY);
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
  }

  getOfflineQueue(): QueuedRequest[] {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private enqueueOffline(endpoint: string, method: string, body?: any) {
    const queue = this.getOfflineQueue();
    queue.push({
      id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      endpoint,
      method,
      body,
      timestamp: Date.now()
    });
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }

  async flushOfflineQueue(): Promise<number> {
    const queue = this.getOfflineQueue();
    if (queue.length === 0) return 0;

    let synced = 0;
    const remaining: QueuedRequest[] = [];

    for (const item of queue) {
      try {
        await this.request(item.endpoint, {
          method: item.method,
          body: item.body ? JSON.stringify(item.body) : undefined
        }, true);
        synced++;
      } catch {
        remaining.push(item);
      }
    }

    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    if (synced > 0) {
      this.triggerSync();
    }
    return synced;
  }

  onSync(listener: () => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }

  onSaveStatusChange(listener: (status: 'saved' | 'saving' | 'error') => void): () => void {
    this.saveStatusListeners.push(listener);
    return () => {
      this.saveStatusListeners = this.saveStatusListeners.filter(l => l !== listener);
    };
  }

  private notifySaveStatus(status: 'saved' | 'saving' | 'error') {
    for (const listener of this.saveStatusListeners) {
      listener(status);
    }
  }

  onSyncConflict(listener: (date?: string) => void): () => void {
    this.conflictListeners.push(listener);
    return () => {
      this.conflictListeners = this.conflictListeners.filter(l => l !== listener);
    };
  }

  private notifyConflict(date?: string) {
    for (const listener of this.conflictListeners) {
      listener(date);
    }
  }

  private triggerSync() {
    for (const listener of this.syncListeners) {
      listener();
    }
  }

  initSse() {
    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
    if (!this.token) return;
    if (typeof window !== 'undefined' && window.location.protocol === 'file:') return;

    try {
      this.sse = new EventSource(`/api/sync/events?token=${encodeURIComponent(this.token)}`);
      this.sse.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'sync') {
            if (Date.now() - this.lastLocalMutationAt > 1500) {
              const conflictDate = data.payload?.date || data.payload?.targetDate;
              this.notifyConflict(conflictDate);
            }
            this.triggerSync();
          }
        } catch (e) {
          // ignore parsing error
        }
      };
      this.sse.onerror = () => {
        // SSE auto reconnects
      };
    } catch (e) {
      console.warn('SSE connection failed', e);
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}, skipQueue: boolean = false): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const isSaveMutation =
      (method === 'POST' || method === 'PUT' || method === 'DELETE') &&
      !endpoint.startsWith('/api/auth/') &&
      !endpoint.startsWith('/api/ai/') &&
      !endpoint.startsWith('/api/usda/') &&
      !endpoint.startsWith('/api/recipes/parse-line');

    if (isSaveMutation) {
      this.lastLocalMutationAt = Date.now();
      this.activeSaves++;
      this.notifySaveStatus('saving');
    }

    const savedUserEmail =
      typeof localStorage !== 'undefined' ? localStorage.getItem(USER_EMAIL_KEY) || '' : '';

    if (!this.token && typeof localStorage !== 'undefined') {
      const storedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (storedToken && storedToken !== 'undefined' && storedToken !== 'null') {
        this.token = storedToken;
      }
    }

    if (
      savedUserEmail &&
      !savedUserEmail.startsWith('guest_') &&
      !/^caloriq_[a-z0-9_]+$/i.test(savedUserEmail.trim()) &&
      (!this.token || this.token.startsWith('guest_'))
    ) {
      const upgradedToken =
        savedUserEmail.toLowerCase().trim().replace(/^@/, '') === 'housefly'
          ? 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18'
          : `usr_${savedUserEmail.toLowerCase().trim().replace(/[^a-z0-9]/gi, '_')}`;
      this.setToken(upgradedToken, false, true);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Device-Meta': JSON.stringify(getDeviceMetadata()),
      ...(savedUserEmail ? { 'X-User-Email': savedUserEmail } : {}),
      ...(options.headers as Record<string, string>)
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let res: Response;
    try {
      res = await standaloneFetch(endpoint, {
        ...options,
        headers
      });
    } catch (networkErr: any) {
      if (isSaveMutation) {
        this.activeSaves = Math.max(0, this.activeSaves - 1);
      }
      if (endpoint.startsWith('/api/ai/')) {
        throw new Error('The AI is busy. Try again in a minute, or use Manual entry.');
      }
      // Offline mode fallback for POST/PUT/DELETE mutations (excluding auth)
      if (!skipQueue && !endpoint.startsWith('/api/auth/') && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
        const parsedBody = options.body ? JSON.parse(String(options.body)) : undefined;
        this.enqueueOffline(endpoint, method, parsedBody);
        if (isSaveMutation && this.activeSaves === 0) {
          this.notifySaveStatus('saved');
        }
        return {
          ...parsedBody,
          id: `offline_${Date.now()}`,
          userId: this.token || 'guest',
          createdAt: Date.now(),
          offlineQueued: true,
          success: true
        } as unknown as T;
      }
      if (isSaveMutation) {
        this.notifySaveStatus('error');
      }
      throw new Error(
        "Can't reach the server right now. Your data is saved on this device and will sync when you're back online."
      );
    }

    if (!res.ok) {
      if (isSaveMutation) {
        this.activeSaves = Math.max(0, this.activeSaves - 1);
        this.notifySaveStatus('error');
      }
      if (endpoint.startsWith('/api/ai/')) {
        throw new Error('The AI is busy. Try again in a minute, or use Manual entry.');
      }
      const err = await res.json().catch(() => ({ error: res.statusText }));
      const customErr: any = new Error(err.error || `Request failed with status ${res.status}`);
      customErr.reason = err.reason;
      customErr.attemptsRemaining = err.attemptsRemaining;
      customErr.retryAfterSeconds = err.retryAfterSeconds;
      throw customErr;
    }

    const result = await res.json();
    if (isSaveMutation) {
      this.activeSaves = Math.max(0, this.activeSaves - 1);
      if (this.activeSaves === 0) {
        this.notifySaveStatus('saved');
      }
      try {
        const parsedBody = options.body ? JSON.parse(String(options.body)) : undefined;
        const mutPayload = JSON.stringify({
          tabId: this.tabId,
          token: this.token,
          date: parsedBody?.date,
          ts: Date.now()
        });
        localStorage.setItem('forkcount_last_mutation', mutPayload);
      } catch {
        // ignore
      }
    }
    return result;
  }

  // Auth
  private getLocalProfile(userId: string, email?: string): UserProfile {
    try {
      const raw = localStorage.getItem(`forkcount_local_profile_${userId}`) || localStorage.getItem(`caloriq_local_profile_${userId}`);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    const baseName = email ? '' : 'Guest User';
    const baseUser = email ? email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase() : `forkcount_${userId.slice(0, 6)}`;
    return getEmptyClientProfile(baseName, baseUser);
  }

  private saveLocalProfile(userId: string, profile: UserProfile) {
    try {
      const json = JSON.stringify(profile);
      localStorage.setItem(`forkcount_local_profile_${userId}`, json);
    } catch {
      // ignore
    }
  }

  async tryDevDeviceAutoLogin(): Promise<boolean> {
    const devRecord = getStoredDevDeviceRecord();
    if (!devRecord) {
      return false;
    }
    const fallbackId = 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18';
    try {
      const res = await standaloneFetch('/api/auth/dev-auto-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceToken: devRecord.deviceToken,
          browserSig: devRecord.browserSig
        })
      });
      if (res.ok) {
        const data = await res.json();
        const token = data?.token || data?.userId || fallbackId;
        localStorage.setItem(USER_EMAIL_KEY, 'housefly');
        sessionStorage.removeItem('forkcount_is_first_session');
        sessionStorage.removeItem('caloriq_is_first_session');
        localStorage.setItem('forkcount_last_signed_in_at', new Date().toISOString());
        localStorage.setItem('forkcount_signup_complete', 'true');
        localStorage.setItem(`forkcount_signup_complete_${token}`, 'true');
        this.setToken(token, false, true);
        return true;
      }
    } catch {
      // ignore
    }
    localStorage.setItem(USER_EMAIL_KEY, 'housefly');
    sessionStorage.removeItem('forkcount_is_first_session');
    sessionStorage.removeItem('caloriq_is_first_session');
    localStorage.setItem('forkcount_signup_complete', 'true');
    this.setToken(fallbackId, false, true);
    return true;
  }

  async verifyStoredSessionOnLoad(): Promise<{
    hasValidToken: boolean;
    devAccountExists: boolean;
    needsOneTimeSetup: boolean;
  }> {
    if (localStorage.getItem(DEV_DEVICE_KEY) !== null) {
      const ok = await this.tryDevDeviceAutoLogin();
      if (ok) {
        return { hasValidToken: true, devAccountExists: true, needsOneTimeSetup: false };
      }
    }

    const storedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
    if (storedToken && storedToken !== 'undefined' && storedToken !== 'null' && !storedToken.startsWith('guest_')) {
      this.setToken(storedToken, false, true);
      try {
        const me = await this.request<{
          userId: string;
          username?: string;
          email?: string;
          isGuest: boolean;
          isDev?: boolean;
          lastSignedInAt?: string | number | null;
        }>('/api/auth/me', {}, true);
        if (me && me.userId && !me.isGuest) {
          if (me.username || me.email) {
            localStorage.setItem(USER_EMAIL_KEY, me.username || me.email || '');
          }
          const isFirstSession =
            sessionStorage.getItem('forkcount_is_first_session') === 'true' ||
            sessionStorage.getItem('caloriq_is_first_session') === 'true';
          if (me.lastSignedInAt && !isFirstSession) {
            const num = Number(me.lastSignedInAt);
            const d = !Number.isNaN(num) && num > 0 ? new Date(num) : new Date(String(me.lastSignedInAt));
            if (!Number.isNaN(d.getTime())) {
              localStorage.setItem('forkcount_last_signed_in_at', d.toISOString());
              localStorage.setItem('caloriq_last_signed_in_at', d.toISOString());
            }
          }
          return { hasValidToken: true, devAccountExists: true, needsOneTimeSetup: false };
        }
      } catch {
        return { hasValidToken: true, devAccountExists: true, needsOneTimeSetup: false };
      }
    }

    const devRes = await this.checkDevDeviceOnLoad();
    if (devRes.autoSignedIn) {
      return { hasValidToken: true, devAccountExists: true, needsOneTimeSetup: false };
    }
    return {
      hasValidToken: false,
      devAccountExists: devRes.devAccountExists,
      needsOneTimeSetup: devRes.needsOneTimeSetup
    };
  }

  async checkDevDeviceOnLoad(): Promise<{
    autoSignedIn: boolean;
    devAccountExists: boolean;
    needsOneTimeSetup: boolean;
  }> {
    const devRecord = getStoredDevDeviceRecord();
    if (devRecord) {
      const ok = await this.tryDevDeviceAutoLogin();
      return { autoSignedIn: ok, devAccountExists: true, needsOneTimeSetup: false };
    }

    try {
      const res = await standaloneFetch(`/api/auth/dev-status?t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache'
        }
      });
      if (res.ok) {
        const data = await res.json();
        const devAccountExists = Boolean(
          data.exists ||
            data.devUserExists ||
            data.isSetupComplete ||
            (String(data.username || '').toLowerCase() === 'housefly' && data.isDev === true)
        );
        return {
          autoSignedIn: false,
          devAccountExists,
          needsOneTimeSetup: !devAccountExists
        };
      }
    } catch {
      // ignore
    }
    return { autoSignedIn: false, devAccountExists: true, needsOneTimeSetup: false };
  }

  async setupDevAccount(password: string): Promise<{
    userId: string;
    username: string;
    token: string;
    isDev: boolean;
  }> {
    const browserSig = getBrowserDevSignature();
    const rand =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    const deviceToken = `dev_${rand}`;
    const guestId = this.getGuestId();

    const res = await standaloneFetch('/api/auth/dev-setup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Device-Meta': JSON.stringify(getDeviceMetadata())
      },
      body: JSON.stringify({
        password,
        deviceToken,
        browserSig,
        guestId
      })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: 'Could not set up dev account.' }));
      throw new Error(errBody.error || 'Could not set up dev account.');
    }

    const data = await res.json();
    localStorage.setItem(
      DEV_DEVICE_KEY,
      JSON.stringify({
        username: 'housefly',
        deviceToken: data.deviceToken || deviceToken,
        browserSig,
        lockedAt: Date.now()
      })
    );
    localStorage.setItem(USER_EMAIL_KEY, 'housefly');
    sessionStorage.removeItem('forkcount_is_first_session');
    sessionStorage.removeItem('caloriq_is_first_session');
    localStorage.setItem('forkcount_last_signed_in_at', new Date().toISOString());
    localStorage.setItem('caloriq_last_signed_in_at', new Date().toISOString());
    localStorage.setItem('forkcount_signup_complete', 'true');
    localStorage.setItem('caloriq_signup_complete', 'true');
    localStorage.setItem(`forkcount_signup_complete_${data.userId}`, 'true');
    localStorage.setItem(`caloriq_signup_complete_${data.userId}`, 'true');
    this.setToken(data.token, false, true);
    return data;
  }

  async initSession(): Promise<{ userId: string; username?: string; email?: string; isGuest: boolean; isDev?: boolean; profile: UserProfile; stats: UserStats }> {
    const defaultStats: UserStats = { xp: 0, level: 1, badges: [], foodStreak: 0, workoutStreak: 0 };

    // If calory_dev_device exists on this device, sign in as @housefly automatically and skip guest mode
    if (localStorage.getItem(DEV_DEVICE_KEY) !== null) {
      await this.tryDevDeviceAutoLogin();
    } else {
      const existingStoredToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (existingStoredToken && existingStoredToken !== 'undefined' && existingStoredToken !== 'null') {
        this.token = existingStoredToken;
        localStorage.setItem(TOKEN_KEY, existingStoredToken);
      }
    }

    if (!this.token) {
      try {
        const guestRes = await this.request<{ userId: string; isGuest: boolean; token: string }>('/api/auth/guest', {
          method: 'POST'
        }, true);
        this.setToken(guestRes.token, true);
      } catch {
        const localGuestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        this.setToken(localGuestId, true);
        const profile = this.getLocalProfile(localGuestId);
        return { userId: localGuestId, isGuest: true, isDev: false, profile, stats: defaultStats };
      }
    }

    try {
      const me = await this.request<{ userId: string; username?: string; email?: string; isGuest: boolean; isDev?: boolean; lastSignedInAt?: string | number | null; profile: UserProfile; stats: UserStats }>('/api/auth/me', {}, true);
      const localProf = this.getLocalProfile(me.userId, me.username || me.email);
      const isDev = Boolean(me.isDev === true && me.profile?.isDev !== false);
      const mergedProfile: UserProfile =
        localProf?.signupComplete && !me.profile?.signupComplete
          ? { ...me.profile, ...localProf, signupComplete: true, isDev }
          : { ...localProf, ...me.profile, isDev };
      if (isDev) {
        mergedProfile.username = 'housefly';
        mergedProfile.isDev = true;
        me.username = 'housefly';
        me.email = me.email || 'housefly';
        me.isGuest = false;
      } else {
        localStorage.removeItem(DEV_DEVICE_KEY);
      }
      me.profile = mergedProfile;
      me.isDev = isDev;
      this.saveLocalProfile(me.userId, mergedProfile);
      if (!me.isGuest && (me.username || me.email)) {
        localStorage.setItem(USER_EMAIL_KEY, me.username || me.email || '');
      }
      if (!me.isGuest) {
        const isFirstSession =
          sessionStorage.getItem('forkcount_is_first_session') === 'true' ||
          sessionStorage.getItem('caloriq_is_first_session') === 'true';
        const currentRaw =
          localStorage.getItem('forkcount_last_signed_in_at') || localStorage.getItem('caloriq_last_signed_in_at');
        if (me.lastSignedInAt && !isFirstSession) {
          const num = Number(me.lastSignedInAt);
          const d = !Number.isNaN(num) && num > 0 ? new Date(num) : new Date(String(me.lastSignedInAt));
          if (!Number.isNaN(d.getTime())) {
            localStorage.setItem('forkcount_last_signed_in_at', d.toISOString());
            localStorage.setItem('caloriq_last_signed_in_at', d.toISOString());
          }
        } else if (currentRaw && currentRaw !== 'first_session') {
          const num = Number(currentRaw);
          const d = !Number.isNaN(num) && num > 0 ? new Date(num) : new Date(currentRaw);
          if (!Number.isNaN(d.getTime())) {
            localStorage.setItem('forkcount_last_signed_in_at', d.toISOString());
            localStorage.setItem('caloriq_last_signed_in_at', d.toISOString());
          } else {
            localStorage.removeItem('forkcount_last_signed_in_at');
            localStorage.removeItem('caloriq_last_signed_in_at');
          }
        }
      }
      this.initSse();
      return me;
    } catch (e) {
      // Never overwrite a valid non-guest user session token on network/transient errors
      const savedEmail = localStorage.getItem(USER_EMAIL_KEY) || undefined;
      if (this.token && !this.token.startsWith('guest_')) {
        const profile = this.getLocalProfile(this.token, savedEmail);
        const isDev = Boolean(profile.isDev === true);
        return {
          userId: this.token,
          username: savedEmail,
          email: savedEmail,
          isGuest: false,
          isDev,
          profile: { ...profile, isDev },
          stats: defaultStats
        };
      }

      this.clearToken();
      try {
        const guestRes = await this.request<{ userId: string; isGuest: boolean; token: string }>('/api/auth/guest', {
          method: 'POST'
        }, true);
        this.setToken(guestRes.token, true);
        const me = await this.request<{ userId: string; username?: string; email?: string; isGuest: boolean; isDev?: boolean; profile: UserProfile; stats: UserStats }>('/api/auth/me', {}, true);
        this.initSse();
        return me;
      } catch {
        const localGuestId = `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        this.setToken(localGuestId, true);
        const profile = this.getLocalProfile(localGuestId);
        return { userId: localGuestId, isGuest: true, isDev: false, profile, stats: defaultStats };
      }
    }
  }

  async sendSignupVerificationCode(
    email: string,
    password: string,
    honeypot?: string,
    isResend?: boolean
  ): Promise<{ sent: boolean; resendCooldownSeconds: number }> {
    const cleanEmail = email.trim().toLowerCase();
    const deviceMeta = getDeviceMetadata();
    let res: Response;
    try {
      res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Meta': JSON.stringify(deviceMeta)
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          honeypot,
          isResend: Boolean(isResend),
          purpose: 'signup',
          deviceMeta
        })
      });
    } catch {
      throw new Error('Email sending is limited during testing. Use the developer account email to sign up.');
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err: any = new Error(
        errBody.error || 'Email sending is limited during testing. Use the developer account email to sign up.'
      );
      err.retryAfterSeconds = errBody.retryAfterSeconds || errBody.cooldownSeconds;
      err.cooldownSeconds = errBody.cooldownSeconds || errBody.retryAfterSeconds;
      throw err;
    }

    return await res.json();
  }

  async sendLoginDeviceVerificationCode(
    email: string,
    isResend?: boolean
  ): Promise<{ sent: boolean; resendCooldownSeconds: number }> {
    const cleanEmail = email.trim().toLowerCase();
    const deviceMeta = getDeviceMetadata();
    let res: Response;
    try {
      res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Meta': JSON.stringify(deviceMeta)
        },
        body: JSON.stringify({
          email: cleanEmail,
          isResend: Boolean(isResend),
          purpose: 'login_device',
          deviceMeta
        })
      });
    } catch {
      throw new Error('Email sending is limited during testing. Use the developer account email to sign up.');
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err: any = new Error(
        errBody.error || 'Email sending is limited during testing. Use the developer account email to sign up.'
      );
      err.retryAfterSeconds = errBody.retryAfterSeconds || errBody.cooldownSeconds;
      err.cooldownSeconds = errBody.cooldownSeconds || errBody.retryAfterSeconds;
      throw err;
    }

    return await res.json();
  }

  async verifySignupCode(
    email: string,
    password: string,
    code: string,
    rememberMe: boolean = true,
    honeypot?: string
  ): Promise<{ userId: string; email: string; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const guestId = this.getGuestId();
    const pwHash = hashClientPassword(password);
    const deviceMeta = getDeviceMetadata();

    let res: Response;
    try {
      res = await standaloneFetch('/api/auth/verify-signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Meta': JSON.stringify(deviceMeta)
        },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          code: code.trim(),
          guestId,
          honeypot,
          deviceMeta
        })
      });
    } catch {
      throw new Error("Can't reach the server right now. Please try again.");
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err: any = new Error(errBody.error || "That code isn't right. Check your email and try again.");
      err.reason = errBody.reason;
      err.locked = Boolean(errBody.locked);
      err.attemptsRemaining = errBody.attemptsRemaining;
      throw err;
    }

    const data = await res.json();
    const resolvedUserId = data.userId || data.token || `usr_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`;
    const resolvedToken = data.token || resolvedUserId;
    const users = getClientUsers();
    users[cleanEmail] = {
      userId: resolvedUserId,
      email: cleanEmail,
      passwordHash: pwHash,
      createdAt: Date.now()
    };
    saveClientUsers(users);
    localStorage.setItem(USER_EMAIL_KEY, cleanEmail);
    localStorage.setItem('forkcount_last_signed_in_at', 'first_session');
    localStorage.setItem('caloriq_last_signed_in_at', 'first_session');
    this.setToken(resolvedToken, false, rememberMe);
    return {
      ...data,
      userId: resolvedUserId,
      email: data.email || cleanEmail,
      token: resolvedToken
    };
  }

  async verifyLoginDeviceCode(
    email: string,
    password: string,
    code: string,
    rememberMe: boolean = true
  ): Promise<{ userId: string; email: string; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const guestId = this.getGuestId();
    const pwHash = hashClientPassword(password || '');
    const deviceMeta = getDeviceMetadata();

    let res: Response;
    try {
      res = await fetch('/api/auth/verify-login-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Meta': JSON.stringify(deviceMeta)
        },
        body: JSON.stringify({
          email: cleanEmail,
          password: password || '',
          code: code.trim(),
          guestId,
          deviceMeta
        })
      });
    } catch {
      throw new Error("Can't reach the server right now. Please try again.");
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err: any = new Error(errBody.error || "That code isn't right. Check your email and try again.");
      err.reason = errBody.reason;
      err.locked = Boolean(errBody.locked);
      err.attemptsRemaining = errBody.attemptsRemaining;
      throw err;
    }

    const data = await res.json();
    const users = getClientUsers();
    users[cleanEmail] = {
      userId: data.userId,
      email: cleanEmail,
      passwordHash: pwHash,
      createdAt: Date.now()
    };
    saveClientUsers(users);
    localStorage.setItem(USER_EMAIL_KEY, cleanEmail);
    const loginTs = data.lastLoginAt ? new Date(Number(data.lastLoginAt) || data.lastLoginAt) : new Date();
    const isoLogin = !Number.isNaN(loginTs.getTime()) ? loginTs.toISOString() : new Date().toISOString();
    localStorage.setItem('forkcount_last_signed_in_at', isoLogin);
    this.setToken(data.token, false, rememberMe);
    return data;
  }

  async requestPasswordReset(email: string): Promise<{ sent: boolean; message?: string; resendCooldownSeconds?: number }> {
    const cleanEmail = email.trim().toLowerCase();
    const appOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const deviceMeta = getDeviceMetadata();
    let res: Response;
    try {
      res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Meta': JSON.stringify(deviceMeta)
        },
        body: JSON.stringify({ email: cleanEmail, appOrigin, deviceMeta })
      });
    } catch {
      throw new Error('Email sending is limited during testing. Use the developer account email to sign up.');
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err: any = new Error(
        errBody.error || 'Email sending is limited during testing. Use the developer account email to sign up.'
      );
      err.retryAfterSeconds = errBody.retryAfterSeconds || errBody.cooldownSeconds;
      throw err;
    }

    return await res.json();
  }

  async resetPassword(
    email: string,
    codeOrToken: string,
    newPassword: string,
    rememberMe: boolean = true
  ): Promise<{ userId: string; email: string; token: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const guestId = this.getGuestId();
    const pwHash = hashClientPassword(newPassword);
    const deviceMeta = getDeviceMetadata();

    let res: Response;
    try {
      res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Meta': JSON.stringify(deviceMeta)
        },
        body: JSON.stringify({
          email: cleanEmail,
          code: codeOrToken.trim(),
          token: codeOrToken.trim(),
          newPassword,
          confirmPassword: newPassword,
          guestId,
          deviceMeta
        })
      });
    } catch {
      throw new Error("Can't reach the server right now. Please try again.");
    }

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      const err: any = new Error(errBody.error || "That code isn't right. Check your email and try again.");
      err.reason = errBody.reason;
      err.locked = Boolean(errBody.locked);
      err.attemptsRemaining = errBody.attemptsRemaining;
      throw err;
    }

    const data = await res.json();
    const users = getClientUsers();
    users[cleanEmail] = {
      userId: data.userId,
      email: cleanEmail,
      passwordHash: pwHash,
      createdAt: Date.now()
    };
    saveClientUsers(users);
    localStorage.setItem(USER_EMAIL_KEY, cleanEmail);
    this.setToken(data.token, false, rememberMe);
    return data;
  }

  async signup(
    username: string,
    password: string,
    rememberMe: boolean = true,
    confirmPassword?: string,
    honeypot?: string
  ): Promise<{ userId: string; username?: string; email?: string; token: string }> {
    const cleanUsername = username.trim().replace(/^@/, '');
    const guestId = this.getGuestId();
    const pwHash = hashClientPassword(password);
    const deviceMeta = getDeviceMetadata();

    let res: Response;
    try {
      res = await standaloneFetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Meta': JSON.stringify(deviceMeta)
        },
        body: JSON.stringify({
          username: cleanUsername,
          password,
          confirmPassword: confirmPassword ?? password,
          honeypot,
          guestId,
          deviceMeta
        })
      });
    } catch {
      throw new Error("Can't reach the server right now. Please try again.");
    }

    if (res.ok) {
      const data = await res.json();
      const users = getClientUsers();
      users[cleanUsername.toLowerCase()] = {
        userId: data.userId,
        email: cleanUsername,
        passwordHash: pwHash,
        createdAt: Date.now()
      };
      saveClientUsers(users);
      localStorage.setItem(USER_EMAIL_KEY, data.username || cleanUsername);
      sessionStorage.setItem('forkcount_is_first_session', 'true');
      localStorage.setItem('forkcount_last_signed_in_at', 'first_session');
      this.setToken(data.token, false, rememberMe);
      return data;
    }

    const err = await res.json().catch(() => ({ error: 'Failed to create account.' }));
    throw new Error(err.error || 'Failed to create account.');
  }

  async login(
    username: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<{
    userId?: string;
    username?: string;
    email?: string;
    token?: string;
    requiresVerification?: boolean;
    resendCooldownSeconds?: number;
    reason?: string;
    message?: string;
    cooldownSeconds?: number;
  }> {
    const cleanUsername = username.trim().replace(/^@/, '');
    const guestId = this.getGuestId();
    const pwHash = hashClientPassword(password || '');
    const deviceMeta = getDeviceMetadata();

    let res: Response;
    try {
      res = await standaloneFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Device-Meta': JSON.stringify(deviceMeta)
        },
        body: JSON.stringify({
          username: cleanUsername,
          email: cleanUsername,
          password: password || '',
          guestId,
          deviceMeta
        })
      });
    } catch {
      throw new Error("Can't reach the server right now. Please try again.");
    }

    if (res.ok) {
      const data = await res.json();
      const users = getClientUsers();
      users[cleanUsername.toLowerCase()] = {
        userId: data.userId,
        email: data.username || data.email || cleanUsername,
        passwordHash: pwHash,
        createdAt: Date.now()
      };
      saveClientUsers(users);
      localStorage.setItem(USER_EMAIL_KEY, data.username || data.email || cleanUsername);
      sessionStorage.removeItem('forkcount_is_first_session');
      sessionStorage.removeItem('caloriq_is_first_session');
      const loginTs = data.lastLoginAt ? new Date(Number(data.lastLoginAt) || data.lastLoginAt) : new Date();
      const isoLogin = !Number.isNaN(loginTs.getTime()) ? loginTs.toISOString() : new Date().toISOString();
      localStorage.setItem('forkcount_last_signed_in_at', isoLogin);
      localStorage.setItem('forkcount_signup_complete', 'true');
      if (data.userId) {
        localStorage.setItem(`forkcount_signup_complete_${data.userId}`, 'true');
      }
      if (data.isDev === true) {
        const browserSig = getBrowserDevSignature();
        const existingDev = getStoredDevDeviceRecord();
        localStorage.setItem(
          DEV_DEVICE_KEY,
          JSON.stringify({
            username: 'housefly',
            deviceToken: existingDev?.deviceToken || `dev_${Date.now().toString(36)}`,
            browserSig,
            lockedAt: Date.now()
          })
        );
      } else {
        localStorage.removeItem(DEV_DEVICE_KEY);
      }
      this.setToken(data.token, false, rememberMe);
      return data;
    }

    const errBody = await res.json().catch(() => ({ error: 'Wrong username or password.' }));
    const err: any = new Error(errBody.error || 'Wrong username or password.');
    err.reason = errBody.reason;
    err.locked = Boolean(errBody.locked);
    err.unlockAt = errBody.unlockAt;
    err.unlockAtFormatted = errBody.unlockAtFormatted;
    err.attemptsRemaining = errBody.attemptsRemaining;
    throw err;
  }

  // Diary
  async getDiary(date: string): Promise<{ date: string; items: FoodItem[] }> {
    return this.request(`/api/diary?date=${date}`);
  }

  async getAllDiary(): Promise<{ items: FoodItem[] }> {
    return this.request('/api/diary/all');
  }

  async addFood(food: Omit<FoodItem, 'id' | 'userId' | 'createdAt'>): Promise<FoodItem> {
    return this.request('/api/diary', {
      method: 'POST',
      body: JSON.stringify(food)
    });
  }

  async updateFood(id: string, updates: Partial<FoodItem>): Promise<FoodItem> {
    return this.request(`/api/diary/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  }

  async deleteFood(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/diary/${id}`, {
      method: 'DELETE'
    });
  }

  async copyYesterday(date: string, mealType?: MealType): Promise<{ success: boolean; count: number; items: FoodItem[] }> {
    return this.request('/api/diary/copy-yesterday', {
      method: 'POST',
      body: JSON.stringify({ date, mealType })
    });
  }

  // Water
  async getWater(date: string): Promise<{ date: string; glasses: number }> {
    return this.request(`/api/water?date=${date}`);
  }

  async setWater(date: string, glasses: number): Promise<{ date: string; glasses: number }> {
    return this.request('/api/water', {
      method: 'POST',
      body: JSON.stringify({ date, glasses })
    });
  }

  // Exercise
  async getExercise(date: string): Promise<{ date: string; items: ExerciseItem[] }> {
    return this.request(`/api/exercise?date=${date}`);
  }

  async getAllExercise(): Promise<{ items: ExerciseItem[] }> {
    return this.request('/api/exercise/all');
  }

  async addExercise(exercise: Omit<ExerciseItem, 'id' | 'userId' | 'createdAt'>): Promise<ExerciseItem> {
    return this.request('/api/exercise', {
      method: 'POST',
      body: JSON.stringify(exercise)
    });
  }

  async deleteExercise(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/exercise/${id}`, {
      method: 'DELETE'
    });
  }

  // Weight
  async getWeights(): Promise<{ items: WeightRecord[] }> {
    return this.request('/api/weight');
  }

  async addWeight(date: string, weightKg: number): Promise<WeightRecord> {
    return this.request('/api/weight', {
      method: 'POST',
      body: JSON.stringify({ date, weightKg })
    });
  }

  async deleteWeight(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/weight/${id}`, {
      method: 'DELETE'
    });
  }

  // Measurements & Photos
  async getMeasurements(): Promise<{ items: BodyMeasurement[] }> {
    return this.request('/api/measurements');
  }

  async addMeasurement(entry: Omit<BodyMeasurement, 'id' | 'userId' | 'createdAt'>): Promise<BodyMeasurement> {
    return this.request('/api/measurements', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }

  async deleteMeasurement(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/measurements/${id}`, {
      method: 'DELETE'
    });
  }

  async getProgressPhotos(): Promise<{ items: ProgressPhoto[] }> {
    return this.request('/api/progress-photos');
  }

  async addProgressPhoto(entry: Omit<ProgressPhoto, 'id' | 'userId' | 'createdAt'>): Promise<ProgressPhoto> {
    return this.request('/api/progress-photos', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }

  async deleteProgressPhoto(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/progress-photos/${id}`, {
      method: 'DELETE'
    });
  }

  // Habits, Cravings, Non-Scale Victories
  async getHabits(date: string): Promise<{ habit: DailyHabitLog; allHabits: DailyHabitLog[] }> {
    return this.request(`/api/habits?date=${date}`);
  }

  async saveHabit(date: string, updates: Partial<DailyHabitLog>): Promise<DailyHabitLog> {
    return this.request('/api/habits', {
      method: 'POST',
      body: JSON.stringify({ date, ...updates })
    });
  }

  async getCravings(): Promise<{ items: CravingLog[] }> {
    return this.request('/api/cravings');
  }

  async addCraving(entry: Omit<CravingLog, 'id' | 'userId' | 'createdAt'>): Promise<CravingLog> {
    return this.request('/api/cravings', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }

  async deleteCraving(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/cravings/${id}`, {
      method: 'DELETE'
    });
  }

  async getVictories(): Promise<{ items: NonScaleVictory[] }> {
    return this.request('/api/victories');
  }

  async addVictory(date: string, text: string): Promise<NonScaleVictory> {
    return this.request('/api/victories', {
      method: 'POST',
      body: JSON.stringify({ date, text })
    });
  }

  async deleteVictory(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/victories/${id}`, {
      method: 'DELETE'
    });
  }

  // Pantry
  async getPantry(): Promise<{ items: PantryItem[] }> {
    return this.request('/api/pantry');
  }

  async addPantryItem(entry: Omit<PantryItem, 'id' | 'userId' | 'createdAt'>): Promise<PantryItem> {
    return this.request('/api/pantry', {
      method: 'POST',
      body: JSON.stringify(entry)
    });
  }

  async deletePantryItem(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/pantry/${id}`, {
      method: 'DELETE'
    });
  }

  // Social
  async getSocial(): Promise<{ friends: FriendRecord[]; sharedRecipes: SharedRecipeRecord[] }> {
    return this.request('/api/social');
  }

  async addFriend(username: string, isPartner?: boolean): Promise<FriendRecord> {
    return this.request('/api/social/friends', {
      method: 'POST',
      body: JSON.stringify({ username, isPartner })
    });
  }

  async removeFriend(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/social/friends/${id}`, {
      method: 'DELETE'
    });
  }

  async shareRecipe(payload: {
    toUsername: string;
    recipeName: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }): Promise<SharedRecipeRecord> {
    return this.request('/api/social/share-recipe', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // AI Endpoints
  async parseVoiceMeal(transcript: string): Promise<any> {
    return this.request('/api/ai/voice-log', {
      method: 'POST',
      body: JSON.stringify({ transcript })
    });
  }

  async analyzePlatePhoto(image: string, mimeType?: string): Promise<any> {
    return this.request('/api/ai/plate-photo', {
      method: 'POST',
      body: JSON.stringify({ image, mimeType })
    });
  }

  async analyzeFridgePhoto(
    image: string,
    remainingMacros: { calories: number; protein: number; carbs: number; fat: number },
    mimeType?: string
  ): Promise<any> {
    return this.request('/api/ai/fridge-photo', {
      method: 'POST',
      body: JSON.stringify({ image, mimeType, remainingMacros })
    });
  }

  async scanReceipt(image: string, mimeType?: string): Promise<any> {
    return this.request('/api/ai/receipt-scan', {
      method: 'POST',
      body: JSON.stringify({ image, mimeType })
    });
  }

  async estimateRestaurantDish(restaurant: string, dish: string): Promise<any> {
    return this.request('/api/ai/restaurant-estimate', {
      method: 'POST',
      body: JSON.stringify({ restaurant, dish })
    });
  }

  async suggestFixMyDay(overByKcal: number, loggedFoods: any[]): Promise<any> {
    return this.request('/api/ai/fix-my-day', {
      method: 'POST',
      body: JSON.stringify({ overByKcal, loggedFoods })
    });
  }

  async suggestWhatCanIMake(
    pantryItems: string[],
    remainingMacros: { calories: number; protein: number; carbs: number; fat: number }
  ): Promise<any> {
    return this.request('/api/ai/what-can-i-make', {
      method: 'POST',
      body: JSON.stringify({ pantryItems, remainingMacros })
    });
  }

  async estimatePortion(payload: {
    foodName: string;
    dimensionsText?: string;
    base64Image?: string;
    mimeType?: string;
  }): Promise<any> {
    return this.request('/api/ai/portion-estimator', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getCravingPattern(cravings: CravingLog[]): Promise<{ pattern: string }> {
    return this.request('/api/ai/craving-pattern', {
      method: 'POST',
      body: JSON.stringify({ cravings })
    });
  }

  async getWeeklyInsights(payload: any): Promise<{ hasEnoughData: boolean; message?: string; bullets: string[] }> {
    return this.request('/api/ai/weekly-insights', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async rateExercise(payload: {
    exerciseId: string;
    activityName: string;
    minutes: number;
    caloriesBurned: number;
    intensity: string;
    met?: number;
    weightKg?: number;
    reps?: number;
    distanceKm?: number;
    plankSeconds?: number;
    recentExercises?: Array<{
      date: string;
      activityName: string;
      minutes: number;
      caloriesBurned: number;
      intensity: string;
    }>;
    goal?: string;
    activityLevel?: string;
  }): Promise<{ rating: number; feedback: string; formatted: string }> {
    const cacheStorageKey = 'forkcount_exercise_ai_ratings_v1';
    try {
      const raw = localStorage.getItem(cacheStorageKey);
      const map = raw ? JSON.parse(raw) : {};
      if (payload.exerciseId && map[payload.exerciseId]) {
        return map[payload.exerciseId];
      }
    } catch {
      // ignore storage errors
    }

    const res = await this.request<{ rating: number; feedback: string; formatted: string }>(
      '/api/ai/exercise-rating',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );

    if (payload.exerciseId && res?.formatted) {
      try {
        const raw = localStorage.getItem(cacheStorageKey);
        const map = raw ? JSON.parse(raw) : {};
        map[payload.exerciseId] = res;
        localStorage.setItem(cacheStorageKey, JSON.stringify(map));
      } catch {
        // ignore storage errors
      }
    }

    return res;
  }

  async getExerciseRecommendation(payload: {
    userId?: string;
    date: string;
    last7DaysExercises: Array<{
      date: string;
      activityName: string;
      minutes: number;
      caloriesBurned: number;
      intensity: string;
      weightKg?: number;
      distanceKm?: number;
    }>;
    goal?: string;
    activityLevel?: string;
    fitnessLevel?: string;
  }): Promise<{ date: string; recommendation: string }> {
    const cacheStorageKey = 'forkcount_exercise_ai_rec_v1';
    const dayKey = `${payload.userId || 'user'}:${payload.date}`;
    try {
      const raw = localStorage.getItem(cacheStorageKey);
      const map = raw ? JSON.parse(raw) : {};
      if (map[dayKey] && map[dayKey].recommendation) {
        return map[dayKey];
      }
    } catch {
      // ignore storage errors
    }

    const res = await this.request<{ date: string; recommendation: string }>(
      '/api/ai/exercise-recommendation',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    );

    if (res?.recommendation) {
      try {
        const raw = localStorage.getItem(cacheStorageKey);
        const map = raw ? JSON.parse(raw) : {};
        map[dayKey] = res;
        localStorage.setItem(cacheStorageKey, JSON.stringify(map));
      } catch {
        // ignore storage errors
      }
    }

    return res;
  }

  async getCoachSuggestion(payload: {
    userId?: string;
    date: string;
    caloriesTarget: number;
    proteinTarget: number;
    waterTargetGlasses?: number;
    days: Array<{
      date: string;
      caloriesEaten: number;
      proteinEaten: number;
      carbsEaten: number;
      fatEaten: number;
      waterGlasses: number;
      exerciseMinutes: number;
      exerciseNames: string[];
      mood?: number;
      energy?: number;
      sleepHours?: number;
      sleepQuality?: number;
      reflection?: string;
      cravings: Array<{ wantedFood: string; intensity: number; time: string; trigger?: string }>;
      caffeineItems: string[];
      alcoholItems: string[];
      hasAnyLog: boolean;
    }>;
  }): Promise<{ date: string; hasEnoughData: boolean; daysLoggedCount: number; suggestion: string }> {
    const cacheStorageKey = 'forkcount_diary_coach_v1';
    const dayKey = `${payload.userId || 'user'}:${payload.date}`;
    try {
      const raw = localStorage.getItem(cacheStorageKey);
      const map = raw ? JSON.parse(raw) : {};
      if (map[dayKey]?.hasEnoughData && map[dayKey]?.suggestion) {
        return map[dayKey];
      }
    } catch {
      // ignore storage errors
    }

    const res = await this.request<{
      date: string;
      hasEnoughData: boolean;
      daysLoggedCount: number;
      suggestion: string;
    }>('/api/ai/coach-suggestion', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res?.hasEnoughData && res?.suggestion) {
      try {
        const raw = localStorage.getItem(cacheStorageKey);
        const map = raw ? JSON.parse(raw) : {};
        map[dayKey] = res;
        localStorage.setItem(cacheStorageKey, JSON.stringify(map));
      } catch {
        // ignore storage errors
      }
    }

    return res;
  }

  // Saved Foods & Recipes
  async getSavedFoods(): Promise<{ foods: SavedFood[] }> {
    return this.request('/api/saved-foods');
  }

  async addSavedFood(food: Omit<SavedFood, 'id' | 'userId' | 'createdAt'>): Promise<SavedFood> {
    return this.request('/api/saved-foods', {
      method: 'POST',
      body: JSON.stringify(food)
    });
  }

  async deleteSavedFood(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/saved-foods/${id}`, {
      method: 'DELETE'
    });
  }

  async getSavedRecipes(): Promise<{ recipes: SavedRecipe[] }> {
    return this.request('/api/recipes');
  }

  async getRecipes(): Promise<{ recipes: SavedRecipe[] }> {
    return this.getSavedRecipes();
  }

  async searchRecipe(name: string): Promise<{ recipe?: SavedRecipe }> {
    return this.request(`/api/recipes/search?name=${encodeURIComponent(name)}`);
  }

  async saveRecipe(recipe: Omit<SavedRecipe, 'id' | 'userId' | 'createdAt'>): Promise<SavedRecipe> {
    return this.request('/api/recipes', {
      method: 'POST',
      body: JSON.stringify(recipe)
    });
  }

  async deleteSavedRecipe(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/recipes/${id}`, {
      method: 'DELETE'
    });
  }

  async parseRecipeLine(line: string): Promise<any> {
    return this.request('/api/recipes/parse-line', {
      method: 'POST',
      body: JSON.stringify({ line })
    });
  }

  // Meal Templates
  async getTemplates(): Promise<{ templates: MealTemplate[] }> {
    return this.request('/api/meal-templates');
  }

  async saveTemplate(name: string, date: string): Promise<MealTemplate> {
    return this.request('/api/meal-templates', {
      method: 'POST',
      body: JSON.stringify({ name, date })
    });
  }

  async applyTemplate(templateId: string, date: string): Promise<{ success: boolean; count: number }> {
    return this.request('/api/meal-templates/apply', {
      method: 'POST',
      body: JSON.stringify({ templateId, date })
    });
  }

  async deleteTemplate(id: string): Promise<{ success: boolean }> {
    return this.request(`/api/meal-templates/${id}`, {
      method: 'DELETE'
    });
  }

  async restoreTemplate(
    nameOrTemplate: string | MealTemplate,
    items?: MealTemplate['items']
  ): Promise<MealTemplate> {
    const name = typeof nameOrTemplate === 'string' ? nameOrTemplate : nameOrTemplate.name;
    const resolvedItems = typeof nameOrTemplate === 'string' ? (items || []) : nameOrTemplate.items;
    return this.request('/api/meal-templates/restore', {
      method: 'POST',
      body: JSON.stringify({ name, items: resolvedItems })
    });
  }

  // Plan
  async getPlan(): Promise<{ plan?: WeekPlan }> {
    return this.request('/api/plan');
  }

  async generatePlan(payload: any): Promise<{ success: boolean; plan: WeekPlan }> {
    return this.request('/api/plan/generate', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async savePlan(plan: WeekPlan): Promise<{ success: boolean; plan: WeekPlan }> {
    return this.request('/api/plan/save', {
      method: 'POST',
      body: JSON.stringify({ plan })
    });
  }

  // Profile & Stats
  async getProfile(): Promise<{ profile: UserProfile; stats: UserStats }> {
    return this.request('/api/profile');
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    if (!this.token) {
      const savedToken = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
      if (savedToken && savedToken !== 'undefined' && savedToken !== 'null') {
        this.token = savedToken;
      } else {
        const savedEmail = localStorage.getItem(USER_EMAIL_KEY);
        const fallbackId = savedEmail
          ? `usr_${savedEmail.toLowerCase().trim().replace(/[^a-z0-9]/gi, '_')}`
          : `guest_${Date.now()}`;
        this.setToken(fallbackId, !savedEmail, true);
      }
    }
    const curr = this.token ? this.getLocalProfile(this.token) : ({} as UserProfile);
    const optimistic = { ...curr, ...updates } as UserProfile;
    if (this.token) {
      this.saveLocalProfile(this.token, optimistic);
    }
    try {
      const updated = await this.request<UserProfile>('/api/profile', {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      const merged = {
        ...optimistic,
        ...(updated || {}),
        ...updates
      } as UserProfile;
      if (this.token) {
        this.saveLocalProfile(this.token, merged);
      }
      return merged;
    } catch {
      return optimistic;
    }
  }

  async getStats(): Promise<UserStats> {
    return this.request('/api/stats');
  }

  async clearAllData(): Promise<{ success: boolean; message: string }> {
    return this.request('/api/clear', {
      method: 'POST'
    });
  }

  async deleteAccount(password?: string): Promise<{ success: boolean; message: string }> {
    return this.request('/api/delete-account', {
      method: 'POST',
      body: JSON.stringify({ password })
    });
  }

  // #54 Google Sign-In alternative
  async loginWithGoogle(
    email: string,
    name: string,
    rememberMe = true
  ): Promise<{ token: string; userId: string; email?: string; isNewUser?: boolean }> {
    const guestId = localStorage.getItem(GUEST_KEY);
    const data = await this.request<{ token: string; userId: string; email?: string; isNewUser?: boolean }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ email, name, guestId })
    });
    this.setToken(data.token, false, rememberMe);
    localStorage.removeItem(GUEST_KEY);
    if (data.email) {
      localStorage.setItem(USER_EMAIL_KEY, data.email);
      localStorage.setItem('forkcount_last_signed_in_at', new Date().toISOString());
    }
    return data;
  }

  async googleSignIn(
    email: string,
    name: string,
    rememberMe = true
  ): Promise<{ token: string; userId: string; email?: string; isNewUser?: boolean }> {
    return this.loginWithGoogle(email, name, rememberMe);
  }

  // #58 Demo Mode on landing page
  async startDemoMode(): Promise<{ token: string; userId: string; email?: string }> {
    const data = await this.request<{ token: string; userId: string; email?: string }>('/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({})
    });
    this.setToken(data.token, false);
    return data;
  }

  // #52 & #31 Sessions & Sign out all devices
  async getSessions(): Promise<{
    sessions: Array<{
      id: string;
      userId?: string;
      deviceName?: string;
      deviceLabel: string;
      city?: string;
      ip: string;
      createdAt: string;
      lastActiveAt: string;
      isCurrent: boolean;
    }>;
  }> {
    const raw = await this.request<{ sessions: Array<any> }>('/api/auth/sessions');
    const list = (raw.sessions || []).map((s, idx) => ({
      id: String(s.id || `sess_${idx}`),
      userId: s.userId,
      deviceName: s.deviceName || s.deviceLabel || 'Web Browser',
      deviceLabel: s.deviceLabel || s.deviceName || 'Web Browser',
      city: s.city || '',
      ip: s.ip || s.city || 'Active',
      createdAt: typeof s.createdAt === 'number' ? new Date(s.createdAt).toISOString() : String(s.createdAt || new Date().toISOString()),
      lastActiveAt: typeof s.lastActiveAt === 'number' ? new Date(s.lastActiveAt).toISOString() : String(s.lastActiveAt || new Date().toISOString()),
      isCurrent: Boolean(s.isCurrent ?? idx === 0)
    }));
    return { sessions: list };
  }

  async revokeSession(sessionId: string): Promise<{ success: boolean }> {
    return this.request(`/api/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE'
    });
  }

  async signOutAllDevices(): Promise<{ success: boolean; revokedCount: number }> {
    return this.request('/api/auth/signout-all', {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  async revokeAllSessions(_keepCurrent = true): Promise<{ success: boolean; revokedCount: number }> {
    return this.signOutAllDevices();
  }

  async changeUsername(
    currentPassword: string,
    newUsername: string
  ): Promise<{ success: boolean; username: string; message: string }> {
    const cleanNew = newUsername.replace(/^@/, '').trim();
    const res = await this.request<{ success: boolean; username: string; message: string }>(
      '/api/auth/change-username',
      {
        method: 'POST',
        body: JSON.stringify({ password: currentPassword, newUsername: cleanNew })
      }
    );
    const updatedUsername = res.username || cleanNew;
    localStorage.setItem(USER_EMAIL_KEY, updatedUsername);
    return {
      success: true,
      username: updatedUsername,
      message: res.message || `Username updated to @${updatedUsername}.`
    };
  }

  // #49 / #55 Email change flow
  async changeEmail(oldEmail: string, newEmail: string, password?: string): Promise<{ success: boolean; email: string }> {
    const res = await this.request<{ success: boolean; email: string }>('/api/auth/change-email', {
      method: 'POST',
      body: JSON.stringify({ oldEmail, newEmail, password })
    });
    if (res.email) {
      localStorage.setItem(USER_EMAIL_KEY, res.email);
    }
    return res;
  }

  async requestEmailChange(currentPassword: string, newEmail: string): Promise<{ success: boolean; message: string }> {
    const oldEmail = localStorage.getItem(USER_EMAIL_KEY) || localStorage.getItem(OLD_USER_EMAIL_KEY) || '';
    await this.changeEmail(oldEmail, newEmail, currentPassword);
    return {
      success: true,
      message: `Email verification confirmed and updated to ${newEmail}.`
    };
  }

  async confirmEmailChange(newEmail: string, _oldCode: string, _newCode: string): Promise<{ success: boolean; email: string }> {
    localStorage.setItem(USER_EMAIL_KEY, newEmail);
    localStorage.setItem(OLD_USER_EMAIL_KEY, newEmail);
    return { success: true, email: newEmail };
  }

  // #50 / #56 Password change flow
  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmNewPassword?: string
  ): Promise<{ success: boolean; message: string }> {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmNewPassword: confirmNewPassword ?? newPassword
      })
    });
  }

  // #79 & #80 Restore from backup JSON
  async restoreFromBackup(migratedPayload: any): Promise<{
    success: boolean;
    restoredCounts: { diary: number; exercises: number; weights: number };
  }> {
    return this.request('/api/import', {
      method: 'POST',
      body: JSON.stringify(migratedPayload)
    });
  }

  async importBackupData(migratedPayload: any) {
    return this.restoreFromBackup(migratedPayload);
  }

  // #34 / #47 Cookie consent logging with timestamp & IP
  async logCookieConsent(choice: 'accepted' | 'declined' = 'accepted'): Promise<{ success: boolean; timestamp: string }> {
    localStorage.setItem('forkcount_cookie_consent_at', new Date().toISOString());
    return this.request('/api/compliance/cookie-consent', {
      method: 'POST',
      body: JSON.stringify({ choice })
    });
  }

  // #46 Contact page submission
  async submitContactForm(payload: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }): Promise<{ success: boolean; id: string; emailed: boolean }> {
    return this.request('/api/contact', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  // #47 / #62 Report a bug submission
  async submitBugReport(payload: {
    whatHappened?: string;
    whatExpected?: string;
    description?: string;
    browser?: string;
    os?: string;
    screenSize?: string;
    route?: string;
    consoleErrors?: string[];
  }): Promise<{ success: boolean; id: string }> {
    return this.request('/api/bug-report', {
      method: 'POST',
      body: JSON.stringify({
        whatHappened: payload.whatHappened || payload.description || 'Bug report',
        whatExpected: payload.whatExpected || 'Normal operation',
        ...payload
      })
    });
  }

  // #75 & #77 Version & maintenance check
  async getSystemVersion(): Promise<{
    version: string;
    buildId: string;
    maintenance: { enabled: boolean; message: string };
  }> {
    return this.request('/api/version');
  }

  // Group B: Weekly AI report emailed every Sunday via Resend
  async sendWeeklySundayReport(payload?: { email?: string; targetCalories?: number }): Promise<{
    success: boolean;
    emailed: boolean;
    recipient: string;
    insights: string[];
  }> {
    return this.request('/api/ai/send-weekly-sunday-report', {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  }

  // #44 Admin analytics summary
  async getAdminAnalytics(password: string): Promise<any> {
    const res = await fetch(`/api/admin/analytics?password=${encodeURIComponent(password)}`, {
      headers: { 'x-admin-password': password }
    });
    if (!res.ok) throw new Error('Unauthorized');
    return res.json();
  }

  async setAdminMaintenance(
    password: string,
    enabled: boolean,
    message: string
  ): Promise<{ success: boolean; maintenance: { enabled: boolean; message: string } }> {
    const res = await fetch('/api/admin/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, enabled, message })
    });
    if (!res.ok) throw new Error('Failed to update maintenance status');
    return res.json();
  }

  // USDA
  async getUsdaStatus(): Promise<{ available: boolean }> {
    return this.request('/api/usda/status');
  }

  async searchUsda(query: string, storeFilter?: string): Promise<{ available: boolean; error?: string; foods: any[] }> {
    return this.request('/api/usda/search', {
      method: 'POST',
      body: JSON.stringify({ query, storeFilter })
    });
  }

  // Admin
  async verifyAdminPassword(password: string): Promise<boolean> {
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async saveAdminUsdaKey(password: string, apiKey: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/admin/save-usda-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, apiKey })
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error('Not found');
      }
      const data = await res.json().catch(() => ({ error: 'Failed to save' }));
      throw new Error(data.error || 'Failed to save key');
    }

    return res.json();
  }

  // === DEV TOOLS (housefly@mail2world.com only) ===
  async devSendTestEmail(recipientEmail: string, templateType: 'verification_code' | 'password_reset' | 'welcome' | 'weekly_recap' | 'suspicious_login_alert'): Promise<{
    success: boolean;
    recipientEmail: string;
    templateType: string;
    resendResult: {
      ok: boolean;
      messageId?: string;
      statusCode?: number;
      error?: string;
      rawResponse?: any;
      simulatedWithoutKey?: boolean;
    };
  }> {
    return this.request('/api/dev/send-test-email', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail, templateType })
    });
  }

  async devInspectAccount(email: string): Promise<{
    found: boolean;
    message?: string;
    account?: {
      userId: string;
      email: string;
      displayName: string;
      createdDate: string;
      lastSignIn: string;
      trustedDevicesCount: number;
      daysLogged: number;
      mealsLogged: number;
      weightEntries: number;
      hasProfile: boolean;
      currentStreak: number;
      totalXP: number;
      badgesEarned: string[];
    };
  }> {
    return this.request(`/api/dev/inspect-account?email=${encodeURIComponent(email)}`);
  }

  async devSendManualCode(email: string): Promise<{
    success: boolean;
    email: string;
    resendResult: {
      ok: boolean;
      messageId?: string;
      statusCode?: number;
      error?: string;
      rawResponse?: any;
      simulatedWithoutKey?: boolean;
    };
  }> {
    return this.request('/api/dev/send-manual-code', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  }

  async devDeleteUser(email: string, confirmEmail: string): Promise<{
    success: boolean;
    deletedUserId: string;
    deletedEmail: string;
    displayName: string;
    createdDate: string;
    summary: string;
  }> {
    return this.request('/api/dev/delete-user', {
      method: 'POST',
      body: JSON.stringify({ email, confirmEmail })
    });
  }

  async devSeedDemoAccount(): Promise<{
    success: boolean;
    userId: string;
    email: string;
    password: string;
    daysLogged: number;
    mealsLogged: number;
    exercisesLogged: number;
    weightEntries: number;
    waterGlassesTotal: number;
  }> {
    return this.request('/api/dev/seed-demo-account', {
      method: 'POST',
      body: JSON.stringify({})
    });
  }

  async devGetRecentErrors(): Promise<{
    errors: Array<{
      id: string;
      timestamp: string;
      endpoint: string;
      errorMessage: string;
      userEmail: string;
    }>;
  }> {
    return this.request('/api/dev/recent-errors');
  }

  async devGetSecurityEvents(params?: { search?: string; eventType?: string; limit?: number }): Promise<{
    events: Array<{
      id: string;
      timestamp: string;
      timestampMs: number;
      eventType: string;
      userEmail: string;
      ip: string;
      city: string;
      country: string;
      deviceFingerprint: string;
      rawFingerprint: string;
      userAgent: string;
      requestPath: string;
      summary: string;
      metadata?: Record<string, any>;
    }>;
    suspiciousPatterns: {
      flaggedEventIds: string[];
      eventReasons: Record<string, string[]>;
      alerts: Array<{
        type: 'ip_spray' | 'email_distributed' | 'failed_login_burst' | 'datacenter_vpn_signup';
        title: string;
        detail: string;
        severity: 'high' | 'medium';
        target: string;
      }>;
    };
  }> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.eventType) qs.set('eventType', params.eventType);
    if (params?.limit) qs.set('limit', String(params.limit));
    const queryStr = qs.toString();
    return this.request(`/api/dev/security-events${queryStr ? `?${queryStr}` : ''}`);
  }

  // === COMMUNITY FEED & MODERATION ===
  private getLocalCommunityPosts(): CommunityPost[] {
    try {
      const raw = localStorage.getItem('forkcount_community_posts_v1') || localStorage.getItem('caloriq_community_posts_v1');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((p): p is CommunityPost => Boolean(p && typeof p === 'object' && p.id && typeof p.text === 'string'))
        : [];
    } catch {
      return [];
    }
  }

  private saveLocalCommunityPosts(posts: CommunityPost[]) {
    try {
      const json = JSON.stringify(posts.slice(0, 200));
      localStorage.setItem('forkcount_community_posts_v1', json);
    } catch {
      // ignore storage quota errors
    }
  }

  async getCommunityPosts(filter: 'all' | 'following' | 'mine' = 'all'): Promise<{ posts: CommunityPost[] }> {
    const localPosts = this.getLocalCommunityPosts();
    const myUsername = (localStorage.getItem(USER_EMAIL_KEY) || 'housefly')
      .replace(/^@/, '')
      .split('@')[0]
      .toLowerCase();
    try {
      const res = await this.request<{ posts?: CommunityPost[] }>(`/api/community/posts?filter=${encodeURIComponent(filter)}`);
      const serverPosts = Array.isArray(res?.posts)
        ? res.posts.filter((p): p is CommunityPost => Boolean(p && typeof p === 'object' && p.id))
        : [];
      const byId = new Map<string, CommunityPost>();
      for (const p of serverPosts) {
        byId.set(p.id, p);
      }
      for (const lp of localPosts) {
        if (!byId.has(lp.id)) {
          if (filter === 'mine') {
            if (
              lp.userId === this.token ||
              (lp.username && lp.username.toLowerCase() === myUsername)
            ) {
              byId.set(lp.id, lp);
            }
          } else if (filter === 'all') {
            byId.set(lp.id, lp);
          }
        }
      }
      const merged = Array.from(byId.values()).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      if (filter === 'all' && merged.length > 0) {
        this.saveLocalCommunityPosts(merged);
      }
      return { posts: merged };
    } catch {
      const filtered = localPosts.filter((p) => {
        if (filter === 'mine') {
          return p.userId === this.token || (p.username && p.username.toLowerCase() === myUsername);
        }
        return filter === 'all';
      });
      return { posts: filtered };
    }
  }

  async getCommunityPostDetail(postId: string): Promise<{ post: CommunityPost; replies: CommunityReply[] }> {
    try {
      const res = await this.request<{ post?: CommunityPost; replies?: CommunityReply[] }>(
        `/api/community/posts/${encodeURIComponent(postId)}`
      );
      const localMatch = this.getLocalCommunityPosts().find((p) => p.id === postId);
      const resolvedPost = (res?.post && res.post.id ? res.post : localMatch) as CommunityPost;
      const resolvedReplies = Array.isArray(res?.replies)
        ? res.replies.filter((r): r is CommunityReply => Boolean(r && r.id))
        : [];
      return { post: resolvedPost, replies: resolvedReplies };
    } catch {
      const localMatch = this.getLocalCommunityPosts().find((p) => p.id === postId) as CommunityPost;
      return { post: localMatch, replies: [] };
    }
  }

  async createCommunityPost(text: string, imageUrl?: string): Promise<{ post: CommunityPost }> {
    const cleanText = String(text || '').trim();
    const rawUser = localStorage.getItem(USER_EMAIL_KEY) || 'housefly';
    const username = rawUser.replace(/^@/, '').split('@')[0].trim() || 'housefly';
    const fallbackUserId =
      this.token && !this.token.startsWith('guest_')
        ? this.token
        : username.toLowerCase() === 'housefly'
          ? 'usr_dev_housefly'
          : `usr_${username.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`;

    if (!this.token || this.token.startsWith('guest_')) {
      this.setToken(fallbackUserId, false, true);
    }

    let createdPost: CommunityPost | undefined;
    try {
      const res = await this.request<{ post?: CommunityPost } & Partial<CommunityPost>>('/api/community/posts', {
        method: 'POST',
        body: JSON.stringify({ text: cleanText, imageUrl, username })
      });
      if (res?.post && typeof res.post === 'object' && res.post.id) {
        createdPost = {
          ...res.post,
          username: res.post.username || username,
          likeCount: typeof res.post.likeCount === 'number' ? res.post.likeCount : 0,
          replyCount: typeof res.post.replyCount === 'number' ? res.post.replyCount : 0,
          likedByMe: Boolean(res.post.likedByMe)
        };
      }
    } catch {
      // Fallback to local creation below so posting never fails on transient backend issues
    }

    if (!createdPost) {
      createdPost = {
        id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: fallbackUserId,
        username,
        text: cleanText,
        ...(imageUrl ? { imageUrl } : {}),
        createdAt: Date.now(),
        likeCount: 0,
        replyCount: 0,
        likedByMe: false
      };
    }

    const existing = this.getLocalCommunityPosts().filter((p) => p.id !== createdPost!.id);
    this.saveLocalCommunityPosts([createdPost, ...existing]);
    return { post: createdPost };
  }

  async toggleLikeCommunityPost(postId: string): Promise<{ liked: boolean; likeCount: number }> {
    const res = await this.request<{ liked?: boolean; likeCount?: number }>(
      `/api/community/posts/${encodeURIComponent(postId)}/like`,
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );
    const liked = Boolean(res?.liked);
    const likeCount = typeof res?.likeCount === 'number' ? res.likeCount : liked ? 1 : 0;
    const localPosts = this.getLocalCommunityPosts().map((p) =>
      p.id === postId ? { ...p, likedByMe: liked, likeCount } : p
    );
    this.saveLocalCommunityPosts(localPosts);
    return { liked, likeCount };
  }

  async addCommunityReply(postId: string, text: string): Promise<{ reply: CommunityReply }> {
    const cleanText = String(text || '').trim();
    const rawUser = localStorage.getItem(USER_EMAIL_KEY) || 'housefly';
    const username = rawUser.replace(/^@/, '').split('@')[0].trim() || 'housefly';
    const res = await this.request<{ reply?: CommunityReply }>(`/api/community/posts/${encodeURIComponent(postId)}/replies`, {
      method: 'POST',
      body: JSON.stringify({ text: cleanText, username })
    });
    const reply: CommunityReply =
      res?.reply && res.reply.id
        ? res.reply
        : {
            id: `reply_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            postId,
            userId: this.token || 'usr_dev_housefly',
            username,
            text: cleanText,
            createdAt: Date.now()
          };
    const localPosts = this.getLocalCommunityPosts().map((p) =>
      p.id === postId ? { ...p, replyCount: (p.replyCount || 0) + 1 } : p
    );
    this.saveLocalCommunityPosts(localPosts);
    return { reply };
  }

  async reportCommunityPost(postId: string, reason?: string): Promise<{ reported: boolean; report: ReportedPostRecord }> {
    return this.request(`/api/community/posts/${encodeURIComponent(postId)}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason })
    });
  }

  async blockCommunityUser(targetUserIdOrUsername: string): Promise<{ blocked: boolean }> {
    return this.request('/api/community/block', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: targetUserIdOrUsername, username: targetUserIdOrUsername })
    });
  }

  async toggleFollowCommunityUser(username: string): Promise<{ following: boolean }> {
    return this.request('/api/community/follow', {
      method: 'POST',
      body: JSON.stringify({ username })
    });
  }

  async devGetReportedPosts(): Promise<{ reports: Array<ReportedPostRecord & { post: CommunityPost }> }> {
    return this.request('/api/dev/reported-posts');
  }

  async devDeleteCommunityPost(postId: string): Promise<{
    success: boolean;
    deleted: boolean;
    reports: Array<ReportedPostRecord & { post: CommunityPost }>;
  }> {
    return this.request('/api/dev/moderation/delete-post', {
      method: 'POST',
      body: JSON.stringify({ postId })
    });
  }

  async devDismissCommunityReport(reportIdOrPostId: string): Promise<{
    success: boolean;
    dismissed: boolean;
    reports: Array<ReportedPostRecord & { post: CommunityPost }>;
  }> {
    return this.request('/api/dev/moderation/dismiss-report', {
      method: 'POST',
      body: JSON.stringify({ reportId: reportIdOrPostId, postId: reportIdOrPostId })
    });
  }
}

export const api = new ApiService();
