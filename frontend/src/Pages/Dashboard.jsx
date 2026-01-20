import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
    status: '',
    ehr: '',
    agency: '',
    date: null
  });

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['dashboardData'],
    queryFn: base44Client.getDashboardData,
    refetchInterval: 30000, // Real-time refresh every 30s
  });

  const filteredAudits = React.useMemo(() => {
    if (!data?.recentAudits) return [];
    
    return data.recentAudits.filter(audit => {
      const matchesSearch = 
        audit.id.toString().includes(filters.search) ||
        audit.agency.toLowerCase().includes(filters.search.toLowerCase()) ||
        audit.ehr.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesStatus = 
        !filters.status || filters.status === 'all' || 
        audit.status.toLowerCase() === filters.status.toLowerCase();

      const matchesEhr = 
        !filters.ehr || filters.ehr === 'all' || 
        audit.ehr === filters.ehr;

      const matchesAgency = 
        !filters.agency || filters.agency === 'all' || 
        audit.agency === filters.agency;

      // Simple date match (checking if same day)
      const matchesDate = !filters.date || (
        new Date(audit.date).toDateString() === filters.date.toDateString()
      );

      return matchesSearch && matchesStatus && matchesEhr && matchesAgency && matchesDate;
    });
  }, [data, filters]);

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
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            {isRefetching ? 'Refreshing...' : 'Refresh Data'}
          </Button>
        </div>

        {data.latestAudit && <LatestAuditSummary audit={data.latestAudit} />}

        <KPICards stats={data.stats} />
        
        <AnalyticsCharts data={data} />

        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            Recent Audits
          </h2>
          
          <FilterPanel 
            filters={filters} 
            setFilters={setFilters}
            onClearFilters={() => setFilters({ search: '', status: '', ehr: '', date: null })}
          />
          
          <AuditTable data={filteredAudits} />
        </div>
      </div>
    </Layout>
  );
}
