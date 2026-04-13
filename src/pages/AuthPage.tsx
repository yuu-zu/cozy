import React, { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, Mail, User, Eye, EyeOff, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import {
  clearPendingRegistrationOtp,
  createPendingRegistrationOtp,
  generateOtpCode,
  getOtpExpiryMinutes,
  sendRegistrationOtpEmail,
  verifyPendingRegistrationOtp,
} from "@/lib/emailOtp";
import { getReadableAuthError } from "@/lib/authErrorMessages";

/**
 * Hàm kiểm tra password mạnh - Trả về Boolean
 * Yêu cầu: Tối thiểu 8 ký tự, có ít nhất 1 chữ hoa, 1 chữ thường, 1 chữ số và 1 ký tự đặc biệt
 */
function validateStrongPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Z]/.test(password)) return false;
  if (!/[a-z]/.test(password)) return false;
  if (!/\d/.test(password)) return false;
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return false;
  return true;
}

/**
 * Hàm lấy danh sách lỗi validation password
 */
function getPasswordErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push("Mật khẩu phải có ít nhất 8 ký tự");
  if (!/[A-Z]/.test(password)) errors.push("Mật khẩu phải có ít nhất 1 chữ hoa (A-Z)");
  if (!/[a-z]/.test(password)) errors.push("Mật khẩu phải có ít nhất 1 chữ thường (a-z)");
  if (!/\d/.test(password)) errors.push("Mật khẩu phải có ít nhất 1 chữ số (0-9)");
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) errors.push("Mật khẩu phải có ít nhất 1 ký tự đặc biệt (!@#$%^&*...)");
  return errors;
}

type AuthMode = "login" | "register" | "forgot" | "verifyOtp";
const EMAIL_ALREADY_REGISTERED_MESSAGE = "Email nay da duoc dang ky. Vui long dang nhap hoac su dung mot email khac.";

interface PendingRegistration {
  email: string;
  password: string;
  displayName: string;
}

type VerificationFlow = "register" | "existingAccount";

export default function AuthPage() {
  const { login, register, verifyExistingAccountEmail, checkEmailExists, checkDisplayNameExists, resetPassword } = useAuth();
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
  const [passwordError, setPasswordError] = useState("");
  const [pendingRegistration, setPendingRegistration] = useState<PendingRegistration | null>(null);
  const [verificationFlow, setVerificationFlow] = useState<VerificationFlow>("register");

  const resetMessages = () => {
    setError("");
    setSuccess("");
    setPasswordError("");
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
    } catch (error) {
      clearPendingRegistrationOtp();
      throw error;
    }
  };

  const beginOtpVerification = async (
    registration: PendingRegistration,
    flow: VerificationFlow,
    successMessage: string,
    toastMessage: string
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

        // Kiểm tra password mạnh lập tức
        if (!validateStrongPassword(password)) {
          setError("Mật khẩu không đạt chuẩn. Vui lòng kiểm tra các yêu cầu bên dưới.");
          setPasswordError("Mật khẩu tối thiểu 8 ký tự, có 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt");
          setLoading(false);
          return;
        }

        if (!trimmedDisplayName) {
          setError("Vui long nhap ten hien thi.");
          setLoading(false);
          return;
        }

        // Kiểm tra xem displayName đã tồn tại chưa
        const displayNameExists = await checkDisplayNameExists(trimmedDisplayName);
        if (displayNameExists) {
          setError("Tên tài khoản này đã có người sử dụng, vui lòng chọn tên khác.");
          setLoading(false);
          return;
        }

        // Kiểm tra xem email đã tồn tại chưa
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
          `Ma OTP da duoc gui toi ${trimmedEmail}. Vui long kiem tra email cua ban.`,
          "Da gui ma OTP qua email."
        );
        return;
      } else if (mode === "forgot") {
        await resetPassword(email);
        setSuccess("Da gui link dat lai mat khau qua email. Vui long kiem tra hop thu.");
      } else if (mode === "verifyOtp") {
        if (!pendingRegistration) {
          setError("Phien dang ky khong con hop le. Vui long dang ky lai.");
          setLoading(false);
          return;
        }

        const normalizedOtp = otp.trim();
        if (normalizedOtp.length !== 6) {
          setError("Vui long nhap day du 6 so OTP.");
          setLoading(false);
          return;
        }

        const isValidOtp = await verifyPendingRegistrationOtp(pendingRegistration.email, normalizedOtp);
        if (!isValidOtp) {
          setError("Ma OTP khong dung. Vui long thu lai.");
          setLoading(false);
          return;
        }

        if (verificationFlow === "register") {
          await register(
            pendingRegistration.email,
            pendingRegistration.password,
            pendingRegistration.displayName
          );

          resetRegistrationFlow();
          setEmail(pendingRegistration.email);
          setPassword("");
          setDisplayName("");
          setMode("login");
          setSuccess("Dang ky thanh cong. Vui long dang nhap de tiep tuc.");
          toast.success("Dang ky thanh cong!");
        } else {
          await verifyExistingAccountEmail(
            pendingRegistration.email,
            pendingRegistration.password
          );

          resetRegistrationFlow();
          setEmail(pendingRegistration.email);
          setPassword("");
          setDisplayName("");
          setMode("login");
          setSuccess("Email da duoc xac minh. Vui long dang nhap lai.");
          toast.success("Xac minh email thanh cong!");
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
          `Tai khoan nay chua xac minh. Ma OTP da duoc gui toi ${pendingAccount.email}.`,
          "Da gui OTP xac minh email."
        );
        return;
      } else if (err?.code === "auth/email-already-in-use") {
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
      setError("Phien dang ky khong con hop le. Vui long dang ky lai.");
      return;
    }

    resetMessages();
    setLoading(true);

    try {
      await sendOtpForRegistration(pendingRegistration);
      setSuccess(`Ma OTP moi da duoc gui toi ${pendingRegistration.email}.`);
      toast.success("Da gui lai ma OTP.");
    } catch (err: any) {
      setError(getReadableAuthError(err, "Khong the gui lai OTP."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="glass-card p-8 w-full max-w-md animate-scale-in relative z-10">
        <div className="text-center mb-8">
          <button onClick={() => navigate("/")} className="absolute top-4 left-4 p-2 rounded-lg hover:bg-secondary text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-wider">COZY</h1>
          <p className="text-muted-foreground mt-2">
            {mode === "login"
              ? "Dang nhap de tiep tuc"
              : mode === "register"
              ? "Tao tai khoan moi"
              : mode === "verifyOtp"
              ? "Xac minh email bang OTP"
              : "Quen mat khau"}
          </p>
          {mode === "register" && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center justify-center gap-1">
              <Lock className="w-3 h-3" />
              He thong se tao cap khoa RSA cho ban
            </p>
          )}
          {mode === "verifyOtp" && pendingRegistration && (
            <p className="text-xs text-muted-foreground mt-1">
              Nhap ma 6 so da gui toi <span className="font-medium text-foreground">{pendingRegistration.email}</span>
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "register" && (
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Ten hien thi"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={mode === "verifyOtp"}
              className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground disabled:opacity-70"
            />
          </div>

          {mode !== "forgot" && mode !== "verifyOtp" && (
            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Mat khau"
                  value={password}
                  onChange={(e) => {
                    const newPassword = e.target.value;
                    setPassword(newPassword);
                    if (mode === "register") {
                      if (!newPassword) {
                        setPasswordError("");
                      } else if (!validateStrongPassword(newPassword)) {
                        setPasswordError("Mật khẩu tối thiểu 8 ký tự, có 1 chữ hoa, 1 chữ thường, 1 số và 1 ký tự đặc biệt");
                      } else {
                        setPasswordError("");
                      }
                    }
                  }}
                  required
                  className="w-full pl-10 pr-12 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground placeholder:text-muted-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {mode === "register" && passwordError && (
                <p style={{color: '#ef4444', fontSize: '12px', marginTop: '5px', paddingLeft: '10px'}}>
                  {passwordError}
                </p>
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
                  placeholder="Nhap ma OTP 6 so"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-secondary/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-foreground tracking-[0.35em] placeholder:tracking-normal placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Ma OTP co hieu luc trong {getOtpExpiryMinutes()} phut.
              </p>
            </div>
          )}

          {mode === "login" && (
            <button type="button" onClick={() => switchMode("forgot")} className="text-sm text-primary hover:underline">
              Quen mat khau?
            </button>
          )}

          {error && <p className="text-destructive text-sm text-center bg-destructive/10 p-2 rounded-lg">{error}</p>}
          {success && <p className="text-primary text-sm text-center bg-primary/10 p-2 rounded-lg">{success}</p>}

          <button
            type="submit"
            disabled={loading || (mode === "register" && (!email.trim() || !displayName.trim() || !!passwordError))}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading
              ? mode === "login"
                ? "Dang dang nhap..."
                : mode === "register"
                ? "Dang gui OTP..."
                : mode === "verifyOtp"
                ? "Dang xac minh..."
                : "Dang gui..."
              : mode === "login"
              ? "Dang nhap"
              : mode === "register"
              ? "Gui ma OTP"
              : mode === "verifyOtp"
              ? "Xac minh OTP"
              : "Gui link dat lai mat khau"}
          </button>
        </form>

        {mode === "verifyOtp" && (
          <div className="mt-4 flex items-center justify-between gap-4 text-sm">
            <button
              type="button"
              onClick={() => switchMode(verificationFlow === "existingAccount" ? "login" : "register")}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {verificationFlow === "existingAccount" ? "Quay lai dang nhap" : "Quay lai dang ky"}
            </button>
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={loading}
              className="text-primary font-semibold hover:underline disabled:opacity-50"
            >
              Gui lai OTP
            </button>
          </div>
        )}

        <div className="text-center text-sm text-muted-foreground mt-6 space-y-1">
          {mode === "login" && (
            <p>
              Chua co tai khoan?{" "}
              <button onClick={() => switchMode("register")} className="text-primary font-semibold hover:underline">Dang ky</button>
            </p>
          )}
          {mode === "register" && (
            <p>
              Da co tai khoan?{" "}
              <button onClick={() => switchMode("login")} className="text-primary font-semibold hover:underline">Dang nhap</button>
            </p>
          )}
          {mode === "forgot" && (
            <p>
              <button onClick={() => switchMode("login")} className="text-primary font-semibold hover:underline">Quay lai dang nhap</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
