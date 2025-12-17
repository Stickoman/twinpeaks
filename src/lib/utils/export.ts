import Papa from "papaparse";

interface ExportableItem {
  id: string;
  name: string;
  variety: string;
  type: string | null;
  quantity: number;
  unit_measure: string;
  image_url: string | null;
}

interface ExportableOrder {
  id: string;
  address: string;
  status: string;
  grade: string;
  notes: string | null;
  created_at: string;
  items: Array<{
    name: string;
    variety: string;
    quantity: number;
    unit: string;
  }>;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportItemsCSV(items: ExportableItem[]) {
  const rows = items.map((item) => ({
    Name: item.name,
    Variety: item.variety,
    Type: item.type ?? "",
    Quantity: item.quantity,
    Unit: item.unit_measure,
    "Image URL": item.image_url ?? "",
  }));

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `inventory-${new Date().toISOString().split("T")[0]}.csv`);
}

export async function exportItemsExcel(items: ExportableItem[]) {
  const XLSX = await import("xlsx");
  const rows = items.map((item) => ({
    Name: item.name,
    Variety: item.variety,
    Type: item.type ?? "",
    Quantity: item.quantity,
    Unit: item.unit_measure,
    "Image URL": item.image_url ?? "",
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventory");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `inventory-${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function exportOrdersCSV(orders: ExportableOrder[]) {
  const rows: Record<string, unknown>[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      rows.push({
        "Order ID": order.id,
        Address: order.address,
        Status: order.status,
        Grade: order.grade,
        Notes: order.notes ?? "",
        "Created At": order.created_at,
        "Item Name": item.name,
        "Item Variety": item.variety,
        "Item Quantity": item.quantity,
        "Item Unit": item.unit,
      });
    }
  }

  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `orders-${new Date().toISOString().split("T")[0]}.csv`);
}

export async function exportOrdersExcel(orders: ExportableOrder[]) {
  const XLSX = await import("xlsx");
  const rows: Record<string, unknown>[] = [];
  for (const order of orders) {
    for (const item of order.items) {
      rows.push({
        "Order ID": order.id,
        Address: order.address,
        Status: order.status,
        Grade: order.grade,
        Notes: order.notes ?? "",
        "Created At": order.created_at,
        "Item Name": item.name,
        "Item Variety": item.variety,
        "Item Quantity": item.quantity,
        "Item Unit": item.unit,
      });
    }
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Orders");
  const buffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, `orders-${new Date().toISOString().split("T")[0]}.xlsx`);
}

export function generateItemTemplate(): string {
  const headers = ["Name", "Variety", "Type", "Quantity", "Unit"];
  const example = ["OG Kush", "Indica", "WEED", "100", "g"];
  return Papa.unparse([headers, example]);
}

export function downloadTemplate() {
  const csv = generateItemTemplate();
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, "inventory-template.csv");
}
