import { InventoryTable } from '@/components/inventory/inventory-table'

export default function InventoryPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Inventory</h1>
      </div>
      <InventoryTable />
    </div>
  )
}
