
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
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

// Use a singleton pattern to initialize Firebase, preventing re-initialization errors.
// FIX: Changed to named imports for Firebase v9 modular SDK.
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };