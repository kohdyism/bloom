import { z } from "zod";
import { route, uuid } from "@/lib/api";
import * as T from "@/lib/modules/sessions/teacher";

const action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve_groups"), sessionId: uuid, groups: z.array(z.array(uuid).max(12)).max(30) }),
  z.object({ action: z.literal("start"), sessionId: uuid }),
  z.object({ action: z.literal("pause"), sessionId: uuid }),
  z.object({ action: z.literal("resume"), sessionId: uuid }),
  z.object({ action: z.literal("end"), sessionId: uuid }),
  z.object({ action: z.literal("refresh_code"), sessionId: uuid }),
  z.object({ action: z.literal("group_pause"), sessionId: uuid, groupId: uuid, paused: z.boolean() }),
  z.object({ action: z.literal("group_extend"), sessionId: uuid, groupId: uuid, seconds: z.number().int() }),
  z.object({ action: z.literal("group_advance"), sessionId: uuid, groupId: uuid }),
  z.object({ action: z.literal("group_reset"), sessionId: uuid, groupId: uuid, mode: z.enum(["restart", "back"]) }),
  z.object({ action: z.literal("group_ai"), sessionId: uuid, groupId: uuid, enabled: z.boolean() }),
  z.object({ action: z.literal("group_message"), sessionId: uuid, groupId: uuid, body: z.string().min(1).max(2000) }),
  z.object({ action: z.literal("group_prompt_ai"), sessionId: uuid, groupId: uuid }),
  z.object({ action: z.literal("reassign"), sessionId: uuid, studentId: uuid, groupId: uuid }),
  z.object({ action: z.literal("announce"), sessionId: uuid, body: z.string().min(1).max(500), groupId: uuid.nullable() }),
  z.object({ action: z.literal("help_status"), sessionId: uuid, helpId: uuid, status: z.enum(["seen", "responding", "resolved"]) }),
  z.object({ action: z.literal("private_message"), sessionId: uuid, studentId: uuid, body: z.string().min(1).max(2000), helpRequestId: uuid.nullable() }),
  z.object({ action: z.literal("review_submission"), sessionId: uuid, submissionId: uuid, status: z.enum(["reviewed", "returned"]), feedback: z.string().max(2000) }),
  z.object({ action: z.literal("present"), sessionId: uuid, groupId: uuid, view: z.enum(["document", "whiteboard", "slides", "media"]).nullable() }),
  z.object({ action: z.literal("present_update"), sessionId: uuid, slide: z.number().int().min(0).max(200).optional(), view: z.enum(["document", "whiteboard", "slides", "media"]).optional(), presenterId: uuid.nullable().optional() }),
  z.object({ action: z.literal("present_stop"), sessionId: uuid }),
  z.object({ action: z.literal("present_decline"), sessionId: uuid, requestId: uuid }),
]);

export const POST = route({ role: "teacher", body: action }, async ({ user, body: b }) => {
  const u = user.id;
  switch (b.action) {
    case "approve_groups": return T.approveGroups(u, b.sessionId, b.groups);
    case "start": return T.startSession(u, b.sessionId);
    case "pause": return T.setSessionPaused(u, b.sessionId, true);
    case "resume": return T.setSessionPaused(u, b.sessionId, false);
    case "end": return T.endSession(u, b.sessionId);
    case "refresh_code": return T.refreshJoinCode(u, b.sessionId);
    case "group_pause": return T.setGroupPaused(u, b.sessionId, b.groupId, b.paused);
    case "group_extend": return T.extendGroup(u, b.sessionId, b.groupId, b.seconds);
    case "group_advance": return T.teacherAdvanceGroup(u, b.sessionId, b.groupId);
    case "group_reset": return T.resetGroupStage(u, b.sessionId, b.groupId, b.mode);
    case "group_ai": return T.setGroupAi(u, b.sessionId, b.groupId, b.enabled);
    case "group_message": return T.teacherGroupMessage(u, b.sessionId, b.groupId, b.body);
    case "group_prompt_ai": return T.teacherPromptFacilitator(u, b.sessionId, b.groupId);
    case "reassign": return T.reassignStudent(u, b.sessionId, b.studentId, b.groupId);
    case "announce": return T.sendAnnouncement(u, b.sessionId, b.body, b.groupId);
    case "help_status": return T.updateHelpRequest(u, b.sessionId, b.helpId, b.status);
    case "private_message": return T.sendPrivateMessage(u, b.sessionId, b.studentId, b.body, b.helpRequestId);
    case "review_submission": return T.reviewSubmission(u, b.sessionId, b.submissionId, b.status, b.feedback);
    case "present": return T.startPresentation(u, b.sessionId, b.groupId, b.view);
    case "present_update": return T.updatePresentation(u, b.sessionId, { slide: b.slide, view: b.view, presenterId: b.presenterId });
    case "present_stop": return T.stopPresentation(u, b.sessionId);
    case "present_decline": return T.declinePresentationRequest(u, b.sessionId, b.requestId);
  }
});
