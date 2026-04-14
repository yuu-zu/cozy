import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ref, onValue, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { decryptMessage } from "@/lib/crypto";
import { forceRichTextStyles } from "@/lib/utils";
import { MOOD_CONFIG, Mood } from "@/types/diary";
import { Lock, Unlock, BookOpen, Send, Inbox, Trash2, Reply, Eye } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfirmDialog from "@/components/ConfirmDialog";

interface ReceivedDiary {
  id: string;
  fromUid: string;
  fromName: string;
  encryptedTitle: string;
  encryptedContent: string;
  createdAt: number;
  isRead: boolean;
  isDecrypted: boolean;
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
  sourceTitle?: string;
  isTrashed?: boolean;
  trashedAt?: number;
}

interface DecryptedDiary {
  title: string;
  content: string;
  mood: Mood;
}

interface TrashTarget {
  diary: ReceivedDiary | SentDiary;
  isReceived: boolean;
}

type ReceivedDiaryStatus = "new" | "decrypted_unread" | "read";
type SharedDiaryRecord = {
  fromUid?: string;
  fromName?: string;
  encryptedTitle?: string;
  encryptedContent?: string;
  createdAt?: number;
  isRead?: boolean;
  isDecrypted?: boolean;
  isTrashed?: boolean;
  trashedAt?: number;
};
type SentDiaryRecord = {
  toUid?: string;
  toName?: string;
  encryptedTitle?: string;
  encryptedContent?: string;
  mood?: Mood;
  createdAt?: number;
  sourceTitle?: string;
  isTrashed?: boolean;
  trashedAt?: number;
};

interface Props {
  highlightedDiaryId?: string | null;
}

export default function MyDiaries({ highlightedDiaryId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [receivedDiaries, setReceivedDiaries] = useState<ReceivedDiary[]>([]);
  const [sentDiaries, setSentDiaries] = useState<SentDiary[]>([]);
  const [decrypted, setDecrypted] = useState<Record<string, DecryptedDiary>>({});
  const [decrypting, setDecrypting] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [trashTarget, setTrashTarget] = useState<TrashTarget | null>(null);
  const [activeMailboxTab, setActiveMailboxTab] = useState<"inbox" | "outbox">("inbox");

  useEffect(() => {
    if (!user?.uid) return;

    const sharedDiariesRef = ref(db, `sharedDiaries/${user.uid}`);
    const unsubscribe = onValue(sharedDiariesRef, (snapshot) => {
      const data = snapshot.val();

      if (!data || typeof data !== "object") {
        setReceivedDiaries([]);
      } else {
        const diaries = Object.entries(data)
          .map(([id, value]) => {
            const diaryValue = value as SharedDiaryRecord;
            return {
              id,
              fromUid: diaryValue.fromUid || "",
              fromName: diaryValue.fromName || t("dashboard.tab.myDiaries"),
              encryptedTitle: diaryValue.encryptedTitle || "",
              encryptedContent: diaryValue.encryptedContent || "",
              createdAt: diaryValue.createdAt || Date.now(),
              isRead: Boolean(diaryValue.isRead),
              isDecrypted: Boolean(diaryValue.isDecrypted),
              isTrashed: Boolean(diaryValue.isTrashed),
              trashedAt: diaryValue.trashedAt,
            } as ReceivedDiary;
          })
          .filter((diary) => !diary.isTrashed)
          .sort((a, b) => b.createdAt - a.createdAt);

        setReceivedDiaries(diaries);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, t]);

  useEffect(() => {
    if (!highlightedDiaryId) return;

    setActiveMailboxTab("inbox");
    const element = document.querySelector(`[data-diary-id="${highlightedDiaryId}"]`);
    if (element instanceof HTMLElement) {
      window.setTimeout(() => {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 150);
    }
  }, [highlightedDiaryId, receivedDiaries.length]);

  useEffect(() => {
    if (!user?.uid) return;

    const sentDiariesRef = ref(db, `sentDiaries/${user.uid}`);
    const unsubscribe = onValue(sentDiariesRef, (snapshot) => {
      const data = snapshot.val();

      if (!data || typeof data !== "object") {
        setSentDiaries([]);
      } else {
        const diaries = Object.entries(data)
          .map(([id, value]) => {
            const diaryValue = value as SentDiaryRecord;
            return {
              id,
              toUid: diaryValue.toUid || "",
              toName: diaryValue.toName || t("dashboard.tab.myDiaries"),
              encryptedTitle: diaryValue.encryptedTitle || "",
              encryptedContent: diaryValue.encryptedContent || "",
              mood: diaryValue.mood || "calm",
              createdAt: diaryValue.createdAt || Date.now(),
              sourceTitle: diaryValue.sourceTitle,
              isTrashed: Boolean(diaryValue.isTrashed),
              trashedAt: diaryValue.trashedAt,
            } as SentDiary;
          })
          .filter((diary) => !diary.isTrashed)
          .sort((a, b) => b.createdAt - a.createdAt);

        setSentDiaries(diaries);
      }
    });

    return () => unsubscribe();
  }, [user?.uid, t]);

  const getDiaryStatus = (diary: ReceivedDiary): ReceivedDiaryStatus => {
    if (diary.isRead) return "read";
    if (diary.isDecrypted) return "decrypted_unread";
    return "new";
  };

  const handleDecrypt = async (diary: ReceivedDiary) => {
    if (!user || decrypted[diary.id]) return;
    setDecrypting(diary.id);

    try {
      const uid = user.uid;
      const storageKey = `cozy:private-key:${uid}`;
      const privateKey = localStorage.getItem(storageKey);

      if (!privateKey) {
        throw new Error(
          "Khong tim thay khoa rieng tu trong local storage. Vui long dang nhap lai de tao khoa moi.",
        );
      }

      const title = await decryptMessage(diary.encryptedTitle, privateKey);
      const contentJson = await decryptMessage(diary.encryptedContent, privateKey);
      const { content, mood } = JSON.parse(contentJson);

      setDecrypted((prev) => ({
        ...prev,
        [diary.id]: { title, content, mood },
      }));

      await update(ref(db, `sharedDiaries/${user.uid}/${diary.id}`), { isDecrypted: true });

      toast.success(t("myDiaries.decryptSuccess"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("myDiaries.decryptError");
      console.error("Decrypt error:", err);
      toast.error(message || t("myDiaries.decryptError"));
    } finally {
      setDecrypting(null);
    }
  };

  const handleMarkAsRead = async (diaryId: string) => {
    if (!user) return;
    setMarkingRead(diaryId);

    try {
      await update(ref(db, `sharedDiaries/${user.uid}/${diaryId}`), { isRead: true });
      toast.success(t("myDiaries.markReadSuccess"));
    } catch (err) {
      console.error("Mark read error:", err);
      toast.error(t("myDiaries.markReadError"));
    } finally {
      setMarkingRead(null);
    }
  };

  const confirmMoveToTrash = async () => {
    if (!trashTarget || !user) return;

    try {
      const { diary, isReceived } = trashTarget;
      const path = isReceived
        ? `sharedDiaries/${user.uid}/${diary.id}`
        : `sentDiaries/${user.uid}/${diary.id}`;

      await update(ref(db, path), {
        isTrashed: true,
        trashedAt: Date.now(),
      });

      toast.success(t("myDiaries.moveToTrashSuccess"));
    } catch (err: unknown) {
      console.error("Move to trash error:", err);
      toast.error(t("myDiaries.moveToTrashError"));
    } finally {
      setTrashTarget(null);
    }
  };

  const handleReply = (diary: ReceivedDiary) => {
    localStorage.setItem(
      "cozy_share_target",
      JSON.stringify({
        uid: diary.fromUid,
      }),
    );

    window.dispatchEvent(new Event("trigger_compose_diary"));
    window.dispatchEvent(new CustomEvent("change_main_tab", { detail: "shared" }));

    toast.success(t("myDiaries.replyingTo", { name: diary.fromName }));
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

      <Tabs value={activeMailboxTab} onValueChange={(value) => setActiveMailboxTab(value as "inbox" | "outbox")} className="w-full">
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
                const status = getDiaryStatus(diary);
                const containerClass =
                  status === "new"
                    ? "border-primary/30 bg-primary/10"
                    : status === "decrypted_unread"
                      ? "border-amber-500/30 bg-amber-500/10"
                      : "border-border bg-secondary/20 opacity-90";
                const badgeClass =
                  status === "new"
                    ? "bg-primary text-primary-foreground"
                    : status === "decrypted_unread"
                      ? "bg-amber-500 text-white"
                      : "bg-secondary text-muted-foreground";
                const badgeLabel =
                  status === "new"
                    ? t("myDiaries.status_new")
                    : status === "decrypted_unread"
                      ? t("myDiaries.status_decrypted_unread")
                      : t("myDiaries.status_read");

                return (
                  <div
                    key={diary.id}
                    data-diary-id={diary.id}
                    className={`border rounded-xl p-6 transition-colors ${
                      highlightedDiaryId === diary.id ? "ring-2 ring-primary/40" : ""
                    } ${containerClass}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className="text-base font-medium text-foreground">
                            {t("myDiaries.from")}: {diary.fromName}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                            {badgeLabel}
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

                        {dec ? (
                          <div className="animate-fade-in">
                            <div className="flex items-center gap-2 mb-3 flex-wrap">
                              <Unlock className="w-5 h-5 text-mood-calm" />
                              <span className="text-sm text-mood-calm font-medium">
                                {t("myDiaries.decrypted")}
                              </span>
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
                              dangerouslySetInnerHTML={{ __html: forceRichTextStyles(dec.content || "") }}
                            />
                          </div>
                        ) : (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Lock className="w-5 h-5 text-accent" />
                              <span className="text-sm text-accent font-medium">
                                {t("myDiaries.rsaEncrypted")}
                              </span>
                            </div>
                            <div className="bg-secondary/50 rounded-lg p-4">
                              <code className="text-sm text-muted-foreground break-all line-clamp-3">
                                {diary.encryptedTitle.slice(0, 150)}...
                              </code>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-3 shrink-0 mt-3 sm:mt-0 flex-wrap justify-end">
                        {!dec && (
                          <button
                            onClick={() => handleDecrypt(diary)}
                            disabled={decrypting === diary.id}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium border border-primary/30 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
                            title={t("myDiaries.decryptTitle")}
                          >
                            <Unlock className="w-4 h-4" />
                            {decrypting === diary.id ? t("myDiaries.decrypting") : t("myDiaries.decrypt")}
                          </button>
                        )}

                        {dec && !diary.isRead && (
                          <button
                            onClick={() => handleMarkAsRead(diary.id)}
                            disabled={markingRead === diary.id}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white text-sm font-medium border border-amber-400/30 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm transition-all duration-200 disabled:opacity-50"
                            title={t("myDiaries.markReadTitle")}
                          >
                            <Eye className="w-4 h-4" />
                            {markingRead === diary.id ? t("myDiaries.markingRead") : t("myDiaries.markRead")}
                          </button>
                        )}

                        {dec && (
                          <button
                            onClick={() => handleReply(diary)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium border border-blue-400/30 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:shadow-sm transition-all duration-200"
                            title={t("myDiaries.replyTitle")}
                          >
                            <Reply className="w-4 h-4" />
                            {t("myDiaries.reply")}
                          </button>
                        )}

                        <button
                          onClick={() => setTrashTarget({ diary, isReceived: true })}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500 text-red-500 text-sm font-medium hover:-translate-y-0.5 hover:shadow-md hover:bg-red-50 active:translate-y-0 active:shadow-sm transition-all duration-200 dark:hover:bg-red-950/30"
                          title={t("myDiaries.trashTitle")}
                        >
                          <Trash2 className="w-4 h-4" />
                          {t("myDiaries.delete")}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

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
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
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

                      {diary.sourceTitle && (
                        <p className="text-sm font-medium text-foreground mb-3">
                          {t("myDiaries.sharedEntry")}: {diary.sourceTitle}
                        </p>
                      )}

                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <Lock className="w-5 h-5 text-accent" />
                          <span className="text-sm text-accent font-medium">
                            {t("myDiaries.rsaEncrypted")}
                          </span>
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
                      onClick={() => setTrashTarget({ diary, isReceived: false })}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500 text-red-500 text-sm font-medium hover:-translate-y-0.5 hover:shadow-md hover:bg-red-50 active:translate-y-0 active:shadow-sm transition-all duration-200 shrink-0 dark:hover:bg-red-950/30"
                      title={t("myDiaries.trashTitle")}
                    >
                      <Trash2 className="w-4 h-4" />
                      {t("myDiaries.delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!trashTarget}
        onOpenChange={(open) => {
          if (!open) setTrashTarget(null);
        }}
        title={t("myDiaries.moveToTrashConfirmTitle")}
        description={t("myDiaries.moveToTrashConfirmDescription")}
        confirmLabel={t("myDiaries.delete")}
        cancelLabel={t("settings.cancel")}
        destructive
        onConfirm={() => {
          void confirmMoveToTrash();
        }}
      />
    </div>
  );
}
