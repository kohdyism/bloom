"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerateReportAction } from "./actions";

export function RegenerateButton({ sessionId }: { sessionId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button size="sm" variant="ghost" pending={pending} onClick={() => start(() => regenerateReportAction(sessionId))}>
      {!pending ? <RefreshCw /> : null}Regenerate summary
    </Button>
  );
}
