import { eq } from "drizzle-orm";
import { DEFAULT_SETTINGS, settingsSchema, type Settings } from "../shared/types";
import { db, schema } from "./db";

const KEY = "store";
let cache: Settings | null = null;

export async function getSettings(): Promise<Settings> {
  if (cache) return cache;
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, KEY)).limit(1);
  let stored: Partial<Settings> = {};
  if (row) {
    try {
      stored = JSON.parse(row.value);
    } catch {
      stored = {};
    }
  }
  const merged = {
    ...DEFAULT_SETTINGS,
    ...stored,
    home: { ...DEFAULT_SETTINGS.home, ...(stored.home ?? {}) },
  };
  const parsed = settingsSchema.safeParse(merged);
  cache = parsed.success ? parsed.data : DEFAULT_SETTINGS;
  return cache;
}

export async function saveSettings(next: Settings) {
  const value = JSON.stringify(next);
  await db
    .insert(schema.settings)
    .values({ key: KEY, value })
    .onDuplicateKeyUpdate({ set: { value } });
  cache = next;
}
