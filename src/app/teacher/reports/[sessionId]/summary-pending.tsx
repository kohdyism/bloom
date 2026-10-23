"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Bloom } from "@/components/mascot";
import { Card, CardBody } from "@/components/ui/primitives";
import { generateReportAction } from "./actions";

/** Shown while the summary is being written; the rest of the report is already here. */
export function SummaryPending({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void generateReportAction(sessionId).catch(() => {}).finally(() => router.refresh());
  }, [sessionId, router]);
  return (
    <Card className="border-purple/30">
      <CardBody className="flex items-center gap-3" role="status">
        <span className="buddy-chatter block"><Bloom size={40} mood="thinking" /></span>
        <p className="text-ink-muted">Writing a summary of the lesson… the rest of the report is ready below.</p>
      </CardBody>
    </Card>
  );
}
