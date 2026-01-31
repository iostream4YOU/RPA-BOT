import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const Calendar = ({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "dropdown",
  fromYear,
  toYear,
  ...props
}) => {
  const currentYear = new Date().getFullYear();
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      fromYear={fromYear || 2020}
      toYear={toYear || currentYear + 2}
      className={cn("p-3", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",
        nav: "space-x-1 flex items-center",
        nav_button:
          "h-7 w-7 bg-transparent p-0 opacity-70 hover:opacity-100 inline-flex items-center justify-center rounded-md border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-600 dark:text-slate-300",
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell: "text-slate-500 dark:text-slate-400 rounded-md w-9 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: "h-9 w-9 text-center text-sm p-0 relative",
        day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 rounded-md",
        day_selected: "bg-indigo-600 text-white hover:bg-indigo-600 hover:text-white",
        day_today: "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-50",
        day_outside: "text-slate-400 opacity-50",
        day_disabled: "text-slate-400 opacity-50",
        day_range_middle: "aria-selected:bg-slate-100 aria-selected:text-slate-900",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: () => <ChevronLeft className="h-4 w-4" />,
        IconRight: () => <ChevronRight className="h-4 w-4" />,
      }}
      {...props}
    />
  );
};
Calendar.displayName = "Calendar";

export { Calendar };
