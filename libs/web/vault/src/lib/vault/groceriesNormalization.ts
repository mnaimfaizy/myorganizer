import { randomId } from '@myorganizer/core';
import {
  CATALOG_ITEM_KEYS,
  GROCERIES_PAYLOAD_KEYS,
  GROCERY_LIST_KEYS,
  GROCERY_PREDEFINED_CATEGORIES,
  LIST_LINE_KEYS,
  readVaultBlobRecords,
  withUnknownFields,
  type GroceriesVaultPayload,
  type CatalogItem,
  type ListLine,
  type GroceryList,
  type GroceryItem,
  type GroceryCategoryType,
} from '@myorganizer/vault-core';
import { z } from 'zod';

// Helper to validate and coerce category
function normalizeCategory(value: unknown): GroceryCategoryType {
  if (
    typeof value === 'string' &&
    (GROCERY_PREDEFINED_CATEGORIES as readonly string[]).includes(value)
  ) {
    return value as GroceryCategoryType;
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

// --- Zod schemas for new shape ---

const CatalogItemSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    category: z.string().optional(),
    price: z.number().optional(),
    notes: z.string().optional(),
    imageUrl: z.string().optional(),
    links: z.array(z.string()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .transform((data): CatalogItem | null => {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) return null;

    const imageUrl = isValidUrl(data.imageUrl) ? data.imageUrl : undefined;
    const links =
      Array.isArray(data.links) && data.links.every(isValidUrl)
        ? data.links
        : undefined;

    return {
      id: data.id || randomId(),
      name,
      category: normalizeCategory(data.category),
      price:
        typeof data.price === 'number' && data.price >= 0
          ? data.price
          : undefined,
      notes: data.notes,
      imageUrl,
      links,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  })
  .refine((item) => item !== null, {
    message: 'CatalogItem must have a non-empty name',
  });

const ListLineSchema = z
  .object({
    id: z.string().optional(),
    catalogItemId: z.string().optional(),
    checked: z.boolean().optional(),
    amount: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .transform((data): ListLine | null => {
    if (typeof data.catalogItemId !== 'string' || !data.catalogItemId) {
      return null;
    }

    return {
      id: data.id || randomId(),
      catalogItemId: data.catalogItemId,
      checked: data.checked === true,
      amount: data.amount,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  })
  .refine((line) => line !== null, {
    message: 'ListLine must have a valid catalogItemId',
  });

const GroceryListSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().optional(),
    lines: z.array(z.any()).optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .transform((data): GroceryList | null => {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) return null;

    const lines: ListLine[] = [];
    if (Array.isArray(data.lines)) {
      for (const lineRaw of data.lines) {
        const result = ListLineSchema.safeParse(lineRaw);
        if (result.success && result.data !== null) {
          lines.push(withUnknownFields(lineRaw, LIST_LINE_KEYS, result.data));
        }
      }
    }

    return {
      id: data.id || randomId(),
      name,
      lines,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: data.updatedAt || new Date().toISOString(),
    };
  })
  .refine((list) => list !== null, {
    message: 'GroceryList must have a non-empty name',
  });

// --- Legacy schema for migration ---

const LegacyGroceryItemSchema = z
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
  .transform((data): GroceryItem | null => {
    const name = typeof data.name === 'string' ? data.name.trim() : '';
    if (!name) return null;

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
  });

// --- Normalization function ---

export interface NormalizeGroceriesResult {
  value: GroceriesVaultPayload;
  changed: boolean;
}

function migrateLegacyToNewShape(legacyLists: any[]): {
  catalog: CatalogItem[];
  lists: GroceryList[];
} {
  const catalog: CatalogItem[] = [];
  const lists: GroceryList[] = [];
  const catalogMap = new Map<string, string>(); // item.id -> catalogItem.id

  for (const legacyList of legacyLists) {
    const listName =
      typeof legacyList.name === 'string' ? legacyList.name.trim() : '';
    if (!listName) continue;

    const lines: ListLine[] = [];

    if (Array.isArray(legacyList.items)) {
      for (const itemRaw of legacyList.items) {
        const result = LegacyGroceryItemSchema.safeParse(itemRaw);
        if (!result.success || result.data === null) continue;

        const item = result.data;

        // Check if this item already exists in catalog by ID
        let catalogItemId = catalogMap.get(item.id);

        if (!catalogItemId) {
          // Create new catalog item
          catalogItemId = randomId();
          catalogMap.set(item.id, catalogItemId);

          catalog.push({
            id: catalogItemId,
            name: item.name,
            category: item.category,
            price: item.price,
            notes: item.notes,
            imageUrl: item.imageUrl,
            links: item.links,
            createdAt: item.createdAt,
            updatedAt: item.updatedAt,
          });
        }

        // Create list line referencing catalog item
        lines.push({
          id: randomId(),
          catalogItemId,
          checked: item.checked,
          amount: item.amount,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        });
      }
    }

    lists.push({
      id: legacyList.id || randomId(),
      name: listName,
      lines,
      createdAt: legacyList.createdAt || new Date().toISOString(),
      updatedAt: legacyList.updatedAt || new Date().toISOString(),
    });
  }

  return { catalog, lists };
}

function pickKnown(
  value: unknown,
  known: Readonly<Record<string, true>>,
): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).filter(([key]) =>
      Object.prototype.hasOwnProperty.call(known, key),
    ),
  );
}

/**
 * A groceries payload reduced to the fields this build knows, at every level,
 * in the order they were written. What `changed` compares.
 */
function knownGroceriesFields(payload: {
  catalog?: unknown;
  lists?: unknown;
}): unknown {
  return {
    catalog: Array.isArray(payload.catalog)
      ? payload.catalog.map((item) => pickKnown(item, CATALOG_ITEM_KEYS))
      : payload.catalog,
    lists: Array.isArray(payload.lists)
      ? payload.lists.map((list) => {
          const known = pickKnown(list, GROCERY_LIST_KEYS);
          if (
            typeof known !== 'object' ||
            known === null ||
            !Array.isArray((known as { lines?: unknown }).lines)
          ) {
            return known;
          }
          return {
            ...known,
            lines: (known as { lines: unknown[] }).lines.map((line) =>
              pickKnown(line, LIST_LINE_KEYS),
            ),
          };
        })
      : payload.lists,
  };
}

export function normalizeGroceries(payload: unknown): NormalizeGroceriesResult {
  const raw = readVaultBlobRecords(payload);

  // Handle null/undefined — return fresh empty payload
  if (raw == null) {
    return {
      value: { catalog: [], lists: [] },
      changed: false,
    };
  }

  // Check if new shape: { catalog: [...], lists: [...] }
  if (
    typeof raw === 'object' &&
    !Array.isArray(raw) &&
    'catalog' in raw &&
    'lists' in raw
  ) {
    const payload = raw as any;

    // Normalize catalog
    const catalog: CatalogItem[] = [];
    if (Array.isArray(payload.catalog)) {
      for (const itemRaw of payload.catalog) {
        const result = CatalogItemSchema.safeParse(itemRaw);
        if (result.success && result.data !== null) {
          catalog.push(
            withUnknownFields(itemRaw, CATALOG_ITEM_KEYS, result.data),
          );
        }
      }
    }

    // Build valid catalog ID set for reference validation
    const validCatalogIds = new Set(catalog.map((item) => item.id));

    // Normalize lists
    const lists: GroceryList[] = [];
    if (Array.isArray(payload.lists)) {
      for (const listRaw of payload.lists) {
        const result = GroceryListSchema.safeParse(listRaw);
        if (result.success && result.data !== null) {
          // Filter out lines with invalid catalog references
          const validLines = result.data.lines.filter((line) =>
            validCatalogIds.has(line.catalogItemId),
          );
          lists.push(
            withUnknownFields(listRaw, GROCERY_LIST_KEYS, {
              ...result.data,
              lines: validLines,
            }),
          );
        }
      }
    }

    // Compared on known fields only: an unknown field is carried through, not
    // repaired, so it never makes the payload worth resaving.
    const changed =
      catalog.length !== (payload.catalog?.length || 0) ||
      lists.length !== (payload.lists?.length || 0) ||
      JSON.stringify(knownGroceriesFields({ catalog, lists })) !==
        JSON.stringify(knownGroceriesFields(payload));

    // Unknown fields survive on the payload, on each Catalog Item, Grocery
    // List and List Line (ADR 0114 decision 3).
    return {
      value: withUnknownFields(raw, GROCERIES_PAYLOAD_KEYS, { catalog, lists }),
      changed,
    };
  }

  // Legacy shape: array of lists with embedded items. This is a migration to
  // the catalog shape, not a write of it, so unknown fields are not carried
  // (ADR 0114 decision 3 protects fields a newer client adds to the current
  // shape). No Mobile Release and no current web build writes this shape; its
  // keys are retired with it, like a Task's `todo` or a Usage Location's
  // `changeType`.
  if (Array.isArray(raw)) {
    const { catalog, lists } = migrateLegacyToNewShape(raw);
    return {
      value: { catalog, lists },
      changed: true,
    };
  }

  // Unrecognized shape — start fresh
  return {
    value: { catalog: [], lists: [] },
    changed: true,
  };
}
