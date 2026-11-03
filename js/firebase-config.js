// Paste the values from Firebase console -> Project settings -> Your apps -> SDK setup and configuration.
// These are identifiers, not secrets: who can read or write is decided by sign-in and firestore.rules.
// While apiKey is empty the app runs in local mode (everything stays in this browser), so it works before Firebase is set up.
export const firebaseConfig = {
  apiKey: "AIzaSyA3TNAv3v37h5jMQ08AcuFcbCBvep5CZa0",
  authDomain: "trainer-runbook.firebaseapp.com",
  projectId: "trainer-runbook",
  storageBucket: "trainer-runbook.firebasestorage.app",
  messagingSenderId: "713727326418",
  appId: "1:713727326418:web:a8bde4cd5758b13331d50b",
};

// Only email addresses at this domain can create an account here. "" allows any address.
// Keep it identical to the domain in firestore.rules, which is what actually enforces it.
export const allowedDomain = "alder.com";

export const cloudConfigured = !!firebaseConfig.apiKey;
