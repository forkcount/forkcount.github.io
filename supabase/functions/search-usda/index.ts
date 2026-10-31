const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface UsdaFoodItem {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

function extractNutrientValue(nutrients: any[], targetNutrientId: number, fallbackId?: number): number {
  if (!Array.isArray(nutrients)) return 0;
  let found = nutrients.find((n: any) => Number(n?.nutrientId ?? n?.nutrient?.id) === targetNutrientId);
  if (!found && fallbackId !== undefined) {
    found = nutrients.find((n: any) => Number(n?.nutrientId ?? n?.nutrient?.id) === fallbackId);
  }
  const raw = Number(found?.value ?? found?.amount ?? 0);
  return Number.isFinite(raw) ? raw : 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const apiKey = Deno.env.get('USDA_API_KEY');
    if (!apiKey || !apiKey.trim()) {
      return new Response(JSON.stringify({ error: 'missing_api_key', foods: [] }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const query = typeof body?.query === 'string' ? body.query.trim() : '';

    if (!query) {
      return new Response(JSON.stringify({ foods: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
    url.searchParams.set('api_key', apiKey.trim());
    url.searchParams.set('query', query);
    url.searchParams.set('pageSize', '10');

    const usdaResponse = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (usdaResponse.status === 429) {
      return new Response(JSON.stringify({ error: 'rate_limit' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!usdaResponse.ok) {
      return new Response(JSON.stringify({ error: `usda_error_${usdaResponse.status}`, foods: [] }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await usdaResponse.json();
    const rawFoods = Array.isArray(data?.foods) ? data.foods : [];

    const foods: UsdaFoodItem[] = rawFoods.slice(0, 10).map((food: any) => {
      const nutrients = Array.isArray(food?.foodNutrients) ? food.foodNutrients : [];
      const kcal = Math.round(extractNutrientValue(nutrients, 1008, 2047));
      const protein = Math.round(extractNutrientValue(nutrients, 1003) * 10) / 10;
      const carbs = Math.round(extractNutrientValue(nutrients, 1005) * 10) / 10;
      const fat = Math.round(extractNutrientValue(nutrients, 1004) * 10) / 10;
      const baseName = String(food?.description || 'Food').trim();
      const brand = typeof food?.brandName === 'string' && food.brandName.trim() ? food.brandName.trim() : '';
      const name =
        brand && !baseName.toLowerCase().includes(brand.toLowerCase())
          ? `${baseName} (${brand})`
          : baseName;

      return {
        name,
        kcal,
        protein,
        carbs,
        fat,
      };
    });

    return new Response(JSON.stringify({ foods }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: 'internal_error', foods: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
