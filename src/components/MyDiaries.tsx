import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ref, onValue, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { decryptMessage } from "@/lib/crypto";
import { forceRichTextStyles } from "@/lib/utils";
import { MOOD_CONFIG, Mood } from "@/types/diary";
import { Lock, Unlock, BookOpen, Eye, Send, Inbox, Trash2, Reply } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ReceivedDiary {
  id: string;
  fromUid: string;
  fromName: string;
  encryptedTitle: string;
  encryptedContent: string;
  createdAt: number;
  isRead: boolean;
  isTrashed?: boolean;
  trashedAt?: number;
}

interface SentDiary {
  id: string;
  toUid: string;
  toName: string;
  encryptedTitle: string;
  encryptedContent: string;
  mood: Mood;
  createdAt: number;
  isTrashed?: boolean;
  trashedAt?: number;
}

interface DecryptedDiary {
  title: string;
  content: string;
  mood: Mood;
}

export default function MyDiaries() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [receivedDiaries, setReceivedDiaries] = useState<ReceivedDiary[]>([]);
  const [sentDiaries, setSentDiaries] = useState<SentDiary[]>([]);
  const [decrypted, setDecrypted] = useState<Record<string, DecryptedDiary>>({});
  const [decrypting, setDecrypting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Lắng nghe danh sách nhật ký được chia sẻ cho mình (Inbox)
  useEffect(() => {
    if (!user?.uid) return;

    const sharedDiariesRef = ref(db, `sharedDiaries/${user.uid}`);
    const unsubscribe = onValue(sharedDiariesRef, (snapshot) => {
      const data = snapshot.val();

      if (!data || typeof data !== "object") {
        setReceivedDiaries([]);
      } else {
        const diaries = Object.entries(data)
          .map(([id, value]: [string, any]) => ({
            id,
            fromUid: value.fromUid || "",
            fromName: value.fromName || "Người dùng",
            encryptedTitle: value.encryptedTitle || "",
            encryptedContent: value.encryptedContent || "",
            createdAt: value.createdAt || Date.now(),
            isRead: value.isRead || false,
            isTrashed: value.isTrashed || false,
            trashedAt: value.trashedAt,
          } as ReceivedDiary))
          .filter((diary) => !diary.isTrashed)
          .sort((a, b) => b.createdAt - a.createdAt);

        setReceivedDiaries(diaries);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Lắng nghe danh sách nhật ký đã gửi (Outbox)
  useEffect(() => {
    if (!user?.uid) return;

    const sentDiariesRef = ref(db, `sentDiaries/${user.uid}`);
    const unsubscribe = onValue(sentDiariesRef, (snapshot) => {
      const data = snapshot.val();

      if (!data || typeof data !== "object") {
        setSentDiaries([]);
      } else {
        const diaries = Object.entries(data)
          .map(([id, value]: [string, any]) => ({
            id,
            toUid: value.toUid || "",
            toName: value.toName || "Người dùng",
            encryptedTitle: value.encryptedTitle || "",
            encryptedContent: value.encryptedContent || "",
            mood: value.mood || "calm",
            createdAt: value.createdAt || Date.now(),
            isTrashed: value.isTrashed || false,
            trashedAt: value.trashedAt,
          } as SentDiary))
          .filter((diary) => !diary.isTrashed)
          .sort((a, b) => b.createdAt - a.createdAt);

        setSentDiaries(diaries);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // Xử lý giải mã nhật ký
  const handleDecrypt = async (diary: ReceivedDiary) => {
    console.log("🔓 Bắt đầu giải mã nhật ký của tôi:", diary.id);
    if (!user || decrypted[diary.id]) {
      console.log("❌ Không thể giải mã: user không tồn tại hoặc đã giải mã");
      return;
    }
    setDecrypting(diary.id);

    try {
      const uid = user.uid;
      const storageKey = `cozy:private-key:${uid}`;
      const privateKey = localStorage.getItem(storageKey);

      if (!privateKey) {
        throw new Error("Không tìm thấy khóa riêng tư trong localStorage. Vui lòng đăng nhập lại để tạo khóa mới.");
      }

      const title = await decryptMessage(diary.encryptedTitle, privateKey);
      const contentJson = await decryptMessage(diary.encryptedContent, privateKey);
      const { content, mood } = JSON.parse(contentJson);

      setDecrypted((prev) => ({
        ...prev,
        [diary.id]: { title, content, mood },
      }));

      await update(ref(db, `sharedDiaries/${user.uid}/${diary.id}`), { isRead: true });

      toast.success("Đã giải mã nhật ký thành công!");
    } catch (err: any) {
      console.error("❌ Decrypt error:", err);
      toast.error(err.message || "Giải mã thất bại. Sai khóa hoặc dữ liệu lỗi.");
    } finally {
      setDecrypting(null);
    }
  };

  // Xử lý di chuyển nhật ký vào thùng rác (Soft Delete)
  const handleMoveToTrash = async (diary: ReceivedDiary | SentDiary, isReceived: boolean) => {
    const confirmed = window.confirm("Bạn có chắc chắn muốn chuyển nhật ký này vào thùng rác?");
    if (!confirmed) return;

    try {
      const path = isReceived 
        ? `sharedDiaries/${user?.uid}/${diary.id}`
        : `sentDiaries/${user?.uid}/${diary.id}`;

      await update(ref(db, path), {
        isTrashed: true,
        trashedAt: Date.now(),
      });

      toast.success("Đã chuyển nhật ký vào thùng rác!");
    } catch (err: any) {
      console.error("❌ Move to trash error:", err);
      toast.error("Lỗi khi chuyển vào thùng rác. Vui lòng thử lại.");
    }
  };

  // Xử lý bấm nút trả lời - Bản fix bay sang tab "Chia sẻ"
  const handleReply = (diary: ReceivedDiary) => {
    // 1. Lưu thông tin người nhận vào kho tạm
    localStorage.setItem("cozy_reply_target", JSON.stringify({
      uid: diary.fromUid,
      name: diary.fromName
    }));

    // 2. Bắn "pháo hiệu" để SendDiary chuẩn bị hứng
    window.dispatchEvent(new Event("trigger_compose_diary"));

    // 3. Phát Custom Event để chuyển tab chính
    window.dispatchEvent(new CustomEvent('change_main_tab', { detail: 'shared' }));
    
    toast.success(`Đang chuyển sang Chia sẻ để trả lời ${diary.fromName}...`);
  };

  if (loading) {
    return (
      <div className="glass-card p-8 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{t("myDiaries.title")}</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-secondary/30 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-primary" />
        <h3 className="font-semibold text-foreground text-xl">{t("myDiaries.title")}</h3>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="inbox" className="flex items-center gap-2 text-sm">
            <Inbox className="w-5 h-5" />
            {t("myDiaries.inbox", { count: receivedDiaries.length })}
          </TabsTrigger>
          <TabsTrigger value="outbox" className="flex items-center gap-2 text-sm">
            <Send className="w-5 h-5" />
            {t("myDiaries.outbox", { count: sentDiaries.length })}
          </TabsTrigger>
        </TabsList>

        {/* Inbox - Nhật ký nhận được */}
        <TabsContent value="inbox" className="mt-6">
          {receivedDiaries.length === 0 ? (
            <div className="text-center py-10">
              <Inbox className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-base">{t("myDiaries.emptyReceived")}</p>
              <p className="text-sm text-muted-foreground/70 mt-3">
                {t("myDiaries.emptyReceivedDetail")}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {receivedDiaries.map((diary) => {
                const dec = decrypted[diary.id];
                return (
                  <div
                    key={diary.id}
                    className="border border-border rounded-xl p-6 bg-secondary/20 hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-base font-medium text-foreground">
                            {t("myDiaries.from")}: {diary.fromName}
                          </span>
                          {!diary.isRead && !dec && (
                            <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                          )}
                          <span className="text-sm text-muted-foreground">
                            {new Date(diary.createdAt).toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>

                        {dec ? (
                          <div className="animate-fade-in">
                            <div className="flex items-center gap-2 mb-3">
                              <Unlock className="w-5 h-5 text-mood-calm" />
                              <span className="text-sm text-mood-calm font-medium">{t("myDiaries.decrypted")}</span>
                              {dec.mood && (
                                <span className={`mood-chip ${MOOD_CONFIG[dec.mood]?.colorClass}`}>
                                  {MOOD_CONFIG[dec.mood]?.emoji} {MOOD_CONFIG[dec.mood]?.label}
                                </span>
                              )}
                            </div>
                            <h4 className="font-display font-semibold text-foreground text-lg mb-3">
                              {dec.title}
                            </h4>
                            <div 
                              className="mt-3 text-base break-words whitespace-pre-wrap rich-text-content"
                              dangerouslySetInnerHTML={{ __html: forceRichTextStyles(dec.content || '') }}
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Lock className="w-5 h-5 text-accent" />
                             <span className="text-sm text-accent font-medium">{t("myDiaries.rsaEncrypted", "Đã mã hóa RSA")}</span>
                            </div>
                            <div className="bg-secondary/50 rounded-lg p-4">
                              <code className="text-sm text-muted-foreground break-all line-clamp-3">
                                {diary.encryptedTitle.slice(0, 150)}...
                              </code>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Nút bấm (Giải mã / Trả lời / Xóa) */}
                      <div className="flex items-center gap-3 shrink-0 mt-3 sm:mt-0">
                        {!dec ? (
                          <button
                            onClick={() => handleDecrypt(diary)}
                            disabled={decrypting === diary.id}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium border border-primary/30 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                            title={t("myDiaries.decryptTitle")}
                          >
                            <Unlock className="w-4 h-4" />
                            {decrypting === diary.id ? t("myDiaries.decrypting") : t("myDiaries.decrypt")}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReply(diary)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium border border-blue-400/30 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm transition-all duration-200"
                            title="Trả lời nhật ký này"
                          >
                            <Reply className="w-4 h-4" />
                             {t("myDiaries.reply", "Trả lời")}
                          </button>
                        )}
                        <button
                          onClick={() => handleMoveToTrash(diary, true)}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500 text-red-500 text-sm font-medium hover:-translate-y-0.5 hover:shadow-md hover:bg-red-50 active:translate-y-0 active:shadow-sm transition-all duration-200 dark:hover:bg-red-950/30"
                          title="Chuyển vào thùng rác"
                        >
                          <Trash2 className="w-4 h-4" />
                           {t("myDiaries.delete", "Xóa")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Outbox - Nhật ký đã gửi */}
        <TabsContent value="outbox" className="mt-6">
          {sentDiaries.length === 0 ? (
            <div className="text-center py-10">
              <Send className="w-14 h-14 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground text-base">{t("myDiaries.emptySent")}</p>
              <p className="text-sm text-muted-foreground/70 mt-3">
                {t("myDiaries.emptySentDetail")}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sentDiaries.map((diary) => (
                <div
                  key={diary.id}
                  className="border border-border rounded-xl p-6 bg-secondary/20 hover:bg-secondary/30 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base font-medium text-foreground">
                          {t("myDiaries.sentTo")}: {diary.toName}
                        </span>
                        <span className="text-sm text-muted-foreground">
                          {new Date(diary.createdAt).toLocaleDateString("vi-VN", {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Lock className="w-5 h-5 text-accent" />
                           <span className="text-sm text-accent font-medium">{t("myDiaries.rsaEncrypted", "Đã mã hóa RSA")}</span>
                          {diary.mood && (
                            <span className={`mood-chip ${MOOD_CONFIG[diary.mood]?.colorClass}`}>
                              {MOOD_CONFIG[diary.mood]?.emoji} {MOOD_CONFIG[diary.mood]?.label}
                            </span>
                          )}
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-4">
                          <code className="text-sm text-muted-foreground break-all line-clamp-3">
                            {diary.encryptedTitle.slice(0, 150)}...
                          </code>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleMoveToTrash(diary, false)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500 text-red-500 text-sm font-medium hover:-translate-y-0.5 hover:shadow-md hover:bg-red-50 active:translate-y-0 active:shadow-sm transition-all duration-200 shrink-0 dark:hover:bg-red-950/30"
                      title="Chuyển vào thùng rác"
                    >
                      <Trash2 className="w-4 h-4" />
                       {t("myDiaries.delete", "Xóa")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}