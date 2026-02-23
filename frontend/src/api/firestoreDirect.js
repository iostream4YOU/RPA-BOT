import { initializeApp, getApps } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as qLimit,
  orderBy,
  query,
} from 'firebase/firestore';

const env = (key) => (import.meta?.env?.[key] || '').toString().trim();

const firebaseConfig = {
  apiKey: env('VITE_FIREBASE_API_KEY'),
  authDomain: env('VITE_FIREBASE_AUTH_DOMAIN'),
  projectId: env('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: env('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: env('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: env('VITE_FIREBASE_APP_ID'),
};

function isConfigured() {
  // Minimal required fields for Firestore Web SDK
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

function shouldUseDirectFirestore() {
  const flag = env('VITE_USE_FIRESTORE_DIRECT').toLowerCase();
  if (flag === '0' || flag === 'false' || flag === 'no') return false;
  // Default: only enable if config is present.
  return isConfigured();
}

function getDb() {
  if (!isConfigured()) {
    throw new Error('Direct Firestore is not configured (missing VITE_FIREBASE_* env vars).');
  }
  if (!getApps().length) initializeApp(firebaseConfig);
  return getFirestore();
}

function asIso(ts) {
  if (!ts) return null;
  // Firestore Timestamp has toDate(); backend sometimes stores ISO strings.
  if (typeof ts?.toDate === 'function') return ts.toDate().toISOString();
  if (typeof ts === 'string') return ts;
  if (ts instanceof Date) return ts.toISOString();
  return null;
}

function sanitizeReason(reason, remark) {
  const text = (reason || '').toString().trim() || (remark || '').toString().trim();
  const lowered = text.toLowerCase();
  if (['batch summary', 'summary', 'batchsummary'].includes(lowered)) return null;
  return text || null;
}

function deriveStatusFromCounts(ordersTotal, ordersProcessed) {
  return ordersTotal > 0 && ordersProcessed >= ordersTotal ? 'success' : 'failed';
}

function mapRunToHistory(runId, data, orders = null) {
  const tsIso = asIso(data.timestamp) || data.timestamp_iso || data.run_date || new Date().toISOString();

  let ordersTotal = Number(data.orders_total || 0);
  let ordersProcessed = Number(data.orders_processed || 0);
  let failureCount = Math.max(ordersTotal - ordersProcessed, 0);

  const failureReasonCounts = { ...(data.failure_reason_counts || {}) };
  const failureDetails = { ...(data.failure_details || {}) };
  let uniqueFailureReasons = [...new Set(Object.keys(failureReasonCounts))];

  let enrichedOrders = orders;
  if (Array.isArray(orders)) {
    enrichedOrders = [];
    ordersTotal = orders.length;
    let successCountCalc = 0;

    for (const order of orders) {
      const orderCopy = { ...(order || {}) };
      const status = (orderCopy.status || '').toString().toLowerCase();
      const rawReason = orderCopy.reason || orderCopy.remark;
      const orderId = String(orderCopy.order_id || orderCopy.id || 'unknown');

      let reason = sanitizeReason(rawReason, data.remark);
      if (!reason && failureDetails) {
        for (const [r, ids] of Object.entries(failureDetails)) {
          if (Array.isArray(ids) && ids.includes(orderId)) {
            reason = sanitizeReason(r, data.remark);
            break;
          }
        }
      }
      if (!reason && !['success', 'signed'].includes(status)) {
        reason = sanitizeReason(null, data.remark) || 'Reason not provided';
      }

      orderCopy.reason = reason || orderCopy.reason;
      if (!orderCopy.remark) orderCopy.remark = orderCopy.reason;

      const isSuccess = ['success', 'signed'].includes(status);
      if (isSuccess) {
        successCountCalc += 1;
      } else if (reason) {
        uniqueFailureReasons.push(reason);
        failureReasonCounts[reason] = (failureReasonCounts[reason] || 0) + 1;
        if (!failureDetails[reason]) failureDetails[reason] = [];
        failureDetails[reason].push(orderId);
      }

      enrichedOrders.push(orderCopy);
    }

    ordersProcessed = successCountCalc;
    failureCount = ordersTotal - ordersProcessed;
    uniqueFailureReasons = [...new Set(uniqueFailureReasons)];
  }

  let successRate = data.success_rate;
  if (successRate === undefined || successRate === null) {
    successRate = ordersTotal ? Math.round((ordersProcessed / ordersTotal) * 10000) / 100 : 0;
  }

  let botType = (data.bot_type || '').toString().trim().toLowerCase();
  if (!botType && Array.isArray(enrichedOrders)) {
    let signed = 0;
    let unsigned = 0;
    for (const o of enrichedOrders) {
      const st = (o?.status || '').toString().toLowerCase();
      if (['signed', 'success'].includes(st)) signed += 1;
      else if (['unsigned', 'failed'].includes(st)) unsigned += 1;
    }
    botType = signed && !unsigned ? 'signed' : unsigned && !signed ? 'unsigned' : (signed || unsigned) ? 'mixed' : 'mixed';
  }
  if (!botType) botType = 'mixed';

  const status = deriveStatusFromCounts(ordersTotal, ordersProcessed);
  const remarks = (data.remark || 'No issues found').toString().trim() || 'No issues found';

  const auditResults = [
    {
      stats: {
        total_rows: ordersTotal,
        success_count: ordersProcessed,
        failure_count: failureCount,
        success_rate: successRate,
        failure_rate: Math.max(100 - Number(successRate || 0), 0),
      },
      unique_failure_reasons: uniqueFailureReasons,
      failure_reason_counts: failureReasonCounts,
      failure_details: failureDetails,
      orders: enrichedOrders || [],
    },
  ];

  return {
    id: runId,
    run_id: runId,
    audit_timestamp: tsIso,
    date: tsIso,
    agency: data.agency || 'Unknown',
    ehr: data.ehr || 'Unknown',
    status,
    bot_type: botType,
    remark: remarks,
    error_message: remarks,
    orders_total: ordersTotal,
    orders_processed: ordersProcessed,
    success_rate: successRate,
    audit_results: auditResults,
    stats: {
      total_rows: ordersTotal,
      success_count: ordersProcessed,
      failure_count: failureCount,
      success_rate: successRate,
      failure_rate: Math.max(100 - Number(successRate || 0), 0),
      failure_reason_counts: failureReasonCounts,
      failure_details: failureDetails,
    },
    unique_failure_reasons: uniqueFailureReasons,
    failure_reason_counts: failureReasonCounts,
    failure_details: failureDetails,
    orders: enrichedOrders || [],
  };
}

function aggregateTopFailureReasons(history, limit = 5) {
  const counts = {};

  const merge = (src) => {
    if (!src) return;
    for (const [reason, count] of Object.entries(src)) {
      if (!reason) continue;
      counts[reason] = (counts[reason] || 0) + Number(count || 0);
    }
  };

  for (const entry of history || []) {
    merge(entry.failure_reason_counts);
    merge(entry.stats?.failure_reason_counts);
    for (const result of entry.audit_results || []) {
      merge(result.failure_reason_counts);
      merge(result.stats?.failure_reason_counts);
    }
  }

  return Object.entries(counts)
    .sort((a, b) => (b[1] || 0) - (a[1] || 0))
    .slice(0, limit);
}

export const firestoreDirect = {
  isEnabled() {
    return shouldUseDirectFirestore();
  },

  async getAuditHistory({ limit = 100, includeOrders = false } = {}) {
    const db = getDb();
    const runsRef = collection(db, 'runs');
    const q = query(runsRef, orderBy('timestamp', 'desc'), qLimit(Math.max(1, Math.min(limit, 200))));

    const snap = await getDocs(q);
    const history = [];

    for (const d of snap.docs) {
      const data = d.data() || {};
      const orders = includeOrders ? await firestoreDirect.getRunOrders(d.id) : null;
      history.push(mapRunToHistory(d.id, data, orders));
    }

    return {
      status: 'success',
      history,
      top_failure_reasons: aggregateTopFailureReasons(history),
    };
  },

  async getRunOrders(runId) {
    const db = getDb();
    const ordersRef = collection(db, 'runs', runId, 'orders');
    const snap = await getDocs(ordersRef);
    return snap.docs.map((d) => d.data() || {});
  },

  async getAuditDetail(runId) {
    if (!runId) throw new Error('runId is required');
    const db = getDb();
    const runRef = doc(db, 'runs', runId);
    const runSnap = await getDoc(runRef);
    if (!runSnap.exists()) return null;

    const data = runSnap.data() || {};
    const orders = await firestoreDirect.getRunOrders(runId);
    return mapRunToHistory(runId, data, orders);
  },
};
