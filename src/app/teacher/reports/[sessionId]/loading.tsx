import { Bloom } from "@/components/mascot";

export default function Loading() {
  return (
    <div className="flex flex-col items-center gap-3 py-20 text-center" role="status">
      <span className="buddy-chatter block"><Bloom size={64} mood="thinking" /></span>
      <p className="font-display text-lg font-semibold">Opening the report…</p>
    </div>
  );
}
