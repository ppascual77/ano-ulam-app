// Catalog names are precise ("Onion, red, raw", "Rice, white, cooked"); the
// pantry shows how people say them ("Red onion", "White rice"). Display
// only: the catalog name stays the ingredient's identity.

// Preparation words that don't help someone recognize what they have.
const DROP = /^(raw|cooked|whole|fresh|dried|iodized|refined|cane|palm|fully dressed|boneless|skinless|local|imported)$/i;
// A colour or kind after the comma reads better in front ("red onion").
const FRONT = /^(red|white|brown|green|black|yellow|purple|sweet)$/i;

export function pantryName(catalogName: string): string {
  const parts = catalogName.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return catalogName;
  // "Kangkong (water spinach)" -> "Kangkong".
  let name = parts[0].replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const rest = parts.slice(1).filter((p) => !DROP.test(p));
  if (rest[0] && FRONT.test(rest[0])) name = `${rest[0]} ${name.toLowerCase()}`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Lowercase, for inside a sentence ("Buy kangkong and …"). */
export const pantryNameLower = (catalogName: string) => pantryName(catalogName).toLowerCase();
