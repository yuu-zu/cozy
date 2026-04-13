import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { DiaryEntry, MOOD_CONFIG } from "@/types/diary";
import { forceRichTextStyles } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  entries: DiaryEntry[];
}

export default function DiaryCalendar({ entries }: Props) {
  const { t, i18n } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const entriesByDate = entries.reduce((acc, e) => {
    const key = new Date(e.createdAt).toISOString().split("T")[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {} as Record<string, DiaryEntry[]>);

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const prev = () => setCurrentDate(new Date(year, month - 1, 1));
  const next = () => setCurrentDate(new Date(year, month + 1, 1));

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const selectedEntries = selectedDate ? entriesByDate[selectedDate] || [] : [];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="glass-card p-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prev} className="p-2 rounded-xl hover:bg-secondary text-muted-foreground">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h3 className="font-display font-semibold text-foreground">
            {t("calendar.monthLabel", { month: month + 1, year })}
          </h3>
          <button onClick={next} className="p-2 rounded-xl hover:bg-secondary text-muted-foreground">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground mb-2">
          {["CN", "T2", "T3", "T4", "T5", "T6", "T7"].map((d) => (
            <div key={d} className="py-1 font-medium">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (day === null) return <div key={`empty-${i}`} />;
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayEntries = entriesByDate[dateStr];
            const isToday = new Date().toISOString().split("T")[0] === dateStr;
            const isSelected = selectedDate === dateStr;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center text-sm transition-all ${
                  isSelected ? "bg-primary text-primary-foreground" :
                  isToday ? "bg-primary/10 text-primary font-bold" :
                  "hover:bg-secondary text-foreground"
                }`}
              >
                <span>{day}</span>
                {dayEntries && (
                  <div className="flex gap-0.5 mt-0.5">
                    {dayEntries.slice(0, 3).map((e, idx) => (
                      <span key={idx} className="text-[8px]">{MOOD_CONFIG[e.mood].emoji}</span>
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && selectedEntries.length > 0 && (
        <div className="glass-card p-4 space-y-3 animate-fade-in">
          <h4 className="font-display font-semibold text-foreground">
            {new Date(selectedDate).toLocaleDateString(i18n.language === "vi" ? "vi-VN" : "en-US", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
          </h4>
          {selectedEntries.map((e) => (
            <div key={e.id} className="p-3 rounded-xl bg-secondary/30">
              <div className="flex items-center gap-2 mb-1">
                <span className={`mood-chip ${MOOD_CONFIG[e.mood].colorClass}`}>
                  {MOOD_CONFIG[e.mood].emoji} {t(`mood.${e.mood}`)}
                </span>
              </div>
              <p className="font-medium text-foreground">{e.title}</p>
              <div className="mt-2 text-sm break-words whitespace-pre-wrap rich-text-content" dangerouslySetInnerHTML={{ __html: forceRichTextStyles(e.content) }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
