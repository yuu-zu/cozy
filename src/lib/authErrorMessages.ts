const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email hoac mat khau khong dung.",
  "auth/invalid-email": "Email khong hop le.",
  "auth/user-not-found": "Khong tim thay tai khoan voi email nay.",
  "auth/wrong-password": "Email hoac mat khau khong dung.",
  "auth/email-already-in-use": "Email nay da duoc dang ky. Vui long dang nhap hoac su dung mot email khac.",
  "auth/weak-password": "Mat khau qua yeu. Vui long chon mat khau manh hon.",
  "auth/too-many-requests": "Ban da thu qua nhieu lan. Vui long doi mot luc roi thu lai.",
  "auth/network-request-failed": "Khong the ket noi den dich vu xac thuc. Vui long kiem tra mang.",
  "auth/requires-recent-login": "Phien dang nhap da het han. Vui long dang nhap lai roi thu lai.",
  "auth/email-not-verified": "Vui long xac minh email truoc khi dang nhap.",
};

export function getReadableAuthError(error: unknown, fallback = "Da xay ra loi.") {
  if (error && typeof error === "object") {
    const code = "code" in error ? String(error.code) : "";
    const message = "message" in error ? String(error.message) : "";

    if (code && ERROR_MESSAGES[code]) {
      return ERROR_MESSAGES[code];
    }

    if (message) {
      return message;
    }
  }

  return fallback;
}
