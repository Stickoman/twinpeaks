-- Categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (name <> ''),
  slug TEXT UNIQUE NOT NULL CHECK (slug <> ''),
  icon TEXT DEFAULT '📦',
  sort_order INTEGER DEFAULT 0,
  grade_visibility TEXT CHECK (grade_visibility IN ('classic', 'premium', 'both')) DEFAULT 'both',
  unit_type TEXT CHECK (unit_type IN ('weight', 'count', 'volume')) DEFAULT 'weight',
  custom_fields_schema JSONB DEFAULT '[]'::jsonb,
  low_stock_threshold NUMERIC DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_slug ON categories (slug);
CREATE INDEX idx_categories_sort ON categories (sort_order);
CREATE INDEX idx_categories_active ON categories (is_active) WHERE is_active = true;

CREATE TRIGGER trg_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Public can read active categories
CREATE POLICY categories_public_read ON categories
  FOR SELECT
  USING (is_active = true);

-- Add category_id to items
ALTER TABLE items ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;
ALTER TABLE items ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;
ALTER TABLE items ADD COLUMN low_stock_threshold NUMERIC;

CREATE INDEX idx_items_category_id ON items (category_id);

-- Add fields to order_items
ALTER TABLE order_items ADD COLUMN category_slug TEXT;
ALTER TABLE order_items ADD COLUMN custom_fields JSONB DEFAULT '{}'::jsonb;

-- Seed product categories
INSERT INTO categories (name, slug, icon, sort_order, grade_visibility, unit_type) VALUES
  ('Wines & Champagnes', 'wines', '🍷', 1, 'classic', 'count'),
  ('Spirits', 'spirits', '🥃', 2, 'classic', 'count'),
  ('Fine Grocery', 'fine-grocery', '🧀', 3, 'classic', 'weight'),
  ('Truffles & Foie Gras', 'truffles', '🍄', 4, 'premium', 'weight'),
  ('Caviar & Seafood', 'caviar', '🦞', 5, 'premium', 'weight'),
  ('Gift Sets', 'gift-sets', '🎁', 6, 'premium', 'count');

-- Migrate existing items.type → category_id
UPDATE items SET category_id = c.id
FROM categories c
WHERE LOWER(items.type) = LOWER(c.name);

-- Stock decrement type
CREATE TYPE stock_decrement_item AS (
  item_id UUID,
  quantity NUMERIC
);

-- Atomic stock decrement function
CREATE OR REPLACE FUNCTION decrement_stock(p_items stock_decrement_item[])
RETURNS TABLE(item_id UUID, success BOOLEAN, remaining NUMERIC, error TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item stock_decrement_item;
  v_current NUMERIC;
BEGIN
  -- Process items in order by ID to prevent deadlocks
  FOR v_item IN
    SELECT * FROM unnest(p_items) ORDER BY (unnest).item_id
  LOOP
    -- Lock the row
    SELECT i.quantity INTO v_current
    FROM items i
    WHERE i.id = v_item.item_id
    FOR UPDATE;

    IF NOT FOUND THEN
      item_id := v_item.item_id;
      success := false;
      remaining := 0;
      error := 'Item not found';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF v_current < v_item.quantity THEN
      item_id := v_item.item_id;
      success := false;
      remaining := v_current;
      error := 'Insufficient stock';
      RETURN NEXT;
      CONTINUE;
    END IF;

    UPDATE items SET quantity = quantity - v_item.quantity
    WHERE id = v_item.item_id;

    item_id := v_item.item_id;
    success := true;
    remaining := v_current - v_item.quantity;
    error := NULL;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Restore stock when order cancelled
CREATE OR REPLACE FUNCTION restore_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE items SET quantity = items.quantity + oi.quantity
  FROM order_items oi
  WHERE oi.order_id = p_order_id
  AND oi.item_id = items.id
  AND oi.item_id IS NOT NULL;
END;
$$;

-- Get item availability status
CREATE OR REPLACE FUNCTION get_item_availability(p_item_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_quantity NUMERIC;
  v_threshold NUMERIC;
  v_cat_threshold NUMERIC;
BEGIN
  SELECT i.quantity, i.low_stock_threshold, c.low_stock_threshold
  INTO v_quantity, v_threshold, v_cat_threshold
  FROM items i
  LEFT JOIN categories c ON c.id = i.category_id
  WHERE i.id = p_item_id;

  IF NOT FOUND OR v_quantity <= 0 THEN
    RETURN 'unavailable';
  END IF;

  -- Use item threshold if set, otherwise category threshold
  IF v_quantity <= COALESCE(v_threshold, v_cat_threshold, 10) THEN
    RETURN 'low';
  END IF;

  RETURN 'available';
END;
$$;
