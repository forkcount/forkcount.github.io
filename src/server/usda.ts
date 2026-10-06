import { getUsdaApiKey, hasUsdaApiKey } from './db.js';
import { safeOutboundFetch } from './ssrfGuard.js';

export interface UsdaFoodResult {
  fdcId: number;
  description: string;
  brandName?: string;
  brandOwner?: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
}

export async function searchUsdaFoods(query: string, storeFilter?: string): Promise<{ available: boolean; error?: string; foods: UsdaFoodResult[] }> {
  if (!hasUsdaApiKey()) {
    return {
      available: false,
      error: "Packaged food search is not available yet.",
      foods: []
    };
  }

  const apiKey = getUsdaApiKey();
  try {
    let fullQuery = query.trim();
    if (storeFilter && storeFilter.trim()) {
      fullQuery = `${fullQuery} ${storeFilter.trim()}`;
    }

    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('api_key', apiKey!);
    url.searchParams.set('query', fullQuery);
    url.searchParams.set('pageSize', '8');
    url.searchParams.set('dataType', 'Branded,Foundation,SR Legacy');

    const res = await safeOutboundFetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'ForkCount-Nutrition-Tracker/1.0'
      }
    });

    if (!res.ok) {
      if (res.status === 403 || res.status === 401) {
        return {
          available: false,
          error: "Invalid or unauthorized USDA API key.",
          foods: []
        };
      }
      return {
        available: true,
        error: `USDA API returned status ${res.status}`,
        foods: []
      };
    }

    const data = await res.json();
    const rawFoods = data.foods || [];

    const results: UsdaFoodResult[] = rawFoods.slice(0, 8).map((f: any) => {
      let calories = 0;
      let protein = 0;
      let fat = 0;
      let carbs = 0;

      const nutrients = f.foodNutrients || [];
      for (const n of nutrients) {
        const id = n.nutrientId || n.nutrientNumber;
        const name = (n.nutrientName || '').toLowerCase();
        const value = Number(n.value) || 0;

        if (name.includes('energy') && (n.unitName === 'KCAL' || !n.unitName || n.unitName === 'kcal')) {
          calories = Math.round(value);
        } else if (id === 1008 || name === 'energy') {
          calories = Math.round(value);
        } else if (name.includes('protein') || id === 1003) {
          protein = Math.round(value * 10) / 10;
        } else if (name.includes('total lipid') || name.includes('fat') || id === 1004) {
          fat = Math.round(value * 10) / 10;
        } else if (name.includes('carbohydrate') || id === 1005) {
          carbs = Math.round(value * 10) / 10;
        }
      }

      return {
        fdcId: f.fdcId,
        description: f.description,
        brandName: f.brandName || f.brandOwner,
        brandOwner: f.brandOwner,
        calories,
        protein,
        fat,
        carbs,
        servingSize: f.servingSize,
        servingSizeUnit: f.servingSizeUnit,
        householdServingFullText: f.householdServingFullText
      };
    });

    return {
      available: true,
      foods: results
    };
  } catch (err: any) {
    return {
      available: true,
      error: err.message || "Failed to search USDA database",
      foods: []
    };
  }
}
