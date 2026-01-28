import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAvuHiyYUEcH8HLmLlrZqczD6RNkEe7Rnc",
  authDomain: "simple-chat-53391.firebaseapp.com",
  projectId: "simple-chat-53391",
  storageBucket: "simple-chat-53391.firebasestorage.app",
  messagingSenderId: "302877021116",
  appId: "1:302877021116:web:1b7c3db7e535a14dc291b9",
  measurementId: "G-ZJDGBM7K9P"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
export const storage = getStorage(app);
