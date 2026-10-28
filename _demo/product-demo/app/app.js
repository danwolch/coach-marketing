/* Work Coach meeting page POC. Vanilla JS over the local server's JSON. */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const mmss = s => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const nice = s => (s || "").replace(/_/g, " ");
const ICONS = {
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
  people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  tag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>',
  play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  ear: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8.5a6 6 0 0 1 12 0c0 3.5-3 4.5-3.5 7.5a3.5 3.5 0 0 1-6.6 1.6"/><path d="M10 8.5a2 2 0 0 1 4 0c0 1.2-1 1.7-1 2.5"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6.5"/><line x1="20" y1="20" x2="16" y2="16"/></svg>',
  doc: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
};

const state = { meetings: [], docTags: [], filter: null, current: null, analysis: null, open: null, poll: null, hasAudio: false, transcriptOpen: false, notesOpen: false, voiceSel: null, practiceOpen: null, practiceBusy: false };
const audio = $("#audio");

// ---------------------------------------------------------------- picker
async function loadMeetings(refresh) {
  const r = await fetch(`/api/meetings${refresh ? "?refresh=1" : ""}`).then(r => r.json());
  state.meetings = r.meetings; state.docTags = r.doc_tags || [];
  $("#origin").textContent = `${r.meetings.length} meetings · ${r.cloud ? "cloud + local" : "local only"}${r.docs ? ` · docs from ${r.docs}` : ""}`;
}
// Tags on a document from --docs: the outcome first, then listening and speaker labels.
const TAG_CLASS = { coached: "ok", "zero points": "warn", "reflect only": "think", nothing: "warn", listening: "think", "speakers not separated": "think", "too short": "", "not a meeting": "", error: "warn" };
function renderList(q) {
  const list = $("#list"); q = (q || "").toLowerCase();
  const matches = m => !q || (m.title + " " + (m.meeting_type || "") + " " + m.user + " " + m.id).toLowerCase().includes(q);
  const all = state.meetings.filter(matches);
  const rows = all.filter(m => !state.filter || (state.filter === "docs" ? m.origin === "docs" : (m.tags || []).includes(state.filter))).slice(0, state.filter ? 300 : 60);
  // filter chips for the documents from --docs, with how many match the search
  const chips = state.docTags.length ? `<div class="filters">${[["docs", "every document from the folder"], ...state.docTags].map(([t, why]) => {
    const n = all.filter(m => t === "docs" ? m.origin === "docs" : (m.tags || []).includes(t)).length;
    return `<button class="fchip ${state.filter === t ? "on" : ""}" data-f="${esc(t)}" title="${esc(why)}">${t === "docs" ? "all documents" : esc(t)} <span>${n}</span></button>`;
  }).join("")}</div>` : "";
  const tagsOf = m => (m.tags || []).filter(t => t !== "zero points" || !(m.tags || []).some(x => x === "reflect only" || x === "nothing")).map(t => `<span class="tag ${TAG_CLASS[t] ?? ""}">${esc(t)}</span>`).join("");
  const counts = m => m.origin === "docs" && !["too_short", "not_a_meeting", "error"].includes(m.outcome) ? ` · ${m.points} coaching, ${m.reflect} to think about` : "";
  list.innerHTML = chips + (rows.map(m => `<div class="row" data-id="${m.id}"><div><b>${esc(m.title)}</b><small>${(m.created_at || "").slice(0, 10)} · ${Math.round(m.duration / 60)} min · ${nice(m.meeting_type) || "unclassified"}${m.meeting_role ? " / " + nice(m.meeting_role) : ""} · ${m.origin}${m.user ? " · " + m.user : ""}${counts(m)}</small></div><div class="tags">${tagsOf(m)}${m.has_audio ? '<span class="tag ok">audio</span>' : ""}${m.analyzed && m.origin !== "docs" ? '<span class="tag ok">analyzed</span>' : ""}</div></div>`).join("") || `<div class="row"><small>No matches</small></div>`);
  list.hidden = false;
  list.querySelectorAll(".fchip").forEach(el => el.onclick = e => { e.stopPropagation(); state.filter = state.filter === el.dataset.f ? null : el.dataset.f; renderList($("#search").value); });
  list.querySelectorAll(".row[data-id]").forEach(el => el.onclick = () => { list.hidden = true; $("#search").value = ""; select(el.dataset.id); });
}
$("#search").addEventListener("input", e => renderList(e.target.value));
$("#search").addEventListener("focus", e => renderList(e.target.value));
document.addEventListener("click", e => { if (!e.target.closest(".picker")) $("#list").hidden = true; });

async function select(id) {
  state.current = state.meetings.find(m => m.id === id); state.analysis = null; state.open = null;
  location.hash = id;
  const r = await fetch(`/api/analysis/${id}`);
  if (r.ok) {
    state.analysis = await r.json();
    if (state.analysis.unanalyzable) renderUnanalyzable(state.analysis.unanalyzable);
    else render();
  }
  else if (state.current?.readonly) { renderNoDocument(await r.json().catch(() => ({}))); }
  else { renderPending(); }
  // documents from --docs are shown as they are: no Analyze, no Re-run
  const ro = !!state.current?.readonly;
  $("#analyze").hidden = ro || !!state.analysis; $("#rerun").hidden = ro || !state.analysis;
}
// A test recording or a clip (the document's `unanalyzable`), as the Mac app's card shows it. The app
// offers Delete meeting and Keep it; this page only shows a note.
function unanalyzableMessage(u) {
  if (u.reason === "not_a_meeting") return "It sounds like a video or audio clip, with no conversation to coach.";
  const words = u.words || 0;
  if (!words) return u.words === 0 ? "There is no speech in it to coach." : "It is too short to coach.";
  const w = words === 1 ? "1 word" : `${words} words`;
  if (!(u.minutes > 0)) return `It has ${w}, which is too little to coach.`;
  if (u.minutes < 1) return `It has ${w} in under a minute, which is too little to coach.`;
  const n = Math.round(u.minutes);
  return `It has ${w} over ${n === 1 ? "1 minute" : `${n} minutes`}, which is too little to coach.`;
}
function renderUnanalyzable(u) {
  const m = state.current;
  $("#page").innerHTML = `<div class="head"><h1 class="title">${esc(m.title)}</h1><div class="pills">${headerPill(m)}</div></div>
  <div class="unanalyzable"><div class="icon">${u.reason === "not_a_meeting" ? "▶" : "≋"}</div><div>
    <h2>This looks like a test recording</h2>
    <p>${esc(unanalyzableMessage(u))}</p>
    <p class="note">In the app, this card offers Delete meeting and Keep it. Keep it shows the notes and transcript.${u.reason === "not_a_meeting" && u.meeting_p != null ? ` Jev: ${Math.round(u.meeting_p * 100)}% a conversation.` : ""}</p>
  </div></div>`;
  $("#analyze").hidden = true; $("#rerun").hidden = true;
}
function renderNoDocument(r) {
  const m = state.current;
  // a too-short run from before the unanalyzable document: the same card, without numbers
  if (r.outcome === "too_short") return renderUnanalyzable({ reason: "too_short" });
  const why = r.outcome === "too_short" ? "The transcript is too short to split into chapters, so the run stopped before writing a document."
    : `The run failed, so there is no document.${r.detail ? ` (${r.detail})` : ""}`;
  $("#page").innerHTML = `<div class="head"><h1 class="title">${esc(m.title)}</h1><div class="pills">${headerPill(m)}</div></div><div class="progress"><span>${esc(why)}</span></div>`;
}
$("#analyze").onclick = () => analyze(false);
$("#rerun").onclick = () => analyze(true);
async function analyze(force) {
  const id = state.current.id;
  $("#analyze").disabled = true; $("#rerun").disabled = true;
  const r = await fetch(`/api/analyze/${id}${force ? "?force=1" : ""}`, { method: "POST" }).then(r => r.json());
  if (r.cached) { state.analysis = r.result; render(); $("#analyze").disabled = false; $("#rerun").disabled = false; return; }
  renderPending([]);
  clearInterval(state.poll);
  state.poll = setInterval(async () => {
    const s = await fetch(`/api/status/${id}`).then(r => r.json());
    renderPending(s.log, s.error);
    if (!s.running) {
      clearInterval(state.poll); $("#analyze").disabled = false; $("#rerun").disabled = false;
      if (s.error && /too short/i.test(s.error)) { renderUnanalyzable({ reason: "too_short" }); return; }
      if (!s.error) { state.analysis = await fetch(`/api/analysis/${id}`).then(r => r.json()); if (state.analysis.unanalyzable) { renderUnanalyzable(state.analysis.unanalyzable); return; } render(); $("#analyze").hidden = true; $("#rerun").hidden = false; await loadMeetings(); }
    }
  }, 1200);
}
function renderPending(log, err) {
  const m = state.current;
  $("#page").innerHTML = `<div class="head"><h1 class="title">${esc(m.title)}</h1><div class="pills">${headerPill(m)}</div></div>
  <div class="progress">${log ? (log.length ? log.map(l => `<span>${esc(l)}</span>`).join("") : "<span>Starting…</span>") : "<span>Not analyzed yet. Click Analyze to run classification, chapters, judgments and coaching on this meeting.</span>"}${err ? `<span class="err">${esc(err)}</span>` : ""}</div>`;
}
function headerPill(m, cls) {
  const d = m.created_at ? new Date(m.created_at) : null;
  const date = d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  const people = (m.attendees || []).length;
  return `<span class="pill">${ICONS.cal}${date}<span style="width:6px"></span>${ICONS.people}${people || "–"}<span style="width:6px"></span>${Math.round((m.duration || 0) / 60)} min</span>` +
    (cls ? `<span class="pill cls">${ICONS.tag}${nice(cls.meeting_type)}${cls.meeting_role ? " · " + nice(cls.meeting_role) : ""}${cls.role_probability ? ` <span style="opacity:.7">${Math.round(cls.role_probability * 100)}%</span>` : ""}</span>` : "");
}

// ---------------------------------------------------------------- page
// Reflect points (kind "reflect") are prompts to think about, drawn without a verdict. A chapter whose
// only points are reflect points is not coached, whatever its verdict (as in the Mac app).
const isReflect = p => p.kind === "reflect";
const hasReflect = c => (c.points || []).some(isReflect);
const isCoached = c => c.verdict !== "quiet" && (!(c.points || []).length || (c.points || []).some(p => !isReflect(p)));
const isThink = c => !isCoached(c) && hasReflect(c);   // a gray chapter with something to think about: a ring
const reflectCount = a => a.chapters.reduce((n, c) => n + (c.points || []).filter(isReflect).length, 0);
const pointCount = a => a.chapters.reduce((n, c) => n + (c.points || []).length, 0);
const chapterCls = c => !isCoached(c) ? "quiet" : c.verdict === "went_well" ? "well" : "improve";
function render() {
  const a = state.analysis, m = state.current; const total = a.duration || 1;
  state.hasAudio = m.has_audio;
  if (state.hasAudio) { audio.src = `/audio/${m.id}`; } else { audio.removeAttribute("src"); }
  const coached = a.chapters.filter(isCoached), nReflect = reflectCount(a);
  // the first could-improve chapter, else any coached one, else the first with something to think about
  // as the Mac app: a meeting with nothing to coach opens on its first section
  if (state.open == null) state.open = (coached.find(c => c.verdict === "could_improve") || coached[0] || a.chapters.find(hasReflect) || a.chapters[0])?.n ?? null;
  const counts = [coached.length ? `${coached.length} coached of ${a.chapters.length} chapters` : "", nReflect ? `${nReflect} to think about` : ""].filter(Boolean).join(" · ");
  $("#page").innerHTML = `
  <div class="head"><h1 class="title">${esc(a.title)}</h1><div class="pills">${headerPill({ ...m, attendees: a.attendees, duration: total }, a.classification)}${a.stored_type && a.stored_type !== a.classification.meeting_type ? `<span class="muted">stored as ${nice(a.stored_type)}</span>` : ""}${a.speaker_labels === "single" ? `<span class="muted" title="This recording has one speaker label for everyone, so this page does not say who said what.">speakers not separated</span>` : ""}${a.timing === "estimated" ? `<span class="muted" title="This transcript has no timestamps. Times are estimated from word counts and scaled to the meeting length.">times estimated</span>` : ""}</div></div>
  <div style="display:flex;flex-direction:column;gap:14px">
    ${a.listening ? `<div class="listenline">${ICONS.ear}<span>${nReflect ? "You mostly listened in this meeting. Here are a few things worth thinking about." : "You mostly listened in this meeting."}</span></div>` : ""}
    <div class="tl">
      <div class="player"><button id="play" ${state.hasAudio ? "" : "disabled title='No local recording for this meeting'"}>${ICONS.play}</button><span class="time"><b id="now">0:00</b><span>/ ${mmss(total)}</span></span></div>
      <div class="track">
        <div id="necks"></div>
        <div class="strip" id="strip">${a.chapters.map(chapterBubble).join("")}</div>
        <div class="ruler" id="ruler"><div class="base"></div><div class="fill" id="fill" style="width:0"></div><div id="selband"></div>${axis(total)}</div>
      </div>
    </div>
    <div id="openpanel"></div>
    <div class="legend"><span><i class="sw"></i>Context, no coaching</span>${coached.length ? `<span><i class="dw"></i>Went well</span><span><i class="di"></i>Could improve</span>` : ""}${nReflect ? `<span><i class="rw"></i>To think about</span>` : ""}${counts ? `<span class="muted">${counts}</span>` : ""}</div>
  </div>
  ${window.voiceSection ? voiceSection(a) : a.audio ? audioSection(a) : ""}
  ${practiceSection(a)}
  ${notesSection(a)}
  ${transcriptSection(a)}
  ${traceSection(a)}`;
  $("#strip").querySelectorAll(".ch[data-n]").forEach(el => el.onclick = () => { state.open = state.open === +el.dataset.n ? null : +el.dataset.n; renderOpen(); });
  $("#ruler").onclick = e => { const r = e.currentTarget.getBoundingClientRect(); seek((e.clientX - r.left) / r.width * total); };
  $("#play").onclick = () => { if (!state.hasAudio) return; audio.paused ? audio.play() : audio.pause(); };
  renderOpen();
  layoutStrip();
  wireHover();
}
/* Coached bubbles that collide after min-width drop to a second row; quiet bars sit below both. */
const MIN_COACHED = 104;   // px: room for two short words and a dot
function layoutStrip() {
  const strip = $("#strip"); if (!strip) return;
  strip.style.height = "46px";
  const W = strip.clientWidth, GAP = 5;
  const els = [...strip.querySelectorAll(".ch")].sort((a, b) => +a.dataset.l - +b.dataset.l);
  // 1. Pixel layout from the time shares, then widen narrow coached blocks at the expense of
  //    gray neighbours only, so the strip stays a timeline and a coached chapter always reads.
  // prominent: coached, or a gray chapter with something to think about; kept wide enough to read
  const b = els.map(el => ({ el, left: W * +el.dataset.l / 100, width: W * +el.dataset.w / 100, coached: !el.classList.contains("quiet") || el.classList.contains("think") }));
  for (let i = 0; i < b.length; i++) {
    if (!b[i].coached || b[i].width >= MIN_COACHED) continue;
    let need = MIN_COACHED - b[i].width;
    const take = (j, fromLeft) => {
      if (j < 0 || j >= b.length || b[j].coached) return;
      const give = Math.min(need, Math.max(0, b[j].width - 28));
      if (give <= 0) return;
      b[j].width -= give; need -= give;
      if (fromLeft) { b[i].left -= give; b[i].width += give; }
      else { b[j].left += give; b[i].width += give; }
    };
    take(i - 1, true); if (need > 0) take(i + 1, false);
  }
  for (const x of b) { x.el.style.left = `${x.left}px`; x.el.style.width = `${Math.max(8, x.width - GAP)}px`; }
  // 2. Label by stages: the label, then its first two words, then the chapter number. Never blank.
  for (const x of b) {
    const el = x.el, txt = el.querySelector(".lbl span:last-child"), chev = el.querySelector(".chev"); if (!txt) continue;
    const full = el.dataset.label || ""; const two = full.split(" ").slice(0, 2).join(" ");
    // a label fits when two lines hold it without breaking a word (as the Mac app checks the longest word)
    const fits = s => { txt.textContent = s; txt.style.webkitLineClamp = "unset"; txt.style.overflowWrap = "normal"; const ok = txt.scrollHeight <= 34 && txt.scrollWidth <= el.clientWidth - (x.coached ? 34 : 18) && txt.scrollWidth <= txt.clientWidth + 1; txt.style.webkitLineClamp = ""; txt.style.overflowWrap = ""; return ok; };
    if (chev) chev.style.display = "";
    if (fits(full)) continue;
    if (fits(two)) continue;
    if (chev) chev.style.display = "none";
    if (x.coached) { txt.textContent = String(+el.dataset.i + 1); if (!fits(txt.textContent)) txt.textContent = ""; }
    else txt.textContent = "";
  }
  placeNeck();
}
/* The connector from the open bubble down through the ruler follows the bubble, which is sized to its label. */
function placeNeck() {
  const neck = $("#necks .neck"), strip = $("#strip"); if (!neck || !strip) return;
  const el = strip.querySelector(`.ch[data-n="${state.open}"]`); if (!el) return;
  const track = strip.parentElement;
  neck.style.left = `${el.offsetLeft}px`; neck.style.width = `${el.offsetWidth}px`;
  const sel = $("#selband .sel"); if (sel) { sel.style.left = `${el.offsetLeft}px`; sel.style.width = `${el.offsetWidth}px`; }
  neck.style.top = `${strip.offsetTop + el.offsetTop + el.offsetHeight - 2}px`; neck.style.height = `${track.offsetHeight - (strip.offsetTop + el.offsetTop + el.offsetHeight) + 10}px`;
}
window.addEventListener("resize", layoutStrip);
function chapterBubble(c) {
  // One row. Every chapter is a block as wide as its share of the meeting, so the strip is the timeline.
  const total = state.analysis.duration || 1;
  const left = 100 * c.start / total, width = Math.max(0.6, 100 * (c.end - c.start) / total);
  const cls = chapterCls(c), think = isThink(c);
  const short = (c.label || c.title.split(" ").slice(0, 3).join(" ")).replace(/[,.;:]+$/, "");
  const inner = `<span class="lbl">${cls === "quiet" ? (think ? '<span class="ring"></span>' : "") : '<span class="d"></span>'}<span>${esc(short)}</span></span>`;
  const box = `left:${left}%;width:calc(${width}% - 5px)`;   // a small gap between blocks, as in the mockup
  const data = `data-i="${c.n}" data-l="${left}" data-w="${width}" data-label="${esc(short)}"`;
  if (think) return `<button class="ch quiet think ${state.open === c.n ? "open" : ""}" data-n="${c.n}" ${data} style="${box}">${inner}<span class="chev">›</span></button>`;
  if (cls === "quiet") return `<button class="ch quiet ${state.open === c.n ? "open" : ""}" data-n="${c.n}" ${data} style="${box}">${inner}</button>`;
  return `<button class="ch ${cls} ${state.open === c.n ? "open" : ""}" data-n="${c.n}" ${data} style="${box}">${inner}<span class="chev">›</span></button>`;
}
/* Hover: the block lifts, a light band marks its span on the ruler, and a caption names it above the strip. */
function wireHover() {
  const strip = $("#strip"), track = strip?.parentElement; if (!strip) return;
  const cap = document.createElement("div"); cap.className = "cap"; track.appendChild(cap);
  const band = document.createElement("div"); band.className = "hoverband"; $("#ruler").appendChild(band);
  strip.querySelectorAll(".ch[data-i]").forEach(el => {
    el.addEventListener("mouseenter", () => {
      const c = state.analysis.chapters.find(x => x.n === +el.dataset.i); if (!c) return;
      const total = state.analysis.duration || 1;
      const cls = chapterCls(c);
      cap.innerHTML = `<b>${mmss(c.start)}–${mmss(c.end)}</b> <span>${esc(c.title)}</span>${cls !== "quiet" ? `<i class="${cls}">${c.verdict === "went_well" ? "went well" : "could improve"}</i>` : `<i>${isThink(c) ? "to think about" : "context"}</i>`}`;
      cap.style.left = `${el.offsetLeft}px`; cap.style.visibility = "visible";
      // keep the caption on the page
      const over = cap.offsetLeft + cap.offsetWidth - strip.offsetWidth; if (over > 0) cap.style.left = `${Math.max(0, el.offsetLeft - over)}px`;
      band.className = `hoverband ${cls}`; band.style.left = `${el.offsetLeft}px`; band.style.width = `${el.offsetWidth}px`; band.style.visibility = "visible";
    });
    el.addEventListener("mouseleave", () => { cap.style.visibility = "hidden"; band.style.visibility = "hidden"; });
  });
}
function axis(total) {
  const step = total > 3600 ? 600 : total > 1500 ? 300 : 60; let out = "";
  for (let t = 0; t + step * 0.6 < total; t += step) { const x = 100 * t / total; out += `<span class="tick" style="left:${x}%"></span><span class="tlbl" style="left:${x}%">${mmss(t)}</span>`; }
  out += `<span class="tick" style="left:100%"></span><span class="tlbl end" style="left:100%">${mmss(total)}</span>`;
  return out;
}
function renderOpen() {
  const a = state.analysis, total = a.duration || 1; const c = a.chapters.find(x => x.n === state.open);
  $("#strip").querySelectorAll(".ch[data-n]").forEach(el => el.classList.toggle("open", +el.dataset.n === state.open));
  const necks = $("#necks"), band = $("#selband"), panel = $("#openpanel");
  if (!c) {
    necks.innerHTML = ""; band.innerHTML = "";
    const coached = a.chapters.filter(isCoached).length, nReflect = reflectCount(a);
    // a document with no points at all: the empty state where the open chapter would be
    if (!coached && !pointCount(a)) {
      panel.innerHTML = `<div class="hintline">Click a chapter to see that part of the notes.</div>`;
      return;
    }
    const hint = !coached ? "Click a chapter. Gray ones with a ring have something worth thinking about."
      : nReflect ? "Click a chapter. Green and amber ones carry coaching; gray ones with a ring have something worth thinking about."
      : "Click a chapter. Green and amber ones carry coaching; gray ones show that part of the notes.";
    panel.innerHTML = `<div class="hintline">${hint}</div>`;
    return;
  }
  const cls = chapterCls(c);
  necks.innerHTML = `<div class="neck ${cls}"></div>`; band.innerHTML = `<div class="sel ${cls}"></div>`;
  const points = (c.points || (c.point ? [{ n: 1, kind: c.framework ? "framework" : c.ledger ? "ledger" : "judgment", verdict: c.verdict, label: c.driver ? nice(c.driver) : nice(c.kind), quote: c.framework ? c.framework.question : "", ...c.point }] : [])).slice().sort((x, y) => (isVisualFirst(x) ? 0 : 1) - (isVisualFirst(y) ? 0 : 1) || (x.at ?? 0) - (y.at ?? 0)).map((p, i) => ({ ...p, n: i + 1 }));
  const notes = (c.notes || []).length ? `<details class="chnotes"><summary>In the notes · ${c.notes.length}</summary><ul>${c.notes.map(n => `<li>${inline(n.text)}</li>`).join("")}</ul></details>` : "";
  const judg = c.applicable ? `<details class="chnotes"><summary>Judgments · ${esc(nice(c.kind))}${c.me_share != null ? ` · you spoke ${Math.round(c.me_share * 100)}%` : ""}</summary><div class="judg">${judgments(c)}</div></details>` : "";
  const header = `<div class="chead"><span class="ctitle">${esc(c.title)}</span><span class="muted">Chapter ${c.n + 1} of ${a.chapters.length} · ${mmss(c.start)}–${mmss(c.end)}</span><button class="close" title="Collapse">×</button></div>`;
  let html;
  if (cls === "quiet") {
    // a context chapter shows its reflect points first, then the context section
    const reflects = points.filter(isReflect).map((p, i) => reflectSection(c, p, false)).join("");
    // same frame as a coaching point: spine with a gray marker and line, pill row with Listen at and close, headline, then the notes
    const kind = nice(c.kind); const notesList = (c.notes || []).length ? `<ul class="plainnotes">${c.notes.map(n => `<li>${inline(n.text)}</li>`).join("")}</ul>` : `<div class="muted">Nothing in the notes maps to this chapter.</div>`;
    html = `<div class="main wide">${header}${reflects}<section class="pt quiet">
      <div class="spine"><span class="num">·</span><span class="line"></span></div>
      <div class="pbody">
        <div class="meta"><span class="kpill quietpill">Context</span><span>${esc(kind[0].toUpperCase() + kind.slice(1))} · ${mmss(c.start)}–${mmss(c.end)}</span><span class="sp"></span><button class="listen sm" data-at="${c.start}">Listen at&nbsp; ${mmss(c.start)}</button></div>
        ${c.gist ? `<div class="pquote plain">${esc(c.gist)}</div>` : ""}
        <div class="coachgrid"><div class="coach"><span class="eyebrow green">In the notes</span>${notesList}${judg}</div></div>
      </div>
    </section></div>`;
  } else {
    // 21a: every point in full down a numbered spine colored by status. No chapter header, no chip row.
    const vcls = p => p.verdict === "went_well" ? "well" : "improve";
    const vtxt = p => p.verdict === "went_well" ? "Went well" : "Could improve";
    const body = points.map((p, i) => {
      if (isReflect(p)) return reflectSection(c, p, i === points.length - 1, notes + judg);
      const tryText = (p.try || "").replace(/^["\u201c]+|["\u201d]+$/g, "");
      const visual = caseVisual(c, p) ?? (p.kind === "framework" ? (c.framework.scheme === "ppf" ? circlesVisual(c.framework) : starVisual(c.framework)) : p.kind === "ledger" ? ledgerVisual(c.ledger) : "");
      const quote = p.quote ? `<div class="pquote">\u201c${esc(p.quote)}\u201d</div>` : "";
      return `<section class="pt ${vcls(p)}" id="pt${c.n}-${p.n}">
        <div class="spine"><span class="num">${p.n}</span><span class="line"></span></div>
        <div class="pbody">
          <div class="meta"><span class="kpill ${vcls(p)}">${vtxt(p)}</span>${caseMeta(c, p) ?? `<span>${esc(p.label || "")} · ${mmss(p.at ?? c.start)}–${mmss(c.end)}</span>`}<span class="sp"></span><button class="listen sm" data-at="${p.at ?? c.start}">Listen at&nbsp; ${mmss(p.at ?? c.start)}</button></div>
          <div class="headline">${esc(p.headline || c.title)}</div>
          ${quote}${visual}
          <div class="coachgrid">
            <div class="coach"><span class="eyebrow green">What happened</span><div class="body lead">${esc(p.body || "")}</div>${i === points.length - 1 ? notes + judg : ""}</div>
            ${tryText ? `<div class="try boxed next"><span class="eyebrow">${p.verdict === "went_well" ? "Keep doing" : "Next time"}</span><span class="text">${esc(tryText)}</span></div>` : ""}
          </div>
        </div>
      </section>`;
    }).join("");
    html = `<div class="main wide">${header}${body}</div>`;
  }
  if (window.voiceLine) html = html.replace(/<\/div>\s*$/, voiceLine(a, c) + "</div>");
  panel.innerHTML = `<div class="open-wrap"><span></span><div class="panel ${cls} single">${html}</div></div>`;
  $("#openpanel .close").onclick = () => { state.open = null; renderOpen(); };
  // Listen at, and the clickable parts of a visual, play from that point in the timeline; the transcript stays where it is
  panel.querySelectorAll("[data-at]").forEach(el => el.onclick = () => seek(+el.dataset.at));
  panel.querySelectorAll(".chip").forEach(el => el.onclick = ev => { ev.preventDefault(); const t = $(el.getAttribute("href")); if (t) t.scrollIntoView({ behavior: "smooth", block: "start" }); });
  placeNeck();
}
// A prompt to think about: a neutral card with a gray spine, the prompt as the headline, an optional
// quote, why it is worth thinking about, and an optional action in a soft box. The meta line names the
// chapter, because the point's own label repeats the pill. Mirrors ChapterCardView.reflectSection.
const REFLECT = {
  question: ["A question worth asking", "?"],
  poke: ["Worth poking at", ICONS.search],
  contribute: ["If you want to add something", "+"],
};
function reflectSection(c, p, showsDisclosures, disclosures = "") {
  const [eyebrow, mark] = REFLECT[p.reflect] || REFLECT.question;
  const at = p.at ?? c.start;
  const tryText = (p.try || "").replace(/^["\u201c\s]+|["\u201d\s]+$/g, "");
  const bodyText = (p.body || "").trim();
  const extra = showsDisclosures ? disclosures : "";
  const showsLeft = !!bodyText || !!extra;
  const kind = nice(c.kind); const label = (c.label || "").trim() || (kind ? kind[0].toUpperCase() + kind.slice(1) : "");
  const quote = p.quote ? `<div class="pquote">\u201c${esc(p.quote)}\u201d</div>` : "";
  const grid = showsLeft || tryText ? `<div class="coachgrid">
      ${showsLeft ? `<div class="coach">${bodyText ? `<span class="eyebrow">Why it\u2019s worth thinking about</span><div class="body lead">${esc(bodyText)}</div>` : ""}${extra}</div>` : ""}
      ${tryText ? `<div class="try boxed soft"><span class="eyebrow">If you want to act on it</span><span class="text">${esc(tryText)}</span></div>` : ""}
    </div>` : "";
  return `<section class="pt reflect" id="pt${c.n}-${p.n}">
    <div class="spine"><span class="num">${mark}</span><span class="line"></span></div>
    <div class="pbody">
      <div class="meta"><span class="kpill reflectpill">${eyebrow}</span><span>${label ? esc(label) + " · " : ""}${mmss(at)}–${mmss(c.end)}</span><span class="sp"></span><button class="listen sm" data-at="${at}">Listen at&nbsp; ${mmss(at)}</button></div>
      <div class="headline">${esc(p.headline || c.title)}</div>
      ${quote}${grid}
    </div>
  </section>`;
}
const STATUS = { clear: "Clear", partial: "Partial", missing: "Missing", folded: "Folded in" };
function starVisual(fw) {
  const bar = fw.parts.map(p => {
    if (p.status === "missing" || p.status === "folded") return `<span class="part ${p.status}" style="flex:0 0 64px"><span class="k">${esc(p.key)}</span></span>`;
    return `<span class="part ${p.status}" style="flex:${Math.max(6, Math.round(p.share * 100))} 1 0" ${p.at != null ? `data-at="${p.at}"` : ""}><span class="k">${esc(p.key)}</span>${p.status === "clear" ? mmss(p.seconds) : ""}</span>`;
  }).join("");
  const legend = fw.parts.map(p => `<div class="pl"><span class="n">${esc(p.name)} <span class="muted">${mmss(p.seconds)}</span></span><span class="st ${p.status}">${STATUS[p.status]}</span><span class="g">${esc(p.snippet)}</span></div>`).join("");
  return `<div class="fw"><div class="starbar">${bar}</div><div class="plgrid">${legend}</div><span class="fwnote">${esc(fw.note)}</span></div>`;
}
function circlesVisual(fw) {
  const order = ["Past", "Present", "Future"]; const total = fw.answer_seconds || 1;
  const cols = order.map(key => {
    const p = fw.parts.find(x => x.key === key); const size = Math.max(40, Math.min(96, Math.round(40 + 70 * p.share)));
    const circ = p.status === "missing" ? `<span class="circ missing" style="width:56px;height:56px">0:00</span>`
      : `<span class="circ ${p.status}" style="width:${size}px;height:${size}px" ${p.at != null ? `data-at="${p.at}"` : ""}>${p.order ? "①②③④⑤⑥"[p.order - 1] + " " : ""}${mmss(p.seconds)}</span>`;
    return `<div class="zone"><span class="eyebrow">${esc(key)}</span><div class="circs">${circ}</div><span class="st ${p.status}">${STATUS[p.status]}</span><span class="g">${esc(p.snippet)}</span></div>`;
  }).join("");
  return `<div class="fw"><div class="zones">${cols}</div><span class="fwnote">${esc(fw.note)}</span></div>`;
}
function ledgerVisual(ld) {
  const mark = { clear: "✓", partial: "–", dropped: "×" };
  const raised = ld.raised.map(a => `<div class="ask ${a.status}" ${a.at != null ? `data-at="${a.at}"` : ""}><span class="m">${mark[a.status] || "–"}</span><span class="l">${esc(a.label)}</span><span class="st ${a.status === "clear" ? "clear" : a.status === "partial" ? "partial" : "missing"}">${a.status === "clear" ? "Clear" : a.status === "partial" ? "Partial" : "Dropped"}</span><span class="t">${a.at != null ? mmss(a.at) : ""}</span></div>`).join("");
  const missed = ld.missed.map(a => `<div class="ask missed"><span class="m"></span><span class="l">${esc(a.label)}</span></div>`).join("");
  return `<div class="fw"><div class="ledger"><div class="col"><span class="eyebrow">Raised · ${ld.raised.length} of ${ld.raised.length + ld.missed.length}</span>${raised || '<span class="muted">Nothing raised</span>'}</div><div class="col"><span class="eyebrow">Didn\u2019t get to · ${ld.missed.length}</span>${missed || `<span class="muted">${ld.from_notes ? "Everything in your notes came up." : "No notes before the meeting, so nothing to check against."}</span>`}</div></div><span class="fwnote">${ld.from_notes ? "From the notes you wrote for the meeting. Partial means you raised it but left without an answer." : "Partial means you raised it but left without an answer."}</span></div>`;
}
function judgments(c) {
  return Object.entries(c.judgments || {}).map(([q, j]) => {
    const label = esc(c.questions?.[q] || q);
    if (j.type === "noul") return `<div class="q"><span title="${label}">${esc(nice(q))}</span><div class="bar"><i style="width:${Math.round(j.p * 100)}%"></i></div><span>${j.p.toFixed(2)}</span></div>`;
    if (j.type === "choice") return `<div class="q"><span title="${label}">${esc(nice(q))}</span><span class="hint">${esc(nice(j.choice))}</span><span>${j.p.toFixed(2)}</span></div>`;
    return `<div class="q"><span title="${label}">${esc(nice(q))}</span><span class="hint">level ${j.level} of ${j.levels - 1}: ${esc(j.legend[j.level])}</span><span>${(+j.score).toFixed(1)}</span></div>`;
  }).join("") + (c.applicable === false ? `<div class="hint">You spoke under 20% of this chapter, so only the kind was checked.</div>` : "");
}

// ---------------------------------------------------------------- sections
function audioSection(a) {
  const s = a.audio, total = a.duration || 1; const open = a.chapters.find(x => x.n === state.open);
  const max = Math.max(1, ...s.bars.map(b => b.me + b.them));
  const note = { interview: "For an interview, talking a bit more than half the time is about right.", one_on_one: "In a 1:1 the split should follow who needs the time that week.", weekly_team_meeting: "In a team meeting a low share is normal unless you run it." }[a.classification.meeting_type] || "";
  const wpmV = s.wpm == null ? ["neutral", "Not enough speech to measure"] : s.wpm > 175 ? ["warn", "Fast"] : s.wpm < 120 ? ["warn", "Slow"] : ["good", "Conversational pace"];
  const fillV = s.fillers_per_min > 4 ? ["warn", `${s.fillers_per_min} a minute`] : ["good", `${s.fillers_per_min} a minute`];
  const pauseV = s.longest_pause >= 1.5 ? ["good", "You took time to think"] : ["neutral", "Quick replies throughout"];
  return `<div class="section"><div class="hd"><span class="t">Audio analysis</span><span class="muted">Measured in code from the transcript timings</span></div>
  <div class="card">
    <div class="talk"><div><div class="eyebrow">Talk time</div><div class="nums"><span class="n"><b>${s.you}%</b><span>you</span></span><span class="n them"><b>${s.them}%</b><span>them</span></span></div></div><span class="note">${esc(note)}</span></div>
    <div class="split"><i class="me" style="width:${s.you}%"></i><i class="th" style="width:${s.them}%"></i></div>
    <div class="bars">${open ? `<div class="band" style="left:${100 * open.start / total}%;width:${100 * (open.end - open.start) / total}%"></div>` : ""}<div class="row">${s.bars.map(b => `<span class="b" title="minute ${b.m}: you ${b.me} words, them ${b.them}" data-t="${b.m * 60}"><i class="me" style="height:${Math.round(100 * b.me / max)}%"></i><i class="th" style="height:${Math.round(100 * b.them / max)}%"></i></span>`).join("")}</div></div>
    <div class="stats">
      <div class="s"><b>${s.wpm ?? "–"}</b><span>words per minute</span><em class="${wpmV[0]}">${wpmV[1]}</em></div>
      <div class="s"><b>${s.fillers}</b><span>filler words</span><em class="${fillV[0]}">${fillV[1]}</em></div>
      <div class="s"><b>${s.longest_pause}s</b><span>longest pause before answering</span><em class="${pauseV[0]}">${pauseV[1]}</em></div>
    </div>
  </div></div>`;
}
// Practice scenarios (design C5): one row per coaching point worth rehearsing; Practice opens the brief.
const MIC_ICON = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>`;
function practiceSection(a) {
  const ps = a.practice || [];
  const rows = ps.length ? ps.map((s, i) => {
    const open = state.practiceOpen === i;
    const chapter = s.chapter != null ? a.chapters.find(c => c.n === s.chapter - 1 || c.n === s.chapter) : null;
    return `<div class="prow ${open ? "open" : ""}" data-pr="${i}">
      <span class="icon">${MIC_ICON}</span>
      <div class="ptext"><span class="pt-title">${esc(s.title)}</span><span class="pt-desc ${open ? "full" : ""}">${esc(s.description)}</span><span class="pt-with">Role-play with: ${esc(s.character_role)}${s.character_trait ? " · " + esc(s.character_trait) : ""}${chapter ? ` · from ${esc(chapter.title)}` : ""}</span></div>
      <button class="pbtn" data-pgo="${i}">${open ? "Close" : "Practice ›"}</button>
      ${open ? `<div class="pbrief">
        <div class="pcol"><span class="eyebrow">They open with</span><span class="pquote">“${esc(s.opening_line || "")}”</span></div>
        <div class="pcol"><span class="eyebrow">Brief for the ${esc(s.character_role.toLowerCase())}</span><span class="pbody">${esc(s.brief || "")}</span></div>
        <div class="pcol"><span class="eyebrow">You’re judged on</span><ul>${(s.criteria || []).map(c => `<li>${esc(c)}</li>`).join("")}</ul></div>
        <div class="pact"><button class="btn" data-pcopy="${i}">Copy brief</button><span class="muted">Role-play runs in the app. Here the brief is what you can take with you.</span></div>
      </div>` : ""}
    </div>`;
  }).join("") : `<div class="muted" style="padding:6px 0">No coaching point in this meeting is worth a role-play right now.</div>`;
  return `<div class="section practice"><div class="hd"><span class="picon">${MIC_ICON}</span><span class="t">Practice scenarios</span><span class="muted">Built from this meeting’s coaching</span><span class="spacer"></span>${state.current?.readonly ? "" : `<button class="btn" id="pregen">${state.practiceBusy ? "Regenerating…" : "Regenerate"}</button>`}</div><div class="plist">${rows}</div></div>`;
}

function notesSection(a) {
  if (!a.summary) return "";
  // same card as the transcript: collapsed by default, click the card to expand
  const words = a.summary.split(/\s+/).filter(Boolean).length;
  return `<div class="section notes"><div class="tcard" id="ncard"><span class="icon">${ICONS.notes || ICONS.doc}</span><span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:700">Summary</span><span class="muted">Generated from the transcript · ${words} words</span></span><button class="btn" id="copynotes" title="Copy summary">Copy</button><span class="muted chev">${state.notesOpen ? "▾" : "›"}</span></div>
  ${state.notesOpen ? `<div class="box" id="notesbox">${markdown(a.summary)}</div>` : ""}</div>`;
}
function markdown(md) {
  const out = []; let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.map(l => `<li>${inline(l)}</li>`).join("")}</ul>`); list = []; } };
  for (const raw of md.split("\n")) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (/^#{1,3}\s/.test(line)) { flush(); out.push(`<h4>${inline(line.replace(/^#+\s*/, ""))}</h4>`); }
    else if (/^[-*•]\s/.test(line)) list.push(line.replace(/^[-*•]\s*/, ""));
    else { flush(); out.push(`<p>${inline(line)}</p>`); }
  }
  flush(); return out.join("");
}
function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>"); }
function speakerName(a, t) {
  if (a.speaker_labels === "single") return "Speaker";
  if (t.speaker === "Me") return "You";
  if (!t.label) return "Them";
  return (a.speaker_names && a.speaker_names[t.label]) || t.label;
}
function transcriptSection(a) {
  // Mirrors the Mac app: timed rows that seek when there is audio and real timings, otherwise the plain text.
  // rows whenever the transcript has real timings (so Listen at can land on a line); plain text only when it doesn't
  const interactive = a.timing !== "estimated" && a.turns.some(t => t.start > 0 || t.end > 0);
  let body = "";
  if (state.transcriptOpen) {
    if (interactive) {
      body = `<div class="hint"><span>↳</span> ${state.hasAudio ? "Click a line to jump" : "No audio for this meeting on this Mac"}</div><div class="turns" id="turns">${a.turns.map(t => `<div class="turn ${t.speaker === "Me" ? "me" : ""}" data-t="${t.start}" data-e="${t.end}" id="turn-${t.id}"><span class="t">${mmss(t.start)}</span><span class="s">${esc(speakerName(a, t))}</span><span>${esc(t.text)}</span></div>`).join("")}</div>`;
    } else {
      const plain = a.transcript_text || a.turns.map(t => `${speakerName(a, t)}: ${t.text}`).join("\n");
      body = plain.trim() ? `<div class="turns plain">${esc(plain)}</div>` : `<div class="muted" style="padding:8px">No transcript available.</div>`;
    }
  }
  return `<div class="section"><div class="tcard" id="tcard"><span class="icon">${ICONS.doc}</span><span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:14px;font-weight:700">Transcript</span><span class="muted">${Math.round(a.duration / 60)} min · ${a.turns.length} turns</span></span><button class="btn" id="copytr" title="Copy transcript">Copy</button><span class="muted chev">${state.transcriptOpen ? "▾" : "›"}</span></div>${body}</div>`;
}
function traceSection(a) {
  if (!a.trace) {
    const money = v => v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;
    return `<div class="section cost"><div class="costline"><span class="big">${money(a.totals?.cost || 0)}</span><span class="muted">for this analysis · ${a.totals?.seconds ?? "–"} s · pipeline ${esc(a.pipeline_version || "?")} · chapters by ${esc(a.chapter_meta?.model || "?")}${a.degraded?.length ? ` · degraded: ${esc(a.degraded.join("; "))}` : ""}</span></div>
    <span class="muted">Ran ${esc(a.ran_at)}. Classified ${esc(nice(a.classification.meeting_type))}${a.classification.meeting_role ? " / " + esc(nice(a.classification.meeting_role)) : ""}${a.classification.role_for_writing === null ? " (role too unsure to coach on)" : ""}; stored as ${esc(nice(a.stored_type) || "nothing")}${a.stored_role ? " / " + esc(nice(a.stored_role)) : ""}.${a.listening ? ` Listening (${esc(a.listening_reason || "")}).` : ""}${a.speaker_labels ? ` One speaker label (${esc(a.single_label_side || "")} side${a.far_side_only ? ", far side only" : ""}).` : ""}</span></div>`;
  }
  const byModel = {};
  for (const s of a.trace) { const k = s.model; byModel[k] = byModel[k] || { calls: 0, seconds: 0, cost: 0, in: 0, out: 0 }; const v = byModel[k]; v.calls++; v.seconds += s.seconds; v.cost += s.cost; v.in += s.in || 0; v.out += s.out || 0; }
  const name = k => ({ "jev": "Jev", "zai-org/GLM-5.3-Flash": "GLM-5.3-Flash", "claude-sonnet-5-5": "Sonnet 5.5" })[k] || k;
  const money = v => v < 0.01 ? `$${v.toFixed(4)}` : `$${v.toFixed(3)}`;
  const parts = Object.entries(byModel).sort((x, y) => y[1].cost - x[1].cost).map(([k, v]) => `<span><b>${esc(name(k))}</b> ${v.calls} call${v.calls === 1 ? "" : "s"} · ${money(v.cost)}</span>`).join("");
  const fb = a.chapter_meta.fallback_reason ? `<span class="warn">Chapters fell back to Sonnet: ${esc(a.chapter_meta.fallback_reason)}</span>` : "";
  return `<div class="section cost">
    <div class="costline"><span class="big">${money(a.totals.cost)}</span><span class="muted">for this analysis · ${a.totals.seconds} s · ${a.trace.length} calls</span><span class="spacer"></span>${parts}</div>
    ${fb}
    <details><summary>Every call</summary><div class="trace"><table><tr><td>step</td><td>model</td><td>in</td><td>out</td><td>time</td><td>cost</td></tr>${a.trace.map(s => `<tr><td>${esc(s.step)}</td><td>${esc(name(s.model))}</td><td>${s.in}</td><td>${s.out}</td><td>${s.seconds}s</td><td>${money(s.cost)}</td></tr>`).join("")}</table>
    <span>Ran ${esc(a.ran_at)}. Classified ${esc(nice(a.classification.meeting_type))}${a.classification.meeting_role ? " / " + esc(nice(a.classification.meeting_role)) : ""}; stored as ${esc(nice(a.stored_type) || "nothing")}${a.stored_role ? " / " + esc(nice(a.stored_role)) : ""}. Prices: Jev $0.042/M in, GLM-5.3-Flash $0.15/M in and $0.50/M out, Sonnet 5.5 $2/M in and $10/M out.</span></div></details>
  </div>`;
}

// ---------------------------------------------------------------- behaviour wired after render
document.addEventListener("click", e => {
  const t = e.target;
  if (t.closest("#tcard") && !t.closest("#copytr")) { state.transcriptOpen = !state.transcriptOpen; render(); }
  if (t.id === "copytr") navigator.clipboard.writeText(state.analysis.transcript_text || state.analysis.turns.map(x => `${speakerName(state.analysis, x)}: ${x.text}`).join("\n")).then(() => t.textContent = "Copied");
  const pgo = t.closest("[data-pgo]"); if (pgo) { const i = +pgo.dataset.pgo; state.practiceOpen = state.practiceOpen === i ? null : i; render(); return; }
  const pcopy = t.closest("[data-pcopy]"); if (pcopy) { const s = state.analysis.practice[+pcopy.dataset.pcopy]; navigator.clipboard.writeText(`${s.title}\n\n${s.description}\n\nRole-play with: ${s.character_role} · ${s.character_trait}\nThey open with: ${s.opening_line}\n\nBrief: ${s.brief}\n\nJudged on:\n- ${(s.criteria || []).join("\n- ")}`).then(() => pcopy.textContent = "Copied"); return; }
  if (t.id === "pregen" && !state.practiceBusy) { state.practiceBusy = true; render(); fetch(`/api/practice/${state.current.id}`, { method: "POST" }).then(r => r.json()).then(j => { if (j.practice) state.analysis.practice = j.practice; }).finally(() => { state.practiceBusy = false; state.practiceOpen = null; render(); }); return; }
  if (t.id === "copynotes") navigator.clipboard.writeText(state.analysis.summary).then(() => t.textContent = "Copied");
  if (t.closest("#ncard") && !t.closest("#copynotes")) { state.notesOpen = !state.notesOpen; render(); }
  const turn = t.closest(".turn"); if (turn && turn.dataset.t != null) { seek(+turn.dataset.t); }
  const bar = t.closest(".bars .b"); if (bar) jumpTo(+bar.dataset.t);
});
function seek(t) { if (state.hasAudio) { audio.currentTime = t; if (audio.paused) audio.play(); } updateTime(t); }
function jumpTo(t) {
  if (state.hasAudio) seek(t);
  if (!state.transcriptOpen) { state.transcriptOpen = true; render(); }
  const a = state.analysis; const turn = [...a.turns].reverse().find(x => x.start <= t + 0.01) || a.turns[0];
  const el = document.getElementById(`turn-${turn.id}`);
  if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); document.querySelectorAll(".turn.mark").forEach(x => x.classList.remove("mark")); el.classList.add("mark"); }
}
function updateTime(t) {
  const total = state.analysis?.duration || 1;
  const now = $("#now"), fill = $("#fill"); if (!now) return;
  now.textContent = mmss(t); fill.style.width = `${Math.min(100, 100 * t / total)}%`;
  // like the Mac app: the current line is marked only while playing, by its own start and end
  const a = state.analysis; const turn = audio.paused ? null : a.turns.find(x => x.start <= t && t < x.end && x.end > x.start);
  document.querySelectorAll(".turn.now").forEach(x => x.classList.remove("now"));
  if (turn && state.transcriptOpen) document.getElementById(`turn-${turn.id}`)?.classList.add("now");
}
audio.addEventListener("timeupdate", () => updateTime(audio.currentTime));
audio.addEventListener("play", () => { const b = $("#play"); if (b) b.innerHTML = ICONS.pause; });
audio.addEventListener("pause", () => { const b = $("#play"); if (b) b.innerHTML = ICONS.play; });

// ---------------------------------------------------------------- case interview cards
// Case flow, Issue tree and Hypothesis tracking, as ChapterVisuals.swift draws them. Each is a coaching
// point with its own visual; the label "Case flow · Clarify · ..." gives a tag pill and a subtitle.
Object.assign(TAG_CLASS, { "case interviews": "think", "case strong": "ok", "case weak": "warn", "case real": "think" });
const isVisualFirst = p =>["framework", "ledger", "issue_tree", "hypothesis"].includes(p.kind);
const isCasePoint = (c, p) => p.kind === "issue_tree" || p.kind === "hypothesis" || (p.kind === "framework" && c.framework?.scheme === "case");
function caseMeta(c, p) {
  const label = p.label || "", cut = label.indexOf(" · ");
  if (!isCasePoint(c, p) || cut < 0) return null;
  return `<span class="casetag">${esc(label.slice(0, cut))}</span><span class="casesub">${esc(label.slice(cut + 3))}</span>`;
}
// Only the visuals this page knows; a case point without its block renders as a plain point.
function caseVisual(c, p) {
  if (p.kind === "framework" && c.framework?.scheme === "case") return caseFlowVisual(c.framework);
  if (p.kind === "issue_tree") return c.issue_tree ? issueTreeVisual(c.issue_tree) : "";
  if (p.kind === "hypothesis") return c.hypothesis ? hypothesisVisual(c.hypothesis) : "";
  if (p.kind === "framework" && c.framework && !["star", "ppf"].includes(c.framework.scheme)) return "";
  return null;
}
const CASE_STATUS = { clear: "Clear", partial: "Partial", missing: "Missing", folded: "Folded in", not_asked: "Not asked", dropped: "Dropped" };
const caseSt = s => `<span class="st ${esc(s)}">${esc(CASE_STATUS[s] || nice(s))}</span>`;
const caseMinutes = s => s < 60 ? `${Math.max(1, Math.round(s))} s` : `${Math.round(s / 60)} min`;
// fill, text and border for a state: clear green tint, partial amber tint, missing dashed red, not asked grey dashed
const caseState = s => ["clear", "partial", "not_asked"].includes(s) ? s : "missing";
const CASE_NAMES = {
  types: { profitability: "Profitability", market_entry: "Market entry", pricing: "Pricing", m_and_a: "M&A", operations: "Operations", growth: "Growth", market_sizing: "Market sizing", private_equity: "Private equity", public_sector: "Public sector", new_product: "New product", product_sense: "Product sense" },
  industries: { restaurants_food: "Restaurants", consumer_retail: "Retail", cpg: "Consumer goods", healthcare: "Healthcare", financial_services: "Financial services", software_tech: "Software", telecom_media: "Telecom and media", transport_logistics: "Transport", industrial_manufacturing: "Manufacturing", energy_utilities: "Energy", hospitality_leisure: "Hospitality", public_nonprofit_education: "Public sector" },
  formats: { interviewer_led: "Interviewer-led", candidate_led: "Candidate-led", mixed: "Mixed lead" },
};
// "Profitability case · Restaurants · Candidate-led"
const caseTags = fw => [CASE_NAMES.types[fw.case_type] && `${CASE_NAMES.types[fw.case_type]} case`, CASE_NAMES.industries[fw.industry], CASE_NAMES.formats[fw.format]].filter(Boolean).join(" · ");

const CASE_ORDER = ["Clarify", "Structure", "Analyze", "Math", "Recommend"];
function caseFlowVisual(fw) {
  // the five stages in case order; a stage the document lacks shows as missing
  const steps = CASE_ORDER.map(key => fw.parts.find(p => (p.key || "").toLowerCase() === key.toLowerCase()) || { key, name: key, seconds: 0, share: 0, status: "missing" });
  // the bar's order: by when each stage first happened; one that never happened sits after the stage before it
  let last = 0; const rank = new Map();
  for (const p of steps) { if (p.order != null) { last = p.order; rank.set(p, last); } else { last += 0.01; rank.set(p, last); } }
  const bar = steps.slice().sort((a, b) => rank.get(a) - rank.get(b));
  const secs = p => p.elapsed ?? p.seconds ?? 0;
  const fixed = p => p.status === "missing" || p.status === "not_asked" || secs(p) <= 0;
  const total = fw.case_start != null && fw.case_end != null && fw.case_end > fw.case_start ? fw.case_end - fw.case_start : steps.reduce((n, p) => n + secs(p), 0);
  const blocks = bar.map(p => {
    const f = fixed(p), seek = p.at != null && !f;
    // a block with no time names its stage; a narrow timed block shows only its time (the container query in styles.css)
    return `<span class="cblock ${caseState(p.status)} ${f ? "fixed" : ""}" style="${f ? "" : `flex:${Math.max(1, secs(p))} 1 0`}" ${seek ? `data-at="${p.at}"` : ""} title="${esc(p.name || p.key)}: ${esc(CASE_STATUS[p.status] || p.status)}">
      <span class="nm">${esc(p.name || p.key)}</span><span class="tm">${p.status === "not_asked" ? "Not asked" : f ? "Missing" : caseMinutes(secs(p))}</span></span>`;
  }).join("");
  // ticks every 1, 2 or 5 minutes depending on the case's length, the total in bold
  const length = Math.max(1, total), step = length > 1200 ? 300 : length > 480 ? 120 : 60;
  let ticks = "";
  for (let t = 0; t < length - step * 0.4; t += step) ticks += `<span style="left:min(calc(100% - 30px), ${100 * t / length}%)">${mmss(t)}</span>`;
  ticks += `<span class="end">${mmss(length)}</span>`;
  const legend = steps.map(p => `<div class="pl"><span class="n">${esc(p.name || p.key)}</span>${caseSt(p.status)}<span class="g">${esc(p.snippet || "")}</span></div>`).join("");
  const tags = caseTags(fw);
  return `<div class="fw caseflow"><div class="cbar">${blocks}</div><div class="caxis">${ticks}</div><div class="plgrid c5">${legend}</div><div class="crule"></div><div class="cfoot">${fw.note ? `<span class="fwnote">${esc(fw.note)}</span>` : ""}${tags ? `<span class="fwnote">${esc(tags)}</span>` : ""}</div></div>`;
}
function issueTreeVisual(tree) {
  const leaf = k => `<div class="leaf"><span class="cbox ${caseState(k.status)}"><span class="l">${esc(k.label)}</span>${caseSt(k.status)}</span></div>`;
  const node = n => {
    const kids = n.children || [];
    const box = `<span class="cbox node ${caseState(n.status)}" ${n.at != null ? `data-at="${n.at}"` : ""}><b>${esc(n.label)}</b>${n.note ? `<span class="nt">${esc(n.note)}</span>` : ""}</span>`;
    return `<div class="nrow">${box}${kids.length ? `<span class="hl"></span><div class="leaves">${kids.map(leaf).join("")}</div>` : ""}</div>`;
  };
  const a = tree.answer;
  let answer = "";
  if (a) {
    const text = /\.$/.test(a.text) ? a.text : a.text + ".";
    const where = a.branch ? ` It sat under <b>${esc(a.branch)}</b>${a.opened === false ? ", the branch you didn’t open." : ", a branch you explored."}` : "";
    answer = `<div class="answer" ${a.at != null ? `data-at="${a.at}"` : ""}><span class="eyebrow">The answer</span><span>${esc(text)}${where}</span></div>`;
  }
  return `<div class="fw itree"><div class="tree"><div class="root"><b>${esc(tree.root)}</b><span>Your question</span></div><span class="hl"></span><div class="nodes">${(tree.nodes || []).map(node).join("")}</div></div>${answer}<div class="crule"></div>${tree.note ? `<span class="fwnote">${esc(tree.note)}</span>` : ""}</div>`;
}
function hypothesisVisual(track) {
  const MARK = { clear: "✓", partial: "!", not_asked: "–" };
  const steps = (track.steps || []).map(s => `<div class="hstep" ${s.at != null ? `data-at="${s.at}"` : ""}><span class="hmark ${caseState(s.status)}">${MARK[s.status] || "×"}</span><b>${esc(s.name || s.key)}</b><span class="t">${s.at != null ? mmss(s.at) : "&nbsp;"}</span><span class="hn ${caseState(s.status)}">${esc(s.note || "")}</span></div>`).join("");
  const boxes = (track.boxes || []).map(b => `<div class="hbox ${b.tone === "good" ? "good" : "warn"}"><b>${esc(b.title)}</b><span>${esc(b.text)}</span></div>`).join("");
  return `<div class="fw htrack"><div class="hsteps">${steps}</div>${boxes ? `<div class="hboxes">${boxes}</div>` : ""}<div class="crule"></div>${track.note ? `<span class="fwnote">${esc(track.note)}</span>` : ""}</div>`;
}

// ---------------------------------------------------------------- boot
(async () => {
  await loadMeetings();
  // #<id>, or #<id>&ch=<n> to open chapter n (0-based, as in the document) on load
  const [id, ...params] = location.hash.slice(1).split("&");
  if (id && state.meetings.some(m => m.id === id)) {
    await select(id);
    const ch = new URLSearchParams(params.join("&")).get("ch");
    if (ch != null && state.analysis?.chapters.some(c => c.n === +ch)) { state.open = +ch; render(); location.hash = `${id}&ch=${ch}`; }
  }
})();
