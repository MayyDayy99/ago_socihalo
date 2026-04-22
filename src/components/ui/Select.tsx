import { type SelectHTMLAttributes, forwardRef } from "react"

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, className = "", ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs text-muted uppercase tracking-wider">{label}</label>
      )}
      <select
        ref={ref}
        className={`w-full bg-app border border-border rounded px-3 py-2 text-sm text-text focus:outline-none focus:border-accent transition-colors font-mono ${className}`}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
)
Select.displayName = "Select"
