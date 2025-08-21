"use client";

import { useState, useCallback } from "react";
import { Upload, FileSpreadsheet, AlertTriangle, Check, X } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  parseCSV,
  parseExcel,
  validateRows,
  type ValidatedRow,
  type ImportRow,
} from "@/lib/utils/import";
import { downloadTemplate } from "@/lib/utils/export";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingItems: Array<{ name: string; variety: string }>;
}

type ImportStep = "upload" | "preview" | "importing";
type ConflictMode = "skip" | "overwrite" | "all";

async function bulkCreateItems(items: ImportRow[]): Promise<void> {
  // Batch in chunks of 100
  for (let i = 0; i < items.length; i += 100) {
    const chunk = items.slice(i, i + 100).map((item) => ({
      name: item.name,
      variety: item.variety,
      type: item.type,
      quantity: item.quantity,
      unit_measure: item.unit_measure,
      image_url: item.image_url,
    }));

    const res = await fetch("/api/inventory/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(chunk),
    });

    if (!res.ok) {
      const body = (await res.json()) as { error?: string };
      throw new Error(body.error ?? "Import failed");
    }
  }
}

export function ImportDialog({ open, onOpenChange, existingItems }: ImportDialogProps) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<ImportStep>("upload");
  const [validatedRows, setValidatedRows] = useState<ValidatedRow[]>([]);
  const [fileName, setFileName] = useState("");

  const importMutation = useMutation({
    mutationFn: bulkCreateItems,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      toast.success("Import completed successfully");
      handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setStep("preview");
    },
  });

  function handleClose() {
    setStep("upload");
    setValidatedRows([]);
    setFileName("");
    onOpenChange(false);
  }

  const handleFile = useCallback(
    async (file: File) => {
      setFileName(file.name);

      let rows: ImportRow[];

      if (file.name.endsWith(".csv")) {
        const text = await file.text();
        rows = parseCSV(text);
      } else if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
        const buffer = await file.arrayBuffer();
        rows = parseExcel(buffer);
      } else {
        toast.error("Unsupported file type. Please use .csv or .xlsx");
        return;
      }

      if (rows.length === 0) {
        toast.error("No data found in file");
        return;
      }

      const validated = validateRows(rows, existingItems);
      setValidatedRows(validated);
      setStep("preview");
    },
    [existingItems],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  function handleImport(mode: ConflictMode) {
    let rowsToImport: ImportRow[];

    const validRows = validatedRows.filter((r) => r.valid);

    switch (mode) {
      case "skip":
        rowsToImport = validRows.filter((r) => !r.isDuplicate).map((r) => r.row);
        break;
      case "overwrite":
      case "all":
        rowsToImport = validRows.map((r) => r.row);
        break;
    }

    if (rowsToImport.length === 0) {
      toast.error("No valid rows to import");
      return;
    }

    setStep("importing");
    importMutation.mutate(rowsToImport);
  }

  const validCount = validatedRows.filter((r) => r.valid).length;
  const errorCount = validatedRows.filter((r) => !r.valid).length;
  const duplicateCount = validatedRows.filter((r) => r.isDuplicate).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Inventory</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a CSV or Excel file to import products."}
            {step === "preview" && `Preview: ${fileName}`}
            {step === "importing" && "Importing..."}
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-8 text-center transition-colors hover:border-primary/50"
            >
              <Upload className="size-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Drop a file here or click to browse</p>
                <p className="text-sm text-muted-foreground">Supports .csv and .xlsx files</p>
              </div>
              <Button variant="outline" asChild>
                <label className="cursor-pointer">
                  <FileSpreadsheet className="size-4" />
                  Choose File
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </Button>
            </div>
            <Button variant="link" size="sm" onClick={downloadTemplate}>
              Download CSV template
            </Button>
          </div>
        )}

        {/* Step 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="secondary"
                className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                <Check className="mr-1 size-3" />
                {validCount} valid
              </Badge>
              {errorCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                >
                  <X className="mr-1 size-3" />
                  {errorCount} errors
                </Badge>
              )}
              {duplicateCount > 0 && (
                <Badge
                  variant="secondary"
                  className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                >
                  <AlertTriangle className="mr-1 size-3" />
                  {duplicateCount} duplicates
                </Badge>
              )}
            </div>

            <div className="max-h-64 overflow-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Variety</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validatedRows.map((vr) => (
                    <TableRow
                      key={vr.index}
                      className={
                        !vr.valid
                          ? "bg-red-50 dark:bg-red-900/10"
                          : vr.isDuplicate
                            ? "bg-amber-50 dark:bg-amber-900/10"
                            : ""
                      }
                    >
                      <TableCell className="text-xs text-muted-foreground">
                        {vr.index + 1}
                      </TableCell>
                      <TableCell>
                        {!vr.valid ? (
                          <Badge variant="destructive" className="text-xs">
                            Error
                          </Badge>
                        ) : vr.isDuplicate ? (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-amber-100 text-amber-800"
                          >
                            Dup
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-emerald-100 text-emerald-800"
                          >
                            OK
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">{vr.row.name}</TableCell>
                      <TableCell className="text-sm">{vr.row.variety}</TableCell>
                      <TableCell className="text-sm">{vr.row.type ?? "-"}</TableCell>
                      <TableCell className="text-sm">{vr.row.quantity}</TableCell>
                      <TableCell className="text-sm">{vr.row.unit_measure}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {validatedRows.some((r) => !r.valid) && (
              <div className="space-y-1">
                <p className="text-sm font-medium text-destructive">Errors:</p>
                {validatedRows
                  .filter((r) => !r.valid)
                  .slice(0, 5)
                  .map((r) => (
                    <p key={r.index} className="text-xs text-muted-foreground">
                      Row {r.index + 1}: {r.errors.join(", ")}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Importing */}
        {step === "importing" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <p className="text-sm text-muted-foreground">Importing products...</p>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              {duplicateCount > 0 && (
                <Button variant="outline" onClick={() => handleImport("skip")}>
                  Skip Duplicates ({validCount - duplicateCount})
                </Button>
              )}
              <Button onClick={() => handleImport("all")} disabled={validCount === 0}>
                Import {validCount} Items
              </Button>
            </>
          )}
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
