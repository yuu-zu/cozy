const { onRequest } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");
const express = require("express");

admin.initializeApp();

const REGION = "asia-southeast1";
const OTP_EXPIRY_MINUTES = 10;
const PASSWORD_RESET_TOKEN_EXPIRY_MINUTES = 15;
const PASSWORD_RESET_OTPS_PATH = "passwordResetOtps";
const PASSWORD_RESET_TOKENS_PATH = "passwordResetTokens";

function json(res, status, body) {
  res.status(status).json(body);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function getEmailKey(email) {
  return Buffer.from(email).toString("base64url");
}

function hashValue(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function generateOtp() {
  return String(crypto.randomInt(0, 10 ** 6)).padStart(6, "0");
}

function generateResetToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function getEmailJsConfig() {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const otpTemplateId = process.env.EMAILJS_TEMPLATE_ID;
  const passwordResetTemplateId =
    process.env.EMAILJS_PASSWORD_RESET_TEMPLATE_ID || process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;

  if (!serviceId || !otpTemplateId || !passwordResetTemplateId || !publicKey) {
    throw new Error(
      "Missing EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID or EMAILJS_PASSWORD_RESET_TEMPLATE_ID, or EMAILJS_PUBLIC_KEY."
    );
  }

  return { serviceId, otpTemplateId, passwordResetTemplateId, publicKey };
}

async function sendEmailViaEmailJs(templateId, templateParams) {
  const { serviceId, publicKey } = getEmailJsConfig();

  const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: templateParams,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Could not send email.");
  }
}

async function sendOtpEmail(email, displayName, otpCode) {
  const { otpTemplateId } = getEmailJsConfig();
  const appName = process.env.APP_NAME || "COZY";
  const otpCodeSpaced = otpCode.split("").join(" ");

  await sendEmailViaEmailJs(otpTemplateId, {
    to_email: email,
    to_name: displayName,
    otp_code: otpCode,
    otp_code_spaced: otpCodeSpaced,
    app_name: appName,
    expiry_minutes: OTP_EXPIRY_MINUTES,
  });
}

async function deliverPasswordResetVerifyEmail(email, displayName, verifyUrl) {
  const { passwordResetTemplateId } = getEmailJsConfig();
  const appName = process.env.APP_NAME || "COZY";
  const fromName = process.env.EMAIL_FROM_NAME || appName;
  const fromEmail = process.env.EMAIL_FROM_ADDRESS || "no-reply@yourdomain.com";
  const subject =
    process.env.EMAILJS_PASSWORD_RESET_SUBJECT || "Xác thực yêu cầu đổi mật khẩu";
  const introText =
    process.env.EMAILJS_PASSWORD_RESET_INTRO ||
    "Nhấn nút bên dưới để xác thực yêu cầu đổi mật khẩu.";
  const actionLabel = process.env.EMAILJS_PASSWORD_RESET_ACTION_LABEL || "Xác thực";

  await sendEmailViaEmailJs(passwordResetTemplateId, {
    to_email: email,
    to_name: displayName,
    from_name: fromName,
    from_email: fromEmail,
    app_name: appName,
    email_subject: subject,
    subject,
    intro_text: introText,
    body_text: introText,
    action_label: actionLabel,
    button_label: actionLabel,
    verify_label: actionLabel,
    verify_url: verifyUrl,
    action_url: verifyUrl,
  });
}

async function getValidPasswordResetTokenRecord(token) {
  const tokenHash = hashValue(token);
  const tokenRef = admin.database().ref(`${PASSWORD_RESET_TOKENS_PATH}/${tokenHash}`);
  const snapshot = await tokenRef.get();
  const tokenData = snapshot.val();

  if (!snapshot.exists() || !tokenData) {
    return { valid: false, code: "password-reset/invalid-token", tokenRef: null, tokenData: null };
  }

  if (Number(tokenData.expiresAt) < Date.now()) {
    return { valid: false, code: "password-reset/expired-token", tokenRef, tokenData };
  }

  if (tokenData.usedAt) {
    return { valid: false, code: "password-reset/token-used", tokenRef, tokenData };
  }

  return { valid: true, code: null, tokenRef, tokenData };
}

async function getVerifiedPasswordResetTokenRecord(token) {
  const result = await getValidPasswordResetTokenRecord(token);
  if (!result.valid || !result.tokenData || !result.tokenRef) {
    return result;
  }

  if (!result.tokenData.verifiedAt) {
    return {
      valid: false,
      code: "password-reset/not-verified",
      tokenRef: result.tokenRef,
      tokenData: result.tokenData,
    };
  }

  return result;
}

exports.sendPasswordResetOtp = onRequest({ region: REGION, cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    return json(res, 405, { code: "method/not-allowed", message: "Method not allowed." });
  }

  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) {
      return json(res, 400, { code: "auth/invalid-email", message: "Email is required." });
    }

    await admin.auth().getUserByEmail(email);

    const otpCode = generateOtp();
    await sendOtpEmail(email, email, otpCode);

    await admin.database().ref(`${PASSWORD_RESET_OTPS_PATH}/${getEmailKey(email)}`).set({
      email,
      otpHash: hashValue(otpCode),
      expiresAt: Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000,
      createdAt: Date.now(),
    });

    return json(res, 200, { ok: true });
  } catch (error) {
    logger.error("sendPasswordResetOtp failed", error);

    if (error?.code === "auth/user-not-found") {
      return json(res, 404, {
        code: "auth/user-not-found",
        message: "Không tìm thấy tài khoản với email này.",
      });
    }

    return json(res, 500, {
      code: "password-reset/send-failed",
      message: "Không thể gửi email, vui lòng thử lại.",
    });
  }
});

const authApp = express();
authApp.use(express.json());

authApp.post("/reset/request", async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const continueUrl = String(req.body?.continueUrl || "").trim();

    if (!email) {
      return json(res, 400, { code: "auth/invalid-email", message: "Email is required." });
    }

    if (!continueUrl) {
      return json(res, 400, {
        code: "password-reset/invalid-continue-url",
        message: "Continue URL is required.",
      });
    }

    const user = await admin.auth().getUserByEmail(email);
    const token = generateResetToken();
    const tokenHash = hashValue(token);
    const verifyUrl = `${continueUrl}${continueUrl.includes("?") ? "&" : "?"}resetToken=${encodeURIComponent(token)}`;

    await admin.database().ref(`${PASSWORD_RESET_TOKENS_PATH}/${tokenHash}`).set({
      email,
      createdAt: Date.now(),
      expiresAt: Date.now() + PASSWORD_RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000,
      verifiedAt: null,
      usedAt: null,
    });

    await deliverPasswordResetVerifyEmail(email, user.displayName || email, verifyUrl);

    return json(res, 200, { ok: true });
  } catch (error) {
    logger.error("auth/reset/request failed", error);

    if (error?.code === "auth/user-not-found") {
      return json(res, 404, {
        code: "auth/user-not-found",
        message: "Không tìm thấy tài khoản với email này.",
      });
    }

    return json(res, 500, {
      code: "password-reset/send-failed",
      message: "Không thể gửi email, vui lòng thử lại.",
    });
  }
});

authApp.post("/reset/verify", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();

    if (!token) {
      return json(res, 400, {
        code: "password-reset/invalid-token",
        message: "Link không hợp lệ hoặc đã hết hạn.",
      });
    }

    const { valid, code, tokenRef, tokenData } = await getValidPasswordResetTokenRecord(token);
    if (!valid || !tokenRef || !tokenData) {
      return json(res, 400, {
        code,
        message: "Link không hợp lệ hoặc đã hết hạn.",
      });
    }

    if (!tokenData.verifiedAt) {
      await tokenRef.update({
        verifiedAt: Date.now(),
      });
    }

    return json(res, 200, {
      ok: true,
      email: tokenData.email,
      expiresAt: tokenData.expiresAt,
    });
  } catch (error) {
    logger.error("auth/reset/verify failed", error);
    return json(res, 500, {
      code: "password-reset/verify-failed",
      message: "Link không hợp lệ hoặc đã hết hạn.",
    });
  }
});

authApp.post("/reset/confirm", async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const newPassword = String(req.body?.newPassword || "");

    if (!token) {
      return json(res, 400, {
        code: "password-reset/invalid-token",
        message: "Link không hợp lệ hoặc đã hết hạn.",
      });
    }

    if (!newPassword || newPassword.length < 8) {
      return json(res, 400, {
        code: "auth/weak-password",
        message: "Mật khẩu phải có ít nhất 8 ký tự.",
      });
    }

    const { valid, code, tokenRef, tokenData } = await getVerifiedPasswordResetTokenRecord(token);
    if (!valid || !tokenRef || !tokenData) {
      return json(res, 400, {
        code,
        message: "Link không hợp lệ hoặc đã hết hạn.",
      });
    }

    const user = await admin.auth().getUserByEmail(tokenData.email);
    await admin.auth().updateUser(user.uid, { password: newPassword });
    await tokenRef.update({
      usedAt: Date.now(),
    });

    return json(res, 200, { ok: true });
  } catch (error) {
    logger.error("auth/reset/confirm failed", error);
    return json(res, 500, {
      code: "password-reset/update-failed",
      message: "Không thể đổi mật khẩu, vui lòng thử lại.",
    });
  }
});

exports.auth = onRequest({ region: REGION, cors: true }, authApp);
