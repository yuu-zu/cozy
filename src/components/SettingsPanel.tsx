import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ref, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { useTranslation } from "react-i18next";
import { User, Lock, Camera, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  clearPendingPasswordChangeOtp,
  createPendingPasswordChangeOtp,
  generateOtpCode,
  getOtpExpiryMinutes,
  sendPasswordChangeOtpEmail,
  verifyPendingPasswordChangeOtp,
} from "@/lib/emailOtp";
import { getReadableAuthError } from "@/lib/authErrorMessages";
import KeyManagement from "@/components/KeyManagement";

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { t } = useTranslation();
  const { user, changePassword, updateUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [photoURL, setPhotoURL] = useState(user?.photoURL || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    get(ref(db, `users/${user.uid}`)).then((snap) => {
      const data = snap.val();
      if (data?.photoURL) setPhotoURL(data.photoURL);
    });
  }, [user]);

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      setProfileErr(t("settings.avatarTooLarge"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPhotoURL(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setProfileErr("");
    setProfileMsg("");
    try {
      await updateUserProfile({ displayName: displayName.trim(), photoURL });
      setProfileMsg(t("settings.profileUpdated"));
    } catch (err: any) {
      setProfileErr(getReadableAuthError(err));
    } finally {
      setSaving(false);
    }
  };

  const resetPasswordOtpFlow = () => {
    clearPendingPasswordChangeOtp();
    setOtpRequested(false);
    setOtp("");
  };

  const handleChangePassword = async () => {
    setPasswordErr("");
    setPasswordMsg("");

    if (!user?.email) {
      setPasswordErr(t("settings.accountEmailMissing"));
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErr(t("settings.passwordMismatch"));
      return;
    }

    if (newPassword.length < 6) {
      setPasswordErr(t("settings.passwordTooShort"));
      return;
    }

    if (!otpRequested) {
      const otpCode = generateOtpCode();
      setSaving(true);

      try {
        await createPendingPasswordChangeOtp(user.email, otpCode);
        await sendPasswordChangeOtpEmail({
          email: user.email,
          displayName: displayName.trim() || user.displayName || "bạn",
          otpCode,
        });
        setOtpRequested(true);
        setPasswordMsg(t("settings.otpSent", { email: user.email }));
        toast.success(t("settings.otpSentToast"));
      } catch (err: any) {
        clearPendingPasswordChangeOtp();
        setPasswordErr(getReadableAuthError(err, t("settings.otpSendError")));
      } finally {
        setSaving(false);
      }

      return;
    }

    if (otp.trim().length !== 6) {
      setPasswordErr(t("settings.otpInvalid"));
      return;
    }

    setSaving(true);
    try {
      const isValidOtp = await verifyPendingPasswordChangeOtp(user.email, otp.trim());
      if (!isValidOtp) {
        setPasswordErr(t("settings.otpInvalid"));
        setSaving(false);
        return;
      }

      await changePassword(newPassword);
      resetPasswordOtpFlow();
      setPasswordMsg(t("settings.passwordChanged"));
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("settings.passwordChangedToast"));
    } catch (err: any) {
      if (err?.code === "auth/requires-recent-login") {
        resetPasswordOtpFlow();
        setPasswordErr(t("settings.sessionExpired"));
      } else {
        setPasswordErr(getReadableAuthError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/35 backdrop-blur-sm p-4">
      <div className="glass-card p-6 md:p-7 w-full max-w-xl max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-foreground">{t("settings.title")}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-5 mb-10">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <User className="w-5 h-5 text-primary" /> {t("settings.personalInfo")}
          </h3>

          <div className="flex items-center gap-4">
            <div className="relative">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt=""
                  className="w-20 h-20 rounded-full object-cover border-2 border-primary/20"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {(displayName || "U").charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              >
                <Camera className="w-4 h-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </div>
            <div className="flex-1">
              <p className="text-base text-muted-foreground break-all">{user?.email}</p>
            </div>
          </div>

          <input
            type="text"
            placeholder={t("settings.displayName")}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
          />

          {profileErr && <p className="text-destructive text-sm leading-6">{profileErr}</p>}
          {profileMsg && <p className="text-primary text-sm leading-6">{profileMsg}</p>}

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-medium text-base hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> {t("settings.saveInfo")}
          </button>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary" /> {t("settings.changePassword")}
          </h3>

          <input
            type="password"
            placeholder={t("settings.newPassword")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
          />
          <input
            type="password"
            placeholder={t("settings.confirmPassword")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
          />

          {otpRequested && (
            <>
              <input
                type="text"
                inputMode="numeric"
                placeholder={t("settings.enterOtp")}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none tracking-[0.35em]"
              />
              <p className="text-sm text-muted-foreground text-center">
                {t("settings.otpExpires", { minutes: getOtpExpiryMinutes() })}
              </p>
            </>
          )}

          {passwordErr && <p className="text-destructive text-sm leading-6">{passwordErr}</p>}
          {passwordMsg && <p className="text-primary text-sm leading-6">{passwordMsg}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleChangePassword}
              disabled={saving || !newPassword || !confirmPassword}
              className="flex-1 py-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-base hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" /> {otpRequested ? t("settings.verifyOtp") : t("settings.sendOtp")}
            </button>
            {otpRequested && (
              <button
                onClick={() => {
                  resetPasswordOtpFlow();
                  setPasswordErr("");
                  setPasswordMsg("");
                }}
                disabled={saving}
                className="px-4 py-3 rounded-xl border border-border text-base text-muted-foreground hover:bg-secondary disabled:opacity-50"
              >
                {t("settings.cancel")}
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-border pt-6 mt-8">
          <KeyManagement />
        </div>
      </div>
    </div>
  );
}
