import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAnalytics, isSupported, logEvent } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-analytics.js";

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
