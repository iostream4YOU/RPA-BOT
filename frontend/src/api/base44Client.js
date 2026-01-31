// Helper to extract metadata from nested structures
const extractMetadata = (record) => {
  let agency = record.agency;
  let ehr = record.ehr;
  let remarks = record.error_message || record.remark;

  // If top-level fields are missing, try to find them in audit_results
  if ((!agency || agency === "Unknown") && record.audit_results && record.audit_results.length > 0) {
    const firstResult = record.audit_results[0];
    agency = firstResult.agency;
    ehr = firstResult.ehr;
    
    // Construct remarks from failure reasons if not present
    if (!remarks && firstResult.unique_failure_reasons && firstResult.unique_failure_reasons.length > 0) {
       remarks = `${firstResult.unique_failure_reasons.length} issues: ${firstResult.unique_failure_reasons.slice(0, 2).join(", ")}`;
       if (firstResult.unique_failure_reasons.length > 2) remarks += "...";
    }
  }
  
  return {
    agency: agency || "Unknown",
    ehr: ehr || "Unknown",
    remarks: remarks || "No issues found"
  };
};

const deriveDate = (record) => {
  return record.audit_timestamp || record.timestamp || record.created_at || record.date || record.run_date;
};

const collectFailureCounts = (record) => {
  const counts = { ...(record.failure_reason_counts || {}) };

  const mergeCounts = (source) => {
    if (!source) return;
    Object.entries(source).forEach(([reason, count]) => {
      if (!reason) return;
      counts[reason] = (counts[reason] || 0) + (count || 0);
    });
  };

  mergeCounts(record.stats?.failure_reason_counts);

  (record.audit_results || []).forEach(result => {
    mergeCounts(result.stats?.failure_reason_counts);
  });

  return counts;
};

const deriveCommonFailureReason = (record) => {
  const counts = collectFailureCounts(record);
  const sorted = Object.entries(counts).sort((a, b) => (b[1] || 0) - (a[1] || 0));
  if (sorted.length > 0) return sorted[0][0];

  const reasonsFromResults = (record.audit_results || [])
    .flatMap(r => r.unique_failure_reasons || r.stats?.unique_failure_reasons || []);
  if (reasonsFromResults.length > 0) return reasonsFromResults[0];

  const reasons = record.unique_failure_reasons || record.failure_reasons || [];
  if (reasons.length > 0) return reasons[0];

  return record.error_message || record.remark || "—";
};

// Aggregate success/failure counts from an audit record
const extractCounts = (record) => {
  const auditResults = record.audit_results || [];
  if (auditResults.length > 0) {
    const successCount = auditResults.reduce((acc, curr) => acc + (curr.stats?.success_count || 0), 0);
    const failureCount = auditResults.reduce((acc, curr) => acc + (curr.stats?.failure_count || 0), 0);
    const totalRows = auditResults.reduce((acc, curr) => acc + (curr.stats?.total_rows || 0), 0) || successCount + failureCount;
    return { successCount, failureCount, totalRows };
  }

  if (record.stats) {
    const successCount = record.stats.success_count || record.stats.signed_count || 0;
    const failureCount = record.stats.failure_count || record.stats.unsigned_count || 0;
    const totalRows = record.stats.total_rows || record.orders_total || successCount + failureCount;
    return { successCount, failureCount, totalRows };
  }

  const successCount = record.orders_processed || 0;
  const totalRows = record.orders_total || successCount;
  const failureCount = Math.max(totalRows - successCount, 0);
  return { successCount, failureCount, totalRows };
};

const deriveStatusAndRates = (record, counts) => {
  const totalRows = counts.totalRows || (counts.successCount + counts.failureCount);
  const successRate = totalRows ? Math.round((counts.successCount / totalRows) * 100) : Math.round(record.success_rate || 0);
  const failureRate = totalRows ? Math.round((counts.failureCount / totalRows) * 100) : Math.round(record.failure_rate || 0);

  const rawStatus = (record.status || "").toLowerCase();
  const computedStatus = totalRows === 0
    ? "Pending"
    : (counts.failureCount > counts.successCount ? "Failed" : "Success");

  if (rawStatus === "success") return { status: "Success", successRate, failureRate };
  if (rawStatus === "failed") {
    const hasMostlySuccess = counts.successCount >= counts.failureCount && counts.successCount > 0;
    return { status: hasMostlySuccess ? "Success" : "Failed", successRate, failureRate };
  }

  return { status: computedStatus, successRate, failureRate };
};

const buildQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") return;
    search.append(key, value);
  });
  return search.toString();
};

export const base44Client = {
  _baseUrl() {
    const envUrl = (import.meta.env.VITE_BACKEND_URL || '').trim();
    if (envUrl) return envUrl.replace(/\/$/, '');
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin.replace(/\/$/, '');
    }
    return '';
  },

  refreshAuditData: async () => {
    const backendUrl = base44Client._baseUrl();
    const response = await fetch(
      `${backendUrl.replace(/\/$/, '')}/audit-agency-data`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true'
        },
        body: JSON.stringify({})
      }
    );
    if (!response.ok) throw new Error('Failed to refresh audit data');
    return response.json();
  },

  getDashboardData: async (filters = {}) => {
    try {
      // Add timestamp to prevent caching
      const backendUrl = base44Client._baseUrl();
      const query = buildQueryString(filters);
      const response = await fetch(
        `${backendUrl.replace(/\/$/, '')}/audit-history?limit=100&t=${Date.now()}${query ? `&${query}` : ''}`,
        {
          headers: {
            'ngrok-skip-browser-warning': 'true'
          }
        }
      );
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      // Handle different response structures
      let history = data.history;
      if (!history && (data.audit_results || data.status)) {
        // If the endpoint returns a single audit record directly
        history = [data];
      }
      history = history || [];
      
      // Sort history by timestamp descending to ensure we get the true latest
      const sortedHistory = [...history].sort((a, b) => {
        const dateA = new Date(deriveDate(a) || 0);
        const dateB = new Date(deriveDate(b) || 0);
        return dateB - dateA;
      });

      const normalized = sortedHistory.map(record => {
        const meta = extractMetadata(record);
        const counts = extractCounts(record);
        const statusData = deriveStatusAndRates(record, counts);
        const failureReasons = (record.audit_results || []).flatMap(r => r.unique_failure_reasons || r.stats?.unique_failure_reasons || []);
        const totalRows = counts.totalRows || (counts.successCount + counts.failureCount);
        const botType = record.bot_type || record.template_type || record.details?.bot_type || "mixed";
        return {
          id: record.id || Math.random().toString(36).substr(2, 9),
          agency: meta.agency,
          ehr: meta.ehr,
          botType,
          status: statusData.status,
          date: deriveDate(record),
          successCount: counts.successCount,
          failureCount: counts.failureCount,
          successRate: statusData.successRate,
          failureRate: statusData.failureRate,
          totalRows,
          commonFailureReason: deriveCommonFailureReason(record),
          failureReasons,
          remarks: meta.remarks,
          details: record // Pass the full record for the details view
        };
      });

      const totalAudits = normalized.length;
      const successCount = normalized.filter(r => r.status === 'Success').length;
      const failedCount = normalized.filter(r => r.status === 'Failed').length;

      const latestAudit = normalized[0];
      const latestStats = latestAudit
        ? {
            agency: latestAudit.agency,
            timestamp: latestAudit.date,
            totalRows: latestAudit.totalRows,
            successCount: latestAudit.successCount,
            failureCount: latestAudit.failureCount,
            successRate: latestAudit.successRate,
            failureReasons: latestAudit.failureReasons?.slice(0, 5) || []
          }
        : null;

      return {
        stats: {
          totalAudits,
          successRate: totalAudits ? Math.round((successCount / totalAudits) * 100) : 0,
          failedAudits: failedCount,
          avgTime: "1.2s" // Mock for now
        },
        latestAudit: latestStats,
        recentAudits: normalized,
        topFailureReasons: data.top_failure_reasons || []
      };
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      throw error;
    }
  },
  getAuditLogs: async (filters = {}) => {
    try {
      const backendUrl = base44Client._baseUrl();
      const query = buildQueryString(filters);
      const response = await fetch(`${backendUrl}/audit-history?limit=1000&t=${Date.now()}${query ? `&${query}` : ''}`);
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      
      let history = data.history;
      if (!history && (data.audit_results || data.status)) {
        history = [data];
      }
      history = history || [];

      return history.map(record => {
        const meta = extractMetadata(record);
        const counts = extractCounts(record);
        const statusData = deriveStatusAndRates(record, counts);
        const failureReasons = (record.audit_results || []).flatMap(r => r.unique_failure_reasons || r.stats?.unique_failure_reasons || []);
        return {
          id: record.id || Math.random().toString(36).substr(2, 9),
          agency: meta.agency,
          ehr: meta.ehr,
          botType: record.bot_type || record.template_type || record.details?.bot_type || "mixed",
          status: statusData.status,
          date: deriveDate(record),
          successCount: counts.successCount,
          failureCount: counts.failureCount,
          successRate: statusData.successRate,
          failureRate: statusData.failureRate,
          totalRows: counts.totalRows || (counts.successCount + counts.failureCount),
          commonFailureReason: deriveCommonFailureReason(record),
          failureReasons,
          remarks: meta.remarks,
          details: record // Pass the full record for the details view
        };
      });
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      throw error;
    }
  },

  getCredentialHealth: async () => {
    const backendUrl = base44Client._baseUrl();
    const response = await fetch(`${backendUrl}/credentials-health?t=${Date.now()}`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    });
    if (!response.ok) throw new Error('Failed to fetch credentials health');
    return response.json();
  }
};
