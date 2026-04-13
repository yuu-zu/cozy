import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBFrTdu7DO1TZB1AksPdW6N-PAq-a1HBbs",
  authDomain: "newdiary-1c766.firebaseapp.com",
  databaseURL: "https://newdiary-1c766-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "newdiary-1c766",
  storageBucket: "newdiary-1c766.firebasestorage.app",
  messagingSenderId: "833028121069",
  appId: "1:833028121069:web:fd8f4bf1f2b96a520347e4",
  measurementId: "G-156VETRE09"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
export default app;
