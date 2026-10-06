import { parseIngredientLine, BUILTIN_FOODS } from '../server/foodData.js';
import { decipherFoodText } from '../utils/localAiEngine.js';
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
  ReportedPostRecord,
  PlanDay
} from '../types/index.js';

const STORAGE_KEY = 'forkcount_standalone_db_v1';
const LEGACY_STORAGE_KEY = 'caloriq_standalone_db_v1';

interface StandaloneDb {
  users: Record<string, { id: string; username?: string; email?: string; passwordHash?: string; isGuest: boolean; isDev?: boolean; devDeviceToken?: string; devBrowserSig?: string; createdAt: number; lastLoginAt: number }>;
  profiles: Record<string, UserProfile>;
  diaryEntries: FoodItem[];
  waterEntries: Record<string, number>;
  exerciseEntries: ExerciseItem[];
  weightEntries: WeightRecord[];
  measurements: BodyMeasurement[];
  progressPhotos: ProgressPhoto[];
  dailyHabits: Record<string, DailyHabitLog>;
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
  plans: Record<string, WeekPlan>;
  userXp: Record<string, { xp: number; badges: string[] }>;
  usdaApiKey?: string;
}

const DEFAULT_DB: StandaloneDb = {
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
  userXp: {}
};

function uid(prefix: string): string {
  const rand = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${rand}`;
}

function hashStandalonePassword(password: string): string {
  let h1 = 0xdeadbeef ^ password.length;
  let h2 = 0x41c6ce57 ^ password.length;
  const salted = `forkcount_standalone_${password}`;
  for (let i = 0; i < salted.length; i++) {
    const ch = salted.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

function hashAltClientPassword(password: string): string {
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

function timingSafeEqualString(a: string | undefined | null, b: string | undefined | null): boolean {
  if (a === undefined || a === null || b === undefined || b === null) {
    return false;
  }
  const strA = String(a);
  const strB = String(b);

  if (typeof window === 'undefined') {
    try {
      const cryptoMod = require('crypto');
      if (cryptoMod && cryptoMod.timingSafeEqual && cryptoMod.createHash) {
        const bufA = cryptoMod.createHash('sha256').update(strA).digest();
        const bufB = cryptoMod.createHash('sha256').update(strB).digest();
        const match = cryptoMod.timingSafeEqual(bufA, bufB);
        return match && strA.length === strB.length;
      }
    } catch {
      // Fallback
    }
  }

  let mismatch = strA.length === strB.length ? 0 : 1;
  const maxLen = Math.max(strA.length, strB.length);
  for (let i = 0; i < maxLen; i++) {
    const codeA = i < strA.length ? strA.charCodeAt(i) : 0;
    const codeB = i < strB.length ? strB.charCodeAt(i) : 0;
    mismatch |= codeA ^ codeB;
  }
  return mismatch === 0;
}

function loadDb(): StandaloneDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DB };
    const parsed = JSON.parse(raw);
    const fakeUsernames = new Set(['claire_m', 'marcus_r', 'elena_v']);
    const cleanedFriends = (parsed.friends || []).filter(
      (f: any) => !fakeUsernames.has(String(f.username || '').toLowerCase())
    );
    const cleanedProfiles: Record<string, UserProfile> = parsed.profiles || {};
    for (const k of Object.keys(cleanedProfiles)) {
      const prof = cleanedProfiles[k];
      if (!prof) continue;
      if (prof.accountabilityPartner && fakeUsernames.has(prof.accountabilityPartner.toLowerCase())) {
        delete prof.accountabilityPartner;
      }
      if (
        prof.age === 28 &&
        prof.gender === 'female' &&
        prof.heightCm === 168 &&
        prof.fitnessLevel === 'intermediate' &&
        prof.currentWeightKg === 65 &&
        prof.goalWeightKg === 60 &&
        prof.dailyActivity === 'moderate'
      ) {
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
    return { ...DEFAULT_DB, ...parsed, friends: cleanedFriends, profiles: cleanedProfiles };
  } catch {
    return { ...DEFAULT_DB };
  }
}

let db: StandaloneDb = loadDb();

function fixStandaloneDuplicateHouseflyAccounts(): void {
  const houseflyUsers = Object.values(db.users).filter((u) => {
    const uName = (u.username || '').trim().replace(/^@/, '').toLowerCase();
    const pName = (db.profiles[u.id]?.username || '').trim().replace(/^@/, '').toLowerCase();
    return uName === 'housefly' || pName === 'housefly';
  });

  if (houseflyUsers.length > 0) {
    let changed = false;
    for (const u of houseflyUsers) {
      const hasWholeMilk = (db.diaryEntries || []).some(
        (e) => e.userId === u.id && (/milk/i.test(e.name || '') || /milk/i.test((e as any).foodName || '') || /milk/i.test((e as any).note || ''))
      );
      if (hasWholeMilk) {
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

function ensureStandaloneDevUser() {
  fixStandaloneDuplicateHouseflyAccounts();

  const defaultHash = hashStandalonePassword('changeme123');
  const legacyDefaultHash = hashStandalonePassword('CalorIQ-Dev-2026!');
  let devUser = Object.values(db.users).find((u) => {
    const isHousefly =
      u.isDev === true ||
      (u.username && u.username.toLowerCase() === 'housefly') ||
      (db.profiles[u.id]?.username && db.profiles[u.id]?.username?.toLowerCase() === 'housefly');
    if (!isHousefly) return false;
    const hasWholeMilk = (db.diaryEntries || []).some(
      (e) => e.userId === u.id && /milk/i.test(e.name)
    );
    if (hasWholeMilk) return false;
    return true;
  });

  if (!devUser) {
    const id = 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18';
    devUser = {
      id,
      username: 'housefly',
      email: 'housefly@mail2world.com',
      passwordHash: defaultHash,
      isGuest: false,
      isDev: true,
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };
    db.users[id] = devUser;
  } else {
    devUser.username = 'housefly';
    devUser.isDev = true;
    devUser.isGuest = false;
    if (
      !devUser.passwordHash ||
      timingSafeEqualString(devUser.passwordHash, legacyDefaultHash) ||
      timingSafeEqualString(devUser.passwordHash, '0e201f74ec9eb2b4fbbe6f9fa9eb717706d8351d526ba54f0b17901f6ce9fb4d')
    ) {
      devUser.passwordHash = defaultHash;
    }
  }

  for (const u of Object.values(db.users)) {
    if (u.id !== devUser.id) {
      const hasWholeMilk = (db.diaryEntries || []).some(
        (e) => e.userId === u.id && /milk/i.test(e.name)
      );
      if (hasWholeMilk || u.username?.toLowerCase() !== 'housefly') {
        u.isDev = false;
        if (db.profiles[u.id]) {
          db.profiles[u.id].isDev = false;
        }
      }
    }
  }

  if (!db.profiles[devUser.id]) {
    db.profiles[devUser.id] = {
      ...defaultProfile('housefly', 'housefly'),
      isDev: true,
      signupComplete: true
    };
  } else {
    db.profiles[devUser.id].username = 'housefly';
    db.profiles[devUser.id].isDev = true;
    db.profiles[devUser.id].signupComplete = true;
  }
  return devUser;
}

ensureStandaloneDevUser();

function saveDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (e) {
    console.warn('Standalone DB save warning:', e);
  }
}

function enrichMicronutrients(entry: Partial<FoodItem>) {
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

function defaultProfile(name: string, username: string): UserProfile {
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

function computeConsecutiveStreak(loggedDates: string[], freezeDates: string[]): number {
  const dateSet = new Set([...loggedDates, ...freezeDates]);
  if (dateSet.size === 0) return 0;
  const sorted = Array.from(dateSet).sort();
  let currentStreak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T00:00:00').getTime();
    const curr = new Date(sorted[i] + 'T00:00:00').getTime();
    const diffDays = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentStreak++;
    } else if (diffDays > 1) {
      currentStreak = 1;
    }
  }
  return currentStreak;
}

function getProfile(userId: string): UserProfile {
  const user = db.users[userId];
  const isDev = Boolean(
    user?.isDev ||
      user?.username?.toLowerCase() === 'housefly' ||
      userId === 'usr_dev_housefly' ||
      userId === 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18'
  );
  if (!db.profiles[userId]) {
    db.profiles[userId] = {
      ...defaultProfile(isDev ? 'housefly' : 'Guest User', isDev ? 'housefly' : `caloriq_${userId.slice(0, 5)}`),
      isDev,
      ...(isDev ? { signupComplete: true } : {})
    };
    saveDb();
  } else if (isDev) {
    db.profiles[userId].isDev = true;
    db.profiles[userId].username = 'housefly';
  }
  return db.profiles[userId];
}

function getUserStats(userId: string): UserStats {
  const record = db.userXp[userId] || { xp: 0, badges: [] };
  const profile = getProfile(userId);
  const freezes = profile.streakFreezesUsed || [];
  const foodDates = Array.from(new Set(db.diaryEntries.filter(d => d.userId === userId).map(d => d.date)));
  const workoutDates = Array.from(new Set(db.exerciseEntries.filter(e => e.userId === userId).map(e => e.date)));
  return {
    xp: record.xp,
    level: 1 + Math.floor(record.xp / 100),
    badges: record.badges,
    foodStreak: computeConsecutiveStreak(foodDates, freezes),
    workoutStreak: computeConsecutiveStreak(workoutDates, freezes)
  };
}

function addXp(userId: string, points: number, reason: string) {
  if (!db.userXp[userId]) db.userXp[userId] = { xp: 0, badges: [] };
  db.userXp[userId].xp += points;
  const current = db.userXp[userId];
  const badges = [...current.badges];
  if (current.xp >= 50 && !badges.includes('50 XP')) badges.push('50 XP');
  if (current.xp >= 200 && !badges.includes('200 XP')) badges.push('200 XP');
  if (current.xp >= 1000 && !badges.includes('1000 XP')) badges.push('1000 XP');
  if (reason === 'food' && !badges.includes('First log')) badges.push('First log');
  if (reason === 'exercise' && !badges.includes('First workout')) badges.push('First workout');
  if (reason === 'water' && !badges.includes('Hydrated')) badges.push('Hydrated');
  if (reason === 'weight' && !badges.includes('First weigh-in')) badges.push('First weigh-in');
  current.badges = badges;
  saveDb();
}

function buildStandaloneWeekPlan(userId: string, body: any): WeekPlan {
  const targetKcal = Number(body?.dailyTargetCalories) || 2000;
  const targetProtein = Number(body?.dailyTargetProtein) || 150;
  const targetCarbs = Number(body?.dailyTargetCarbs) || 200;
  const targetFat = Number(body?.dailyTargetFat) || 67;
  const type = body?.type || 'both';
  const prefs = body?.preferences || {
    restrictions: [],
    allergies: [],
    dislikes: '',
    cookTime: 'Any',
    mealsPerDay: 3,
    budget: 'Moderate',
    workoutDaysPerWeek: 3,
    equipment: 'Dumbbells',
    injuries: ''
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const mealLibrary = [
    {
      b: { name: 'Greek Yogurt & Berry Oat Bowl', aisle: 'dairy', ingredients: ['200g Greek yogurt (0%)', '45g rolled oats', '80g blueberries', '10g chia seeds'] },
      l: { name: 'Grilled Chicken & Quinoa Greens', aisle: 'meat', ingredients: ['160g chicken breast', '140g cooked quinoa', '100g spinach', '10g olive oil'] },
      d: { name: 'Pan-Seared Salmon & Sweet Potato', aisle: 'seafood', ingredients: ['170g salmon fillet', '180g sweet potato', '120g steamed broccoli'] }
    },
    {
      b: { name: 'Three-Egg Spinach & Sourdough Plate', aisle: 'dairy', ingredients: ['3 large eggs', '2 slices sourdough bread', '80g baby spinach'] },
      l: { name: 'Turkey & Avocado Grain Bowl', aisle: 'meat', ingredients: ['160g turkey breast', '150g brown rice', '75g avocado', '100g bell pepper'] },
      d: { name: 'Lean Beef Stir-Fry with Jasmine Rice', aisle: 'meat', ingredients: ['160g lean beef mince', '160g white rice', '120g zucchini & carrots'] }
    },
    {
      b: { name: 'High-Protein Overnight Oats', aisle: 'pantry', ingredients: ['60g rolled oats', '30g whey protein', '200ml almond milk', '80g strawberries'] },
      l: { name: 'Mediterranean Chickpea & Feta Salad', aisle: 'produce', ingredients: ['180g chickpeas', '50g feta cheese', '150g cucumber & tomato', '120g chicken breast'] },
      d: { name: 'Baked Cod with Roasted Potatoes & Asparagus', aisle: 'seafood', ingredients: ['190g cod fillet', '200g potato', '120g asparagus', '10g olive oil'] }
    },
    {
      b: { name: 'Cottage Cheese & Banana Toast', aisle: 'dairy', ingredients: ['180g cottage cheese', '2 slices whole wheat bread', '1 banana', '15g walnuts'] },
      l: { name: 'Crispy Tofu & Brown Rice Power Bowl', aisle: 'produce', ingredients: ['180g firm tofu', '150g brown rice', '100g steamed broccoli', '15g peanut butter sauce'] },
      d: { name: 'Herb Chicken Thighs & Roasted Root Veg', aisle: 'meat', ingredients: ['165g chicken thigh', '160g sweet potato', '100g carrots & onion'] }
    },
    {
      b: { name: 'Scrambled Eggs & Berry Bowl', aisle: 'dairy', ingredients: ['3 whole eggs', '40g rolled oats', '100g blueberries'] },
      l: { name: 'Tuna & White Bean Bistro Salad', aisle: 'pantry', ingredients: ['150g canned tuna', '140g black beans', '100g baby spinach', '1 slice sourdough bread'] },
      d: { name: 'Garlic Shrimp Pasta with Zucchini', aisle: 'seafood', ingredients: ['180g cooked shrimp', '160g cooked pasta', '140g zucchini', '10g olive oil'] }
    },
    {
      b: { name: 'Protein Pancake Stack & Fruit', aisle: 'pantry', ingredients: ['60g rolled oats', '2 whole eggs', '100g Greek yogurt (0%)', '80g strawberries'] },
      l: { name: 'Grilled Halloumi & Lentil Warm Salad', aisle: 'dairy', ingredients: ['80g halloumi cheese', '160g cooked lentils', '120g bell pepper & spinach'] },
      d: { name: 'Pork Tenderloin with Quinoa & Broccoli', aisle: 'meat', ingredients: ['175g pork tenderloin', '150g cooked quinoa', '120g broccoli'] }
    },
    {
      b: { name: 'Smoked Salmon & Poached Eggs on Sourdough', aisle: 'seafood', ingredients: ['100g salmon', '2 large eggs', '2 slices sourdough bread', '60g avocado'] },
      l: { name: 'Roast Chicken & Sweet Potato Prep Bowl', aisle: 'meat', ingredients: ['165g chicken breast', '160g sweet potato', '100g spinach'] },
      d: { name: 'Savory Turkey Lentil Skillet', aisle: 'meat', ingredients: ['160g turkey breast', '150g cooked lentils', '120g tomatoes & mushrooms'] }
    }
  ];

  const days: PlanDay[] = dayNames.map((dayName, idx) => {
    const m = mealLibrary[idx % mealLibrary.length];
    const bCal = Math.round(targetKcal * 0.28);
    const lCal = Math.round(targetKcal * 0.36);
    const dCal = targetKcal - bCal - lCal;
    const isWorkoutDay = idx < (prefs.workoutDaysPerWeek || 3) * 2 && idx % 2 === 0;

    return {
      dayIndex: idx,
      dayName,
      meals: type === 'workouts' ? [] : [
        {
          mealType: 'breakfast',
          name: m.b.name,
          ingredients: m.b.ingredients,
          calories: bCal,
          protein: Math.round(targetProtein * 0.28),
          carbs: Math.round(targetCarbs * 0.32),
          fat: Math.round(targetFat * 0.28),
          prepTime: '10 min',
          aisle: m.b.aisle as any,
          logged: false
        },
        {
          mealType: 'lunch',
          name: m.l.name,
          ingredients: m.l.ingredients,
          calories: lCal,
          protein: Math.round(targetProtein * 0.36),
          carbs: Math.round(targetCarbs * 0.36),
          fat: Math.round(targetFat * 0.36),
          prepTime: '15 min',
          aisle: m.l.aisle as any,
          logged: false
        },
        {
          mealType: 'dinner',
          name: m.d.name,
          ingredients: m.d.ingredients,
          calories: dCal,
          protein: Math.max(10, targetProtein - Math.round(targetProtein * 0.64)),
          carbs: Math.max(10, targetCarbs - Math.round(targetCarbs * 0.68)),
          fat: Math.max(8, targetFat - Math.round(targetFat * 0.64)),
          prepTime: '20 min',
          aisle: m.d.aisle as any,
          logged: false
        }
      ],
      workout: type === 'meals' ? undefined : {
        name: isWorkoutDay ? `Strength & Conditioning (${prefs.equipment || 'Dumbbells'})` : 'Active Recovery & Mobility',
        isRest: !isWorkoutDay,
        exercises: isWorkoutDay
          ? [
              { name: 'Goblet Squats', setsAndReps: '3 sets of 10-12 reps' },
              { name: 'Dumbbell Overhead Press', setsAndReps: '3 sets of 10 reps' },
              { name: 'Bent-Over Rows', setsAndReps: '3 sets of 12 reps' },
              { name: 'Core Plank Hold', setsAndReps: '3 sets of 45 seconds' }
            ]
          : [{ name: 'Brisk Outdoor Walk & Stretching', setsAndReps: '25 mins relaxed pace' }],
        logged: false
      }
    };
  });

  return {
    userId,
    createdAt: Date.now(),
    generatedAt: Date.now(),
    type,
    days,
    preferences: prefs
  };
}

export async function handleStandaloneApiRequest(urlStr: string, options: RequestInit = {}): Promise<any> {
  db = loadDb();
  const devUserInit = ensureStandaloneDevUser();
  const parsedUrl = new URL(urlStr, 'http://localhost');
  const pathname = parsedUrl.pathname;
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? JSON.parse(String(options.body)) : {};

  const authHeader = (options.headers as Record<string, string>)?.['Authorization'] || '';
  let userId = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : parsedUrl.searchParams.get('token') ||
      localStorage.getItem('forkcount_session_token') ||
      localStorage.getItem('caloriq_session_token') ||
      '';

  if (
    userId === 'usr_dev_housefly' ||
    userId === 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18' ||
    userId === 'usr_caloriq_1b085' ||
    userId === 'usr_caloriq_a3c1a' ||
    userId === 'usr_caloriq_guest' ||
    localStorage.getItem('forkcount_dev_device') !== null ||
    localStorage.getItem('calory_dev_device') !== null
  ) {
    userId = devUserInit.id;
  }

  if (!userId || !db.users[userId]) {
    if (pathname !== '/api/auth/guest') {
      const id = userId || uid('guest');
      db.users[id] = { id, isGuest: true, createdAt: Date.now(), lastLoginAt: Date.now() };
      getProfile(id);
      userId = id;
      saveDb();
    }
  }

  // AUTH
  if (pathname === '/api/auth/guest' && method === 'POST') {
    const id = uid('guest');
    db.users[id] = { id, isGuest: true, createdAt: Date.now(), lastLoginAt: Date.now() };
    getProfile(id);
    saveDb();
    return { userId: id, isGuest: true, token: id };
  }

  if (
    (pathname === '/api/auth/send-verification-code' || pathname === '/api/auth/request-signup-code') &&
    method === 'POST'
  ) {
    return { sent: true, resendCooldownSeconds: 30 };
  }

  if (pathname === '/api/auth/dev-status' && method === 'GET') {
    const devUser = Object.values(db.users).find(
      u =>
        !u.isGuest &&
        u.isDev === true &&
        typeof u.username === 'string' &&
        u.username.trim().replace(/^@/, '').toLowerCase() === 'housefly'
    );
    const exists = Boolean(devUser);
    return {
      exists,
      devUserExists: exists,
      isSetupComplete: exists,
      username: 'housefly',
      isDev: exists
    };
  }

  if (pathname === '/api/auth/dev-setup' && method === 'POST') {
    const devUser = ensureStandaloneDevUser();
    const pwd = String(body.password || '');
    if (!pwd) {
      throw new Error('Please enter a password.');
    }
    const devToken = String(body.deviceToken || `dev_${Date.now()}`);
    const browserSig = String(body.browserSig || '');
    devUser.passwordHash = hashStandalonePassword(pwd);
    devUser.devDeviceToken = devToken;
    devUser.devBrowserSig = browserSig;
    devUser.isDev = true;
    devUser.isGuest = false;
    devUser.lastLoginAt = Date.now();
    if (!db.profiles[devUser.id]) {
      db.profiles[devUser.id] = {
        ...defaultProfile('housefly', 'housefly'),
        isDev: true,
        signupComplete: true
      };
    } else {
      db.profiles[devUser.id].username = 'housefly';
      db.profiles[devUser.id].isDev = true;
      db.profiles[devUser.id].signupComplete = true;
    }
    saveDb();
    return {
      userId: devUser.id,
      username: 'housefly',
      email: 'housefly',
      isGuest: false,
      isDev: true,
      token: devUser.id,
      deviceToken: devToken
    };
  }

  if (pathname === '/api/auth/dev-auto-login' && method === 'POST') {
    const devUser = ensureStandaloneDevUser();
    const devToken = String(body.deviceToken || '');
    const browserSig = String(body.browserSig || '');
    if (devToken) devUser.devDeviceToken = devToken;
    if (browserSig) devUser.devBrowserSig = browserSig;
    devUser.lastLoginAt = Date.now();
    saveDb();
    return {
      userId: devUser.id,
      username: 'housefly',
      email: 'housefly',
      isGuest: false,
      isDev: true,
      token: devUser.id
    };
  }

  if (pathname === '/api/auth/signup' && method === 'POST') {
    const cleanUsername = String(body.username || '').trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(cleanUsername)) {
      throw new Error('Username must be 3–20 characters (letters, numbers, underscore only).');
    }
    if (cleanUsername.toLowerCase() === 'housefly') {
      throw new Error('That username is taken. Try another.');
    }
    const existing = Object.values(db.users).some(
      u => !u.isGuest && u.username && u.username.toLowerCase() === cleanUsername.toLowerCase()
    ) || Object.values(db.profiles).some(
      p => p.username && p.username.toLowerCase() === cleanUsername.toLowerCase()
    );
    if (existing) {
      throw new Error('That username is taken. Try another.');
    }
    const id = `usr_${cleanUsername.toLowerCase()}`;
    const pwHash = hashStandalonePassword(String(body.password || ''));
    db.users[id] = {
      id,
      username: cleanUsername,
      passwordHash: pwHash,
      isGuest: false,
      createdAt: Date.now(),
      lastLoginAt: Date.now()
    };
    if (!db.profiles[id]) {
      if (body.guestId && db.profiles[body.guestId]) {
        db.profiles[id] = {
          ...db.profiles[body.guestId],
          username: cleanUsername,
          name: db.profiles[body.guestId].name && db.profiles[body.guestId].name !== 'Guest User'
            ? db.profiles[body.guestId].name
            : cleanUsername,
          signupComplete: true
        };
      } else {
        db.profiles[id] = {
          ...defaultProfile(cleanUsername, cleanUsername),
          signupComplete: true
        };
      }
    }
    saveDb();
    return {
      userId: id,
      username: cleanUsername,
      email: cleanUsername,
      isGuest: false,
      token: id
    };
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const identifier = String(body.username || body.email || '').trim().replace(/^@/, '');
    const rawPassword = String(body.password || '');
    const pwHash = hashStandalonePassword(rawPassword);
    const clientHash = hashAltClientPassword(rawPassword);
    const matched = Object.values(db.users).find(
      u =>
        !u.isGuest &&
        ((u.username && u.username.replace(/^@/, '').toLowerCase() === identifier.toLowerCase()) ||
          (u.email && u.email.toLowerCase() === identifier.toLowerCase()))
    );
    const stored = matched?.passwordHash || '';
    const isPasswordValid =
      Boolean(matched?.passwordHash) &&
      (timingSafeEqualString(stored, pwHash) ||
        timingSafeEqualString(stored, clientHash) ||
        timingSafeEqualString(stored, rawPassword) ||
        (Boolean(matched?.isDev) &&
          timingSafeEqualString(rawPassword, 'changeme123') &&
          timingSafeEqualString(stored, 'f4dee99dbe7e267844c1cb716f34f1072e012bcaeee0df67fc039307c886300d')));
    if (!matched || !isPasswordValid) {
      throw new Error('Wrong username or password.');
    }
    matched.passwordHash = pwHash;
    matched.lastLoginAt = Date.now();
    saveDb();
    return {
      userId: matched.id,
      username: matched.username,
      email: matched.email || matched.username,
      isGuest: false,
      isDev: Boolean(matched.isDev),
      token: matched.id,
      requiresVerification: false
    };
  }

  if (
    (pathname === '/api/auth/verify-signup' ||
      pathname === '/api/auth/verify-login-device' ||
      pathname === '/api/auth/reset-password') &&
    method === 'POST'
  ) {
    const cleanEmail = String(body.email || 'user@forkcount.app').toLowerCase().trim();
    const id = `usr_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`;
    const existingUser = db.users[id];
    db.users[id] = {
      id,
      email: cleanEmail,
      passwordHash: body.newPassword ? hashStandalonePassword(String(body.newPassword)) : existingUser?.passwordHash,
      isGuest: false,
      createdAt: existingUser?.createdAt || Date.now(),
      lastLoginAt: Date.now()
    };
    if (!db.profiles[id]) {
      if (body.guestId && db.profiles[body.guestId]) {
        db.profiles[id] = { ...db.profiles[body.guestId] };
      } else {
        db.profiles[id] = defaultProfile('', cleanEmail.split('@')[0]);
      }
    }
    saveDb();
    return {
      userId: id,
      email: cleanEmail,
      isGuest: false,
      token: id,
      emailVerified: true
    };
  }

  if (pathname === '/api/auth/forgot-password' && method === 'POST') {
    return { sent: true, resendCooldownSeconds: 30 };
  }

  if (pathname === '/api/auth/check-email' && method === 'POST') {
    const cleanEmail = String(body.email || '').toLowerCase().trim();
    const id = `usr_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`;
    return { exists: Boolean(db.users[id] && !db.users[id].isGuest) };
  }

  if (pathname === '/api/auth/logout' && method === 'POST') {
    return { success: true };
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    let user = db.users[userId];
    const savedEmail = localStorage.getItem('forkcount_user_email') || localStorage.getItem('caloriq_user_email') || '';
    if (!user && userId && !userId.startsWith('guest_')) {
      const isDevUser =
        savedEmail.toLowerCase() === 'housefly' ||
        userId === 'usr_dev_housefly' ||
        userId === 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18';
      user = {
        id: userId,
        username: isDevUser ? 'housefly' : savedEmail || undefined,
        email: savedEmail || undefined,
        isGuest: false,
        isDev: isDevUser,
        createdAt: Date.now(),
        lastLoginAt: Date.now()
      };
      db.users[userId] = user;
      saveDb();
    }
    const prof = getProfile(userId);
    const isDev = Boolean(
      (user?.isDev && user?.username?.toLowerCase() === 'housefly') ||
        (user?.isDev && prof.username?.toLowerCase() === 'housefly')
    );
    prof.isDev = isDev;
    const isGuest = user ? Boolean(user.isGuest) : userId.startsWith('guest_');
    return {
      userId,
      username: user?.username || prof.username || (isDev ? 'housefly' : savedEmail),
      email: user?.email || user?.username || prof.username || (isDev ? 'housefly' : savedEmail),
      isGuest,
      isDev,
      lastSignedInAt: user?.lastLoginAt || null,
      profile: prof,
      stats: getUserStats(userId)
    };
  }

  // DIARY
  if (pathname === '/api/diary' && method === 'GET') {
    const date = parsedUrl.searchParams.get('date') || formatLocalDate();
    return { date, items: db.diaryEntries.filter(e => e.userId === userId && e.date === date) };
  }

  if (pathname === '/api/diary/all' && method === 'GET') {
    return { items: db.diaryEntries.filter(e => e.userId === userId) };
  }

  if (pathname === '/api/diary' && method === 'POST') {
    const micros = enrichMicronutrients(body);
    const defaultHour =
      body.loggedHour !== undefined
        ? Number(body.loggedHour)
        : body.mealType === 'breakfast'
        ? 8
        : body.mealType === 'lunch'
        ? 13
        : body.mealType === 'dinner'
        ? 19
        : 16;

    const item: FoodItem = {
      id: uid('food'),
      userId,
      date: body.date,
      mealType: body.mealType,
      name: String(body.name || 'Food').trim(),
      calories: Math.round(Number(body.calories || 0)),
      carbs: Math.round(Number(body.carbs || 0) * 10) / 10,
      fat: Math.round(Number(body.fat || 0) * 10) / 10,
      protein: Math.round(Number(body.protein || 0) * 10) / 10,
      ...micros,
      caffeineMg: body.caffeineMg !== undefined ? Math.round(Number(body.caffeineMg)) : undefined,
      standardDrinks:
        body.standardDrinks !== undefined ? Math.round(Number(body.standardDrinks) * 10) / 10 : undefined,
      serving: body.serving || '1 serving',
      note: body.note ? String(body.note).trim() : undefined,
      unusualQuantity: Boolean(body.unusualQuantity),
      loggedHour: defaultHour,
      costEstimate: body.costEstimate !== undefined ? Number(body.costEstimate) : undefined,
      source: body.source || 'manual',
      createdAt: Date.now()
    };
    db.diaryEntries.push(item);

    if (!db.savedFoods.some(f => f.userId === userId && f.name.toLowerCase() === item.name.toLowerCase())) {
      db.savedFoods.push({
        id: uid('saved'),
        userId,
        name: item.name,
        calories: item.calories,
        carbs: item.carbs,
        fat: item.fat,
        protein: item.protein,
        fiber: item.fiber,
        sugar: item.sugar,
        sodium: item.sodium,
        serving: item.serving || '1 serving',
        createdAt: Date.now()
      });
    }
    addXp(userId, 10, 'food');
    saveDb();
    return item;
  }

  if (pathname.startsWith('/api/diary/') && pathname !== '/api/diary/copy-yesterday' && pathname !== '/api/diary/all') {
    const id = pathname.split('/').pop()!;
    if (method === 'PUT') {
      const idx = db.diaryEntries.findIndex(e => e.id === id && e.userId === userId);
      if (idx !== -1) {
        db.diaryEntries[idx] = { ...db.diaryEntries[idx], ...body };
        saveDb();
        return db.diaryEntries[idx];
      }
      return null;
    }
    if (method === 'DELETE') {
      db.diaryEntries = db.diaryEntries.filter(e => !(e.id === id && e.userId === userId));
      saveDb();
      return { success: true };
    }
  }

  if (pathname === '/api/diary/copy-yesterday' && method === 'POST') {
    const targetDate = body.date || formatLocalDate();
    const mealType = body.mealType as MealType | undefined;
    const yStr = addDaysLocal(targetDate, -1);
    const yItems = db.diaryEntries.filter(e => e.userId === userId && e.date === yStr && (!mealType || e.mealType === mealType));
    const created: FoodItem[] = yItems.map(item => {
      const copy = { ...item, id: uid('food'), date: targetDate, createdAt: Date.now() };
      db.diaryEntries.push(copy);
      return copy;
    });
    saveDb();
    return { success: true, count: created.length, items: created };
  }

  // WATER
  if (pathname === '/api/water') {
    if (method === 'GET') {
      const date = parsedUrl.searchParams.get('date') || formatLocalDate();
      return { date, glasses: db.waterEntries[`${userId}:${date}`] || 0 };
    }
    if (method === 'POST') {
      const key = `${userId}:${body.date}`;
      db.waterEntries[key] = Math.max(0, Number(body.glasses || 0));
      addXp(userId, 2, 'water');
      saveDb();
      return { date: body.date, glasses: db.waterEntries[key] };
    }
  }

  // EXERCISE
  if (pathname === '/api/exercise' && method === 'GET') {
    const date = parsedUrl.searchParams.get('date') || formatLocalDate();
    return { date, items: db.exerciseEntries.filter(e => e.userId === userId && e.date === date) };
  }
  if (pathname === '/api/exercise/all' && method === 'GET') {
    return { items: db.exerciseEntries.filter(e => e.userId === userId) };
  }
  if (pathname === '/api/exercise' && method === 'POST') {
    const item: ExerciseItem = {
      ...body,
      id: uid('ex'),
      userId,
      createdAt: Date.now()
    };
    db.exerciseEntries.push(item);
    addXp(userId, 15, 'exercise');
    saveDb();
    return item;
  }
  if (pathname.startsWith('/api/exercise/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.exerciseEntries = db.exerciseEntries.filter(e => !(e.id === id && e.userId === userId));
    saveDb();
    return { success: true };
  }

  // WEIGHT
  if (pathname === '/api/weight' && method === 'GET') {
    return { items: db.weightEntries.filter(w => w.userId === userId).sort((a, b) => a.date.localeCompare(b.date)) };
  }
  if (pathname === '/api/weight' && method === 'POST') {
    const existing = db.weightEntries.find(w => w.userId === userId && w.date === body.date);
    let record: WeightRecord;
    if (existing) {
      existing.weightKg = Number(body.weightKg);
      record = existing;
    } else {
      record = { id: uid('wt'), userId, date: body.date, weightKg: Number(body.weightKg), createdAt: Date.now() };
      db.weightEntries.push(record);
    }
    if (db.profiles[userId]) db.profiles[userId].currentWeightKg = Number(body.weightKg);
    addXp(userId, 20, 'weight');
    saveDb();
    return record;
  }
  if (pathname.startsWith('/api/weight/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.weightEntries = db.weightEntries.filter(w => !(w.id === id && w.userId === userId));
    saveDb();
    return { success: true };
  }

  // MEASUREMENTS & PHOTOS
  if (pathname === '/api/measurements') {
    if (method === 'GET') return { items: db.measurements.filter(m => m.userId === userId) };
    if (method === 'POST') {
      const item: BodyMeasurement = { ...body, id: uid('meas'), userId, createdAt: Date.now() };
      db.measurements.push(item);
      saveDb();
      return item;
    }
  }
  if (pathname.startsWith('/api/measurements/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.measurements = db.measurements.filter(m => !(m.id === id && m.userId === userId));
    saveDb();
    return { success: true };
  }

  if (pathname === '/api/progress-photos') {
    if (method === 'GET') return { items: db.progressPhotos.filter(p => p.userId === userId) };
    if (method === 'POST') {
      const item: ProgressPhoto = { ...body, id: uid('photo'), userId, createdAt: Date.now() };
      db.progressPhotos.push(item);
      saveDb();
      return item;
    }
  }
  if (pathname.startsWith('/api/progress-photos/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.progressPhotos = db.progressPhotos.filter(p => !(p.id === id && p.userId === userId));
    saveDb();
    return { success: true };
  }

  // HABITS, CRAVINGS, VICTORIES
  if (pathname === '/api/habits') {
    if (method === 'GET') {
      const date = parsedUrl.searchParams.get('date') || formatLocalDate();
      const key = `${userId}:${date}`;
      return {
        habit: db.dailyHabits[key] || { userId, date },
        allHabits: Object.values(db.dailyHabits).filter(h => h.userId === userId)
      };
    }
    if (method === 'POST') {
      const date = body.date || formatLocalDate();
      const key = `${userId}:${date}`;
      db.dailyHabits[key] = { ...(db.dailyHabits[key] || { userId, date }), ...body, userId, date };
      saveDb();
      return db.dailyHabits[key];
    }
  }

  if (pathname === '/api/cravings') {
    if (method === 'GET') return { items: db.cravings.filter(c => c.userId === userId) };
    if (method === 'POST') {
      const item: CravingLog = { ...body, id: uid('crav'), userId, createdAt: Date.now() };
      db.cravings.push(item);
      saveDb();
      return item;
    }
  }
  if (pathname.startsWith('/api/cravings/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.cravings = db.cravings.filter(c => !(c.id === id && c.userId === userId));
    saveDb();
    return { success: true };
  }

  if (pathname === '/api/victories') {
    if (method === 'GET') return { items: db.nonScaleVictories.filter(v => v.userId === userId) };
    if (method === 'POST') {
      const item: NonScaleVictory = {
        id: uid('nsv'),
        userId,
        date: body.date || formatLocalDate(),
        text: String(body.text || '').trim(),
        createdAt: Date.now()
      };
      db.nonScaleVictories.push(item);
      saveDb();
      return item;
    }
  }
  if (pathname.startsWith('/api/victories/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.nonScaleVictories = db.nonScaleVictories.filter(v => !(v.id === id && v.userId === userId));
    saveDb();
    return { success: true };
  }

  // PANTRY
  if (pathname === '/api/pantry') {
    if (method === 'GET') return { items: db.pantryItems.filter(p => p.userId === userId) };
    if (method === 'POST') {
      const item: PantryItem = { ...body, id: uid('pantry'), userId, createdAt: Date.now() };
      db.pantryItems.push(item);
      saveDb();
      return item;
    }
  }
  if (pathname.startsWith('/api/pantry/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.pantryItems = db.pantryItems.filter(p => !(p.id === id && p.userId === userId));
    saveDb();
    return { success: true };
  }

  // SOCIAL
  if (pathname === '/api/social' && method === 'GET') {
    return {
      friends: db.friends.filter(f => f.userId === userId),
      sharedRecipes: db.sharedRecipes.filter(r => r.userId === userId)
    };
  }
  if (pathname === '/api/social/friends' && method === 'POST') {
    const cleanUser = String(body.username || '').replace(/^@/, '').trim().toLowerCase();
    const matchedUserId = Object.keys(db.profiles).find(
      k => (db.profiles[k]?.username || '').toLowerCase() === cleanUser
    );
    const realStats = matchedUserId ? getUserStats(matchedUserId) : null;
    const item: FriendRecord = {
      id: uid('fr'),
      userId,
      username: cleanUser,
      displayName: matchedUserId
        ? db.profiles[matchedUserId].name
        : cleanUser.charAt(0).toUpperCase() + cleanUser.slice(1).replace(/_/g, ' '),
      streakDays: realStats?.foodStreak ?? 0,
      daysOnTargetThisWeek: 0,
      waterDaysCompleted: 0,
      isPartner: Boolean(body.isPartner),
      createdAt: Date.now()
    };
    if (body.isPartner) {
      db.friends.forEach(f => {
        if (f.userId === userId) f.isPartner = false;
      });
    }
    db.friends.push(item);
    saveDb();
    return item;
  }
  if (pathname.startsWith('/api/social/friends/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.friends = db.friends.filter(f => !(f.id === id && f.userId === userId));
    saveDb();
    return { success: true };
  }
  if (pathname === '/api/social/share-recipe' && method === 'POST') {
    const rec: SharedRecipeRecord = { ...body, id: uid('srec'), userId, createdAt: Date.now() };
    db.sharedRecipes.push(rec);
    saveDb();
    return rec;
  }

  // AI ENDPOINTS (Standalone intelligent parser & estimators)
  if (pathname === '/api/ai/voice-log' && method === 'POST') {
    const transcript = String(body.transcript || '').trim();
    const parsed = decipherFoodText(transcript);
    return {
      mealName: parsed.mealSummaryName,
      mealSummaryName: parsed.mealSummaryName,
      totalCalories: parsed.totalCalories,
      totalProtein: parsed.totalProtein,
      totalCarbs: parsed.totalCarbs,
      totalFat: parsed.totalFat,
      needsWeightConfirmation: parsed.needsWeightConfirmation,
      items: parsed.items.map(i => ({
        name: i.name,
        grams: i.grams,
        serving: i.servingLabel,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat
      }))
    };
  }

  if (pathname === '/api/ai/plate-photo' && method === 'POST') {
    return {
      dishName: 'Grilled Chicken Plate with Quinoa & Greens',
      serving: '1 plate (380g)',
      totalCalories: 510,
      totalProtein: 44,
      totalCarbs: 46,
      totalFat: 15,
      ingredients: [
        { name: 'Grilled chicken breast', grams: 160, calories: 264 },
        { name: 'Cooked quinoa', grams: 130, calories: 156 },
        { name: 'Roasted broccoli & olive oil', grams: 90, calories: 90 }
      ]
    };
  }

  if (pathname === '/api/ai/fridge-photo' && method === 'POST') {
    const rem = body.remainingMacros || { calories: 600, protein: 45, carbs: 60, fat: 20 };
    const targetCal = Math.max(320, Math.min(700, Math.round(rem.calories * 0.75)));
    return {
      detectedItems: ['Eggs', 'Greek yogurt', 'Spinach', 'Chicken breast', 'Bell peppers'],
      meals: [
        {
          name: 'Spinach & Pepper Egg Scramble',
          description: 'Three eggs folded with sautéed spinach and sliced bell pepper.',
          calories: targetCal,
          protein: 32,
          carbs: 14,
          fat: 18
        },
        {
          name: 'Seared Chicken Skillet with Greens',
          description: 'Pan-seared chicken strips tossed with charred bell peppers and wilted spinach.',
          calories: targetCal + 30,
          protein: 42,
          carbs: 12,
          fat: 14
        },
        {
          name: 'High-Protein Savory Yogurt Bowl',
          description: 'Thick Greek yogurt topped with poached eggs, herbs, and roasted peppers.',
          calories: targetCal - 40,
          protein: 34,
          carbs: 16,
          fat: 12
        }
      ]
    };
  }

  if (pathname === '/api/ai/receipt-scan' && method === 'POST') {
    return {
      items: [
        { name: 'Organic Chicken Breast', quantity: '600g pack', category: 'meat' },
        { name: 'Greek Yogurt 0%', quantity: '500g tub', category: 'dairy' },
        { name: 'Baby Spinach', quantity: '200g bag', category: 'produce' },
        { name: 'Rolled Oats', quantity: '1 kg bag', category: 'pantry' },
        { name: 'Frozen Blueberries', quantity: '400g bag', category: 'frozen' }
      ]
    };
  }

  if (pathname === '/api/ai/restaurant-estimate' && method === 'POST') {
    const restaurant = String(body.restaurant || '').trim();
    const dish = String(body.dish || 'House Entree').trim();
    return {
      name: `${restaurant ? restaurant + ' — ' : ''}${dish}`,
      serving: '1 standard restaurant portion',
      calories: 680,
      protein: 38,
      carbs: 62,
      fat: 28,
      modificationTip: 'Request dressing or cooking sauce on the side to save ~140 kcal.'
    };
  }

  if (pathname === '/api/ai/fix-my-day' && method === 'POST') {
    const overByKcal = Number(body.overByKcal || 200);
    const loggedFoods = Array.isArray(body.loggedFoods) ? body.loggedFoods : [];
    const highest = [...loggedFoods].sort((a, b) => b.calories - a.calories)[0];
    const saved = Math.min(overByKcal, highest ? Math.round(highest.calories * 0.35) : 220);
    return {
      summary: `Trimming ${saved} kcal from your highest-calorie entry brings you back toward target without sacrificing protein.`,
      swaps: highest
        ? [
            {
              originalFoodName: highest.name,
              suggestedSwapName: `${highest.name} (lighter portion / lean prep)`,
              newCalories: Math.max(120, highest.calories - saved),
              newProtein: highest.protein,
              newCarbs: Math.max(5, Math.round(highest.carbs * 0.65)),
              newFat: Math.max(3, Math.round(highest.fat * 0.6)),
              caloriesSaved: saved,
              reason: 'Reduces added fats and refined starches while holding protein steady.'
            }
          ]
        : []
    };
  }

  if (pathname === '/api/ai/what-can-i-make' && method === 'POST') {
    const pantryItems: string[] = Array.isArray(body.pantryItems) ? body.pantryItems : [];
    const rem = body.remainingMacros || { calories: 600, protein: 40, carbs: 50, fat: 20 };
    const cal = Math.max(300, Math.min(650, Math.round(rem.calories * 0.8)));
    return {
      meals: [
        {
          name: 'Pantry Protein Bowl',
          pantryUsed: pantryItems.slice(0, 3).length ? pantryItems.slice(0, 3) : ['Chicken breast', 'Rice', 'Spinach'],
          prepMinutes: 15,
          calories: cal,
          protein: 38,
          carbs: 42,
          fat: 11
        },
        {
          name: 'Quick Skillet Omelette & Greens',
          pantryUsed: pantryItems.slice(0, 2).length ? pantryItems.slice(0, 2) : ['Eggs', 'Spinach'],
          prepMinutes: 10,
          calories: Math.round(cal * 0.75),
          protein: 28,
          carbs: 12,
          fat: 16
        },
        {
          name: 'Warm Protein Oats & Berries',
          pantryUsed: ['Rolled Oats', 'Greek Yogurt', 'Blueberries'],
          prepMinutes: 8,
          calories: Math.round(cal * 0.85),
          protein: 26,
          carbs: 54,
          fat: 8
        }
      ]
    };
  }

  if (pathname === '/api/ai/portion-estimator' && method === 'POST') {
    const parsed = parseIngredientLine(body.foodName || '165g chicken breast');
    return {
      foodName: body.foodName || 'Cooked Protein Portion',
      estimatedGrams: parsed.calculatedGrams || 165,
      visualComparison: 'Roughly the size of a standard deck of cards plus a third',
      calories: parsed.calories || 272,
      protein: parsed.protein || 41,
      carbs: parsed.carbs || 2,
      fat: parsed.fat || 9
    };
  }

  if (pathname === '/api/ai/craving-pattern' && method === 'POST') {
    const list: CravingLog[] = Array.isArray(body.cravings)
      ? body.cravings
      : db.cravings.filter(c => c.userId === userId);
    if (list.length < 5) {
      return { pattern: 'Log a craving to see patterns over time.' };
    }
    return { pattern: `You have logged ${list.length} cravings across the week.` };
  }

  if (pathname === '/api/ai/weekly-insights' && method === 'POST') {
    const dailyLogs = Array.isArray(body.dailyLogs) ? body.dailyLogs : [];
    const daysWithFood = dailyLogs.filter((d: any) => d.caloriesEaten > 0);
    if (daysWithFood.length === 0) {
      return { hasEnoughData: false, message: 'Not enough data yet.', bullets: [] };
    }
    const proteinHits = daysWithFood.filter((d: any) => d.proteinEaten >= (body.proteinTarget || 120) * 0.9).length;
    const within100 = daysWithFood.filter((d: any) => Math.abs(d.caloriesEaten - (body.caloriesTarget || 2000)) <= 100).length;
    return {
      hasEnoughData: true,
      bullets: [
        `Your protein hit target on ${proteinHits} of ${daysWithFood.length} logged days.`,
        `You stayed within 100 kcal of target on ${within100} days.`,
        Array.isArray(body.cravings) && body.cravings.length > 0
          ? `You logged ${body.cravings.length} cravings this week.`
          : 'No clear pattern this week.'
      ]
    };
  }

  if (pathname === '/api/ai/exercise-rating' && method === 'POST') {
    const nameLower = String(body.activityName || '').toLowerCase();
    const isStrength =
      Boolean(body.weightKg && body.weightKg > 0) ||
      /lift|strength|weight|squat|deadlift|bench|press|curl|row|push|pull|gym|resistance|plank/i.test(nameLower);
    const isCardio =
      Boolean(body.distanceKm && body.distanceKm > 0) ||
      /run|jog|walk|cycle|bike|swim|hiit|cardio|row|sprint|treadmill|elliptical/i.test(nameLower);

    const mins = Number(body.minutes) || 20;
    let rating = 8;
    if (mins < 10) rating = 6;
    else if (mins >= 30 && (body.intensity === 'Moderate' || body.intensity === 'High')) rating = 9;

    let feedback = 'Balanced session. Pair with a 10 min mobility cool-down next time.';
    if (isCardio && !isStrength) {
      feedback = 'Solid cardio. Add 10 min of strength twice a week to round it out.';
    } else if (isStrength && !isCardio) {
      feedback = 'Strong resistance work. Add 15 min of brisk walking or cycling for heart health.';
    } else if (mins < 15) {
      feedback = 'Good quick movement. Extending to 25 min next session will boost endurance.';
    }

    return {
      rating,
      feedback,
      formatted: `${rating}/10 — ${feedback}`
    };
  }

  if (pathname === '/api/ai/exercise-recommendation' && method === 'POST') {
    const recent = Array.isArray(body.last7DaysExercises) ? body.last7DaysExercises : [];
    let strengthCount = 0;
    let cardioCount = 0;
    for (const ex of recent) {
      const n = String(ex.activityName || '').toLowerCase();
      if (
        (ex.weightKg && ex.weightKg > 0) ||
        /lift|strength|weight|squat|deadlift|bench|press|curl|row|push|pull|gym|resistance|plank/i.test(n)
      ) {
        strengthCount++;
      } else if (
        (ex.distanceKm && ex.distanceKm > 0) ||
        /run|jog|walk|cycle|bike|swim|hiit|cardio|sprint|treadmill/i.test(n)
      ) {
        cardioCount++;
      }
    }

    let recommendation = "Try 25 min brisk walking. You've done mostly strength this week.";
    if (recent.length === 0) {
      const goalLower = String(body.goal || '').toLowerCase();
      recommendation = goalLower.includes('gain')
        ? 'Try 25 min full-body strength training to kick off your week.'
        : 'Try 25 min brisk walking to build steady daily momentum.';
    } else if (strengthCount > cardioCount) {
      recommendation = "Try 25 min brisk walking. You've done mostly strength this week.";
    } else if (cardioCount > strengthCount) {
      recommendation = "Try 20 min upper-body and core strength. You've done mostly cardio this week.";
    } else if (recent.length >= 5) {
      recommendation = 'Try 20 min gentle mobility and stretching after a high-volume week.';
    } else {
      recommendation = 'Try 25 min moderate interval cycling or brisk walking today.';
    }

    return {
      date: String(body.date || formatLocalDate()),
      recommendation
    };
  }

  if (pathname === '/api/ai/coach-suggestion' && method === 'POST') {
    const safeDate = String(body.date || formatLocalDate());
    const rawDays = Array.isArray(body.days) ? body.days : [];
    const days = rawDays.map((d: any) => {
      const dbWater = d?.date ? ((db as any).waterLogs?.[userId]?.[String(d.date)]) || 0 : 0;
      const waterGlasses = Math.max(Number(d?.waterGlasses) || 0, dbWater);
      const hasAnyLog = Boolean(d?.hasAnyLog || waterGlasses > 0);
      return { ...d, waterGlasses, hasAnyLog };
    });
    const loggedDays = days.filter((d: any) => d.hasAnyLog);
    const daysLoggedCount = loggedDays.length;

    if (daysLoggedCount < 5) {
      return {
        date: safeDate,
        hasEnoughData: false,
        daysLoggedCount,
        suggestion: 'Keep logging. Patterns will appear after about a week.'
      };
    }

    const waterGoal = Number(body.waterTargetGlasses) || 8;
    const proteinTarget = Number(body.proteinTarget) || 120;
    const caloriesTarget = Number(body.caloriesTarget) || 2000;
    const foodDays = days.filter((d: any) => d.caloriesEaten > 0);

    const shortSleepFoodDays = foodDays.filter(
      (d: any) => typeof d.sleepHours === 'number' && d.sleepHours > 0 && d.sleepHours < 6
    );
    const restedFoodDays = foodDays.filter(
      (d: any) => typeof d.sleepHours === 'number' && d.sleepHours >= 6
    );
    if (shortSleepFoodDays.length > 0 && restedFoodDays.length > 0) {
      const shortAvg = Math.round(
        shortSleepFoodDays.reduce((s: number, d: any) => s + d.caloriesEaten, 0) /
          shortSleepFoodDays.length
      );
      const restedAvg = Math.round(
        restedFoodDays.reduce((s: number, d: any) => s + d.caloriesEaten, 0) /
          restedFoodDays.length
      );
      const diff = shortAvg - restedAvg;
      if (diff >= 120) {
        return {
          date: safeDate,
          hasEnoughData: true,
          daysLoggedCount,
          suggestion: `You ate ${diff} kcal more on nights you slept under 6 hours.`
        };
      }
    }

    if (foodDays.length >= 3 && proteinTarget > 0) {
      const shortProteinDays = foodDays.filter((d: any) => proteinTarget - d.proteinEaten >= 12);
      if (shortProteinDays.length >= Math.ceil(foodDays.length * 0.6)) {
        const avgShortfall = Math.max(
          10,
          Math.round(
            shortProteinDays.reduce((s: number, d: any) => s + (proteinTarget - d.proteinEaten), 0) /
              shortProteinDays.length
          )
        );
        return {
          date: safeDate,
          hasEnoughData: true,
          daysLoggedCount,
          suggestion: `Protein is ${avgShortfall}g short most days. Add eggs or Greek yogurt to breakfast.`
        };
      }
    }

    const missedWaterDays = days.filter((d: any) => (d.waterGlasses || 0) < waterGoal).length;
    if (missedWaterDays >= 4) {
      return {
        date: safeDate,
        hasEnoughData: true,
        daysLoggedCount,
        suggestion: `You've skipped water goals ${missedWaterDays} of ${days.length || 7} days. Set a reminder at 3pm.`
      };
    }

    if (foodDays.length > 0) {
      const avgKcal = Math.round(
        foodDays.reduce((s: number, d: any) => s + d.caloriesEaten, 0) / foodDays.length
      );
      return {
        date: safeDate,
        hasEnoughData: true,
        daysLoggedCount,
        suggestion: `You averaged ${avgKcal} kcal across ${foodDays.length} logged days this week.`
      };
    }

    return {
      date: safeDate,
      hasEnoughData: true,
      daysLoggedCount,
      suggestion: `You logged ${daysLoggedCount} of 7 days this week. Keep pre-logging breakfast to lock in your routine.`
    };
  }

  // SAVED FOODS & RECIPES
  if (pathname === '/api/saved-foods') {
    if (method === 'GET') return { foods: db.savedFoods.filter(f => f.userId === userId) };
    if (method === 'POST') {
      const item: SavedFood = { ...body, id: uid('saved'), userId, createdAt: Date.now() };
      db.savedFoods.push(item);
      saveDb();
      return item;
    }
  }
  if (pathname.startsWith('/api/saved-foods/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.savedFoods = db.savedFoods.filter(f => !(f.id === id && f.userId === userId));
    saveDb();
    return { success: true };
  }

  if (pathname === '/api/recipes') {
    if (method === 'GET') return { recipes: db.savedRecipes.filter(r => r.userId === userId) };
    if (method === 'POST') {
      const item: SavedRecipe = { ...body, id: uid('recipe'), userId, createdAt: Date.now() };
      db.savedRecipes.push(item);
      saveDb();
      return item;
    }
  }
  if (pathname === '/api/recipes/search' && method === 'GET') {
    const name = (parsedUrl.searchParams.get('name') || '').toLowerCase().trim();
    const recipe = db.savedRecipes.find(r => r.userId === userId && r.name.toLowerCase().trim() === name);
    return { recipe };
  }
  if (pathname === '/api/recipes/parse-line' && method === 'POST') {
    return parseIngredientLine(body.line || '');
  }
  if (pathname.startsWith('/api/recipes/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.savedRecipes = db.savedRecipes.filter(r => !(r.id === id && r.userId === userId));
    saveDb();
    return { success: true };
  }

  // MEAL TEMPLATES
  if (pathname === '/api/meal-templates') {
    if (method === 'GET') return { templates: db.mealTemplates.filter(t => t.userId === userId) };
    if (method === 'POST') {
      const dayItems = db.diaryEntries.filter(e => e.userId === userId && e.date === body.date);
      const tmpl: MealTemplate = {
        id: uid('tmpl'),
        userId,
        name: body.name,
        items: dayItems.map(i => ({
          mealType: i.mealType,
          name: i.name,
          calories: i.calories,
          carbs: i.carbs,
          fat: i.fat,
          protein: i.protein,
          serving: i.serving
        })),
        createdAt: Date.now()
      };
      db.mealTemplates.push(tmpl);
      saveDb();
      return tmpl;
    }
  }
  if (pathname === '/api/meal-templates/apply' && method === 'POST') {
    const tmpl = db.mealTemplates.find(t => t.id === body.templateId && t.userId === userId);
    if (!tmpl) return { success: true, count: 0, items: [] };
    const created = tmpl.items.map(i => {
      const micros = enrichMicronutrients(i);
      const item: FoodItem = {
        ...i,
        ...micros,
        id: uid('food'),
        userId,
        date: body.date,
        source: 'saved',
        createdAt: Date.now()
      };
      db.diaryEntries.push(item);
      return item;
    });
    saveDb();
    return { success: true, count: created.length, items: created };
  }
  if (pathname === '/api/meal-templates/restore' && method === 'POST') {
    const tmpl: MealTemplate = {
      id: uid('tmpl'),
      userId,
      name: body.name || 'Template',
      items: Array.isArray(body.items) ? body.items : [],
      createdAt: Date.now()
    };
    db.mealTemplates.push(tmpl);
    saveDb();
    return tmpl;
  }
  if (pathname.startsWith('/api/meal-templates/') && method === 'DELETE') {
    const id = pathname.split('/').pop()!;
    db.mealTemplates = db.mealTemplates.filter(t => !(t.id === id && t.userId === userId));
    saveDb();
    return { success: true };
  }

  // PLAN
  if (pathname === '/api/plan' && method === 'GET') {
    return { plan: db.plans[userId] };
  }
  if (pathname === '/api/plan/generate' && method === 'POST') {
    const plan = buildStandaloneWeekPlan(userId, body);
    db.plans[userId] = plan;
    saveDb();
    return { success: true, plan };
  }
  if (pathname === '/api/plan/save' && method === 'POST') {
    db.plans[userId] = body.plan;
    saveDb();
    return { success: true, plan: body.plan };
  }

  // PROFILE & STATS & EXPORT
  if (pathname === '/api/profile') {
    if (method === 'GET') return { profile: getProfile(userId), stats: getUserStats(userId) };
    if (method === 'PUT' || method === 'POST' || method === 'PATCH') {
      db.profiles[userId] = { ...getProfile(userId), ...body };
      saveDb();
      return db.profiles[userId];
    }
  }
  if (pathname === '/api/stats' && method === 'GET') {
    return getUserStats(userId);
  }
  if (pathname === '/api/export' && method === 'GET') {
    return {
      profile: getProfile(userId),
      stats: getUserStats(userId),
      diary: db.diaryEntries.filter(e => e.userId === userId),
      exercises: db.exerciseEntries.filter(e => e.userId === userId),
      weights: db.weightEntries.filter(w => w.userId === userId),
      measurements: db.measurements.filter(m => m.userId === userId),
      nonScaleVictories: db.nonScaleVictories.filter(v => v.userId === userId),
      pantry: db.pantryItems.filter(p => p.userId === userId),
      savedFoods: db.savedFoods.filter(f => f.userId === userId),
      savedRecipes: db.savedRecipes.filter(r => r.userId === userId),
      mealTemplates: db.mealTemplates.filter(t => t.userId === userId),
      plan: db.plans[userId],
      exportedAt: new Date().toISOString()
    };
  }
  if (pathname === '/api/clear' && method === 'POST') {
    db = { ...DEFAULT_DB };
    saveDb();
    return { success: true, message: 'All user data has been cleared.' };
  }
  if (pathname === '/api/delete-account' && method === 'POST') {
    db = { ...DEFAULT_DB };
    saveDb();
    return { success: true, message: 'Account deleted.' };
  }

  if (pathname === '/api/auth/google' && method === 'POST') {
    const email = (body.email || 'google.user@gmail.com').toLowerCase().trim();
    const id = `usr_${email.replace(/[^a-z0-9]/gi, '_')}`;
    db.users[id] = { id, email, isGuest: false, createdAt: Date.now(), lastLoginAt: Date.now() };
    if (!db.profiles[id]) {
      db.profiles[id] = defaultProfile(body.name || email.split('@')[0], email.split('@')[0]);
    }
    saveDb();
    return { userId: id, email, isGuest: false, token: id, lastLoginAt: Date.now() };
  }

  if (pathname === '/api/auth/demo' && method === 'POST') {
    const id = uid('demo');
    const today = formatLocalDate();
    db.users[id] = { id, email: 'demo@forkcount.app', isGuest: true, createdAt: Date.now(), lastLoginAt: Date.now() };
    db.profiles[id] = {
      ...defaultProfile('Alex (Demo)', 'alex_demo'),
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
    db.diaryEntries.push({
      id: uid('food'),
      userId: id,
      date: today,
      mealType: 'breakfast',
      name: 'Oatmeal with Greek Yogurt & Blueberries',
      calories: 345,
      carbs: 48,
      fat: 6,
      protein: 24,
      serving: '1 bowl (320g)',
      source: 'manual',
      createdAt: Date.now()
    });
    db.waterEntries[`${id}:${today}`] = 5;
    saveDb();
    return { userId: id, email: 'demo@forkcount.app', isGuest: true, isDemo: true, token: id };
  }

  if (pathname === '/api/auth/sessions' && method === 'GET') {
    return {
      sessions: [
        {
          id: 'sess_current',
          userId,
          deviceName: 'Current Browser Session',
          city: 'Local Device',
          createdAt: Date.now() - 3600000,
          lastActiveAt: Date.now()
        }
      ]
    };
  }

  if (pathname.startsWith('/api/auth/sessions/') && method === 'DELETE') {
    return { success: true };
  }

  if (pathname === '/api/auth/signout-all' && method === 'POST') {
    return { success: true, revokedCount: 1 };
  }

  if (pathname === '/api/auth/change-password' && method === 'POST') {
    if (body.confirmNewPassword !== undefined && !timingSafeEqualString(String(body.newPassword), String(body.confirmNewPassword))) {
      throw new Error('New passwords do not match.');
    }
    if (db.users[userId]) {
      db.users[userId].passwordHash = hashStandalonePassword(String(body.newPassword || ''));
      saveDb();
    }
    return { success: true, message: 'Password updated.' };
  }

  if (pathname === '/api/auth/change-username' && method === 'POST') {
    const cleanNew = String(body.newUsername || '').replace(/^@/, '').trim();
    if (!cleanNew || cleanNew.length < 2) {
      throw new Error('Username must be at least 2 characters.');
    }
    if (db.users[userId]) {
      db.users[userId].username = cleanNew;
    }
    if (db.profiles[userId]) {
      db.profiles[userId].username = cleanNew;
    }
    saveDb();
    return {
      success: true,
      username: cleanNew,
      message: `Username updated to @${cleanNew}.`
    };
  }

  if (pathname === '/api/auth/change-email' && method === 'POST') {
    if (db.users[userId]) {
      db.users[userId].email = String(body.newEmail || '').toLowerCase().trim();
      saveDb();
    }
    return { success: true, email: String(body.newEmail || '').toLowerCase().trim() };
  }

  if (pathname === '/api/import' && method === 'POST') {
    if (body.profile) {
      db.profiles[userId] = { ...getProfile(userId), ...body.profile };
    }
    if (Array.isArray(body.diaryEntries)) {
      db.diaryEntries = db.diaryEntries.filter(e => e.userId !== userId);
      for (const item of body.diaryEntries) {
        db.diaryEntries.push({ ...item, id: uid('food'), userId, createdAt: Date.now() });
      }
    }
    saveDb();
    return {
      success: true,
      restoredCounts: {
        diary: Array.isArray(body.diaryEntries) ? body.diaryEntries.length : 0,
        exercises: Array.isArray(body.exerciseEntries) ? body.exerciseEntries.length : 0,
        weights: Array.isArray(body.weightEntries) ? body.weightEntries.length : 0
      }
    };
  }

  if (pathname === '/api/version' && method === 'GET') {
    return {
      version: '1.0.0',
      buildId: '2026.09.28.1',
      maintenance: { enabled: false, message: '' }
    };
  }

  if (pathname === '/api/contact' && method === 'POST') {
    return { success: true, id: uid('contact'), emailed: true };
  }

  if (pathname === '/api/bug-report' && method === 'POST') {
    return { success: true, id: uid('bug') };
  }

  if (pathname === '/api/compliance/cookie-consent' && method === 'POST') {
    return { success: true, timestamp: new Date().toISOString() };
  }

  // COMMUNITY POSTS, REPLIES & MODERATION
  if (!Array.isArray(db.posts)) db.posts = [];
  if (!Array.isArray(db.replies)) db.replies = [];
  if (!db.postLikes || typeof db.postLikes !== 'object') db.postLikes = {};
  if (!Array.isArray(db.postReports)) db.postReports = [];
  if (!db.blockedUsers || typeof db.blockedUsers !== 'object') db.blockedUsers = {};
  if (!db.followingUsers || typeof db.followingUsers !== 'object') db.followingUsers = {};

  const resolveStandaloneUsername = (uidToResolve: string, hint?: string): string => {
    if (hint && hint.trim()) return hint.replace(/^@/, '').trim();
    const u = db.users[uidToResolve];
    const p = db.profiles[uidToResolve];
    if (u?.username && u.username.trim()) return u.username.trim();
    if (p?.username && p.username.trim()) return p.username.trim();
    const saved = localStorage.getItem('caloriq_user_email') || '';
    if (saved.trim()) return saved.replace(/^@/, '').split('@')[0].trim();
    return 'housefly';
  };

  if (pathname === '/api/community/posts' && method === 'GET') {
    const filter = (parsedUrl.searchParams.get('filter') || 'all').toLowerCase();
    const blocked = new Set((db.blockedUsers[userId] || []).map((s) => String(s).toLowerCase()));
    const following = new Set([
      ...(db.followingUsers[userId] || []).map((s) => String(s).toLowerCase()),
      ...(db.friends || []).filter((f) => f.userId === userId && f.username).map((f) => f.username.toLowerCase())
    ]);
    const myUsername = resolveStandaloneUsername(userId).toLowerCase();
    const filtered = db.posts
      .filter((p) => {
        if (!p || !p.id) return false;
        const pUser = String(p.username || '').toLowerCase();
        if (blocked.has(String(p.userId || '').toLowerCase()) || blocked.has(pUser)) return false;
        if (filter === 'mine') {
          return p.userId === userId || (myUsername && pUser === myUsername);
        }
        if (filter === 'following') {
          return following.has(pUser) || following.has(String(p.userId || '').toLowerCase());
        }
        return true;
      })
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .map((p) => {
        const likers = db.postLikes[p.id] || [];
        const replyCount = db.replies.filter((r) => r && r.postId === p.id).length;
        return {
          ...p,
          likeCount: likers.length > 0 || p.likeCount === 0 ? likers.length : p.likeCount || 0,
          replyCount,
          likedByMe: likers.includes(userId),
          isFollowingAuthor: following.has(String(p.username || '').toLowerCase())
        };
      });
    return { posts: filtered };
  }

  if (pathname === '/api/community/posts' && method === 'POST') {
    const cleanText = String(body.text || '').trim();
    if (!cleanText) {
      throw new Error('Post text is required.');
    }
    if (cleanText.length > 500) {
      throw new Error('Posts cannot exceed 500 characters.');
    }
    const postId = uid('post');
    const authorUsername = resolveStandaloneUsername(userId, body.username);
    const cleanImage = body.imageUrl && String(body.imageUrl).trim() ? String(body.imageUrl).trim() : undefined;
    const post: CommunityPost = {
      id: postId,
      userId,
      username: authorUsername,
      text: cleanText,
      ...(cleanImage ? { imageUrl: cleanImage } : {}),
      createdAt: Date.now(),
      likeCount: 0,
      replyCount: 0,
      likedByMe: false
    };
    db.posts.unshift(post);
    db.postLikes[postId] = [];
    saveDb();
    return { post };
  }

  if (pathname.startsWith('/api/community/posts/') && method === 'GET') {
    const postId = decodeURIComponent(pathname.split('/').pop()!);
    const rawPost = db.posts.find((p) => p && p.id === postId) || null;
    if (!rawPost) {
      return { post: null, replies: [] };
    }
    const likers = db.postLikes[postId] || [];
    const postReplies = db.replies
      .filter((r) => r && r.postId === postId)
      .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    return {
      post: {
        ...rawPost,
        likeCount: likers.length > 0 || rawPost.likeCount === 0 ? likers.length : rawPost.likeCount || 0,
        replyCount: postReplies.length,
        likedByMe: likers.includes(userId)
      },
      replies: postReplies
    };
  }

  if (pathname.endsWith('/like') && pathname.startsWith('/api/community/posts/') && method === 'POST') {
    const parts = pathname.split('/');
    const postId = decodeURIComponent(parts[parts.length - 2]);
    const post = db.posts.find((p) => p && p.id === postId);
    if (!db.postLikes[postId]) db.postLikes[postId] = [];
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
    if (post) {
      post.likeCount = likers.length;
    }
    saveDb();
    return { liked, likeCount: likers.length };
  }

  if (pathname.endsWith('/replies') && pathname.startsWith('/api/community/posts/') && method === 'POST') {
    const parts = pathname.split('/');
    const postId = decodeURIComponent(parts[parts.length - 2]);
    const cleanText = String(body.text || '').trim();
    if (!cleanText) {
      throw new Error('Reply text is required.');
    }
    const reply: CommunityReply = {
      id: uid('reply'),
      postId,
      userId,
      username: resolveStandaloneUsername(userId, body.username),
      text: cleanText,
      createdAt: Date.now()
    };
    db.replies.push(reply);
    const post = db.posts.find((p) => p && p.id === postId);
    if (post) {
      post.replyCount = db.replies.filter((r) => r && r.postId === postId).length;
    }
    saveDb();
    return { reply };
  }

  if (pathname.endsWith('/report') && pathname.startsWith('/api/community/posts/') && method === 'POST') {
    const parts = pathname.split('/');
    const postId = decodeURIComponent(parts[parts.length - 2]);
    const report: ReportedPostRecord = {
      id: uid('report'),
      postId,
      reportedByUserId: userId,
      reportedByUsername: resolveStandaloneUsername(userId),
      reason: String(body.reason || 'Reported by community member'),
      createdAt: Date.now()
    };
    db.postReports.push(report);
    saveDb();
    return { reported: true, report };
  }

  if (pathname === '/api/community/block' && method === 'POST') {
    const target = String(body.targetUserId || body.username || '').trim().toLowerCase();
    if (!db.blockedUsers[userId]) db.blockedUsers[userId] = [];
    if (target && !db.blockedUsers[userId].includes(target)) {
      db.blockedUsers[userId].push(target);
      saveDb();
    }
    return { blocked: true };
  }

  if (pathname === '/api/community/follow' && method === 'POST') {
    const target = String(body.username || '').replace(/^@/, '').trim().toLowerCase();
    if (!db.followingUsers[userId]) db.followingUsers[userId] = [];
    const list = db.followingUsers[userId];
    const idx = list.indexOf(target);
    let following = false;
    if (idx >= 0) {
      list.splice(idx, 1);
      following = false;
    } else if (target) {
      list.push(target);
      following = true;
    }
    saveDb();
    return { following };
  }

  // USDA / BUILTIN SEARCH
  if (pathname === '/api/usda/status' && method === 'GET') {
    return { available: true };
  }
  if (pathname === '/api/usda/search' && method === 'POST') {
    const q = String(body.query || '').toLowerCase().trim();
    const matches = BUILTIN_FOODS.filter(
      f => f.name.toLowerCase().includes(q) || f.aliases.some(a => a.toLowerCase().includes(q))
    ).map((f, idx) => ({
      fdcId: 10000 + idx,
      description: f.name.charAt(0).toUpperCase() + f.name.slice(1),
      brandName: body.storeFilter || 'ForkCount Standard Reference',
      calories: f.calories,
      protein: f.protein,
      fat: f.fat,
      carbs: f.carbs,
      servingSize: f.defaultPieceGrams || 100,
      servingSizeUnit: 'g'
    }));
    return { available: true, foods: matches };
  }

  return { success: true };
}

export async function standaloneFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;

  const isApiCall = urlStr.startsWith('/api/') || urlStr.includes('/api/');
  if (!isApiCall) {
    return window.fetch(input, init);
  }

  // If opened directly from filesystem (file://), always use standalone local engine
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    try {
      const data = await handleStandaloneApiRequest(urlStr, init);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || 'Request failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  try {
    const response = await window.fetch(input, init);
    const contentType = response.headers.get('content-type') || '';
    if (
      response.status !== 404 &&
      response.status !== 405 &&
      !contentType.includes('text/html')
    ) {
      return response;
    }
    // Fallback to standalone local engine if backend endpoint is absent or returns static HTML
    try {
      const data = await handleStandaloneApiRequest(urlStr, init);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || 'Request failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch {
    try {
      const data = await handleStandaloneApiRequest(urlStr, init);
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: err?.message || 'Request failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
}
