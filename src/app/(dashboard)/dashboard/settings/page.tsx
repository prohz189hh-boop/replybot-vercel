"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel, FieldLabel, inputClasses, ErrorText } from "@/components/ui/primitives";

interface BusinessProfile {
  name: string;
  website: string | null;
  industry: string | null;
  description: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
}

export default function SettingsPage() {
  const [form, setForm] = useState<BusinessProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/business")
      .then((res) => res.json())
      .then((data) => setForm(data.business));
  }, []);

  function update(key: keyof BusinessProfile) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => (f ? { ...f, [key]: e.target.value } : f));
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError(null);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/dashboard/business", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save changes.");
        return;
      }
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!form) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold text-ink">Settings</h1>
      <form onSubmit={onSave} className="mt-6">
        <Panel className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-ink">Business profile</h2>
          <div>
            <FieldLabel htmlFor="name">Business name</FieldLabel>
            <input id="name" className={inputClasses} value={form.name} onChange={update("name")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="website">Website</FieldLabel>
              <input id="website" className={inputClasses} value={form.website ?? ""} onChange={update("website")} />
            </div>
            <div>
              <FieldLabel htmlFor="industry">Industry</FieldLabel>
              <input id="industry" className={inputClasses} value={form.industry ?? ""} onChange={update("industry")} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="description">Description</FieldLabel>
            <textarea id="description" rows={3} className={inputClasses} value={form.description ?? ""} onChange={update("description")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FieldLabel htmlFor="contactEmail">Contact email</FieldLabel>
              <input id="contactEmail" className={inputClasses} value={form.contactEmail ?? ""} onChange={update("contactEmail")} />
            </div>
            <div>
              <FieldLabel htmlFor="contactPhone">Contact phone</FieldLabel>
              <input id="contactPhone" className={inputClasses} value={form.contactPhone ?? ""} onChange={update("contactPhone")} />
            </div>
          </div>
          <div>
            <FieldLabel htmlFor="address">Address</FieldLabel>
            <input id="address" className={inputClasses} value={form.address ?? ""} onChange={update("address")} />
          </div>
        </Panel>

        <ErrorText>{error}</ErrorText>
        {saved && !error && <p className="mt-2 text-sm text-resolved">Saved.</p>}
        <Button type="submit" disabled={saving} className="mt-4">
          {saving ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
