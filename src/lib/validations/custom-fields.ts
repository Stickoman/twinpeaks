import { z } from "zod";
import type { CustomFieldDefinition } from "./categories";

/**
 * Dynamically build a Zod schema from a category's custom_fields_schema.
 */
export function buildCustomFieldsSchema(
  definitions: CustomFieldDefinition[],
): z.ZodType<Record<string, unknown>> {
  if (definitions.length === 0) {
    return z.record(z.string(), z.unknown()).default({});
  }

  const shape: Record<string, z.ZodTypeAny> = {};

  for (const def of definitions) {
    let fieldSchema: z.ZodTypeAny;

    switch (def.type) {
      case "text": {
        let s = z.string();
        if (def.min !== undefined) s = s.min(def.min);
        if (def.max !== undefined) s = s.max(def.max);
        fieldSchema = s;
        break;
      }
      case "number": {
        let n = z.number();
        if (def.min !== undefined) n = n.min(def.min);
        if (def.max !== undefined) n = n.max(def.max);
        fieldSchema = n;
        break;
      }
      case "select": {
        if (def.options && def.options.length > 0) {
          fieldSchema = z.enum(def.options as [string, ...string[]]);
        } else {
          fieldSchema = z.string();
        }
        break;
      }
      case "boolean":
        fieldSchema = z.boolean();
        break;
      default:
        fieldSchema = z.unknown();
    }

    if (!def.required) {
      fieldSchema = fieldSchema.optional();
    }

    shape[def.key] = fieldSchema;
  }

  return z.object(shape).passthrough() as z.ZodType<Record<string, unknown>>;
}
