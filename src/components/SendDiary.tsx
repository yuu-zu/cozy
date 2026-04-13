import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ref, onValue, push, set, get } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Friend, Mood, MOOD_CONFIG } from "@/types/diary";
import { encryptMessage } from "@/lib/crypto";
import { Send, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import Quill from 'quill';

/* ==================================================
   CẤU HÌNH TÙY CHỈNH CHO EDITOR (FONT, SIZE, COLOR)
   ================================================== */

// 1. Cấu hình Font chữ
const Font = Quill.import('formats/font');
const customFonts = ['sans-serif', 'serif', 'monospace', 'times-new-roman', 'roboto', 'dancing-script', 'pacifico'];
Font.whitelist = customFonts;
Quill.register(Font, true);

// 2. Cấu hình Cỡ chữ (Dùng pixel thay vì small/large)
const Size = Quill.import('attributors/style/size');
const customSizes = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '32px'];
Size.whitelist = customSizes;
Quill.register(Size, true);

// 3. Bảng 8 màu chuẩn Tailwind
const customColors = [
  '#000000', // Đen
  '#FFFFFF', // Trắng
  '#EF4444', // Đỏ
  '#22C55E', // Xanh lá
  '#3B82F6', // Xanh dương
  '#EAB308', // Vàng
  '#A855F7', // Tím
  '#EC4899'  // Hồng
];

export default function SendDiary() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriendUid, setSelectedFriendUid] = useState<string>("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [mood, setMood] = useState<Mood>("calm");
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Áp dụng cấu hình vào Toolbar
  const quillModules = {
    toolbar: [
      [{ 'font': customFonts }, { 'size': customSizes }],              // Font và Size
      ['bold', 'italic', 'underline', 'strike'],                       // Định dạng chữ
      [{ 'color': customColors }, { 'background': customColors }],     // Bảng 8 màu
      [{ 'list': 'ordered'}, { 'list': 'bullet' }, { 'align': [] }],   // Căn lề, danh sách
      ['clean']                                                        // Xóa định dạng
    ],
  };

  useEffect(() => {
    const handleReceiveReplySignal = () => {
      const targetData = localStorage.getItem("cozy_reply_target");
      if (targetData) {
        const { uid, name } = JSON.parse(targetData);
        setSelectedFriendUid(uid);
        setTitle(`Re: Nhật ký từ ${name}`);
        localStorage.removeItem("cozy_reply_target");
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener("trigger_compose_diary", handleReceiveReplySignal);
    handleReceiveReplySignal();

    return () => window.removeEventListener("trigger_compose_diary", handleReceiveReplySignal);
  }, [friends]);

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
      const nextFriends = Object.entries(data).map(([uid, value]: [string, any]) => ({
        uid,
        displayName: value.displayName || "Người dùng",
        publicKey: value.publicKey,
      }));
      setFriends(nextFriends);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const handleSendDiary = async () => {
    if (!user || !selectedFriendUid) return toast.error(t("sendDiary.noFriends"));
    if (!title.trim()) return toast.error(t("sendDiary.titleLabel"));
    
    // Quill thường trả về '<p><br></p>' khi rỗng, ta cần check kĩ hơn
    const plainText = content.replace(/<[^>]*>?/gm, '').trim();
    if (!plainText) return toast.error(t("sendDiary.contentLabel"));

    const selectedFriend = friends.find((f) => f.uid === selectedFriendUid);
    if (!selectedFriend) return toast.error(t("sendDiary.noFriends"));

    setIsSending(true);

    try {
      const senderSnapshot = await get(ref(db, `users/${user.uid}`));
      if (!senderSnapshot.exists()) throw new Error(t("sendDiary.noFriends"));

      const senderData = senderSnapshot.val();
      const senderName = senderData.displayName || user.displayName || t("dashboard.tab.myDiaries");

      const encryptedTitle = await encryptMessage(title, selectedFriend.publicKey);
      
      const contentPayload = JSON.stringify({ content, mood });
      const encryptedContent = await encryptMessage(contentPayload, selectedFriend.publicKey);

      const entryId = push(ref(db, "sharedDiaries")).key || `entry_${Date.now()}`;

      await set(ref(db, `sharedDiaries/${selectedFriendUid}/${entryId}`), {
        fromUid: user.uid,
        fromName: senderName,
        encryptedTitle,
        encryptedContent,
        createdAt: Date.now(),
        isRead: false,
      });

      await set(ref(db, `sentDiaries/${user.uid}/${entryId}`), {
        toUid: selectedFriendUid,
        toName: selectedFriend.displayName,
        encryptedTitle,
        encryptedContent,
        mood,
        createdAt: Date.now(),
      });

      setTitle("");
      setContent("");
      setMood("calm");
      setSelectedFriendUid("");

      toast.success(`${t("sendDiary.send")} ${selectedFriend.displayName} ✓`);
    } catch (err: any) {
      console.error("Send diary error:", err);
      toast.error(err.message || t("sendDiary.send"));
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-card p-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-4">
          <Send className="w-5 h-5 text-primary" />
          <h3 className="font-semibold text-foreground">Gửi Nhật Ký</h3>
        </div>
        <div className="space-y-3">
          <div className="h-10 bg-secondary/30 rounded-xl animate-pulse" />
          <div className="h-32 bg-secondary/30 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Send className="w-6 h-6 text-primary" />
        <h3 className="font-semibold text-foreground text-xl">{t("sendDiary.title")}</h3>
      </div>

      {friends.length === 0 ? (
        <div className="flex items-start gap-4 p-6 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive text-base">{t("sendDiary.noFriends")}</p>
            <p className="text-sm text-destructive/80 mt-2">{t("sendDiary.noFriendsDetail")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          
          <div>
            <label className="block text-base font-medium text-foreground mb-3">{t("sendDiary.sendToLabel")}</label>
            <select
              value={selectedFriendUid}
              onChange={(e) => setSelectedFriendUid(e.target.value)}
              disabled={isSending}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none disabled:opacity-50"
            >
              <option value="">-- {t("sendDiary.selectFriend")} --</option>
              {friends.map((friend) => (
                <option key={friend.uid} value={friend.uid}>{friend.displayName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-base font-medium text-foreground mb-3">{t("sendDiary.moodLabel")}</label>
            <div className="flex gap-3 flex-wrap">
              {(Object.keys(MOOD_CONFIG) as Mood[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMood(m)}
                  disabled={isSending}
                  className={`mood-chip transition-all ${mood === m ? MOOD_CONFIG[m].colorClass : "bg-secondary text-muted-foreground"} disabled:opacity-50`}
                >
                  {MOOD_CONFIG[m].emoji} {t(`mood.${m}`)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-base font-medium text-foreground mb-3">{t("sendDiary.titleLabel")}</label>
            <input
              type="text"
              placeholder={t("sendDiary.titlePlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSending}
              maxLength={200}
              className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-base font-medium text-foreground mb-3">{t("sendDiary.contentLabel")}</label>
            <div className={`bg-secondary/50 rounded-xl overflow-hidden border border-border focus-within:border-primary transition-colors ${isSending ? 'opacity-50 pointer-events-none' : ''}`}>
              <ReactQuill 
                theme="snow" 
                value={content} 
                onChange={setContent} 
                modules={quillModules}
                placeholder={t("sendDiary.contentPlaceholder")}
                className="custom-quill-editor"
              />
            </div>
          </div>

          <button
            onClick={handleSendDiary}
            disabled={isSending || !selectedFriendUid || !title.trim() || !content.replace(/<[^>]*>?/gm, '').trim()}
            className="w-full flex items-center justify-center gap-3 px-4 py-4 rounded-xl bg-primary text-primary-foreground text-base font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
            {isSending ? t("sendDiary.sending") : t("sendDiary.send")}
          </button>

        </div>
      )}
    </div>
  );
}