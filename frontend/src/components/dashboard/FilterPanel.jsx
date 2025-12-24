import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import ehrData from '@/data/ehr_agencies.json';

export default function FilterPanel({ filters, setFilters, onClearFilters }) {
  const availableAgencies = React.useMemo(() => {
    if (filters.ehr && filters.ehr !== 'all') {
      return ehrData[filters.ehr] || [];
    }
    // If no EHR selected, show all agencies
    return Object.values(ehrData).flat().sort();
  }, [filters.ehr]);

  return (
    <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm space-y-4 mb-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Search by ID or Remarks..." 
            className="pl-9 bg-gray-50 dark:bg-slate-950 border-gray-200 dark:border-slate-800"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
          <Select 
            value={filters.status} 
            onValueChange={(val) => setFilters(prev => ({ ...prev, status: val }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filters.ehr} 
            onValueChange={(val) => setFilters(prev => ({ ...prev, ehr: val, agency: 'all' }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="EHR System" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All EHRs</SelectItem>
              {Object.keys(ehrData).map(ehr => (
                <SelectItem key={ehr} value={ehr}>{ehr}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select 
            value={filters.agency} 
            onValueChange={(val) => setFilters(prev => ({ ...prev, agency: val }))}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select Agency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agencies</SelectItem>
              {availableAgencies.map(agency => (
                <SelectItem key={agency} value={agency}>{agency}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant={"outline"}
                className={cn(
                  "w-[240px] justify-start text-left font-normal",
                  !filters.date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.date ? format(filters.date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.date}
                onSelect={(date) => setFilters(prev => ({ ...prev, date }))}
                initialFocus
              />
            </PopoverContent>
          </Popover>

          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClearFilters}
            title="Clear Filters"
            className="text-gray-500 hover:text-red-500"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
