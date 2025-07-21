'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export function StatsOverview() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">—</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">—</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Inventory Items</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">—</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Active Drivers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">—</p>
        </CardContent>
      </Card>
    </div>
  )
}
