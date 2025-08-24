import { z } from "zod";

const GRADE_VISIBILITY = ["classic", "premium"] as const;
const UNIT_TYPES = ["weight", "count", "volume"] as const;

export const customFieldDefinitionSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z][a-z0-9_]*$/, "Must be lowercase snake_case"),
  label: z.string().min(1).max(100),
  type: z.enum(["text", "number", "select", "boolean"]),
  required: z.boolean().default(false),
  min: z.number().optional(),
  max: z.number().optional(),
  options: z.array(z.string()).optional(),
});

export type CustomFieldDefinition = z.infer<typeof customFieldDefinitionSchema>;

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z][a-z0-9-]*$/, "Must be lowercase with hyphens"),
  icon: z.string().max(10).default("\u{1F4E6}"),
  sort_order: z.number().int().min(0).default(0),
  grade_visibility: z.enum(GRADE_VISIBILITY).default("classic"),
  unit_type: z.enum(UNIT_TYPES).default("weight"),
  custom_fields_schema: z.array(customFieldDefinitionSchema).default([]),
  low_stock_threshold: z.number().min(0).default(10),
  is_active: z.boolean().default(true),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
