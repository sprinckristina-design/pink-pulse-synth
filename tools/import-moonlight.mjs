// Reproducible conversion of Mutopia's unabridged first-movement MIDI.
// MIDI pitches/ticks are retained. Dynamics/pedal below are an interpretation,
// not a claim to reproduce a particular pianist's recording.
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../assets/moonlight/", import.meta.url);
const b = readFileSync(new URL("moonlight1.mid", root));
let pos = 0;
const str = (n) => {
  const s = b.toString("ascii", pos, pos + n);
  pos += n;
  return s;
};
const u16 = () => {
  const n = b.readUInt16BE(pos);
  pos += 2;
  return n;
};
const u32 = () => {
  const n = b.readUInt32BE(pos);
  pos += 4;
  return n;
};
const vlq = () => {
  let n = 0,
    c;
  do {
    c = b[pos++];
    n = (n << 7) | (c & 127);
  } while (c & 128);
  return n;
};
if (str(4) !== "MThd") throw Error("Not MIDI");
const headerLength = u32(),
  headerStart = pos;
const format = u16(),
  trackCount = u16(),
  ppq = u16();
if (ppq & 0x8000) throw Error("SMPTE MIDI is not supported");
pos = headerStart + headerLength;
const notes = [],
  tracks = [];
for (let track = 0; track < trackCount; track++) {
  if (str(4) !== "MTrk") throw Error("Missing track");
  const length = u32(),
    end = pos + length;
  let tick = 0,
    running = 0,
    name = "";
  const active = new Map();
  while (pos < end) {
    tick += vlq();
    let status = b[pos];
    if (status & 128) {
      pos++;
      if (status < 0xf0) running = status;
    } else status = running;
    if (status === 0xff) {
      const type = b[pos++],
        size = vlq();
      if (type === 3) name = b.toString("utf8", pos, pos + size);
      pos += size;
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      pos += vlq();
      continue;
    }
    const kind = status >> 4,
      channel = status & 15;
    const a = b[pos++],
      v = kind === 12 || kind === 13 ? 0 : b[pos++];
    const key = `${channel}:${a}`;
    if (kind === 9 && v) {
      const queue = active.get(key) || [];
      queue.push({ tick, pitch: a, velocity: v, track });
      active.set(key, queue);
    } else if (kind === 8 || (kind === 9 && !v)) {
      const n = active.get(key)?.shift();
      if (n) notes.push({ ...n, duration: tick - n.tick });
    }
  }
  if ([...active.values()].some((q) => q.length))
    throw Error("Unclosed MIDI notes");
  tracks.push({ track, name, endTick: tick });
}
notes.sort((a, c) => a.tick - c.tick || a.track - c.track || a.pitch - c.pitch);
const round = (n) => +n.toFixed(5);
// Quarter = 54, as suggested in the edition's LilyPond source. Not 124 BPM.
const bpm = 54,
  beatSeconds = 60 / bpm;
const finishBeat = Math.max(...notes.map((n) => (n.tick + n.duration) / ppq));
// Editorial dynamic curve: pianissimo, two restrained crescendi and final diminuendo.
const anchors = [
  [0, 0.39],
  [92, 0.39],
  [104, 0.52],
  [112, 0.39],
  [156, 0.32],
  [164, 0.36],
  [184, 0.37],
  [192, 0.49],
  [208, 0.47],
  [220, 0.39],
  [228, 0.51],
  [236, 0.4],
  [260, 0.34],
  [272, 0.28],
];
function dynamic(beat) {
  let a = anchors[0],
    c = anchors.at(-1);
  for (let i = 1; i < anchors.length; i++)
    if (beat < anchors[i][0]) {
      a = anchors[i - 1];
      c = anchors[i];
      break;
    }
  return (
    a[1] +
    (c[1] - a[1]) * Math.max(0, Math.min(1, (beat - a[0]) / (c[0] - a[0] || 1)))
  );
}
const data = {
  title: "Лунная соната · I. Adagio sostenuto",
  composer: "Ludwig van Beethoven",
  opus: "Op. 27 No. 2",
  key: "C♯ minor",
  bpm,
  beatsPerBar: 4,
  source: "https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=276",
  license: "CC BY-SA 2.5",
  edition: "Mutopia-2007/02/11-276; Stewart Holmes / Chris Sawer",
  interpretation:
    "Quarter=54; editorial velocity curve, half-bar pedal clearing, final fermata. Pitches and note-on ticks unchanged.",
  duration: round(finishBeat * beatSeconds + 3),
  // [start seconds, MIDI pitch, key duration seconds, velocity 0..1, original track]
  notes: notes.map((n) => {
    const beat = n.tick / ppq,
      d = n.duration / ppq;
    const melody = n.track === 1 && d >= 0.5;
    return [
      round(beat * beatSeconds),
      n.pitch,
      round(d * beatSeconds + (beat >= 272 ? 1.4 : 0)),
      round(
        Math.min(
          0.72,
          dynamic(beat) * (melody ? 1.22 : n.pitch < 48 ? 0.9 : 0.86),
        ),
      ),
      n.track,
    ];
  }),
};
writeFileSync(new URL("score.json", root), JSON.stringify(data) + "\n");
console.log(
  JSON.stringify(
    {
      format,
      ppq,
      tracks,
      notes: notes.length,
      minPitch: Math.min(...notes.map((n) => n.pitch)),
      maxPitch: Math.max(...notes.map((n) => n.pitch)),
      beats: finishBeat,
      duration: data.duration,
      firstNotes: data.notes.slice(0, 6),
    },
    null,
    2,
  ),
);
