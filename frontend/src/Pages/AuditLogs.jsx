import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Layout from '@/Layout';
import AuditTable from '@/components/dashboard/AuditTable';
import FilterPanel from '@/components/dashboard/FilterPanel';
import { base44Client } from '@/api/base44Client';
import { Loader2, Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

export default function AuditLogs() {
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    ehr: 'all',
    agency: 'all',
    botType: 'all',
    date: null
  });

  const queryParams = useMemo(() => {
    const params = {};
    if (filters.date) {
      const iso = filters.date.toISOString().slice(0, 10);
      params.start_date = iso;
      params.end_date = iso;
    }
    if (filters.agency && filters.agency !== 'all') params.agency = filters.agency;
    if (filters.botType && filters.botType !== 'all') params.bot_type = filters.botType;
    return params;
  }, [filters.date, filters.agency, filters.botType]);

  const { data: audits, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['auditLogs', queryParams],
    queryFn: () => base44Client.getAuditLogs(queryParams),
    refetchInterval: 30000,
  });

  const filteredAudits = useMemo(() => {
    if (!audits) return [];
    
    return audits.filter(audit => {
      const search = filters.search.toLowerCase();
      const matchesSearch = 
        audit.id.toString().includes(search) ||
        (audit.remarks && audit.remarks.toLowerCase().includes(search));
      
      const matchesStatus = 
        !filters.status || filters.status === 'all' || 
        audit.status.toLowerCase() === filters.status.toLowerCase();

      const matchesEhr = 
        !filters.ehr || filters.ehr === 'all' || 
        audit.ehr === filters.ehr;

      const matchesAgency = 
        !filters.agency || filters.agency === 'all' || 
        audit.agency === filters.agency;

      const matchesBotType =
        !filters.botType || filters.botType === 'all' ||
        (audit.botType || '').toLowerCase() === filters.botType;

      const matchesDate = !filters.date || (() => {
        const auditDate = audit.date ? new Date(audit.date) : null;
        if (!auditDate || Number.isNaN(auditDate.getTime())) return false;
        return isWithinInterval(auditDate, { start: startOfDay(filters.date), end: endOfDay(filters.date) });
      })();

      return matchesSearch && matchesStatus && matchesEhr && matchesAgency && matchesBotType && matchesDate;
    });
  }, [audits, filters]);

  const handleExport = () => {
    if (!filteredAudits.length) return;
    
    const headers = ['ID', 'Agency', 'EHR', 'Bot Type', 'Status', 'Date', 'Remarks', 'Common Failure Reason'];
    const csvContent = [
      headers.join(','),
      ...filteredAudits.map(row => [
        row.id,
        `"${row.agency}"`,
        row.ehr,
        row.botType,
        row.status,
        row.date,
        `"${row.remarks}"`,
        `"${row.commonFailureReason || ''}"`
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
            onClearFilters={() => setFilters({ search: '', status: 'all', ehr: 'all', agency: 'all', botType: 'all', date: null })}
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
