import { createPiano } from "./piano-engine.js";

const { context, stopOtherMusic, levels } = window.pinkPulseBridge;
const piano = createPiano(context);
const button = document.querySelector("#moonlightButton");
const status = document.querySelector("#moonlightStatus");
const progress = document.querySelector("#moonlightProgress");
const keyboard = document.querySelector("#keyboard");
const keyboardTitle = document.querySelector(".keyboard-title");
const trackName = document.querySelector("#trackName");
const trackStatus = document.querySelector("#status");
const tempo = document.querySelector("#tempoValue"),
  key = document.querySelector("#keyValue");
const noteName = (midi) =>
  ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"][midi % 12] +
  (Math.floor(midi / 12) - 1);
const clock = (s) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
let mode = "idle",
  score,
  generation = 0,
  startTime = 0,
  cursor = 0,
  timer = null,
  animation = null;
let savedKeys, savedTitle;
const pianoKeys = new Map();

function showPianoKeyboard() {
  savedKeys = [...keyboard.childNodes];
  savedTitle = keyboardTitle.innerHTML;
  keyboard.replaceChildren();
  keyboard.classList.add("piano-keyboard");
  keyboardTitle.innerHTML =
    "<b>GRAND PIANO / AUTO PERFORMANCE</b><span>88 КЛАВИШ · A0–C8 · БЕЗ ТРАНСПОНИРОВАНИЯ</span>";
  let whiteIndex = 0;
  for (let midi = 21; midi <= 108; midi++) {
    const black = [1, 3, 6, 8, 10].includes(midi % 12);
    const el = document.createElement("button");
    el.className = black ? "black" : "key";
    el.dataset.note = noteName(midi);
    el.setAttribute("aria-label", noteName(midi));
    el.title = noteName(midi);
    if (black) el.style.left = `calc(${(whiteIndex / 52) * 100}% - 7px)`;
    else {
      el.textContent = midi % 12 === 0 ? noteName(midi) : "";
      whiteIndex++;
    }
    el.onpointerdown = () => manual(midi, el);
    pianoKeys.set(midi, el);
    keyboard.append(el);
  }
  window.pinkPulsePianoMode = { manual };
}
function restoreKeyboard() {
  if (!savedKeys) return;
  keyboard.replaceChildren(...savedKeys);
  keyboard.classList.remove("piano-keyboard");
  keyboardTitle.innerHTML = savedTitle;
  savedKeys = null;
  pianoKeys.clear();
  window.pinkPulsePianoMode = null;
}
function manual(midi, el) {
  if (!piano.loaded) return;
  context.resume();
  piano.note(midi, context.currentTime, 0.8, 0.48);
  el?.classList.add("pressed");
  setTimeout(() => el?.classList.remove("pressed"), 250);
}
function stop(message = "Остановлено. Нажми, чтобы сыграть сначала.") {
  if (mode === "idle") return;
  generation++;
  mode = "idle";
  clearInterval(timer);
  cancelAnimationFrame(animation);
  piano.stop();
  restoreKeyboard();
  button.textContent = "☾ ЛУННАЯ СОНАТА";
  button.setAttribute("aria-pressed", "false");
  status.textContent = message;
  trackName.textContent = "Velvet Transit";
  trackStatus.textContent = "ready · 124 bpm · C minor";
  tempo.textContent = "124";
  key.textContent = "C MIN";
}
// Audio is scheduled ahead, not timed by key animation or one timeout per note.
function schedule() {
  if (mode !== "playing" || context.state !== "running") return;
  const until = context.currentTime - startTime + 0.25;
  const { lead, bass, master } = levels();
  piano.setVolume(master * 0.95);
  while (cursor < score.notes.length && score.notes[cursor][0] < until) {
    const [time, pitch, duration, velocity, track] = score.notes[cursor++];
    const end = time + duration;
    const halfBar = 120 / score.bpm;
    const pedal = Math.ceil((end - 0.02) / halfBar) * halfBar;
    piano.note(
      pitch,
      startTime + time,
      duration,
      velocity,
      startTime + Math.max(end, pedal),
      track === 2 ? bass / 0.5 : lead / 0.62,
    );
  }
}
let visualCursor = 0;
const litUntil = new Map();
function draw() {
  if (mode !== "playing") return;
  const elapsed = Math.max(0, context.currentTime - startTime);
  while (
    visualCursor < score.notes.length &&
    score.notes[visualCursor][0] <= elapsed
  ) {
    const [time, pitch, duration] = score.notes[visualCursor++];
    litUntil.set(pitch, Math.max(litUntil.get(pitch) || 0, time + duration));
  }
  for (const [pitch, el] of pianoKeys)
    el.classList.toggle("pressed", (litUntil.get(pitch) || 0) > elapsed);
  progress.value = elapsed / score.duration;
  const time = `${clock(elapsed)} / ${clock(score.duration)}`;
  // Keep a changing clock out of the aria-live status, avoiding repeated announcements.
  trackStatus.textContent = `${time} · ♩ = ${score.bpm} · C♯ minor`;
  if (elapsed >= score.duration) {
    stop("Исполнение завершено · I. Adagio sostenuto целиком.");
    progress.value = 1;
    return;
  }
  animation = requestAnimationFrame(draw);
}
async function start() {
  if (mode !== "idle") {
    stop();
    return;
  }
  // Stop other modes before setting 'loading': they also dispatch the stop event.
  stopOtherMusic();
  const id = ++generation;
  mode = "loading";
  progress.value = 0;
  button.textContent = "■ ОТМЕНИТЬ ЗАГРУЗКУ";
  button.setAttribute("aria-pressed", "true");
  status.textContent = "Загружаю фортепиано…";
  try {
    await context.resume();
    const [loadedScore] = await Promise.all([
      score
        ? Promise.resolve(score)
        : fetch(new URL("./assets/moonlight/score.json", import.meta.url)).then(
            (r) => {
              if (!r.ok) throw Error(`Score: HTTP ${r.status}`);
              return r.json();
            },
          ),
      piano.load((done, total) => {
        if (generation === id)
          status.textContent = `Загружаю фортепиано: ${done} / ${total}…`;
      }),
    ]);
    if (generation !== id) return;
    score = loadedScore;
    if (!Array.isArray(score.notes) || !score.notes.length)
      throw Error("Empty score");
    if (context.state !== "running") await context.resume();
    if (generation !== id) return;
    mode = "playing";
    cursor = 0;
    visualCursor = 0;
    litUntil.clear();
    startTime = context.currentTime + 0.12;
    showPianoKeyboard();
    trackName.textContent = "Moonlight Sonata · I";
    tempo.textContent = String(score.bpm);
    key.textContent = "C♯ MIN";
    button.textContent = "■ ОСТАНОВИТЬ СОНАТУ";
    status.textContent =
      "Играет рояль · первая часть целиком · клавиши показывают обе руки.";
    schedule();
    timer = setInterval(schedule, 40);
    draw();
  } catch (error) {
    if (generation !== id) return;
    console.error("Moonlight piano:", error);
    stop(
      "Не удалось загрузить рояль. Проверь интернет и нажми кнопку ещё раз.",
    );
  }
}
button.addEventListener("click", start);
window.addEventListener("pinkpulse:stop-piano", () => stop());
// Avoid skips when browsers throttle background timers. Restart is explicit.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && mode === "playing")
    stop(
      "Исполнение остановлено при смене вкладки. Нажми, чтобы начать снова.",
    );
});
window.addEventListener("pagehide", () => stop());
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") stop();
});
window.pinkPulseMoonlight = Object.freeze({
  get state() {
    return mode;
  },
  get notesScheduled() {
    return cursor;
  },
  get duration() {
    return score?.duration || 0;
  },
  get activeVoices() {
    return piano.activeVoices;
  },
});
