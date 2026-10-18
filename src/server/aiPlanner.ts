import { GoogleGenAI, Type } from '@google/genai';
import type { WeekPlan, PlanDay, PlanDayMeal, PlanDayWorkout } from '../types/index.js';
import { getProfile } from './db.js';

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

  // Load user profile to check dietary preferences
  const profile = (getProfile(userId) || {}) as any;
  const profileRestrictions = profile.restrictions || [];
  const dietField = profile.diet || profile.dietaryPreference || profile.dietary_preference || profile.eatingStyle || '';
  const isVeg = profile.vegetarian || profile.isVegetarian || false;

  const combinedRestrictionsSet = new Set<string>();
  if (Array.isArray(req.preferences?.restrictions)) {
    req.preferences.restrictions.forEach(r => combinedRestrictionsSet.add(r));
  }
  if (Array.isArray(profileRestrictions)) {
    profileRestrictions.forEach(r => combinedRestrictionsSet.add(r));
  }
  if (dietField) {
    combinedRestrictionsSet.add(dietField);
  }
  if (isVeg) {
    combinedRestrictionsSet.add('Vegetarian');
  }

  const restrictionsList = Array.from(combinedRestrictionsSet);
  const lowerRestrictions = restrictionsList.map(r => r.toLowerCase());

  let dietConstraintDescription = "No dietary restriction (standard balanced diet)";
  let systemDietConstraint = "";

  if (lowerRestrictions.some(r => r.includes('vegan'))) {
    dietConstraintDescription = "STRICTLY VEGAN: Zero animal products. No meat, poultry, fish, seafood, eggs, dairy, honey, gelatin, or animal-derived ingredients.";
    systemDietConstraint = "The user is vegan. Do NOT include any animal products whatsoever (no meat, poultry, fish, seafood, eggs, dairy, honey, or gelatin). Every meal must be 100% plant-based/vegan.";
  } else if (lowerRestrictions.some(r => r.includes('vegetarian'))) {
    dietConstraintDescription = "STRICTLY VEGETARIAN: No meat, poultry, fish, shellfish, turkey, lamb, duck, bacon, ham, sausage, gelatin, or seafood of any kind. Eggs and dairy are acceptable.";
    systemDietConstraint = "The user is vegetarian. Do NOT include any meat, poultry, fish, shellfish, or seafood in any meal. Eggs and dairy are acceptable. Every meal must be vegetarian.";
  } else if (lowerRestrictions.some(r => r.includes('pescatarian'))) {
    dietConstraintDescription = "PESCATARIAN: No meat or poultry (no chicken, beef, pork, turkey, lamb). Fish and seafood are allowed. Eggs and dairy are allowed.";
    systemDietConstraint = "The user is pescatarian. Do NOT include any meat or poultry (no chicken, beef, pork, turkey, lamb). Fish and seafood, eggs, and dairy are acceptable.";
  } else if (lowerRestrictions.some(r => r.includes('halal'))) {
    dietConstraintDescription = "HALAL: No pork, no alcohol, no non-Halal meat.";
    systemDietConstraint = "The user follows a Halal diet. Do NOT include any pork, alcohol, or non-Halal meat.";
  } else if (lowerRestrictions.some(r => r.includes('kosher'))) {
    dietConstraintDescription = "KOSHER: No pork, no shellfish, no mixing meat and dairy.";
    systemDietConstraint = "The user follows a Kosher diet. Do NOT include pork or shellfish, and never mix meat and dairy.";
  }

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
- DIETARY PREFERENCE / RESTRICTIONS: ${dietConstraintDescription} (${restrictionsList.join(', ') || 'None specified'}).
- Allergies to strictly avoid: ${req.preferences.allergies.join(', ') || 'None'}.
- Disliked ingredients to avoid: ${req.preferences.dislikes || 'None'}.
- Maximum cook time preference: ${req.preferences.cookTime || 'Any'}.
- Budget level: ${req.preferences.budget || 'Moderate'}.
${req.preferences.narrowingText ? `- Specific user narrowing requests & custom preferences: "${req.preferences.narrowingText}". Strictly accommodate this free-text instruction.` : ''}
- Variety rule: NO repeated meal recipes across the entire 7-day week. Every day should have fresh, distinct, appetizing dishes.
- Each meal MUST specify:
  1. Detailed ingredients with exact quantities.
  2. Step-by-step cooking instructions (3 to 6 numbered steps, written clearly for a beginner).
  3. Prep time, cook time, and total time.
  4. Primary grocery aisle category ('produce', 'dairy', 'meat', 'pantry', or 'frozen').

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
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: `You are a professional performance nutritionist and athletic fitness planner. Create structured, appetizing, practical, macro-accurate weekly plans with clear step-by-step recipe instructions. ${systemDietConstraint} Never include emojis in names or descriptions. Use precise nutritional numbers.`,
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
                        instructions: {
                          type: Type.ARRAY,
                          items: { type: Type.STRING }
                        },
                        calories: { type: Type.NUMBER },
                        protein: { type: Type.NUMBER },
                        carbs: { type: Type.NUMBER },
                        fat: { type: Type.NUMBER },
                        prepTime: { type: Type.STRING },
                        cookTime: { type: Type.STRING },
                        totalTime: { type: Type.STRING },
                        aisle: { type: Type.STRING }
                      },
                      required: ['mealType', 'name', 'ingredients', 'instructions', 'calories', 'protein', 'carbs', 'fat', 'prepTime', 'cookTime', 'totalTime', 'aisle']
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

    // Post-generation safety net filter for dietary restrictions
    const isVegetarian = lowerRestrictions.some(r => r.includes('vegetarian'));
    const isVegan = lowerRestrictions.some(r => r.includes('vegan'));
    const isPescatarian = lowerRestrictions.some(r => r.includes('pescatarian'));

    const forbiddenMeatRegex = /\b(chicken|beef|pork|turkey|lamb|duck|bacon|ham|sausage|gelatin|steak|mince|veal|venison|bison)\b/i;
    const forbiddenFishRegex = /\b(fish|salmon|tuna|cod|shrimp|prawns|halibut|tilapia|trout|crab|lobster|shellfish|seafood)\b/i;
    const forbiddenAnimalRegex = /\b(chicken|beef|pork|turkey|lamb|duck|bacon|ham|sausage|gelatin|steak|mince|veal|venison|bison|fish|salmon|tuna|cod|shrimp|prawns|halibut|tilapia|trout|crab|lobster|shellfish|seafood|milk|cheese|yogurt|butter|eggs|honey|whey|casein|cream|ghee)\b/i;

    const defaultInstructions = [
      'Prepare and measure all ingredients according to the quantities listed.',
      'Heat a pan or pot over medium heat with a drizzle of olive oil or cooking spray.',
      'Combine and cook ingredients, stirring occasionally until tender and fully heated through.',
      'Season with salt, pepper, and your favorite herbs to taste.',
      'Plate, serve warm, and enjoy your meal!'
    ];

    const days: PlanDay[] = (parsed.days || []).map((d: any, idx: number) => ({
      dayIndex: typeof d.dayIndex === 'number' ? d.dayIndex : idx,
      dayName: d.dayName || dayNames[idx] || `Day ${idx + 1}`,
      meals: (d.meals || []).map((m: any) => {
        let mealName = m.name || 'Balanced Meal';
        let ingredients: string[] = Array.isArray(m.ingredients) ? m.ingredients : [];
        let instructions: string[] = Array.isArray(m.instructions) && m.instructions.length > 0 ? m.instructions : defaultInstructions;
        let calories = Math.round(Number(m.calories) || 400);
        let protein = Math.round(Number(m.protein) || 30);
        let carbs = Math.round(Number(m.carbs) || 40);
        let fat = Math.round(Number(m.fat) || 15);
        let prepTime = m.prepTime || '10 min';
        let cookTime = m.cookTime || '15 min';
        let totalTime = m.totalTime || '25 min';

        const checkText = `${mealName} ${ingredients.join(' ')}`;

        let hasViolation = false;
        if (isVegan) {
          hasViolation = forbiddenAnimalRegex.test(checkText);
        } else if (isVegetarian) {
          hasViolation = forbiddenMeatRegex.test(checkText) || forbiddenFishRegex.test(checkText);
        } else if (isPescatarian) {
          hasViolation = forbiddenMeatRegex.test(checkText);
        }

        if (hasViolation) {
          if (isVegan) {
            mealName = 'Plant-Based Tofu Quinoa Buddha Bowl';
            ingredients = ['200g firm tofu', '150g cooked quinoa', '100g roasted chickpeas', '80g spinach', '15ml olive oil'];
            instructions = [
              'Press tofu to remove excess moisture and cube into bite-sized pieces.',
              'Pan-sear tofu cubes in olive oil until golden brown on all sides.',
              'Warm cooked quinoa and arrange in a bowl alongside roasted chickpeas and fresh spinach.',
              'Top with seared tofu and your favorite dressing or lemon juice.'
            ];
          } else if (isVegetarian) {
            mealName = 'Greek Salad with Feta & Roasted Chickpeas';
            ingredients = ['150g chickpeas', '100g feta cheese', '200g cucumber & tomatoes', '10ml olive oil', '50g whole grain pita'];
            instructions = [
              'Drain and rinse chickpeas, tossing with a pinch of salt and olive oil.',
              'Chop cucumbers, tomatoes, and red onion into bite-sized chunks.',
              'Combine vegetables and chickpeas in a large bowl and crumble feta cheese on top.',
              'Drizzle with olive oil and serve with warm whole grain pita.'
            ];
          } else if (isPescatarian) {
            mealName = 'Lemon Herb Baked Salmon with Quinoa';
            ingredients = ['160g salmon fillet', '150g cooked quinoa', '100g steamed broccoli', '10ml olive oil'];
            instructions = [
              'Preheat oven to 200°C (400°F) and line a baking sheet with parchment paper.',
              'Season salmon fillet with olive oil, lemon juice, salt, and herbs, then bake for 12-15 minutes.',
              'Steam broccoli florets until tender-crisp and warm the cooked quinoa.',
              'Plate the baked salmon over quinoa and broccoli with a lemon wedge.'
            ];
          }
        }

        return {
          mealType: m.mealType || 'lunch',
          name: mealName,
          ingredients,
          instructions,
          calories,
          protein,
          carbs,
          fat,
          prepTime,
          cookTime,
          totalTime,
          aisle: (['produce', 'dairy', 'meat', 'pantry', 'frozen'].includes(m.aisle) ? m.aisle : 'produce') as any,
          logged: false
        };
      }),
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
