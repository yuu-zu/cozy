import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, Mail, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  clearPendingRegistrationOtp,
  createPendingRegistrationOtp,
  generateOtpCode,
  getOtpExpiryMinutes,
  sendRegistrationOtpEmail,
  verifyPendingRegistrationOtp,
} from "@/lib/emailOtp";
import { getReadableAuthError } from "@/lib/authErrorMessages";

function validateStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) return false;
  return true;
}

function getPasswordErrors(password: string, t: (key: string) => string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push(t("auth.passwordRequirement.length"));
  if (!/[A-Z]/.test(password)) errors.push(t("auth.passwordRequirement.uppercase"));
  if (!/[a-z]/.test(password)) errors.push(t("auth.passwordRequirement.lowercase"));
  if (!/\d/.test(password)) errors.push(t("auth.passwordRequirement.number"));
  if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)) {
    errors.push(t("auth.passwordRequirement.special"));
  }
  return errors;
}

type AuthMode = "login" | "register" | "forgot" | "verifyOtp";

interface PendingRegistration {
  email: string;
  password: string;
  displayName: string;
}

type VerificationFlow = "register" | "existingAccount";

export default function AuthPage() {
  const { t } = useTranslation();
  const {
    login,
    register,
    verifyExistingAccountEmail,
    checkEmailExists,
    checkDisplayNameExists,
    resetPassword,
  } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
  const [verificationFlow, setVerificationFlow] = useState<VerificationFlow>("register");

  const EMAIL_ALREADY_REGISTERED_MESSAGE = t("auth.emailRegistered");

  const resetMessages = () => {
    setError("");
    setSuccess("");
    setPasswordErrors([]);
  };

  const resetRegistrationFlow = () => {
    clearPendingRegistrationOtp();
    setPendingRegistration(null);
    setVerificationFlow("register");
    setOtp("");
  };

  const switchMode = (nextMode: AuthMode) => {
    if (mode === "verifyOtp" && nextMode !== "verifyOtp") {
      resetRegistrationFlow();
    }

    setMode(nextMode);
    resetMessages();
  };

  const sendOtpForRegistration = async (registration: PendingRegistration) => {
    const otpCode = generateOtpCode();

    await createPendingRegistrationOtp(registration.email, registration.displayName, otpCode);

    try {
      await sendRegistrationOtpEmail({
        email: registration.email,
        displayName: registration.displayName,
        otpCode,
      });
    } catch (sendError) {
      clearPendingRegistrationOtp();
      throw sendError;
    }
  };

  const beginOtpVerification = async (
    registration: PendingRegistration,
    flow: VerificationFlow,
    successMessage: string,
    toastMessage: string,
  ) => {
    await sendOtpForRegistration(registration);
    setPendingRegistration(registration);
    setVerificationFlow(flow);
    setOtp("");
    setMode("verifyOtp");
    setError("");
    setSuccess(successMessage);
    toast.success(toastMessage);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (mode === "register" && value) {
      setPasswordErrors(getPasswordErrors(value, t));
    } else {
      setPasswordErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else if (mode === "register") {
        const trimmedDisplayName = displayName.trim();
        const trimmedEmail = email.trim();
        const currentPasswordErrors = getPasswordErrors(password, t);

        if (currentPasswordErrors.length > 0) {
          setPasswordErrors(currentPasswordErrors);
          setError(t("auth.passwordInvalid"));
          setLoading(false);
          return;
        }

        if (!trimmedDisplayName) {
          setError(t("auth.displayNameRequired"));
          setLoading(false);
          return;
        }

        const displayNameExists = await checkDisplayNameExists(trimmedDisplayName);
        if (displayNameExists) {
          setError(t("auth.displayNameTaken"));
          setLoading(false);
          return;
        }

        const emailExists = await checkEmailExists(trimmedEmail);
        if (emailExists) {
          setError(EMAIL_ALREADY_REGISTERED_MESSAGE);
          setLoading(false);
          return;
        }

        const nextRegistration = {
          email: trimmedEmail,
          password,
          displayName: trimmedDisplayName,
        };

        await beginOtpVerification(
          nextRegistration,
          "register",
          t("auth.otpSent", { email: trimmedEmail }),
          t("auth.otpSentToast"),
        );
        return;
      } else if (mode === "forgot") {
        await resetPassword(email);
        setSuccess(t("auth.resetSent"));
      } else if (mode === "verifyOtp") {
        if (!pendingRegistration) {
          setError(t("auth.sessionExpired"));
          setLoading(false);
          return;
        }

        const normalizedOtp = otp.trim();
        if (normalizedOtp.length !== 6) {
          setError(t("auth.otpLength"));
          setLoading(false);
          return;
        }

        const isValidOtp = await verifyPendingRegistrationOtp(
          pendingRegistration.email,
          normalizedOtp,
        );
        if (!isValidOtp) {
          setError(t("auth.otpInvalid"));
          setLoading(false);
          return;
        }

        if (verificationFlow === "register") {
          await register(
            pendingRegistration.email,
            pendingRegistration.password,
            pendingRegistration.displayName,
          );

          const verifiedEmail = pendingRegistration.email;
          resetRegistrationFlow();
          setEmail(verifiedEmail);
          setPassword("");
          setDisplayName("");
          setMode("login");
          setSuccess(t("auth.registerSuccess"));
          toast.success(t("auth.registerSuccessToast"));
        } else {
          await verifyExistingAccountEmail(
            pendingRegistration.email,
            pendingRegistration.password,
          );

          const verifiedEmail = pendingRegistration.email;
          resetRegistrationFlow();
          setEmail(verifiedEmail);
          setPassword("");
          setDisplayName("");
          setMode("login");
          setSuccess(t("auth.verifySuccess"));
          toast.success(t("auth.verifySuccessToast"));
        }
      }
    } catch (err: any) {
      if (err?.code === "auth/email-not-verified") {
        const pendingAccount = {
          email: email.trim(),
          password,
          displayName: err?.displayName || "",
        };

        await beginOtpVerification(
          pendingAccount,
          "existingAccount",
          t("auth.accountUnverified", { email: pendingAccount.email }),
          t("auth.accountUnverifiedToast"),
        );
        return;
      }

      if (err?.code === "auth/email-already-in-use") {
        resetRegistrationFlow();
        setMode("register");
        setError(EMAIL_ALREADY_REGISTERED_MESSAGE);
      } else {
        setError(getReadableAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!pendingRegistration) {
      setError(t("auth.sessionExpired"));
      return;
    }

    resetMessages();
    setLoading(true);

    try {
      await sendOtpForRegistration(pendingRegistration);
      setSuccess(t("auth.resendOtpSuccess", { email: pendingRegistration.email }));
      toast.success(t("auth.resendOtpToast"));
    } catch (err: any) {
      setError(getReadableAuthError(err, t("auth.resendOtpError")));
    } finally {
      setLoading(false);
    }
  };

  const subtitle =
    mode === "login"
      ? t("auth.loginSubtitle")
      : mode === "register"
        ? t("auth.registerSubtitle")
        : mode === "verifyOtp"
          ? t("auth.verifySubtitle")
          : t("auth.forgotSubtitle");

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="glass-card p-8 md:p-10 w-full max-w-lg animate-scale-in relative z-10">
        <div className="text-center mb-8">
          <button
            onClick={() => navigate("/")}
            className="absolute top-4 left-4 p-2 rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center justify-center w-18 h-18 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-wider">COZY</h1>
          <p className="text-muted-foreground mt-2 text-base">{subtitle}</p>
          {mode === "register" && (
            <p className="text-sm text-muted-foreground mt-2 flex items-center justify-center gap-1">
              <Lock className="w-4 h-4" />
              {t("auth.generateKeys")}
            </p>
          )}
          {mode === "verifyOtp" && pendingRegistration && (
            <p className="text-sm text-muted-foreground mt-2">
              {t("auth.enterOtpFor", { email: pendingRegistration.email })}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("auth.displayNamePlaceholder")}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder={t("auth.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={mode === "verifyOtp"}
              className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground disabled:opacity-70"
            />
          </div>

          {mode !== "forgot" && mode !== "verifyOtp" && (
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder={t("auth.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  required
                  className="w-full pl-10 pr-12 py-3.5 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "register" && passwordErrors.length > 0 && (
                <div className="mt-3 rounded-xl bg-destructive/8 border border-destructive/15 px-4 py-3">
                  {passwordErrors.map((passwordError) => (
                    <p key={passwordError} className="text-destructive text-sm leading-6">
                      {passwordError}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "verifyOtp" && (
            <div className="space-y-3">
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder={t("auth.otpPlaceholder")}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground tracking-[0.35em] placeholder:tracking-normal placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                {t("auth.otpExpires", { minutes: getOtpExpiryMinutes() })}
              </p>
            </div>
          )}

          {mode === "login" && (
            <button
              type="button"
              onClick={() => switchMode("forgot")}
              className="text-sm text-primary hover:underline"
            >
              {t("auth.forgotPassword")}
            </button>
          )}

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
            disabled={loading || (mode === "register" && (!email.trim() || !displayName.trim() || passwordErrors.length > 0))}
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading
              ? mode === "login"
                ? t("auth.loggingIn")
                : mode === "register"
                  ? t("auth.sendingOtp")
                  : mode === "verifyOtp"
                    ? t("auth.verifyingOtp")
                    : t("auth.sendingReset")
              : mode === "login"
                ? t("auth.login")
                : mode === "register"
                  ? t("auth.sendOtp")
                  : mode === "verifyOtp"
                    ? t("auth.verifyOtp")
                    : t("auth.resetPassword")}
          </button>
        </form>

        {mode === "verifyOtp" && (
          <div className="mt-4 flex items-center justify-between gap-4 text-sm">
            <button
              type="button"
              onClick={() => switchMode(verificationFlow === "existingAccount" ? "login" : "register")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {verificationFlow === "existingAccount" ? t("auth.backToLogin") : t("auth.backToRegister")}
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={loading}
              className="text-primary font-semibold hover:underline disabled:opacity-50"
            >
              {t("auth.resendOtp")}
            </button>
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground mt-6 space-y-1">
          {mode === "login" && (
            <p>
              {t("auth.noAccount")}{" "}
              <button onClick={() => switchMode("register")} className="text-primary font-semibold hover:underline">
                {t("auth.register")}
              </button>
            </p>
          )}
          {mode === "register" && (
            <p>
              {t("auth.haveAccount")}{" "}
              <button onClick={() => switchMode("login")} className="text-primary font-semibold hover:underline">
                {t("auth.login")}
              </button>
            </p>
          )}
          {mode === "forgot" && (
            <p>
              <button onClick={() => switchMode("login")} className="text-primary font-semibold hover:underline">
                {t("auth.backToLogin")}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
