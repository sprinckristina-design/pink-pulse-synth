import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import assert from "node:assert/strict";
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || undefined,
  headless: true,
});
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(process.env.SYNTH_URL || "http://127.0.0.1:4175/");
  await page.waitForFunction(() => window.pinkPulseMoonlight);
  assert.equal(await page.locator("#keyboard .key").count(), 19);
  await page.locator("#moonlightButton").click();
  await page.waitForFunction(
    () => window.pinkPulseMoonlight.state === "playing",
    { timeout: 30000 },
  );
  assert.equal(await page.locator("#keyboard .key").count(), 52);
  assert.equal(await page.locator("#keyboard .black").count(), 36);
  await page.waitForFunction(
    () => document.querySelectorAll("#keyboard .pressed").length >= 3,
  );
  assert.equal(await page.locator("#keyValue").textContent(), "C♯ MIN");
  assert.equal(await page.locator("#tempoValue").textContent(), "54");
  await page.screenshot({
    path: process.env.SCREENSHOT_PATH || "test-results/moonlight.png",
    fullPage: true,
  });
  await page.locator("#moonlightButton").click();
  await page.waitForTimeout(120);
  assert.equal(await page.locator("#keyboard .key").count(), 19);
  assert.equal(
    await page.evaluate(() => window.pinkPulseMoonlight.activeVoices),
    0,
  );
  await page.locator("#moonlightButton").click();
  await page.waitForFunction(
    () => window.pinkPulseMoonlight.state === "playing",
  );
  await page.locator("#waltzButton").click();
  assert.equal(
    await page.evaluate(() => window.pinkPulseMoonlight.state),
    "idle",
  );
  assert.equal(await page.locator("#trackName").textContent(), "Dog Waltz");
  await page.locator("#waltzButton").click();
  await page.locator("#moonlightButton").click();
  await page.waitForFunction(
    () => window.pinkPulseMoonlight.state === "playing",
  );
  await page.locator("#playButton").click();
  assert.equal(
    await page.evaluate(() => window.pinkPulseMoonlight.state),
    "idle",
  );
  assert.equal(await page.locator("#playButton").textContent(), "■ STOP SET");
  await page.locator("#playButton").click();
  await page.locator("#moonlightButton").click();
  await page.waitForFunction(
    () => window.pinkPulseMoonlight.state === "playing",
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() => window.pinkPulseMoonlight.state),
    "idle",
  );
  assert.equal(
    await page.locator('#keyboard .black[data-note="C#3"]').count(),
    1,
  );
  // Render all 1142 notes, not just the beginning, through the actual sampler.
  const render = await page.evaluate(async () => {
    const { createPiano } = await import("./piano-engine.js");
    const score = await fetch("./assets/moonlight/score.json").then((r) =>
      r.json(),
    );
    const offline = new OfflineAudioContext(
      2,
      Math.ceil((score.duration + 1) * 22050),
      22050,
    );
    const instrument = createPiano(offline);
    await instrument.load();
    for (const [time, pitch, duration, velocity] of score.notes) {
      const halfBar = 120 / score.bpm;
      instrument.note(
        pitch,
        time,
        duration,
        velocity,
        Math.max(
          time + duration,
          Math.ceil((time + duration - 0.02) / halfBar) * halfBar,
        ),
      );
    }
    const audio = await offline.startRendering();
    let peak = 0,
      energy = 0,
      finite = true;
    const mono = audio.getChannelData(0);
    for (const n of mono) {
      peak = Math.max(peak, Math.abs(n));
      energy += n * n;
      if (!Number.isFinite(n)) finite = false;
    }
    const windows = [0, 60, 150, 240, 304].map((t) => {
      let e = 0;
      for (let i = t * 22050; i < (t + 1) * 22050; i++) e += mono[i] ** 2;
      return Math.sqrt(e / 22050);
    });
    return {
      noteCount: score.notes.length,
      duration: audio.duration,
      peak,
      rms: Math.sqrt(energy / mono.length),
      finite,
      windows,
    };
  });
  assert.equal(render.noteCount, 1142);
  assert.ok(render.duration > 309);
  assert.ok(render.finite && render.peak > 0.03 && render.peak < 0.99);
  assert.ok(render.windows.every((rms) => rms > 0.001));
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: "PASS", render, errors }, null, 2));
  // Network failure should be visible, with a functioning retry and cancellation.
  const broken = await browser.newPage();
  await broken.route("**/assets/piano/**", (route) =>
    route.fulfill({ status: 503, body: "test" }),
  );
  await broken.goto("http://127.0.0.1:4175/");
  await broken.locator("#moonlightButton").click();
  await broken.waitForFunction(() =>
    document
      .querySelector("#moonlightStatus")
      .textContent.includes("Не удалось"),
  );
  assert.equal(
    await broken.evaluate(() => window.pinkPulseMoonlight.state),
    "idle",
  );
  await broken.unroute("**/assets/piano/**");
  await broken.locator("#moonlightButton").click();
  await broken.waitForFunction(
    () => window.pinkPulseMoonlight.state === "playing",
  );
  await broken.locator("#moonlightButton").click();
  console.log("Network failure and retry: PASS");
} finally {
  await browser.close();
}
