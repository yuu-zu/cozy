import React from "react";
import type { FirebaseError } from "firebase/app";
import { confirmPasswordReset, signOut, verifyPasswordResetCode } from "firebase/auth";
import { ArrowLeft, Eye, EyeOff, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { auth } from "@/lib/firebase";

const verifiedCodeCache = new Map<string, string>();
const pendingCodeVerification = new Map<string, Promise<string>>();

function getResetPasswordErrorMessage(error: unknown) {
  const code = (error as FirebaseError | undefined)?.code;

  switch (code) {
    case "auth/expired-action-code":
      return "Liên kết đặt lại mật khẩu đã hết hạn. Vui lòng yêu cầu email mới.";
    case "auth/invalid-action-code":
      return "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng.";
    case "auth/network-request-failed":
      return "Không thể kết nối đến hệ thống xác thực. Vui lòng kiểm tra mạng và thử lại.";
    case "auth/too-many-requests":
      return "Bạn đã thao tác quá nhiều lần. Vui lòng chờ một chút rồi thử lại.";
    case "auth/weak-password":
      return "Mật khẩu mới chưa hợp lệ. Vui lòng chọn mật khẩu khác.";
    default:
      return "Không thể đổi mật khẩu. Vui lòng thử lại.";
  }
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [verifiedEmail, setVerifiedEmail] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [resetCompleted, setResetCompleted] = React.useState(false);
  const isSubmittingRef = React.useRef(false);
  const redirectTimeoutRef = React.useRef<number | null>(null);

  const oobCode = searchParams.get("oobCode")?.trim() || "";

  React.useEffect(() => {
    let cancelled = false;

    const verifyCode = async () => {
      if (resetCompleted) {
        setLoading(false);
        return;
      }

      if (!oobCode) {
        setError("Liên kết đặt lại mật khẩu không hợp lệ.");
        setLoading(false);
        return;
      }

      if (verifiedCodeCache.has(oobCode)) {
        setVerifiedEmail(verifiedCodeCache.get(oobCode) ?? "");
        setLoading(false);
        return;
      }

      try {
        const verificationPromise =
          pendingCodeVerification.get(oobCode) ??
          verifyPasswordResetCode(auth, oobCode);

        pendingCodeVerification.set(oobCode, verificationPromise);
        const email = await verificationPromise;

        if (cancelled) {
          return;
        }

        verifiedCodeCache.set(oobCode, email);
        setVerifiedEmail(email);
      } catch (err) {
        if (!cancelled) {
          setError(getResetPasswordErrorMessage(err));
        }
      } finally {
        pendingCodeVerification.delete(oobCode);
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void verifyCode();

    return () => {
      cancelled = true;
    };
  }, [oobCode, resetCompleted]);

  React.useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        window.clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const handleResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();

    if (submitting || isSubmittingRef.current || resetCompleted) {
      return;
    }

    setError("");
    setSuccess("");

    if (!oobCode) {
      setError("Liên kết đặt lại mật khẩu không hợp lệ.");
      return;
    }

    if (newPassword.length <= 6) {
      setError("Mật khẩu mới phải dài hơn 6 ký tự.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      await signOut(auth).catch(() => undefined);

      verifiedCodeCache.delete(oobCode);
      pendingCodeVerification.delete(oobCode);

      setResetCompleted(true);
      setVerifiedEmail("");
      setSuccess("Đổi mật khẩu thành công. Bạn sẽ được chuyển về trang đăng nhập.");
      toast.success("Đổi mật khẩu thành công.");

      redirectTimeoutRef.current = window.setTimeout(() => {
        navigate("/auth", { replace: true });
      }, 2000);
    } catch (err) {
      setError(getResetPasswordErrorMessage(err));
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="glass-card p-8 md:p-10 w-full max-w-lg animate-scale-in relative z-10">
        <div className="text-center mb-8">
          <button
            onClick={() => navigate("/auth")}
            className="absolute top-4 left-4 p-2 rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <img
            src="/logo-hub.webp"
            alt="Hub Logo"
            className="h-12 w-auto object-contain mx-auto mb-4"
            style={{ filter: "drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff) drop-shadow(0 0 1px #fff)" }}
          />
          <h1 className="text-3xl font-bold text-foreground tracking-wider">COZY</h1>
          <p className="text-muted-foreground mt-2 text-base">{t("auth.resetLinkSubtitle")}</p>
          {verifiedEmail && <p className="text-sm text-muted-foreground mt-2">{verifiedEmail}</p>}
        </div>

        {loading ? (
          <div className="rounded-xl border border-border bg-secondary/20 px-4 py-4 text-sm text-center text-muted-foreground">
            {t("auth.resetLoading")}
          </div>
        ) : resetCompleted ? (
          <div className="space-y-4">
            <p className="text-primary text-sm text-center bg-primary/10 p-3 rounded-lg">{success}</p>
            <button
              type="button"
              onClick={() => navigate("/auth", { replace: true })}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all"
            >
              {t("auth.backToLogin")}
            </button>
          </div>
        ) : error && !verifiedEmail ? (
          <div className="space-y-4">
            <p className="text-destructive text-sm text-center bg-destructive/10 p-3 rounded-lg">{error}</p>
            <button
              type="button"
              onClick={() => navigate("/auth", { replace: true })}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all"
            >
              {t("auth.backToLogin")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Mật khẩu mới"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="w-full pl-10 pr-12 py-3.5 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type={showConfirmPassword ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Nhập lại mật khẩu mới"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full pl-10 pr-12 py-3.5 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <p className="text-destructive text-sm text-center bg-destructive/10 p-3 rounded-lg">
                {error}
              </p>
            )}

            {success && (
              <p className="text-primary text-sm text-center bg-primary/10 p-3 rounded-lg">
                {success}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || !newPassword.trim() || !confirmPassword.trim()}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {submitting ? t("auth.resetSubmitting") : "Đổi mật khẩu"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
