import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { studentState } from "@/lib/modules/sessions/state";
import { NotFoundError } from "@/lib/db";
import { Toaster } from "@/components/ui/toast";
import { MascotSays } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { Workspace } from "./workspace";

export const metadata = { title: "Lesson" };

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser("student");
  const { sessionId } = await params;
  const initial = await studentState(user.id, sessionId).catch((e) => {
    if (e instanceof NotFoundError || (e as { code?: string }).code === "22P02") return null;
    throw e;
  });
  if (!initial) {
    return (
      <div className="mx-auto w-full flex max-w-xl flex-col gap-6 px-4 py-12">
        <MascotSays mood="thinking">We couldn&apos;t open that lesson. You may need to join it with the code on the board first.</MascotSays>
        <Button asChild className="self-start"><Link href="/student">Enter a code</Link></Button>
      </div>
    );
  }
  return (
    <Toaster>
      <Workspace sessionId={sessionId} initial={initial} />
    </Toaster>
  );
}
