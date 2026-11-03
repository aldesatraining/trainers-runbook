// Sign-in screens (email + password, with email verification and password reset).
// startSession() resolves with { mode: "local" } when Firebase isn't configured, or { mode: "cloud", user, signOut }
// once someone with a verified email at the allowed domain is signed in.
import { cloudConfigured, allowedDomain } from "./firebase-config.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const ERRORS = {
  "auth/invalid-credential": "That email and password don’t match.",
  "auth/wrong-password": "That email and password don’t match.",
  "auth/user-not-found": "That email and password don’t match.",
  "auth/email-already-in-use": "An account with that email already exists. Try signing in.",
  "auth/weak-password": "Use a password with at least 6 characters.",
  "auth/invalid-email": "That doesn’t look like an email address.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/network-request-failed": "Couldn’t reach the server. Check your connection.",
  "auth/operation-not-allowed": "Email sign-in isn’t switched on in Firebase yet (Authentication → Sign-in method).",
};
const explain = (e) => ERRORS[e?.code] || `Something went wrong${e?.code ? ` (${e.code})` : ""}. Try again.`;
const domainOk = (email) => !allowedDomain || email.trim().toLowerCase().endsWith(`@${allowedDomain.toLowerCase()}`);
const domainMsg = `Use your @${allowedDomain} email address.`;

const shell = (title, body, msg) => `
  <header class="top"><div class="top-row"><span class="brand static"><span class="brand-mark" aria-hidden="true">▶</span><span class="brand-name">Trainer Runbook</span></span></div></header>
  <main class="stage auth"><div class="auth-card">
    <h1>${title}</h1>
    ${msg ? `<div class="banner ${msg.kind}" role="status"><span>${esc(msg.text)}</span></div>` : ""}
    ${body}
  </div></main>`;

const field = (label, name, type, extra = "") => `<label class="mfield"><span class="label">${label}</span><input name="${name}" type="${type}" required ${extra}></label>`;

function screens({ screen, msg, busy, user }) {
  const dis = busy ? "disabled" : "";
  if (screen === "signup") return shell("Create your account", `
    <form data-auth-form="signup">
      ${field("Work email", "email", "email", `autocomplete="email" placeholder="you@${esc(allowedDomain || "company.com")}" autofocus`)}
      ${field("Password", "password", "password", 'autocomplete="new-password" minlength="6"')}
      <p class="muted small">We’ll send a link to confirm your email before you can open the library.</p>
      <button class="btn primary wide" ${dis}>Create account</button>
    </form>
    <p class="muted small auth-alt">Already have an account? <button class="plain" data-auth="to:signin">Sign in</button></p>`, msg);
  if (screen === "reset") return shell("Reset your password", `
    <form data-auth-form="reset">
      ${field("Email", "email", "email", 'autocomplete="email" autofocus')}
      <button class="btn primary wide" ${dis}>Send reset link</button>
    </form>
    <p class="muted small auth-alt"><button class="plain" data-auth="to:signin">Back to sign in</button></p>`, msg);
  if (screen === "verify") return shell("Confirm your email", `
    <p>We sent a link to <strong>${esc(user?.email || "your email")}</strong>. Open it, then come back and press the button below. It can take a minute, and may land in spam.</p>
    <div class="auth-stack">
      <button class="btn primary wide" data-auth="verified" ${dis}>I’ve confirmed my email</button>
      <button class="btn wide" data-auth="resend" ${dis}>Send the email again</button>
      <button class="plain" data-auth="signout">Use a different account</button>
    </div>`, msg);
  if (screen === "error") return shell("Can’t open the library", `
    <p>${esc(msg?.detail || "")}</p>
    <div class="auth-stack"><button class="btn wide" data-auth="signout">Sign out</button></div>`, null);
  if (screen === "loading") return shell("Trainer Runbook", `<p class="muted">Loading…</p>`, null);
  return shell("Sign in", `
    <form data-auth-form="signin">
      ${field("Email", "email", "email", 'autocomplete="email" autofocus')}
      ${field("Password", "password", "password", 'autocomplete="current-password"')}
      <button class="btn primary wide" ${dis}>Sign in</button>
    </form>
    <p class="muted small auth-alt"><button class="plain" data-auth="to:reset">Forgot your password?</button></p>
    <p class="muted small auth-alt">Need access? Ask your administrator to create an account for you.</p>`, msg);
}

export async function startSession(root) {
  if (!cloudConfigured) return { mode: "local" };
  const state = { screen: "loading", msg: null, busy: false, user: null };
  const draw = () => { root.innerHTML = screens(state); root.dataset.view = "auth"; };
  draw();
  let cloud;
  try { cloud = await import("./cloud.js"); } catch (e) {
    state.screen = "error"; state.msg = { detail: "Couldn’t load the sign-in service. Check your connection and reload." }; draw();
    return new Promise(() => {});
  }
  return new Promise((resolve) => {
    let done = false;
    const go = (screen, msg = null) => { state.screen = screen; state.msg = msg; state.busy = false; draw(); };
    const finish = (user) => {
      done = true;
      resolve({ mode: "cloud", user, signOut: async () => { await cloud.logout(); location.hash = "#/"; location.reload(); } });
    };
    // Signed in: the email must be at the allowed domain and verified before the library opens.
    const admit = async (user) => {
      state.user = user;
      if (!domainOk(user.email || "")) { await cloud.logout(); return go("signin", { kind: "err", text: domainMsg }); }
      // Accounts are created by an administrator, so access is decided by the "allowed" list in firestore.rules.
      finish(user);
    };
    cloud.watch((user) => { if (done) return; if (user) admit(user); else if (state.screen === "loading") go("signin"); });

    root.addEventListener("submit", async (e) => {
      const form = e.target.closest("[data-auth-form]");
      if (!form || done) return;
      e.preventDefault();
      const kind = form.dataset.authForm, email = form.email.value.trim(), password = form.password?.value || "";
      if (kind !== "signin" && !domainOk(email)) return go(kind, { kind: "err", text: domainMsg });
      if (kind === "signup") return go("signin");
      state.busy = true; draw();
      try {
        if (kind === "signin") { await cloud.signIn(email, password); /* the auth listener takes it from here */ }
        else if (kind === "signup") { const u = await cloud.signUp(email, password); state.user = u; go("verify", { kind: "ok", text: "Account created. Check your email for the confirmation link." }); }
        else { await cloud.resetPassword(email).catch(() => {}); go("signin", { kind: "ok", text: "If an account exists for that email, a reset link is on its way." }); }
      } catch (err) { go(kind, { kind: "err", text: explain(err) }); }
    });
    root.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-auth]");
      if (!b || done) return;
      const [cmd, arg] = b.dataset.auth.split(":");
      if (cmd === "to") return go(arg);
      if (cmd === "signout") { await cloud.logout(); return go("signin"); }
      state.busy = true; draw();
      try {
        if (cmd === "resend") { await cloud.resendVerification(); go("verify", { kind: "ok", text: "Sent. Check your inbox." }); }
        else if (cmd === "verified") { const u = await cloud.refreshUser(); if (u.emailVerified) finish(u); else go("verify", { kind: "err", text: "Not confirmed yet. Open the link in the email first." }); }
      } catch (err) { go("verify", { kind: "err", text: explain(err) }); }
    });
  });
}

// Signed in but the shared library can't be read (usually the email domain or the Firestore rules).
export function showAccessError(root, session, err) {
  const why = err?.code === "permission-denied"
    ? `The shared library refused access for ${session.user?.email || "this account"}. Check that the account’s email domain is the allowed one and that the Firestore rules have been published.`
    : `The shared library couldn’t be loaded: ${err?.message || err}`;
  root.innerHTML = screens({ screen: "error", msg: { detail: why } });
  root.dataset.view = "auth";
  root.addEventListener("click", (e) => { if (e.target.closest("[data-auth=signout]")) session.signOut(); });
}
