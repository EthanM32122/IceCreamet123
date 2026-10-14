/**
 * Firebase client (Analytics). Safe to import from the SPA.
 * Project: icecreamet-85a3c
 */
import { initializeApp } from 'firebase/app';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyBxj4uF-9z7hMoAGx1mo_jrXobfItaHZMY',
  authDomain: 'icecreamet-85a3c.firebaseapp.com',
  projectId: 'icecreamet-85a3c',
  storageBucket: 'icecreamet-85a3c.firebasestorage.app',
  messagingSenderId: '361894613044',
  appId: '1:361894613044:web:1d24371198d41d9f177a61',
  measurementId: 'G-RSVDNCSR79',
};

export const firebaseApp = initializeApp(firebaseConfig);

let analyticsPromise = null;
export function initFirebaseAnalytics() {
  if (!analyticsPromise) {
    analyticsPromise = isSupported()
      .then((ok) => (ok ? getAnalytics(firebaseApp) : null))
      .catch(() => null);
  }
  return analyticsPromise;
}

export default firebaseApp;
