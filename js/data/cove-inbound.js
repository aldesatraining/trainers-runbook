import { day1, day2 } from "./days-1-2.js";
import { day3, day4, day5 } from "./days-3-5.js";
import { day6, day7, day8, day9, day10 } from "./days-6-10.js";
import { LINKS, res, resTbd, block, brk, lunch, checklist } from "./helpers.js";

// Standing items added to every training day.
const ATTENDANCE_TEXT = "Update the trainee attendance tracker";
const DAILY = {
  prep: ["Open the trainee attendance tracker and keep it updated through the day"],
  resources: [resTbd("Trainee attendance tracker", "spreadsheet")],
};

// ---------------------------------------------------------------------------------------------
// Schedule. The source outline is organised by topic and has no day/time split, so everything in
// this file is a proposed plan: which topics land on which of the 13 days, and how long each takes.
//   Day = 7.5 working hours (450 min) + two 15-min breaks + 1-hour lunch, 10:00-19:00 PHT, Mon-Fri.
// Topic content itself (js/data/days-*.js) is untouched source material.
// ---------------------------------------------------------------------------------------------
const DAY_MINUTES = 450;
const START = "10:00";

const pool = new Map();
[day1, day2, day3, day4, day5, day6, day7, day8, day9, day10].forEach((d) =>
  d.blocks.forEach((b) => { if (b.type !== "break" && b.type !== "lunch") pool.set(b.id, b); })
);

// Planned minutes per topic (estimates; the outline gives durations for only some topics and none for the whole of Customer Service Policies).
const MIN = {
  "d1-intro": 60, "d1-expect": 30, "d1-roadmap": 20, "d1-kpi": 30, "d1-login": 60, "d1-form": 20, "d1-360": 60,
  "d1-aldesa-360": 20, "d1-aldesa-hist": 15, "d1-cove-begin": 40, "d2-tools-360": 30, "d2-kb": 20, "d2-pando": 20,
  "d2-dealer": 30, "d2-cops": 20, "d2-callflow-360": 45, "d2-4es": 45, "d2-callflow": 60, "d2-soft": 60, "d2-crusade": 30,
  "d3-services": 105, "d3-pando": 45, "d3-updown": 90, "d3-orders": 150, "d3-return": 120,
  "d4-billing": 180, "d4-moving": 90, "d4-transfer": 75, "d4-cancel": 90, "d4-react": 60,
  "d5-edit": 105, "d5-notes": 75, "d5-tc": 60, "d5-mir": 75,
  "d6-intro": 15, "d6-types": 60, "d6-install": 120, "d6-usage": 90,
  "d7-sensors-intro": 60, "d7-sensors-prog": 120, "d7-upgrade": 60,
  "d8-ts-panel": 120, "d8-ts-sensor": 120, "d8-apps": 150,
  "d9-cam-intro": 60, "d9-cam-pair": 90, "d9-cam-ts": 60, "d9-consultant": 150,
  "d10-vici": 120, "d10-wfm": 60,
};

const FLEX_NOTE = "Open, flexible practice time. Scenarios and rubrics are not in the source outline yet (listed there as “for the future” / a pending mock-call project).";
const flex = (id, title, summary = FLEX_NOTE) => block(id, { title, type: "activity", flex: true, summary });

const reminder = (...r) => r;
const days = [
  {
    theme: "Welcome to Training · Aldesa · Tools begin",
    blocks: ["d1-intro", "d1-expect", "d1-roadmap", "d1-kpi", "d1-login", "d1-form", "d1-360", "d1-aldesa-360", "d1-aldesa-hist", "d1-cove-begin", "d2-tools-360", "d2-kb", "d2-pando", flex("f1", "Recap, Q&A and catch-up", "Recap the day, answer questions, and catch up on any logins or forms still outstanding.")],
    resources: [res("Nexus · Academy cohorts (under testing)", "external", LINKS.nexus), resTbd("Cove Inbound Scorecard Tracker (current)", "spreadsheet")],
    prep: [
      "Check your email for the HR endorsement: it lists the number of new hires, their names, work emails, phone numbers and other details",
      "Add every new hire’s name to the Cove Inbound Scorecard Tracker (current). Adding cohorts in Nexus is under testing and will replace the tracker",
      "Coordinate with available IT personnel so trainee logins can be tested in real time",
      "Send the Employee Information Form alongside the Welcome Email",
      "Open the “Welcome to Training” presentation",
      "Presentations for Aldesa: Introduction to Cove (New) and Alarm Signal Pathway Introduction",
      "Verify the tool links open (KB, Pando, Securenet, Alula, COPS, Order Tracker) and the Pando test accounts load",
    ],
    reminders: reminder(
      "Start exactly on time and keep your own phone tucked away. You are modelling the EOP rule.",
      "Login testing must be finished within 30 min to 1 hour. Escalate unresolved logins to IT in real time.",
      "Tools Overview is a run-through only. Keep information surface level; processes come later in Customer Service Policies and Tech Support."
    ),
    close: ["Confirm every trainee’s tool logins work. Note any still unresolved", "Confirm Employee Information Forms are submitted", "Confirm trainees can open the 360Learning courses"],
  },
  {
    theme: "Tools wrap-up · Cove Call Flow",
    blocks: ["d2-dealer", "d2-cops", "f2a", "d2-callflow-360", "d2-4es", "d2-callflow", "d2-soft", "d2-crusade", flex("f2b", "Mock calls: call flow & soft skills")],
    extra: { f2a: flex("f2a", "Account lookup practice", "Trainees pull up accounts in Pando, Securenet, Alula and COPS with the test accounts.") },
    prep: [
      "Verify Securenet (111036), Alula Dealer Portal and COPS (TXC-4403, CCA-004805) test accounts load",
      "Open presentations: 4E’s Logistician, Cove Call Flow, Soft Skills, Personality Types, Mirroring, De-escalation, Crusade of Stars",
    ],
    reminders: reminder(
      "Dealer Sites: avoid discussing processes; focus on what information is on specific tabs.",
      "360Learning limits: Call Flow 30–45 minutes max."
    ),
    close: ["Note which trainees struggled to pull up accounts and revisit tomorrow", "Confirm trainees completed the Call Flow 360Learning course"],
  },
  {
    theme: "Customer Service Policies · Services and plans, plan changes, orders",
    blocks: ["d3-services", "d3-pando", "d3-updown", "d3-orders", flex("f3", "Mock calls: plans, plan changes and orders")],
    prep: [
      "Pando test accounts 100103 (Karlo Pelayo) and 167312 (Adam Training) load",
      "Alula test panel 54:21:60:27:E8:DC and Securenet 346362 / 123785 load; COPS CTX-006170 / MDC-0502 load",
      "Order Tracker opens",
      "360 Learning path for Customer Service Policies opens",
    ],
    reminders: reminder(
      "Signal Pathway in Services and Plans: keep it simple, no troubleshooting depth yet.",
      "Orders: do not demonstrate order creation until after the tour and policy review.",
      "Don’t forget the ETA when creating orders; Cove credit never covers shipping fees.",
      "Upgrade/downgrade assumes trainees already know the plan benefits."
    ),
    close: ["Confirm trainees can find the plan and Cove credit balance in Pando", "Note anyone who could not complete an upgrade/downgrade or order with minimal help"],
  },
  {
    theme: "Customer Service Policies · Returns, billing, moving",
    blocks: ["d3-return", flex("f4", "Mock calls: returns"), "d4-moving", "d4-billing"],
    prep: [
      "Test accounts ready for trainees to practice editing payment profiles",
      "Pando, Alula and COPS test accounts from the Policies preparation list still load",
    ],
    reminders: reminder(
      "Never repeat a full credit card number back to the customer; agents save only the last 4 digits.",
      "Cover the credit authorization limits explicitly.",
      "Moving: spend extra time on “cancel due to move” and pivot to a moving solution before accepting the cancellation."
    ),
    close: ["Confirm trainees can process a credit and a refund in a test account", "Source note pending: list the security policies to highlight in Billing"],
  },
  {
    theme: "Customer Service Policies · Transfers, cancellations, account edits",
    blocks: ["d4-transfer", "d4-cancel", "d4-react", "d5-edit", flex("f5", "Mock calls: transfers, cancellations, reactivations")],
    prep: ["Pando test accounts from the Policies list load", "Review the Cancellation and Reactivation procedures"],
    reminders: reminder(
      "Cancellation: offer help, do not aggressively retain.",
      "Editing Account Information: tour Pando left to right and discuss the editing rules on every card."
    ),
    close: ["Confirm trainees can add a verbal RTC to account notes and check balance before reactivation"],
  },
  {
    theme: "Customer Service Policies · Notes, T&C, Make It Right · review",
    blocks: ["d5-notes", "d5-tc", "d5-mir", flex("f6a", "Customer Service Policies: knowledge check", "End-of-session knowledge check for the policies module (listed in the module objectives; the question set is not in the source outline yet)."), flex("f6b", "Mock calls: full policy scenarios")],
    prep: [
      "Open the T&C presentation slides",
      "Prepare the three Make It Right scenarios to present one at a time without revealing the ideal action",
    ],
    reminders: reminder(
      "Make It Right: ask what trainees would do before revealing the ideal action.",
      "Customer Service Policies finish today. Record who needs more practice before Technical Support."
    ),
    close: ["Record knowledge check results and anyone who needs reteaching", "Tomorrow starts Technical Support: confirm panel equipment is ready"],
  },
  {
    theme: "Technical Support · Panels · Sensors intro",
    blocks: ["d6-intro", "d6-types", "d6-install", "d6-usage", "d7-sensors-intro", flex("f7", "Equipment hands-on practice")],
    prep: [
      "Prepare in-office equipment: Cove Simple, Cove Connect+ touchpads and the Puck, with accessories (transformer, external sirens, etc.)",
      "Program a door sensor, window sensor, motion detection and key fob on each panel",
      "Prepare sensors: program at least one of each type, install if possible, have at least two of each type",
      "Open presentations: Panels (Canva), Tools – Dealer Portal, Tools – Securenet, Sensors",
      "Verify support site logins: Pando, SecureNet (Smart Admin), Alula Connect",
      "Have each panel type ready to be set up as if new",
    ],
    reminders: reminder(
      "Trainees must get hands-on time on each panel. In Basic Usage have each trainee execute a step.",
      "Night mode has no exit or entry delays; remote arming has no Auto-stay."
    ),
    close: ["Confirm every trainee executed at least one panel step", "Disconnect all sensors from the panel before tomorrow’s programming activity"],
  },
  {
    theme: "Technical Support · Sensor install · Connect upgrade · Panel troubleshooting",
    blocks: ["d7-sensors-prog", "d7-upgrade", "d8-ts-panel", flex("f8", "Mock calls: panel and upgrade scenarios")],
    prep: [
      "All sensors disconnected from the panel and installation guides available",
      "Prepare Luna Simple troubleshooting scenarios (communication failure, panel swap/registration, power failure, tamper)",
    ],
    reminders: reminder(
      "Connect upgrade: tell the customer it is permanent and they cannot return to the Simple Panel BEFORE running the checklist.",
      "TXIDs are 7 digits; pad with leading zeros.",
      "Encourage trainees to use the KB and test accounts."
    ),
    close: ["Confirm each trainee demonstrated their assigned sensors", "Prepare training tablets and test accounts for tomorrow’s Apps topic"],
  },
  {
    theme: "Technical Support · Sensor troubleshooting · Apps",
    blocks: ["d8-ts-sensor", flex("f9a", "Mock calls: sensor troubleshooting"), "d8-apps", flex("f9b", "Mock calls: app troubleshooting")],
    prep: [
      "Training tablets ready (Samsung tab and iPad); test accounts from the Training Department Handbook",
      "COPS navigation access works for sensor troubleshooting",
      "Open the Apps presentation",
    ],
    reminders: reminder(
      "Apps: 3 min per trainee for self discovery; at least 5 min per trainee for each password reset method.",
      "Use test accounts whenever possible."
    ),
    close: ["Confirm each trainee performed every password reset method"],
  },
  {
    theme: "Technical Support · Cameras · Cove Consultant",
    blocks: ["d9-cam-intro", "d9-cam-pair", "d9-cam-ts", "d9-consultant", flex("f10", "Mock calls: cameras and sales")],
    prep: [
      "Prepare all cameras for the training. Two of each if available",
      "Samsung tablet and iPad from the managers pedestal; app credentials and Wi-Fi password from the Training Department Handbook",
      "Open presentations: New Cove Cameras, Cove Cameras",
      "Verify the Cove Portal test account (john.lucino@alder.com) signs in; covesmart website, “Build My System” and ID.me load",
    ],
    reminders: reminder(
      "Cameras: trainees pair cameras themselves, then role-play a walkthrough on another trainee or the trainer.",
      "Cove Consultant: shift from account creation to account management before the Portal walkthrough."
    ),
    close: ["Confirm each trainee paired at least one camera", "Confirm trainees completed the sales mock calls", "Prepare VICI presentation and trainee VICI logins for tomorrow"],
  },
  {
    theme: "Pre-Nesting · VICI Dialer · Workforce Management",
    blocks: ["d10-vici", "d10-wfm", flex("f11a", "Mock calls: dialer practice", "Trainees practice inbound, outbound, hold, transfer and hang-up in VICI."), flex("f11b", "Mock calls: end-to-end")],
    prep: ["Open presentations: VICI, Workforce Management", "Verify trainee VICI Dialer logins work"],
    reminders: reminder(
      "Pre-Nesting is the transition to the dialer trainees use daily.",
      "Workforce Management (call-in procedures) is Post-Nesting in the source outline; it is placed here as the last topic.",
      "Source comment: VICI should be a separate course with Workforce."
    ),
    close: ["Confirm every trainee can log in to VICI and transfer, hold, place an outbound call and hang up", "Confirm trainees know call-in channels and the sick/vacation leave processes"],
  },
  {
    theme: "Integrated practice · Gap review",
    blocks: [flex("f12a", "Integrated mock calls", "End-to-end mock calls mixing call flow, policies, tech support and tools."), flex("f12b", "Gap review: reteach weakest topics", "Reteach the topics your notes and checklists flagged as weakest."), flex("f12c", "Open practice")],
    prep: ["Review your notes and skipped blocks from Days 1–11 to choose what to reteach", "Mock call scenarios and rubric (pending in the source outline)"],
    reminders: reminder("Use Close summaries and your block notes from earlier days to decide what needs reteaching."),
    close: ["Record each trainee’s remaining weak areas for the final day"],
  },
  {
    theme: "Readiness review · Transition to nesting",
    blocks: [flex("f13a", "Final mock calls"), flex("f13b", "Readiness review and Q&A", "Final questions, readiness review, and what happens in nesting (see Training Roadmap and Nesting KPI overview)."), flex("f13c", "Training wrap-up and handoff to nesting")],
    prep: ["Nesting KPI overview and nesting schedule ready", "Training handoff notes ready for the nesting team"],
    reminders: reminder("Last day of product-specific training: hand trainees off to nesting."),
    close: ["Complete the training program and hand off trainees to nesting"],
  },
];

// ---------------- build: resolve ids, fill flexible time, insert rests, compute clock times ----------------
const isRest = (b) => b.type === "break" || b.type === "lunch";
const toMin = (hhmm) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const toClock = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

function build(def, i) {
  const id = `d${i + 1}`;
  const content = def.blocks.map((b) => {
    if (typeof b !== "string") return b;
    if (def.extra?.[b]) return def.extra[b];
    const src = pool.get(b);
    if (!src) throw new Error(`Unknown block ${b}`);
    return { ...src, minutes: MIN[b] ?? src.minutes };
  });
  const flexes = content.filter((b) => b.flex);
  const fixed = content.reduce((n, b) => n + (b.flex ? 0 : b.minutes || 0), 0);
  const left = DAY_MINUTES - fixed;
  if (left < 0 || (flexes.length === 0 && left !== 0)) throw new Error(`${id}: fixed minutes ${fixed} do not fit`);
  const share = Math.floor(left / flexes.length / 5) * 5;
  flexes.forEach((b, n) => { b.minutes = n === flexes.length - 1 ? left - share * (flexes.length - 1) : share; });

  // Topics only. Break and lunch placement comes from the outline's break schedule (standard), applied when it is normalised.
  const blocks = content;

  return {
    id,
    title: `Day ${i + 1}`,
    theme: def.theme,
    start: START,
    prep: checklist(`${id}.prep`, [...def.prep, ...DAILY.prep]),
    reminders: def.reminders,
    // Same id as the Run-mode attendance toggle, so ticking either one updates both.
    close: [...checklist(`${id}.close`, def.close), { id: `${id}.attendance`, text: ATTENDANCE_TEXT }],
    attendanceId: `${id}.attendance`,
    attendanceText: ATTENDANCE_TEXT,
    resources: [...(def.resources || []), ...DAILY.resources],
    blocks,
  };
}

export const coveInbound = {
  id: "cove-inbound",
  title: "Cove Inbound",
  version: "1.0",
  // library metadata
  summary: "Product-specific training for new Cove Inbound representatives: onboarding, tools, call flow, customer service policies, technical support, and consultative guidance, through to the dialer and workforce procedures.",
  tags: ["Inbound", "Customer support", "Technical support", "Cove", "New hire"],
  audience: "New hire trainers, Cove Inbound",
  status: "Draft",
  timezone: "PHT",
  tz: "Asia/Manila", // IANA zone used to compare the plan with the real clock, whatever the machine's zone is
  schedule: "13 days · Mon–Fri · 10:00–19:00 PHT · 7.5 h training + 2 × 15 min breaks + 1 h lunch",
  objectives: [
    "Confidently handle inbound customer interactions by applying Cove’s service standards, navigating core systems and tools, and following standard call flows and policies.",
    "Resolve common customer service and technical support concerns, documenting interactions accurately.",
    "Demonstrate readiness to transition successfully into nesting and live operations.",
  ],
  breaks: { mode: "standard" }, // break after 2h of training, lunch after 2h more, second break after 2h more
  overview:
    "A structured roadmap for the Cove Inbound training program, preparing new hires for customer-facing success across the full support journey: onboarding and company orientation, tools, call handling standards, customer service policies, technical support, and consultative guidance, through a mix of discussion, guided practice, hands-on activities, and mock calls.",
  days: days.map(build),
};
