"use client";

import { useEffect } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Category, Item } from "@/types/database";
import {
  createItemSchema,
  type CreateItemInput,
  type UpdateItemInput,
} from "@/lib/validations/inventory";
import { WEIGHT_UNITS, COUNT_UNITS } from "@/lib/utils/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "./image-upload";

const BADGE_OPTIONS = ["PREMIUM", "BESTSELLER", "LIMITED", "SEASONAL", "PROMO"] as const;
type BadgeValue = "PREMIUM" | "BESTSELLER" | "LIMITED" | "SEASONAL" | "PROMO" | "HOT" | "NEW";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface InventoryFormProps {
  item?: Item;
  onSuccess: () => void;
  onCancel: () => void;
}

// ────────────────────────────────────────────────────────────
// API helpers
// ────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json() as Promise<Category[]>;
}

async function createItem(data: CreateItemInput): Promise<Item> {
  const response = await fetch("/api/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to create product");
  }
  return response.json() as Promise<Item>;
}

async function updateItem({ id, data }: { id: string; data: UpdateItemInput }): Promise<Item> {
  const response = await fetch(`/api/inventory/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update product");
  }
  return response.json() as Promise<Item>;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function InventoryForm({ item, onSuccess, onCancel }: InventoryFormProps) {
  const isEditing = Boolean(item);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      name: item?.name ?? "",
      variety: item?.variety ?? "",
      type: item?.type ?? "",
      quantity: item?.quantity ?? 0,
      price: item?.price ?? 0,
      unit_measure: item?.unit_measure ?? "g",
      image_url: item?.image_url ?? "",
      category_id: item?.category_id ?? undefined,
      custom_fields: item?.custom_fields ?? {},
      badges: (item?.badges as BadgeValue[]) ?? [],
      is_featured: item?.is_featured ?? false,
    },
  });

  // When editing, ensure name is explicitly set in RHF internal state.
  // Hidden inputs rely on DOM ref to set defaultValue, which can race with
  // React's commit phase — setValue guarantees the value is in _formValues.
  useEffect(() => {
    if (item?.name) {
      setValue("name", item.name);
    }
  }, [item?.name, setValue]);

  const selectedName = watch("name");
  const selectedUnit = watch("unit_measure");
  const selectedCategoryId = watch("category_id");
  const imageUrl = watch("image_url");
  const selectedBadges = watch("badges") ?? [];
  const isFeatured = watch("is_featured") ?? false;
  const customFields = watch("custom_fields") ?? {};
  const promoDiscount =
    typeof customFields.promo_discount === "number" ? customFields.promo_discount : 0;

  // Derive unit options from selected category's unit_type
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const unitType = selectedCategory?.unit_type ?? "weight";
  const availableUnits = unitType === "count" ? COUNT_UNITS : WEIGHT_UNITS;

  // ── Mutations ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createItem,
    onSuccess,
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create product");
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateItem,
    onSuccess,
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update product");
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // When category changes, auto-set name and default unit based on unit_type
  function handleCategoryChange(categoryId: string) {
    setValue("category_id", categoryId, { shouldValidate: true });
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) {
      setValue("name", cat.name, { shouldValidate: true });
      // Set default unit for this category's unit_type
      const defaultUnit = cat.unit_type === "count" ? "unit" : "g";
      setValue("unit_measure", defaultUnit, { shouldValidate: true });
    }
  }

  // ── Submit handler ─────────────────────────────────────
  function onSubmit(data: CreateItemInput) {
    const cf = { ...(data.custom_fields ?? {}) };
    if (!data.badges?.includes("PROMO")) {
      delete cf.promo_discount;
    }

    const payload = {
      ...data,
      type: data.type || null,
      image_url: data.image_url || null,
      custom_fields: Object.keys(cf).length > 0 ? cf : undefined,
    };

    if (isEditing && item) {
      updateMutation.mutate({ id: item.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function onValidationError(fieldErrors: FieldErrors<CreateItemInput>) {
    const entries = Object.entries(fieldErrors);
    const [firstField, firstError] = entries[0] ?? [];
    const message =
      typeof firstError?.message === "string"
        ? `${firstField}: ${firstError.message}`
        : "Please check the form fields";
    console.error("Form validation errors:", fieldErrors);
    toast.error(message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onValidationError)} className="space-y-4">
      {/* Category (from API) */}
      <div className="space-y-2">
        <Label htmlFor="category">Category *</Label>
        {categoriesLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select value={selectedCategoryId ?? ""} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!selectedCategoryId && !selectedName && errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
        {/* Hidden: name is auto-set from category */}
        <input type="hidden" {...register("name")} />
      </div>

      {/* Variety */}
      <div className="space-y-2">
        <Label htmlFor="variety">Variety / Product *</Label>
        <Input
          id="variety"
          placeholder="e.g. Château Pétrus 2015, Black Périgord Truffle..."
          {...register("variety")}
          aria-invalid={Boolean(errors.variety)}
        />
        {errors.variety && <p className="text-sm text-destructive">{errors.variety.message}</p>}
      </div>

      {/* Type (optional — sub-type) */}
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Input
          id="type"
          placeholder="e.g. Red, White, Rosé, Aged, Fresh..."
          {...register("type")}
          aria-invalid={Boolean(errors.type)}
        />
        {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
      </div>

      {/* Quantity + Unit (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity *</Label>
          <Input
            id="quantity"
            type="number"
            min={0}
            step={unitType === "count" ? "1" : "any"}
            placeholder="0"
            {...register("quantity", { valueAsNumber: true })}
            aria-invalid={Boolean(errors.quantity)}
          />
          {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit_measure">Unit</Label>
          <Select
            value={selectedUnit}
            onValueChange={(value) => setValue("unit_measure", value, { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((unit) => (
                <SelectItem key={unit.value} value={unit.value}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.unit_measure && (
            <p className="text-sm text-destructive">{errors.unit_measure.message}</p>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="space-y-2">
        <Label htmlFor="price">Price ($)</Label>
        <Input
          id="price"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          {...register("price", { valueAsNumber: true })}
          aria-invalid={Boolean(errors.price)}
        />
        {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
      </div>

      {/* Badges */}
      <div className="space-y-2">
        <Label>Badges</Label>
        <div className="flex flex-wrap gap-2">
          {BADGE_OPTIONS.map((badge) => {
            const isSelected = selectedBadges.includes(badge);
            return (
              <Button
                key={badge}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => {
                  const newBadges = isSelected
                    ? selectedBadges.filter((b) => b !== badge)
                    : [...selectedBadges, badge];
                  setValue("badges", newBadges as BadgeValue[], {
                    shouldValidate: true,
                  });
                }}
              >
                {badge}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Promo Discount — shown when PROMO badge is selected */}
      {selectedBadges.includes("PROMO") && (
        <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <Label htmlFor="promo_discount">Promo Discount (%)</Label>
          <Input
            id="promo_discount"
            type="number"
            min={1}
            max={99}
            step={1}
            placeholder="e.g. 20"
            value={promoDiscount || ""}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setValue(
                "custom_fields",
                {
                  ...customFields,
                  promo_discount: isNaN(val) ? undefined : Math.min(99, Math.max(1, val)),
                },
                { shouldValidate: true },
              );
            }}
          />
          <p className="text-xs text-muted-foreground">
            Discount shown to clients (e.g. 20 = 20% off the base price)
          </p>
        </div>
      )}

      {/* Featured toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="is_featured">Featured Product</Label>
          <p className="text-xs text-muted-foreground">
            Show this product at the top of the catalog
          </p>
        </div>
        <Switch
          id="is_featured"
          checked={isFeatured}
          onCheckedChange={(checked) => setValue("is_featured", checked, { shouldValidate: true })}
        />
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>Image</Label>
        <ImageUpload
          value={imageUrl || null}
          onChange={(url) => setValue("image_url", url ?? "", { shouldValidate: true })}
          disabled={isPending}
        />
        {errors.image_url && <p className="text-sm text-destructive">{errors.image_url.message}</p>}
      </div>

      {/* Mutation error */}
      {mutationError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20">
          {mutationError instanceof Error ? mutationError.message : "An error occurred."}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? isEditing
              ? "Updating..."
              : "Creating..."
            : isEditing
              ? "Update"
              : "Create Product"}
        </Button>
      </div>
    </form>
  );
}
"use client";

import { useEffect } from "react";
import { useForm, type FieldErrors } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import type { Category, Item } from "@/types/database";
import {
  createItemSchema,
  type CreateItemInput,
  type UpdateItemInput,
} from "@/lib/validations/inventory";
import { WEIGHT_UNITS, COUNT_UNITS } from "@/lib/utils/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ImageUpload } from "./image-upload";

const BADGE_OPTIONS = ["PREMIUM", "BESTSELLER", "LIMITED", "SEASONAL", "PROMO"] as const;
type BadgeValue = "PREMIUM" | "BESTSELLER" | "LIMITED" | "SEASONAL" | "PROMO" | "HOT" | "NEW";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface InventoryFormProps {
  item?: Item;
  onSuccess: () => void;
  onCancel: () => void;
}

// ────────────────────────────────────────────────────────────
// API helpers
// ────────────────────────────────────────────────────────────

async function fetchCategories(): Promise<Category[]> {
  const res = await fetch("/api/categories");
  if (!res.ok) throw new Error("Failed to load categories");
  return res.json() as Promise<Category[]>;
}

async function createItem(data: CreateItemInput): Promise<Item> {
  const response = await fetch("/api/inventory", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to create product");
  }
  return response.json() as Promise<Item>;
}

async function updateItem({ id, data }: { id: string; data: UpdateItemInput }): Promise<Item> {
  const response = await fetch(`/api/inventory/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error("Failed to update product");
  }
  return response.json() as Promise<Item>;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

export function InventoryForm({ item, onSuccess, onCancel }: InventoryFormProps) {
  const isEditing = Boolean(item);

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CreateItemInput>({
    resolver: zodResolver(createItemSchema),
    defaultValues: {
      name: item?.name ?? "",
      variety: item?.variety ?? "",
      type: item?.type ?? "",
      quantity: item?.quantity ?? 0,
      price: item?.price ?? 0,
      unit_measure: item?.unit_measure ?? "g",
      image_url: item?.image_url ?? "",
      category_id: item?.category_id ?? undefined,
      custom_fields: item?.custom_fields ?? {},
      badges: (item?.badges as BadgeValue[]) ?? [],
      is_featured: item?.is_featured ?? false,
    },
  });

  // When editing, ensure name is explicitly set in RHF internal state.
  // Hidden inputs rely on DOM ref to set defaultValue, which can race with
  // React's commit phase — setValue guarantees the value is in _formValues.
  useEffect(() => {
    if (item?.name) {
      setValue("name", item.name);
    }
  }, [item?.name, setValue]);

  const selectedName = watch("name");
  const selectedUnit = watch("unit_measure");
  const selectedCategoryId = watch("category_id");
  const imageUrl = watch("image_url");
  const selectedBadges = watch("badges") ?? [];
  const isFeatured = watch("is_featured") ?? false;
  const customFields = watch("custom_fields") ?? {};
  const promoDiscount =
    typeof customFields.promo_discount === "number" ? customFields.promo_discount : 0;

  // Derive unit options from selected category's unit_type
  const selectedCategory = categories.find((c) => c.id === selectedCategoryId);
  const unitType = selectedCategory?.unit_type ?? "weight";
  const availableUnits = unitType === "count" ? COUNT_UNITS : WEIGHT_UNITS;

  // ── Mutations ──────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: createItem,
    onSuccess,
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to create product");
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateItem,
    onSuccess,
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to update product");
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;
  const mutationError = createMutation.error ?? updateMutation.error;

  // When category changes, auto-set name and default unit based on unit_type
  function handleCategoryChange(categoryId: string) {
    setValue("category_id", categoryId, { shouldValidate: true });
    const cat = categories.find((c) => c.id === categoryId);
    if (cat) {
      setValue("name", cat.name, { shouldValidate: true });
      // Set default unit for this category's unit_type
      const defaultUnit = cat.unit_type === "count" ? "unit" : "g";
      setValue("unit_measure", defaultUnit, { shouldValidate: true });
    }
  }

  // ── Submit handler ─────────────────────────────────────
  function onSubmit(data: CreateItemInput) {
    const cf = { ...(data.custom_fields ?? {}) };
    if (!data.badges?.includes("PROMO")) {
      delete cf.promo_discount;
    }

    const payload = {
      ...data,
      type: data.type || null,
      image_url: data.image_url || null,
      custom_fields: Object.keys(cf).length > 0 ? cf : undefined,
    };

    if (isEditing && item) {
      updateMutation.mutate({ id: item.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function onValidationError(fieldErrors: FieldErrors<CreateItemInput>) {
    const entries = Object.entries(fieldErrors);
    const [firstField, firstError] = entries[0] ?? [];
    const message =
      typeof firstError?.message === "string"
        ? `${firstField}: ${firstError.message}`
        : "Please check the form fields";
    console.error("Form validation errors:", fieldErrors);
    toast.error(message);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit, onValidationError)} className="space-y-4">
      {/* Category (from API) */}
      <div className="space-y-2">
        <Label htmlFor="category">Category *</Label>
        {categoriesLoading ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <Select value={selectedCategoryId ?? ""} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.icon} {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!selectedCategoryId && !selectedName && errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
        {/* Hidden: name is auto-set from category */}
        <input type="hidden" {...register("name")} />
      </div>

      {/* Variety */}
      <div className="space-y-2">
        <Label htmlFor="variety">Variety / Product *</Label>
        <Input
          id="variety"
          placeholder="e.g. Château Pétrus 2015, Black Périgord Truffle..."
          {...register("variety")}
          aria-invalid={Boolean(errors.variety)}
        />
        {errors.variety && <p className="text-sm text-destructive">{errors.variety.message}</p>}
      </div>

      {/* Type (optional — sub-type) */}
      <div className="space-y-2">
        <Label htmlFor="type">Type</Label>
        <Input
          id="type"
          placeholder="e.g. Red, White, Rosé, Aged, Fresh..."
          {...register("type")}
          aria-invalid={Boolean(errors.type)}
        />
        {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
      </div>

      {/* Quantity + Unit (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="quantity">Quantity *</Label>
          <Input
            id="quantity"
            type="number"
            min={0}
            step={unitType === "count" ? "1" : "any"}
            placeholder="0"
            {...register("quantity", { valueAsNumber: true })}
            aria-invalid={Boolean(errors.quantity)}
          />
          {errors.quantity && <p className="text-sm text-destructive">{errors.quantity.message}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="unit_measure">Unit</Label>
          <Select
            value={selectedUnit}
            onValueChange={(value) => setValue("unit_measure", value, { shouldValidate: true })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unit" />
            </SelectTrigger>
            <SelectContent>
              {availableUnits.map((unit) => (
                <SelectItem key={unit.value} value={unit.value}>
                  {unit.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.unit_measure && (
            <p className="text-sm text-destructive">{errors.unit_measure.message}</p>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="space-y-2">
        <Label htmlFor="price">Price ($)</Label>
        <Input
          id="price"
          type="number"
          min={0}
          step="0.01"
          placeholder="0.00"
          {...register("price", { valueAsNumber: true })}
          aria-invalid={Boolean(errors.price)}
        />
        {errors.price && <p className="text-sm text-destructive">{errors.price.message}</p>}
      </div>

      {/* Badges */}
      <div className="space-y-2">
        <Label>Badges</Label>
        <div className="flex flex-wrap gap-2">
          {BADGE_OPTIONS.map((badge) => {
            const isSelected = selectedBadges.includes(badge);
            return (
              <Button
                key={badge}
                type="button"
                size="sm"
                variant={isSelected ? "default" : "outline"}
                onClick={() => {
                  const newBadges = isSelected
                    ? selectedBadges.filter((b) => b !== badge)
                    : [...selectedBadges, badge];
                  setValue("badges", newBadges as BadgeValue[], {
                    shouldValidate: true,
                  });
                }}
              >
                {badge}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Promo Discount — shown when PROMO badge is selected */}
      {selectedBadges.includes("PROMO") && (
        <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
          <Label htmlFor="promo_discount">Promo Discount (%)</Label>
          <Input
            id="promo_discount"
            type="number"
            min={1}
            max={99}
            step={1}
            placeholder="e.g. 20"
            value={promoDiscount || ""}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setValue(
                "custom_fields",
                {
                  ...customFields,
                  promo_discount: isNaN(val) ? undefined : Math.min(99, Math.max(1, val)),
                },
                { shouldValidate: true },
              );
            }}
          />
          <p className="text-xs text-muted-foreground">
            Discount shown to clients (e.g. 20 = 20% off the base price)
          </p>
        </div>
      )}

      {/* Featured toggle */}
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="space-y-0.5">
          <Label htmlFor="is_featured">Featured Product</Label>
          <p className="text-xs text-muted-foreground">
            Show this product at the top of the catalog
          </p>
        </div>
        <Switch
          id="is_featured"
          checked={isFeatured}
          onCheckedChange={(checked) => setValue("is_featured", checked, { shouldValidate: true })}
        />
      </div>

      {/* Image Upload */}
      <div className="space-y-2">
        <Label>Image</Label>
        <ImageUpload
          value={imageUrl || null}
          onChange={(url) => setValue("image_url", url ?? "", { shouldValidate: true })}
          disabled={isPending}
        />
        {errors.image_url && <p className="text-sm text-destructive">{errors.image_url.message}</p>}
      </div>

      {/* Mutation error */}
      {mutationError && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/20">
          {mutationError instanceof Error ? mutationError.message : "An error occurred."}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? isEditing
              ? "Updating..."
              : "Creating..."
            : isEditing
              ? "Update"
              : "Create Product"}
        </Button>
      </div>
    </form>
  );
}
