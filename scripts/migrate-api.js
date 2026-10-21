const fs = require('fs');

let code = fs.readFileSync('src/services/api.ts', 'utf8');

// 1. Replace OperationType and handleFirestoreError with handleDatabaseError
code = code.replace(/handleFirestoreError\(/g, 'handleDatabaseError(');
code = code.replace(/function handleFirestoreError\(/g, 'function handleDatabaseError(');
code = code.replace(/initFirestoreSync\(/g, 'initRealtimeSync(');
code = code.replace(/initFirestoreSync/g, 'initRealtimeSync');
code = code.replace(/Firestore offline\/fallback/g, 'Supabase offline/fallback');
code = code.replace(/Firestore getDiary fallback/g, 'Supabase getDiary fallback');
code = code.replace(/Firestore query fallback for login/g, 'Supabase query fallback for login');
code = code.replace(/Firestore onSnapshot sync notice/g, 'Supabase sync notice');

// 2. Add table mapper and helper functions after cleanUndefinedForSupabase
const helpers = `
function mapTable(colName: string): string {
  const map: Record<string, string> = {
    users: 'profiles',
    diaryEntries: 'diary_entries',
    waterEntries: 'water_entries',
    exerciseEntries: 'exercise_entries',
    weightEntries: 'weight_entries',
    plans: 'plans',
    communityPosts: 'community_posts',
    communityReplies: 'community_replies',
    habits: 'habits',
    cravings: 'cravings',
    victories: 'victories',
    pantry: 'pantry',
    savedFoods: 'saved_foods',
    savedMeals: 'saved_meals',
    savedRecipes: 'saved_recipes',
    mealTemplates: 'meal_templates',
    reports: 'reports',
    securityEvents: 'security_events'
  };
  return map[colName] || colName;
}

async function supabaseUpsert(table: string, id: string, data: any) {
  const target = mapTable(table);
  const row = cleanUndefinedForSupabase({ id, ...data });
  try {
    const { error } = await supabase.from(target).upsert(row);
    if (error) {
      console.warn('Supabase upsert error on ' + target + ':', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase upsert exception on ' + target + ':', err?.message || err);
  }
}

async function supabaseFetchDoc(table: string, id: string): Promise<any | null> {
  const target = mapTable(table);
  try {
    const { data, error } = await supabase.from(target).select('*').eq('id', id).maybeSingle();
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

async function supabaseDelete(table: string, id: string): Promise<void> {
  const target = mapTable(table);
  try {
    const { error } = await supabase.from(target).delete().eq('id', id);
    if (error) {
      console.warn('Supabase delete error on ' + target + ':', error.message);
    }
  } catch (err: any) {
    console.warn('Supabase delete exception on ' + target + ':', err?.message || err);
  }
}

async function supabaseSelectAll(table: string, filterField?: string, filterVal?: any): Promise<any[]> {
  const target = mapTable(table);
  try {
    let q = supabase.from(target).select('*');
    if (filterField && filterVal !== undefined) {
      q = q.eq(filterField, filterVal);
    }
    const { data, error } = await q;
    if (error || !data) return [];
    return data;
  } catch {
    return [];
  }
}
`;

// Insert helpers after safeUpsert
code = code.replace(/async function safeUpsert\(table: string, data: any\) \{[\s\S]*?\n\}/, (match) => {
  return match + '\n' + helpers;
});

// Check if replacement worked
console.log('Helpers inserted:', code.includes('supabaseUpsert'));
