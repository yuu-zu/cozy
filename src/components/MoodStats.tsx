import React from "react";
import { useTranslation } from "react-i18next";
import { DiaryEntry, Mood, MOOD_CONFIG } from "@/types/diary";

interface Props {
  entries: DiaryEntry[];
}

export default function MoodStats({ entries }: Props) {
  const { t } = useTranslation();
  const moodCount = entries.reduce((acc, e) => {
    acc[e.mood] = (acc[e.mood] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = entries.length;

  // Weekly stats
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const weekEntries = entries.filter((e) => e.createdAt > weekAgo);
  const monthAgo = now - 30 * 24 * 60 * 60 * 1000;
  const monthEntries = entries.filter((e) => e.createdAt > monthAgo);

  // Streak
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    const hasEntry = entries.some(
      (e) => new Date(e.createdAt).toISOString().split("T")[0] === dateStr
    );
    if (hasEntry) streak++;
    else break;
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("moodStats.total"), value: total, emoji: "📝" },
          { label: t("moodStats.weekly"), value: weekEntries.length, emoji: "📅" },
          { label: t("moodStats.monthly"), value: monthEntries.length, emoji: "📊" },
          { label: t("moodStats.streak"), value: streak, emoji: "🔥" },
        ].map((stat) => (
          <div key={stat.label} className="glass-card p-4 text-center">
            <p className="text-2xl mb-1">{stat.emoji}</p>
            <p className="text-2xl font-bold font-display text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Mood distribution */}
      <div className="glass-card p-4">
        <h3 className="font-display font-semibold text-foreground mb-4">{t("moodStats.distribution")}</h3>
        <div className="space-y-3">
          {(Object.keys(MOOD_CONFIG) as Mood[]).map((mood) => {
            const count = moodCount[mood] || 0;
            const percent = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={mood} className="flex items-center gap-3">
                <span className="w-20 text-sm flex items-center gap-1">
                  {MOOD_CONFIG[mood].emoji} {t(`mood.${mood}`)}
                </span>
                <div className="flex-1 h-6 bg-secondary/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${MOOD_CONFIG[mood].colorClass}`}
                    style={{ width: `${percent}%`, minWidth: count > 0 ? "1rem" : 0 }}
                  />
                </div>
                <span className="text-sm text-muted-foreground w-12 text-right">
                  {count} ({Math.round(percent)}%)
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
