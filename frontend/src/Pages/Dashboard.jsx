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
import { Badge } from '@/components/ui/badge';
import { startOfDay, endOfDay, isWithinInterval } from 'date-fns';

export default function Dashboard() {
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    ehr: 'all',
    agency: 'all',
    botType: 'all',
    date: null
  });

  const queryParams = React.useMemo(() => {
    const params = {};
    if (filters.date) {
      const iso = filters.date.toISOString().slice(0, 10);
      params.start_date = iso;
      params.end_date = iso;
    }
    if (filters.agency && filters.agency !== 'all') params.agency = filters.agency;
    if (filters.botType && filters.botType !== 'all') params.bot_type = filters.botType;
    if (filters.dateRange) {
      params.start_date = filters.dateRange.start;
      params.end_date = filters.dateRange.end;
    }
    return params;
  }, [filters.date, filters.agency, filters.botType, filters.dateRange]);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['dashboardData', queryParams],
    queryFn: () => base44Client.getDashboardData(queryParams),
    refetchInterval: 30000, // Real-time refresh every 30s
    keepPreviousData: true, // avoid empty/loading flicker on filter change
    placeholderData: (prev) => prev, // show last data while new fetch resolves
    refetchOnWindowFocus: false,
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

      const matchesBotType =
        filters.botType === 'all' || (audit.botType || '').toLowerCase() === filters.botType;

      const matchesDate = !filters.date || (() => {
        const auditDate = audit.date ? new Date(audit.date) : null;
        if (!auditDate || Number.isNaN(auditDate.getTime())) return false;
        return isWithinInterval(auditDate, { start: startOfDay(filters.date), end: endOfDay(filters.date) });
      })();

      return matchesSearch && matchesStatus && matchesEhr && matchesAgency && matchesBotType && matchesDate;
    });
  }, [data, filters]);

  const derivedStats = React.useMemo(() => {
    const audits = filteredAudits;
    const successSum = audits.reduce((acc, a) => acc + (a.successCount || 0), 0);
    const failureSum = audits.reduce((acc, a) => acc + (a.failureCount || 0), 0);
    const totalRows = successSum + failureSum;
    const successRate = totalRows ? Math.round((successSum / totalRows) * 100) : 0;
    return {
      totalOrders: totalRows,
      successOrders: successSum,
      failureOrders: failureSum,
      successRate,
      avgTime: data?.stats?.avgTime || '~',
    };
  }, [filteredAudits, data]);

  const overallSummary = React.useMemo(() => {
    if (!filteredAudits.length) return null;

    const successCount = filteredAudits.reduce((acc, a) => acc + (a.successCount || 0), 0);
    const failureCount = filteredAudits.reduce((acc, a) => acc + (a.failureCount || 0), 0);
    const totalRows = successCount + failureCount;
    const successRate = totalRows ? Math.round((successCount / totalRows) * 100) : 0;

    const failureReasons = filteredAudits.flatMap(a => {
      if (a.details?.audit_results) {
        return a.details.audit_results.flatMap(r => r.unique_failure_reasons || []);
      }
      return a.failureReasons || [];
    });

    const dates = filteredAudits
      .map(a => (a.date ? new Date(a.date) : null))
      .filter(Boolean)
      .sort((a, b) => a - b);
    const rangeLabel = dates.length
      ? `${startOfDay(dates[0]).toLocaleDateString()} — ${endOfDay(dates[dates.length - 1]).toLocaleDateString()}`
      : 'Across current filters';

    return {
      totalRows,
      successCount,
      failureCount,
      successRate,
      failureReasons,
      rangeLabel,
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
        <FilterPanel 
          filters={filters} 
          setFilters={setFilters}
          onClearFilters={() => setFilters({ search: '', status: 'all', ehr: 'all', agency: 'all', botType: 'all', date: null })}
        />

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-slate-900 text-white shadow-lg">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(255,255,255,0.15),transparent_25%)]" />
          <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="uppercase text-xs tracking-[0.25em] text-slate-100/80">RPA Auditor</p>
              <h1 className="text-3xl md:text-4xl font-semibold mt-2">Audit Health Dashboard</h1>
              <p className="text-slate-100/80 mt-2 max-w-2xl">Filtered, real-time telemetry with top failure reasons and bot-type visibility.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary"
                size="sm"
                className="bg-white/10 backdrop-blur border border-white/20 hover:bg-white/20"
                onClick={() => refreshMutation.mutate()}
                disabled={isRefetching || refreshMutation.isLoading}
              >
                <RefreshCw className={`mr-2 h-4 w-4 ${(isRefetching || refreshMutation.isLoading) ? 'animate-spin' : ''}`} />
                {(isRefetching || refreshMutation.isLoading) ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
          {data?.topFailureReasons?.length ? (
            <div className="relative border-t border-white/10 px-6 md:px-8 pb-6 flex flex-wrap gap-2">
              {data.topFailureReasons.map(([reason, count]) => (
                <Badge key={reason} variant="secondary" className="bg-white/15 text-white border-white/20 capitalize">
                  {reason} — {count}
                </Badge>
              ))}
            </div>
          ) : null}
        </div>

        <KPICards stats={derivedStats} />
        {overallSummary && <LatestAuditSummary audit={overallSummary} variant="overall" />}
        <AnalyticsCharts audits={filteredAudits} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Recent Audits</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Filter by status, bot type, date, and agency. Top failure reasons reflect current filters.</p>
            </div>
          </div>

          <AuditTable data={filteredAudits} />
        </div>
      </div>
    </Layout>
  );
}
