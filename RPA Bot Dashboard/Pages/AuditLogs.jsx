import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import AuditTable from '@/components/dashboard/AuditTable';
import { Loader2, FileText } from 'lucide-react';

export default function AuditLogs() {
  const { data: records, isLoading } = useQuery({
    queryKey: ['auditRecordsAll'],
    queryFn: () => base44.entities.AuditRecord.list({ limit: 1000, sort: { analysis_date: -1 } }),
    initialData: [],
  });

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
          <FileText className="w-8 h-8 text-indigo-600" />
          Audit Logs
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Full history of all processed agency audits.
        </p>
      </div>

      {isLoading ? (
         <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
         </div>
      ) : (
        <AuditTable records={records} />
      )}
    </div>
  );
}