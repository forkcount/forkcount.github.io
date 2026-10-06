import type { UserProfile, MacroTarget, WeightRecord } from '../types/index.js';

export function hasCompleteProfileStats(profile?: UserProfile | null): boolean {
  if (!profile) return false;
  return Boolean(
    profile.name &&
      profile.name.trim().length > 0 &&
      profile.age >= 13 &&
      profile.age <= 120 &&
      profile.heightCm > 0 &&
      profile.currentWeightKg > 0 &&
      profile.goalWeightKg > 0 &&
      (profile.gender === 'male' ||
        profile.gender === 'female' ||
        profile.gender === 'other' ||
        profile.gender === 'prefer_not_to_say') &&
      profile.dailyActivity &&
      (profile.goalSpeed || profile.goal)
  );
}

function computeRawBmr(profile: UserProfile): number {
  const { gender, currentWeightKg, heightCm, age, bodyFatPercent } = profile;

  if (bodyFatPercent && bodyFatPercent > 3 && bodyFatPercent < 60) {
    // Katch-McArdle formula
    const leanMass = currentWeightKg * (1 - bodyFatPercent / 100);
    return 370 + 21.6 * leanMass;
  }

  // Mifflin-St Jeor formula
  const base = 10 * currentWeightKg + 6.25 * heightCm - 5 * age;
  if (gender === 'male') {
    return base + 5;
  }
  if (gender === 'female') {
    return base - 161;
  }
  // Prefer not to say: average of male (+5) and female (-161) formulas = -78
  return base - 78;
}

export function calculateBmr(profile: UserProfile): number {
  if (!hasCompleteProfileStats(profile)) {
    return 0;
  }
  return Math.round(computeRawBmr(profile));
}

export function calculateMaintenanceCalories(profile: UserProfile): number {
  if (!hasCompleteProfileStats(profile)) {
    return 0;
  }
  const bmr = computeRawBmr(profile);
  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    athlete: 1.9
  };
  const multiplier = activityMultipliers[profile.dailyActivity];
  if (!multiplier) return 0;
  return Math.round(bmr * multiplier);
}

export function calculateDailyCalorieTarget(profile: UserProfile): number {
  if (!hasCompleteProfileStats(profile)) {
    return 0;
  }

  const { gender, dailyActivity, goalSpeed } = profile;
  const bmr = computeRawBmr(profile);

  const activityMultipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    athlete: 1.9
  };

  const multiplier = activityMultipliers[dailyActivity];
  if (!multiplier) return 0;

  const tdee = bmr * multiplier;

  const speedAdjustments: Record<string, number> = {
    lose_slow: -250,
    lose_normal: -500,
    lose_fast: -750,
    lose_aggressive: -1000,
    lose: -500,
    maintain: 0,
    gain_slow: 250,
    gain_normal: 500,
    gain: 500,
    recomp: 0
  };

  const selectedKey = profile.goalSpeed || profile.goal || 'maintain';
  if (!(selectedKey in speedAdjustments)) {
    return Math.round(tdee);
  }

  let target = tdee + speedAdjustments[selectedKey];

  // Floor at 1200 for women, 1500 for men, 1350 (average) for other/prefer_not_to_say
  const floor = gender === 'male' ? 1500 : gender === 'female' ? 1200 : 1350;
  if (target < floor) {
    target = floor;
  }

  return Math.round(target);
}

/**
 * Auto-calculate macros from the calorie goal:
 * Standard: 30% Protein, 30% Fat, 40% Carbs
 * Recomp: 35% Protein, 25% Fat, 40% Carbs
 * The three percentages must add to 100%. Grams × 4/4/9 must equal the target exactly.
 */
export function calculateMacroTargets(targetCalories: number, goal?: string): MacroTarget {
  const target = targetCalories;
  const isRecomp = goal === 'recomp';
  const proteinPct = isRecomp ? 35 : 30;
  const fatPct = isRecomp ? 25 : 30;
  const carbsPct = 40;

  if (!target || target <= 0) {
    return {
      calories: 0,
      carbsGrams: 0,
      fatGrams: 0,
      proteinGrams: 0,
      carbsPct,
      fatPct,
      proteinPct
    };
  }

  const targetFatKcal = target * (fatPct / 100);
  const targetProteinKcal = target * (proteinPct / 100);

  let proteinGrams = Math.round(targetProteinKcal / 4);
  let fatGrams = Math.round(targetFatKcal / 9);

  let remainingKcal = target - (proteinGrams * 4 + fatGrams * 9);
  let carbsGrams = Math.round(remainingKcal / 4);

  let currentTotal = proteinGrams * 4 + fatGrams * 9 + carbsGrams * 4;
  let diff = target - currentTotal;

  let attempts = 0;
  while (diff !== 0 && attempts < 20) {
    attempts++;
    if (diff % 4 === 0) {
      carbsGrams += diff / 4;
      break;
    } else {
      if (diff > 0) {
        fatGrams += 1;
      } else {
        fatGrams = Math.max(10, fatGrams - 1);
      }
      currentTotal = proteinGrams * 4 + fatGrams * 9 + carbsGrams * 4;
      diff = target - currentTotal;
    }
  }

  currentTotal = proteinGrams * 4 + fatGrams * 9 + carbsGrams * 4;
  if (currentTotal !== target) {
    carbsGrams = Math.max(0, Math.floor((target - (proteinGrams * 4 + fatGrams * 9)) / 4));
    const remainder = target - (proteinGrams * 4 + fatGrams * 9 + carbsGrams * 4);
    if (remainder > 0) {
      proteinGrams += Math.floor(remainder / 4);
    }
  }

  return {
    calories: target,
    carbsGrams,
    fatGrams,
    proteinGrams,
    carbsPct,
    fatPct,
    proteinPct
  };
}

export interface ProjectedGoalDetails {
  dateText: string;
  daysNeeded: number;
  weeksNeeded: number;
  diffKg: number;
  calculationText: string;
  isMaintain: boolean;
  basisLabel: 'Based on your last 2 weeks' | 'Based on your goal speed' | '';
  usedActualTrend: boolean;
  ratePerWeekKg: number;
  isCappedAtTwoYears: boolean;
  cappedNote: string;
  whyText: string;
}

/**
 * Calculates projected goal date details using the exact formula:
 * weeks = |current weight − goal weight| ÷ rate per week
 * days = weeks × 7
 * projected date = today + days
 *
 * If goal speed is Lose slow, use 0.25 kg/week.
 * If Lose normal, use 0.5 kg/week.
 * If Lose fast, use 0.75 kg/week.
 * If Build muscle, use the gain rate.
 * If Maintain, hide the projected date entirely and show "—".
 */
export function calculateProjectedGoalDetails(
  profile: UserProfile,
  _weights: WeightRecord[] = [],
  _forceGoalSpeedOverride: boolean = false
): ProjectedGoalDetails {
  const emptyResult: ProjectedGoalDetails = {
    dateText: '',
    daysNeeded: 0,
    weeksNeeded: 0,
    diffKg: 0,
    calculationText: '',
    isMaintain: false,
    basisLabel: '',
    usedActualTrend: false,
    ratePerWeekKg: 0,
    isCappedAtTwoYears: false,
    cappedNote: '',
    whyText: 'We use your goal speed to project. Change your goal speed in the Me tab anytime.'
  };

  if (!hasCompleteProfileStats(profile)) {
    return emptyResult;
  }

  if (profile.goalSpeed === 'maintain') {
    return {
      ...emptyResult,
      dateText: '—',
      isMaintain: true,
      basisLabel: 'Based on your goal speed'
    };
  }

  if (!profile.goalWeightKg || profile.goalWeightKg <= 0) {
    return emptyResult;
  }

  const weeklyRateBySpeed: Record<string, number> = {
    lose_slow: 0.25,
    lose_normal: 0.5,
    lose_fast: 0.75,
    lose_aggressive: 1.0,
    maintain: 0,
    gain_slow: 0.25,
    gain_normal: 0.5
  };

  const diffKg = Math.round(Math.abs(profile.currentWeightKg - profile.goalWeightKg) * 10) / 10;
  if (diffKg < 0.1) {
    return {
      ...emptyResult,
      dateText: '—',
      isMaintain: true,
      basisLabel: 'Based on your goal speed'
    };
  }

  const ratePerWeek = weeklyRateBySpeed[profile.goalSpeed] || 0;
  if (!ratePerWeek || ratePerWeek <= 0) {
    return emptyResult;
  }

  const weeks = diffKg / ratePerWeek;
  const roundedWeeks = Math.max(1, Math.round(weeks));
  const rawDaysNeeded = Math.max(1, Math.round(weeks * 7));

  const MAX_DAYS_TWO_YEARS = 730;
  const isCappedAtTwoYears = rawDaysNeeded > MAX_DAYS_TWO_YEARS;
  const daysNeeded = isCappedAtTwoYears ? MAX_DAYS_TWO_YEARS : rawDaysNeeded;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysNeeded);

  const formattedDate =
    targetDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    }) + ` (~${daysNeeded} days)`;

  const calculationText = `${diffKg} kg to go ÷ ${ratePerWeek} kg per week = ${roundedWeeks} ${
    roundedWeeks === 1 ? 'week' : 'weeks'
  }`;

  return {
    dateText: formattedDate,
    daysNeeded,
    weeksNeeded: roundedWeeks,
    diffKg,
    calculationText,
    isMaintain: false,
    basisLabel: 'Based on your goal speed',
    usedActualTrend: false,
    ratePerWeekKg: ratePerWeek,
    isCappedAtTwoYears,
    cappedNote: isCappedAtTwoYears ? 'Long-term trend — keep logging to refine.' : '',
    whyText: 'We use your goal speed to project. Change your goal speed in the Me tab anytime.'
  };
}

/**
 * Calculates projected goal date based on weight difference and weekly rate:
 * weeks = |current weight − goal weight| ÷ rate per week
 * days = weeks × 7
 * projected date = today + days
 * Never invents numbers if required stats are incomplete.
 */
export function calculateProjectedGoalDate(
  profile: UserProfile,
  weights: WeightRecord[] = [],
  forceGoalSpeedOverride: boolean = false
): string {
  return calculateProjectedGoalDetails(profile, weights, forceGoalSpeedOverride).dateText;
}

export function formatWeight(kg: number, unitSystem: 'metric' | 'imperial'): string {
  if (unitSystem === 'imperial') {
    const lbs = Math.round(kg * 2.20462 * 10) / 10;
    return `${lbs} lbs`;
  }
  return `${Math.round(kg * 10) / 10} kg`;
}
