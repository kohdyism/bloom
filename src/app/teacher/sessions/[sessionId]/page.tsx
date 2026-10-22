import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { teacherState } from "@/lib/modules/sessions/state";
import { NotFoundError } from "@/lib/db";
import { Toaster } from "@/components/ui/toast";
import { LiveSession } from "./live-session";

export const metadata = { title: "Live lesson" };

export default async function LiveSessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireUser("teacher");
  const { sessionId } = await params;
  const initial = await teacherState(user.id, sessionId).catch((e) => {
    if (e instanceof NotFoundError || (e as { code?: string }).code === "22P02") notFound();
    throw e;
  });
  return (
    <Toaster>
      <LiveSession sessionId={sessionId} initial={initial} />
    </Toaster>
  );
}
