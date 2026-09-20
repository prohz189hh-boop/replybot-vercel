"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ErrorText, FieldLabel, inputClasses, Panel } from "@/components/ui/primitives";

const STEPS = ["Business", "Agent", "Knowledge", "Test", "Install"];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [businessName, setBusinessName] = useState("");
  const [website, setWebsite] = useState("");
  const [industry, setIndustry] = useState("");
  const [description, setDescription] = useState("");
  const [agentName, setAgentName] = useState("ReplyPilot");
  const [personality, setPersonality] = useState("FRIENDLY");
  const [responseLength, setResponseLength] = useState("BALANCED");
  const [knowledgeName, setKnowledgeName] = useState("About our business");
  const [knowledge, setKnowledge] = useState("");
  const [knowledgeUrl, setKnowledgeUrl] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState<"TEXT" | "WEBSITE">("TEXT");
  const [agentId, setAgentId] = useState("");
  const [agentPublicId, setAgentPublicId] = useState("");
  const [testMessage, setTestMessage] = useState("What can you help me with?");
  const [testReply, setTestReply] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const installSnippet = useMemo(
    () => `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget/loader.js" data-agent-id="${agentPublicId}"></script>`,
    [agentPublicId],
  );

  async function post(body: unknown) {
    const res = await fetch("/api/onboarding/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
    return data;
  }

  async function next() {
    setError(null);
    setLoading(true);
    try {
      if (step === 0) {
        await post({ action: "business", name: businessName, website, industry, description });
      } else if (step === 1) {
        const data = await post({ action: "agent", name: agentName, personality, responseLength });
        setAgentId(data.agent.id);
        setAgentPublicId(data.agent.publicId);
      } else if (step === 2) {
        if (knowledgeMode === "TEXT" && knowledge.trim()) {
          await post({ action: "knowledge", agentId, kind: "TEXT", name: knowledgeName, content: knowledge });
        } else if (knowledgeMode === "WEBSITE" && knowledgeUrl.trim()) {
          await post({ action: "knowledge", agentId, kind: "WEBSITE", name: knowledgeName, url: knowledgeUrl });
        }
      } else if (step === 3) {
        if (!testMessage.trim()) throw new Error("Enter a test question.");
        const res = await fetch(`/api/dashboard/agents/${agentId}/playground`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: testMessage }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "The test request failed.");
        setTestReply(data.reply);
      } else if (step === 4) {
        router.push("/dashboard");
        router.refresh();
        return;
      }
      setStep((s) => Math.min(s + 1, 4));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  return (
    <main className="min-h-screen bg-paper px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <p className="text-lg font-semibold text-ink">ReplyPilot</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Let's get your AI support agent live</h1>
          <p className="mt-1 text-sm text-muted">A quick five-step setup. You can change everything later.</p>
        </div>

        <div className="mt-8 grid grid-cols-5 gap-1.5">
          {STEPS.map((name, i) => (
            <div key={name} className="text-center">
              <div className={`h-1 rounded-full ${i <= step ? "bg-signal-600" : "bg-line"}`} />
              <p className={`mt-2 text-[11px] ${i === step ? "font-semibold text-ink" : "text-muted"}`}>{name}</p>
            </div>
          ))}
        </div>

        <Panel className="mt-6 p-6">
          {step === 0 && (
            <>
              <h2 className="text-lg font-semibold text-ink">Tell us about your business</h2>
              <p className="mt-1 text-sm text-muted">This information helps you organize your ReplyPilot workspace.</p>
              <div className="mt-5 space-y-4">
                <div><FieldLabel htmlFor="businessName">Business name</FieldLabel><input id="businessName" className={inputClasses} value={businessName} onChange={(e) => setBusinessName(e.target.value)} autoFocus /></div>
                <div><FieldLabel htmlFor="website">Website (optional)</FieldLabel><input id="website" className={inputClasses} placeholder="https://example.com" value={website} onChange={(e) => setWebsite(e.target.value)} /></div>
                <div><FieldLabel htmlFor="industry">Industry (optional)</FieldLabel><input id="industry" className={inputClasses} placeholder="Retail, restaurant, SaaS…" value={industry} onChange={(e) => setIndustry(e.target.value)} /></div>
                <div><FieldLabel htmlFor="description">Short description (optional)</FieldLabel><textarea id="description" className={`${inputClasses} min-h-24`} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h2 className="text-lg font-semibold text-ink">Create your AI agent</h2>
              <p className="mt-1 text-sm text-muted">Pick the starting personality. You can fine-tune it later.</p>
              <div className="mt-5 space-y-4">
                <div><FieldLabel htmlFor="agentName">Agent name</FieldLabel><input id="agentName" className={inputClasses} value={agentName} onChange={(e) => setAgentName(e.target.value)} /></div>
                <div><FieldLabel htmlFor="personality">Personality</FieldLabel><select id="personality" className={inputClasses} value={personality} onChange={(e) => setPersonality(e.target.value)}><option value="FRIENDLY">Friendly</option><option value="PROFESSIONAL">Professional</option><option value="CONCISE">Concise</option><option value="DETAILED">Detailed</option></select></div>
                <div><FieldLabel htmlFor="responseLength">Response length</FieldLabel><select id="responseLength" className={inputClasses} value={responseLength} onChange={(e) => setResponseLength(e.target.value)}><option value="SHORT">Short</option><option value="BALANCED">Balanced</option><option value="DETAILED">Detailed</option></select></div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-lg font-semibold text-ink">Give your agent knowledge</h2>
              <p className="mt-1 text-sm text-muted">Add a short FAQ/about-us text, or index one website page. You can skip this and add more later.</p>
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setKnowledgeMode("TEXT")} className={`rounded-md border px-3 py-2 text-sm ${knowledgeMode === "TEXT" ? "border-signal-600 bg-signal-50" : "border-line"}`}>Text / FAQ</button>
                <button type="button" onClick={() => setKnowledgeMode("WEBSITE")} className={`rounded-md border px-3 py-2 text-sm ${knowledgeMode === "WEBSITE" ? "border-signal-600 bg-signal-50" : "border-line"}`}>Website</button>
              </div>
              <div className="mt-4 space-y-4">
                <div><FieldLabel htmlFor="knowledgeName">Source name</FieldLabel><input id="knowledgeName" className={inputClasses} value={knowledgeName} onChange={(e) => setKnowledgeName(e.target.value)} /></div>
                {knowledgeMode === "TEXT" ? (
                  <div><FieldLabel htmlFor="knowledge">Knowledge</FieldLabel><textarea id="knowledge" className={`${inputClasses} min-h-40`} placeholder="Opening hours, products, pricing, policies, common questions…" value={knowledge} onChange={(e) => setKnowledge(e.target.value)} /></div>
                ) : (
                  <div><FieldLabel htmlFor="knowledgeUrl">Website URL</FieldLabel><input id="knowledgeUrl" className={inputClasses} placeholder="https://example.com" value={knowledgeUrl} onChange={(e) => setKnowledgeUrl(e.target.value)} /></div>
                )}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-lg font-semibold text-ink">Test your agent</h2>
              <p className="mt-1 text-sm text-muted">This uses the same RAG playground your team can use later.</p>
              <div className="mt-5">
                <FieldLabel htmlFor="testMessage">Test question</FieldLabel>
                <textarea id="testMessage" className={`${inputClasses} mt-1 min-h-24`} value={testMessage} onChange={(e) => setTestMessage(e.target.value)} />
                {testReply && <div className="mt-4 rounded-md border border-line bg-paper p-4"><p className="text-xs font-medium text-muted">Agent response</p><p className="mt-2 text-sm text-ink">{testReply}</p></div>}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <h2 className="text-lg font-semibold text-ink">Install the widget</h2>
              <p className="mt-1 text-sm text-muted">Paste this snippet before the closing body tag on your website. Add your website domain in Agent settings first if your widget is blocked by origin protection.</p>
              <div className="mt-5 rounded-md border border-line bg-paper p-4">
                <code className="block break-all text-xs text-ink">{installSnippet}</code>
                <button type="button" className="mt-3 text-xs font-medium text-signal-700 hover:underline" onClick={() => navigator.clipboard?.writeText(installSnippet)}>Copy snippet</button>
              </div>
              <div className="mt-4 rounded-md border border-line p-4 text-sm text-muted">
                Your agent is ready. The full dashboard remains available for knowledge, inbox, team, analytics, settings, and billing display.
              </div>
            </>
          )}

          <ErrorText>{error}</ErrorText>
          <div className="mt-6 flex justify-between gap-3">
            <Button type="button" variant="secondary" onClick={back} disabled={step === 0 || loading}>Back</Button>
            <Button type="button" onClick={next} disabled={loading || (step === 0 && !businessName.trim()) || (step === 1 && !agentName.trim())}>
              {loading ? "Working…" : step === 4 ? "Go to dashboard" : step === 2 ? "Continue" : "Continue"}
            </Button>
          </div>
        </Panel>
      </div>
    </main>
  );
}
