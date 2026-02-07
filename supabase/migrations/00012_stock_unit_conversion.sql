-- Store the actual stock amount decremented (in item's base unit)
-- so restore_stock can accurately restore it.
ALTER TABLE order_items ADD COLUMN stock_decrement NUMERIC;

-- Update restore_stock to use stock_decrement when available.
-- Falls back to raw quantity for orders created before this migration.
CREATE OR REPLACE FUNCTION restore_stock(p_order_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE items SET quantity = items.quantity + COALESCE(oi.stock_decrement, oi.quantity)
  FROM order_items oi
  WHERE oi.order_id = p_order_id
  AND oi.item_id = items.id
  AND oi.item_id IS NOT NULL;
END;
$$;
