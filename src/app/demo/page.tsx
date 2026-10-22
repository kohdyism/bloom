import Link from "next/link";
import { Mascot } from "@/components/mascot";
import { Card } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Demo guide" };

const STEPS: { title: string; body: React.ReactNode }[] = [
  { title: "Open the teacher view", body: <>In your normal browser window, sign in as <code>teacher.demo</code> / <code>bloom-demo</code>. Open <strong>Lesson library → Reading ‘Alone’ together</strong> and press <strong>Launch lesson</strong>.</> },
  { title: "Open the classroom display", body: <>In the lobby, press <strong>Open classroom display</strong>. Put that tab on a second screen or projector. It never shows private information.</> },
  { title: "Join as students", body: <>Open two or three <strong>private/incognito windows</strong> (or different browsers or devices). Sign in as <code>ben.o</code>, <code>chloe.m</code>, <code>dev.p</code>, <code>elena.r</code>… with password <code>bloom-student</code>, then type the join code. Sign in as <code>ava.k</code> to see the first-time preferences survey.</> },
  { title: "Make groups", body: <>Back in the teacher window, press <strong>Suggest groups</strong>. Drag students between groups (or use each name&apos;s “Move to” menu), read the reasons, then <strong>Approve groups</strong> and <strong>Start lesson</strong>.</> },
  { title: "Work as a group", body: <>In the student windows: add private ideas, then mark “I&apos;m done thinking”. Watch the AI synthesis appear, discuss in the chat, ask <strong>Bloom</strong> as a group, open <strong>Ask Pip</strong> privately, and try <strong>Need help</strong> — the teacher sees it instantly.</> },
  { title: "Create, submit and present", body: <>Write the shared paragraph together (type in two windows at once), submit it, then use the teacher&apos;s <strong>Presentations</strong> panel to present it on the display and every student&apos;s device.</> },
  { title: "End and reflect", body: <>Press <strong>End lesson</strong>. Students complete a short reflection; the teacher opens <strong>Reports</strong> to see the lesson report and can deliberately open an individual reflection.</> },
];

export default function DemoGuide() {
  return (
    <main id="main" className="mx-auto w-full flex max-w-3xl flex-col gap-6 px-5 py-10">
      <div className="flex items-center gap-4">
        <Mascot mood="wave" size={72} />
        <div>
          <h1 className="font-display text-3xl font-bold">Try Canopy: a guided demo</h1>
          <p className="text-ink-muted">Everything here uses fictional students and simulated support needs.</p>
        </div>
      </div>
      <ol className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <Card className="flex gap-4 p-5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-teal font-display font-bold text-white">{i + 1}</span>
              <div><h2 className="font-semibold">{s.title}</h2><p className="mt-1 text-ink-muted">{s.body}</p></div>
            </Card>
          </li>
        ))}
      </ol>
      <p className="text-sm text-ink-muted">Other demo lessons: <strong>Paper Aeroplane Challenge</strong> (Year 8 Design &amp; Technology — roles, physical check-ins and photo evidence) and <strong>School Improvement Challenge</strong> (Year 9 Citizenship — anonymous ideas, voting, whiteboard and slides).</p>
      <Button asChild size="lg" className="self-start"><Link href="/sign-in">Go to sign in</Link></Button>
    </main>
  );
}
