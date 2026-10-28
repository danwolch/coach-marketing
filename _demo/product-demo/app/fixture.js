/* Demo meeting for the product video. app.js (copied unchanged from the Mac app's meeting-page
   prototype, coach-macapp/scripts/poc/meeting-page) fetches /api/meetings and /api/analysis/<id>;
   this answers both from the document below so the page renders exactly as the prototype draws it. */
(function () {
  const ID = "demo-larkspur";
  const meeting = {
    id: ID, title: "Final Round Interview: Larkspur", created_at: "2026-10-28T10:00:00", duration: 1720,
    meeting_type: "interview", origin: "local", user: "", has_audio: false, analyzed: true, readonly: true,
  };
  const analysis = {
    title: "Final Round Interview: Larkspur",
    duration: 1720,
    attendees: ["Priya Natarajan", "Marcus Lee"],
    classification: { meeting_type: "interview", meeting_role: "candidate" },
    chapters: [
      { n: 0, title: "Introductions and the role", label: "Intro", start: 0, end: 150, verdict: "quiet", kind: "small_talk", gist: "Priya walked through the team and what the role owns.", notes: [{ text: "Team of six, reporting to the Head of Product" }] },
      { n: 1, title: "A project with a tight deadline", label: "Tight deadline story", start: 150, end: 560, verdict: "went_well", kind: "behavioral",
        points: [{ kind: "judgment", verdict: "went_well", label: "Story", at: 168, headline: "Your launch story had a real result.", quote: "We shipped in five weeks and cut onboarding drop-off by 18%.", body: "You set up the stakes in one sentence, said what you did rather than what the team did, and ended on a number.", try: "Open the next story the same way: the stakes, your call, the number." }] },
      { n: 2, title: "Meal kit case", label: "Meal kit case", start: 560, end: 990, verdict: "could_improve", kind: "case",
        points: [{ kind: "judgment", verdict: "could_improve", label: "Structure", at: 602, headline: "Lay out your structure before you dive in.", quote: "How would you grow repeat orders for a meal kit company?", body: "You went straight to discounts. Priya had to ask twice what else you would look at before you named retention and delivery windows.", try: "Say the three branches out loud first: 'I'd look at who churns, why, and what brings them back.'" }] },
      { n: 3, title: "The team and how they work", label: "The team", start: 990, end: 1170, verdict: "quiet", kind: "discussion", gist: "Priya described how the growth team plans and ships.", notes: [{ text: "Planning runs in six-week cycles" }] },
      { n: 4, title: "Current pay and the salary band", label: "Salary", start: 1170, end: 1290, verdict: "could_improve", kind: "compensation",
        points: [{ kind: "judgment", verdict: "could_improve", label: "Your number", at: 1196, headline: "Don’t share your current salary.", quote: "What are you making today?", body: "When asked what you make today, you said ‘about 165 base.’ That number now anchors your offer in the lower part of their $155,000 to $185,000 band.", try: "Ask for their range first: ‘I’d prefer not to share my current salary. Can you share the salary band for this role?’" }],
        notes: [{ text: "Band for the role is $155,000 to $185,000" }, { text: "Equity refreshes yearly" }] },
      { n: 5, title: "Your questions for Priya", label: "Your questions", start: 1290, end: 1610, verdict: "went_well", kind: "candidate_questions",
        points: [{ kind: "judgment", verdict: "went_well", label: "Questions", at: 1290, headline: "Your questions showed you’d done the work.", quote: "What would make someone great in this role at six months?", body: "You asked about the team’s roadmap and what success looks like, which told Priya you were already thinking about the job.", try: "Keep one question that shows you read their latest launch." }] },
      { n: 6, title: "Wrap-up and next steps", label: "Wrap-up", start: 1610, end: 1720, verdict: "quiet", kind: "logistics", gist: "Priya will share feedback by Friday.", notes: [] },
    ],
    practice: [
      { title: "Hold your number back", description: "Priya asks what you make today. Turn it into their band without sounding cagey.", character_role: "Recruiter", character_trait: "Friendly but direct", opening_line: "Before we wrap up, what are you making today?", brief: "", criteria: [] },
      { title: "Structure the case out loud", description: "Lay out three branches before you go deep on any of them.", character_role: "Interviewer", character_trait: "Pushes for structure", opening_line: "How would you grow repeat orders?", brief: "", criteria: [] },
    ],
    summary: "## Role\n- Senior PM, growth team\n## Next steps\n- Priya to share feedback by Friday",
    turns: [
      { id: 1, speaker: "Them", label: "Priya Natarajan", start: 1191, end: 1195, text: "What are you making today?" },
      { id: 2, speaker: "Me", start: 1196, end: 1199, text: "Um, about 165 base." },
    ],
    speaker_names: {},
    totals: { cost: 0, seconds: 0 },
    ran_at: "",
  };
  const json = body => Promise.resolve(new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }));
  window.fetch = url => {
    if (String(url).startsWith("/api/meetings")) return json({ meetings: [meeting], doc_tags: [], cloud: false });
    if (String(url).startsWith(`/api/analysis/${ID}`)) return json(analysis);
    return Promise.resolve(new Response("{}", { status: 404 }));
  };
  if (!location.hash) location.hash = `${ID}&ch=2`;
})();
