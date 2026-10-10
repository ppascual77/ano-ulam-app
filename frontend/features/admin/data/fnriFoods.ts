// FNRI (DOST-FNRI Philippine Food Composition Tables) values for the
// ingredients USDA couldn't ground well: hand-copied from PhilFCT (its site is
// login-only with copying disabled, so there's no API to ground against) and
// matched to our ingredients by hand. Applied from Manage Ingredients > FNRI.
//
// GENERATED from docs/fnri/fnri-import.csv (source of truth, with
// docs/fnri/fnri-grounding-starter.csv holding the full working notes). To
// add or fix a row, edit the CSV and regenerate this file; don't hand-edit.
//
// All values per 100 g edible portion (E.P.). null = PhilFCT doesn't report
// that nutrient for the food ("-" on its page), never zero. FNRI has no
// public food IDs, so the PhilFCT food name is the citation (null when it
// wasn't copied: the ingredient sheet then cites the tables generally).

export type FnriFood = {
  /** Exact canonical_name of the ingredient this applies to. */
  ingredient: string;
  fnriName: string | null;
  calories: number;
  protein: number | null;
  carbohydrates: number | null;
  fat: number | null;
  fiber: number | null;
  /** grams */
  sugar: number | null;
  /** milligrams */
  sodium: number | null;
};

export const FNRI_FOODS: FnriFood[] = [
  { ingredient: "Atis, raw", fnriName: null, calories: 104, protein: 1.3, carbohydrates: 23.7, fat: 0.4, fiber: 4.3, sugar: 17.7, sodium: 4 },
  { ingredient: "Banana, lakatan, raw", fnriName: "Banana, lacatan", calories: 126, protein: 1.4, carbohydrates: 29.6, fat: 0.2, fiber: 3.3, sugar: 15.6, sodium: 2 },
  { ingredient: "Banana, saba, raw", fnriName: null, calories: 110, protein: 1.1, carbohydrates: 25.5, fat: 0.4, fiber: 2.9, sugar: 13.6, sodium: 2 },
  { ingredient: "Calamansi, raw", fnriName: null, calories: 44, protein: 0.4, carbohydrates: 8.3, fat: 1.0, fiber: 2.4, sugar: 1.5, sodium: 3 },
  { ingredient: "Chico, raw", fnriName: null, calories: 108, protein: 0.5, carbohydrates: 24.5, fat: 0.9, fiber: 6.3, sugar: 16.3, sodium: 5 },
  { ingredient: "Dalandan, raw", fnriName: null, calories: 35, protein: 0.4, carbohydrates: 7.8, fat: 0.2, fiber: 1.6, sugar: 6.1, sodium: 3 },
  { ingredient: "Guyabano, raw", fnriName: null, calories: 70, protein: 1.1, carbohydrates: 16.2, fat: 0.1, fiber: 3.2, sugar: 12.9, sodium: 4 },
  { ingredient: "Lanzones, raw", fnriName: null, calories: 64, protein: 1.0, carbohydrates: 14.2, fat: 0.3, fiber: 2.7, sugar: null, sodium: 1 },
  { ingredient: "Mango, green, raw", fnriName: "Mango, paho, unripe", calories: 74, protein: 0.7, carbohydrates: 16.4, fat: 0.6, fiber: 1.8, sugar: 6.5, sodium: 7 },
  { ingredient: "Mango, ripe, raw", fnriName: null, calories: 70, protein: 0.6, carbohydrates: 16.4, fat: 0.2, fiber: 1.7, sugar: 13.8, sodium: 4 },
  { ingredient: "Pomelo, raw", fnriName: "Pomelo", calories: 51, protein: 0.7, carbohydrates: 10.6, fat: 0.6, fiber: 1.1, sugar: 8.5, sodium: 2 },
  { ingredient: "Rambutan, raw", fnriName: "Rambutan", calories: 87, protein: 1.2, carbohydrates: 18.6, fat: 0.9, fiber: 0.9, sugar: null, sodium: 18 },
  { ingredient: "Santol, raw", fnriName: "Santol", calories: 67, protein: 0.7, carbohydrates: 13.8, fat: 1.0, fiber: 0.2, sugar: 13.0, sodium: 3 },
  { ingredient: "Star apple, raw", fnriName: "Star apple, purple", calories: 80, protein: 1.3, carbohydrates: 17.4, fat: 0.6, fiber: 3.0, sugar: 11.2, sodium: 9 },
  { ingredient: "Tamarind, raw", fnriName: "Tamarind, unripe", calories: 77, protein: 0.9, carbohydrates: 17.7, fat: 0.3, fiber: null, sugar: null, sodium: 3 },
  { ingredient: "Bitter gourd, raw", fnriName: "Bitter melon/gourd fruit", calories: 23, protein: 1.0, carbohydrates: 4.2, fat: 0.2, fiber: 1.3, sugar: 0.8, sodium: 15 },
  { ingredient: "Bottle gourd, raw", fnriName: "Bottle gourd fruit", calories: 20, protein: 0.4, carbohydrates: 4.3, fat: 0.1, fiber: 0.7, sugar: 2.8, sodium: 5 },
  { ingredient: "Green papaya, raw", fnriName: "Papaya fruit, unripe", calories: 27, protein: 1.0, carbohydrates: 5.5, fat: 0.1, fiber: 0.7, sugar: 3.0, sodium: 4 },
  { ingredient: "Luffa, raw", fnriName: null, calories: 21, protein: 0.7, carbohydrates: 4.3, fat: 0.1, fiber: 0.4, sugar: 3.0, sodium: 8 },
  { ingredient: "Squash blossom, raw", fnriName: "Squash flower", calories: 33, protein: 1.9, carbohydrates: 5.2, fat: 0.5, fiber: null, sugar: 2.8, sodium: 5 },
  { ingredient: "Squash, raw", fnriName: "Squash fruit", calories: 68, protein: 1.2, carbohydrates: 15.3, fat: 0.2, fiber: 1.6, sugar: 5.1, sodium: 8 },
  { ingredient: "String beans, raw", fnriName: "String/Yard long bean pod, green", calories: 38, protein: 2.7, carbohydrates: 6.2, fat: 0.3, fiber: 3.7, sugar: null, sodium: 5 },
  { ingredient: "Winged bean, raw", fnriName: "Winged bean pod", calories: 31, protein: 2.0, carbohydrates: 5.1, fat: 0.3, fiber: 3.1, sugar: 2.1, sodium: 8 },
  { ingredient: "Moringa leaves, raw", fnriName: "Horseradish tree lvs", calories: 108, protein: 9.7, carbohydrates: 12.7, fat: 2.0, fiber: 6.7, sugar: 4.0, sodium: 17 },
  { ingredient: "Sweet potato tops, raw", fnriName: "Sweet potato lvs", calories: 49, protein: 3.9, carbohydrates: 7.2, fat: 0.5, fiber: 5.0, sugar: 1.3, sodium: 9 },
  { ingredient: "Purple yam, raw", fnriName: "Yam, purple", calories: 97, protein: 1.7, carbohydrates: 22.2, fat: 0.2, fiber: 3.4, sugar: 0.4, sodium: 7 },
  { ingredient: "Lemongrass, raw", fnriName: "Lemon grass lvs", calories: 111, protein: 1.4, carbohydrates: 23.1, fat: 1.4, fiber: 3.3, sugar: null, sodium: 10 },
  { ingredient: "Turmeric, raw", fnriName: "Turmeric", calories: 71, protein: 2.0, carbohydrates: 9.6, fat: 2.7, fiber: 4.1, sugar: 0.6, sodium: 61 },
  { ingredient: "Anchovy, fresh, raw", fnriName: "Anchovy, long-jawed, whole", calories: 69, protein: 14.1, carbohydrates: 0.0, fat: 1.4, fiber: 0.0, sugar: 0.0, sodium: 120 },
  { ingredient: "Anchovy, dried", fnriName: "Anchovy, long-jawed, dried", calories: 318, protein: 69.0, carbohydrates: 0.0, fat: 4.7, fiber: 0.0, sugar: 0.0, sodium: null },
  { ingredient: "Milkfish, dried", fnriName: "Milkfish, dried", calories: 415, protein: 51.2, carbohydrates: 0.0, fat: 23.3, fiber: 0.0, sugar: 0.0, sodium: 8616 },
  { ingredient: "Mudfish, raw", fnriName: "Mudfish/Murrel, striated", calories: 99, protein: 21.2, carbohydrates: 0.0, fat: 1.6, fiber: 0.0, sugar: 0.0, sodium: 88 },
  { ingredient: "Round scad, raw", fnriName: "Scad, round", calories: 100, protein: 20.4, carbohydrates: 0.0, fat: 2.1, fiber: 0.0, sugar: 0.0, sodium: 88 },
  { ingredient: "Sardines, fresh, raw", fnriName: "Sardine, Indian", calories: 120, protein: 19.5, carbohydrates: 0.0, fat: 4.7, fiber: 0.0, sugar: 0.0, sodium: 68 },
  { ingredient: "Smoked fish, whole", fnriName: "Milkfish, smoked", calories: 212, protein: 27.2, carbohydrates: 0.0, fat: 11.5, fiber: 0.0, sugar: 0.0, sodium: 1446 },
  { ingredient: "Shrimp, dried", fnriName: "Shrimp, small marine, dried", calories: 263, protein: 57.4, carbohydrates: 3.4, fat: 2.2, fiber: 0.0, sugar: 0.0, sodium: 2774 },
  { ingredient: "Squid, dried", fnriName: "Squid, dried", calories: 289, protein: 62.3, carbohydrates: 0.0, fat: 4.4, fiber: 0.0, sugar: 0.0, sodium: 864 },
  { ingredient: "Pork longganisa", fnriName: "Sausage, pork", calories: 315, protein: 11.8, carbohydrates: 15.8, fat: 22.7, fiber: 0.9, sugar: null, sodium: 714 },
  { ingredient: "Longganisa, native", fnriName: "Sausage, chorizo", calories: 440, protein: 29.6, carbohydrates: 5.8, fat: 33.2, fiber: 0.0, sugar: 0.0, sodium: 1345 },
  { ingredient: "Pork tocino", fnriName: "Pork, sweet cured", calories: 206, protein: 11.2, carbohydrates: 25.9, fat: 6.4, fiber: 0.0, sugar: 20.2, sodium: 1037 },
  { ingredient: "Pork tapa", fnriName: "Pork jerky", calories: 277, protein: 15.8, carbohydrates: 10.2, fat: 19.2, fiber: 0.0, sugar: null, sodium: 1086 },
  { ingredient: "Beef tapa", fnriName: "Beef jerky", calories: 102, protein: 13.8, carbohydrates: 3.7, fat: 3.6, fiber: 0.0, sugar: 1.2, sodium: 694 },
  { ingredient: "Beef tocino", fnriName: "Beef, sweet cured", calories: 80, protein: 18.1, carbohydrates: 0.0, fat: 0.8, fiber: 0.0, sugar: null, sodium: 715 },
  { ingredient: "Chicharon", fnriName: "Pork crackling, skin", calories: 591, protein: 65.6, carbohydrates: 0.0, fat: 36.5, fiber: 0.0, sugar: 0.0, sodium: 472 },
  { ingredient: "Pork blood, raw", fnriName: "Pork blood", calories: 55, protein: 11.6, carbohydrates: 2.1, fat: 0.0, fiber: 0.0, sugar: 0.9, sodium: null },
  { ingredient: "Fermented fish paste", fnriName: "Fish paste, anchovy", calories: 133, protein: 10.0, carbohydrates: 17.5, fat: 2.5, fiber: 0.0, sugar: 1.1, sodium: 4014 },
  { ingredient: "Shrimp paste, raw", fnriName: "Shrimp paste, alamang", calories: 61, protein: 12.4, carbohydrates: 0.6, fat: 1.0, fiber: 1.3, sugar: 0.0, sodium: 4396 },
  { ingredient: "Vinegar, coconut", fnriName: "Vinegar, coconut", calories: 7, protein: 0.0, carbohydrates: 1.4, fat: 0.1, fiber: 0.0, sugar: 0.0, sodium: 1 },
  { ingredient: "Taba ng talangka", fnriName: "Crab, blue swimming, fat", calories: 86, protein: 11.5, carbohydrates: 0.0, fat: 4.4, fiber: 0.0, sugar: 0.0, sodium: 644 },
  { ingredient: "Salted black beans", fnriName: "Soybean seed, black, fermented", calories: 143, protein: 12.0, carbohydrates: 7.6, fat: 7.2, fiber: 0.0, sugar: 2.4, sodium: 3842 },
  { ingredient: "Pinipig", fnriName: "Rice, glutinous, parboiled, flattened", calories: 340, protein: 4.3, carbohydrates: 78.5, fat: 1.0, fiber: 1.7, sugar: 0.3, sodium: 7 },
  { ingredient: "Corn grits, raw", fnriName: "Corn grits, yellow", calories: 350, protein: 7.7, carbohydrates: 78.1, fat: 0.8, fiber: 1.6, sugar: 0.6, sodium: null },
  { ingredient: "Mung beans, dried", fnriName: "Mung bean seed, green, dried", calories: 348, protein: 23.2, carbohydrates: 60.1, fat: 1.6, fiber: 18.4, sugar: 6.4, sodium: 24 },
  { ingredient: "Kesong puti", fnriName: "Cheese, native", calories: 299, protein: 13.2, carbohydrates: 5.3, fat: 25.0, fiber: 0.0, sugar: null, sodium: 865 },
  { ingredient: "Balut, cooked", fnriName: "Egg, duck, fertilized, boiled", calories: 172, protein: 12.8, carbohydrates: 2.2, fat: 12.4, fiber: 0.0, sugar: 0.9, sodium: 141 },
  { ingredient: "Pili nuts", fnriName: "Pili nut", calories: 699, protein: 14.2, carbohydrates: 6.4, fat: 68.5, fiber: null, sugar: null, sodium: 3 },
  { ingredient: "Lumpia wrapper", fnriName: "Spring roll wrapper, plain", calories: 316, protein: 10.6, carbohydrates: 67.2, fat: 0.5, fiber: 2.0, sugar: 0.0, sodium: 140 },
  { ingredient: "Milkfish, raw", fnriName: "Milkfish", calories: 137, protein: 19.8, carbohydrates: 0.0, fat: 6.4, fiber: 0.0, sugar: 0.0, sodium: 67 },
  { ingredient: "Sardines, canned in tomato sauce", fnriName: "Sardines, in tomato sce, cnd", calories: 88, protein: 9.7, carbohydrates: 2.7, fat: 4.3, fiber: 0.4, sugar: 0.3, sodium: 311 },
];
