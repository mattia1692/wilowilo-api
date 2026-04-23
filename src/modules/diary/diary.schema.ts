import { z } from 'zod';

export const foodItemSchema = z.object({
  name: z.string(),
  kcal: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  satfat: z.number().optional(),
  fiber: z.number().optional(),
  grams: z.number().optional(),
  ultra: z.boolean().optional(),
});

export const addItemBodySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.string().min(1),
  item: foodItemSchema,
});

export const updateItemBodySchema = z.object({
  item: foodItemSchema,
});

export const dayMetaBodySchema = z.object({
  hunger: z.number().int().min(1).max(6).optional(),
  mood: z.number().int().min(1).max(6).optional(),
  water: z.number().int().min(0).optional(),
});

export const dateParamSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const itemParamsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.string().min(1),
  idx: z.coerce.number().int().min(0),
});

export const itemByIdParamsSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meal: z.string().min(1),
  itemId: z.string().min(1),
});

export type FoodItem = z.infer<typeof foodItemSchema>;
export type AddItemBody = z.infer<typeof addItemBodySchema>;
export type DayMetaBody = z.infer<typeof dayMetaBodySchema>;
