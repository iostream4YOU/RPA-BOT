import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/Layout';
import AuditTable from '@/components/dashboard/AuditTable';
import FilterPanel from '@/components/dashboard/FilterPanel';
import { base44Client } from '@/api/base44Client';
import { Loader2, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AuditLogs() {
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    ehr: '',
    agency: '',
    date: null
  });

  const { data: audits, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: base44Client.getAuditLogs,
    refetchInterval: 30000,
  });

  const filteredAudits = useMemo(() => {
    if (!audits) return [];
    
    return audits.filter(audit => {
      const matchesSearch = 
        audit.id.toString().includes(filters.search) ||
        (audit.remarks && audit.remarks.toLowerCase().includes(filters.search.toLowerCase()));
      
      const matchesStatus = 
        !filters.status || filters.status === 'all' || 
        audit.status.toLowerCase() === filters.status.toLowerCase();

      const matchesEhr = 
        !filters.ehr || filters.ehr === 'all' || 
        audit.ehr === filters.ehr;

      const matchesAgency = 
        !filters.agency || filters.agency === 'all' || 
        audit.agency === filters.agency;

      const matchesDate = !filters.date || (
        new Date(audit.date).toDateString() === filters.date.toDateString()
      );

      return matchesSearch && matchesStatus && matchesEhr && matchesAgency && matchesDate;
    });
  }, [audits, filters]);

  const handleExport = () => {
    if (!filteredAudits.length) return;
    
    const headers = ['ID', 'Agency', 'EHR', 'Status', 'Date', 'Remarks'];
    const csvContent = [
      headers.join(','),
      ...filteredAudits.map(row => [
        row.id,
        `"${row.agency}"`,
        row.ehr,
        row.status,
        row.date,
        `"${row.remarks}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <Layout currentPageName="Audit Logs">
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout currentPageName="Audit Logs">
        <div className="p-8 text-center text-red-500">
          Error loading audit logs. Please try again later.
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPageName="Audit Logs">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Audit Logs
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Complete history of all RPA bot executions and audits.
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              {isRefetching ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          <FilterPanel 
            filters={filters} 
            setFilters={setFilters}
            onClearFilters={() => setFilters({ search: '', status: '', ehr: '', date: null })}
          />
          
          <div className="text-sm text-slate-500 dark:text-slate-400">
            Showing {filteredAudits.length} records
          </div>

          <AuditTable data={filteredAudits} />
        </div>
      </div>
    </Layout>
  );
}
