import { type ButtonHTMLAttributes, forwardRef } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className = "", children, ...props }, ref) => {
    const base = "inline-flex items-center justify-center gap-1.5 font-mono font-medium transition-all focus:outline-none rounded disabled:opacity-40 disabled:cursor-not-allowed"
    const sizes = {
      sm: "px-2.5 py-1 text-xs",
      md: "px-3.5 py-1.5 text-sm",
    }
    const variants = {
      primary:   "bg-accent hover:bg-accent-2 text-app font-semibold shadow-warm hover:shadow-glow",
      secondary: "bg-surface-2 hover:bg-surface-3 text-text border border-border shadow-inset",
      ghost:     "hover:bg-surface-2 text-muted hover:text-text",
      danger:    "bg-family/10 hover:bg-family/20 text-family border border-family/30",
    }
    return (
      <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"
