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
    if (!file || file.size > 500 * 1024) return;
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
      setProfileMsg("Da cap nhat thong tin!");
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
      setPasswordErr("Khong tim thay email tai khoan.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordErr("Mat khau moi khong khop");
      return;
    }

    if (newPassword.length < 6) {
      setPasswordErr("Mat khau phai it nhat 6 ky tu");
      return;
    }

    if (!otpRequested) {
      const otpCode = generateOtpCode();
      setSaving(true);

      try {
        await createPendingPasswordChangeOtp(user.email, otpCode);
        await sendPasswordChangeOtpEmail({
          email: user.email,
          displayName: displayName.trim() || user.displayName || "ban",
          otpCode,
        });
        setOtpRequested(true);
        setPasswordMsg(`Da gui OTP toi ${user.email}. Vui long nhap ma de doi mat khau.`);
        toast.success("Da gui OTP doi mat khau.");
      } catch (err: any) {
        clearPendingPasswordChangeOtp();
        setPasswordErr(getReadableAuthError(err, "Khong the gui OTP doi mat khau."));
      } finally {
        setSaving(false);
      }

      return;
    }

    if (otp.trim().length !== 6) {
      setPasswordErr("Vui long nhap day du 6 so OTP.");
      return;
    }

    setSaving(true);
    try {
      const isValidOtp = await verifyPendingPasswordChangeOtp(user.email, otp.trim());
      if (!isValidOtp) {
        setPasswordErr("Ma OTP khong dung. Vui long thu lai.");
        setSaving(false);
        return;
      }

      await changePassword(newPassword);
      resetPasswordOtpFlow();
      setPasswordMsg("Da doi mat khau thanh cong!");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Da doi mat khau thanh cong!");
    } catch (err: any) {
      if (err?.code === "auth/requires-recent-login") {
        resetPasswordOtpFlow();
        setPasswordErr("Phien dang nhap da het han. Vui long dang nhap lai roi thu doi mat khau.");
      } else {
        setPasswordErr(getReadableAuthError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm p-4">
      <div className="glass-card p-6 w-full max-w-md max-h-[90vh] overflow-y-auto animate-scale-in">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-foreground">{t("settings.title", "Cài đặt")}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-8">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <User className="w-4 h-4 text-primary" /> {t("settings.personalInfo", "Thông tin cá nhân")}
          </h3>

          <div className="flex items-center gap-4">
            <div className="relative">
              {photoURL ? (
                <img src={photoURL} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-primary/20" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center">
                  <span className="text-xl font-bold text-primary">{(displayName || "U").charAt(0).toUpperCase()}</span>
                </div>
              )}
              <button
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <input
            type="text"
            placeholder={t("settings.displayName", "Tên hiển thị")}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
          />

          {profileErr && <p className="text-destructive text-sm">{profileErr}</p>}
          {profileMsg && <p className="text-primary text-sm">{profileMsg}</p>}

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> {t("settings.saveInfo", "Lưu thông tin")}
          </button>
        </div>

        <div className="space-y-4">
          <h3 className="font-semibold text-foreground flex items-center gap-2">
            <Lock className="w-4 h-4 text-primary" /> {t("settings.changePassword", "Đổi mật khẩu")}
          </h3>

          <input
            type="password"
            placeholder={t("settings.newPassword", "Mật khẩu mới")}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
          />
          <input
            type="password"
            placeholder={t("settings.confirmPassword", "Xác nhận mật khẩu mới")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
          />

          {otpRequested && (
            <>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Nhap ma OTP 6 so"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:border-primary outline-none tracking-[0.35em]"
              />
              <p className="text-xs text-muted-foreground text-center">
                Ma OTP co hieu luc trong {getOtpExpiryMinutes()} phut.
              </p>
            </>
          )}

          {passwordErr && <p className="text-destructive text-sm">{passwordErr}</p>}
          {passwordMsg && <p className="text-primary text-sm">{passwordMsg}</p>}

          <div className="flex gap-3">
            <button
              onClick={handleChangePassword}
              disabled={saving || !newPassword || !confirmPassword}
              className="flex-1 py-2.5 rounded-xl bg-secondary text-secondary-foreground font-medium text-sm hover:bg-secondary/80 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" /> {otpRequested ? t("settings.verifyOtp", "Xác minh OTP và đổi mật khẩu") : t("settings.sendOtp", "Gửi OTP đổi mật khẩu")}
            </button>
            {otpRequested && (
              <button
                onClick={() => {
                  resetPasswordOtpFlow();
                  setPasswordErr("");
                  setPasswordMsg("");
                }}
                disabled={saving}
                className="px-4 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary disabled:opacity-50"
              >
                {t("settings.cancel", "Hủy")}
              </button>
            )}
          </div>
        </div>

        {/* Key Management Section */}
        <div className="border-t border-border pt-6 mt-6">
          <KeyManagement />
        </div>
      </div>
    </div>
  );
}
