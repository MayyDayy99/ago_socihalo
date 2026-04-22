import { type InputHTMLAttributes, forwardRef } from "react"

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-xs text-muted uppercase tracking-wider">{label}</label>
      )}
      <input
        ref={ref}
        className={`w-full bg-surface border ${error ? "border-family" : "border-border-strong"} rounded px-3 py-1.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-family">{error}</p>}
    </div>
  )
)
Input.displayName = "Input"
