"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEV_TEAM } from "@/lib/dev-team";

export function DevLoginButtons({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleClick(name: string) {
    setLoading(name);
    const res = await fetch("/api/dev-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(null);
    if (res.ok) {
      router.push(callbackUrl);
      router.refresh();
    }
  }

  return (
    <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px dashed var(--line)" }}>
      <div className="eyebrow" style={{ marginBottom: 10 }}>
        Dev preview: sign in as
      </div>
      <div style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {DEV_TEAM.map((member) => (
          <button
            key={member.name}
            className="btn small"
            disabled={loading !== null}
            onClick={() => handleClick(member.name)}
          >
            {loading === member.name ? "Signing in…" : member.name}
          </button>
        ))}
      </div>
      <div className="helptext" style={{ marginTop: 10 }}>
        Only available in local development. Disabled automatically in production.
      </div>
    </div>
  );
}
