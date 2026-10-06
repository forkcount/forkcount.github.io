// Section N: Backup validation, version mismatch detection, and schema migration (#79, #80)
import { formatLocalDate } from './dateUtils.js';

export const CURRENT_BACKUP_SCHEMA_VERSION = '1.0.0';

export interface MigratedBackupPayload {
  schemaVersion: string;
  migratedFromVersion: string | null;
  profile?: Record<string, any>;
  diaryEntries: any[];
  exerciseEntries: any[];
  weightEntries: any[];
  waterEntries?: Record<string, number>;
  savedFoods: any[];
  savedRecipes: any[];
  mealTemplates: any[];
  measurements: any[];
  cravings: any[];
  nonScaleVictories: any[];
}

export function migrateAndValidateBackup(rawInput: unknown): {
  valid: boolean;
  error?: string;
  data?: MigratedBackupPayload;
} {
  if (!rawInput || typeof rawInput !== 'object') {
    return { valid: false, error: 'Invalid backup file: expected a JSON object.' };
  }

  const obj = rawInput as Record<string, any>;
  const sourceVersion = String(obj.schemaVersion || obj.version || '0.8.0');
  let migratedFromVersion: string | null = null;

  if (sourceVersion !== CURRENT_BACKUP_SCHEMA_VERSION) {
    migratedFromVersion = sourceVersion;
  }

  // Support both v0.x legacy keys (`diary`, `exercises`, `weights`) and v1.0.0 keys (`diaryEntries`, `exerciseEntries`, `weightEntries`)
  const rawDiary = Array.isArray(obj.diaryEntries)
    ? obj.diaryEntries
    : Array.isArray(obj.diary)
      ? obj.diary
      : [];

  const rawExercises = Array.isArray(obj.exerciseEntries)
    ? obj.exerciseEntries
    : Array.isArray(obj.exercises)
      ? obj.exercises
      : [];

  const rawWeights = Array.isArray(obj.weightEntries)
    ? obj.weightEntries
    : Array.isArray(obj.weights)
      ? obj.weights
      : [];

  const diaryEntries = rawDiary
    .filter((item: any) => item && typeof item === 'object' && item.name)
    .map((item: any) => ({
      ...item,
      date: item.date || formatLocalDate(),
      mealType: item.mealType || 'breakfast',
      name: String(item.name).trim().slice(0, 200),
      calories: Math.max(0, Math.round(Number(item.calories) || 0)),
      carbs: Math.max(0, Number(item.carbs) || 0),
      fat: Math.max(0, Number(item.fat) || 0),
      protein: Math.max(0, Number(item.protein) || 0),
      serving: String(item.serving || '1 serving'),
      createdAt: Number(item.createdAt) || Date.now()
    }));

  const exerciseEntries = rawExercises
    .filter((ex: any) => ex && typeof ex === 'object')
    .map((ex: any) => ({
      ...ex,
      date: ex.date || formatLocalDate(),
      activityName: String(ex.activityName || ex.name || 'Workout').trim().slice(0, 200),
      minutes: Math.max(1, Number(ex.minutes) || 15),
      met: Math.max(1, Number(ex.met) || 5),
      caloriesBurned: Math.max(0, Math.round(Number(ex.caloriesBurned) || 0)),
      intensity: ex.intensity === 'Low' || ex.intensity === 'High' ? ex.intensity : 'Moderate',
      createdAt: Number(ex.createdAt) || Date.now()
    }));

  const weightEntries = rawWeights
    .filter((w: any) => w && typeof w === 'object' && Number(w.weightKg) > 0)
    .map((w: any) => ({
      ...w,
      date: w.date || formatLocalDate(),
      weightKg: Math.min(500, Math.max(20, Number(w.weightKg))),
      createdAt: Number(w.createdAt) || Date.now()
    }));

  return {
    valid: true,
    data: {
      schemaVersion: CURRENT_BACKUP_SCHEMA_VERSION,
      migratedFromVersion,
      profile: obj.profile && typeof obj.profile === 'object' ? obj.profile : undefined,
      diaryEntries,
      exerciseEntries,
      weightEntries,
      waterEntries: obj.waterEntries && typeof obj.waterEntries === 'object' ? obj.waterEntries : undefined,
      savedFoods: Array.isArray(obj.savedFoods) ? obj.savedFoods : [],
      savedRecipes: Array.isArray(obj.savedRecipes) ? obj.savedRecipes : [],
      mealTemplates: Array.isArray(obj.mealTemplates) ? obj.mealTemplates : [],
      measurements: Array.isArray(obj.measurements) ? obj.measurements : [],
      cravings: Array.isArray(obj.cravings) ? obj.cravings : [],
      nonScaleVictories: Array.isArray(obj.nonScaleVictories) ? obj.nonScaleVictories : []
    }
  };
}

export function validateAndMigrateBackup(rawInput: unknown): MigratedBackupPayload {
  const res = migrateAndValidateBackup(rawInput);
  if (!res.valid || !res.data) {
    throw new Error(res.error || 'Invalid backup file.');
  }
  return res.data;
}

