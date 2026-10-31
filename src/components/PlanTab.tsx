import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Plus,
  CheckCircle2,
  ShoppingBag,
  Dumbbell,
  Utensils,
  DollarSign,
  ChefHat,
  Users,
  X
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import {
  swapPlanMealFromMealDb,
  splitMealDbInstructions,
  isLegacyNonMealDbPlan
} from '../utils/mealDbPlanner.js';
import type { WeekPlan, PlanDayMeal } from '../types/index.js';

export const PlanTab: React.FC = () => {
  const { macroTarget, activeDate, profile, updateUserProfile, addFoodItem, addExerciseItem } = useApp();

  const [cachedPlan, setCachedPlan] = useState<WeekPlan | null>(null);
  const [declinedPlan, setDeclinedPlan] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [planType, setPlanType] = useState<'meals' | 'workouts' | 'both'>('both');
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [showShoppingList, setShowShoppingList] = useState(false);
  // #50 Meal prep mode toggle
  const [showMealPrepMode, setShowMealPrepMode] = useState(false);
  // #52 Scale servings (1, 2, or 4)
  const [servingsScale, setServingsScale] = useState<1 | 2 | 4>(1);
  // #49 Budget tracker target ($)
  const [weeklyBudgetLimit, setWeeklyBudgetLimit] = useState<number>(profile.weeklyBudget || 95);

  const [loggedMealIds, setLoggedMealIds] = useState<Set<string>>(new Set());
  const [loggedWorkoutDays, setLoggedWorkoutDays] = useState<Set<number>>(new Set());
  const [swappingMealKey, setSwappingMealKey] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedRecipeModal, setSelectedRecipeModal] = useState<{
    meal: PlanDayMeal;
    dayIdx: number;
    mealIdx: number;
  } | null>(null);
  const [recipeToast, setRecipeToast] = useState<string | null>(null);

  // Wizard Questions state
  const [restrictions, setRestrictions] = useState<string[]>(() =>
    Array.isArray(profile.restrictions) ? profile.restrictions : []
  );
  const [allergies, setAllergies] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState('');
  const [cookTime, setCookTime] = useState('15–30 min');
  const [mealsPerDay, setMealsPerDay] = useState<number>(3);
  const [budget, setBudget] = useState('Moderate');
  const [workoutDays, setWorkoutDays] = useState<number>(4);
  const [equipment, setEquipment] = useState('Dumbbells');
  const [injuries, setInjuries] = useState('');
  const [narrowingText, setNarrowingText] = useState('');

  useEffect(() => {
    if (profile.weeklyBudget) {
      setWeeklyBudgetLimit(profile.weeklyBudget);
    }
  }, [profile.weeklyBudget]);

  useEffect(() => {
    if (Array.isArray(profile.restrictions) && profile.restrictions.length > 0 && restrictions.length === 0) {
      setRestrictions(profile.restrictions);
    }
  }, [profile.restrictions]);

  useEffect(() => {
    async function loadPlan() {
      try {
        const res = await api.getPlan();
        if (res.plan && !isLegacyNonMealDbPlan(res.plan)) {
          setCachedPlan(res.plan);
        }
      } catch (err) {
        console.error(err);
      }
    }
    loadPlan();
  }, []);

  const isPlanFromLastWeek = useMemo(() => {
    if (!cachedPlan) return false;
    const ts = cachedPlan.createdAt || cachedPlan.generatedAt;
    if (!ts) return false;
    const ageMs = Date.now() - Number(ts);
    return ageMs > 7 * 24 * 60 * 60 * 1000;
  }, [cachedPlan]);

  const startWizard = (type: 'meals' | 'workouts' | 'both') => {
    setPlanType(type);
    if (Array.isArray(profile.restrictions) && profile.restrictions.length > 0 && restrictions.length === 0) {
      setRestrictions(profile.restrictions);
    }
    setIsWizardOpen(true);
    setWizardStep(0);
  };

  const effectiveCalorieTarget =
    macroTarget.calories > 0
      ? macroTarget.calories
      : profile.targetCalories && profile.targetCalories > 0
        ? profile.targetCalories
        : 2000;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setIsWizardOpen(false);
    setErrorMsg(null);

    try {
      if (restrictions.length > 0 || (Array.isArray(profile.restrictions) && profile.restrictions.length > 0)) {
        updateUserProfile({ restrictions }).catch(() => {});
      }

      const res = await api.generatePlan({
        type: planType,
        dailyTargetCalories: effectiveCalorieTarget,
        dailyTargetCarbs: macroTarget.carbsGrams || Math.round((effectiveCalorieTarget * 0.4) / 4),
        dailyTargetFat: macroTarget.fatGrams || Math.round((effectiveCalorieTarget * 0.3) / 9),
        dailyTargetProtein: macroTarget.proteinGrams || Math.round((effectiveCalorieTarget * 0.3) / 4),
        preferences: {
          restrictions,
          allergies,
          dislikes,
          cookTime,
          mealsPerDay,
          budget,
          workoutDaysPerWeek: workoutDays,
          equipment,
          injuries,
          narrowingText
        }
      });
      setCachedPlan(res.plan);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not generate plan from TheMealDB');
    } finally {
      setIsGenerating(false);
    }
  };

  const getTodayDayIndex = () => {
    const d = new Date(activeDate + 'T00:00:00');
    const day = d.getDay();
    return day === 0 ? 6 : day - 1;
  };

  const todayIndex = getTodayDayIndex();
  const currentDayPlan = cachedPlan?.days?.[todayIndex] || cachedPlan?.days?.[0];

  const handleLogPlanMeal = async (meal: PlanDayMeal, mealIndex: number, dayIdx: number = todayIndex) => {
    if (meal.noMatchMessage) return;
    const key = `${dayIdx}-${mealIndex}-${meal.name}`;
    if (loggedMealIds.has(key)) return;

    await addFoodItem({
      date: activeDate,
      mealType: meal.mealType,
      name: `${meal.name}${servingsScale > 1 ? ` (${servingsScale}×)` : ''}`,
      calories: Math.round(meal.calories * servingsScale),
      carbs: Math.round(meal.carbs * servingsScale),
      fat: Math.round(meal.fat * servingsScale),
      protein: Math.round(meal.protein * servingsScale),
      serving: `${servingsScale} portion${servingsScale > 1 ? 's' : ''}`,
      source: 'plan'
    });

    setLoggedMealIds((prev) => new Set([...prev, key]));
  };

  const handleLogPlanWorkout = async (dayIndex: number) => {
    if (!currentDayPlan?.workout || currentDayPlan.workout.isRest) return;
    if (loggedWorkoutDays.has(dayIndex)) return;

    await addExerciseItem({
      date: activeDate,
      activityName: currentDayPlan.workout.name,
      met: 6.0,
      minutes: 45,
      caloriesBurned: Math.round(6.0 * (profile.currentWeightKg || 70) * (45 / 60)),
      intensity: 'Moderate'
    });

    setLoggedWorkoutDays((prev) => new Set([...prev, dayIndex]));
  };

  // #51 Swap a meal — searches TheMealDB for another real recipe matching the slot & dietary filter
  const handleSwapMeal = async (dayIdx: number, mealIdx: number) => {
    if (!cachedPlan) return;
    const swapKey = `${dayIdx}-${mealIdx}`;
    if (swappingMealKey === swapKey) return;

    setSwappingMealKey(swapKey);
    setErrorMsg(null);
    try {
      const replacement = await swapPlanMealFromMealDb(
        cachedPlan,
        dayIdx,
        mealIdx,
        cachedPlan.targetCalories || effectiveCalorieTarget,
        profile.restrictions
      );
      if (!replacement) {
        setErrorMsg('No alternative TheMealDB recipe matched your dietary filter for this meal slot.');
        return;
      }

      const day = cachedPlan.days[dayIdx];
      const updatedMeals = [...day.meals];
      updatedMeals[mealIdx] = replacement;

      const updatedDays = [...cachedPlan.days];
      updatedDays[dayIdx] = { ...day, meals: updatedMeals };
      const newPlan = { ...cachedPlan, days: updatedDays };
      setCachedPlan(newPlan);
      await api.savePlan(newPlan);
    } catch {
      setErrorMsg('Could not swap recipe from TheMealDB. Check your connection and try again.');
    } finally {
      setSwappingMealKey(null);
    }
  };

  // #52 Helper to scale an ingredient string by servingsScale (1, 2, or 4)
  const scaleIngredientText = (raw: string, scale: number): string => {
    if (scale === 1) return raw;
    const match = raw.match(
      /^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|lb|lbs|tbsp|tbs|tsp|cup|cups|slice|slices|can|cans|large|medium|small)?\s+(.*)$/i
    );
    if (match) {
      const num = Math.round(parseFloat(match[1]) * scale * 10) / 10;
      const unit = match[2] || '';
      const rest = match[3];
      return `${num}${unit ? (unit.length <= 2 ? unit : ` ${unit}`) : ''} ${rest}`;
    }
    return `${raw} (×${scale})`;
  };

  // #48 Smart Grocery List — merges duplicate ingredients across the week's plan and groups by aisle
  const smartGroceryByAisle = useMemo(() => {
    if (!cachedPlan) return {};
    const aisles: Record<
      string,
      Map<string, { name: string; totalGrams: number; totalCount: number; unit: string }>
    > = {
      produce: new Map(),
      dairy: new Map(),
      meat: new Map(),
      pantry: new Map(),
      frozen: new Map()
    };

    for (const day of cachedPlan.days) {
      for (const meal of day.meals) {
        const cat = aisles[meal.aisle] ? meal.aisle : 'produce';
        for (const raw of meal.ingredients || []) {
          const match = raw.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml)?\s*(.*)$/i);
          let amount = 1;
          let unit = '×';
          let cleanName = raw.trim();

          if (match && match[3]) {
            amount = parseFloat(match[1]) || 1;
            unit = (match[2] || 'unit').toLowerCase();
            cleanName = match[3].trim();
          }

          const key = cleanName.toLowerCase();
          const map = aisles[cat];
          const existing = map.get(key);
          if (existing && existing.unit === unit) {
            existing.totalGrams += amount * servingsScale;
            existing.totalCount += 1;
          } else if (existing) {
            existing.totalCount += servingsScale;
          } else {
            map.set(key, {
              name: cleanName,
              totalGrams: amount * servingsScale,
              totalCount: 1,
              unit
            });
          }
        }
      }
    }

    const formatted: Record<string, string[]> = {};
    for (const [aisle, map] of Object.entries(aisles)) {
      formatted[aisle] = Array.from(map.values()).map((item) => {
        if (item.unit === 'g' || item.unit === 'ml' || item.unit === 'kg') {
          return `${Math.round(item.totalGrams)}${item.unit} ${item.name}`;
        }
        if (item.totalGrams > 1) {
          return `${Math.round(item.totalGrams)}× ${item.name}`;
        }
        return item.name;
      });
    }
    return formatted;
  }, [cachedPlan, servingsScale]);

  // #49 Budget Tracker — estimate weekly grocery cost
  const estimatedWeeklyCost = useMemo(() => {
    if (!cachedPlan) return 0;
    let baseSum = 0;
    for (const day of cachedPlan.days) {
      for (const meal of day.meals) {
        if (meal.noMatchMessage) continue;
        if (meal.costEstimate) {
          baseSum += meal.costEstimate;
        } else {
          const perMeal = cachedPlan.preferences?.budget === 'Cheap' ? 2.8 : 4.1;
          baseSum += perMeal;
        }
      }
    }
    const scaleFactor = servingsScale === 1 ? 1 : servingsScale === 2 ? 1.85 : 3.5;
    return Math.round(baseSum * scaleFactor);
  }, [cachedPlan, servingsScale]);

  // #50 Meal Prep Mode — Sunday batch-cook tasks for the week
  const sundayPrepBatches = useMemo(() => {
    if (!cachedPlan) return [];
    const mealCounts = new Map<
      string,
      { name: string; count: number; mealType: string; prepTime: string; totalCalories: number }
    >();
    for (const day of cachedPlan.days) {
      for (const meal of day.meals) {
        if (meal.noMatchMessage) continue;
        const key = meal.name;
        const ex = mealCounts.get(key);
        if (ex) {
          ex.count += servingsScale;
        } else {
          mealCounts.set(key, {
            name: meal.name,
            count: servingsScale,
            mealType: meal.mealType,
            prepTime: meal.prepTime || 'Not specified',
            totalCalories: meal.calories
          });
        }
      }
    }
    return Array.from(mealCounts.values()).slice(0, 8);
  }, [cachedPlan, servingsScale]);

  const wizardQuestions = [
    ...(planType === 'meals' || planType === 'both'
      ? [
          {
            title: "Anything you won't eat?",
            subtitle: 'Select any dietary principles or exclusions to filter TheMealDB recipes',
            type: 'multi',
            options: [
              'Vegetarian',
              'Vegan',
              'Pescatarian',
              'Halal',
              'Kosher',
              'No pork',
              'No beef',
              'No seafood',
              'None'
            ],
            selected: restrictions,
            onChange: (opt: string) => {
              if (opt === 'None') {
                setRestrictions([]);
              } else {
                setRestrictions((prev) =>
                  prev.includes(opt)
                    ? prev.filter((x) => x !== opt)
                    : [...prev.filter((x) => x !== 'None'), opt]
                );
              }
            }
          },
          {
            title: 'Any allergies?',
            subtitle: 'Strictly filtered out when searching TheMealDB',
            type: 'multi',
            options: ['Nuts', 'Dairy', 'Gluten', 'Eggs', 'Soy', 'Shellfish', 'None'],
            selected: allergies,
            onChange: (opt: string) => {
              if (opt === 'None') {
                setAllergies([]);
              } else {
                setAllergies((prev) =>
                  prev.includes(opt)
                    ? prev.filter((x) => x !== opt)
                    : [...prev.filter((x) => x !== 'None'), opt]
                );
              }
            }
          },
          {
            title: 'Any specific ingredients to exclude?',
            subtitle: 'Comma-separated ingredients to filter out (optional)',
            type: 'text',
            value: dislikes,
            onChange: setDislikes,
            placeholder: 'e.g. mushrooms, coriander, olives'
          },
          {
            title: 'How long to cook?',
            subtitle: 'Preferred kitchen preparation window',
            type: 'single',
            options: ['Under 15 min', '15–30 min', '30–60 min', 'Any'],
            selected: cookTime,
            onChange: setCookTime
          },
          {
            title: 'Meals per day?',
            subtitle: 'Breakfast 25%, Lunch 35%, Dinner 40% (adjusted if snacks are included)',
            type: 'number-chips',
            options: [3, 4, 5],
            selected: mealsPerDay,
            onChange: setMealsPerDay
          },
          {
            title: 'Weekly Grocery Budget?',
            subtitle: 'Ingredient budget target',
            type: 'single',
            options: ['Cheap', 'Moderate', 'Any'],
            selected: budget,
            onChange: setBudget
          }
        ]
      : []),
    ...(planType === 'workouts' || planType === 'both'
      ? [
          {
            title: 'Workout days per week?',
            subtitle: 'Active training days (remaining will be Rest & Recovery)',
            type: 'number-chips',
            options: [2, 3, 4, 5, 6],
            selected: workoutDays,
            onChange: setWorkoutDays
          },
          {
            title: 'Available equipment?',
            subtitle: 'Training gear you have immediate access to',
            type: 'single',
            options: ['None', 'Dumbbells', 'Full gym'],
            selected: equipment,
            onChange: setEquipment
          },
          {
            title: 'Injuries or limitations?',
            subtitle: 'Specify any movements to avoid (optional)',
            type: 'text',
            value: injuries,
            onChange: setInjuries,
            placeholder: 'e.g. lower back pain, knee rehab'
          }
        ]
      : []),
    {
      title: 'Anything else you want to narrow this down?',
      subtitle: 'e.g. no eggs, no beef, 30-minute workouts.',
      type: 'text',
      value: narrowingText,
      onChange: setNarrowingText,
      placeholder: 'e.g. no eggs, no mushrooms'
    }
  ];

  const modalSteps = useMemo(() => {
    if (!selectedRecipeModal) return [];
    const { meal } = selectedRecipeModal;
    if (meal.rawInstructions && meal.rawInstructions.trim()) {
      return splitMealDbInstructions(meal.rawInstructions);
    }
    if (Array.isArray(meal.instructions) && meal.instructions.length > 0) {
      return meal.instructions;
    }
    return [];
  }, [selectedRecipeModal]);

  const modalIngredients = useMemo(() => {
    if (!selectedRecipeModal) return [];
    const { meal } = selectedRecipeModal;
    if (Array.isArray(meal.ingredientItems) && meal.ingredientItems.length > 0) {
      return meal.ingredientItems.map((item) => {
        const combined = item.measure && item.measure !== 'To taste'
          ? `${item.measure} ${item.ingredient}`.replace(/\s+/g, ' ').trim()
          : `${item.ingredient}${item.measure === 'To taste' ? ' (to taste)' : ''}`;
        return scaleIngredientText(combined, servingsScale);
      });
    }
    return (meal.ingredients || []).map((ing) => scaleIngredientText(ing, servingsScale));
  }, [selectedRecipeModal, servingsScale]);

  return (
    <div className="space-y-5 pb-20 max-w-md mx-auto">
      {errorMsg && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* INITIAL PROMPT: "Want us to plan your week?" */}
      {!cachedPlan && !declinedPlan && !isWizardOpen && !isGenerating && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 text-center shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto">
            <Utensils className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              Want us to plan your week?
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
              Build a 7-day plan using real recipes searched from TheMealDB matched to your{' '}
              {effectiveCalorieTarget} kcal daily target, with a relaxed comfort dinner on Sunday.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <button
              onClick={() => startWizard('meals')}
              className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200 transition-colors"
            >
              Plan my meals
            </button>
            <button
              onClick={() => startWizard('workouts')}
              className="p-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-xs font-semibold text-zinc-200 transition-colors"
            >
              Plan my workouts
            </button>
            <button
              onClick={() => startWizard('both')}
              className="col-span-2 p-3 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
            >
              <CalendarCheck className="w-4 h-4" />
              Generate Plan
            </button>
            <button
              onClick={() => setDeclinedPlan(true)}
              className="col-span-2 py-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      )}

      {/* NOT NOW SELECTED */}
      {!cachedPlan && declinedPlan && !isWizardOpen && !isGenerating && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 text-center shadow-xl space-y-3">
          <CalendarCheck className="w-8 h-8 text-zinc-600 mx-auto" />
          <p className="text-xs text-zinc-400">
            No plan yet. Tap here whenever you want one.
          </p>
          <button
            onClick={() => {
              setDeclinedPlan(false);
              startWizard('both');
            }}
            className="px-4 py-2 bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 text-xs font-semibold rounded-xl transition-colors"
          >
            Generate Plan
          </button>
        </div>
      )}

      {/* WIZARD MODAL */}
      {isWizardOpen && (
        <div className="bg-zinc-900/95 border border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[85dvh] overflow-hidden">
          <div className="flex items-center justify-between text-xs text-zinc-500 border-b border-zinc-800 pb-3 shrink-0">
            <span>
              Step {wizardStep + 1} of {wizardQuestions.length}
            </span>
            <button
              onClick={() => setIsWizardOpen(false)}
              className="text-zinc-400 hover:text-zinc-200 text-xs"
            >
              Cancel
            </button>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 pb-4 my-3 space-y-4">
            <div className="space-y-1">
              <h4 className="text-base font-semibold text-zinc-100">
                {wizardQuestions[wizardStep].title}
              </h4>
              <p className="text-xs text-zinc-400">
                {wizardQuestions[wizardStep].subtitle}
              </p>
            </div>

            <div className="min-h-[120px] flex flex-col justify-center">
              {wizardQuestions[wizardStep].type === 'multi' && (
                <div className="flex flex-wrap gap-2">
                  {wizardQuestions[wizardStep].options?.map((opt: any) => {
                    const isSel = (wizardQuestions[wizardStep].selected as string[]).includes(opt);
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => wizardQuestions[wizardStep].onChange(opt)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                          isSel
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {wizardQuestions[wizardStep].type === 'single' && (
                <div className="grid grid-cols-2 gap-2">
                  {wizardQuestions[wizardStep].options?.map((opt: any) => {
                    const isSel = wizardQuestions[wizardStep].selected === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => wizardQuestions[wizardStep].onChange(opt)}
                        className={`p-3 rounded-xl text-xs font-medium border transition-colors ${
                          isSel
                            ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>
              )}

              {wizardQuestions[wizardStep].type === 'number-chips' && (
                <div className="flex gap-2">
                  {wizardQuestions[wizardStep].options?.map((num: any) => {
                    const isSel = wizardQuestions[wizardStep].selected === num;
                    return (
                      <button
                        key={num}
                        type="button"
                        onClick={() => wizardQuestions[wizardStep].onChange(num)}
                        className={`flex-1 py-3 rounded-xl text-sm font-bold font-mono border transition-colors ${
                          isSel
                            ? 'bg-teal-500 text-zinc-950 border-teal-400'
                            : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                        }`}
                      >
                        {num}
                      </button>
                    );
                  })}
                </div>
              )}

              {wizardQuestions[wizardStep].type === 'text' && (
                <input
                  type="text"
                  value={wizardQuestions[wizardStep].value || ''}
                  onChange={(e) => {
                    const cb = wizardQuestions[wizardStep].onChange as (val: string) => void;
                    cb(e.target.value);
                  }}
                  placeholder={wizardQuestions[wizardStep].placeholder}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                />
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-800 shrink-0">
            {wizardStep > 0 ? (
              <button
                type="button"
                onClick={() => setWizardStep((s) => s - 1)}
                className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              {wizardStep < wizardQuestions.length - 1 && (
                <button
                  type="button"
                  onClick={() => setWizardStep((s) => s + 1)}
                  className="px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
              >
                <CalendarCheck className="w-4 h-4" />
                {isGenerating ? 'Searching TheMealDB...' : 'Generate Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GENERATING STATE */}
      {isGenerating && (
        <div className="space-y-4 animate-pulse" aria-label="Searching TheMealDB recipes">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="h-4 w-48 bg-zinc-800 rounded-lg" />
            <div className="h-3 w-64 bg-zinc-800/70 rounded-lg" />
            <div className="h-2 w-full bg-zinc-800 rounded-full" />
          </div>
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="h-4 w-36 bg-zinc-800 rounded-lg" />
            <div className="h-16 w-full bg-zinc-800/70 rounded-xl" />
            <div className="h-16 w-full bg-zinc-800/70 rounded-xl" />
            <div className="h-16 w-full bg-zinc-800/70 rounded-xl" />
          </div>
        </div>
      )}

      {/* PLAN TAB AFTER GENERATION */}
      {cachedPlan && !isGenerating && !isWizardOpen && (
        <div className="space-y-5">
          {/* #55 Alert when plan is older than 7 days */}
          {isPlanFromLastWeek && (
            <div className="bg-teal-950/40 border border-teal-500/40 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg">
              <div>
                <p className="text-xs font-semibold text-teal-200">
                  This plan is from last week. Regenerate?
                </p>
                <p className="text-[11px] text-teal-400/80 mt-0.5">
                  Refresh your meals and workouts for the upcoming week.
                </p>
              </div>
              <button
                type="button"
                onClick={() => startWizard(cachedPlan.type || 'both')}
                className="px-3 py-1.5 bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-bold rounded-xl transition-colors shrink-0 flex items-center gap-1 shadow-md shadow-teal-500/20"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Regenerate
              </button>
            </div>
          )}

          {/* Header controls: #52 Scale Servings, #50 Meal Prep Mode, #48 Smart Grocery List & Regenerate */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-800 rounded-xl px-2.5 py-1">
              <Users className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-[11px] text-zinc-400">Servings:</span>
              {([1, 2, 4] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setServingsScale(s)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold transition-colors ${
                    servingsScale === s
                      ? 'bg-teal-500 text-zinc-950'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {s}×
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowMealPrepMode(!showMealPrepMode)}
                className={`px-2.5 py-1.5 border rounded-xl text-xs flex items-center gap-1 transition-colors ${
                  showMealPrepMode
                    ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                }`}
              >
                <ChefHat className="w-3.5 h-3.5 text-teal-400" />
                Sunday Prep
              </button>

              <button
                type="button"
                onClick={() => setShowShoppingList(!showShoppingList)}
                className={`px-2.5 py-1.5 border rounded-xl text-xs flex items-center gap-1 transition-colors ${
                  showShoppingList
                    ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                    : 'bg-zinc-900 hover:bg-zinc-800 border-zinc-800 text-zinc-300'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 text-teal-400" />
                Groceries
              </button>

              <button
                type="button"
                onClick={() => startWizard(cachedPlan.type || 'both')}
                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-zinc-100 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Generate Plan"
              >
                <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                Generate Plan
              </button>
            </div>
          </div>

          {/* #49 BUDGET TRACKER CARD */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-4 shadow-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-teal-400" />
                <div>
                  <span className="text-xs font-semibold text-zinc-200 block">
                    Weekly Grocery Budget Tracker ({servingsScale}× Servings)
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Estimated cost:{' '}
                    <strong className="text-zinc-200 font-mono">${estimatedWeeklyCost}</strong> / $
                    {weeklyBudgetLimit} budget
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-zinc-500 font-mono">$</span>
                <input
                  type="number"
                  min="20"
                  max="1000"
                  value={weeklyBudgetLimit}
                  onChange={(e) => {
                    const v = Number(e.target.value) || 80;
                    setWeeklyBudgetLimit(v);
                    updateUserProfile({ weeklyBudget: v });
                  }}
                  className="w-16 bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono text-zinc-100 text-right"
                />
              </div>
            </div>
            <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  estimatedWeeklyCost > weeklyBudgetLimit ? 'bg-rose-500' : 'bg-teal-500'
                }`}
                style={{
                  width: `${Math.min(100, Math.round((estimatedWeeklyCost / (weeklyBudgetLimit || 1)) * 100))}%`
                }}
              />
            </div>
          </div>

          {/* #50 MEAL PREP MODE (Sunday Batch-Cook View) */}
          {showMealPrepMode && (
            <div className="bg-zinc-900/90 border border-teal-500/30 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-semibold text-teal-400">
                    Sunday Meal Prep Batch Guide
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">
                  For {servingsScale} person(s)
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Batch-cook these TheMealDB recipes on Sunday to streamline your week:
              </p>
              <div className="space-y-2">
                {sundayPrepBatches.map((batch, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="text-zinc-200 font-semibold block">{batch.name}</span>
                      <span className="text-[10px] text-zinc-500 capitalize">
                        {batch.mealType} · Prep time: {batch.prepTime}
                      </span>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-teal-300">
                      {batch.count} portions
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* #48 SMART GROCERY LIST */}
          {showShoppingList && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-semibold text-teal-400">
                  Smart Grocery List (Merged &amp; Scaled {servingsScale}×)
                </span>
                <span className="text-[11px] text-zinc-500">By Aisle</span>
              </div>

              {Object.entries(smartGroceryByAisle).map(([aisle, items]) => {
                if (!items || items.length === 0) return null;
                return (
                  <div key={aisle} className="space-y-1">
                    <span className="text-[11px] font-semibold text-zinc-300 capitalize block">
                      {aisle}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {items.map((ing, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-lg bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 font-mono"
                        >
                          {ing}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TODAY'S PLAN CARD */}
          {currentDayPlan && (
            <div className="bg-zinc-900/90 border border-teal-500/30 rounded-2xl p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <div>
                  <span className="text-[11px] font-medium text-teal-400 block">
                    Today&apos;s Schedule
                  </span>
                  <h3 className="text-base font-bold text-zinc-100">
                    {currentDayPlan.dayName}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono tabular-nums text-zinc-400 block">
                    {currentDayPlan.meals.reduce((s, m) => s + m.calories, 0)} kcal / person
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    Recipes from TheMealDB
                  </span>
                </div>
              </div>

              {/* Today's Meals */}
              {currentDayPlan.meals.length > 0 && (
                <div className="space-y-2.5">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Utensils className="w-3.5 h-3.5 text-teal-400" />
                    Planned Meals ({servingsScale}× Servings)
                  </span>

                  {currentDayPlan.meals.map((meal, mIdx) => {
                    const key = `${todayIndex}-${mIdx}-${meal.name}`;
                    const isLogged = loggedMealIds.has(key);
                    const isSwapping = swappingMealKey === `${todayIndex}-${mIdx}`;

                    if (meal.noMatchMessage) {
                      return (
                        <div
                          key={mIdx}
                          className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-1.5"
                        >
                          <div className="text-[10px] text-teal-400 font-medium capitalize">
                            {meal.mealType}
                          </div>
                          <p className="text-xs text-zinc-300 font-medium">{meal.name}</p>
                          <p className="text-[11px] text-zinc-400">{meal.noMatchMessage}</p>
                        </div>
                      );
                    }

                    return (
                      <div
                        key={mIdx}
                        onClick={() =>
                          setSelectedRecipeModal({ meal, dayIdx: todayIndex, mealIdx: mIdx })
                        }
                        className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2 cursor-pointer hover:border-zinc-700 transition-colors"
                      >
                        <div className="flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {meal.imageUrl && (
                              <img
                                src={meal.imageUrl}
                                alt={meal.name}
                                loading="lazy"
                                className="w-12 h-12 rounded-lg object-cover shrink-0 border border-zinc-800"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                <span className="text-teal-400 font-semibold capitalize">
                                  {meal.mealType}
                                </span>
                                {meal.category && (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <span>{meal.category}</span>
                                  </>
                                )}
                              </div>
                              <span className="text-xs font-medium text-zinc-100 block truncate">
                                {meal.name}
                              </span>
                              <div className="text-[10px] text-zinc-500 font-mono tabular-nums mt-0.5">
                                <span className="text-teal-400 font-semibold">
                                  {Math.round(meal.calories * servingsScale)} kcal
                                </span>
                                <span>
                                  {' '}
                                  · {Math.round(meal.protein * servingsScale)}p{' '}
                                  {Math.round(meal.carbs * servingsScale)}c{' '}
                                  {Math.round(meal.fat * servingsScale)}f
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSwapMeal(todayIndex, mIdx);
                              }}
                              disabled={isSwapping}
                              className="px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-teal-300 rounded-lg text-[11px] flex items-center gap-1 transition-colors disabled:opacity-50"
                              title="Swap with another TheMealDB recipe"
                            >
                              <RefreshCw className={`w-3 h-3 ${isSwapping ? 'animate-spin' : ''}`} />
                              Swap
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLogPlanMeal(meal, mIdx);
                              }}
                              disabled={isLogged}
                              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                                isLogged
                                  ? 'bg-zinc-800 text-teal-400 border border-teal-500/30'
                                  : 'bg-teal-500 hover:bg-teal-400 text-zinc-950 shadow-sm shadow-teal-500/20'
                              }`}
                            >
                              {isLogged ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Logged
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  Log
                                </>
                              )}
                            </button>
                          </div>
                        </div>

                        {meal.calorieNote && (
                          <p
                            className={`text-[11px] ${
                              meal.isSundayTreat ? 'text-amber-300' : 'text-zinc-400'
                            }`}
                          >
                            {meal.calorieNote}
                          </p>
                        )}

                        {meal.ingredients && meal.ingredients.length > 0 && (
                          <div className="text-[11px] text-zinc-400 pt-1.5 border-t border-zinc-900 truncate">
                            {meal.ingredients
                              .slice(0, 4)
                              .map((ing) => scaleIngredientText(ing, servingsScale))
                              .join(' · ')}
                            {meal.ingredients.length > 4
                              ? ` · +${meal.ingredients.length - 4} more`
                              : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Today's Workout */}
              {currentDayPlan.workout && (
                <div className="pt-2 border-t border-zinc-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Dumbbell className="w-3.5 h-3.5 text-teal-400" />
                      Planned Training
                    </span>
                    {!currentDayPlan.workout.isRest && (
                      <button
                        type="button"
                        onClick={() => handleLogPlanWorkout(todayIndex)}
                        disabled={loggedWorkoutDays.has(todayIndex)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors ${
                          loggedWorkoutDays.has(todayIndex)
                            ? 'bg-zinc-800 text-teal-400'
                            : 'bg-teal-500 hover:bg-teal-400 text-zinc-950'
                        }`}
                      >
                        {loggedWorkoutDays.has(todayIndex) ? 'Logged' : 'Log Workout'}
                      </button>
                    )}
                  </div>

                  <div className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl">
                    <span className="text-xs font-medium text-zinc-200 block">
                      {currentDayPlan.workout.name}
                    </span>
                    {currentDayPlan.workout.isRest ? (
                      <span className="text-[11px] text-zinc-500 mt-1 block">
                        Full rest &amp; recovery day. Focus on hydration and mobility.
                      </span>
                    ) : (
                      <div className="mt-2 space-y-1">
                        {currentDayPlan.workout.exercises.map((ex, eIdx) => (
                          <div key={eIdx} className="text-[11px] text-zinc-400 flex justify-between">
                            <span>{ex.name}</span>
                            <span className="font-mono text-zinc-500">{ex.setsAndReps}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* "THIS WEEK" EXPANDABLE SECTION */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold text-zinc-200">
                7-Day Schedule (Monday – Sunday)
              </h4>
              <span className="text-[11px] text-zinc-500">Recipe from TheMealDB</span>
            </div>

            <div className="space-y-2">
              {cachedPlan.days.map((day, dIdx) => {
                const isExpanded = expandedDay === dIdx;
                const dayKcal = day.meals.reduce((s, m) => s + m.calories, 0);
                const hasSundayTreat = day.meals.some((m) => m.isSundayTreat);

                return (
                  <div
                    key={dIdx}
                    className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/60"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedDay(isExpanded ? null : dIdx)}
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-zinc-900/60 transition-colors"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-xs text-zinc-100">
                          {day.dayName}
                        </span>
                        {hasSundayTreat && (
                          <span className="text-[11px] text-amber-300/90 truncate">
                            · Sunday treat
                          </span>
                        )}
                        {day.workout && !hasSundayTreat && (
                          <span className="text-[11px] text-zinc-500 truncate">
                            · {day.workout.isRest ? 'Rest' : day.workout.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono tabular-nums text-zinc-400 shrink-0">
                        <span>{dayKcal} kcal</span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 border-t border-zinc-800/80 space-y-2 bg-zinc-900/30">
                        {day.meals.map((meal, mIdx) => {
                          const isSwapping = swappingMealKey === `${dIdx}-${mIdx}`;

                          if (meal.noMatchMessage) {
                            return (
                              <div
                                key={mIdx}
                                className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs space-y-1"
                              >
                                <span className="text-[10px] text-teal-400 capitalize block">
                                  {meal.mealType}
                                </span>
                                <span className="text-zinc-300 font-medium block">{meal.name}</span>
                                <span className="text-[11px] text-zinc-400 block">
                                  {meal.noMatchMessage}
                                </span>
                              </div>
                            );
                          }

                          return (
                            <div
                              key={mIdx}
                              onClick={() =>
                                setSelectedRecipeModal({ meal, dayIdx: dIdx, mealIdx: mIdx })
                              }
                              className="p-2.5 rounded-lg bg-zinc-950 border border-zinc-800/80 space-y-1.5 text-xs cursor-pointer hover:border-zinc-700 transition-colors"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  {meal.imageUrl && (
                                    <img
                                      src={meal.imageUrl}
                                      alt={meal.name}
                                      loading="lazy"
                                      className="w-10 h-10 rounded-md object-cover shrink-0 border border-zinc-800"
                                    />
                                  )}
                                  <div className="truncate pr-1">
                                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                                      <span className="text-teal-400 font-semibold capitalize">
                                        {meal.mealType}
                                      </span>
                                      {meal.category && (
                                        <>
                                          <span aria-hidden="true">·</span>
                                          <span>{meal.category}</span>
                                        </>
                                      )}
                                    </div>
                                    <span className="text-zinc-100 font-medium block truncate">
                                      {meal.name}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="font-mono tabular-nums text-zinc-400">
                                    {Math.round(meal.calories * servingsScale)} kcal
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleSwapMeal(dIdx, mIdx);
                                    }}
                                    disabled={isSwapping}
                                    className="px-2 py-1 rounded bg-zinc-900 text-zinc-400 hover:text-teal-300 flex items-center gap-1 text-[10px] disabled:opacity-50"
                                    title="Swap with another TheMealDB recipe"
                                  >
                                    <RefreshCw
                                      className={`w-3 h-3 ${isSwapping ? 'animate-spin' : ''}`}
                                    />
                                    Swap
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleLogPlanMeal(meal, mIdx, dIdx);
                                    }}
                                    disabled={loggedMealIds.has(`${dIdx}-${mIdx}-${meal.name}`)}
                                    className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 transition-colors ${
                                      loggedMealIds.has(`${dIdx}-${mIdx}-${meal.name}`)
                                        ? 'bg-zinc-800 text-teal-400 border border-teal-500/30'
                                        : 'bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold'
                                    }`}
                                  >
                                    {loggedMealIds.has(`${dIdx}-${mIdx}-${meal.name}`) ? (
                                      <>
                                        <CheckCircle2 className="w-3 h-3" />
                                        Logged
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="w-3 h-3" />
                                        Log
                                      </>
                                    )}
                                  </button>
                                </div>
                              </div>

                              {meal.calorieNote && (
                                <p
                                  className={`text-[11px] ${
                                    meal.isSundayTreat ? 'text-amber-300' : 'text-zinc-400'
                                  }`}
                                >
                                  {meal.calorieNote}
                                </p>
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
          </div>
        </div>
      )}

      {/* Recipe Detail Modal */}
      {selectedRecipeModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={selectedRecipeModal.meal.name}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center overflow-hidden h-[100dvh]"
          onClick={() => setSelectedRecipeModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-w-lg w-full h-[90dvh] sm:h-auto sm:max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden"
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-start justify-between gap-3 shrink-0">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-400">
                  <span className="text-teal-400 font-semibold capitalize">
                    {selectedRecipeModal.meal.mealType}
                  </span>
                  {selectedRecipeModal.meal.category && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{selectedRecipeModal.meal.category}</span>
                    </>
                  )}
                  {selectedRecipeModal.meal.area && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{selectedRecipeModal.meal.area}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{selectedRecipeModal.meal.sourceAttribution || 'Recipe from TheMealDB'}</span>
                </div>
                <h3 className="text-base font-bold text-zinc-100 mt-0.5 leading-snug">
                  {selectedRecipeModal.meal.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecipeModal(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors shrink-0"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body (Scrollable) */}
            <div className="p-4 overflow-y-auto flex-1 space-y-4 pb-[100px]">
              {/* Recipe Image (TheMealDB Thumbnail) */}
              {selectedRecipeModal.meal.imageUrl && (
                <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950">
                  <img
                    src={selectedRecipeModal.meal.imageUrl}
                    alt={selectedRecipeModal.meal.name}
                    className="w-full h-52 object-cover"
                  />
                </div>
              )}

              {/* Sunday Treat or Calorie Note */}
              {selectedRecipeModal.meal.calorieNote && (
                <div
                  className={`p-3 rounded-xl border text-xs ${
                    selectedRecipeModal.meal.isSundayTreat
                      ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-300'
                  }`}
                >
                  {selectedRecipeModal.meal.calorieNote}
                </div>
              )}

              {/* Prep / Cook Time & Servings */}
              <div className="grid grid-cols-3 gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-center font-mono text-xs">
                <div>
                  <span className="text-[10px] text-zinc-500 block">Prep Time</span>
                  <span className="font-semibold text-zinc-200">
                    {selectedRecipeModal.meal.prepTime || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">Cook Time</span>
                  <span className="font-semibold text-zinc-200">
                    {selectedRecipeModal.meal.cookTime || 'Not specified'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 block">Servings</span>
                  <span className="font-semibold text-teal-400">
                    {servingsScale} serving{servingsScale > 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Macros & Calories */}
              <div className="grid grid-cols-4 gap-2 bg-zinc-950 p-3 rounded-xl border border-zinc-800 text-center font-mono tabular-nums">
                <div>
                  <span className="text-[10px] text-zinc-500 block">Calories</span>
                  <span className="text-xs font-bold text-teal-400">
                    {Math.round(selectedRecipeModal.meal.calories * servingsScale)} kcal
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-teal-400 block">Protein</span>
                  <span className="text-xs font-bold text-teal-300">
                    {Math.round(selectedRecipeModal.meal.protein * servingsScale)}g
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-blue-400 block">Carbs</span>
                  <span className="text-xs font-bold text-blue-300">
                    {Math.round(selectedRecipeModal.meal.carbs * servingsScale)}g
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-amber-400 block">Fat</span>
                  <span className="text-xs font-bold text-amber-300">
                    {Math.round(selectedRecipeModal.meal.fat * servingsScale)}g
                  </span>
                </div>
              </div>

              {/* Full Ingredient List with Measurements */}
              <div className="space-y-2 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-teal-400" />
                  <span>Ingredients &amp; Measurements</span>
                </h4>
                <ul className="space-y-1.5 text-xs text-zinc-300 font-mono">
                  {modalIngredients.length > 0 ? (
                    modalIngredients.map((ing, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 bg-zinc-900/60 p-2 rounded-lg border border-zinc-800/80"
                      >
                        <span className="text-teal-400 font-bold">·</span>
                        <span>{ing}</span>
                      </li>
                    ))
                  ) : (
                    <li className="text-zinc-500 italic text-[11px]">No ingredients listed.</li>
                  )}
                </ul>
              </div>

              {/* Numbered Cooking Steps from TheMealDB */}
              <div className="space-y-2 bg-zinc-950 p-3.5 rounded-xl border border-zinc-800">
                <h4 className="text-xs font-semibold text-zinc-200 flex items-center gap-1.5">
                  <ChefHat className="w-3.5 h-3.5 text-teal-400" />
                  <span>Cooking Steps</span>
                </h4>
                {modalSteps.length > 0 ? (
                  <ol className="space-y-2.5 text-xs text-zinc-300">
                    {modalSteps.map((step, sIdx) => (
                      <li
                        key={sIdx}
                        className="flex items-start gap-2.5 bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-800/80"
                      >
                        <span className="shrink-0 w-5 h-5 rounded-full bg-teal-500/20 text-teal-300 font-mono font-bold text-[10px] flex items-center justify-center border border-teal-500/40">
                          {sIdx + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-xs text-zinc-500">Not specified by TheMealDB.</p>
                )}
              </div>

              {/* Source Attribution Footer */}
              <div className="pt-1 flex items-center justify-between text-[11px] text-zinc-500">
                <span>
                  {selectedRecipeModal.meal.sourceAttribution || 'Recipe from TheMealDB'}
                </span>
                {(selectedRecipeModal.meal.mealDbId || selectedRecipeModal.meal.idMeal) && (
                  <span className="font-mono">
                    Meal ID #{selectedRecipeModal.meal.mealDbId || selectedRecipeModal.meal.idMeal}
                  </span>
                )}
              </div>
            </div>

            {/* Toast Notification */}
            {recipeToast && (
              <div className="absolute top-16 left-4 right-4 bg-teal-950 border border-teal-500/50 text-teal-300 text-xs p-3 rounded-xl shadow-lg z-20 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                <span>{recipeToast}</span>
              </div>
            )}

            {/* Sticky Bottom Log Button */}
            <div className="sticky bottom-0 left-0 right-0 p-3 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 shrink-0 z-10 flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  const { meal, dayIdx, mealIdx } = selectedRecipeModal;
                  await handleLogPlanMeal(meal, mealIdx, dayIdx);
                  setRecipeToast(`Logged "${meal.name}" to ${meal.mealType}!`);
                  setTimeout(() => {
                    setRecipeToast(null);
                    setSelectedRecipeModal(null);
                  }, 1500);
                }}
                className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Log to {selectedRecipeModal.meal.mealType}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
