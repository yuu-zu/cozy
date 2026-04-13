import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { equalTo, get, onValue, orderByChild, query, ref, remove, set } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Friend } from "@/types/diary";
import { Search, UserPlus, Users, Key, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatPublicKey } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";

interface Props {
  entries?: unknown[];
}

interface SearchResult {
  uid: string;
  displayName: string;
  email: string;
  publicKey: string;
}

export default function FriendsPanel(_: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);

  useEffect(() => {
    if (!user) return;

    const contactsRef = ref(db, `contacts/${user.uid}`);
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setFriends([]);
        return;
      }

      const nextFriends = Object.entries(data).map(([uid, value]: [string, any]) => ({
        uid,
        displayName: value.displayName,
        publicKey: value.publicKey,
      }));

      setFriends(nextFriends);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSearch = async () => {
    if (!user) return;

    const normalizedEmail = emailInput.trim().toLowerCase();
    if (!normalizedEmail) {
      setError(t("friends.error_empty_email"));
      setSearchResult(null);
      return;
    }

    setSearching(true);
    setError("");
    setSuccess("");
    setSearchResult(null);

    try {
      const usersQuery = query(ref(db, "users"), orderByChild("email"), equalTo(normalizedEmail));
      const snapshot = await get(usersQuery);

      if (!snapshot.exists()) {
        setError(t("friends.error_not_found"));
        return;
      }

      const [uid, userData] = Object.entries(snapshot.val())[0] as [string, any];

      if (uid === user.uid) {
        setError(t("friends.error_self_invite"));
        return;
      }

      setSearchResult({
        uid,
        displayName: userData.displayName || t("dashboard.tab.myDiaries"),
        email: userData.email,
        publicKey: userData.publicKey,
      });
    } catch (err: any) {
      setError(err.message || t("friends.error_search"));
    } finally {
      setSearching(false);
    }
  };

  const handleSendFriendRequest = async () => {
    if (!user || !searchResult) return;

    setSendingInvite(true);
    setError("");
    setSuccess("");

    try {
      const currentUserSnapshot = await get(ref(db, `users/${user.uid}`));
      const currentUserData = currentUserSnapshot.val();

      if (!currentUserSnapshot.exists()) {
        throw new Error(t("sendDiary.noFriends"));
      }

      await set(ref(db, `friend_requests/${searchResult.uid}/${user.uid}`), {
        status: "pending",
        senderEmail: currentUserData.email || user.email || "",
        senderName: currentUserData.displayName || user.displayName || t("dashboard.tab.myDiaries"),
        senderPublicKey: currentUserData.publicKey,
        createdAt: Date.now(),
      });

      setSuccess(t("friends.invite_sent"));
      setSearchResult(null);
      setEmailInput("");
      toast.success(t("friends.invite_sent"));
    } catch (err: any) {
      setError(err.message || t("friends.error_search"));
    } finally {
      setSendingInvite(false);
    }
  };

  const handleCopyPublicKey = async (publicKey: string) => {
    try {
      await navigator.clipboard.writeText(publicKey);
      toast.success(t("friends.copied_key"));
    } catch {
      toast.error(t("friends.error_copy"));
    }
  };

  const handleRemoveContact = async (friend: Friend) => {
    if (!user) return;

    setRemovingUid(friend.uid);
    setError("");
    setSuccess("");

    try {
      await remove(ref(db, `contacts/${user.uid}/${friend.uid}`));
      await remove(ref(db, `contacts/${friend.uid}/${user.uid}`));

      setSuccess(t("friends.removed", { name: friend.displayName }));
      toast.success(t("friends.removed", { name: friend.displayName }));
    } catch (err: any) {
      console.error("Delete friend error:", err);
      setError(err.message || t("friends.error_remove"));
      toast.error(t("friends.error_remove"));
    } finally {
      setRemovingUid(null);
      setFriendToRemove(null);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="glass-card p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" /> {t("friends.search_label")}
        </h3>

        <div className="flex gap-2">
          <input
            type="email"
            placeholder={t("friends.search_placeholder")}
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl bg-secondary/50 border border-border text-base text-foreground placeholder:text-muted-foreground focus:border-primary outline-none"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-3 rounded-xl bg-primary text-primary-foreground text-base font-medium disabled:opacity-50"
          >
            {searching ? t("friends.searching") : t("friends.search_button")}
          </button>
        </div>

        {error && <p className="text-destructive text-sm mt-3">{error}</p>}
        {success && <p className="text-primary text-sm mt-3">{success}</p>}

        {searchResult && (
          <div className="mt-4 rounded-2xl border border-border bg-secondary/30 p-4">
            <p className="font-medium text-foreground">{searchResult.displayName}</p>
            <p className="text-sm text-muted-foreground mt-1">{searchResult.email}</p>
            <button
              onClick={handleSendFriendRequest}
              disabled={sendingInvite}
              className="mt-3 inline-flex items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-base font-medium disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              {sendingInvite ? t("friends.sending_invite") : t("friends.send_invite_button")}
            </button>
          </div>
        )}
      </div>

      <div className="glass-card p-5">
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" /> {t("friends.connected_friends")} ({friends.length})
        </h3>

        {friends.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("friends.no_friends")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4">{t("friends.table_name")}</th>
                  <th className="py-2">{t("friends.table_key")}</th>
                  <th className="py-2 text-right">{t("friends.table_actions")}</th>
                </tr>
              </thead>
              <tbody>
                {friends.map((friend) => (
                  <tr key={friend.uid} className="border-b border-border/50 align-top">
                    <td className="py-3 pr-4 font-medium text-foreground">{friend.displayName}</td>
                    <td className="py-3">
                      <div className="flex items-start gap-2">
                        <Key className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                        <code
                          className="font-mono text-xs text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg break-all max-w-xs overflow-x-auto"
                          title={friend.publicKey}
                        >
                          {formatPublicKey(friend.publicKey)}
                        </code>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleCopyPublicKey(friend.publicKey)}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          {t("friends.copy_button")}
                        </button>
                        <button
                          onClick={() => setFriendToRemove(friend)}
                          disabled={removingUid === friend.uid}
                          className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-sm font-medium hover:bg-destructive/20 disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          {removingUid === friend.uid ? t("friends.removing") : t("friends.remove_button")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!friendToRemove}
        onOpenChange={(open) => {
          if (!open) setFriendToRemove(null);
        }}
        title={friendToRemove ? t("friends.remove_confirm", { name: friendToRemove.displayName }) : ""}
        description={t("friends.remove_confirm_detail")}
        confirmLabel={t("friends.remove_button")}
        cancelLabel={t("settings.cancel")}
        destructive
        onConfirm={() => {
          if (friendToRemove) {
            void handleRemoveContact(friendToRemove);
          }
        }}
      />
    </div>
  );
}
