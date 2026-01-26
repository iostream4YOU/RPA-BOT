import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Activity, 
  GitCompare, 
  FileSpreadsheet,
  Calendar,
  Hash,
  Clock
} from 'lucide-react';
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronUp } from 'lucide-react';

const FailureReasonItem = ({ reason, count, details }) => {
  const [expanded, setExpanded] = React.useState(false);
  const hasDetails = details && details.length > 0;

  return (
    <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 overflow-hidden transition-all">
      <div 
        className={`flex items-center justify-between p-3 ${hasDetails ? 'cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800' : ''} transition-colors ${expanded ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium flex-1 mr-4">{reason}</span>
        <div className="flex items-center gap-2 shrink-0">
          <Badge variant="secondary">
            {count} occurrences
          </Badge>
          {hasDetails && (
            expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </div>
      </div>
      
      {expanded && hasDetails && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 animate-in slide-in-from-top-1 duration-200">
          <div className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Affected Identifiers (Row / Order ID)</div>
          <div className="flex flex-wrap gap-2 max-h-[200px] overflow-y-auto pr-2">
            {details.map((id, idx) => (
              <Badge key={idx} variant="outline" className="font-mono text-xs bg-slate-50 text-slate-600 border-slate-200">
                {id}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default function AuditDetailsDialog({ audit, open, onOpenChange }) {
  if (!audit || !audit.details) return null;

  const { details } = audit;
  const results = details.audit_results || [];
  const pairedResults = details.paired_results || [];
  const reconciliation = details.reconciliation_summary || [];

  const getStatusColor = (status) => {
    return status === 'Success' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
           'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        <div className="p-6 border-b bg-slate-50/50 dark:bg-slate-900/50 shrink-0">
          <div className="flex items-start justify-between mb-2">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3">
                {audit.agency}
                <Badge variant="secondary" className={getStatusColor(audit.status)}>
                  {audit.status}
                </Badge>
              </DialogTitle>
              <DialogDescription className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Hash className="w-3 h-3" /> ID: {audit.id}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {new Date(audit.date).toLocaleDateString()}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {new Date(audit.date).toLocaleTimeString()}
                </span>
              </DialogDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">EHR System</div>
              <div className="font-semibold text-slate-900 dark:text-slate-100">{audit.ehr}</div>
            </div>
          </div>
        </div>

        <ScrollArea className="flex-1 bg-slate-50/30 dark:bg-slate-950/30">
          <div className="p-6">
            <Tabs defaultValue="results" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="results" className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4" /> Audit Results
                </TabsTrigger>
                <TabsTrigger value="paired" className="flex items-center gap-2">
                  <GitCompare className="w-4 h-4" /> Paired Analysis
                </TabsTrigger>
                <TabsTrigger value="summary" className="flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Reconciliation
                </TabsTrigger>
              </TabsList>

              <TabsContent value="results" className="space-y-6 mt-0">
                {results.length === 0 && (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-dashed">
                    <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-muted-foreground">No detailed results available.</p>
                  </div>
                )}
                {results.map((result, index) => (
                  <Card key={index} className="overflow-hidden border-l-4 border-l-indigo-500">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50 pb-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg font-semibold flex items-center gap-2">
                            <FileText className="w-5 h-5 text-indigo-500" />
                            {result.file_name ? result.file_name.split('/').pop() : 'Unknown File'}
                          </CardTitle>
                          <CardDescription className="mt-1">
                            Template: {result.template_type}
                          </CardDescription>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="outline" className="bg-white dark:bg-slate-800">
                            {result.stats?.total_rows || 0} Rows
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-6">
                      {(() => {
                        const counts = result.stats?.failure_reason_counts || {};
                        const reasonsFromCounts = Object.keys(counts);
                        const reasonsFromList = result.unique_failure_reasons || result.stats?.unique_failure_reasons || [];
                        const reasons = (reasonsFromCounts.length ? reasonsFromCounts : reasonsFromList) || [];
                        return reasons.length > 0 ? (
                          <div className="mb-6">
                            <div className="text-xs font-semibold uppercase text-muted-foreground mb-2 flex items-center gap-2">
                              <AlertCircle className="w-3 h-3" /> Issue Reasons
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {reasons.map((reason) => (
                                <Badge key={reason} variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40">
                                  {reason}
                                  {counts[reason] ? ` (${counts[reason]})` : ''}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : null;
                      })()}

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/20">
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="font-medium">Success Rate</span>
                          </div>
                          <div className="text-2xl font-bold text-green-700 dark:text-green-400">
                            {result.stats?.success_rate || '0%'}
                          </div>
                          <Progress value={parseInt(result.stats?.success_rate) || 0} className="h-1.5 mt-2 bg-green-200 dark:bg-green-900/40" indicatorClassName="bg-green-600 dark:bg-green-500" />
                        </div>
                        
                        <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                          <div className="flex items-center gap-2 text-red-700 dark:text-red-400 mb-2">
                            <XCircle className="w-4 h-4" />
                            <span className="font-medium">Failure Rate</span>
                          </div>
                          <div className="text-2xl font-bold text-red-700 dark:text-red-400">
                            {result.stats?.failure_rate || '0%'}
                          </div>
                          <Progress value={parseInt(result.stats?.failure_rate) || 0} className="h-1.5 mt-2 bg-red-200 dark:bg-red-900/40" indicatorClassName="bg-red-600 dark:bg-red-500" />
                        </div>

                        <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mb-2">
                            <AlertCircle className="w-4 h-4" />
                            <span className="font-medium">Issues Found</span>
                          </div>
                          <div className="text-2xl font-bold text-slate-700 dark:text-slate-300">
                            {result.stats?.failure_count || 0}
                          </div>
                        </div>
                      </div>
                      
                      {result.stats?.failure_reason_counts && Object.keys(result.stats.failure_reason_counts).length > 0 && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            Failure Analysis
                          </h4>
                          <div className="grid gap-3">
                            {Object.entries(result.stats.failure_reason_counts).map(([reason, count]) => (
                              <FailureReasonItem 
                                key={reason} 
                                reason={reason} 
                                count={count} 
                                details={result.stats?.failure_details?.[reason]} 
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {!result.stats?.failure_reason_counts?.length && (result.unique_failure_reasons?.length || result.stats?.unique_failure_reasons?.length) && (
                        <div className="mt-6">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500" />
                            Failure Analysis
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {(result.unique_failure_reasons || result.stats?.unique_failure_reasons || []).map((reason) => (
                              <Badge key={reason} variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-900/40">
                                {reason}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {result.orders && result.orders.length > 0 && (
                        <div className="mt-8">
                          <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            Orders Breakdown (from Firestore)
                          </h4>
                          <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
                            <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-900/50 text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                              <div className="col-span-3 px-3 py-2">Order ID</div>
                              <div className="col-span-2 px-3 py-2">Status</div>
                              <div className="col-span-7 px-3 py-2">Reason / Remark</div>
                            </div>
                            <div className="max-h-[240px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                              {result.orders.map((order, idx) => {
                                const status = (order.status || '').toString();
                                const reason = order.reason || order.remark || '—';
                                return (
                                  <div key={`${order.order_id || order.id || idx}`} className="grid grid-cols-12 text-sm px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="col-span-3 font-mono text-xs text-slate-700 dark:text-slate-300 truncate" title={order.order_id || order.id || 'Unknown'}>
                                      {order.order_id || order.id || 'Unknown'}
                                    </div>
                                    <div className="col-span-2">
                                      <Badge variant={status.toLowerCase() === 'success' || status.toLowerCase() === 'signed' ? 'success' : 'destructive'}>
                                        {status || 'unknown'}
                                      </Badge>
                                    </div>
                                    <div className="col-span-7 text-slate-700 dark:text-slate-200 truncate" title={reason}>
                                      {reason}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="paired" className="space-y-6 mt-0">
                {pairedResults.length === 0 && (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-dashed">
                    <GitCompare className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-muted-foreground">No paired analysis available.</p>
                  </div>
                )}
                {pairedResults.map((pair, index) => (
                  <Card key={index} className="overflow-hidden">
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50">
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <GitCompare className="w-5 h-5 text-blue-500" />
                        Pair Analysis Group #{index + 1}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Signed Stats */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-2 border-b">
                            <h4 className="font-semibold text-blue-600 flex items-center gap-2">
                              <FileText className="w-4 h-4" /> Signed Orders
                            </h4>
                            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
                              {pair.signed?.stats?.total_rows || 0} Total
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <StatBox label="Success Rate" value={pair.signed?.stats?.success_rate} className="text-green-600" />
                            <StatBox label="Failure Rate" value={pair.signed?.stats?.failure_rate} className="text-red-600" />
                          </div>
                        </div>

                        {/* Unsigned Stats */}
                        <div className="space-y-4">
                          <div className="flex items-center justify-between pb-2 border-b">
                            <h4 className="font-semibold text-orange-600 flex items-center gap-2">
                              <FileText className="w-4 h-4" /> Unsigned Orders
                            </h4>
                            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                              {pair.unsigned?.stats?.total_rows || 0} Total
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <StatBox label="Success Rate" value={pair.unsigned?.stats?.success_rate} className="text-green-600" />
                            <StatBox label="Failure Rate" value={pair.unsigned?.stats?.failure_rate} className="text-red-600" />
                          </div>
                        </div>
                      </div>
                      
                      {pair.combined_summary && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-100 dark:border-slate-800">
                          <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
                            <Activity className="w-4 h-4 text-slate-500" />
                            Combined Processing Summary
                          </h4>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <StatBox label="Signed Processed" value={pair.combined_summary.documents_processed?.signed} />
                            <StatBox label="Unsigned Processed" value={pair.combined_summary.documents_processed?.unsigned} />
                            <StatBox label="Total Matches" value={pair.combined_summary.matches_found} />
                            <StatBox label="Discrepancies" value={pair.combined_summary.discrepancies_found} className="text-amber-600" />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="summary" className="space-y-6 mt-0">
                {reconciliation.length === 0 && (
                  <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-lg border border-dashed">
                    <Activity className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                    <p className="text-muted-foreground">No reconciliation summary available.</p>
                  </div>
                )}
                {reconciliation.map((rec, index) => (
                  <Card key={index}>
                    <CardHeader className="bg-slate-50 dark:bg-slate-900/50">
                      <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Activity className="w-5 h-5 text-purple-500" />
                        Reconciliation: {rec.agency}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20">
                          <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">Total Signed</div>
                          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{rec.signed_total}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-100 dark:border-orange-900/20">
                          <div className="text-sm text-orange-600 dark:text-orange-400 mb-1">Total Unsigned</div>
                          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{rec.unsigned_total}</div>
                        </div>
                      </div>

                      {rec.pending_signature_orders && rec.pending_signature_orders.length > 0 && (
                        <div className="border rounded-lg overflow-hidden">
                          <div className="bg-slate-50 dark:bg-slate-900/50 p-3 border-b flex justify-between items-center">
                            <h4 className="text-sm font-semibold flex items-center gap-2">
                              <Clock className="w-4 h-4 text-slate-500" />
                              Pending Signature Orders
                            </h4>
                            <Badge variant="secondary">{rec.pending_signature_orders.length} Pending</Badge>
                          </div>
                          <ScrollArea className="h-[200px] w-full p-0">
                            <div className="divide-y">
                              {rec.pending_signature_orders.map((id, i) => (
                                <div key={i} className="p-3 text-sm font-mono hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors flex items-center gap-3">
                                  <span className="text-slate-400 w-6 text-right">{i + 1}.</span>
                                  {id}
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function StatBox({ label, value, className = "" }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{label}</span>
      <span className={`text-xl font-bold ${className}`}>{value ?? '-'}</span>
    </div>
  );
}
