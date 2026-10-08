export interface BarcodeProduct {
  barcode: string;
  name: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number;
  sugarPer100g: number;
  sodiumMgPer100g: number;
  servingGrams: number;
  servingLabel: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  brand?: string;
}

export async function lookupBarcodeProduct(barcode: string): Promise<BarcodeProduct | null> {
  const clean = barcode.trim().replace(/[^0-9]/g, '');
  if (!clean || clean.length < 6) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 7000);
    const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${clean}.json`, {
      signal: controller.signal
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;

    const p = data.product;
    const rawName = p.product_name || p.product_name_en || p.generic_name || (p.brands ? `${p.brands} Product` : '');
    const name = String(rawName || '').trim();
    if (!name || name.toLowerCase() === 'upc' || name.toLowerCase() === 'barcode') return null;

    const n = p.nutriments || {};
    let cal100 = n['energy-kcal_100g'] ?? n['energy-kcal'] ?? n['energy-kcal_value'];
    if (cal100 === undefined && n['energy_100g']) {
      cal100 = Math.round(Number(n['energy_100g']) / 4.184);
    }
    const caloriesPer100g = typeof cal100 === 'number' ? cal100 : parseFloat(cal100) || 0;
    const proteinPer100g = Math.round((parseFloat(n['proteins_100g'] ?? n['proteins'] ?? 0) || 0) * 10) / 10;
    const carbsPer100g = Math.round((parseFloat(n['carbohydrates_100g'] ?? n['carbohydrates'] ?? 0) || 0) * 10) / 10;
    const fatPer100g = Math.round((parseFloat(n['fat_100g'] ?? n['fat'] ?? 0) || 0) * 10) / 10;
    const fiberPer100g = Math.round((parseFloat(n['fiber_100g'] ?? n['fiber'] ?? 0) || 0) * 10) / 10;
    const sugarPer100g = Math.round((parseFloat(n['sugars_100g'] ?? n['sugars'] ?? 0) || 0) * 10) / 10;
    const sodiumMgPer100g = Math.round(((parseFloat(n['sodium_100g'] ?? (n['salt_100g'] ? n['salt_100g'] / 2.5 : 0)) || 0) * 1000));

    // Never log 0 calories as a real item: If food has no data (all zeros), return null
    if (caloriesPer100g <= 0 && proteinPer100g <= 0 && carbsPer100g <= 0 && fatPer100g <= 0) {
      return null;
    }

    let servingGrams = 100;
    if (p.serving_quantity) {
      servingGrams = parseFloat(p.serving_quantity) || 100;
    } else if (p.serving_size) {
      const match = String(p.serving_size).match(/(\d+(?:[.,]\d+)?)\s*(?:g|ml)/i);
      if (match) servingGrams = parseFloat(match[1].replace(',', '.')) || 100;
    }

    const factor = servingGrams / 100;
    const totalCalories = Math.round(caloriesPer100g * factor);
    const totalProtein = Math.round(proteinPer100g * factor * 10) / 10;
    const totalCarbs = Math.round(carbsPer100g * factor * 10) / 10;
    const totalFat = Math.round(fatPer100g * factor * 10) / 10;

    return {
      barcode: clean,
      name,
      brand: p.brands,
      caloriesPer100g,
      proteinPer100g,
      carbsPer100g,
      fatPer100g,
      fiberPer100g,
      sugarPer100g,
      sodiumMgPer100g,
      servingGrams,
      servingLabel: p.serving_size ? String(p.serving_size) : `${servingGrams}g`,
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat
    };
  } catch {
    return null;
  }
}
