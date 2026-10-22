import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { Mascot } from "@/components/mascot";
import { SignInForm } from "./sign-in-form";
import { config } from "@/lib/config";

export const metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  const { next } = await searchParams;
  if (user) redirect(user.role === "teacher" ? "/teacher" : "/student");
  return (
    <main id="main" className="mx-auto grid min-h-[calc(100dvh-2rem)] max-w-5xl items-center gap-10 px-5 py-10 md:grid-cols-[1.1fr_1fr]">
      <section className="hidden md:block">
        <div className="flex items-center gap-3">
          <Mascot mood="wave" size={88} />
          <div>
            <p className="font-display text-4xl font-bold tracking-tight">Bloom</p>
            <p className="text-ink-muted">Think together. Grow together.</p>
          </div>
        </div>
        <ul className="mt-10 space-y-4 text-[0.95rem]">
          <li className="flex gap-3"><Dot className="bg-teal" />Share ideas your way — written, spoken or on the board.</li>
          <li className="flex gap-3"><Dot className="bg-blue" />A friendly facilitator that helps your group, not one that takes over.</li>
          <li className="flex gap-3"><Dot className="bg-purple" />Private help whenever you need it — your groupmates won’t see it.</li>
        </ul>
      </section>
      <section className="rounded-3xl border border-line bg-surface p-7 shadow-lift sm:p-9">
        <div className="mb-6 md:hidden"><Mascot mood="wave" size={64} /></div>
        <h1 className="font-display text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-ink-muted">Use the username your teacher gave you.</p>
        <SignInForm next={next} />
        {config.demoMode ? <DemoAccounts /> : null}
      </section>
    </main>
  );
}

function Dot({ className }: { className: string }) {
  return <span aria-hidden="true" className={`mt-2 size-2.5 shrink-0 rounded-full ${className}`} />;
}

function DemoAccounts() {
  return (
    <details className="mt-6 rounded-xl border border-dashed border-line-strong bg-surface-2 px-4 py-3 text-sm">
      <summary className="cursor-pointer font-semibold">Demo accounts (fictional)</summary>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-ink-muted">Teacher</dt>
        <dd><code>teacher.demo</code> / <code>bloom-demo</code></dd>
        <dt className="text-ink-muted">Students</dt>
        <dd><code>ben.o</code>, <code>chloe.m</code>, <code>dev.p</code>, … / <code>bloom-student</code></dd>
        <dt className="text-ink-muted">First-time</dt>
        <dd><code>ava.k</code> / <code>bloom-student</code> (sees the onboarding survey)</dd>
      </dl>
      <p className="mt-3 text-ink-muted">Tip: open the teacher in one browser and students in private windows or other browsers to try a live lesson. See <a className="text-teal underline" href="/demo">the demo guide</a>.</p>
    </details>
  );
}
