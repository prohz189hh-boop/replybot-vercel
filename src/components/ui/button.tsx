import { ButtonHTMLAttributes, forwardRef } from "react";
import Link from "next/link";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "bg-[#6257EF] text-white shadow-[0_8px_22px_rgba(98,87,239,.18)] hover:bg-[#5146DD] disabled:bg-[#C8C5EE] disabled:text-white",
  secondary: "bg-white text-[#363151] border border-[#DEDCF0] hover:bg-[#F8F7FF]",
  ghost: "text-[#4D4867] hover:bg-[#F5F3FF]",
  danger: "bg-white text-danger border border-[#E9C8C8] hover:bg-danger-50",
};

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold px-4 py-2.5 transition-all disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#6257EF]";

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
