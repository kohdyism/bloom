import * as Y from "yjs";

/**
 * Simulates the server's merge path: two students edit the same paragraph
 * offline, their updates are stored independently, and the server merges
 * them. Returns the texts present after the merge.
 */
export function CRDT_GUARD(): string[] {
  const base = new Y.Doc();
  base.getText("t").insert(0, "");
  const snapshot = Y.encodeStateAsUpdate(base);

  const a = new Y.Doc();
  const b = new Y.Doc();
  Y.applyUpdate(a, snapshot);
  Y.applyUpdate(b, snapshot);
  a.getText("t").insert(0, "Poe presents loneliness.");
  b.getText("t").insert(0, "Nature mirrors it.");

  const merged = Y.mergeUpdates([snapshot, Y.encodeStateAsUpdate(a), Y.encodeStateAsUpdate(b)]);
  const server = new Y.Doc();
  Y.applyUpdate(server, merged);
  const text = server.getText("t").toString();
  return ["Poe presents loneliness.", "Nature mirrors it."].filter((s) => text.includes(s));
}
