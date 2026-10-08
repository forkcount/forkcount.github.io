/**
 * Built-in nutritional database for 60+ common foods (per 100g)
 * and recipe parsing / vague ingredient disambiguation rules.
 */

export interface BuiltinFood {
  name: string;
  aliases: string[];
  calories: number; // kcal per 100g
  protein: number;  // g per 100g
  fat: number;      // g per 100g
  carbs: number;    // g per 100g
  defaultPieceGrams?: number; // e.g. 1 egg ~ 50g, 1 banana ~ 118g
  category?: 'dairy' | 'meat' | 'produce' | 'pantry' | 'seafood';
  isPackagedSpecific?: boolean; // If true, prefers USDA lookup if available
}

export const VAGUE_ITEMS: Record<string, { prompt: string; suggestions: string[] }> = {
  cheese: {
    prompt: "Which cheese?",
    suggestions: ["camembert", "cheddar", "mozzarella", "feta", "halloumi", "cottage cheese"]
  },
  bread: {
    prompt: "Which bread?",
    suggestions: ["sourdough", "whole wheat bread", "white bread", "rye bread", "pita"]
  },
  milk: {
    prompt: "Which milk?",
    suggestions: ["whole milk", "skim milk", "soy milk", "almond milk", "oat milk"]
  },
  yogurt: {
    prompt: "Which yogurt?",
    suggestions: ["Greek yogurt (0%)", "whole milk yogurt", "skyr", "coconut yogurt"]
  },
  fish: {
    prompt: "Which fish?",
    suggestions: ["salmon", "cod", "tuna", "halibut", "tilapia", "trout"]
  }
};

export const BUILTIN_FOODS: BuiltinFood[] = [
  // Meats & Poultry
  { name: "chicken breast", aliases: ["chicken", "chicken fillet", "skinless chicken breast"], calories: 165, protein: 31.0, fat: 3.6, carbs: 0.0, category: 'meat' },
  { name: "chicken thigh", aliases: ["chicken thighs"], calories: 209, protein: 26.0, fat: 10.9, carbs: 0.0, category: 'meat' },
  { name: "turkey breast", aliases: ["turkey", "ground turkey 93/7"], calories: 135, protein: 30.0, fat: 1.0, carbs: 0.0, category: 'meat' },
  { name: "beef mince 90/10", aliases: ["ground beef", "lean beef", "lean ground beef", "beef steak"], calories: 176, protein: 26.0, fat: 10.0, carbs: 0.0, category: 'meat' },
  { name: "pork tenderloin", aliases: ["pork chop", "lean pork"], calories: 143, protein: 26.0, fat: 3.5, carbs: 0.0, category: 'meat' },

  // Seafood
  { name: "salmon", aliases: ["salmon fillet", "wild salmon"], calories: 208, protein: 20.4, fat: 13.4, carbs: 0.0, category: 'seafood' },
  { name: "cod", aliases: ["cod fillet", "atlantic cod"], calories: 82, protein: 17.8, fat: 0.7, carbs: 0.0, category: 'seafood' },
  { name: "tuna canned in water", aliases: ["tuna", "canned tuna"], calories: 116, protein: 25.5, fat: 1.0, carbs: 0.0, category: 'seafood' },
  { name: "halibut", aliases: ["halibut fillet"], calories: 111, protein: 22.5, fat: 1.6, carbs: 0.0, category: 'seafood' },
  { name: "shrimp", aliases: ["prawns", "prawn", "cooked shrimp"], calories: 99, protein: 24.0, fat: 0.3, carbs: 0.2, category: 'seafood' },

  // Eggs & Dairy & Plant proteins (including packaged-specific items)
  { name: "egg", aliases: ["eggs", "whole egg", "large egg"], calories: 143, protein: 12.6, fat: 9.5, carbs: 0.7, defaultPieceGrams: 60, category: 'dairy' },
  { name: "egg white", aliases: ["egg whites"], calories: 52, protein: 10.9, fat: 0.2, carbs: 0.7, defaultPieceGrams: 33, category: 'dairy' },
  { name: "tofu", aliases: ["firm tofu", "silken tofu", "extra firm tofu"], calories: 76, protein: 8.1, fat: 4.8, carbs: 1.9, category: 'produce', isPackagedSpecific: true },
  { name: "tempeh", aliases: ["organic tempeh"], calories: 192, protein: 20.3, fat: 10.8, carbs: 7.6, category: 'produce', isPackagedSpecific: true },
  { name: "cheddar", aliases: ["cheddar cheese", "sharp cheddar", "slice of cheese", "cheese slice"], calories: 403, protein: 24.9, fat: 33.1, carbs: 1.3, defaultPieceGrams: 20, category: 'dairy', isPackagedSpecific: true },
  { name: "mozzarella", aliases: ["mozzarella cheese", "fresh mozzarella"], calories: 280, protein: 28.0, fat: 17.1, carbs: 3.1, defaultPieceGrams: 20, category: 'dairy', isPackagedSpecific: true },
  { name: "camembert", aliases: ["camembert cheese"], calories: 300, protein: 19.8, fat: 24.3, carbs: 0.5, defaultPieceGrams: 20, category: 'dairy', isPackagedSpecific: true },
  { name: "feta", aliases: ["feta cheese"], calories: 264, protein: 14.2, fat: 21.3, carbs: 4.1, defaultPieceGrams: 20, category: 'dairy', isPackagedSpecific: true },
  { name: "halloumi", aliases: ["halloumi cheese"], calories: 321, protein: 21.0, fat: 25.0, carbs: 2.0, defaultPieceGrams: 20, category: 'dairy', isPackagedSpecific: true },
  { name: "cottage cheese", aliases: ["low fat cottage cheese"], calories: 98, protein: 11.1, fat: 4.3, carbs: 3.4, category: 'dairy' },
  { name: "Greek yogurt (0%)", aliases: ["greek yogurt", "nonfat greek yogurt", "greek yougurt", "greek yoghurt"], calories: 59, protein: 10.2, fat: 0.4, carbs: 3.6, category: 'dairy' },
  { name: "whole milk yogurt", aliases: ["plain yogurt", "yogurt", "yougurt", "yoghurt", "natural yogurt"], calories: 61, protein: 3.5, fat: 3.3, carbs: 4.7, category: 'dairy' },
  { name: "whole milk", aliases: ["milk", "cow milk", "regular milk"], calories: 64, protein: 3.3, fat: 3.3, carbs: 4.8, category: 'dairy' },
  { name: "Milk (3% fat)", aliases: ["3% milk", "3% fat milk", "milk 3%", "milk, 3%"], calories: 64, protein: 3.3, fat: 3.0, carbs: 4.8, category: 'dairy' },
  { name: "Milk (2% fat)", aliases: ["2% milk", "2% fat milk", "reduced fat milk", "milk 2%"], calories: 50, protein: 3.3, fat: 2.0, carbs: 4.8, category: 'dairy' },
  { name: "Milk (1% fat)", aliases: ["1% milk", "1% fat milk", "low fat milk", "semi skimmed milk", "semi-skimmed milk"], calories: 42, protein: 3.4, fat: 1.0, carbs: 5.0, category: 'dairy' },
  { name: "skim milk", aliases: ["nonfat milk", "0% milk", "fat free milk"], calories: 35, protein: 3.4, fat: 0.1, carbs: 5.0, category: 'dairy' },
  { name: "soy milk", aliases: ["unsweetened soy milk"], calories: 54, protein: 3.3, fat: 1.8, carbs: 6.0, category: 'dairy' },
  { name: "almond milk", aliases: ["unsweetened almond milk"], calories: 15, protein: 0.6, fat: 1.1, carbs: 0.6, category: 'dairy' },
  { name: "oat milk", aliases: ["unsweetened oat milk"], calories: 60, protein: 1.0, fat: 1.5, carbs: 10.0, category: 'dairy' },
  { name: "whey protein", aliases: ["protein powder", "whey"], calories: 380, protein: 80.0, fat: 4.0, carbs: 6.0, defaultPieceGrams: 30, category: 'pantry' },

  // Grains, Rice, Pastas, Legumes
  { name: "white rice", aliases: ["cooked white rice", "jasmine rice", "basmati rice"], calories: 130, protein: 2.7, fat: 0.3, carbs: 28.2, category: 'pantry' },
  { name: "brown rice", aliases: ["cooked brown rice"], calories: 112, protein: 2.6, fat: 0.9, carbs: 23.5, category: 'pantry' },
  { name: "oats", aliases: ["rolled oats", "oatmeal", "quick oats"], calories: 389, protein: 16.9, fat: 6.9, carbs: 66.3, category: 'pantry' },
  { name: "quinoa", aliases: ["cooked quinoa"], calories: 120, protein: 4.4, fat: 1.9, carbs: 21.3, category: 'pantry' },
  { name: "pasta", aliases: ["dry pasta", "spaghetti", "penne"], calories: 371, protein: 13.0, fat: 1.5, carbs: 74.7, category: 'pantry' },
  { name: "cooked pasta", aliases: ["boiled pasta"], calories: 158, protein: 5.8, fat: 0.9, carbs: 30.9, category: 'pantry' },
  { name: "sourdough bread", aliases: ["sourdough", "slice of bread"], calories: 247, protein: 9.1, fat: 1.2, carbs: 49.3, defaultPieceGrams: 30, category: 'pantry' },
  { name: "whole wheat bread", aliases: ["brown bread"], calories: 247, protein: 13.0, fat: 3.4, carbs: 41.3, defaultPieceGrams: 30, category: 'pantry' },
  { name: "white bread", aliases: ["toast bread"], calories: 265, protein: 9.0, fat: 3.2, carbs: 49.0, defaultPieceGrams: 30, category: 'pantry' },
  { name: "black beans", aliases: ["cooked black beans", "canned black beans"], calories: 132, protein: 8.9, fat: 0.5, carbs: 23.7, category: 'pantry' },
  { name: "chickpeas", aliases: ["garbanzo beans", "cooked chickpeas"], calories: 164, protein: 8.9, fat: 2.6, carbs: 27.4, category: 'pantry' },
  { name: "lentils", aliases: ["cooked lentils", "brown lentils", "red lentils"], calories: 116, protein: 9.0, fat: 0.4, carbs: 20.1, category: 'pantry' },

  // Fruits
  { name: "banana", aliases: ["bananas"], calories: 89, protein: 1.1, fat: 0.3, carbs: 22.8, defaultPieceGrams: 120, category: 'produce' },
  { name: "apple", aliases: ["apples"], calories: 52, protein: 0.3, fat: 0.2, carbs: 13.8, defaultPieceGrams: 180, category: 'produce' },
  { name: "raspberries", aliases: ["raspberry", "rasberry", "rasberries"], calories: 52, protein: 1.2, fat: 0.7, carbs: 11.9, defaultPieceGrams: 4, category: 'produce' },
  { name: "blueberries", aliases: ["blueberry"], calories: 57, protein: 0.7, fat: 0.3, carbs: 14.5, defaultPieceGrams: 2, category: 'produce' },
  { name: "strawberries", aliases: ["strawberry"], calories: 32, protein: 0.7, fat: 0.3, carbs: 7.7, defaultPieceGrams: 12, category: 'produce' },
  { name: "blackberries", aliases: ["blackberry"], calories: 43, protein: 1.4, fat: 0.5, carbs: 9.6, defaultPieceGrams: 5, category: 'produce' },
  { name: "grapes", aliases: ["grape"], calories: 69, protein: 0.7, fat: 0.2, carbs: 18.1, defaultPieceGrams: 5, category: 'produce' },
  { name: "cherries", aliases: ["cherry"], calories: 63, protein: 1.1, fat: 0.2, carbs: 16.0, defaultPieceGrams: 8, category: 'produce' },
  { name: "avocado", aliases: ["avocados"], calories: 160, protein: 2.0, fat: 14.7, carbs: 8.5, defaultPieceGrams: 150, category: 'produce' },
  { name: "orange", aliases: ["oranges"], calories: 47, protein: 0.9, fat: 0.1, carbs: 11.8, defaultPieceGrams: 150, category: 'produce' },

  // Vegetables
  { name: "broccoli", aliases: ["steamed broccoli"], calories: 34, protein: 2.8, fat: 0.4, carbs: 6.6, category: 'produce' },
  { name: "spinach", aliases: ["baby spinach", "fresh spinach"], calories: 23, protein: 2.9, fat: 0.4, carbs: 3.6, category: 'produce' },
  { name: "sweet potato", aliases: ["baked sweet potato", "sweet potatoes"], calories: 86, protein: 1.6, fat: 0.1, carbs: 20.1, defaultPieceGrams: 170, category: 'produce' },
  { name: "potato", aliases: ["potatoes", "baked potato", "russet potato"], calories: 93, protein: 2.5, fat: 0.1, carbs: 21.2, defaultPieceGrams: 170, category: 'produce' },
  { name: "cucumber", aliases: ["cucumbers"], calories: 15, protein: 0.7, fat: 0.1, carbs: 3.6, defaultPieceGrams: 200, category: 'produce' },
  { name: "tomato", aliases: ["tomatoes"], calories: 18, protein: 0.9, fat: 0.2, carbs: 3.9, defaultPieceGrams: 120, category: 'produce' },
  { name: "bell pepper", aliases: ["sweet pepper", "red bell pepper", "green pepper"], calories: 31, protein: 1.0, fat: 0.3, carbs: 6.0, defaultPieceGrams: 120, category: 'produce' },
  { name: "carrots", aliases: ["carrot"], calories: 41, protein: 0.9, fat: 0.2, carbs: 9.6, defaultPieceGrams: 60, category: 'produce' },
  { name: "onion", aliases: ["onions", "yellow onion", "red onion"], calories: 40, protein: 1.1, fat: 0.1, carbs: 9.3, defaultPieceGrams: 100, category: 'produce' },
  { name: "garlic", aliases: ["garlic clove", "garlic cloves"], calories: 149, protein: 6.4, fat: 0.5, carbs: 33.1, defaultPieceGrams: 5, category: 'produce' },
  { name: "mushrooms", aliases: ["mushroom", "white mushrooms", "cremini"], calories: 22, protein: 3.1, fat: 0.3, carbs: 3.3, category: 'produce' },
  { name: "asparagus", aliases: [], calories: 20, protein: 2.2, fat: 0.1, carbs: 3.9, category: 'produce' },
  { name: "zucchini", aliases: ["courgette"], calories: 17, protein: 1.2, fat: 0.3, carbs: 3.1, defaultPieceGrams: 150, category: 'produce' },
  { name: "cauliflower", aliases: [], calories: 25, protein: 1.9, fat: 0.3, carbs: 5.0, category: 'produce' },

  // Fats, Oils, Nuts & Seeds
  { name: "olive oil", aliases: ["extra virgin olive oil"], calories: 884, protein: 0.0, fat: 100.0, carbs: 0.0, category: 'pantry' },
  { name: "butter", aliases: ["unsalted butter", "salted butter"], calories: 717, protein: 0.9, fat: 81.1, carbs: 0.1, category: 'dairy' },
  { name: "peanut butter", aliases: ["creamy peanut butter", "natural peanut butter"], calories: 588, protein: 25.1, fat: 50.4, carbs: 20.0, category: 'pantry' },
  { name: "almonds", aliases: ["raw almonds"], calories: 579, protein: 21.2, fat: 49.9, carbs: 21.6, category: 'pantry' },
  { name: "walnuts", aliases: ["raw walnuts"], calories: 654, protein: 15.2, fat: 65.2, carbs: 13.7, category: 'pantry' },
  { name: "chia seeds", aliases: ["chia seed"], calories: 486, protein: 16.5, fat: 30.7, carbs: 42.1, category: 'pantry' },
  { name: "flax seeds", aliases: ["flaxseed"], calories: 534, protein: 18.3, fat: 42.2, carbs: 28.9, category: 'pantry' },
  { name: "dark chocolate 70-85%", aliases: ["dark chocolate"], calories: 598, protein: 7.8, fat: 42.6, carbs: 45.9, category: 'pantry' },
  { name: "honey", aliases: ["raw honey"], calories: 304, protein: 0.3, fat: 0.0, carbs: 82.4, category: 'pantry' }
];

/**
 * Normalizes an ingredient name string for lookup
 */
export function normalizeName(str: string): string {
  return str.toLowerCase().trim().replace(/[-_]/g, ' ');
}

/**
 * Checks if an item string matches any vague item category
 */
export function checkVagueItem(name: string): { isVague: boolean; prompt?: string; suggestions?: string[] } {
  const norm = normalizeName(name);
  for (const [key, val] of Object.entries(VAGUE_ITEMS)) {
    if (norm === key || norm === `${key}s`) {
      return { isVague: true, prompt: val.prompt, suggestions: val.suggestions };
    }
  }
  return { isVague: false };
}

/**
 * Parses a plain English ingredient line like:
 * "80g tofu"
 * "2 eggs"
 * "1.5 kg chicken breast"
 * "250 ml milk"
 * "1 banana"
 */
export interface ParsedIngredient {
  raw: string;
  name: string;
  amount: number;
  unit: string;
  isVague: boolean;
  vaguePrompt?: string;
  vagueSuggestions?: string[];
  matchedFood?: BuiltinFood;
  calculatedGrams: number;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  needsUsdaLookup?: boolean;
}

export function parseIngredientLine(line: string): ParsedIngredient {
  const trimmed = line.trim();
  if (!trimmed) {
    return {
      raw: line,
      name: '',
      amount: 0,
      unit: '',
      isVague: false,
      calculatedGrams: 0,
      calories: 0,
      carbs: 0,
      fat: 0,
      protein: 0
    };
  }

  // Regex patterns for quantity and units
  // Examples: "80g tofu", "80 g tofu", "1.5kg chicken", "250ml milk", "2 eggs", "1 banana", "1/2 cup rice"
  const match = trimmed.match(/^([\d.,/]+)\s*([a-zA-Z]*)\s+(.*)$/);

  let amount = 1;
  let unit = 'item';
  let foodName = trimmed;

  if (match) {
    const rawAmt = match[1];
    if (rawAmt.includes('/')) {
      const [num, den] = rawAmt.split('/');
      amount = parseFloat(num) / (parseFloat(den) || 1);
    } else {
      amount = parseFloat(rawAmt.replace(',', '.')) || 1;
    }
    const rawUnit = match[2].toLowerCase();
    const remaining = match[3].trim();

    if (rawUnit === 'g' || rawUnit === 'gram' || rawUnit === 'grams') {
      unit = 'g';
      foodName = remaining;
    } else if (rawUnit === 'kg' || rawUnit === 'kilogram' || rawUnit === 'kilograms') {
      unit = 'kg';
      foodName = remaining;
    } else if (rawUnit === 'ml' || rawUnit === 'milliliter' || rawUnit === 'milliliters') {
      unit = 'ml';
      foodName = remaining;
    } else if (rawUnit === 'l' || rawUnit === 'liter' || rawUnit === 'liters') {
      unit = 'l';
      foodName = remaining;
    } else if (rawUnit === 'oz' || rawUnit === 'ounce' || rawUnit === 'ounces') {
      unit = 'oz';
      foodName = remaining;
    } else if (rawUnit === 'cup' || rawUnit === 'cups') {
      unit = 'cup';
      foodName = remaining;
    } else if (rawUnit === 'tbsp' || rawUnit === 'tablespoon' || rawUnit === 'tablespoons') {
      unit = 'tbsp';
      foodName = remaining;
    } else if (rawUnit === 'tsp' || rawUnit === 'teaspoon' || rawUnit === 'teaspoons') {
      unit = 'tsp';
      foodName = remaining;
    } else {
      // Maybe unit wasn't separated or rawUnit is part of food or item count
      if (!rawUnit) {
        unit = 'item';
        foodName = remaining;
      } else {
        // e.g. "2 eggs" -> amount: 2, rawUnit: 'eggs', remaining: '' (if remaining was empty)
        // Here match matched 3 parts, so foodName is rawUnit + " " + remaining
        foodName = `${rawUnit} ${remaining}`.trim();
        unit = 'item';
      }
    }
  } else {
    // Just a food name without leading number, default to 1 item or 100g
    foodName = trimmed;
    amount = 1;
    unit = 'item';
  }

  // Check vague
  const vagueCheck = checkVagueItem(foodName);
  if (vagueCheck.isVague) {
    return {
      raw: trimmed,
      name: foodName,
      amount,
      unit,
      isVague: true,
      vaguePrompt: vagueCheck.prompt,
      vagueSuggestions: vagueCheck.suggestions,
      calculatedGrams: 0,
      calories: 0,
      carbs: 0,
      fat: 0,
      protein: 0
    };
  }

  // Match in BUILTIN_FOODS using whole-word boundaries
  const normFoodName = normalizeName(foodName);
  const matched = BUILTIN_FOODS.find(f => {
    if (f.name === normFoodName) return true;
    const candidates = [f.name, ...f.aliases];
    return candidates.some(a => {
      if (a === normFoodName) return true;
      const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return new RegExp(`\\b${escaped}\\b`, 'i').test(normFoodName);
    });
  });

  // Convert unit to grams (never assume 100g default when weight is unknown)
  let grams = 0;
  if (unit === 'g') {
    grams = amount;
  } else if (unit === 'kg') {
    grams = amount * 1000;
  } else if (unit === 'ml') {
    grams = amount; // ~1g per ml for liquids
  } else if (unit === 'l') {
    grams = amount * 1000;
  } else if (unit === 'oz') {
    grams = amount * 28.35;
  } else if (unit === 'cup') {
    grams = amount * 240;
  } else if (unit === 'tbsp') {
    grams = amount * 15;
  } else if (unit === 'tsp') {
    grams = amount * 5;
  } else if (unit === 'item') {
    if (matched && matched.defaultPieceGrams) {
      grams = amount * matched.defaultPieceGrams;
    } else {
      grams = 0;
    }
  }

  if (matched) {
    const factor = grams / 100;
    return {
      raw: trimmed,
      name: foodName,
      amount,
      unit,
      isVague: false,
      matchedFood: matched,
      calculatedGrams: Math.round(grams),
      calories: Math.round(matched.calories * factor),
      carbs: Math.round(matched.carbs * factor * 10) / 10,
      fat: Math.round(matched.fat * factor * 10) / 10,
      protein: Math.round(matched.protein * factor * 10) / 10,
      needsUsdaLookup: Boolean(matched.isPackagedSpecific)
    };
  }

  // Unrecognized item - estimate safe baseline
  return {
    raw: trimmed,
    name: foodName,
    amount,
    unit,
    isVague: false,
    calculatedGrams: Math.round(grams),
    calories: Math.round(150 * (grams / 100)),
    carbs: Math.round(15 * (grams / 100)),
    fat: Math.round(5 * (grams / 100)),
    protein: Math.round(10 * (grams / 100)),
    needsUsdaLookup: true
  };
}
