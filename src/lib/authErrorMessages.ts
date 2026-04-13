const ERROR_MESSAGES = {
  en: {
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/invalid-email": "Invalid email address.",
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect email or password.",
    "auth/email-already-in-use": "This email is already registered. Please sign in or use another one.",
    "auth/weak-password": "Password is too weak. Please choose a stronger password.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Could not connect to the authentication service. Please check your network.",
    "auth/requires-recent-login": "Your session has expired. Please sign in again and retry.",
    "auth/email-not-verified": "Please verify your email before signing in.",
  },
  vi: {
    "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/user-not-found": "Không tìm thấy tài khoản với email này.",
    "auth/wrong-password": "Email hoặc mật khẩu không đúng.",
    "auth/email-already-in-use": "Email này đã được đăng ký. Vui lòng đăng nhập hoặc sử dụng email khác.",
    "auth/weak-password": "Mật khẩu quá yếu. Vui lòng chọn mật khẩu mạnh hơn.",
    "auth/too-many-requests": "Bạn đã thử quá nhiều lần. Vui lòng đợi một lúc rồi thử lại.",
    "auth/network-request-failed": "Không thể kết nối đến dịch vụ xác thực. Vui lòng kiểm tra mạng.",
    "auth/requires-recent-login": "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi thử lại.",
    "auth/email-not-verified": "Vui lòng xác minh email trước khi đăng nhập.",
  },
};

function getCurrentLang() {
  return localStorage.getItem("i18nextLng") === "en" ? "en" : "vi";
}

export function getReadableAuthError(error: unknown, fallback?: string) {
  const lang = getCurrentLang();
  const defaultFallback = lang === "en" ? "An error occurred." : "Đã xảy ra lỗi.";

  if (error && typeof error === "object") {
    const code = "code" in error ? String(error.code) : "";
    const message = "message" in error ? String(error.message) : "";

    if (code && ERROR_MESSAGES[lang][code as keyof typeof ERROR_MESSAGES.en]) {
      return ERROR_MESSAGES[lang][code as keyof typeof ERROR_MESSAGES.en];
    }

    if (message) {
      return message;
    }
  }

  return fallback || defaultFallback;
}
