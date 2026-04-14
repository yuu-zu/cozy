import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { User, Lock, Save, X, Mail } from "lucide-react";
import { toast } from "sonner";
import { getReadableAuthError } from "@/lib/authErrorMessages";

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const { t } = useTranslation();
  const { user, changePassword, updateUserProfile } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileMsg, setProfileMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [passwordErr, setPasswordErr] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    setProfileErr("");
    setProfileMsg("");
    try {
      await updateUserProfile({ displayName: displayName.trim() });
      setProfileMsg(t("settings.profileUpdated"));
    } catch (err: unknown) {
      setProfileErr(getReadableAuthError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPasswordErr("");
    setPasswordMsg("");

    if (!user?.email) {
      setPasswordErr(t("settings.accountEmailMissing"));
      return;
    }

    if (!currentPassword) {
      setPasswordErr(t("settings.currentPasswordRequired"));
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

    if (currentPassword === newPassword) {
      setPasswordErr(t("settings.passwordMustDiffer"));
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordMsg(t("settings.passwordChanged"));
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success(t("settings.passwordChangedToast"));
    } catch (err: unknown) {
      if (typeof err === "object" && err !== null && "code" in err) {
        if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          setPasswordErr(t("settings.currentPasswordInvalid"));
        } else if (err.code === "auth/requires-recent-login") {
          setPasswordErr(t("settings.sessionExpired"));
        } else {
          setPasswordErr(getReadableAuthError(err));
        }
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

          <div className="rounded-2xl border border-border bg-secondary/20 p-4 space-y-3">
            <div className="flex items-center gap-3">
              <User className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t("settings.displayName")}</p>
                <p className="text-sm text-foreground font-medium">{displayName || user?.displayName}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-4 h-4 text-primary" />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Email</p>
                <p className="text-sm text-foreground break-all">{user?.email}</p>
              </div>
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
            placeholder={t("settings.currentPassword")}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
          />
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

          {passwordErr && <p className="text-destructive text-sm leading-6">{passwordErr}</p>}
          {passwordMsg && <p className="text-primary text-sm leading-6">{passwordMsg}</p>}

          <button
            onClick={handleChangePassword}
            disabled={saving || !currentPassword || !newPassword || !confirmPassword}
            className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground font-medium text-base hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" /> {t("settings.changePassword")}
          </button>
        </div>
      </div>
    </div>
  );
}
