import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Làm sạch Public Key PEM để lấy phần Base64 thuần túy (chỉ dùng để hiển thị)
 * @param key Public Key gốc (có thể có header/footer PEM)
 * @returns Chuỗi Base64 sạch (không có header/footer và whitespace)
 */
function cleanPublicKeyForDisplay(key: string): string {
  if (!key) return key;

  let cleaned = key;

  // Xóa header/footer PEM
  cleaned = cleaned.replace(/-----BEGIN PUBLIC KEY-----/g, '');
  cleaned = cleaned.replace(/-----BEGIN RSA PUBLIC KEY-----/g, '');
  cleaned = cleaned.replace(/-----END PUBLIC KEY-----/g, '');
  cleaned = cleaned.replace(/-----END RSA PUBLIC KEY-----/g, '');

  // Xóa toàn bộ khoảng trắng và ký tự xuống dòng
  cleaned = cleaned.replace(/\s/g, '');

  return cleaned;
}

/**
 * Định dạng Public Key dài để hiển thị gọn.
 * Làm sạch PEM format trước, sau đó cắt ngắn bằng cách lấy:
 * 10 ký tự đầu + ... + 10 ký tự cuối của phần Base64
 * @param key Public Key gốc (có thể có header/footer PEM)
 * @returns Chuỗi được định dạng để hiển thị (ví dụ: MIIBIjANBgk...wIDAQAB)
 */
export function formatPublicKey(key: string): string {
  if (!key) return key;

  // Làm sạch key để lấy phần Base64 thuần túy
  const cleanKey = cleanPublicKeyForDisplay(key);

  // Nếu sau khi làm sạch vẫn <= 40 ký tự, trả về nguyên
  if (cleanKey.length <= 40) {
    return cleanKey;
  }

  // Cắt 10 ký tự đầu + ... + 10 ký tự cuối
  const start = cleanKey.substring(0, 10);
  const end = cleanKey.substring(cleanKey.length - 10);

  return `${start}...${end}`;
}

/**
 * Định dạng lại HTML content từ document.execCommand để tương thích với Tailwind CSS
 * - Chuyển đổi <font color="..."> thành <span style="color: ...">
 * - Chuyển đổi </font> thành </span>
 * @param htmlContent Chuỗi HTML gốc từ contentEditable editor
 * @returns Chuỗi HTML đã định dạng lại
 */
export function formatHTML(htmlContent: string): string {
  if (!htmlContent) return htmlContent;
  
  // Thay thế <font color="..."> bằng <span style="color: ...">
  let formatted = htmlContent.replace(/<font color="([^"]+)">/g, '<span style="color: $1;">');
  
  // Thay thế </font> bằng </span>
  formatted = formatted.replace(/<\/font>/g, '</span>');
  
  return formatted;
}

/**
 * Ép cứng các style định dạng HTML để không bị Tailwind CSS reset
 * - Chuyển <font color="..."> thành <span> với color: !important
 * - Ép cứng font-weight: bold !important cho <b> và <strong>
 * - Ép cứng font-style: italic !important cho <i> và <em>
 * @param htmlString Chuỗi HTML gốc từ Firebase
 * @returns Chuỗi HTML đã được ép cứng style
 */
export function forceRichTextStyles(htmlString: string): string {
  if (!htmlString) return htmlString;

  try {
    // Parse HTML string thành DOM ảo
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // 1. Xử lý thẻ <font> - chuyển sang <span> với style color
    const fontElements = doc.querySelectorAll('font');
    fontElements.forEach((fontEl) => {
      const color = fontEl.getAttribute('color');
      const span = doc.createElement('span');
      
      if (color) {
        span.style.setProperty('color', color, 'important');
      }
      
      // Copy toàn bộ nội dung con
      while (fontEl.firstChild) {
        span.appendChild(fontEl.firstChild);
      }
      
      // Thay thế font bằng span
      fontEl.replaceWith(span);
    });

    // 2. Xử lý thẻ <b> - ép cứng font-weight: bold
    const boldElements = doc.querySelectorAll('b');
    boldElements.forEach((el) => {
      el.style.setProperty('font-weight', 'bold', 'important');
    });

    // 3. Xử lý thẻ <strong> - ép cứng font-weight: bold
    const strongElements = doc.querySelectorAll('strong');
    strongElements.forEach((el) => {
      el.style.setProperty('font-weight', 'bold', 'important');
    });

    // 4. Xử lý thẻ <i> - ép cứng font-style: italic
    const italicElements = doc.querySelectorAll('i');
    italicElements.forEach((el) => {
      el.style.setProperty('font-style', 'italic', 'important');
    });

    // 5. Xử lý thẻ <em> - ép cứng font-style: italic
    const emElements = doc.querySelectorAll('em');
    emElements.forEach((el) => {
      el.style.setProperty('font-style', 'italic', 'important');
    });

    // Trả về innerHTML của body
    return doc.body.innerHTML;
  } catch (error) {
    console.error('Error processing rich text styles:', error);
    return htmlString;
  }
}
