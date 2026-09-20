import Link from "next/link";
import { MessageSquareText, Sparkles } from "lucide-react";

export function BrandMark({ inverted = false }: { inverted?: boolean }) {
  return (
    <span className={`relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-[0_8px_20px_rgba(91,87,246,0.25)] ${inverted ? "bg-white text-[#514CF4]" : "bg-gradient-to-br from-[#776BFF] to-[#4A41D8] text-white"}`}>
      <MessageSquareText className="h-[21px] w-[21px]" strokeWidth={2.3} aria-hidden="true" />
      <span className={`absolute -right-1 -top-1 inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 ${inverted ? "border-[#171436] bg-[#71E3C4]" : "border-white bg-[#71E3C4]"}`} />
    </span>
  );
}

export function BrandWordmark({ light = false, href = "/" }: { light?: boolean; href?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-3 font-semibold tracking-tight ${light ? "text-white" : "text-[#17152F]"}`} aria-label="ReplyPilot home">
      <BrandMark inverted={light} />
      <span className="text-[21px]">reply<span className={light ? "text-[#C7C3FF]" : "text-[#6259EA]"}>pilot</span><span className="text-[#6CE2C3]">.</span></span>
    </Link>
  );
}

export function AccentLabel({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return <span className={`inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.17em] ${light ? "text-[#B5ABFF]" : "text-[#6259EA]"}`}><Sparkles className="h-3.5 w-3.5" aria-hidden="true" />{children}</span>;
}
