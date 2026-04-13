import React, { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Key, Download, Upload, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function KeyManagement() {
  const { user } = useAuth();
  const [importKey, setImportKey] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hàm tải về khóa bí mật
  const handleDownloadKey = async () => {
    if (!user?.uid) {
      toast.error("Không tìm thấy thông tin người dùng.");
      return;
    }

    setIsDownloading(true);

    try {
      // Lấy private key từ localStorage
      const storageKey = `cozy:private-key:${user.uid}`;
      const privateKey = localStorage.getItem(storageKey);

      if (!privateKey) {
        toast.error("Không tìm thấy khóa bí mật trong localStorage. Vui lòng đăng nhập lại.");
        return;
      }

      // Tạo file blob và download
      const blob = new Blob([privateKey], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `private_key_${user.uid}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast.success("Đã tải về khóa bí mật thành công!");
    } catch (err: any) {
      console.error("Download key error:", err);
      toast.error("Không thể tải về khóa bí mật.");
    } finally {
      setIsDownloading(false);
    }
  };

  // Hàm validate định dạng private key
  const validatePrivateKey = (key: string): boolean => {
    if (!key || key.trim().length === 0) {
      return false;
    }

    // Basic validation: should contain PEM format markers
    const hasBeginMarker = key.includes("-----BEGIN") && key.includes("PRIVATE KEY-----");
    const hasEndMarker = key.includes("-----END") && key.includes("PRIVATE KEY-----");

    if (!hasBeginMarker || !hasEndMarker) {
      return false;
    }

    // Check if it's a reasonable length (RSA private keys are typically long)
    const cleanKey = key.replace(/-----.*-----/g, "").replace(/\s/g, "");
    return cleanKey.length > 500; // RSA private keys are much longer than this
  };

  // Hàm khôi phục khóa từ text input
  const handleImportKey = async () => {
    if (!user?.uid) {
      toast.error("Không tìm thấy thông tin người dùng.");
      return;
    }

    const keyToImport = importKey.trim();
    if (!keyToImport) {
      toast.error("Vui lòng nhập khóa bí mật.");
      return;
    }

    // Validate định dạng
    if (!validatePrivateKey(keyToImport)) {
      toast.error("Định dạng khóa bí mật không hợp lệ. Vui lòng kiểm tra lại.");
      return;
    }

    setIsImporting(true);

    try {
      // Lưu vào localStorage với đúng format
      const storageKey = `cozy:private-key:${user.uid}`;
      localStorage.setItem(storageKey, keyToImport);

      // Reset form
      setImportKey("");

      toast.success("Đã khôi phục khóa bí mật thành công!");
    } catch (err: any) {
      console.error("Import key error:", err);
      toast.error("Không thể khôi phục khóa bí mật.");
    } finally {
      setIsImporting(false);
    }
  };

  // Hàm xử lý upload file
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setImportKey(content);
        toast.success("Đã tải file thành công. Nhấn 'Khôi phục' để áp dụng.");
      }
    };
    reader.readAsText(file);

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 pb-4 border-b border-border">
        <Key className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">Quản lý khóa bí mật</h3>
      </div>

      {/* Cảnh báo bảo mật */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-destructive">CẢNH BÁO QUAN TRỌNG</p>
          <p className="text-sm text-destructive/80 mt-1">
            Hãy lưu giữ file khóa bí mật ở nơi an toàn. Nếu mất file này, bạn sẽ không thể đọc lại các nhật ký cũ trên thiết bị mới.
            Khóa này được mã hóa RSA-2048 và chỉ tồn tại trên thiết bị của bạn.
          </p>
        </div>
      </div>

      {/* Tải về khóa */}
      <div className="space-y-3">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <Download className="w-4 h-4" />
          Tải về khóa bí mật
        </h4>
        <p className="text-sm text-muted-foreground">
          Tải file chứa khóa bí mật để backup. File sẽ có tên <code className="bg-secondary px-1 rounded">private_key_[UID].txt</code>
        </p>
        <button
          onClick={handleDownloadKey}
          disabled={isDownloading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {isDownloading ? "Đang tải..." : "Tải về khóa"}
        </button>
      </div>

      {/* Khôi phục khóa */}
      <div className="space-y-3">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <Upload className="w-4 h-4" />
          Khôi phục khóa bí mật
        </h4>
        <p className="text-sm text-muted-foreground">
          Upload file backup hoặc dán trực tiếp chuỗi khóa bí mật để khôi phục.
        </p>

        {/* Upload file */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Chọn file
          </button>
        </div>

        {/* Text input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            Hoặc dán khóa bí mật:
          </label>
          <textarea
            value={importKey}
            onChange={(e) => setImportKey(e.target.value)}
            placeholder="-----BEGIN PRIVATE KEY-----&#10;MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...&#10;-----END PRIVATE KEY-----"
            rows={6}
            className="w-full px-4 py-2 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none font-mono"
          />
        </div>

        {/* Nút khôi phục */}
        <button
          onClick={handleImportKey}
          disabled={isImporting || !importKey.trim()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          {isImporting ? "Đang khôi phục..." : "Khôi phục khóa"}
        </button>
      </div>

      {/* Thông tin bổ sung */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Khóa bí mật được lưu trữ cục bộ trên thiết bị của bạn.</p>
        <p>• Việc khôi phục sẽ ghi đè khóa hiện tại.</p>
        <p>• Đảm bảo file backup được lưu ở nơi an toàn và bảo mật.</p>
      </div>
    </div>
  );
}