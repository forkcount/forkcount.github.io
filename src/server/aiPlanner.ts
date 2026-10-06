import { GoogleGenAI, Type } from '@google/genai';
import type { WeekPlan, PlanDay, PlanDayMeal, PlanDayWorkout } from '../types/index.js';

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

export async function generateWeekPlanWithGemini(
  userId: string,
  req: GeneratePlanRequest
): Promise<WeekPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not configured.');
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });

  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const mealsPerDay = req.preferences.mealsPerDay || 3;
  const mealTypes = mealsPerDay === 3 
    ? ['breakfast', 'lunch', 'dinner'] 
    : mealsPerDay === 4 
      ? ['breakfast', 'lunch', 'snack', 'dinner'] 
      : ['breakfast', 'snack', 'lunch', 'snack', 'dinner'];

  const prompt = `
Generate a personalized, production-quality 7-day plan (Monday through Sunday) for ForkCount tracker.
Targets & Constraints:
- Plan type requested: ${req.type}
- Daily Target: ${req.dailyTargetCalories} kcal total.
- Daily Target Macros: ~${req.dailyTargetCarbs}g carbs, ~${req.dailyTargetFat}g fat, ~${req.dailyTargetProtein}g protein.
- CRITICAL: For each day, the sum of meal calories must hit the daily calorie target within 5% (${Math.round(req.dailyTargetCalories * 0.95)} - ${Math.round(req.dailyTargetCalories * 1.05)} kcal).
- Meals per day: ${mealsPerDay} (${mealTypes.join(', ')}).
- Dietary restrictions: ${req.preferences.restrictions.join(', ') || 'None'}.
- Allergies to strictly avoid: ${req.preferences.allergies.join(', ') || 'None'}.
- Disliked ingredients to avoid: ${req.preferences.dislikes || 'None'}.
- Maximum cook time preference: ${req.preferences.cookTime || 'Any'}.
- Budget level: ${req.preferences.budget || 'Moderate'}.
${req.preferences.narrowingText ? `- Specific user narrowing requests & custom preferences: "${req.preferences.narrowingText}". Strictly accommodate this free-text instruction.` : ''}
- Variety rule: NO repeated meal recipes across the entire 7-day week. Every day should have fresh, distinct, appetizing dishes.
- Each meal MUST specify a primary grocery aisle category for shopping: 'produce', 'dairy', 'meat', 'pantry', or 'frozen'.

${req.type === 'meals' ? 'Do NOT generate workouts, focus only on meals.' : ''}
${req.type === 'workouts' || req.type === 'both' ? `
Workout Requirements:
- Workouts per week: ${req.preferences.workoutDaysPerWeek || 3} days active, remaining days MUST be Rest days (isRest: true).
- Equipment available: ${req.preferences.equipment || 'Dumbbells'}.
- Physical injuries or limits: ${req.preferences.injuries || 'None'}.
- List clean exercise names and exact sets/reps (e.g. "3 sets of 10-12 reps" or "30 mins steady pace").
` : ''}

Output strictly valid JSON according to the schema.
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional performance nutritionist and athletic fitness planner. Create structured, appetizing, practical, macro-accurate weekly plans. Never include emojis in names or descriptions. Use precise nutritional numbers.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            days: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  dayIndex: { type: Type.INTEGER },
                  dayName: { type: Type.STRING },
                  meals: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        mealType: { type: Type.STRING },
                        name: { type: Type.STRING },
                        ingredients: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        },
                        calories: { type: Type.NUMBER },
                        protein: { type: Type.NUMBER },
                        carbs: { type: Type.NUMBER },
                        fat: { type: Type.NUMBER },
                        prepTime: { type: Type.STRING },
                        aisle: { type: Type.STRING }
                      },
                      required: ['mealType', 'name', 'ingredients', 'calories', 'protein', 'carbs', 'fat', 'prepTime', 'aisle']
                    }
                  },
                  workout: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      isRest: { type: Type.BOOLEAN },
                      exercises: {
                        type: Type.ARRAY,
                        items: {
                          type: Type.OBJECT,
                          properties: {
                            name: { type: Type.STRING },
                            setsAndReps: { type: Type.STRING }
                          },
                          required: ['name', 'setsAndReps']
                        }
                      }
                    },
                    required: ['name', 'isRest', 'exercises']
                  }
                },
                required: ['dayIndex', 'dayName', 'meals']
              }
            }
          },
          required: ['days']
        }
      }
    });

    const text = response.text || '{}';
    const parsed = JSON.parse(text);

    const days: PlanDay[] = (parsed.days || []).map((d: any, idx: number) => ({
      dayIndex: typeof d.dayIndex === 'number' ? d.dayIndex : idx,
      dayName: d.dayName || dayNames[idx] || `Day ${idx + 1}`,
      meals: (d.meals || []).map((m: any) => ({
        mealType: m.mealType || 'lunch',
        name: m.name || 'Balanced Meal',
        ingredients: Array.isArray(m.ingredients) ? m.ingredients : [],
        calories: Math.round(Number(m.calories) || 400),
        protein: Math.round(Number(m.protein) || 30),
        carbs: Math.round(Number(m.carbs) || 40),
        fat: Math.round(Number(m.fat) || 15),
        prepTime: m.prepTime || '20 min',
        aisle: (['produce', 'dairy', 'meat', 'pantry', 'frozen'].includes(m.aisle) ? m.aisle : 'produce') as any,
        logged: false
      })),
      workout: d.workout ? {
        name: d.workout.name || (d.workout.isRest ? 'Rest & Recovery' : 'Full Body Training'),
        isRest: Boolean(d.workout.isRest),
        exercises: Array.isArray(d.workout.exercises) ? d.workout.exercises : [],
        logged: false
      } : undefined
    }));

    const weekPlan: WeekPlan = {
      userId,
      createdAt: Date.now(),
      generatedAt: Date.now(),
      type: req.type,
      days,
      preferences: req.preferences
    };

    return weekPlan;
  } catch (err: any) {
    console.error('Gemini plan generation error:', err);
    throw new Error(err.message || 'Failed to generate plan with AI');
  }
}
