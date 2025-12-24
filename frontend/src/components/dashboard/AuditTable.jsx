import React, { useState } from 'react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from 'date-fns';
import AuditDetailsDialog from './AuditDetailsDialog';

export default function AuditTable({ data }) {
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleViewDetails = (audit) => {
    setSelectedAudit(audit);
    // Add a small delay to ensure the dropdown closes completely
    // before the dialog opens. This prevents focus trapping issues.
    setTimeout(() => setIsDialogOpen(true), 100);
  };

  const handleDialogOpenChange = (open) => {
    setIsDialogOpen(open);
    if (!open) {
      // Clear selected audit after animation to ensure fresh state next time
      setTimeout(() => setSelectedAudit(null), 300);
    }
  };

  return (
    <div className="rounded-md border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">Audit ID</TableHead>
            <TableHead>Agency</TableHead>
            <TableHead>EHR System</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Remarks</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((audit) => (
            <TableRow key={audit.id}>
              <TableCell className="font-medium">{audit.id}</TableCell>
              <TableCell>{audit.agency}</TableCell>
              <TableCell>{audit.ehr}</TableCell>
              <TableCell>
                <Badge 
                  variant={
                    audit.status === 'Success' ? 'success' : 
                    audit.status === 'Failed' ? 'destructive' : 'secondary'
                  }
                  className="flex w-fit items-center gap-1"
                >
                  {audit.status === 'Success' && <CheckCircle2 className="w-3 h-3" />}
                  {audit.status === 'Failed' && <AlertCircle className="w-3 h-3" />}
                  {audit.status}
                </Badge>
              </TableCell>
              <TableCell>
                {audit.date ? format(new Date(audit.date), 'MMM dd, yyyy HH:mm') : '-'}
              </TableCell>
              <TableCell className="max-w-[200px] truncate" title={audit.remarks}>
                {audit.remarks}
              </TableCell>
              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="h-8 w-8 p-0">
                      <span className="sr-only">Open menu</span>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Actions</DropdownMenuLabel>
                    <DropdownMenuItem 
                      onClick={() => handleViewDetails(audit)}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      View Details
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem>Download Report</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <AuditDetailsDialog 
        audit={selectedAudit} 
        open={isDialogOpen} 
        onOpenChange={handleDialogOpenChange} 
      />
    </div>
  );
}
