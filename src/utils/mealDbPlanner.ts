import type {
  WeekPlan,
  PlanDay,
  PlanDayMeal,
  PlanDayWorkout,
  MealType,
  MealDbIngredientItem
} from '../types/index.js';
import { formatLocalDate, addDaysLocal } from './dateUtils.js';

export interface GenerateMealDbPlanRequest {
  type: 'meals' | 'workouts' | 'both';
  dailyTargetCalories: number;
  dailyTargetCarbs?: number;
  dailyTargetFat?: number;
  dailyTargetProtein?: number;
  profileRestrictions?: string[];
  preferences?: {
    restrictions?: string[];
    allergies?: string[];
    dislikes?: string;
    cookTime?: string;
    mealsPerDay?: number;
    budget?: string;
    workoutDaysPerWeek?: number;
    equipment?: string;
    injuries?: string;
    narrowingText?: string;
  };
}

export interface RawMealDbMeal {
  idMeal: string;
  strMeal: string;
  strCategory?: string | null;
  strArea?: string | null;
  strInstructions?: string | null;
  strMealThumb?: string | null;
  strTags?: string | null;
  [key: string]: any;
}

interface HydratedCandidate {
  raw: RawMealDbMeal;
  idMeal: string;
  name: string;
  category: string;
  area: string;
  imageUrl: string;
  ingredientItems: MealDbIngredientItem[];
  ingredientsFormatted: string[];
  rawInstructions: string;
  instructionSteps: string[];
  prepTime: string;
  cookTime: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  aisle: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen';
  servingsYield: number;
}

const THEMEALDB_BASE = 'https://www.themealdb.com/api/json/v1/1';

// In-memory session caches to prevent redundant HTTP requests
const searchCache = new Map<string, RawMealDbMeal[]>();
const filterCache = new Map<string, Array<{ idMeal: string; strMeal: string; strMealThumb: string }>>();
const lookupCache = new Map<string, RawMealDbMeal | null>();

async function fetchJsonWithRetry(url: string, retries = 1): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timer);
      if (res.status === 429 && attempt < retries) {
        await new Promise((r) => setTimeout(r, 450 * (attempt + 1)));
        continue;
      }
      if (!res.ok) {
        throw new Error(`TheMealDB HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (attempt >= retries) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 350));
    }
  }
  return null;
}

async function searchMealDbByTerm(term: string): Promise<RawMealDbMeal[]> {
  const key = term.trim().toLowerCase();
  if (!key) return [];
  if (searchCache.has(key)) {
    return searchCache.get(key)!;
  }
  try {
    const data = await fetchJsonWithRetry(`${THEMEALDB_BASE}/search.php?s=${encodeURIComponent(key)}`);
    const meals: RawMealDbMeal[] = Array.isArray(data?.meals) ? data.meals : [];
    for (const m of meals) {
      if (m?.idMeal) lookupCache.set(String(m.idMeal), m);
    }
    searchCache.set(key, meals);
    return meals;
  } catch {
    return [];
  }
}

async function filterMealDbByCategory(category: string): Promise<Array<{ idMeal: string; strMeal: string; strMealThumb: string }>> {
  const key = category.trim();
  if (!key) return [];
  if (filterCache.has(key)) {
    return filterCache.get(key)!;
  }
  try {
    const data = await fetchJsonWithRetry(`${THEMEALDB_BASE}/filter.php?c=${encodeURIComponent(key)}`);
    const meals = Array.isArray(data?.meals) ? data.meals : [];
    filterCache.set(key, meals);
    return meals;
  } catch {
    return [];
  }
}

async function lookupMealDbById(idMeal: string): Promise<RawMealDbMeal | null> {
  const key = String(idMeal).trim();
  if (!key) return null;
  if (lookupCache.has(key)) {
    return lookupCache.get(key)!;
  }
  try {
    const data = await fetchJsonWithRetry(`${THEMEALDB_BASE}/lookup.php?i=${encodeURIComponent(key)}`);
    const meal: RawMealDbMeal | null = Array.isArray(data?.meals) && data.meals[0] ? data.meals[0] : null;
    lookupCache.set(key, meal);
    return meal;
  } catch {
    return null;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await fn(items[current]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Splits TheMealDB's strInstructions block cleanly into numbered cooking steps
 * while preserving the exact authentic wording from TheMealDB.
 */
export function splitMealDbInstructions(rawInstructions?: string | null): string[] {
  const raw = String(rawInstructions || '').trim();
  if (!raw) return [];

  const normalized = raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ');

  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    // Remove standalone step label lines like "STEP 1" or "Step 2:" where content is on next line
    .filter((line) => !/^(?:step\s*\d+|0?\d+[.)]?)\s*:?\s*$/i.test(line))
    // Strip leading numbering prefixes ("01.", "1.", "1)", "STEP 1:", "Step 1 -") to avoid double numbering
    .map((line) =>
      line
        .replace(/^(?:step\s*\d+\s*[:.\-–—]?\s*|0?\d+\s*[.)\-–—:]\s*)/i, '')
        .trim()
    )
    .filter(Boolean);

  if (lines.length >= 2) {
    return lines;
  }

  // Single block paragraph: split on sentence boundaries
  const single = lines[0] || normalized;
  const rawSentences = single
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.replace(/^(?:step\s*\d+\s*[:.\-–—]?\s*|0?\d+\s*[.)\-–—:]\s*)/i, '').trim())
    .filter(Boolean);

  if (rawSentences.length <= 1) {
    return [single];
  }

  // Group very short fragments (< 25 chars) with the following sentence so steps read naturally
  const merged: string[] = [];
  let buffer = '';
  for (const s of rawSentences) {
    if (buffer) {
      buffer = `${buffer} ${s}`;
      if (buffer.length >= 30) {
        merged.push(buffer);
        buffer = '';
      }
    } else if (s.length < 25) {
      buffer = s;
    } else {
      merged.push(s);
    }
  }
  if (buffer) {
    if (merged.length > 0) {
      merged[merged.length - 1] = `${merged[merged.length - 1]} ${buffer}`;
    } else {
      merged.push(buffer);
    }
  }

  return merged;
}

/**
 * Extracts Prep / Cook time if explicitly present in TheMealDB's strInstructions;
 * otherwise returns "Not specified" as required.
 */
export function extractMealDbTimes(rawInstructions?: string | null): { prepTime: string; cookTime: string } {
  const text = String(rawInstructions || '');
  const prepMatch = text.match(/\bprep(?:aration)?(?:\s*time)?\s*[:\-]\s*(\d+\s*(?:mins?|minutes?|hrs?|hours?)(?:\s*\d+\s*(?:mins?|minutes?))?)/i);
  const cookMatch = text.match(/\bcook(?:ing)?(?:\s*time)?\s*[:\-]\s*(\d+\s*(?:mins?|minutes?|hrs?|hours?)(?:\s*\d+\s*(?:mins?|minutes?))?)/i);

  return {
    prepTime: prepMatch ? prepMatch[1].trim() : 'Not specified',
    cookTime: cookMatch ? cookMatch[1].trim() : 'Not specified'
  };
}

// ---------------- NUTRITION ESTIMATION FROM THEMEALDB INGREDIENTS ----------------

interface MacroDensity {
  kcal: number; // per 100g
  p: number;
  c: number;
  f: number;
  aisle: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen';
  cupGrams?: number;
  pieceGrams?: number;
}

const INGREDIENT_PROFILES: Array<{ pattern: RegExp; density: MacroDensity }> = [
  // Zero / trace calorie items
  {
    pattern: /\b(water|ice|salt|sea salt|kosher salt|black pepper|white pepper|peppercorns?|baking powder|baking soda|bicarbonate|vanilla extract|almond extract|food colou?ring|tea bag|coffee|vinegar|lemon zest|lime zest|orange zest|bay leaf|bay leaves)\b/i,
    density: { kcal: 2, p: 0, c: 0.4, f: 0, aisle: 'pantry', cupGrams: 240, pieceGrams: 2 }
  },
  // Dried spices & fresh herbs (small gram weights)
  {
    pattern: /\b(cumin|paprika|turmeric|cinnamon|nutmeg|allspice|cloves|cardamom|coriander|cilantro|parsley|basil|mint|thyme|rosemary|oregano|dill|chives|sage|tarragon|marjoram|chili powder|chilli powder|cayenne|curry powder|garam masala|five spice|fennel seeds|mustard seeds| saffron|ginger|garlic)\b/i,
    density: { kcal: 65, p: 2.5, c: 13, f: 1, aisle: 'produce', cupGrams: 40, pieceGrams: 5 }
  },
  // Pure oils & cooking fats
  {
    pattern: /\b(olive oil|vegetable oil|sunflower oil|rapeseed oil|canola oil|sesame oil|coconut oil|peanut oil|corn oil|oil|lard|suet|shortening|dripping)\b/i,
    density: { kcal: 884, p: 0, c: 0, f: 100, aisle: 'pantry', cupGrams: 218, pieceGrams: 14 }
  },
  // Butter, ghee, margarine
  {
    pattern: /\b(butter|ghee|margarine)\b/i,
    density: { kcal: 717, p: 0.9, c: 0.1, f: 81.1, aisle: 'dairy', cupGrams: 227, pieceGrams: 15 }
  },
  // Nut butters & nuts & seeds & tahini
  {
    pattern: /\b(peanut butter|almond butter|cashew butter|tahini|peanuts|almonds|walnuts|cashews|pecans|hazelnuts|pistachios|pine nuts|macadamia|sesame seeds|chia seeds|flax|sunflower seeds|pumpkin seeds|desiccated coconut)\b/i,
    density: { kcal: 595, p: 20, c: 18, f: 51, aisle: 'pantry', cupGrams: 140, pieceGrams: 20 }
  },
  // Sugars
  {
    pattern: /\b(sugar|caster sugar|icing sugar|powdered sugar|brown sugar|muscovado|demerara|jaggery)\b/i,
    density: { kcal: 387, p: 0, c: 99.8, f: 0, aisle: 'pantry', cupGrams: 200, pieceGrams: 10 }
  },
  // Syrups, honey, jam
  {
    pattern: /\b(honey|maple syrup|golden syrup|corn syrup|agave|molasses|treacle|jam|marmalade|jelly|chutney)\b/i,
    density: { kcal: 300, p: 0.3, c: 76, f: 0, aisle: 'pantry', cupGrams: 320, pieceGrams: 20 }
  },
  // Chocolate & cocoa
  {
    pattern: /\b(chocolate|cocoa|cacao|nutella)\b/i,
    density: { kcal: 535, p: 7, c: 56, f: 31, aisle: 'pantry', cupGrams: 150, pieceGrams: 25 }
  },
  // Pastry sheets / pie crust
  {
    pattern: /\b(puff pastry|shortcrust pastry|filo pastry|phyllo|pie crust|pastry)\b/i,
    density: { kcal: 455, p: 6.5, c: 45, f: 28, aisle: 'frozen', cupGrams: 150, pieceGrams: 220 }
  },
  // Flours, cornmeal, grits, dry grains, dry pasta, oats
  {
    pattern: /\b(flour|cornmeal|polenta|grits|semolina|cornstarch|cornflour|oats|oatmeal|rolled oats|porridge oats|couscous|bulgur|quinoa|macaroni|spaghetti|penne|fettuccine|linguine|rigatoni|lasagne|lasagna|tagliatelle|pasta|noodles|vermicelli|rice)\b/i,
    density: { kcal: 358, p: 11, c: 74, f: 2, aisle: 'pantry', cupGrams: 145, pieceGrams: 85 }
  },
  // Bread, wraps, tortillas, buns, pita
  {
    pattern: /\b(bread|baguette|ciabatta|sourdough|brioche|pita|pitta|naan|flatbread|tortilla|wrap|muffin|english muffin|bun|roll|breadcrumbs|panko|croutons|biscuits|crackers|digestive)\b/i,
    density: { kcal: 272, p: 8.8, c: 50, f: 4.2, aisle: 'pantry', cupGrams: 100, pieceGrams: 42 }
  },
  // Eggs
  {
    pattern: /\b(egg whites?)\b/i,
    density: { kcal: 52, p: 10.9, c: 0.7, f: 0.2, aisle: 'dairy', cupGrams: 240, pieceGrams: 33 }
  },
  {
    pattern: /\b(eggs?|egg yolks?)\b/i,
    density: { kcal: 143, p: 12.6, c: 0.7, f: 9.5, aisle: 'dairy', cupGrams: 240, pieceGrams: 55 }
  },
  // Coconut milk / coconut cream
  {
    pattern: /\b(coconut milk|coconut cream)\b/i,
    density: { kcal: 197, p: 2.0, c: 2.8, f: 20.8, aisle: 'pantry', cupGrams: 240, pieceGrams: 200 }
  },
  // Heavy / double / whipping cream
  {
    pattern: /\b(double cream|heavy cream|whipping cream|clotted cream)\b/i,
    density: { kcal: 445, p: 1.7, c: 2.7, f: 47.5, aisle: 'dairy', cupGrams: 240, pieceGrams: 30 }
  },
  // Sour cream, creme fraiche, cream cheese, mascarpone, condensed milk
  {
    pattern: /\b(sour cream|creme fraiche|crème fraîche|single cream)\b/i,
    density: { kcal: 198, p: 2.4, c: 4.6, f: 19.4, aisle: 'dairy', cupGrams: 240, pieceGrams: 30 }
  },
  {
    pattern: /\b(cream cheese|mascarpone)\b/i,
    density: { kcal: 342, p: 5.9, c: 4.1, f: 34.2, aisle: 'dairy', cupGrams: 230, pieceGrams: 30 }
  },
  {
    pattern: /\b(condensed milk)\b/i,
    density: { kcal: 321, p: 7.9, c: 54.4, f: 8.7, aisle: 'pantry', cupGrams: 300, pieceGrams: 40 }
  },
  // Hard & semi-hard cheeses
  {
    pattern: /\b(cheddar|parmesan|pecorino|gruyere|gouda|emmental|monterey|red leicester|stilton|cheese)\b/i,
    density: { kcal: 392, p: 25, c: 1.5, f: 32, aisle: 'dairy', cupGrams: 113, pieceGrams: 28 }
  },
  // Medium cheeses (mozzarella, feta, halloumi, paneer, goat cheese, brie)
  {
    pattern: /\b(mozzarella|feta|halloumi|paneer|goat cheese|brie|camembert)\b/i,
    density: { kcal: 285, p: 20, c: 2.5, f: 22, aisle: 'dairy', cupGrams: 120, pieceGrams: 35 }
  },
  // Ricotta / cottage cheese / yogurt / milk
  {
    pattern: /\b(ricotta|cottage cheese|quark)\b/i,
    density: { kcal: 128, p: 11, c: 3.5, f: 7.5, aisle: 'dairy', cupGrams: 245, pieceGrams: 50 }
  },
  {
    pattern: /\b(yogurt|yoghurt|greek yogurt|skyr|kefir)\b/i,
    density: { kcal: 72, p: 7.5, c: 4.5, f: 2.5, aisle: 'dairy', cupGrams: 245, pieceGrams: 150 }
  },
  {
    pattern: /\b(almond milk|soy milk|oat milk|rice milk)\b/i,
    density: { kcal: 42, p: 2.0, c: 5.0, f: 1.5, aisle: 'dairy', cupGrams: 240, pieceGrams: 240 }
  },
  {
    pattern: /\b(milk|buttermilk|evaporated milk)\b/i,
    density: { kcal: 61, p: 3.3, c: 4.8, f: 3.2, aisle: 'dairy', cupGrams: 244, pieceGrams: 240 }
  },
  // Legumes, beans, chickpeas, lentils, tofu, tempeh, hummus
  {
    pattern: /\b(tofu|bean curd)\b/i,
    density: { kcal: 86, p: 9.4, c: 1.9, f: 4.8, aisle: 'produce', cupGrams: 220, pieceGrams: 150 }
  },
  {
    pattern: /\b(tempeh)\b/i,
    density: { kcal: 192, p: 20.3, c: 7.6, f: 10.8, aisle: 'produce', cupGrams: 165, pieceGrams: 120 }
  },
  {
    pattern: /\b(hummus)\b/i,
    density: { kcal: 177, p: 7.9, c: 14.3, f: 9.6, aisle: 'produce', cupGrams: 240, pieceGrams: 60 }
  },
  {
    pattern: /\b(chickpeas|garbanzo|kidney beans|black beans|cannellini|haricot|borlotti|pinto beans|white beans|butter beans|broad beans|fava beans|baked beans|refried beans|beans|lentils|red lentils|green lentils|brown lentils|puy lentils|dal|split peas)\b/i,
    density: { kcal: 128, p: 8.6, c: 21.5, f: 1.1, aisle: 'pantry', cupGrams: 185, pieceGrams: 120 }
  },
  // Poultry & Meat & Seafood
  {
    pattern: /\b(bacon|pancetta|chorizo|salami|pepperoni|sausage|sausages|black pudding|pork belly)\b/i,
    density: { kcal: 325, p: 16, c: 1.5, f: 28, aisle: 'meat', cupGrams: 140, pieceGrams: 45 }
  },
  {
    pattern: /\b(chicken breast|turkey breast|turkey|chicken)\b/i,
    density: { kcal: 172, p: 29, c: 0, f: 5.5, aisle: 'meat', cupGrams: 140, pieceGrams: 165 }
  },
  {
    pattern: /\b(beef|steak|sirloin|ribeye|brisket|mince|lamb|mutton|goat|pork|ham|gammon|prosciutto|duck|veal|venison|oxtail)\b/i,
    density: { kcal: 225, p: 24, c: 0, f: 14, aisle: 'meat', cupGrams: 140, pieceGrams: 160 }
  },
  {
    pattern: /\b(salmon|mackerel|sardines|trout|herring|kippers|anchovies)\b/i,
    density: { kcal: 205, p: 20.5, c: 0, f: 13, aisle: 'meat', cupGrams: 150, pieceGrams: 155 }
  },
  {
    pattern: /\b(cod|codfish|haddock|halibut|tilapia|sea bass|bream|monkfish|pollock|tuna|fish|saltfish|prawns|shrimp|crab|lobster|clams|mussels|oysters|scallops|squid|calamari|octopus|conch)\b/i,
    density: { kcal: 98, p: 21.5, c: 0.3, f: 1.2, aisle: 'meat', cupGrams: 150, pieceGrams: 150 }
  },
  // Starchy produce & avocado & fruits
  {
    pattern: /\b(avocado)\b/i,
    density: { kcal: 160, p: 2.0, c: 8.5, f: 14.7, aisle: 'produce', cupGrams: 150, pieceGrams: 140 }
  },
  {
    pattern: /\b(potato|potatoes|sweet potato|sweet potatoes|yam|cassava|plantain)\b/i,
    density: { kcal: 89, p: 2.0, c: 20.5, f: 0.2, aisle: 'produce', cupGrams: 150, pieceGrams: 160 }
  },
  {
    pattern: /\b(peas|sweetcorn|corn)\b/i,
    density: { kcal: 84, p: 5.0, c: 15.0, f: 0.8, aisle: 'frozen', cupGrams: 145, pieceGrams: 80 }
  },
  {
    pattern: /\b(raisins|sultanas|currants|dates|prunes|dried apricots|dried figs|cranberries)\b/i,
    density: { kcal: 295, p: 2.5, c: 74, f: 0.5, aisle: 'pantry', cupGrams: 150, pieceGrams: 25 }
  },
  {
    pattern: /\b(banana|bananas)\b/i,
    density: { kcal: 89, p: 1.1, c: 22.8, f: 0.3, aisle: 'produce', cupGrams: 150, pieceGrams: 118 }
  },
  {
    pattern: /\b(apple|apples|pear|pears|peach|mango|papaya|pineapple|orange|oranges|berries|strawberries|blueberries|raspberries|blackberries|saskatoon|cherries|grapes|plum|lemon|lime|pomegranate|fruit)\b/i,
    density: { kcal: 54, p: 0.7, c: 13.5, f: 0.2, aisle: 'produce', cupGrams: 145, pieceGrams: 130 }
  },
  // Sauces, condiments, stocks
  {
    pattern: /\b(mayonnaise|mayo)\b/i,
    density: { kcal: 680, p: 1.0, c: 0.6, f: 75, aisle: 'pantry', cupGrams: 220, pieceGrams: 15 }
  },
  {
    pattern: /\b(pesto)\b/i,
    density: { kcal: 420, p: 5.0, c: 6.0, f: 42, aisle: 'pantry', cupGrams: 240, pieceGrams: 20 }
  },
  {
    pattern: /\b(stock|broth|bouillon)\b/i,
    density: { kcal: 12, p: 1.2, c: 1.0, f: 0.3, aisle: 'pantry', cupGrams: 240, pieceGrams: 240 }
  },
  {
    pattern: /\b(soy sauce|tamari|fish sauce|worcestershire|oyster sauce|hoisin|teriyaki|ketchup|tomato puree|tomato paste|passata|harissa|mustard|hot sauce|sriracha|salsa)\b/i,
    density: { kcal: 68, p: 3.0, c: 13.0, f: 0.5, aisle: 'pantry', cupGrams: 245, pieceGrams: 15 }
  },
  // Alcohol (for non-Halal recipes)
  {
    pattern: /\b(wine|beer|stout|ale|cider|sherry|marsala|port|rum|brandy|whisky|whiskey|vodka|gin|mirin|sake)\b/i,
    density: { kcal: 95, p: 0.2, c: 4.5, f: 0, aisle: 'pantry', cupGrams: 240, pieceGrams: 60 }
  },
  // Non-starchy vegetables (default produce)
  {
    pattern: /\b(tomato|tomatoes|onion|onions|shallot|spring onion|scallion|leek|pepper|peppers|capsicum|cucumber|courgette|zucchini|aubergine|eggplant|spinach|kale|chard|callaloo|lettuce|rocket|arugula|cabbage|sauerkraut|broccoli|cauliflower|carrot|carrots|celery|fennel|mushroom|mushrooms|pumpkin|squash|butternut|asparagus|green beans|okra|beetroot|radish|turnip|swede)\b/i,
    density: { kcal: 28, p: 1.5, c: 5.2, f: 0.3, aisle: 'produce', cupGrams: 120, pieceGrams: 110 }
  }
];

const DEFAULT_DENSITY: MacroDensity = {
  kcal: 95,
  p: 3.5,
  c: 14,
  f: 2.5,
  aisle: 'pantry',
  cupGrams: 160,
  pieceGrams: 65
};

function lookupIngredientDensity(ingredient: string): MacroDensity {
  const clean = ingredient.toLowerCase().trim();
  for (const entry of INGREDIENT_PROFILES) {
    if (entry.pattern.test(clean)) {
      return entry.density;
    }
  }
  return DEFAULT_DENSITY;
}

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '¼': 0.25,
  '¾': 0.75,
  '⅕': 0.2,
  '⅖': 0.4,
  '⅗': 0.6,
  '⅘': 0.8,
  '⅙': 1 / 6,
  '⅚': 5 / 6,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875
};

function parseMeasureQuantity(rawMeasure: string): { value: number; hasExplicitNumber: boolean; rest: string } {
  let s = String(rawMeasure || '').trim();
  if (!s) return { value: 1, hasExplicitNumber: false, rest: '' };

  for (const [glyph, num] of Object.entries(UNICODE_FRACTIONS)) {
    s = s.replace(new RegExp(glyph, 'g'), ` ${num} `);
  }
  s = s.replace(/\s+/g, ' ').trim();

  // Mixed fraction e.g. "1 1/2 cups"
  const mixed = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)(.*)$/);
  if (mixed) {
    const val = parseFloat(mixed[1]) + parseFloat(mixed[2]) / (parseFloat(mixed[3]) || 1);
    return { value: val, hasExplicitNumber: true, rest: mixed[4].trim() };
  }

  // Simple fraction e.g. "3/4 cup"
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)(.*)$/);
  if (frac) {
    const val = parseFloat(frac[1]) / (parseFloat(frac[2]) || 1);
    return { value: val, hasExplicitNumber: true, rest: frac[3].trim() };
  }

  // Range e.g. "2-3 tbsp"
  const range = s.match(/^(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)(.*)$/i);
  if (range) {
    const val = (parseFloat(range[1]) + parseFloat(range[2])) / 2;
    return { value: val, hasExplicitNumber: true, rest: range[3].trim() };
  }

  // Multiplier e.g. "2 x 400g"
  const mult = s.match(/^(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)(.*)$/i);
  if (mult) {
    const val = parseFloat(mult[1]) * parseFloat(mult[2]);
    return { value: val, hasExplicitNumber: true, rest: mult[3].trim() };
  }

  // Decimal / integer e.g. "125g", "2.5 tbsp"
  const num = s.match(/^(\d+(?:\.\d+)?)(.*)$/);
  if (num) {
    return { value: parseFloat(num[1]) || 1, hasExplicitNumber: true, rest: num[2].trim() };
  }

  // Word numbers
  const lower = s.toLowerCase();
  if (/^(half\b|a half\b)/.test(lower)) {
    return { value: 0.5, hasExplicitNumber: true, rest: lower.replace(/^(a\s+)?half\s*(of\s*|a\s*)?/, '').trim() };
  }
  if (/^(quarter\b|a quarter\b)/.test(lower)) {
    return { value: 0.25, hasExplicitNumber: true, rest: lower.replace(/^(a\s+)?quarter\s*(of\s*|a\s*)?/, '').trim() };
  }

  return { value: 1, hasExplicitNumber: false, rest: s };
}

function estimateGramsForMeasure(measure: string, ingredient: string, density: MacroDensity): number {
  const lowerMeas = String(measure || '').toLowerCase().trim();
  const lowerIng = ingredient.toLowerCase().trim();

  // Check explicit parenthetical metric equivalents first e.g. "8 ounces (230 grams)" or "1 cup (240 milliliters)"
  const parenMetric = lowerMeas.match(/\((\d+(?:\.\d+)?)\s*(g|grams?|kg|ml|milliliters?|millilitres?)\)/i);
  if (parenMetric) {
    const pVal = parseFloat(parenMetric[1]) || 0;
    const pUnit = parenMetric[2].toLowerCase();
    if (pVal > 0) {
      return pUnit.startsWith('k') ? pVal * 1000 : pVal;
    }
  }

  if (
    !lowerMeas ||
    /\b(pinch|dash|sprinkling|sprinkle|to taste|garnish|optional|dusting|splash)\b/.test(lowerMeas)
  ) {
    if (density.kcal >= 700) return 6; // drizzle / to serve oil or butter
    if (density.kcal <= 30) return 3;
    return 5;
  }

  const { value, hasExplicitNumber, rest } = parseMeasureQuantity(lowerMeas);
  const u = rest.toLowerCase();

  if (/^(kg|kgs|kilogram|kilograms)\b/.test(u)) return value * 1000;
  if (/^(g|gr|gm|gram|grams)\b/.test(u)) return value;
  if (/^(mg)\b/.test(u)) return value / 1000;
  if (/^(lb|lbs|pound|pounds)\b/.test(u)) return value * 453.6;
  if (/^(oz|ounce|ounces)\b/.test(u)) return value * 28.35;
  if (/^(l|litre|litres|liter|liters)\b/.test(u)) return value * 1000;
  if (/^(ml|millilitre|milliliter|milliliters|cc)\b/.test(u)) return value;
  if (/^(fl\s*oz)\b/.test(u)) return value * 29.57;
  if (/^(cup|cups)\b/.test(u)) return value * (density.cupGrams || 180);
  if (/^(tbsp|tbs|tbls|tblsp|tablespoon|tablespoons)\b/.test(u)) return value * (density.kcal >= 700 ? 14 : 15);
  if (/^(tsp|tsps|teaspoon|teaspoons)\b/.test(u)) return value * 5;
  if (/^(can|cans|tin|tins)\b/.test(u)) {
    if (/\b(beans|chickpeas|lentils|corn)\b/.test(lowerIng)) return value * 240; // drained weight
    return value * 400;
  }
  if (/^(jar|jars|pack|packs|packet|packets|bag|bags|carton)\b/.test(u)) return value * 250;
  if (/^(clove|cloves)\b/.test(u)) return value * 4;
  if (/^(slice|slices|rasher|rashers|strip|strips)\b/.test(u)) {
    if (/\b(bread|toast)\b/.test(lowerIng)) return value * 35;
    if (/\b(cheese)\b/.test(lowerIng)) return value * 22;
    return value * 25;
  }
  if (/^(knob)\b/.test(u)) return value * 15;
  if (/^(handful|bunch|sprig|sprigs|stalk|stalks|stem)\b/.test(u)) {
    return density.kcal <= 70 ? value * 20 : value * 35;
  }
  if (/^(sheet|sheets)\b/.test(u)) {
    return /\b(filo|phyllo)\b/.test(lowerIng) ? value * 20 : value * 220;
  }
  if (/^(pod|pods|stick|sticks|leaf|leaves)\b/.test(u)) return value * 3;

  if (hasExplicitNumber) {
    // Plain item count e.g. "2 Egg", "3 Medium Potatoes", "1 Diced Onion"
    const sizeFactor = /\bsmall\b/.test(u) ? 0.75 : /\blarge\b/.test(u) ? 1.25 : 1;
    return value * (density.pieceGrams || 75) * sizeFactor;
  }

  if (/\b(to serve|for frying|for greasing)\b/.test(lowerMeas)) {
    return 10;
  }

  return density.pieceGrams || 50;
}

function estimateServingsYield(
  mealName: string,
  category: string,
  instructions: string,
  batchKcal: number,
  batchGrams: number
): number {
  // 1. Check explicit serving yield in instructions ("serves 4", "makes 6 servings", "for 4 people")
  const explicitMatch =
    instructions.match(/\b(?:serves?|servings?|portions?)\s*[:\-]?\s*(\d{1,2})\b/i) ||
    instructions.match(/\bfor\s+(\d{1,2})\s+(?:people|persons|diners)\b/i) ||
    instructions.match(/\bdivide\s+(?:between|among|into)\s+(\d{1,2})\s+(?:bowls|plates|servings|portions|glasses)\b/i);

  if (explicitMatch) {
    const parsed = parseInt(explicitMatch[1], 10);
    if (parsed >= 1 && parsed <= 12) {
      // Sanity check so an outlier "makes 12 cookies" doesn't yield 40 kcal for a meal
      const perServing = batchKcal / parsed;
      if (perServing >= 140 && perServing <= 1050) {
        return parsed;
      }
    }
  }

  const isBakeryOrDessert =
    category === 'Dessert' || /\b(cake|pie|tart|crumble|pudding|brownie|pastry|pastries|mandazi|torrijas|flija)\b/i.test(mealName);
  const isBreakfast =
    category === 'Breakfast' || /\b(pancake|poffertjes|omelette|porridge|grits|shakshuka|lahsa|breakfast)\b/i.test(mealName);

  if (isBakeryOrDessert) {
    if (batchKcal <= 680) return 1;
    return Math.min(12, Math.max(2, Math.round(batchKcal / 540)));
  }

  if (isBreakfast) {
    if (batchKcal <= 480 && batchGrams <= 450) return 1;
    return Math.min(14, Math.max(2, Math.round(batchKcal / 355)));
  }

  // Main / Lunch / Dinner / Soup / Salad
  if (batchKcal <= 560 && batchGrams <= 550) return 1;
  const byKcal = Math.max(1, Math.round(batchKcal / 485));
  const byWeight = Math.max(1, Math.floor(batchGrams / 520));
  return Math.min(12, Math.max(byKcal, Math.min(byKcal + 2, byWeight)));
}

function hydrateMealCandidate(raw: RawMealDbMeal): HydratedCandidate | null {
  if (!raw || !raw.idMeal || !raw.strMeal) return null;

  const ingredientItems: MealDbIngredientItem[] = [];
  const ingredientsFormatted: string[] = [];

  let batchKcal = 0;
  let batchP = 0;
  let batchC = 0;
  let batchF = 0;
  let batchGrams = 0;

  const aisleScores: Record<'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen', number> = {
    produce: 0,
    dairy: 0,
    meat: 0,
    pantry: 0,
    frozen: 0
  };

  for (let i = 1; i <= 20; i++) {
    const ing = String(raw[`strIngredient${i}`] || '').trim();
    const meas = String(raw[`strMeasure${i}`] || '').trim();
    if (!ing) continue;

    ingredientItems.push({ ingredient: ing, measure: meas || 'To taste' });
    ingredientsFormatted.push(meas ? `${meas} ${ing}`.replace(/\s+/g, ' ').trim() : ing);

    const density = lookupIngredientDensity(ing);
    const grams = estimateGramsForMeasure(meas, ing, density);
    const factor = grams / 100;

    batchKcal += density.kcal * factor;
    batchP += density.p * factor;
    batchC += density.c * factor;
    batchF += density.f * factor;
    // Don't inflate solid dish weight with plain boiling water
    if (!/^\s*water\s*$/i.test(ing)) {
      batchGrams += grams;
    } else {
      batchGrams += grams * 0.35;
    }
    aisleScores[density.aisle] += grams;
  }

  if (ingredientItems.length === 0) return null;

  const category = String(raw.strCategory || 'Miscellaneous').trim();
  const area = String(raw.strArea || 'International').trim();
  const rawInstructions = String(raw.strInstructions || '').trim();
  const instructionSteps = splitMealDbInstructions(rawInstructions);
  const { prepTime, cookTime } = extractMealDbTimes(rawInstructions);

  const servingsYield = estimateServingsYield(raw.strMeal, category, rawInstructions, batchKcal, batchGrams);

  const perServingKcal = Math.max(110, Math.round(batchKcal / servingsYield));
  const perServingP = Math.max(2, Math.round(batchP / servingsYield));
  const perServingC = Math.max(2, Math.round(batchC / servingsYield));
  const perServingF = Math.max(1, Math.round(batchF / servingsYield));

  let dominantAisle: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen' = 'produce';
  let bestScore = -1;
  for (const [k, score] of Object.entries(aisleScores) as Array<[typeof dominantAisle, number]>) {
    if (score > bestScore) {
      bestScore = score;
      dominantAisle = k;
    }
  }

  return {
    raw,
    idMeal: String(raw.idMeal),
    name: String(raw.strMeal).trim(),
    category,
    area,
    imageUrl: String(raw.strMealThumb || '').trim(),
    ingredientItems,
    ingredientsFormatted,
    rawInstructions,
    instructionSteps,
    prepTime,
    cookTime,
    calories: perServingKcal,
    protein: perServingP,
    carbs: perServingC,
    fat: perServingF,
    aisle: dominantAisle,
    servingsYield
  };
}

// ---------------- DIETARY & EXCLUSION FILTERING ----------------

const LAND_MEAT_RE =
  /\b(chicken|beef|pork|turkey|lamb|duck|goose|quail|pheasant|veal|venison|bison|goat|mutton|rabbit|bacon|ham|gammon|prosciutto|pancetta|chorizo|sausage|sausages|salami|pepperoni|frankfurter|hot dog|mince|minced meat|meatballs?|steak|sirloin|ribeye|fillet steak|brisket|oxtail|ribs|chop|chops|suet|lard|dripping|tallow|gelatin|gelatine|black pudding|blood sausage|chicken stock|chicken broth|beef stock|beef broth|lamb stock|veal stock|meat|poultry)\b/i;

const SEAFOOD_RE =
  /\b(fish|salmon|tuna|cod|codfish|haddock|halibut|tilapia|trout|mackerel|sardine|sardines|herring|kippers|anchovy|anchovies|sea bass|bream|monkfish|pollock|whitebait|saltfish|shrimp|prawn|prawns|king prawn|crab|lobster|crayfish|crawfish|clam|clams|mussel|mussels|oyster|oysters|scallop|scallops|squid|calamari|octopus|conch|cockles|whelks|seafood|fish sauce|fish stock|oyster sauce|shrimp paste|worcestershire)\b/i;

const SHELLFISH_RE =
  /\b(shrimp|prawn|prawns|crab|lobster|crayfish|crawfish|clam|clams|mussel|mussels|oyster|oysters|scallop|scallops|squid|calamari|octopus|conch|cockles|whelks|shellfish|oyster sauce|shrimp paste)\b/i;

const PORK_RE =
  /\b(pork|bacon|ham|gammon|prosciutto|pancetta|chorizo|salami|pepperoni|lard|black pudding|gelatin|gelatine|pork chop|porkloin|pork belly|sausage|sausages)\b/i;

const BEEF_RE =
  /\b(beef|steak|sirloin|ribeye|brisket|oxtail|veal|corned beef|beef stock|beef broth|beef mince|ground beef)\b/i;

const ALCOHOL_RE =
  /\b(wine|red wine|white wine|rice wine|beer|stout|guinness|ale|lager|hard cider|cider|rum|brandy|cognac|whiskey|whisky|bourbon|scotch|vodka|gin|tequila|sherry|marsala|port|mirin|sake|champagne|prosecco|liqueur|grand marnier|cointreau|amaretto|kahlua|baileys|kirsch|vermouth)\b/i;

const PLANT_SAFE_MASK_RE =
  /\b(coconut milk|almond milk|soy milk|soya milk|oat milk|rice milk|cashew milk|peanut butter|almond butter|cashew butter|sunflower butter|cocoa butter|coconut butter|coconut cream|cream of tartar|cream of coconut|butternut|buttercup|butter beans?|butterbean|apple cider vinegar|rice vinegar|malt vinegar|ginger beer|root beer|eggplant|eggplants|egg plant|egg plants)\b/gi;

const EGG_RE = /\b(egg|eggs|egg white|egg whites|egg yolk|egg yolks|meringue|mayonnaise|mayo)\b/i;

const DAIRY_RE =
  /\b(milk|whole milk|skim milk|semi-skimmed milk|buttermilk|condensed milk|evaporated milk|cheese|cheddar|mozzarella|parmesan|pecorino|feta|halloumi|paneer|ricotta|mascarpone|gruyere|gouda|brie|camembert|stilton|goat cheese|cream cheese|cottage cheese|quark|butter|salted butter|unsalted butter|ghee|cream|double cream|single cream|heavy cream|whipping cream|clotted cream|sour cream|creme fraiche|crème fraîche|yogurt|yoghurt|greek yogurt|whey|casein|custard)\b/i;

const VEGAN_EXTRA_ANIMAL_RE = /\b(honey)\b/i;

const NUTS_RE =
  /\b(almond|almonds|walnut|walnuts|cashew|cashews|pecan|pecans|hazelnut|hazelnuts|pistachio|pistachios|macadamia|pine nuts?|peanut|peanuts|peanut butter|almond butter|cashew butter|chestnut|chestnuts|praline|marzipan|nutella|nuts)\b/i;

const GLUTEN_RE =
  /\b(wheat|flour|plain flour|self-raising flour|all-purpose flour|bread flour|strong flour|wholemeal flour|bread|baguette|ciabatta|sourdough|brioche|pita|pitta|naan|flatbread|pasta|spaghetti|macaroni|penne|fettuccine|linguine|rigatoni|lasagne|lasagna|tagliatelle|orzo|couscous|bulgur|barley|rye|semolina|puff pastry|shortcrust pastry|filo|phyllo|pastry|breadcrumbs|panko|croutons|soy sauce|biscuits?|crackers?|tortilla|wrap|english muffin|muffin|noodles)\b/i;

const GLUTEN_SAFE_MASK_RE =
  /\b(rice flour|corn flour|cornflour|buckwheat flour|gram flour|chickpea flour|almond flour|coconut flour|gluten[- ]free flour|gluten[- ]free bread|gluten[- ]free pasta|rice noodles|glass noodles|corn tortilla|tamari)\b/gi;

const SOY_RE = /\b(soy|soya|tofu|tempeh|edamame|miso|tamari|soy sauce|bean curd)\b/i;

export interface ParsedDietFilter {
  isVegetarian: boolean;
  isVegan: boolean;
  isPescatarian: boolean;
  isHalal: boolean;
  isKosher: boolean;
  noPork: boolean;
  noBeef: boolean;
  noSeafood: boolean;
  noNuts: boolean;
  noDairy: boolean;
  noGluten: boolean;
  noEggs: boolean;
  noSoy: boolean;
  noShellfish: boolean;
  excludedTerms: string[];
}

export function buildDietFilter(req: GenerateMealDbPlanRequest): ParsedDietFilter {
  const allRestrictions = [
    ...(req.profileRestrictions || []),
    ...(req.preferences?.restrictions || [])
  ].map((s) => String(s || '').toLowerCase().trim());

  const allAllergies = (req.preferences?.allergies || []).map((s) => String(s || '').toLowerCase().trim());
  const narrowing = String(req.preferences?.narrowingText || '').toLowerCase();
  const dislikesRaw = String(req.preferences?.dislikes || '').toLowerCase();

  const combinedText = [...allRestrictions, ...allAllergies, narrowing].join(' | ');

  const isVegan = allRestrictions.some((r) => r.includes('vegan')) || /\bvegan\b/.test(narrowing);
  const isVegetarian =
    isVegan || allRestrictions.some((r) => r.includes('vegetarian')) || /\bvegetarian\b/.test(narrowing);
  const isPescatarian =
    allRestrictions.some((r) => r.includes('pescatarian')) || /\bpescatarian\b/.test(narrowing);
  const isHalal = allRestrictions.some((r) => r.includes('halal')) || /\bhalal\b/.test(narrowing);
  const isKosher = allRestrictions.some((r) => r.includes('kosher')) || /\bkosher\b/.test(narrowing);

  const noPork = isHalal || isKosher || combinedText.includes('no pork') || combinedText.includes('pork-free');
  const noBeef = combinedText.includes('no beef') || combinedText.includes('beef-free');
  const noSeafood = combinedText.includes('no seafood') || combinedText.includes('no fish');

  const noNuts = allAllergies.some((a) => a.includes('nut')) || /\b(no nuts|nut[- ]free)\b/.test(combinedText);
  const noDairy =
    isVegan || allAllergies.some((a) => a.includes('dairy')) || /\b(no dairy|dairy[- ]free|lactose)\b/.test(combinedText);
  const noGluten =
    allAllergies.some((a) => a.includes('gluten')) || /\b(no gluten|gluten[- ]free|celiac|coeliac)\b/.test(combinedText);
  const noEggs =
    isVegan || allAllergies.some((a) => a.includes('egg')) || /\b(no eggs?|egg[- ]free)\b/.test(combinedText);
  const noSoy = allAllergies.some((a) => a.includes('soy')) || /\b(no soy|soy[- ]free)\b/.test(combinedText);
  const noShellfish =
    isKosher ||
    noSeafood ||
    allAllergies.some((a) => a.includes('shellfish')) ||
    /\b(no shellfish|shellfish[- ]free)\b/.test(combinedText);

  const excludedTerms: string[] = [];
  if (dislikesRaw) {
    for (const part of dislikesRaw.split(/[,;/]+/)) {
      const cleaned = part.trim();
      if (cleaned.length >= 2 && cleaned !== 'none') {
        excludedTerms.push(cleaned);
      }
    }
  }

  // Extract "no <ingredient>" or "without <ingredient>" from narrowingText
  const noMatches = narrowing.matchAll(/\b(?:no|without|avoid)\s+([a-z][a-z\s]{1,22}?)(?:[,.]|$|\band\b)/g);
  for (const m of noMatches) {
    const phrase = m[1].trim();
    if (
      phrase &&
      !['pork', 'beef', 'seafood', 'fish', 'nuts', 'dairy', 'gluten', 'eggs', 'egg', 'soy', 'shellfish', 'equipment'].includes(phrase)
    ) {
      excludedTerms.push(phrase);
    }
  }

  return {
    isVegetarian,
    isVegan,
    isPescatarian,
    isHalal,
    isKosher,
    noPork,
    noBeef,
    noSeafood,
    noNuts,
    noDairy,
    noGluten,
    noEggs,
    noSoy,
    noShellfish,
    excludedTerms
  };
}

export function passesDietFilter(candidate: HydratedCandidate, filter: ParsedDietFilter): boolean {
  const cat = candidate.category;
  const rawParts = [candidate.name, ...candidate.ingredientItems.map((i) => i.ingredient)];
  const rawCombined = rawParts.join(' | ');
  const plantMasked = rawCombined.replace(PLANT_SAFE_MASK_RE, ' plant_safe_item ');

  if (filter.isVegetarian) {
    if (['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood'].includes(cat)) return false;
    if (LAND_MEAT_RE.test(plantMasked) || SEAFOOD_RE.test(plantMasked)) return false;
  }

  if (filter.isVegan) {
    if (['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat', 'Seafood'].includes(cat)) return false;
    if (
      LAND_MEAT_RE.test(plantMasked) ||
      SEAFOOD_RE.test(plantMasked) ||
      EGG_RE.test(plantMasked) ||
      DAIRY_RE.test(plantMasked) ||
      VEGAN_EXTRA_ANIMAL_RE.test(plantMasked)
    ) {
      return false;
    }
  }

  if (filter.isPescatarian) {
    if (['Beef', 'Chicken', 'Pork', 'Lamb', 'Goat'].includes(cat)) return false;
    if (LAND_MEAT_RE.test(plantMasked)) return false;
  }

  if (filter.isHalal) {
    if (cat === 'Pork') return false;
    if (PORK_RE.test(plantMasked) || ALCOHOL_RE.test(plantMasked)) return false;
  }

  if (filter.isKosher) {
    if (cat === 'Pork') return false;
    if (PORK_RE.test(plantMasked) || ALCOHOL_RE.test(plantMasked) || SHELLFISH_RE.test(plantMasked)) {
      return false;
    }
    // Kosher: do not mix land meat/poultry and dairy
    if (LAND_MEAT_RE.test(plantMasked) && DAIRY_RE.test(plantMasked)) {
      return false;
    }
  }

  if (filter.noPork && (cat === 'Pork' || PORK_RE.test(plantMasked))) return false;
  if (filter.noBeef && (cat === 'Beef' || BEEF_RE.test(plantMasked))) return false;
  if (filter.noSeafood && (cat === 'Seafood' || SEAFOOD_RE.test(plantMasked))) return false;
  if (filter.noShellfish && SHELLFISH_RE.test(plantMasked)) return false;
  if (filter.noEggs && EGG_RE.test(plantMasked)) return false;
  if (filter.noDairy && DAIRY_RE.test(plantMasked)) return false;
  if (filter.noNuts && NUTS_RE.test(rawCombined)) return false;
  if (filter.noSoy && SOY_RE.test(rawCombined)) return false;
  if (filter.noGluten) {
    const glutenMasked = rawCombined.replace(GLUTEN_SAFE_MASK_RE, ' gluten_safe_item ');
    if (GLUTEN_RE.test(glutenMasked)) return false;
  }

  for (const term of filter.excludedTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${escaped}`, 'i').test(rawCombined)) {
      return false;
    }
  }

  return true;
}

// ---------------- SLOT APPROPRIATENESS RULES ----------------

const BREAKFAST_POSITIVE_RE =
  /\b(breakfast|porridge|pancakes?|poffertjes|crepes?|blini|waffles?|omelette|omelet|eggs?|benedict|shakshuka|lahsa|kedgeree|grits|ugali|oatmeal|oats|granola|muesli|torrijas|french toast|toast|pastries|pastry|mandazi|muffins?|croissant|bagel|smoothie|fruit|yogurt)\b/i;

const NON_BREAKFAST_SAVORY_OR_DESSERT_RE =
  /\b(curry|stew|roast|burger|pizza|lasagne|lasagna|spaghetti|macaroni|soup|chili|chilli|fajita|taco|pie|cheesecake|brownie|tiramisu|trifle|mousse|deviled eggs)\b/i;

const SWEET_DESSERT_TITLE_RE =
  /\b(cake|cakes|pie|tart|rijstevlaai|pudding|brownie|cookie|biscuit|fudge|trifle|tiramisu|cheesecake|mousse|crumble|cobbler|ice cream|sorbet|sweet|sugar syrup|tamarind balls|pops)\b/i;

const TINY_CONDIMENT_OR_SNACK_RE =
  /\b(paracuca|roasted peanuts|pickle|pickled|sauce|chutney|jam|dip|gohan rice)\b/i;

function isAppropriateForSlot(
  candidate: HydratedCandidate,
  slot: MealType,
  isSundayTreat: boolean
): boolean {
  const title = candidate.name;
  const cat = candidate.category;

  if (isSundayTreat && slot === 'dinner') {
    // Sunday treat allows comfort foods ("pie", "roast", "cake", "pudding", "mac and cheese")
    if (TINY_CONDIMENT_OR_SNACK_RE.test(title)) return false;
    if (/\b(pancakes?|poffertjes|blini)\b/i.test(title)) return false;
    return true;
  }

  if (slot === 'breakfast') {
    if (['Beef', 'Chicken', 'Lamb', 'Goat', 'Pasta'].includes(cat)) return false;
    if (NON_BREAKFAST_SAVORY_OR_DESSERT_RE.test(title)) return false;
    if (cat === 'Breakfast') return true;
    return BREAKFAST_POSITIVE_RE.test(title);
  }

  if (slot === 'lunch') {
    if (cat === 'Dessert' || cat === 'Breakfast') return false;
    if (SWEET_DESSERT_TITLE_RE.test(title)) return false;
    if (/\b(pickle|paracuca|roasted peanuts)\b/i.test(title)) return false;
    return true;
  }

  if (slot === 'dinner') {
    if (cat === 'Dessert' || cat === 'Breakfast') return false;
    if (SWEET_DESSERT_TITLE_RE.test(title)) return false;
    if (TINY_CONDIMENT_OR_SNACK_RE.test(title)) return false;
    return true;
  }

  // Snack slot
  if (TINY_CONDIMENT_OR_SNACK_RE.test(title) && /pickle/i.test(title)) return false;
  return true;
}

// ---------------- SLOT CANDIDATE POOL BUILDERS ----------------

interface SlotPoolConfig {
  primaryCategories: string[];
  primaryTerms: string[];
  fallbackCategories: string[];
  fallbackTerms: string[];
}

function getSlotQueryConfig(slot: MealType, isSundayTreat: boolean, filter: ParsedDietFilter): SlotPoolConfig {
  if (isSundayTreat && slot === 'dinner') {
    return {
      primaryCategories: [],
      primaryTerms: ['pie', 'roast', 'cake', 'pudding', 'mac and cheese'],
      fallbackCategories: filter.isVegan ? ['Vegan'] : filter.isVegetarian ? ['Pasta', 'Vegetarian'] : ['Pasta'],
      fallbackTerms: ['lasagne', 'tart', 'crumble', 'cheese']
    };
  }

  if (slot === 'breakfast') {
    return {
      primaryCategories: ['Breakfast'],
      primaryTerms: ['breakfast', 'porridge', 'pancakes', 'eggs'],
      fallbackCategories: filter.isVegan ? ['Vegan'] : [],
      fallbackTerms: ['omelette', 'grits', 'banana', 'toast', 'fruit', 'crepe', 'bean']
    };
  }

  if (slot === 'lunch') {
    return {
      primaryCategories: [],
      primaryTerms: ['salad', 'sandwich', 'soup', 'wrap'],
      fallbackCategories: filter.isVegan ? ['Vegan'] : filter.isVegetarian ? ['Vegetarian'] : ['Starter', 'Side'],
      fallbackTerms: ['bean', 'chickpea', 'lentil', 'tofu', 'fajita', 'hummus', 'cheese']
    };
  }

  if (slot === 'dinner') {
    return {
      primaryCategories: [],
      primaryTerms: ['curry', 'roast', 'stew', 'pasta', 'rice'],
      fallbackCategories: filter.isVegan
        ? ['Vegan']
        : filter.isVegetarian
          ? ['Vegetarian', 'Pasta']
          : filter.isPescatarian
            ? ['Seafood', 'Pasta']
            : ['Pasta'],
      fallbackTerms: ['chili', 'lentil', 'chickpea', 'tofu', 'bean', 'lasagne', 'casserole', 'noodles']
    };
  }

  // Snack
  return {
    primaryCategories: ['Starter', 'Side'],
    primaryTerms: ['fruit', 'hummus', 'salad', 'pancakes'],
    fallbackCategories: filter.isVegan ? ['Vegan'] : ['Breakfast'],
    fallbackTerms: ['porridge', 'soup', 'bean']
  };
}

async function fetchHydratedPool(
  categories: string[],
  terms: string[],
  filter: ParsedDietFilter,
  slot: MealType,
  isSundayTreat: boolean,
  maxCategoryLookups = 24
): Promise<HydratedCandidate[]> {
  const byId = new Map<string, HydratedCandidate>();

  // 1. Search terms (each search.php call returns already-hydrated recipes!)
  const termResults = await mapWithConcurrency(terms, 4, (t) => searchMealDbByTerm(t));
  for (const list of termResults) {
    for (const raw of list) {
      if (!raw?.idMeal || byId.has(String(raw.idMeal))) continue;
      const hydrated = hydrateMealCandidate(raw);
      if (!hydrated) continue;
      if (!passesDietFilter(hydrated, filter)) continue;
      if (!isAppropriateForSlot(hydrated, slot, isSundayTreat)) continue;
      byId.set(hydrated.idMeal, hydrated);
    }
  }

  // 2. Category filters (requires lookup.php hydration for non-cached IDs)
  if (categories.length > 0) {
    const catLists = await mapWithConcurrency(categories, 3, (c) => filterMealDbByCategory(c));
    const summaryQueue: Array<{ idMeal: string; strMeal: string }> = [];
    for (const list of catLists) {
      for (const item of list) {
        if (!item?.idMeal || byId.has(String(item.idMeal))) continue;
        // Quick title pre-filter to avoid unnecessary lookups on obvious meat dishes for vegetarians
        if (filter.isVegetarian && (LAND_MEAT_RE.test(item.strMeal) || SEAFOOD_RE.test(item.strMeal))) {
          continue;
        }
        if (filter.isPescatarian && LAND_MEAT_RE.test(item.strMeal)) {
          continue;
        }
        summaryQueue.push(item);
      }
    }

    const capped = summaryQueue.slice(0, maxCategoryLookups);
    const lookedUp = await mapWithConcurrency(capped, 5, (s) => lookupMealDbById(s.idMeal));
    for (const raw of lookedUp) {
      if (!raw?.idMeal || byId.has(String(raw.idMeal))) continue;
      const hydrated = hydrateMealCandidate(raw);
      if (!hydrated) continue;
      if (!passesDietFilter(hydrated, filter)) continue;
      if (!isAppropriateForSlot(hydrated, slot, isSundayTreat)) continue;
      byId.set(hydrated.idMeal, hydrated);
    }
  }

  return Array.from(byId.values());
}

function candidateToPlanDayMeal(
  candidate: HydratedCandidate,
  slot: MealType,
  slotTargetCalories: number,
  options: { isSundayTreat?: boolean; forceCalorieDiffNote?: boolean }
): PlanDayMeal {
  const diff = candidate.calories - slotTargetCalories;
  const absDiff = Math.abs(diff);
  const tolerance = Math.max(75, Math.round(slotTargetCalories * 0.2));

  let calorieNote: string | undefined;
  if (options.isSundayTreat) {
    calorieNote = 'Sunday treat — slightly over target.';
  } else if ((options.forceCalorieDiffNote || absDiff > tolerance) && absDiff > 0) {
    calorieNote = `This recipe is ${absDiff} kcal ${diff > 0 ? 'over' : 'under'} your target for this meal.`;
  }

  return {
    mealType: slot,
    mealDbId: candidate.idMeal,
    idMeal: candidate.idMeal,
    name: candidate.name,
    category: candidate.category,
    area: candidate.area,
    imageUrl: candidate.imageUrl,
    ingredientItems: candidate.ingredientItems,
    ingredients: candidate.ingredientsFormatted,
    rawInstructions: candidate.rawInstructions,
    instructions: candidate.instructionSteps,
    sourceAttribution: 'Recipe from TheMealDB',
    targetSlotCalories: slotTargetCalories,
    calorieNote,
    isSundayTreat: Boolean(options.isSundayTreat),
    calories: candidate.calories,
    protein: candidate.protein,
    carbs: candidate.carbs,
    fat: candidate.fat,
    prepTime: candidate.prepTime,
    cookTime: candidate.cookTime,
    totalTime:
      candidate.prepTime !== 'Not specified' || candidate.cookTime !== 'Not specified'
        ? `${candidate.prepTime} / ${candidate.cookTime}`
        : 'Not specified',
    aisle: candidate.aisle,
    servings: 1,
    logged: false
  };
}

function createNoMatchPlanMeal(slot: MealType, slotTargetCalories: number): PlanDayMeal {
  return {
    mealType: slot,
    name: 'No matching TheMealDB recipe found',
    ingredients: [],
    ingredientItems: [],
    instructions: [],
    rawInstructions: '',
    sourceAttribution: 'Recipe from TheMealDB',
    targetSlotCalories: slotTargetCalories,
    noMatchMessage:
      'TheMealDB did not return a recipe matching your dietary preferences and exclusions for this slot.',
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    prepTime: 'Not specified',
    cookTime: 'Not specified',
    totalTime: 'Not specified',
    aisle: 'produce',
    servings: 1,
    logged: false
  };
}

function selectBestCandidateForRegularSlot(
  pool: HydratedCandidate[],
  slotTarget: number,
  usedIdsInWeek: Map<string, number>,
  usedIdsToday: Set<string>,
  dayIndex: number
): HydratedCandidate | null {
  if (pool.length === 0) return null;

  // Prefer recipes not used today, and lightly penalize recipes already used earlier in the week
  const available = pool.filter((c) => !usedIdsToday.has(c.idMeal));
  const candidates = available.length > 0 ? available : pool;

  const scored = candidates.map((c, idx) => {
    const calDiff = Math.abs(c.calories - slotTarget);
    const repeatCount = usedIdsInWeek.get(c.idMeal) || 0;
    // Small tie-breaker rotation by dayIndex so identically-scored recipes vary across the week
    const tieBreaker = ((idx + dayIndex) % 7) * 0.5;
    const score = calDiff + repeatCount * 115 + tieBreaker;
    return { candidate: c, score, calDiff };
  });

  scored.sort((a, b) => a.score - b.score);
  return scored[0].candidate;
}

function selectBestSundayTreatCandidate(
  comfortPool: HydratedCandidate[],
  normalDinnerTarget: number,
  dailyTarget: number,
  sundayOtherMealsKcal: number,
  usedIdsInWeek: Map<string, number>
): HydratedCandidate | null {
  if (comfortPool.length === 0) return null;

  // Sunday dinner can make the day up to 200 kcal over dailyTarget, and should be slightly over target
  const remainingForExactDaily = Math.max(250, dailyTarget - sundayOtherMealsKcal);
  const minOverTarget = Math.max(normalDinnerTarget + 10, remainingForExactDaily + 10);
  const maxAllowedDinner = Math.max(
    minOverTarget + 25,
    Math.min(normalDinnerTarget + 200, dailyTarget + 200 - sundayOtherMealsKcal)
  );
  const idealTreatKcal = Math.round((minOverTarget + maxAllowedDinner) / 2);

  // 1. Ideal window: comfort recipes that are genuinely slightly over target AND <= +200 kcal cap
  const inSweetSpot = comfortPool.filter(
    (c) => c.calories > Math.min(normalDinnerTarget, remainingForExactDaily) && c.calories <= maxAllowedDinner
  );
  if (inSweetSpot.length > 0) {
    inSweetSpot.sort((a, b) => {
      const aSavoryBonus = a.category !== 'Dessert' ? -85 : 0;
      const bSavoryBonus = b.category !== 'Dessert' ? -85 : 0;
      const aScore = Math.abs(a.calories - idealTreatKcal) + (usedIdsInWeek.get(a.idMeal) || 0) * 60 + aSavoryBonus;
      const bScore = Math.abs(b.calories - idealTreatKcal) + (usedIdsInWeek.get(b.idMeal) || 0) * 60 + bSavoryBonus;
      return aScore - bScore;
    });
    return inSweetSpot[0];
  }

  // 2. Next best: comfort recipes within +200 kcal ceiling closest to idealTreatKcal
  const underCap = comfortPool.filter((c) => c.calories <= dailyTarget + 200 - sundayOtherMealsKcal);
  if (underCap.length > 0) {
    underCap.sort((a, b) => {
      const aSavoryBonus = a.category !== 'Dessert' ? -55 : 0;
      const bSavoryBonus = b.category !== 'Dessert' ? -55 : 0;
      return (
        Math.abs(a.calories - idealTreatKcal) + aSavoryBonus - (Math.abs(b.calories - idealTreatKcal) + bSavoryBonus)
      );
    });
    return underCap[0];
  }

  // 3. Fallback: closest comfort recipe to idealTreatKcal without inventing anything
  const sortedAll = [...comfortPool].sort(
    (a, b) => Math.abs(a.calories - idealTreatKcal) - Math.abs(b.calories - idealTreatKcal)
  );
  return sortedAll[0];
}

// ---------------- DETERMINISTIC WORKOUT SCHEDULE (NO AI) ----------------

function buildWeeklyWorkoutForDay(
  dayIndex: number,
  workoutDaysPerWeek: number,
  equipment: string,
  injuries: string
): PlanDayWorkout {
  const activeCount = Math.min(7, Math.max(1, Number(workoutDaysPerWeek) || 4));
  // Spread training days evenly across Monday(0)..Sunday(6)
  const schedulePatterns: Record<number, number[]> = {
    1: [2],
    2: [1, 4],
    3: [0, 2, 4],
    4: [0, 1, 3, 5],
    5: [0, 1, 2, 4, 5],
    6: [0, 1, 2, 3, 4, 5],
    7: [0, 1, 2, 3, 4, 5, 6]
  };
  const activeDays = schedulePatterns[activeCount] || schedulePatterns[4];
  if (!activeDays.includes(dayIndex)) {
    return {
      name: 'Rest & Recovery',
      isRest: true,
      exercises: [],
      logged: false
    };
  }

  const eq = String(equipment || 'Dumbbells').toLowerCase();
  const inj = String(injuries || '').toLowerCase();
  const avoidKnees = /\b(knee|meniscus|acl)\b/.test(inj);
  const avoidBack = /\b(back|spine|sciatica|lumbar)\b/.test(inj);

  const sessionOrder = activeDays.indexOf(dayIndex) % 4;
  if (eq.includes('none')) {
    const bodyweightSessions: PlanDayWorkout[] = [
      {
        name: 'Upper Body & Core Bodyweight',
        isRest: false,
        exercises: [
          { name: 'Push-Ups', setsAndReps: '3 sets of 10-15 reps' },
          { name: 'Pike Shoulder Press', setsAndReps: '3 sets of 8-12 reps' },
          { name: 'Bench or Chair Tricep Dips', setsAndReps: '3 sets of 12 reps' },
          { name: 'Forearm Plank', setsAndReps: '3 sets of 45 sec' }
        ],
        logged: false
      },
      {
        name: 'Lower Body Stability & Glutes',
        isRest: false,
        exercises: [
          { name: avoidKnees ? 'Glute Bridges' : 'Bodyweight Squats', setsAndReps: '4 sets of 15 reps' },
          { name: avoidKnees ? 'Side-Lying Hip Abductions' : 'Reverse Lunges', setsAndReps: '3 sets of 12 reps/side' },
          { name: 'Single-Leg Calf Raises', setsAndReps: '3 sets of 15 reps/side' },
          { name: 'Dead Bug Core Hold', setsAndReps: '3 sets of 12 reps' }
        ],
        logged: false
      },
      {
        name: 'Low-Impact Cardio & Conditioning',
        isRest: false,
        exercises: [
          { name: 'Brisk Incline Walk or March', setsAndReps: '20 mins steady pace' },
          { name: 'Mountain Climbers (controlled)', setsAndReps: '3 sets of 30 sec' },
          { name: 'Bird-Dog Reach', setsAndReps: '3 sets of 10 reps/side' }
        ],
        logged: false
      },
      {
        name: 'Full Body Mobility & Endurance',
        isRest: false,
        exercises: [
          { name: 'Incline Push-Ups', setsAndReps: '3 sets of 12-15 reps' },
          { name: 'Glute Bridge March', setsAndReps: '3 sets of 12 reps' },
          { name: 'Side Plank', setsAndReps: '3 sets of 30 sec/side' }
        ],
        logged: false
      }
    ];
    return bodyweightSessions[sessionOrder];
  }

  const weightedSessions: PlanDayWorkout[] = [
    {
      name: 'Upper Body Push & Pull',
      isRest: false,
      exercises: [
        { name: eq.includes('gym') ? 'Barbell or Dumbbell Bench Press' : 'Dumbbell Floor/Bench Press', setsAndReps: '4 sets of 8-10 reps' },
        { name: avoidBack ? 'Chest-Supported Dumbbell Row' : 'One-Arm Dumbbell Row', setsAndReps: '4 sets of 10-12 reps' },
        { name: 'Seated Dumbbell Overhead Press', setsAndReps: '3 sets of 10 reps' },
        { name: 'Dumbbell Bicep Curls', setsAndReps: '3 sets of 12 reps' }
      ],
      logged: false
    },
    {
      name: 'Lower Body Strength',
      isRest: false,
      exercises: [
        { name: avoidKnees ? 'Dumbbell Hip Thrusts' : 'Goblet Squats', setsAndReps: '4 sets of 10-12 reps' },
        { name: avoidBack ? 'Step-Ups' : 'Dumbbell Romanian Deadlifts', setsAndReps: '3 sets of 10 reps' },
        { name: avoidKnees ? 'Standing Hamstring Curls' : 'Dumbbell Split Squats', setsAndReps: '3 sets of 10 reps/side' },
        { name: 'Standing Calf Raises', setsAndReps: '3 sets of 15 reps' }
      ],
      logged: false
    },
    {
      name: 'Metabolic Conditioning & Core',
      isRest: false,
      exercises: [
        { name: 'Dumbbell Thrusters or Push Press', setsAndReps: '3 sets of 10 reps' },
        { name: 'Renegade Rows or Plank Taps', setsAndReps: '3 sets of 10 reps' },
        { name: 'Farmer Carries', setsAndReps: '3 sets of 45 sec' },
        { name: 'Brisk Walk or Cycling Cooldown', setsAndReps: '15 mins steady pace' }
      ],
      logged: false
    },
    {
      name: 'Full Body Hypertrophy',
      isRest: false,
      exercises: [
        { name: 'Incline Dumbbell Press', setsAndReps: '3 sets of 10-12 reps' },
        { name: eq.includes('gym') ? 'Lat Pulldown' : 'Dumbbell Pullover', setsAndReps: '3 sets of 12 reps' },
        { name: 'Lateral Shoulder Raises', setsAndReps: '3 sets of 12-15 reps' },
        { name: 'Weighted Glute Bridge', setsAndReps: '3 sets of 12 reps' }
      ],
      logged: false
    }
  ];
  return weightedSessions[sessionOrder];
}

// ---------------- MAIN 7-DAY PLAN GENERATOR & SINGLE-SLOT SWAP ----------------

export function getSlotCalorieSplit(mealsPerDay: number): Array<{ mealType: MealType; share: number }> {
  if (mealsPerDay === 4) {
    // Breakfast 25%, Lunch 35%, Dinner 40% scaled by 0.90 + 10% Snack
    return [
      { mealType: 'breakfast', share: 0.225 },
      { mealType: 'lunch', share: 0.315 },
      { mealType: 'snack', share: 0.10 },
      { mealType: 'dinner', share: 0.36 }
    ];
  }
  if (mealsPerDay >= 5) {
    // Breakfast 25%, Lunch 35%, Dinner 40% scaled by 0.80 + two 10% Snacks
    return [
      { mealType: 'breakfast', share: 0.20 },
      { mealType: 'snack', share: 0.10 },
      { mealType: 'lunch', share: 0.28 },
      { mealType: 'snack', share: 0.10 },
      { mealType: 'dinner', share: 0.32 }
    ];
  }
  // Standard 3 meals/day: Breakfast 25%, Lunch 35%, Dinner 40%
  return [
    { mealType: 'breakfast', share: 0.25 },
    { mealType: 'lunch', share: 0.35 },
    { mealType: 'dinner', share: 0.40 }
  ];
}

export async function generateWeekPlanFromMealDb(
  userId: string,
  req: GenerateMealDbPlanRequest
): Promise<WeekPlan> {
  const dailyTargetCalories = Math.max(800, Math.round(Number(req.dailyTargetCalories) || 2000));
  const prefs = {
    restrictions: req.preferences?.restrictions || [],
    allergies: req.preferences?.allergies || [],
    dislikes: req.preferences?.dislikes || '',
    cookTime: req.preferences?.cookTime || 'Any',
    mealsPerDay: Number(req.preferences?.mealsPerDay) || 3,
    budget: req.preferences?.budget || 'Moderate',
    workoutDaysPerWeek: Number(req.preferences?.workoutDaysPerWeek) || 4,
    equipment: req.preferences?.equipment || 'Dumbbells',
    injuries: req.preferences?.injuries || '',
    narrowingText: req.preferences?.narrowingText || ''
  };

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const includeMeals = req.type !== 'workouts';
  const includeWorkouts = req.type === 'workouts' || req.type === 'both';

  const filter = buildDietFilter(req);
  const slotSplit = getSlotCalorieSplit(prefs.mealsPerDay);
  const uniqueSlots = Array.from(new Set(slotSplit.map((s) => s.mealType)));

  // Pre-build primary & fallback pools per slot so we only query TheMealDB once per slot type
  const primaryPools = new Map<string, HydratedCandidate[]>();
  const mergedFallbackPools = new Map<string, HydratedCandidate[]>();

  if (includeMeals) {
    await Promise.all(
      uniqueSlots.map(async (slot) => {
        const cfg = getSlotQueryConfig(slot, false, filter);
        const primary = await fetchHydratedPool(cfg.primaryCategories, cfg.primaryTerms, filter, slot, false, 24);
        primaryPools.set(slot, primary);

        // If primary pool is small (< 7 distinct dishes) or lacks close calorie variety, also load fallback terms
        if (primary.length < 7) {
          const extra = await fetchHydratedPool(
            cfg.fallbackCategories,
            cfg.fallbackTerms,
            filter,
            slot,
            false,
            32
          );
          const merged = new Map<string, HydratedCandidate>();
          for (const item of [...primary, ...extra]) merged.set(item.idMeal, item);
          mergedFallbackPools.set(slot, Array.from(merged.values()));
        }
      })
    );

    // Pre-build Sunday comfort dinner pool ("pie", "roast", "cake", "pudding", "mac and cheese")
    const sundayCfg = getSlotQueryConfig('dinner', true, filter);
    const sundayPrimary = await fetchHydratedPool(
      sundayCfg.primaryCategories,
      sundayCfg.primaryTerms,
      filter,
      'dinner',
      true,
      20
    );
    primaryPools.set('sunday_dinner', sundayPrimary);
    if (sundayPrimary.length < 4) {
      const sundayExtra = await fetchHydratedPool(
        sundayCfg.fallbackCategories,
        sundayCfg.fallbackTerms,
        filter,
        'dinner',
        true,
        24
      );
      const merged = new Map<string, HydratedCandidate>();
      for (const item of [...sundayPrimary, ...sundayExtra]) merged.set(item.idMeal, item);
      mergedFallbackPools.set('sunday_dinner', Array.from(merged.values()));
    }
  }

  const usedIdsInWeek = new Map<string, number>();
  const days: PlanDay[] = [];

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const isSunday = dayIndex === 6;
    const usedIdsToday = new Set<string>();
    const meals: PlanDayMeal[] = [];

    if (includeMeals) {
      // On Sunday, compute non-dinner slots first so Sunday Dinner knows exact remaining daily calories
      const orderedSlots = slotSplit.map((entry, originalIdx) => ({ ...entry, originalIdx }));
      if (isSunday) {
        orderedSlots.sort((a, b) => (a.mealType === 'dinner' ? 1 : b.mealType === 'dinner' ? -1 : a.originalIdx - b.originalIdx));
      }

      const placedByOriginalIdx = new Map<number, PlanDayMeal>();

      for (const slotSpec of orderedSlots) {
        const slotTarget = Math.round(dailyTargetCalories * slotSpec.share);
        const isSundayDinnerTreat = isSunday && slotSpec.mealType === 'dinner';

        if (isSundayDinnerTreat) {
          const sundayOtherMealsKcal = Array.from(placedByOriginalIdx.values()).reduce(
            (sum, m) => sum + (m.calories || 0),
            0
          );

          let comfortPool = primaryPools.get('sunday_dinner') || [];
          let usedFallback = false;
          let chosen = selectBestSundayTreatCandidate(
            comfortPool,
            slotTarget,
            dailyTargetCalories,
            sundayOtherMealsKcal,
            usedIdsInWeek
          );

          if (!chosen) {
            if (!mergedFallbackPools.has('sunday_dinner')) {
              const sundayCfg = getSlotQueryConfig('dinner', true, filter);
              const extra = await fetchHydratedPool(
                sundayCfg.fallbackCategories,
                sundayCfg.fallbackTerms,
                filter,
                'dinner',
                true,
                28
              );
              const merged = new Map<string, HydratedCandidate>();
              for (const item of [...comfortPool, ...extra]) merged.set(item.idMeal, item);
              mergedFallbackPools.set('sunday_dinner', Array.from(merged.values()));
            }
            comfortPool = mergedFallbackPools.get('sunday_dinner') || [];
            usedFallback = true;
            chosen = selectBestSundayTreatCandidate(
              comfortPool,
              slotTarget,
              dailyTargetCalories,
              sundayOtherMealsKcal,
              usedIdsInWeek
            );
          }

          if (chosen) {
            usedIdsToday.add(chosen.idMeal);
            usedIdsInWeek.set(chosen.idMeal, (usedIdsInWeek.get(chosen.idMeal) || 0) + 1);
            placedByOriginalIdx.set(
              slotSpec.originalIdx,
              candidateToPlanDayMeal(chosen, 'dinner', slotTarget, {
                isSundayTreat: true,
                forceCalorieDiffNote: usedFallback
              })
            );
          } else {
            placedByOriginalIdx.set(slotSpec.originalIdx, createNoMatchPlanMeal('dinner', slotTarget));
          }
          continue;
        }

        // Standard slot selection (Monday–Saturday all meals, and Sunday Breakfast/Lunch/Snack)
        const primaryPool = primaryPools.get(slotSpec.mealType) || [];
        const tolerance = Math.max(75, Math.round(slotTarget * 0.2));
        let chosen = selectBestCandidateForRegularSlot(
          primaryPool,
          slotTarget,
          usedIdsInWeek,
          usedIdsToday,
          dayIndex
        );

        let usedFallbackSearch = false;
        if (!chosen || Math.abs(chosen.calories - slotTarget) > tolerance) {
          // Requirement 1.5: Try a different search term if primary has no recipe fitting diet + calorie target
          if (!mergedFallbackPools.has(slotSpec.mealType)) {
            const cfg = getSlotQueryConfig(slotSpec.mealType, false, filter);
            const extra = await fetchHydratedPool(
              cfg.fallbackCategories,
              cfg.fallbackTerms,
              filter,
              slotSpec.mealType,
              false,
              32
            );
            const merged = new Map<string, HydratedCandidate>();
            for (const item of [...primaryPool, ...extra]) merged.set(item.idMeal, item);
            mergedFallbackPools.set(slotSpec.mealType, Array.from(merged.values()));
          }
          const expandedPool = mergedFallbackPools.get(slotSpec.mealType) || primaryPool;
          const fallbackCandidate = selectBestCandidateForRegularSlot(
            expandedPool,
            slotTarget,
            usedIdsInWeek,
            usedIdsToday,
            dayIndex
          );
          if (
            fallbackCandidate &&
            (!chosen || Math.abs(fallbackCandidate.calories - slotTarget) < Math.abs(chosen.calories - slotTarget))
          ) {
            chosen = fallbackCandidate;
            usedFallbackSearch = true;
          }
        }

        if (chosen) {
          usedIdsToday.add(chosen.idMeal);
          usedIdsInWeek.set(chosen.idMeal, (usedIdsInWeek.get(chosen.idMeal) || 0) + 1);
          const stillOutsideTolerance = Math.abs(chosen.calories - slotTarget) > tolerance;
          placedByOriginalIdx.set(
            slotSpec.originalIdx,
            candidateToPlanDayMeal(chosen, slotSpec.mealType, slotTarget, {
              isSundayTreat: false,
              forceCalorieDiffNote: stillOutsideTolerance && (usedFallbackSearch || stillOutsideTolerance)
            })
          );
        } else {
          placedByOriginalIdx.set(slotSpec.originalIdx, createNoMatchPlanMeal(slotSpec.mealType, slotTarget));
        }
      }

      for (let idx = 0; idx < slotSplit.length; idx++) {
        const meal = placedByOriginalIdx.get(idx);
        if (meal) meals.push(meal);
      }
    }

    days.push({
      dayIndex,
      dayName: dayNames[dayIndex],
      meals,
      workout: includeWorkouts
        ? buildWeeklyWorkoutForDay(dayIndex, prefs.workoutDaysPerWeek, prefs.equipment, prefs.injuries)
        : undefined
    });
  }

  const proteinGrams = Number(req.dailyTargetProtein) || Math.round((dailyTargetCalories * 0.3) / 4);
  const fatGrams = Number(req.dailyTargetFat) || Math.round((dailyTargetCalories * 0.3) / 9);
  const carbsGrams =
    Number(req.dailyTargetCarbs) ||
    Math.max(20, Math.round((dailyTargetCalories - (proteinGrams * 4 + fatGrams * 9)) / 4));

  return {
    userId,
    weekStartDate: formatLocalDate(),
    targetCalories: dailyTargetCalories,
    macroTarget: {
      calories: dailyTargetCalories,
      proteinGrams,
      fatGrams,
      carbsGrams,
      proteinPct: 30,
      fatPct: 30,
      carbsPct: 40
    },
    weeklyStrategy: 'Recipes searched directly from TheMealDB matched to your dietary preferences and calorie targets.',
    createdAt: Date.now(),
    generatedAt: Date.now(),
    type: req.type,
    days,
    preferences: prefs
  };
}

/**
 * Replaces a single meal in an existing WeekPlan with another real recipe from TheMealDB
 * matching the same slot, dietary preferences, and calorie target (never inventing a recipe).
 */
export async function swapPlanMealFromMealDb(
  plan: WeekPlan,
  dayIndex: number,
  mealIndex: number,
  dailyTargetCalories: number,
  profileRestrictions?: string[]
): Promise<PlanDayMeal | null> {
  const day = plan.days?.[dayIndex];
  const currentMeal = day?.meals?.[mealIndex];
  if (!day || !currentMeal) return null;

  const isSundayTreat = dayIndex === 6 && currentMeal.mealType === 'dinner';
  const filter = buildDietFilter({
    type: plan.type || 'both',
    dailyTargetCalories,
    profileRestrictions,
    preferences: plan.preferences
  });

  const cfg = getSlotQueryConfig(currentMeal.mealType, isSundayTreat, filter);
  const primary = await fetchHydratedPool(
    cfg.primaryCategories,
    cfg.primaryTerms,
    filter,
    currentMeal.mealType,
    isSundayTreat,
    24
  );
  const extra = await fetchHydratedPool(
    cfg.fallbackCategories,
    cfg.fallbackTerms,
    filter,
    currentMeal.mealType,
    isSundayTreat,
    28
  );

  const mergedMap = new Map<string, HydratedCandidate>();
  for (const item of [...primary, ...extra]) {
    if (item.idMeal !== currentMeal.mealDbId && item.idMeal !== currentMeal.idMeal && item.name !== currentMeal.name) {
      mergedMap.set(item.idMeal, item);
    }
  }
  const pool = Array.from(mergedMap.values());
  if (pool.length === 0) return null;

  const slotSplit = getSlotCalorieSplit(plan.preferences?.mealsPerDay || day.meals.length || 3);
  const share = slotSplit[mealIndex]?.share || 0.33;
  const slotTarget = currentMeal.targetSlotCalories || Math.round(dailyTargetCalories * share);

  const usedIdsInWeek = new Map<string, number>();
  for (const d of plan.days) {
    for (const m of d.meals) {
      const id = m.mealDbId || m.idMeal;
      if (id) usedIdsInWeek.set(id, (usedIdsInWeek.get(id) || 0) + 1);
    }
  }

  if (isSundayTreat) {
    const otherMealsKcal = day.meals.reduce((s, m, idx) => (idx === mealIndex ? s : s + (m.calories || 0)), 0);
    const chosen = selectBestSundayTreatCandidate(
      pool,
      slotTarget,
      dailyTargetCalories,
      otherMealsKcal,
      usedIdsInWeek
    );
    if (!chosen) return null;
    return candidateToPlanDayMeal(chosen, 'dinner', slotTarget, { isSundayTreat: true });
  }

  const chosen = selectBestCandidateForRegularSlot(pool, slotTarget, usedIdsInWeek, new Set(), dayIndex + 1);
  if (!chosen) return null;
  const tolerance = Math.max(75, Math.round(slotTarget * 0.2));
  return candidateToPlanDayMeal(chosen, currentMeal.mealType, slotTarget, {
    isSundayTreat: false,
    forceCalorieDiffNote: Math.abs(chosen.calories - slotTarget) > tolerance
  });
}

export function isLegacyNonMealDbPlan(plan?: WeekPlan | null): boolean {
  if (!plan || !Array.isArray(plan.days) || plan.days.length === 0) return false;
  if (plan.type === 'workouts') return false;
  const allMeals = plan.days.flatMap((d) => d.meals || []);
  if (allMeals.length === 0) return false;
  return !allMeals.some((m) => Boolean(m.mealDbId || m.idMeal || m.noMatchMessage));
}
