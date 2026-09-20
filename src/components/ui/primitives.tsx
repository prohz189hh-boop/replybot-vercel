import { HTMLAttributes } from "react";

export function Panel({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={`rounded-2xl border border-[#E8E8F3] bg-white shadow-[0_6px_35px_rgba(26,23,71,.035)] ${className}`} {...props} />;
}

const STATUS_STYLES: Record<string, string> = {
  AI: "bg-signal-50 text-signal-700",
  OPEN: "bg-signal-50 text-signal-700",
  WAITING_FOR_HUMAN: "bg-escalate-50 text-escalate",
  HUMAN: "bg-escalate-50 text-escalate",
  RESOLVED: "bg-resolved-50 text-resolved",
  READY: "bg-resolved-50 text-resolved",
  PROCESSING: "bg-signal-50 text-signal-700",
  FAILED: "bg-danger-50 text-danger",
  ACTIVE: "bg-resolved-50 text-resolved",
  INACTIVE: "bg-paper text-muted",
};

const STATUS_LABELS: Record<string, string> = {
  AI: "AI handling",
  OPEN: "Open",
  WAITING_FOR_HUMAN: "Needs human",
  HUMAN: "Human handling",
  RESOLVED: "Resolved",
  READY: "Ready",
  PROCESSING: "Processing",
  FAILED: "Failed",
};

export function StatusBadge({ status }: { status: string }) {
  const classes = STATUS_STYLES[status] ?? "bg-paper text-muted";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#D9D6F5] bg-gradient-to-br from-white to-[#FAF9FF] px-6 py-16 text-center">
      <p className="text-base font-medium text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function FieldLabel({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-[12px] font-bold text-[#36334F]">
      {children}
    </label>
  );
}

export const inputClasses =
  "rp-field";

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return <p className="mt-2 text-[12px] font-medium text-danger">{children}</p>;
}
