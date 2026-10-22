import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-medium transition-[background-color,box-shadow,transform,color] duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-teal text-white shadow-soft hover:bg-teal-strong",
        secondary: "bg-surface text-ink border border-line-strong shadow-soft hover:bg-surface-2",
        soft: "bg-teal-soft text-teal-strong hover:brightness-95",
        ghost: "text-ink hover:bg-surface-2",
        danger: "bg-coral text-white hover:brightness-95",
        link: "text-teal underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-[0.95rem]",
        lg: "h-12 px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  pending?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, pending, children, disabled, ...props }, ref) => {
    if (asChild) {
      // Slot needs exactly one child element (e.g. a Link); no spinner here.
      return (
        <Slot.Root ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props}>
          {children}
        </Slot.Root>
      );
    }
    const Comp = "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || pending}
        aria-busy={pending || undefined}
        {...props}
      >
        {pending ? <Spinner /> : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <span role={label ? "status" : undefined} className={cn("inline-flex items-center", className)}>
      <svg viewBox="0 0 24 24" className="size-4 animate-spin" aria-hidden="true">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
