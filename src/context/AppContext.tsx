import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type {
  FoodItem,
  ExerciseItem,
  UserProfile,
  UserStats,
  MealType,
  MacroTarget,
  WeightRecord,
  DailyHabitLog,
  CravingLog,
  NonScaleVictory,
  PantryItem
} from '../types/index.js';
import { api } from '../services/api.js';
import { calculateDailyCalorieTarget, calculateMacroTargets } from '../utils/nutritionMath.js';
import { triggerHaptic } from '../utils/haptics.js';
import { detectDefaultLanguage, SupportedLanguage, syncHtmlLangAttribute } from '../utils/i18n.js';
import { getDateBounds } from '../utils/validation.js';
import { trackEventOnce, checkDay7Retention } from '../utils/analytics.js';
import { formatLocalDate, addDaysLocal } from '../utils/dateUtils.js';

export interface UndoToastItem {
  id: string;
  label: string;
  onUndo: () => Promise<void>;
}

export type FastingPreset = '16:8' | '18:6' | '20:4' | '5:2';

interface AppContextType {
  userId: string;
  userEmail?: string;
  isGuest: boolean;
  isDev: boolean;
  guestRemainingMs: number;
  isGuestExpired: boolean;
  guestAiUsed: boolean;
  consumeGuestAiCall: () => boolean;
  isGuestLockOpen: boolean;
  openGuestLock: () => void;
  closeGuestLock: () => void;
  resetGuestSession: () => Promise<void>;
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  fastingPreset: FastingPreset;
  setFastingPreset: (preset: FastingPreset) => void;
  fastingStartedAt: number | null;
  fastingTargetHours: number;
  fastingRemainingSec: number;
  completedFasts: Record<string, string[]>;
  startFasting: (preset?: FastingPreset) => void;
  stopFasting: (markComplete?: boolean) => void;
  milestoneCelebration: number | null;
  dismissMilestone: () => void;
  activeDate: string;
  setActiveDate: (date: string) => void;
  diaryItems: FoodItem[];
  allDiaryItems: FoodItem[];
  waterGlasses: number;
  exercises: ExerciseItem[];
  allExercises: ExerciseItem[];
  weights: WeightRecord[];
  profile: UserProfile;
  stats: UserStats;
  macroTarget: MacroTarget;
  todayHabit: DailyHabitLog | null;
  allHabits: DailyHabitLog[];
  cravings: CravingLog[];
  victories: NonScaleVictory[];
  pantryItems: PantryItem[];
  isOnline: boolean;
  offlineQueueCount: number;
  isLoading: boolean;
  offlineWarning: string | null;
  setOfflineWarning: (warning: string | null) => void;
  isSyncing: boolean;
  saveStatus: 'saved' | 'saving' | 'error';
  hasSyncConflict: boolean;
  resolveSyncConflict: () => Promise<void>;
  isSessionExpiryWarningOpen: boolean;
  sessionExpiryRemainingSec: number;
  staySignedIn: () => void;
  lastSelectedMeal: MealType;
  setLastSelectedMeal: (meal: MealType) => void;
  selectedMealForAdd: MealType | null;
  isAddFoodOpen: boolean;
  openAddFood: (meal?: MealType) => void;
  closeAddFood: () => void;
  isAuthModalOpen: boolean;
  authModalMode: 'signup' | 'login';
  openAuthModal: (mode?: 'signup' | 'login') => void;
  closeAuthModal: () => void;
  undoToast: UndoToastItem | null;
  showUndoToast: (label: string, onUndo: () => Promise<void>) => void;
  triggerUndoableDelete: (label: string, onDelete: () => Promise<void>, onUndo: () => Promise<void>) => Promise<void>;
  dismissUndoToast: () => void;
  // Actions
  addFoodItem: (food: Omit<FoodItem, 'id' | 'userId' | 'createdAt'>) => Promise<FoodItem>;
  updateFoodItem: (id: string, updates: Partial<FoodItem>) => Promise<void>;
  deleteFoodItem: (id: string) => Promise<void>;
  logFoodAgainTomorrow: (food: FoodItem) => Promise<void>;
  updateWaterGlasses: (glasses: number) => Promise<void>;
  addExerciseItem: (exercise: Omit<ExerciseItem, 'id' | 'userId' | 'createdAt'>) => Promise<ExerciseItem>;
  deleteExerciseItem: (id: string) => Promise<void>;
  addWeightLog: (weightKg: number, date?: string) => Promise<void>;
  deleteWeightLog: (id: string) => Promise<void>;
  copyYesterdayMeals: (mealType?: MealType) => Promise<number>;
  updateUserProfile: (updates: Partial<UserProfile>) => Promise<void>;
  saveTodayHabit: (updates: Partial<DailyHabitLog>) => Promise<void>;
  addCravingItem: (entry: Omit<CravingLog, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  deleteCravingItem: (id: string) => Promise<void>;
  addVictoryItem: (text: string, date?: string) => Promise<void>;
  deleteVictoryItem: (id: string) => Promise<void>;
  addPantryEntry: (entry: Omit<PantryItem, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  deletePantryEntry: (id: string) => Promise<void>;
  refreshDayData: () => Promise<void>;
  onAuthSuccess: () => Promise<void>;
}

const getSavedThemeMode = (): 'dark' | 'light' | 'auto' => {
  if (typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('forkcount_theme_mode') || localStorage.getItem('caloriq_theme_mode');
      if (saved === 'dark' || saved === 'light' || saved === 'auto') {
        return saved;
      }
    } catch {
      // ignore
    }
  }
  return 'dark';
};

const defaultProfile: UserProfile = {
  name: '',
  age: 0,
  gender: '',
  heightCm: 0,
  fitnessLevel: '',
  currentWeightKg: 0,
  goalWeightKg: 0,
  dailyActivity: '',
  goalSpeed: '',
  unitSystem: 'metric',
  themeMode: getSavedThemeMode(),
  streakFreezesUsed: []
};

const defaultStats: UserStats = {
  xp: 0,
  level: 1,
  badges: [],
  foodStreak: 0,
  workoutStreak: 0
};

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const getTodayStr = () => formatLocalDate();

  const hasDevDeviceOnInit =
    typeof localStorage !== 'undefined' &&
    (localStorage.getItem('forkcount_dev_device') !== null || localStorage.getItem('calory_dev_device') !== null);
  const [userId, setUserId] = useState<string>(() => (hasDevDeviceOnInit ? 'usr_545648c7-5e38-44fc-adc5-373e0b3e5e18' : ''));
  const [userEmail, setUserEmail] = useState<string | undefined>(() => (hasDevDeviceOnInit ? 'housefly' : undefined));
  const [isGuest, setIsGuest] = useState<boolean>(() => (hasDevDeviceOnInit ? false : true));
  const [isDev, setIsDev] = useState<boolean>(() => (hasDevDeviceOnInit ? true : false));
  const [activeDate, setActiveDateState] = useState<string>(getTodayStr());

  // Guest 24-hour clock & 1-call AI limit
  const [guestStartedAt, setGuestStartedAt] = useState<number>(() => {
    const raw = localStorage.getItem('forkcount_guest_started_at') || localStorage.getItem('caloriq_guest_started_at');
    if (raw) {
      const parsed = Number(raw);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
    const now = Date.now();
    localStorage.setItem('forkcount_guest_started_at', String(now));
    return now;
  });
  const [guestRemainingMs, setGuestRemainingMs] = useState<number>(() =>
    Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - guestStartedAt))
  );
  const [guestAiUsed, setGuestAiUsed] = useState<boolean>(() =>
    localStorage.getItem('forkcount_guest_ai_used') === 'true' || localStorage.getItem('caloriq_guest_ai_used') === 'true'
  );
  const [isGuestLockOpen, setIsGuestLockOpen] = useState<boolean>(false);

  // Multi-language
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    const detected = detectDefaultLanguage();
    syncHtmlLangAttribute(detected);
    return detected;
  });
  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    syncHtmlLangAttribute(lang);
  };

  useEffect(() => {
    syncHtmlLangAttribute(language);
    checkDay7Retention();
  }, [language]);

  // Fasting timer (#13)
  const [fastingPreset, setFastingPreset] = useState<FastingPreset>(() => {
    return (
      (localStorage.getItem('forkcount_fast_preset') as FastingPreset) ||
      (localStorage.getItem('caloriq_fast_preset') as FastingPreset) ||
      '16:8'
    );
  });
  const [fastingStartedAt, setFastingStartedAt] = useState<number | null>(() => {
    const raw = localStorage.getItem('forkcount_fast_started_at') || localStorage.getItem('caloriq_fast_started_at');
    return raw ? Number(raw) : null;
  });
  const [fastingRemainingSec, setFastingRemainingSec] = useState<number>(0);
  const [completedFasts, setCompletedFasts] = useState<Record<string, string[]>>(() => {
    try {
      const raw = localStorage.getItem('forkcount_completed_fasts') || localStorage.getItem('caloriq_completed_fasts');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Milestone confetti (#34)
  const [milestoneCelebration, setMilestoneCelebration] = useState<number | null>(null);
  const dismissMilestone = () => setMilestoneCelebration(null);

  const openGuestLock = useCallback(() => setIsGuestLockOpen(true), []);
  const closeGuestLock = useCallback(() => setIsGuestLockOpen(false), []);

  const setActiveDate = useCallback((date: string) => {
    if (isGuest && date !== getTodayStr()) {
      openGuestLock();
      return;
    }
    const { minDate, maxDate } = getDateBounds();
    if (date > maxDate || date < minDate) {
      return;
    }
    setActiveDateState(date);
  }, [isGuest, openGuestLock]);

  const consumeGuestAiCall = useCallback((): boolean => {
    if (!isGuest) return true;
    if (guestAiUsed) {
      openGuestLock();
      return false;
    }
    setGuestAiUsed(true);
    localStorage.setItem('forkcount_guest_ai_used', 'true');
    return true;
  }, [isGuest, guestAiUsed, openGuestLock]);

  const getFastingHoursForPreset = (preset: FastingPreset): number => {
    if (preset === '18:6') return 18;
    if (preset === '20:4') return 20;
    if (preset === '5:2') return 24;
    return 16;
  };

  const fastingTargetHours = getFastingHoursForPreset(fastingPreset);

  const startFasting = (preset?: FastingPreset) => {
    const chosen = preset || fastingPreset;
    setFastingPreset(chosen);
    localStorage.setItem('forkcount_fast_preset', chosen);
    const now = Date.now();
    setFastingStartedAt(now);
    localStorage.setItem('forkcount_fast_started_at', String(now));
  };

  const stopFasting = useCallback((markComplete: boolean = false) => {
    if (markComplete || (fastingStartedAt && Date.now() - fastingStartedAt >= 3600 * 1000)) {
      const dStr = getTodayStr();
      setCompletedFasts(prev => {
        const list = prev[dStr] || [];
        const badgeLabel = `${fastingPreset} Fast Completed`;
        const nextList = list.includes(badgeLabel) ? list : [...list, badgeLabel];
        const next = { ...prev, [dStr]: nextList };
        localStorage.setItem('forkcount_completed_fasts', JSON.stringify(next));
        return next;
      });
    }
    setFastingStartedAt(null);
    setFastingRemainingSec(0);
    localStorage.removeItem('forkcount_fast_started_at');
  }, [fastingPreset, fastingStartedAt]);

  // Guest 24h live countdown & Fasting live countdown
  useEffect(() => {
    const tick = () => {
      if (isGuest) {
        const rem = Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - guestStartedAt));
        setGuestRemainingMs(rem);
      }
      if (fastingStartedAt) {
        const totalSec = getFastingHoursForPreset(fastingPreset) * 3600;
        const elapsedSec = Math.floor((Date.now() - fastingStartedAt) / 1000);
        const remSec = Math.max(0, totalSec - elapsedSec);
        setFastingRemainingSec(remSec);
        if (remSec === 0) {
          stopFasting(true);
        }
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [isGuest, guestStartedAt, fastingStartedAt, fastingPreset, stopFasting]);

  const [diaryItems, setDiaryItems] = useState<FoodItem[]>([]);
  const [allDiaryItems, setAllDiaryItems] = useState<FoodItem[]>([]);
  const [waterGlasses, setWaterGlasses] = useState<number>(0);
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [allExercises, setAllExercises] = useState<ExerciseItem[]>([]);
  const [weights, setWeights] = useState<WeightRecord[]>([]);
  const [profile, setProfile] = useState<UserProfile>(() =>
    hasDevDeviceOnInit
      ? { ...defaultProfile, name: 'N', username: 'housefly', isDev: true, signupComplete: true }
      : defaultProfile
  );
  const [stats, setStats] = useState<UserStats>(defaultStats);
  const [todayHabit, setTodayHabit] = useState<DailyHabitLog | null>(null);
  const [allHabits, setAllHabits] = useState<DailyHabitLog[]>([]);
  const [cravings, setCravings] = useState<CravingLog[]>([]);
  const [victories, setVictories] = useState<NonScaleVictory[]>([]);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);

  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [offlineQueueCount, setOfflineQueueCount] = useState<number>(0);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [offlineWarning, setOfflineWarning] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [hasSyncConflict, setHasSyncConflict] = useState<boolean>(false);

  // #21 Session expiry warning (25m idle -> 5m warning before sign out)
  const lastInteractionRef = useRef<number>(Date.now());
  const [isSessionExpiryWarningOpen, setIsSessionExpiryWarningOpen] = useState<boolean>(false);
  const [sessionExpiryRemainingSec, setSessionExpiryRemainingSec] = useState<number>(300);

  // #24 Remember last meal
  const [lastSelectedMeal, setLastSelectedMealState] = useState<MealType>(() => {
    const saved = localStorage.getItem('forkcount_last_meal') || localStorage.getItem('caloriq_last_meal');
    if (saved === 'breakfast' || saved === 'lunch' || saved === 'dinner' || saved === 'snack') {
      return saved;
    }
    return 'breakfast';
  });
  const setLastSelectedMeal = useCallback((meal: MealType) => {
    setLastSelectedMealState(meal);
    localStorage.setItem('forkcount_last_meal', meal);
  }, []);

  const [isAddFoodOpen, setIsAddFoodOpen] = useState<boolean>(false);
  const [selectedMealForAdd, setSelectedMealForAdd] = useState<MealType | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signup' | 'login'>('login');

  const [undoToast, setUndoToast] = useState<UndoToastItem | null>(null);
  const undoTimerRef = useRef<number | null>(null);

  // Compute targets
  const dailyCalories = calculateDailyCalorieTarget(profile);
  const macroTarget = calculateMacroTargets(dailyCalories);

  // Apply theme mode (dark / light / auto follows device setting)
  useEffect(() => {
    const mode = profile.themeMode || getSavedThemeMode();
    try {
      localStorage.setItem('forkcount_theme_mode', mode);
    } catch {
      // ignore
    }
    const root = document.documentElement;
    const applyTheme = () => {
      let useLight = false;
      if (mode === 'light') {
        useLight = true;
      } else if (mode === 'auto') {
        if (typeof window !== 'undefined' && window.matchMedia) {
          useLight = window.matchMedia('(prefers-color-scheme: light)').matches;
        }
      }
      if (useLight) {
        root.classList.add('light-theme', 'light-mode');
        root.classList.remove('dark');
      } else {
        root.classList.remove('light-theme', 'light-mode');
        root.classList.add('dark');
      }
    };
    applyTheme();
    if (mode === 'auto' && typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-color-scheme: light)');
      mq.addEventListener?.('change', applyTheme);
      return () => mq.removeEventListener?.('change', applyTheme);
    }
  }, [profile.themeMode]);

  // Monitor online/offline state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      api.flushOfflineQueue().then(() => {
        setOfflineQueueCount(api.getOfflineQueue().length);
      });
    };
    const handleOffline = () => {
      setIsOnline(false);
      setOfflineQueueCount(api.getOfflineQueue().length);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setOfflineQueueCount(api.getOfflineQueue().length);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // #19 Auto-save indicator & #20 Sync conflict banner subscriptions
  useEffect(() => {
    const unsubSave = api.onSaveStatusChange((status) => {
      setSaveStatus(status);
    });
    const unsubConflict = api.onSyncConflict((conflictDate) => {
      if (!conflictDate || conflictDate === activeDate) {
        setHasSyncConflict(true);
      }
    });
    return () => {
      unsubSave();
      unsubConflict();
    };
  }, [activeDate]);

  // #21 Session expiry warning for signed-in users (25 min idle -> 5 min warning)
  const staySignedIn = useCallback(() => {
    lastInteractionRef.current = Date.now();
    setIsSessionExpiryWarningOpen(false);
    setSessionExpiryRemainingSec(300);
  }, []);

  useEffect(() => {
    if (
      isGuest ||
      isDev ||
      localStorage.getItem('forkcount_dev_device') !== null ||
      localStorage.getItem('calory_dev_device') !== null
    ) {
      setIsSessionExpiryWarningOpen(false);
      return;
    }
    const recordActivity = () => {
      if (!isSessionExpiryWarningOpen) {
        lastInteractionRef.current = Date.now();
      }
    };
    window.addEventListener('mousedown', recordActivity, { passive: true });
    window.addEventListener('keydown', recordActivity, { passive: true });
    window.addEventListener('touchstart', recordActivity, { passive: true });
    window.addEventListener('scroll', recordActivity, { passive: true });

    const interval = window.setInterval(() => {
      const idleMs = Date.now() - lastInteractionRef.current;
      const warnThresholdMs = 25 * 60 * 1000; // 25 minutes
      const expireThresholdMs = 30 * 60 * 1000; // 30 minutes total
      if (idleMs >= expireThresholdMs) {
        setIsSessionExpiryWarningOpen(false);
        api.logout();
        api.initSession().then((session) => {
          setUserId(session.userId);
          setUserEmail(session.username || session.email);
          setIsGuest(session.isGuest);
          setIsDev(Boolean(session.isDev || session.profile?.isDev));
          if (session.profile) setProfile(session.profile);
          if (session.stats) setStats(session.stats);
        });
      } else if (idleMs >= warnThresholdMs) {
        setIsSessionExpiryWarningOpen(true);
        setSessionExpiryRemainingSec(Math.max(0, Math.ceil((expireThresholdMs - idleMs) / 1000)));
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousedown', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('touchstart', recordActivity);
      window.removeEventListener('scroll', recordActivity);
      window.clearInterval(interval);
    };
  }, [isGuest, isSessionExpiryWarningOpen]);

  const showUndoToast = useCallback((label: string, onUndo: () => Promise<void>) => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    const id = `undo_${Date.now()}`;
    setUndoToast({ id, label, onUndo });
    undoTimerRef.current = window.setTimeout(() => {
      setUndoToast(null);
    }, 5000);
  }, []);

  const dismissUndoToast = useCallback(() => {
    if (undoTimerRef.current) {
      window.clearTimeout(undoTimerRef.current);
    }
    setUndoToast(null);
  }, []);

  const triggerUndoableDelete = useCallback(async (
    label: string,
    onDelete: () => Promise<void>,
    onUndo: () => Promise<void>
  ) => {
    await onDelete();
    showUndoToast(label, onUndo);
  }, [showUndoToast]);

  // Load day data
  const loadDayData = useCallback(async (date: string) => {
    setIsSyncing(true);
    try {
      const [diaryRes, waterRes, exerciseRes, habitsRes] = await Promise.all([
        api.getDiary(date),
        api.getWater(date),
        api.getExercise(date),
        api.getHabits(date)
      ]);
      setDiaryItems(diaryRes.items || []);
      setWaterGlasses(waterRes.glasses || 0);
      setExercises(exerciseRes.items || []);
      setTodayHabit(habitsRes.habit || null);
      setAllHabits(habitsRes.allHabits || []);
    } catch (err) {
      console.error('Error loading day data:', err);
    } finally {
      setIsSyncing(false);
      setOfflineQueueCount(api.getOfflineQueue().length);
    }
  }, []);

  const loadGeneralData = useCallback(async () => {
    try {
      const [weightsRes, statsRes, allDiaryRes, allExRes, cravingsRes, victoriesRes, pantryRes] = await Promise.all([
        api.getWeights(),
        api.getStats(),
        api.getAllDiary(),
        api.getAllExercise(),
        api.getCravings(),
        api.getVictories(),
        api.getPantry()
      ]);
      setWeights(weightsRes.items || []);
      setStats(statsRes);
      setAllDiaryItems(allDiaryRes.items || []);
      setAllExercises(allExRes.items || []);
      setCravings(cravingsRes.items || []);
      setVictories(victoriesRes.items || []);
      setPantryItems(pantryRes.items || []);
    } catch (err) {
      console.error('Error loading general data:', err);
    }
  }, []);

  // Initialize session
  useEffect(() => {
    let unregisterSync: (() => void) | undefined;

    // Fallback: If init takes longer than 5 seconds, force loading to false and show offline warning
    const fallbackTimer = setTimeout(() => {
      setIsLoading(false);
      setIsGuest(true);
      setOfflineWarning('Could not reach server. Running in offline mode.');
    }, 5000);

    async function init() {
      setIsLoading(true);
      try {
        const session = await api.initSession();
        clearTimeout(fallbackTimer);
        setUserId(session.userId);
        setUserEmail(session.username || session.email);
        setIsGuest(session.isGuest);
        setIsDev(Boolean(session.isDev || session.profile?.isDev));
        if (session.profile) setProfile(session.profile);
        if (session.stats) setStats(session.stats);

        await Promise.all([
          loadDayData(activeDate),
          loadGeneralData()
        ]);

        unregisterSync = api.onSync(() => {
          loadDayData(activeDate);
          loadGeneralData();
        });
      } catch (err) {
        console.error('Failed to init session:', err);
        clearTimeout(fallbackTimer);
        setIsGuest(true);
        setOfflineWarning('Could not reach server. Running in offline mode.');
      } finally {
        clearTimeout(fallbackTimer);
        setIsLoading(false);
      }
    }

    init();

    return () => {
      clearTimeout(fallbackTimer);
      if (unregisterSync) unregisterSync();
    };
  }, []);

  // When activeDate changes, reload that date's data
  useEffect(() => {
    if (userId) {
      loadDayData(activeDate);
    }
  }, [activeDate, userId, loadDayData]);

  // Actions
  const openAddFood = (meal?: MealType) => {
    const chosen = meal || lastSelectedMeal || 'breakfast';
    setSelectedMealForAdd(chosen);
    setLastSelectedMeal(chosen);
    setIsAddFoodOpen(true);
  };

  const closeAddFood = () => {
    setIsAddFoodOpen(false);
    setSelectedMealForAdd(null);
  };

  const openAuthModal = useCallback((mode: 'signup' | 'login' = 'login') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  const addFoodItem = async (food: Omit<FoodItem, 'id' | 'userId' | 'createdAt'>): Promise<FoodItem> => {
    if (food.mealType) {
      setLastSelectedMeal(food.mealType);
    }
    const item = await api.addFood(food);
    trackEventOnce('first_meal_logged');
    if (food.date === activeDate) {
      setDiaryItems(prev => {
        const next = [...prev, item];
        const totalKcal = next.reduce((acc, i) => acc + i.calories, 0);
        const burned = exercises.reduce((acc, e) => acc + e.caloriesBurned, 0);
        const target = macroTarget.calories + burned;
        if (Math.abs(totalKcal - target) <= 100) {
          triggerHaptic('success');
        } else {
          triggerHaptic('medium');
        }
        return next;
      });
    } else {
      triggerHaptic('medium');
    }
    setAllDiaryItems(prev => [...prev, item]);
    loadGeneralData();
    setOfflineQueueCount(api.getOfflineQueue().length);
    return item;
  };

  const updateFoodItem = async (id: string, updates: Partial<FoodItem>): Promise<void> => {
    setDiaryItems(prev => prev.map(i => (i.id === id ? { ...i, ...updates } : i)));
    setAllDiaryItems(prev => prev.map(i => (i.id === id ? { ...i, ...updates } : i)));
    await api.updateFood(id, updates);
  };

  const deleteFoodItem = async (id: string): Promise<void> => {
    const target = diaryItems.find(i => i.id === id);
    setDiaryItems(prev => prev.filter(i => i.id !== id));
    setAllDiaryItems(prev => prev.filter(i => i.id !== id));
    await api.deleteFood(id);
    if (target) {
      showUndoToast(`Deleted "${target.name}"`, async () => {
        const { id: _id, userId: _u, createdAt: _c, ...rest } = target;
        await addFoodItem(rest);
      });
    }
  };

  const logFoodAgainTomorrow = async (food: FoodItem): Promise<void> => {
    const tomorrowStr = addDaysLocal(food.date, 1);
    const { id: _id, userId: _u, createdAt: _c, ...rest } = food;
    await addFoodItem({
      ...rest,
      date: tomorrowStr
    });
  };

  const updateWaterGlasses = async (glasses: number): Promise<void> => {
    const prevGlasses = waterGlasses;
    triggerHaptic(glasses >= 8 ? 'success' : 'light');
    setWaterGlasses(glasses);
    await api.setWater(activeDate, glasses);
    loadGeneralData();
    if (glasses < prevGlasses) {
      showUndoToast(`Removed water glass (${glasses} left)`, async () => {
        setWaterGlasses(prevGlasses);
        await api.setWater(activeDate, prevGlasses);
        loadGeneralData();
      });
    }
  };

  const addExerciseItem = async (exercise: Omit<ExerciseItem, 'id' | 'userId' | 'createdAt'>): Promise<ExerciseItem> => {
    if (isGuest) {
      openGuestLock();
      throw new Error('Guest account locked');
    }
    triggerHaptic('medium');
    const item = await api.addExercise(exercise);
    setExercises(prev => [...prev, item]);
    setAllExercises(prev => [...prev, item]);
    loadGeneralData();
    return item;
  };

  const deleteExerciseItem = async (id: string): Promise<void> => {
    const target = exercises.find(e => e.id === id);
    setExercises(prev => prev.filter(e => e.id !== id));
    setAllExercises(prev => prev.filter(e => e.id !== id));
    await api.deleteExercise(id);
    if (target) {
      showUndoToast(`Deleted "${target.activityName}"`, async () => {
        const { id: _id, userId: _u, createdAt: _c, ...rest } = target;
        await addExerciseItem(rest);
      });
    }
  };

  const addWeightLog = async (weightKg: number, date: string = activeDate): Promise<void> => {
    const hasCompletedOnboarding =
      Boolean(profile.signupComplete) ||
      localStorage.getItem('forkcount_signup_complete') === 'true' ||
      localStorage.getItem('caloriq_signup_complete') === 'true';
    if (isGuest && !hasCompletedOnboarding) {
      openGuestLock();
      return;
    }
    triggerHaptic('light');
    const record = await api.addWeight(date, weightKg);
    setWeights(prev => {
      const idx = prev.findIndex(w => w.date === date);
      let next: WeightRecord[];
      if (idx !== -1) {
        const copy = [...prev];
        copy[idx] = record;
        next = copy;
      } else {
        next = [...prev, record].sort((a, b) => a.date.localeCompare(b.date));
      }
      if (next.length >= 2) {
        const baseline = next[0].weightKg;
        const delta = Math.abs(weightKg - baseline);
        const milestones = [25, 10, 5, 1];
        for (const m of milestones) {
          const seenKey = `forkcount_milestone_${m}kg`;
          const oldSeenKey = `caloriq_milestone_${m}kg`;
          if (delta >= m && !localStorage.getItem(seenKey) && !localStorage.getItem(oldSeenKey)) {
            localStorage.setItem(seenKey, 'true');
            localStorage.setItem(oldSeenKey, 'true');
            setMilestoneCelebration(m);
            break;
          }
        }
      }
      return next;
    });
    setProfile(prev => ({ ...prev, currentWeightKg: weightKg }));
    loadGeneralData();
  };

  const deleteWeightLog = async (id: string): Promise<void> => {
    const target = weights.find(w => w.id === id);
    setWeights(prev => prev.filter(w => w.id !== id));
    await api.deleteWeight(id);
    if (target) {
      showUndoToast(`Deleted weight entry (${target.weightKg}kg)`, async () => {
        await addWeightLog(target.weightKg, target.date);
      });
    }
  };

  const copyYesterdayMeals = async (mealType?: MealType): Promise<number> => {
    const res = await api.copyYesterday(activeDate, mealType);
    if (res.items && res.items.length > 0) {
      triggerHaptic('medium');
      setDiaryItems(prev => [...prev, ...res.items]);
      setAllDiaryItems(prev => [...prev, ...res.items]);
    }
    loadGeneralData();
    return res.count;
  };

  const updateUserProfile = async (updates: Partial<UserProfile>): Promise<void> => {
    setProfile(prev => ({ ...prev, ...updates }));
    if (updates.signupComplete) {
      setIsGuest(false);
      setIsGuestLockOpen(false);
    }
    const updated = await api.updateProfile(updates);
    setProfile(prev => ({ ...prev, ...updated, ...updates }));
    loadGeneralData();
  };

  const saveTodayHabit = async (updates: Partial<DailyHabitLog>): Promise<void> => {
    const saved = await api.saveHabit(activeDate, updates);
    setTodayHabit(saved);
    setAllHabits(prev => {
      const idx = prev.findIndex(h => h.date === activeDate);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  };

  const addCravingItem = async (entry: Omit<CravingLog, 'id' | 'userId' | 'createdAt'>): Promise<void> => {
    const item = await api.addCraving(entry);
    setCravings(prev => [item, ...prev]);
  };

  const deleteCravingItem = async (id: string): Promise<void> => {
    const target = cravings.find(c => c.id === id);
    setCravings(prev => prev.filter(c => c.id !== id));
    await api.deleteCraving(id);
    if (target) {
      showUndoToast(`Deleted craving "${target.wantedFood}"`, async () => {
        const { id: _id, userId: _u, createdAt: _c, ...rest } = target;
        await addCravingItem(rest);
      });
    }
  };

  const addVictoryItem = async (text: string, date: string = activeDate): Promise<void> => {
    const item = await api.addVictory(date, text);
    setVictories(prev => [item, ...prev]);
    triggerHaptic('success');
  };

  const deleteVictoryItem = async (id: string): Promise<void> => {
    const target = victories.find(v => v.id === id);
    setVictories(prev => prev.filter(v => v.id !== id));
    await api.deleteVictory(id);
    if (target) {
      showUndoToast(`Deleted non-scale victory`, async () => {
        await addVictoryItem(target.text, target.date);
      });
    }
  };

  const addPantryEntry = async (entry: Omit<PantryItem, 'id' | 'userId' | 'createdAt'>): Promise<void> => {
    const item = await api.addPantryItem(entry);
    setPantryItems(prev => [item, ...prev]);
  };

  const deletePantryEntry = async (id: string): Promise<void> => {
    const target = pantryItems.find(p => p.id === id);
    setPantryItems(prev => prev.filter(p => p.id !== id));
    await api.deletePantryItem(id);
    if (target) {
      showUndoToast(`Removed "${target.name}" from pantry`, async () => {
        const { id: _id, userId: _u, createdAt: _c, ...rest } = target;
        await addPantryEntry(rest);
      });
    }
  };

  const refreshDayData = async () => {
    setHasSyncConflict(false);
    await Promise.all([
      loadDayData(activeDate),
      loadGeneralData()
    ]);
  };

  const resolveSyncConflict = async () => {
    setHasSyncConflict(false);
    await refreshDayData();
  };

  const onAuthSuccess = async () => {
    const session = await api.initSession();
    setUserId(session.userId);
    setUserEmail(session.username || session.email);
    setIsGuest(session.isGuest);
    setIsDev(Boolean(session.isDev || session.profile?.isDev));
    setIsGuestLockOpen(false);
    if (session.profile) {
      setProfile(prev =>
        prev.signupComplete && !session.profile.signupComplete
          ? { ...session.profile, ...prev, signupComplete: true, isDev: Boolean(session.isDev || session.profile?.isDev) }
          : { ...prev, ...session.profile, isDev: Boolean(session.isDev || session.profile?.isDev) }
      );
    }
    if (session.stats) setStats(session.stats);
    await refreshDayData();
  };

  const resetGuestSession = async () => {
    try {
      await api.clearAllData();
    } catch {
      // ignore
    }
    const now = Date.now();
    localStorage.setItem('forkcount_guest_started_at', String(now));
    localStorage.setItem('forkcount_guest_ai_used', 'false');
    setGuestStartedAt(now);
    setGuestRemainingMs(24 * 60 * 60 * 1000);
    setGuestAiUsed(false);
    setActiveDateState(getTodayStr());
    await refreshDayData();
  };

  return (
    <AppContext.Provider
      value={{
        userId,
        userEmail,
        isGuest,
        isDev,
        guestRemainingMs,
        isGuestExpired: isGuest && guestRemainingMs <= 0,
        guestAiUsed,
        consumeGuestAiCall,
        isGuestLockOpen,
        openGuestLock,
        closeGuestLock,
        resetGuestSession,
        language,
        setLanguage,
        fastingPreset,
        setFastingPreset,
        fastingStartedAt,
        fastingTargetHours,
        fastingRemainingSec,
        completedFasts,
        startFasting,
        stopFasting,
        milestoneCelebration,
        dismissMilestone,
        activeDate,
        setActiveDate,
        diaryItems,
        allDiaryItems,
        waterGlasses,
        exercises,
        allExercises,
        weights,
        profile,
        stats,
        macroTarget,
        todayHabit,
        allHabits,
        cravings,
        victories,
        pantryItems,
        isOnline,
        offlineQueueCount,
        isLoading,
        offlineWarning,
        setOfflineWarning,
        isSyncing,
        saveStatus,
        hasSyncConflict,
        resolveSyncConflict,
        isSessionExpiryWarningOpen,
        sessionExpiryRemainingSec,
        staySignedIn,
        lastSelectedMeal,
        setLastSelectedMeal,
        selectedMealForAdd,
        isAddFoodOpen,
        openAddFood,
        closeAddFood,
        isAuthModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        undoToast,
        showUndoToast,
        triggerUndoableDelete,
        dismissUndoToast,
        addFoodItem,
        updateFoodItem,
        deleteFoodItem,
        logFoodAgainTomorrow,
        updateWaterGlasses,
        addExerciseItem,
        deleteExerciseItem,
        addWeightLog,
        deleteWeightLog,
        copyYesterdayMeals,
        updateUserProfile,
        saveTodayHabit,
        addCravingItem,
        deleteCravingItem,
        addVictoryItem,
        deleteVictoryItem,
        addPantryEntry,
        deletePantryEntry,
        refreshDayData,
        onAuthSuccess
      }}
    >
      {offlineWarning && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] max-w-md w-[92%] bg-amber-950/95 border border-amber-500/50 rounded-xl px-4 py-2.5 text-center text-xs text-amber-200 shadow-2xl flex items-center justify-between gap-2 no-print"
        >
          <span className="font-medium">{offlineWarning}</span>
          <button
            type="button"
            onClick={() => setOfflineWarning(null)}
            className="text-amber-400 hover:text-amber-100 font-bold text-xs ml-2 px-1.5 py-0.5 rounded bg-amber-900/50"
            aria-label="Dismiss offline warning"
          >
            ✕
          </button>
        </div>
      )}
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
