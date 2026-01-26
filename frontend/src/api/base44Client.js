// Helper to extract metadata from nested structures
const extractMetadata = (record) => {
  let agency = record.agency;
  let ehr = record.ehr;
  let remarks = record.error_message;

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

// Aggregate success/failure counts from an audit record
const extractCounts = (record) => {
  const auditResults = record.audit_results || [];
  if (auditResults.length > 0) {
    const successCount = auditResults.reduce((acc, curr) => acc + (curr.stats?.success_count || 0), 0);
    const failureCount = auditResults.reduce((acc, curr) => acc + (curr.stats?.failure_count || 0), 0);
    return { successCount, failureCount };
  }

  if (record.stats) {
    return {
      successCount: record.stats.success_count || 0,
      failureCount: record.stats.failure_count || 0,
    };
  }

  return { successCount: 0, failureCount: 0 };
};

export const base44Client = {
  refreshAuditData: async () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
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

  getDashboardData: async () => {
    try {
      // Add timestamp to prevent caching
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(
        `${backendUrl.replace(/\/$/, '')}/audit-history?limit=100&t=${Date.now()}`,
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
      
      // Calculate stats
      const totalAudits = history.length;
      const successCount = history.filter(r => r.status === 'success').length;
      const failedCount = history.filter(r => r.status === 'failed').length;
      
      // Sort history by timestamp descending to ensure we get the true latest
      const sortedHistory = [...history].sort((a, b) => {
        const dateA = new Date(a.audit_timestamp || a.created_at || a.date || 0);
        const dateB = new Date(b.audit_timestamp || b.created_at || b.date || 0);
        return dateB - dateA;
      });

      let latestAudit = sortedHistory[0] || null;
      let latestStats = null;

      if (latestAudit) {
        // If the history record is missing detailed results, try to fetch the full details
        // Only attempt if we have an ID and missing results
        if ((!latestAudit.audit_results || latestAudit.audit_results.length === 0) && latestAudit.id) {
          try {
            // Attempt to fetch details for this specific audit
            const detailResponse = await fetch(`${backendUrl}/audit-history/${latestAudit.id}`);
            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              // If the detail endpoint returns the full object, merge it into the existing record
              // This ensures the "Recent Audits" list also gets the details
              if (detailData && (detailData.audit_results || detailData.reconciliation_summary)) {
                Object.assign(latestAudit, detailData);
              }
            }
          } catch (err) {
            console.warn("Could not fetch details for latest audit:", err);
          }
        }

        // Try to extract meaningful stats from the complex JSON structure
        const recSummary = latestAudit.reconciliation_summary?.[0] || {};
        const auditResults = latestAudit.audit_results || [];
        
        // Calculate aggregate stats for the latest run
        let totalRows = 0;
        let failureCount = 0;
        let successCountLatest = 0;

        if (auditResults.length > 0) {
          totalRows = auditResults.reduce((acc, curr) => acc + (curr.stats?.total_rows || 0), 0);
          failureCount = auditResults.reduce((acc, curr) => acc + (curr.stats?.failure_count || 0), 0);
          successCountLatest = auditResults.reduce((acc, curr) => acc + (curr.stats?.success_count || 0), 0);
        } else if (latestAudit.reconciliation_summary) {
           // Fallback to reconciliation summary if audit_results are missing
           latestAudit.reconciliation_summary.forEach(rec => {
             totalRows += (rec.signed_total || 0) + (rec.unsigned_total || 0);
             // We can't easily determine success/failure count from just totals without more data, 
             // but we can try to infer or leave as 0 to avoid misleading data.
             // However, the user's JSON shows 'success_rate' in stats, so audit_results is preferred.
           });
        }
        
        const meta = extractMetadata(latestAudit);
        latestStats = {
          agency: meta.agency,
          timestamp: latestAudit.audit_timestamp || latestAudit.created_at || latestAudit.date,
          totalRows,
          successCount: successCountLatest,
          failureCount,
          successRate: totalRows ? Math.round((successCountLatest / totalRows) * 100) : 0,
          failureReasons: auditResults.flatMap(r => r.unique_failure_reasons || []).slice(0, 5) // Top 5 reasons
        };
      }

      return {
        stats: {
          totalAudits,
          successRate: totalAudits ? Math.round((successCount / totalAudits) * 100) : 0,
          failedAudits: failedCount,
          avgTime: "1.2s" // Mock for now
        },
        latestAudit: latestStats,
        recentAudits: sortedHistory.map(record => {
          const meta = extractMetadata(record);
          const counts = extractCounts(record);
          return {
            id: record.id || Math.random().toString(36).substr(2, 9),
            agency: meta.agency,
            ehr: meta.ehr,
            status: record.status === 'success' ? 'Success' : 'Failed',
            date: record.audit_timestamp || record.created_at || record.date,
            successCount: counts.successCount,
            failureCount: counts.failureCount,
            remarks: meta.remarks,
            details: record // Pass the full record for the details view
          };
        })
      };
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      throw error;
    }
  },
  getAuditLogs: async () => {
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const response = await fetch(`${backendUrl}/audit-history?limit=1000&t=${Date.now()}`);
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
        return {
          id: record.id || Math.random().toString(36).substr(2, 9),
          agency: meta.agency,
          ehr: meta.ehr,
          status: record.status === 'success' ? 'Success' : 'Failed',
          date: record.audit_timestamp,
          successCount: counts.successCount,
          failureCount: counts.failureCount,
          remarks: meta.remarks,
          details: record // Pass the full record for the details view
        };
      });
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      throw error;
    }
  }
};
