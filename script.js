const ctx = new (window.AudioContext || window.webkitAudioContext)();
const state = {
  playing: false,
  hold: false,
  bpm: 124,
  step: 0,
  timer: null,
  master: 0.75,
  lead: 0.62,
  bass: 0.5,
  fx: 0.22,
  cutoff: 2400,
  resonance: 8,
  attack: 0.02,
  release: 0.65,
  reverb: 0.32,
  drive: 0.18,
  detune: 7,
  pan: -0.08,
};
const knobs = [
  ["CUTOFF", "cutoff", 200, 7000, "Hz"],
  ["RESONANCE", "resonance", 0, 24, "%"],
  ["ATTACK", "attack", 0.01, 0.5, "s"],
  ["RELEASE", "release", 0.08, 2, "s"],
  ["REVERB", "reverb", 0, 0.8, "%"],
  ["DRIVE", "drive", 0, 0.8, "%"],
  ["DETUNE", "detune", -40, 40, "ct"],
  ["PAN", "pan", -1, 1, ""],
];
const noteNames = [
  "C3",
  "D3",
  "E3",
  "F3",
  "G3",
  "A3",
  "B3",
  "C4",
  "D4",
  "E4",
  "F4",
  "G4",
  "A4",
  "B4",
  "C5",
  "D5",
  "E5",
  "F5",
  "G5",
];
const keyMap = [
  "z",
  "x",
  "c",
  "v",
  "b",
  "n",
  "m",
  "q",
  "w",
  "e",
  "r",
  "t",
  "y",
  "u",
  "i",
  "o",
  "p",
  "[",
  "]",
];
const blackAfter = [0, 1, 3, 4, 5, 7, 8, 10, 11, 12, 14, 15, 17];
const seq = [1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1];
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);
const midiFromName = (n) =>
  12 * (+n.slice(-1) + 1) +
  ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"].indexOf(
    n.slice(0, -1),
  );
const knobRoot = document.querySelector("#knobs"),
  seqRoot = document.querySelector("#sequencer"),
  keyRoot = document.querySelector("#keyboard"),
  mixRoot = document.querySelector("#mixers");
knobs.forEach(([name, key, min, max, unit], i) => {
  const el = document.createElement("div");
  el.className = "knob-control";
  el.innerHTML = `<div class="knob" style="--angle:${-120 + ((state[key] - min) / (max - min)) * 240}deg"></div><label>${name}</label><output>${format(key, state[key], unit)}</output><input aria-label="${name}" type="range" min="${min}" max="${max}" step="${(max - min) / 100}" value="${state[key]}">`;
  el.querySelector("input").oninput = (e) => {
    state[key] = +e.target.value;
    el.querySelector(".knob").style.setProperty(
      "--angle",
      `${-120 + ((state[key] - min) / (max - min)) * 240}deg`,
    );
    el.querySelector("output").textContent = format(key, state[key], unit);
  };
  knobRoot.append(el);
});
function format(k, v, u) {
  if (k === "cutoff") return `${(v / 1000).toFixed(1)} kHz`;
  if (k === "attack" || k === "release") return `${v.toFixed(2)} s`;
  if (k === "resonance") return `${Math.round(v)} Q`;
  if (k === "detune") return `${Math.round(v)} ct`;
  if (k === "pan")
    return v < 0 ? `L ${Math.round(-v * 100)}` : `R ${Math.round(v * 100)}`;
  return `${Math.round(v * 100)}${u}`;
}
seq.forEach((on, i) => {
  const s = document.createElement("button");
  s.className = `step ${on ? "on" : ""}`;
  s.innerHTML = `<b>${String(i + 1).padStart(2, "0")}</b><i></i><em></em>`;
  s.onclick = () => {
    seq[i] = +!seq[i];
    s.classList.toggle("on", !!seq[i]);
  };
  seqRoot.append(s);
});
[
  ["LEAD", "lead"],
  ["BASS", "bass"],
  ["SPACE", "fx"],
  ["MASTER", "master"],
].forEach(([n, k]) => {
  const d = document.createElement("div");
  d.className = "mix";
  d.innerHTML = `<label>${n}</label><input type="range" min="0" max="1" step=".01" value="${state[k]}"><output>${Math.round(state[k] * 100)}%</output>`;
  d.querySelector("input").oninput = (e) => {
    state[k] = +e.target.value;
    d.querySelector("output").textContent = `${Math.round(state[k] * 100)}%`;
  };
  mixRoot.append(d);
});
noteNames.forEach((n, i) => {
  const b = document.createElement("button");
  b.className = "key";
  b.dataset.note = n;
  b.innerHTML = `${n}<small>${keyMap[i].toUpperCase()}</small>`;
  b.onpointerdown = () => playLead(n, b);
  b.onpointerup = () => b.classList.remove("pressed");
  keyRoot.append(b);
  if (blackAfter.includes(i)) {
    const q = document.createElement("button");
    q.className = "black";
    q.style.left = `${((i + 1) / noteNames.length) * 100 - 1.25}%`;
    q.dataset.note = n + "#";
    q.onpointerdown = () => playLead(sharpOf(n), q);
    q.onpointerup = () => q.classList.remove("pressed");
    keyRoot.append(q);
  }
});
function sharpOf(n) {
  const names = {
    C3: "C#3",
    D3: "D#3",
    F3: "F#3",
    G3: "G#3",
    A3: "A#3",
    C4: "C#4",
    D4: "D#4",
    F4: "F#4",
    G4: "G#4",
    A4: "A#4",
    C5: "C#5",
    D5: "D#5",
    F5: "F#5",
    G5: "G#5",
  };
  return names[n] || n;
}
async function init() {
  if (ctx.state !== "running") await ctx.resume();
}
function playLead(n, el) {
  init();
  el.classList.add("pressed");
  const t = ctx.currentTime,
    o = ctx.createOscillator(),
    g = ctx.createGain(),
    f = ctx.createBiquadFilter(),
    p = ctx.createStereoPanner();
  o.type = "sawtooth";
  o.frequency.value = hz(midiFromName(n));
  o.detune.value = state.detune;
  f.type = "lowpass";
  f.frequency.value = state.cutoff;
  f.Q.value = state.resonance;
  p.pan.value = state.pan;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(state.lead * 0.22, t + state.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + state.attack + state.release);
  o.connect(f).connect(p).connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + state.attack + state.release + 0.04);
  setTimeout(() => el.classList.remove("pressed"), 250);
}
function playBass(i) {
  if (!seq[i]) return;
  const notes = [36, 36, 43, 36, 44, 36, 43, 39],
    t = ctx.currentTime,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = "square";
  o.frequency.value = hz(notes[i % 8]);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(state.bass * 0.24, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.23);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.25);
}
function tick() {
  document
    .querySelectorAll(".step")
    .forEach((e, i) => e.classList.toggle("active", i === state.step));
  playBass(state.step);
  state.step = (state.step + 1) % 16;
}
function togglePlay() {
  init();
  state.playing = !state.playing;
  const b = document.querySelector("#playButton");
  b.textContent = state.playing ? "■ STOP SET" : "▶ PLAY SET";
  document.querySelector("#status").textContent = state.playing
    ? "playing · 124 bpm · C minor"
    : "ready · 124 bpm · C minor";
  if (state.playing) {
    tick();
    state.timer = setInterval(tick, 60000 / state.bpm / 4);
  } else {
    clearInterval(state.timer);
    document
      .querySelectorAll(".step")
      .forEach((e) => e.classList.remove("active"));
  }
}
document.querySelector("#playButton").onclick = togglePlay;
document.querySelector("#holdButton").onclick = (e) => {
  state.hold = !state.hold;
  e.target.textContent = `HOLD: ${state.hold ? "ON" : "OFF"}`;
};
document.querySelector("#randomButton").onclick = () =>
  document.querySelectorAll(".step").forEach((e, i) => {
    seq[i] = Math.random() > 0.45 ? 1 : 0;
    e.classList.toggle("on", !!seq[i]);
  });
window.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const i = keyMap.indexOf(e.key.toLowerCase());
  if (i > -1) playLead(noteNames[i], document.querySelectorAll(".key")[i]);
});

// Performance preset: a short two-voice version of «Собачий вальс».
state.waltz = false;
state.waltzTimers = [];
function stopWaltz() {
  state.waltzTimers.forEach(clearTimeout);
  state.waltzTimers = [];
  state.waltz = false;
  document.querySelector("#waltzButton").textContent = "♫ DOG WALTZ";
  document.querySelector("#trackName").textContent = "Velvet Transit";
  document.querySelector("#status").textContent = "ready · 124 bpm · C minor";
}
function playWaltzBass(note) {
  const t = ctx.currentTime,
    o = ctx.createOscillator(),
    g = ctx.createGain();
  o.type = "triangle";
  o.frequency.value = hz(note);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(state.bass * 0.2, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.36);
}
function playDogWaltz() {
  if (state.waltz) {
    stopWaltz();
    return;
  }
  init();
  if (state.playing) togglePlay();
  state.waltz = true;
  const button = document.querySelector("#waltzButton");
  button.textContent = "■ STOP WALTZ";
  document.querySelector("#trackName").textContent = "Dog Waltz";
  document.querySelector("#status").textContent =
    "performing · 138 bpm · C major";
  const phrase = [
    ["C4", "E4"],
    ["C4", "E4"],
    ["D4", "F4"],
    ["D4", "F4"],
    ["E4", "G4"],
    ["E4", "G4"],
    ["D4", "F4"],
    ["D4", "F4"],
    ["C4", "E4"],
    ["C4", "E4"],
    ["G3", "C4"],
    ["G3", "C4"],
    ["A3", "C4"],
    ["A3", "C4"],
    ["G3", "B3"],
    ["G3", "B3"],
    ["C4", "E4"],
    ["C4", "E4"],
    ["D4", "F4"],
    ["D4", "F4"],
    ["E4", "G4"],
    ["E4", "G4"],
    ["D4", "F4"],
    ["D4", "F4"],
    ["C4", "E4"],
    ["G3", "C4"],
    ["C4", "E4"],
    ["G3", "C4"],
  ];
  const bass = [36, 36, 43, 36, 41, 41, 43, 43];
  phrase.forEach((chord, i) =>
    state.waltzTimers.push(
      setTimeout(() => {
        if (!state.waltz) return;
        chord.forEach((n) =>
          playLead(n, document.querySelector('[data-note="' + n + '"]')),
        );
        if (i % 2 === 0) playWaltzBass(bass[((i / 2) | 0) % bass.length]);
      }, i * 215),
    ),
  );
  state.waltzTimers.push(setTimeout(stopWaltz, phrase.length * 215 + 500));
}
document.querySelector("#waltzButton").onclick = playDogWaltz;
