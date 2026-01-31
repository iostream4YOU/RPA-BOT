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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    return params;
  }, [filters.date, filters.agency, filters.botType]);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['dashboardData', queryParams],
    queryFn: () => base44Client.getDashboardData(queryParams),
    refetchInterval: 30000, // Real-time refresh every 30s
  });

  const { data: credsHealth } = useQuery({
    queryKey: ['credentialsHealth'],
    queryFn: base44Client.getCredentialHealth,
    refetchInterval: 60000,
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

        {credsHealth && (
          <Card className="border border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm">Credential Health</CardTitle>
              <Badge variant={credsHealth.status === 'ok' ? 'success' : 'destructive'}>
                {credsHealth.status === 'ok' ? 'Healthy' : 'Attention needed'}
              </Badge>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {Object.entries(credsHealth.checks || {}).map(([key, val]) => (
                <div key={key} className="flex items-center justify-between rounded-lg border border-slate-100 dark:border-slate-800 px-3 py-2 bg-slate-50/60 dark:bg-slate-900/60">
                  <span className="text-sm text-slate-600 dark:text-slate-300 capitalize">{key.replace(/_/g, ' ')}</span>
                  <Badge variant={val.status === 'ok' ? 'success' : val.status === 'degraded' ? 'secondary' : 'destructive'}>
                    {val.status}
                  </Badge>
                </div>
              ))}
              {!credsHealth.checks && (
                <div className="text-sm text-slate-500">No credential data available</div>
              )}
            </CardContent>
          </Card>
        )}

        <KPICards stats={derivedStats} />
        {latestAudit && <LatestAuditSummary audit={latestAudit} />}
        <AnalyticsCharts audits={filteredAudits} />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">Recent Audits</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Filter by status, bot type, date, and agency. Top failure reasons reflect current filters.</p>
            </div>
          </div>

          <FilterPanel 
            filters={filters} 
            setFilters={setFilters}
            onClearFilters={() => setFilters({ search: '', status: 'all', ehr: 'all', agency: 'all', botType: 'all', date: null })}
          />
          
          <AuditTable data={filteredAudits} />
        </div>
      </div>
    </Layout>
  );
}
