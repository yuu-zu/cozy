import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ref, onValue, update, remove } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { MOOD_CONFIG, Mood } from "@/types/diary";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmDialog from "@/components/ConfirmDialog";

interface TrashedDiary {
  id: string;
  type: "personal" | "received" | "sent";
  title?: string;
  encryptedTitle?: string;
  mood?: Mood;
  fromName?: string;
  toName?: string;
  createdAt: number;
  trashedAt: number;
  isTrashed: boolean;
}

interface TrashActionState {
  diary: TrashedDiary;
  action: "restore" | "delete";
}

export default function TrashBin() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [trashedDiaries, setTrashedDiaries] = useState<TrashedDiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [actionState, setActionState] = useState<TrashActionState | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const allTrashedDiaries: TrashedDiary[] = [];
    let completedSources = 0;

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

      setTrashedDiaries((prev) => {
        const nonPersonal = prev.filter((d) => d.type !== "personal");
        return [...nonPersonal, ...personalTrashed];
      });

      completedSources++;
      if (completedSources === 3) setLoading(false);
    });

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

  const handleRestore = async (diary: TrashedDiary) => {
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

      toast.success(t("trashBin.restoreSuccess"));
      setTrashedDiaries((prev) => prev.filter((d) => d.id !== diary.id));
    } catch (err: any) {
      console.error("Restore error:", err);
      toast.error(t("trashBin.restoreError"));
    } finally {
      setRestoring(null);
      setActionState(null);
    }
  };

  const handlePermanentDelete = async (diary: TrashedDiary) => {
    setDeleting(diary.id);
    try {
      const path =
        diary.type === "personal"
          ? `diaries/${user?.uid}/${diary.id}`
          : diary.type === "received"
            ? `sharedDiaries/${user?.uid}/${diary.id}`
            : `sentDiaries/${user?.uid}/${diary.id}`;

      await remove(ref(db, path));

      toast.success(t("trashBin.deleteSuccess"));
      setTrashedDiaries((prev) => prev.filter((d) => d.id !== diary.id));
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(t("trashBin.deleteError"));
    } finally {
      setDeleting(null);
      setActionState(null);
    }
  };

  const getDaysLeft = (trashedAt: number): number => {
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const daysLeftMs = thirtyDaysMs - (Date.now() - trashedAt);
    return Math.max(0, Math.ceil(daysLeftMs / (24 * 60 * 60 * 1000)));
  };

  const sortedTrashedDiaries = [...trashedDiaries].sort((a, b) => b.trashedAt - a.trashedAt);

  if (loading) {
    return (
      <div className="glass-card p-8 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">{t("dashboard.tab.trash")}</h3>
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
          <h3 className="font-semibold text-foreground">{t("dashboard.tab.trash")}</h3>
        </div>
        <Trash2 className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-muted-foreground font-medium">{t("trashBin.empty")}</p>
        <p className="text-sm text-muted-foreground/70 mt-2">{t("trashBin.warning")}</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Trash2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-foreground">{t("dashboard.tab.trash")}</h3>
        <span className="ml-2 text-xs text-muted-foreground">({sortedTrashedDiaries.length})</span>
      </div>

      <div className="mb-4 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
        <p className="text-sm text-destructive">{t("trashBin.warning")}</p>
      </div>

      <div className="space-y-3">
        {sortedTrashedDiaries.map((diary) => {
          const daysLeft = getDaysLeft(diary.trashedAt);
          const typeLabel =
            diary.type === "personal"
              ? t("trashBin.type.personal")
              : diary.type === "received"
                ? t("trashBin.type.received", { name: diary.fromName })
                : t("trashBin.type.sent", { name: diary.toName });

          return (
            <div
              key={`${diary.type}-${diary.id}`}
              className="border border-border rounded-xl p-4 bg-secondary/10 hover:bg-secondary/20 transition-colors opacity-90"
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
                      {t("trashBin.daysLeft", { count: daysLeft })}
                    </span>
                  </div>

                  <h4 className="font-semibold text-foreground truncate mb-1">
                    {diary.title || t("trashBin.untitled")}
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
                    onClick={() => setActionState({ diary, action: "restore" })}
                    disabled={restoring === diary.id}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-primary text-primary text-xs font-medium hover:bg-primary/10 transition-all disabled:opacity-50"
                    title={t("trashBin.restore")}
                  >
                    <RotateCcw className="w-3 h-3" />
                    {restoring === diary.id ? "..." : t("trashBin.restore")}
                  </button>
                  <button
                    onClick={() => setActionState({ diary, action: "delete" })}
                    disabled={deleting === diary.id}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg border border-destructive text-destructive text-xs font-medium hover:bg-destructive/10 transition-all disabled:opacity-50"
                    title={t("trashBin.deleteForever")}
                  >
                    <Trash2 className="w-3 h-3" />
                    {deleting === diary.id ? "..." : t("trashBin.deleteForever")}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDialog
        open={!!actionState}
        onOpenChange={(open) => {
          if (!open) setActionState(null);
        }}
        title={
          actionState?.action === "restore"
            ? t("trashBin.restoreConfirmTitle")
            : t("trashBin.deleteConfirmTitle")
        }
        description={
          actionState?.action === "restore"
            ? t("trashBin.restoreConfirmDescription")
            : t("trashBin.deleteConfirmDescription")
        }
        confirmLabel={
          actionState?.action === "restore"
            ? t("trashBin.restore")
            : t("trashBin.deleteForever")
        }
        cancelLabel={t("settings.cancel")}
        destructive={actionState?.action === "delete"}
        onConfirm={() => {
          if (!actionState) return;
          if (actionState.action === "restore") {
            void handleRestore(actionState.diary);
          } else {
            void handlePermanentDelete(actionState.diary);
          }
        }}
      />
    </div>
  );
}
