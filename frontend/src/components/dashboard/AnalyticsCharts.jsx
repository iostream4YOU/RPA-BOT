import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import { format, subDays, isSameDay } from 'date-fns';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-800 p-3 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
        <p className="font-medium text-slate-900 dark:text-slate-50 mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-500 dark:text-slate-400 capitalize">{entry.name}:</span>
            <span className="font-medium text-slate-900 dark:text-slate-50">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsCharts({ audits }) {
  const { activityData, ehrDistribution } = useMemo(() => {
    const recentAudits = audits || [];

    const last7Days = Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i));

    const activity = last7Days.map(date => {
      const dayAudits = recentAudits.filter(audit => {
        const auditDate = new Date(audit.date);
        return isSameDay(auditDate, date);
      });

      return {
        date: format(date, 'MMM dd'),
        success: dayAudits.filter(a => a.status === 'Success').length,
        failed: dayAudits.filter(a => a.status === 'Failed').length,
        total: dayAudits.length
      };
    });

    const ehrCounts = recentAudits.reduce((acc, audit) => {
      const ehr = audit.ehr || 'Unknown';
      acc[ehr] = (acc[ehr] || 0) + 1;
      return acc;
    }, {});

    const distribution = Object.entries(ehrCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { activityData: activity, ehrDistribution: distribution };
  }, [audits]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <Card className="col-span-1 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Audit Activity
          </CardTitle>
          <CardDescription>
            Success vs Failure trends over the last 7 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorSuccess" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorFailed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#64748b', fontSize: 12 }} 
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="success" 
                  name="Success"
                  stroke="#10b981" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorSuccess)" 
                />
                <Area 
                  type="monotone" 
                  dataKey="failed" 
                  name="Failed"
                  stroke="#ef4444" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorFailed)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card className="col-span-1 shadow-sm hover:shadow-md transition-shadow duration-200">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            EHR Distribution
          </CardTitle>
          <CardDescription>
            Breakdown of audits by EHR system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] w-full relative">
                  {ehrDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ehrDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {ehrDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend 
                    verticalAlign="middle" 
                    align="right"
                    layout="vertical"
                    iconType="circle"
                    formatter={(value, entry) => (
                      <span className="text-slate-600 dark:text-slate-300 ml-2">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                No data available
              </div>
            )}
                  {ehrDistribution.length > 0 && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                      <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                        {audits?.length || 0}
                      </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Total Audits</div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
