import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import {
  ActionCodeSettings,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  User,
  updateProfile,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from "firebase/auth";
import { ref, set, get, update } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import { generateKeyPair, savePrivateKeyToLocalStorage } from "@/lib/crypto";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  suppressAuthRedirect: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  verifyExistingAccountEmail: (email: string, password: string) => Promise<void>;
  checkEmailExists: (email: string) => Promise<boolean>;
  checkDisplayNameExists: (displayName: string) => Promise<boolean>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUserProfile: (data: { displayName?: string }) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const INACTIVITY_TIMEOUT = 180_000;
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [suppressAuthRedirect, setSuppressAuthRedirect] = useState(false);

  const getPasswordResetActionCodeSettings = useCallback((): ActionCodeSettings => {
    return {
      url: `${window.location.origin}/reset-password`,
      handleCodeInApp: true,
    };
  }, []);

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
    setSuppressAuthRedirect(true);
    try {
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
        createdAt: Date.now(),
      });

      await signOut(auth);
      setUser(null);
    } finally {
      setSuppressAuthRedirect(false);
    }
  }, []);

  const verifyExistingAccountEmail = useCallback(async (email: string, password: string) => {
    setSuppressAuthRedirect(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      await update(ref(db, `users/${cred.user.uid}`), {
        emailVerified: true,
        emailVerifiedAt: Date.now(),
      });
      await signOut(auth);
      setUser(null);
    } finally {
      setSuppressAuthRedirect(false);
    }
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
    const normalizedEmail = email.trim().toLowerCase();
    const locale = localStorage.getItem("i18nextLng") === "en" ? "en" : "vi";
    auth.languageCode = locale;
    await sendPasswordResetEmail(auth, normalizedEmail, getPasswordResetActionCodeSettings());
  }, [getPasswordResetActionCodeSettings]);

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    if (!auth.currentUser) throw new Error("Chua dang nhap");
    if (!auth.currentUser.email) throw new Error("Khong tim thay email tai khoan");

    const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, newPassword);
  }, []);

  const updateUserProfile = useCallback(async (data: { displayName?: string }) => {
    if (!auth.currentUser) throw new Error("Chua dang nhap");
    await updateProfile(auth.currentUser, data);

    const updates: Record<string, string> = {};
    if (data.displayName) updates.displayName = data.displayName;
    await update(ref(db, `users/${auth.currentUser.uid}`), updates);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        suppressAuthRedirect,
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
