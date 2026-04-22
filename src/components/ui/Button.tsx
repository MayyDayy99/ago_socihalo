import { type ButtonHTMLAttributes, forwardRef } from "react"

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "sm" | "md"
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "secondary", size = "md", className = "", children, ...props }, ref) => {
    const base = "inline-flex items-center justify-center gap-1.5 font-medium transition-colors focus:outline-none rounded disabled:opacity-40 disabled:cursor-not-allowed"
    const sizes = {
      sm: "px-2.5 py-1 text-xs",
      md: "px-3.5 py-1.5 text-sm",
    }
    const variants = {
      primary:   "bg-accent hover:bg-accent-2 text-white font-semibold",
      secondary: "bg-surface hover:bg-surface-2 text-text border border-border-strong",
      ghost:     "hover:bg-surface-2 text-muted hover:text-text",
      danger:    "bg-surface hover:bg-family/10 text-family border border-family/40",
    }
    return (
      <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props}>
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"
