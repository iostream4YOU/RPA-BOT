import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, FileText, Clock } from 'lucide-react';
import { format } from 'date-fns';

export default function LatestAuditSummary({ audit }) {
  if (!audit) return null;

  return (
    <Card className="mb-6 border-l-4 border-l-indigo-500 shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                Latest Audit
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {audit.timestamp ? format(new Date(audit.timestamp), 'MMM dd, yyyy HH:mm:ss') : 'Just now'}
              </span>
            </div>
            <CardTitle className="text-xl">
              {audit.agency} Processing Summary
            </CardTitle>
            <CardDescription>
              Real-time snapshot of the most recent document processing batch.
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">{audit.totalRows}</div>
            <div className="text-xs text-muted-foreground">Total Rows Processed</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-2">
          {/* Success Rate */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Success Rate</span>
              <span className="font-medium text-green-600">{audit.successRate}%</span>
            </div>
            <Progress value={audit.successRate} className="h-2 bg-green-100" indicatorClassName="bg-green-600" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <CheckCircle2 className="w-3 h-3 text-green-600" />
              {audit.successCount} successful records
            </div>
          </div>

          {/* Failure Rate */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Failure Rate</span>
              <span className="font-medium text-red-600">{100 - audit.successRate}%</span>
            </div>
            <Progress value={100 - audit.successRate} className="h-2 bg-red-100" indicatorClassName="bg-red-600" />
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <AlertTriangle className="w-3 h-3 text-red-600" />
              {audit.failureCount} failed records
            </div>
          </div>

          {/* Top Issues */}
          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-md p-3">
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-1">
              <FileText className="w-3 h-3" />
              Top Failure Reasons
            </h4>
            <div className="space-y-1">
              {audit.failureReasons && audit.failureReasons.length > 0 ? (
                [...new Set(audit.failureReasons)].slice(0, 3).map((reason, idx) => (
                  <div key={idx} className="text-xs truncate text-slate-700 dark:text-slate-300" title={reason}>
                    • {reason}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground italic">No failures reported</div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
