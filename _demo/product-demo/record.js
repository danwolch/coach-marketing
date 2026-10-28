// Renders scene.html frame by frame and encodes the homepage demo video.
//
//   cd coach-marketing && python3 -m http.server 8811 &
//   node _demo/product-demo/record.js
//
// Writes img/product-demo.webm, img/product-demo.mp4 and img/product-demo-poster.jpg.
// Needs Playwright (chromium) and ffmpeg. Each frame is set by renderAt(t), so the result does not
// depend on how fast the machine is.
const { chromium } = require("playwright");
const { spawn, execFileSync } = require("child_process");
const path = require("path");

const URL = process.env.DEMO_URL || "http://localhost:8811/_demo/product-demo/scene.html?record";
const FPS = 30, SCALE = 1.5, OUT_W = 1600, OUT_H = 1000, FADE = 0.6;
const root = path.resolve(__dirname, "../..");
const master = path.join(__dirname, ".master.mp4");
const out = name => path.join(root, "img", name);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: SCALE });
  page.on("pageerror", e => { console.error(e); process.exit(1); });
  await page.goto(URL);
  await page.evaluate(() => window.demoReady);
  const length = await page.evaluate(() => window.DEMO_LENGTH);
  const frames = Math.round(length * FPS);

  // a near-lossless master; the web encodes are cut from it
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "image2pipe", "-framerate", String(FPS), "-i", "-",
    "-vf", `scale=${OUT_W}:${OUT_H}:flags=lanczos`, "-c:v", "libx264", "-crf", "10", "-preset", "medium", "-pix_fmt", "yuv420p", master],
    { stdio: ["pipe", "inherit", "inherit"] });
  for (let i = 0; i < frames; i++) {
    await page.evaluate(t => window.renderAt(t), i / FPS);
    const png = await page.screenshot({ type: "png" });
    if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once("drain", r));
    if (i % 60 === 0) process.stdout.write(`frame ${i}/${frames}\n`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on("close", r));
  await browser.close();

  // Seamless loop: drop the first FADE seconds and crossfade them over the end, so the last frame
  // flows into the first.
  const loop = `[0]split[a][b];[a]trim=start=${FADE},setpts=PTS-STARTPTS[body];[b]trim=end=${FADE},setpts=PTS-STARTPTS[head];` +
    `[body][head]xfade=transition=fade:duration=${FADE}:offset=${(length - 2 * FADE).toFixed(3)}`;
  const run = args => execFileSync("ffmpeg", ["-v", "error", "-y", "-i", master, ...args], { stdio: "inherit" });
  run(["-filter_complex", loop, "-c:v", "libvpx-vp9", "-b:v", "0", "-crf", "36", "-row-mt", "1", "-deadline", "good", "-cpu-used", "2", "-an", out("product-demo.webm")]);
  run(["-filter_complex", loop, "-c:v", "libx264", "-crf", "25", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", out("product-demo.mp4")]);
  run(["-ss", String(FADE), "-frames:v", "1", "-q:v", "3", out("product-demo-poster.jpg")]);
  console.log("done");
})();
