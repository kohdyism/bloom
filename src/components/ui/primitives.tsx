import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn, AVATAR_COLORS, initials } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-line bg-surface shadow-soft", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-5 pb-3", className)} {...props} />;
}

export function CardTitle({ className, as: Tag = "h2", ...props }: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h1" | "h2" | "h3" }) {
  return <Tag className={cn("font-display text-lg font-semibold text-ink", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5", {
  variants: {
    tone: {
      neutral: "bg-surface-2 text-ink-muted",
      teal: "bg-teal-soft text-teal-strong",
      blue: "bg-blue-soft text-blue",
      purple: "bg-purple-soft text-purple",
      mint: "bg-mint-soft text-mint",
      coral: "bg-coral-soft text-coral",
      amber: "bg-amber-soft text-amber",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export function Badge({ className, tone, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-11 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-[0.95rem] text-ink placeholder:text-ink-faint aria-[invalid=true]:border-coral",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-24 w-full rounded-xl border border-line-strong bg-surface px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-ink-faint aria-[invalid=true]:border-coral",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select
    ref={ref}
    className={cn("h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-[0.95rem] text-ink", className)}
    {...props}
  />
));
Select.displayName = "Select";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold text-ink", className)} {...props} />;
}

/** Label + control + hint + accessible error, wired with ids. */
export function Field({
  label, hint, error, children, id, className,
}: { label: string; hint?: string; error?: string; id: string; children: React.ReactElement<Record<string, unknown>>; className?: string }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {React.cloneElement(children, { id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint ? <p id={hintId} className="text-sm text-ink-muted">{hint}</p> : null}
      {error ? <p id={errorId} className="text-sm font-medium text-coral" role="alert">{error}</p> : null}
    </div>
  );
}

export function Avatar({ name, color = "teal", size = "md", className, title }: { name: string; color?: string; size?: "sm" | "md" | "lg"; className?: string; title?: string }) {
  const c = AVATAR_COLORS[color] ?? AVATAR_COLORS.teal;
  const dims = size === "sm" ? "size-7 text-[0.7rem]" : size === "lg" ? "size-12 text-base" : "size-9 text-sm";
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold ring-2 ring-surface", dims, className)}
      style={{ background: c.bg, color: c.fg }}
      title={title ?? name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Notice({ tone = "neutral", title, children, className, role }: { tone?: "neutral" | "teal" | "amber" | "coral" | "blue" | "purple"; title?: string; children?: React.ReactNode; className?: string; role?: string }) {
  const tones: Record<string, string> = {
    neutral: "bg-surface-2 border-line text-ink",
    teal: "bg-teal-soft border-teal/30 text-ink",
    amber: "bg-amber-soft border-amber/30 text-ink",
    coral: "bg-coral-soft border-coral/30 text-ink",
    blue: "bg-blue-soft border-blue/30 text-ink",
    purple: "bg-purple-soft border-purple/30 text-ink",
  };
  return (
    <div role={role} className={cn("rounded-xl border px-4 py-3 text-sm", tones[tone], className)}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-0.5 text-ink-muted" : ""}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children, action, className }: { title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center", className)}>
      <p className="font-display text-base font-semibold">{title}</p>
      {children ? <div className="max-w-md text-sm text-ink-muted">{children}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, description, actions, eyebrow }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; eyebrow?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? <div className="mb-1 text-sm font-semibold text-teal">{eyebrow}</div> : null}
        <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Horizontal step indicator used for stage progress. */
export function StepDots({ total, current, label }: { total: number; current: number; label?: string }) {
  return (
    <div className="flex items-center gap-1.5" role="img" aria-label={label ?? `Step ${Math.min(current + 1, total)} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all",
            i < current ? "w-4 bg-teal" : i === current ? "w-6 bg-teal" : "w-4 bg-line-strong",
          )}
        />
      ))}
    </div>
  );
}
