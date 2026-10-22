import { FlowerPicture } from "@/components/flower";
import { FLOWERS, type FlowerId } from "@/lib/domain/flowers";
import { cn } from "@/lib/utils";

export type GardenEntry = { flower: FlowerId; lesson: string; group: string; at: string };

/**
 * The student's garden: one flower from every group lesson they finished.
 * Flowers not found yet show as gentle silhouettes — something to look
 * forward to, never a score or a comparison with anyone else.
 */
export function Garden({ entries }: { entries: GardenEntry[] }) {
  const byFlower = new Map<FlowerId, GardenEntry[]>();
  for (const e of entries) byFlower.set(e.flower, [...(byFlower.get(e.flower) ?? []), e]);
  const found = byFlower.size;
  return (
    <section id="garden" aria-labelledby="garden-title" className="scroll-mt-6 rounded-[2rem] border-2 border-white bg-gradient-to-b from-[#f2fbf3] to-[#fff7ee] p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="garden-title" className="font-display text-2xl font-bold">My garden</h2>
          <p className="text-ink-muted">Every time your group finishes its work, your plant blooms into a flower for your garden.</p>
        </div>
        <p className="rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-soft">{found} of {FLOWERS.length} flowers found</p>
      </div>
      <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-6">
        {FLOWERS.map((f) => {
          const got = byFlower.get(f.id);
          return (
            <li key={f.id} className={cn("flex flex-col items-center rounded-2xl px-1 pb-2 pt-1 text-center", got ? "bg-white shadow-soft" : "bg-white/40")}
              title={got ? `${f.name}: ${got.map((g) => g.lesson).join(", ")}` : "Not found yet"}>
              <FlowerPicture id={f.id} size={56} faded={!got} />
              <span className={cn("text-sm font-semibold leading-tight", !got && "text-ink-faint")}>{got ? f.name : "?"}</span>
              {got && got.length > 1 ? <span className="text-xs font-semibold text-purple">×{got.length}</span> : null}
              <span className="sr-only">{got ? `Found ${got.length} time${got.length === 1 ? "" : "s"}` : "Not found yet"}</span>
            </li>
          );
        })}
      </ul>
      {entries.length === 0 ? <p className="mt-3 text-sm text-ink-muted">Your first flower is waiting — finish a group lesson to grow it.</p> : null}
    </section>
  );
}
