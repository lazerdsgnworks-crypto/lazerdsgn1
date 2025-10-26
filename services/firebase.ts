
// FIX: Correctly import `initializeApp` as a named export from 'firebase/app' as per Firebase v9+ modular SDK standards. The previous namespace import was causing the "Property 'initializeApp' does not exist" error.
import { initializeApp } from "firebase/app";
// FIX: Use browserLocalPersistence for web clients instead of indexedDBLocalPersistence.
// `indexedDBLocalPersistence` is intended for service workers and can cause issues in a standard web app context.
// This may resolve an underlying issue that is causing a misleading build error on this line.
import { initializeAuth, browserLocalPersistence, browserPopupRedirectResolver } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDYUeDN0eRafp1iCQpiwZpJ_Ure96fqis8",
    authDomain: "lazer-6c326.firebaseapp.com",
    projectId: "lazer-6c326",
    storageBucket: "lazer-6c326.firebasestorage.app",
    messagingSenderId: "212531762187",
    appId: "1:212531762187:web:5cdb56c616760165ae630e",
    measurementId: "G-QBRJPG5JYJ"
};

const app = initializeApp(firebaseConfig);

const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

const db = getFirestore(app);

export { auth, db };