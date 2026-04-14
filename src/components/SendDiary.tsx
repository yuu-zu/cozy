import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ref, onValue, push, set, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { DiaryEntry, Friend } from "@/types/diary";
import { encryptMessage } from "@/lib/crypto";
import { Send, AlertCircle, BookOpen, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createNotification } from "@/lib/notifications";

interface ShareTargetPayload {
  uid?: string;
  entryId?: string;
}

interface Props {
  entries: DiaryEntry[];
}

type ContactRecord = {
  displayName?: string;
  publicKey?: string;
};

type UserRecord = {
  displayName?: string;
};

export default function SendDiary({ entries }: Props) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendUid, setSelectedFriendUid] = useState<string>("");
  const [selectedEntryId, setSelectedEntryId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    const handlePrefillCompose = () => {
      const targetData = localStorage.getItem("cozy_share_target");
      if (!targetData) return;

      const payload = JSON.parse(targetData) as ShareTargetPayload;
      if (payload.uid) setSelectedFriendUid(payload.uid);
      if (payload.entryId) setSelectedEntryId(payload.entryId);
      localStorage.removeItem("cozy_share_target");
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

    window.addEventListener("trigger_compose_diary", handlePrefillCompose);
    handlePrefillCompose();

    return () => window.removeEventListener("trigger_compose_diary", handlePrefillCompose);
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const contactsRef = ref(db, `contacts/${user.uid}`);
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || typeof data !== "object") {
        setFriends([]);
        setLoading(false);
        return;
      }

      const nextFriends = Object.entries(data).map(([uid, value]) => {
        const contact = value as ContactRecord;
        return {
          uid,
          displayName: contact.displayName || t("dashboard.tab.myDiaries"),
          publicKey: contact.publicKey || "",
        };
      });

      setFriends(nextFriends);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, t]);

  const shareableEntries = useMemo(
    () =>
      [...entries]
        .filter((entry) => !entry.isTrashed)
        .sort((a, b) => b.createdAt - a.createdAt),
    [entries],
  );

  const selectedEntry = shareableEntries.find((entry) => entry.id === selectedEntryId);

  const handleSendDiary = async () => {
    if (!user || !selectedFriendUid) {
      toast.error(t("sendDiary.noFriends"));
      return;
    }

    if (!selectedEntry) {
      toast.error(t("sendDiary.selectDiary"));
      return;
    }

    const selectedFriend = friends.find((friend) => friend.uid === selectedFriendUid);
    if (!selectedFriend) {
      toast.error(t("sendDiary.noFriends"));
      return;
    }

    setIsSending(true);

    try {
      const senderSnapshot = await get(ref(db, `users/${user.uid}`));
      if (!senderSnapshot.exists()) throw new Error(t("sendDiary.noFriends"));

      const senderData = senderSnapshot.val() as UserRecord;
      const senderName = senderData.displayName || user.displayName || t("dashboard.tab.myDiaries");
      const encryptedTitle = await encryptMessage(selectedEntry.title, selectedFriend.publicKey);
      const contentPayload = JSON.stringify({
        content: selectedEntry.content,
        mood: selectedEntry.mood,
      });
      const encryptedContent = await encryptMessage(contentPayload, selectedFriend.publicKey);

      const entryId = push(ref(db, "sharedDiaries")).key || `entry_${Date.now()}`;

      await set(ref(db, `sharedDiaries/${selectedFriendUid}/${entryId}`), {
        fromUid: user.uid,
        fromName: senderName,
        encryptedTitle,
        encryptedContent,
        createdAt: Date.now(),
        isRead: false,
        isDecrypted: false,
        sourceEntryId: selectedEntry.id,
        sourceTitle: selectedEntry.title,
      });

      await set(ref(db, `sentDiaries/${user.uid}/${entryId}`), {
        toUid: selectedFriendUid,
        toName: selectedFriend.displayName,
        encryptedTitle,
        encryptedContent,
        mood: selectedEntry.mood,
        createdAt: Date.now(),
        sourceEntryId: selectedEntry.id,
        sourceTitle: selectedEntry.title,
      });

      await createNotification({
        userUid: selectedFriendUid,
        type: "diary_shared",
        title: t("notifications.diary_shared_title"),
        message: t("notifications.diary_shared_message", {
          name: senderName,
        }),
        targetId: entryId,
      });

      toast.success(t("sendDiary.sent_toast", { name: selectedFriend.displayName }));
      setSelectedFriendUid("");
      setSelectedEntryId("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("sendDiary.send");
      console.error("Send diary error:", err);
      toast.error(message || t("sendDiary.send"));
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{t("sendDiary.title")}</h3>
        </div>
        <div className="space-y-3">
          <div className="h-10 bg-secondary/30 rounded-xl animate-pulse" />
          <div className="h-24 bg-secondary/30 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="glass-card p-8 animate-fade-in">
        <div className="flex items-start gap-4 p-6 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive text-base">{t("sendDiary.noFriends")}</p>
            <p className="text-sm text-destructive/80 mt-2">{t("sendDiary.noFriendsDetail")}</p>
          </div>
        </div>
      </div>
    );
  }

  if (shareableEntries.length === 0) {
    return (
      <div className="glass-card p-8 animate-fade-in">
        <div className="flex items-start gap-4 p-6 rounded-lg bg-secondary/30 border border-border">
          <BookOpen className="w-6 h-6 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-foreground text-base">{t("sendDiary.noDiaries")}</p>
            <p className="text-sm text-muted-foreground mt-2">{t("sendDiary.noDiariesDetail")}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-2">
        <Send className="w-6 h-6 text-primary" />
        <h3 className="font-semibold text-foreground text-xl">{t("sendDiary.title")}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-6">{t("sendDiary.helperText")}</p>

      <div className="space-y-6">
        <div>
          <label className="block text-base font-medium text-foreground mb-3">{t("sendDiary.sendToLabel")}</label>
          <select
            value={selectedFriendUid}
            onChange={(e) => setSelectedFriendUid(e.target.value)}
            disabled={isSending}
            className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-base text-foreground focus:border-primary outline-none disabled:opacity-50"
          >
            <option value="">-- {t("sendDiary.selectFriend")} --</option>
            {friends.map((friend) => (
              <option key={friend.uid} value={friend.uid}>
                {friend.displayName}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-base font-medium text-foreground mb-3">{t("sendDiary.diaryListLabel")}</label>
          <div className="space-y-3 max-h-[24rem] overflow-y-auto pr-1">
            {shareableEntries.map((entry) => {
              const isSelected = entry.id === selectedEntryId;
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => setSelectedEntryId(entry.id)}
                  disabled={isSending}
                  className={`w-full text-left rounded-2xl border p-4 transition-colors disabled:opacity-50 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-border bg-secondary/20 hover:bg-secondary/35"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={`truncate ${isSelected ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
                        {entry.title || t("trashBin.untitled")}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {new Date(entry.createdAt).toLocaleDateString(
                          i18n.language === "vi" ? "vi-VN" : "en-US",
                          {
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}
                      </p>
                    </div>
                    {isSelected && <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {selectedEntry && (
          <div className="rounded-2xl border border-border bg-secondary/20 p-4">
            <p className="text-sm font-medium text-foreground">{t("sendDiary.selectedDiary")}</p>
            <p className="text-sm text-muted-foreground mt-1">{selectedEntry.title || t("trashBin.untitled")}</p>
          </div>
        )}

        <button
          onClick={handleSendDiary}
          disabled={isSending || !selectedFriendUid || !selectedEntryId}
          className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-primary text-primary-foreground text-base font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Send className="w-5 h-5" />
          {isSending ? t("sendDiary.sending") : t("sendDiary.send")}
        </button>
      </div>
    </div>
  );
}
