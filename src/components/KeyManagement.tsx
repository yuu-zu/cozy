import React, { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Key, Download, Upload, AlertTriangle, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export default function KeyManagement() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [importKey, setImportKey] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDownloadKey = async () => {
    if (!user?.uid) {
      toast.error(t("keyManagement.userMissing"));
      return;
    }

    setIsDownloading(true);

    try {
      const storageKey = `cozy:private-key:${user.uid}`;
      const privateKey = localStorage.getItem(storageKey);

      if (!privateKey) {
        toast.error(t("keyManagement.keyMissing"));
        return;
      }

      const blob = new Blob([privateKey], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `private_key_${user.uid}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);

      toast.success(t("keyManagement.downloadSuccess"));
    } catch (err: any) {
      console.error("Download key error:", err);
      toast.error(t("keyManagement.downloadError"));
    } finally {
      setIsDownloading(false);
    }
  };

  const validatePrivateKey = (key: string): boolean => {
    if (!key || key.trim().length === 0) {
      return false;
    }

    const hasBeginMarker = key.includes("-----BEGIN") && key.includes("PRIVATE KEY-----");
    const hasEndMarker = key.includes("-----END") && key.includes("PRIVATE KEY-----");

    if (!hasBeginMarker || !hasEndMarker) {
      return false;
    }

    const cleanKey = key.replace(/-----.*-----/g, "").replace(/\s/g, "");
    return cleanKey.length > 500;
  };

  const handleImportKey = async () => {
    if (!user?.uid) {
      toast.error(t("keyManagement.userMissing"));
      return;
    }

    const keyToImport = importKey.trim();
    if (!keyToImport) {
      toast.error(t("keyManagement.emptyInput"));
      return;
    }

    if (!validatePrivateKey(keyToImport)) {
      toast.error(t("keyManagement.invalidFormat"));
      return;
    }

    setIsImporting(true);

    try {
      const storageKey = `cozy:private-key:${user.uid}`;
      localStorage.setItem(storageKey, keyToImport);
      setImportKey("");
      toast.success(t("keyManagement.restoreSuccess"));
    } catch (err: any) {
      console.error("Import key error:", err);
      toast.error(t("keyManagement.restoreError"));
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setImportKey(content);
        toast.success(t("keyManagement.fileLoaded"));
      }
    };
    reader.readAsText(file);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 pb-4 border-b border-border">
        <Key className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-foreground">{t("keyManagement.title")}</h3>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
        <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
        <div>
          <p className="font-medium text-destructive">{t("keyManagement.warningTitle")}</p>
          <p className="text-sm text-destructive/80 mt-1 leading-6">
            {t("keyManagement.warningBody")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <Download className="w-4 h-4" />
          {t("keyManagement.downloadTitle")}
        </h4>
        <p className="text-sm text-muted-foreground leading-6">
          {t("keyManagement.downloadDescription")}
        </p>
        <button
          onClick={handleDownloadKey}
          disabled={isDownloading}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {isDownloading ? t("keyManagement.downloading") : t("keyManagement.downloadButton")}
        </button>
      </div>

      <div className="space-y-3">
        <h4 className="font-medium text-foreground flex items-center gap-2">
          <Upload className="w-4 h-4" />
          {t("keyManagement.importTitle")}
        </h4>
        <p className="text-sm text-muted-foreground leading-6">
          {t("keyManagement.importDescription")}
        </p>

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
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {t("keyManagement.chooseFile")}
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-foreground">
            {t("keyManagement.orPaste")}
          </label>
          <textarea
            value={importKey}
            onChange={(e) => setImportKey(e.target.value)}
            placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"}
            rows={6}
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none font-mono"
          />
        </div>

        <button
          onClick={handleImportKey}
          disabled={isImporting || !importKey.trim()}
          className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Check className="w-4 h-4" />
          {isImporting ? t("keyManagement.restoring") : t("keyManagement.restoreButton")}
        </button>
      </div>

      <div className="text-sm text-muted-foreground space-y-1 leading-6">
        <p>{t("keyManagement.localOnly")}</p>
        <p>{t("keyManagement.overwriteWarning")}</p>
        <p>{t("keyManagement.keepSafe")}</p>
      </div>
    </div>
  );
}
