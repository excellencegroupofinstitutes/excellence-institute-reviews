/* ── Firebase Configuration ──
   Replace the values below with your Firebase project credentials.
   Get them from: Firebase Console → Project Settings → Your Apps → Config
*/
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",
  authDomain:        "YOUR_PROJECT_ID.firebaseapp.com",
  projectId:         "YOUR_PROJECT_ID",
  storageBucket:     "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId:             "YOUR_APP_ID"
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
