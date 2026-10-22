"use client";

import { createContext, useContext } from "react";
import type { StudentState } from "@/lib/modules/sessions/state";

export type StudentAction = Record<string, unknown> & { action: string };

export type WorkspaceCtx = {
  sessionId: string;
  state: StudentState;
  group: NonNullable<StudentState["group"]>;
  act: (b: StudentAction) => Promise<unknown>;
  refresh: () => void;
  openAssistant: (prefill?: { action?: string; text?: string }) => void;
  openChat: () => void;
};

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside workspace");
  return ctx;
}

export const roleName = (state: StudentState, key: string) => state.session.roles.find((r) => r.key === key)?.name ?? key;
