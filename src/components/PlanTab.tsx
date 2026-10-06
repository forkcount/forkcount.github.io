import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarCheck,
  Sparkles,
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
  Users
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Wizard Questions state
  const [restrictions, setRestrictions] = useState<string[]>([]);
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
    async function loadPlan() {
      try {
        const res = await api.getPlan();
        if (res.plan) {
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
    setIsWizardOpen(true);
    setWizardStep(0);
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setIsWizardOpen(false);
    setErrorMsg(null);

    try {
      const res = await api.generatePlan({
        type: planType,
        dailyTargetCalories: macroTarget.calories,
        dailyTargetCarbs: macroTarget.carbsGrams,
        dailyTargetFat: macroTarget.fatGrams,
        dailyTargetProtein: macroTarget.proteinGrams,
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
      setErrorMsg(err.message || 'Could not generate plan');
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

  const handleLogPlanMeal = async (meal: PlanDayMeal, mealIndex: number) => {
    const key = `${todayIndex}-${mealIndex}-${meal.name}`;
    if (loggedMealIds.has(key)) return;

    await addFoodItem({
      date: activeDate,
      mealType: meal.mealType,
      name: meal.name,
      calories: meal.calories,
      carbs: meal.carbs,
      fat: meal.fat,
      protein: meal.protein,
      serving: '1 meal portion',
      source: 'plan'
    });

    setLoggedMealIds(prev => new Set([...prev, key]));
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

    setLoggedWorkoutDays(prev => new Set([...prev, dayIndex]));
  };

  // #51 Swap a meal — one tap on any planned meal replaces it with another fitting the same macros
  const handleSwapMeal = (dayIdx: number, mealIdx: number) => {
    if (!cachedPlan) return;
    const day = cachedPlan.days[dayIdx];
    const oldMeal = day.meals[mealIdx];

    const alternatives = [
      {
        name: 'Grilled Herb Chicken & Sweet Potato',
        ingredients: ['180g chicken breast', '200g sweet potato', '10ml olive oil', '100g broccoli'],
        carbs: oldMeal.carbs,
        fat: oldMeal.fat,
        protein: oldMeal.protein,
        aisle: 'meat' as const,
        costEstimate: 4.5
      },
      {
        name: 'Pan-Seared Salmon & Quinoa Bowl',
        ingredients: ['160g salmon fillet', '150g cooked quinoa', '80g spinach', '1 lemon'],
        carbs: oldMeal.carbs,
        fat: oldMeal.fat,
        protein: oldMeal.protein,
        aisle: 'meat' as const,
        costEstimate: 5.8
      },
      {
        name: 'Crispy Tempeh & Brown Rice Stir-fry',
        ingredients: ['150g tempeh', '160g brown rice', '120g mixed bell peppers', '15ml soy sauce'],
        carbs: oldMeal.carbs,
        fat: oldMeal.fat,
        protein: oldMeal.protein,
        aisle: 'produce' as const,
        costEstimate: 3.6
      },
      {
        name: 'Turkey Breast & Roasted Mediterranean Vegetables',
        ingredients: ['175g turkey breast', '150g zucchini', '100g cherry tomatoes', '10ml olive oil'],
        carbs: oldMeal.carbs,
        fat: oldMeal.fat,
        protein: oldMeal.protein,
        aisle: 'meat' as const,
        costEstimate: 4.2
      },
      {
        name: 'Greek Yogurt Berry Protein Parfait',
        ingredients: ['220g Greek yogurt', '80g mixed berries', '40g rolled oats', '15g almonds'],
        carbs: oldMeal.carbs,
        fat: oldMeal.fat,
        protein: oldMeal.protein,
        aisle: 'dairy' as const,
        costEstimate: 3.2
      }
    ];

    const seed = (dayIdx + mealIdx + oldMeal.name.length) % alternatives.length;
    const alt = alternatives[seed].name === oldMeal.name
      ? alternatives[(seed + 1) % alternatives.length]
      : alternatives[seed];

    const updatedMeals = [...day.meals];
    updatedMeals[mealIdx] = {
      ...oldMeal,
      name: alt.name,
      ingredients: alt.ingredients,
      carbs: alt.carbs,
      fat: alt.fat,
      protein: alt.protein,
      aisle: alt.aisle,
      costEstimate: alt.costEstimate
    };

    const updatedDays = [...cachedPlan.days];
    updatedDays[dayIdx] = { ...day, meals: updatedMeals };
    const newPlan = { ...cachedPlan, days: updatedDays };
    setCachedPlan(newPlan);
    api.savePlan(newPlan);
  };

  // #52 Helper to scale an ingredient string by servingsScale (1, 2, or 4)
  const scaleIngredientText = (raw: string, scale: number): string => {
    if (scale === 1) return raw;
    const match = raw.match(/^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|oz|tbsp|tsp|cup|cups|slice|slices|large|medium|small)?\s+(.*)$/i);
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
    const aisles: Record<string, Map<string, { name: string; totalGrams: number; totalCount: number; unit: string }>> = {
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
      formatted[aisle] = Array.from(map.values()).map(item => {
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
        if (meal.costEstimate) {
          baseSum += meal.costEstimate;
        } else {
          // Estimate based on meal calories and budget preference
          const perMeal = cachedPlan.preferences?.budget === 'Cheap' ? 2.8 : 4.1;
          baseSum += perMeal;
        }
      }
    }
    // Scale by servings (with bulk efficiency factor)
    const scaleFactor = servingsScale === 1 ? 1 : servingsScale === 2 ? 1.85 : 3.5;
    return Math.round(baseSum * scaleFactor);
  }, [cachedPlan, servingsScale]);

  // #50 Meal Prep Mode — Sunday batch-cook tasks for the week
  const sundayPrepBatches = useMemo(() => {
    if (!cachedPlan) return [];
    const mealCounts = new Map<string, { name: string; count: number; mealType: string; prepTime: string; totalCalories: number }>();
    for (const day of cachedPlan.days) {
      for (const meal of day.meals) {
        const key = meal.name;
        const ex = mealCounts.get(key);
        if (ex) {
          ex.count += servingsScale;
        } else {
          mealCounts.set(key, {
            name: meal.name,
            count: servingsScale,
            mealType: meal.mealType,
            prepTime: meal.prepTime || '20 min',
            totalCalories: meal.calories
          });
        }
      }
    }
    return Array.from(mealCounts.values()).slice(0, 8);
  }, [cachedPlan, servingsScale]);

  const wizardQuestions = [
    ...(planType === 'meals' || planType === 'both' ? [
      {
        title: "Anything you won't eat?",
        subtitle: "Select any dietary principles you follow",
        type: "multi",
        options: ['Vegetarian', 'Vegan', 'Pescatarian', 'Halal', 'Kosher', 'No pork', 'No beef', 'No seafood', 'None'],
        selected: restrictions,
        onChange: (opt: string) => {
          if (opt === 'None') {
            setRestrictions([]);
          } else {
            setRestrictions(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev.filter(x => x !== 'None'), opt]);
          }
        }
      },
      {
        title: "Any allergies?",
        subtitle: "Strictly eliminated from your generated plan",
        type: "multi",
        options: ['Nuts', 'Dairy', 'Gluten', 'Eggs', 'Soy', 'Shellfish', 'None'],
        selected: allergies,
        onChange: (opt: string) => {
          if (opt === 'None') {
            setAllergies([]);
          } else {
            setAllergies(prev => prev.includes(opt) ? prev.filter(x => x !== opt) : [...prev.filter(x => x !== 'None'), opt]);
          }
        }
      },
      {
        title: "How long to cook?",
        subtitle: "Target maximum kitchen preparation time",
        type: "single",
        options: ['Under 15 min', '15–30 min', '30–60 min', 'Any'],
        selected: cookTime,
        onChange: setCookTime
      },
      {
        title: "Meals per day?",
        subtitle: "How many meals to divide your daily calories across",
        type: "number-chips",
        options: [3, 4, 5],
        selected: mealsPerDay,
        onChange: setMealsPerDay
      },
      {
        title: "Weekly Grocery Budget?",
        subtitle: "Ingredient complexity and sourcing target",
        type: "single",
        options: ['Cheap', 'Moderate', 'Any'],
        selected: budget,
        onChange: setBudget
      }
    ] : []),
    ...(planType === 'workouts' || planType === 'both' ? [
      {
        title: "Workout days per week?",
        subtitle: "Active training days (remaining will be Rest & Recovery)",
        type: "number-chips",
        options: [2, 3, 4, 5, 6],
        selected: workoutDays,
        onChange: setWorkoutDays
      },
      {
        title: "Available equipment?",
        subtitle: "Training gear you have immediate access to",
        type: "single",
        options: ['None', 'Dumbbells', 'Full gym'],
        selected: equipment,
        onChange: setEquipment
      },
      {
        title: "Injuries or limitations?",
        subtitle: "Specify any movements to avoid (optional)",
        type: "text",
        value: injuries,
        onChange: setInjuries,
        placeholder: "e.g. lower back pain, knee rehab"
      }
    ] : []),
    {
      title: "Anything else you want to narrow this down?",
      subtitle: "e.g. high protein, low carb, no eggs, 30-minute workouts.",
      type: "text",
      value: narrowingText,
      onChange: setNarrowingText,
      placeholder: "e.g. high protein, low carb, no eggs, 30-minute workouts"
    }
  ];

  return (
    <div className="space-y-5 pb-8 max-w-md mx-auto">
      {errorMsg && (
        <div className="p-3 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300">
          {errorMsg}
        </div>
      )}

      {/* INITIAL PROMPT: "Want us to plan your week?" */}
      {!cachedPlan && !declinedPlan && !isWizardOpen && (
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-6 text-center shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto">
            <Sparkles className="w-6 h-6" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-zinc-100">
              Want us to plan your week?
            </h3>
            <p className="text-xs text-zinc-400 mt-1 max-w-xs mx-auto leading-relaxed">
              We&apos;ll generate a tailored 7-day schedule hitting your {macroTarget.calories} kcal goal within 5%.
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
              <Sparkles className="w-4 h-4" />
              Plan both
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
      {!cachedPlan && declinedPlan && !isWizardOpen && (
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
            Create 7-Day Plan
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

          <div className="flex items-center justify-between pt-3 border-t border-zinc-800 shrink-0">
            {wizardStep > 0 ? (
              <button
                onClick={() => setWizardStep(s => s - 1)}
                className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>
            ) : (
              <div />
            )}

            {wizardStep < wizardQuestions.length - 1 ? (
              <button
                onClick={() => setWizardStep(s => s + 1)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-xl flex items-center gap-1 transition-colors"
              >
                Skip / Next
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
              >
                <Sparkles className="w-4 h-4" />
                {isGenerating ? 'Calculating...' : 'Generate 7-Day Plan'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* GENERATING STATE (#13 grey shimmer placeholder the shape of the content) */}
      {isGenerating && (
        <div className="space-y-4 animate-pulse" aria-label="Loading weekly plan">
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="h-4 w-44 bg-zinc-800 rounded-lg" />
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
      {cachedPlan && !isGenerating && (
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
            {/* #52 Scale servings selector (1, 2, 4) */}
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
                title="Regenerate week"
              >
                <RefreshCw className="w-3.5 h-3.5 text-teal-400" />
                Regenerate week
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
                    Estimated cost: <strong className="text-zinc-200 font-mono">${estimatedWeeklyCost}</strong> / ${weeklyBudgetLimit} budget
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
                style={{ width: `${Math.min(100, Math.round((estimatedWeeklyCost / (weeklyBudgetLimit || 1)) * 100))}%` }}
              />
            </div>
          </div>

          {/* #50 MEAL PREP MODE (Sunday Batch-Cook View) */}
          {showMealPrepMode && (
            <div className="bg-zinc-900/90 border border-teal-500/30 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <ChefHat className="w-4 h-4 text-teal-400" />
                  <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                    Sunday Meal Prep Batch Guide
                  </span>
                </div>
                <span className="text-[11px] font-mono text-zinc-400">For {servingsScale} person(s)</span>
              </div>
              <p className="text-xs text-zinc-400">
                Batch-cook these core components on Sunday to assemble your week&apos;s meals in under 10 minutes:
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
                    <span className="px-2 py-1 rounded-lg bg-teal-500/15 border border-teal-500/30 text-teal-300 font-mono text-[11px] font-bold">
                      Prep {batch.count} portions
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* #48 SMART GROCERY LIST (Merges duplicate ingredients & groups by aisle) */}
          {showShoppingList && (
            <div className="bg-zinc-900/90 border border-zinc-800 rounded-2xl p-5 shadow-xl space-y-3">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                  Smart Grocery List (Merged &amp; Scaled {servingsScale}×)
                </span>
                <span className="text-[11px] text-zinc-500">By Aisle</span>
              </div>

              {Object.entries(smartGroceryByAisle).map(([aisle, items]) => {
                if (!items || items.length === 0) return null;
                return (
                  <div key={aisle} className="space-y-1">
                    <span className="text-[11px] font-bold text-zinc-300 capitalize tracking-wide block">
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
                  <span className="text-[10px] font-bold text-teal-400 uppercase tracking-wider block">
                    Today&apos;s Schedule
                  </span>
                  <h3 className="text-base font-bold text-zinc-100">
                    {currentDayPlan.dayName}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono text-zinc-400">
                    {currentDayPlan.meals.reduce((s, m) => s + m.calories, 0)} kcal / person
                  </span>
                </div>
              </div>

              {/* Today's Meals */}
              <div className="space-y-2.5">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-teal-400" />
                  Planned Meals ({servingsScale}× Servings)
                </span>

                {currentDayPlan.meals.map((meal, mIdx) => {
                  const key = `${todayIndex}-${mIdx}-${meal.name}`;
                  const isLogged = loggedMealIds.has(key);

                  return (
                    <div
                      key={mIdx}
                      className="p-3 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="max-w-[65%]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-teal-400 font-medium uppercase">
                              {meal.mealType}
                            </span>
                            <span className="text-[10px] text-zinc-500">· {meal.prepTime}</span>
                          </div>
                          <span className="text-xs font-medium text-zinc-200 block truncate">
                            {meal.name}
                          </span>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            <span className="text-teal-400 font-semibold">{meal.calories} kcal</span>
                            <span> · {meal.protein}p {meal.carbs}c {meal.fat}f</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {/* #51 Swap a meal */}
                          <button
                            type="button"
                            onClick={() => handleSwapMeal(todayIndex, mIdx)}
                            className="px-2 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-teal-300 rounded-lg text-[11px] flex items-center gap-1 transition-colors"
                            title="Swap meal with another matching macros"
                          >
                            <RefreshCw className="w-3 h-3" />
                            Swap
                          </button>

                          <button
                            type="button"
                            onClick={() => handleLogPlanMeal(meal, mIdx)}
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

                      {/* #52 Scaled ingredients preview */}
                      {meal.ingredients && meal.ingredients.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1 border-t border-zinc-900">
                          {meal.ingredients.map((ing, iIdx) => (
                            <span
                              key={iIdx}
                              className="px-1.5 py-0.5 rounded bg-zinc-900 text-[10px] text-zinc-400 font-mono"
                            >
                              {scaleIngredientText(ing, servingsScale)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

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
            <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
              This Week Overview
            </h4>

            <div className="space-y-2">
              {cachedPlan.days.map((day, dIdx) => {
                const isExpanded = expandedDay === dIdx;
                const dayKcal = day.meals.reduce((s, m) => s + m.calories, 0);

                return (
                  <div
                    key={dIdx}
                    className="border border-zinc-800/80 rounded-xl overflow-hidden bg-zinc-950/60"
                  >
                    <button
                      onClick={() => setExpandedDay(isExpanded ? null : dIdx)}
                      className="w-full p-3 flex items-center justify-between text-left hover:bg-zinc-850/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-zinc-200">
                          {day.dayName}
                        </span>
                        {day.workout && (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-900 text-teal-400 border border-zinc-800">
                            {day.workout.isRest ? 'Rest' : day.workout.name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                        <span>{dayKcal} kcal</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 border-t border-zinc-800/80 space-y-2 bg-zinc-900/30">
                        {day.meals.map((meal, mIdx) => (
                          <div
                            key={mIdx}
                            className="p-2 rounded-lg bg-zinc-950 border border-zinc-850 flex items-center justify-between text-xs"
                          >
                            <div className="truncate pr-2">
                              <span className="text-[10px] text-teal-400 block uppercase">
                                {meal.mealType}
                              </span>
                              <span className="text-zinc-200 font-medium block truncate">
                                {meal.name}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="font-mono text-zinc-400">{meal.calories} kcal</span>
                              <button
                                onClick={() => handleSwapMeal(dIdx, mIdx)}
                                className="px-2 py-1 rounded bg-zinc-900 text-zinc-400 hover:text-teal-300 flex items-center gap-1 text-[10px]"
                                title="Swap meal"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Swap
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
