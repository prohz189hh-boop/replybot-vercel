import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, Bot, Check, CheckCircle2, ChevronRight, Globe2, HeartHandshake, Inbox, Layers3, MessageCircle, MousePointerClick, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AccentLabel, BrandWordmark } from "@/components/brand";

const features = [
  { icon: BookOpen, label: "Your knowledge, organized", text: "Bring your FAQs, documents, or website content together to give your agent the right context.", theme: "bg-[#EDEAFF] text-[#6154D9]" },
  { icon: MessageCircle, label: "Helpful conversations", text: "Give visitors a place to ask questions whenever they need an answer.", theme: "bg-[#DBF7ED] text-[#188C69]" },
  { icon: HeartHandshake, label: "Human when it counts", text: "Keep complex conversations in your team's inbox and follow up personally.", theme: "bg-[#FDEEDC] text-[#BA7127]" },
];

function DemoWindow() {
  return (
    <div className="relative mx-auto max-w-[600px] lg:ml-auto">
      <div className="pointer-events-none absolute -inset-5 rounded-[40px] bg-[#8879FF]/15 blur-3xl" />
      <div className="relative overflow-hidden rounded-[25px] border border-white/20 bg-white p-2 shadow-[0_35px_90px_rgba(6,5,39,.35)] sm:p-3">
        <div className="overflow-hidden rounded-[18px] border border-[#E9E9F3] bg-[#FAFAFD]">
          <div className="flex items-center gap-2 border-b border-[#E9E9F3] bg-white px-4 py-3">
            <span className="h-2.5 w-2.5 rounded-full bg-[#FFBDB7]" /><span className="h-2.5 w-2.5 rounded-full bg-[#FADCAA]" /><span className="h-2.5 w-2.5 rounded-full bg-[#A8E6CF]" />
            <span className="ml-3 rounded-lg bg-[#F4F3FA] px-4 py-1.5 text-[10px] font-semibold text-[#9291AD]">Your website · Live preview</span>
          </div>
          <div className="grid min-h-[360px] grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] sm:min-h-[410px]">
            <div className="relative overflow-hidden bg-[#F5F4FC] px-5 pt-9 sm:px-7">
              <span className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#847EB2]">YOUR COMPANY</span>
              <div className="mt-7 max-w-[175px] text-[23px] font-extrabold leading-tight tracking-[-.05em] text-[#2C2754] sm:text-[31px]">A better way to connect.</div>
              <p className="mt-3 max-w-[175px] text-[10px] leading-5 text-[#9290AC] sm:text-xs">A space for the questions your customers ask most.</p>
              <div className="mt-7 h-8 max-w-[140px] rounded-xl bg-[#665AE9]" />
              <div className="absolute bottom-0 left-4 right-4 h-24 rounded-t-[20px] bg-[#E7E5F7] sm:left-7 sm:right-7" />
              <div className="absolute bottom-0 left-9 right-9 h-16 rounded-t-[17px] bg-[#DAD7F1] sm:left-12 sm:right-12" />
            </div>
            <div className="flex flex-col bg-white px-3 pb-3 pt-4 sm:px-5">
              <div className="flex items-center gap-2 border-b border-[#EFEFF4] pb-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#655BE9] text-white"><Sparkles className="h-4 w-4" /></span>
                <div className="min-w-0"><p className="text-[11px] font-extrabold text-[#27233F] sm:text-xs">Support assistant</p><p className="text-[9px] text-[#209B75]">● Available to help</p></div>
              </div>
              <div className="flex-1 space-y-3 py-4 text-[10px] font-medium leading-[1.5] sm:text-xs">
                <div className="rounded-[13px] rounded-tl-sm bg-[#F2F2F7] p-3 text-[#49445B]">Hey there! What can I help you with today?</div>
                <div className="ml-5 rounded-[13px] rounded-tr-sm bg-[#ECE9FF] p-3 text-[#453C92]">Can you help with an order?</div>
                <div className="rounded-[13px] rounded-tl-sm bg-[#F2F2F7] p-3 text-[#49445B]">Absolutely. Tell me a little more, and I’ll help you find the right next step.</div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-[#ECECF4] px-3 py-2.5 text-[10px] text-[#A0A0B2]">Type your message…<ArrowUpRight className="h-3.5 w-3.5 text-[#655BE9]" /></div>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 flex items-center gap-3 rounded-2xl border border-white/40 bg-white px-4 py-3 shadow-[0_15px_40px_rgba(12,10,35,.22)] sm:-left-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#E7F9F0] text-[#249569]"><CheckCircle2 className="h-5 w-5" /></span>
        <div><p className="text-[11px] font-extrabold text-[#292541]">Thoughtful handoff</p><p className="text-[10px] text-[#9692A9]">Bring your team into the conversation</p></div>
      </div>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="overflow-x-hidden bg-[#F8F9FC] text-[#1E1B37]">
      <header className="absolute inset-x-0 top-0 z-30">
        <nav className="mx-auto flex max-w-[1240px] items-center justify-between gap-3 px-5 py-6 sm:px-8 lg:px-10" aria-label="Main navigation">
          <BrandWordmark light />
          <div className="flex items-center gap-3 text-sm font-bold">
            <Link href="/login" className="rounded-xl px-3 py-2.5 text-white/80 transition hover:bg-white/10 hover:text-white">Log in</Link>
            <Link href="/signup" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-extrabold text-[#382E9D] shadow-lg transition hover:bg-[#EEEAFE] sm:text-sm">Get started <ArrowUpRight className="h-4 w-4" /></Link>
          </div>
        </nav>
      </header>

      <section className="rp-hero-gradient rp-dot-grid relative overflow-hidden px-5 pb-32 pt-36 text-white sm:px-8 lg:px-10 lg:pb-44 lg:pt-48">
        <div className="rp-aurora absolute -left-64 top-14 h-[700px] w-[700px] rounded-full" />
        <div className="rp-aurora absolute -right-56 top-20 h-[650px] w-[650px] rounded-full" />
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-12">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[10px] font-extrabold uppercase tracking-[.15em] text-[#C5C0FF] sm:text-xs"><span className="h-1.5 w-1.5 rounded-full bg-[#6DE6C6]" /> Meet your new support teammate</span>
            <h1 className="mt-7 max-w-[600px] text-[42px] font-extrabold leading-[1.09] tracking-[-.065em] sm:text-[57px] lg:text-[65px] xl:text-[73px]">Support that feels <span className="text-[#C4B9FF]">one step ahead.</span></h1>
            <p className="mt-7 max-w-[475px] text-[15px] leading-7 text-[#CBC9E5] sm:text-[17px] sm:leading-8">Meet the AI support workspace that learns from your business, helps customers find answers, and keeps your team close to every conversation.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/signup" className="inline-flex items-center gap-2 rounded-2xl bg-[#7268FA] px-6 py-4 text-sm font-extrabold text-white shadow-[0_14px_30px_rgba(96,79,247,.24)] transition hover:-translate-y-1 hover:bg-[#8177FF]">Start free <ArrowRight className="h-4 w-4" /></Link>
              <Link href="#how-it-works" className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-4 text-sm font-bold text-white transition hover:bg-white/15">See how it works <ChevronRight className="h-4 w-4" /></Link>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-[#ADACD0]"><Check className="h-4 w-4 text-[#6DE6C6]" /> Start on the free plan · No credit card required</p>
          </div>
          <div className="mx-auto w-full max-w-[620px] py-4"><DemoWindow /></div>
        </div>
      </section>

      <section className="relative z-10 -mt-12 px-5 sm:px-8 lg:px-10">
        <div className="mx-auto grid max-w-[1120px] gap-4 rounded-[26px] border border-[#ECECF3] bg-white px-6 py-7 shadow-[0_25px_60px_rgba(32,25,70,.08)] md:grid-cols-3 md:gap-0 md:px-8">
          <div className="flex items-center gap-3 md:border-r md:border-[#E8E8F0] md:pr-5"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#EDEAFF] text-[#6156E7]"><Zap className="h-5 w-5" /></span><div><p className="text-sm font-extrabold">Always ready</p><p className="text-xs text-[#84859A]">Help customers on their schedule</p></div></div>
          <div className="flex items-center gap-3 md:border-r md:border-[#E8E8F0] md:px-6"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E8F9F2] text-[#239C75]"><Layers3 className="h-5 w-5" /></span><div><p className="text-sm font-extrabold">Business-aware</p><p className="text-xs text-[#84859A]">Answers shaped by your knowledge</p></div></div>
          <div className="flex items-center gap-3 md:pl-6"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF0E4] text-[#C47A2A]"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-sm font-extrabold">Human-first</p><p className="text-xs text-[#84859A]">Escalate when it matters</p></div></div>
        </div>
      </section>

      <section className="mx-auto max-w-[1180px] px-5 py-24 sm:px-8 lg:px-10 lg:py-32" id="features">
        <div className="max-w-[650px]"><AccentLabel>One workspace. More clarity.</AccentLabel><h2 className="mt-4 text-[33px] font-extrabold leading-tight tracking-[-.05em] sm:text-[46px]">Everything your team needs to be there for customers.</h2><p className="mt-4 max-w-[570px] text-[15px] leading-7 text-[#7E7D93]">From the first question to the personal follow-up, keep your support process in one organized place.</p></div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {features.map(({ icon: Icon, label, text, theme }) => (
            <div key={label} className="rp-panel group p-7 transition hover:-translate-y-1 hover:shadow-[0_20px_65px_rgba(40,36,83,.08)]">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${theme}`}><Icon className="h-6 w-6" /></span>
              <h3 className="mt-8 text-[18px] font-extrabold tracking-tight">{label}</h3>
              <p className="mt-3 text-[13px] leading-6 text-[#7D7D95]">{text}</p>
              <div className="mt-7 inline-flex items-center gap-1.5 text-xs font-bold text-[#6459E6]">Made for your workflow <ArrowUpRight className="h-4 w-4" /></div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white px-5 py-24 sm:px-8 lg:px-10" id="how-it-works">
        <div className="mx-auto max-w-[1180px]"><div className="max-w-[650px]"><AccentLabel>Simple by design</AccentLabel><h2 className="mt-4 text-[33px] font-extrabold tracking-[-.05em] sm:text-[46px]">From idea to helpful answers.</h2><p className="mt-4 text-[15px] leading-7 text-[#7E7D93]">A straightforward setup that grows with your business.</p></div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {[{n:"01",icon:Globe2,title:"Tell us about your business",text:"Create your workspace and get the basics in place."},{n:"02",icon:BookOpen,title:"Share what you know",text:"Add the knowledge your agent should use when answering."},{n:"03",icon:MousePointerClick,title:"Make it yours",text:"Test your agent, configure the widget, and connect your team."}].map(({n,icon:Icon,title,text})=>(
              <div key={n} className="rounded-[22px] border border-[#EDECF5] bg-[#FBFBFE] p-7"><div className="flex items-center justify-between"><span className="text-[11px] font-extrabold tracking-[.19em] text-[#AAA5CA]">STEP {n}</span><Icon className="h-5 w-5 text-[#6D62E9]" /></div><h3 className="mt-9 text-[18px] font-extrabold">{title}</h3><p className="mt-3 text-[13px] leading-6 text-[#85849B]">{text}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 lg:px-10">
        <div className="rp-hero-gradient relative mx-auto max-w-[1180px] overflow-hidden rounded-[32px] px-7 py-14 text-center text-white sm:px-10 lg:py-20"><div className="rp-aurora absolute -right-32 -top-28 h-80 w-80 rounded-full" /><div className="relative"><AccentLabel light>Let's get started</AccentLabel><h2 className="mx-auto mt-5 max-w-[670px] text-[34px] font-extrabold leading-tight tracking-[-.05em] sm:text-[46px]">Great customer conversations start here.</h2><p className="mx-auto mt-5 max-w-[530px] text-sm leading-7 text-[#CFCEE4]">Create your workspace and start building support that works for your business.</p><Link href="/signup" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3.5 text-sm font-extrabold text-[#4738B6] transition hover:bg-[#EEEAFE]">Create your free account <ArrowRight className="h-4 w-4" /></Link></div></div>
      </section>
      <footer className="mx-auto flex max-w-[1180px] flex-col gap-4 px-5 pb-10 pt-5 text-xs text-[#87869A] sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-10"><BrandWordmark /><span>© {new Date().getFullYear()} ReplyPilot. Made for better conversations.</span><div className="flex gap-5"><Link href="/login" className="hover:text-[#6257EF]">Log in</Link><Link href="/signup" className="hover:text-[#6257EF]">Get started</Link></div></footer>
    </div>
  );
}
