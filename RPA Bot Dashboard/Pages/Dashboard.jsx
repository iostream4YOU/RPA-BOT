import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { subDays, isSameDay, parseISO, isAfter, isBefore } from 'date-fns';
import FilterPanel from '@/components/dashboard/FilterPanel';
import KPICards from '@/components/dashboard/KPICards';
import AnalyticsCharts from '@/components/dashboard/AnalyticsCharts';
import AuditTable from '@/components/dashboard/AuditTable';
import { Loader2, Check } from 'lucide-react';

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isCopied, setIsCopied] = useState(false);
  
  // Initial State from URL Params
  const [filters, setFilters] = useState({
    range: searchParams.get('range') || '30days',
    ehr: searchParams.get('ehr') ? searchParams.get('ehr').split(',') : [],
    agency: searchParams.get('agency') || null
  });

  // Sync filters to URL
  useEffect(() => {
    const params = { range: filters.range };
    if (filters.ehr.length > 0) params.ehr = filters.ehr.join(',');
    if (filters.agency) params.agency = filters.agency;
    setSearchParams(params);
  }, [filters, setSearchParams]);

  // Fetch Data
  const { data: allRecords, isLoading, error } = useQuery({
    queryKey: ['auditRecords'],
    queryFn: () => base44.entities.AuditRecord.list({ limit: 1000, sort: { analysis_date: -1 } }),
    initialData: [],
  });

  // Unique Agencies List (Dependent on EHR)
  const agencies = useMemo(() => {
    const source = filters.ehr.length > 0 
      ? allRecords.filter(r => filters.ehr.includes(r.ehr))
      : allRecords;
    const set = new Set(source.map(r => r.agency));
    return Array.from(set).sort();
  }, [allRecords, filters.ehr]);

  // Filtering Logic
  const filteredRecords = useMemo(() => {
    if (!allRecords) return [];
    
    const today = new Date();
    let startDate;
    
    if (filters.range === '7days') startDate = subDays(today, 7);
    else if (filters.range === '30days') startDate = subDays(today, 30);
    else if (filters.range === 'today') startDate = today;
    // 'custom' would need a date picker, assuming all time or handled elsewhere for demo simplicity if custom

    return allRecords.filter(record => {
      const recordDate = parseISO(record.analysis_date);
      
      // Date Filter
      if (filters.range === 'today' && !isSameDay(recordDate, today)) return false;
      if ((filters.range === '7days' || filters.range === '30days') && isBefore(recordDate, startDate)) return false;

      // EHR Filter
      if (filters.ehr.length > 0 && !filters.ehr.includes(record.ehr)) return false;

      // Agency Filter
      if (filters.agency && record.agency !== filters.agency) return false;

      return true;
    });
  }, [allRecords, filters]);

  // Aggregation Logic
  const stats = useMemo(() => {
    if (filteredRecords.length === 0) return {};

    const totalOrders = filteredRecords.reduce((acc, curr) => acc + (curr.orders_to_be_uploaded || 0), 0);
    const uploadedOrders = filteredRecords.reduce((acc, curr) => acc + (curr.orders_uploaded || 0), 0);
    
    // Weighted averages for accuracy
    const avgSuccess = totalOrders ? (uploadedOrders / totalOrders) * 100 : 0;
    const avgFailure = 100 - avgSuccess;

    return {
      total_orders: totalOrders,
      orders_uploaded: uploadedOrders,
      success_rate: avgSuccess,
      failure_rate: avgFailure
    };
  }, [filteredRecords]);

  const dailyTrend = useMemo(() => {
    // Group by date
    const grouped = filteredRecords.reduce((acc, curr) => {
      const date = curr.analysis_date; // Should already be YYYY-MM-DD
      if (!acc[date]) acc[date] = { date, total: 0, uploaded: 0 };
      acc[date].total += curr.orders_to_be_uploaded || 0;
      acc[date].uploaded += curr.orders_uploaded || 0;
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(d => ({
        date: format(parseISO(d.date), 'MMM dd'),
        originalDate: d.date,
        avg_success_rate: d.total ? (d.uploaded / d.total) * 100 : 0,
        uploaded: d.uploaded,
        failed: d.total - d.uploaded
      }));
  }, [filteredRecords]);

  const topRemarks = useMemo(() => {
    const remarkCounts = {};
    filteredRecords.forEach(r => {
      if (r.most_frequent_remark) {
        remarkCounts[r.most_frequent_remark] = (remarkCounts[r.most_frequent_remark] || 0) + 1;
      }
    });
    
    return Object.entries(remarkCounts)
      .map(([remark, count]) => ({ remark, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredRecords]);


  // Handlers
  const handleDownload = () => {
    // Simple CSV conversion
    if (filteredRecords.length === 0) {
      toast.error("No data to download");
      return;
    }
    
    const headers = ["Date", "Agency", "EHR", "Orders Analyzed", "Orders Uploaded", "Success Rate", "Failure Rate", "Remark"];
    const csvContent = [
      headers.join(","),
      ...filteredRecords.map(r => [
        r.analysis_date,
        `"${r.agency}"`,
        r.ehr,
        r.orders_to_be_uploaded,
        r.orders_uploaded,
        r.success_rate.toFixed(2),
        r.failure_rate.toFixed(2),
        `"${r.most_frequent_remark}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `audit_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[80vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        <span className="ml-2 font-medium text-gray-500">Loading analytics...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
          Audit Control Center
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Monitor RPA performance and agency compliance metrics.
        </p>
      </div>

      <FilterPanel 
        filters={filters} 
        setFilters={setFilters} 
        agencies={agencies}
        onDownload={handleDownload}
        onShare={handleShare}
        isCopied={isCopied}
      />

      <KPICards stats={stats} />
      
      <AnalyticsCharts dailyTrend={dailyTrend} topRemarks={topRemarks} />
      
      <AuditTable records={filteredRecords} />
    </div>
  );
}