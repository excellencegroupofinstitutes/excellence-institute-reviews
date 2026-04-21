/* ── Firebase Configuration ──
   Replace the values below with your Firebase project credentials.
   Get them from: Firebase Console → Project Settings → Your Apps → Config
*/
const firebaseConfig = {
  apiKey: "AIzaSyDUr3F1hm6Tf8W0YfpSyIn5Qv4NCpi6i0E",
  authDomain: "excellence-institute.firebaseapp.com",
  projectId: "excellence-institute",
  storageBucket: "excellence-institute.firebasestorage.app",
  messagingSenderId: "50323421921",
  appId: "1:50323421921:web:03f21a030476311eeb15a0",
  measurementId: "G-75HD49LXB5"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

/*
  ── Recommended Firestore Security Rules ──
  Paste these in Firebase Console → Firestore → Rules:

  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /sessions/{id}   { allow read, write: if true; }
      match /faculties/{id}  { allow read, write: if true; }
      match /reviews/{id}    { allow read, write: if true; }
    }
  }
*/
