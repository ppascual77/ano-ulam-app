import {
  cheapestPricePatch,
  isPackEstimate,
  supermarketPriceOptions,
  type IngredientRow,
  type PriceOption,
} from "@/api/ingredients";

// "Add from link": an admin pastes a supermarket product link and it
// becomes one of an ingredient's store listings (price_sources), the same
// shape Ground Prices saves. SM Markets only for now: its storefront
// (Magento) answers a public product query, so no scraping and no secret
// key, which is why this runs on the device instead of an edge function.

export type StoreListing = {
  store: string;
  productTitle: string;
  packPrice: number;
  packSize: number;
  packUnit: "g" | "kg" | "ml" | "L";
  url: string;
  pricePerUnit: number;
  unit: "kg" | "L";
};

export type FetchedListing = StoreListing & {
  inStock: boolean;
  /** The undiscounted price, when the listing is on sale. */
  regularPrice: number | null;
};

const SM_HOST = "smmarkets.ph";

/** What the admin types in when a link can't be read automatically (any
 *  store but SM, or an SM product with no size in its name). */
export type ManualListingInput = {
  /** May be empty: a price with no product page (e.g. a market stall). */
  url: string;
  store: string;
  productTitle: string;
  packPrice: number;
  packSize: number;
  packUnit: StoreListing["packUnit"];
};

/** Thrown when a link needs the manual form; `partial` prefills it. */
export class ListingNeedsInput extends Error {
  constructor(
    message: string,
    readonly partial: Partial<ManualListingInput>,
  ) {
    super(message);
  }
}

/** The store name for a link: its domain without "www.". */
export function storeFromUrl(rawUrl: string): string {
  try {
    return new URL(rawUrl.trim()).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const cleanUrl = (url: URL) => `${url.origin}${url.pathname}`;
const SM_GRAPHQL = "https://smmarkets.ph/graphql";

type SmProduct = {
  name: string;
  stock_status: string;
  price_range: { minimum_price: { regular_price: { value: string | number }; final_price: { value: string | number } } };
};

async function smProduct(filter: string): Promise<SmProduct | undefined> {
  const query = `{products(filter:{${filter}}){items{name stock_status price_range{minimum_price{regular_price{value} final_price{value}}}}}}`;
  const res = await fetch(`${SM_GRAPHQL}?query=${encodeURIComponent(query)}`, { headers: { Store: "default" } });
  if (!res.ok) throw new Error(`SM Markets didn't answer (${res.status}).`);
  return (await res.json())?.data?.products?.items?.[0];
}

// "Barilla Pasta Fettuccine | 500g", "Datu Puti Vinegar 1L", "… 385 ml":
// the last size in the name.
function packFromName(name: string): { size: number; unit: StoreListing["packUnit"] } | null {
  const matches = [...name.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/gi)];
  const last = matches.at(-1);
  if (!last) return null;
  const unit = last[2].toLowerCase();
  return { size: Number(last[1]), unit: unit === "l" ? "L" : (unit as "g" | "kg" | "ml") };
}

// Pack size in kg or L. The listing is priced in the ingredient's own unit
// family when it can be (a 1 L bottle of oil priced per kg needs the
// ingredient's grams_per_ml), else the pack's.
function perUnit(
  packPrice: number,
  size: number,
  packUnit: StoreListing["packUnit"],
  ingredient: Pick<IngredientRow, "estimated_price_unit" | "grams_per_ml">,
): { pricePerUnit: number; unit: "kg" | "L" } {
  const isVolume = packUnit === "ml" || packUnit === "L";
  const amount = packUnit === "g" || packUnit === "ml" ? size / 1000 : size;
  const wantsKg = ingredient.estimated_price_unit === "g" || ingredient.estimated_price_unit === "kg";
  const density = ingredient.grams_per_ml;
  if (isVolume && wantsKg && density) return { pricePerUnit: packPrice / (amount * density), unit: "kg" };
  if (!isVolume && !wantsKg && density) return { pricePerUnit: packPrice / (amount / density), unit: "L" };
  return { pricePerUnit: packPrice / amount, unit: isVolume ? "L" : "kg" };
}

/** Reads a product link into a store listing for this ingredient. Throws a
 *  readable message for anything it can't use. */
export async function fetchListingFromUrl(
  rawUrl: string,
  ingredient: Pick<IngredientRow, "estimated_price_unit" | "grams_per_ml">,
): Promise<FetchedListing> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new Error("That doesn't look like a link.");
  }
  if (!url.hostname.endsWith(SM_HOST)) {
    throw new ListingNeedsInput("Only SM Markets prices can be read automatically. Enter this one by hand.", {
      url: cleanUrl(url),
      store: storeFromUrl(rawUrl),
    });
  }
  const slug = url.pathname.split("/").pop()?.replace(/\.html$/, "");
  if (!slug) throw new Error("Couldn't find the product in that link.");
  // SM links come as "20512947-barilla-…", "…-20586191" or "20580933": the
  // SKU is in every one, so look it up by that, else by the whole slug.
  const sku = slug.match(/(?:^|-)(\d{6,})(?:-|$)/)?.[1];
  const product =
    (sku ? await smProduct(`sku:{eq:${JSON.stringify(sku)}}`) : undefined) ??
    (await smProduct(`url_key:{eq:${JSON.stringify(slug)}}`));
  if (!product) throw new Error("SM Markets has no product at that link.");

  const pack = packFromName(product.name);
  const packPrice = Number(product.price_range.minimum_price.final_price.value);
  const regular = Number(product.price_range.minimum_price.regular_price.value);
  if (!pack || !(packPrice > 0)) {
    throw new ListingNeedsInput(
      !pack ? `No pack size in "${product.name}". Enter it by hand.` : "SM Markets shows no price for it. Enter it by hand.",
      { url: cleanUrl(url), store: SM_HOST, productTitle: product.name, ...(packPrice > 0 ? { packPrice } : {}) },
    );
  }

  return {
    store: SM_HOST,
    productTitle: product.name,
    packPrice,
    packSize: pack.size,
    packUnit: pack.unit,
    // Without tracking parameters.
    url: cleanUrl(url),
    ...perUnit(packPrice, pack.size, pack.unit, ingredient),
    inStock: product.stock_status === "IN_STOCK",
    regularPrice: regular > packPrice ? regular : null,
  };
}

/** A listing from the manual form, priced in the ingredient's unit like a
 *  fetched one. */
export function manualListing(
  input: ManualListingInput,
  ingredient: Pick<IngredientRow, "estimated_price_unit" | "grams_per_ml">,
): FetchedListing {
  let url = input.url.trim();
  try {
    if (url) url = cleanUrl(new URL(url));
  } catch {
    // Not a parseable link: kept as typed.
  }
  return {
    store: input.store.trim(),
    productTitle: input.productTitle.trim(),
    packPrice: input.packPrice,
    packSize: input.packSize,
    packUnit: input.packUnit,
    url,
    ...perUnit(input.packPrice, input.packSize, input.packUnit, ingredient),
    inStock: true,
    regularPrice: null,
  };
}

/** The ingredient patch for adding a listing: kept next to its other real
 *  listings (one with the same link is replaced), the AI pack estimate
 *  dropped, and the price re-picked from the cheapest real source
 *  (`daOptions`: its linked DA prices). Never touches anything else. */
export function addListingPatch(
  ingredient: IngredientRow,
  listing: StoreListing,
  daOptions: PriceOption[],
): Partial<IngredientRow> {
  const kept = (Array.isArray(ingredient.price_sources) ? ingredient.price_sources : []).filter(
    // The same link again replaces the old listing; no-link ones (a market
    // stall) never replace each other.
    (s) => !isPackEstimate(s) && !(listing.url && s && typeof s === "object" && "url" in s && s.url === listing.url),
  );
  const priceSources = [...kept, { ...listing }];
  return {
    price_sources: priceSources,
    ...cheapestPricePatch(ingredient, [...supermarketPriceOptions(priceSources), ...daOptions]),
    price_last_updated_at: new Date().toISOString(),
  };
}
