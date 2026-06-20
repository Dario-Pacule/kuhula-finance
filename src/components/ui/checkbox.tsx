"use client"

import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, ...props }, ref) => {
    return (
      <div className="relative flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="peer sr-only"
          {...props}
        />
        <div
          onClick={() => onCheckedChange?.(!checked)}
          className={cn(
            "h-4.5 w-4.5 shrink-0 rounded border border-zinc-800 bg-zinc-950 shadow-sm transition-all hover:bg-zinc-900/50 cursor-pointer flex items-center justify-center peer-focus-visible:ring-2 peer-focus-visible:ring-zinc-500 peer-checked:bg-zinc-50 peer-checked:border-zinc-50 peer-checked:text-zinc-950",
            className
          )}
        >
          {checked && <Check className="h-3 w-3 stroke-[3.5px]" />}
        </div>
      </div>
    )
  }
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
