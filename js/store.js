import { adapter } from "./storage.js";

const blank = (program) => ({
  v: 1,
  mode: "prep",
  day: program.days[0].id,
  pos: {},          // dayId -> current blockId
  completed: {},    // blockId -> timestamp
  skipped: {},      // blockId -> true
  checks: {},       // checklist item id -> true
  notes: {},        // blockId -> personal trainer note
  dayNotes: {},     // dayId -> end-of-day / handoff note
  closed: {},       // dayId -> timestamp
  timers: {},       // blockId -> { endsAt, total } | { remaining, total } (paused)
  entered: {},      // blockId -> timestamp the trainer arrived at it (drives the pace chip)
});

export async function createStore(program) {
  const saved = await adapter.load(program.id);
  let state = { ...blank(program), ...(saved || {}) };
  const listeners = new Set();
  let saveTimer = null;

  const persist = () => {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => adapter.save(program.id, state), 150);
  };
  // Write any pending change now (used when leaving an outline or closing the page).
  const flush = () => {
    if (saveTimer == null) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    adapter.save(program.id, state);
  };
  const commit = (patch, { silent = false } = {}) => {
    state = { ...state, ...patch };
    persist();
    if (!silent) listeners.forEach((fn) => fn(state));
  };

  const dayOf = (id) => program.days.find((d) => d.id === id) || program.days[0];
  const day = () => dayOf(state.day);
  const currentBlock = () => {
    const d = day();
    return d.blocks.find((b) => b.id === state.pos[d.id]) || d.blocks[0];
  };
  const indexOf = () => day().blocks.findIndex((b) => b.id === currentBlock().id);

  // Arriving at a block (not yet completed) stamps the time, so pace can be measured against the plan.
  const arrive = (id) => (state.completed[id] ? state.entered : { ...state.entered, [id]: Date.now() });

  const goto = (dayId, blockId, mode) => {
    const d = dayOf(dayId);
    const b = d.blocks.find((x) => x.id === blockId) || d.blocks[0];
    commit({ day: d.id, pos: { ...state.pos, [d.id]: b.id }, entered: arrive(b.id), ...(mode ? { mode } : {}) });
  };

  const api = {
    program,
    flush,
    get: () => state,
    subscribe: (fn) => (listeners.add(fn), () => listeners.delete(fn)),
    day,
    dayOf,
    currentBlock,
    index: indexOf,
    blockAt: (i) => day().blocks[i] || null,
    next: () => day().blocks[indexOf() + 1] || null,

    setMode(mode) {
      const cur = currentBlock();
      // Starting Run on a block you haven't been timed on yet: start the clock for it.
      commit({ mode, ...(mode === "run" && !state.entered[cur.id] ? { entered: arrive(cur.id) } : {}) });
    },
    // Switching day lands on the first block not yet completed.
    setDay(dayId) {
      const d = dayOf(dayId);
      const first = d.blocks.find((b) => !state.completed[b.id]) || d.blocks[0];
      commit({ day: d.id, pos: { ...state.pos, [d.id]: state.pos[d.id] || first.id } });
    },
    goto,

    complete() {
      const b = currentBlock();
      const completed = { ...state.completed, [b.id]: Date.now() };
      const skipped = { ...state.skipped };
      delete skipped[b.id];
      const nxt = day().blocks[indexOf() + 1];
      commit({ completed, skipped, pos: nxt ? { ...state.pos, [day().id]: nxt.id } : state.pos, ...(nxt ? { entered: arrive(nxt.id) } : {}) });
    },
    // Moving forward without completing marks the block as skipped (revisitable from CLOSE or the outline).
    advance() {
      const b = currentBlock();
      const nxt = day().blocks[indexOf() + 1];
      if (!nxt) return;
      const skipped = state.completed[b.id] ? state.skipped : { ...state.skipped, [b.id]: true };
      commit({ skipped, pos: { ...state.pos, [day().id]: nxt.id }, entered: arrive(nxt.id) });
    },
    prev() {
      const p = day().blocks[indexOf() - 1];
      if (p) commit({ pos: { ...state.pos, [day().id]: p.id }, entered: arrive(p.id) });
    },
    uncomplete(blockId) {
      const completed = { ...state.completed };
      delete completed[blockId];
      commit({ completed });
    },

    toggleCheck(id) {
      const checks = { ...state.checks };
      if (checks[id]) delete checks[id];
      else checks[id] = true;
      commit({ checks });
    },
    // Notes are saved silently so typing never triggers a re-render.
    setNote: (blockId, text) => commit({ notes: { ...state.notes, [blockId]: text } }, { silent: true }),
    setDayNote: (dayId, text) => commit({ dayNotes: { ...state.dayNotes, [dayId]: text } }, { silent: true }),

    closeDay: (dayId) => commit({ closed: { ...state.closed, [dayId]: Date.now() } }),
    reopenDay(dayId) {
      const closed = { ...state.closed };
      delete closed[dayId];
      commit({ closed });
    },

    startTimer(blockId, minutes) {
      const total = minutes * 60000;
      commit({ timers: { ...state.timers, [blockId]: { endsAt: Date.now() + total, total } } });
    },
    pauseTimer(blockId) {
      const t = state.timers[blockId];
      if (!t || !t.endsAt) return;
      commit({ timers: { ...state.timers, [blockId]: { remaining: Math.max(0, t.endsAt - Date.now()), total: t.total } } });
    },
    resumeTimer(blockId) {
      const t = state.timers[blockId];
      if (!t || t.endsAt) return;
      commit({ timers: { ...state.timers, [blockId]: { endsAt: Date.now() + t.remaining, total: t.total } } });
    },
    clearTimer(blockId) {
      const timers = { ...state.timers };
      delete timers[blockId];
      commit({ timers });
    },

    async resetAll() {
      await adapter.clear(program.id);
      state = blank(program);
      listeners.forEach((fn) => fn(state));
    },
  };
  return api;
}

// Derived helpers shared by views.
export const timerLeft = (t) => (!t ? null : t.endsAt ? Math.max(0, t.endsAt - Date.now()) : t.remaining);
