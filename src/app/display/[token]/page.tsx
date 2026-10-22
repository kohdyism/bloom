import { notFound } from "next/navigation";
import { displayState } from "@/lib/modules/sessions/state";
import { NotFoundError } from "@/lib/db";
import { ClassroomDisplay } from "./classroom-display";

export const metadata = { title: "Classroom display", robots: { index: false } };

export default async function DisplayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) notFound();
  const initial = await displayState(token).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return <ClassroomDisplay token={token} initial={initial} />;
}
