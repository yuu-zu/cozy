import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ref, onValue, update, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { forceRichTextStyles } from "@/lib/utils";
import { MOOD_CONFIG, Mood } from "@/types/diary";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface TrashedDiary {
  id: string;
  type: "personal" | "received" | "sent"; // Loại nhật ký
  title?: string;
  encryptedTitle?: string;
  content?: string;
  encryptedContent?: string;
  mood?: Mood;
  fromName?: string; // Cho received diaries
  toName?: string; // Cho sent diaries
  createdAt: number;
  trashedAt: number;
  isTrashed: boolean;
}

export default function TrashBin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [trashedDiaries, setTrashedDiaries] = useState<TrashedDiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);

  // Lắng nghe trashed diaries từ cả 3 nguồn: personal, received, sent
  useEffect(() => {
    if (!user?.uid) return;

    const allTrashedDiaries: TrashedDiary[] = [];
    let completedSources = 0;

    // 1. Lắng nghe personal diaries (isTrashed === true)
    const personalDiariesRef = ref(db, `diaries/${user.uid}`);
    const unsubPersonal = onValue(personalDiariesRef, (snapshot) => {
      const data = snapshot.val();
      const personalTrashed = data
        ? Object.entries(data)
            .filter(([, value]: [string, any]) => value.isTrashed === true)
            .map(([id, value]: [string, any]) => ({
              id,
              type: "personal" as const,
              title: value.title,
              mood: value.mood,
              createdAt: value.createdAt || Date.now(),
              trashedAt: value.trashedAt || Date.now(),
              isTrashed: true,
            }))
        : [];

      // Cập nhật danh sách personal trashed
      setTrashedDiaries((prev) => {
        const nonPersonal = prev.filter((d) => d.type !== "personal");
        return [...nonPersonal, ...personalTrashed];
      });

      completedSources++;
      if (completedSources === 3) setLoading(false);
    });

    // 2. Lắng nghe received shared diaries (isTrashed === true)
    const receivedDiariesRef = ref(db, `sharedDiaries/${user.uid}`);
    const unsubReceived = onValue(receivedDiariesRef, (snapshot) => {
      const data = snapshot.val();
      const receivedTrashed = data
        ? Object.entries(data)
            .filter(([, value]: [string, any]) => value.isTrashed === true)
            .map(([id, value]: [string, any]) => ({
              id,
              type: "received" as const,
              encryptedTitle: value.encryptedTitle,
              fromName: value.fromName || "User",
              createdAt: value.createdAt || Date.now(),
              trashedAt: value.trashedAt || Date.now(),
              isTrashed: true,
            }))
        : [];

      setTrashedDiaries((prev) => {
        const nonReceived = prev.filter((d) => d.type !== "received");
        return [...nonReceived, ...receivedTrashed];
      });

      completedSources++;
      if (completedSources === 3) setLoading(false);
    });

    // 3. Lắng nghe sent shared diaries (isTrashed === true)
    const sentDiariesRef = ref(db, `sentDiaries/${user.uid}`);
    const unsubSent = onValue(sentDiariesRef, (snapshot) => {
      const data = snapshot.val();
      const sentTrashed = data
        ? Object.entries(data)
            .filter(([, value]: [string, any]) => value.isTrashed === true)
            .map(([id, value]: [string, any]) => ({
              id,
              type: "sent" as const,
              encryptedTitle: value.encryptedTitle,
              toName: value.toName || "User",
              mood: value.mood,
              createdAt: value.createdAt || Date.now(),
              trashedAt: value.trashedAt || Date.now(),
              isTrashed: true,
            }))
        : [];

      setTrashedDiaries((prev) => {
        const nonSent = prev.filter((d) => d.type !== "sent");
        return [...nonSent, ...sentTrashed];
      });

      completedSources++;
      if (completedSources === 3) setLoading(false);
    });

    return () => {
      unsubPersonal();
      unsubReceived();
      unsubSent();
    };
  }, [user?.uid]);

  // Xử lý khôi phục nhật ký (Restore)
  const handleRestore = async (diary: TrashedDiary) => {
    const confirmed = window.confirm("Restore this diary?");
    if (!confirmed) return;

    setRestoring(diary.id);
    try {
      const path =
        diary.type === "personal"
          ? `diaries/${user?.uid}/${diary.id}`
          : diary.type === "received"
            ? `sharedDiaries/${user?.uid}/${diary.id}`
            : `sentDiaries/${user?.uid}/${diary.id}`;

      await update(ref(db, path), {
        isTrashed: false,
        trashedAt: null,
      });

      toast.success("Diary restored!");
      setTrashedDiaries((prev) => prev.filter((d) => d.id !== diary.id));
    } catch (err: any) {
      console.error("❌ Restore error:", err);
      toast.error("Failed to restore diary. Please try again.");
    } finally {
      setRestoring(null);
    }
  };

  // Xử lý xóa vĩnh viễn (Permanent Delete)
  const handlePermanentDelete = async (diary: TrashedDiary) => {
    const confirmed = window.confirm(
      "Are you sure you want to permanently delete this diary? This action cannot be undone."
    );
    if (!confirmed) return;

    setDeleting(diary.id);
    try {
      const path =
        diary.type === "personal"
          ? `diaries/${user?.uid}/${diary.id}`
          : diary.type === "received"
            ? `sharedDiaries/${user?.uid}/${diary.id}`
            : `sentDiaries/${user?.uid}/${diary.id}`;

      await remove(ref(db, path));

      toast.success("Diary deleted permanently!");
      setTrashedDiaries((prev) => prev.filter((d) => d.id !== diary.id));
    } catch (err: any) {
      console.error("❌ Delete error:", err);
      toast.error("Failed to delete diary. Please try again.");
    } finally {
      setDeleting(null);
    }
  };

  // Tính ngày còn lại (30 ngày)
  const getDaysLeft = (trashedAt: number): number => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const daysLeftMs = thirtyDaysMs - (Date.now() - trashedAt);
    return Math.max(0, Math.ceil(daysLeftMs / (24 * 60 * 60 * 1000)));
  };

  // Sắp xếp theo ngày xóa (mới nhất trước)
  const sortedTrashedDiaries = [...trashedDiaries].sort(
    (a, b) => b.trashedAt - a.trashedAt
  );

  if (loading) {
    return (
      <div className="glass-card p-8 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{t('dashboard.tab.trash')}</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-secondary/30 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (sortedTrashedDiaries.length === 0) {
    return (
      <div className="glass-card p-8 animate-fade-in text-center">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{t('dashboard.tab.trash')}</h3>
        </div>
        <Trash2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-muted-foreground font-medium">{t('trashBin.empty')}</p>
        <p className="text-sm text-muted-foreground/70 mt-2">
          {t('trashBin.warning')}
        </p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">{t('dashboard.tab.trash')}</h3>
        <span className="ml-2 text-xs text-muted-foreground">
          ({sortedTrashedDiaries.length})
        </span>
      </div>

      <div className="mb-4 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
        <p className="text-xs text-destructive">
          ⚠️ {t('trashBin.warning')}
        </p>
      </div>

      <div className="space-y-3">
        {sortedTrashedDiaries.map((diary) => {
          const daysLeft = getDaysLeft(diary.trashedAt);
          const typeLabel =
            diary.type === "personal"
              ? "Personal Diary"
              : diary.type === "received"
                ? `From ${diary.fromName}`
                : `Sent to ${diary.toName}`;

          return (
            <div
              key={`${diary.type}-${diary.id}`}
              className="border border-border rounded-xl p-4 bg-secondary/10 hover:bg-secondary/20 transition-colors opacity-80"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground bg-secondary/50 px-2 py-1 rounded">
                      {typeLabel}
                    </span>
                    {diary.mood && (
                      <span className={`mood-chip ${MOOD_CONFIG[diary.mood]?.colorClass}`}>
                        {MOOD_CONFIG[diary.mood]?.emoji} {MOOD_CONFIG[diary.mood]?.label}
                      </span>
                    )}
                    <span className="text-xs text-destructive font-medium ml-auto">
                      ⏱️ {t('trashBin.daysLeft', { count: daysLeft })}
                    </span>
                  </div>

                  <h4 className="font-semibold text-foreground truncate mb-1">
                    {diary.title || "(No title)"}
                  </h4>

                  <div className="text-xs text-muted-foreground">
                    {new Date(diary.trashedAt).toLocaleDateString("vi-VN", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(diary)}
                    disabled={restoring === diary.id}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-primary text-primary text-xs font-medium hover:bg-primary/10 transition-all disabled:opacity-50"
                    title={t('trashBin.restore')}
                  >
                    <RotateCcw className="w-3 h-3" />
                    {restoring === diary.id ? "..." : t('trashBin.restore')}
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(diary)}
                    disabled={deleting === diary.id}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-destructive text-destructive text-xs font-medium hover:bg-destructive/10 transition-all disabled:opacity-50"
                    title={t('trashBin.deleteForever')}
                  >
                    <Trash2 className="w-3 h-3" />
                    {deleting === diary.id ? "..." : t('trashBin.deleteForever')}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
