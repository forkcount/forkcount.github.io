import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Check,
  Sparkles,
  Mic,
  MicOff,
  Camera,
  Scan,
  AlertTriangle,
  Pencil,
  ChevronRight,
  ArrowLeft,
  Loader2,
  FileImage,
  Flame,
  Info,
  Bookmark
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import { supabase } from '../services/supabase.js';
import { BarcodeScannerModal } from './BarcodeScannerModal.js';
import { lookupBarcodeProduct, BarcodeProduct } from '../services/barcodeService.js';
import {
  decipherFoodText,
  recalculateDecipheredFoodWithGrams,
  extractUsdaCandidateQuery,
  DecipheredFoodResult,
  DecipheredFoodItem
} from '../utils/localAiEngine.js';
import type { MealType } from '../types/index.js';
import { SmartAiFoodInput } from './SmartAiFoodInput.js';

interface AddFoodModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMeal: MealType;
}

interface ScannedMenuDish {
  id: string;
  name: string;
  description?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  grams: number;
  servingLabel: string;
  statedOnMenu: boolean;
  goodToEatScore: 'green' | 'amber' | 'red';
  scoreReason: string;
}

interface UsdaSearchFoodCard {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const AddFoodModal: React.FC<AddFoodModalProps> = ({ isOpen, onClose, defaultMeal }) => {
  const {
    activeDate,
    diaryItems,
    addFoodItem,
    macroTarget,
    profile,
    lastSelectedMeal,
    setLastSelectedMeal,
    isGuest,
    openGuestLock,
    consumeGuestAiCall
  } = useApp();

  const [mealType, setMealType] = useState<MealType>(defaultMeal || lastSelectedMeal || 'breakfast');
  const [inputText, setInputText] = useState('');
  const [rawTypedText, setRawTypedText] = useState('');
  const [parsedResult, setParsedResult] = useState<DecipheredFoodResult | null>(null);
  const [gramOverrides, setGramOverrides] = useState<Record<number, number>>({});
  const [editingWeightIndex, setEditingWeightIndex] = useState<number | null>(null);
  const [userServingsEaten, setUserServingsEaten] = useState<string>('1');
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [recipeServingsOverride, setRecipeServingsOverride] = useState<number | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // USDA FoodData Central Search State
  const [isSearchingUsda, setIsSearchingUsda] = useState(false);
  const [usdaFoods, setUsdaFoods] = useState<UsdaSearchFoodCard[]>([]);
  const [usdaCompletedQuery, setUsdaCompletedQuery] = useState<string | null>(null);
  const [usdaRateLimited, setUsdaRateLimited] = useState(false);
  const [hasSelectedUsdaItem, setHasSelectedUsdaItem] = useState(false);
  const hasSelectedUsdaItemRef = useRef(false);
  const usdaSearchSeqRef = useRef(0);

  // Speech Recognition State
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(true);
  const recognitionRef = useRef<any>(null);

  // Menu Scanner State
  const [isScanningMenu, setIsScanningMenu] = useState(false);
  const [menuPhotos, setMenuPhotos] = useState<Array<{ base64Image: string; mimeType: string }>>([]);
  const [isAnalyzingMenu, setIsAnalyzingMenu] = useState(false);
  const [scannedDishes, setScannedDishes] = useState<ScannedMenuDish[]>([]);
  const [menuAdjustments, setMenuAdjustments] = useState<Record<string, number>>({}); // multiplier e.g. 1.0
  const [addedDishIds, setAddedDishIds] = useState<Record<string, boolean>>({});

  // Barcode quick scanner
  const [isBarcodeOpen, setIsBarcodeOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Remaining macros & user goal for menu recommendations
  const remainingMacros = useMemo(() => {
    const consumedKcal = (diaryItems || []).reduce((acc, i) => acc + (i.calories || 0), 0);
    const consumedP = (diaryItems || []).reduce((acc, i) => acc + (i.protein || 0), 0);
    const consumedC = (diaryItems || []).reduce((acc, i) => acc + (i.carbs || 0), 0);
    const consumedF = (diaryItems || []).reduce((acc, i) => acc + (i.fat || 0), 0);

    const targetKcal = macroTarget?.calories || 2000;
    const targetP = macroTarget?.proteinGrams || 140;
    const targetC = macroTarget?.carbsGrams || 200;
    const targetF = macroTarget?.fatGrams || 65;

    return {
      calories: Math.max(0, targetKcal - consumedKcal),
      protein: Math.max(0, targetP - consumedP),
      carbs: Math.max(0, targetC - consumedC),
      fat: Math.max(0, targetF - consumedF)
    };
  }, [diaryItems, macroTarget]);

  const userGoal = useMemo(() => {
    const g = profile?.goal || profile?.goalSpeed || '';
    if (typeof g === 'string') {
      if (g.toLowerCase().includes('lose')) return 'Lose';
      if (g.toLowerCase().includes('gain')) return 'Gain';
      if (g.toLowerCase().includes('recomp')) return 'Recomp';
    }
    return 'Maintain';
  }, [profile]);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
    }
  }, []);

  // Reset form on open
  useEffect(() => {
    if (isOpen) {
      setMealType(defaultMeal || lastSelectedMeal || 'breakfast');
      setInputText('');
      setRawTypedText('');
      setParsedResult(null);
      setGramOverrides({});
      setEditingWeightIndex(null);
      setUserServingsEaten('1');
      setIsSaving(false);
      setSaveSuccessMsg(null);
      setIsScanningMenu(false);
      setMenuPhotos([]);
      setScannedDishes([]);
      setAddedDishIds({});
      setIsSearchingUsda(false);
      setUsdaFoods([]);
      setUsdaCompletedQuery(null);
      setUsdaRateLimited(false);
      setHasSelectedUsdaItem(false);
      hasSelectedUsdaItemRef.current = false;
    }
  }, [isOpen, defaultMeal, lastSelectedMeal]);

  // Speech Recognition Handler
  const toggleSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText((prev) => {
            const next = prev.trim() ? `${prev.trim()} ${transcript}` : transcript;
            setRawTypedText(next);
            hasSelectedUsdaItemRef.current = false;
            setHasSelectedUsdaItem(false);
            return next;
          });
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch {
      setIsListening(false);
    }
  };

  // Recalculate parsed result whenever gram overrides change
  const activeResult = useMemo(() => {
    if (!parsedResult) return null;
    if (Object.keys(gramOverrides).length === 0) return parsedResult;
    return recalculateDecipheredFoodWithGrams(
      parsedResult,
      gramOverrides,
      macroTarget?.calories || 2000,
      mealType
    );
  }, [parsedResult, gramOverrides, macroTarget, mealType]);

  // Helper to calculate recipe scaling from servings, fractions, or free-text gram weights
  const calculateRecipeScale = (
    inputVal: string,
    totalGrams: number,
    totalCalories: number,
    defaultServings: number = 4
  ) => {
    const v = (inputVal || '1').trim();
    const lower = v.toLowerCase();

    // Fraction check
    if (lower === '½' || lower === '1/2' || lower === '0.5') {
      const scale = 0.5;
      return {
        scale,
        label: '½ of recipe',
        eatenGrams: Math.round(totalGrams * scale),
        eatenCalories: Math.round(totalCalories * scale)
      };
    }
    if (lower === '¼' || lower === '1/4' || lower === '0.25') {
      const scale = 0.25;
      return {
        scale,
        label: '¼ of recipe',
        eatenGrams: Math.round(totalGrams * scale),
        eatenCalories: Math.round(totalCalories * scale)
      };
    }
    if (lower === '⅓' || lower === '1/3') {
      const scale = 1 / 3;
      return {
        scale,
        label: '⅓ of recipe',
        eatenGrams: Math.round(totalGrams * scale),
        eatenCalories: Math.round(totalCalories * scale)
      };
    }
    if (lower === '¾' || lower === '3/4' || lower === '0.75') {
      const scale = 0.75;
      return {
        scale,
        label: '¾ of recipe',
        eatenGrams: Math.round(totalGrams * scale),
        eatenCalories: Math.round(totalCalories * scale)
      };
    }
    if (lower === 'all' || lower === 'whole' || lower === '100%') {
      return {
        scale: 1.0,
        label: 'Entire recipe',
        eatenGrams: totalGrams,
        eatenCalories: totalCalories
      };
    }

    // Free-text grams check: e.g. "120g", "120 grams", "100 g", or free-text number greater than defaultServings
    const gramMatch = lower.match(/^(\d+(?:[.,]\d+)?)\s*(?:g|grams?)?$/i);
    const num = parseFloat(v.replace(',', '.'));
    if (gramMatch && !Number.isNaN(num) && (num > defaultServings || lower.includes('g'))) {
      const safeG = Math.max(1, num);
      const scale = totalGrams > 0 ? safeG / totalGrams : 1.0;
      return {
        scale,
        label: `${Math.round(safeG)}g portion`,
        eatenGrams: Math.round(safeG),
        eatenCalories: Math.round(totalCalories * scale)
      };
    }

    // Servings number input
    if (!Number.isNaN(num) && num > 0) {
      const scale = num / defaultServings;
      return {
        scale,
        label: `${num} of ${defaultServings} servings`,
        eatenGrams: Math.round(totalGrams * scale),
        eatenCalories: Math.round(totalCalories * scale)
      };
    }

    const scale = 1 / defaultServings;
    return {
      scale,
      label: `1 of ${defaultServings} servings`,
      eatenGrams: Math.round(totalGrams * scale),
      eatenCalories: Math.round(totalCalories * scale)
    };
  };

  useEffect(() => {
    if (isOpen) {
      setIsSubmitted(false);
      setIsSaving(false);
      setFormError(null);
    }
  }, [isOpen]);

  const usdaCandidate = useMemo(() => extractUsdaCandidateQuery(rawTypedText), [rawTypedText]);

  // 800ms debounced USDA FoodData Central search when typed food is NOT in the built-in list
  useEffect(() => {
    if (!isOpen) return;

    if (!usdaCandidate.shouldSearchUsda || !usdaCandidate.cleanQuery) {
      setIsSearchingUsda(false);
      setUsdaFoods([]);
      setUsdaCompletedQuery(null);
      setUsdaRateLimited(false);
      return;
    }

    const queryToSearch = usdaCandidate.cleanQuery;
    const seq = ++usdaSearchSeqRef.current;

    const timer = setTimeout(async () => {
      setIsSearchingUsda(true);
      setUsdaRateLimited(false);

      try {
        let payload: any = null;
        const { data, error } = await supabase.functions.invoke('search-usda', {
          body: { query: queryToSearch }
        });

        if (!error && data) {
          payload = data;
        } else {
          // Server-side fallback proxy if the Edge Function has not been deployed yet (never uses client-side keys)
          const fallbackRes = await fetch('/api/usda/fdc-search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: queryToSearch })
          });
          if (fallbackRes.ok) {
            payload = await fallbackRes.json();
          }
        }

        if (seq !== usdaSearchSeqRef.current) return;

        if (payload?.error === 'rate_limit') {
          setUsdaRateLimited(true);
          setUsdaFoods([]);
          setUsdaCompletedQuery(queryToSearch);
        } else {
          const list = Array.isArray(payload?.foods) ? payload.foods : [];
          setUsdaFoods(
            list.map((f: any) => ({
              name: String(f?.name || 'Food'),
              kcal: Math.round(Number(f?.kcal) || 0),
              protein: Math.round((Number(f?.protein) || 0) * 10) / 10,
              carbs: Math.round((Number(f?.carbs) || 0) * 10) / 10,
              fat: Math.round((Number(f?.fat) || 0) * 10) / 10
            }))
          );
          setUsdaCompletedQuery(queryToSearch);
        }
      } catch {
        if (seq !== usdaSearchSeqRef.current) return;
        setUsdaFoods([]);
        setUsdaCompletedQuery(queryToSearch);
      } finally {
        if (seq === usdaSearchSeqRef.current) {
          setIsSearchingUsda(false);
        }
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [isOpen, usdaCandidate.shouldSearchUsda, usdaCandidate.cleanQuery]);

  // Tap handler for USDA FoodData Central cards: adds item to meal with editable gram input (default 100g)
  const handleSelectUsdaCard = (food: UsdaSearchFoodCard) => {
    const newItem: DecipheredFoodItem = {
      rawText: food.name,
      name: food.name,
      grams: 100,
      isEstimatedWeight: false,
      needsWeightConfirmation: false,
      servingLabel: '100g',
      calories: Math.round(food.kcal),
      protein: Math.round(food.protein * 10) / 10,
      carbs: Math.round(food.carbs * 10) / 10,
      fat: Math.round(food.fat * 10) / 10,
      fiber: 0,
      sugar: 0,
      sodiumMg: 0,
      caffeineMg: 0,
      standardDrinks: 0,
      caloriesPer100g: food.kcal,
      proteinPer100g: food.protein,
      carbsPer100g: food.carbs,
      fatPer100g: food.fat,
      fiberPer100g: 0,
      sugarPer100g: 0,
      sodiumMgPer100g: 0,
      category: 'processed'
    };

    const existingItems =
      hasSelectedUsdaItemRef.current && parsedResult && !parsedResult.isRecipe
        ? parsedResult.items
        : [];
    const combinedItems = [...existingItems, newItem];
    const nextOverrides: Record<number, number> = {};
    combinedItems.forEach((it, idx) => {
      nextOverrides[idx] = idx < existingItems.length ? (gramOverrides[idx] ?? it.grams) : 100;
    });

    const baseSummary: DecipheredFoodResult = {
      mealSummaryName:
        combinedItems.length === 1
          ? newItem.name
          : `${combinedItems[0].name} + ${combinedItems.length - 1} more`,
      items: combinedItems,
      needsWeightConfirmation: false,
      hasItemOver5kg: false,
      isOver5000Kcal: false,
      isExtremeCalorieMeal: false,
      usedFallbackReference: false,
      referenceDailyGoal: macroTarget?.calories || 2000,
      totalCalories: combinedItems.reduce((s, i) => s + i.calories, 0),
      totalProtein: Math.round(combinedItems.reduce((s, i) => s + i.protein, 0) * 10) / 10,
      totalCarbs: Math.round(combinedItems.reduce((s, i) => s + i.carbs, 0) * 10) / 10,
      totalFat: Math.round(combinedItems.reduce((s, i) => s + i.fat, 0) * 10) / 10,
      totalFiber: 0,
      totalSugar: 0,
      totalSodiumMg: 0,
      totalCaffeineMg: 0,
      totalStandardDrinks: 0,
      healthRating: 8,
      healthLabel: 'Nutrition data from USDA FoodData Central (per 100g).',
      whatToAdd: [],
      whatToTakeOut: [],
      isRecipe: false
    };

    const recalculated = recalculateDecipheredFoodWithGrams(
      baseSummary,
      nextOverrides,
      macroTarget?.calories || 2000,
      mealType
    );

    hasSelectedUsdaItemRef.current = true;
    setHasSelectedUsdaItem(true);
    if (!inputText.trim() && rawTypedText.trim()) {
      setInputText(rawTypedText);
    }
    setParsedResult(recalculated);
    setGramOverrides(nextOverrides);
    setEditingWeightIndex(combinedItems.length - 1);
    setFormError(null);
  };

  // Real-time input parsing: automatically deciphers built-in foods and recipes as user types or pastes
  useEffect(() => {
    if (hasSelectedUsdaItemRef.current) {
      return;
    }

    const trimmed = inputText.trim();
    if (!trimmed) {
      setParsedResult(null);
      setGramOverrides({});
      setFormError(null);
      return;
    }

    // Check if input looks like a barcode number (e.g. 3800748051053 or UPC 3800748051053)
    const barcodeMatch = trimmed.match(/^(?:upc|ean|barcode)?\s*[:#]?\s*(\d{8,14})$/i);
    if (barcodeMatch) {
      const cleanCode = barcodeMatch[1];
      const timer = setTimeout(async () => {
        const prod = await lookupBarcodeProduct(cleanCode);
        if (prod) {
          const item: DecipheredFoodItem = {
            rawText: prod.name,
            name: prod.name,
            grams: prod.servingGrams,
            needsWeightConfirmation: false,
            servingLabel: prod.servingLabel,
            calories: prod.totalCalories,
            protein: prod.totalProtein,
            carbs: prod.totalCarbs,
            fat: prod.totalFat,
            fiber: prod.fiberPer100g ? Math.round(prod.fiberPer100g * (prod.servingGrams / 100) * 10) / 10 : 0,
            sugar: prod.sugarPer100g ? Math.round(prod.sugarPer100g * (prod.servingGrams / 100) * 10) / 10 : 0,
            sodiumMg: prod.sodiumMgPer100g ? Math.round(prod.sodiumMgPer100g * (prod.servingGrams / 100)) : 0,
            caffeineMg: 0,
            standardDrinks: 0,
            caloriesPer100g: prod.caloriesPer100g,
            proteinPer100g: prod.proteinPer100g,
            carbsPer100g: prod.carbsPer100g,
            fatPer100g: prod.fatPer100g,
            fiberPer100g: prod.fiberPer100g,
            sugarPer100g: prod.sugarPer100g,
            sodiumMgPer100g: prod.sodiumMgPer100g,
            category: 'packaged' as any
          };
          setParsedResult({
            mealSummaryName: prod.name,
            items: [item],
            needsWeightConfirmation: false,
            hasItemOver5kg: false,
            isOver5000Kcal: false,
            isExtremeCalorieMeal: false,
            usedFallbackReference: false,
            referenceDailyGoal: macroTarget?.calories || 2000,
            totalCalories: prod.totalCalories,
            totalProtein: prod.totalProtein,
            totalCarbs: prod.totalCarbs,
            totalFat: prod.totalFat,
            totalFiber: item.fiber,
            totalSugar: item.sugar,
            totalSodiumMg: item.sodiumMg,
            totalCaffeineMg: 0,
            totalStandardDrinks: 0,
            healthRating: 8,
            healthLabel: 'Scanned Item',
            whatToAdd: [],
            whatToTakeOut: [],
            isRecipe: false
          });
          setGramOverrides({});
          setFormError(null);
        } else {
          setParsedResult(null);
          setFormError(`Product not found. You can type the food instead. (Barcode: ${cleanCode})`);
        }
      }, 300);
      return () => clearTimeout(timer);
    }

    // If the typed food is NOT in the built-in list, let USDA search handle it instead of guessing
    const checkUsda = extractUsdaCandidateQuery(trimmed);
    if (checkUsda.shouldSearchUsda) {
      setParsedResult(null);
      setGramOverrides({});
      setFormError(null);
      return;
    }

    const timer = setTimeout(() => {
      if (hasSelectedUsdaItemRef.current) return;
      const parsed = decipherFoodText(trimmed, macroTarget?.calories || 2000, mealType);
      setParsedResult(parsed);
      setGramOverrides({});
      setFormError(null);
    }, 400);

    return () => clearTimeout(timer);
  }, [inputText, macroTarget, mealType]);

  // Check if form has valid food items with nutrition data
  const hasValidItems = useMemo(() => {
    if (activeResult && activeResult.items.length > 0) {
      const cal = activeResult.items.reduce((s, i) => s + (i.calories || 0), 0);
      const p = activeResult.items.reduce((s, i) => s + (i.protein || 0), 0);
      const c = activeResult.items.reduce((s, i) => s + (i.carbs || 0), 0);
      const f = activeResult.items.reduce((s, i) => s + (i.fat || 0), 0);
      return cal > 0 || p > 0 || c > 0 || f > 0;
    }
    return false;
  }, [activeResult]);

  // Check if user has entered food with parsed items (used to gate result card display)
  const hasParsedItems = useMemo(() => {
    return Boolean(
      (inputText.trim() || rawTypedText.trim() || hasSelectedUsdaItem) &&
      activeResult &&
      activeResult.items &&
      activeResult.items.length > 0 &&
      activeResult.items.some(
        (it) => it.name && it.name.trim().length > 0 && (it.calories > 0 || it.grams > 0 || it.protein > 0 || it.carbs > 0 || it.fat > 0)
      )
    );
  }, [inputText, rawTypedText, hasSelectedUsdaItem, activeResult]);

  // Unified Log action: reads parsed item(s), saves to database diary, resets form, and navigates back to Diary
  const handleLogAndSave = async (eOrExplicitText?: React.FormEvent | string) => {
    if (eOrExplicitText && typeof eOrExplicitText !== 'string' && 'preventDefault' in eOrExplicitText) {
      eOrExplicitText.preventDefault();
    }
    if (isSaving) return;

    if (isGuest && !consumeGuestAiCall()) {
      openGuestLock();
      return;
    }

    const explicitText = typeof eOrExplicitText === 'string' ? eOrExplicitText : inputText;
    const trimmed = explicitText.trim();

    // Determine current items to log
    let targetResult = activeResult;
    if (!targetResult || targetResult.items.length === 0 || (trimmed && trimmed !== inputText.trim())) {
      if (!trimmed) {
        setFormError('Add a food first.');
        return;
      }
      targetResult = decipherFoodText(trimmed, macroTarget?.calories || 2000, mealType);
      setParsedResult(targetResult);
    }

    if (!targetResult || targetResult.items.length === 0) {
      setFormError('Add a food first.');
      return;
    }

    // Never log 0 calories as a real item: check for valid nutrition data
    const allTotalCal = targetResult.items.reduce((s, i) => s + (i.calories || 0), 0);
    const allTotalP = targetResult.items.reduce((s, i) => s + (i.protein || 0), 0);
    const allTotalC = targetResult.items.reduce((s, i) => s + (i.carbs || 0), 0);
    const allTotalF = targetResult.items.reduce((s, i) => s + (i.fat || 0), 0);
    if (allTotalCal <= 0 && allTotalP <= 0 && allTotalC <= 0 && allTotalF <= 0) {
      setFormError('Add a food first.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const isRecipe = Boolean(targetResult.isRecipe);
      const totalRecipeGrams = targetResult.totalRecipeGrams || targetResult.items.reduce((s, i) => s + (i.grams || 0), 0);
      const servingsCount = recipeServingsOverride || targetResult.recipeServings || 4;

      if (isRecipe) {
        // Calculate portion scaling from fraction, grams, or servings
        const portion = calculateRecipeScale(
          userServingsEaten,
          totalRecipeGrams,
          targetResult.totalCalories,
          servingsCount
        );
        const recipeScale = portion.scale;

        const totalCals = Math.round(targetResult.totalCalories * recipeScale);
        const totalP = Math.round(targetResult.totalProtein * recipeScale * 10) / 10;
        const totalC = Math.round(targetResult.totalCarbs * recipeScale * 10) / 10;
        const totalF = Math.round(targetResult.totalFat * recipeScale * 10) / 10;
        const totalFib = Math.round(targetResult.totalFiber * recipeScale * 10) / 10;
        const totalSug = Math.round(targetResult.totalSugar * recipeScale * 10) / 10;
        const totalSod = Math.round(targetResult.totalSodiumMg * recipeScale);

        await addFoodItem({
          name: `${targetResult.mealSummaryName || 'Recipe'} (${portion.label})`,
          calories: totalCals,
          protein: totalP,
          carbs: totalC,
          fat: totalF,
          fiber: totalFib,
          sugar: totalSug,
          sodium: totalSod,
          serving: `${portion.eatenGrams}g`,
          mealType,
          date: activeDate,
          source: 'recipe'
        });
      } else if (targetResult.items.length === 1) {
        // Single food item
        const item = targetResult.items[0];
        await addFoodItem({
          name: item.name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          fiber: item.fiber,
          sugar: item.sugar,
          sodium: item.sodiumMg,
          serving: item.servingLabel,
          mealType,
          date: activeDate,
          source: 'ai'
        });
      } else {
        // Multiple food items: log each item
        for (const item of targetResult.items) {
          await addFoodItem({
            name: item.name,
            calories: item.calories,
            protein: item.protein,
            carbs: item.carbs,
            fat: item.fat,
            fiber: item.fiber,
            sugar: item.sugar,
            sodium: item.sodiumMg,
            serving: item.servingLabel,
            mealType,
            date: activeDate,
            source: 'ai'
          });
        }
      }

      // Cleanly blur input to close soft keyboard on mobile
      if (typeof document !== 'undefined' && document.activeElement && 'blur' in document.activeElement) {
        (document.activeElement as HTMLElement).blur();
      }

      // Do not re-render the Add Food screen after Log is tapped:
      // Immediately set isSubmitted and trigger onClose to navigate back to Diary
      setIsSubmitted(true);
      onClose();

      // Reset form in background
      setInputText('');
      setParsedResult(null);
      setGramOverrides({});
      setUserServingsEaten('1');
    } catch (err: any) {
      console.error('Failed to log food:', err);
      setFormError(err?.message || 'Failed to save food.');
      setIsSaving(false);
    }
  };

  const handleSaveMeal = async () => {
    if (!activeResult || !hasValidItems || isSavingMeal) return;
    setIsSavingMeal(true);
    setSaveSuccessMsg(null);
    setFormError(null);
    try {
      const mealName = activeResult.mealSummaryName || 'Saved Meal';
      const itemsToSave = activeResult.items.map((it, idx) => {
        const grams = Object.prototype.hasOwnProperty.call(gramOverrides, idx) ? gramOverrides[idx] : it.grams;
        const scale = it.grams > 0 ? grams / it.grams : 1;
        return {
          name: it.name,
          calories: Math.round(it.calories * scale),
          protein: Math.round(it.protein * scale * 10) / 10,
          carbs: Math.round(it.carbs * scale * 10) / 10,
          fat: Math.round(it.fat * scale * 10) / 10,
          serving: `${grams}g`,
          mealType
        };
      });

      await api.saveMealDirect(mealName, itemsToSave);
      setSaveSuccessMsg(`Saved "${mealName}" to your saved meals!`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save meal.');
    } finally {
      setIsSavingMeal(false);
    }
  };

  // Menu photo upload handler
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newPhotos: Array<{ base64Image: string; mimeType: string }> = [];
    const readNext = (idx: number) => {
      if (idx >= files.length) {
        setMenuPhotos((prev) => [...prev, ...newPhotos]);
        return;
      }
      const file = files[idx];
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          newPhotos.push({
            base64Image: reader.result,
            mimeType: file.type || 'image/jpeg'
          });
        }
        readNext(idx + 1);
      };
      reader.readAsDataURL(file);
    };
    readNext(0);
    // Reset file input value so user can re-upload if needed
    e.target.value = '';
  };

  // Analyze menu photos
  const handleAnalyzeMenu = async () => {
    if (menuPhotos.length === 0 || isAnalyzingMenu) return;

    if (isGuest && !consumeGuestAiCall()) {
      openGuestLock();
      return;
    }

    setIsAnalyzingMenu(true);
    try {
      const res = await api.scanMenu(menuPhotos, userGoal, remainingMacros);
      if (res && Array.isArray(res.dishes)) {
        setScannedDishes(res.dishes);
      }
    } catch (err) {
      console.error('Error analyzing menu:', err);
    } finally {
      setIsAnalyzingMenu(false);
    }
  };

  // Add individual dish from scanned menu
  const handleAddScannedDish = async (dish: ScannedMenuDish) => {
    const factor = menuAdjustments[dish.id] || 1.0;
    const finalKcal = Math.round(dish.calories * factor);
    const finalP = Math.round(dish.protein * factor * 10) / 10;
    const finalC = Math.round(dish.carbs * factor * 10) / 10;
    const finalF = Math.round(dish.fat * factor * 10) / 10;
    const finalGrams = Math.round(dish.grams * factor);

    try {
      await addFoodItem({
        name: dish.name,
        calories: finalKcal,
        protein: finalP,
        carbs: finalC,
        fat: finalF,
        serving: `${finalGrams}g (${dish.servingLabel})`,
        mealType,
        date: activeDate,
        source: 'restaurant'
      });
      setAddedDishIds((prev) => ({ ...prev, [dish.id]: true }));
    } catch (err) {
      console.error('Failed to add dish:', err);
    }
  };

  if (!isOpen || isSubmitted) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center overflow-hidden h-[100dvh]">
      <div className="bg-zinc-900 border-t sm:border border-zinc-800 rounded-t-2xl sm:rounded-2xl max-w-lg w-full h-[100dvh] sm:h-auto sm:max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-100">Add to</span>
            <select
              value={mealType}
              onChange={(e) => {
                const next = e.target.value as MealType;
                setMealType(next);
                setLastSelectedMeal(next);
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
            <button
              type="button"
              onClick={() => setIsBarcodeOpen(true)}
              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-300 flex items-center gap-1.5 text-xs font-medium transition-colors"
              title="Scan barcode"
            >
              <Scan className="w-3.5 h-3.5" />
              <span>Scan Barcode</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body / Content area */}
        <div
          className="content p-4 overflow-y-auto flex-1 space-y-4 pb-[120px]"
          style={{ scrollBehavior: 'auto' }}
        >
          {saveSuccessMsg && (
            <div className="p-3 bg-teal-950/80 border border-teal-500/50 rounded-xl flex items-center gap-2 text-teal-300 text-xs font-semibold animate-in fade-in duration-200">
              <Check className="w-4 h-4 text-teal-400" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* MENU SCANNER VIEW */}
          {isScanningMenu ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsScanningMenu(false)}
                  className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Smart AI Box</span>
                </button>
                <span className="text-xs font-semibold text-teal-400">Menu Scanner</span>
              </div>

              {/* Upload Multiple Photos */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-zinc-200">Menu Photos</h3>
                    <p className="text-[11px] text-zinc-400">
                      Snap or upload multiple pages for full menus.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-200 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-teal-400" />
                    <span>Add Photo</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                </div>

                {menuPhotos.length === 0 ? (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-zinc-800 hover:border-teal-500/50 rounded-xl p-6 text-center cursor-pointer transition-colors bg-zinc-900/40"
                  >
                    <Camera className="w-8 h-8 text-zinc-500 mx-auto mb-2" />
                    <p className="text-xs font-medium text-zinc-300">Tap to upload menu photos</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Take photos of multiple pages</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {menuPhotos.map((photo, idx) => (
                        <div key={idx} className="relative shrink-0 w-20 h-24 rounded-lg overflow-hidden border border-zinc-700 bg-zinc-900 group">
                          <img src={photo.base64Image} alt={`Menu page ${idx + 1}`} className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setMenuPhotos((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 p-1 rounded-md bg-black/70 hover:bg-rose-900 text-rose-300 transition-colors"
                            title="Remove photo"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                          <span className="absolute bottom-1 left-1 px-1 py-0.5 bg-black/70 text-[9px] font-mono text-zinc-300 rounded">
                            Pg {idx + 1}
                          </span>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-20 h-24 shrink-0 rounded-lg border border-dashed border-zinc-700 hover:border-teal-500/50 flex flex-col items-center justify-center gap-1 text-zinc-400 hover:text-teal-300 transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-[10px]">Add page</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      disabled={isAnalyzingMenu}
                      onClick={handleAnalyzeMenu}
                      className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
                    >
                      {isAnalyzingMenu ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Reading menu with AI...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>Analyze Menu ({menuPhotos.length} {menuPhotos.length === 1 ? 'page' : 'pages'})</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Scanned Dishes Results */}
              {scannedDishes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                      Identified Dishes ({scannedDishes.length})
                    </span>
                    <span className="text-[11px] text-zinc-400">
                      Goal: <strong className="text-zinc-200">{userGoal}</strong> · Remaining: <strong className="text-teal-300">{remainingMacros.calories} kcal</strong>
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {scannedDishes.map((dish) => {
                      const factor = menuAdjustments[dish.id] || 1.0;
                      const kcal = Math.round(dish.calories * factor);
                      const p = Math.round(dish.protein * factor * 10) / 10;
                      const c = Math.round(dish.carbs * factor * 10) / 10;
                      const f = Math.round(dish.fat * factor * 10) / 10;
                      const grams = Math.round(dish.grams * factor);
                      const isAdded = Boolean(addedDishIds[dish.id]);

                      const scoreBadgeClass =
                        dish.goodToEatScore === 'green'
                          ? 'bg-teal-500/20 text-teal-300 border-teal-500/40'
                          : dish.goodToEatScore === 'amber'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/40';

                      const scoreLabel =
                        dish.goodToEatScore === 'green'
                          ? 'Good to eat'
                          : dish.goodToEatScore === 'amber'
                          ? 'Moderate fit'
                          : 'Heavy choice';

                      return (
                        <div
                          key={dish.id}
                          className="p-3 bg-zinc-950 border border-zinc-800 rounded-xl space-y-2 transition-colors hover:border-zinc-700"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-xs font-bold text-zinc-100 truncate">{dish.name}</h4>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${scoreBadgeClass}`}>
                                  {scoreLabel}
                                </span>
                              </div>
                              {dish.description && (
                                <p className="text-[11px] text-zinc-400 line-clamp-2 mt-0.5">{dish.description}</p>
                              )}
                            </div>
                            <span className="text-xs font-mono font-bold text-teal-400 shrink-0">
                              {kcal} kcal
                            </span>
                          </div>

                          {/* Nutrition and score reason */}
                          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 bg-zinc-900/70 px-2.5 py-1.5 rounded-lg border border-zinc-850">
                            <span>{grams}g</span>
                            <span>{p}g protein</span>
                            <span>{c}g carbs</span>
                            <span>{f}g fat</span>
                            <span className="text-[10px] text-zinc-500">
                              {dish.statedOnMenu ? 'Menu stats' : 'Estimated'}
                            </span>
                          </div>

                          <p className="text-[11px] text-zinc-400 italic">
                            💡 {dish.scoreReason}
                          </p>

                          {/* Portion adjuster and Add Button */}
                          <div className="flex items-center justify-between pt-1 gap-2">
                            <div className="flex items-center gap-1 text-[11px]">
                              <span className="text-zinc-500 text-[10px]">Portion:</span>
                              {[0.5, 1.0, 1.5].map((mult) => (
                                <button
                                  key={mult}
                                  type="button"
                                  onClick={() => setMenuAdjustments((prev) => ({ ...prev, [dish.id]: mult }))}
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
                                    factor === mult
                                      ? 'bg-teal-500/30 text-teal-300 border border-teal-500/50'
                                      : 'bg-zinc-900 text-zinc-400 hover:text-zinc-200'
                                  }`}
                                >
                                  {mult === 0.5 ? '½' : mult === 1.0 ? '1x' : '1.5x'}
                                </button>
                              ))}
                            </div>

                            <button
                              type="button"
                              disabled={isAdded}
                              onClick={() => handleAddScannedDish(dish)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                                isAdded
                                  ? 'bg-zinc-800 text-teal-400 cursor-default'
                                  : 'bg-teal-500 hover:bg-teal-400 text-zinc-950'
                              }`}
                            >
                              {isAdded ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  <span>Added</span>
                                </>
                              ) : (
                                <>
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* SMART AI BOX (The Only Input) */
            <div className="space-y-4">
              <div className="space-y-2.5">
                <SmartAiFoodInput
                  value={inputText}
                  onRawChange={(val) => {
                    setRawTypedText(val);
                    hasSelectedUsdaItemRef.current = false;
                    setHasSelectedUsdaItem(false);
                    if (!val.trim()) {
                      setParsedResult(null);
                      setGramOverrides({});
                    }
                    if (formError) setFormError(null);
                  }}
                  onChange={(val) => {
                    setInputText(val);
                    if (formError) setFormError(null);
                  }}
                  onSubmit={(val) => handleLogAndSave(val)}
                  onClear={() => {
                    setInputText('');
                    setRawTypedText('');
                    setParsedResult(null);
                    setFormError(null);
                    setGramOverrides({});
                    setIsSearchingUsda(false);
                    setUsdaFoods([]);
                    setUsdaCompletedQuery(null);
                    setUsdaRateLimited(false);
                    hasSelectedUsdaItemRef.current = false;
                    setHasSelectedUsdaItem(false);
                  }}
                  isListening={isListening}
                  speechSupported={speechSupported}
                  onToggleSpeech={toggleSpeechRecognition}
                />

                {formError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* USDA FoodData Central Search Results (when food is not in built-in list) */}
                {usdaCandidate.shouldSearchUsda && (
                  <div className="space-y-2">
                    {isSearchingUsda ? (
                      <div
                        role="status"
                        aria-live="polite"
                        className="p-3.5 bg-zinc-950 border border-teal-500/30 rounded-2xl flex items-center justify-center gap-2 text-xs font-semibold text-teal-300"
                      >
                        <Loader2 className="w-4 h-4 animate-spin text-teal-400 shrink-0" />
                        <span>Searching USDA...</span>
                      </div>
                    ) : usdaRateLimited ? (
                      <div className="p-3.5 bg-zinc-950 border border-amber-500/30 rounded-2xl text-xs text-amber-300 text-center">
                        USDA rate limit reached. Please wait a moment and try again.
                      </div>
                    ) : usdaFoods.length > 0 ? (
                      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-3 space-y-2">
                        <div className="flex items-center justify-between px-0.5">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400">
                            USDA Results (per 100g)
                          </span>
                          <span className="text-[10px] text-zinc-400">Tap a food to add</span>
                        </div>
                        <div className="space-y-1.5 max-h-56 overflow-y-auto pr-0.5">
                          {usdaFoods.map((food, idx) => (
                            <button
                              key={`${food.name}-${idx}`}
                              type="button"
                              onClick={() => handleSelectUsdaCard(food)}
                              className="w-full text-left p-2.5 rounded-xl bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-800 hover:border-teal-500/50 transition-colors flex items-center justify-between gap-2.5 group"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-semibold text-zinc-100 block truncate group-hover:text-teal-300 transition-colors">
                                  {food.name}
                                </span>
                                <span className="text-[11px] font-mono text-zinc-400 block mt-0.5">
                                  {food.kcal} kcal · {food.protein}g P · {food.carbs}g C · {food.fat}g F
                                </span>
                              </div>
                              <span className="px-2 py-1 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-500/30 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0">
                                <Plus className="w-3 h-3" />
                                <span>100g</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : usdaCompletedQuery === usdaCandidate.cleanQuery ? (
                      <div className="p-3.5 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs text-zinc-400 text-center">
                        No results in USDA. Try a different name.
                      </div>
                    ) : null}
                  </div>
                )}

                {/* Actions: Scan Menu Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsScanningMenu(true)}
                    className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                    title="Scan restaurant menu photos"
                  >
                    <Camera className="w-4 h-4 text-teal-400" />
                    <span>Scan Menu</span>
                  </button>
                </div>
              </div>

              {/* NUTRITION BREAKDOWN PANEL: Visible at all times below Smart AI input */}
              {hasParsedItems && activeResult ? (
                <div className="bg-zinc-950 border border-teal-500/40 rounded-2xl p-4 space-y-4 animate-in fade-in duration-200">
                  {/* Result Header */}
                  <div className="flex items-start justify-between gap-2 border-b border-zinc-850 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-zinc-100">
                          {activeResult.mealSummaryName}
                        </h3>
                        {activeResult.isRecipe && (
                          <span className="px-2 py-0.5 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-300 text-[10px] font-bold">
                            Recipe ({activeResult.recipeServings || 4} servings)
                          </span>
                        )}
                        {!activeResult.isRecipe && activeResult.items.length > 1 && (
                          <span className="px-2 py-0.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-medium">
                            {activeResult.items.length} items
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        {activeResult.isRecipe
                          ? 'Parsed entire recipe with per-serving & total macro breakdown'
                          : 'Calculated nutritional breakdown from weight'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-lg font-mono font-extrabold text-teal-400 block">
                        {activeResult.isRecipe
                          ? `${Math.round(activeResult.totalCalories / (activeResult.recipeServings || 4))} kcal`
                          : `${activeResult.totalCalories} kcal`}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {activeResult.isRecipe ? 'per serving' : 'total'}
                      </span>
                    </div>
                  </div>

                  {/* Total Macros Bar */}
                  <div className="grid grid-cols-4 gap-2 bg-zinc-900/80 p-2.5 rounded-xl border border-zinc-850 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Calories</span>
                      <span className="text-xs font-bold text-zinc-200">{activeResult.totalCalories}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-teal-400 uppercase block">Protein</span>
                      <span className="text-xs font-bold text-teal-300">{activeResult.totalProtein}g</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-blue-400 uppercase block">Carbs</span>
                      <span className="text-xs font-bold text-blue-300">{activeResult.totalCarbs}g</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-400 uppercase block">Fat</span>
                      <span className="text-xs font-bold text-amber-300">{activeResult.totalFat}g</span>
                    </div>
                  </div>

                  {/* Confirm Weights Step (Editable item portions) */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-zinc-300 uppercase tracking-wider">
                        Confirm Weights &amp; Items
                      </span>
                      <span className="text-[10px] text-zinc-500">Tap weight to edit portion</span>
                    </div>

                    <div className="space-y-1.5">
                      {activeResult.items.map((item, idx) => {
                        const hasOverride = Object.prototype.hasOwnProperty.call(gramOverrides, idx);
                        const currentGrams = hasOverride ? gramOverrides[idx] : item.grams;
                        const isEditing = editingWeightIndex === idx;

                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-xl bg-zinc-900/80 border transition-colors ${
                              item.needsWeightConfirmation
                                ? 'border-amber-500/50 bg-amber-950/20'
                                : 'border-zinc-800'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <span className="text-xs font-semibold text-zinc-200 block truncate">
                                  {item.name}
                                </span>
                                <span className="text-[10px] font-mono text-zinc-400 block truncate">
                                  {item.calories} kcal · {item.protein}p · {item.carbs}c · {item.fat}f
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {hasSelectedUsdaItem || isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      aria-label={`Grams for ${item.name}`}
                                      value={currentGrams === 0 && !hasOverride ? '' : currentGrams}
                                      placeholder="100"
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const num = raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0);
                                        setGramOverrides((prev) => ({ ...prev, [idx]: num }));
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault();
                                          if (!hasSelectedUsdaItem) {
                                            setEditingWeightIndex(null);
                                          }
                                        }
                                      }}
                                      onBlur={() => {
                                        if (!hasSelectedUsdaItem) {
                                          setEditingWeightIndex(null);
                                        }
                                      }}
                                      className="w-16 bg-zinc-950 border border-teal-500 rounded px-1.5 py-0.5 text-right font-mono text-xs text-zinc-100 focus:outline-none"
                                    />
                                    <span className="text-[11px] font-mono text-zinc-400">g</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditingWeightIndex(idx)}
                                    className={`px-2 py-1 rounded border text-[11px] font-mono flex items-center gap-1 transition-colors ${
                                      item.needsWeightConfirmation
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                        : 'bg-zinc-950 hover:bg-zinc-800 border-zinc-750 text-zinc-200'
                                    }`}
                                    title="Edit weight"
                                  >
                                    <span>{currentGrams}g</span>
                                    <Pencil className="w-3 h-3 text-teal-400" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Health Rating (out of 10) + One Line of Advice */}
                  <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-200">Health Rating</span>
                      <span
                        className={`text-xs font-mono font-extrabold px-2 py-0.5 rounded-md ${
                          activeResult.healthRating >= 7.5
                            ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                            : activeResult.healthRating >= 5.5
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        }`}
                      >
                        {activeResult.healthRating} / 10
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          activeResult.healthRating >= 7.5
                            ? 'bg-teal-400'
                            : activeResult.healthRating >= 5.5
                            ? 'bg-amber-400'
                            : 'bg-rose-400'
                        }`}
                        style={{ width: `${Math.min(100, activeResult.healthRating * 10)}%` }}
                      />
                    </div>

                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                      💡 {activeResult.healthLabel || activeResult.whatToAdd[0] || 'Nutrient-rich, well-portioned choice.'}
                    </p>
                  </div>

                  {/* Recipe Servings Input: "How much did you eat?" (For recipes only) */}
                  {activeResult.isRecipe && (() => {
                    const totalGrams = activeResult.totalRecipeGrams || activeResult.items.reduce((s, i) => s + (i.grams || 0), 0);
                    const portion = calculateRecipeScale(userServingsEaten, totalGrams, activeResult.totalCalories, activeResult.recipeServings || 4);

                    return (
                      <div className="bg-zinc-900/90 border border-teal-500/30 rounded-xl p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-zinc-100 flex items-center gap-1.5">
                            <span>How much did you eat?</span>
                          </label>
                          <span className="text-[11px] font-mono text-teal-400 font-semibold">
                            Total Recipe: {totalGrams}g ({activeResult.totalCalories} kcal)
                          </span>
                        </div>

                        {/* Servings count editor */}
                        <div className="flex items-center justify-between py-1 px-2.5 bg-zinc-950 rounded-lg border border-zinc-850 text-xs">
                          <span className="text-zinc-400">Recipe yields:</span>
                          <div className="flex items-center gap-1.5 font-mono">
                            <input
                              type="number"
                              min="1"
                              max="100"
                              value={recipeServingsOverride || activeResult.recipeServings || 4}
                              onChange={(e) => {
                                const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                                setRecipeServingsOverride(val);
                              }}
                              className="w-14 bg-zinc-900 border border-zinc-700 rounded px-1.5 py-0.5 text-center text-xs font-mono text-teal-300 focus:outline-none focus:border-teal-500"
                            />
                            <span className="text-zinc-500 text-[11px]">servings</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          {['½', '¼', '⅓', '¾', 'All'].map((frac) => (
                            <button
                              key={frac}
                              type="button"
                              onClick={() => setUserServingsEaten(frac)}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-colors ${
                                userServingsEaten === frac
                                  ? 'bg-teal-500 text-zinc-950 font-bold shadow-sm'
                                  : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                              }`}
                            >
                              {frac}
                            </button>
                          ))}

                          <div className="flex items-center gap-1 ml-auto">
                            <input
                              type="text"
                              value={userServingsEaten}
                              onChange={(e) => setUserServingsEaten(e.target.value)}
                              placeholder="e.g. 100g, ½, 1"
                              className="w-24 bg-zinc-950 border border-zinc-750 rounded-lg px-2 py-1 text-xs font-mono text-zinc-100 text-right focus:outline-none focus:border-teal-500"
                            />
                            <span className="text-[11px] text-zinc-400 font-mono">portion</span>
                          </div>
                        </div>

                        <div className="text-[11px] font-mono text-zinc-300 flex items-center justify-between pt-1 border-t border-zinc-850">
                          <span className="text-zinc-400">Logging portion ({portion.label}):</span>
                          <strong className="text-teal-300 text-xs">
                            {portion.eatenCalories} kcal ({portion.eatenGrams}g)
                          </strong>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* DEFAULT STATE: Nutrition breakdown panel visible before typing */
                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-4 space-y-4">
                  {/* Result Header Placeholder */}
                  <div className="flex items-start justify-between gap-2 border-b border-zinc-850 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-zinc-300">
                        Calculated nutritional breakdown from weight
                      </h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        Type a food above to see the breakdown.
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-lg font-mono font-extrabold text-zinc-600 block">
                        0 kcal
                      </span>
                      <span className="text-[10px] text-zinc-600">total</span>
                    </div>
                  </div>

                  {/* Empty Macros Bar */}
                  <div className="grid grid-cols-4 gap-2 bg-zinc-900/50 p-2.5 rounded-xl border border-zinc-850 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-600 uppercase block">Calories</span>
                      <span className="text-xs font-bold text-zinc-500">0</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-600 uppercase block">Protein</span>
                      <span className="text-xs font-bold text-zinc-500">0g</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-600 uppercase block">Carbs</span>
                      <span className="text-xs font-bold text-zinc-500">0g</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-zinc-600 uppercase block">Fat</span>
                      <span className="text-xs font-bold text-zinc-500">0g</span>
                    </div>
                  </div>

                  {/* Health Rating Placeholder */}
                  <div className="bg-zinc-900/50 border border-zinc-850 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-400">Health Rating</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-500 border border-zinc-800">
                        — / 10
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-700 w-0" />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed italic">
                      Waiting for input.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Save success banner if meal saved */}
        {saveSuccessMsg && (
          <div className="px-4 py-2 bg-teal-950/80 border-t border-teal-500/40 text-teal-300 text-xs flex items-center gap-2 shrink-0">
            <Check className="w-4 h-4 text-teal-400 shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Sticky Action Buttons at the bottom (Save meal & Log to [meal]) */}
        <div className="sticky bottom-0 left-0 right-0 p-3 bg-zinc-900/95 backdrop-blur-md border-t border-zinc-800 shrink-0 z-10 flex items-center gap-2">
          <button
            type="button"
            disabled={isSaving || isSavingMeal || !hasValidItems}
            onClick={handleSaveMeal}
            className="flex-1 py-3 bg-zinc-950 hover:bg-zinc-800 disabled:opacity-40 disabled:hover:bg-zinc-950 text-teal-300 border border-teal-500/40 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            {isSavingMeal ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving meal...</span>
              </>
            ) : (
              <>
                <Bookmark className="w-4 h-4 text-teal-400" />
                <span>Save meal</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isSaving || isSavingMeal || !hasValidItems}
            onClick={() => handleLogAndSave()}
            className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 disabled:hover:bg-teal-500 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Logging to {mealType}...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Log to {mealType}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeOpen}
        onClose={() => setIsBarcodeOpen(false)}
        onDetected={async (barcodeQuery, product) => {
          setIsBarcodeOpen(false);
          setFormError(null);
          if (product) {
            setInputText(product.name);
            const item: DecipheredFoodItem = {
              rawText: product.name,
              name: product.name,
              grams: product.servingGrams,
              needsWeightConfirmation: false,
              servingLabel: product.servingLabel,
              calories: product.totalCalories,
              protein: product.totalProtein,
              carbs: product.totalCarbs,
              fat: product.totalFat,
              fiber: product.fiberPer100g ? Math.round(product.fiberPer100g * (product.servingGrams / 100) * 10) / 10 : 0,
              sugar: product.sugarPer100g ? Math.round(product.sugarPer100g * (product.servingGrams / 100) * 10) / 10 : 0,
              sodiumMg: product.sodiumMgPer100g ? Math.round(product.sodiumMgPer100g * (product.servingGrams / 100)) : 0,
              caffeineMg: 0,
              standardDrinks: 0,
              caloriesPer100g: product.caloriesPer100g,
              proteinPer100g: product.proteinPer100g,
              carbsPer100g: product.carbsPer100g,
              fatPer100g: product.fatPer100g,
              fiberPer100g: product.fiberPer100g,
              sugarPer100g: product.sugarPer100g,
              sodiumMgPer100g: product.sodiumMgPer100g,
              category: 'packaged' as any
            };
            const result: DecipheredFoodResult = {
              mealSummaryName: product.name,
              items: [item],
              needsWeightConfirmation: false,
              hasItemOver5kg: false,
              isOver5000Kcal: false,
              isExtremeCalorieMeal: false,
              usedFallbackReference: false,
              referenceDailyGoal: macroTarget?.calories || 2000,
              totalCalories: product.totalCalories,
              totalProtein: product.totalProtein,
              totalCarbs: product.totalCarbs,
              totalFat: product.totalFat,
              totalFiber: item.fiber,
              totalSugar: item.sugar,
              totalSodiumMg: item.sodiumMg,
              totalCaffeineMg: 0,
              totalStandardDrinks: 0,
              healthRating: 8,
              healthLabel: 'Scanned Item',
              whatToAdd: [],
              whatToTakeOut: [],
              isRecipe: false
            };
            setParsedResult(result);
            setGramOverrides({});
          } else {
            setParsedResult(null);
            setFormError(`Product not found. You can type the food instead. (Barcode: ${barcodeQuery})`);
          }
        }}
      />
    </div>
  );
};
