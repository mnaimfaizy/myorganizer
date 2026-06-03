import { randomId, type GroceryList } from '@myorganizer/core';
import { z } from 'zod';

const VALID_CATEGORIES = [
  'produce',
  'dairy',
  'meat',
  'seafood',
  'bakery',
  'frozen',
  'beverages',
  'snacks',
  'condiments',
  'household',
  'personal-care',
  'other',
] as const;

// Helper to validate and coerce category
function normalizeCategory(value: unknown): string {
  if (typeof value === 'string' && VALID_CATEGORIES.includes(value as any)) {
    return value;
  }
  return 'other';
}

// Helper to validate URL
function isValidUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// --- Zod schemas (runtime validation + coercion) ---

const GroceryItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    amount: z.string().optional(),
    price: z.number().optional(),
    category: z.string().optional(),
    checked: z.boolean().optional(),
    notes: z.string().optional(),
    imageUrl: z.string().optional(),
    links: z.array(z.string()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .transform((data): any => {
    // Item must have a non-empty name
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) return null; // Signal to filter out

    const imageUrl = isValidUrl(data.imageUrl) ? data.imageUrl : undefined;

    const links =
      Array.isArray(data.links) && data.links.every(isValidUrl)
        ? data.links
        : undefined;

    return {
      id: data.id || randomId(),
      name,
      amount: data.amount,
      price:
        typeof data.price === 'number' && data.price >= 0
          ? data.price
          : undefined,
      category: normalizeCategory(data.category),
      checked: data.checked === true,
      notes: data.notes,
      imageUrl,
      links,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  })
  .refine((item) => item !== null, {
    message: 'Item must have a non-empty name',
  });

const GroceryListSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    items: z.array(z.any()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .transform((data) => {
    // List must have a non-empty name
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) return null; // Signal to filter out

    // Normalize items individually, dropping invalid ones
    const items: any[] = [];
    if (Array.isArray(data.items)) {
      for (const itemRaw of data.items) {
        const result = GroceryItemSchema.safeParse(itemRaw);
        if (result.success && result.data !== null) {
          items.push(result.data);
        }
      }
    }

    return {
      id: data.id || randomId(),
      name,
      items,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  })
  .refine((list) => list !== null, {
    message: 'List must have a non-empty name',
  });

// --- Normalization function ---

export interface NormalizeGroceriesResult {
  value: GroceryList[];
  changed: boolean; // true if the blob was migrated/repaired and must be re-saved
}

export function normalizeGroceries(raw: unknown): NormalizeGroceriesResult {
  if (!Array.isArray(raw)) {
    // Unrecognized shape — start fresh
    return { value: [], changed: raw != null };
  }

  // Normalize each list, dropping invalid ones
  const normalized: GroceryList[] = [];

  for (const entry of raw) {
    const result = GroceryListSchema.safeParse(entry);
    if (result.success && result.data !== null) {
      normalized.push(result.data as GroceryList);
    }
  }

  // Check if we had to make changes (coercion, defaults, or dropping invalid entries)
  const changed =
    normalized.length !== raw.length ||
    JSON.stringify(normalized) !== JSON.stringify(raw);

  return { value: normalized, changed };
}
