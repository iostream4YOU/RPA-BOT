import React from 'react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function AnalyticsCharts({ dailyTrend, topRemarks }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      {/* Daily Success Trend - Line Chart */}
      <Card className="border-none shadow-sm bg-white dark:bg-slate-900 col-span-1 lg:col-span-2 xl:col-span-1">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Daily Success Rate Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 12}}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 12}}
                domain={[0, 100]}
                tickFormatter={(val) => `${val}%`}
              />
              <Tooltip 
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                cursor={{stroke: '#6366f1', strokeWidth: 2}}
              />
              <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
              <Line 
                type="monotone" 
                dataKey="avg_success_rate" 
                name="Success Rate" 
                stroke="#6366f1" 
                strokeWidth={3} 
                dot={{r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff'}}
                activeDot={{r: 6}}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Failure Remarks - Horizontal Bar Chart */}
      <Card className="border-none shadow-sm bg-white dark:bg-slate-900">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Top 5 Failure Remarks</CardTitle>
        </CardHeader>
        <CardContent className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={topRemarks} margin={{left: 0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="remark" 
                type="category" 
                width={150} 
                tick={{fill: '#64748b', fontSize: 11}} 
                interval={0}
              />
              <Tooltip 
                 cursor={{fill: 'rgba(226, 232, 240, 0.4)'}}
                 contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
              />
              <Bar 
                dataKey="count" 
                name="Count" 
                fill="#f43f5e" 
                radius={[0, 4, 4, 0]} 
                barSize={24}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Stacked Bar: Success vs Failure counts per day */}
       <Card className="border-none shadow-sm bg-white dark:bg-slate-900 col-span-1 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Processed Orders Volume</CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 12}}
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#94a3b8', fontSize: 12}}
              />
              <Tooltip 
                contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                cursor={{fill: 'rgba(226, 232, 240, 0.4)'}}
              />
              <Legend iconType="circle" wrapperStyle={{paddingTop: '20px'}} />
              <Bar dataKey="uploaded" name="Uploaded (Success)" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} barSize={30} />
              <Bar dataKey="failed" name="Failed/Pending" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={30} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}