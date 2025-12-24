import * as React from "react"
import { cn } from "@/lib/utils"

const Calendar = ({ className, ...props }) => {
  return (
    <div className={cn("p-3", className)} {...props}>
      Calendar Component Placeholder
    </div>
  )
}
Calendar.displayName = "Calendar"

export { Calendar }
