import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Bookmark,
  Layers,
  Plus,
  Trash2,
  Check,
  Search,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  Scale,
  Moon,
  Clock,
  Activity,
  Copy,
  Share2,
  RefreshCw,
  MessageSquare,
  Printer,
  Pencil
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import { trackEventOnce } from '../utils/analytics.js';
import { formatWeight } from '../utils/nutritionMath.js';
import { useDebounce, getDateBounds } from '../utils/validation.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { SwipeableItem } from './SwipeableItem.js';
import { formatLocalDate, parseLocalDate } from '../utils/dateUtils.js';
import type { MealTemplate, SavedFood, SavedRecipe, FoodItem, MealType } from '../types/index.js';

export const ReportsTab: React.FC = () => {
  const {
    userId,
    activeDate,
    setActiveDate,
    macroTarget,
    profile,
    weights,
    allHabits,
    cravings,
    diaryItems,
    addFoodItem,
    showUndoToast,
    updateUserProfile
  } = useApp();

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [customTargetInput, setCustomTargetInput] = useState('');
  const [isSavingTarget, setIsSavingTarget] = useState(false);
  const [targetSaveSuccess, setTargetSaveSuccess] = useState(false);

  const { minDate, maxDate } = getDateBounds();
  const [allEntries, setAllEntries] = useState<FoodItem[]>([]);
  const [templates, setTemplates] = useState<MealTemplate[]>([]);
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);
  const [templateToDelete, setTemplateToDelete] = useState<MealTemplate | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<SavedRecipe | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [savedSearch, setSavedSearch] = useState('');
  const debouncedSavedSearch = useDebounce(savedSearch, 400);
  const [reflectionSearch, setReflectionSearch] = useState('');
  const debouncedReflectionSearch = useDebounce(reflectionSearch, 400);
  const [notification, setNotification] = useState<string | null>(null);
  // #26 & #27 View mode: 7d | 30d | 12m
  const [chartRange, setChartRange] = useState<'7d' | '30d' | '12m'>('7d');
  const [weeklyBullets, setWeeklyBullets] = useState<string[]>([]);
  const [weeklyStatusText, setWeeklyStatusText] = useState<string>('Not enough data yet.');
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);

  useEffect(() => {
    trackEventOnce('first_report_viewed');
    loadReportsData();
  }, [diaryItems]);

  const loadReportsData = async () => {
    try {
      const [allRes, tmplRes, savedRes, recRes] = await Promise.all([
        api.getAllDiary(),
        api.getTemplates(),
        api.getSavedFoods(),
        api.getRecipes()
      ]);
      setAllEntries(allRes.items || []);
      setTemplates(tmplRes.templates || []);
      setSavedFoods(savedRes.foods || []);
      setSavedRecipes(recRes.recipes || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingReports(false);
    }
  };

  // Build N-day data ending today
  const getPastDays = (numDays: number) => {
    const today = new Date();
    const days = [];

    for (let i = numDays - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const str = formatLocalDate(d);
      const dayEntries = allEntries.filter(e => e.date === str);
      const calories = dayEntries.reduce((sum, e) => sum + e.calories, 0);
      const carbs = dayEntries.reduce((sum, e) => sum + (e.carbs || 0), 0);
      const fat = dayEntries.reduce((sum, e) => sum + (e.fat || 0), 0);
      const protein = dayEntries.reduce((sum, e) => sum + (e.protein || 0), 0);

      days.push({
        dateStr: str,
        label: numDays <= 7
          ? d.toLocaleDateString('en-US', { weekday: 'short' })
          : d.getDate().toString(),
        dayOfWeek: d.getDay(),
        calories,
        carbs,
        fat,
        protein,
        isOver: calories > macroTarget.calories
      });
    }

    return days;
  };

  // #27 12-Month Yearly Trend Line
  const past12Months = useMemo(() => {
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { month: 'short' });
      const entries = allEntries.filter(e => e.date.startsWith(ym));
      const uniqueDays = new Set(entries.map(e => e.date)).size || 1;
      const avgKcal = entries.length > 0
        ? Math.round(entries.reduce((s, e) => s + e.calories, 0) / uniqueDays)
        : 0;
      months.push({ ym, label, avgKcal, isOver: avgKcal > macroTarget.calories });
    }
    return months;
  }, [allEntries, macroTarget.calories]);

  const past7Days = getPastDays(7);
  const past30Days = getPastDays(30);
  const activeSeries = chartRange === '7d' ? past7Days : past30Days;
  const maxBarCal = Math.max(
    macroTarget.calories * 1.25,
    ...activeSeries.map(d => d.calories),
    2000
  );

  // Weekly Averages
  const loggedDaysCount = past7Days.filter(d => d.calories > 0).length || 1;
  const avgCalories = Math.round(past7Days.reduce((s, d) => s + d.calories, 0) / loggedDaysCount);
  const avgCarbs = Math.round((past7Days.reduce((s, d) => s + d.carbs, 0) / loggedDaysCount) * 10) / 10;
  const avgFat = Math.round((past7Days.reduce((s, d) => s + d.fat, 0) / loggedDaysCount) * 10) / 10;
  const avgProtein = Math.round((past7Days.reduce((s, d) => s + d.protein, 0) / loggedDaysCount) * 10) / 10;

  // #28, #29, #30, #31, #32 Daily Nutrition Deep-Dive (Protein/kg, Fiber, Sugar, Sodium, Micronutrients)
  const activeDayItems = allEntries.filter(e => e.date === activeDate);
  const dayProtein = activeDayItems.reduce((s, i) => s + (i.protein || 0), 0);
  const proteinPerKg = Math.round((dayProtein / (profile.currentWeightKg || 65)) * 100) / 100;
  const fiberTarget = profile.gender === 'male' ? (profile.age < 50 ? 38 : 30) : (profile.age < 50 ? 25 : 21);
  const dayFiber = Math.round(
    activeDayItems.reduce((s, i) => s + (i.fiber ?? Math.round((i.carbs || 0) * 0.12)), 0) * 10
  ) / 10;
  const daySugar = Math.round(
    activeDayItems.reduce((s, i) => s + (i.sugar ?? Math.round((i.carbs || 0) * 0.22)), 0) * 10
  ) / 10;
  const sugarWarningThreshold = profile.gender === 'male' ? 36 : 25;
  const daySodium = Math.round(
    activeDayItems.reduce((s, i) => s + (i.sodium ?? Math.round((i.calories || 0) * 1.1)), 0)
  );

  // #32 Micronutrient warnings (Iron, Calcium, Vitamin D)
  const dayIron = Math.round(activeDayItems.reduce((s, i) => s + (i.iron ?? (i.protein || 0) * 0.12), 0) * 10) / 10;
  const dayCalcium = Math.round(activeDayItems.reduce((s, i) => s + (i.calcium ?? (i.calories || 0) * 0.35), 0));
  const dayVitD = Math.round(activeDayItems.reduce((s, i) => s + (i.vitaminD ?? (i.fat || 0) * 0.15), 0) * 10) / 10;
  const lowMicros: string[] = [];
  if (dayIron < 8) lowMicros.push(`Iron (${dayIron}mg / 14mg target)`);
  if (dayCalcium < 600) lowMicros.push(`Calcium (${dayCalcium}mg / 1000mg target)`);
  if (dayVitD < 10) lowMicros.push(`Vitamin D (${dayVitD}mcg / 15mcg target)`);

  // #34 Weekend vs Weekday Comparison
  const weekdayWeekendStats = useMemo(() => {
    let weekdaySum = 0;
    let weekdayDays = 0;
    let weekendSum = 0;
    let weekendDays = 0;
    for (const d of past30Days) {
      if (d.calories <= 0) continue;
      const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
      if (isWeekend) {
        weekendSum += d.calories;
        weekendDays++;
      } else {
        weekdaySum += d.calories;
        weekdayDays++;
      }
    }
    return {
      weekdayAvg: weekdayDays > 0 ? Math.round(weekdaySum / weekdayDays) : 0,
      weekendAvg: weekendDays > 0 ? Math.round(weekendSum / weekendDays) : 0
    };
  }, [past30Days]);

  // #33 Time-of-day eating heatmap across the week
  const timeSlots = [
    { label: 'Morning (6–11)', match: (e: FoodItem) => (e.loggedHour !== undefined ? e.loggedHour >= 6 && e.loggedHour < 11 : e.mealType === 'breakfast') },
    { label: 'Midday (11–16)', match: (e: FoodItem) => (e.loggedHour !== undefined ? e.loggedHour >= 11 && e.loggedHour < 16 : e.mealType === 'lunch') },
    { label: 'Evening (16–21)', match: (e: FoodItem) => (e.loggedHour !== undefined ? e.loggedHour >= 16 && e.loggedHour < 21 : e.mealType === 'dinner') },
    { label: 'Late (21–6)', match: (e: FoodItem) => (e.loggedHour !== undefined ? e.loggedHour >= 21 || e.loggedHour < 6 : e.mealType === 'snack') }
  ];

  // #36 Weight Trend Smoothed Over 7 Days & #35 Plateau Detector
  const sortedWeights = useMemo(
    () => [...weights].sort((a, b) => a.date.localeCompare(b.date)),
    [weights]
  );

  const smoothedWeights = useMemo(() => {
    return sortedWeights.map((w, idx) => {
      const windowSlice = sortedWeights.slice(Math.max(0, idx - 6), idx + 1);
      const avg = windowSlice.reduce((s, x) => s + x.weightKg, 0) / windowSlice.length;
      return { ...w, smoothedKg: Math.round(avg * 100) / 100 };
    });
  }, [sortedWeights]);

  const isInPlateau = useMemo(() => {
    if (sortedWeights.length < 2) return false;
    const latest = sortedWeights[sortedWeights.length - 1];
    const twoWeeksAgoDate = parseLocalDate(latest.date);
    twoWeeksAgoDate.setDate(twoWeeksAgoDate.getDate() - 14);
    const cutoffStr = formatLocalDate(twoWeeksAgoDate);
    const recentWindow = sortedWeights.filter(w => w.date >= cutoffStr);
    if (recentWindow.length < 2) return false;
    const minW = Math.min(...recentWindow.map(w => w.weightKg));
    const maxW = Math.max(...recentWindow.map(w => w.weightKg));
    return maxW - minW <= 0.35;
  }, [sortedWeights]);

  // #38 Sleep vs Next-Day Hunger/Intake correlation (14+ days required)
  const sleepCalorieCorrelation = useMemo(() => {
    const validDays: Array<{ sleepHours: number; calories: number }> = [];
    for (const h of allHabits) {
      if (!h.sleepHours || h.sleepHours <= 0) continue;
      const dayItems = allEntries.filter(e => e.date === h.date);
      const dayKcal = dayItems.reduce((s, i) => s + i.calories, 0);
      if (dayKcal <= 0) continue;
      validDays.push({ sleepHours: h.sleepHours, calories: dayKcal });
    }
    if (validDays.length < 14) return null;
    const under7 = validDays.filter(d => d.sleepHours < 7);
    const atLeast7 = validDays.filter(d => d.sleepHours >= 7);
    if (under7.length < 2 || atLeast7.length < 2) return null;
    const under7Avg = under7.reduce((s, d) => s + d.calories, 0) / under7.length;
    const atLeast7Avg = atLeast7.reduce((s, d) => s + d.calories, 0) / atLeast7.length;
    const diff = Math.round(under7Avg - atLeast7Avg);
    if (diff < 50) return null;
    return { diff };
  }, [allHabits, allEntries]);

  // Mood and Food Correlation (14+ days required, > 0.5 difference on 1-5 scale)
  const moodProteinCorrelation = useMemo(() => {
    const validDays: Array<{ mood: number; hitProtein: boolean }> = [];
    for (const h of allHabits) {
      if (!h.mood || h.mood < 1 || h.mood > 5) continue;
      const dayItems = allEntries.filter(e => e.date === h.date);
      const dayKcal = dayItems.reduce((s, i) => s + i.calories, 0);
      if (dayKcal <= 0) continue;
      const dayProt = dayItems.reduce((s, i) => s + (i.protein || 0), 0);
      const hitProtein = macroTarget.proteinGrams > 0 && dayProt >= macroTarget.proteinGrams;
      validDays.push({ mood: h.mood, hitProtein });
    }
    if (validDays.length < 14) return null;
    const hitDays = validDays.filter(d => d.hitProtein);
    const missDays = validDays.filter(d => !d.hitProtein);
    if (hitDays.length === 0 || missDays.length === 0) return null;
    const hitAvg = hitDays.reduce((s, d) => s + d.mood, 0) / hitDays.length;
    const missAvg = missDays.reduce((s, d) => s + d.mood, 0) / missDays.length;
    if (Math.abs(hitAvg - missAvg) <= 0.5) return null;
    return {
      hitAvg: Math.round(hitAvg * 10) / 10,
      missAvg: Math.round(missAvg * 10) / 10
    };
  }, [allHabits, allEntries, macroTarget.proteinGrams]);

  // Distinct days with meals logged
  const totalDistinctMealDays = useMemo(() => {
    return new Set(allEntries.filter(e => e.calories > 0).map(e => e.date)).size;
  }, [allEntries]);

  // Past reflections sorted newest first
  const reflectionsList = useMemo(() => {
    return allHabits
      .filter(h => h.journalAnswer && h.journalAnswer.trim().length > 0)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [allHabits]);

  const filteredReflections = useMemo(() => {
    const q = debouncedReflectionSearch.trim().toLowerCase();
    if (!q) return reflectionsList;
    return reflectionsList.filter(
      r =>
        (r.journalAnswer || '').toLowerCase().includes(q) ||
        (r.journalPrompt || '').toLowerCase().includes(q) ||
        r.date.includes(q)
    );
  }, [reflectionsList, debouncedReflectionSearch]);

  // Weekly AI Insights caching & generation
  const getCurrentWeekKey = () => {
    const now = new Date();
    const sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay(), 0, 0, 0, 0);
    return formatLocalDate(sunday);
  };

  const fetchWeeklyInsights = async (forceRefresh = false) => {
    const cacheKey = `forkcount_weekly_insights_${userId || 'guest'}`;
    const weekKey = getCurrentWeekKey();

    if (!forceRefresh) {
      try {
        const raw = localStorage.getItem(cacheKey) || localStorage.getItem(`caloriq_weekly_insights_${userId || 'guest'}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.weekKey === weekKey) {
            setWeeklyBullets(Array.isArray(parsed.bullets) ? parsed.bullets : []);
            setWeeklyStatusText(parsed.statusText || 'No clear pattern this week.');
            return;
          }
        }
      } catch {
        // ignore cache parse error
      }
    }

    // Build 7-day input
    const daysPayload = past7Days.map(d => {
      const habit = allHabits.find(h => h.date === d.dateStr);
      const dayItems = allEntries.filter(e => e.date === d.dateStr);
      return {
        date: d.dateStr,
        calories: d.calories,
        calorieTarget: macroTarget.calories,
        protein: d.protein,
        proteinTarget: macroTarget.proteinGrams,
        mood: habit?.mood,
        energy: habit?.energy,
        sleepHours: habit?.sleepHours,
        sleepQuality: habit?.sleepQuality,
        foods: dayItems.map(i => i.name)
      };
    });

    const activeDataDays = daysPayload.filter(
      d => d.calories > 0 || d.mood !== undefined || d.energy !== undefined || d.sleepHours !== undefined
    );

    if (activeDataDays.length < 3 && totalDistinctMealDays < 7) {
      setWeeklyBullets([]);
      setWeeklyStatusText('Not enough data yet.');
      return;
    }

    const sevenDaysAgoStr = past7Days[0]?.dateStr || '';
    const recentCravings = (cravings || [])
      .filter(c => c.date >= sevenDaysAgoStr)
      .map(c => ({
        date: c.date,
        time: c.createdAt ? new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
        food: c.wantedFood,
        trigger: c.trigger,
        intensity: c.intensity
      }));

    const recentWeights = sortedWeights
      .filter(w => w.date >= sevenDaysAgoStr)
      .map(w => ({ date: w.date, weightKg: w.weightKg }));

    setIsLoadingWeekly(true);
    try {
      const res = await api.getWeeklyInsights({
        days: daysPayload,
        cravings: recentCravings,
        weights: recentWeights
      });
      const bullets = Array.isArray(res.bullets) ? res.bullets : [];
      const statusText = res.message || (bullets.length === 0 ? 'No clear pattern this week.' : '');
      setWeeklyBullets(bullets);
      setWeeklyStatusText(statusText);
      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          weekKey,
          bullets,
          statusText,
          updatedAt: new Date().toISOString()
        })
      );
    } catch {
      setWeeklyBullets([]);
      setWeeklyStatusText('No clear pattern this week.');
    } finally {
      setIsLoadingWeekly(false);
    }
  };

  useEffect(() => {
    const isSundayEvening = new Date().getDay() === 0 && new Date().getHours() >= 18;
    if (totalDistinctMealDays >= 7 || isSundayEvening) {
      fetchWeeklyInsights(false);
    } else {
      // Check if we already have a cached insight, otherwise show Not enough data yet.
      const cacheKey = `forkcount_weekly_insights_${userId || 'guest'}`;
      try {
        const raw = localStorage.getItem(cacheKey) || localStorage.getItem(`caloriq_weekly_insights_${userId || 'guest'}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.weekKey === getCurrentWeekKey() && parsed.bullets?.length > 0) {
            setWeeklyBullets(parsed.bullets);
            setWeeklyStatusText(parsed.statusText || '');
            return;
          }
        }
      } catch {
        // ignore
      }
      setWeeklyBullets([]);
      setWeeklyStatusText('Not enough data yet.');
    }
  }, [totalDistinctMealDays, allHabits.length]);

  // Meal Templates actions
  const handleSaveCurrentAsTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) return;

    try {
      const tmpl = await api.saveTemplate(templateName.trim(), activeDate);
      setTemplates(prev => [...prev, tmpl]);
      setTemplateName('');
      setIsSavingTemplate(false);
      setNotification(`Saved "${tmpl.name}" as meal template!`);
      setTimeout(() => setNotification(null), 3000);
    } catch (e: any) {
      setNotification(e.message || 'Failed to save template');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleApplyTemplate = async (templateId: string) => {
    try {
      const res = await api.applyTemplate(templateId, activeDate);
      setNotification(`Applied template (${res.count} meals loaded into today)!`);
      setTimeout(() => setNotification(null), 3000);
      loadReportsData();
    } catch (e: any) {
      setNotification(e.message || 'Failed to apply template');
      setTimeout(() => setNotification(null), 3000);
    }
  };

  const handleDeleteTemplateConfirmed = async (tmpl: MealTemplate) => {
    setTemplates(prev => prev.filter(t => t.id !== tmpl.id));
    await api.deleteTemplate(tmpl.id);
    showUndoToast(`Deleted template "${tmpl.name}"`, async () => {
      const restored = await api.restoreTemplate(tmpl);
      setTemplates(prev => [...prev, restored]);
    });
  };

  const handleDeleteSavedFood = async (id: string) => {
    await api.deleteSavedFood(id);
    setSavedFoods(prev => prev.filter(f => f.id !== id));
  };

  const filteredSavedFoods = savedFoods.filter(f =>
    f.name.toLowerCase().includes(debouncedSavedSearch.toLowerCase())
  );

  if (isLoadingReports) {
    return (
      <div className="space-y-4 pb-8 max-w-md mx-auto animate-pulse" aria-label="Loading reports">
        <div className="h-14 bg-zinc-900/90 border border-zinc-800 rounded-2xl" />
        <div className="h-36 bg-zinc-900/90 border border-zinc-800 rounded-2xl" />
        <div className="h-56 bg-zinc-900/90 border border-zinc-800 rounded-2xl" />
        <div className="h-44 bg-zinc-900/90 border border-zinc-800 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8 max-w-md mx-auto">
      {/* Date Picker Search Bar & Print Report Button (#75) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl flex items-center justify-between gap-2 no-print">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-teal-400" />
          <span className="text-xs font-semibold text-zinc-200">Inspect Past Days</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="relative cursor-pointer bg-zinc-950 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-xl text-xs font-mono text-zinc-300 flex items-center gap-1.5 transition-colors">
            <span>{activeDate}</span>
            <ArrowRight className="w-3.5 h-3.5 text-zinc-500" />
            <input
              type="date"
              aria-label="Inspect past day"
              min={minDate}
              max={maxDate}
              value={activeDate}
              onChange={(e) => e.target.value && setActiveDate(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full"
            />
          </label>
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print report"
            title="Print clean report"
            className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 rounded-xl text-xs font-medium text-teal-400 flex items-center gap-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Print</span>
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3 bg-teal-950/60 border border-teal-800/80 rounded-xl text-xs text-teal-300 flex items-center gap-2 animate-fade-in">
          <Check className="w-4 h-4 text-teal-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* #16 COPY MEAL FROM ANY PAST DAY */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-zinc-200">
            Meals Logged on {activeDate}
          </span>
          <span className="text-[10px] font-mono text-zinc-500">
            Tap any bar below to switch day
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map((mt) => {
            const slotItems = activeDayItems.filter((i) => i.mealType === mt);
            const slotKcal = slotItems.reduce((s, i) => s + i.calories, 0);
            const todayIso = formatLocalDate();

            const copySlotToToday = async () => {
              if (slotItems.length === 0) return;
              for (const item of slotItems) {
                await addFoodItem({
                  date: todayIso,
                  mealType: mt,
                  name: item.name,
                  calories: item.calories,
                  carbs: item.carbs,
                  fat: item.fat,
                  protein: item.protein,
                  serving: item.serving || '1 portion',
                  source: 'saved'
                });
              }
              setNotification(`Copied ${mt} (${slotItems.length} item${slotItems.length > 1 ? 's' : ''}) to today`);
              setTimeout(() => setNotification(null), 3000);
            };

            return (
              <SwipeableItem
                key={mt}
                onDuplicateToToday={slotItems.length > 0 ? copySlotToToday : undefined}
                duplicateLabel="Copy to Today"
                options={
                  slotItems.length > 0
                    ? [
                        {
                          label: `Duplicate ${mt} into today`,
                          onClick: copySlotToToday
                        }
                      ]
                    : undefined
                }
              >
                <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200 capitalize">{mt}</span>
                      <span className="text-[10px] font-mono text-teal-400">{slotKcal} kcal</span>
                    </div>
                    <span className="text-[10px] text-zinc-500 block truncate mt-0.5">
                      {slotItems.length > 0
                        ? slotItems.map((x) => x.name).join(', ')
                        : 'No items logged'}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={slotItems.length === 0}
                    onClick={copySlotToToday}
                    aria-label={`Copy ${mt} from ${activeDate} to today`}
                    className="w-full py-1.5 px-2 bg-teal-500/15 hover:bg-teal-500/25 disabled:opacity-40 border border-teal-500/30 rounded-lg text-[10px] font-semibold text-teal-300 flex items-center justify-center gap-1 transition-colors"
                  >
                    <Copy className="w-3 h-3" />
                    Copy to today
                  </button>
                </div>
              </SwipeableItem>
            );
          })}
        </div>
      </div>

      {/* THIS WEEK — REAL AI WEEKLY INSIGHTS */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">This week</h3>
            <span className="text-[11px] text-zinc-500">
              Patterns from your last 7 days of logs
            </span>
          </div>
          <button
            type="button"
            onClick={() => fetchWeeklyInsights(true)}
            disabled={isLoadingWeekly}
            aria-label="Refresh weekly insights"
            title="Refresh weekly insights"
            className="px-2.5 py-1.5 rounded-xl bg-zinc-950 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-teal-400 disabled:opacity-50 transition-colors flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isLoadingWeekly && <span>Calculating...</span>}
          </button>
        </div>

        {isLoadingWeekly ? (
          <div className="space-y-2 py-2 animate-pulse">
            <div className="h-3.5 w-5/6 bg-zinc-800 rounded" />
            <div className="h-3.5 w-3/4 bg-zinc-800/70 rounded" />
            <div className="h-3.5 w-4/5 bg-zinc-800/70 rounded" />
          </div>
        ) : weeklyBullets.length > 0 ? (
          <ul className="space-y-2 text-xs text-zinc-200 list-disc pl-4">
            {weeklyBullets.map((bullet, i) => (
              <li key={i} className="leading-relaxed">
                {bullet}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-zinc-500 py-2">
            {weeklyStatusText || 'Not enough data yet.'}
          </p>
        )}
      </div>

      {/* 14+ DAY MOOD & PROTEIN CORRELATION (only shown when meaningful >0.5 diff) */}
      {moodProteinCorrelation && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl">
          <p className="text-xs font-medium text-zinc-200 leading-relaxed">
            Your mood averages {moodProteinCorrelation.hitAvg} on days you hit protein, {moodProteinCorrelation.missAvg} on days you don&apos;t.
          </p>
        </div>
      )}

      {/* 14+ DAY SLEEP & CALORIE CORRELATION (only shown when real & consistent) */}
      {sleepCalorieCorrelation && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl">
          <p className="text-xs font-medium text-zinc-200 leading-relaxed">
            On nights you slept under 7 hours, you ate an average of {sleepCalorieCorrelation.diff} kcal more.
          </p>
        </div>
      )}

      {/* DAILY CALORIE TARGET ROW & EDITOR */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center justify-between gap-3">
          <div
            onClick={() => {
              if (!isEditingTarget) {
                setCustomTargetInput(String(macroTarget.calories));
                setIsEditingTarget(true);
              }
            }}
            className="cursor-pointer flex-1"
          >
            <span className="text-xs font-semibold text-zinc-300 block">Daily calorie target</span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-lg font-mono font-bold text-teal-400">
                {macroTarget.calories.toLocaleString()}
              </span>
              <span className="text-xs text-zinc-500 font-mono">kcal / day</span>
              {profile.targetCalories ? (
                <span className="ml-2 text-[10px] text-teal-400/80 bg-teal-500/10 px-1.5 py-0.5 rounded font-mono">
                  Custom
                </span>
              ) : (
                <span className="ml-2 text-[10px] text-zinc-500 bg-zinc-800/40 px-1.5 py-0.5 rounded font-mono">
                  Formula
                </span>
              )}
            </div>
          </div>

          {!isEditingTarget ? (
            <button
              type="button"
              onClick={() => {
                setCustomTargetInput(String(macroTarget.calories));
                setIsEditingTarget(true);
              }}
              className="p-2 rounded-xl bg-zinc-800/80 hover:bg-zinc-750 text-zinc-300 hover:text-teal-300 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Edit daily calorie target"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const val = parseInt(customTargetInput, 10);
                if (isNaN(val) || val <= 0) return;
                setIsSavingTarget(true);
                try {
                  await updateUserProfile({ targetCalories: val });
                  setIsEditingTarget(false);
                  setTargetSaveSuccess(true);
                  setTimeout(() => setTargetSaveSuccess(false), 3000);
                } finally {
                  setIsSavingTarget(false);
                }
              }}
              className="flex items-center gap-2"
            >
              <input
                type="number"
                min="500"
                max="10000"
                autoFocus
                value={customTargetInput}
                onChange={(e) => setCustomTargetInput(e.target.value)}
                placeholder="kcal"
                className="w-24 bg-zinc-950 border border-teal-500 rounded-xl px-2.5 py-1.5 text-xs font-mono text-zinc-100 text-right focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSavingTarget || !customTargetInput}
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-bold text-xs rounded-xl transition-colors"
              >
                {isSavingTarget ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={() => setIsEditingTarget(false)}
                className="px-2 py-1.5 text-zinc-400 hover:text-zinc-200 text-xs"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
        {targetSaveSuccess && (
          <p className="text-[11px] text-teal-400 mt-2 font-mono flex items-center gap-1">
            <Check className="w-3 h-3" /> Target updated in Firestore — Diary recalculated.
          </p>
        )}
      </div>

      {/* #26 & #27 CALORIE CHART WITH 7-DAY / 30-DAY MONTHLY / 12-MONTH YEARLY TOGGLE */}
      <div
        className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4 print-card"
        aria-describedby="sr-calorie-chart-summary"
      >
        <p id="sr-calorie-chart-summary" className="sr-only">
          {`Calorie intake chart (${chartRange}). Daily target is ${macroTarget.calories} kilocalories. Weekly average is ${avgCalories} kilocalories, ${avgProtein}g protein, ${avgCarbs}g carbs, ${avgFat}g fat.`}
        </p>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">
              {chartRange === '7d'
                ? '7-Day Calorie Intake'
                : chartRange === '30d'
                  ? '30-Day Monthly Intake'
                  : '12-Month Yearly Trend'}
            </h3>
            <span className="text-[11px] text-zinc-500">
              Target: {macroTarget.calories} kcal/day
            </span>
          </div>

          <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
            {(['7d', '30d', '12m'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setChartRange(mode)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-semibold transition-colors ${
                  chartRange === mode
                    ? 'bg-teal-500 text-zinc-950'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {allEntries.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-6 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
            No meals logged yet. Log meals to see your chart.
          </p>
        ) : chartRange === '12m' ? (
          <div className="h-44 flex items-end justify-between gap-1.5 pt-6 px-1 border-b border-zinc-800 relative">
            {past12Months.map((m) => {
              const heightPct = Math.min(100, Math.max(8, (m.avgKcal / maxBarCal) * 100));
              return (
                <div key={m.ym} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <span className="text-[8px] font-mono text-zinc-400 mb-1 opacity-0 group-hover:opacity-100">
                    {m.avgKcal}
                  </span>
                  <div className="w-full h-full flex items-end">
                    <div
                      className={`w-full rounded-t-md ${
                        m.isOver ? 'bg-rose-500' : m.avgKcal > 0 ? 'bg-teal-500' : 'bg-zinc-800/40'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] mt-1.5 text-zinc-500 font-mono">{m.label}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-44 flex items-end justify-between gap-1 pt-6 px-1 border-b border-zinc-800 relative">
            <div
              className="absolute left-0 right-0 border-b border-dashed border-teal-500/40 pointer-events-none z-10 flex justify-end pr-1"
              style={{ bottom: `${(macroTarget.calories / maxBarCal) * 100}%` }}
            >
              <span className="text-[9px] font-mono text-teal-400/80 -translate-y-3">
                Goal {macroTarget.calories}
              </span>
            </div>

            {activeSeries.map((day, idx) => {
              const heightPct = Math.min(100, Math.max(6, (day.calories / maxBarCal) * 100));
              const isSelected = day.dateStr === activeDate;
              const showLabel = chartRange === '7d' || idx % 5 === 0;

              return (
                <button
                  key={day.dateStr}
                  onClick={() => setActiveDate(day.dateStr)}
                  className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer focus:outline-none"
                >
                  <div className="w-full max-w-[24px] h-full flex items-end">
                    <div
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        day.isOver
                          ? 'bg-rose-500'
                          : day.calories > 0
                            ? 'bg-teal-500'
                            : 'bg-zinc-800/40'
                      } ${isSelected ? 'ring-1 ring-teal-300' : ''}`}
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className={`text-[9px] mt-1.5 font-mono ${isSelected ? 'text-teal-300' : 'text-zinc-500'}`}>
                    {showLabel ? day.label : ''}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* #18 WEIGHT SMOOTHING: Raw daily weights in light grey, 7-day rolling average in teal */}
      <div
        className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3.5 print-card"
        aria-describedby="sr-weight-chart-summary"
      >
        <p id="sr-weight-chart-summary" className="sr-only">
          {smoothedWeights.length > 1
            ? `Weight chart with ${smoothedWeights.length} weigh-ins. Latest 7-day rolling average is ${smoothedWeights[smoothedWeights.length - 1]?.smoothedKg} kilograms.`
            : 'Weight chart requires at least 2 weigh-ins to display trend.'}
        </p>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Weight &amp; 7-Day Rolling Average</h4>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="text-zinc-400">― Raw Daily</span>
            <span className="text-teal-400 font-bold">― 7d Trend</span>
          </div>
        </div>

        {smoothedWeights.length > 1 ? (
          <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-850">
            {(() => {
              const minW = Math.min(...smoothedWeights.map(w => w.weightKg)) - 1;
              const maxW = Math.max(...smoothedWeights.map(w => w.weightKg)) + 1;
              const range = maxW - minW || 1;
              const rawPts = smoothedWeights
                .map((w, idx) => {
                  const x = (idx / (smoothedWeights.length - 1)) * 260 + 20;
                  const y = 85 - ((w.weightKg - minW) / range) * 65;
                  return `${x},${y}`;
                })
                .join(' ');
              const smoothPts = smoothedWeights
                .map((w, idx) => {
                  const x = (idx / (smoothedWeights.length - 1)) * 260 + 20;
                  const y = 85 - ((w.smoothedKg - minW) / range) * 65;
                  return `${x},${y}`;
                })
                .join(' ');

              const latestSmooth = smoothedWeights[smoothedWeights.length - 1]?.smoothedKg;

              return (
                <>
                  <svg
                    className="w-full h-28"
                    viewBox="0 0 300 100"
                    preserveAspectRatio="none"
                    role="img"
                    aria-label={`Weight trend chart showing ${smoothedWeights.length} entries. Latest 7-day rolling average is ${latestSmooth} kg.`}
                  >
                    <line x1="0" y1="20" x2="300" y2="20" stroke="#27272a" strokeDasharray="3 3" />
                    <line x1="0" y1="85" x2="300" y2="85" stroke="#27272a" strokeDasharray="3 3" />
                    {/* Raw daily weights in light grey */}
                    <polyline
                      fill="none"
                      stroke="#a1a1aa"
                      strokeOpacity="0.6"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      points={rawPts}
                    />
                    {/* 7-day rolling average in teal */}
                    <polyline
                      fill="none"
                      stroke="#14b8a6"
                      strokeWidth="2.75"
                      strokeLinecap="round"
                      points={smoothPts}
                    />
                  </svg>
                  <span className="sr-only">
                    Latest 7-day rolling average weight: {latestSmooth} kg.
                  </span>
                </>
              );
            })()}
          </div>
        ) : (
          <p className="text-xs text-zinc-500 text-center py-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
            Log at least 2 weigh-ins to see the trend.
          </p>
        )}

        {/* #35 Plateau Detector */}
        {isInPlateau ? (
          <div className="p-3 bg-amber-950/30 border border-amber-700/50 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>14-Day Weight Plateau Detected</span>
            </div>
            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Scale weight has stayed within ±0.3kg over 14+ days. Next steps: verify cooking oil/sauce portions, add 1,500 daily steps, or take a 3-day maintenance refeed.
            </p>
          </div>
        ) : (
          <div className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">14-Day Plateau Detector</span>
            <span className="text-teal-400 font-mono">No plateau detected</span>
          </div>
        )}
      </div>

      {/* #28, #29, #30, #31, #32 PROTEIN/KG, FIBER, SUGAR, SODIUM & MICRONUTRIENTS */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Nutrition Quality ({activeDate})</h4>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 text-xs">
          {/* #28 Protein per kg */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] text-zinc-500 uppercase block">Protein / kg Body Wt</span>
            <span className="text-base font-bold text-zinc-100 font-mono">{proteinPerKg} g/kg</span>
            <span className={`text-[10px] block mt-0.5 ${proteinPerKg >= 1.2 && proteinPerKg <= 2.2 ? 'text-teal-400' : 'text-amber-400'}`}>
              Healthy range: 1.2–2.2 g/kg
            </span>
          </div>

          {/* #29 Fiber tracking */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] text-zinc-500 uppercase block">Dietary Fiber</span>
            <span className="text-base font-bold text-zinc-100 font-mono">{dayFiber}g / {fiberTarget}g</span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              Target based on age &amp; gender
            </span>
          </div>

          {/* #30 Sugar tracking */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] text-zinc-500 uppercase block">Daily Sugar</span>
            <span className={`text-base font-bold font-mono ${daySugar > sugarWarningThreshold ? 'text-rose-400' : 'text-zinc-100'}`}>
              {daySugar}g
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              Warning threshold: {sugarWarningThreshold}g
            </span>
          </div>

          {/* #31 Sodium tracking */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] text-zinc-500 uppercase block">Daily Sodium</span>
            <span className={`text-base font-bold font-mono ${daySodium > 2300 ? 'text-amber-400' : 'text-zinc-100'}`}>
              {daySodium} mg
            </span>
            <span className="text-[10px] text-zinc-500 block mt-0.5">
              Daily limit: 2,300 mg
            </span>
          </div>
        </div>

        {/* #32 Micronutrient warnings */}
        {activeDayItems.length === 0 ? (
          <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-500 text-center">
            Log food to see micronutrient tracking.
          </div>
        ) : lowMicros.length > 0 ? (
          <div className="p-3 bg-amber-950/30 border border-amber-800/50 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Micronutrient Watch</span>
            </div>
            <p className="text-[11px] text-zinc-300">
              Low intake flagged today for: {lowMicros.join(' · ')}. Consider leafy greens, dairy/fortified tofu, or fatty fish.
            </p>
          </div>
        ) : null}
      </div>

      {/* #33 TIME-OF-DAY EATING HEATMAP & #34 WEEKEND VS WEEKDAY COMPARISON */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-400" />
          <h4 className="text-sm font-semibold text-zinc-200">Timing &amp; Weekend Insights</h4>
        </div>

        {/* #34 Weekend vs Weekday */}
        <div className="grid grid-cols-2 gap-2.5 text-center">
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] text-zinc-500 uppercase block">Weekday Avg (Mon–Fri)</span>
            <span className="text-sm font-bold text-teal-400 font-mono">{weekdayWeekendStats.weekdayAvg} kcal</span>
          </div>
          <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3">
            <span className="text-[10px] text-zinc-500 uppercase block">Weekend Avg (Sat–Sun)</span>
            <span className="text-sm font-bold text-amber-400 font-mono">{weekdayWeekendStats.weekendAvg} kcal</span>
          </div>
        </div>

        {/* #33 Time-of-Day Eating Heatmap */}
        <div className="space-y-1.5">
          <span className="text-[11px] text-zinc-400 font-medium block">
            Time-of-Day Calorie Distribution (Past 7 Days)
          </span>
          <div className="space-y-1">
            {timeSlots.map((slot) => (
              <div key={slot.label} className="flex items-center gap-2">
                <span className="w-24 text-[10px] text-zinc-500 font-mono shrink-0">{slot.label}</span>
                <div className="flex-1 grid grid-cols-7 gap-1">
                  {past7Days.map((d) => {
                    const dayItems = allEntries.filter(e => e.date === d.dateStr && slot.match(e));
                    const slotKcal = dayItems.reduce((s, i) => s + i.calories, 0);
                    const intensityClass =
                      slotKcal > 700
                        ? 'bg-teal-400'
                        : slotKcal > 350
                          ? 'bg-teal-500/60'
                          : slotKcal > 0
                            ? 'bg-teal-500/25'
                            : 'bg-zinc-950 border border-zinc-800/80';
                    return (
                      <div
                        key={d.dateStr}
                        title={`${d.label} ${slot.label}: ${slotKcal} kcal`}
                        className={`h-5 rounded ${intensityClass}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* REFLECTIONS SECTION WITH SEARCH */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Reflections</h4>
          </div>
          <span className="text-[11px] font-mono text-zinc-500">
            {reflectionsList.length} saved
          </span>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={reflectionSearch}
            onChange={(e) => setReflectionSearch(e.target.value)}
            placeholder="Search reflections (e.g. tired, hungry)..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
          />
        </div>

        {reflectionsList.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-3 bg-zinc-950/60 border border-zinc-800/80 rounded-xl">
            Save a Daily Reflection on the Diary tab to see your entries here.
          </p>
        ) : filteredReflections.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-3">
            No reflections matching &ldquo;{reflectionSearch}&rdquo;.
          </p>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {filteredReflections.map((r) => (
              <div
                key={r.date}
                className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-teal-400">{r.date}</span>
                  {r.journalPrompt && (
                    <span className="text-[10px] text-zinc-500 truncate max-w-[200px]">
                      {r.journalPrompt}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-200 leading-relaxed">{r.journalAnswer}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WEEKLY AVERAGES & SHARE PROGRESS CARD */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-zinc-300">
            7-Day Daily Averages
          </h4>
          <button
            type="button"
            onClick={() => {
              const canvas = document.createElement('canvas');
              canvas.width = 640;
              canvas.height = 360;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.fillStyle = '#09090b';
                ctx.fillRect(0, 0, 640, 360);
                ctx.strokeStyle = '#14b8a6';
                ctx.lineWidth = 3;
                ctx.strokeRect(18, 18, 604, 324);
                ctx.fillStyle = '#2dd4bf';
                ctx.font = 'bold 20px monospace';
                ctx.fillText('FORKCOUNT PROGRESS SUMMARY', 44, 66);
                ctx.fillStyle = '#f4f4f5';
                ctx.font = 'bold 34px sans-serif';
                ctx.fillText(`${profile.streakDays || 0} Day Streak`, 44, 125);
                ctx.fillStyle = '#a1a1aa';
                ctx.font = '20px monospace';
                ctx.fillText(`7d Avg Intake: ${avgCalories} kcal (${avgProtein}g Protein)`, 44, 185);
                const weightDiff =
                  sortedWeights.length >= 2
                    ? Math.round((sortedWeights[sortedWeights.length - 1].weightKg - sortedWeights[0].weightKg) * 10) / 10
                    : 0;
                ctx.fillText(
                  `Weight Change: ${weightDiff > 0 ? '+' : ''}${formatWeight(weightDiff, profile.unitSystem)}`,
                  44,
                  230
                );
                ctx.fillStyle = '#52525b';
                ctx.font = '14px monospace';
                ctx.fillText(`Generated on ${formatLocalDate()}`, 44, 305);
                const link = document.createElement('a');
                link.download = `forkcount-progress-${formatLocalDate()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
              }
              setNotification('Progress card downloaded as PNG');
              setTimeout(() => setNotification(null), 3000);
            }}
            aria-label="Share progress card"
            className="px-2.5 py-1.5 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 rounded-lg text-xs font-semibold text-teal-300 flex items-center gap-1.5 transition-colors"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share progress card
          </button>
        </div>

        <div className="grid grid-cols-4 gap-2">
          <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] text-zinc-500 block uppercase">Avg Kcal</span>
            <span className="text-sm font-bold text-zinc-200 font-mono">{avgCalories}</span>
          </div>
          <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] text-blue-400 block uppercase">Carbs</span>
            <span className="text-sm font-bold text-zinc-200 font-mono">{avgCarbs}g</span>
          </div>
          <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] text-amber-400 block uppercase">Fat</span>
            <span className="text-sm font-bold text-zinc-200 font-mono">{avgFat}g</span>
          </div>
          <div className="bg-zinc-950 p-2.5 rounded-xl border border-zinc-800 text-center">
            <span className="text-[10px] text-red-400 block uppercase">Protein</span>
            <span className="text-sm font-bold text-zinc-200 font-mono">{avgProtein}g</span>
          </div>
        </div>
      </div>

      {/* MEAL TEMPLATES */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">Meal Templates</h4>
          </div>

          <button
            onClick={() => setIsSavingTemplate(!isSavingTemplate)}
            className="px-2.5 py-1 bg-teal-500/15 text-teal-300 border border-teal-500/30 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Save Today
          </button>
        </div>

        {isSavingTemplate && (
          <form onSubmit={handleSaveCurrentAsTemplate} className="space-y-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800">
            <label className="block text-xs font-medium text-zinc-400">
              Template Name (e.g. &apos;Standard Training Day&apos;)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name..."
                required
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-teal-500"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold text-xs rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </form>
        )}

        {templates.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-3 border border-dashed border-zinc-800 rounded-xl">
            No meal templates yet. Save today&apos;s meals as a template to reuse later.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t) => (
              <SwipeableItem
                key={t.id}
                onDelete={() => setTemplateToDelete(t)}
                onDuplicateToToday={() => handleApplyTemplate(t.id)}
                duplicateLabel="Apply Template"
                options={[
                  {
                    label: `Apply to ${activeDate}`,
                    onClick: () => handleApplyTemplate(t.id)
                  },
                  {
                    label: 'Delete meal template',
                    onClick: () => setTemplateToDelete(t),
                    destructive: true
                  }
                ]}
              >
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-zinc-200 block">{t.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {t.items.length} items · {t.items.reduce((s, i) => s + i.calories, 0)} kcal total
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApplyTemplate(t.id)}
                      className="px-2.5 py-1 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded-lg text-xs font-medium transition-colors"
                    >
                      Apply to {activeDate}
                    </button>
                    <button
                      onClick={() => setTemplateToDelete(t)}
                      className="p-1 text-zinc-600 hover:text-rose-400 rounded transition-colors"
                      aria-label="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </SwipeableItem>
            ))}
          </div>
        )}
      </div>

      {/* SAVED RECIPES SECTION (#27 Empty state + #18 Two-step delete confirmation) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">
              Saved Recipes ({savedRecipes.length})
            </h4>
          </div>
        </div>

        {savedRecipes.length === 0 ? (
          <p className="text-xs text-zinc-500 py-3 text-center border border-dashed border-zinc-800 rounded-xl">
            No saved recipes yet. Create a recipe in the Add Food screen to save it here.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {savedRecipes.map((rec) => (
              <SwipeableItem
                key={rec.id}
                onDelete={() => setRecipeToDelete(rec)}
                onDuplicateToToday={async () => {
                  await addFoodItem({
                    date: formatLocalDate(),
                    mealType: 'dinner',
                    name: rec.name,
                    calories: rec.totalCalories,
                    carbs: rec.totalCarbs,
                    fat: rec.totalFat,
                    protein: rec.totalProtein,
                    serving: '1 recipe portion',
                    source: 'recipe'
                  });
                  setNotification(`Logged "${rec.name}" into today`);
                  setTimeout(() => setNotification(null), 3000);
                }}
                duplicateLabel="Log Recipe Today"
                options={[
                  {
                    label: 'Log recipe into today',
                    onClick: async () => {
                      await addFoodItem({
                        date: formatLocalDate(),
                        mealType: 'dinner',
                        name: rec.name,
                        calories: rec.totalCalories,
                        carbs: rec.totalCarbs,
                        fat: rec.totalFat,
                        protein: rec.totalProtein,
                        serving: '1 recipe portion',
                        source: 'recipe'
                      });
                      setNotification(`Logged "${rec.name}" into today`);
                      setTimeout(() => setNotification(null), 3000);
                    }
                  },
                  {
                    label: 'Delete saved recipe',
                    onClick: () => setRecipeToDelete(rec),
                    destructive: true
                  }
                ]}
              >
                <div className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="text-xs font-medium text-zinc-200 block truncate">{rec.name}</span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {rec.ingredients.length} ingredients · {rec.totalCarbs}c · {rec.totalFat}f · {rec.totalProtein}p
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs font-bold text-teal-400">
                      {rec.totalCalories} kcal
                    </span>
                    <button
                      type="button"
                      onClick={() => setRecipeToDelete(rec)}
                      className="p-1 text-zinc-600 hover:text-rose-400 rounded transition-colors"
                      aria-label={`Delete recipe ${rec.name}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </SwipeableItem>
            ))}
          </div>
        )}
      </div>

      {/* SAVED FOODS LIST */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-teal-400" />
            <h4 className="text-sm font-semibold text-zinc-200">
              Saved Foods ({savedFoods.length})
            </h4>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={savedSearch}
            onChange={(e) => setSavedSearch(e.target.value)}
            placeholder="Search saved foods..."
            className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
          />
        </div>

        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
          {savedFoods.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3 text-center border border-dashed border-zinc-800 rounded-xl">
              No saved foods yet. Foods you log will appear here for one-tap re-adding.
            </p>
          ) : filteredSavedFoods.length === 0 ? (
            <p className="text-xs text-zinc-500 py-3 text-center">No saved foods found.</p>
          ) : (
            filteredSavedFoods.map((food) => (
              <SwipeableItem
                key={food.id}
                onDelete={() => handleDeleteSavedFood(food.id)}
                onDuplicateToToday={async () => {
                  await addFoodItem({
                    date: formatLocalDate(),
                    mealType: 'lunch',
                    name: food.name,
                    calories: food.calories,
                    carbs: food.carbs,
                    fat: food.fat,
                    protein: food.protein,
                    serving: food.serving || '1 portion',
                    source: 'saved'
                  });
                  setNotification(`Logged "${food.name}" into today`);
                  setTimeout(() => setNotification(null), 3000);
                }}
                duplicateLabel="Log Today"
                options={[
                  {
                    label: 'Log food into today',
                    onClick: async () => {
                      await addFoodItem({
                        date: formatLocalDate(),
                        mealType: 'lunch',
                        name: food.name,
                        calories: food.calories,
                        carbs: food.carbs,
                        fat: food.fat,
                        protein: food.protein,
                        serving: food.serving || '1 portion',
                        source: 'saved'
                      });
                      setNotification(`Logged "${food.name}" into today`);
                      setTimeout(() => setNotification(null), 3000);
                    }
                  },
                  {
                    label: 'Delete saved food',
                    onClick: () => handleDeleteSavedFood(food.id),
                    destructive: true
                  }
                ]}
              >
                <div className="p-2.5 bg-zinc-950 border border-zinc-850 rounded-xl flex items-center justify-between">
                  <div className="truncate pr-2">
                    <span className="text-xs font-medium text-zinc-200 block truncate">{food.name}</span>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-mono">
                      <span>{food.serving}</span>
                      <span>·</span>
                      <span className="text-blue-400">{food.carbs}c</span>
                      <span className="text-amber-400">{food.fat}f</span>
                      <span className="text-red-400">{food.protein}p</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs font-bold text-teal-400">
                      {food.calories} kcal
                    </span>
                    <button
                      onClick={() => handleDeleteSavedFood(food.id)}
                      className="p-1 text-zinc-600 hover:text-rose-400 rounded transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </SwipeableItem>
            ))
          )}
        </div>
      </div>

      {/* #18 Two-step confirmation for deleting a meal template */}
      <ConfirmDialog
        isOpen={templateToDelete !== null}
        title="Delete Meal Template"
        description={
          templateToDelete
            ? `Are you sure you want to delete the meal template "${templateToDelete.name}"?`
            : ''
        }
        confirmLabel="Delete Template"
        secondStepLabel="Confirm Template Deletion"
        onClose={() => setTemplateToDelete(null)}
        onConfirm={async () => {
          if (!templateToDelete) return;
          await handleDeleteTemplateConfirmed(templateToDelete);
        }}
      />

      {/* #18 Two-step confirmation for deleting a saved recipe */}
      <ConfirmDialog
        isOpen={recipeToDelete !== null}
        title="Delete Saved Recipe"
        description={
          recipeToDelete
            ? `Are you sure you want to delete the saved recipe "${recipeToDelete.name}"?`
            : ''
        }
        confirmLabel="Delete Recipe"
        secondStepLabel="Confirm Recipe Deletion"
        onClose={() => setRecipeToDelete(null)}
        onConfirm={async () => {
          if (!recipeToDelete) return;
          const id = recipeToDelete.id;
          setSavedRecipes(prev => prev.filter(r => r.id !== id));
          await api.deleteSavedRecipe(id);
        }}
      />
    </div>
  );
};
