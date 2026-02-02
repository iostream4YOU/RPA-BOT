import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, CheckCircle2, XCircle, Clock, TrendingUp, TrendingDown } from 'lucide-react';

export default function KPICards({ stats }) {
  const cards = [
    {
      title: "Total Orders",
      value: stats.totalOrders ?? 0,
      sub: "Across current filters",
      icon: Activity,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      title: "Success Orders",
      value: stats.successOrders ?? 0,
      sub: "Processed successfully",
      icon: CheckCircle2,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-900/20"
    },
    {
      title: "Failed Orders",
      value: stats.failureOrders ?? 0,
      sub: "Require attention",
      icon: XCircle,
      color: "text-red-600",
      bg: "bg-red-50 dark:bg-red-900/20"
    },
    {
      title: "Success Rate",
      value: `${stats.successRate ?? 0}%`,
      sub: "Rate of processed orders",
      icon: Clock,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/20"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => (
        <Card key={index} className="border-none shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-full ${card.bg}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            <p className="text-xs text-muted-foreground flex items-center mt-1">
              {card.sub}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
