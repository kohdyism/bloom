import { z } from "zod";
import { route, uuid } from "@/lib/api";
import * as S from "@/lib/modules/sessions/student";
import { submitGroupWork } from "@/lib/modules/artifacts";
import { askPrivateAssistant } from "@/lib/modules/private-ai";
import { reflectionSchema } from "@/lib/domain/reflection";

const cluster = z.object({ id: z.string().max(20), title: z.string().max(80), summary: z.string().max(300), ideaIds: z.array(uuid).max(100) });

/**
 * Student live actions. Note there is no groupId anywhere: the server always
 * derives the caller's group from their own membership.
 */
const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("roles"), sessionId: uuid, roleKeys: z.array(z.string().max(40)).max(8) }),
  z.object({ action: z.literal("readiness"), sessionId: uuid, state: z.enum(["ready", "need_time"]).nullable() }),
  z.object({ action: z.literal("idea_save"), sessionId: uuid, id: uuid.optional(), body: z.string().max(1000), submit: z.boolean(), buildsOn: uuid.nullable().optional() }),
  z.object({ action: z.literal("idea_delete"), sessionId: uuid, id: uuid }),
  z.object({ action: z.literal("synthesis_edit"), sessionId: uuid, clusters: z.array(cluster).max(12), note: z.string().max(300).default("") }),
  z.object({ action: z.literal("synthesis_refresh"), sessionId: uuid }),
  z.object({ action: z.literal("message"), sessionId: uuid, body: z.string().max(2000), replyTo: uuid.nullable() }),
  z.object({ action: z.literal("react"), sessionId: uuid, messageId: uuid, kind: z.enum(["applaud", "agree", "build", "question"]) }),
  z.object({ action: z.literal("pin"), sessionId: uuid, messageId: uuid }),
  z.object({ action: z.literal("hand"), sessionId: uuid }),
  z.object({ action: z.literal("vote"), sessionId: uuid, targetId: uuid }),
  z.object({ action: z.literal("checkin"), sessionId: uuid, index: z.number().int().min(0).max(20) }),
  z.object({ action: z.literal("ask_group_ai"), sessionId: uuid, quick: z.enum(["explain_task", "discussion_question", "we_disagree", "we_are_stuck", "question"]), question: z.string().max(500).optional() }),
  z.object({ action: z.literal("help"), sessionId: uuid, reason: z.enum(["dont_understand", "need_time", "group_help", "speak_to_teacher", "uncomfortable", "other"]), message: z.string().max(1000).default("") }),
  z.object({ action: z.literal("message_teacher"), sessionId: uuid, body: z.string().max(2000), helpRequestId: uuid.nullable() }),
  z.object({ action: z.literal("submit"), sessionId: uuid, note: z.string().max(2000).default(""), expectedVersion: z.number().int().min(0) }),
  z.object({ action: z.literal("request_present"), sessionId: uuid }),
  z.object({ action: z.literal("presenter_slide"), sessionId: uuid, slide: z.number().int().min(0).max(200) }),
  z.object({ action: z.literal("reflection"), sessionId: uuid, ratings: reflectionSchema.shape.ratings, answers: reflectionSchema.shape.answers }),
  z.object({
    action: z.literal("assistant"), sessionId: uuid,
    request: z.enum(["explain_simply", "break_into_steps", "show_example", "what_is_group_doing", "summarise_discussion", "express_idea", "prepare_to_contribute", "stuck", "question"]),
    text: z.string().max(2000).optional(),
  }),
]);

export const POST = route({ role: "student", body: action }, async ({ user, body: b }) => {
  const u = user.id;
  switch (b.action) {
    case "roles": return S.setRoles(u, b.sessionId, b.roleKeys);
    case "readiness": return S.setReadiness(u, b.sessionId, b.state);
    case "idea_save": return S.saveIdea(u, b.sessionId, { id: b.id, body: b.body, submit: b.submit, buildsOn: b.buildsOn ?? null });
    case "idea_delete": return S.deleteIdea(u, b.sessionId, b.id);
    case "synthesis_edit": return S.editSynthesis(u, b.sessionId, b.clusters, b.note);
    case "synthesis_refresh": return S.requestResynthesis(u, b.sessionId);
    case "message": return S.postMessage(u, b.sessionId, b.body, b.replyTo);
    case "react": return S.toggleReaction(u, b.sessionId, b.messageId, b.kind);
    case "pin": return S.togglePin(u, b.sessionId, b.messageId);
    case "hand": return S.toggleHand(u, b.sessionId);
    case "vote": return S.toggleVote(u, b.sessionId, b.targetId);
    case "checkin": return S.toggleCheckin(u, b.sessionId, b.index);
    case "ask_group_ai": return S.askFacilitator(u, b.sessionId, b.quick, b.question);
    case "help": return { id: await S.createHelpRequest(u, b.sessionId, b.reason, b.message) };
    case "message_teacher": return S.messageTeacher(u, b.sessionId, b.body, b.helpRequestId);
    case "submit": return submitGroupWork(u, b.sessionId, b.note, b.expectedVersion);
    case "request_present": return S.requestToPresent(u, b.sessionId);
    case "presenter_slide": return S.presenterNavigate(u, b.sessionId, b.slide);
    case "reflection": return S.submitReflection(u, b.sessionId, b.ratings, Object.fromEntries(Object.entries(b.answers).filter(([, v]) => v && v.trim()).map(([k, v]) => [k, v!.trim()])));
    case "assistant": return askPrivateAssistant(u, b.sessionId, b.request, b.text);
  }
});
