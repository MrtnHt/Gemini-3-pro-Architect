import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Vervang dit door jouw eigen config als het scherm wit blijft!
const firebaseConfig = {
  apiKey: "AIzaSy...", 
  authDomain: "jouw-app.firebaseapp.com",
  projectId: "jouw-app",
  storageBucket: "jouw-app.appspot.com",
  messagingSenderId: "12345",
  appId: "1:12345:web:abcde"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
