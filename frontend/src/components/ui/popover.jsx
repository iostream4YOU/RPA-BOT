import * as React from "react"
import { cn } from "@/lib/utils"

const PopoverContext = React.createContext({})

const Popover = ({ children }) => {
  const [open, setOpen] = React.useState(false)
  return (
    <PopoverContext.Provider value={{ open, setOpen }}>
      <div className="relative inline-block text-left">{children}</div>
    </PopoverContext.Provider>
  )
}

const PopoverTrigger = React.forwardRef(({ asChild, children, ...props }, ref) => {
  const { open, setOpen } = React.useContext(PopoverContext)
  const Comp = asChild ? React.Slot : "button" // Simplified, assuming asChild means we clone element or just render children with click handler
  // Since I don't have Slot, I'll just wrap children in a div if asChild is true, or just attach onClick to the child if possible.
  // For simplicity, I'll ignore asChild and just render a div wrapper that handles click.
  return (
    <div onClick={() => setOpen(!open)} className="inline-block cursor-pointer">
      {children}
    </div>
  )
})
PopoverTrigger.displayName = "PopoverTrigger"

const PopoverContent = React.forwardRef(({ className, align = "center", sideOffset = 4, ...props }, ref) => {
  const { open } = React.useContext(PopoverContext)
  if (!open) return null
  return (
    <div
      ref={ref}
      className={cn(
        "absolute z-50 w-72 rounded-md border bg-popover p-4 text-popover-foreground shadow-md outline-none animate-in fade-in-80 bg-white",
        className
      )}
      {...props}
    />
  )
})
PopoverContent.displayName = "PopoverContent"

export { Popover, PopoverTrigger, PopoverContent }
