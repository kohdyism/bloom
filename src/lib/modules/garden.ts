import "server-only";
import { asServer } from "@/lib/db";
import { isFlowerId, type FlowerId } from "@/lib/domain/flowers";

export type GardenEntry = { flower: FlowerId; lesson: string; group: string; at: string };

/** Every flower this student's groups have grown, oldest first. Read for this student only. */
export async function myGarden(uid: string): Promise<GardenEntry[]> {
  const rows = await asServer((db) =>
    db.query<{ flower: string; lesson: string; group_name: string; at: Date }>(
      `select g.flower, s.snapshot ->> 'title' as lesson, g.name as group_name, coalesce(s.ended_at, g.updated_at) as at
       from group_members gm join session_groups g on g.id = gm.group_id join activity_sessions s on s.id = g.session_id
       where gm.student_id = $1 and g.flower is not null order by at`,
      [uid],
    ),
  );
  return rows.filter((r) => isFlowerId(r.flower)).map((r) => ({ flower: r.flower as FlowerId, lesson: r.lesson, group: r.group_name, at: new Date(r.at).toISOString() }));
}
