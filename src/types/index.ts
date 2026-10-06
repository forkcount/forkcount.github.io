export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface FoodItem {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  name: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  fiber?: number; // g
  sugar?: number; // g
  sodium?: number; // mg
  iron?: number; // mg
  calcium?: number; // mg
  vitaminD?: number; // mcg
  caffeineMg?: number; // mg
  standardDrinks?: number; // standard alcoholic drinks
  serving?: string;
  servingSize?: number;
  servingUnit?: string;
  note?: string;
  unusualQuantity?: boolean;
  loggedHour?: number; // 0-23
  costEstimate?: number;
  source?: 'manual' | 'recipe' | 'packaged' | 'usda' | 'saved' | 'plan' | 'voice' | 'photo' | 'restaurant' | 'ai';
  createdAt: number;
}

export type DiaryEntry = FoodItem;

export interface ExerciseItem {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  activityName: string;
  met: number;
  minutes: number;
  caloriesBurned: number;
  intensity: 'Low' | 'Moderate' | 'High';
  weightKg?: number;
  reps?: number;
  sets?: number;
  distanceKm?: number;
  plankSeconds?: number;
  createdAt: number;
}

export interface WaterRecord {
  date: string;
  glasses: number; // 0 to 8+
}

export interface WeightRecord {
  id: string;
  userId: string;
  date: string;
  weightKg: number;
  createdAt: number;
}

export interface BodyMeasurement {
  id: string;
  userId: string;
  date: string;
  chestCm?: number;
  waistCm?: number;
  armsCm?: number;
  hipsCm?: number;
  thighCm?: number;
  createdAt: number;
}

export interface ProgressPhoto {
  id: string;
  userId: string;
  date: string;
  label: 'before' | 'after' | 'progress' | 'front' | 'side' | 'back';
  dataUrl: string;
  weightKg?: number;
  note?: string;
  createdAt: number;
}

export interface DailyHabitLog {
  userId: string;
  date: string;
  mood?: number; // 1-5
  energy?: number; // 1-5
  sleepQuality?: number; // 1-5
  sleepHours?: number;
  journalPrompt?: string;
  journalAnswer?: string;
  steps?: number;
}

export interface CravingLog {
  id: string;
  userId: string;
  date: string;
  time: string;
  wantedFood: string;
  intensity: number; // 1-5
  trigger?: string;
  createdAt: number;
}

export interface NonScaleVictory {
  id: string;
  userId: string;
  date: string;
  text: string;
  createdAt: number;
}

export interface PantryItem {
  id: string;
  userId: string;
  name: string;
  quantity: string;
  category: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen' | 'leftover';
  caloriesPerPortion?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  isLeftover?: boolean;
  createdAt: number;
}

export interface FriendRecord {
  id: string;
  userId?: string;
  username: string;
  displayName?: string;
  streakDays?: number;
  daysOnTargetThisWeek?: number;
  waterDaysCompleted?: number;
  isPartner?: boolean;
  createdAt?: number;
  addedAt?: number;
}

export interface SharedRecipeRecord {
  id: string;
  userId: string;
  toUsername: string;
  fromUsername?: string;
  recipeName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: number;
  recipeId?: string;
}

export interface SavedFood {
  id: string;
  userId: string;
  name: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  serving: string;
  createdAt: number;
}

export interface RecipeIngredient {
  raw: string;
  name: string;
  amount: number;
  unit: string;
  calories: number;
  carbs: number;
  fat: number;
  protein: number;
  isVague?: boolean;
  vagueSuggestions?: string[];
}

export interface SavedRecipe {
  id: string;
  userId: string;
  name: string;
  servings?: number;
  ingredients: RecipeIngredient[];
  totalCalories: number;
  totalCarbs: number;
  totalFat: number;
  totalProtein: number;
  createdAt: number;
}

export interface MealTemplate {
  id: string;
  userId: string;
  name: string;
  items: Array<{
    mealType: MealType;
    name: string;
    calories: number;
    carbs: number;
    fat: number;
    protein: number;
    serving?: string;
  }>;
  createdAt: number;
}

export interface UserProfile {
  name: string;
  username?: string;
  country?: string;
  age: number;
  gender: 'male' | 'female' | 'other' | 'prefer_not_to_say' | '';
  heightCm: number;
  height?: number;
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced' | '';
  bodyFatPercent?: number;
  currentWeightKg: number;
  currentWeight?: number;
  goalWeightKg: number;
  goalWeight?: number;
  dailyActivity: 'sedentary' | 'light' | 'moderate' | 'active' | 'athlete' | '';
  activity?: string;
  goalSpeed: 'lose_slow' | 'lose_normal' | 'lose_fast' | 'lose_aggressive' | 'maintain' | 'gain_slow' | 'gain_normal' | 'recomp' | '';
  goal?: 'lose' | 'maintain' | 'gain' | 'recomp' | string;
  bmr?: number;
  tdee?: number;
  targetCalories?: number;
  macroTarget?: MacroTarget;
  goalSpeedOverriddenAt?: number;
  signupComplete?: boolean;
  isDev?: boolean;
  unitSystem: 'metric' | 'imperial';
  pinnedWhy?: string;
  themeMode?: 'dark' | 'light' | 'auto';
  streakFreezesUsed?: string[]; // YYYY-MM-DD dates protected
  waterReminderEnabled?: boolean;
  mealReminderEnabled?: boolean;
  reminderTimes?: {
    breakfast: string;
    lunch: string;
    dinner: string;
    water: string;
  };
  weeklyBudget?: number;
  accountabilityPartner?: string;
  streakOptIn?: boolean;
  waterChallengeJoined?: boolean;
  language?: 'en' | 'es' | 'fr' | 'de';
  referralCode?: string;
  usedReferrals?: string[];
  xp?: number;
  streakDays?: number;
}

export interface MacroTarget {
  calories: number;
  carbsGrams: number;
  fatGrams: number;
  proteinGrams: number;
  carbsPct: number;
  fatPct: number;
  proteinPct: number;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  unlockedAt?: number;
}

export interface UserStats {
  xp?: number;
  level?: number;
  badges?: string[];
  foodStreak?: number;
  workoutStreak?: number;
  currentStreak?: number;
  longestStreak?: number;
  mealsLoggedTotal?: number;
  uniqueFoodsCount?: number;
  weightLossKg?: number;
  consistencyScore?: number;
  averageDailyCalories?: number;
}

export interface PlanDayMeal {
  mealType: MealType;
  name: string;
  ingredients: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  prepTime: string;
  aisle: 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen';
  costEstimate?: number;
  servings?: number;
  logged?: boolean;
}

export interface PlanDayWorkout {
  name: string;
  isRest: boolean;
  exercises: Array<{
    name: string;
    setsAndReps: string;
  }>;
  logged?: boolean;
}

export interface PlanDay {
  dayIndex: number; // 0 to 6 (Monday to Sunday)
  dayName: string;
  meals: PlanDayMeal[];
  workout?: PlanDayWorkout;
}

export interface WeekPlan {
  userId?: string;
  weekStartDate?: string;
  targetCalories?: number;
  macroTarget?: MacroTarget;
  weeklyStrategy?: string;
  createdAt?: number;
  generatedAt: number;
  type?: 'meals' | 'workouts' | 'both';
  days: PlanDay[];
  preferences?: {
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

export interface UserSession {
  userId: string;
  email?: string;
  isGuest: boolean;
  token: string;
}

export interface CommunityPost {
  id: string;
  userId: string;
  username: string;
  text?: string;
  content?: string;
  imageUrl?: string;
  createdAt: number;
  likeCount?: number;
  likesCount?: number;
  replyCount?: number;
  likedByMe?: boolean;
  isFollowingAuthor?: boolean;
}

export interface CommunityReply {
  id: string;
  postId: string;
  userId: string;
  username: string;
  text?: string;
  content?: string;
  createdAt: number;
}

export interface ReportedPostRecord {
  id: string;
  postId: string;
  reportedByUserId: string;
  reportedByUsername?: string;
  reason?: string;
  createdAt: number;
  post?: CommunityPost;
}

