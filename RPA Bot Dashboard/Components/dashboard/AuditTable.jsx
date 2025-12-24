import React from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';

export default function AuditTable({ records }) {
  return (
    <Card className="border-none shadow-sm bg-white dark:bg-slate-900 overflow-hidden">
      <CardHeader className="border-b border-gray-100 dark:border-slate-800">
        <CardTitle className="text-lg font-semibold">Detailed Audit Records</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50 dark:bg-slate-800/50">
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Agency</TableHead>
                <TableHead>EHR System</TableHead>
                <TableHead className="text-right">Success %</TableHead>
                <TableHead className="text-right">Failure %</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead>Most Frequent Remark</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records && records.length > 0 ? (
                records.map((record, i) => (
                  <TableRow key={i} className="hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors">
                    <TableCell className="font-medium text-gray-600 dark:text-gray-300">
                      {format(new Date(record.analysis_date), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell className="font-semibold">{record.agency}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800">
                        {record.ehr}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={record.success_rate >= 90 ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                        {record.success_rate?.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={record.failure_rate > 5 ? 'text-red-500 font-medium' : 'text-gray-500'}>
                         {record.failure_rate?.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right text-gray-600">
                        {record.orders_uploaded} / {record.orders_to_be_uploaded}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-gray-500 text-sm" title={record.most_frequent_remark}>
                      {record.most_frequent_remark || '-'}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                 <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                       No records found for the selected filters.
                    </TableCell>
                 </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}