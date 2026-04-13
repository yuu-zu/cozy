import React, { useState, useEffect } from "react";import { useTranslation } from "react-i18next";import { ref, onValue, get, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { decryptMessage } from "@/lib/crypto";
import { forceRichTextStyles } from "@/lib/utils";
import { MOOD_CONFIG, Mood } from "@/types/diary";
import { Lock, Unlock, Mail, Eye } from "lucide-react";
import { toast } from "sonner";

interface SharedEntry {
  id: string;
  fromUid: string;
  fromName: string;
  encryptedTitle: string;
  encryptedContent: string;
  createdAt: number;
  isRead: boolean;
}

interface DecryptedEntry {
  title: string;
  content: string;
  mood: Mood;
}

export default function SharedDiaries() {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [sharedEntries, setSharedEntries] = useState<SharedEntry[]>([]);
  const [decrypted, setDecrypted] = useState<Record<string, DecryptedEntry>>({});
  const [decrypting, setDecrypting] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const sharedRef = ref(db, `sharedDiaries/${user.uid}`);
    const unsub = onValue(sharedRef, (snap) => {
      const data = snap.val();
      if (data) {
        const list = Object.entries(data)
          .map(([id, val]: [string, any]) => ({ id, ...val }))
          .sort((a: any, b: any) => b.createdAt - a.createdAt);
        setSharedEntries(list as SharedEntry[]);
      } else {
        setSharedEntries([]);
      }
    });
    return () => unsub();
  }, [user]);

  const handleDecrypt = async (entry: SharedEntry) => {
    console.log("🔓 Bắt đầu giải mã nhật ký:", entry.id);
    if (!user || decrypted[entry.id]) {
      console.log("❌ Không thể giải mã: user không tồn tại hoặc đã giải mã");
      return;
    }
    setDecrypting(entry.id);

    try {
      // 1. Lấy uid của người dùng đang đăng nhập hiện tại từ Firebase Auth
      const uid = user.uid; // auth.currentUser.uid
      console.log("👤 User UID:", uid);

      // 2. Tạo chuỗi key tìm kiếm chính xác
      const storageKey = `cozy:private-key:${uid}`;
      console.log("🔑 Storage key:", storageKey);

      // 3. Lấy khóa từ trình duyệt
      const privateKey = localStorage.getItem(storageKey);
      console.log("🔐 Private key tồn tại:", !!privateKey);

      // 4. Xử lý lỗi: Nếu !privateKey, tiếp tục văng lỗi
      if (!privateKey) {
        throw new Error("Không tìm thấy khóa riêng tư trong localStorage. Vui lòng đăng nhập lại để tạo khóa mới.");
      }

      console.log("📝 Đang giải mã tiêu đề...");
      // 5. Giải mã tiêu đề (JSON string chứa encryptedAesKey, iv, data)
      const title = await decryptMessage(entry.encryptedTitle, privateKey);
      console.log("✅ Tiêu đề đã giải mã:", title);

      console.log("📄 Đang giải mã nội dung...");
      // 6. Giải mã nội dung (JSON string chứa content + mood)
      const contentJson = await decryptMessage(entry.encryptedContent, privateKey);
      console.log("📋 Content JSON:", contentJson);
      const { content, mood } = JSON.parse(contentJson);
      console.log("✅ Nội dung đã giải mã:", { content: content.substring(0, 50) + "...", mood });

      // 7. Cập nhật state với văn bản gốc vừa giải mã
      setDecrypted((prev) => ({
        ...prev,
        [entry.id]: { title, content, mood },
      }));

      // 8. Đánh dấu đã đọc
      await update(ref(db, `sharedDiaries/${user.uid}/${entry.id}`), { isRead: true });

      toast.success("Đã giải mã nhật ký thành công!");
      console.log("🎉 Giải mã hoàn tất!");
    } catch (err: any) {
      console.error("❌ Decrypt error:", err);
      toast.error(err.message || "Giải mã thất bại. Sai khóa hoặc dữ liệu lỗi.");
    } finally {
      setDecrypting(null);
    }
  };

  if (sharedEntries.length === 0) {
    return (
      <div className="glass-card p-8 text-center animate-fade-in">
        <Mail className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
        <p className="text-muted-foreground">{t("sharedDiaries.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in">
      <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
        <Mail className="w-5 h-5 text-primary" /> {t("sharedDiaries.title", { count: sharedEntries.length })}
      </h3>
      {sharedEntries.map((entry) => {
        const dec = decrypted[entry.id];
        return (
          <div key={entry.id} className="glass-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-medium text-foreground">{t("sharedDiaries.from")}: {entry.fromName}</span>
                  {!entry.isRead && !dec && (
                    <span className="w-2 h-2 rounded-full bg-accent" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US", {
                      day: "2-digit", month: "2-digit", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                </div>

                {dec ? (
                  <div className="animate-fade-in">
                    <div className="flex items-center gap-2 mb-2">
                      <Unlock className="w-4 h-4 text-mood-calm" />
                      <span className="text-xs text-mood-calm font-medium">{t("sharedDiaries.decrypted")}</span>
                      {dec.mood && (
                        <span className={`mood-chip ${MOOD_CONFIG[dec.mood]?.colorClass}`}>
                          {MOOD_CONFIG[dec.mood]?.emoji} {MOOD_CONFIG[dec.mood]?.label}
                        </span>
                      )}
                    </div>
                    <h4 className="font-display font-semibold text-foreground">{dec.title}</h4>
                    <div 
                      className="mt-2 text-sm break-words whitespace-pre-wrap rich-text-content"
                      dangerouslySetInnerHTML={{ __html: forceRichTextStyles(dec.content) }}
                    />
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Lock className="w-4 h-4 text-accent" />
                      <span className="text-xs text-accent font-medium">{t("sharedDiaries.encrypted")}</span>
                    </div>
                    <code className="text-xs text-muted-foreground bg-secondary/50 p-2 rounded-lg block break-all line-clamp-2">
                      {entry.encryptedTitle.slice(0, 100)}...
                    </code>
                  </div>
                )}
              </div>

              {!dec && (
                <button
                  onClick={() => handleDecrypt(entry)}
                  disabled={decrypting === entry.id}
                  className="flex items-center gap-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-all disabled:opacity-50 shrink-0"
                >
                  <Unlock className="w-3 h-3" />
                  {decrypting === entry.id ? t("sharedDiaries.decrypting") : t("sharedDiaries.decrypt")}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
