


import { initializeApp } from "firebase/app";
import { initializeAuth, indexedDBLocalPersistence, browserPopupRedirectResolver } from "firebase/auth";
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
  persistence: indexedDBLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

const db = getFirestore(app);

export { auth, db };