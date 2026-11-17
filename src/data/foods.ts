import { normalizeText } from './util';

// Aliments courants, valeurs moyennes pour 100 g (ordre de grandeur des tables françaises),
// avec une portion habituelle. Tout est dans l'appli : rien n'est cherché sur Internet.

export interface Food {
  name: string;
  /** Pour 100 g. */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  /** Portion habituelle, en g (ou ml). */
  portion: number;
}

type Row = [name: string, kcal: number, protein: number, carbs: number, fat: number, portion: number];

const ROWS: Row[] = [
  // Féculents
  ['Riz blanc cuit', 130, 2.7, 28, 0.3, 150],
  ['Riz complet cuit', 123, 2.7, 25.6, 1, 150],
  ['Pâtes cuites', 150, 5.5, 30, 0.9, 180],
  ['Pâtes complètes cuites', 140, 5.5, 26, 1.3, 180],
  ['Semoule cuite', 112, 3.8, 23, 0.2, 150],
  ['Quinoa cuit', 120, 4.4, 21, 1.9, 150],
  ['Pomme de terre cuite', 80, 2, 17, 0.1, 200],
  ['Patate douce cuite', 86, 1.6, 20, 0.1, 200],
  ['Frites', 300, 3.5, 37, 15, 150],
  ['Pain (baguette)', 270, 9, 55, 1.2, 50],
  ['Pain complet', 240, 9, 45, 3, 50],
  ['Pain de mie', 270, 8.5, 48, 4.5, 30],
  ['Flocons d’avoine', 370, 13, 60, 7, 50],
  ['Céréales du petit-déjeuner', 375, 7, 84, 0.9, 40],
  ['Muesli', 370, 10, 62, 7, 50],
  ['Lentilles cuites', 115, 9, 17, 0.5, 150],
  ['Pois chiches cuits', 140, 8, 19, 2.5, 150],
  ['Haricots rouges cuits', 115, 8.5, 15, 0.5, 150],
  ['Tortilla de blé', 310, 8.5, 50, 8, 60],
  // Viandes, poissons, œufs
  ['Blanc de poulet cuit', 150, 31, 0, 2.5, 150],
  ['Escalope de dinde cuite', 140, 29, 0, 2, 150],
  ['Steak haché 5 % cuit', 150, 26, 0, 5, 125],
  ['Steak haché 15 % cuit', 230, 25, 0, 15, 125],
  ['Bœuf (rumsteck) cuit', 180, 30, 0, 6.5, 150],
  ['Filet de porc cuit', 160, 28, 0, 5, 150],
  ['Jambon blanc', 115, 20, 1, 3.5, 40],
  ['Saumon cuit', 200, 24, 0, 11.5, 130],
  ['Thon au naturel', 115, 26, 0, 1, 100],
  ['Cabillaud cuit', 100, 22, 0, 1, 150],
  ['Crevettes cuites', 100, 22, 0, 1.5, 100],
  ['Sardines à l’huile', 220, 24, 0, 14, 80],
  ['Œuf', 140, 12.5, 0.5, 9.8, 60],
  ['Blanc d’œuf', 48, 10.5, 0.7, 0.2, 35],
  ['Tofu', 130, 13, 2, 8, 100],
  // Produits laitiers
  ['Lait demi-écrémé', 46, 3.3, 4.8, 1.6, 250],
  ['Lait écrémé', 34, 3.4, 5, 0.1, 250],
  ['Yaourt nature', 55, 4.3, 5.5, 1.5, 125],
  ['Skyr', 60, 10.5, 4, 0.2, 150],
  ['Fromage blanc 0 %', 45, 7.5, 4, 0.2, 100],
  ['Fromage blanc 3 %', 75, 7, 3.8, 3.2, 100],
  ['Emmental', 380, 28, 0, 29.5, 30],
  ['Comté', 410, 27, 0, 34, 30],
  ['Camembert', 270, 20, 0, 21, 30],
  ['Mozzarella', 250, 18, 1, 19, 60],
  ['Beurre', 745, 0.7, 0.7, 82, 10],
  ['Crème fraîche', 300, 2.4, 3, 30, 20],
  // Fruits
  ['Banane', 90, 1.1, 20, 0.3, 120],
  ['Pomme', 53, 0.3, 11.6, 0.2, 150],
  ['Orange', 47, 0.9, 9, 0.2, 150],
  ['Fraises', 33, 0.7, 6, 0.3, 150],
  ['Raisin', 70, 0.6, 16, 0.2, 125],
  ['Kiwi', 58, 1, 11, 0.6, 80],
  ['Ananas', 52, 0.5, 11, 0.2, 150],
  ['Mangue', 65, 0.7, 14, 0.3, 150],
  ['Fruits rouges', 45, 1, 8, 0.4, 100],
  ['Dattes', 290, 2.5, 66, 0.4, 30],
  ['Raisins secs', 300, 3, 70, 0.5, 30],
  ['Avocat', 160, 2, 1.8, 15.5, 100],
  // Légumes
  ['Brocoli cuit', 30, 2.5, 3, 0.4, 150],
  ['Haricots verts cuits', 30, 2, 4, 0.2, 150],
  ['Carottes', 37, 0.8, 7, 0.3, 100],
  ['Tomate', 19, 0.9, 3, 0.2, 120],
  ['Salade verte', 15, 1.3, 1.5, 0.2, 50],
  ['Courgette cuite', 20, 1.2, 2.5, 0.3, 150],
  ['Épinards cuits', 25, 3, 1, 0.5, 150],
  ['Champignons', 25, 2.5, 1.5, 0.3, 100],
  ['Poivron', 30, 1, 5, 0.3, 100],
  ['Légumes surgelés (mélange)', 45, 2.5, 6, 0.5, 200],
  ['Soupe de légumes', 35, 1, 5, 1, 250],
  // Matières grasses, fruits à coque
  ['Huile d’olive', 900, 0, 0, 100, 10],
  ['Amandes', 600, 25, 7, 52, 30],
  ['Noix', 700, 15, 7, 65, 30],
  ['Noix de cajou', 590, 20, 26, 46, 30],
  ['Cacahuètes', 610, 26, 10, 50, 30],
  ['Beurre de cacahuète', 610, 25, 14, 50, 20],
  // Sucré
  ['Chocolat noir 70 %', 560, 8, 33, 42, 20],
  ['Chocolat au lait', 545, 7, 57, 31, 20],
  ['Pâte à tartiner', 540, 6, 57, 31, 20],
  ['Miel', 320, 0.3, 80, 0, 15],
  ['Confiture', 270, 0.4, 66, 0.1, 20],
  ['Sucre', 400, 0, 100, 0, 5],
  ['Biscuits secs', 470, 7, 70, 17, 30],
  ['Croissant', 420, 8, 45, 22, 60],
  ['Pain au chocolat', 420, 7.5, 48, 22, 70],
  ['Barre de céréales', 400, 6, 70, 11, 25],
  // Plats
  ['Pizza', 250, 11, 30, 9.5, 200],
  ['Hamburger', 250, 13, 25, 11, 200],
  ['Kebab (sandwich)', 230, 12, 22, 10, 350],
  ['Sushis, makis', 150, 5, 28, 2, 200],
  ['Lasagnes', 150, 8, 13, 7, 300],
  ['Hachis parmentier', 130, 7, 10, 7, 300],
  // Sauces
  ['Ketchup', 110, 1.2, 25, 0.2, 15],
  ['Mayonnaise', 700, 1.2, 1.5, 76, 15],
  ['Vinaigrette', 450, 0.5, 4, 47, 15],
  // Boissons
  ['Jus d’orange', 45, 0.7, 10, 0.1, 200],
  ['Soda', 42, 0, 10.6, 0, 330],
  ['Bière', 43, 0.4, 3.6, 0, 250],
  ['Vin', 85, 0.1, 2.6, 0, 125],
  // Compléments
  ['Protéine en poudre (whey)', 380, 78, 7, 5, 30],
  ['Gainer', 380, 20, 70, 3, 100],
  ['Barre protéinée', 350, 33, 35, 11, 60],
];

export const FOODS: Food[] = ROWS.map(([name, kcal, protein, carbs, fat, portion]) => ({
  name,
  kcal,
  protein,
  carbs,
  fat,
  portion,
}));

/** Aliments dont le nom contient la recherche (sans tenir compte des accents ni des majuscules). */
export function searchFoods(query: string): Food[] {
  // « œ » n'est pas un accent : « oeuf » doit trouver « Œuf ».
  const clean = (text: string) => normalizeText(text).replace(/œ/g, 'oe').replace(/æ/g, 'ae');
  const q = clean(query);
  if (q === '') return FOODS;
  return FOODS.filter((food) => clean(food.name).includes(q));
}

/** Valeurs pour une quantité donnée (g), arrondies. */
export function foodFor(food: Food, grams: number) {
  const k = grams / 100;
  return {
    kcal: Math.round(food.kcal * k),
    protein: Math.round(food.protein * k * 10) / 10,
    carbs: Math.round(food.carbs * k * 10) / 10,
    fat: Math.round(food.fat * k * 10) / 10,
  };
}
