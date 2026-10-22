"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/primitives";
import { api } from "@/lib/realtime/client";

export function JoinForm({ initialCode = "", autoSubmit = false }: { initialCode?: string; autoSubmit?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode.toUpperCase());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const tried = useRef(false);

  async function join(c: string) {
    setPending(true);
    setError(null);
    try {
      const { sessionId } = await api<{ sessionId: string }>("/api/join", { method: "POST", json: { code: c } });
      router.push(`/student/session/${sessionId}`);
    } catch (e) {
      setError((e as Error).message);
      setPending(false);
    }
  }

  useEffect(() => {
    if (autoSubmit && initialCode && !tried.current) {
      tried.current = true;
      void join(initialCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmit, initialCode]);

  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void join(code); }}>
      <label htmlFor="join-code" className="font-semibold">Lesson code</label>
      <div className="flex flex-wrap gap-3">
        <input
          id="join-code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8))}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          inputMode="text"
          placeholder="ABC123"
          aria-describedby={error ? "join-error" : undefined}
          aria-invalid={error ? true : undefined}
          className="h-14 min-w-0 flex-1 rounded-2xl border-2 border-line-strong bg-surface px-4 text-center font-display text-3xl font-bold tracking-[0.25em] uppercase placeholder:text-ink-faint/50"
        />
        <Button type="submit" size="lg" className="h-14" pending={pending} disabled={code.length < 4}><LogIn />Join</Button>
      </div>
      {error ? <Notice tone="coral" role="alert"><span id="join-error">{error}</span></Notice> : null}
    </form>
  );
}
