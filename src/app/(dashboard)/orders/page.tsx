import { OrdersPanel } from '@/components/orders/orders-panel'

export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Orders</h1>
      <OrdersPanel />
    </div>
  )
}
