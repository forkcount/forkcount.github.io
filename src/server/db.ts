import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { safeOutboundFetch } from './ssrfGuard.js';
import { formatLocalDate, addDaysLocal } from '../utils/dateUtils.js';
import type {
  FoodItem,
  ExerciseItem,
  WeightRecord,
  SavedFood,
  SavedRecipe,
  MealTemplate,
  UserProfile,
  WeekPlan,
  UserStats,
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

export interface TrustedDeviceRecord {
  fingerprintHash: string;
  rawFingerprint: string;
  deviceName: string;
  userAgent: string;
  ip: string;
  city: string;
  trustedAt: number;
  lastUsedAt: number;
}

export interface UserRow {
  id: string;
  username?: string;
  email?: string;
  passwordHash?: string;
  isGuest: boolean;
  isDev?: boolean;
  devDeviceToken?: string;
  devBrowserSig?: string;
  createdAt: number;
  lastLoginAt: number;
  trustedDevices?: TrustedDeviceRecord[];
}

export type SecurityEventType =
  | 'failed_login'
  | 'login_new_device'
  | 'login_known_device'
  | 'signup_attempt'
  | 'code_requested'
  | 'code_correct'
  | 'code_wrong'
  | 'code_expired'
  | 'code_locked'
  | 'code_rate_limit'
  | 'password_reset_requested'
  | 'password_reset_completed'
  | 'password_reset_new_device'
  | 'rate_limit_hit'
  | 'honeypot_triggered'
  | 'account_lockout'
  | 'email_change_requested'
  | 'session_revoked'
  | 'dev_action';

export interface SecurityEventRecord {
  id: string;
  timestamp: string;
  createdAt: number;
  eventType: SecurityEventType;
  userEmail: string;
  ip: string;
  city: string;
  country: string;
  ispOrOrg?: string;
  isVpnOrDatacenter?: boolean;
  deviceFingerprint: string;
  deviceName: string;
  userAgent: string;
  requestPath: string;
  summary: string;
  metadata?: Record<string, any>;
}

export interface BackendErrorRecord {
  id: string;
  timestamp: string;
  createdAt: number;
  endpoint: string;
  errorMessage: string;
  userEmail: string;
}

export interface SettingsRow {
  id: string;
  usdaApiKey?: string;
}

export interface DatabaseSchema {
  users: Record<string, UserRow>;
  profiles: Record<string, UserProfile>;
  diaryEntries: FoodItem[];
  waterEntries: Record<string, number>; // key: `${userId}:${date}` -> glasses
  exerciseEntries: ExerciseItem[];
  weightEntries: WeightRecord[];
  measurements: BodyMeasurement[];
  progressPhotos: ProgressPhoto[];
  dailyHabits: Record<string, DailyHabitLog>; // key: `${userId}:${date}`
  cravings: CravingLog[];
  nonScaleVictories: NonScaleVictory[];
  pantryItems: PantryItem[];
  friends: FriendRecord[];
  sharedRecipes: SharedRecipeRecord[];
  posts: CommunityPost[];
  replies: CommunityReply[];
  postLikes: Record<string, string[]>;
  postReports: ReportedPostRecord[];
  blockedUsers: Record<string, string[]>;
  followingUsers: Record<string, string[]>;
  savedFoods: SavedFood[];
  savedRecipes: SavedRecipe[];
  mealTemplates: MealTemplate[];
  plans: Record<string, WeekPlan>; // key: userId
  userXp: Record<string, { xp: number; badges: string[] }>;
  securityEvents: SecurityEventRecord[];
  recentErrors: BackendErrorRecord[];
  settings: SettingsRow;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'caloriq-db.json');
export const DEV_USERNAME = 'housefly';

const INITIAL_DB: DatabaseSchema = {
  users: {},
  profiles: {},
  diaryEntries: [],
  waterEntries: {},
  exerciseEntries: [],
  weightEntries: [],
  measurements: [],
  progressPhotos: [],
  dailyHabits: {},
  cravings: [],
  nonScaleVictories: [],
  pantryItems: [],
  friends: [],
  sharedRecipes: [],
  posts: [],
  replies: [],
  postLikes: {},
  postReports: [],
  blockedUsers: {},
  followingUsers: {},
  savedFoods: [],
  savedRecipes: [],
  mealTemplates: [],
  plans: {},
  userXp: {},
  securityEvents: [],
  recentErrors: [],
  settings: { id: 'global' }
};

let db: DatabaseSchema = { ...INITIAL_DB };

function isLegacyDefaultProfile(prof: UserProfile): boolean {
  return (
    prof.age === 28 &&
    prof.gender === 'female' &&
    prof.heightCm === 168 &&
    prof.fitnessLevel === 'intermediate' &&
    prof.currentWeightKg === 65 &&
    prof.goalWeightKg === 60 &&
    prof.dailyActivity === 'moderate'
  );
}

function initDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      const fakeUsernames = new Set(['claire_m', 'marcus_r', 'elena_v']);
      const cleanedFriends = (parsed.friends || []).filter(
        (f: any) => !fakeUsernames.has(String(f.username || '').toLowerCase())
      );
      const cleanedProfiles: Record<string, UserProfile> = parsed.profiles || {};
      for (const uid of Object.keys(cleanedProfiles)) {
        const prof = cleanedProfiles[uid];
        if (!prof) continue;
        if (prof.accountabilityPartner && fakeUsernames.has(prof.accountabilityPartner.toLowerCase())) {
          delete prof.accountabilityPartner;
        }
        if (isLegacyDefaultProfile(prof)) {
          prof.age = 0;
          prof.gender = '';
          prof.heightCm = 0;
          prof.fitnessLevel = '';
          prof.currentWeightKg = 0;
          prof.goalWeightKg = 0;
          prof.dailyActivity = '';
          if (prof.pinnedWhy === 'Building steady energy and long-term strength, one measured week at a time.') {
            prof.pinnedWhy = '';
          }
        }
      }
      db = {
        ...INITIAL_DB,
        ...parsed,
        profiles: cleanedProfiles,
        measurements: parsed.measurements || [],
        progressPhotos: parsed.progressPhotos || [],
        dailyHabits: parsed.dailyHabits || {},
        cravings: parsed.cravings || [],
        nonScaleVictories: parsed.nonScaleVictories || [],
        pantryItems: parsed.pantryItems || [],
        friends: cleanedFriends,
        sharedRecipes: parsed.sharedRecipes || [],
        posts: parsed.posts || [],
        replies: parsed.replies || [],
        postLikes: parsed.postLikes || {},
        postReports: parsed.postReports || [],
        blockedUsers: parsed.blockedUsers || {},
        followingUsers: parsed.followingUsers || {},
        securityEvents: (parsed.securityEvents || []).filter(
          (ev: any) => Date.now() - (ev.createdAt || 0) <= 90 * 24 * 60 * 60 * 1000
        ),
        recentErrors: (parsed.recentErrors || []).slice(0, 50)
      };
      ensureDevUserExists();
      saveDb();
    } else {
      ensureDevUserExists();
      saveDb();
    }
  } catch (err) {
    console.error('Failed to initialize database, using in-memory fallback', err);
    ensureDevUserExists();
  }
}

let saveTimeout: NodeJS.Timeout | null = null;
function saveDb() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    try {
      const tmpFile = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), 'utf-8');
      fs.renameSync(tmpFile, DB_FILE);
    } catch (err) {
      console.error('Error persisting database:', err);
    }
  }, 100);
}

initDb();

// SSE Sync Broadcast Hub
type SseClient = {
  id: string;
  userId: string;
  res: any;
};

const sseClients: SseClient[] = [];

export function registerSseClient(userId: string, res: any): () => void {
  const clientId = crypto.randomUUID();
  sseClients.push({ id: clientId, userId, res });

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  return () => {
    const idx = sseClients.findIndex(c => c.id === clientId);
    if (idx !== -1) {
      sseClients.splice(idx, 1);
    }
  };
}

export function broadcastSync(userId: string, action: string, data?: any) {
  const payload = JSON.stringify({ type: 'sync', action, data, timestamp: Date.now() });
  for (const client of sseClients) {
    if (client.userId === userId) {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch (err) {
        // Client might have closed
      }
    }
  }
}

// Helper to estimate micronutrients when not explicitly supplied
function enrichMicronutrients(entry: Partial<FoodItem>): {
  fiber: number;
  sugar: number;
  sodium: number;
  iron: number;
  calcium: number;
  vitaminD: number;
} {
  const nameLower = (entry.name || '').toLowerCase();
  const carbs = Number(entry.carbs || 0);
  const protein = Number(entry.protein || 0);
  const calories = Number(entry.calories || 0);

  const isWholeGrainOrVeg = /oat|berry|blueberr|broccoli|spinach|kale|bean|lentil|quinoa|brown rice|toast|sourdough|apple|banana|avocado|salad|veg/i.test(nameLower);
  const isSweet = /honey|sugar|chocolate|cookie|cake|juice|soda|syrup|jam|yogurt|berry|banana|fruit/i.test(nameLower);
  const isDairy = /milk|yogurt|cheese|whey|cottage|kefir/i.test(nameLower);
  const isIronRich = /beef|steak|spinach|lentil|egg|chicken|turkey|tofu|oats|beans/i.test(nameLower);
  const isVitDRich = /salmon|egg|milk|tuna|mushroom|sardine|yogurt/i.test(nameLower);

  const fiber = entry.fiber !== undefined
    ? Number(entry.fiber)
    : Math.round((isWholeGrainOrVeg ? Math.max(2.5, carbs * 0.16) : carbs * 0.05) * 10) / 10;

  const sugar = entry.sugar !== undefined
    ? Number(entry.sugar)
    : Math.round((isSweet ? Math.max(4, carbs * 0.35) : carbs * 0.1) * 10) / 10;

  const sodium = entry.sodium !== undefined
    ? Number(entry.sodium)
    : Math.round(calories * 1.15);

  const iron = entry.iron !== undefined
    ? Number(entry.iron)
    : Math.round((isIronRich ? Math.max(1.8, protein * 0.11) : Math.max(0.4, calories * 0.003)) * 10) / 10;

  const calcium = entry.calcium !== undefined
    ? Number(entry.calcium)
    : Math.round(isDairy ? Math.max(180, calories * 0.75) : Math.max(25, calories * 0.12));

  const vitaminD = entry.vitaminD !== undefined
    ? Number(entry.vitaminD)
    : Math.round((isVitDRich ? Math.max(2.5, protein * 0.18) : 0.4) * 10) / 10;

  return { fiber, sugar, sodium, iron, calcium, vitaminD };
}

// ------------------- AUTH & USERS -------------------
function createEmptyProfile(name: string, username: string): UserProfile {
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

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(`caloriq_salt_${password}`).digest('hex');
}

function hashCybr53(salted: string, lengthSeed: number): string {
  let h1 = 0xdeadbeef ^ lengthSeed;
  let h2 = 0x41c6ce57 ^ lengthSeed;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function getAllPasswordCandidateHashes(password: string): string[] {
  const raw = String(password ?? '');
  const trimmed = raw.trim();
  const candidates = new Set<string>();
  for (const variant of [raw, trimmed]) {
    candidates.add(hashPassword(variant));
    candidates.add(crypto.createHash('sha256').update(variant).digest('hex'));
    candidates.add(hashCybr53(`caloriq_standalone_${variant}`, variant.length));
    candidates.add(hashCybr53(`caloriq_client_${variant}`, variant.length));
    candidates.add(variant);
  }
  return Array.from(candidates);
}

export function constantTimeHashEqual(hashA: string, hashB: string): boolean {
  const bufA = crypto.createHash('sha256').update(String(hashA)).digest();
  const bufB = crypto.createHash('sha256').update(String(hashB)).digest();
  return crypto.timingSafeEqual(bufA, bufB) && hashA.length === hashB.length;
}

function matchesStoredPasswordHash(storedHash: string | undefined, plainPassword: string): boolean {
  if (!storedHash) return false;
  const candidates = getAllPasswordCandidateHashes(plainPassword);
  let matched = false;
  for (const candidate of candidates) {
    if (constantTimeHashEqual(storedHash, candidate)) {
      matched = true;
    }
  }
  return matched;
}

export function createGuestUser(): UserRow {
  const id = `guest_${crypto.randomUUID()}`;
  const user: UserRow = {
    id,
    isGuest: true,
    createdAt: Date.now(),
    lastLoginAt: Date.now()
  };
  db.users[id] = user;
  db.profiles[id] = createEmptyProfile('Guest User', `caloriq_${id.slice(6, 11)}`);
  db.userXp[id] = { xp: 0, badges: [] };
  saveDb();
  return user;
}

export function fixDuplicateHouseflyAccounts(): void {
  const houseflyUsers = Object.values(db.users).filter((u) => {
    const uName = (u.username || '').trim().replace(/^@/, '').toLowerCase();
    const pName = (db.profiles[u.id]?.username || '').trim().replace(/^@/, '').toLowerCase();
    return uName === DEV_USERNAME || pName === DEV_USERNAME;
  });

  if (houseflyUsers.length > 0) {
    let changed = false;
    for (const u of houseflyUsers) {
      const hasWholeMilk = (db.diaryEntries || []).some(
        (e) => e.userId === u.id && (/milk/i.test(e.name || '') || /milk/i.test((e as any).foodName || '') || /milk/i.test((e as any).note || ''))
      );
      if (hasWholeMilk) {
        // Set its isDev flag to false. Do NOT delete the account. Do NOT touch its diary, weight log, profile, or any other data.
        if (u.isDev !== false) {
          u.isDev = false;
          changed = true;
        }
        if (db.profiles[u.id] && db.profiles[u.id].isDev !== false) {
          db.profiles[u.id].isDev = false;
          changed = true;
        }
      }
    }

    // Leave the other "housefly" account as isDev = true.
    const nonMilkHousefly = houseflyUsers.find((u) => {
      const hasWholeMilk = (db.diaryEntries || []).some(
        (e) => e.userId === u.id && (/milk/i.test(e.name || '') || /milk/i.test((e as any).foodName || '') || /milk/i.test((e as any).note || ''))
      );
      return !hasWholeMilk;
    });

    if (nonMilkHousefly) {
      if (nonMilkHousefly.isDev !== true) {
        nonMilkHousefly.isDev = true;
        changed = true;
      }
      if (db.profiles[nonMilkHousefly.id] && db.profiles[nonMilkHousefly.id].isDev !== true) {
        db.profiles[nonMilkHousefly.id].isDev = true;
        changed = true;
      }
    }

    if (changed) {
      saveDb();
    }
  }
}

export function isUsernameTaken(username: string): boolean {
  const norm = username.trim().replace(/^@/, '').toLowerCase();
  if (!norm) return false;
  if (norm === DEV_USERNAME) return true;
  for (const u of Object.values(db.users)) {
    if (u.username && u.username.trim().replace(/^@/, '').toLowerCase() === norm) {
      return true;
    }
    const prof = db.profiles[u.id];
    if (prof?.username && prof.username.trim().replace(/^@/, '').toLowerCase() === norm) {
      return true;
    }
    if (u.email && (u.email.toLowerCase() === norm || u.email.toLowerCase().split('@')[0] === norm)) {
      return true;
    }
  }
  return false;
}

export function findUserById(id: string, emailHint?: string): UserRow | undefined {
  fixDuplicateHouseflyAccounts();
  if (id === 'usr_dev_housefly') {
    return ensureDevUserExists();
  }
  if (db.users[id]) {
    return db.users[id];
  }
  const cleanHint = emailHint ? emailHint.trim().replace(/^@/, '') : '';
  const isAutoGuestHint = /^caloriq_[a-z0-9_]+$/i.test(cleanHint);
  if (cleanHint && !isAutoGuestHint) {
    if (
      cleanHint.toLowerCase() === DEV_USERNAME ||
      cleanHint.toLowerCase() === 'housefly@mail2world.com'
    ) {
      return ensureDevUserExists();
    }
    const byUsername = findUserByUsername(cleanHint);
    if (byUsername) {
      return byUsername;
    }
    const cleanEmail = cleanHint.toLowerCase();
    const byEmail = Object.values(db.users).find(u => u.email === cleanEmail);
    if (byEmail) {
      return byEmail;
    }
  }
  if (id && (id.startsWith('usr_') || id.startsWith('guest_'))) {
    const isGuest = id.startsWith('guest_') || isAutoGuestHint || id.startsWith('usr_caloriq_');
    const isEmail = cleanHint.includes('@');
    const user: UserRow = {
      id,
      username: !isGuest && cleanHint && !isEmail ? cleanHint : undefined,
      email: !isGuest && cleanHint && isEmail ? cleanHint.toLowerCase() : undefined,
      isGuest,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      trustedDevices: []
    };
    db.users[id] = user;
    if (!db.profiles[id]) {
      const defaultUsername = cleanHint
        ? cleanHint.split('@')[0].replace(/[^a-z0-9_]/gi, '_')
        : `caloriq_${id.slice(0, 10).replace(/[^a-z0-9_]/gi, '_')}`;
      db.profiles[id] = createEmptyProfile(isGuest ? 'Guest User' : defaultUsername, defaultUsername);
    }
    if (!db.userXp[id]) {
      db.userXp[id] = { xp: 0, badges: [] };
    }
    saveDb();
    return user;
  }
  return undefined;
}

export function ensureDevUserExists(): UserRow {
  fixDuplicateHouseflyAccounts();

  const defaultHash = hashPassword('changeme123');
  const legacyDefaultHash = hashPassword('CalorIQ-Dev-2026!');
  let devUser = Object.values(db.users).find((u) => {
    const isHousefly =
      (u.username && u.username.toLowerCase() === DEV_USERNAME) ||
      (db.profiles[u.id]?.username && db.profiles[u.id].username!.toLowerCase() === DEV_USERNAME) ||
      (u.email && u.email.toLowerCase() === 'housefly@mail2world.com');
    if (!isHousefly && !u.isDev) return false;
    const hasWholeMilk = (db.diaryEntries || []).some(
      (e) => e.userId === u.id && /milk/i.test(e.name)
    );
    if (hasWholeMilk) return false;
    return true;
  });

  if (devUser) {
    devUser.username = DEV_USERNAME;
    devUser.isDev = true;
    devUser.isGuest = false;
    if (!devUser.passwordHash || constantTimeHashEqual(devUser.passwordHash, legacyDefaultHash)) {
      devUser.passwordHash = defaultHash;
    }
  } else {
    const id = 'usr_dev_housefly';
    devUser = {
      id,
      username: DEV_USERNAME,
      passwordHash: defaultHash,
      isGuest: false,
      isDev: true,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      trustedDevices: []
    };
    db.users[id] = devUser;
  }

  for (const u of Object.values(db.users)) {
    if (u.id !== devUser.id) {
      const hasWholeMilk = (db.diaryEntries || []).some(
        (e) => e.userId === u.id && /milk/i.test(e.name)
      );
      if (hasWholeMilk || u.username?.toLowerCase() !== DEV_USERNAME) {
        u.isDev = false;
        if (db.profiles[u.id]) {
          db.profiles[u.id].isDev = false;
        }
      }
    }
  }

  if (!db.profiles[devUser.id]) {
    db.profiles[devUser.id] = {
      ...createEmptyProfile(DEV_USERNAME, DEV_USERNAME),
      isDev: true,
      signupComplete: true
    };
  } else {
    db.profiles[devUser.id].username = DEV_USERNAME;
    db.profiles[devUser.id].isDev = true;
    db.profiles[devUser.id].signupComplete = true;
    if (!db.profiles[devUser.id].name) {
      db.profiles[devUser.id].name = DEV_USERNAME;
    }
  }

  if (!db.userXp[devUser.id]) {
    db.userXp[devUser.id] = { xp: 0, badges: [] };
  }

  return devUser;
}

export function getDevSetupStatus(): {
  exists: boolean;
  devUserExists: boolean;
  isSetupComplete: boolean;
  username: string;
  isDev: boolean;
} {
  const devUser = Object.values(db.users).find(
    (u) =>
      !u.isGuest &&
      u.isDev === true &&
      typeof u.username === 'string' &&
      u.username.trim().replace(/^@/, '').toLowerCase() === DEV_USERNAME
  );
  const exists = Boolean(devUser);
  return {
    exists,
    devUserExists: exists,
    isSetupComplete: exists,
    username: DEV_USERNAME,
    isDev: exists
  };
}

export function setupDevAccount(
  password: string,
  deviceToken: string,
  browserSig: string,
  guestIdToMigrate?: string
): UserRow {
  const devUser = ensureDevUserExists();
  const pwHash = hashPassword(password);

  devUser.username = DEV_USERNAME;
  devUser.isDev = true;
  devUser.isGuest = false;
  devUser.passwordHash = pwHash;
  devUser.devDeviceToken = deviceToken;
  devUser.devBrowserSig = browserSig;
  devUser.lastLoginAt = Date.now();

  if (guestIdToMigrate && guestIdToMigrate !== devUser.id && db.users[guestIdToMigrate]) {
    migrateGuestData(guestIdToMigrate, devUser.id);
  }

  if (!db.profiles[devUser.id]) {
    db.profiles[devUser.id] = {
      ...createEmptyProfile(DEV_USERNAME, DEV_USERNAME),
      isDev: true,
      signupComplete: true
    };
  } else {
    db.profiles[devUser.id].username = DEV_USERNAME;
    db.profiles[devUser.id].isDev = true;
    db.profiles[devUser.id].signupComplete = true;
  }

  saveDb();
  return devUser;
}

export function autoLoginDevAccount(deviceToken?: string, browserSig?: string): UserRow {
  const devUser = ensureDevUserExists();
  if (deviceToken) {
    devUser.devDeviceToken = deviceToken;
  }
  if (browserSig) {
    devUser.devBrowserSig = browserSig;
  }
  devUser.lastLoginAt = Date.now();
  if (db.profiles[devUser.id]) {
    db.profiles[devUser.id].isDev = true;
    db.profiles[devUser.id].username = DEV_USERNAME;
  }
  saveDb();
  return devUser;
}

export function findUserByUsername(username: string): UserRow | undefined {
  fixDuplicateHouseflyAccounts();
  const norm = username.trim().replace(/^@/, '').toLowerCase();
  if (!norm) return undefined;
  return Object.values(db.users).find(u => {
    if (u.isGuest) return false;
    if (u.username && u.username.replace(/^@/, '').toLowerCase() === norm) return true;
    const prof = db.profiles[u.id];
    if (prof?.username && prof.username.replace(/^@/, '').toLowerCase() === norm && u.passwordHash) return true;
    return false;
  });
}

export function findUserByEmail(email: string): UserRow | undefined {
  const norm = email.toLowerCase().trim();
  if (!norm) return undefined;
  return Object.values(db.users).find(u => u.email === norm);
}

export function signupUser(usernameOrEmail: string, password: string, guestIdToMigrate?: string): UserRow {
  const trimmed = usernameOrEmail.trim();
  const isEmail = trimmed.includes('@');
  const pwHash = hashPassword(password);

  if (!isEmail) {
    if (isUsernameTaken(trimmed)) {
      const err: any = new Error('That username is taken. Try another.');
      err.reason = 'username_taken';
      throw err;
    }

    const id = `usr_${crypto.randomUUID()}`;
    const user: UserRow = {
      id,
      username: trimmed,
      passwordHash: pwHash,
      isGuest: false,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      trustedDevices: []
    };
    db.users[id] = user;
    db.profiles[id] = {
      ...createEmptyProfile(trimmed, trimmed),
      signupComplete: true
    };
    db.userXp[id] = { xp: 0, badges: [] };

    if (guestIdToMigrate && guestIdToMigrate !== user.id && db.users[guestIdToMigrate]) {
      migrateGuestData(guestIdToMigrate, user.id);
      if (db.profiles[user.id]) {
        db.profiles[user.id].username = trimmed;
        if (!db.profiles[user.id].name || db.profiles[user.id].name === 'Guest User') {
          db.profiles[user.id].name = trimmed;
        }
      }
    }

    saveDb();
    return user;
  }

  const norm = trimmed.toLowerCase();
  let user = findUserByEmail(norm);

  if (user) {
    if (password) {
      user.passwordHash = pwHash;
    }
    user.isGuest = false;
    user.lastLoginAt = Date.now();
  } else {
    const id = `usr_${crypto.randomUUID()}`;
    const defaultUsername = norm.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    user = {
      id,
      username: defaultUsername,
      email: norm,
      passwordHash: pwHash,
      isGuest: false,
      createdAt: Date.now(),
      lastLoginAt: Date.now(),
      trustedDevices: []
    };
    db.users[id] = user;
    db.profiles[id] = createEmptyProfile('', defaultUsername);
    db.userXp[id] = { xp: 0, badges: [] };
  }

  if (guestIdToMigrate && guestIdToMigrate !== user.id && db.users[guestIdToMigrate]) {
    migrateGuestData(guestIdToMigrate, user.id);
  }

  saveDb();
  return user;
}

export function resetUserPassword(emailOrUsername: string, newPassword: string, guestIdToMigrate?: string): UserRow {
  const norm = emailOrUsername.trim();
  const pwHash = hashPassword(newPassword);
  let user = findUserByUsername(norm) || findUserByEmail(norm);

  if (!user) {
    return signupUser(norm, newPassword, guestIdToMigrate);
  }

  user.passwordHash = pwHash;
  user.lastLoginAt = Date.now();

  if (guestIdToMigrate && guestIdToMigrate !== user.id && db.users[guestIdToMigrate]) {
    migrateGuestData(guestIdToMigrate, user.id);
  }

  saveDb();
  return user;
}

export function verifyUserCredentials(usernameOrEmail: string, password: string): {
  valid: boolean;
  reason?: 'unknown_user' | 'unknown_email' | 'wrong_password';
  user?: UserRow;
} {
  fixDuplicateHouseflyAccounts();
  const trimmed = usernameOrEmail.trim().replace(/^@/, '');
  const pwHash = hashPassword(password);
  
  const matchingUsers = Object.values(db.users).filter((u) => {
    if (u.isGuest) return false;
    const uName = (u.username || '').trim().replace(/^@/, '').toLowerCase();
    const pName = (db.profiles[u.id]?.username || '').trim().replace(/^@/, '').toLowerCase();
    const email = (u.email || '').trim().toLowerCase();
    const target = trimmed.toLowerCase();
    return uName === target || pName === target || email === target;
  });

  if (matchingUsers.length === 0) {
    // Still run constant-time comparison against dummy hash to prevent timing enumeration
    constantTimeHashEqual(pwHash, hashPassword('dummy_constant_time_check_password'));
    return { valid: false, reason: 'unknown_user' };
  }

  for (const user of matchingUsers) {
    if (!user.passwordHash && password && password.length >= 1) {
      user.passwordHash = pwHash;
      saveDb();
      return { valid: true, user };
    }

    if (user.passwordHash && matchesStoredPasswordHash(user.passwordHash, password)) {
      if (!constantTimeHashEqual(user.passwordHash, pwHash)) {
        user.passwordHash = pwHash;
        saveDb();
      }
      return { valid: true, user };
    }
  }

  return { valid: false, reason: 'wrong_password', user: matchingUsers[0] };
}

export function loginUser(usernameOrEmail: string, password: string, guestIdToMigrate?: string): UserRow {
  const check = verifyUserCredentials(usernameOrEmail, password);
  if (!check.valid || !check.user) {
    const err: any = new Error('Wrong username or password.');
    err.reason = check.reason || 'invalid_credentials';
    throw err;
  }

  const user = check.user;
  user.lastLoginAt = Date.now();

  if (guestIdToMigrate && guestIdToMigrate !== user.id && db.users[guestIdToMigrate]) {
    migrateGuestData(guestIdToMigrate, user.id);
  }

  saveDb();
  return user;
}

function migrateGuestData(guestId: string, targetUserId: string) {
  for (const entry of db.diaryEntries) {
    if (entry.userId === guestId) entry.userId = targetUserId;
  }
  for (const key of Object.keys(db.waterEntries)) {
    if (key.startsWith(`${guestId}:`)) {
      const date = key.split(':')[1];
      const val = db.waterEntries[key];
      db.waterEntries[`${targetUserId}:${date}`] = Math.max(val, db.waterEntries[`${targetUserId}:${date}`] || 0);
      delete db.waterEntries[key];
    }
  }
  for (const ex of db.exerciseEntries) {
    if (ex.userId === guestId) ex.userId = targetUserId;
  }
  for (const wt of db.weightEntries) {
    if (wt.userId === guestId) wt.userId = targetUserId;
  }
  for (const m of db.measurements) {
    if (m.userId === guestId) m.userId = targetUserId;
  }
  for (const p of db.progressPhotos) {
    if (p.userId === guestId) p.userId = targetUserId;
  }
  for (const key of Object.keys(db.dailyHabits)) {
    if (key.startsWith(`${guestId}:`)) {
      const date = key.split(':')[1];
      db.dailyHabits[`${targetUserId}:${date}`] = {
        ...db.dailyHabits[key],
        userId: targetUserId
      };
      delete db.dailyHabits[key];
    }
  }
  for (const c of db.cravings) {
    if (c.userId === guestId) c.userId = targetUserId;
  }
  for (const v of db.nonScaleVictories) {
    if (v.userId === guestId) v.userId = targetUserId;
  }
  for (const pi of db.pantryItems) {
    if (pi.userId === guestId) pi.userId = targetUserId;
  }
  for (const f of db.savedFoods) {
    if (f.userId === guestId) f.userId = targetUserId;
  }
  for (const r of db.savedRecipes) {
    if (r.userId === guestId) r.userId = targetUserId;
  }
  for (const t of db.mealTemplates) {
    if (t.userId === guestId) t.userId = targetUserId;
  }
  if (db.profiles[guestId]) {
    const guestProf = db.profiles[guestId];
    const targetProf = db.profiles[targetUserId];
    const guestHasCustomStats = guestProf.age > 0 && guestProf.heightCm > 0 && guestProf.currentWeightKg > 0;
    if (guestHasCustomStats) {
      db.profiles[targetUserId] = {
        ...guestProf,
        name: targetProf?.name || guestProf.name,
        username: targetProf?.username || guestProf.username
      };
    }
    delete db.profiles[guestId];
  }
  if (db.plans[guestId]) {
    db.plans[targetUserId] = { ...db.plans[guestId], userId: targetUserId };
    delete db.plans[guestId];
  }
  if (db.userXp[guestId]) {
    const existing = db.userXp[targetUserId] || { xp: 0, badges: [] };
    const combinedBadges = Array.from(new Set([...existing.badges, ...db.userXp[guestId].badges]));
    db.userXp[targetUserId] = {
      xp: existing.xp + db.userXp[guestId].xp,
      badges: combinedBadges
    };
    delete db.userXp[guestId];
  }
  delete db.users[guestId];
}

// ------------------- PROFILE & XP & STREAKS -------------------
export function getProfile(userId: string): UserProfile {
  if (!db.profiles[userId]) {
    db.profiles[userId] = createEmptyProfile('User', `user_${userId.slice(0, 6)}`);
    saveDb();
  }
  const user = db.users[userId];
  const isDevAccount = Boolean(user?.isDev && user?.username?.toLowerCase() === DEV_USERNAME);
  db.profiles[userId].isDev = isDevAccount;
  return db.profiles[userId];
}

export function updateProfile(userId: string, updates: Partial<UserProfile>): UserProfile {
  const current = getProfile(userId);
  const user = db.users[userId];
  const isDevAccount = Boolean(user?.isDev && user?.username?.toLowerCase() === DEV_USERNAME);
  const safeUpdates = { ...updates };
  if (!isDevAccount && safeUpdates.username?.toLowerCase().trim() === DEV_USERNAME) {
    delete safeUpdates.username;
  }
  const updated: UserProfile = {
    ...current,
    ...safeUpdates,
    isDev: isDevAccount,
    username: isDevAccount ? DEV_USERNAME : safeUpdates.username ?? current.username
  };
  db.profiles[userId] = updated;
  saveDb();
  broadcastSync(userId, 'profile_updated', updated);
  return updated;
}

function computeConsecutiveStreak(loggedDates: string[], freezeDates: string[]): number {
  const dateSet = new Set([...loggedDates, ...freezeDates]);
  if (dateSet.size === 0) return 0;

  const sorted = Array.from(dateSet).sort();
  let maxStreak = 1;
  let currentStreak = 1;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00').getTime();
    const curr = new Date(sorted[i] + 'T00:00:00').getTime();
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak++;
      if (currentStreak > maxStreak) maxStreak = currentStreak;
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
  }
  return currentStreak;
}

export function getUserStats(userId: string): UserStats {
  const record = db.userXp[userId] || { xp: 0, badges: [] };
  const profile = getProfile(userId);
  const freezes = profile.streakFreezesUsed || [];
  const foodDates = Array.from(new Set(db.diaryEntries.filter(d => d.userId === userId).map(d => d.date)));
  const workoutDates = Array.from(new Set(db.exerciseEntries.filter(e => e.userId === userId).map(e => e.date)));

  const foodStreak = computeConsecutiveStreak(foodDates, freezes);
  const workoutStreak = computeConsecutiveStreak(workoutDates, freezes);
  const level = 1 + Math.floor(record.xp / 100);

  return {
    xp: record.xp,
    level,
    badges: record.badges,
    foodStreak,
    workoutStreak
  };
}

export function addXpAndCheckBadges(userId: string, points: number, reason: string): UserStats {
  if (!db.userXp[userId]) {
    db.userXp[userId] = { xp: 0, badges: [] };
  }
  db.userXp[userId].xp += points;
  const current = db.userXp[userId];
  const newBadges: string[] = [...current.badges];

  if (current.xp >= 50 && !newBadges.includes('50 XP')) newBadges.push('50 XP');
  if (current.xp >= 200 && !newBadges.includes('200 XP')) newBadges.push('200 XP');
  if (current.xp >= 1000 && !newBadges.includes('1000 XP')) newBadges.push('1000 XP');
  if (current.xp >= 5000 && !newBadges.includes('5000 XP')) newBadges.push('5000 XP');

  if (reason === 'food' && !newBadges.includes('First log')) newBadges.push('First log');
  if (reason === 'exercise' && !newBadges.includes('First workout')) newBadges.push('First workout');
  if (reason === 'water' && !newBadges.includes('Hydrated')) newBadges.push('Hydrated');

  const weights = db.weightEntries.filter(w => w.userId === userId);
  if (weights.length >= 1 && !newBadges.includes('First weigh-in')) newBadges.push('First weigh-in');
  if (weights.length >= 7 && !newBadges.includes('Weighed 7 times')) newBadges.push('Weighed 7 times');
  if (weights.length >= 30 && !newBadges.includes('Weighed 30 times')) newBadges.push('Weighed 30 times');

  const profile = getProfile(userId);
  const freezes = profile.streakFreezesUsed || [];
  const dates = Array.from(new Set(db.diaryEntries.filter(d => d.userId === userId).map(d => d.date)));
  const maxStreak = computeConsecutiveStreak(dates, freezes);

  if (maxStreak >= 3 && !newBadges.includes('3-day streak')) newBadges.push('3-day streak');
  if (maxStreak >= 7 && !newBadges.includes('7-day streak')) newBadges.push('7-day streak');
  if (maxStreak >= 30 && !newBadges.includes('30-day streak')) newBadges.push('30-day streak');
  if (maxStreak >= 100 && !newBadges.includes('100-day streak')) newBadges.push('100-day streak');

  current.badges = newBadges;
  saveDb();
  broadcastSync(userId, 'xp_updated', { xp: current.xp, badges: newBadges });
  return getUserStats(userId);
}

// ------------------- DIARY FOOD ENTRIES -------------------
export function getDiaryEntries(userId: string, date: string): FoodItem[] {
  return db.diaryEntries.filter(e => e.userId === userId && e.date === date);
}

export function getAllDiaryEntries(userId: string): FoodItem[] {
  return db.diaryEntries.filter(e => e.userId === userId);
}

export function addDiaryEntry(userId: string, entry: Omit<FoodItem, 'id' | 'userId' | 'createdAt'>): FoodItem {
  const micros = enrichMicronutrients(entry);
  const defaultHour =
    entry.loggedHour !== undefined
      ? entry.loggedHour
      : entry.mealType === 'breakfast'
      ? 8
      : entry.mealType === 'lunch'
      ? 13
      : entry.mealType === 'dinner'
      ? 19
      : 16;

  const item: FoodItem = {
    ...entry,
    ...micros,
    loggedHour: defaultHour,
    id: `food_${crypto.randomUUID()}`,
    userId,
    createdAt: Date.now()
  };
  db.diaryEntries.push(item);

  const existingSaved = db.savedFoods.find(f => f.userId === userId && f.name.toLowerCase() === item.name.toLowerCase());
  if (!existingSaved) {
    db.savedFoods.push({
      id: `saved_${crypto.randomUUID()}`,
      userId,
      name: item.name,
      calories: item.calories,
      carbs: item.carbs,
      fat: item.fat,
      protein: item.protein,
      fiber: item.fiber,
      sugar: item.sugar,
      sodium: item.sodium,
      serving: item.serving || '1 portion',
      createdAt: Date.now()
    });
  }

  addXpAndCheckBadges(userId, 10, 'food');
  saveDb();
  broadcastSync(userId, 'food_added', item);
  return item;
}

export function updateDiaryEntry(userId: string, id: string, updates: Partial<FoodItem>): FoodItem | null {
  const idx = db.diaryEntries.findIndex(e => e.id === id && e.userId === userId);
  if (idx === -1) return null;
  db.diaryEntries[idx] = { ...db.diaryEntries[idx], ...updates };
  saveDb();
  broadcastSync(userId, 'food_updated', db.diaryEntries[idx]);
  return db.diaryEntries[idx];
}

export function deleteDiaryEntry(userId: string, id: string): boolean {
  const idx = db.diaryEntries.findIndex(e => e.id === id && e.userId === userId);
  if (idx !== -1) {
    db.diaryEntries.splice(idx, 1);
    saveDb();
    broadcastSync(userId, 'food_deleted', { id });
    return true;
  }
  return false;
}

export function copyYesterdayMeals(userId: string, targetDate: string, mealType?: MealType): FoodItem[] {
  const yesterdayStr = addDaysLocal(targetDate, -1);

  const yesterdayItems = getDiaryEntries(userId, yesterdayStr).filter(i => !mealType || i.mealType === mealType);
  const created: FoodItem[] = [];

  for (const item of yesterdayItems) {
    const newItem: FoodItem = {
      ...item,
      id: `food_${crypto.randomUUID()}`,
      userId,
      date: targetDate,
      createdAt: Date.now()
    };
    db.diaryEntries.push(newItem);
    created.push(newItem);
  }

  if (created.length > 0) {
    addXpAndCheckBadges(userId, 10, 'food');
    saveDb();
    broadcastSync(userId, 'yesterday_copied', { targetDate, mealType, count: created.length });
  }

  return created;
}

// ------------------- WATER ENTRIES -------------------
export function getWaterGlasses(userId: string, date: string): number {
  return db.waterEntries[`${userId}:${date}`] || 0;
}

export function setWaterGlasses(userId: string, date: string, glasses: number): number {
  const key = `${userId}:${date}`;
  const prev = db.waterEntries[key] || 0;
  db.waterEntries[key] = Math.max(0, glasses);

  if (glasses > prev) {
    addXpAndCheckBadges(userId, 2 * (glasses - prev), 'water');
  }

  saveDb();
  broadcastSync(userId, 'water_updated', { date, glasses: db.waterEntries[key] });
  return db.waterEntries[key];
}

// ------------------- EXERCISE ENTRIES -------------------
export function getExerciseEntries(userId: string, date: string): ExerciseItem[] {
  return db.exerciseEntries.filter(e => e.userId === userId && e.date === date);
}

export function getAllExerciseEntries(userId: string): ExerciseItem[] {
  return db.exerciseEntries.filter(e => e.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
}

export function addExerciseEntry(userId: string, entry: Omit<ExerciseItem, 'id' | 'userId' | 'createdAt'>): ExerciseItem {
  const item: ExerciseItem = {
    ...entry,
    id: `ex_${crypto.randomUUID()}`,
    userId,
    createdAt: Date.now()
  };
  db.exerciseEntries.push(item);
  addXpAndCheckBadges(userId, 15, 'exercise');
  saveDb();
  broadcastSync(userId, 'exercise_added', item);
  return item;
}

export function deleteExerciseEntry(userId: string, id: string): boolean {
  const idx = db.exerciseEntries.findIndex(e => e.id === id && e.userId === userId);
  if (idx !== -1) {
    db.exerciseEntries.splice(idx, 1);
    saveDb();
    broadcastSync(userId, 'exercise_deleted', { id });
    return true;
  }
  return false;
}

// ------------------- WEIGHT ENTRIES -------------------
export function getWeightEntries(userId: string): WeightRecord[] {
  return db.weightEntries.filter(w => w.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
}

export function addWeightEntry(userId: string, date: string, weightKg: number): WeightRecord {
  const existingIdx = db.weightEntries.findIndex(w => w.userId === userId && w.date === date);
  let record: WeightRecord;
  if (existingIdx !== -1) {
    db.weightEntries[existingIdx].weightKg = weightKg;
    record = db.weightEntries[existingIdx];
  } else {
    record = {
      id: `wt_${crypto.randomUUID()}`,
      userId,
      date,
      weightKg,
      createdAt: Date.now()
    };
    db.weightEntries.push(record);
  }

  if (db.profiles[userId]) {
    db.profiles[userId].currentWeightKg = weightKg;
  }

  addXpAndCheckBadges(userId, 20, 'weight');
  saveDb();
  broadcastSync(userId, 'weight_added', record);
  return record;
}

export function deleteWeightEntry(userId: string, id: string): boolean {
  const idx = db.weightEntries.findIndex(w => w.id === id && w.userId === userId);
  if (idx !== -1) {
    db.weightEntries.splice(idx, 1);
    saveDb();
    broadcastSync(userId, 'weight_deleted', { id });
    return true;
  }
  return false;
}

// ------------------- BODY MEASUREMENTS -------------------
export function getBodyMeasurements(userId: string): BodyMeasurement[] {
  return db.measurements.filter(m => m.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
}

export function addBodyMeasurement(userId: string, entry: Omit<BodyMeasurement, 'id' | 'userId' | 'createdAt'>): BodyMeasurement {
  const item: BodyMeasurement = {
    ...entry,
    id: `meas_${crypto.randomUUID()}`,
    userId,
    createdAt: Date.now()
  };
  db.measurements.push(item);
  saveDb();
  broadcastSync(userId, 'measurement_added', item);
  return item;
}

export function deleteBodyMeasurement(userId: string, id: string): boolean {
  const idx = db.measurements.findIndex(m => m.id === id && m.userId === userId);
  if (idx !== -1) {
    db.measurements.splice(idx, 1);
    saveDb();
    broadcastSync(userId, 'measurement_deleted', { id });
    return true;
  }
  return false;
}

// ------------------- PROGRESS PHOTOS -------------------
export function getProgressPhotos(userId: string): ProgressPhoto[] {
  return db.progressPhotos.filter(p => p.userId === userId).sort((a, b) => a.date.localeCompare(b.date));
}

export function addProgressPhoto(userId: string, entry: Omit<ProgressPhoto, 'id' | 'userId' | 'createdAt'>): ProgressPhoto {
  const item: ProgressPhoto = {
    ...entry,
    id: `photo_${crypto.randomUUID()}`,
    userId,
    createdAt: Date.now()
  };
  db.progressPhotos.push(item);
  saveDb();
  broadcastSync(userId, 'photo_added', item);
  return item;
}

export function deleteProgressPhoto(userId: string, id: string): boolean {
  const idx = db.progressPhotos.findIndex(p => p.id === id && p.userId === userId);
  if (idx !== -1) {
    db.progressPhotos.splice(idx, 1);
    saveDb();
    broadcastSync(userId, 'photo_deleted', { id });
    return true;
  }
  return false;
}

// ------------------- DAILY HABITS, CRAVINGS & VICTORIES -------------------
export function getDailyHabitLog(userId: string, date: string): DailyHabitLog {
  const key = `${userId}:${date}`;
  return db.dailyHabits[key] || { userId, date };
}

export function getAllDailyHabitLogs(userId: string): DailyHabitLog[] {
  return Object.values(db.dailyHabits).filter(h => h.userId === userId);
}

export function upsertDailyHabitLog(userId: string, date: string, updates: Partial<DailyHabitLog>): DailyHabitLog {
  const key = `${userId}:${date}`;
  const current = db.dailyHabits[key] || { userId, date };
  const updated: DailyHabitLog = {
    ...current,
    ...updates,
    userId,
    date
  };
  db.dailyHabits[key] = updated;
  saveDb();
  broadcastSync(userId, 'habit_updated', updated);
  return updated;
}

export function getCravings(userId: string): CravingLog[] {
  return db.cravings.filter(c => c.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function addCraving(userId: string, entry: Omit<CravingLog, 'id' | 'userId' | 'createdAt'>): CravingLog {
  const item: CravingLog = {
    ...entry,
    id: `crav_${crypto.randomUUID()}`,
    userId,
    createdAt: Date.now()
  };
  db.cravings.push(item);
  saveDb();
  broadcastSync(userId, 'craving_added', item);
  return item;
}

export function deleteCraving(userId: string, id: string): boolean {
  const idx = db.cravings.findIndex(c => c.id === id && c.userId === userId);
  if (idx !== -1) {
    db.cravings.splice(idx, 1);
    saveDb();
    return true;
  }
  return false;
}

export function getNonScaleVictories(userId: string): NonScaleVictory[] {
  return db.nonScaleVictories.filter(v => v.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function addNonScaleVictory(userId: string, date: string, text: string): NonScaleVictory {
  const item: NonScaleVictory = {
    id: `nsv_${crypto.randomUUID()}`,
    userId,
    date,
    text: text.trim(),
    createdAt: Date.now()
  };
  db.nonScaleVictories.push(item);
  addXpAndCheckBadges(userId, 15, 'victory');
  saveDb();
  broadcastSync(userId, 'nsv_added', item);
  return item;
}

export function deleteNonScaleVictory(userId: string, id: string): boolean {
  const idx = db.nonScaleVictories.findIndex(v => v.id === id && v.userId === userId);
  if (idx !== -1) {
    db.nonScaleVictories.splice(idx, 1);
    saveDb();
    return true;
  }
  return false;
}

// ------------------- PANTRY & LEFTOVERS -------------------
export function getPantryItems(userId: string): PantryItem[] {
  return db.pantryItems.filter(p => p.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function addPantryItem(userId: string, entry: Omit<PantryItem, 'id' | 'userId' | 'createdAt'>): PantryItem {
  const item: PantryItem = {
    ...entry,
    id: `pantry_${crypto.randomUUID()}`,
    userId,
    createdAt: Date.now()
  };
  db.pantryItems.push(item);
  saveDb();
  broadcastSync(userId, 'pantry_added', item);
  return item;
}

export function deletePantryItem(userId: string, id: string): boolean {
  const idx = db.pantryItems.findIndex(p => p.id === id && p.userId === userId);
  if (idx !== -1) {
    db.pantryItems.splice(idx, 1);
    saveDb();
    return true;
  }
  return false;
}

// ------------------- SOCIAL & FRIENDS -------------------
export function getFriends(userId: string): FriendRecord[] {
  return db.friends.filter(f => f.userId === userId);
}

export function addFriend(userId: string, username: string, isPartner?: boolean): FriendRecord {
  const cleanUser = username.replace(/^@/, '').trim().toLowerCase();
  const display = cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1).replace(/_/g, ' ');
  // Look up real user streak if that account exists in db
  const matchedUserId = Object.keys(db.profiles).find(
    uid => (db.profiles[uid]?.username || '').toLowerCase() === cleanUser
  );
  const realStats = matchedUserId ? getUserStats(matchedUserId) : null;
  const item: FriendRecord = {
    id: `fr_${crypto.randomUUID()}`,
    userId,
    username: cleanUser,
    displayName: matchedUserId ? db.profiles[matchedUserId].name : display,
    streakDays: realStats?.foodStreak ?? 0,
    daysOnTargetThisWeek: 0,
    waterDaysCompleted: 0,
    isPartner: Boolean(isPartner),
    createdAt: Date.now()
  };
  if (isPartner) {
    for (const f of db.friends) {
      if (f.userId === userId) f.isPartner = false;
    }
  }
  db.friends.push(item);
  saveDb();
  return item;
}

export function removeFriend(userId: string, id: string): boolean {
  const idx = db.friends.findIndex(f => f.id === id && f.userId === userId);
  if (idx !== -1) {
    db.friends.splice(idx, 1);
    saveDb();
    return true;
  }
  return false;
}

export function shareRecipeToFriend(
  userId: string,
  payload: Omit<SharedRecipeRecord, 'id' | 'userId' | 'createdAt'>
): SharedRecipeRecord {
  const rec: SharedRecipeRecord = {
    ...payload,
    id: `srec_${crypto.randomUUID()}`,
    userId,
    createdAt: Date.now()
  };
  db.sharedRecipes.push(rec);
  saveDb();
  return rec;
}

export function getSharedRecipes(userId: string): SharedRecipeRecord[] {
  return db.sharedRecipes.filter(s => s.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

// ------------------- SAVED FOODS & RECIPES -------------------
export function getSavedFoods(userId: string): SavedFood[] {
  return db.savedFoods.filter(f => f.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function addSavedFood(userId: string, food: Omit<SavedFood, 'id' | 'userId' | 'createdAt'>): SavedFood {
  const item: SavedFood = {
    ...food,
    id: `saved_${crypto.randomUUID()}`,
    userId,
    createdAt: Date.now()
  };
  db.savedFoods.push(item);
  saveDb();
  broadcastSync(userId, 'saved_food_added', item);
  return item;
}

export function deleteSavedFood(userId: string, id: string): boolean {
  const idx = db.savedFoods.findIndex(f => f.id === id && f.userId === userId);
  if (idx !== -1) {
    db.savedFoods.splice(idx, 1);
    saveDb();
    broadcastSync(userId, 'saved_food_deleted', { id });
    return true;
  }
  return false;
}

export function getSavedRecipes(userId: string): SavedRecipe[] {
  return db.savedRecipes.filter(r => r.userId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

export function findSavedRecipeByName(userId: string, name: string): SavedRecipe | undefined {
  const norm = name.toLowerCase().trim();
  return db.savedRecipes.find(r => r.userId === userId && r.name.toLowerCase().trim() === norm);
}

export function saveRecipe(userId: string, recipe: Omit<SavedRecipe, 'id' | 'userId' | 'createdAt'>): SavedRecipe {
  const norm = recipe.name.toLowerCase().trim();
  const existingIdx = db.savedRecipes.findIndex(r => r.userId === userId && r.name.toLowerCase().trim() === norm);

  let item: SavedRecipe;
  if (existingIdx !== -1) {
    item = {
      ...recipe,
      id: db.savedRecipes[existingIdx].id,
      userId,
      createdAt: Date.now()
    };
    db.savedRecipes[existingIdx] = item;
  } else {
    item = {
      ...recipe,
      id: `recipe_${crypto.randomUUID()}`,
      userId,
      createdAt: Date.now()
    };
    db.savedRecipes.push(item);
  }

  saveDb();
  broadcastSync(userId, 'recipe_saved', item);
  return item;
}

export function deleteSavedRecipe(userId: string, id: string): boolean {
  const idx = db.savedRecipes.findIndex(r => r.id === id && r.userId === userId);
  if (idx !== -1) {
    db.savedRecipes.splice(idx, 1);
    saveDb();
    broadcastSync(userId, 'recipe_deleted', { id });
    return true;
  }
  return false;
}

// ------------------- MEAL TEMPLATES -------------------
export function getMealTemplates(userId: string): MealTemplate[] {
  return db.mealTemplates.filter(t => t.userId === userId);
}

export function saveMealTemplate(userId: string, name: string, date: string): MealTemplate {
  const dayItems = getDiaryEntries(userId, date);
  const template: MealTemplate = {
    id: `tmpl_${crypto.randomUUID()}`,
    userId,
    name,
    items: dayItems.map(item => ({
      mealType: item.mealType,
      name: item.name,
      calories: item.calories,
      carbs: item.carbs,
      fat: item.fat,
      protein: item.protein,
      serving: item.serving
    })),
    createdAt: Date.now()
  };

  db.mealTemplates.push(template);
  saveDb();
  broadcastSync(userId, 'template_saved', template);
  return template;
}

export function applyMealTemplate(userId: string, templateId: string, targetDate: string): FoodItem[] {
  const template = db.mealTemplates.find(t => t.id === templateId && t.userId === userId);
  if (!template) return [];

  const created: FoodItem[] = [];
  for (const item of template.items) {
    const micros = enrichMicronutrients(item);
    const newItem: FoodItem = {
      id: `food_${crypto.randomUUID()}`,
      userId,
      date: targetDate,
      mealType: item.mealType,
      name: item.name,
      calories: item.calories,
      carbs: item.carbs,
      fat: item.fat,
      protein: item.protein,
      ...micros,
      serving: item.serving,
      source: 'saved',
      createdAt: Date.now()
    };
    db.diaryEntries.push(newItem);
    created.push(newItem);
  }

  saveDb();
  broadcastSync(userId, 'template_applied', { count: created.length });
  return created;
}

export function deleteMealTemplate(userId: string, id: string): boolean {
  const idx = db.mealTemplates.findIndex(t => t.id === id && t.userId === userId);
  if (idx !== -1) {
    db.mealTemplates.splice(idx, 1);
    saveDb();
    broadcastSync(userId, 'template_deleted', { id });
    return true;
  }
  return false;
}

export function restoreMealTemplate(userId: string, template: Omit<MealTemplate, 'id' | 'userId' | 'createdAt'>): MealTemplate {
  const restored: MealTemplate = {
    id: `tmpl_${crypto.randomUUID()}`,
    userId,
    name: template.name,
    items: Array.isArray(template.items) ? template.items : [],
    createdAt: Date.now()
  };
  db.mealTemplates.push(restored);
  saveDb();
  broadcastSync(userId, 'template_saved', restored);
  return restored;
}

// ------------------- PLANS -------------------
export function getPlan(userId: string): WeekPlan | undefined {
  return db.plans[userId];
}

export function savePlan(userId: string, plan: WeekPlan) {
  db.plans[userId] = plan;
  saveDb();
  broadcastSync(userId, 'plan_saved', plan);
}

// ------------------- SETTINGS (USDA KEY) -------------------
export function setUsdaApiKey(key: string) {
  db.settings.usdaApiKey = key.trim();
  saveDb();
}

export function getUsdaApiKey(): string | undefined {
  return db.settings.usdaApiKey || process.env.USDA_API_KEY;
}

export function hasUsdaApiKey(): boolean {
  const key = getUsdaApiKey();
  return Boolean(key && key.length > 5);
}

// ------------------- EXPORT & CLEAR DATA -------------------
export function exportUserData(userId: string) {
  const userWater: Record<string, number> = {};
  for (const [k, v] of Object.entries(db.waterEntries)) {
    if (k.startsWith(`${userId}:`)) {
      userWater[k.split(':')[1]] = v;
    }
  }
  return {
    schemaVersion: '1.0.0',
    profile: getProfile(userId),
    stats: getUserStats(userId),
    diaryEntries: getAllDiaryEntries(userId),
    diary: getAllDiaryEntries(userId),
    exerciseEntries: db.exerciseEntries.filter(e => e.userId === userId),
    exercises: db.exerciseEntries.filter(e => e.userId === userId),
    weightEntries: getWeightEntries(userId),
    weights: getWeightEntries(userId),
    waterEntries: userWater,
    measurements: getBodyMeasurements(userId),
    cravings: getCravings(userId),
    nonScaleVictories: getNonScaleVictories(userId),
    pantry: getPantryItems(userId),
    savedFoods: getSavedFoods(userId),
    savedRecipes: getSavedRecipes(userId),
    mealTemplates: getMealTemplates(userId),
    plan: getPlan(userId),
    exportedAt: new Date().toISOString()
  };
}

export function clearUserData(userId: string) {
  db.diaryEntries = db.diaryEntries.filter(e => e.userId !== userId);
  db.exerciseEntries = db.exerciseEntries.filter(e => e.userId !== userId);
  db.weightEntries = db.weightEntries.filter(w => w.userId !== userId);
  db.measurements = db.measurements.filter(m => m.userId !== userId);
  db.progressPhotos = db.progressPhotos.filter(p => p.userId !== userId);
  db.cravings = db.cravings.filter(c => c.userId !== userId);
  db.nonScaleVictories = db.nonScaleVictories.filter(v => v.userId !== userId);
  db.pantryItems = db.pantryItems.filter(p => p.userId !== userId);
  db.savedFoods = db.savedFoods.filter(f => f.userId !== userId);
  db.savedRecipes = db.savedRecipes.filter(r => r.userId !== userId);
  db.mealTemplates = db.mealTemplates.filter(t => t.userId !== userId);
  delete db.plans[userId];

  for (const k of Object.keys(db.waterEntries)) {
    if (k.startsWith(`${userId}:`)) {
      delete db.waterEntries[k];
    }
  }
  for (const k of Object.keys(db.dailyHabits)) {
    if (k.startsWith(`${userId}:`)) {
      delete db.dailyHabits[k];
    }
  }

  db.userXp[userId] = { xp: 0, badges: [] };
  saveDb();
  broadcastSync(userId, 'data_cleared');
}

// #36 GDPR right to be forgotten: account deletion wipes everything, no backups, no shadow copies
export function deleteUserAccount(userId: string) {
  clearUserData(userId);
  db.friends = db.friends.filter(f => f.userId !== userId);
  db.sharedRecipes = db.sharedRecipes.filter(s => s.userId !== userId);
  userSessionsStore = userSessionsStore.filter(s => s.userId !== userId);
  bugReportsStore = bugReportsStore.filter(b => b.userId !== userId);
  delete db.profiles[userId];
  delete db.userXp[userId];
  delete db.users[userId];
  saveDb();
}

// ------------------- SECURITY SANITIZATION (#26) -------------------
export function sanitizeString(input: unknown, maxLen = 1000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLen);
}

export function sanitizeObjectStrings<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    return sanitizeString(obj, 4000) as unknown as T;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObjectStrings(item)) as unknown as T;
  }
  if (typeof obj === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj as Record<string, any>)) {
      if (
        k === 'image' ||
        k === 'base64Image' ||
        k === 'photoUrl' ||
        k === 'imageUrl' ||
        k === 'password' ||
        k === 'confirmPassword' ||
        k === 'currentPassword' ||
        k === 'newPassword'
      ) {
        out[k] = v;
      } else {
        out[k] = sanitizeObjectStrings(v);
      }
    }
    return out as T;
  }
  return obj;
}

// ------------------- ACCOUNT MANAGEMENT & SESSIONS (#31, #32, #49, #50, #52, #53, #54, #58) -------------------
export interface UserSessionRecord {
  id: string;
  userId: string;
  deviceName: string;
  city: string;
  ipHash: string;
  createdAt: number;
  lastActiveAt: number;
}

let userSessionsStore: UserSessionRecord[] = [];

export function recordUserSession(userId: string, userAgent = '', city = 'London, UK', ip = '127.0.0.1'): UserSessionRecord {
  const ua = userAgent.toLowerCase();
  let deviceName = 'Desktop Browser';
  if (ua.includes('iphone')) deviceName = 'iPhone Safari';
  else if (ua.includes('ipad')) deviceName = 'iPad Safari';
  else if (ua.includes('android')) deviceName = 'Android Chrome';
  else if (ua.includes('macintosh') && ua.includes('safari') && !ua.includes('chrome')) deviceName = 'macOS Safari';
  else if (ua.includes('firefox')) deviceName = 'Desktop Firefox';
  else if (ua.includes('chrome')) deviceName = 'Desktop Chrome';

  const ipHash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 10);
  const existing = userSessionsStore.find(s => s.userId === userId && s.deviceName === deviceName && s.ipHash === ipHash);
  if (existing) {
    existing.lastActiveAt = Date.now();
    return existing;
  }

  const session: UserSessionRecord = {
    id: `sess_${crypto.randomUUID()}`,
    userId,
    deviceName,
    city: city || 'Local Network',
    ipHash,
    createdAt: Date.now(),
    lastActiveAt: Date.now()
  };
  userSessionsStore.push(session);
  return session;
}

export function getUserSessions(userId: string, currentUserAgent = ''): UserSessionRecord[] {
  const list = userSessionsStore.filter(s => s.userId === userId).sort((a, b) => b.lastActiveAt - a.lastActiveAt);
  if (list.length === 0) {
    return [recordUserSession(userId, currentUserAgent)];
  }
  return list;
}

export function revokeUserSession(userId: string, sessionId: string): boolean {
  const before = userSessionsStore.length;
  userSessionsStore = userSessionsStore.filter(s => !(s.userId === userId && s.id === sessionId));
  return userSessionsStore.length < before;
}

export function revokeAllUserSessions(userId: string): number {
  const count = userSessionsStore.filter(s => s.userId === userId).length;
  userSessionsStore = userSessionsStore.filter(s => s.userId !== userId);
  return count;
}

export function verifyUserPassword(userId: string, password: string): boolean {
  const user = db.users[userId] || findUserById(userId);
  if (!user) return false;
  if (user.isGuest || !user.passwordHash) return true;
  return matchesStoredPasswordHash(user.passwordHash, password);
}

export function changeUserPassword(userId: string, currentPassword: string, newPassword: string): void {
  const user = db.users[userId] || findUserById(userId);
  if (!user || user.isGuest) {
    throw new Error('Only registered accounts can change their password.');
  }
  if (user.passwordHash && !matchesStoredPasswordHash(user.passwordHash, currentPassword)) {
    throw new Error('Current password is incorrect.');
  }
  user.passwordHash = hashPassword(newPassword);
  saveDb();
}

export function changeUsername(userId: string, newUsername: string): UserRow {
  const user = db.users[userId] || findUserById(userId);
  if (!user || user.isGuest) {
    throw new Error('Only registered accounts can change their username.');
  }
  const cleanNew = newUsername.replace(/^@/, '').trim();
  if (cleanNew.length < 2) {
    throw new Error('Username must be at least 2 characters.');
  }
  const conflict = Object.values(db.users).find(
    u => u.id !== user.id && u.username && u.username.toLowerCase() === cleanNew.toLowerCase()
  );
  if (conflict) {
    throw new Error('That username is already in use by another account.');
  }
  user.username = cleanNew;
  if (db.profiles[user.id]) {
    db.profiles[user.id].username = cleanNew;
  }
  saveDb();
  return user;
}

export function changeUserEmail(userId: string, oldEmail: string, newEmail: string): UserRow {
  const user = db.users[userId];
  if (!user || user.isGuest) {
    throw new Error('Only registered accounts can change their email address.');
  }
  const cleanOld = oldEmail.toLowerCase().trim();
  const cleanNew = newEmail.toLowerCase().trim();
  if (user.email && user.email.toLowerCase() !== cleanOld) {
    throw new Error('Old email address does not match your current account email.');
  }
  const conflict = Object.values(db.users).find(u => u.email === cleanNew && u.id !== userId);
  if (conflict) {
    throw new Error('That email address is already in use by another account.');
  }
  user.email = cleanNew;
  saveDb();
  return user;
}

export function loginOrSignupWithGoogle(email: string, displayName: string, guestIdToMigrate?: string): UserRow {
  const norm = email.toLowerCase().trim();
  let user = findUserByEmail(norm);
  if (!user) {
    const id = `usr_${crypto.randomUUID()}`;
    user = {
      id,
      email: norm,
      isGuest: false,
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };
    db.users[id] = user;
    const defaultUsername = norm.split('@')[0].replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    db.profiles[id] = createEmptyProfile(displayName || '', defaultUsername);
    db.userXp[id] = { xp: 0, badges: [] };
  } else {
    user.lastLoginAt = Date.now();
  }
  if (guestIdToMigrate && guestIdToMigrate !== user.id && db.users[guestIdToMigrate]) {
    migrateGuestData(guestIdToMigrate, user.id);
  }
  saveDb();
  return user;
}

// #58 Demo mode button on landing page: loads a temporary account with sample data
export function createDemoAccount(): UserRow {
  const id = `demo_${crypto.randomUUID()}`;
  const now = Date.now();
  const today = formatLocalDate();
  const yesterdayDate = addDaysLocal(new Date(), -1);
  const twoDaysAgoDate = addDaysLocal(new Date(), -2);

  const user: UserRow = {
    id,
    email: 'demo@forkcount.app',
    isGuest: true,
    createdAt: now,
    lastLoginAt: now
  };
  db.users[id] = user;
  db.profiles[id] = {
    ...createEmptyProfile('Alex (Demo)', 'alex_demo'),
    age: 31,
    gender: 'prefer_not_to_say',
    heightCm: 174,
    fitnessLevel: 'intermediate',
    currentWeightKg: 74.2,
    goalWeightKg: 69.0,
    dailyActivity: 'moderate',
    goalSpeed: 'lose_normal',
    pinnedWhy: 'Steady energy through the workday and consistent strength training.'
  };
  db.userXp[id] = { xp: 240, badges: ['First log', 'Hydrated', 'First workout', 'First weigh-in', '3-day streak', '50 XP', '200 XP'] };

  addDiaryEntry(id, {
    date: today,
    mealType: 'breakfast',
    name: 'Oatmeal with Greek Yogurt & Blueberries',
    calories: 345,
    carbs: 48,
    fat: 6,
    protein: 24,
    serving: '1 bowl (320g)',
    source: 'manual'
  });
  addDiaryEntry(id, {
    date: today,
    mealType: 'lunch',
    name: 'Grilled Chicken, Quinoa & Roasted Broccoli',
    calories: 520,
    carbs: 46,
    fat: 14,
    protein: 48,
    serving: '1 plate (410g)',
    source: 'manual'
  });
  addDiaryEntry(id, {
    date: yesterdayDate,
    mealType: 'breakfast',
    name: '2 Poached Eggs on Sourdough Toast',
    calories: 330,
    carbs: 28,
    fat: 14,
    protein: 21,
    serving: '2 slices + 2 eggs',
    source: 'manual'
  });
  addDiaryEntry(id, {
    date: twoDaysAgoDate,
    mealType: 'dinner',
    name: 'Baked Salmon, Sweet Potato & Spinach',
    calories: 590,
    carbs: 42,
    fat: 24,
    protein: 46,
    serving: '1 fillet + sides',
    source: 'manual'
  });

  setWaterGlasses(id, today, 5);
  addExerciseEntry(id, {
    date: today,
    activityName: 'Brisk Walking Intervals (30 min)',
    met: 4.5,
    minutes: 30,
    caloriesBurned: 168,
    intensity: 'Moderate'
  });
  addWeightEntry(id, twoDaysAgoDate, 74.8);
  addWeightEntry(id, yesterdayDate, 74.5);
  addWeightEntry(id, today, 74.2);

  saveDb();
  return user;
}

// ------------------- COMPLIANCE, ANALYTICS, SUPPORT & MONITORING (#34, #41-44, #46, #47, #74, #75, #79) -------------------
export interface CookieConsentRecord {
  id: string;
  choice: 'accepted' | 'declined';
  timestamp: string;
  ip: string;
  userAgent: string;
}

export interface ContactSubmissionRecord {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: number;
}

export interface BugReportRecord {
  id: string;
  userId: string;
  whatHappened: string;
  whatExpected: string;
  createdAt: number;
}

let cookieConsentLogs: CookieConsentRecord[] = [];
let contactSubmissions: ContactSubmissionRecord[] = [];
let bugReportsStore: BugReportRecord[] = [];
let maintenanceModeState = { enabled: false, message: 'ForkCount is undergoing a scheduled update. Back in a few minutes.' };

const privacyAnalyticsStore: {
  pageviews: number;
  events: Record<string, number>;
  byPath: Record<string, number>;
  recentEvents: Array<{ event: string; path: string; timestamp: number }>;
} = {
  pageviews: 0,
  events: {
    pageview: 0,
    signup: 0,
    first_meal_logged: 0,
    first_ai_call: 0,
    first_report_viewed: 0,
    first_week_completed: 0
  },
  byPath: {},
  recentEvents: []
};

export function logCookieConsent(choice: 'accepted' | 'declined', ip: string, userAgent: string): CookieConsentRecord {
  const rec: CookieConsentRecord = {
    id: `consent_${crypto.randomUUID()}`,
    choice,
    timestamp: new Date().toISOString(),
    ip,
    userAgent: sanitizeString(userAgent, 250)
  };
  cookieConsentLogs.push(rec);
  return rec;
}

export function getCookieConsentLogs(): CookieConsentRecord[] {
  return cookieConsentLogs.slice(-100);
}

export function recordPrivacyAnalyticsEvent(event: string, rawPath = '/'): void {
  const allowed = new Set(['pageview', 'signup', 'first_meal_logged', 'first_ai_call', 'first_report_viewed', 'first_week_completed']);
  if (!allowed.has(event)) return;
  const cleanPath = sanitizeString(rawPath || '/', 64) || '/';
  if (event === 'pageview') {
    privacyAnalyticsStore.pageviews += 1;
    privacyAnalyticsStore.byPath[cleanPath] = (privacyAnalyticsStore.byPath[cleanPath] || 0) + 1;
  }
  privacyAnalyticsStore.events[event] = (privacyAnalyticsStore.events[event] || 0) + 1;
  privacyAnalyticsStore.recentEvents.unshift({
    event,
    path: cleanPath,
    timestamp: Date.now()
  });
  if (privacyAnalyticsStore.recentEvents.length > 50) {
    privacyAnalyticsStore.recentEvents.length = 50;
  }
}

export function getPrivacyAnalyticsSummary() {
  return {
    ...privacyAnalyticsStore,
    totalUsers: Object.values(db.users).filter(u => !u.isGuest).length,
    consentLogsCount: cookieConsentLogs.length,
    bugReportsCount: bugReportsStore.length,
    contactMessagesCount: contactSubmissions.length
  };
}

export function saveContactMessage(payload: { name: string; email: string; subject: string; message: string }): ContactSubmissionRecord {
  const rec: ContactSubmissionRecord = {
    id: `contact_${crypto.randomUUID()}`,
    name: sanitizeString(payload.name, 120),
    email: sanitizeString(payload.email, 160),
    subject: sanitizeString(payload.subject, 200),
    message: sanitizeString(payload.message, 4000),
    createdAt: Date.now()
  };
  contactSubmissions.unshift(rec);
  return rec;
}

export function getContactMessages(): ContactSubmissionRecord[] {
  return contactSubmissions.slice(0, 100);
}

export function saveBugReport(userId: string, whatHappened: string, whatExpected: string): BugReportRecord {
  const rec: BugReportRecord = {
    id: `bug_${crypto.randomUUID()}`,
    userId,
    whatHappened: sanitizeString(whatHappened, 2000),
    whatExpected: sanitizeString(whatExpected, 2000),
    createdAt: Date.now()
  };
  bugReportsStore.unshift(rec);
  return rec;
}

export function getBugReports(): BugReportRecord[] {
  return bugReportsStore.slice(0, 100);
}

export function getMaintenanceStatus() {
  return maintenanceModeState;
}

export function setMaintenanceStatus(enabled: boolean, message?: string) {
  maintenanceModeState = {
    enabled: Boolean(enabled),
    message: sanitizeString(message || 'ForkCount is undergoing a scheduled update. Back in a few minutes.', 300)
  };
  return maintenanceModeState;
}

export function importUserBackupData(userId: string, migratedData: any): { restoredCounts: Record<string, number> } {
  clearUserData(userId);
  if (migratedData.profile && typeof migratedData.profile === 'object') {
    updateProfile(userId, sanitizeObjectStrings(migratedData.profile));
  }

  let diaryCount = 0;
  if (Array.isArray(migratedData.diaryEntries)) {
    for (const item of migratedData.diaryEntries) {
      addDiaryEntry(userId, {
        date: sanitizeString(item.date, 20),
        mealType: item.mealType || 'breakfast',
        name: sanitizeString(item.name, 200),
        calories: Math.max(0, Number(item.calories) || 0),
        carbs: Math.max(0, Number(item.carbs) || 0),
        fat: Math.max(0, Number(item.fat) || 0),
        protein: Math.max(0, Number(item.protein) || 0),
        serving: sanitizeString(item.serving || '1 serving', 100),
        source: item.source || 'manual'
      });
      diaryCount++;
    }
  }

  let exerciseCount = 0;
  if (Array.isArray(migratedData.exerciseEntries)) {
    for (const ex of migratedData.exerciseEntries) {
      addExerciseEntry(userId, {
        date: sanitizeString(ex.date, 20),
        activityName: sanitizeString(ex.activityName || 'Workout', 200),
        met: Math.max(1, Number(ex.met) || 5),
        minutes: Math.max(1, Number(ex.minutes) || 15),
        caloriesBurned: Math.max(0, Number(ex.caloriesBurned) || 0),
        intensity: ex.intensity === 'Low' || ex.intensity === 'High' ? ex.intensity : 'Moderate'
      });
      exerciseCount++;
    }
  }

  let weightCount = 0;
  if (Array.isArray(migratedData.weightEntries)) {
    for (const w of migratedData.weightEntries) {
      if (Number(w.weightKg) >= 20 && Number(w.weightKg) <= 500) {
        addWeightEntry(userId, sanitizeString(w.date, 20), Number(w.weightKg));
        weightCount++;
      }
    }
  }

  if (migratedData.waterEntries && typeof migratedData.waterEntries === 'object') {
    for (const [dt, glasses] of Object.entries(migratedData.waterEntries)) {
      const cleanDate = dt.includes(':') ? dt.split(':')[1] : dt;
      setWaterGlasses(userId, cleanDate, Math.max(0, Number(glasses) || 0));
    }
  }

  saveDb();
  return {
    restoredCounts: {
      diary: diaryCount,
      exercises: exerciseCount,
      weights: weightCount
    }
  };
}

// ------------------- TRUSTED DEVICES, SESSIONS & SECURITY EVENTS -------------------
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
const MAX_TRUSTED_DEVICES = 5;

export function parseDeviceLabelFromUserAgent(userAgent = ''): string {
  const ua = userAgent.toLowerCase();
  if (ua.includes('iphone')) return 'iPhone Safari';
  if (ua.includes('ipad')) return 'iPad Safari';
  if (ua.includes('android')) return 'Android Chrome';
  if (ua.includes('macintosh') && ua.includes('safari') && !ua.includes('chrome')) return 'macOS Safari';
  if (ua.includes('firefox')) return 'Desktop Firefox';
  if (ua.includes('edg/')) return 'Desktop Edge';
  if (ua.includes('chrome')) return 'Desktop Chrome';
  return 'Web Browser';
}

export function computeServerDeviceFingerprint(
  userAgent: string,
  meta?: {
    screenSize?: string;
    timezone?: string;
    language?: string;
    platform?: string;
  }
): {
  fingerprintHash: string;
  rawFingerprint: string;
  deviceName: string;
} {
  const cleanUa = String(userAgent || 'Unknown').trim();
  const screenSize = String(meta?.screenSize || '0x0').trim();
  const timezone = String(meta?.timezone || 'UTC').trim();
  const language = String(meta?.language || 'en').trim();
  const platform = String(meta?.platform || 'Web').trim();
  const rawFingerprint = `${cleanUa} | screen:${screenSize} | tz:${timezone} | lang:${language} | platform:${platform}`;
  const fingerprintHash = crypto
    .createHash('sha256')
    .update(`${cleanUa}|${screenSize}|${timezone}|${language}|${platform}`)
    .digest('hex');
  const deviceName = parseDeviceLabelFromUserAgent(cleanUa);
  return { fingerprintHash, rawFingerprint, deviceName };
}

export function isTrustedDeviceForUser(userId: string, fingerprintHash: string): boolean {
  const user = db.users[userId];
  if (!user || !Array.isArray(user.trustedDevices)) return false;
  const now = Date.now();
  // Prune expired trusted devices (> 30 days)
  user.trustedDevices = user.trustedDevices.filter((d) => now - d.trustedAt <= THIRTY_DAYS_MS);
  const match = user.trustedDevices.find((d) => constantTimeHashEqual(d.fingerprintHash, fingerprintHash));
  if (match) {
    match.lastUsedAt = now;
    saveDb();
    return true;
  }
  return false;
}

export function trustDeviceForUser(
  userId: string,
  device: {
    fingerprintHash: string;
    rawFingerprint: string;
    deviceName: string;
    userAgent: string;
    ip: string;
    city: string;
  }
): void {
  const user = db.users[userId];
  if (!user) return;
  const now = Date.now();
  const current = (user.trustedDevices || []).filter((d) => now - d.trustedAt <= THIRTY_DAYS_MS);
  const existingIdx = current.findIndex((d) =>
    constantTimeHashEqual(d.fingerprintHash, device.fingerprintHash)
  );
  if (existingIdx !== -1) {
    current[existingIdx] = {
      ...current[existingIdx],
      ...device,
      trustedAt: now,
      lastUsedAt: now
    };
  } else {
    current.push({
      ...device,
      trustedAt: now,
      lastUsedAt: now
    });
  }
  // Track up to 5 trusted devices per account; oldest falls off when a 6th is added
  current.sort((a, b) => a.trustedAt - b.trustedAt);
  while (current.length > MAX_TRUSTED_DEVICES) {
    current.shift();
  }
  user.trustedDevices = current;
  saveDb();
}

export function getTrustedDevicesCount(userId: string): number {
  const user = db.users[userId];
  if (!user || !Array.isArray(user.trustedDevices)) return 0;
  const now = Date.now();
  return user.trustedDevices.filter((d) => now - d.trustedAt <= THIRTY_DAYS_MS).length;
}

export function checkAndTouchUserSessionActivity(userId: string): {
  valid: boolean;
  expired: boolean;
} {
  const user = db.users[userId];
  if (!user) return { valid: false, expired: false };
  if (user.isGuest) return { valid: true, expired: false };

  const now = Date.now();
  const userSessions = userSessionsStore.filter((s) => s.userId === userId);
  if (userSessions.length === 0) {
    // Check user.lastLoginAt for 30-day inactivity
    if (user.lastLoginAt && now - user.lastLoginAt > THIRTY_DAYS_MS) {
      return { valid: false, expired: true };
    }
    return { valid: true, expired: false };
  }

  const activeSessions = userSessions.filter((s) => now - s.lastActiveAt <= THIRTY_DAYS_MS);
  if (activeSessions.length === 0) {
    userSessionsStore = userSessionsStore.filter((s) => s.userId !== userId);
    return { valid: false, expired: true };
  }

  activeSessions[0].lastActiveAt = now;
  return { valid: true, expired: false };
}

// IP Geolocation & VPN/Datacenter Detection
const ipGeoCache = new Map<
  string,
  { city: string; country: string; org: string; isVpnOrDatacenter: boolean; cachedAt: number }
>();

const DATACENTER_OR_VPN_KEYWORDS = [
  'digitalocean',
  'amazon',
  'aws',
  'ec2',
  'linode',
  'akamai',
  'vultr',
  'choopa',
  'hetzner',
  'ovh',
  'm247',
  'datacamp',
  'nordvpn',
  'expressvpn',
  'mullvad',
  'protonvpn',
  'surfshark',
  'cyberghost',
  'private internet access',
  'leaseweb',
  'scaleway',
  'contabo',
  'google cloud',
  'microsoft corporation',
  'azure',
  'cloudflare',
  'tor exit',
  'hosting',
  'datacenter',
  'vpn'
];

export function detectVpnOrDatacenterFromIpOrOrg(ip: string, org = ''): boolean {
  const lowerOrg = org.toLowerCase();
  if (DATACENTER_OR_VPN_KEYWORDS.some((kw) => lowerOrg.includes(kw))) {
    return true;
  }
  // Common known datacenter / cloud public IP prefixes (e.g. DigitalOcean, AWS, Vultr, M247)
  if (
    /^(104\.248\.|134\.209\.|159\.65\.|159\.89\.|167\.71\.|167\.99\.|178\.128\.|185\.220\.|45\.32\.|45\.76\.|45\.77\.|185\.156\.)/.test(
      ip
    )
  ) {
    return true;
  }
  return false;
}

export async function resolveIpGeo(
  ip: string,
  headers: Record<string, any> = {}
): Promise<{
  city: string;
  country: string;
  org: string;
  isVpnOrDatacenter: boolean;
}> {
  const cleanIp = String(ip || '127.0.0.1').trim();
  const headerCity =
    headers['cf-ipcity'] ||
    headers['x-vercel-ip-city'] ||
    headers['x-appengine-city'] ||
    headers['x-geo-city'];
  const headerCountry =
    headers['cf-ipcountry'] ||
    headers['x-vercel-ip-country'] ||
    headers['x-appengine-country'] ||
    headers['x-geo-country'];
  const headerOrg = headers['x-asn-org'] || headers['cf-Connecting-org'] || '';

  if (headerCity || headerCountry) {
    const city = String(headerCity || 'Unknown City');
    const country = String(headerCountry || 'Unknown Country');
    const org = String(headerOrg || '');
    return {
      city,
      country,
      org,
      isVpnOrDatacenter: detectVpnOrDatacenterFromIpOrOrg(cleanIp, org)
    };
  }

  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp.startsWith('172.')
  ) {
    return {
      city: 'Localhost',
      country: 'Local',
      org: 'Local Network',
      isVpnOrDatacenter: false
    };
  }

  const cached = ipGeoCache.get(cleanIp);
  if (cached && Date.now() - cached.cachedAt < 6 * 60 * 60 * 1000) {
    return {
      city: cached.city,
      country: cached.country,
      org: cached.org,
      isVpnOrDatacenter: cached.isVpnOrDatacenter
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1800);
    const resp = await safeOutboundFetch(`https://ipapi.co/${encodeURIComponent(cleanIp)}/json/`, {
      signal: controller.signal,
      headers: { 'User-Agent': 'ForkCount-Security-Inspector/1.0' }
    });
    clearTimeout(timeout);
    if (resp.ok) {
      const data: any = await resp.json();
      const city = String(data.city || 'Unknown');
      const country = String(data.country_name || data.country || 'Unknown');
      const org = String(data.org || data.asn || '');
      const isVpn = detectVpnOrDatacenterFromIpOrOrg(cleanIp, org);
      ipGeoCache.set(cleanIp, {
        city,
        country,
        org,
        isVpnOrDatacenter: isVpn,
        cachedAt: Date.now()
      });
      return { city, country, org, isVpnOrDatacenter: isVpn };
    }
  } catch {
    // Ignore external geo lookup failures
  }

  const isVpnFallback = detectVpnOrDatacenterFromIpOrOrg(cleanIp, '');
  return {
    city: 'Unknown',
    country: 'Unknown',
    org: '',
    isVpnOrDatacenter: isVpnFallback
  };
}

export function pruneOldSecurityEvents(): void {
  if (!Array.isArray(db.securityEvents)) {
    db.securityEvents = [];
    return;
  }
  const cutoff = Date.now() - NINETY_DAYS_MS;
  const before = db.securityEvents.length;
  db.securityEvents = db.securityEvents.filter((ev) => ev.createdAt >= cutoff);
  if (db.securityEvents.length !== before) {
    saveDb();
  }
}

export async function logSecurityEvent(params: {
  eventType: SecurityEventType;
  userEmail?: string;
  ip: string;
  headers?: Record<string, any>;
  deviceFingerprint: string;
  deviceName?: string;
  userAgent: string;
  requestPath: string;
  summary: string;
  metadata?: Record<string, any>;
}): Promise<SecurityEventRecord> {
  pruneOldSecurityEvents();
  const geo = await resolveIpGeo(params.ip, params.headers || {});
  const now = Date.now();
  const record: SecurityEventRecord = {
    id: `sec_${crypto.randomUUID()}`,
    timestamp: new Date(now).toISOString(),
    createdAt: now,
    eventType: params.eventType,
    userEmail: String(params.userEmail || '').toLowerCase().trim(),
    ip: String(params.ip || '127.0.0.1').trim(),
    city: geo.city,
    country: geo.country,
    ispOrOrg: geo.org || undefined,
    isVpnOrDatacenter: geo.isVpnOrDatacenter,
    deviceFingerprint: params.deviceFingerprint || 'Unknown',
    deviceName: params.deviceName || parseDeviceLabelFromUserAgent(params.userAgent),
    userAgent: String(params.userAgent || '').slice(0, 500),
    requestPath: String(params.requestPath || '/'),
    summary: String(params.summary || ''),
    metadata: params.metadata
  };

  if (!Array.isArray(db.securityEvents)) {
    db.securityEvents = [];
  }
  db.securityEvents.unshift(record);
  if (db.securityEvents.length > 5000) {
    db.securityEvents.length = 5000;
  }
  saveDb();
  return record;
}

export interface SuspiciousPatternAlert {
  id: string;
  patternType: 'ip_many_emails' | 'email_many_ips' | 'many_failed_logins' | 'vpn_datacenter_signup';
  title: string;
  detail: string;
  matchingEventIds: string[];
}

export function analyzeSuspiciousPatterns(events: SecurityEventRecord[]): {
  alerts: SuspiciousPatternAlert[];
  flaggedEventIds: Record<string, string[]>;
} {
  const alerts: SuspiciousPatternAlert[] = [];
  const flaggedEventIds: Record<string, string[]> = {};

  const markEvent = (eventId: string, label: string) => {
    if (!flaggedEventIds[eventId]) flaggedEventIds[eventId] = [];
    if (!flaggedEventIds[eventId].includes(label)) {
      flaggedEventIds[eventId].push(label);
    }
  };

  // 1. Same IP hitting many emails in a short window (15 mins, >= 3 distinct emails)
  const ipEventsMap = new Map<string, SecurityEventRecord[]>();
  for (const ev of events) {
    if (!ev.ip || !ev.userEmail) continue;
    const list = ipEventsMap.get(ev.ip) || [];
    list.push(ev);
    ipEventsMap.set(ev.ip, list);
  }
  for (const [ip, list] of ipEventsMap.entries()) {
    const sorted = [...list].sort((a, b) => a.createdAt - b.createdAt);
    const matchedEmails = new Set<string>();
    const matchedIds = new Set<string>();
    for (let i = 0; i < sorted.length; i++) {
      const windowEmails = new Set<string>([sorted[i].userEmail]);
      const windowIds = [sorted[i].id];
      for (let j = i + 1; j < sorted.length; j++) {
        if (sorted[j].createdAt - sorted[i].createdAt <= 15 * 60 * 1000) {
          windowEmails.add(sorted[j].userEmail);
          windowIds.push(sorted[j].id);
        } else {
          break;
        }
      }
      if (windowEmails.size >= 3) {
        windowEmails.forEach((e) => matchedEmails.add(e));
        windowIds.forEach((id) => matchedIds.add(id));
      }
    }
    if (matchedEmails.size >= 3) {
      const idList = Array.from(matchedIds);
      idList.forEach((id) => markEvent(id, 'IP hitting multiple emails'));
      alerts.push({
        id: `pat_ip_${ip}`,
        patternType: 'ip_many_emails',
        title: 'Same IP hitting many emails in a short window',
        detail: `IP ${ip} targeted ${matchedEmails.size} distinct emails (${Array.from(matchedEmails).slice(0, 4).join(', ')}) within 15 minutes.`,
        matchingEventIds: idList
      });
    }
  }

  // 2. Same email from many IPs (>= 3 distinct IPs)
  const emailIpsMap = new Map<string, { ips: Set<string>; eventIds: string[] }>();
  for (const ev of events) {
    if (!ev.userEmail || !ev.ip) continue;
    const entry = emailIpsMap.get(ev.userEmail) || { ips: new Set<string>(), eventIds: [] };
    entry.ips.add(ev.ip);
    entry.eventIds.push(ev.id);
    emailIpsMap.set(ev.userEmail, entry);
  }
  for (const [email, info] of emailIpsMap.entries()) {
    if (info.ips.size >= 3) {
      info.eventIds.forEach((id) => markEvent(id, 'Email accessed from many IPs'));
      alerts.push({
        id: `pat_email_ips_${email}`,
        patternType: 'email_many_ips',
        title: 'Same email from many IPs',
        detail: `${email} was seen from ${info.ips.size} distinct IP addresses (${Array.from(info.ips).slice(0, 4).join(', ')}).`,
        matchingEventIds: info.eventIds
      });
    }
  }

  // 3. Many failed logins for one email (>= 3 failed logins)
  const failedByEmail = new Map<string, string[]>();
  for (const ev of events) {
    if (ev.eventType === 'failed_login' && ev.userEmail) {
      const list = failedByEmail.get(ev.userEmail) || [];
      list.push(ev.id);
      failedByEmail.set(ev.userEmail, list);
    }
  }
  for (const [email, ids] of failedByEmail.entries()) {
    if (ids.length >= 3) {
      ids.forEach((id) => markEvent(id, 'Repeated failed logins'));
      alerts.push({
        id: `pat_failed_${email}`,
        patternType: 'many_failed_logins',
        title: 'Many failed logins for one email',
        detail: `${ids.length} failed login attempts recorded for ${email}.`,
        matchingEventIds: ids
      });
    }
  }

  // 4. Signups from a known VPN or datacenter IP range
  const vpnSignupEvents = events.filter(
    (ev) => ev.eventType === 'signup_attempt' && ev.isVpnOrDatacenter
  );
  if (vpnSignupEvents.length > 0) {
    const ids = vpnSignupEvents.map((e) => e.id);
    ids.forEach((id) => markEvent(id, 'VPN / Datacenter IP signup'));
    alerts.push({
      id: 'pat_vpn_signup',
      patternType: 'vpn_datacenter_signup',
      title: 'Signups from a known VPN or datacenter IP range',
      detail: `${vpnSignupEvents.length} signup attempt(s) detected from VPN or datacenter IP ranges (${vpnSignupEvents.map((e) => e.ip).slice(0, 4).join(', ')}).`,
      matchingEventIds: ids
    });
  }

  return { alerts, flaggedEventIds };
}

export function getSecurityEvents(filters?: {
  search?: string;
  eventType?: string;
  limit?: number;
}): {
  events: SecurityEventRecord[];
  alerts: SuspiciousPatternAlert[];
  flaggedEventIds: Record<string, string[]>;
} {
  pruneOldSecurityEvents();
  const all = [...(db.securityEvents || [])].sort((a, b) => b.createdAt - a.createdAt);
  const { alerts, flaggedEventIds } = analyzeSuspiciousPatterns(all);

  let filtered = all;
  if (filters?.eventType && filters.eventType !== 'all') {
    filtered = filtered.filter((e) => e.eventType === filters.eventType);
  }
  if (filters?.search && filters.search.trim()) {
    const q = filters.search.trim().toLowerCase();
    filtered = filtered.filter(
      (e) =>
        (e.userEmail && e.userEmail.toLowerCase().includes(q)) ||
        (e.ip && e.ip.toLowerCase().includes(q)) ||
        (e.city && e.city.toLowerCase().includes(q)) ||
        (e.summary && e.summary.toLowerCase().includes(q))
    );
  }

  const max = filters?.limit || 500;
  return {
    events: filtered.slice(0, max),
    alerts,
    flaggedEventIds
  };
}

// Recent Backend Errors (Last 50, newest first)
export function logBackendError(endpoint: string, errorMessage: string, userEmail = ''): void {
  if (!Array.isArray(db.recentErrors)) {
    db.recentErrors = [];
  }
  const now = Date.now();
  const rec: BackendErrorRecord = {
    id: `err_${crypto.randomUUID()}`,
    timestamp: new Date(now).toISOString(),
    createdAt: now,
    endpoint: String(endpoint || '/'),
    errorMessage: String(errorMessage || 'Unknown error').slice(0, 600),
    userEmail: String(userEmail || '').toLowerCase().trim()
  };
  db.recentErrors.unshift(rec);
  if (db.recentErrors.length > 50) {
    db.recentErrors.length = 50;
  }
  saveDb();
}

export function getRecentBackendErrors(): BackendErrorRecord[] {
  if (!Array.isArray(db.recentErrors)) return [];
  return db.recentErrors.slice(0, 50);
}

// Dev Tools: Account Inspector
export function inspectAccountByEmail(rawIdentifier: string) {
  const identifier = String(rawIdentifier || '').toLowerCase().trim();
  const user = findUserByUsername(identifier) || findUserByEmail(identifier);
  if (!user) {
    return null;
  }
  const profile = db.profiles[user.id];
  const stats = getUserStats(user.id);
  const userMeals = db.diaryEntries.filter((e) => e.userId === user.id);
  const daysLoggedSet = new Set(userMeals.map((e) => e.date));
  const userWeights = db.weightEntries.filter((w) => w.userId === user.id);
  const hasProfile = Boolean(
    profile &&
      profile.age > 0 &&
      profile.heightCm > 0 &&
      profile.currentWeightKg > 0 &&
      profile.goalWeightKg > 0 &&
      profile.dailyActivity &&
      profile.goalSpeed
  );

  const createdTs = user.createdAt ? new Date(Number(user.createdAt) || user.createdAt) : null;
  const lastLoginTs = user.lastLoginAt ? new Date(Number(user.lastLoginAt) || user.lastLoginAt) : null;

  return {
    userId: user.id,
    username: user.username || profile?.username || identifier,
    email: user.email || user.username || profile?.username || identifier,
    displayName: profile?.name || user.username || 'No display name',
    createdDate: createdTs && !Number.isNaN(createdTs.getTime()) ? createdTs.toISOString() : new Date().toISOString(),
    lastSignIn: lastLoginTs && !Number.isNaN(lastLoginTs.getTime()) ? lastLoginTs.toISOString() : 'This is your first session',
    trustedDevicesCount: getTrustedDevicesCount(user.id),
    daysLogged: daysLoggedSet.size,
    mealsLogged: userMeals.length,
    weightEntries: userWeights.length,
    hasProfile,
    currentStreak: stats.foodStreak,
    totalXp: stats.xp,
    totalXP: stats.xp,
    badgesEarned: stats.badges
  };
}

// Dev Tools: Seed demo account with 1 full week (7 days) of food, water, weight, and exercise
export function seedFullWeekDemoAccount(): {
  userId: string;
  username: string;
  email: string;
  daysSeeded: number;
  mealsSeeded: number;
  waterDaysSeeded: number;
  weightEntriesSeeded: number;
  exerciseEntriesSeeded: number;
} {
  const shortTag = crypto.randomBytes(2).toString('hex');
  const username = `demo_${shortTag}`;
  const email = `demo.${shortTag}@forkcount.app`;
  const id = `usr_demo_${crypto.randomUUID()}`;
  const now = Date.now();

  const user: UserRow = {
    id,
    username,
    email,
    passwordHash: hashPassword('DemoWeek2026!'),
    isGuest: false,
    isDev: false,
    createdAt: now - 7 * 86400000,
    lastLoginAt: now,
    trustedDevices: []
  };
  db.users[id] = user;
  db.profiles[id] = {
    ...createEmptyProfile(`Jordan Demo (${shortTag})`, username),
    age: 29,
    gender: 'female',
    heightCm: 169,
    fitnessLevel: 'intermediate',
    currentWeightKg: 72.4,
    goalWeightKg: 66.0,
    dailyActivity: 'moderate',
    goalSpeed: 'lose_normal',
    pinnedWhy: 'Consistent protein intake and sustainable weekly progress.'
  };

  let mealsCount = 0;
  let waterDaysCount = 0;
  let weightCount = 0;
  let exerciseCount = 0;

  const dailyMenus = [
    {
      b: { name: 'Greek Yogurt Bowl with Oats & Berries', cal: 360, c: 44, f: 7, p: 28 },
      l: { name: 'Grilled Chicken Quinoa Salad', cal: 540, c: 48, f: 16, p: 46 },
      d: { name: 'Baked Salmon with Roasted Asparagus & Rice', cal: 610, c: 52, f: 22, p: 45 },
      s: { name: 'Apple Slices & Almond Butter', cal: 190, c: 22, f: 11, p: 4 }
    },
    {
      b: { name: '2 Poached Eggs on Sourdough Toast', cal: 340, c: 30, f: 14, p: 20 },
      l: { name: 'Turkey & Avocado Wholegrain Wrap', cal: 510, c: 46, f: 18, p: 38 },
      d: { name: 'Lean Beef Stir-Fry with Broccoli & Jasmine Rice', cal: 630, c: 58, f: 19, p: 48 },
      s: { name: 'Cottage Cheese with Pineapple', cal: 175, c: 16, f: 4, p: 20 }
    },
    {
      b: { name: 'High-Protein Overnight Oats with Chia', cal: 390, c: 48, f: 9, p: 30 },
      l: { name: 'Tuna & White Bean Mediterranean Salad', cal: 490, c: 40, f: 14, p: 44 },
      d: { name: 'Roast Chicken Breast, Sweet Potato & Greens', cal: 580, c: 50, f: 15, p: 52 },
      s: { name: 'Whey Protein Shake & Banana', cal: 230, c: 27, f: 2, p: 26 }
    }
  ];

  for (let i = 6; i >= 0; i--) {
    const dateStr = addDaysLocal(new Date(), -i);
    const menu = dailyMenus[i % dailyMenus.length];

    addDiaryEntry(id, {
      date: dateStr,
      mealType: 'breakfast',
      name: menu.b.name,
      calories: menu.b.cal,
      carbs: menu.b.c,
      fat: menu.b.f,
      protein: menu.b.p,
      serving: '1 serving',
      source: 'manual'
    });
    addDiaryEntry(id, {
      date: dateStr,
      mealType: 'lunch',
      name: menu.l.name,
      calories: menu.l.cal,
      carbs: menu.l.c,
      fat: menu.l.f,
      protein: menu.l.p,
      serving: '1 plate',
      source: 'manual'
    });
    addDiaryEntry(id, {
      date: dateStr,
      mealType: 'dinner',
      name: menu.d.name,
      calories: menu.d.cal,
      carbs: menu.d.c,
      fat: menu.d.f,
      protein: menu.d.p,
      serving: '1 plate',
      source: 'manual'
    });
    addDiaryEntry(id, {
      date: dateStr,
      mealType: 'snack',
      name: menu.s.name,
      calories: menu.s.cal,
      carbs: menu.s.c,
      fat: menu.s.f,
      protein: menu.s.p,
      serving: '1 portion',
      source: 'manual'
    });
    mealsCount += 4;

    setWaterGlasses(id, dateStr, 7 + (i % 2));
    waterDaysCount += 1;

    const weightVal = Math.round((73.0 - (6 - i) * 0.1) * 10) / 10;
    addWeightEntry(id, dateStr, weightVal);
    weightCount += 1;

    if (i % 2 === 0) {
      addExerciseEntry(id, {
        date: dateStr,
        activityName: i === 0 ? 'Upper Body Dumbbell Session' : 'Brisk Incline Walk & Core',
        met: 5.5,
        minutes: 40,
        caloriesBurned: 265,
        intensity: 'Moderate'
      });
      exerciseCount += 1;
    }
  }

  saveDb();
  return {
    userId: id,
    username,
    email,
    daysSeeded: 7,
    mealsSeeded: mealsCount,
    waterDaysSeeded: waterDaysCount,
    weightEntriesSeeded: weightCount,
    exerciseEntriesSeeded: exerciseCount
  };
}

// ------------------- COMMUNITY POSTS, REPLIES & MODERATION -------------------
function resolveDisplayUsername(userId: string): string {
  const user = db.users[userId];
  const prof = db.profiles[userId];
  if (user?.username && user.username.trim()) return user.username.trim();
  if (prof?.username && prof.username.trim()) return prof.username.trim();
  if (prof?.name && prof.name.trim() && prof.name !== 'Guest User') return prof.name.trim();
  if (user?.email) return user.email.split('@')[0];
  return `user_${userId.slice(-5)}`;
}

export function getBlockedSetForUser(userId?: string): Set<string> {
  if (!userId) return new Set();
  const list = db.blockedUsers[userId] || [];
  return new Set(list.map((s) => String(s).toLowerCase()));
}

export function getFollowingSetForUser(userId?: string): Set<string> {
  if (!userId) return new Set();
  const friendNames = (db.friends || [])
    .filter((f) => f.userId === userId && f.username)
    .map((f) => f.username.toLowerCase());
  const explicitFollows = (db.followingUsers[userId] || []).map((u) => u.toLowerCase());
  return new Set([...friendNames, ...explicitFollows]);
}

export function getCommunityPosts(
  viewerUserId?: string,
  filter: 'all' | 'following' | 'mine' = 'all'
): CommunityPost[] {
  const blocked = getBlockedSetForUser(viewerUserId);
  const following = getFollowingSetForUser(viewerUserId);
  const viewerUsername = viewerUserId ? resolveDisplayUsername(viewerUserId).toLowerCase() : '';

  const allPosts = (db.posts || [])
    .filter((p) => {
      if (blocked.has(p.userId.toLowerCase()) || blocked.has((p.username || '').toLowerCase())) {
        return false;
      }
      if (filter === 'mine') {
        if (!viewerUserId) return false;
        return p.userId === viewerUserId || (viewerUsername && p.username.toLowerCase() === viewerUsername);
      }
      if (filter === 'following') {
        if (!viewerUserId) return false;
        return following.has((p.username || '').toLowerCase()) || following.has(p.userId.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => b.createdAt - a.createdAt);

  return allPosts.map((p) => {
    const likers = db.postLikes[p.id] || [];
    const replyCount = (db.replies || []).filter((r) => r.postId === p.id).length;
    return {
      ...p,
      likeCount: likers.length > 0 || p.likeCount === 0 ? likers.length : p.likeCount,
      replyCount,
      likedByMe: Boolean(viewerUserId && likers.includes(viewerUserId)),
      isFollowingAuthor: Boolean(viewerUserId && following.has((p.username || '').toLowerCase()))
    };
  });
}

export function getCommunityPostDetail(
  postId: string,
  viewerUserId?: string
): { post: CommunityPost | null; replies: CommunityReply[] } {
  const rawPost = (db.posts || []).find((p) => p.id === postId);
  if (!rawPost) {
    return { post: null, replies: [] };
  }
  const blocked = getBlockedSetForUser(viewerUserId);
  const following = getFollowingSetForUser(viewerUserId);
  const likers = db.postLikes[rawPost.id] || [];
  const replies = (db.replies || [])
    .filter(
      (r) =>
        r.postId === postId &&
        !blocked.has(r.userId.toLowerCase()) &&
        !blocked.has((r.username || '').toLowerCase())
    )
    .sort((a, b) => a.createdAt - b.createdAt);

  const post: CommunityPost = {
    ...rawPost,
    likeCount: likers.length > 0 || rawPost.likeCount === 0 ? likers.length : rawPost.likeCount,
    replyCount: replies.length,
    likedByMe: Boolean(viewerUserId && likers.includes(viewerUserId)),
    isFollowingAuthor: Boolean(viewerUserId && following.has((rawPost.username || '').toLowerCase()))
  };

  return { post, replies };
}

export function createCommunityPost(
  userId: string,
  text: string,
  imageUrl?: string,
  usernameHint?: string
): CommunityPost {
  let user = findUserById(userId, usernameHint);
  if ((!user || user.isGuest) && usernameHint) {
    user = findUserById(`usr_${usernameHint.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`, usernameHint);
  }
  if (!user || user.isGuest) {
    const err: any = new Error('Create an account to post.');
    err.status = 403;
    throw err;
  }

  const cleanText = String(text || '').trim();
  if (!cleanText) {
    const err: any = new Error('Post text is required.');
    err.status = 400;
    throw err;
  }
  if (cleanText.length > 500) {
    const err: any = new Error('Posts cannot exceed 500 characters.');
    err.status = 400;
    throw err;
  }

  if (!Array.isArray(db.posts)) db.posts = [];
  if (!db.postLikes || typeof db.postLikes !== 'object') db.postLikes = {};

  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const recentByUser = (db.posts || []).filter(
    (p) => p.userId === user.id && p.createdAt >= oneHourAgo
  );
  if (recentByUser.length >= 10) {
    const err: any = new Error('Rate limit reached: You can publish up to 10 posts per hour.');
    err.status = 429;
    throw err;
  }

  const username = usernameHint?.replace(/^@/, '').trim() || resolveDisplayUsername(user.id);
  const id = `post_${crypto.randomUUID()}`;
  const cleanImage = imageUrl && String(imageUrl).trim() ? String(imageUrl).trim() : undefined;

  const post: CommunityPost = {
    id,
    userId: user.id,
    username,
    text: cleanText,
    ...(cleanImage ? { imageUrl: cleanImage } : {}),
    createdAt: now,
    likeCount: 0,
    replyCount: 0
  };

  db.posts.unshift(post);
  db.postLikes[id] = [];
  saveDb();

  return { ...post, likedByMe: false };
}

export function toggleLikeCommunityPost(
  userId: string,
  postId: string
): { liked: boolean; likeCount: number } {
  const post = (db.posts || []).find((p) => p.id === postId);
  if (!post) {
    const err: any = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  if (!db.postLikes[postId]) {
    db.postLikes[postId] = [];
  }
  const likers = db.postLikes[postId];
  const idx = likers.indexOf(userId);
  let liked = false;
  if (idx >= 0) {
    likers.splice(idx, 1);
    liked = false;
  } else {
    likers.push(userId);
    liked = true;
  }
  post.likeCount = likers.length;
  saveDb();

  return { liked, likeCount: post.likeCount };
}

export function addCommunityReply(
  userId: string,
  postId: string,
  text: string,
  usernameHint?: string
): CommunityReply {
  let user = findUserById(userId, usernameHint);
  if ((!user || user.isGuest) && usernameHint) {
    user = findUserById(`usr_${usernameHint.toLowerCase().replace(/[^a-z0-9]/gi, '_')}`, usernameHint);
  }
  if (!user || user.isGuest) {
    const err: any = new Error('Create an account to post.');
    err.status = 403;
    throw err;
  }

  const post = (db.posts || []).find((p) => p.id === postId);
  if (!post) {
    const err: any = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  const cleanText = String(text || '').trim();
  if (!cleanText) {
    const err: any = new Error('Reply text is required.');
    err.status = 400;
    throw err;
  }
  if (cleanText.length > 500) {
    const err: any = new Error('Replies cannot exceed 500 characters.');
    err.status = 400;
    throw err;
  }

  const username = resolveDisplayUsername(user.id);
  const reply: CommunityReply = {
    id: `reply_${crypto.randomUUID()}`,
    postId,
    userId: user.id,
    username,
    text: cleanText,
    createdAt: Date.now()
  };

  if (!db.replies) db.replies = [];
  db.replies.push(reply);
  post.replyCount = db.replies.filter((r) => r.postId === postId).length;
  saveDb();

  return reply;
}

export function reportCommunityPost(
  reporterUserId: string,
  postId: string,
  reason?: string
): ReportedPostRecord {
  const post = (db.posts || []).find((p) => p.id === postId);
  if (!post) {
    const err: any = new Error('Post not found.');
    err.status = 404;
    throw err;
  }

  if (!db.postReports) db.postReports = [];
  const existing = db.postReports.find(
    (r) => r.postId === postId && r.reportedByUserId === reporterUserId
  );
  if (existing) {
    return existing;
  }

  const record: ReportedPostRecord = {
    id: `rep_${crypto.randomUUID()}`,
    postId,
    reportedByUserId: reporterUserId,
    reportedByUsername: resolveDisplayUsername(reporterUserId),
    reason: reason ? sanitizeString(reason, 200) : 'Reported by community member',
    createdAt: Date.now()
  };

  db.postReports.unshift(record);
  saveDb();
  return record;
}

export function blockCommunityUser(
  userId: string,
  targetUserIdOrUsername: string
): { blocked: string[] } {
  if (!db.blockedUsers) db.blockedUsers = {};
  if (!db.blockedUsers[userId]) db.blockedUsers[userId] = [];

  const cleanTarget = String(targetUserIdOrUsername || '').trim().toLowerCase();
  if (cleanTarget && !db.blockedUsers[userId].includes(cleanTarget)) {
    db.blockedUsers[userId].push(cleanTarget);
  }

  const targetUser =
    db.users[targetUserIdOrUsername] || findUserByUsername(cleanTarget);
  if (targetUser) {
    const uidLower = targetUser.id.toLowerCase();
    if (!db.blockedUsers[userId].includes(uidLower)) {
      db.blockedUsers[userId].push(uidLower);
    }
    if (targetUser.username) {
      const unameLower = targetUser.username.toLowerCase();
      if (!db.blockedUsers[userId].includes(unameLower)) {
        db.blockedUsers[userId].push(unameLower);
      }
    }
  }

  saveDb();
  return { blocked: db.blockedUsers[userId] };
}

export function toggleFollowCommunityUser(
  userId: string,
  targetUsername: string
): { following: boolean } {
  if (!db.followingUsers) db.followingUsers = {};
  if (!db.followingUsers[userId]) db.followingUsers[userId] = [];

  const norm = String(targetUsername || '').trim().replace(/^@/, '').toLowerCase();
  if (!norm) return { following: false };

  const list = db.followingUsers[userId];
  const idx = list.indexOf(norm);
  let following = false;
  if (idx >= 0) {
    list.splice(idx, 1);
    following = false;
  } else {
    list.push(norm);
    following = true;
  }
  saveDb();
  return { following };
}

export function getReportedCommunityPosts(): Array<ReportedPostRecord & { post: CommunityPost }> {
  if (!db.postReports) return [];
  const results: Array<ReportedPostRecord & { post: CommunityPost }> = [];
  const seenPostIds = new Set<string>();

  for (const rep of db.postReports) {
    if (seenPostIds.has(rep.postId)) continue;
    const post = (db.posts || []).find((p) => p.id === rep.postId);
    if (post) {
      seenPostIds.add(rep.postId);
      results.push({
        ...rep,
        post
      });
    }
  }
  return results;
}

export function moderateDeleteCommunityPost(postId: string): boolean {
  const beforeLen = (db.posts || []).length;
  db.posts = (db.posts || []).filter((p) => p.id !== postId);
  db.replies = (db.replies || []).filter((r) => r.postId !== postId);
  db.postReports = (db.postReports || []).filter((r) => r.postId !== postId);
  delete db.postLikes[postId];
  saveDb();
  return db.posts.length < beforeLen;
}

export function moderateDismissPostReport(reportIdOrPostId: string): boolean {
  const beforeLen = (db.postReports || []).length;
  db.postReports = (db.postReports || []).filter(
    (r) => r.id !== reportIdOrPostId && r.postId !== reportIdOrPostId
  );
  saveDb();
  return db.postReports.length < beforeLen;
}


