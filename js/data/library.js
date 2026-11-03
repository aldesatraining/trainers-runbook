// Program-wide quick-access library, shown in the Toolbox drawer. Everything here comes from the source outline.
// Passwords are deliberately not stored: the outline points to the Training Department Handbook.
import { LINKS } from "./helpers.js";

export const CREDENTIAL_NOTE =
  "Only the Cove Portal training test login is stored here. Other passwords and default app credentials are in the Training Department Handbook. Don’t host this app anywhere public while it holds a password.";

// Systems trainers log into. `accounts` are the training/test accounts named in the outline.
export const logins = [
  { id: "pando", label: "Pando", url: LINKS.pando, note: "Primary customer account platform",
    accounts: [["362002", "Joe Smith (Security)"], ["108923", "Francis Test (Security)"], ["100103", "Karlo Pelayo (Security)"], ["167312", "Adam Training (Security)"]] },
  { id: "kb", label: "Knowledge Base", url: LINKS.kb, note: "Customer-facing and employee articles", accounts: [] },
  { id: "securenet", label: "Securenet", url: LINKS.securenet, note: "Dealer site for Simple systems (search by SNet ID or Interactive ID)",
    accounts: [["111036", "Andrea Turner"], ["346362", "Policies practice"], ["123785", "Policies practice"]] },
  { id: "smartadmin", label: "Smart Admin (Securenet dealer dashboard)", url: LINKS.smartAdmin, note: "Support site for Tech Support days", accounts: [] },
  { id: "alula", label: "Alula Dealer Portal", url: LINKS.alula, note: "Dealer site for Connect systems (search by MAC ID)",
    accounts: [["54216026E148", "C100103"], ["54216026E134", "Aldesaflex"], ["542160188F00", "Cebu.training"], ["54:21:60:27:E8:DC", "Policies practice panel"]] },
  { id: "alulaconnect", label: "Alula Connect", url: LINKS.alulaConnect, note: "Alula Connect login", accounts: [] },
  { id: "cops", label: "COPS Monitoring", url: LINKS.cops, note: "Alarm activity and event history (search by CS-ID)",
    accounts: [["TXC-4403", ""], ["CCA-004805", ""], ["CTX-006170", "Policies practice"], ["MDC-0502", "Policies practice"]] },
  { id: "orders", label: "Order Tracker", url: LINKS.orderTracker, note: "Log every order here", accounts: [] },
  { id: "portal", label: "Cove Portal", url: LINKS.portal, note: "Customer self-service portal",
    accounts: [["john.lucino@alder.com", "Test account user"], ["Jalder1234L", "Test account password"]] },
  { id: "nexus", label: "Nexus · Academy cohorts", url: LINKS.nexus, note: "Under testing. Will replace the Scorecard Tracker for adding new hires", accounts: [] },
  { id: "360", label: "360Learning", url: LINKS.threeSixty, note: "Trainee courses; path for Customer Service Policies", accounts: [] },
];

export const loginByUrl = new Map(logins.map((l) => [l.url, l]));

// Presentations and training material. url:null = the source outline has no link yet.
export const presentations = [
  { label: "Welcome to Training", url: LINKS.welcomeTraining, for: "Day 1" },
  { label: "360 Learning Learner’s Guide (PowerPoint)", url: LINKS.threeSixtyGuide, for: "Day 1" },
  { label: "Introduction to Cove (New)", url: null, for: "Day 1" },
  { label: "Alarm Signal Pathway Introduction", url: null, for: "Day 1" },
  { label: "Knowledge Base Navigation (Genially)", url: LINKS.kbNavigation, for: "Day 1" },
  { label: "4E’s Logistician", url: null, for: "Call Flow" },
  { label: "Cove Call Flow", url: null, for: "Call Flow" },
  { label: "Soft Skills · Personality Types · Mirroring · De-escalation", url: null, for: "Call Flow" },
  { label: "Crusade of Stars", url: null, for: "Call Flow" },
  { label: "T&C slides", url: null, for: "Policies" },
  { label: "Panels (Canva folder)", url: LINKS.panelsFolder, for: "Panels" },
  { label: "Tools – Dealer Portal", url: LINKS.dealerPortalPres, for: "Dealer Sites · Panels" },
  { label: "Tools – Securenet", url: LINKS.securenetPres, for: "Dealer Sites · Panels" },
  { label: "Sensors", url: null, for: "Sensors" },
  { label: "Apps", url: null, for: "Apps" },
  { label: "New Cove Cameras (Canva folder)", url: LINKS.newCamerasFolder, for: "Cameras" },
  { label: "Cove Cameras (Canva folder)", url: LINKS.camerasFolder, for: "Cameras" },
  { label: "VICI", url: LINKS.vici, for: "Pre-Nesting" },
  { label: "Workforce Management", url: LINKS.workforce, for: "Post-Nesting" },
];

export const documents = [
  { label: "Employee Information Form", url: LINKS.employeeForm, note: "Send with the Welcome Email" },
  { label: "Welcome Email (SharePoint)", url: LINKS.welcomeEmail, note: "Training Essentials (Onboarding)" },
  { label: "Cove Inbound Scorecard Tracker (current)", url: null, note: "Add new hire names here (moving to Nexus; link not in the source outline)" },
  { label: "Trainee attendance tracker", url: null, note: "Update every day" },
  { label: "HR endorsement email", url: null, note: "Headcount, names, work emails, phone numbers and other details. Check before training starts" },
  { label: "Training timeline", url: null, note: "Roadmap: still to be added in the source outline" },
  { label: "Updated PST / Nesting KPIs", url: null, note: "Still to be added in the source outline" },
  { label: "Training Department Handbook", url: null, note: "App credentials, Wi-Fi password, tablet test accounts" },
  { label: "Mock call scenarios and rubric", url: null, note: "Pending project in the source outline" },
];

