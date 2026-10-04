// MOCK — grocery checkbox state, under the spec'd function names so a real
// table later is a swap of these bodies. In memory, resets on reload.

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Grocery checkboxes, by item id, holding the quantity the item had when it
// was checked: if the quantity changes later (e.g. a servings update), the
// item reads as unchecked so the user knows to restock.
let groceryChecks: Record<string, string> = {};

export async function getGroceryChecks(): Promise<Record<string, string>> {
  await delay(200);
  return { ...groceryChecks };
}

// One batch of changes: item id -> its quantity (checked) or null (unchecked).
export async function flushGroceryChecks(changes: Record<string, string | null>): Promise<void> {
  await delay(300);
  const next = { ...groceryChecks };
  for (const [id, qty] of Object.entries(changes)) {
    if (qty === null) delete next[id];
    else next[id] = qty;
  }
  groceryChecks = next;
}
