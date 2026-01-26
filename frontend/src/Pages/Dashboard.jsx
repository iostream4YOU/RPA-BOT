import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import Layout from '@/Layout';
import KPICards from '@/components/dashboard/KPICards';
import LatestAuditSummary from '@/components/dashboard/LatestAuditSummary';
import AnalyticsCharts from '@/components/dashboard/AnalyticsCharts';
import AuditTable from '@/components/dashboard/AuditTable';
import FilterPanel from '@/components/dashboard/FilterPanel';
import { base44Client } from '@/api/base44Client';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    ehr: 'all',
    agency: 'all',
    date: null
  });

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: base44Client.getDashboardData,
    refetchInterval: 30000, // Real-time refresh every 30s
  });

  const refreshMutation = useMutation({
    mutationFn: base44Client.refreshAuditData,
    onSuccess: () => refetch(),
  });

  const filteredAudits = React.useMemo(() => {
    const audits = data?.recentAudits || [];
    const search = filters.search.toLowerCase();

    return audits.filter(audit => {
      const matchesSearch =
        audit.id.toString().includes(search) ||
        (audit.agency || '').toLowerCase().includes(search) ||
        (audit.ehr || '').toLowerCase().includes(search) ||
        (audit.remarks || '').toLowerCase().includes(search);

      const matchesStatus =
        filters.status === 'all' ||
        audit.status.toLowerCase() === filters.status.toLowerCase();

      const matchesEhr =
        filters.ehr === 'all' || audit.ehr === filters.ehr;

      const matchesAgency =
        filters.agency === 'all' || audit.agency === filters.agency;

      const matchesDate = !filters.date || (
        new Date(audit.date).toDateString() === filters.date.toDateString()
      );

      return matchesSearch && matchesStatus && matchesEhr && matchesAgency && matchesDate;
    });
  }, [data, filters]);

  const derivedStats = React.useMemo(() => {
    const audits = filteredAudits;
    const totalAudits = audits.length;
    const successSum = audits.reduce((acc, a) => acc + (a.successCount || 0), 0);
    const failureSum = audits.reduce((acc, a) => acc + (a.failureCount || 0), 0);
    const totalRows = successSum + failureSum;
    const successRate = totalRows ? Math.round((successSum / totalRows) * 100) : 0;
    const failedAudits = audits.filter(a => a.status.toLowerCase() === 'failed').length;
    return {
      totalAudits,
      successRate,
      failedAudits,
      avgTime: data?.stats?.avgTime || '~',
    };
  }, [filteredAudits, data]);

  const latestAudit = React.useMemo(() => {
    if (!filteredAudits.length) return null;
    const sorted = [...filteredAudits].sort((a, b) => new Date(b.date) - new Date(a.date));
    const top = sorted[0];
    const successRate = top.totalRows
      ? Math.round(((top.successCount || 0) / top.totalRows) * 100)
      : (top.successRate ?? 0);
    const failureReasons = top.details?.audit_results
      ? top.details.audit_results.flatMap(r => r.unique_failure_reasons || [])
      : top.failureReasons || [];
    return {
      agency: top.agency,
      timestamp: top.date,
      totalRows: top.successCount + top.failureCount,
      successCount: top.successCount,
      failureCount: top.failureCount,
      successRate: successRate,
      failureReasons,
    };
  }, [filteredAudits]);

  if (isLoading) {
    return (
      <Layout currentPageName="Dashboard">
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout currentPageName="Dashboard">
        <div className="p-8 text-center text-red-500">
          Error loading dashboard data. Please try again later.
        </div>
      </Layout>
    );
  }

  return (
    <Layout currentPageName="Dashboard">
      <div className="p-6 max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
              Dashboard
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">
              Real-time overview of RPA bot performance and audit logs.
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refreshMutation.mutate()}
            disabled={isRefetching || refreshMutation.isLoading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${(isRefetching || refreshMutation.isLoading) ? 'animate-spin' : ''}`} />
            {(isRefetching || refreshMutation.isLoading) ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>

        {latestAudit && <LatestAuditSummary audit={latestAudit} />}

        <KPICards stats={derivedStats} />
        
        <AnalyticsCharts audits={filteredAudits} />

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Recent Audits
          </h2>
          
          <FilterPanel 
            filters={filters} 
            setFilters={setFilters}
            onClearFilters={() => setFilters({ search: '', status: 'all', ehr: 'all', agency: 'all', date: null })}
          />
          
          <AuditTable data={filteredAudits} />
        </div>
      </div>
    </Layout>
  );
}
