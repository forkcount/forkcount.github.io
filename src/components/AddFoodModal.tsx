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
  Info
} from 'lucide-react';
import { useApp } from '../context/AppContext.js';
import { api } from '../services/api.js';
import { BarcodeScannerModal } from './BarcodeScannerModal.js';
import {
  decipherFoodText,
  recalculateDecipheredFoodWithGrams,
  DecipheredFoodResult,
  DecipheredFoodItem
} from '../utils/localAiEngine.js';
import type { MealType } from '../types/index.js';

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
  const [parsedResult, setParsedResult] = useState<DecipheredFoodResult | null>(null);
  const [gramOverrides, setGramOverrides] = useState<Record<number, number>>({});
  const [editingWeightIndex, setEditingWeightIndex] = useState<number | null>(null);
  const [userServingsEaten, setUserServingsEaten] = useState<string>('1');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

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
          setInputText((prev) => (prev.trim() ? `${prev.trim()} ${transcript}` : transcript));
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

  // Parse Servings amount helper
  const parseServings = (val: string): number => {
    if (val === '½') return 0.5;
    if (val === '¼') return 0.25;
    if (val === '¾') return 0.75;
    const num = parseFloat(val);
    return Number.isNaN(num) || num <= 0 ? 1.0 : num;
  };

  // The single Log action
  const handleLogInput = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    if (isGuest && !consumeGuestAiCall()) {
      openGuestLock();
      return;
    }

    const parsed = decipherFoodText(trimmed, macroTarget?.calories || 2000, mealType);
    setParsedResult(parsed);
    setGramOverrides({});
    setEditingWeightIndex(null);
    setUserServingsEaten('1');
  };

  // Save Food action
  const handleSaveToDiary = async () => {
    if (!activeResult || activeResult.items.length === 0 || isSaving) return;

    setIsSaving(true);
    try {
      const isRecipe = Boolean(activeResult.isRecipe);
      const servingsCount = activeResult.recipeServings || 4;
      const eatenServings = parseServings(userServingsEaten);
      const recipeScale = isRecipe ? eatenServings / servingsCount : 1.0;

      if (isRecipe) {
        // Log recipe with divided numbers
        const totalCals = Math.round(activeResult.totalCalories * recipeScale);
        const totalP = Math.round(activeResult.totalProtein * recipeScale * 10) / 10;
        const totalC = Math.round(activeResult.totalCarbs * recipeScale * 10) / 10;
        const totalF = Math.round(activeResult.totalFat * recipeScale * 10) / 10;
        const totalFib = Math.round(activeResult.totalFiber * recipeScale * 10) / 10;
        const totalSug = Math.round(activeResult.totalSugar * recipeScale * 10) / 10;
        const totalSod = Math.round(activeResult.totalSodiumMg * recipeScale);

        await addFoodItem({
          name: `${activeResult.mealSummaryName} (${userServingsEaten} of ${servingsCount} servings)`,
          calories: totalCals,
          protein: totalP,
          carbs: totalC,
          fat: totalF,
          fiber: totalFib,
          sugar: totalSug,
          sodium: totalSod,
          serving: `${userServingsEaten} serving`,
          mealType,
          date: activeDate,
          source: 'recipe'
        });
      } else if (activeResult.items.length === 1) {
        // Single food item
        const item = activeResult.items[0];
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
        for (const item of activeResult.items) {
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

      setSaveSuccessMsg('Logged successfully!');
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err) {
      console.error('Failed to save food:', err);
    } finally {
      setIsSaving(false);
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
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

        {/* Modal Body */}
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
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
              <form onSubmit={handleLogInput} className="space-y-2.5">
                <div className="relative bg-zinc-950 border border-zinc-800 rounded-2xl p-3 focus-within:border-teal-500 transition-colors shadow-inner">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[11px] font-semibold text-teal-400 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Smart AI Food Input</span>
                    </label>

                    <div className="flex items-center gap-1">
                      {/* Microphone button inside the Smart AI box */}
                      <button
                        type="button"
                        onClick={toggleSpeechRecognition}
                        disabled={!speechSupported}
                        title={
                          speechSupported
                            ? isListening
                              ? 'Listening... tap to stop'
                              : 'Tap to speak food description'
                            : 'Speech recognition not supported in this browser'
                        }
                        className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs ${
                          isListening
                            ? 'bg-rose-500 text-white animate-pulse'
                            : speechSupported
                            ? 'text-zinc-400 hover:text-teal-300 hover:bg-zinc-800'
                            : 'text-zinc-600 opacity-40 cursor-not-allowed'
                        }`}
                        aria-label="Speech to text"
                      >
                        {isListening ? (
                          <>
                            <Mic className="w-3.5 h-3.5 animate-bounce" />
                            <span className="text-[10px] font-semibold">Listening...</span>
                          </>
                        ) : (
                          <Mic className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {inputText.trim() && (
                        <button
                          type="button"
                          onClick={() => {
                            setInputText('');
                            setParsedResult(null);
                          }}
                          className="p-1 rounded-md text-zinc-500 hover:text-zinc-300 transition-colors"
                          title="Clear input"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleLogInput();
                      }
                    }}
                    placeholder="Type or speak: 89g mango, 2 egs and tost, 1 pack Doritos, 1 can Coke Zero, or paste a recipe..."
                    className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* Actions: Scan Menu & Log Button */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsScanningMenu(true)}
                    className="px-3.5 py-2.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shrink-0"
                    title="Scan restaurant menu photos"
                  >
                    <Camera className="w-4 h-4 text-teal-400" />
                    <span>Scan Menu</span>
                  </button>

                  <button
                    type="submit"
                    disabled={!inputText.trim()}
                    className="flex-1 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-40 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-teal-500/20"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Log</span>
                  </button>
                </div>
              </form>

              {/* RESULT CARD FLOW */}
              {activeResult && activeResult.items.length > 0 && (
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
                        const isEditing = editingWeightIndex === idx || item.needsWeightConfirmation;

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
                                {isEditing ? (
                                  <div className="flex items-center gap-1">
                                    <input
                                      type="number"
                                      min="0"
                                      step="any"
                                      autoFocus
                                      value={currentGrams === 0 && !hasOverride ? '' : currentGrams}
                                      placeholder="grams"
                                      onChange={(e) => {
                                        const raw = e.target.value;
                                        const num = raw === '' ? 0 : Math.max(0, parseFloat(raw) || 0);
                                        setGramOverrides((prev) => ({ ...prev, [idx]: num }));
                                      }}
                                      onBlur={() => setEditingWeightIndex(null)}
                                      className="w-16 bg-zinc-950 border border-teal-500 rounded px-1.5 py-0.5 text-right font-mono text-xs text-zinc-100 focus:outline-none"
                                    />
                                    <span className="text-[11px] font-mono text-zinc-400">g</span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setEditingWeightIndex(idx)}
                                    className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-750 text-[11px] font-mono text-zinc-200 flex items-center gap-1 transition-colors"
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
                  {activeResult.isRecipe && (
                    <div className="bg-zinc-900/90 border border-teal-500/30 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-zinc-200">
                          Servings: How much did you eat?
                        </label>
                        <span className="text-[11px] font-mono text-teal-400 font-semibold">
                          Total recipe: {activeResult.recipeServings || 4} servings
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {['1', '2', '3', '4', '½', '¼'].map((sVal) => (
                          <button
                            key={sVal}
                            type="button"
                            onClick={() => setUserServingsEaten(sVal)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono transition-colors ${
                              userServingsEaten === sVal
                                ? 'bg-teal-500 text-zinc-950 font-bold'
                                : 'bg-zinc-950 text-zinc-300 hover:bg-zinc-800 border border-zinc-800'
                            }`}
                          >
                            {sVal}
                          </button>
                        ))}

                        <div className="flex items-center gap-1 ml-auto">
                          <input
                            type="number"
                            step="any"
                            min="0.1"
                            value={userServingsEaten}
                            onChange={(e) => setUserServingsEaten(e.target.value)}
                            placeholder="Custom"
                            className="w-16 bg-zinc-950 border border-zinc-750 rounded-lg px-2 py-1 text-xs font-mono text-zinc-100 text-right focus:outline-none focus:border-teal-500"
                          />
                          <span className="text-[11px] text-zinc-400 font-mono">serving</span>
                        </div>
                      </div>

                      <div className="text-[11px] font-mono text-zinc-400 flex items-center justify-between pt-1 border-t border-zinc-850">
                        <span>Logging portion:</span>
                        <strong className="text-teal-300">
                          {Math.round(
                            (activeResult.totalCalories * parseServings(userServingsEaten)) /
                              (activeResult.recipeServings || 4)
                          )}{' '}
                          kcal
                        </strong>
                      </div>
                    </div>
                  )}

                  {/* Save Button at the Bottom */}
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleSaveToDiary}
                    className="w-full py-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-zinc-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-teal-500/20"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving to {mealType}...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Save to {mealType}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isBarcodeOpen}
        onClose={() => setIsBarcodeOpen(false)}
        onDetected={async (barcodeQuery) => {
          setIsBarcodeOpen(false);
          setInputText(barcodeQuery);
          const parsed = decipherFoodText(barcodeQuery, macroTarget?.calories || 2000, mealType);
          setParsedResult(parsed);
          setGramOverrides({});
        }}
      />
    </div>
  );
};
