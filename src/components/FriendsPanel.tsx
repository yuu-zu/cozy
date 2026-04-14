import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { equalTo, get, onValue, orderByChild, query, ref, update } from "firebase/database";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { Friend } from "@/types/diary";
import { Search, UserPlus, Users, Key, Copy, Trash2, CheckCircle2, Clock3, Inbox } from "lucide-react";
import { toast } from "sonner";
import { formatPublicKey } from "@/lib/utils";
import ConfirmDialog from "@/components/ConfirmDialog";
import { createNotification } from "@/lib/notifications";

interface Props {
  entries?: unknown[];
}

interface SearchResult {
  uid: string;
  displayName: string;
  email: string;
  publicKey: string;
}

type RelationshipState = "none" | "friend" | "outgoing" | "incoming";
type ContactRecord = { displayName?: string; publicKey?: string };
type RequestRecord = { status?: string };
type UserRecord = { displayName?: string; email?: string; publicKey?: string };

export default function FriendsPanel(_: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [emailInput, setEmailInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [removingUid, setRemovingUid] = useState<string | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [friendUidSet, setFriendUidSet] = useState<Set<string>>(new Set());
  const [outgoingRequestUids, setOutgoingRequestUids] = useState<Set<string>>(new Set());
  const [incomingRequestUids, setIncomingRequestUids] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);

  useEffect(() => {
    if (!user?.uid) return;

    const contactsRef = ref(db, `contacts/${user.uid}`);
    const unsubscribe = onValue(contactsRef, (snapshot) => {
      const data = snapshot.val();

      if (!data) {
        setFriends([]);
        setFriendUidSet(new Set());
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
      setFriendUidSet(new Set(nextFriends.map((friend) => friend.uid)));
    });

    return () => unsubscribe();
  }, [user?.uid, t]);

  useEffect(() => {
    if (!user?.uid) return;

    const friendRequestsRef = ref(db, "friend_requests");
    const unsubscribe = onValue(friendRequestsRef, (snapshot) => {
      const data = snapshot.val();
      const nextOutgoing = new Set<string>();
      const nextIncoming = new Set<string>();

      if (data && typeof data === "object") {
        Object.entries(data).forEach(([recipientUid, requests]) => {
          if (!requests || typeof requests !== "object") return;

          if (recipientUid === user.uid) {
            Object.entries(requests).forEach(([senderUid, requestValue]) => {
              if ((requestValue as RequestRecord)?.status === "pending") {
                nextIncoming.add(senderUid);
              }
            });
            return;
          }

          if ((requests as Record<string, RequestRecord>)[user.uid]?.status === "pending") {
            nextOutgoing.add(recipientUid);
          }
        });
      }

      setOutgoingRequestUids(nextOutgoing);
      setIncomingRequestUids(nextIncoming);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  const getRelationshipState = (targetUid?: string): RelationshipState => {
    if (!targetUid) return "none";
    if (friendUidSet.has(targetUid)) return "friend";
    if (outgoingRequestUids.has(targetUid)) return "outgoing";
    if (incomingRequestUids.has(targetUid)) return "incoming";
    return "none";
  };

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

      const [uid, userData] = Object.entries(snapshot.val())[0] as [string, UserRecord];

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

      const relationshipState = getRelationshipState(uid);
      if (relationshipState === "friend") {
        setSuccess(t("friends.status_already_friends"));
      } else if (relationshipState === "outgoing") {
        setSuccess(t("friends.status_invite_sent"));
      } else if (relationshipState === "incoming") {
        setSuccess(t("friends.status_request_received"));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("friends.error_search");
      setError(message || t("friends.error_search"));
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
      const relationshipState = getRelationshipState(searchResult.uid);
      if (relationshipState === "friend") {
        throw new Error(t("friends.error_already_friends"));
      }
      if (relationshipState === "outgoing") {
        throw new Error(t("friends.error_request_exists"));
      }
      if (relationshipState === "incoming") {
        throw new Error(t("friends.error_request_received"));
      }

      const currentUserSnapshot = await get(ref(db, `users/${user.uid}`));
      if (!currentUserSnapshot.exists()) {
        throw new Error(t("sendDiary.noFriends"));
      }

      const currentUserData = currentUserSnapshot.val() as UserRecord;
      const [existingContactSnapshot, existingOutgoingSnapshot, existingIncomingSnapshot] = await Promise.all([
        get(ref(db, `contacts/${user.uid}/${searchResult.uid}`)),
        get(ref(db, `friend_requests/${searchResult.uid}/${user.uid}`)),
        get(ref(db, `friend_requests/${user.uid}/${searchResult.uid}`)),
      ]);

      if (existingContactSnapshot.exists()) {
        throw new Error(t("friends.error_already_friends"));
      }
      if (existingOutgoingSnapshot.exists() && (existingOutgoingSnapshot.val() as RequestRecord)?.status === "pending") {
        throw new Error(t("friends.error_request_exists"));
      }
      if (existingIncomingSnapshot.exists() && (existingIncomingSnapshot.val() as RequestRecord)?.status === "pending") {
        throw new Error(t("friends.error_request_received"));
      }

      await update(ref(db), {
        [`friend_requests/${searchResult.uid}/${user.uid}`]: {
          status: "pending",
          senderEmail: currentUserData.email || user.email || "",
          senderName: currentUserData.displayName || user.displayName || t("dashboard.tab.myDiaries"),
          senderPublicKey: currentUserData.publicKey,
          createdAt: Date.now(),
        },
      });

      await createNotification({
        userUid: searchResult.uid,
        type: "friend_request",
        title: t("notifications.friend_request_title"),
        message: t("notifications.friend_request_message", {
          name: currentUserData.displayName || user.displayName || t("notifications.someone"),
        }),
        targetId: user.uid,
      });

      setSuccess(t("friends.invite_sent"));
      toast.success(t("friends.invite_sent"));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("friends.error_search");
      setError(message || t("friends.error_search"));
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
      await update(ref(db), {
        [`contacts/${user.uid}/${friend.uid}`]: null,
        [`contacts/${friend.uid}/${user.uid}`]: null,
        [`friend_requests/${user.uid}/${friend.uid}`]: null,
        [`friend_requests/${friend.uid}/${user.uid}`]: null,
      });

      setSuccess(t("friends.removed", { name: friend.displayName }));
      toast.success(t("friends.removed", { name: friend.displayName }));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t("friends.error_remove");
      console.error("Delete friend error:", err);
      setError(message || t("friends.error_remove"));
      toast.error(t("friends.error_remove"));
    } finally {
      setRemovingUid(null);
      setFriendToRemove(null);
    }
  };

  const relationshipState = searchResult ? getRelationshipState(searchResult.uid) : "none";
  const inviteDisabled = sendingInvite || relationshipState !== "none";
  const inviteButtonLabel =
    relationshipState === "friend"
      ? t("friends.status_already_friends")
      : relationshipState === "outgoing"
        ? t("friends.status_invite_sent")
        : relationshipState === "incoming"
          ? t("friends.status_request_received")
          : sendingInvite
            ? t("friends.sending_invite")
            : t("friends.send_invite_button");
  const InviteIcon =
    relationshipState === "friend"
      ? CheckCircle2
      : relationshipState === "outgoing"
        ? Clock3
        : relationshipState === "incoming"
          ? Inbox
          : UserPlus;

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
              disabled={inviteDisabled}
              className={`mt-3 inline-flex items-center gap-2 px-4 py-3 rounded-xl text-base font-medium disabled:cursor-not-allowed ${
                relationshipState === "none"
                  ? "bg-primary text-primary-foreground disabled:opacity-50"
                  : "bg-secondary text-muted-foreground disabled:opacity-100"
              }`}
            >
              <InviteIcon className="w-4 h-4" />
              {inviteButtonLabel}
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
