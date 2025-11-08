// src/Admin/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";   // 👈 NEW

const firebaseConfig = {
  apiKey: "AIzaSyAfpVN26S4MLb_4LJL8ZhGJqxffvWZoOB4",
  authDomain: "fit21-d2c9b.firebaseapp.com",
  projectId: "fit21-d2c9b",
  storageBucket: "fit21-d2c9b.firebasestorage.app",
  messagingSenderId: "172668868691",
  appId: "1:172668868691:web:923c69dc3a1d44437b4ea6",
  measurementId: "G-NPXHESTGEP",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);  // 👈 NEW – now available

export default app;
