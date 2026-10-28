"use client";

import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintBar({ back }: { back: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
      <Button asChild variant="ghost"><Link href={back}><ArrowLeft />Back</Link></Button>
      <p className="flex-1 text-sm text-ink-muted">In the print window, choose <strong>Save as PDF</strong> as the printer.</p>
      <Button onClick={() => window.print()}><Printer />Print or save as PDF</Button>
    </div>
  );
}
