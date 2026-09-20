import { ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-signal text-white hover:bg-signal-700 disabled:bg-signal-100 disabled:text-muted",
  secondary: "bg-white text-ink border border-line hover:bg-paper",
  ghost: "text-ink hover:bg-paper",
  danger: "bg-white text-danger border border-danger/30 hover:bg-danger-50",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium px-3.5 py-2 transition-colors disabled:cursor-not-allowed";

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(function Button({ variant = "primary", className = "", ...props }, ref) {
  return <button ref={ref} className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`} {...props} />;
});

export function LinkButton({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={`${BASE} ${VARIANT_CLASSES[variant]} ${className}`}>
      {children}
    </Link>
  );
}
