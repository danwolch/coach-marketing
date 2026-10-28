# Homepage product demo video

The looping screen recording in the homepage's "An app that coaches you without joining the meeting"
section (`img/product-demo.webm`, `img/product-demo.mp4`, `img/product-demo-poster.jpg`) is rendered
from this folder. Jekyll skips folders that start with `_`, so none of this is published.

- `scene.html`: the whole video as one 1280x800 page: a macOS desktop, a Google Meet call, the WorkCoach
  recording prompt and recorder HUD, the analyzing card, then the Work Coach window. Every moving part is
  set by `renderAt(t)`. Open it in a browser (through a local server) to watch it loop live.
- `app/`: the meeting page inside the Work Coach window. `app.js`, `styles.css` and `ds/` are copied
  unchanged from the Mac app's prototype (`coach-macapp/scripts/poc/meeting-page/static`), which the
  SwiftUI meeting page mirrors. `fixture.js` stands in for the prototype's server with the demo meeting.
  Re-copy those files when the meeting page design changes.
- `img/`: Priya and Marcus are stills from the interview overview video; the icons come from the Mac app.

## Re-render

```bash
cd coach-marketing && python3 -m http.server 8811
```

```bash
cd coach-marketing && node _demo/product-demo/record.js
```

Needs Playwright with Chromium, and ffmpeg. It takes about six minutes and overwrites the three files
in `img/`. Bump the `?v=` on the video sources in `index.html` after re-rendering so caches refresh.
To change the story, edit the timings in `S` and the text in `scene.html` or `app/fixture.js`.
