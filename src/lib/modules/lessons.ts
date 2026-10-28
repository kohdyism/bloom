import "server-only";
import { asUser, NotFoundError, type Db } from "@/lib/db";
import {
  lessonConfigSchema, lessonDraftSchema, stageConfigSchema, type LessonDraft, type StageKind,
} from "@/lib/domain/lesson";

export type LessonListItem = {
  id: string; title: string; subject: string; yearLevel: string; className: string | null; classId: string | null;
  stageCount: number; totalSeconds: number; isTemplate: boolean; source: string; needsApproval: boolean; updatedAt: string;
  tags: string[];
  folderId: string | null;
};

export async function listLessons(uid: string): Promise<LessonListItem[]> {
  return asUser(uid, async (db) => {
    const rows = await db.query<{
      id: string; title: string; subject: string; year_level: string; class_name: string | null; class_id: string | null;
      stages: string; seconds: string | null; is_template: boolean; source: string; ai_draft_approved_at: Date | null; updated_at: Date; tags: unknown; folder_id: string | null;
    }>(
      `select l.id, l.title, l.subject, l.year_level, c.name as class_name, l.class_id, l.is_template, l.source, l.ai_draft_approved_at, l.updated_at, l.config -> 'tags' as tags, l.folder_id,
              (select count(*) from lesson_stages s where s.lesson_id = l.id) as stages,
              (select sum(duration_seconds) from lesson_stages s where s.lesson_id = l.id) as seconds
       from lessons l left join classes c on c.id = l.class_id
       where l.teacher_id = $1 order by l.updated_at desc`,
      [uid],
    );
    return rows.map((r) => ({
      id: r.id, title: r.title, subject: r.subject, yearLevel: r.year_level, className: r.class_name, classId: r.class_id,
      stageCount: Number(r.stages), totalSeconds: Number(r.seconds ?? 0), isTemplate: r.is_template, source: r.source,
      needsApproval: r.source === "ai" && !r.ai_draft_approved_at, updatedAt: r.updated_at.toISOString(),
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string").slice(0, 10) : [],
      folderId: r.folder_id,
    }));
  });
}

export type LessonDetail = LessonDraft & {
  id: string; classId: string | null; isTemplate: boolean; source: string; needsApproval: boolean;
  materials: { id: string; kind: string; title: string; body: string; storagePath: string | null; mimeType: string | null }[];
};

export async function loadLesson(db: Db, uid: string, lessonId: string): Promise<LessonDetail> {
  const l = await db.maybeOne<{
    id: string; title: string; description: string; subject: string; year_level: string; objectives: string[]; config: unknown;
    class_id: string | null; is_template: boolean; source: string; ai_draft_approved_at: Date | null;
  }>("select * from lessons where id = $1 and teacher_id = $2", [lessonId, uid]);
  if (!l) throw new NotFoundError();
  const stages = await db.query<{ id: string; kind: StageKind; title: string; instructions: string; duration_seconds: number; config: unknown }>(
    "select id, kind, title, instructions, duration_seconds, config from lesson_stages where lesson_id = $1 order by position",
    [lessonId],
  );
  const materials = await db.query<{ id: string; kind: string; title: string; body: string; storage_path: string | null; mime_type: string | null }>(
    "select id, kind, title, body, storage_path, mime_type from lesson_materials where lesson_id = $1 and kind <> 'stage_file' order by created_at",
    [lessonId],
  );
  return {
    id: l.id,
    title: l.title,
    description: l.description,
    subject: l.subject,
    yearLevel: l.year_level,
    objectives: l.objectives,
    config: lessonConfigSchema.parse(l.config ?? {}),
    stages: stages.map((s) => ({
      id: s.id, kind: s.kind, title: s.title, instructions: s.instructions, durationSeconds: s.duration_seconds,
      config: stageConfigSchema.parse(s.config ?? {}),
    })),
    classId: l.class_id,
    isTemplate: l.is_template,
    source: l.source,
    needsApproval: l.source === "ai" && !l.ai_draft_approved_at,
    materials: materials.map((m) => ({ id: m.id, kind: m.kind, title: m.title, body: m.body, storagePath: m.storage_path, mimeType: m.mime_type })),
  };
}

export async function getLesson(uid: string, lessonId: string) {
  return asUser(uid, (db) => loadLesson(db, uid, lessonId));
}

async function writeStages(db: Db, lessonId: string, draft: LessonDraft) {
  await db.query("delete from lesson_stages where lesson_id = $1", [lessonId]);
  for (const [pos, st] of draft.stages.entries()) {
    await db.query(
      `insert into lesson_stages(lesson_id, position, kind, title, instructions, duration_seconds, config)
       values ($1,$2,$3,$4,$5,$6,$7)`,
      [lessonId, pos, st.kind, st.title, st.instructions, st.durationSeconds, JSON.stringify(st.config)],
    );
  }
}

export async function createLesson(uid: string, draftInput: LessonDraft, opts: { classId?: string | null; source: "scratch" | "template" | "ai"; isTemplate?: boolean }) {
  const draft = lessonDraftSchema.parse(draftInput);
  return asUser(uid, async (db) => {
    const { id } = await db.one<{ id: string }>(
      `insert into lessons(teacher_id, class_id, title, description, subject, year_level, objectives, config, source, is_template)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) returning id`,
      [uid, opts.classId ?? null, draft.title, draft.description, draft.subject, draft.yearLevel, draft.objectives,
        JSON.stringify(draft.config), opts.source, opts.isTemplate ?? false],
    );
    await writeStages(db, id, draft);
    return id;
  });
}

export async function saveLesson(uid: string, lessonId: string, draftInput: LessonDraft, classId: string | null) {
  const draft = lessonDraftSchema.parse(draftInput);
  if (draft.config.groupSizeMin > draft.config.groupSizeMax) throw new Error("Minimum group size can't be larger than the maximum.");
  return asUser(uid, async (db) => {
    const updated = await db.query(
      `update lessons set title=$3, description=$4, subject=$5, year_level=$6, objectives=$7, config=$8, class_id=$9
       where id = $1 and teacher_id = $2 returning id`,
      [lessonId, uid, draft.title, draft.description, draft.subject, draft.yearLevel, draft.objectives, JSON.stringify(draft.config), classId],
    );
    if (!updated.length) throw new NotFoundError();
    // A lesson moved to another class leaves the old class's folder.
    await db.query(
      "update lessons set folder_id = null where id = $1 and folder_id is not null and folder_id not in (select id from lesson_folders where class_id is not distinct from $2)",
      [lessonId, classId],
    );
    await writeStages(db, lessonId, draft);
  });
}

export async function approveAiDraft(uid: string, lessonId: string) {
  await asUser(uid, async (db) => {
    await db.query("update lessons set ai_draft_approved_at = now() where id = $1 and teacher_id = $2", [lessonId, uid]);
    await db.query("insert into audit_events(actor_id, action, target) values ($1, 'lesson.ai_draft_approved', $2)", [uid, lessonId]);
  });
}

export async function duplicateLesson(uid: string, lessonId: string, asTemplate: boolean) {
  const lesson = await getLesson(uid, lessonId);
  const id = await createLesson(uid, { ...lesson, title: asTemplate ? `${lesson.title} (template)` : `${lesson.title} (copy)` }, {
    classId: asTemplate ? null : lesson.classId, source: "template", isTemplate: asTemplate,
  });
  await asUser(uid, async (db) => {
    await db.query(
      `insert into lesson_materials(lesson_id, kind, title, body, storage_path, mime_type)
       select $2, kind, title, body, storage_path, mime_type from lesson_materials where lesson_id = $1 and kind <> 'stage_file'`,
      [lessonId, id],
    );
    // Files attached to stages are copied too, and the copy's stages point at the new copies.
    const files = await db.query<{ id: string; title: string; storage_path: string; mime_type: string }>(
      "select id, title, storage_path, mime_type from lesson_materials where lesson_id = $1 and kind = 'stage_file'",
      [lessonId],
    );
    for (const f of files) {
      const copy = await db.one<{ id: string }>(
        "insert into lesson_materials(lesson_id, kind, title, storage_path, mime_type) values ($1, 'stage_file', $2, $3, $4) returning id",
        [id, f.title, f.storage_path, f.mime_type],
      );
      await db.query("update lesson_stages set config = replace(config::text, $2, $3)::jsonb where lesson_id = $1", [id, f.id, copy.id]);
    }
  });
  return id;
}

export async function deleteLesson(uid: string, lessonId: string) {
  await asUser(uid, (db) => db.query("delete from lessons where id = $1 and teacher_id = $2", [lessonId, uid]));
}

export async function addTextMaterial(uid: string, lessonId: string, title: string, body: string) {
  await asUser(uid, (db) =>
    db.query("insert into lesson_materials(lesson_id, kind, title, body) values ($1, 'text', $2, $3)", [lessonId, title.slice(0, 160), body.slice(0, 20000)]),
  );
}

export async function addFileMaterial(uid: string, lessonId: string, title: string, storagePath: string, mimeType: string) {
  await asUser(uid, (db) =>
    db.query("insert into lesson_materials(lesson_id, kind, title, storage_path, mime_type) values ($1, 'file', $2, $3, $4)", [lessonId, title.slice(0, 160), storagePath, mimeType]),
  );
}

/** A file attached to one stage's instructions (kept out of the general materials list). */
export async function addStageFile(uid: string, lessonId: string, title: string, storagePath: string, mimeType: string) {
  return asUser(uid, async (db) => {
    const owns = await db.maybeOne("select 1 from lessons where id = $1 and teacher_id = $2", [lessonId, uid]);
    if (!owns) throw new NotFoundError();
    return db.one<{ id: string }>(
      "insert into lesson_materials(lesson_id, kind, title, storage_path, mime_type) values ($1, 'stage_file', $2, $3, $4) returning id",
      [lessonId, title.slice(0, 160), storagePath, mimeType],
    );
  });
}

export async function removeMaterial(uid: string, materialId: string) {
  await asUser(uid, (db) => db.query("delete from lesson_materials where id = $1", [materialId]));
}

// ---------------------------------------------------------------------------
// Library folders: grouped by class first; inside a class, the teacher's own folders.
// ---------------------------------------------------------------------------
export type LessonFolder = { id: string; classId: string | null; name: string };

export async function listFolders(uid: string): Promise<LessonFolder[]> {
  return asUser(uid, async (db) => {
    const rows = await db.query<{ id: string; class_id: string | null; name: string }>("select id, class_id, name from lesson_folders where teacher_id = $1 order by name", [uid]);
    return rows.map((r) => ({ id: r.id, classId: r.class_id, name: r.name }));
  });
}

export async function createFolder(uid: string, classId: string | null, name: string) {
  const n = name.trim().slice(0, 80);
  if (!n) throw new Error("Give the folder a name.");
  return asUser(uid, async (db) => {
    if (classId) {
      const ok = await db.maybeOne("select 1 from classes where id = $1 and teacher_id = $2", [classId, uid]);
      if (!ok) throw new NotFoundError();
    }
    return (await db.one<{ id: string }>("insert into lesson_folders(teacher_id, class_id, name) values ($1,$2,$3) returning id", [uid, classId, n])).id;
  });
}

export async function renameFolder(uid: string, folderId: string, name: string) {
  const n = name.trim().slice(0, 80);
  if (!n) throw new Error("Give the folder a name.");
  await asUser(uid, (db) => db.query("update lesson_folders set name = $3 where id = $1 and teacher_id = $2", [folderId, uid, n]));
}

/** Deleting a folder never deletes lessons: they go back to the class. */
export async function deleteFolder(uid: string, folderId: string) {
  await asUser(uid, (db) => db.query("delete from lesson_folders where id = $1 and teacher_id = $2", [folderId, uid]));
}

export async function moveLessonToFolder(uid: string, lessonId: string, folderId: string | null) {
  await asUser(uid, async (db) => {
    const lesson = await db.maybeOne<{ class_id: string | null }>("select class_id from lessons where id = $1 and teacher_id = $2", [lessonId, uid]);
    if (!lesson) throw new NotFoundError();
    if (folderId) {
      const f = await db.maybeOne<{ class_id: string | null }>("select class_id from lesson_folders where id = $1 and teacher_id = $2", [folderId, uid]);
      if (!f) throw new NotFoundError();
      if (f.class_id !== lesson.class_id) throw new Error("That folder belongs to a different class.");
    }
    await db.query("update lessons set folder_id = $3 where id = $1 and teacher_id = $2", [lessonId, uid, folderId]);
  });
}
