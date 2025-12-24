import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, subDays } from 'date-fns';
import { Calendar as CalendarIcon, Download, Share2, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

const EHR_OPTIONS = ["Axxess", "Kinnser", "Kantime", "HCHB", "Athena", "eCW", "Elation", "Interlink", "Automedsys"];

import { Check } from 'lucide-react';

export default function FilterPanel({ 
  filters, 
  setFilters, 
  agencies, 
  onDownload,
  onShare,
  isCopied
}) {
  
  // EHR Multi-select handler
  const toggleEHR = (ehr) => {
    const current = filters.ehr || [];
    if (current.includes(ehr)) {
      setFilters(prev => ({ ...prev, ehr: current.filter(e => e !== ehr) }));
    } else {
      setFilters(prev => ({ ...prev, ehr: [...current, ehr] }));
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 p-4 sticky top-0 z-30 shadow-sm mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left Side: Filters */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Date Range Selector */}
          <Select 
            value={filters.range} 
            onValueChange={(val) => setFilters(prev => ({ ...prev, range: val }))}
          >
            <SelectTrigger className="w-[160px] bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7days">Past 7 Days</SelectItem>
              <SelectItem value="30days">Past 30 Days</SelectItem>
              <SelectItem value="custom">Custom Range</SelectItem>
            </SelectContent>
          </Select>

          {/* EHR Multi-Select (Simulated with Popover for cleaner UI) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700 min-w-[140px] justify-between">
                <span className="truncate">
                  {filters.ehr?.length > 0 ? `${filters.ehr.length} EHRs Selected` : "Select EHR"}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[250px] p-3 align-start">
               <div className="space-y-2">
                 <div className="font-medium mb-2">Select EHR Systems</div>
                 {EHR_OPTIONS.map(ehr => (
                   <div key={ehr} className="flex items-center space-x-2">
                     <Checkbox 
                        id={ehr} 
                        checked={filters.ehr?.includes(ehr)}
                        onCheckedChange={() => toggleEHR(ehr)}
                     />
                     <label htmlFor={ehr} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                       {ehr}
                     </label>
                   </div>
                 ))}
               </div>
            </PopoverContent>
          </Popover>

          {/* Agency Selector */}
          <Select 
             value={filters.agency || "all"} 
             onValueChange={(val) => setFilters(prev => ({ ...prev, agency: val === "all" ? null : val }))}
          >
            <SelectTrigger className="w-[180px] bg-gray-50 dark:bg-slate-800 border-gray-200 dark:border-slate-700">
              <SelectValue placeholder="All Agencies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Agencies</SelectItem>
              {agencies.map(a => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {/* Active Filter Badges */}
          <div className="hidden xl:flex gap-2 items-center ml-2">
            {filters.ehr?.map(e => (
              <Badge key={e} variant="secondary" className="h-7 text-xs gap-1">
                {e} 
                <X 
                  className="w-3 h-3 cursor-pointer hover:text-red-500" 
                  onClick={() => toggleEHR(e)}
                />
              </Badge>
            ))}
          </div>

        </div>

        {/* Right Side: Actions */}
        <div className="flex items-center gap-2">
          <Button 
             variant="outline" 
             size="sm"
             onClick={onShare}
             className="text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-900 hover:bg-indigo-50 min-w-[100px]"
          >
            {isCopied ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Copied
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </>
            )}
          </Button>
          <Button 
             size="sm"
             onClick={onDownload}
             className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-200 dark:shadow-none"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>
    </div>
  );
}