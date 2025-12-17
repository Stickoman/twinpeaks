"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportButtonProps {
  onExportCSV: () => void;
  onExportExcel: () => void;
  disabled?: boolean;
}

export function ExportButton({ onExportCSV, onExportExcel, disabled }: ExportButtonProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="size-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportCSV}>Export as CSV</DropdownMenuItem>
        <DropdownMenuItem onClick={onExportExcel}>Export as Excel</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
