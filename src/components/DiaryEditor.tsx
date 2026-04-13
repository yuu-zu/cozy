import React, { useState, useRef, useCallback, useEffect } from "react";
import { DiaryEntry, Mood, MOOD_CONFIG, JOURNAL_PROMPTS } from "@/types/diary";
import { X, Image, Lightbulb, Trash2, Bold, Italic, Underline, Type } from "lucide-react";

interface Props {
  entry: DiaryEntry | null;
  onSave: (entry: Omit<DiaryEntry, "id">) => void;
  onClose: () => void;
}

const FONT_OPTIONS = ["Arial", "Georgia", "Times New Roman", "Courier New", "Verdana"];
const SIZE_OPTIONS = ["1", "2", "3", "4", "5", "6", "7"];
const COLOR_OPTIONS = ["#000000", "#ffffff", "#ef4444", "#22c55e", "#3b82f6", "#eab308", "#a855f7", "#ec4899"];

export default function DiaryEditor({ entry, onSave, onClose }: Props) {
  const [title, setTitle] = useState(entry?.title || "");
  const [mood, setMood] = useState<Mood>(entry?.mood || "neutral");
  const [images, setImages] = useState<string[]>(entry?.images || []);
  const [content, setContent] = useState(entry?.content || "");
  const [showPrompts, setShowPrompts] = useState(false);
  const [showToolbar, setShowToolbar] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Khởi tạo nội dung của editor khi entry tồn tại
  useEffect(() => {
    if (editorRef.current && entry?.content) {
      editorRef.current.innerHTML = entry.content;
      setContent(entry.content);
    }
  }, [entry?.content]);

  // Hàm đồng bộ nội dung HTML từ editor vào state
  const syncContentToState = useCallback(() => {
    if (editorRef.current) {
      const htmlContent = editorRef.current.innerHTML;
      setContent(htmlContent);
      return htmlContent;
    }
    return "";
  }, []);

  const execCmd = useCallback((cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    // NGAY SAU KHI execCommand, đồng bộ HTML vào state
    syncContentToState();
  }, [syncContentToState]);

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      if (file.size > 2 * 1024 * 1024) return;
      const reader = new FileReader();
      reader.onload = () => {
        setImages((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Xử lý sự kiện input trên editor - cập nhật state ngay lập tức
  const handleEditorInput = (e: React.FormEvent<HTMLDivElement>) => {
    const htmlContent = e.currentTarget.innerHTML;
    setContent(htmlContent);
  };

  const handleSave = () => {
    // Đảm bảo state content luôn được cập nhật từ editor trước khi lưu
    const finalContent = editorRef.current?.innerHTML || content;
    
    if (!title.trim() || !finalContent.trim()) return;
    
    onSave({
      title: title.trim(),
      content: finalContent,
      mood,
      images,
      createdAt: entry?.createdAt || Date.now(),
      updatedAt: Date.now(),
    });
  };

  return (
    <div className="glass-card p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-foreground">
          {entry ? "Chỉnh sửa" : "Viết nhật ký"}
        </h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary text-muted-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          placeholder="Tiêu đề..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-lg"
        />

        {/* Mood selector */}
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(MOOD_CONFIG) as Mood[]).map((m) => (
            <button
              key={m}
              onClick={() => setMood(m)}
              className={`mood-chip transition-all ${
                mood === m ? MOOD_CONFIG[m].colorClass + " ring-2 ring-offset-2 ring-offset-card" : "bg-secondary text-muted-foreground"
              }`}
            >
              {MOOD_CONFIG[m].emoji} {MOOD_CONFIG[m].label}
            </button>
          ))}
        </div>

        {/* Prompt */}
        <div className="relative">
          <button
            onClick={() => setShowPrompts(!showPrompts)}
            className="flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <Lightbulb className="w-4 h-4" /> Gợi ý câu hỏi
          </button>
          {showPrompts && (
            <div className="mt-2 glass-card p-3 space-y-1 animate-fade-in">
              {JOURNAL_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => {
                    if (editorRef.current) {
                      editorRef.current.innerHTML += (editorRef.current.innerHTML ? "<br><br>" : "") + p + "<br>";
                      // Cập nhật state ngay sau khi thay đổi editor
                      syncContentToState();
                    }
                    setShowPrompts(false);
                  }}
                  className="block text-left text-sm text-muted-foreground hover:text-foreground transition-colors w-full p-1.5 rounded-lg hover:bg-secondary/50"
                >
                  💡 {p}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Rich text toolbar */}
        <div className="space-y-2">
          <div className="flex items-center gap-1 flex-wrap">
            <button onClick={() => execCmd("bold")} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground" title="In đậm">
              <Bold className="w-4 h-4" />
            </button>
            <button onClick={() => execCmd("italic")} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground" title="In nghiêng">
              <Italic className="w-4 h-4" />
            </button>
            <button onClick={() => execCmd("underline")} className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground" title="Gạch chân">
              <Underline className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-border mx-1" />
            <select
              onChange={(e) => {
                execCmd("fontName", e.target.value);
                e.target.value = ""; // Reset select
              }}
              className="px-2 py-1 rounded-lg bg-secondary/50 border border-border text-xs text-foreground"
              defaultValue=""
            >
              <option value="" disabled>Font</option>
              {FONT_OPTIONS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
            <select
              onChange={(e) => {
                execCmd("fontSize", e.target.value);
                e.target.value = ""; // Reset select
              }}
              className="px-2 py-1 rounded-lg bg-secondary/50 border border-border text-xs text-foreground"
              defaultValue=""
            >
              <option value="" disabled>Cỡ</option>
              {SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <div className="flex gap-1 ml-1">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={() => execCmd("foreColor", c)}
                  className="w-5 h-5 rounded-full border border-border hover:scale-110 transition-transform"
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

          {/* Content editor */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleEditorInput}
            className="w-full min-h-[180px] px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none overflow-y-auto"
            style={{ maxHeight: "300px" }}
          />
        </div>

        {/* Images */}
        {images.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {images.map((img, i) => (
              <div key={i} className="relative group w-20 h-20 rounded-xl overflow-hidden">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute inset-0 bg-foreground/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-4 h-4 text-primary-foreground" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            <Image className="w-4 h-4" /> Đính kèm ảnh
          </button>
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={handleImageAdd} />
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="px-6 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-all disabled:opacity-50"
          >
            {entry ? "Cập nhật" : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}
