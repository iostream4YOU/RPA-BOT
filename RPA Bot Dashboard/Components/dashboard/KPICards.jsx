import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowUpRight, ArrowDownRight, CheckCircle2, AlertCircle, FileText, UploadCloud } from 'lucide-react';

export default function KPICards({ stats }) {
  const items = [
    {
      title: "Avg Success Rate",
      value: `${stats.success_rate?.toFixed(1)}%`,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-100 dark:bg-emerald-900/20",
      trend: stats.success_rate > 90 ? "positive" : "neutral"
    },
    {
      title: "Avg Failure Rate",
      value: `${stats.failure_rate?.toFixed(1)}%`,
      icon: AlertCircle,
      color: "text-rose-600 dark:text-rose-400",
      bgColor: "bg-rose-100 dark:bg-rose-900/20",
      trend: stats.failure_rate < 5 ? "positive" : "negative"
    },
    {
      title: "Total Orders Analyzed",
      value: stats.total_orders?.toLocaleString(),
      icon: FileText,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
      trend: "neutral"
    },
    {
      title: "Orders Uploaded",
      value: stats.orders_uploaded?.toLocaleString(),
      icon: UploadCloud,
      color: "text-indigo-600 dark:text-indigo-400",
      bgColor: "bg-indigo-100 dark:bg-indigo-900/20",
      trend: "positive"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {items.map((item, idx) => (
        <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-900">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.title}</p>
                <h3 className="text-2xl font-bold mt-2 text-gray-900 dark:text-white">{item.value}</h3>
              </div>
              <div className={`p-3 rounded-xl ${item.bgColor}`}>
                <item.icon className={`w-5 h-5 ${item.color}`} />
              </div>
            </div>
            {/* Optional Trend Indicator */}
            <div className="flex items-center mt-4 text-xs font-medium">
              {item.trend === 'positive' && (
                <span className="text-emerald-600 flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> Trending up
                </span>
              )}
              {item.trend === 'negative' && (
                <span className="text-rose-600 flex items-center gap-1">
                  <ArrowDownRight className="w-3 h-3" /> Attention needed
                </span>
              )}
              {item.trend === 'neutral' && (
                <span className="text-gray-500 dark:text-gray-400">
                  Since last update
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}