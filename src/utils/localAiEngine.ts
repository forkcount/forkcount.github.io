export interface DecipheredExerciseSegment {
  description: string;
  activityName: string;
  minutes: number;
  met: number;
  intensity: 'Low' | 'Moderate' | 'High';
  caloriesBurned: number;
  distanceKm?: number;
  weightKg?: number;
  reps?: number;
}

export interface DecipheredExerciseResult {
  summaryTitle: string;
  totalMinutes: number;
  averageMet: number;
  overallIntensity: 'Low' | 'Moderate' | 'High';
  totalCaloriesBurned: number;
  segments: DecipheredExerciseSegment[];
  explanation: string;
}

export interface DecipheredFoodItem {
  rawText: string;
  name: string;
  grams: number;
  isEstimatedWeight?: boolean;
  needsWeightConfirmation?: boolean;
  notes?: string;
  isOver5kg?: boolean;
  kgAmount?: number;
  suggestedGrams?: number;
  over5kgWarning?: string;
  servingLabel: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodiumMg: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  sugarPer100g: number;
  sodiumMgPer100g: number;
  caffeineMg: number;
  standardDrinks: number;
  caffeineMgPer100g?: number;
  abvPercent?: number;
  category: 'produce' | 'protein' | 'dairy' | 'grain' | 'fat' | 'seasoning' | 'processed' | 'beverage';
}

export type MealContextType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface DecipheredFoodResult {
  mealSummaryName: string;
  items: DecipheredFoodItem[];
  needsWeightConfirmation: boolean;
  hasItemOver5kg: boolean;
  isOver5000Kcal: boolean;
  over5000KcalWarning?: string;
  isExtremeCalorieMeal: boolean;
  usedFallbackReference: boolean;
  referenceDailyGoal: number;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  totalFiber: number;
  totalSugar: number;
  totalSodiumMg: number;
  totalCaffeineMg: number;
  totalStandardDrinks: number;
  healthRating: number; // 1 to 10
  healthLabel: string;
  whatToAdd: string[];
  whatToTakeOut: string[];
  isRecipe?: boolean;
  recipeServings?: number;
  totalRecipeGrams?: number;
}

export interface ExercisePattern {
  keywords: RegExp;
  label: string;
  met: number;
  intensity: 'Low' | 'Moderate' | 'High';
  caloriePerRep?: number;
}

export interface ExerciseEntry {
  id: string;
  label: string;
  category: 'bodyweight' | 'cardio' | 'strength' | 'flexibility' | 'sports';
  met: number;
  intensity: 'Low' | 'Moderate' | 'High';
  caloriePerRep?: number; // Estimated kcal burned per repetition for average 70kg body weight
  matcher: RegExp;
}

export const EXERCISE_DATABASE: ExerciseEntry[] = [
  // --- Bodyweight Push-ups & Specific Variants First ---
  {
    id: 'wall-pushups',
    label: 'Wall Push-ups',
    category: 'bodyweight',
    met: 3.5,
    intensity: 'Low',
    caloriePerRep: 0.3, // ~0.3 kcal per rep (easier variant)
    matcher: /\bwall\s*push[- ]*ups?\b/i
  },
  {
    id: 'modified-pushups',
    label: 'Modified Push-ups',
    category: 'bodyweight',
    met: 4.0,
    intensity: 'Low',
    caloriePerRep: 0.35,
    matcher: /\b(?:(?:knee|kneeling|modified|incline)\s*push[- ]*ups?|push[- ]*ups?\s*(?:modified|on\s*knees|incline))\b/i
  },
  {
    id: 'high-intensity-pushups',
    label: 'High-Intensity Push-ups',
    category: 'bodyweight',
    met: 6.0,
    intensity: 'High',
    caloriePerRep: 0.6,
    matcher: /\b(?:(?:diamond|decline|clap|clapping|explosive|weighted|archer)\s*push[- ]*ups?|push[- ]*ups?\s*(?:diamond|decline|clap|weighted))\b/i
  },
  {
    id: 'pushups',
    label: 'Push-ups',
    category: 'bodyweight',
    met: 4.8,
    intensity: 'Moderate',
    caloriePerRep: 0.5, // ~0.5 kcal per rep for standard pushups
    matcher: /\b(?:push[- ]*ups?|press[- ]*ups?)\b/i
  },

  // --- Calisthenics & Bodyweight Movements ---
  {
    id: 'jumping-jacks',
    label: 'Jumping Jacks',
    category: 'bodyweight',
    met: 8.0,
    intensity: 'Moderate',
    caloriePerRep: 0.2, // ~0.2 kcal per rep
    matcher: /\b(?:jumping\s*jacks?|jump\s*jacks?|star\s*jumps?|jumpingjacks?)\b/i
  },
  {
    id: 'jump-squats',
    label: 'Jump Squats',
    category: 'bodyweight',
    met: 8.0,
    intensity: 'High',
    caloriePerRep: 0.6,
    matcher: /\b(?:jump|plyo|box|explosive)\s*squats?\b/i
  },
  {
    id: 'weighted-squats',
    label: 'Weighted Squats',
    category: 'strength',
    met: 6.0,
    intensity: 'Moderate',
    caloriePerRep: 0.5,
    matcher: /\b(?:sumo|goblet|barbell|heavy|front|back)\s*squats?\b/i
  },
  {
    id: 'squats',
    label: 'Squats',
    category: 'bodyweight',
    met: 5.0,
    intensity: 'Moderate',
    caloriePerRep: 0.4, // ~0.4 kcal per rep
    matcher: /\b(?:air\s*squats?|bodyweight\s*squats?|squats?)\b/i
  },
  {
    id: 'assisted-pullups',
    label: 'Assisted Pull-ups',
    category: 'bodyweight',
    met: 5.0,
    intensity: 'Moderate',
    caloriePerRep: 0.6,
    matcher: /\b(?:assisted|banded|negative)\s*(?:pull[- ]*ups?|chin[- ]*ups?)\b/i
  },
  {
    id: 'pullups',
    label: 'Pull-ups',
    category: 'bodyweight',
    met: 8.0,
    intensity: 'High',
    caloriePerRep: 1.0, // ~1.0 kcal per rep
    matcher: /\b(?:pull[- ]*ups?|chin[- ]*ups?)\b/i
  },
  {
    id: 'jump-lunges',
    label: 'Jump Lunges',
    category: 'bodyweight',
    met: 7.5,
    intensity: 'High',
    caloriePerRep: 0.5,
    matcher: /\b(?:jump|jumping|explosive)\s*lunges?\b/i
  },
  {
    id: 'lunges',
    label: 'Lunges',
    category: 'bodyweight',
    met: 4.8,
    intensity: 'Moderate',
    caloriePerRep: 0.35, // ~0.35 kcal per rep
    matcher: /\b(?:walking\s*lunges?|reverse\s*lunges?|forward\s*lunges?|lunges?)\b/i
  },
  {
    id: 'burpees',
    label: 'Burpees',
    category: 'bodyweight',
    met: 10.0,
    intensity: 'High',
    caloriePerRep: 0.6, // ~0.6 kcal per rep
    matcher: /\bburpees?\b/i
  },
  {
    id: 'situps',
    label: 'Sit-ups',
    category: 'bodyweight',
    met: 4.5,
    intensity: 'Moderate',
    caloriePerRep: 0.35, // ~0.35 kcal per rep
    matcher: /\b(?:sit[- ]*ups?|crunches?|ab\s*crunches?|abdominal\s*crunches?)\b/i
  },
  {
    id: 'wall-sit',
    label: 'Wall Sit',
    category: 'bodyweight',
    met: 4.0,
    intensity: 'Moderate',
    matcher: /\bwall\s*sits?\b/i
  },
  {
    id: 'plank',
    label: 'Plank',
    category: 'bodyweight',
    met: 4.8,
    intensity: 'Moderate',
    matcher: /\b(?:plank(?:ing)?|front\s*plank|side\s*plank)\b/i
  },
  {
    id: 'calf-raises',
    label: 'Calf Raises',
    category: 'bodyweight',
    met: 3.5,
    intensity: 'Low',
    caloriePerRep: 0.15, // ~0.15 kcal per rep
    matcher: /\b(?:calf\s*raises?|heel\s*raises?|standing\s*calf\s*raises?|seated\s*calf\s*raises?)\b/i
  },
  {
    id: 'dips',
    label: 'Dips',
    category: 'bodyweight',
    met: 6.0,
    intensity: 'Moderate',
    caloriePerRep: 0.5,
    matcher: /\b(?:tricep\s*dips?|bench\s*dips?|parallel\s*bar\s*dips?|dips?)\b/i
  },
  {
    id: 'mountain-climbers',
    label: 'Mountain Climbers',
    category: 'bodyweight',
    met: 8.0,
    intensity: 'High',
    caloriePerRep: 0.2,
    matcher: /\bmountain\s*climbers?\b/i
  },
  {
    id: 'high-knees',
    label: 'High Knees',
    category: 'bodyweight',
    met: 8.0,
    intensity: 'High',
    caloriePerRep: 0.15,
    matcher: /\bhigh\s*knees?\b/i
  },
  {
    id: 'glute-bridges',
    label: 'Glute Bridges',
    category: 'bodyweight',
    met: 3.8,
    intensity: 'Low',
    caloriePerRep: 0.3,
    matcher: /\b(?:glute\s*bridges?|hip\s*thrusts?)\b/i
  },

  // --- Cardio & Aerobic Activities ---
  {
    id: 'sprints',
    label: 'High-Intensity Intervals / Sprints',
    category: 'cardio',
    met: 10.5,
    intensity: 'High',
    matcher: /\b(?:sprint(?:ing|s)?|all[- ]out\s*run|fast\s*intervals?|hiit|tabata|circuit\s*training|crossfit)\b/i
  },
  {
    id: 'running',
    label: 'Steady-Pace Running',
    category: 'cardio',
    met: 9.8,
    intensity: 'High',
    matcher: /\b(?:run|running|steady\s*run|tempo\s*run|fast\s*jog(?:ging)?|5k|10k)\b/i
  },
  {
    id: 'jogging',
    label: 'Slow / Moderate Jog',
    category: 'cardio',
    met: 7.0,
    intensity: 'Moderate',
    matcher: /\b(?:slow\s*jog(?:ging)?|light\s*jog(?:ging)?|easy\s*jog(?:ging)?|warm[- ]?up\s*jog(?:ging)?|jog(?:ging)?)\b/i
  },
  {
    id: 'brisk-walking',
    label: 'Brisk Walking Intervals',
    category: 'cardio',
    met: 4.5,
    intensity: 'Moderate',
    matcher: /\b(?:brisk\s*walk(?:ing)?|power\s*walk(?:ing)?|incline\s*walk(?:ing)?|fast\s*walk(?:ing)?|hik(?:e|ing)|walking\s*intervals?)\b/i
  },
  {
    id: 'walking',
    label: 'Walking',
    category: 'cardio',
    met: 3.5,
    intensity: 'Low',
    matcher: /\b(?:slow\s*walk|cool[- ]?down\s*walk|stroll|casual\s*walk|walking|walk)\b/i
  },
  {
    id: 'vigorous-cycling',
    label: 'Vigorous Cycling',
    category: 'cardio',
    met: 9.0,
    intensity: 'High',
    matcher: /\b(?:spin|spinning|peloton|vigorous\s*cycl(?:e|ing)?|fast\s*bik(?:e|ing)?|road\s*cycl(?:e|ing)?)\b/i
  },
  {
    id: 'cycling',
    label: 'Cycling',
    category: 'cardio',
    met: 7.5,
    intensity: 'Moderate',
    matcher: /\b(?:cycl(?:e|ing|es)?|bik(?:e|ing|es)?|bicycl(?:e|ing)?|stationary\s*bik(?:e|ing)?)\b/i
  },
  {
    id: 'swimming',
    label: 'Swimming Laps',
    category: 'cardio',
    met: 8.0,
    intensity: 'High',
    matcher: /\b(?:swim|swimming|laps|freestyle|breaststroke)\b/i
  },
  {
    id: 'rowing',
    label: 'Rowing Machine',
    category: 'cardio',
    met: 7.5,
    intensity: 'High',
    matcher: /\b(?:row|rowing|erg|ergometer)\b/i
  },
  {
    id: 'jump-rope',
    label: 'Jump Rope / Plyometrics',
    category: 'cardio',
    met: 10.0,
    intensity: 'High',
    matcher: /\b(?:jump\s*rope|skipping|rope\s*jumping|box\s*jumps?|plyo)\b/i
  },
  {
    id: 'stair-climber',
    label: 'Stair Climber / Elliptical',
    category: 'cardio',
    met: 8.0,
    intensity: 'High',
    matcher: /\b(?:stairs?|stairmaster|stepmill|elliptical)\b/i
  },
  {
    id: 'strength-training',
    label: 'Strength & Weight Training',
    category: 'strength',
    met: 5.5,
    intensity: 'Moderate',
    matcher: /\b(?:heavy\s*lift(?:ing)?|powerlift(?:ing)?|deadlifts?|bench\s*press|barbell|strength\s*training|weightlifting|weights|lifting|dumbbells?|kettlebells?|resistance\s*bands?)\b/i
  },
  {
    id: 'pilates',
    label: 'Pilates / Core Control',
    category: 'flexibility',
    met: 3.8,
    intensity: 'Low',
    matcher: /\b(?:pilates|barre)\b/i
  },
  {
    id: 'yoga',
    label: 'Yoga & Mobility Flow',
    category: 'flexibility',
    met: 3.0,
    intensity: 'Low',
    matcher: /\b(?:yoga|stretch|stretching|mobility|foam\s*roll(?:ing)?|warm[- ]?up|cool[- ]?down)\b/i
  },
  {
    id: 'boxing',
    label: 'Boxing / Conditioning',
    category: 'sports',
    met: 8.5,
    intensity: 'High',
    matcher: /\b(?:boxing|kickboxing|mma|sparring|heavy\s*bag|martial\s*arts)\b/i
  },
  {
    id: 'court-sports',
    label: 'Court / Field Sport',
    category: 'sports',
    met: 7.8,
    intensity: 'High',
    matcher: /\b(?:tennis|basketball|soccer|football|badminton|squash|pickleball|volleyball|racquetball|racquet)\b/i
  },
  {
    id: 'dance',
    label: 'Dance / Aerobic Session',
    category: 'sports',
    met: 6.5,
    intensity: 'Moderate',
    matcher: /\b(?:dance|dancing|zumba|aerobics)\b/i
  }
];

// Backward-compatible alias for EXERCISE_PATTERNS
export const EXERCISE_PATTERNS: ExercisePattern[] = EXERCISE_DATABASE.map(e => ({
  keywords: e.matcher,
  label: e.label,
  met: e.met,
  intensity: e.intensity,
  caloriePerRep: e.caloriePerRep
}));

/**
 * Matches user input clause to the best exercise entry in the database.
 * Supports fuzzy matching for variants (e.g., "wall pushups" matches lower-intensity Wall Push-ups).
 */
export function matchExercisePattern(clause: string): ExerciseEntry {
  // 1. Direct matcher check against all definitions
  for (const entry of EXERCISE_DATABASE) {
    if (entry.matcher.test(clause)) {
      return entry;
    }
  }

  // 2. Fuzzy modifier check: if pushup root matches, resolve to appropriate variant
  if (/\b(?:push[- ]*ups?|press[- ]*ups?)\b/i.test(clause)) {
    if (/\bwall\b/i.test(clause)) {
      return EXERCISE_DATABASE.find(e => e.id === 'wall-pushups')!;
    }
    if (/\b(?:knee|kneeling|modified|incline)\b/i.test(clause)) {
      return EXERCISE_DATABASE.find(e => e.id === 'modified-pushups')!;
    }
    if (/\b(?:diamond|decline|clap|clapping|explosive|weighted)\b/i.test(clause)) {
      return EXERCISE_DATABASE.find(e => e.id === 'high-intensity-pushups')!;
    }
    return EXERCISE_DATABASE.find(e => e.id === 'pushups')!;
  }

  // 3. Fallback General Conditioning
  return {
    id: 'general-conditioning',
    label: 'General Conditioning',
    category: 'bodyweight',
    met: 5.5,
    intensity: 'Moderate',
    matcher: /.*/
  };
}

const WORD_NUMBERS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  half: 0.5,
  quarter: 0.25
};

/**
 * Splits a natural-language workout entry into distinct timed/activity clauses.
 * Handles both comma/conjunction separated inputs AND run-on inputs like:
 * "slow jog for 2 min jog 10 min walking intervals for 24 min"
 */
function splitExerciseClauses(rawText: string): string[] {
  const normalized = rawText
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return [];

  // First split by explicit separators: commas, semicolons, newlines, "followed by", "then", "and then", "+"
  const primaryParts = normalized
    .split(/(?:[,;\n+]+|\b(?:followed by|and then|then|after that|plus)\b)/i)
    .map(s => s.trim())
    .filter(Boolean);

  const finalClauses: string[] = [];

  for (const part of primaryParts) {
    // Check if this part contains multiple duration expressions (e.g. "slow jog for 2 min jog 10 min walking intervals for 24 min")
    const durationTokens = Array.from(
      part.matchAll(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/gi)
    );

    if (durationTokens.length <= 1) {
      // Also try splitting on " and " if both sides have activity words
      const andParts = part.split(/\band\b/i).map(s => s.trim()).filter(Boolean);
      if (andParts.length > 1 && andParts.every(p => /\d/.test(p) || EXERCISE_PATTERNS.some(ep => ep.keywords.test(p)))) {
        finalClauses.push(...andParts);
      } else {
        finalClauses.push(part);
      }
      continue;
    }

    // If multiple durations exist in a single run-on string, determine whether duration comes BEFORE or AFTER activity
    // e.g. Pattern A: "2 min slow jog 10 min run 24 min walk" (number at start)
    // e.g. Pattern B: "slow jog for 2 min jog 10 min walking intervals for 24 min" (duration at end of each phrase)
    const startsWithDuration = /^\d+(?:\.\d+)?\s*(?:hours?|hrs?|hr|h|minutes?|mins?|min|m|seconds?|secs?|sec|s)\b/i.test(part);

    if (startsWithDuration) {
      // Split right before each duration token
      let lastIdx = 0;
      for (let i = 1; i < durationTokens.length; i++) {
        const idx = durationTokens[i].index ?? 0;
        const slice = part.slice(lastIdx, idx).trim();
        if (slice) finalClauses.push(slice);
        lastIdx = idx;
      }
      const tail = part.slice(lastIdx).trim();
      if (tail) finalClauses.push(tail);
    } else {
      // Duration concludes each segment: slice after each duration token
      let lastIdx = 0;
      for (let i = 0; i < durationTokens.length; i++) {
        const match = durationTokens[i];
        const endIdx = (match.index ?? 0) + match[0].length;
        const slice = part.slice(lastIdx, endIdx).trim();
        if (slice) finalClauses.push(slice);
        lastIdx = endIdx;
      }
      const tail = part.slice(lastIdx).trim();
      if (tail && finalClauses.length > 0) {
        finalClauses[finalClauses.length - 1] += ` ${tail}`;
      } else if (tail) {
        finalClauses.push(tail);
      }
    }
  }

  return finalClauses.filter(Boolean);
}

interface ExtractedClauseDetails {
  minutes: number;
  hasExplicitDuration: boolean;
  reps?: number;
  distanceKm?: number;
  weightKg?: number;
}

function extractClauseDetails(clause: string, exercise: ExerciseEntry): ExtractedClauseDetails {
  let totalMinutes = 0;
  let matchedTime = false;

  // 1. Explicit duration: Hours
  const hrMatches = Array.from(clause.matchAll(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|hr|h)\b/gi));
  for (const m of hrMatches) {
    totalMinutes += parseFloat(m[1]) * 60;
    matchedTime = true;
  }

  // Explicit duration: Minutes
  const minMatches = Array.from(clause.matchAll(/(\d+(?:\.\d+)?)\s*(?:minutes?|mins?|min|m)\b/gi));
  for (const m of minMatches) {
    totalMinutes += parseFloat(m[1]);
    matchedTime = true;
  }

  // Explicit duration: Seconds
  const secMatches = Array.from(clause.matchAll(/(\d+(?:\.\d+)?)\s*(?:seconds?|secs?|sec|s)\b/gi));
  for (const m of secMatches) {
    totalMinutes += parseFloat(m[1]) / 60;
    matchedTime = true;
  }

  // Distance extraction (km / miles)
  let distanceKm: number | undefined;
  const kmMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:km|kilometers?)\b/i);
  if (kmMatch) {
    distanceKm = parseFloat(kmMatch[1]);
    if (!matchedTime) {
      const isWalk = /\bwalk/i.test(clause);
      totalMinutes = Math.round(distanceKm * (isWalk ? 11 : 6));
      matchedTime = true;
    }
  }

  const mileMatch = clause.match(/(\d+(?:\.\d+)?)\s*(?:miles?|mi)\b/i);
  if (mileMatch) {
    const mi = parseFloat(mileMatch[1]);
    distanceKm = Math.round(mi * 1.60934 * 10) / 10;
    if (!matchedTime) {
      const isWalk = /\bwalk/i.test(clause);
      totalMinutes = Math.round(mi * (isWalk ? 17 : 9.5));
      matchedTime = true;
    }
  }

  // Weight extraction (kg)
  let weightKg: number | undefined;
  const kgMatch = clause.match(/(\d+(?:\.\d+)?)\s*kg\b/i);
  if (kgMatch) {
    weightKg = parseFloat(kgMatch[1]);
  }

  // 2. Reps extraction
  let reps: number | undefined;
  const setsRepsMatch = clause.match(/(\d+)\s*sets?\s*(?:of|x|\*)\s*(\d+)\s*(?:reps?)?/i);
  if (setsRepsMatch) {
    const sets = parseInt(setsRepsMatch[1], 10);
    const setReps = parseInt(setsRepsMatch[2], 10);
    reps = sets * setReps;
  } else {
    const explicitReps = clause.match(/(\d+)\s*reps?\b/i);
    if (explicitReps) {
      reps = parseInt(explicitReps[1], 10);
    } else if (!matchedTime) {
      // Look for leading number ("10 wall pushups"), trailing number ("pushups 20"), or bare number
      const leadingNum = clause.match(/^\s*(\d+(?:\.\d+)?)\b/);
      const trailingNum = clause.match(/\b(\d+(?:\.\d+)?)\s*$/);
      const bareNum = leadingNum || trailingNum || clause.match(/\b(\d+(?:\.\d+)?)\b/);

      if (bareNum) {
        const val = parseFloat(bareNum[1]);
        if (exercise.caloriePerRep) {
          reps = Math.round(val);
        } else {
          // For duration-based activity without caloriePerRep, bare number is minutes (e.g. "15 walking")
          totalMinutes = val;
          matchedTime = true;
        }
      }
    }
  }

  const minutes = matchedTime && totalMinutes > 0
    ? Math.max(0.5, Math.round(totalMinutes * 10) / 10)
    : reps
    ? Math.max(1, Math.round((reps * 3 / 60) * 10) / 10)
    : 15;

  return {
    minutes,
    hasExplicitDuration: matchedTime,
    reps,
    distanceKm,
    weightKg
  };
}

export function decipherExerciseText(rawInput: string, userWeightKg = 70): DecipheredExerciseResult {
  const weight = userWeightKg > 20 ? userWeightKg : 70;
  const clauses = splitExerciseClauses(rawInput);

  if (clauses.length === 0) {
    return {
      summaryTitle: 'Workout Session',
      totalMinutes: 0,
      averageMet: 0,
      overallIntensity: 'Low',
      totalCaloriesBurned: 0,
      segments: [],
      explanation: 'Type your workout above to calculate calories burned.'
    };
  }

  const segments: DecipheredExerciseSegment[] = clauses.map((clause) => {
    // 1. Match exercise pattern
    const matchedExercise = matchExercisePattern(clause);

    // 2. Extract duration and reps
    const details = extractClauseDetails(clause, matchedExercise);

    // 3. Intensity modifiers in user text
    let met = matchedExercise.met;
    let intensity = matchedExercise.intensity;
    if (/\b(slow|easy|light|gentle|warm[- ]?up|cool[- ]?down|recovery)\b/i.test(clause)) {
      met = Math.max(2.5, Math.round((met * 0.85) * 10) / 10);
      if (met < 4.5) intensity = 'Low';
    } else if (/\b(fast|hard|heavy|intense|vigorous|incline|uphill|sprint|max)\b/i.test(clause)) {
      met = Math.round((met * 1.18) * 10) / 10;
      if (met >= 7.5) intensity = 'High';
    }

    // 4. Calculate calories burned
    let caloriesBurned = 0;
    if (details.reps && details.reps > 0 && matchedExercise.caloriePerRep && !details.hasExplicitDuration) {
      // Rep-based calculation scaled to user body weight (~70kg baseline)
      const weightFactor = weight / 70;
      caloriesBurned = Math.max(1, Math.round(details.reps * matchedExercise.caloriePerRep * weightFactor));
    } else {
      // Duration-based MET calculation
      caloriesBurned = Math.max(1, Math.round(met * weight * (details.minutes / 60)));
    }

    return {
      description: clause,
      activityName: matchedExercise.label,
      minutes: details.minutes,
      met,
      intensity,
      caloriesBurned,
      distanceKm: details.distanceKm,
      weightKg: details.weightKg,
      reps: details.reps
    };
  });

  const totalMinutes = Math.round(segments.reduce((acc, s) => acc + s.minutes, 0) * 10) / 10;
  const totalCaloriesBurned = segments.reduce((acc, s) => acc + s.caloriesBurned, 0);
  const weightedMet = totalMinutes > 0
    ? Math.round((segments.reduce((acc, s) => acc + s.met * s.minutes, 0) / totalMinutes) * 10) / 10
    : 5.0;

  const overallIntensity: 'Low' | 'Moderate' | 'High' =
    weightedMet >= 7.5 ? 'High' : weightedMet >= 4.5 ? 'Moderate' : 'Low';

  const uniqueNames = Array.from(new Set(segments.map(s => s.activityName)));
  let summaryTitle = 'Workout';
  if (segments.length === 1) {
    const s = segments[0];
    summaryTitle = s.reps
      ? `${s.activityName} (${s.reps} reps)`
      : `${s.activityName} (${totalMinutes} min)`;
  } else if (uniqueNames.length === 2) {
    summaryTitle = `${uniqueNames[0]} & ${uniqueNames[1]}`;
  } else if (uniqueNames.length > 2) {
    summaryTitle = `${uniqueNames[0]} + ${uniqueNames.length - 1} Exercises`;
  } else {
    summaryTitle = `${uniqueNames[0]} (${totalMinutes} min)`;
  }

  const segmentNotes = segments.map(s => s.reps ? `${s.reps} reps of ${s.activityName}` : `${s.activityName} (${s.minutes}m)`).join(', ');

  return {
    summaryTitle,
    totalMinutes,
    averageMet: weightedMet,
    overallIntensity,
    totalCaloriesBurned,
    segments,
    explanation: `Deciphered ${segments.length} activity segment${segments.length > 1 ? 's' : ''} (${segmentNotes} · ${totalCaloriesBurned} kcal burned at ${weightedMet} avg MET for ${weight} kg body weight).`
  };
}

// ============================================================================
// IN-CODE FOOD DECIPHERER & NUTRITIONAL HEALTH ANALYZER
// ============================================================================

interface LocalFoodEntry {
  name: string;
  keywords: string[];
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  sugarPer100g: number;
  sodiumMgPer100g: number;
  defaultGrams: number;
  defaultUnitLabel: string;
  category: DecipheredFoodItem['category'];
}

const LOCAL_FOOD_DB: LocalFoodEntry[] = [
  // Packaged Foods
  {
    name: 'Doritos',
    keywords: ['doritos', 'dorito', 'nacho cheese doritos', 'tortilla chips'],
    caloriesPer100g: 488,
    proteinPer100g: 7.0,
    carbsPer100g: 58.0,
    fatPer100g: 26.0,
    fiberPer100g: 3.5,
    sugarPer100g: 2.3,
    sodiumMgPer100g: 710,
    defaultGrams: 45,
    defaultUnitLabel: '1 pack (45g)',
    category: 'processed'
  },
  {
    name: 'Coke Zero',
    keywords: ['coke zero', 'diet coke', 'coca cola zero', 'coca-cola zero'],
    caloriesPer100g: 0,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 5,
    defaultGrams: 330,
    defaultUnitLabel: '1 can (330ml)',
    category: 'beverage'
  },
  // Fruits
  {
    name: 'Mango',
    keywords: ['mango', 'mangos', 'mangoes', 'fresh mango', 'sliced mango'],
    caloriesPer100g: 60,
    proteinPer100g: 0.8,
    carbsPer100g: 15.0,
    fatPer100g: 0.4,
    fiberPer100g: 1.6,
    sugarPer100g: 13.7,
    sodiumMgPer100g: 1,
    defaultGrams: 150,
    defaultUnitLabel: '1 cup sliced',
    category: 'produce'
  },
  {
    name: 'Banana',
    keywords: ['banana', 'bananas', 'bannana'],
    caloriesPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 22.8,
    fatPer100g: 0.3,
    fiberPer100g: 2.6,
    sugarPer100g: 12.2,
    sodiumMgPer100g: 1,
    defaultGrams: 120,
    defaultUnitLabel: '1 banana (120g)',
    category: 'produce'
  },
  {
    name: 'Apple',
    keywords: ['apple', 'apples', 'green apple', 'red apple'],
    caloriesPer100g: 52,
    proteinPer100g: 0.3,
    carbsPer100g: 13.8,
    fatPer100g: 0.2,
    fiberPer100g: 2.4,
    sugarPer100g: 10.4,
    sodiumMgPer100g: 1,
    defaultGrams: 180,
    defaultUnitLabel: '1 apple (180g)',
    category: 'produce'
  },
  {
    name: 'Raspberries',
    keywords: ['raspberry', 'raspberries', 'rasberry', 'rasberries'],
    caloriesPer100g: 52,
    proteinPer100g: 1.2,
    carbsPer100g: 11.9,
    fatPer100g: 0.7,
    fiberPer100g: 6.5,
    sugarPer100g: 4.4,
    sodiumMgPer100g: 1,
    defaultGrams: 4,
    defaultUnitLabel: '1 raspberry (4g)',
    category: 'produce'
  },
  {
    name: 'Blueberries',
    keywords: ['blueberry', 'blueberries'],
    caloriesPer100g: 57,
    proteinPer100g: 0.7,
    carbsPer100g: 14.5,
    fatPer100g: 0.3,
    fiberPer100g: 2.4,
    sugarPer100g: 10.0,
    sodiumMgPer100g: 1,
    defaultGrams: 2,
    defaultUnitLabel: '1 blueberry (2g)',
    category: 'produce'
  },
  {
    name: 'Strawberries',
    keywords: ['strawberry', 'strawberries'],
    caloriesPer100g: 32,
    proteinPer100g: 0.7,
    carbsPer100g: 7.7,
    fatPer100g: 0.3,
    fiberPer100g: 2.0,
    sugarPer100g: 4.9,
    sodiumMgPer100g: 1,
    defaultGrams: 12,
    defaultUnitLabel: '1 strawberry (12g)',
    category: 'produce'
  },
  {
    name: 'Blackberries',
    keywords: ['blackberry', 'blackberries'],
    caloriesPer100g: 43,
    proteinPer100g: 1.4,
    carbsPer100g: 9.6,
    fatPer100g: 0.5,
    fiberPer100g: 5.3,
    sugarPer100g: 4.9,
    sodiumMgPer100g: 1,
    defaultGrams: 5,
    defaultUnitLabel: '1 blackberry (5g)',
    category: 'produce'
  },
  {
    name: 'Cherries',
    keywords: ['cherry', 'cherries'],
    caloriesPer100g: 63,
    proteinPer100g: 1.1,
    carbsPer100g: 16.0,
    fatPer100g: 0.2,
    fiberPer100g: 2.1,
    sugarPer100g: 12.8,
    sodiumMgPer100g: 0,
    defaultGrams: 8,
    defaultUnitLabel: '1 cherry (8g)',
    category: 'produce'
  },
  {
    name: 'Avocado',
    keywords: ['avocado', 'avocados', 'avacado', 'guacamole'],
    caloriesPer100g: 160,
    proteinPer100g: 2.0,
    carbsPer100g: 8.5,
    fatPer100g: 14.7,
    fiberPer100g: 6.7,
    sugarPer100g: 0.7,
    sodiumMgPer100g: 7,
    defaultGrams: 140,
    defaultUnitLabel: '1 whole',
    category: 'produce'
  },
  {
    name: 'Orange',
    keywords: ['orange', 'oranges', 'mandarin', 'clementine'],
    caloriesPer100g: 47,
    proteinPer100g: 0.9,
    carbsPer100g: 11.8,
    fatPer100g: 0.1,
    fiberPer100g: 2.4,
    sugarPer100g: 9.4,
    sodiumMgPer100g: 0,
    defaultGrams: 150,
    defaultUnitLabel: '1 orange (150g)',
    category: 'produce'
  },
  {
    name: 'Pineapple',
    keywords: ['pineapple', 'pineapples'],
    caloriesPer100g: 50,
    proteinPer100g: 0.5,
    carbsPer100g: 13.1,
    fatPer100g: 0.1,
    fiberPer100g: 1.4,
    sugarPer100g: 9.9,
    sodiumMgPer100g: 1,
    defaultGrams: 140,
    defaultUnitLabel: '1 cup',
    category: 'produce'
  },
  {
    name: 'Grapes',
    keywords: ['grape', 'grapes'],
    caloriesPer100g: 69,
    proteinPer100g: 0.7,
    carbsPer100g: 18.1,
    fatPer100g: 0.2,
    fiberPer100g: 0.9,
    sugarPer100g: 15.5,
    sodiumMgPer100g: 2,
    defaultGrams: 5,
    defaultUnitLabel: '1 grape (5g)',
    category: 'produce'
  },
  {
    name: 'Watermelon',
    keywords: ['watermelon', 'melon'],
    caloriesPer100g: 30,
    proteinPer100g: 0.6,
    carbsPer100g: 7.6,
    fatPer100g: 0.2,
    fiberPer100g: 0.4,
    sugarPer100g: 6.2,
    sodiumMgPer100g: 1,
    defaultGrams: 180,
    defaultUnitLabel: '1 wedge',
    category: 'produce'
  },
  {
    name: 'Dried Prunes',
    keywords: ['dried prunes', 'prunes', 'prune', 'dried plums', 'plum', 'plums'],
    caloriesPer100g: 135,
    proteinPer100g: 2.2,
    carbsPer100g: 31.0,
    fatPer100g: 0.4,
    fiberPer100g: 7.1,
    sugarPer100g: 18.0,
    sodiumMgPer100g: 2,
    defaultGrams: 60,
    defaultUnitLabel: '60g (estimated)',
    category: 'produce'
  },

  // Yogurt & Dairy (including common typos like "yougurt", "yoghurt", "yogart")
  {
    name: 'Greek Yogurt',
    keywords: ['greek yogurt', 'greek yougurt', 'greek yoghurt', '0% yogurt', 'skyr', 'high protein yogurt'],
    caloriesPer100g: 59,
    proteinPer100g: 10.2,
    carbsPer100g: 3.6,
    fatPer100g: 0.4,
    fiberPer100g: 0,
    sugarPer100g: 3.2,
    sodiumMgPer100g: 36,
    defaultGrams: 170,
    defaultUnitLabel: '1 bowl (170g)',
    category: 'dairy'
  },
  {
    name: 'Natural Yogurt',
    keywords: ['yogurt', 'yougurt', 'yoghurt', 'yogart', 'plain yogurt', 'natural yogurt', 'whole milk yogurt'],
    caloriesPer100g: 61,
    proteinPer100g: 3.5,
    carbsPer100g: 4.7,
    fatPer100g: 3.3,
    fiberPer100g: 0,
    sugarPer100g: 4.7,
    sodiumMgPer100g: 46,
    defaultGrams: 150,
    defaultUnitLabel: '150g serving',
    category: 'dairy'
  },
  {
    name: 'Cottage Cheese',
    keywords: ['cottage cheese', 'curd'],
    caloriesPer100g: 98,
    proteinPer100g: 11.1,
    carbsPer100g: 3.4,
    fatPer100g: 4.3,
    fiberPer100g: 0,
    sugarPer100g: 2.7,
    sodiumMgPer100g: 364,
    defaultGrams: 150,
    defaultUnitLabel: '150g',
    category: 'dairy'
  },
  {
    name: 'Cheese',
    keywords: ['cheddar', 'cheese', 'cheddar cheese', 'cheder', 'sliced cheese', 'slice of cheese'],
    caloriesPer100g: 403,
    proteinPer100g: 24.9,
    carbsPer100g: 1.3,
    fatPer100g: 33.1,
    fiberPer100g: 0,
    sugarPer100g: 0.5,
    sodiumMgPer100g: 621,
    defaultGrams: 20,
    defaultUnitLabel: '1 slice (20g)',
    category: 'dairy'
  },
  {
    name: 'Parmesan',
    keywords: ['parmesan', 'parmigiano', 'parmigiano reggiano', 'grated parmesan'],
    caloriesPer100g: 431,
    proteinPer100g: 38.0,
    carbsPer100g: 4.1,
    fatPer100g: 29.0,
    fiberPer100g: 0,
    sugarPer100g: 0.9,
    sodiumMgPer100g: 1529,
    defaultGrams: 25,
    defaultUnitLabel: '25g',
    category: 'dairy'
  },
  {
    name: 'Mozzarella',
    keywords: ['mozzarella', 'burrata'],
    caloriesPer100g: 280,
    proteinPer100g: 28.0,
    carbsPer100g: 3.1,
    fatPer100g: 17.1,
    fiberPer100g: 0,
    sugarPer100g: 1.0,
    sodiumMgPer100g: 480,
    defaultGrams: 60,
    defaultUnitLabel: '60g',
    category: 'dairy'
  },
  {
    name: 'Feta Cheese',
    keywords: ['feta', 'feta cheese', 'halloumi'],
    caloriesPer100g: 264,
    proteinPer100g: 14.2,
    carbsPer100g: 4.1,
    fatPer100g: 21.3,
    fiberPer100g: 0,
    sugarPer100g: 4.1,
    sodiumMgPer100g: 917,
    defaultGrams: 45,
    defaultUnitLabel: '45g',
    category: 'dairy'
  },
  {
    name: 'Milk (3% fat)',
    keywords: ['3% milk', '3% fat milk', 'milk 3%', 'milk, 3%', '3 percent milk', 'milk (3% fat)', 'milk (3%)', 'cow milk 3%'],
    caloriesPer100g: 64,
    proteinPer100g: 3.3,
    carbsPer100g: 4.8,
    fatPer100g: 3.0,
    fiberPer100g: 0,
    sugarPer100g: 4.8,
    sodiumMgPer100g: 44,
    defaultGrams: 220,
    defaultUnitLabel: '1 glass (220ml)',
    category: 'dairy'
  },
  {
    name: 'Milk (2% fat)',
    keywords: ['2% milk', '2% fat milk', 'reduced fat milk', 'milk 2%', '2 percent milk', 'milk (2% fat)', 'milk (2%)'],
    caloriesPer100g: 50,
    proteinPer100g: 3.3,
    carbsPer100g: 4.8,
    fatPer100g: 2.0,
    fiberPer100g: 0,
    sugarPer100g: 4.8,
    sodiumMgPer100g: 44,
    defaultGrams: 220,
    defaultUnitLabel: '1 glass (220ml)',
    category: 'dairy'
  },
  {
    name: 'Milk (1% fat)',
    keywords: ['1% milk', '1% fat milk', 'low fat milk', 'milk 1%', '1 percent milk', 'semi skimmed milk', 'semi-skimmed milk'],
    caloriesPer100g: 42,
    proteinPer100g: 3.4,
    carbsPer100g: 5.0,
    fatPer100g: 1.0,
    fiberPer100g: 0,
    sugarPer100g: 5.0,
    sodiumMgPer100g: 44,
    defaultGrams: 220,
    defaultUnitLabel: '1 glass (220ml)',
    category: 'dairy'
  },
  {
    name: 'Skim Milk',
    keywords: ['skim milk', 'skimmed milk', 'nonfat milk', '0% milk', 'fat free milk'],
    caloriesPer100g: 35,
    proteinPer100g: 3.4,
    carbsPer100g: 5.0,
    fatPer100g: 0.1,
    fiberPer100g: 0,
    sugarPer100g: 5.0,
    sodiumMgPer100g: 44,
    defaultGrams: 220,
    defaultUnitLabel: '1 glass (220ml)',
    category: 'dairy'
  },
  {
    name: 'Whole Milk',
    keywords: ['milk', 'whole milk', 'cow milk', 'regular milk', 'fresh milk', 'full cream milk'],
    caloriesPer100g: 64,
    proteinPer100g: 3.3,
    carbsPer100g: 4.8,
    fatPer100g: 3.3,
    fiberPer100g: 0,
    sugarPer100g: 4.8,
    sodiumMgPer100g: 44,
    defaultGrams: 220,
    defaultUnitLabel: '1 glass (220ml)',
    category: 'dairy'
  },
  {
    name: 'Almond Milk',
    keywords: ['almond milk', 'oat milk', 'soy milk', 'plant milk'],
    caloriesPer100g: 24,
    proteinPer100g: 1.0,
    carbsPer100g: 2.5,
    fatPer100g: 1.2,
    fiberPer100g: 0.4,
    sugarPer100g: 1.0,
    sodiumMgPer100g: 55,
    defaultGrams: 240,
    defaultUnitLabel: '1 cup (240ml)',
    category: 'dairy'
  },

  // Seasonings, Salt, Spices, Condiments
  {
    name: 'Salt',
    keywords: ['salt', 'sea salt', 'pink salt', 'himalayan salt', 'table salt', 'kosher salt'],
    caloriesPer100g: 0,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 38758,
    defaultGrams: 0.5,
    defaultUnitLabel: '1 pinch (0.5g)',
    category: 'seasoning'
  },
  {
    name: 'Black Pepper & Spices',
    keywords: ['pepper', 'black pepper', 'chili flakes', 'cinnamon', 'turmeric', 'cumin', 'paprika', 'oregano', 'basil', 'herbs', 'spices', 'garlic powder', 'ginger'],
    caloriesPer100g: 250,
    proteinPer100g: 10,
    carbsPer100g: 60,
    fatPer100g: 3,
    fiberPer100g: 25,
    sugarPer100g: 1,
    sodiumMgPer100g: 20,
    defaultGrams: 1,
    defaultUnitLabel: '1 pinch (1g)',
    category: 'seasoning'
  },
  {
    name: 'Soy Sauce',
    keywords: ['soy sauce', 'tamari', 'teriyaki sauce'],
    caloriesPer100g: 53,
    proteinPer100g: 8.1,
    carbsPer100g: 4.9,
    fatPer100g: 0.6,
    fiberPer100g: 0.8,
    sugarPer100g: 0.4,
    sodiumMgPer100g: 5493,
    defaultGrams: 15,
    defaultUnitLabel: '1 tbsp (15ml)',
    category: 'seasoning'
  },
  {
    name: 'Honey',
    keywords: ['honey', 'raw honey'],
    caloriesPer100g: 304,
    proteinPer100g: 0.3,
    carbsPer100g: 82.4,
    fatPer100g: 0,
    fiberPer100g: 0.2,
    sugarPer100g: 82.1,
    sodiumMgPer100g: 4,
    defaultGrams: 21,
    defaultUnitLabel: '1 tbsp (21g)',
    category: 'processed'
  },
  {
    name: 'Maple Syrup',
    keywords: ['maple syrup', 'agave', 'syrup'],
    caloriesPer100g: 260,
    proteinPer100g: 0,
    carbsPer100g: 67.0,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 60.5,
    sodiumMgPer100g: 12,
    defaultGrams: 20,
    defaultUnitLabel: '1 tbsp (20g)',
    category: 'processed'
  },
  {
    name: 'Sugar',
    keywords: ['sugar', 'white sugar', 'brown sugar', 'cane sugar'],
    caloriesPer100g: 387,
    proteinPer100g: 0,
    carbsPer100g: 100,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 100,
    sodiumMgPer100g: 1,
    defaultGrams: 5,
    defaultUnitLabel: '1 tsp (5g)',
    category: 'processed'
  },

  // Proteins (Eggs, Poultry, Meat, Fish, Plant)
  {
    name: 'Egg',
    keywords: ['egg', 'eggs', 'egs', 'eg', 'boiled egg', 'scrambled egg', 'scrambled eggs', 'poached egg', 'fried egg', 'omelette', 'omelet'],
    caloriesPer100g: 143,
    proteinPer100g: 12.6,
    carbsPer100g: 0.7,
    fatPer100g: 9.5,
    fiberPer100g: 0,
    sugarPer100g: 0.4,
    sodiumMgPer100g: 142,
    defaultGrams: 60,
    defaultUnitLabel: '1 egg (60g)',
    category: 'protein'
  },
  {
    name: 'Egg Whites',
    keywords: ['egg white', 'egg whites'],
    caloriesPer100g: 52,
    proteinPer100g: 10.9,
    carbsPer100g: 0.7,
    fatPer100g: 0.2,
    fiberPer100g: 0,
    sugarPer100g: 0.7,
    sodiumMgPer100g: 166,
    defaultGrams: 33,
    defaultUnitLabel: '1 egg white',
    category: 'protein'
  },
  {
    name: 'Chicken Breast',
    keywords: ['chicken breast', 'chicken', 'chiken', 'grilled chicken', 'roast chicken', 'chicken fillet'],
    caloriesPer100g: 165,
    proteinPer100g: 31.0,
    carbsPer100g: 0,
    fatPer100g: 3.6,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 74,
    defaultGrams: 150,
    defaultUnitLabel: '1 fillet (150g)',
    category: 'protein'
  },
  {
    name: 'Chicken Thigh',
    keywords: ['chicken thigh', 'chicken thighs', 'chicken drumstick', 'chicken wing'],
    caloriesPer100g: 209,
    proteinPer100g: 26.0,
    carbsPer100g: 0,
    fatPer100g: 10.9,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 84,
    defaultGrams: 130,
    defaultUnitLabel: '130g',
    category: 'protein'
  },
  {
    name: 'Turkey Breast',
    keywords: ['turkey', 'turkey breast', 'ground turkey', 'turkey mince', 'turkey slices'],
    caloriesPer100g: 135,
    proteinPer100g: 30.0,
    carbsPer100g: 0,
    fatPer100g: 1.0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 110,
    defaultGrams: 140,
    defaultUnitLabel: '140g',
    category: 'protein'
  },
  {
    name: 'Lean Beef / Steak',
    keywords: ['beef', 'steak', 'sirloin', 'ground beef', 'beef mince', 'mince', 'roast beef'],
    caloriesPer100g: 186,
    proteinPer100g: 26.0,
    carbsPer100g: 0,
    fatPer100g: 9.0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 68,
    defaultGrams: 160,
    defaultUnitLabel: '160g',
    category: 'protein'
  },
  {
    name: 'Pork Tenderloin / Chop',
    keywords: ['pork', 'pork chop', 'pork tenderloin', 'pork loin', 'ham', 'bacon'],
    caloriesPer100g: 165,
    proteinPer100g: 25.0,
    carbsPer100g: 0.5,
    fatPer100g: 6.8,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 220,
    defaultGrams: 140,
    defaultUnitLabel: '140g',
    category: 'protein'
  },
  {
    name: 'Pancetta',
    keywords: ['pancetta', 'guanciale', 'prosciutto', 'cured pork'],
    caloriesPer100g: 450,
    proteinPer100g: 28.0,
    carbsPer100g: 0.5,
    fatPer100g: 38.0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 1400,
    defaultGrams: 50,
    defaultUnitLabel: '50g',
    category: 'protein'
  },
  {
    name: 'Salmon',
    keywords: ['salmon', 'salmon fillet', 'smoked salmon', 'grilled salmon'],
    caloriesPer100g: 208,
    proteinPer100g: 20.4,
    carbsPer100g: 0,
    fatPer100g: 13.4,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 59,
    defaultGrams: 160,
    defaultUnitLabel: '1 fillet (160g)',
    category: 'protein'
  },
  {
    name: 'Tuna',
    keywords: ['tuna', 'canned tuna', 'tuna steak'],
    caloriesPer100g: 116,
    proteinPer100g: 25.5,
    carbsPer100g: 0,
    fatPer100g: 1.0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 247,
    defaultGrams: 120,
    defaultUnitLabel: '1 can (120g)',
    category: 'protein'
  },
  {
    name: 'White Fish (Cod / Tilapia)',
    keywords: ['cod', 'white fish', 'fish', 'tilapia', 'halibut', 'haddock', 'sea bass'],
    caloriesPer100g: 90,
    proteinPer100g: 19.0,
    carbsPer100g: 0,
    fatPer100g: 1.2,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 65,
    defaultGrams: 160,
    defaultUnitLabel: '1 fillet (160g)',
    category: 'protein'
  },
  {
    name: 'Shrimp / Prawns',
    keywords: ['shrimp', 'prawn', 'prawns'],
    caloriesPer100g: 99,
    proteinPer100g: 24.0,
    carbsPer100g: 0.2,
    fatPer100g: 0.3,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 111,
    defaultGrams: 140,
    defaultUnitLabel: '140g',
    category: 'protein'
  },
  {
    name: 'Tofu / Tempeh',
    keywords: ['tofu', 'firm tofu', 'tempeh', 'edamame'],
    caloriesPer100g: 95,
    proteinPer100g: 10.5,
    carbsPer100g: 2.5,
    fatPer100g: 5.2,
    fiberPer100g: 1.2,
    sugarPer100g: 0.5,
    sodiumMgPer100g: 14,
    defaultGrams: 150,
    defaultUnitLabel: '150g',
    category: 'protein'
  },
  {
    name: 'Whey Protein Powder',
    keywords: ['whey', 'protein powder', 'whey protein', 'protein shake', 'protein scoop'],
    caloriesPer100g: 380,
    proteinPer100g: 78.0,
    carbsPer100g: 6.5,
    fatPer100g: 4.2,
    fiberPer100g: 0.5,
    sugarPer100g: 3.0,
    sodiumMgPer100g: 180,
    defaultGrams: 30,
    defaultUnitLabel: '1 scoop (30g)',
    category: 'protein'
  },

  // Grains, Breads, Legumes
  {
    name: 'Oatmeal',
    keywords: ['oatmeal', 'oatmel', 'cooked oatmeal', 'porridge', 'cooked oats', 'overnight oats'],
    caloriesPer100g: 78,
    proteinPer100g: 2.8,
    carbsPer100g: 13.5,
    fatPer100g: 1.5,
    fiberPer100g: 2.1,
    sugarPer100g: 0.5,
    sodiumMgPer100g: 4,
    defaultGrams: 150,
    defaultUnitLabel: '150g (estimated)',
    category: 'grain'
  },
  {
    name: 'Rolled Oats',
    keywords: ['oats', 'rolled oats', 'dry oats', 'raw oats'],
    caloriesPer100g: 389,
    proteinPer100g: 16.9,
    carbsPer100g: 66.3,
    fatPer100g: 6.9,
    fiberPer100g: 10.6,
    sugarPer100g: 0.9,
    sodiumMgPer100g: 2,
    defaultGrams: 50,
    defaultUnitLabel: '50g (estimated)',
    category: 'grain'
  },
  {
    name: 'Flour',
    keywords: ['flour', 'all purpose flour', 'all-purpose flour', 'white flour', 'wheat flour', 'plain flour', 'baking flour'],
    caloriesPer100g: 364,
    proteinPer100g: 10.3,
    carbsPer100g: 76.3,
    fatPer100g: 1.0,
    fiberPer100g: 2.7,
    sugarPer100g: 0.3,
    sodiumMgPer100g: 2,
    defaultGrams: 120,
    defaultUnitLabel: '1 cup (120g)',
    category: 'grain'
  },
  {
    name: 'Rice (raw)',
    keywords: ['raw rice', 'uncooked rice', 'dry rice'],
    caloriesPer100g: 365,
    proteinPer100g: 7.1,
    carbsPer100g: 80.0,
    fatPer100g: 0.7,
    fiberPer100g: 1.3,
    sugarPer100g: 0.1,
    sodiumMgPer100g: 5,
    defaultGrams: 185,
    defaultUnitLabel: '1 cup (185g)',
    category: 'grain'
  },
  {
    name: 'Water',
    keywords: ['water', 'tap water', 'mineral water', 'spring water'],
    caloriesPer100g: 0,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 5,
    defaultGrams: 240,
    defaultUnitLabel: '1 glass (240ml)',
    category: 'beverage'
  },
  {
    name: 'Cooked Rice',
    keywords: ['rice', 'white rice', 'brown rice', 'jasmine rice', 'basmati rice', 'cooked rice'],
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28.2,
    fatPer100g: 0.3,
    fiberPer100g: 0.8,
    sugarPer100g: 0.1,
    sodiumMgPer100g: 5,
    defaultGrams: 160,
    defaultUnitLabel: '1 cup cooked (160g)',
    category: 'grain'
  },
  {
    name: 'Quinoa',
    keywords: ['quinoa', 'cooked quinoa'],
    caloriesPer100g: 120,
    proteinPer100g: 4.4,
    carbsPer100g: 21.3,
    fatPer100g: 1.9,
    fiberPer100g: 2.8,
    sugarPer100g: 0.9,
    sodiumMgPer100g: 7,
    defaultGrams: 150,
    defaultUnitLabel: '1 cup cooked (150g)',
    category: 'grain'
  },
  {
    name: 'Bread',
    keywords: ['sourdough', 'bread', 'toast', 'tost', 'whole wheat bread', 'slice of bread', 'rye bread', 'bagel', 'wrap', 'tortilla'],
    caloriesPer100g: 250,
    proteinPer100g: 10.0,
    carbsPer100g: 46.0,
    fatPer100g: 2.5,
    fiberPer100g: 4.5,
    sugarPer100g: 3.0,
    sodiumMgPer100g: 450,
    defaultGrams: 30,
    defaultUnitLabel: '1 slice (30g)',
    category: 'grain'
  },
  {
    name: 'Cooked Pasta',
    keywords: ['pasta', 'spaghetti', 'penne', 'noodles', 'macaroni'],
    caloriesPer100g: 158,
    proteinPer100g: 5.8,
    carbsPer100g: 30.9,
    fatPer100g: 0.9,
    fiberPer100g: 1.8,
    sugarPer100g: 0.6,
    sodiumMgPer100g: 6,
    defaultGrams: 180,
    defaultUnitLabel: '1 bowl cooked (180g)',
    category: 'grain'
  },
  {
    name: 'Beans / Lentils / Chickpeas',
    keywords: ['beans', 'black beans', 'kidney beans', 'chickpeas', 'lentils', 'dal', 'hummus'],
    caloriesPer100g: 135,
    proteinPer100g: 8.9,
    carbsPer100g: 23.0,
    fatPer100g: 1.2,
    fiberPer100g: 7.5,
    sugarPer100g: 1.0,
    sodiumMgPer100g: 120,
    defaultGrams: 150,
    defaultUnitLabel: '150g cooked',
    category: 'grain'
  },
  {
    name: 'Potato / Sweet Potato',
    keywords: ['sweet potato', 'potato', 'potatoes', 'baked potato', 'mashed potato', 'roasted potatoes'],
    caloriesPer100g: 90,
    proteinPer100g: 2.0,
    carbsPer100g: 20.5,
    fatPer100g: 0.2,
    fiberPer100g: 2.6,
    sugarPer100g: 3.2,
    sodiumMgPer100g: 25,
    defaultGrams: 170,
    defaultUnitLabel: '1 medium (170g)',
    category: 'produce'
  },

  // Vegetables
  {
    name: 'Broccoli / Green Veg',
    keywords: ['broccoli', 'brocoli', 'asparagus', 'green beans', 'cauliflower', 'brussels sprouts', 'cabbage'],
    caloriesPer100g: 34,
    proteinPer100g: 2.8,
    carbsPer100g: 6.6,
    fatPer100g: 0.4,
    fiberPer100g: 2.6,
    sugarPer100g: 1.7,
    sodiumMgPer100g: 33,
    defaultGrams: 120,
    defaultUnitLabel: '120g',
    category: 'produce'
  },
  {
    name: 'Spinach / Leafy Greens',
    keywords: ['spinach', 'kale', 'lettuce', 'arugula', 'rocket', 'salad', 'mixed greens'],
    caloriesPer100g: 23,
    proteinPer100g: 2.9,
    carbsPer100g: 3.6,
    fatPer100g: 0.4,
    fiberPer100g: 2.2,
    sugarPer100g: 0.4,
    sodiumMgPer100g: 79,
    defaultGrams: 80,
    defaultUnitLabel: '80g',
    category: 'produce'
  },
  {
    name: 'Mixed Vegetables',
    keywords: ['tomato', 'tomatoes', 'cucumber', 'bell pepper', 'peppers', 'carrots', 'carrot', 'zucchini', 'mushrooms', 'onion', 'veggies', 'vegetables'],
    caloriesPer100g: 28,
    proteinPer100g: 1.2,
    carbsPer100g: 5.5,
    fatPer100g: 0.2,
    fiberPer100g: 1.8,
    sugarPer100g: 3.0,
    sodiumMgPer100g: 15,
    defaultGrams: 120,
    defaultUnitLabel: '120g',
    category: 'produce'
  },

  // Fats, Nuts, Seeds, Oils
  {
    name: 'Olive Oil / Cooking Oil',
    keywords: ['olive oil', 'oil', 'coconut oil', 'avocado oil', 'sesame oil'],
    caloriesPer100g: 884,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatPer100g: 100,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 2,
    defaultGrams: 14,
    defaultUnitLabel: '1 tbsp (14g)',
    category: 'fat'
  },
  {
    name: 'Butter',
    keywords: ['butter', 'ghee'],
    caloriesPer100g: 717,
    proteinPer100g: 0.9,
    carbsPer100g: 0.1,
    fatPer100g: 81.1,
    fiberPer100g: 0,
    sugarPer100g: 0.1,
    sodiumMgPer100g: 11,
    defaultGrams: 10,
    defaultUnitLabel: '10g pat',
    category: 'fat'
  },
  {
    name: 'Peanut / Almond Butter',
    keywords: ['peanut butter', 'almond butter', 'nut butter', 'cashew butter'],
    caloriesPer100g: 588,
    proteinPer100g: 25.0,
    carbsPer100g: 20.0,
    fatPer100g: 50.0,
    fiberPer100g: 6.0,
    sugarPer100g: 7.0,
    sodiumMgPer100g: 320,
    defaultGrams: 16,
    defaultUnitLabel: '1 tbsp (16g)',
    category: 'fat'
  },
  {
    name: 'Nuts (Almonds / Walnuts / Cashews)',
    keywords: ['almonds', 'almond', 'walnuts', 'walnut', 'cashews', 'cashew', 'peanuts', 'pistachios', 'pecans', 'mixed nuts', 'nuts'],
    caloriesPer100g: 590,
    proteinPer100g: 20.0,
    carbsPer100g: 20.0,
    fatPer100g: 52.0,
    fiberPer100g: 9.0,
    sugarPer100g: 4.0,
    sodiumMgPer100g: 10,
    defaultGrams: 28,
    defaultUnitLabel: '1 handful (28g)',
    category: 'fat'
  },
  {
    name: 'Seeds (Chia / Flax / Hemp / Pumpkin)',
    keywords: ['chia seeds', 'chia', 'flax seeds', 'flax', 'hemp seeds', 'pumpkin seeds', 'sunflower seeds', 'seeds'],
    caloriesPer100g: 510,
    proteinPer100g: 20.0,
    carbsPer100g: 34.0,
    fatPer100g: 35.0,
    fiberPer100g: 25.0,
    sugarPer100g: 1.0,
    sodiumMgPer100g: 15,
    defaultGrams: 12,
    defaultUnitLabel: '1 tbsp (12g)',
    category: 'fat'
  },

  // Common Processed / Fast Foods / Snacks
  {
    name: 'Dark Chocolate',
    keywords: ['dark chocolate', 'chocolate', 'cocoa'],
    caloriesPer100g: 546,
    proteinPer100g: 6.1,
    carbsPer100g: 52.0,
    fatPer100g: 35.0,
    fiberPer100g: 7.0,
    sugarPer100g: 38.0,
    sodiumMgPer100g: 24,
    defaultGrams: 25,
    defaultUnitLabel: '25g',
    category: 'processed'
  },
  {
    name: 'Chips / Crisps / Fries',
    keywords: ['chips', 'crisps', 'french fries', 'fries', 'nachos'],
    caloriesPer100g: 365,
    proteinPer100g: 4.5,
    carbsPer100g: 48.0,
    fatPer100g: 18.0,
    fiberPer100g: 3.8,
    sugarPer100g: 0.5,
    sodiumMgPer100g: 420,
    defaultGrams: 85,
    defaultUnitLabel: '85g portion',
    category: 'processed'
  },
  {
    name: 'Pizza Slice',
    keywords: ['pizza', 'slice of pizza', 'pepperoni pizza', 'margherita pizza'],
    caloriesPer100g: 266,
    proteinPer100g: 11.4,
    carbsPer100g: 33.3,
    fatPer100g: 9.8,
    fiberPer100g: 2.3,
    sugarPer100g: 3.6,
    sodiumMgPer100g: 598,
    defaultGrams: 125,
    defaultUnitLabel: '1 slice (125g)',
    category: 'processed'
  },
  {
    name: 'Burger',
    keywords: ['burger', 'cheeseburger', 'hamburger'],
    caloriesPer100g: 260,
    proteinPer100g: 15.0,
    carbsPer100g: 24.0,
    fatPer100g: 12.0,
    fiberPer100g: 1.5,
    sugarPer100g: 4.0,
    sodiumMgPer100g: 520,
    defaultGrams: 210,
    defaultUnitLabel: '1 burger (210g)',
    category: 'processed'
  },
  {
    name: 'Cookie / Pastry / Cake',
    keywords: ['cookie', 'cookies', 'biscuit', 'cake', 'muffin', 'croissant', 'donut', 'brownie', 'pastry'],
    caloriesPer100g: 425,
    proteinPer100g: 5.5,
    carbsPer100g: 58.0,
    fatPer100g: 19.5,
    fiberPer100g: 1.8,
    sugarPer100g: 32.0,
    sodiumMgPer100g: 310,
    defaultGrams: 65,
    defaultUnitLabel: '1 piece (65g)',
    category: 'processed'
  },
  {
    name: 'Soda / Sweetened Drink',
    keywords: ['soda', 'cola', 'coke', 'soft drink', 'energy drink', 'sweet tea', 'juice', 'orange juice'],
    caloriesPer100g: 42,
    proteinPer100g: 0,
    carbsPer100g: 10.6,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 10.4,
    sodiumMgPer100g: 8,
    defaultGrams: 330,
    defaultUnitLabel: '1 can (330ml)',
    category: 'beverage'
  },
  {
    name: 'Coffee / Tea',
    keywords: ['coffee', 'regular coffee', 'black coffee', 'brewed coffee', 'drip coffee', 'filter coffee', 'iced coffee', 'cold brew', 'espresso', 'americano', 'tea', 'green tea', 'black tea', 'matcha', 'latte', 'cappuccino', 'flat white'],
    caloriesPer100g: 2,
    proteinPer100g: 0.1,
    carbsPer100g: 0,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 2,
    defaultGrams: 240,
    defaultUnitLabel: '1 cup (240ml)',
    category: 'beverage'
  },
  {
    name: 'Beer',
    keywords: ['beer', 'lager', 'ale', 'ipa', 'stout', 'pilsner', 'draught beer', 'craft beer'],
    caloriesPer100g: 43,
    proteinPer100g: 0.5,
    carbsPer100g: 3.6,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 4,
    defaultGrams: 330,
    defaultUnitLabel: '1 bottle (330ml)',
    category: 'beverage'
  },
  {
    name: 'Wine',
    keywords: ['wine', 'red wine', 'white wine', 'rose wine', 'rosé', 'prosecco', 'champagne', 'sparkling wine', 'pinot noir', 'cabernet', 'chardonnay', 'sauvignon blanc', 'merlot'],
    caloriesPer100g: 83,
    proteinPer100g: 0.1,
    carbsPer100g: 2.6,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 0.6,
    sodiumMgPer100g: 5,
    defaultGrams: 150,
    defaultUnitLabel: '1 glass (150ml)',
    category: 'beverage'
  },
  {
    name: 'Spirits / Liquor',
    keywords: ['whiskey', 'whisky', 'bourbon', 'scotch', 'vodka', 'gin', 'rum', 'tequila', 'brandy', 'cognac', 'liquor', 'spirits'],
    caloriesPer100g: 231,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 0,
    sodiumMgPer100g: 1,
    defaultGrams: 45,
    defaultUnitLabel: '1 shot (45ml)',
    category: 'beverage'
  },
  {
    name: 'Cider / Cocktail',
    keywords: ['cider', 'hard cider', 'cocktail', 'margarita', 'mojito', 'martini', 'spritz', 'aperol spritz', 'hard seltzer'],
    caloriesPer100g: 58,
    proteinPer100g: 0,
    carbsPer100g: 5.0,
    fatPer100g: 0,
    fiberPer100g: 0,
    sugarPer100g: 4.2,
    sodiumMgPer100g: 6,
    defaultGrams: 250,
    defaultUnitLabel: '1 glass (250ml)',
    category: 'beverage'
  }
];

function estimateBeverageCaffeineAndAlcohol(
  rawText: string,
  foodPhrase: string,
  grams: number,
  explicitAbvPercent?: number
): {
  caffeineMg: number;
  caffeineMgPer100g: number;
  standardDrinks: number;
  abvPercent?: number;
  overrideCaloriesPer100g?: number;
  overrideCarbsPer100g?: number;
  overrideProteinPer100g?: number;
} {
  const combined = `${rawText} ${foodPhrase}`.toLowerCase();
  const isDecaf = /\b(decaf|decaffeinated|caffeine[-\s]?free|herbal|chamomile|peppermint|rooibos)\b/i.test(combined);

  let caffeineMgPer100g = 0;
  if (!isDecaf) {
    if (/\b(espresso|ristretto)\b/i.test(combined)) {
      caffeineMgPer100g = 210; // ~63mg per 30ml shot
    } else if (/\b(cold brew)\b/i.test(combined)) {
      caffeineMgPer100g = 52; // ~125mg per 240ml cup
    } else if (/\b(instant coffee)\b/i.test(combined)) {
      caffeineMgPer100g = 26; // ~62mg per 240ml cup
    } else if (/\b(latte|cappuccino|flat white|macchiato|mocha)\b/i.test(combined)) {
      caffeineMgPer100g = 31.25; // ~75mg per 240ml cup
    } else if (/\b(coffee|americano|drip|brewed|iced coffee)\b/i.test(combined)) {
      caffeineMgPer100g = 39.58; // ~95mg per 240ml cup
    } else if (/\b(matcha)\b/i.test(combined)) {
      caffeineMgPer100g = 29.17; // ~70mg per 240ml cup
    } else if (/\b(black tea|english breakfast|earl grey|chai|sweet tea|iced tea)\b/i.test(combined)) {
      caffeineMgPer100g = 19.58; // ~47mg per 240ml cup
    } else if (/\b(green tea|oolong|white tea|tea)\b/i.test(combined)) {
      caffeineMgPer100g = 11.67; // ~28mg per 240ml cup
    } else if (/\b(pre[-\s]?workout)\b/i.test(combined)) {
      caffeineMgPer100g = 75;
    } else if (/\b(energy drink|red bull|monster|celsius)\b/i.test(combined)) {
      caffeineMgPer100g = 32; // ~80mg per 250ml can
    } else if (/\b(cola|coke|pepsi|diet coke|dr pepper|mountain dew)\b/i.test(combined)) {
      caffeineMgPer100g = 10; // ~33mg per 330ml can
    } else if (/\b(dark chocolate)\b/i.test(combined)) {
      caffeineMgPer100g = 80;
    } else if (/\b(chocolate|cocoa)\b/i.test(combined)) {
      caffeineMgPer100g = 20;
    }
  } else if (/\b(coffee|espresso|latte|cappuccino|americano)\b/i.test(combined)) {
    caffeineMgPer100g = 1.0; // trace caffeine in decaf (~2-3mg per cup)
  }

  const isDairyOrMilk = /\b(milk|dairy|yogurt|cream|cheese|butter)\b/i.test(combined);
  const isAlcoholKeyword = !isDairyOrMilk && /\b(beer|lager|ale|ipa|stout|pilsner|wine|red wine|white wine|rosé|rose wine|prosecco|champagne|sparkling wine|pinot|cabernet|chardonnay|sauvignon|merlot|whiskey|whisky|bourbon|scotch|vodka|gin|rum|tequila|brandy|cognac|liquor|spirits|cider|hard cider|hard seltzer|cocktail|margarita|mojito|martini|spritz|aperol)\b/i.test(
    combined
  );
  const isNonAlcoholic = isDairyOrMilk || /\b(non[-\s]?alcoholic|alcohol[-\s]?free|0\.0%|zero alcohol|ginger beer|root beer|apple cider vinegar)\b/i.test(
    combined
  );

  let abvPercent: number | undefined = isDairyOrMilk ? undefined : explicitAbvPercent;
  if (abvPercent === undefined && isAlcoholKeyword && !isNonAlcoholic) {
    if (/\b(whiskey|whisky|bourbon|scotch|vodka|gin|rum|tequila|brandy|cognac|liquor|spirits)\b/i.test(combined)) {
      abvPercent = 40;
    } else if (/\b(wine|red wine|white wine|rosé|rose wine|prosecco|champagne|sparkling wine|pinot|cabernet|chardonnay|sauvignon|merlot)\b/i.test(combined)) {
      abvPercent = 12.5;
    } else if (/\b(cocktail|margarita|mojito|martini|spritz|aperol)\b/i.test(combined)) {
      abvPercent = 11;
    } else if (/\b(beer|lager|ale|ipa|stout|pilsner|cider|hard cider|hard seltzer)\b/i.test(combined)) {
      abvPercent = 5.0;
    }
  }

  const caffeineMg = Math.round((grams / 100) * caffeineMgPer100g);

  if (abvPercent !== undefined && abvPercent > 0 && !isNonAlcoholic) {
    // 1 ml ethanol = 0.789g; 1 standard drink = 14g pure ethanol; 1g ethanol = 7 kcal
    const pureEthanolGramsPer100ml = abvPercent * 0.789;
    const alcoholKcalPer100ml = pureEthanolGramsPer100ml * 7;
    let nonAlcoholCarbsPer100ml = 0;
    let nonAlcoholProteinPer100ml = 0;

    if (/\b(beer|lager|ale|ipa|stout|pilsner)\b/i.test(combined)) {
      nonAlcoholCarbsPer100ml = 3.6;
      nonAlcoholProteinPer100ml = 0.5;
    } else if (/\b(wine|red wine|white wine|rosé|rose wine|prosecco|champagne|sparkling wine|pinot|cabernet|chardonnay|sauvignon|merlot)\b/i.test(combined)) {
      nonAlcoholCarbsPer100ml = 2.6;
      nonAlcoholProteinPer100ml = 0.1;
    } else if (/\b(cider|hard cider|cocktail|margarita|mojito|spritz|aperol)\b/i.test(combined)) {
      nonAlcoholCarbsPer100ml = 5.0;
    }

    const totalKcalPer100ml = Math.round(
      alcoholKcalPer100ml + nonAlcoholCarbsPer100ml * 4 + nonAlcoholProteinPer100ml * 4
    );
    const totalPureAlcoholGrams = (grams / 100) * pureEthanolGramsPer100ml;
    const standardDrinks = Math.round((totalPureAlcoholGrams / 14) * 10) / 10;

    return {
      caffeineMg,
      caffeineMgPer100g,
      standardDrinks,
      abvPercent,
      overrideCaloriesPer100g: totalKcalPer100ml,
      overrideCarbsPer100g: nonAlcoholCarbsPer100ml,
      overrideProteinPer100g: nonAlcoholProteinPer100ml
    };
  }

  return {
    caffeineMg,
    caffeineMgPer100g,
    standardDrinks: 0
  };
}

// Known per-item weights (in grams) for count-based inputs without explicit weight
const KNOWN_ITEM_WEIGHTS_GRAMS: Array<{ pattern: RegExp; grams: number; unitLabel: string }> = [
  { pattern: /\b(raspberry|raspberries|rasberry|rasberries)\b/i, grams: 4, unitLabel: 'raspberry' },
  { pattern: /\b(blueberry|blueberries)\b/i, grams: 2, unitLabel: 'blueberry' },
  { pattern: /\b(strawberry|strawberries)\b/i, grams: 12, unitLabel: 'strawberry' },
  { pattern: /\b(blackberry|blackberries)\b/i, grams: 5, unitLabel: 'blackberry' },
  { pattern: /\b(grape|grapes)\b/i, grams: 5, unitLabel: 'grape' },
  { pattern: /\b(cherry|cherries)\b/i, grams: 8, unitLabel: 'cherry' },
  { pattern: /\b(egg|eggs|egs|eg)\b/i, grams: 60, unitLabel: 'egg' },
  { pattern: /\b(banana|bananas|bannana)\b/i, grams: 120, unitLabel: 'banana' },
  { pattern: /\b(apple|apples)\b/i, grams: 180, unitLabel: 'apple' },
  { pattern: /\b(orange|oranges|mandarin|clementine)\b/i, grams: 150, unitLabel: 'orange' },
  { pattern: /\b(potato|potatoes|sweet potato|sweet potatoes)\b/i, grams: 170, unitLabel: 'potato' },
  { pattern: /\b(slice of bread|slices of bread|bread|toast|tost|sourdough|whole wheat bread|rye bread)\b/i, grams: 35, unitLabel: 'slice of bread' },
  { pattern: /\b(slice of cheese|slices of cheese|cheese slice|cheddar|cheese|cheder)\b/i, grams: 20, unitLabel: 'slice of cheese' },
  { pattern: /\b(tofu|tempeh)\b/i, grams: 100, unitLabel: '100g' }
];

const COMMON_TYPOS: Record<string, string> = {
  egs: 'eggs',
  eg: 'egg',
  tost: 'toast',
  yougurt: 'yogurt',
  yoghurt: 'yogurt',
  yogart: 'yogurt',
  chiken: 'chicken',
  chikn: 'chicken',
  avocadoo: 'avocado',
  avocdo: 'avocado',
  bannana: 'banana',
  bananna: 'banana',
  aple: 'apple',
  potatos: 'potatoes',
  tomatos: 'tomatoes',
  chesse: 'cheese',
  chese: 'cheese',
  cheder: 'cheddar',
  spagetti: 'spaghetti',
  spageti: 'spaghetti',
  peper: 'pepper',
  milke: 'milk'
};

export function normalizeFoodTypos(text: string): string {
  let normalized = text;
  for (const [typo, replacement] of Object.entries(COMMON_TYPOS)) {
    const reg = new RegExp(`\\b${typo}\\b`, 'gi');
    normalized = normalized.replace(reg, replacement);
  }
  return normalized;
}

function getKnownPerItemWeight(foodPhrase: string, unit: string): number | null {
  const combined = `${unit} ${foodPhrase}`.trim();
  if (unit === 'slice' || unit === 'slices') {
    if (/\b(cheese|cheddar|mozzarella|swiss|gouda|provolone)\b/i.test(foodPhrase)) {
      return 20;
    }
    if (/\b(bread|toast|sourdough|rye|wheat|loaf)\b/i.test(foodPhrase)) {
      return 30;
    }
  }
  for (const item of KNOWN_ITEM_WEIGHTS_GRAMS) {
    if (item.pattern.test(combined) || item.pattern.test(foodPhrase)) {
      return item.grams;
    }
  }
  return null;
}

function formatTypedFoodName(foodPhrase: string): string {
  const cleaned = foodPhrase
    .replace(/\b(of|some|a|an|the)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return 'Food Item';
  return cleaned
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function findBestFoodMatch(foodPhrase: string): LocalFoodEntry | null {
  const cleaned = foodPhrase
    .toLowerCase()
    .replace(/\b(of|with|fresh|raw|organic|cooked|chopped|diced|sliced|some|a|an|the)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return null;

  // 1. Exact keyword match
  for (const entry of LOCAL_FOOD_DB) {
    if (entry.keywords.some(kw => kw === cleaned)) {
      return entry;
    }
  }

  // 2. Whole-word match inside phrase (longest keyword first so "greek yogurt" beats "yogurt")
  let bestEntry: LocalFoodEntry | null = null;
  let longestKwLen = 0;
  for (const entry of LOCAL_FOOD_DB) {
    for (const kw of entry.keywords) {
      const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Use boundary assertion that works with '%' characters
      const wordRegex = new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, 'i');
      if (wordRegex.test(cleaned) && kw.length > longestKwLen) {
        bestEntry = entry;
        longestKwLen = kw.length;
      }
    }
  }
  if (bestEntry) return bestEntry;

  return null;
}

export function getCupWeightGrams(foodPhrase: string): number {
  const lower = foodPhrase.toLowerCase();
  if (/\b(?:flour|all[- ]?purpose flour|wheat flour|plain flour|baking flour|cake flour)\b/i.test(lower)) return 120;
  if (/\b(?:sugar|white sugar|brown sugar|cane sugar|powdered sugar|granulated sugar)\b/i.test(lower)) return 200;
  if (/\b(?:milk|water|buttermilk|cream|broth|stock)\b/i.test(lower)) return 240;
  if (/\b(?:rice|uncooked rice|raw rice|basmati|jasmine)\b/i.test(lower)) return 185;
  if (/\b(?:oats|rolled oats|quick oats|oatmeal|raw oats|dry oats)\b/i.test(lower)) return 90;
  if (/\b(?:butter|margarine|ghee)\b/i.test(lower)) return 227;
  if (/\b(?:oil|olive oil|vegetable oil|canola oil|coconut oil|sunflower oil)\b/i.test(lower)) return 218;
  if (/\b(?:honey|maple syrup|syrup|molasses)\b/i.test(lower)) return 340;
  return 240;
}

function parseFoodSegment(segmentRaw: string): DecipheredFoodItem | null {
  const raw = segmentRaw.trim();
  if (!raw) return null;

  // Never treat pure barcode tokens like "upc", "upc 123456", "barcode" as food
  if (/^(?:upc|ean|barcode)(?:\s*[:#]?\s*\d+)?$/i.test(raw)) {
    return null;
  }

  const lower = raw.toLowerCase();

  // Extract explicit ABV percentage ONLY if followed by abv, alc, alcohol, by volume OR on known alcohol drink
  // NEVER treat fat percentages (e.g. 3% milk, 2% milk, 10% fat) as alcohol ABV!
  const isAlcoholPhrase = /\b(beer|lager|ale|ipa|stout|pilsner|wine|whiskey|whisky|bourbon|scotch|vodka|gin|rum|tequila|brandy|cognac|liquor|spirits|cider|hard cider|cocktail|margarita|mojito|martini|spritz|aperol)\b/i.test(raw);
  const isDairyOrFatPhrase = /\b(milk|dairy|yogurt|cheese|cream|butter|fat|mf|milkfat|beef|pork|meat)\b/i.test(raw);

  const abvMatch = !isDairyOrFatPhrase
    ? (raw.match(/\b(\d+(?:[.,]\d+)?)\s*%\s*(?:abv|alc(?:ohol)?(?:\s*by\s*vol(?:ume)?)?)\b/i) ||
       (isAlcoholPhrase ? raw.match(/\b(\d+(?:[.,]\d+)?)\s*%/i) : null))
    : null;

  const explicitAbvPercent = abvMatch
    ? parseFloat(abvMatch[1].replace(',', '.'))
    : undefined;
  const rawWithoutAbv = abvMatch
    ? raw.replace(abvMatch[0], ' ').replace(/\s+/g, ' ').trim()
    : raw;

  // Check colloquial small measures first: "a pinch of", "2 pinches of", "a dash of", "a sprinkle of"
  const pinchMatch = lower.match(/^(?:(\d+|a|an|one|two|three)\s+)?(pinch|pinches|dash|dashes|sprinkle|touch)\s+(?:of\s+)?(.+)$/i);
  if (pinchMatch) {
    const countWord = (pinchMatch[1] || '1').toLowerCase();
    const mult = WORD_NUMBERS[countWord] || parseFloat(countWord) || 1;
    const itemName = pinchMatch[3].trim();
    const matched = findBestFoodMatch(itemName);
    const displayName = formatTypedFoodName(itemName);
    const grams = Math.round(mult * 0.4 * 10) / 10; // 1 pinch ≈ 0.4g
    const factor = grams / 100;

    if (matched) {
      return {
        rawText: raw,
        name: displayName,
        grams,
        needsWeightConfirmation: false,
        servingLabel: `${mult > 1 ? mult + ' pinches' : '1 pinch'} (${grams}g)`,
        calories: Math.round(matched.caloriesPer100g * factor),
        protein: Math.round(matched.proteinPer100g * factor * 10) / 10,
        carbs: Math.round(matched.carbsPer100g * factor * 10) / 10,
        fat: Math.round(matched.fatPer100g * factor * 10) / 10,
        fiber: Math.round(matched.fiberPer100g * factor * 10) / 10,
        sugar: Math.round(matched.sugarPer100g * factor * 10) / 10,
        sodiumMg: Math.round(matched.sodiumMgPer100g * factor),
        caffeineMg: 0,
        standardDrinks: 0,
        caloriesPer100g: matched.caloriesPer100g,
        proteinPer100g: matched.proteinPer100g,
        carbsPer100g: matched.carbsPer100g,
        fatPer100g: matched.fatPer100g,
        fiberPer100g: matched.fiberPer100g,
        sugarPer100g: matched.sugarPer100g,
        sodiumMgPer100g: matched.sodiumMgPer100g,
        category: matched.category
      };
    }

    const sodiumPer100g = /salt/i.test(itemName) ? 38758 : 1250;
    return {
      rawText: raw,
      name: displayName,
      grams,
      needsWeightConfirmation: false,
      servingLabel: `1 pinch (${grams}g)`,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodiumMg: /salt/i.test(itemName) ? 155 : 5,
      caffeineMg: 0,
      standardDrinks: 0,
      caloriesPer100g: 0,
      proteinPer100g: 0,
      carbsPer100g: 0,
      fatPer100g: 0,
      fiberPer100g: 0,
      sugarPer100g: 0,
      sodiumMgPer100g: sodiumPer100g,
      category: 'seasoning'
    };
  }

  let amount = 1;
  let unit = '';
  let foodPhrase = rawWithoutAbv;
  let hasUserExplicitWeight = false;

  const parseQtyToken = (rawQty: string): number => {
    let q = (rawQty || '1').toLowerCase().trim();
    if (q === '½' || q === 'half') return 0.5;
    if (q === '¼' || q === 'quarter') return 0.25;
    if (q === '¾') return 0.75;
    if (q === '⅓') return 1 / 3;
    if (q === '⅔') return 2 / 3;
    if (q.includes('½')) q = q.replace('½', '.5');
    if (q.includes('¼')) q = q.replace('¼', '.25');
    if (q.includes('¾')) q = q.replace('¾', '.75');
    if (q.includes('⅓')) q = q.replace('⅓', '.333');
    if (q.includes('⅔')) q = q.replace('⅔', '.667');
    if (q.includes('/')) {
      const [n, d] = q.split('/');
      return parseFloat(n) / (parseFloat(d) || 1);
    }
    return WORD_NUMBERS[q] ?? (parseFloat(q.replace(',', '.')) || 1);
  };

  // Special case: vessel + food + explicit volume, e.g. "1 glass of beer 150ml", "2 cans of beer 330ml"
  const vesselPlusVolumeMatch = rawWithoutAbv.match(
    /^(?:(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:[.,/]\d+)?)\s+)?(glass|glasses|cup|cups|mug|mugs|can|cans|bottle|bottles|pint|pints|shot|shots)\s+(?:of\s+)?(.+?)[,\s\-–(]+(\d+(?:[.,]\d+)?)\s*(ml|milliliters?|l|liters?|oz|ounces?|lbs?|pounds?|g|grams?)\)?$/i
  );

  // 1. Check quantity + unit at START: e.g. "60g dried prunes", "200ml milk", "2 slices bread", "2 cups flour", "1 glass of wine"
  const leadingUnitMatch = !vesselPlusVolumeMatch
    ? rawWithoutAbv.match(
        /^(?:(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|half|quarter|\d+(?:[.,/]\d+)?)\s*)?(g|grams?|kg|kilograms?|ml|milliliters?|l|liters?|oz|ounces?|lbs?|pounds?|cups?|mug|mugs|glass|glasses|pint|pints|shot|shots|can|cans|bottle|bottles|tbsp|tablespoons?|tsp|teaspoons?|slices?)\b\s*(?:of\s+)?(.+)$/i
      )
    : null;

  // 2. Check quantity + unit at END or in parens: e.g. "oatmeal 150g", "milk 200g", "milk (200ml)", "oatmeal - 150g"
  const trailingUnitMatch = !vesselPlusVolumeMatch && !leadingUnitMatch
    ? rawWithoutAbv.match(
        /^(.+?)[,\s\-–(]+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|half|quarter|\d+(?:[.,/]\d+)?)\s*(g|grams?|kg|kilograms?|ml|milliliters?|l|liters?|oz|ounces?|lbs?|pounds?|cups?|mug|mugs|glass|glasses|pint|pints|shot|shots|can|cans|bottle|bottles|tbsp|tablespoons?|tsp|teaspoons?|slices?)\)?$/i
      )
    : null;

  // 3. Check quantity + unit in MIDDLE: e.g. "oatmeal 150g cooked"
  const middleUnitMatch = !vesselPlusVolumeMatch && !leadingUnitMatch && !trailingUnitMatch
    ? rawWithoutAbv.match(
        /^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(g|grams?|kg|kilograms?|ml|milliliters?|l|liters?|oz|ounces?|lbs?|pounds?|cups?|tbsp|tablespoons?|tsp|teaspoons?)\b\s+(.+)$/i
      )
    : null;

  if (vesselPlusVolumeMatch) {
    const vesselCount = parseQtyToken(vesselPlusVolumeMatch[1] || '1');
    const perVesselAmount = parseFloat(vesselPlusVolumeMatch[4].replace(',', '.')) || 0;
    amount = vesselCount * perVesselAmount;
    unit = vesselPlusVolumeMatch[5].toLowerCase();
    foodPhrase = vesselPlusVolumeMatch[3].trim();
    hasUserExplicitWeight = true;
  } else if (leadingUnitMatch && leadingUnitMatch[3]) {
    amount = parseQtyToken(leadingUnitMatch[1] || '1');
    unit = leadingUnitMatch[2].toLowerCase();
    foodPhrase = leadingUnitMatch[3].trim();
    hasUserExplicitWeight = true;
  } else if (trailingUnitMatch && trailingUnitMatch[1]) {
    foodPhrase = trailingUnitMatch[1].trim();
    amount = parseQtyToken(trailingUnitMatch[2] || '1');
    unit = trailingUnitMatch[3].toLowerCase();
    hasUserExplicitWeight = true;
  } else if (middleUnitMatch && middleUnitMatch[1]) {
    foodPhrase = `${middleUnitMatch[1]} ${middleUnitMatch[4]}`.trim();
    amount = parseQtyToken(middleUnitMatch[2] || '1');
    unit = middleUnitMatch[3].toLowerCase();
    hasUserExplicitWeight = true;
  } else {
    // Check leading or trailing bare number without unit, e.g. "3 raspberries", "2 eggs", "eggs 2"
    const leadingCountMatch = rawWithoutAbv.match(
      /^(a|an|one|two|three|four|five|six|seven|eight|nine|ten|twelve|fifteen|twenty|thirty|forty|fifty|half|quarter|\d+(?:[.,/]\d+)?)\s+(?:of\s+|an?\s+)?(.+)$/i
    );
    const trailingCountMatch = !leadingCountMatch
      ? rawWithoutAbv.match(/^(.+?)\s*[x×\-]?\s*(\d+(?:[.,]\d+)?)$/i)
      : null;

    if (leadingCountMatch) {
      amount = parseQtyToken(leadingCountMatch[1]);
      unit = 'piece';
      foodPhrase = leadingCountMatch[2].trim();
    } else if (trailingCountMatch) {
      foodPhrase = trailingCountMatch[1].trim();
      amount = parseQtyToken(trailingCountMatch[2]);
      unit = 'piece';
    } else {
      amount = 1;
      unit = 'piece';
      foodPhrase = rawWithoutAbv;
    }
  }

  const matched = findBestFoodMatch(foodPhrase);
  const baseDisplayName = formatTypedFoodName(foodPhrase);
  let displayName =
    explicitAbvPercent !== undefined
      ? `${baseDisplayName} (${explicitAbvPercent}% ABV)`
      : (matched && (/\b(milk|dairy|fat)\b/i.test(matched.name) || matched.name.includes('%'))
          ? matched.name
          : baseDisplayName);

  // If user typed 3% milk, ensure label is "Milk (3% fat)" not ABV
  if (/\b3\s*%\s*milk\b/i.test(raw) || /\bmilk\s*3\s*%/i.test(raw) || /\bmilk\s*,\s*3\s*%/i.test(raw) || /\b3\s*%\s*fat\b/i.test(raw)) {
    displayName = 'Milk (3% fat)';
  } else if (/\b2\s*%\s*milk\b/i.test(raw) || /\bmilk\s*2\s*%/i.test(raw) || /\bmilk\s*,\s*2\s*%/i.test(raw) || /\b2\s*%\s*fat\b/i.test(raw)) {
    displayName = 'Milk (2% fat)';
  } else if (/\b1\s*%\s*milk\b/i.test(raw) || /\bmilk\s*1\s*%/i.test(raw) || /\bmilk\s*,\s*1\s*%/i.test(raw) || /\b1\s*%\s*fat\b/i.test(raw)) {
    displayName = 'Milk (1% fat)';
  } else if (/\b(?:whole\s*milk|full\s*cream\s*milk)\b/i.test(raw)) {
    displayName = 'Whole Milk';
  }

  // Never return an item called "Upc" or "Barcode"
  if (/^(?:upc|barcode)\b/i.test(displayName.trim())) {
    return null;
  }

  const isLiquidOrBeverage =
    matched?.category === 'beverage' ||
    /\b(coffee|espresso|americano|latte|cappuccino|flat white|tea|matcha|milk|water|juice|soda|cola|coke|energy drink|beer|lager|ale|ipa|stout|wine|whiskey|whisky|vodka|gin|rum|tequila|cider|cocktail)\b/i.test(
      foodPhrase
    );

  let grams = 0;
  let isEstimatedWeight = false;
  let needsWeightConfirmation = false;
  let servingLabel = '';
  let notes: string | undefined;

  if (unit === 'g' || unit === 'gram' || unit === 'grams') {
    grams = amount;
    servingLabel = `${grams}g`;
  } else if (unit === 'kg' || unit === 'kilogram' || unit === 'kilograms') {
    grams = amount * 1000;
    servingLabel = `${amount}kg (${grams}g)`;
  } else if (unit === 'ml' || unit === 'milliliter' || unit === 'milliliters') {
    grams = amount;
    servingLabel = `${amount}ml`;
  } else if (unit === 'l' || unit === 'liter' || unit === 'liters') {
    grams = amount * 1000;
    servingLabel = `${amount}L (${grams}ml)`;
  } else if (unit === 'lb' || unit === 'lbs' || unit === 'pound' || unit === 'pounds') {
    grams = Math.round(amount * 453.6 * 10) / 10;
    servingLabel = `${amount} lb${amount !== 1 ? 's' : ''} (${grams}g)`;
  } else if (unit === 'oz' || unit === 'ounce' || unit === 'ounces') {
    grams = Math.round(amount * (isLiquidOrBeverage ? 29.57 : 28.35) * 10) / 10;
    servingLabel = `${amount} oz (${grams}${isLiquidOrBeverage ? 'ml' : 'g'})`;
  } else if (unit === 'cup' || unit === 'cups' || unit === 'mug' || unit === 'mugs') {
    const perCupGrams = getCupWeightGrams(foodPhrase);
    grams = Math.round(amount * perCupGrams * 10) / 10;
    servingLabel = `${amount} ${unit.replace(/s$/, '')}${amount !== 1 ? 's' : ''} (${grams}g)`;
  } else if (unit === 'glass' || unit === 'glasses') {
    const isWine = /\b(wine|prosecco|champagne|pinot|cabernet|chardonnay|sauvignon|merlot|rosé|rose)\b/i.test(foodPhrase);
    const perGlassMl = isWine ? 150 : 250;
    grams = Math.round(amount * perGlassMl);
    servingLabel = `${amount} glass${amount !== 1 ? 'es' : ''} (${grams}ml)`;
  } else if (unit === 'pint' || unit === 'pints') {
    grams = Math.round(amount * 473);
    servingLabel = `${amount} pint${amount !== 1 ? 's' : ''} (${grams}ml)`;
  } else if (unit === 'shot' || unit === 'shots') {
    const isEspresso = /\b(espresso|ristretto|coffee)\b/i.test(foodPhrase);
    const perShotMl = isEspresso ? 30 : 45;
    grams = Math.round(amount * perShotMl);
    servingLabel = `${amount} shot${amount !== 1 ? 's' : ''} (${grams}ml)`;
  } else if (unit === 'can' || unit === 'cans' || unit === 'bottle' || unit === 'bottles') {
    const perVesselMl = matched?.defaultGrams && matched.defaultGrams >= 100 ? matched.defaultGrams : 330;
    grams = Math.round(amount * perVesselMl);
    servingLabel = `${amount} ${unit.replace(/s$/, '')}${amount !== 1 ? 's' : ''} (${grams}ml)`;
  } else if (unit === 'tbsp' || unit === 'tablespoon' || unit === 'tablespoons') {
    grams = Math.round(amount * 15 * 10) / 10;
    servingLabel = `${amount} tbsp (${grams}g)`;
  } else if (unit === 'tsp' || unit === 'teaspoon' || unit === 'teaspoons') {
    grams = Math.round(amount * 5 * 10) / 10;
    servingLabel = `${amount} tsp (${grams}g)`;
  } else {
    // Count or bare item: check the known per-item weight table OR real-food database defaultGrams
    const knownPieceGrams = getKnownPerItemWeight(foodPhrase, unit);
    if (knownPieceGrams !== null) {
      grams = Math.round(amount * knownPieceGrams * 10) / 10;
      isEstimatedWeight = !hasUserExplicitWeight;
      servingLabel = isEstimatedWeight
        ? `${grams}g (estimated)`
        : `${amount} slice${amount > 1 ? 's' : ''} (${grams}g)`;
    } else if (matched && matched.defaultGrams > 0) {
      grams = Math.round(amount * matched.defaultGrams * 10) / 10;
      isEstimatedWeight = true;
      needsWeightConfirmation = false;
      servingLabel = `${grams}${isLiquidOrBeverage ? 'ml' : 'g'} (estimated)`;
    } else {
      // Only show confirm weight when the user gave NO weight AND the AI could not estimate one
      grams = 0;
      isEstimatedWeight = false;
      needsWeightConfirmation = true;
      servingLabel = 'How much?';
      notes = `Could not estimate weight for "${displayName}" automatically — please enter weight in grams.`;
    }
  }

  const roundedGrams = Math.round(grams * 10) / 10;
  const isOver5kg = roundedGrams > 5000;
  const kgAmount = isOver5kg ? Math.round((roundedGrams / 1000) * 100) / 100 : undefined;
  const suggestedGrams = isOver5kg ? kgAmount : undefined;
  const over5kgWarning = isOver5kg
    ? `${kgAmount}kg of ${displayName.toLowerCase()} seems very high. Did you mean ${suggestedGrams}g?`
    : undefined;
  const factor = grams / 100;

  const bevEstimate = estimateBeverageCaffeineAndAlcohol(
    raw,
    foodPhrase,
    roundedGrams,
    explicitAbvPercent
  );

  if (matched) {
    const calPer100g = bevEstimate.overrideCaloriesPer100g ?? matched.caloriesPer100g;
    const carbsPer100g = bevEstimate.overrideCarbsPer100g ?? matched.carbsPer100g;
    const protPer100g = bevEstimate.overrideProteinPer100g ?? matched.proteinPer100g;

    return {
      rawText: raw,
      name: displayName,
      grams: roundedGrams,
      isEstimatedWeight,
      needsWeightConfirmation,
      notes,
      isOver5kg,
      kgAmount,
      suggestedGrams,
      over5kgWarning,
      servingLabel,
      calories: Math.round(calPer100g * factor),
      protein: Math.round(protPer100g * factor * 10) / 10,
      carbs: Math.round(carbsPer100g * factor * 10) / 10,
      fat: Math.round(matched.fatPer100g * factor * 10) / 10,
      fiber: Math.round(matched.fiberPer100g * factor * 10) / 10,
      sugar: Math.round(matched.sugarPer100g * factor * 10) / 10,
      sodiumMg: Math.round(matched.sodiumMgPer100g * factor),
      caffeineMg: bevEstimate.caffeineMg,
      standardDrinks: bevEstimate.standardDrinks,
      caffeineMgPer100g: bevEstimate.caffeineMgPer100g,
      abvPercent: bevEstimate.abvPercent,
      caloriesPer100g: calPer100g,
      proteinPer100g: protPer100g,
      carbsPer100g: carbsPer100g,
      fatPer100g: matched.fatPer100g,
      fiberPer100g: matched.fiberPer100g,
      sugarPer100g: matched.sugarPer100g,
      sodiumMgPer100g: matched.sodiumMgPer100g,
      category: matched.category
    };
  }

  // If explicit ABV was given on an unrecognized drink name, treat as alcoholic beverage
  if (bevEstimate.overrideCaloriesPer100g !== undefined) {
    const calPer100g = bevEstimate.overrideCaloriesPer100g;
    const carbsPer100g = bevEstimate.overrideCarbsPer100g ?? 2.0;
    const protPer100g = bevEstimate.overrideProteinPer100g ?? 0;
    return {
      rawText: raw,
      name: displayName,
      grams: roundedGrams,
      isEstimatedWeight,
      needsWeightConfirmation,
      notes,
      isOver5kg,
      kgAmount,
      suggestedGrams,
      over5kgWarning,
      servingLabel,
      calories: Math.round(calPer100g * factor),
      protein: Math.round(protPer100g * factor * 10) / 10,
      carbs: Math.round(carbsPer100g * factor * 10) / 10,
      fat: 0,
      fiber: 0,
      sugar: 0,
      sodiumMg: Math.round(4 * factor),
      caffeineMg: bevEstimate.caffeineMg,
      standardDrinks: bevEstimate.standardDrinks,
      caffeineMgPer100g: bevEstimate.caffeineMgPer100g,
      abvPercent: bevEstimate.abvPercent,
      caloriesPer100g: calPer100g,
      proteinPer100g: protPer100g,
      carbsPer100g: carbsPer100g,
      fatPer100g: 0,
      fiberPer100g: 0,
      sugarPer100g: 0,
      sodiumMgPer100g: 4,
      category: 'beverage'
    };
  }

  if (!notes) {
    notes = `Unrecognized item "${displayName}" — estimated using standard mixed-food macros (135 kcal/100g).`;
  }

  return {
    rawText: raw,
    name: displayName,
    grams: roundedGrams,
    isEstimatedWeight,
    needsWeightConfirmation,
    notes,
    isOver5kg,
    kgAmount,
    suggestedGrams,
    over5kgWarning,
    servingLabel,
    calories: Math.round(135 * factor),
    protein: Math.round(6 * factor * 10) / 10,
    carbs: Math.round(16 * factor * 10) / 10,
    fat: Math.round(4.5 * factor * 10) / 10,
    fiber: Math.round(1.5 * factor * 10) / 10,
    sugar: Math.round(3.0 * factor * 10) / 10,
    sodiumMg: Math.round(140 * factor),
    caffeineMg: bevEstimate.caffeineMg,
    standardDrinks: bevEstimate.standardDrinks,
    caffeineMgPer100g: bevEstimate.caffeineMgPer100g,
    abvPercent: bevEstimate.abvPercent,
    caloriesPer100g: 135,
    proteinPer100g: 6,
    carbsPer100g: 16,
    fatPer100g: 4.5,
    fiberPer100g: 1.5,
    sugarPer100g: 3.0,
    sodiumMgPer100g: 140,
    category: 'grain'
  };
}

const MEAL_PROTEIN_PHRASES: Record<MealContextType, string[]> = {
  breakfast: [
    'Add a breakfast protein like 150g Greek yogurt, 2 eggs, or cottage cheese to turn this into a filling morning meal.',
    'Boost morning protein with a scoop of protein powder, scrambled eggs, or Greek yogurt to steady energy until lunch.',
    'Pair this with cottage cheese, smoked salmon, or a tofu scramble to reach 20–25g of breakfast protein.',
    'Round out your breakfast with 2 poached eggs or 150g skyr/Greek yogurt for stronger satiety.',
    'Stir in a scoop of protein powder or add a side of Greek yogurt and eggs so breakfast keeps you full longer.',
    'Include smoked salmon, cottage cheese, or tofu scramble alongside this to hit a solid morning protein target.',
    'Top with Greek yogurt or serve with 2 boiled eggs to balance morning carbohydrates with protein.'
  ],
  lunch: [
    'Add 120g grilled chicken, fish, tofu, or lentils to bring lunch up to 25–30g of protein.',
    'Pair this with lean beef, tempeh, or black beans so your midday meal sustains afternoon focus.',
    'Include a hearty protein source like baked fish, chicken breast, or spiced lentils to make lunch more filling.',
    'Round out lunch with 120g tofu, tempeh, or grilled chicken to improve protein density.',
    'Toss in chickpeas, beans, or flaked tuna/salmon to anchor this lunch with steady protein.',
    'Add a serving of lean beef, fish, or lentils alongside this to support muscle maintenance through the afternoon.',
    'Balance your lunch macros by adding grilled chicken, firm tofu, or a scoop of cooked beans.'
  ],
  dinner: [
    'Add 140g salmon, chicken, lean beef, or tempeh to anchor dinner with 25–35g of protein.',
    'Pair this evening meal with baked white fish, tofu, or lentils for overnight recovery and satiety.',
    'Include a main protein like grilled chicken, lean steak, or beans and lentils to complete dinner.',
    'Round out dinner with seared tofu, tempeh, or fish so the meal is balanced and satisfying.',
    'Add 130g lean beef, poultry, or a hearty lentil-bean mix to hit your evening protein target.',
    'Serve alongside baked fish, chicken breast, or crispy tofu to boost dinner protein density.',
    'Strengthen this dinner with tempeh, beans, or lean meat so you don’t get late-night hunger.'
  ],
  snack: [
    'Pair this snack with Greek yogurt, cottage cheese, or a hard boiled egg to keep hunger at bay.',
    'Add a handful of nuts, hummus, or beef/turkey jerky for a more satisfying, protein-rich snack.',
    'Include 100g cottage cheese, a boiled egg, or Greek yogurt so this snack holds you over.',
    'Combine with a spoonful of hummus, a small handful of almonds, or jerky to slow digestion.',
    'Make this snack more filling by adding Greek yogurt, hard boiled eggs, or a few walnuts.',
    'Boost snack protein with cottage cheese, jerky, or nuts and seeds for steadier afternoon energy.'
  ]
};

const HEALTHY_FAT_PHRASES = [
  'Add 10–15g of healthy fats (chia seeds, flaxseeds, or crushed walnuts) to slow digestion and help absorb fat-soluble vitamins.',
  'Sprinkle 1 tbsp of hemp seeds, chia, or sliced almonds on top for healthy fats and steadier energy.',
  'Include a small handful of nuts or a drizzle of olive/avocado oil to round out essential fatty acids.',
  'Top with pumpkin seeds, flax, or a spoonful of nut butter to add healthy unsaturated fats.',
  'Pair with ¼ avocado or 12g of mixed seeds so the meal digests more gradually.',
  'Add crushed almonds, walnuts, or chia seeds to bring healthy fats into balance.'
];

const PRODUCE_FIBER_PHRASES = [
  'Add 80–100g of fresh berries, sliced fruit, or leafy greens for extra fiber and micronutrients.',
  'Pair with a handful of spinach, broccoli, or fresh berries to boost volume and dietary fiber.',
  'Include a side of colourful vegetables or whole fruit to increase antioxidants and gut-friendly fiber.',
  'Toss in berries, sliced apple, or steamed greens to add natural fiber and potassium.',
  'Round out the plate with 100g of fresh produce to lift fiber above 4g for the meal.',
  'Add a serving of fruit or crisp vegetables to improve micronutrient density and fullness.'
];

const BALANCED_ADD_PHRASES = [
  'A glass of water alongside this meal — your protein, fiber, and whole-food balance already look solid.',
  'Fresh herbs, lemon zest, or cinnamon for extra antioxidants — your macro split is already well balanced.',
  'Nothing major needed — pair with water or green tea; protein and fiber are right on track.',
  'A sprinkle of seeds or fresh herbs if you like — this meal already hits a strong macro balance.',
  'Just a glass of water — your meal size, protein density, and fiber are well proportioned.'
];

function pickPhrase(phrases: string[], seed: number): string {
  const idx = Math.abs(seed) % phrases.length;
  return phrases[idx];
}

export function buildDecipheredFoodSummary(
  items: DecipheredFoodItem[],
  dailyCalorieGoal?: number,
  mealType: MealContextType = 'breakfast'
): DecipheredFoodResult {
  const hasKnownGoal = typeof dailyCalorieGoal === 'number' && dailyCalorieGoal > 0;
  const referenceDailyGoal = hasKnownGoal ? dailyCalorieGoal : 2000;
  const usedFallbackReference = !hasKnownGoal;

  if (items.length === 0) {
    return {
      mealSummaryName: 'Custom Meal',
      items: [],
      needsWeightConfirmation: false,
      hasItemOver5kg: false,
      isOver5000Kcal: false,
      isExtremeCalorieMeal: false,
      usedFallbackReference,
      referenceDailyGoal,
      totalCalories: 0,
      totalProtein: 0,
      totalCarbs: 0,
      totalFat: 0,
      totalFiber: 0,
      totalSugar: 0,
      totalSodiumMg: 0,
      totalCaffeineMg: 0,
      totalStandardDrinks: 0,
      healthRating: 5,
      healthLabel: 'Enter ingredients above',
      whatToAdd: [],
      whatToTakeOut: []
    };
  }

  const totalCalories = items.reduce((s, i) => s + i.calories, 0);
  const totalProtein = Math.round(items.reduce((s, i) => s + i.protein, 0) * 10) / 10;
  const totalCarbs = Math.round(items.reduce((s, i) => s + i.carbs, 0) * 10) / 10;
  const totalFat = Math.round(items.reduce((s, i) => s + i.fat, 0) * 10) / 10;
  const totalFiber = Math.round(items.reduce((s, i) => s + i.fiber, 0) * 10) / 10;
  const totalSugar = Math.round(items.reduce((s, i) => s + i.sugar, 0) * 10) / 10;
  const totalSodiumMg = items.reduce((s, i) => s + i.sodiumMg, 0);
  const totalCaffeineMg = Math.round(items.reduce((s, i) => s + (i.caffeineMg || 0), 0));
  const totalStandardDrinks = Math.round(items.reduce((s, i) => s + (i.standardDrinks || 0), 0) * 10) / 10;
  const needsWeightConfirmation = items.some(i => Boolean(i.needsWeightConfirmation));

  const hasItemOver5kg = items.some(i => i.grams > 5000);
  const hasItemOver2000Kcal = items.some(i => i.calories > 2000);
  const exceeds2xDailyGoal = totalCalories > 2 * referenceDailyGoal;
  const isOver5000Kcal = totalCalories > 5000;
  const over5000KcalWarning = isOver5000Kcal
    ? 'This meal is over 5,000 kcal. Is that right?'
    : undefined;
  const isExtremeCalorieMeal =
    hasItemOver5kg || hasItemOver2000Kcal || exceeds2xDailyGoal || isOver5000Kcal;

  const mainNames = items.filter(i => i.category !== 'seasoning' || items.length === 1).map(i => i.name);
  const mealSummaryName =
    mainNames.length <= 3
      ? mainNames.join(' & ')
      : `${mainNames.slice(0, 2).join(', ')} + ${mainNames.length - 2} more`;

  const phraseSeed =
    mealSummaryName.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0) +
    Math.round(totalCalories) +
    items.length * 17;

  // Health rating considers whole-food ratio, added sugar (>25g / >50g thresholds), meal size (>800 kcal), protein, and fiber
  const hasProduce = items.some(i => i.category === 'produce');
  const hasWholeGrainOrDairy = items.some(i => i.category === 'grain' || i.category === 'dairy');
  const isAddedSugarSource = (item: DecipheredFoodItem): boolean =>
    item.category === 'processed' ||
    (item.category === 'beverage' && item.sugar > 0) ||
    /\b(honey|syrup|maple|agave|sugar|chocolate|cookie|cookies|biscuit|cake|muffin|croissant|donut|brownie|pastry|candy|jam|jelly|soda|cola|coke|soft drink|energy drink|sweet tea)\b/i.test(
      item.name
    );

  const addedSugarGrams =
    Math.round(items.reduce((s, i) => s + (isAddedSugarSource(i) ? i.sugar : 0), 0) * 10) / 10;

  const isWholeFoodItem = (item: DecipheredFoodItem): boolean => {
    if (
      item.category === 'produce' ||
      item.category === 'grain' ||
      item.category === 'dairy' ||
      item.category === 'protein' ||
      item.category === 'fat' ||
      item.category === 'seasoning'
    ) {
      return true;
    }
    if (item.category === 'beverage' && item.calories <= 10) {
      return true;
    }
    return false;
  };

  const totalGrams = items.reduce((s, i) => s + i.grams, 0);
  const wholeFoodGrams = items.filter(isWholeFoodItem).reduce((s, i) => s + i.grams, 0);
  const wholeFoodCalories = items.filter(isWholeFoodItem).reduce((s, i) => s + i.calories, 0);
  const wholeFoodShare =
    totalCalories > 0
      ? Math.max(
          totalGrams > 0 ? wholeFoodGrams / totalGrams : 0,
          wholeFoodCalories / totalCalories
        )
      : 0;

  const isBeverageOnlyZeroCal = items.every(i => i.category === 'beverage' && i.calories <= 15 && (i.standardDrinks || 0) === 0);
  const hasAlmostNoProteinAndNoFibre = !isBeverageOnlyZeroCal && totalProtein < 5 && totalFiber < 2;
  const isGenuinelyPoorMeal =
    totalCalories > 800 ||
    addedSugarGrams > 50 ||
    hasAlmostNoProteinAndNoFibre ||
    isExtremeCalorieMeal;

  const isMostlyWholeFood = wholeFoodShare >= 0.65 && addedSugarGrams <= 25 && !isGenuinelyPoorMeal;
  const proteinDensityPct = totalCalories > 0 ? (totalProtein * 4 * 100) / totalCalories : 0;
  const isLightMeal = totalCalories > 0 && totalCalories < 220;

  let score = isMostlyWholeFood ? 8.0 : 6.8;

  // Fiber contribution
  if (totalFiber >= 5) score += 0.8;
  else if (totalFiber >= 3) score += 0.5;
  else if (totalFiber >= 1.5) score += 0.2;

  // Whole-food foundation bonus
  if (hasProduce && hasWholeGrainOrDairy) score += 0.4;
  else if (hasProduce || hasWholeGrainOrDairy) score += 0.2;

  // Protein density & absolute protein
  if (totalProtein >= 25 || (totalProtein >= 18 && proteinDensityPct >= 20)) {
    score += 0.8;
  } else if (totalProtein >= 12 || proteinDensityPct >= 15) {
    score += 0.5;
  }

  // Only penalize added sugar when total added sugar in the meal exceeds 25g
  if (addedSugarGrams > 50) {
    score -= 2.8;
  } else if (addedSugarGrams > 25) {
    score -= 1.4;
  }

  // Savory ultra-processed penalty only for substantial processed portions (>= 15g) when not mostly whole food
  const hasSubstantialSavoryProcessed = items.some(
    i => i.category === 'processed' && i.grams >= 15 && !isAddedSugarSource(i)
  );
  if (hasSubstantialSavoryProcessed && !isMostlyWholeFood) {
    score -= 1.0;
  }

  if (totalSodiumMg > 1000) score -= 0.8;
  if (totalFat > 35 && totalProtein < 12) score -= 0.6;

  // Apply genuinely poor meal penalties vs whole-food floor
  if (isGenuinelyPoorMeal) {
    if (addedSugarGrams > 50 || hasAlmostNoProteinAndNoFibre) {
      score = Math.min(score, 5.2);
    } else if (totalCalories > 800 && (!isMostlyWholeFood || totalCalories > 1100 || addedSugarGrams > 25)) {
      score = Math.min(score, 5.5);
    }
  } else {
    // Never rate under 6 unless the meal is genuinely poor
    score = Math.max(6.0, score);
    // A meal of mostly whole foods should rate 8/10 or higher
    if (isMostlyWholeFood) {
      score = Math.max(8.0, score);
    }
  }

  score = Math.max(1, Math.min(10, score));

  if (hasItemOver2000Kcal) {
    score -= 3;
  }
  if (exceeds2xDailyGoal) {
    score = Math.min(score, 2);
  }
  if (isOver5000Kcal) {
    score = 1;
  }

  const healthRating = isOver5000Kcal
    ? 1
    : Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  const whatToAdd: string[] = [];
  const whatToTakeOut: string[] = [];
  let healthLabel: string;

  const mealDisplayName =
    mealType === 'snack' ? 'snack' : mealType;

  if (isExtremeCalorieMeal) {
    const quantityAdvice = usedFallbackReference
      ? 'This is far above a normal meal. Check the quantities. Based on a 2,000 kcal reference.'
      : 'This is far above a normal meal. Check the quantities.';
    healthLabel = quantityAdvice;
    whatToTakeOut.push(quantityAdvice);

    for (const item of items) {
      if (item.grams > 5000 && item.over5kgWarning) {
        whatToTakeOut.push(item.over5kgWarning);
      } else if (item.calories > 2000) {
        whatToTakeOut.push(
          `${item.name} (${item.grams}g — ${item.calories} kcal) exceeds 2,000 kcal for a single item. Check the quantity.`
        );
      }
    }
  } else {
    let baseLabel: string;
    if (healthRating >= 8.0) {
      baseLabel =
        healthRating >= 8.5
          ? 'Excellent — Nutrient-Dense & Balanced'
          : 'Great — Whole-Food Foundation';
    } else if (isLightMeal && totalProtein < 10 && addedSugarGrams <= 25) {
      baseLabel = `Light meal — add protein to make it a proper ${mealDisplayName}.`;
    } else if (totalProtein < 5) {
      baseLabel = `Low protein — add protein to make it a proper ${mealDisplayName}.`;
    } else if (healthRating >= 7.0) {
      baseLabel = 'Good — Whole-Food Foundation';
    } else if (healthRating >= 6.0) {
      baseLabel = 'Moderate — Could Use Macro Balance';
    } else if (addedSugarGrams > 25) {
      baseLabel = 'Low — High in Added Sugar';
    } else {
      baseLabel = 'Low — High Calorie Density or Low Protein & Fiber';
    }

    healthLabel = usedFallbackReference
      ? `${baseLabel} (Based on a 2,000 kcal reference.)`
      : baseLabel;

    const proteinSuggestions = MEAL_PROTEIN_PHRASES[mealType] || MEAL_PROTEIN_PHRASES.breakfast;
    if (totalProtein < 15) {
      whatToAdd.push(pickPhrase(proteinSuggestions, phraseSeed));
    }

    if (totalFat < 3) {
      whatToAdd.push(pickPhrase(HEALTHY_FAT_PHRASES, phraseSeed + 3));
    }

    if (!hasProduce && totalFiber < 3) {
      whatToAdd.push(pickPhrase(PRODUCE_FIBER_PHRASES, phraseSeed + 7));
    } else if (totalFiber < 2.5) {
      whatToAdd.push(pickPhrase(PRODUCE_FIBER_PHRASES, phraseSeed + 11));
    }

    if (whatToAdd.length === 0) {
      whatToAdd.push(pickPhrase(BALANCED_ADD_PHRASES, phraseSeed));
    }

    // Never suggest removing a single ingredient under 15g unless the meal is otherwise unhealthy (isGenuinelyPoorMeal)
    const canSuggestRemovingItem = (item: DecipheredFoodItem): boolean =>
      item.grams >= 15 || isGenuinelyPoorMeal;

    const saltItem = items.find(
      i => /salt|soy sauce/i.test(i.name) && canSuggestRemovingItem(i) && i.sodiumMg > 400
    );
    if (saltItem) {
      whatToTakeOut.push(
        `Reduce the ${saltItem.rawText} (~${saltItem.sodiumMg}mg sodium) and swap in cinnamon, citrus zest, or fresh herbs.`
      );
    } else if (totalSodiumMg > 900) {
      whatToTakeOut.push(
        `Trim high-sodium items (${totalSodiumMg}mg total sodium) to keep daily sodium in check.`
      );
    }

    // Only flag sugar or say "take out empty calories" when added sugar is over 25g in the meal
    if (addedSugarGrams > 25) {
      const sugaryItems = items.filter(
        i => isAddedSugarSource(i) && i.sugar > 0 && canSuggestRemovingItem(i)
      );
      if (sugaryItems.length > 0) {
        whatToTakeOut.push(
          `Take out empty calories by scaling back ${sugaryItems.map(p => p.name).join(' & ')} (${addedSugarGrams}g added sugar).`
        );
      } else {
        whatToTakeOut.push(
          `Take out empty calories by reducing added sugars (${addedSugarGrams}g total in this meal).`
        );
      }
    }

    const heavyFatItem = items.find(
      i => i.fat > 22 && canSuggestRemovingItem(i) && !isMostlyWholeFood
    );
    if (heavyFatItem) {
      whatToTakeOut.push(
        `Trim the portion of ${heavyFatItem.name} by ~30% to save ~${Math.round(heavyFatItem.calories * 0.3)} kcal.`
      );
    }

    if (whatToTakeOut.length === 0) {
      if (hasAlmostNoProteinAndNoFibre) {
        whatToTakeOut.push('Add protein and fiber to make this a balanced meal.');
      } else {
        const cleanTakeoutPhrases = [
          'Whole-food ingredients look clean — no excess refined sugars or trans fats to remove.',
          'Ingredients are clean and unprocessed; focus on portion balance rather than removing items.',
          'No excess refined ingredients or high sodium detected in this meal.',
          'Solid whole-food choices — nothing unhealthy needs to be cut from this plate.',
          'Clean ingredient profile with no refined oils or excess added sugars to strip out.'
        ];
        whatToTakeOut.push(pickPhrase(cleanTakeoutPhrases, phraseSeed + 5));
      }
    }
  }

  return {
    mealSummaryName,
    items,
    needsWeightConfirmation,
    hasItemOver5kg,
    isOver5000Kcal,
    over5000KcalWarning,
    isExtremeCalorieMeal,
    usedFallbackReference,
    referenceDailyGoal,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat,
    totalFiber,
    totalSugar,
    totalSodiumMg,
    totalCaffeineMg,
    totalStandardDrinks,
    healthRating,
    healthLabel,
    whatToAdd,
    whatToTakeOut
  };
}

export function recalculateDecipheredFoodWithGrams(
  baseResult: DecipheredFoodResult,
  gramOverrides: Record<number, number>,
  dailyCalorieGoal?: number,
  mealType: MealContextType = 'breakfast'
): DecipheredFoodResult {
  const updatedItems = baseResult.items.map((item, idx) => {
    const hasOverride = Object.prototype.hasOwnProperty.call(gramOverrides, idx);
    const grams = hasOverride ? Math.max(0, Number(gramOverrides[idx]) || 0) : item.grams;
    const roundedGrams = Math.round(grams * 10) / 10;
    const isOver5kg = roundedGrams > 5000;
    const kgAmount = isOver5kg ? Math.round((roundedGrams / 1000) * 100) / 100 : undefined;
    const suggestedGrams = isOver5kg ? kgAmount : undefined;
    const over5kgWarning = isOver5kg
      ? `${kgAmount}kg of ${item.name.toLowerCase()} seems very high. Did you mean ${suggestedGrams}g?`
      : undefined;
    const factor = grams / 100;
    const stillNeedsConfirmation = hasOverride ? grams <= 0 : Boolean(item.needsWeightConfirmation);

    const caffeineMg = item.caffeineMgPer100g
      ? Math.round(item.caffeineMgPer100g * factor)
      : item.caffeineMg || 0;
    const standardDrinks =
      item.abvPercent && item.abvPercent > 0
        ? Math.round(((grams / 100) * item.abvPercent * 0.789 / 14) * 10) / 10
        : item.standardDrinks || 0;

    return {
      ...item,
      grams: roundedGrams,
      isEstimatedWeight: hasOverride ? false : item.isEstimatedWeight,
      needsWeightConfirmation: stillNeedsConfirmation,
      isOver5kg,
      kgAmount,
      suggestedGrams,
      over5kgWarning,
      servingLabel: hasOverride
        ? `${roundedGrams}g`
        : stillNeedsConfirmation
          ? 'How much?'
          : item.servingLabel,
      calories: Math.round(item.caloriesPer100g * factor),
      protein: Math.round(item.proteinPer100g * factor * 10) / 10,
      carbs: Math.round(item.carbsPer100g * factor * 10) / 10,
      fat: Math.round(item.fatPer100g * factor * 10) / 10,
      fiber: Math.round(item.fiberPer100g * factor * 10) / 10,
      sugar: Math.round(item.sugarPer100g * factor * 10) / 10,
      sodiumMg: Math.round(item.sodiumMgPer100g * factor),
      caffeineMg,
      standardDrinks
    };
  });
  const summary = buildDecipheredFoodSummary(updatedItems, dailyCalorieGoal, mealType);
  summary.isRecipe = baseResult.isRecipe;
  summary.recipeServings = baseResult.recipeServings;
  if (baseResult.isRecipe && baseResult.mealSummaryName) {
    summary.mealSummaryName = baseResult.mealSummaryName;
  }
  let totalRecipeGrams = 0;
  for (const it of updatedItems) {
    totalRecipeGrams += it.grams;
  }
  summary.totalRecipeGrams = Math.round(totalRecipeGrams * 10) / 10;
  return summary;
}

export function decipherFoodText(
  rawInput: string,
  dailyCalorieGoal?: number,
  mealType: MealContextType = 'breakfast'
): DecipheredFoodResult {
  const normalizedInput = normalizeFoodTypos(rawInput.trim());

  // Check for recipe format like "Carbonara for 4 people: 400g spaghetti, 200g pancetta, 4 eggs..."
  // or "Carbonara: 400g spaghetti, ..."
  // or "Pasta (serves 4): 400g spaghetti..."
  const recipeColonMatch = normalizedInput.match(
    /^([^:\n]+?)(?:\s+(?:for|serves|makes|yields)\s*(\d+)\s*(?:people|servings|portions|cups)?)?\s*:\s*(.+)$/is
  );

  let recipeTitle: string | undefined;
  let detectedRecipeServings: number | undefined;
  let ingredientsString = normalizedInput;

  if (recipeColonMatch) {
    recipeTitle = recipeColonMatch[1].trim();
    if (recipeColonMatch[2]) {
      detectedRecipeServings = parseInt(recipeColonMatch[2], 10);
    }
    ingredientsString = recipeColonMatch[3].trim();
  }

  // Also check if text has "for 4 people" anywhere
  const servesMatch = normalizedInput.match(/\b(?:for|serves|makes|yields)\s*(\d+)\s*(?:people|servings|portions|cups)?\b/i) || 
                      normalizedInput.match(/\b(\d+)\s*(?:servings|people|portions|serves)\b/i);
  if (!detectedRecipeServings && servesMatch) {
    detectedRecipeServings = parseInt(servesMatch[1], 10);
  }

  // Avoid splitting items like "milk, 3%" or "yogurt, 2%" on the comma
  const sanitizedIngredients = ingredientsString.replace(/,\s*(?=\d+\s*%)/g, ' ');

  const parts = sanitizedIngredients
    .split(/(?:[,;\n+]+|\b(?:and|with|plus|topped with|alongside)\b)/i)
    .map(s => s.trim())
    .filter(Boolean);

  const items: DecipheredFoodItem[] = [];
  for (const part of parts) {
    const parsed = parseFoodSegment(part);
    if (parsed) items.push(parsed);
  }

  const result = buildDecipheredFoodSummary(items, dailyCalorieGoal, mealType);

  let totalRecipeGrams = 0;
  for (const it of items) {
    totalRecipeGrams += it.grams;
  }
  result.totalRecipeGrams = Math.round(totalRecipeGrams * 10) / 10;

  const hasRecipeUnits = /\b(cups?|tablespoons?|tbsp|teaspoons?|tsp|pounds?|lbs?|ounces?|oz)\b/i.test(normalizedInput);
  const hasRecipeKeywords = /\b(flour|sugar|baking|dough|butter|oil|vanilla|salt|powder|egg|eggs)\b/i.test(normalizedInput);
  const isRecipe = Boolean(recipeColonMatch) || 
                   Boolean(detectedRecipeServings) || 
                   /\b(?:recipe|carbonara|for\s+\d+|serves\s+\d+|makes\s+\d+)\b/i.test(normalizedInput) ||
                   (items.length >= 2 && (hasRecipeUnits || hasRecipeKeywords)) ||
                   (items.length >= 3 && normalizedInput.toLowerCase().includes('people'));

  result.isRecipe = isRecipe;
  if (isRecipe) {
    result.recipeServings = detectedRecipeServings || 4; // default 4 servings
    if (recipeTitle) {
      result.mealSummaryName = recipeTitle
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');
    } else {
      result.mealSummaryName = 'Recipe';
    }
  }

  return result;
}
