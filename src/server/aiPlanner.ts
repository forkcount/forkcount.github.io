import type { WeekPlan } from '../types/index.js';
import { getProfile } from './db.js';
import { generateWeekPlanFromMealDb } from '../utils/mealDbPlanner.js';

interface GeneratePlanRequest {
  type: 'meals' | 'workouts' | 'both';
  dailyTargetCalories: number;
  dailyTargetCarbs: number;
  dailyTargetFat: number;
  dailyTargetProtein: number;
  preferences: {
    restrictions: string[];
    allergies: string[];
    dislikes: string;
    cookTime: string;
    mealsPerDay: number;
    budget: string;
    workoutDaysPerWeek: number;
    equipment: string;
    injuries: string;
    narrowingText?: string;
  };
}

/**
 * Generates a 7-day weekly meal & workout plan exclusively by searching real recipes
 * from TheMealDB (no AI-generated or invented recipes).
 */
export async function generateWeekPlanWithGemini(
  userId: string,
  req: GeneratePlanRequest
): Promise<WeekPlan> {
  const profile = (getProfile(userId) || {}) as any;
  const profileRestrictions: string[] = [];

  if (Array.isArray(profile.restrictions)) {
    for (const r of profile.restrictions) {
      if (r && typeof r === 'string') profileRestrictions.push(r);
    }
  }
  const dietField =
    profile.diet ||
    profile.dietaryPreference ||
    profile.dietary_preference ||
    profile.eatingStyle ||
    '';
  if (dietField && typeof dietField === 'string') {
    profileRestrictions.push(dietField);
  }
  if (profile.vegetarian || profile.isVegetarian) {
    profileRestrictions.push('Vegetarian');
  }
  if (profile.vegan || profile.isVegan) {
    profileRestrictions.push('Vegan');
  }

  return generateWeekPlanFromMealDb(userId, {
    type: req.type || 'both',
    dailyTargetCalories: Number(req.dailyTargetCalories) || Number(profile.targetCalories) || 2000,
    dailyTargetCarbs: req.dailyTargetCarbs,
    dailyTargetFat: req.dailyTargetFat,
    dailyTargetProtein: req.dailyTargetProtein,
    profileRestrictions,
    preferences: req.preferences
  });
}
