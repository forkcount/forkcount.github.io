import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Droplets,
  Flame,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  CalendarPlus,
  RotateCcw,
  Sparkles,
  Check,
  Moon,
  Activity,
  BookOpen,
  Zap,
  Mic,
  Camera,
  Package,
  ChefHat,
  Wand2,
  RefreshCw,
  Compass
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import { decipherExerciseText } from '../utils/localAiEngine.js';
import { formatWeight } from '../utils/nutritionMath.js';
import {
  useDebounce,
  validateExerciseMinutes,
  validateWaterGlasses,
  isDailyTotalUnusual,
  findRecentDuplicateFood,
  getDateBounds
} from '../utils/validation.js';
import { SwipeableItem } from './SwipeableItem.js';
import { formatLocalDate, parseLocalDate } from '../utils/dateUtils.js';
import type { MealType, FoodItem } from '../types/index.js';

const TIPS_OF_THE_DAY = [
  'Logging meals before you eat keeps portion awareness effortless.',
  'Drinking a glass of water 15 minutes before meals supports steady hydration.',
  'Aiming for 25–35g of protein at breakfast helps keep afternoon cravings low.',
  'Weighing in at the same time each morning reduces normal daily water noise.',
  'Pre-logging dinner in the morning makes hitting your evening macro targets simpler.',
  'Whole fruits and vegetables add volume and fiber without high calorie density.',
  'Consistency across seven days matters far more than any single meal.'
];

const DAILY_REFLECTION_PROMPT = 'How did today go?';

interface DiaryTabProps {
  onNavigateToFitness: () => void;
}

export const DiaryTab: React.FC<DiaryTabProps> = ({ onNavigateToFitness }) => {
  const {
    userId,
    isLoading,
    activeDate,
    setActiveDate,
    diaryItems,
    allDiaryItems,
    waterGlasses,
    updateWaterGlasses,
    exercises,
    allExercises,
    addExerciseItem,
    profile,
    macroTarget,
    todayHabit,
    allHabits,
    saveTodayHabit,
    cravings,
    addCravingItem,
    deleteCravingItem,
    pantryItems,
    addPantryEntry,
    deletePantryEntry,
    addFoodItem,
    updateFoodItem,
    deleteFoodItem,
    logFoodAgainTomorrow,
    copyYesterdayMeals,
    openAddFood,
    lastSelectedMeal,
    isGuest,
    openGuestLock,
    weights
  } = useApp();

  const mealsSectionRef = useRef<HTMLDivElement | null>(null);
  const { minDate, maxDate: todayStr } = getDateBounds();
  const [pendingWaterCount, setPendingWaterCount] = useState<number | null>(null);
  const [pendingQuickDuplicate, setPendingQuickDuplicate] = useState<{
    mealType: MealType;
    food: { name: string; calories: number; carbs: number; fat: number; protein: number; serving: string };
  } | null>(null);

  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  // #13 Fix My Day AI suggestions state
  const [isFixingDay, setIsFixingDay] = useState(false);
  const [fixDayResult, setFixDayResult] = useState<{ summary: string; swaps: Array<{ originalFood: string; suggestedSwap: string; caloriesSaved: number; reason: string }> } | null>(null);
  // #14, #10, #11, #16 Pantry & AI Kitchen state
  const [newPantryName, setNewPantryName] = useState('');
  const [newPantryQty, setNewPantryQty] = useState('1 unit');
  const [isKitchenAiBusy, setIsKitchenAiBusy] = useState(false);
  const [kitchenMeals, setKitchenMeals] = useState<Array<{ name: string; description: string; calories: number; protein: number; carbs: number; fat: number }> | null>(null);
  // Swipe-left-to-delete state
  const [swipedItemId, setSwipedItemId] = useState<string | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  // Long-press "Log again tomorrow" state
  const [longPressedItemId, setLongPressedItemId] = useState<string | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  // Meal notes inline editor
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState<string>('');
  // #40 One-question daily journal draft
  const [journalDraft, setJournalDraft] = useState<string>(todayHabit?.journalAnswer || '');
  const [journalSavedMsg, setJournalSavedMsg] = useState(false);

  useEffect(() => {
    setJournalDraft(todayHabit?.journalAnswer || '');
  }, [activeDate, todayHabit?.journalAnswer]);

  // #39 Craving log inputs & AI pattern
  const [cravingFood, setCravingFood] = useState('');
  const [cravingIntensity, setCravingIntensity] = useState(3);
  const [cravingTrigger, setCravingTrigger] = useState('');
  const [aiCravingPattern, setAiCravingPattern] = useState<string | null>(null);

  useEffect(() => {
    if (cravings.length < 5) {
      setAiCravingPattern(null);
      return;
    }
    const cacheKey = `caloriq_craving_pattern_${cravings.length}_${cravings[0]?.id || ''}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      setAiCravingPattern(cached);
      return;
    }
    let cancelled = false;
    api
      .getCravingPattern(cravings)
      .then((res) => {
        if (!cancelled && res?.pattern) {
          setAiCravingPattern(res.pattern);
          localStorage.setItem(cacheKey, res.pattern);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [cravings]);

  // Inline Log Exercise box state (#16 draft save + #15 debounce)
  const [showExerciseBox, setShowExerciseBox] = useState(false);
  const [exerciseInput, setExerciseInput] = useState(() => {
    return localStorage.getItem('caloriq_draft_diary_exercise') || '';
  });
  const debouncedExerciseInput = useDebounce(exerciseInput, 400);
  const [isSavingExercise, setIsSavingExercise] = useState(false);
  const [inlineExerciseError, setInlineExerciseError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem('caloriq_draft_diary_exercise', exerciseInput);
  }, [exerciseInput]);

  const decipheredExercise = useMemo(
    () => decipherExerciseText(debouncedExerciseInput, profile?.currentWeightKg || 70),
    [debouncedExerciseInput, profile?.currentWeightKg]
  );

  const handleSaveInlineExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    setInlineExerciseError(null);
    if (!exerciseInput.trim() || decipheredExercise.totalCaloriesBurned <= 0) return;
    const minErr = validateExerciseMinutes(Math.max(1, Math.round(decipheredExercise.totalMinutes)));
    if (minErr) {
      setInlineExerciseError(minErr);
      return;
    }
    setIsSavingExercise(true);
    try {
      await addExerciseItem({
        date: activeDate,
        activityName: decipheredExercise.summaryTitle,
        met: decipheredExercise.averageMet,
        minutes: Math.max(1, Math.round(decipheredExercise.totalMinutes)),
        caloriesBurned: decipheredExercise.totalCaloriesBurned,
        intensity: decipheredExercise.overallIntensity
      });
      setExerciseInput('');
      localStorage.removeItem('caloriq_draft_diary_exercise');
      setShowExerciseBox(false);
      setCopyStatus(`Saved exercise (+${decipheredExercise.totalCaloriesBurned} kcal burned)`);
      setTimeout(() => setCopyStatus(null), 3000);
    } finally {
      setIsSavingExercise(false);
    }
  };

  const dailyPrompt = DAILY_REFLECTION_PROMPT;

  // Coach card state (last 7 days of everything logged, cached once per day)
  const [coachSuggestion, setCoachSuggestion] = useState<string>(
    'Keep logging. Patterns will appear after about a week.'
  );
  const coachFetchedKeyRef = useRef<string | null>(null);

  const coachSevenDaySummaries = useMemo(() => {
    const anchor = parseLocalDate(todayStr);
    const summaries = [];
    const caffeineRegex =
      /\b(coffee|espresso|latte|cappuccino|americano|matcha|tea|green tea|black tea|energy drink|pre[- ]?workout|caffeine|cola)\b/i;
    const alcoholRegex =
      /\b(wine|red wine|white wine|beer|lager|ipa|stout|ale|cider|vodka|whiskey|whisky|bourbon|gin|rum|tequila|cocktail|margarita|champagne|prosecco|spirits|liquor|alcohol)\b/i;

    for (let i = 0; i < 7; i++) {
      const d = new Date(anchor);
      d.setDate(d.getDate() - i);
      const dtStr = formatLocalDate(d);

      const dayFoods = allDiaryItems.filter((item) => item.date === dtStr);
      const dayEx = allExercises.filter((ex) => ex.date === dtStr);
      const dayHabit =
        dtStr === activeDate && todayHabit
          ? todayHabit
          : allHabits.find((h) => h.date === dtStr);
      const dayCravings = cravings.filter((c) => c.date === dtStr);
      const dayWater = dtStr === activeDate ? waterGlasses : 0;

      const caloriesEaten = dayFoods.reduce((s, f) => s + (f.calories || 0), 0);
      const proteinEaten = Math.round(dayFoods.reduce((s, f) => s + (f.protein || 0), 0) * 10) / 10;
      const carbsEaten = Math.round(dayFoods.reduce((s, f) => s + (f.carbs || 0), 0) * 10) / 10;
      const fatEaten = Math.round(dayFoods.reduce((s, f) => s + (f.fat || 0), 0) * 10) / 10;

      const caffeineItems = dayFoods
        .filter((f) => (typeof f.caffeineMg === 'number' && f.caffeineMg > 0) || caffeineRegex.test(f.name || '') || caffeineRegex.test(f.note || ''))
        .map((f) => (typeof f.caffeineMg === 'number' && f.caffeineMg > 0 ? `${f.name} (${f.caffeineMg}mg caffeine)` : f.name));
      const alcoholItems = dayFoods
        .filter((f) => (typeof f.standardDrinks === 'number' && f.standardDrinks > 0) || alcoholRegex.test(f.name || '') || alcoholRegex.test(f.note || ''))
        .map((f) => (typeof f.standardDrinks === 'number' && f.standardDrinks > 0 ? `${f.name} (${f.standardDrinks} std drinks)` : f.name));

      const hasHabitLog = Boolean(
        dayHabit &&
          (dayHabit.mood !== undefined ||
            dayHabit.energy !== undefined ||
            dayHabit.sleepHours !== undefined ||
            dayHabit.sleepQuality !== undefined ||
            (dayHabit.journalAnswer && dayHabit.journalAnswer.trim().length > 0))
      );

      const hasAnyLog =
        dayFoods.length > 0 ||
        dayEx.length > 0 ||
        dayWater > 0 ||
        hasHabitLog ||
        dayCravings.length > 0;

      summaries.push({
        date: dtStr,
        caloriesEaten,
        proteinEaten,
        carbsEaten,
        fatEaten,
        waterGlasses: dayWater,
        exerciseMinutes: dayEx.reduce((s, e) => s + (e.minutes || 0), 0),
        exerciseNames: dayEx.map((e) => e.activityName),
        mood: dayHabit?.mood,
        energy: dayHabit?.energy,
        sleepHours: dayHabit?.sleepHours,
        sleepQuality: dayHabit?.sleepQuality,
        reflection: dayHabit?.journalAnswer?.trim() || undefined,
        cravings: dayCravings.map((c) => ({
          wantedFood: c.wantedFood,
          intensity: c.intensity,
          time: c.time,
          trigger: c.trigger
        })),
        caffeineItems,
        alcoholItems,
        hasAnyLog
      });
    }
    return summaries;
  }, [allDiaryItems, allExercises, allHabits, todayHabit, cravings, waterGlasses, activeDate, todayStr]);

  useEffect(() => {
    if (isLoading) return;
    const uidKey = userId || 'user';
    const dayKey = `${uidKey}:${todayStr}`;
    const clientLoggedDays = coachSevenDaySummaries.filter((d) => d.hasAnyLog).length;

    try {
      const raw = localStorage.getItem('caloriq_diary_coach_v1');
      const map = raw ? JSON.parse(raw) : {};
      if (map[dayKey]?.hasEnoughData && map[dayKey]?.suggestion) {
        setCoachSuggestion(map[dayKey].suggestion);
        coachFetchedKeyRef.current = `${dayKey}:cached`;
        return;
      }
    } catch {
      // ignore storage errors
    }

    const requestKey = `${dayKey}:${clientLoggedDays >= 5 ? '5plus' : clientLoggedDays}`;
    if (coachFetchedKeyRef.current === requestKey) return;
    coachFetchedKeyRef.current = requestKey;

    api
      .getCoachSuggestion({
        userId: uidKey,
        date: todayStr,
        caloriesTarget: macroTarget.calories || 2000,
        proteinTarget: macroTarget.proteinGrams || 120,
        waterTargetGlasses: 8,
        days: coachSevenDaySummaries
      })
      .then((res) => {
        if (res?.suggestion) {
          setCoachSuggestion(res.suggestion);
        }
      })
      .catch(() => {
        setCoachSuggestion('Keep logging. Patterns will appear after about a week.');
      });
  }, [isLoading, userId, todayStr, coachSevenDaySummaries, macroTarget.calories, macroTarget.proteinGrams]);

  const dailyTip = useMemo(() => {
    const daySeed = Number(activeDate.replace(/-/g, '')) || 0;
    return TIPS_OF_THE_DAY[daySeed % TIPS_OF_THE_DAY.length];
  }, [activeDate]);

  const isMonday = useMemo(() => {
    const d = new Date(activeDate + 'T00:00:00');
    return d.getDay() === 1;
  }, [activeDate]);

  const mondayRecap = useMemo(() => {
    const d = parseLocalDate(activeDate);
    const last7: string[] = [];
    for (let i = 1; i <= 7; i++) {
      const p = new Date(d);
      p.setDate(p.getDate() - i);
      last7.push(formatLocalDate(p));
    }
    let daysLogged = 0;
    let validDaysForAvg = 0;
    let excludedDaysCount = 0;
    let excludedMealsCount = 0;
    let kcalSum = 0;
    let protSum = 0;
    for (const dt of last7) {
      const entries = allDiaryItems.filter(i => i.date === dt);
      if (entries.length > 0) {
        daysLogged++;
        const rawDayKcal = entries.reduce((s, e) => s + (e.calories || 0), 0);
        if (rawDayKcal > 20000) {
          excludedDaysCount++;
          continue;
        }
        const validEntries = entries.filter(e => {
          if ((e.calories || 0) > 10000) {
            excludedMealsCount++;
            return false;
          }
          return true;
        });
        if (validEntries.length === 0) {
          excludedDaysCount++;
          continue;
        }
        validDaysForAvg++;
        kcalSum += validEntries.reduce((s, e) => s + (e.calories || 0), 0);
        protSum += validEntries.reduce((s, e) => s + (e.protein || 0), 0);
      }
    }
    const avgKcal = validDaysForAvg > 0 ? Math.min(20000, Math.round(kcalSum / validDaysForAvg)) : 0;
    const avgProt = validDaysForAvg > 0 ? Math.min(1000, Math.round(protSum / validDaysForAvg)) : 0;
    const weekWeights = weights
      .filter(w => last7.includes(w.date))
      .sort((a, b) => a.date.localeCompare(b.date));
    const weightChangeKg =
      weekWeights.length >= 2
        ? Math.round((weekWeights[weekWeights.length - 1].weightKg - weekWeights[0].weightKg) * 10) / 10
        : 0;
    const diffFromTarget = avgKcal - macroTarget.calories;
    const totalOutlierDays = excludedDaysCount > 0 ? excludedDaysCount : (excludedMealsCount > 0 ? 1 : 0);
    const factLine =
      daysLogged === 0
        ? '0 days logged last week.'
        : `Logged ${daysLogged} of 7 days with an average daily difference of ${diffFromTarget > 0 ? `+${diffFromTarget}` : diffFromTarget} kcal vs target.`;
    return { daysLogged, avgKcal, avgProt, weightChangeKg, factLine, excludedDaysCount: totalOutlierDays };
  }, [activeDate, allDiaryItems, weights, macroTarget.calories]);

  const cravingPatternText = useMemo(() => {
    if (cravings.length === 0) {
      return 'Log a craving to see patterns over time.';
    }
    if (cravings.length < 5) {
      return 'Log a craving to see patterns.';
    }
    if (aiCravingPattern) {
      return aiCravingPattern;
    }
    return `Analyzing ${cravings.length} logged cravings...`;
  }, [cravings, aiCravingPattern]);

  // Compute daily numbers
  const hasStats = macroTarget.calories > 0;
  const totalEaten = diaryItems.reduce((sum, item) => sum + (item.calories || 0), 0);
  const totalBurned = exercises.reduce((sum, ex) => sum + (ex.caloriesBurned || 0), 0);
  const dailyTarget = hasStats ? macroTarget.calories + totalBurned : 0;
  const remaining = hasStats ? dailyTarget - totalEaten : 0;
  const isOverBudget = hasStats && remaining < 0;

  // Macros eaten
  const carbsEaten = Math.round(diaryItems.reduce((sum, i) => sum + (i.carbs || 0), 0) * 10) / 10;
  const fatEaten = Math.round(diaryItems.reduce((sum, i) => sum + (i.fat || 0), 0) * 10) / 10;
  const proteinEaten = Math.round(diaryItems.reduce((sum, i) => sum + (i.protein || 0), 0) * 10) / 10;
  const sodiumEaten = Math.round(
    diaryItems.reduce((sum, i) => {
      if (typeof i.sodium === 'number') return sum + i.sodium;
      return sum + Math.round((i.calories || 0) * 1.15);
    }, 0)
  );
  const sugarEaten =
    Math.round(
      diaryItems.reduce((sum, i) => {
        if (typeof i.sugar === 'number') return sum + i.sugar;
        const isSweet = /honey|sugar|chocolate|cookie|cake|juice|soda|syrup|jam|yogurt|berry|banana|fruit/i.test(
          i.name || ''
        );
        const c = i.carbs || 0;
        return sum + (isSweet ? Math.max(4, c * 0.35) : c * 0.1);
      }, 0) * 10
    ) / 10;
  const caffeineEatenMg = Math.round(
    diaryItems.reduce((sum, i) => {
      if (typeof i.caffeineMg === 'number') return sum + i.caffeineMg;
      const lower = `${i.name || ''} ${i.serving || ''}`.toLowerCase();
      if (/\b(decaf|decaffeinated|herbal)\b/.test(lower)) return sum;
      if (/\b(espresso)\b/.test(lower)) return sum + 63;
      if (/\b(coffee|americano|latte|cappuccino|cold brew|flat white)\b/.test(lower)) return sum + 95;
      if (/\b(matcha|energy drink|red bull|monster)\b/.test(lower)) return sum + 80;
      if (/\b(black tea|green tea|tea)\b/.test(lower)) return sum + 35;
      return sum;
    }, 0)
  );
  const standardDrinksEaten =
    Math.round(
      diaryItems.reduce((sum, i) => {
        if (typeof i.standardDrinks === 'number') return sum + i.standardDrinks;
        const lower = `${i.name || ''} ${i.serving || ''}`.toLowerCase();
        if (
          /\b(beer|lager|ale|ipa|stout|cider|wine|prosecco|champagne|whiskey|whisky|vodka|gin|rum|tequila|cocktail|margarita)\b/.test(
            lower
          ) &&
          !/\b(non-alcoholic|ginger beer|root beer|vinegar)\b/.test(lower)
        ) {
          return sum + 1;
        }
        return sum;
      }, 0) * 10
    ) / 10;

  // Macro progress percentages
  const carbsPercent = hasStats ? Math.min(100, Math.round((carbsEaten / (macroTarget.carbsGrams || 1)) * 100)) : 0;
  const fatPercent = hasStats ? Math.min(100, Math.round((fatEaten / (macroTarget.fatGrams || 1)) * 100)) : 0;
  const proteinPercent = hasStats ? Math.min(100, Math.round((proteinEaten / (macroTarget.proteinGrams || 1)) * 100)) : 0;

  // Ring calculation
  const ringProgress = hasStats ? Math.min(100, Math.max(0, Math.round((totalEaten / (dailyTarget || 1)) * 100))) : 0;
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (ringProgress / 100) * circumference;

  // Top 3 most-logged foods per meal slot (#7 Quick-log bar)
  const topFoodsByMeal = useMemo(() => {
    const result: Record<MealType, Array<{ name: string; calories: number; carbs: number; fat: number; protein: number; serving: string; count: number }>> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: []
    };
    const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
    for (const mt of mealTypes) {
      const counts = new Map<string, { name: string; calories: number; carbs: number; fat: number; protein: number; serving: string; count: number }>();
      for (const item of allDiaryItems) {
        if (item.mealType !== mt) continue;
        const key = item.name.toLowerCase().trim();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, {
            name: item.name,
            calories: item.calories,
            carbs: item.carbs,
            fat: item.fat,
            protein: item.protein,
            serving: item.serving || '1 portion',
            count: 1
          });
        }
      }
      result[mt] = Array.from(counts.values())
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
    }
    return result;
  }, [allDiaryItems]);

  // Most common combination for each meal slot (#8 "Same as usual" button)
  const usualComboByMeal = useMemo(() => {
    const result: Record<MealType, Array<{ name: string; calories: number; carbs: number; fat: number; protein: number; serving: string }>> = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: []
    };
    const mealTypes: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
    for (const mt of mealTypes) {
      const byDate = new Map<string, FoodItem[]>();
      for (const item of allDiaryItems) {
        if (item.mealType !== mt) continue;
        const list = byDate.get(item.date) || [];
        list.push(item);
        byDate.set(item.date, list);
      }
      const comboCounts = new Map<string, { count: number; items: FoodItem[] }>();
      for (const [, dayItems] of byDate.entries()) {
        if (dayItems.length === 0) continue;
        const signature = dayItems.map(i => i.name.toLowerCase().trim()).sort().join('||');
        const ex = comboCounts.get(signature);
        if (ex) {
          ex.count += 1;
        } else {
          comboCounts.set(signature, { count: 1, items: dayItems });
        }
      }
      const sorted = Array.from(comboCounts.values()).sort((a, b) => b.count - a.count);
      if (sorted.length > 0) {
        result[mt] = sorted[0].items.map(i => ({
          name: i.name,
          calories: i.calories,
          carbs: i.carbs,
          fat: i.fat,
          protein: i.protein,
          serving: i.serving || '1 portion'
        }));
      }
    }
    return result;
  }, [allDiaryItems]);

  // 7-day strip calculation
  const getSevenDays = () => {
    const curr = parseLocalDate(activeDate);
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(curr);
      d.setDate(d.getDate() + i);
      const str = formatLocalDate(d);
      const isSelected = str === activeDate;
      const dayLetter = d.toLocaleDateString('en-US', { weekday: 'narrow' });
      const dayNum = d.getDate();
      days.push({ str, isSelected, dayLetter, dayNum });
    }
    return days;
  };

  const handleCopyYesterday = async (mealType?: MealType) => {
    if (isGuest) {
      openGuestLock();
      return;
    }
    try {
      const count = await copyYesterdayMeals(mealType);
      if (count > 0) {
        setCopyStatus(
          mealType
            ? `Copied ${count} ${mealType} item(s) from yesterday`
            : `Copied ${count} meals from yesterday`
        );
      } else {
        setCopyStatus(mealType ? `No ${mealType} logged yesterday` : 'No meals recorded yesterday');
      }
      setTimeout(() => setCopyStatus(null), 3000);
    } catch {
      setCopyStatus('Could not copy yesterday');
      setTimeout(() => setCopyStatus(null), 3000);
    }
  };

  const handleWaterRequest = (newCount: number) => {
    const safeCount = Math.max(0, newCount);
    const warning = validateWaterGlasses(safeCount);
    if (warning && safeCount > waterGlasses) {
      setPendingWaterCount(safeCount);
      return;
    }
    setPendingWaterCount(null);
    updateWaterGlasses(safeCount);
  };

  const handleQuickLog = async (
    mealType: MealType,
    food: { name: string; calories: number; carbs: number; fat: number; protein: number; serving: string },
    forceDuplicate = false
  ) => {
    if (!forceDuplicate) {
      const dup = findRecentDuplicateFood(diaryItems, food.name, food.calories);
      if (dup) {
        setPendingQuickDuplicate({ mealType, food });
        return;
      }
    }
    setPendingQuickDuplicate(null);
    await addFoodItem({
      date: activeDate,
      mealType,
      name: food.name,
      calories: food.calories,
      carbs: food.carbs,
      fat: food.fat,
      protein: food.protein,
      serving: food.serving,
      source: 'saved'
    });
    setCopyStatus(`Quick-logged ${food.name}`);
    setTimeout(() => setCopyStatus(null), 2500);
  };

  const handleDuplicateItemToToday = async (item: FoodItem) => {
    await addFoodItem({
      date: todayStr,
      mealType: item.mealType,
      name: item.name,
      calories: item.calories,
      carbs: item.carbs,
      fat: item.fat,
      protein: item.protein,
      serving: item.serving || '1 portion',
      source: item.source || 'saved'
    });
    setCopyStatus(`Duplicated "${item.name}" into today`);
    setTimeout(() => setCopyStatus(null), 2500);
  };

  const handleSameAsUsual = async (mealType: MealType) => {
    const combo = usualComboByMeal[mealType];
    if (!combo || combo.length === 0) {
      setCopyStatus(`Log ${mealType} once first to set your usual`);
      setTimeout(() => setCopyStatus(null), 2500);
      return;
    }
    for (const f of combo) {
      await addFoodItem({
        date: activeDate,
        mealType,
        name: f.name,
        calories: f.calories,
        carbs: f.carbs,
        fat: f.fat,
        protein: f.protein,
        serving: f.serving,
        source: 'saved'
      });
    }
    setCopyStatus(`Logged usual ${mealType} (${combo.length} item${combo.length > 1 ? 's' : ''})`);
    setTimeout(() => setCopyStatus(null), 2500);
  };

  const handlePointerDownItem = (itemId: string, clientX: number) => {
    touchStartXRef.current = clientX;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
    }
    longPressTimerRef.current = window.setTimeout(() => {
      setLongPressedItemId(prev => (prev === itemId ? null : itemId));
    }, 500);
  };

  const handlePointerMoveItem = (itemId: string, clientX: number) => {
    if (touchStartXRef.current === null) return;
    const deltaX = clientX - touchStartXRef.current;
    if (Math.abs(deltaX) > 12 && longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    if (deltaX < -45) {
      setSwipedItemId(itemId);
    } else if (deltaX > 30 && swipedItemId === itemId) {
      setSwipedItemId(null);
    }
  };

  const handlePointerUpItem = () => {
    touchStartXRef.current = null;
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleSaveNote = async (itemId: string) => {
    await updateFoodItem(itemId, { note: noteDraft.trim() || undefined });
    setEditingNoteId(null);
    setNoteDraft('');
  };

  const mealsList: Array<{ type: MealType; title: string; ratio: number }> = [
    { type: 'breakfast', title: 'Breakfast', ratio: 0.25 },
    { type: 'lunch', title: 'Lunch', ratio: 0.35 },
    { type: 'dinner', title: 'Dinner', ratio: 0.30 },
    { type: 'snack', title: 'Snacks', ratio: 0.10 }
  ];

  return (
    <div className="space-y-5 pb-8 max-w-md mx-auto">
      {/* #10 Daily total over 10,000 kcal warning banner */}
      {isDailyTotalUnusual(totalEaten) && (
        <button
          type="button"
          onClick={() => mealsSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full bg-amber-950/80 hover:bg-amber-900/80 border border-amber-500/50 rounded-2xl px-4 py-3 flex items-center justify-between gap-2.5 text-left transition-colors shadow-lg"
        >
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-semibold text-amber-200">
              Today&apos;s total is unusual. Tap to review.
            </span>
          </div>
          <span className="text-[11px] font-mono text-amber-300 shrink-0">{totalEaten.toLocaleString()} kcal</span>
        </button>
      )}

      {/* #11 Quick-log duplicate confirmation banner */}
      {pendingQuickDuplicate && (
        <div className="bg-amber-950/80 border border-amber-500/50 rounded-2xl p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs text-amber-100 font-medium">
              You just logged this. Add another?
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPendingQuickDuplicate(null)}
              className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                handleQuickLog(pendingQuickDuplicate.mealType, pendingQuickDuplicate.food, true)
              }
              className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-lg text-xs"
            >
              Add another
            </button>
          </div>
        </div>
      )}

      {/* #32 "Why" pin at the top of the Diary every day */}
      {profile.pinnedWhy && (
        <div className="bg-zinc-900/90 border border-teal-500/30 rounded-2xl px-4 py-3 flex items-center gap-2.5">
          <Compass className="w-4 h-4 text-teal-400 shrink-0" />
          <p className="text-xs text-zinc-200 font-medium leading-relaxed">
            {profile.pinnedWhy}
          </p>
        </div>
      )}

      {/* Tip of the Day (Available to Guests & Accounts) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl px-4 py-3 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-teal-400 shrink-0 mt-0.5" />
        <div>
          <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 block">
            Tip of the Day
          </span>
          <p className="text-xs text-zinc-300 leading-relaxed mt-0.5">{dailyTip}</p>
        </div>
      </div>

      {/* #19 Weekly recap card on Mondays */}
      {isMonday && !isGuest && (
        <div className="bg-zinc-900/90 border border-teal-500/30 rounded-2xl p-4 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400">
              Monday Weekly Recap
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {mondayRecap.daysLogged} / 7 days logged
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2">
              <span className="text-[10px] text-zinc-500 block">Avg Calories</span>
              <span className="text-xs font-bold font-mono text-zinc-100">{mondayRecap.avgKcal} kcal</span>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2">
              <span className="text-[10px] text-zinc-500 block">Avg Protein</span>
              <span className="text-xs font-bold font-mono text-zinc-100">{mondayRecap.avgProt}g</span>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2">
              <span className="text-[10px] text-zinc-500 block">Weight Change</span>
              <span className="text-xs font-bold font-mono text-teal-400">
                {mondayRecap.weightChangeKg > 0 ? '+' : ''}
                {formatWeight(mondayRecap.weightChangeKg, profile.unitSystem)}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-zinc-300">{mondayRecap.factLine}</p>
          {mondayRecap.excludedDaysCount > 0 && (
            <p className="text-[11px] text-amber-300 font-mono">
              {mondayRecap.excludedDaysCount === 1
                ? '1 day excluded from averages (unusual entry).'
                : `${mondayRecap.excludedDaysCount} days excluded from averages (unusual entry).`}
            </p>
          )}
        </div>
      )}
      {/* 7-Day Strip with day chevrons and fill bars (#12 no future dates) */}
      <div className="bg-zinc-900/90 border border-zinc-800/90 rounded-2xl p-2.5">
        <div className="flex items-center justify-between gap-1">
          {getSevenDays().map((day) => {
            const isOutOfBounds = day.str > todayStr || day.str < minDate;
            return (
              <button
                key={day.str}
                type="button"
                disabled={isOutOfBounds}
                onClick={() => !isOutOfBounds && setActiveDate(day.str)}
                className={`flex-1 py-1.5 px-1 rounded-xl flex flex-col items-center gap-1 transition-all ${
                  day.isSelected
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : isOutOfBounds
                      ? 'text-zinc-700 opacity-40 cursor-not-allowed'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
              >
                <span className="text-[10px] font-medium uppercase">{day.dayLetter}</span>
                <span className={`text-xs font-semibold ${day.isSelected ? 'text-teal-300' : 'text-zinc-200'}`}>
                  {day.dayNum}
                </span>
                <div className="w-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      day.isSelected ? 'bg-teal-400' : 'bg-zinc-600'
                    }`}
                    style={{ width: day.isSelected ? `${Math.min(100, ringProgress)}%` : '40%' }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* TOP CALORIE RING CARD */}
      <div
        className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl relative overflow-hidden"
        aria-describedby="sr-calorie-ring-summary"
      >
        <p id="sr-calorie-ring-summary" className="sr-only">
          {hasStats
            ? `Daily calorie summary: ${totalEaten} kilocalories eaten, ${totalBurned} kilocalories burned from exercise, daily target ${dailyTarget} kilocalories, ${Math.abs(remaining)} kilocalories ${isOverBudget ? 'over budget' : 'remaining'}.`
            : 'Daily calorie summary: Set up your profile to calculate your daily calorie target.'}
        </p>
        <div className="flex flex-col items-center justify-center">
          <div className="relative w-44 h-44 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
              <circle
                cx="50"
                cy="50"
                r="42"
                strokeWidth="7"
                className="stroke-zinc-800 fill-none"
              />
              <circle
                cx="50"
                cy="50"
                r="42"
                strokeWidth="7"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className={`fill-none transition-all duration-700 ease-out ${
                  isOverBudget ? 'stroke-rose-500' : 'stroke-teal-500'
                }`}
              />
            </svg>

            <div className="absolute flex flex-col items-center justify-center text-center px-3">
              <span
                className={`text-3xl font-extrabold tracking-tight font-mono ${
                  isOverBudget ? 'text-rose-400' : 'text-zinc-100'
                }`}
              >
                {hasStats ? Math.abs(remaining) : '—'}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-400">
                {hasStats ? (isOverBudget ? 'kcal over' : 'kcal remaining') : 'Set up your profile'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 w-full pt-4 mt-2 border-t border-zinc-800/80 text-center">
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Eaten</span>
              <span className="text-sm font-bold text-zinc-200 font-mono">{totalEaten}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Exercise</span>
              <span className="text-sm font-bold text-teal-400 font-mono">+{totalBurned}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Target</span>
              <span className="text-sm font-bold text-zinc-200 font-mono">{hasStats ? dailyTarget : '—'}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 block uppercase tracking-wider">Left</span>
              <span className={`text-sm font-bold font-mono ${isOverBudget ? 'text-rose-400' : 'text-teal-400'}`}>
                {hasStats ? remaining : '—'}
              </span>
            </div>
          </div>

          <div className="mt-3 text-[11px] text-zinc-400 font-mono bg-zinc-950/80 px-3 py-1.5 rounded-xl border border-zinc-800/60 text-center w-full flex items-center justify-center gap-1.5">
            {isOverBudget ? (
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            ) : (
              <TrendingUp className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            )}
            <span>
              {hasStats
                ? `Target (${macroTarget.calories} + ${totalBurned}) − Eaten (${totalEaten}) = ${remaining} kcal`
                : 'Enter your stats to see your calorie target.'}
            </span>
          </div>

          {/* #13 "Fix my day" button when over goal (#14 Calculating... & #13 skeleton) */}
          {isOverBudget && (
            <div className="w-full mt-3 space-y-2">
              <button
                type="button"
                disabled={isFixingDay}
                onClick={async () => {
                  setIsFixingDay(true);
                  try {
                    const res = await api.suggestFixMyDay(Math.abs(remaining), diaryItems);
                    setFixDayResult(res);
                  } catch {
                    // ignore
                  } finally {
                    setIsFixingDay(false);
                  }
                }}
                className="w-full py-2 bg-rose-500/15 hover:bg-rose-500/25 disabled:opacity-50 border border-rose-500/40 text-rose-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                {isFixingDay
                  ? 'Calculating...'
                  : `Fix my day (Suggest smart swaps for ${Math.abs(remaining)} kcal over)`}
              </button>

              {isFixingDay && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 animate-pulse">
                  <div className="h-3 w-3/4 bg-zinc-800 rounded" />
                  <div className="h-10 w-full bg-zinc-900 rounded-lg" />
                  <div className="h-10 w-full bg-zinc-900 rounded-lg" />
                </div>
              )}

              {!isFixingDay && fixDayResult && (
                <div className="p-3 bg-zinc-950 border border-rose-500/30 rounded-xl text-left space-y-2">
                  <p className="text-xs text-zinc-200 font-medium">{fixDayResult.summary}</p>
                  <div className="space-y-1.5">
                    {(fixDayResult.swaps || []).map((sw, idx) => (
                      <div key={idx} className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-[11px]">
                        <div className="flex justify-between font-semibold text-zinc-200">
                          <span>{sw.originalFood} → {sw.suggestedSwap}</span>
                          <span className="text-teal-400 font-mono">−{sw.caloriesSaved} kcal</span>
                        </div>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">{sw.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* THREE MACRO METERS: Carbs (blue), Fat (amber), Protein (red) */}
      <div
        className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3"
        aria-describedby="sr-macro-bars-summary"
      >
        <p id="sr-macro-bars-summary" className="sr-only">
          {hasStats
            ? `Macronutrients today: Carbohydrates ${carbsEaten} of ${macroTarget.carbsGrams} grams (${carbsPercent}%), Fat ${fatEaten} of ${macroTarget.fatGrams} grams (${fatPercent}%), Protein ${proteinEaten} of ${macroTarget.proteinGrams} grams (${proteinPercent}%), Sodium ${sodiumEaten} of 2300 milligrams, Sugar ${sugarEaten} of 25 grams.`
            : `Macronutrients today: Set up your profile to see macro gram targets. Sodium ${sodiumEaten} of 2300 milligrams, Sugar ${sugarEaten} of 25 grams.`}
        </p>
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold text-zinc-300">Daily Macronutrients</div>
          {!hasStats && (
            <span className="text-[11px] font-mono text-zinc-500">Set up your profile</span>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold text-blue-400">Carbs</span>
              <span className="text-zinc-500 font-mono text-[10px]">{hasStats ? `${carbsPercent}%` : '—'}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${carbsPercent}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              {hasStats ? (
                <>
                  <span className="font-bold text-zinc-200">{carbsEaten}</span>
                  <span> / {macroTarget.carbsGrams}g</span>
                </>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold text-amber-400">Fat</span>
              <span className="text-zinc-500 font-mono text-[10px]">{hasStats ? `${fatPercent}%` : '—'}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${fatPercent}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              {hasStats ? (
                <>
                  <span className="font-bold text-zinc-200">{fatEaten}</span>
                  <span> / {macroTarget.fatGrams}g</span>
                </>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>

          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5">
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-semibold text-red-400">Protein</span>
              <span className="text-zinc-500 font-mono text-[10px]">{hasStats ? `${proteinPercent}%` : '—'}</span>
            </div>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full bg-red-500 rounded-full transition-all duration-500"
                style={{ width: `${proteinPercent}%` }}
              />
            </div>
            <div className="text-[10px] font-mono text-zinc-400">
              {hasStats ? (
                <>
                  <span className="font-bold text-zinc-200">{proteinEaten}</span>
                  <span> / {macroTarget.proteinGrams}g</span>
                </>
              ) : (
                <span>—</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-0.5">
          <div className="bg-zinc-950/70 border border-orange-500/25 rounded-full px-3 py-1.5 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
              <span className="font-semibold text-orange-400">Sodium</span>
            </div>
            <div className="font-mono text-[10px] text-zinc-400">
              <span className={`font-bold ${sodiumEaten > 2300 ? 'text-orange-300' : 'text-zinc-200'}`}>
                {sodiumEaten.toLocaleString()}
              </span>
              <span> / 2,300 mg</span>
            </div>
          </div>

          <div className="bg-zinc-950/70 border border-pink-500/25 rounded-full px-3 py-1.5 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-pink-500 shrink-0" />
              <span className="font-semibold text-pink-400">Sugar</span>
            </div>
            <div className="font-mono text-[10px] text-zinc-400">
              <span className={`font-bold ${sugarEaten > 25 ? 'text-pink-300' : 'text-zinc-200'}`}>
                {sugarEaten}
              </span>
              <span> / 25 g</span>
            </div>
          </div>
        </div>

        {(caffeineEatenMg > 0 || standardDrinksEaten > 0) && (
          <div className="grid grid-cols-2 gap-2.5 pt-0.5">
            {caffeineEatenMg > 0 && (
              <div className="bg-zinc-950/70 border border-amber-500/25 rounded-full px-3 py-1.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                  <span className="font-semibold text-amber-300">Caffeine</span>
                </div>
                <div className="font-mono text-[10px] text-zinc-400">
                  <span className="font-bold text-zinc-200">{caffeineEatenMg.toLocaleString()}</span>
                  <span> mg</span>
                </div>
              </div>
            )}

            {standardDrinksEaten > 0 && (
              <div className="bg-zinc-950/70 border border-purple-500/25 rounded-full px-3 py-1.5 flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400 shrink-0" />
                  <span className="font-semibold text-purple-300">Alcohol</span>
                </div>
                <div className="font-mono text-[10px] text-zinc-400">
                  <span className="font-bold text-zinc-200">{standardDrinksEaten}</span>
                  <span> std drink{standardDrinksEaten === 1 ? '' : 's'}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* WATER TRACKER: Quick-add buttons + 8 tappable glasses per day */}
      <div
        className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3"
        aria-describedby="sr-water-tracker-summary"
      >
        <p id="sr-water-tracker-summary" className="sr-only">
          {`Water intake today: ${waterGlasses} of 8 glasses (${waterGlasses * 250} milliliters).`}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Droplets className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-semibold text-zinc-200">Water Tracker</span>
          </div>
          <span className="text-xs font-mono text-cyan-400 font-bold">
            {waterGlasses} / 8 glasses ({waterGlasses * 250} ml)
          </span>
        </div>

        {/* #17 Water quick-add buttons: +250 ml, +500 ml, +1 L */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleWaterRequest(waterGlasses + 1)}
            aria-label="Add 250 milliliters of water"
            className="min-h-[38px] py-1.5 px-2.5 bg-zinc-950 hover:bg-cyan-950/40 border border-zinc-800 hover:border-cyan-500/40 rounded-xl text-xs font-mono font-semibold text-cyan-300 transition-colors"
          >
            +250 ml
          </button>
          <button
            type="button"
            onClick={() => handleWaterRequest(waterGlasses + 2)}
            aria-label="Add 500 milliliters of water"
            className="min-h-[38px] py-1.5 px-2.5 bg-zinc-950 hover:bg-cyan-950/40 border border-zinc-800 hover:border-cyan-500/40 rounded-xl text-xs font-mono font-semibold text-cyan-300 transition-colors"
          >
            +500 ml
          </button>
          <button
            type="button"
            onClick={() => handleWaterRequest(waterGlasses + 4)}
            aria-label="Add 1 liter of water"
            className="min-h-[38px] py-1.5 px-2.5 bg-zinc-950 hover:bg-cyan-950/40 border border-zinc-800 hover:border-cyan-500/40 rounded-xl text-xs font-mono font-semibold text-cyan-300 transition-colors"
          >
            +1 L
          </button>
        </div>

        {/* #6 Water glasses > 20 warning prompt */}
        {pendingWaterCount !== null && (
          <div className="p-3 bg-amber-950/70 border border-amber-500/40 rounded-xl flex items-center justify-between gap-2">
            <span className="text-xs text-amber-200 font-medium">
              That&apos;s more than 20 glasses. Are you sure?
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setPendingWaterCount(null)}
                className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  updateWaterGlasses(pendingWaterCount);
                  setPendingWaterCount(null);
                }}
                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-lg text-xs"
              >
                Yes ({pendingWaterCount})
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-8 gap-1.5">
          {Array.from({ length: 8 }).map((_, idx) => {
            const isFilled = idx < waterGlasses;
            return (
              <button
                key={idx}
                onClick={() => handleWaterRequest(isFilled && idx === waterGlasses - 1 ? idx : idx + 1)}
                aria-label={`Water glass ${idx + 1}`}
                className={`min-h-[44px] py-2 rounded-xl flex flex-col items-center justify-center transition-all ${
                  isFilled
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : 'bg-zinc-950/80 text-zinc-600 border border-zinc-800 hover:text-zinc-400'
                }`}
                title={`Glass ${idx + 1}`}
              >
                <Droplets className={`w-4 h-4 ${isFilled ? 'fill-cyan-400' : ''}`} />
                <span className="text-[9px] mt-0.5 font-mono">{idx + 1}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* EXERCISE CARD */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
              <Flame className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-zinc-200 block">Today&apos;s Exercise</span>
              <span className="text-[11px] text-zinc-400">
                {exercises.length === 0
                  ? 'No activities logged'
                  : `${exercises.length} logged · +${totalBurned} kcal burned`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                if (isGuest) {
                  openGuestLock();
                  return;
                }
                setShowExerciseBox(!showExerciseBox);
              }}
              aria-label="Log Exercise"
              className="min-h-[44px] px-3 py-2 bg-teal-500/15 hover:bg-teal-500/25 text-teal-300 border border-teal-500/30 rounded-xl flex items-center gap-1 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Log Exercise
            </button>
          </div>
        </div>

        {showExerciseBox && (
          <form onSubmit={handleSaveInlineExercise} className="pt-3 border-t border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-300">
                Describe what you did in your own words
              </label>
              <button
                type="button"
                onClick={() =>
                  setExerciseInput(
                    '2 min warm-up slow jog, 10 min steady-pace run, followed by 24 min brisk walking intervals'
                  )
                }
                className="text-[11px] text-teal-400 hover:text-teal-300 underline cursor-pointer"
              >
                Try example
              </button>
            </div>

            <textarea
              rows={2}
              value={exerciseInput}
              onChange={(e) => setExerciseInput(e.target.value)}
              placeholder="e.g., 2 min warm-up slow jog, 10 min steady-pace run, followed by 24 min brisk walking intervals"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 resize-none leading-relaxed"
            />

            {/* Calories Burned Box Below */}
            <div className="bg-zinc-950 border border-teal-500/30 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">
                    Calories Burned
                  </span>
                  <span className="text-xs text-zinc-200 font-medium">
                    {exerciseInput.trim()
                      ? decipheredExercise.summaryTitle
                      : 'Type your workout above to calculate'}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-xl font-extrabold text-teal-400 font-mono">
                    {decipheredExercise.totalCaloriesBurned}
                  </span>
                  <span className="text-xs text-zinc-400 font-mono ml-1">kcal</span>
                </div>
              </div>

              {decipheredExercise.segments.length > 0 && (
                <div className="pt-2 border-t border-zinc-800/80 space-y-1">
                  {decipheredExercise.segments.map((seg, i) => (
                    <div key={i} className="flex items-center justify-between text-[11px] text-zinc-300">
                      <span>
                        {seg.activityName} <span className="text-zinc-500 font-mono">({seg.minutes} min)</span>
                      </span>
                      <span className="font-mono text-teal-400 font-semibold">+{seg.caloriesBurned} kcal</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {(inlineExerciseError || validateExerciseMinutes(Math.round(decipheredExercise.totalMinutes))) && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                {inlineExerciseError || validateExerciseMinutes(Math.round(decipheredExercise.totalMinutes))}
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSavingExercise || !exerciseInput.trim() || decipheredExercise.totalCaloriesBurned <= 0}
                className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Check className="w-4 h-4" />
                {isSavingExercise ? 'Calculating...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={onNavigateToFitness}
                className="px-3 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
              >
                Full Fitness Tab
              </button>
            </div>
          </form>
        )}
      </div>

      {/* COPY YESTERDAY & #3 VOICE LOG BAR */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleCopyYesterday()}
            className="text-xs text-zinc-400 hover:text-teal-400 flex items-center gap-1.5 transition-colors py-1"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy yesterday
          </button>

          <button
            type="button"
            onClick={() => openAddFood(lastSelectedMeal)}
            className="px-2.5 py-1 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Mic className="w-3.5 h-3.5" />
            Voice / AI Log
          </button>
        </div>

        {copyStatus && (
          <span className="text-xs text-teal-400 animate-fade-in font-medium truncate">
            {copyStatus}
          </span>
        )}
      </div>

      {/* FOUR MEAL SECTIONS: Breakfast (25%), Lunch (35%), Dinner (30%), Snacks (10%) */}
      <div ref={mealsSectionRef} className="space-y-3.5">
        {mealsList.map((meal) => {
          const items = diaryItems.filter((i) => i.mealType === meal.type);
          const mealKcal = items.reduce((sum, i) => sum + (i.calories || 0), 0);
          const mealTargetKcal = hasStats ? Math.round(dailyTarget * meal.ratio) : 0;
          const mealTargetProt = hasStats ? Math.round(macroTarget.proteinGrams * meal.ratio) : 0;
          const mealTargetCarbs = hasStats ? Math.round(macroTarget.carbsGrams * meal.ratio) : 0;
          const mealTargetFat = hasStats ? Math.round(macroTarget.fatGrams * meal.ratio) : 0;
          const isMealOver = hasStats && mealKcal > mealTargetKcal;
          const topThree = topFoodsByMeal[meal.type] || [];
          const hasUsual = (usualComboByMeal[meal.type] || []).length > 0;

          return (
            <div
              key={meal.type}
              className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3"
            >
              {/* Meal Header with #14 Per-meal target & red over-indicator */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <h4 className="text-sm font-semibold text-zinc-200">{meal.title}</h4>
                      {isMealOver && (
                        <span
                          title="Over meal calorie target"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[9px] font-mono text-rose-400"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Over
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handleCopyYesterday(meal.type)}
                        title={`Copy yesterday's ${meal.title}`}
                        aria-label={`Copy yesterday's ${meal.title}`}
                        className="p-1 text-zinc-500 hover:text-teal-400 rounded-lg bg-zinc-950/60 border border-zinc-800/80 transition-colors flex items-center gap-0.5 text-[10px]"
                      >
                        <ChevronRight className="w-3 h-3" />
                        <span>Yesterday</span>
                      </button>
                    </div>
                    <span className="text-[11px] font-mono text-zinc-400">
                      {hasStats
                        ? `${mealKcal} / ${mealTargetKcal} kcal · Target ${mealTargetCarbs}c ${mealTargetFat}f ${mealTargetProt}p`
                        : '— · Set up your profile'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasUsual && (
                    <button
                      type="button"
                      onClick={() => handleSameAsUsual(meal.type)}
                      title="Log your most common combination for this meal"
                      className="px-2 py-1.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-teal-300 rounded-xl transition-colors flex items-center gap-1 text-[11px] font-medium"
                    >
                      <RotateCcw className="w-3 h-3 text-teal-400" />
                      Same as usual
                    </button>
                  )}
                  <button
                    onClick={() => openAddFood(meal.type)}
                    className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-teal-400 rounded-xl transition-colors flex items-center gap-1 text-xs font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add
                  </button>
                </div>
              </div>

              {/* #7 Quick-log bar at the top of each meal section showing top 3 most-logged foods */}
              {topThree.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-500 shrink-0 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 text-teal-400" />
                    Quick:
                  </span>
                  {topThree.map((qf) => (
                    <button
                      key={qf.name}
                      type="button"
                      onClick={() => handleQuickLog(meal.type, qf)}
                      className="px-2 py-1 rounded-lg bg-zinc-950 hover:bg-teal-950/50 border border-zinc-800 hover:border-teal-500/40 text-[11px] text-zinc-300 hover:text-teal-300 shrink-0 flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-2.5 h-2.5 text-teal-400" />
                      <span className="truncate max-w-[110px]">{qf.name}</span>
                      <span className="text-[10px] font-mono text-zinc-500">{qf.calories}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Logged Foods List (#26 Swipe left to delete, Swipe right to duplicate into today, Long-press options) */}
              {items.length === 0 ? (
                <div className="py-3 px-3 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  No foods logged for {meal.title.toLowerCase()} yet. Tap Add to log a meal.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {items.map((item) => {
                    const isLongPressed = longPressedItemId === item.id;
                    const isEditingNote = editingNoteId === item.id;

                    return (
                      <div key={item.id} className="space-y-1">
                        <SwipeableItem
                          onDelete={() => deleteFoodItem(item.id)}
                          onDuplicateToToday={() => handleDuplicateItemToToday(item)}
                          duplicateLabel="Duplicate to Today"
                          options={[
                            {
                              label: 'Duplicate into today',
                              onClick: () => handleDuplicateItemToToday(item)
                            },
                            {
                              label: 'Log again tomorrow',
                              onClick: async () => {
                                await logFoodAgainTomorrow(item);
                                setCopyStatus(`Logged "${item.name}" for tomorrow`);
                                setTimeout(() => setCopyStatus(null), 2500);
                              }
                            },
                            {
                              label: item.note ? 'Edit meal note' : 'Add meal note',
                              onClick: () => {
                                setEditingNoteId(item.id);
                                setNoteDraft(item.note || '');
                              }
                            },
                            {
                              label: 'Delete food item',
                              onClick: () => deleteFoodItem(item.id),
                              destructive: true
                            }
                          ]}
                        >
                          <div className="p-2.5 bg-zinc-950/70 border border-zinc-850 rounded-xl flex items-center justify-between group select-none">
                            <div
                              onClick={() => {
                                setEditingNoteId(isEditingNote ? null : item.id);
                                setNoteDraft(item.note || '');
                              }}
                              className="max-w-[68%] cursor-pointer"
                            >
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-medium text-zinc-200 block truncate">
                                  {item.name}
                                </span>
                                {(item.unusualQuantity || item.note?.includes('Unusual quantity')) && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono font-semibold text-rose-400">
                                    <AlertTriangle className="w-2.5 h-2.5 text-rose-400 shrink-0" />
                                    Unusual quantity
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono flex-wrap">
                                <span>{item.serving || '1 portion'}</span>
                                <span>·</span>
                                <span className="text-blue-400">{item.carbs}c</span>
                                <span className="text-amber-400">{item.fat}f</span>
                                <span className="text-red-400">{item.protein}p</span>
                                {typeof item.caffeineMg === 'number' && item.caffeineMg > 0 && (
                                  <>
                                    <span>·</span>
                                    <span className="text-amber-300">{item.caffeineMg}mg caffeine</span>
                                  </>
                                )}
                                {typeof item.standardDrinks === 'number' && item.standardDrinks > 0 && (
                                  <>
                                    <span>·</span>
                                    <span className="text-purple-300">
                                      {item.standardDrinks} std drink{item.standardDrinks === 1 ? '' : 's'}
                                    </span>
                                  </>
                                )}
                              </div>
                              {item.note && !isEditingNote && (
                                <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                                  <MessageSquare className="w-2.5 h-2.5 shrink-0 text-zinc-500" />
                                  {item.note}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-teal-400 font-mono mr-1">
                                {item.calories} kcal
                              </span>
                              {/* #15 Leftover tracker on dinner items */}
                              {meal.type === 'dinner' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await addPantryEntry({
                                      name: `${item.name} (Leftover)`,
                                      quantity: item.serving || '1 portion',
                                      category: 'leftover',
                                      caloriesPerPortion: item.calories,
                                      protein: item.protein,
                                      carbs: item.carbs,
                                      fat: item.fat,
                                      isLeftover: true
                                    });
                                    setCopyStatus(`Saved "${item.name}" as leftover in Pantry`);
                                    setTimeout(() => setCopyStatus(null), 2500);
                                  }}
                                  title="Save dinner as leftover in Pantry"
                                  className="p-1 text-zinc-600 hover:text-teal-400 rounded transition-colors"
                                >
                                  <Package className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {/* #4 Meal notes button */}
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingNoteId(isEditingNote ? null : item.id);
                                  setNoteDraft(item.note || '');
                                }}
                                title="Add or edit meal note"
                                className={`p-1 rounded transition-colors ${
                                  item.note
                                    ? 'text-teal-400 hover:text-teal-300'
                                    : 'text-zinc-600 hover:text-zinc-300'
                                }`}
                              >
                                <MessageSquare className="w-3.5 h-3.5" />
                              </button>
                              {/* #2 Long-press / tomorrow trigger */}
                              <button
                                type="button"
                                onClick={() =>
                                  setLongPressedItemId(prev => (prev === item.id ? null : item.id))
                                }
                                title="More meal options"
                                className="p-1 text-zinc-600 hover:text-teal-400 rounded transition-colors"
                              >
                                <CalendarPlus className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteFoodItem(item.id)}
                                className="p-1 text-zinc-600 hover:text-rose-400 rounded transition-colors"
                                aria-label="Delete food"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </SwipeableItem>

                        {/* #2 Long-press "Log again tomorrow" action bar */}
                        {isLongPressed && (
                          <div className="flex items-center justify-between px-3 py-1.5 bg-teal-950/40 border border-teal-800/50 rounded-xl text-xs">
                            <span className="text-zinc-300 text-[11px]">
                              Schedule <strong className="text-teal-300">{item.name}</strong> for tomorrow?
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                await logFoodAgainTomorrow(item);
                                setLongPressedItemId(null);
                                setCopyStatus(`Logged "${item.name}" for tomorrow`);
                                setTimeout(() => setCopyStatus(null), 2500);
                              }}
                              className="px-2.5 py-1 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold rounded-lg text-[11px] flex items-center gap-1"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              Log again tomorrow
                            </button>
                          </div>
                        )}

                        {/* #4 Meal notes inline input */}
                        {isEditingNote && (
                          <div className="flex items-center gap-1.5 px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-xl">
                            <input
                              type="text"
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              placeholder="Add a short note (e.g. felt tired after this)..."
                              className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveNote(item.id)}
                              className="px-2.5 py-1 bg-teal-500 text-zinc-950 font-semibold rounded-lg text-[11px] flex items-center gap-1"
                            >
                              <Check className="w-3 h-3" />
                              Save
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* COACH CARD (Directly below Snacks meal section) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-teal-400 shrink-0" />
          <h4 className="text-xs font-semibold text-zinc-200">Coach</h4>
        </div>
        <p className="text-xs text-zinc-300 leading-relaxed">{coachSuggestion}</p>
      </div>

      {/* #14 PANTRY, #15 LEFTOVERS, #11 RECEIPT SCAN, #10 FRIDGE PHOTO & #16 WHAT CAN I MAKE? */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold text-zinc-200">
              Pantry &amp; Leftovers ({pantryItems.length})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {/* #11 Receipt Scan */}
            <label className="px-2 py-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[10px] font-medium text-teal-300 cursor-pointer flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Receipt Scan
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    setIsKitchenAiBusy(true);
                    try {
                      const res = await api.scanReceipt(String(reader.result), file.type);
                      for (const it of res.items || []) {
                        await addPantryEntry({
                          name: it.name,
                          quantity: it.quantity || '1 unit',
                          category: it.category || 'pantry'
                        });
                      }
                      setCopyStatus(`Added ${(res.items || []).length} items from receipt`);
                      setTimeout(() => setCopyStatus(null), 3000);
                    } catch {
                      // ignore
                    } finally {
                      setIsKitchenAiBusy(false);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
                className="hidden"
              />
            </label>

            {/* #10 Fridge Photo */}
            <label className="px-2 py-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-[10px] font-medium text-teal-300 cursor-pointer flex items-center gap-1">
              <Camera className="w-3 h-3" />
              Fridge Photo
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async () => {
                    setIsKitchenAiBusy(true);
                    try {
                      const res = await api.analyzeFridgePhoto(
                        String(reader.result),
                        {
                          calories: Math.max(250, remaining),
                          protein: Math.max(15, macroTarget.proteinGrams - proteinEaten),
                          carbs: Math.max(15, macroTarget.carbsGrams - carbsEaten),
                          fat: Math.max(10, macroTarget.fatGrams - fatEaten)
                        },
                        file.type
                      );
                      setKitchenMeals(res.meals || []);
                    } catch {
                      // ignore
                    } finally {
                      setIsKitchenAiBusy(false);
                    }
                  };
                  reader.readAsDataURL(file);
                }}
                className="hidden"
              />
            </label>
          </div>
        </div>

        {/* Manual Pantry Add */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!newPantryName.trim()) return;
            await addPantryEntry({
              name: newPantryName.trim(),
              quantity: newPantryQty.trim() || '1 unit',
              category: 'pantry'
            });
            setNewPantryName('');
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={newPantryName}
            onChange={(e) => setNewPantryName(e.target.value)}
            placeholder="Add item to Pantry (e.g. Greek yogurt, spinach, rice)..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
          />
          <button
            type="submit"
            className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-teal-400 rounded-xl text-xs font-medium shrink-0"
          >
            Add
          </button>
        </form>

        {/* Pantry Items Pill List */}
        {pantryItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
            {pantryItems.map((p) => (
              <span
                key={p.id}
                className={`px-2.5 py-1 rounded-lg text-[11px] flex items-center gap-1.5 border ${
                  p.isLeftover
                    ? 'bg-teal-950/50 border-teal-700/50 text-teal-200'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                }`}
              >
                <span>{p.name}</span>
                <button
                  type="button"
                  onClick={() => deletePantryEntry(p.id)}
                  className="text-zinc-500 hover:text-rose-400"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        {/* #16 "What can I make?" button (#14 Calculating... & #13 skeleton) */}
        <button
          type="button"
          disabled={isKitchenAiBusy}
          onClick={async () => {
            setIsKitchenAiBusy(true);
            try {
              const res = await api.suggestWhatCanIMake(
                pantryItems.map(p => p.name),
                {
                  calories: Math.max(250, remaining),
                  protein: Math.max(15, macroTarget.proteinGrams - proteinEaten),
                  carbs: Math.max(15, macroTarget.carbsGrams - carbsEaten),
                  fat: Math.max(10, macroTarget.fatGrams - fatEaten)
                }
              );
              setKitchenMeals(res.meals || []);
            } catch {
              // ignore
            } finally {
              setIsKitchenAiBusy(false);
            }
          }}
          className="w-full py-2 bg-teal-500/15 hover:bg-teal-500/25 disabled:opacity-50 border border-teal-500/30 text-teal-300 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
        >
          <ChefHat className="w-3.5 h-3.5" />
          {isKitchenAiBusy
            ? 'Calculating...'
            : 'What can I make? (3 meals for your remaining macros)'}
        </button>

        {isKitchenAiBusy && (
          <div className="space-y-2 pt-1 animate-pulse">
            <div className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl" />
            <div className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl" />
            <div className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl" />
          </div>
        )}

        {!isKitchenAiBusy && kitchenMeals && kitchenMeals.length > 0 && (
          <div className="space-y-2 pt-1">
            {kitchenMeals.map((m, idx) => (
              <div key={idx} className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold text-zinc-100 block">{m.name}</span>
                  <span className="text-[10px] text-zinc-400 block">{m.description}</span>
                  <span className="text-[10px] font-mono text-teal-400">
                    {m.calories} kcal · {m.protein}p · {m.carbs}c · {m.fat}f
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    addFoodItem({
                      date: activeDate,
                      mealType: 'dinner',
                      name: m.name,
                      calories: m.calories,
                      protein: m.protein,
                      carbs: m.carbs,
                      fat: m.fat,
                      serving: '1 portion',
                      source: 'recipe'
                    })
                  }
                  className="px-2.5 py-1.5 bg-teal-500 text-zinc-950 font-semibold rounded-lg text-[11px] shrink-0"
                >
                  Log
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* #37 DAILY CHECK-IN CARD (Mood, Energy, Sleep Quality 1-5) & #38 SLEEP TRACKER (Hours Slept) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold text-zinc-200">Daily Check-In & Sleep</span>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">1–5 Scale</span>
        </div>

        <div className="space-y-3">
          {/* Mood */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Mood</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => saveTodayHabit({ mood: val })}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-colors ${
                    todayHabit?.mood === val
                      ? 'bg-teal-500 text-zinc-950'
                      : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

           {/* Energy ("How's your energy today?" 1-5 scale) */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-300 font-medium">How&apos;s your energy today?</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => saveTodayHabit({ energy: val })}
                  aria-label={`Energy level ${val}`}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-colors ${
                    todayHabit?.energy === val
                      ? 'bg-teal-500 text-zinc-950'
                      : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Sleep Quality */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">Sleep Quality</span>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => saveTodayHabit({ sleepQuality: val })}
                  className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-colors ${
                    todayHabit?.sleepQuality === val
                      ? 'bg-teal-500 text-zinc-950'
                      : 'bg-zinc-950 border border-zinc-800 text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* #38 Sleep Tracker — hours slept */}
          <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Moon className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-xs text-zinc-300">Hours Slept Last Night</span>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.5"
                min="0"
                max="16"
                value={todayHabit?.sleepHours ?? ''}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  saveTodayHabit({ sleepHours: isNaN(val) ? undefined : val });
                }}
                placeholder="7.5"
                className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-100 text-center focus:outline-none focus:border-teal-500"
              />
              <span className="text-xs text-zinc-500 font-mono">hrs</span>
            </div>
          </div>
        </div>
      </div>

      {/* #40 ONE-QUESTION DAILY JOURNAL */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-teal-400" />
            <span className="text-xs font-semibold text-zinc-200">Daily Reflection</span>
          </div>
          {journalSavedMsg && (
            <span className="text-[11px] text-teal-400 font-medium">Saved.</span>
          )}
        </div>
        <p className="text-xs text-teal-300/90 font-medium">How did today go?</p>
        <div className="flex gap-2">
          <input
            type="text"
            minLength={1}
            value={journalDraft}
            onChange={(e) => setJournalDraft(e.target.value)}
            placeholder="Write a brief reflection..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
          />
          <button
            type="button"
            disabled={!journalDraft.trim()}
            onClick={async () => {
              const trimmed = journalDraft.trim();
              if (!trimmed) return;
              await saveTodayHabit({
                journalPrompt: 'How did today go?',
                journalAnswer: trimmed
              });
              setJournalSavedMsg(true);
              setTimeout(() => setJournalSavedMsg(false), 3000);
            }}
            className="px-3 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold rounded-xl text-xs shrink-0"
          >
            Save
          </button>
        </div>
      </div>

      {/* #29 CRAVING LOG */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 shrink-0">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-semibold text-zinc-200">Log a craving</span>
          </div>
          <span className="text-[10px] text-teal-400 font-mono text-right">
            {cravingPatternText}
          </span>
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!cravingFood.trim()) return;
            const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            await addCravingItem({
              date: activeDate,
              time: nowTime,
              wantedFood: cravingFood.trim(),
              intensity: cravingIntensity,
              trigger: cravingTrigger.trim() || undefined
            });
            setCravingFood('');
            setCravingTrigger('');
          }}
          className="space-y-2.5"
        >
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={cravingFood}
              onChange={(e) => setCravingFood(e.target.value)}
              placeholder="What did you crave?"
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
            />
            <input
              type="text"
              value={cravingTrigger}
              onChange={(e) => setCravingTrigger(e.target.value)}
              placeholder="Trigger (e.g. stress, late night)"
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-400">Strength:</span>
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setCravingIntensity(lvl)}
                  className={`w-6 h-6 rounded-md text-[11px] font-mono font-bold ${
                    cravingIntensity === lvl
                      ? 'bg-amber-500 text-zinc-950'
                      : 'bg-zinc-950 border border-zinc-800 text-zinc-400'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-teal-400 rounded-xl text-xs font-medium flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Craving
            </button>
          </div>
        </form>

        {cravings.filter(c => c.date === activeDate).length === 0 ? (
          <div className="py-2.5 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
            No cravings logged today. Log when a craving hits to spot triggers.
          </div>
        ) : (
          <div className="space-y-1.5 pt-1">
            {cravings
              .filter(c => c.date === activeDate)
              .map((c) => (
                <SwipeableItem
                  key={c.id}
                  onDelete={() => deleteCravingItem(c.id)}
                  options={[
                    {
                      label: 'Delete craving entry',
                      onClick: () => deleteCravingItem(c.id),
                      destructive: true
                    }
                  ]}
                >
                  <div className="p-2 bg-zinc-950/70 border border-zinc-850 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <span className="text-zinc-200 font-medium">{c.wantedFood}</span>
                      <span className="text-[10px] text-zinc-500 font-mono block">
                        {c.time} · Strength {c.intensity}/5 {c.trigger ? `· ${c.trigger}` : ''}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCravingItem(c.id)}
                      className="p-1 text-zinc-600 hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </SwipeableItem>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
