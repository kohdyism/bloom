"use client";

import { createContext, useContext } from "react";
import type { StudentState } from "@/lib/modules/sessions/state";

export type StudentAction = Record<string, unknown> & { action: string };

/** Where an idea from the idea bank can be dropped (the visible shared editor). */
export type Inserter = { label: string; insert: (text: string) => void };

export type WorkspaceCtx = {
  sessionId: string;
  state: StudentState;
  group: NonNullable<StudentState["group"]>;
  act: (b: StudentAction) => Promise<unknown>;
  refresh: () => void;
  openAssistant: (prefill?: { action?: string; text?: string }) => void;
  openChat: () => void;
  /** Switch the activity panel to the Ideas tab. */
  openIdeas: () => void;
  /** Increments each time openIdeas is called. */
  ideasSignal: number;
  inserter: Inserter | null;
  setInserter: (i: Inserter | null) => void;
  /** Brainstorm: load one of my ideas back into the writing box. */
  editRequest: { id: string; body: string; n: number } | null;
  requestEdit: (id: string, body: string) => void;
};

export const WorkspaceContext = createContext<WorkspaceCtx | null>(null);

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace outside workspace");
  return ctx;
}

export const roleName = (state: StudentState, key: string) => state.session.roles.find((r) => r.key === key)?.name ?? key;
