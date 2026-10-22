"use client";

/**
 * Tiny, soft sound effects, synthesised with Web Audio (no audio files).
 * Only ever played in response to something the student did (a tap), and
 * only when Settings → Sounds is on. Every sound also has a visual signal.
 */
export type Sfx = "bloom" | "pip" | "wiggle" | "snooze" | "wake" | "cheer" | "nod" | "plant" | "water" | "grow";

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

const VOL = 0.07;

function tone(a: AudioContext, { f, to, at = 0, dur = 0.18, type = "sine", vol = VOL }: { f: number; to?: number; at?: number; dur?: number; type?: OscillatorType; vol?: number }) {
  const t = a.currentTime + at;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function rustle(a: AudioContext, at = 0, dur = 0.22) {
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 3200;
  bp.Q.value = 0.8;
  const g = a.createGain();
  g.gain.value = VOL * 0.6;
  src.connect(bp).connect(g).connect(a.destination);
  src.start(t);
}

export function playSfx(name: Sfx) {
  const a = audio();
  if (!a) return;
  switch (name) {
    case "bloom": // a bright little sparkle
      tone(a, { f: 880, at: 0, dur: 0.16 });
      tone(a, { f: 1318, at: 0.08, dur: 0.22 });
      break;
    case "pip": // a round, friendly "boop"
      tone(a, { f: 520, to: 360, dur: 0.2, type: "triangle", vol: VOL * 1.2 });
      break;
    case "wiggle": // a wobbly giggle
      [0, 0.07, 0.14, 0.21].forEach((at, i) => tone(a, { f: i % 2 ? 700 : 820, at, dur: 0.08, type: "triangle" }));
      break;
    case "snooze": // a sleepy slide down
      tone(a, { f: 420, to: 210, dur: 0.6, type: "sine", vol: VOL * 0.8 });
      break;
    case "wake":
      tone(a, { f: 300, to: 760, dur: 0.22, type: "triangle" });
      break;
    case "cheer": // a happy arpeggio
      [523, 659, 784, 1046].forEach((f, i) => tone(a, { f, at: i * 0.08, dur: 0.2 }));
      break;
    case "nod":
      tone(a, { f: 660, dur: 0.1, type: "triangle" });
      tone(a, { f: 880, at: 0.07, dur: 0.12, type: "triangle" });
      break;
    case "plant": // leaves rustling
      rustle(a);
      tone(a, { f: 990, at: 0.05, dur: 0.12, vol: VOL * 0.5 });
      break;
    case "water": // a water drop
      tone(a, { f: 1400, to: 500, dur: 0.14, vol: VOL * 1.1 });
      tone(a, { f: 900, to: 1500, at: 0.12, dur: 0.1, vol: VOL * 0.5 });
      break;
    case "grow": // a rising shimmer
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(a, { f, at: i * 0.06, dur: 0.25, vol: VOL * 0.8 }));
      break;
  }
}
