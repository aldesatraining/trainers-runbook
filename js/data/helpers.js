// Content-authoring helpers. Content lives in plain data so a program editor / backend can replace it later.
// Bullet lists: a string is a bullet; an array right after a string is that bullet's children.

export const LINKS = {
  kb: "https://cove.helpjuice.com/",
  pando: "https://cove.pandolink.com/",
  portal: "https://portal.covesmart.com/sign-in/",
  securenet: "https://portal.alder.com/snapi/login#/",
  alula: "https://www.alulaconnect.com/en/auth/login",
  cops: "https://copalink.copsmonitoring.com/login/index.cfm",
  orderTracker: "https://creation-tracker.emergent.host/login",
  kbNavigation: "https://view.genially.com/66b25862bd1d034f8d4d34d5/interactive-content-knowledge-base-navigation",
  employeeForm: "https://forms.office.com/Pages/ResponsePage.aspx?id=BqY9LUxukkm32IbYTfK8jzMXehVXfjhHmPqlneSzxu9URFFYQjdJWlFaUUg0REdXSzhaMFI3SzlKUyQlQCN0PWcu",
  nexus: "https://nexus-alder.northcentralus.cloudapp.azure.com/academy/cohorts",
  welcomeTraining: "https://canva.link/ec8b3xxnkx4dzg2",
  welcomeEmail: "https://alarmprotection.sharepoint.com/sites/aldesatrainingmanagement2/_layouts/15/Doc.aspx?sourcedoc=%7B8afc9b58-b90d-4da0-8b5f-1d7c81d5a725%7D&action=edit&wd=target%28Training%20Essentials%20%28Onboarding%5C%29.one%7Cc5cba9b8-85ff-47e7-9ce7-d21cd9816239%2FWelcome%20Email%7C873eba39-7a1b-4b6c-bd13-34f8f53038fa%2F%29&wdorigin=703&wdpartid=%7B9b024f77-14a2-4154-b056-4c601af103fa%7D%7B132%7D&wdsectionfileid=%7B693294e0-47af-4ff0-8175-4c3320a0b5cf%7D",
  panelsFolder: "https://www.canva.com/folder/FAHDMCnvWMw",
  dealerPortalPres: "https://www.canva.com/design/DAFvyATRdfM/o5_G1twIIDrZyyGF89IDKA/edit",
  securenetPres: "https://www.canva.com/design/DAFtzlXdYBg/1L2-0SxqV8KKteLbWey_cQ/edit",
  smartAdmin: "https://portal.alder.com/snapi/login#/snapi/dealer/c/ajaxcontent/dashboard",
  alulaConnect: "https://alulaconnect.com/en/auth/login",
  newCamerasFolder: "https://www.canva.com/folder/FAF_M83vzyo",
  camerasFolder: "https://www.canva.com/folder/FAFOl2TZkvA",
  vici: "https://www.canva.com/design/DAGNSt2NU3Y/BDKBnjjGM7wT1DY8FfNtFw/edit",
  workforce: "https://www.canva.com/design/DAHHu7xBEdk/gwlalyDOO8TqsVEoX_G2xQ/edit",
  threeSixty: "https://alder-cove.360learning.com/paths/6a1706cc142bc7763b5242ab/edit",
  threeSixtyGuide: "https://alarmprotection.sharepoint.com/:p:/r/sites/CebuTraining-CSRTSR/_layouts/15/Doc.aspx?sourcedoc=%7B68182696-540E-454B-8713-A0869FC6D3FA%7D&file=360%20Learning%20Learner%27s%20Guide.pptx",
};

let _seq = 0;
export const res = (label, kind, url) => ({ label, kind, url: url || null });
// Resource with a link the source outline still has to supply.
export const resTbd = (label, kind = "presentation") => res(label, kind, null);

export const sec = (heading, kind, items) => ({ heading, kind, items });
// kinds: content | conduct | activity | note

export function block(id, o) {
  return {
    id,
    type: "topic",
    minutes: null,
    objective: null,
    summary: null,
    sections: [],
    reminders: [],
    warnings: [],
    resources: [],
    prep: [],        // things to prepare before the day (aggregated into PREP)
    actions: [],     // things the trainer must do during this block (shown in RUN)
    transition: null,
    ...o,
    prep: (o.prep || []).map((t, i) => ({ id: `${id}.p${i}`, text: t })),
    actions: (o.actions || []).map((t, i) => ({ id: `${id}.a${i}`, text: t })),
  };
}

export const brk = (id, minutes = 15, title = "Break") =>
  block(id, { title, type: "break", minutes, summary: "Phones are allowed on breaks. Trainees back on time." });
export const lunch = (id) =>
  block(id, { title: "Lunch", type: "lunch", minutes: 60, summary: "Phones are allowed at lunch. Trainees back on time." });

export const checklist = (prefix, items) => items.map((text, i) => ({ id: `${prefix}.${i}`, text }));
