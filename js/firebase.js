import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, isSupported, logEvent } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, increment, serverTimestamp, collection, getDocs, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Valores públicos por diseño: la seguridad real se controla con las reglas de Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyC8e2W2bL-a4VtARDVhq0z7HTOVYPabe6A",
  authDomain: "ariii-c43e3.firebaseapp.com",
  projectId: "ariii-c43e3",
  storageBucket: "ariii-c43e3.firebasestorage.app",
  messagingSenderId: "499391976845",
  appId: "1:499391976845:web:56ae8a7ccfb1aef4d0d9c4",
  measurementId: "G-9LR7P8HPDM",
};

export const app = initializeApp(firebaseConfig);

const analytics = isSupported()
  .then((ok) => (ok ? getAnalytics(app) : null))
  .catch(() => null);

export async function track(name, params) {
  const a = await analytics;
  if (a) logEvent(a, name, params);
}

export const auth = getAuth(app);
export const db = getFirestore(app);
export { GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut };
export { doc, getDoc, setDoc, increment, serverTimestamp, collection, getDocs, onSnapshot };
