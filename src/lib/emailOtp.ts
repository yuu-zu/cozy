const REGISTRATION_OTP_STORAGE_KEY = "cozy:registration-otp";
const PASSWORD_CHANGE_OTP_STORAGE_KEY = "cozy:password-change-otp";
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

export interface PendingRegistrationOtp {
  email: string;
  displayName: string;
  otpHash: string;
  expiresAt: number;
}

export interface PendingPasswordChangeOtp {
  email: string;
  otpHash: string;
  expiresAt: number;
}

function getEmailJsConfig() {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

  if (!serviceId || !templateId || !publicKey) {
    throw new Error(
      "Chua cau hinh gui OTP email. Hay them VITE_EMAILJS_SERVICE_ID, VITE_EMAILJS_TEMPLATE_ID va VITE_EMAILJS_PUBLIC_KEY."
    );
  }

  return { serviceId, templateId, publicKey };
}

async function sha256(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateOtpCode() {
  const random = window.crypto.getRandomValues(new Uint32Array(1))[0];
  return (random % 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, "0");
}

export function getOtpExpiryMinutes() {
  return OTP_EXPIRY_MINUTES;
}

export async function createPendingRegistrationOtp(email: string, displayName: string, otpCode: string) {
  const pendingOtp: PendingRegistrationOtp = {
    email,
    displayName,
    otpHash: await sha256(otpCode),
    expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
  };

  sessionStorage.setItem(REGISTRATION_OTP_STORAGE_KEY, JSON.stringify(pendingOtp));
  return pendingOtp;
}

export function getPendingRegistrationOtp() {
  const raw = sessionStorage.getItem(REGISTRATION_OTP_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingRegistrationOtp;
  } catch {
    sessionStorage.removeItem(REGISTRATION_OTP_STORAGE_KEY);
    return null;
  }
}

export function clearPendingRegistrationOtp() {
  sessionStorage.removeItem(REGISTRATION_OTP_STORAGE_KEY);
}

export async function createPendingPasswordChangeOtp(email: string, otpCode: string) {
  const pendingOtp: PendingPasswordChangeOtp = {
    email,
    otpHash: await sha256(otpCode),
    expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
  };

  sessionStorage.setItem(PASSWORD_CHANGE_OTP_STORAGE_KEY, JSON.stringify(pendingOtp));
  return pendingOtp;
}

export function getPendingPasswordChangeOtp() {
  const raw = sessionStorage.getItem(PASSWORD_CHANGE_OTP_STORAGE_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PendingPasswordChangeOtp;
  } catch {
    sessionStorage.removeItem(PASSWORD_CHANGE_OTP_STORAGE_KEY);
    return null;
  }
}

export function clearPendingPasswordChangeOtp() {
  sessionStorage.removeItem(PASSWORD_CHANGE_OTP_STORAGE_KEY);
}

export async function verifyPendingPasswordChangeOtp(email: string, otpCode: string) {
  const pendingOtp = getPendingPasswordChangeOtp();

  if (!pendingOtp || pendingOtp.email !== email) {
    throw new Error("Phien xac minh doi mat khau khong con hop le. Vui long gui lai OTP.");
  }

  if (pendingOtp.expiresAt < Date.now()) {
    clearPendingPasswordChangeOtp();
    throw new Error("Ma OTP da het han. Vui long gui lai ma moi.");
  }

  return pendingOtp.otpHash === (await sha256(otpCode));
}

export async function verifyPendingRegistrationOtp(email: string, otpCode: string) {
  const pendingOtp = getPendingRegistrationOtp();

  if (!pendingOtp || pendingOtp.email !== email) {
    throw new Error("Phien xac minh khong con hop le. Vui long dang ky lai.");
  }

  if (pendingOtp.expiresAt < Date.now()) {
    clearPendingRegistrationOtp();
    throw new Error("Ma OTP da het han. Vui long yeu cau gui lai ma moi.");
  }

  return pendingOtp.otpHash === (await sha256(otpCode));
}

export async function sendRegistrationOtpEmail(params: {
  email: string;
  displayName: string;
  otpCode: string;
}) {
  try {
    const { serviceId, templateId, publicKey } = getEmailJsConfig();
    const appName = import.meta.env.VITE_APP_NAME ?? "COZY";
    const otp_code_spaced = params.otpCode.split("").join(" ");

    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        template_params: {
          to_email: params.email,
          to_name: params.displayName,
          otp_code: params.otpCode,
          otp_code_spaced,
          app_name: appName,
          expiry_minutes: OTP_EXPIRY_MINUTES,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Khong gui duoc OTP qua email.");
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Khong gui duoc OTP qua email. Vui long thu lai sau.");
  }
}

export async function sendPasswordChangeOtpEmail(params: {
  email: string;
  displayName: string;
  otpCode: string;
}) {
  await sendRegistrationOtpEmail(params);
}
