import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  User,
  updateProfile,
  fetchSignInMethodsForEmail,
} from "firebase/auth";
import { ref, set, get, update } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import { generateKeyPair, savePrivateKeyToLocalStorage } from "@/lib/crypto";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  verifyExistingAccountEmail: (email: string, password: string) => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
  checkDisplayNameExists: (displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
  updateUserProfile: (data: { displayName?: string; photoURL?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 180_000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let timer: ReturnType<typeof setTimeout>;

    const resetTimer = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        signOut(auth);
      }, INACTIVITY_TIMEOUT);
    };

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer));
    resetTimer();

    return () => {
      clearTimeout(timer);
      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const snapshot = await get(ref(db, `users/${cred.user.uid}`));
    const userData = snapshot.val();

    if (!snapshot.exists() || !userData?.emailVerified) {
      await signOut(auth);
      const error = new Error("Vui long xac minh email truoc khi dang nhap") as Error & {
        code?: string;
        displayName?: string;
      };
      error.code = "auth/email-not-verified";
      error.displayName = userData?.displayName || cred.user.displayName || "";
      throw error;
    }
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });

    const { publicKey, privateKey } = await generateKeyPair();
    savePrivateKeyToLocalStorage(cred.user.uid, privateKey);

    await set(ref(db, `users/${cred.user.uid}`), {
      displayName,
      email,
      emailVerified: true,
      emailVerifiedAt: Date.now(),
      publicKey,
      photoURL: "",
      createdAt: Date.now(),
    });

    await signOut(auth);
  }, []);

  const verifyExistingAccountEmail = useCallback(async (email: string, password: string) => {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    await update(ref(db, `users/${cred.user.uid}`), {
      emailVerified: true,
      emailVerifiedAt: Date.now(),
    });
    await signOut(auth);
  }, []);

  const checkEmailExists = useCallback(async (email: string) => {
    const signInMethods = await fetchSignInMethodsForEmail(auth, email);
    return signInMethods.length > 0;
  }, []);

  const checkDisplayNameExists = useCallback(async (displayName: string) => {
    try {
      const usersRef = ref(db, "users");
      const snapshot = await get(usersRef);

      if (!snapshot.exists()) {
        return false;
      }

      const users = snapshot.val();
      const normalizedInputName = displayName.trim().toLowerCase();

      // Kiểm tra xem displayName đã tồn tại chưa (so sánh không phân biệt hoa/thường)
      for (const userData of Object.values(users)) {
        const user = userData as { displayName?: string };
        if (user.displayName && user.displayName.toLowerCase() === normalizedInputName) {
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error("Error checking displayName:", error);
      return false;
    }
  }, []);

  const logout = useCallback(async () => {
    await signOut(auth);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    if (!auth.currentUser) throw new Error("Chua dang nhap");
    await updatePassword(auth.currentUser, newPassword);
  }, []);

  const updateUserProfile = useCallback(async (data: { displayName?: string; photoURL?: string }) => {
    if (!auth.currentUser) throw new Error("Chua dang nhap");
    await updateProfile(auth.currentUser, data);

    const updates: Record<string, string> = {};
    if (data.displayName) updates.displayName = data.displayName;
    if (data.photoURL !== undefined) updates.photoURL = data.photoURL;
    await update(ref(db, `users/${auth.currentUser.uid}`), updates);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        register,
        verifyExistingAccountEmail,
        checkEmailExists,
        checkDisplayNameExists,
        logout,
        resetPassword,
        changePassword,
        updateUserProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
