import Papa from "papaparse";
import * as XLSX from "xlsx";
import { createItemSchema } from "@/lib/validations/inventory";

export interface ImportRow {
  name: string;
  variety: string;
  type: string | null;
  quantity: number;
  unit_measure: string;
  image_url: string | null;
}

export interface ValidatedRow {
  row: ImportRow;
  index: number;
  valid: boolean;
  errors: string[];
  isDuplicate: boolean;
}

// Column header aliases for case-insensitive matching
const COLUMN_MAP: Record<string, string> = {
  name: "name",
  product: "name",
  "product name": "name",
  variety: "variety",
  type: "type",
  category: "type",
  quantity: "quantity",
  qty: "quantity",
  stock: "quantity",
  unit: "unit_measure",
  "unit measure": "unit_measure",
  unit_measure: "unit_measure",
  image: "image_url",
  "image url": "image_url",
  image_url: "image_url",
};

function mapHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    if (COLUMN_MAP[normalized]) {
      mapping[header] = COLUMN_MAP[normalized];
    }
  }
  return mapping;
}

function mapRow(raw: Record<string, string>, headerMap: Record<string, string>): ImportRow {
  const mapped: Record<string, unknown> = {};
  for (const [originalHeader, value] of Object.entries(raw)) {
    const field = headerMap[originalHeader];
    if (field) {
      mapped[field] = value;
    }
  }

  return {
    name: String(mapped.name ?? "").trim(),
    variety: String(mapped.variety ?? "").trim(),
    type: mapped.type ? String(mapped.type).trim() : null,
    quantity: Number(mapped.quantity) || 0,
    unit_measure: String(mapped.unit_measure ?? "g").trim(),
    image_url: mapped.image_url ? String(mapped.image_url).trim() : null,
  };
}

export function parseCSV(fileContent: string): ImportRow[] {
  const result = Papa.parse<Record<string, string>>(fileContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  if (!result.data.length || !result.meta.fields?.length) return [];

  const headerMap = mapHeaders(result.meta.fields);
  return result.data.map((row) => mapRow(row, headerMap));
}

export function parseExcel(buffer: ArrayBuffer): ImportRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, {
    defval: "",
  });

  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  const headerMap = mapHeaders(headers);
  return rows.map((row) => mapRow(row, headerMap));
}

export function validateRows(
  rows: ImportRow[],
  existingItems: Array<{ name: string; variety: string }>,
): ValidatedRow[] {
  return rows.map((row, index) => {
    const errors: string[] = [];

    const result = createItemSchema.safeParse({
      name: row.name,
      variety: row.variety,
      type: row.type,
      quantity: row.quantity,
      unit_measure: row.unit_measure,
      image_url: row.image_url,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push(`${issue.path.join(".")}: ${issue.message}`);
      }
    }

    const isDuplicate = existingItems.some(
      (existing) =>
        existing.name.toLowerCase() === row.name.toLowerCase() &&
        existing.variety.toLowerCase() === row.variety.toLowerCase(),
    );

    return {
      row,
      index,
      valid: errors.length === 0,
      errors,
      isDuplicate,
    };
  });
}
