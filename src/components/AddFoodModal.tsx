import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Trash2,
  Search,
  Scan,
  Bookmark,
  Check,
  Sparkles,
  HelpCircle,
  RefreshCw,
  ShoppingBag,
  Mic,
  Camera,
  Utensils,
  Ruler,
  AlertTriangle,
  Pencil,
  MicOff
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import { trackEventOnce } from '../utils/analytics.js';
import { BarcodeScannerModal } from './BarcodeScannerModal.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { SwipeableItem } from './SwipeableItem.js';
import { SafeImage } from './SafeImage.js';
import { decipherFoodText, recalculateDecipheredFoodWithGrams } from '../utils/localAiEngine.js';
import {
  useDebounce,
  validateSingleFoodCalories,
  validateSingleFoodWeightGrams,
  validateSingleFoodWeightText,
  findRecentDuplicateFood
} from '../utils/validation.js';
import type { MealType, SavedFood, SavedRecipe } from '../types/index.js';

interface AddFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMeal: MealType;
}

type ModeTab = 'smart' | 'manual' | 'recipe' | 'packaged' | 'ai';

interface IngredientRow {
  id: string;
  raw: string;
  name: string;
  amount: number;
  unit: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  isVague: boolean;
  vaguePrompt?: string;
  vagueSuggestions?: string[];
  isParsed: boolean;
}

export const AddFoodModal: React.FC<AddFoodModalProps> = ({ isOpen, onClose, defaultMeal }) => {
  const {
    activeDate,
    diaryItems,
    allDiaryItems,
    addFoodItem,
    macroTarget,
    lastSelectedMeal,
    setLastSelectedMeal,
    isGuest,
    openGuestLock,
    guestAiUsed,
    consumeGuestAiCall,
    isOnline
  } = useApp();
  const [mealType, setMealType] = useState<MealType>(defaultMeal || lastSelectedMeal);
  const [activeTab, setActiveTab] = useState<ModeTab>('smart');
  const [isSavingSmart, setIsSavingSmart] = useState(false);

  // #11 Duplicate food confirmation state
  const [pendingDuplicatePayload, setPendingDuplicatePayload] = useState<{
    name: string;
    calories: number;
    carbs: number;
    fat: number;
    protein: number;
    fiber?: number;
    sugar?: number;
    sodium?: number;
    serving?: string;
    note?: string;
    unusualQuantity?: boolean;
    source: 'manual' | 'recipe' | 'usda' | 'saved' | 'voice' | 'photo' | 'restaurant';
    closeAfter?: boolean;
  } | null>(null);

  // #25 Last 5 foods logged by this user for one-tap re-adding
  const recentFiveFoods = useMemo(() => {
    const seen = new Set<string>();
    const sorted = [...allDiaryItems].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    const list: Array<{
      id: string;
      name: string;
      calories: number;
      carbs: number;
      fat: number;
      protein: number;
      serving: string;
    }> = [];
    for (const item of sorted) {
      const key = `${item.name.toLowerCase().trim()}_${item.calories}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push({
        id: item.id,
        name: item.name,
        calories: item.calories,
        carbs: item.carbs,
        fat: item.fat,
        protein: item.protein,
        serving: item.serving || '1 portion'
      });
      if (list.length >= 5) break;
    }
    return list;
  }, [allDiaryItems]);

  // Smart Food Decipherer State (In-Code AI) — #16 Draft save for AI logs + #15 Debounce
  const [smartFoodText, setSmartFoodText] = useState(() => {
    return localStorage.getItem('forkcount_draft_smart_food') || localStorage.getItem('caloriq_draft_smart_food') || '';
  });
  const debouncedSmartFoodText = useDebounce(smartFoodText, 400);
  const [gramOverrides, setGramOverrides] = useState<Record<number, number>>({});
  const [editingWeightIndices, setEditingWeightIndices] = useState<Record<number, boolean>>({});
  const [confirmedOver5kgIndices, setConfirmedOver5kgIndices] = useState<Record<number, number>>({});
  const [confirmedOver5000Kcal, setConfirmedOver5000Kcal] = useState<boolean>(false);

  const [userServingsEaten, setUserServingsEaten] = useState<string>('1');
  const [isRecording, setIsRecording] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const [scannedMenuDishes, setScannedMenuDishes] = useState<Array<{
    name: string;
    calories: number;
    carbs: number;
    fat: number;
    protein: number;
    fitScore: 'green' | 'amber' | 'red';
    fitLabel: string;
    adjustedScale: number;
  }>>([]);
  const [isScanningMenu, setIsScanningMenu] = useState(false);
  const [menuPhotosCount, setMenuImagesCount] = useState(0);

  const { profile } = useApp();
  const totalCaloriesLoggedToday = diaryItems.reduce((acc, item) => acc + item.calories, 0);
  const remainingCaloriesToday = Math.max(0, macroTarget.calories - totalCaloriesLoggedToday);

  const SpeechRecognition =
    typeof window !== 'undefined' ? ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition) : null;

  const handleStartSpeech = () => {
    if (!SpeechRecognition) return;
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onstart = () => {
      setIsRecording(true);
      setSpeechError(null);
    };

    rec.onresult = (event: any) => {
      const resultText = event.results[0][0].transcript;
      setSmartFoodText((prev) => (prev ? `${prev}, ${resultText}` : resultText));
    };

    rec.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setSpeechError(event.error);
      setIsRecording(false);
    };

    rec.onend = () => {
      setIsRecording(false);
    };

    rec.start();
  };

  const calculateMenuDishFit = (
    dishKcal: number,
    remainingKcal: number,
    goal?: string
  ): { fitScore: 'green' | 'amber' | 'red'; fitLabel: string } => {
    if (dishKcal > remainingKcal) {
      return { fitScore: 'red', fitLabel: 'Exceeds remaining daily target' };
    }
    if (goal === 'lose') {
      if (dishKcal < 500) {
        return { fitScore: 'green', fitLabel: 'Excellent low-calorie option' };
      } else if (dishKcal < 750) {
        return { fitScore: 'amber', fitLabel: 'Moderate fit for weight loss' };
      } else {
        return { fitScore: 'red', fitLabel: 'High calorie for loss goal' };
      }
    } else if (goal === 'gain') {
      if (dishKcal > 600) {
        return { fitScore: 'green', fitLabel: 'Great calorie dense option' };
      } else {
        return { fitScore: 'amber', fitLabel: 'Light calories for gaining' };
      }
    } else {
      if (dishKcal < 650) {
        return { fitScore: 'green', fitLabel: 'Perfect calorie fit' };
      } else {
        return { fitScore: 'amber', fitLabel: 'Slightly high calorie portion' };
      }
    }
  };

  const RESTUARANT_DISHES_POOL = [
    { name: 'Grilled Salmon with Asparagus', calories: 480, carbs: 12, fat: 28, protein: 42 },
    { name: 'Teriyaki Chicken Bowl with Broccoli', calories: 650, carbs: 68, fat: 14, protein: 48 },
    { name: 'Caesar Salad with Grilled Shrimp', calories: 380, carbs: 15, fat: 22, protein: 32 },
    { name: 'Sirloin Steak (200g) with Garlic Greens', calories: 520, carbs: 8, fat: 30, protein: 46 },
    { name: 'Tofu & Vegetable Stir Fry', calories: 340, carbs: 24, fat: 12, protein: 18 },
    { name: 'Classic Cheeseburger & Side Fries', calories: 890, carbs: 75, fat: 42, protein: 38 },
    { name: 'Penne Arrabbiata with Mozzarella', calories: 580, carbs: 82, fat: 16, protein: 22 },
    { name: 'Greek Salad with Feta & Olives', calories: 310, carbs: 14, fat: 24, protein: 10 },
    { name: 'High-Protein Grain Bowl (Quinoa, Edamame)', calories: 450, carbs: 54, fat: 15, protein: 24 }
  ];

  const handleMenuScanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    setIsScanningMenu(true);
    setMenuImagesCount((prev) => prev + files.length);

    setTimeout(() => {
      const shuffled = [...RESTUARANT_DISHES_POOL].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, Math.round(3 + Math.random()));
      
      const mapped = selected.map((d) => {
        const fit = calculateMenuDishFit(d.calories, remainingCaloriesToday, profile?.goal);
        return {
          ...d,
          fitScore: fit.fitScore,
          fitLabel: fit.fitLabel,
          adjustedScale: 1.0
        } as any;
      });

      setScannedMenuDishes(mapped);
      setIsScanningMenu(false);
    }, 2000);
  };

  useEffect(() => {
    localStorage.setItem('forkcount_draft_smart_food', smartFoodText);
  }, [smartFoodText]);

  useEffect(() => {
    setGramOverrides({});
    setEditingWeightIndices({});
    setConfirmedOver5kgIndices({});
    setConfirmedOver5000Kcal(false);
  }, [debouncedSmartFoodText]);

  const baseDecipheredFood = useMemo(
    () => decipherFoodText(debouncedSmartFoodText, macroTarget.calories, mealType),
    [debouncedSmartFoodText, macroTarget.calories, mealType]
  );
  const decipheredFood = useMemo(
    () => recalculateDecipheredFoodWithGrams(baseDecipheredFood, gramOverrides, macroTarget.calories, mealType),
    [baseDecipheredFood, gramOverrides, macroTarget.calories, mealType]
  );

  const hasUnconfirmedOver5kg = decipheredFood.items.some(
    (item, idx) => item.grams > 5000 && confirmedOver5kgIndices[idx] !== item.grams
  );
  const hasConfirmedAnyOver5kg = decipheredFood.items.some(
    (item, idx) => item.grams > 5000 && confirmedOver5kgIndices[idx] === item.grams
  );
  const hasUnconfirmedOver5000Kcal =
    decipheredFood.isOver5000Kcal && !confirmedOver5000Kcal && !hasConfirmedAnyOver5kg;
  const needsSanityConfirmation = hasUnconfirmedOver5kg || hasUnconfirmedOver5000Kcal;
  const isUnusualQuantityConfirmed =
    hasConfirmedAnyOver5kg || (decipheredFood.isOver5000Kcal && confirmedOver5000Kcal);

  const submitFoodWithDuplicateCheck = async (
    payload: {
      name: string;
      calories: number;
      carbs: number;
      fat: number;
      protein: number;
      fiber?: number;
      sugar?: number;
      sodium?: number;
      caffeineMg?: number;
      standardDrinks?: number;
      serving?: string;
      note?: string;
      unusualQuantity?: boolean;
      source: 'manual' | 'recipe' | 'usda' | 'saved' | 'voice' | 'photo' | 'restaurant';
      closeAfter?: boolean;
    },
    forceDuplicate = false
  ) => {
    if (!forceDuplicate) {
      const dup = findRecentDuplicateFood(diaryItems, payload.name, payload.calories);
      if (dup) {
        setPendingDuplicatePayload(payload);
        return false;
      }
    }
    setPendingDuplicatePayload(null);
    await addFoodItem({
      date: activeDate,
      mealType,
      name: payload.name,
      calories: payload.calories,
      carbs: payload.carbs,
      fat: payload.fat,
      protein: payload.protein,
      fiber: payload.fiber,
      sugar: payload.sugar,
      sodium: payload.sodium,
      caffeineMg: payload.caffeineMg,
      standardDrinks: payload.standardDrinks,
      serving: payload.serving || '1 portion',
      note: payload.note,
      unusualQuantity: payload.unusualQuantity,
      source: payload.source
    });
    if (payload.closeAfter !== false) {
      onClose();
    }
    return true;
  };

  const parseServingsValue = (val: string): number => {
    if (val === '½') return 0.5;
    if (val === '¼') return 0.25;
    if (val === '¾') return 0.75;
    const num = parseFloat(val);
    return Number.isNaN(num) ? 1.0 : num;
  };

  const handleSaveSmartFood = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !smartFoodText.trim() ||
      decipheredFood.items.length === 0 ||
      decipheredFood.needsWeightConfirmation ||
      needsSanityConfirmation
    ) {
      return;
    }

    if (isGuest) {
      const allowed = consumeGuestAiCall();
      if (!allowed) {
        return;
      }
    }

    setIsSavingSmart(true);
    try {
      const isRecipe = Boolean(decipheredFood.isRecipe);
      const scale = isRecipe
        ? parseServingsValue(userServingsEaten) / (decipheredFood.recipeServings || 4)
        : 1.0;

      const saved = await submitFoodWithDuplicateCheck({
        name: isRecipe
          ? `${decipheredFood.mealSummaryName} (${userServingsEaten} portion${parseServingsValue(userServingsEaten) === 1 ? '' : 's'} of ${decipheredFood.recipeServings || 4}-serving recipe)`
          : decipheredFood.mealSummaryName,
        calories: Math.round(decipheredFood.totalCalories * scale),
        carbs: Math.round(decipheredFood.totalCarbs * scale * 10) / 10,
        fat: Math.round(decipheredFood.totalFat * scale * 10) / 10,
        protein: Math.round(decipheredFood.totalProtein * scale * 10) / 10,
        fiber: decipheredFood.totalFiber ? Math.round(decipheredFood.totalFiber * scale * 10) / 10 : undefined,
        sugar: decipheredFood.totalSugar ? Math.round(decipheredFood.totalSugar * scale * 10) / 10 : undefined,
        sodium: decipheredFood.totalSodiumMg ? Math.round(decipheredFood.totalSodiumMg * scale) : undefined,
        caffeineMg: decipheredFood.totalCaffeineMg > 0 ? Math.round(decipheredFood.totalCaffeineMg * scale) : undefined,
        standardDrinks: decipheredFood.totalStandardDrinks > 0 ? Math.round(decipheredFood.totalStandardDrinks * scale * 10) / 10 : undefined,
        serving: isRecipe
          ? `${userServingsEaten} serving (approx ${Math.round(decipheredFood.items.reduce((s, i) => s + i.grams, 0) * scale * 10) / 10}g)`
          : `${Math.round(decipheredFood.items.reduce((s, i) => s + i.grams, 0) * 10) / 10}g total`,
        note: isUnusualQuantityConfirmed
          ? `Unusual quantity · Health Rating: ${decipheredFood.healthRating}/10`
          : `Health Rating: ${decipheredFood.healthRating}/10`,
        unusualQuantity: isUnusualQuantityConfirmed,
        source: 'manual',
        closeAfter: true
      });

      if (saved) {
        setSmartFoodText('');
        localStorage.removeItem('forkcount_draft_smart_food');
        localStorage.removeItem('caloriq_draft_smart_food');
        setGramOverrides({});
        setConfirmedOver5kgIndices({});
        setConfirmedOver5000Kcal(false);
        setUserServingsEaten('1');
      }
    } finally {
      setIsSavingSmart(false);
    }
  };

  // Manual Form State
  const [manualName, setManualName] = useState('');
  const [manualCalories, setManualCalories] = useState('');
  const [manualCarbs, setManualCarbs] = useState('');
  const [manualFat, setManualFat] = useState('');
  const [manualProtein, setManualProtein] = useState('');
  const [manualServing, setManualServing] = useState('1 serving');
  const [manualNote, setManualNote] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const debouncedManualCalories = useDebounce(manualCalories, 400);
  const debouncedManualServing = useDebounce(manualServing, 400);

  // Recipe Form State
  const [recipeName, setRecipeName] = useState('');
  const debouncedRecipeName = useDebounce(recipeName, 400);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([
    { id: '1', raw: '', name: '', amount: 0, unit: '', calories: 0, carbs: 0, fat: 0, protein: 0, isVague: false, isParsed: false }
  ]);
  const [isParsingRow, setIsParsingRow] = useState<string | null>(null);
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [recipeToDelete, setRecipeToDelete] = useState<SavedRecipe | null>(null);
  const [recipeError, setRecipeError] = useState<string | null>(null);

  // Packaged Search State
  const [packagedQuery, setPackagedQuery] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [packagedResults, setPackagedResults] = useState<any[]>([]);
  const [isSearchingPackaged, setIsSearchingPackaged] = useState(false);
  const [usdaStatusMsg, setUsdaStatusMsg] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Saved Foods State
  const [savedFoods, setSavedFoods] = useState<SavedFood[]>([]);
  const [savedFoodSearch, setSavedFoodSearch] = useState('');
  const debouncedSavedFoodSearch = useDebounce(savedFoodSearch, 400);
  const [showSavedList, setShowSavedList] = useState(false);

  // Phase 4 AI Tools State (#3 Voice, #9 Plate Photo, #12 Restaurant Mode, #17 Portion Estimator)
  const [aiSubMode, setAiSubMode] = useState<'voice' | 'plate' | 'restaurant' | 'portion'>('voice');
  const [isAiBusy, setIsAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // #3 Voice Log (#16 draft save)
  const [voiceTranscript, setVoiceTranscript] = useState(() => {
    return localStorage.getItem('forkcount_draft_voice_food') || localStorage.getItem('caloriq_draft_voice_food') || '';
  });
  const [isListening, setIsListening] = useState(false);
  const [voiceResult, setVoiceResult] = useState<any | null>(null);

  useEffect(() => {
    localStorage.setItem('forkcount_draft_voice_food', voiceTranscript);
  }, [voiceTranscript]);

  // #9 Plate Photo
  const [platePreview, setPlatePreview] = useState<string | null>(null);
  const [plateResult, setPlateResult] = useState<any | null>(null);

  // #12 Restaurant Mode
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantDish, setRestaurantDish] = useState('');
  const [restaurantResult, setRestaurantResult] = useState<any | null>(null);

  // #17 Portion Estimator
  const [portionFood, setPortionFood] = useState('');
  const [portionDimensions, setPortionDimensions] = useState('');
  const [portionResult, setPortionResult] = useState<any | null>(null);

  useEffect(() => {
    setMealType(defaultMeal || lastSelectedMeal);
  }, [defaultMeal, lastSelectedMeal]);

  useEffect(() => {
    if (isOpen) {
      loadSavedFoods();
      loadSavedRecipes();
      setPendingDuplicatePayload(null);
    }
  }, [isOpen]);

  const loadSavedFoods = async () => {
    try {
      const res = await api.getSavedFoods();
      setSavedFoods(res.foods || []);
    } catch {
      // ignore
    }
  };

  const loadSavedRecipes = async () => {
    try {
      const res = await api.getRecipes();
      setSavedRecipes(res.recipes || []);
    } catch {
      // ignore
    }
  };

  // #15 Debounced recipe search on name typing
  useEffect(() => {
    if (debouncedRecipeName.trim().length >= 3) {
      api
        .searchRecipe(debouncedRecipeName.trim())
        .then((res) => {
          if (res.recipe) {
            const loadedRows: IngredientRow[] = res.recipe.ingredients.map((ing, idx) => ({
              id: String(idx + 1),
              raw: ing.raw || `${ing.amount}${ing.unit} ${ing.name}`,
              name: ing.name,
              amount: ing.amount,
              unit: ing.unit,
              calories: ing.calories,
              carbs: ing.carbs,
              fat: ing.fat,
              protein: ing.protein,
              isVague: false,
              isParsed: true
            }));
            setIngredients(loadedRows);
          }
        })
        .catch(() => {});
    }
  }, [debouncedRecipeName]);

  const handleRecipeNameChange = (name: string) => {
    setRecipeName(name);
    setRecipeError(null);
  };

  const handleIngredientBlur = async (id: string, text: string) => {
    if (!text.trim()) return;
    setIsParsingRow(id);
    try {
      const parsed = await api.parseRecipeLine(text);
      setIngredients(prev => prev.map(row => {
        if (row.id === id) {
          return {
            ...row,
            raw: text,
            name: parsed.name,
            amount: parsed.amount,
            unit: parsed.unit,
            calories: parsed.calories,
            carbs: parsed.carbs,
            fat: parsed.fat,
            protein: parsed.protein,
            isVague: Boolean(parsed.isVague),
            vaguePrompt: parsed.vaguePrompt,
            vagueSuggestions: parsed.vagueSuggestions,
            isParsed: true
          };
        }
        return row;
      }));
    } catch {
      // fallback
    } finally {
      setIsParsingRow(null);
    }
  };

  const handleSelectVagueSuggestion = (id: string, suggestion: string, row: IngredientRow) => {
    const newRaw = row.raw ? row.raw.replace(new RegExp(row.name, 'i'), suggestion) : `${row.amount || 100}g ${suggestion}`;
    handleIngredientBlur(id, newRaw);
  };

  const addIngredientRow = () => {
    setIngredients(prev => [
      ...prev,
      { id: String(Date.now()), raw: '', name: '', amount: 0, unit: '', calories: 0, carbs: 0, fat: 0, protein: 0, isVague: false, isParsed: false }
    ]);
  };

  const removeIngredientRow = (id: string) => {
    if (ingredients.length > 1) {
      setIngredients(prev => prev.filter(r => r.id !== id));
    }
  };

  const totalRecipeCalories = ingredients.reduce((sum, r) => sum + (r.calories || 0), 0);
  const totalRecipeCarbs = Math.round(ingredients.reduce((sum, r) => sum + (r.carbs || 0), 0) * 10) / 10;
  const totalRecipeFat = Math.round(ingredients.reduce((sum, r) => sum + (r.fat || 0), 0) * 10) / 10;
  const totalRecipeProtein = Math.round(ingredients.reduce((sum, r) => sum + (r.protein || 0), 0) * 10) / 10;
  const hasVagueIngredient = ingredients.some(r => r.isVague);

  const handlePackagedSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!packagedQuery.trim()) return;

    setIsSearchingPackaged(true);
    setUsdaStatusMsg(null);
    try {
      const res = await api.searchUsda(packagedQuery, storeFilter);
      if (!res.available) {
        setUsdaStatusMsg(res.error || "Packaged food search is not available yet.");
        setPackagedResults([]);
      } else {
        setPackagedResults(res.foods || []);
        if (res.foods.length === 0) {
          setUsdaStatusMsg("No matching packaged foods found.");
        }
      }
    } catch (err: any) {
      setUsdaStatusMsg(err.message || "Failed to search USDA database.");
    } finally {
      setIsSearchingPackaged(false);
    }
  };

  const selectPackagedFood = (food: any) => {
    setManualName(food.brandName ? `${food.brandName} - ${food.description}` : food.description);
    setManualCalories(String(food.calories || 0));
    setManualCarbs(String(food.carbs || 0));
    setManualFat(String(food.fat || 0));
    setManualProtein(String(food.protein || 0));
    setManualServing(food.householdServingFullText || `${food.servingSize || 100} ${food.servingSizeUnit || 'g'}`);
    setActiveTab('manual');
  };

  const selectSavedFood = (food: SavedFood) => {
    setManualName(food.name);
    setManualCalories(String(food.calories));
    setManualCarbs(String(food.carbs));
    setManualFat(String(food.fat));
    setManualProtein(String(food.protein));
    setManualServing(food.serving || '1 portion');
    setShowSavedList(false);
  };

  const handleSaveManual = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError(null);
    if (!manualName.trim() || !manualCalories) return;

    const kcalErr = validateSingleFoodCalories(manualCalories);
    if (kcalErr) {
      setManualError(kcalErr);
      return;
    }

    const weightErr = validateSingleFoodWeightText(manualServing);
    if (weightErr) {
      setManualError(weightErr);
      return;
    }

    await submitFoodWithDuplicateCheck({
      name: manualName.trim(),
      calories: Math.round(Number(manualCalories)),
      carbs: Number(manualCarbs) || 0,
      fat: Number(manualFat) || 0,
      protein: Number(manualProtein) || 0,
      serving: manualServing || '1 serving',
      note: manualNote.trim() || undefined,
      source: 'manual',
      closeAfter: true
    });
  };

  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecipeError(null);
    if (!recipeName.trim() || totalRecipeCalories === 0) return;

    // #8 & #9 Sanity checks on recipe ingredients
    for (const ing of ingredients) {
      const kcalErr = validateSingleFoodCalories(ing.calories);
      if (kcalErr) {
        setRecipeError(kcalErr);
        return;
      }
      const grams =
        ing.unit.toLowerCase() === 'kg'
          ? ing.amount * 1000
          : ing.unit.toLowerCase() === 'g'
            ? ing.amount
            : 0;
      const wErr = validateSingleFoodWeightGrams(grams);
      if (wErr) {
        setRecipeError(wErr);
        return;
      }
    }

    await api.saveRecipe({
      name: recipeName.trim(),
      ingredients: ingredients.map(ing => ({
        raw: ing.raw,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
        calories: ing.calories,
        carbs: ing.carbs,
        fat: ing.fat,
        protein: ing.protein
      })),
      totalCalories: totalRecipeCalories,
      totalCarbs: totalRecipeCarbs,
      totalFat: totalRecipeFat,
      totalProtein: totalRecipeProtein
    });
    await loadSavedRecipes();

    await submitFoodWithDuplicateCheck({
      name: recipeName.trim(),
      calories: totalRecipeCalories,
      carbs: totalRecipeCarbs,
      fat: totalRecipeFat,
      protein: totalRecipeProtein,
      serving: '1 recipe portion',
      source: 'recipe',
      closeAfter: true
    });
  };

  // #3 Voice Log Handlers
  const startSpeechRecognition = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setAiError('Voice dictation is not supported in this browser — type what you ate below.');
      return;
    }
    try {
      const recognition = new SpeechRec();
      recognition.lang = 'en-US';
      recognition.interimResults = false;
      setIsListening(true);
      setAiError(null);
      recognition.onresult = (event: any) => {
        const text = event.results?.[0]?.[0]?.transcript || '';
        setVoiceTranscript(text);
        setIsListening(false);
      };
      recognition.onerror = () => {
        setIsListening(false);
      };
      recognition.onend = () => {
        setIsListening(false);
      };
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  const handleParseVoice = async () => {
    if (!voiceTranscript.trim()) return;
    setIsAiBusy(true);
    setAiError(null);
    trackEventOnce('first_ai_call');
    try {
      const res = await api.parseVoiceMeal(voiceTranscript.trim());
      setVoiceResult(res);
    } catch (e: any) {
      setAiError(e.message || 'Could not parse meal.');
    } finally {
      setIsAiBusy(false);
    }
  };

  // #9 Plate Photo Handler
  const handlePlatePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result);
      setPlatePreview(dataUrl);
      setIsAiBusy(true);
      setAiError(null);
      try {
        const res = await api.analyzePlatePhoto(dataUrl, file.type);
        setPlateResult(res);
      } catch (err: any) {
        setAiError(err.message || 'Could not analyze plate photo.');
      } finally {
        setIsAiBusy(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // #12 Restaurant Mode Handler
  const handleRestaurantEstimate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim() || !restaurantDish.trim()) return;
    setIsAiBusy(true);
    setAiError(null);
    try {
      const res = await api.estimateRestaurantDish(restaurantName.trim(), restaurantDish.trim());
      setRestaurantResult(res);
    } catch (err: any) {
      setAiError(err.message || 'Failed to estimate restaurant dish.');
    } finally {
      setIsAiBusy(false);
    }
  };

  // #17 Portion Estimator Handler
  const handlePortionEstimate = async (e: React.FormEvent, photoDataUrl?: string, mimeType?: string) => {
    e.preventDefault();
    if (!portionFood.trim()) return;
    setIsAiBusy(true);
    setAiError(null);
    try {
      const res = await api.estimatePortion({
        foodName: portionFood.trim(),
        dimensionsText: portionDimensions.trim() || undefined,
        base64Image: photoDataUrl,
        mimeType
      });
      setPortionResult(res);
    } catch (err: any) {
      setAiError(err.message || 'Failed to estimate portion.');
    } finally {
      setIsAiBusy(false);
    }
  };

  const handleConfirmAiMeal = async (payload: {
    name: string;
    calories: number;
    carbs: number;
    fat: number;
    protein: number;
    serving?: string;
    source: 'voice' | 'photo' | 'restaurant' | 'manual';
  }) => {
    const kcalErr = validateSingleFoodCalories(payload.calories);
    if (kcalErr) {
      setAiError(kcalErr);
      return;
    }
    const saved = await submitFoodWithDuplicateCheck({
      name: payload.name,
      calories: Math.round(payload.calories || 0),
      carbs: Math.round(payload.carbs || 0),
      fat: Math.round(payload.fat || 0),
      protein: Math.round(payload.protein || 0),
      serving: payload.serving || '1 portion',
      source: payload.source,
      closeAfter: true
    });
    if (saved && payload.source === 'voice') {
      setVoiceTranscript('');
      localStorage.removeItem('forkcount_draft_voice_food');
      localStorage.removeItem('caloriq_draft_voice_food');
    }
  };

  if (!isOpen) return null;

  const filteredSavedFoods = savedFoods.filter(f =>
    f.name.toLowerCase().includes(debouncedSavedFoodSearch.toLowerCase())
  );

  const inlineManualCalorieError = debouncedManualCalories
    ? validateSingleFoodCalories(debouncedManualCalories)
    : null;
  const inlineManualWeightError = debouncedManualServing
    ? validateSingleFoodWeightText(debouncedManualServing)
    : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div role="status" aria-live="polite" className="sr-only">
          {aiError ? `Error: ${aiError}` : isAiBusy ? 'Calculating nutrition estimates...' : ''}
        </div>
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">Add to</span>
            <select
              value={mealType}
              onChange={(e) => {
                const nextMeal = e.target.value as MealType;
                setMealType(nextMeal);
                setLastSelectedMeal(nextMeal);
              }}
              aria-label="Select meal slot"
              className="bg-zinc-800 border border-zinc-700 text-teal-400 font-semibold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-teal-500 capitalize"
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
              <option value="snack">Snacks</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            {/* #15 Barcode quick log icon on the Add screen */}
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="min-h-[38px] px-2.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 flex items-center gap-1.5 text-xs font-medium transition-colors"
              aria-label="Barcode quick log"
              title="Scan barcode"
            >
              <Scan className="w-4 h-4" />
              <span>Scan</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mode Tabs */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-1 border-b border-zinc-850">
          <button
            onClick={() => {
              if (isGuest && guestAiUsed) {
                openGuestLock();
                return;
              }
              setActiveTab('smart');
            }}
            aria-label="Smart AI tab"
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'smart'
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Smart AI
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            aria-label="Manual entry tab"
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              activeTab === 'manual'
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => {
              if (isGuest) {
                openGuestLock();
                return;
              }
              setActiveTab('recipe');
            }}
            aria-label="Recipe tab"
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'recipe'
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Recipe
          </button>
          <button
            onClick={() => setActiveTab('packaged')}
            aria-label="Packaged food tab"
            className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 ${
              activeTab === 'packaged'
                ? 'bg-teal-500/15 text-teal-300 border border-teal-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ShoppingBag className="w-3 h-3" />
            Packaged
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {!isOnline && (
            <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-800 text-[11px] text-zinc-400">
              Offline — cloud AI features are paused. Manual entry and local deciphering work offline.
            </div>
          )}

          {/* #11 Duplicate food within 5 minutes confirmation */}
          {pendingDuplicatePayload && (
            <div className="p-3 rounded-xl bg-amber-950/80 border border-amber-500/50 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs text-amber-100 font-medium">
                  You just logged this. Add another?
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setPendingDuplicatePayload(null)}
                  className="px-2.5 py-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => submitFoodWithDuplicateCheck(pendingDuplicatePayload, true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold rounded-lg text-xs"
                >
                  Add another
                </button>
              </div>
            </div>
          )}

          {/* #25 Recent foods shortcut — last 5 foods logged by this user for one-tap re-adding */}
          <div className="bg-zinc-950/70 border border-zinc-800 rounded-xl p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400">
                Recent Foods (One-Tap Re-Add)
              </span>
              <span className="text-[10px] text-zinc-500 font-mono">Last 5</span>
            </div>
            {recentFiveFoods.length === 0 ? (
              <p className="text-[11px] text-zinc-500 py-1">
                No recent foods logged yet. Your last 5 logged foods will appear here.
              </p>
            ) : (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                {recentFiveFoods.map((rf) => (
                  <button
                    key={rf.id}
                    type="button"
                    onClick={() =>
                      submitFoodWithDuplicateCheck({
                        name: rf.name,
                        calories: rf.calories,
                        carbs: rf.carbs,
                        fat: rf.fat,
                        protein: rf.protein,
                        serving: rf.serving,
                        source: 'saved',
                        closeAfter: true
                      })
                    }
                    className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-teal-950/50 border border-zinc-800 hover:border-teal-500/40 text-left shrink-0 flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3 h-3 text-teal-400 shrink-0" />
                    <span className="text-xs text-zinc-200 font-medium truncate max-w-[120px]">{rf.name}</span>
                    <span className="text-[10px] font-mono text-teal-400 shrink-0">{rf.calories} kcal</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Saved Foods Drawer Toggle */}
          <div className="flex items-center justify-between bg-zinc-950/60 border border-zinc-800 rounded-xl p-2.5">
            <div className="flex items-center gap-2 text-xs text-zinc-300">
              <Bookmark className="w-3.5 h-3.5 text-teal-400" />
              <span>Saved Foods ({isGuest ? 'Locked' : savedFoods.length})</span>
            </div>
            <button
              onClick={() => {
                if (isGuest) {
                  openGuestLock();
                  return;
                }
                setShowSavedList(!showSavedList);
              }}
              aria-label="Browse saved foods"
              className="text-[11px] font-medium text-teal-400 hover:underline"
            >
              {showSavedList ? 'Hide List' : 'Browse & Re-add'}
            </button>
          </div>

          {showSavedList && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={savedFoodSearch}
                  onChange={(e) => setSavedFoodSearch(e.target.value)}
                  placeholder="Search previously logged items..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {savedFoods.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 py-2 text-center">
                    No saved foods yet. Foods you log will appear here for one-tap re-adding.
                  </p>
                ) : filteredSavedFoods.length === 0 ? (
                  <p className="text-[11px] text-zinc-500 py-2 text-center">No saved foods match your search.</p>
                ) : (
                  filteredSavedFoods.map((f) => (
                    <SwipeableItem
                      key={f.id}
                      onDelete={() => setSavedFoods(prev => prev.filter(item => item.id !== f.id))}
                      options={[
                        {
                          label: 'Use this saved food',
                          onClick: () => selectSavedFood(f)
                        },
                        {
                          label: 'Remove from list',
                          onClick: () => setSavedFoods(prev => prev.filter(item => item.id !== f.id)),
                          destructive: true
                        }
                      ]}
                    >
                      <button
                        type="button"
                        onClick={() => selectSavedFood(f)}
                        className="w-full text-left p-2 rounded-lg bg-zinc-900/60 hover:bg-zinc-850 border border-zinc-800 text-xs flex items-center justify-between transition-colors"
                      >
                        <div className="truncate pr-2">
                          <span className="font-medium text-zinc-200 block truncate">{f.name}</span>
                          <span className="text-[10px] text-zinc-500">{f.serving}</span>
                        </div>
                        <span className="text-teal-400 font-semibold text-xs shrink-0">{f.calories} kcal</span>
                      </button>
                    </SwipeableItem>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 0: SMART FOOD DECIPHERER (IN-CODE AI) */}
          {activeTab === 'smart' && (
            <form onSubmit={handleSaveSmartFood} className="space-y-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-zinc-300">
                    Type what you ate in your own words
                  </label>
                  <button
                    type="button"
                    onClick={() => setSmartFoodText('80g mangos, 10g yougurt, a pinch of salt')}
                    className="text-[11px] text-teal-400 hover:text-teal-300 underline cursor-pointer"
                  >
                    Try example
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={smartFoodText}
                  onChange={(e) => setSmartFoodText(e.target.value)}
                  placeholder="e.g., 80g mangos, 2 cups regular coffee, or 1 glass of beer 150ml 12.5% ABV"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 resize-none leading-relaxed"
                />
              </div>

              {/* Deciphered Calories & Macros Box Below */}
              <div className="bg-zinc-950 border border-teal-500/30 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400 block">
                      Calculated Calories &amp; Macros
                    </span>
                    <span className="text-xs font-bold text-zinc-100">
                      {smartFoodText.trim() ? decipheredFood.mealSummaryName : 'Type ingredients above to decipher'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-teal-400 font-mono">
                      {decipheredFood.totalCalories}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono ml-1">kcal</span>
                  </div>
                </div>

                {/* Macros Grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2">
                    <span className="text-[10px] font-semibold text-blue-400 block">Carbs</span>
                    <span className="text-sm font-bold text-zinc-100 font-mono">{decipheredFood.totalCarbs}g</span>
                  </div>
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2">
                    <span className="text-[10px] font-semibold text-amber-400 block">Fat</span>
                    <span className="text-sm font-bold text-zinc-100 font-mono">{decipheredFood.totalFat}g</span>
                  </div>
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-lg p-2">
                    <span className="text-[10px] font-semibold text-red-400 block">Protein</span>
                    <span className="text-sm font-bold text-zinc-100 font-mono">{decipheredFood.totalProtein}g</span>
                  </div>
                </div>

                {(decipheredFood.totalCaffeineMg > 0 || decipheredFood.totalStandardDrinks > 0) && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {decipheredFood.totalCaffeineMg > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono">
                        <span className="font-semibold">Caffeine:</span>
                        <span className="font-bold">{decipheredFood.totalCaffeineMg} mg</span>
                      </div>
                    )}
                    {decipheredFood.totalStandardDrinks > 0 && (
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-[11px] font-mono">
                        <span className="font-semibold">Alcohol:</span>
                        <span className="font-bold">
                          {decipheredFood.totalStandardDrinks} std drink{decipheredFood.totalStandardDrinks === 1 ? '' : 's'}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Confirm Weights & Itemized Ingredient Breakdown */}
                {decipheredFood.items.length > 0 && (
                  <div className="pt-2.5 border-t border-zinc-800/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-400">
                        {decipheredFood.needsWeightConfirmation ? 'Confirm weights' : 'Ingredients & weights'}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {decipheredFood.needsWeightConfirmation
                          ? 'Enter missing weight below'
                          : 'Tap pencil to edit weight'}
                      </span>
                    </div>

                    {decipheredFood.needsWeightConfirmation && (
                      <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/40 text-[11px] text-amber-300 flex items-center gap-1.5">
                        <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>How much? Enter weight in grams for items without a known portion.</span>
                      </div>
                    )}

                    {/* Per-item >5kg sanity check warnings */}
                    {decipheredFood.items.map((item, idx) => {
                      if (!item.isOver5kg || !item.over5kgWarning) return null;
                      const isConfirmed = confirmedOver5kgIndices[idx] === item.grams;
                      if (isConfirmed) {
                        return (
                          <div
                            key={`flag-${idx}`}
                            className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-500/40 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-1.5 text-rose-300 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                              <span>Unusual quantity</span>
                              <span className="text-zinc-400 font-normal">
                                ({item.kgAmount}kg of {item.name.toLowerCase()})
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setGramOverrides((prev) => ({
                                  ...prev,
                                  [idx]: item.suggestedGrams || 75
                                }));
                              }}
                              className="text-[11px] text-teal-400 hover:text-teal-300 underline shrink-0"
                            >
                              Change to {item.suggestedGrams}g
                            </button>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={`warn-${idx}`}
                          className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 space-y-2.5"
                        >
                          <div className="flex items-start gap-2 text-xs text-rose-200 font-medium">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <span>{item.over5kgWarning}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmedOver5kgIndices((prev) => ({
                                  ...prev,
                                  [idx]: item.grams
                                }));
                                setConfirmedOver5000Kcal(true);
                              }}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold transition-colors"
                            >
                              Yes, {item.kgAmount}kg
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setGramOverrides((prev) => ({
                                  ...prev,
                                  [idx]: item.suggestedGrams || 75
                                }));
                              }}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-zinc-950 text-xs font-semibold transition-colors"
                            >
                              Change to {item.suggestedGrams}g
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Total meal >5,000 kcal warning */}
                    {decipheredFood.isOver5000Kcal && (
                      <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/50 space-y-2">
                        <div className="flex items-start justify-between gap-2 text-xs text-rose-200 font-medium">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                            <span>This meal is over 5,000 kcal. Is that right?</span>
                          </div>
                          {isUnusualQuantityConfirmed && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-rose-500/20 border border-rose-500/40 text-[10px] font-mono font-semibold text-rose-300 shrink-0">
                              Unusual quantity
                            </span>
                          )}
                        </div>
                        {!decipheredFood.hasItemOver5kg && !confirmedOver5000Kcal && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmedOver5000Kcal(true)}
                              className="flex-1 py-1.5 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-semibold transition-colors"
                            >
                              Yes, {decipheredFood.totalCalories} kcal
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      {decipheredFood.items.map((item, idx) => {
                        const hasUserOverride = Object.prototype.hasOwnProperty.call(gramOverrides, idx);
                        const currentGrams = hasUserOverride ? gramOverrides[idx] : item.grams;
                        const isUnconfirmed = Boolean(item.needsWeightConfirmation);
                        const isEditing = isUnconfirmed || Boolean(editingWeightIndices[idx]);
                        return (
                          <div
                            key={idx}
                            className={`space-y-1 bg-zinc-900/60 px-2.5 py-2 rounded-lg border ${
                              isUnconfirmed ? 'border-amber-500/60 bg-amber-950/20' : 'border-zinc-800/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 text-[11px]">
                              <div className="min-w-0 flex-1">
                                <span className="text-zinc-200 font-medium block truncate">{item.name}</span>
                                <span className="text-zinc-400 font-mono text-[10px] block truncate">
                                  {item.servingLabel} — {item.calories} kcal ({item.carbs}c · {item.fat}f · {item.protein}p)
                                  {item.caffeineMg > 0 ? ` · ${item.caffeineMg}mg caffeine` : ''}
                                  {item.standardDrinks > 0 ? ` · ${item.standardDrinks} std drink${item.standardDrinks === 1 ? '' : 's'}` : ''}
                                </span>
                                {item.notes && (
                                  <span className="text-amber-300/90 text-[10px] block mt-0.5">
                                    {item.notes}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    {isUnconfirmed && (
                                      <span className="text-[10px] text-amber-300 font-medium mr-0.5">
                                        How much?
                                      </span>
                                    )}
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      aria-label={`Grams for ${item.name}`}
                                      value={currentGrams === 0 && isUnconfirmed && !hasUserOverride ? '' : currentGrams}
                                      placeholder="g"
                                      onChange={(e) => {
                                        const rawVal = e.target.value;
                                        const numVal = rawVal === '' ? 0 : Math.max(0, parseFloat(rawVal) || 0);
                                        setGramOverrides((prev) => ({
                                          ...prev,
                                          [idx]: numVal
                                        }));
                                      }}
                                      className={`w-16 bg-zinc-950 border rounded-md px-2 py-1 text-right font-mono text-xs text-zinc-100 focus:outline-none ${
                                        isUnconfirmed
                                          ? 'border-amber-500/80 focus:border-amber-400'
                                          : 'border-zinc-700 focus:border-teal-500'
                                      }`}
                                    />
                                    <span className="text-[11px] font-mono text-zinc-400">g</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingWeightIndices((prev) => ({ ...prev, [idx]: true }))
                                    }
                                    aria-label={`Edit weight for ${item.name}`}
                                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-950/80 hover:bg-zinc-800 border border-zinc-800 text-[11px] font-mono text-zinc-200 transition-colors"
                                  >
                                    <span>
                                      {item.isEstimatedWeight
                                        ? `${currentGrams}g (estimated)`
                                        : `${currentGrams}g`}
                                    </span>
                                    <Pencil className="w-3 h-3 text-teal-400" />
                                  </button>
                                )}
                              </div>
                            </div>
                            {/* #8 & #9 single item sanity feedback */}
                            {item.calories > 5000 && (
                              <p className="text-[10px] text-rose-400 font-medium">
                                This item is over 5,000 kcal. Check the quantity.
                              </p>
                            )}
                            {currentGrams > 5000 && (
                              <p className="text-[10px] text-rose-400 font-medium">
                                That&apos;s over 5 kg of one item. Did you mean grams?
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Health Rating (1 to 10) + What to Add + What to Take Out */}
                {decipheredFood.items.length > 0 && (
                  <div className="pt-2.5 border-t border-zinc-800 space-y-2.5">
                    <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-zinc-200">
                          Health Rating (1–10)
                        </span>
                        <span
                          className={`text-sm font-extrabold font-mono px-2 py-0.5 rounded-md ${
                            decipheredFood.healthRating >= 7.5
                              ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                              : decipheredFood.healthRating >= 5.5
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          }`}
                        >
                          {decipheredFood.healthRating} / 10
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            decipheredFood.healthRating >= 7.5
                              ? 'bg-teal-400'
                              : decipheredFood.healthRating >= 5.5
                              ? 'bg-amber-400'
                              : 'bg-rose-400'
                          }`}
                          style={{ width: `${Math.min(100, decipheredFood.healthRating * 10)}%` }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-400 block">{decipheredFood.healthLabel}</span>
                    </div>

                    {/* What to Add (hidden when meal is far above normal size so quantity advice is shown first) */}
                    {decipheredFood.whatToAdd.length > 0 && (
                      <div className="bg-teal-950/25 border border-teal-800/40 rounded-xl p-2.5 space-y-1">
                        <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider block">
                          + What to Add
                        </span>
                        <ul className="space-y-1 text-[11px] text-zinc-200 leading-relaxed">
                          {decipheredFood.whatToAdd.map((tip, i) => (
                            <li key={i}>• {tip}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* What to Take Out */}
                    <div className="bg-amber-950/25 border border-amber-800/40 rounded-xl p-2.5 space-y-1">
                      <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider block">
                        − What to Take Out / Reduce
                      </span>
                      <ul className="space-y-1 text-[11px] text-zinc-200 leading-relaxed">
                        {decipheredFood.whatToTakeOut.map((tip, i) => (
                          <li key={i}>• {tip}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  isSavingSmart ||
                  !smartFoodText.trim() ||
                  decipheredFood.items.length === 0 ||
                  decipheredFood.needsWeightConfirmation ||
                  needsSanityConfirmation
                }
                className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
              >
                <Check className="w-4 h-4" />
                {isSavingSmart
                  ? 'Calculating...'
                  : decipheredFood.needsWeightConfirmation
                    ? 'Confirm Item Weights Above to Save'
                    : needsSanityConfirmation
                      ? 'Confirm Unusual Quantity Above to Save'
                      : 'Save Food'}
              </button>
            </form>
          )}

          {/* TAB 1: MANUAL */}
          {activeTab === 'manual' && (
            <form onSubmit={handleSaveManual} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Food Name
                </label>
                <input
                  type="text"
                  value={manualName}
                  onChange={(e) => setManualName(e.target.value)}
                  placeholder="e.g. Scrambled Eggs & Avocado"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Calories (kcal)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={manualCalories}
                    onChange={(e) => setManualCalories(e.target.value)}
                    placeholder="350"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">
                    Serving / Size
                  </label>
                  <input
                    type="text"
                    value={manualServing}
                    onChange={(e) => setManualServing(e.target.value)}
                    placeholder="1 bowl"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1">
                <div>
                  <label className="block text-[11px] font-medium text-blue-400 mb-1">
                    Carbs (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={manualCarbs}
                    onChange={(e) => setManualCarbs(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-amber-400 mb-1">
                    Fat (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={manualFat}
                    onChange={(e) => setManualFat(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-red-400 mb-1">
                    Protein (g)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={manualProtein}
                    onChange={(e) => setManualProtein(e.target.value)}
                    placeholder="0"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-red-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">
                  Optional Note
                </label>
                <input
                  type="text"
                  value={manualNote}
                  onChange={(e) => setManualNote(e.target.value)}
                  placeholder="e.g. felt tired after this"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                />
              </div>

              {(manualError || inlineManualCalorieError || inlineManualWeightError) && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {manualError || inlineManualCalorieError || inlineManualWeightError}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-teal-500 hover:bg-teal-400 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20 mt-2"
              >
                <Check className="w-4 h-4" />
                Log Food
              </button>
            </form>
          )}

          {/* TAB 2: RECIPE */}
          {activeTab === 'recipe' && (
            <form onSubmit={handleSaveRecipe} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Recipe Name
                </label>
                <input
                  type="text"
                  value={recipeName}
                  onChange={(e) => handleRecipeNameChange(e.target.value)}
                  placeholder="e.g. Tofu Veggie Stir Fry"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                />
                <span className="text-[10px] text-zinc-500 mt-1 block">
                  ForkCount saves your recipes — typing this name in the future autofills ingredients.
                </span>
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-400">
                    Ingredients (e.g. &apos;80g tofu&apos;, &apos;2 eggs&apos;, &apos;1 banana&apos;)
                  </label>
                  <button
                    type="button"
                    onClick={addIngredientRow}
                    className="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Row
                  </button>
                </div>

                {ingredients.map((row) => (
                  <div key={row.id} className="space-y-1.5 bg-zinc-950/70 border border-zinc-800/80 rounded-xl p-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={row.raw}
                        onChange={(e) => {
                          const val = e.target.value;
                          setIngredients(prev => prev.map(r => r.id === row.id ? { ...r, raw: val } : r));
                        }}
                        onBlur={(e) => handleIngredientBlur(row.id, e.target.value)}
                        placeholder="e.g. 150g chicken breast or 2 eggs"
                        className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                      />

                      {ingredients.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeIngredientRow(row.id)}
                          className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg transition-colors"
                          aria-label="Remove ingredient"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {isParsingRow === row.id && (
                      <div className="h-6 w-full bg-zinc-900 rounded-lg animate-pulse" />
                    )}

                    {row.isVague && (
                      <div className="p-2 bg-amber-950/40 border border-amber-800/50 rounded-lg text-xs space-y-1.5">
                        <div className="flex items-center gap-1.5 text-amber-300 font-medium text-[11px]">
                          <HelpCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{row.vaguePrompt || `Which ${row.name}?`}</span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {row.vagueSuggestions?.map(s => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => handleSelectVagueSuggestion(row.id, s, row)}
                              className="px-2 py-0.5 rounded bg-amber-900/60 hover:bg-amber-800/80 text-amber-200 text-[10px] transition-colors border border-amber-700/60"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {row.isParsed && !row.isVague && row.calories > 0 && (
                      <div className="flex items-center justify-between text-[11px] text-zinc-400 pt-0.5">
                        <span className="capitalize text-zinc-300">{row.name} ({row.amount}{row.unit})</span>
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-teal-400 font-semibold">{row.calories} kcal</span>
                          <span className="text-blue-400">{row.carbs}c</span>
                          <span className="text-amber-400">{row.fat}f</span>
                          <span className="text-red-400">{row.protein}p</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs text-zinc-400 block">Total Recipe Nutrition</span>
                  <div className="flex items-center gap-2 text-xs font-mono mt-0.5">
                    <span className="text-blue-400">{totalRecipeCarbs}g C</span>
                    <span className="text-amber-400">{totalRecipeFat}g F</span>
                    <span className="text-red-400">{totalRecipeProtein}g P</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-teal-400 font-mono">
                    {totalRecipeCalories}
                  </span>
                  <span className="text-[10px] text-zinc-500 block">kcal total</span>
                </div>
              </div>

              {recipeError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {recipeError}
                </div>
              )}

              <button
                type="submit"
                disabled={isParsingRow !== null || totalRecipeCalories === 0 || hasVagueIngredient}
                className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
              >
                <Check className="w-4 h-4" />
                {isParsingRow !== null
                  ? 'Calculating...'
                  : hasVagueIngredient
                    ? 'Specify Vague Ingredients Above'
                    : 'Save & Log Recipe'}
              </button>

              {/* #27 & #18 Saved Recipes List with Empty State, SwipeableItem, and 2-Step Delete Confirmation */}
              <div className="pt-3 border-t border-zinc-800 space-y-2">
                <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block">
                  Saved Recipes ({savedRecipes.length})
                </span>
                {savedRecipes.length === 0 ? (
                  <div className="py-3 px-3 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                    No saved recipes yet. Create a recipe above to save it for future meals.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {savedRecipes.map((rec) => (
                      <SwipeableItem
                        key={rec.id}
                        onDelete={() => setRecipeToDelete(rec)}
                        options={[
                          {
                            label: 'Load recipe into builder',
                            onClick: () => handleRecipeNameChange(rec.name)
                          },
                          {
                            label: 'Delete saved recipe',
                            onClick: () => setRecipeToDelete(rec),
                            destructive: true
                          }
                        ]}
                      >
                        <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded-xl flex items-center justify-between text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setRecipeName(rec.name);
                              setIngredients(
                                rec.ingredients.map((ing, idx) => ({
                                  id: String(idx + 1),
                                  raw: ing.raw || `${ing.amount}${ing.unit} ${ing.name}`,
                                  name: ing.name,
                                  amount: ing.amount,
                                  unit: ing.unit,
                                  calories: ing.calories,
                                  carbs: ing.carbs,
                                  fat: ing.fat,
                                  protein: ing.protein,
                                  isVague: false,
                                  isParsed: true
                                }))
                              );
                            }}
                            className="text-left flex-1 truncate pr-2"
                          >
                            <span className="font-semibold text-zinc-200 block truncate">{rec.name}</span>
                            <span className="text-[10px] font-mono text-teal-400">
                              {rec.totalCalories} kcal · {rec.totalCarbs}c · {rec.totalFat}f · {rec.totalProtein}p
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRecipeToDelete(rec)}
                            className="p-1.5 text-zinc-500 hover:text-rose-400 rounded-lg"
                            aria-label={`Delete recipe ${rec.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </SwipeableItem>
                    ))}
                  </div>
                )}
              </div>
            </form>
          )}

          {/* TAB 3: PACKAGED */}
          {activeTab === 'packaged' && (
            <div className="space-y-4">
              <form onSubmit={handlePackagedSearch} className="space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={packagedQuery}
                    onChange={(e) => setPackagedQuery(e.target.value)}
                    placeholder="Search brand or food (e.g. Chobani Greek Yogurt)..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-10 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="absolute right-2 top-2 p-1 text-zinc-400 hover:text-teal-400 transition-colors"
                    title="Scan Barcode"
                  >
                    <Scan className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                    placeholder="Store (optional, e.g. Trader Joe's, Costco)"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-teal-500"
                  />
                  <button
                    type="submit"
                    disabled={isSearchingPackaged || !packagedQuery.trim()}
                    className="px-4 py-1.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold text-xs rounded-xl flex items-center gap-1 transition-colors"
                  >
                    {isSearchingPackaged ? 'Calculating...' : 'Search'}
                  </button>
                </div>
              </form>

              {isSearchingPackaged && (
                <div className="space-y-2 animate-pulse">
                  <div className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl" />
                  <div className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl" />
                  <div className="h-14 bg-zinc-950 border border-zinc-800 rounded-xl" />
                </div>
              )}

              {!isSearchingPackaged && usdaStatusMsg && (
                <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-400 text-center">
                  {usdaStatusMsg}
                </div>
              )}

              {!isSearchingPackaged && !usdaStatusMsg && packagedResults.length === 0 && (
                <div className="py-6 px-4 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                  Search by brand or food name above, or tap Scan to use your camera barcode scanner.
                </div>
              )}

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {packagedResults.map((item, idx) => (
                  <button
                    key={item.fdcId || idx}
                    type="button"
                    onClick={() => selectPackagedFood(item)}
                    className="w-full text-left p-3 rounded-xl bg-zinc-950 hover:bg-zinc-850 border border-zinc-800 transition-colors flex items-center justify-between group"
                  >
                    <div className="max-w-[75%]">
                      <span className="font-medium text-xs text-zinc-200 block truncate group-hover:text-teal-300">
                        {item.description}
                      </span>
                      <span className="text-[10px] text-zinc-500 block truncate">
                        {item.brandName || item.brandOwner || 'Brand item'} · {item.householdServingFullText || '1 serving'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono text-xs font-bold text-teal-400 block">
                        {item.calories}
                      </span>
                      <span className="text-[10px] text-zinc-500">kcal</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AI & PHOTO TOOLS (#3 Voice, #9 Plate Photo, #12 Restaurant, #17 Portion Estimator) */}
          {activeTab === 'ai' && (
            <div className="space-y-3.5">
              {/* Sub-mode switcher */}
              <div className="grid grid-cols-4 gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button
                  type="button"
                  onClick={() => setAiSubMode('voice')}
                  className={`py-1.5 rounded-lg text-[10px] font-medium flex flex-col items-center gap-0.5 ${
                    aiSubMode === 'voice' ? 'bg-teal-500 text-zinc-950 font-semibold' : 'text-zinc-400'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  Voice
                </button>
                <button
                  type="button"
                  onClick={() => setAiSubMode('plate')}
                  className={`py-1.5 rounded-lg text-[10px] font-medium flex flex-col items-center gap-0.5 ${
                    aiSubMode === 'plate' ? 'bg-teal-500 text-zinc-950 font-semibold' : 'text-zinc-400'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Plate Photo
                </button>
                <button
                  type="button"
                  onClick={() => setAiSubMode('restaurant')}
                  className={`py-1.5 rounded-lg text-[10px] font-medium flex flex-col items-center gap-0.5 ${
                    aiSubMode === 'restaurant' ? 'bg-teal-500 text-zinc-950 font-semibold' : 'text-zinc-400'
                  }`}
                >
                  <Utensils className="w-3.5 h-3.5" />
                  Restaurant
                </button>
                <button
                  type="button"
                  onClick={() => setAiSubMode('portion')}
                  className={`py-1.5 rounded-lg text-[10px] font-medium flex flex-col items-center gap-0.5 ${
                    aiSubMode === 'portion' ? 'bg-teal-500 text-zinc-950 font-semibold' : 'text-zinc-400'
                  }`}
                >
                  <Ruler className="w-3.5 h-3.5" />
                  Portion
                </button>
              </div>

              {aiError && (
                <div className="p-2.5 bg-rose-950/40 border border-rose-800/50 rounded-xl text-xs text-rose-300">
                  {aiError}
                </div>
              )}

              {/* #3 VOICE LOG */}
              {aiSubMode === 'voice' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={startSpeechRecognition}
                      className={`p-3 rounded-xl border flex items-center justify-center transition-colors ${
                        isListening
                          ? 'bg-rose-500 text-white border-rose-400 animate-pulse'
                          : 'bg-teal-500/15 border-teal-500/30 text-teal-300 hover:bg-teal-500/25'
                      }`}
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                    <input
                      type="text"
                      value={voiceTranscript}
                      onChange={(e) => setVoiceTranscript(e.target.value)}
                      placeholder="Tap mic or type e.g. 'two eggs and sourdough toast'..."
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-zinc-100"
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isAiBusy || !voiceTranscript.trim()}
                    onClick={handleParseVoice}
                    className="w-full py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isAiBusy ? 'Calculating...' : 'Parse Spoken Meal'}
                  </button>

                  {isAiBusy && (
                    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 animate-pulse">
                      <div className="h-4 w-2/3 bg-zinc-800 rounded" />
                      <div className="h-3 w-1/2 bg-zinc-800 rounded" />
                      <div className="h-8 w-full bg-zinc-900 rounded-lg" />
                    </div>
                  )}

                  {!isAiBusy && voiceResult && (
                    <div className="p-3 bg-zinc-950 border border-teal-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-100">{voiceResult.mealName}</span>
                        <span className="text-sm font-bold text-teal-400 font-mono">{voiceResult.totalCalories} kcal</span>
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono">
                        {voiceResult.totalCarbs}g C · {voiceResult.totalFat}g F · {voiceResult.totalProtein}g P
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleConfirmAiMeal({
                            name: voiceResult.mealName,
                            calories: voiceResult.totalCalories,
                            carbs: voiceResult.totalCarbs,
                            fat: voiceResult.totalFat,
                            protein: voiceResult.totalProtein,
                            source: 'voice'
                          })
                        }
                        className="w-full py-2 bg-teal-500 text-zinc-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Confirm &amp; Log Meal
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* #9 PLATE PHOTO */}
              {aiSubMode === 'plate' && (
                <div className="space-y-3">
                  <label className="w-full py-6 border border-dashed border-zinc-700 hover:border-teal-500/50 rounded-xl bg-zinc-950 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Camera className="w-6 h-6 text-teal-400" />
                    <span className="text-xs font-medium text-zinc-300">Snap or upload a photo of your plate</span>
                    <span className="text-[10px] text-zinc-500">AI estimates ingredients &amp; macros before saving</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handlePlatePhotoChange} className="hidden" />
                  </label>

                  {platePreview && (
                    <SafeImage
                      src={platePreview}
                      alt="Plate preview"
                      className="w-full h-36 object-cover rounded-xl border border-zinc-800"
                      fallbackClassName="w-full h-36 rounded-xl"
                    />
                  )}

                  {isAiBusy && (
                    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 animate-pulse">
                      <div className="h-4 w-1/2 bg-zinc-800 rounded" />
                      <div className="h-3 w-full bg-zinc-900 rounded" />
                      <div className="h-3 w-4/5 bg-zinc-900 rounded" />
                      <div className="h-8 w-full bg-zinc-900 rounded-lg" />
                    </div>
                  )}

                  {!isAiBusy && plateResult && (
                    <div className="p-3 bg-zinc-950 border border-teal-500/30 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-100">{plateResult.mealName}</span>
                        <span className="text-sm font-bold text-teal-400 font-mono">{plateResult.totalCalories} kcal</span>
                      </div>
                      <div className="space-y-1">
                        {(plateResult.items || []).map((ing: any, i: number) => (
                          <div key={i} className="flex justify-between text-[11px] text-zinc-400">
                            <span>{ing.name} ({ing.portion})</span>
                            <span className="font-mono text-zinc-300">{ing.calories} kcal</span>
                          </div>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleConfirmAiMeal({
                            name: plateResult.mealName,
                            calories: plateResult.totalCalories,
                            carbs: plateResult.totalCarbs,
                            fat: plateResult.totalFat,
                            protein: plateResult.totalProtein,
                            source: 'photo'
                          })
                        }
                        className="w-full py-2 bg-teal-500 text-zinc-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Confirm &amp; Save Plate
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* #12 RESTAURANT MODE */}
              {aiSubMode === 'restaurant' && (
                <form onSubmit={handleRestaurantEstimate} className="space-y-3">
                  <input
                    type="text"
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="Restaurant name (e.g. Chipotle, Sweetgreen, Local Thai)"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  />
                  <input
                    type="text"
                    value={restaurantDish}
                    onChange={(e) => setRestaurantDish(e.target.value)}
                    placeholder="Dish name (e.g. Chicken Burrito Bowl, Pad Thai)"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  />
                  <button
                    type="submit"
                    disabled={isAiBusy}
                    className="w-full py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold rounded-xl text-xs flex items-center justify-center gap-1.5"
                  >
                    <Utensils className="w-3.5 h-3.5" />
                    {isAiBusy ? 'Calculating...' : 'Estimate Typical Portion'}
                  </button>

                  {isAiBusy && (
                    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 animate-pulse">
                      <div className="h-4 w-2/3 bg-zinc-800 rounded" />
                      <div className="h-3 w-1/2 bg-zinc-900 rounded" />
                      <div className="h-8 w-full bg-zinc-900 rounded-lg" />
                    </div>
                  )}

                  {!isAiBusy && restaurantResult && (
                    <div className="p-3 bg-zinc-950 border border-teal-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-100">{restaurantResult.name}</span>
                        <span className="text-sm font-bold text-teal-400 font-mono">{restaurantResult.calories} kcal</span>
                      </div>
                      <span className="text-[11px] text-zinc-400 block">{restaurantResult.serving}</span>
                      <div className="text-[11px] font-mono text-zinc-300">
                        {restaurantResult.carbs}g C · {restaurantResult.fat}g F · {restaurantResult.protein}g P
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          handleConfirmAiMeal({
                            name: restaurantResult.name,
                            calories: restaurantResult.calories,
                            carbs: restaurantResult.carbs,
                            fat: restaurantResult.fat,
                            protein: restaurantResult.protein,
                            serving: restaurantResult.serving,
                            source: 'restaurant'
                          })
                        }
                        className="w-full py-2 bg-teal-500 text-zinc-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Log Restaurant Dish
                      </button>
                    </div>
                  )}
                </form>
              )}

              {/* #17 PORTION ESTIMATOR */}
              {aiSubMode === 'portion' && (
                <form onSubmit={(e) => handlePortionEstimate(e)} className="space-y-3">
                  <input
                    type="text"
                    value={portionFood}
                    onChange={(e) => setPortionFood(e.target.value)}
                    placeholder="Food item (e.g. Grilled Salmon, Cooked White Rice)"
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  />
                  <input
                    type="text"
                    value={portionDimensions}
                    onChange={(e) => setPortionDimensions(e.target.value)}
                    placeholder="Visual size / dimensions (e.g. deck of cards, 10cm x 6cm x 2cm)"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-100"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={isAiBusy || !portionFood.trim()}
                      className="flex-1 py-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-semibold rounded-xl text-xs flex items-center justify-center gap-1"
                    >
                      <Ruler className="w-3.5 h-3.5" />
                      {isAiBusy ? 'Calculating...' : 'Estimate Grams'}
                    </button>
                    <label className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-teal-400 rounded-xl text-xs font-medium cursor-pointer flex items-center gap-1">
                      <Camera className="w-3.5 h-3.5" />
                      Photo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => {
                            handlePortionEstimate(
                              { preventDefault: () => {} } as React.FormEvent,
                              String(reader.result),
                              file.type
                            );
                          };
                          reader.readAsDataURL(file);
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {isAiBusy && (
                    <div className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 animate-pulse">
                      <div className="h-4 w-2/3 bg-zinc-800 rounded" />
                      <div className="h-3 w-full bg-zinc-900 rounded" />
                      <div className="h-8 w-full bg-zinc-900 rounded-lg" />
                    </div>
                  )}

                  {!isAiBusy && portionResult && (
                    <div className="p-3 bg-zinc-950 border border-teal-500/30 rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-100">
                          {portionResult.foodName} (~{portionResult.estimatedGrams}g)
                        </span>
                        <span className="text-sm font-bold text-teal-400 font-mono">{portionResult.calories} kcal</span>
                      </div>
                      <p className="text-[11px] text-zinc-400">{portionResult.explanation}</p>
                      <button
                        type="button"
                        onClick={() =>
                          handleConfirmAiMeal({
                            name: `${portionResult.foodName} (${portionResult.estimatedGrams}g)`,
                            calories: portionResult.calories,
                            carbs: portionResult.carbs,
                            fat: portionResult.fat,
                            protein: portionResult.protein,
                            serving: `${portionResult.estimatedGrams}g`,
                            source: 'manual'
                          })
                        }
                        className="w-full py-2 bg-teal-500 text-zinc-950 font-bold rounded-lg text-xs flex items-center justify-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Log Estimated Portion
                      </button>
                    </div>
                  )}
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={recipeToDelete !== null}
        title="Delete Saved Recipe"
        description={
          recipeToDelete
            ? `Are you sure you want to delete "${recipeToDelete.name}" from your saved recipes?`
            : ''
        }
        confirmLabel="Delete Recipe"
        secondStepLabel="Confirm Permanent Delete"
        onClose={() => setRecipeToDelete(null)}
        onConfirm={async () => {
          if (!recipeToDelete) return;
          await api.deleteSavedRecipe(recipeToDelete.id);
          await loadSavedRecipes();
        }}
      />

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onDetected={async (query) => {
          setPackagedQuery(query);
          try {
            const res = await api.searchUsda(query, '');
            if (res.available && res.foods && res.foods.length > 0) {
              selectPackagedFood(res.foods[0]);
              return;
            }
          } catch {
            // fallback to manual serving drawer
          }
          const parsed = decipherFoodText(query);
          if (parsed.items.length > 0) {
            setManualName(parsed.mealSummaryName);
            setManualCalories(String(parsed.totalCalories));
            setManualCarbs(String(parsed.totalCarbs));
            setManualFat(String(parsed.totalFat));
            setManualProtein(String(parsed.totalProtein));
            setManualServing('1 scanned package');
          } else {
            setManualName(`Scanned Item (${query})`);
            setManualCalories('210');
            setManualCarbs('24');
            setManualFat('8');
            setManualProtein('10');
            setManualServing('1 package');
          }
          setActiveTab('manual');
        }}
      />
    </div>
  );
};
