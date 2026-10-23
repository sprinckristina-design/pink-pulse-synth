// A sample-based acoustic piano. All note times use the AudioContext clock.
// Samples: Alexander Holm, Salamander Grand Piano, CC BY 3.0; see CREDITS.md.
export const SAMPLE_BANK = Array.from({ length: 20 }, (_, i) => {
  const midi = 30 + i * 3;
  const names = [
    "C",
    "Cs",
    "D",
    "Ds",
    "E",
    "F",
    "Fs",
    "G",
    "Gs",
    "A",
    "As",
    "B",
  ];
  return { midi, file: `${names[midi % 12]}${Math.floor(midi / 12) - 1}.mp3` };
});

export function createPiano(context) {
  const buffers = new Map(),
    voices = new Set();
  const output = context.createGain();
  const safety = context.createDynamicsCompressor();
  safety.threshold.value = -10;
  safety.knee.value = 10;
  safety.ratio.value = 4;
  output.gain.value = 0.8;
  output.connect(safety).connect(context.destination);
  let loading;
  async function load(onProgress = () => {}) {
    if (buffers.size === SAMPLE_BANK.length) return;
    if (loading) return loading;
    loading = (async () => {
      let done = buffers.size;
      // Four concurrent downloads; completed buffers survive a failed attempt.
      const pending = SAMPLE_BANK.filter((s) => !buffers.has(s.midi));
      await Promise.all(
        Array.from({ length: 4 }, async () => {
          while (pending.length) {
            const sample = pending.shift();
            const response = await fetch(
              new URL(`assets/piano/${sample.file}`, import.meta.url),
            );
            if (!response.ok)
              throw Error(`Piano sample: HTTP ${response.status}`);
            const audio = await context.decodeAudioData(
              await response.arrayBuffer(),
            );
            buffers.set(sample.midi, audio);
            onProgress(++done, SAMPLE_BANK.length);
          }
        }),
      );
    })().finally(() => {
      loading = null;
    });
    return loading;
  }
  function note(
    pitch,
    start,
    duration,
    velocity,
    pedalEnd = start + duration,
    level = 1,
  ) {
    if (!buffers.size) throw Error("Piano has not loaded");
    const sample = SAMPLE_BANK.reduce((a, b) =>
      Math.abs(b.midi - pitch) < Math.abs(a.midi - pitch) ? b : a,
    );
    const source = context.createBufferSource(),
      envelope = context.createGain();
    const tone = context.createBiquadFilter();
    source.buffer = buffers.get(sample.midi);
    source.playbackRate.value = 2 ** ((pitch - sample.midi) / 12);
    tone.type = "lowpass";
    tone.frequency.value = 4200 + velocity * 8500;
    tone.Q.value = 0.5;
    const amplitude = 0.38 * (velocity / 0.5) ** 1.6 * level;
    const release = Math.max(start + duration, pedalEnd),
      tail = 0.42;
    envelope.gain.setValueAtTime(amplitude, start);
    envelope.gain.setValueAtTime(amplitude, release);
    envelope.gain.exponentialRampToValueAtTime(0.0001, release + tail);
    source.connect(tone).connect(envelope).connect(output);
    const voice = { source, envelope };
    voices.add(voice);
    source.onended = () => {
      voices.delete(voice);
      source.disconnect();
      tone.disconnect();
      envelope.disconnect();
    };
    source.start(start);
    source.stop(release + tail + 0.02);
    return voice;
  }
  function stop() {
    const now = context.currentTime;
    for (const { source, envelope } of voices) {
      // Includes sources scheduled in the look-ahead window: no stray future notes.
      envelope.gain.cancelScheduledValues(now);
      envelope.gain.setTargetAtTime(0.0001, now, 0.015);
      try {
        source.stop(now + 0.06);
      } catch {
        /* already ended */
      }
    }
  }
  return {
    load,
    note,
    stop,
    setVolume(v) {
      output.gain.setTargetAtTime(
        Math.max(0, Math.min(1, v)),
        context.currentTime,
        0.03,
      );
    },
    get loaded() {
      return buffers.size === SAMPLE_BANK.length;
    },
    get activeVoices() {
      return voices.size;
    },
  };
}
