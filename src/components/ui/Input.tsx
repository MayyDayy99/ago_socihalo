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
        className={`w-full bg-app border ${error ? "border-family" : "border-border"} rounded px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors font-mono ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-family">{error}</p>}
    </div>
  )
)
Input.displayName = "Input"
