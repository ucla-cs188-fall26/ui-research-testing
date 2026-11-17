import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { supabase } from "../lib/supabase";

const USERNAME_RE = /^[a-z0-9_]{3,30}$/;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

type Message = { type: "ok" | "error"; text: string };

export default function ProfileEditor() {
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load the signed-in user's profile (it may not exist yet)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (!cancelled) {
          setMessage({ type: "error", text: "Sign in to edit your profile." });
          setLoading(false);
        }
        return;
      }

      const id = session.user.id;
      const { data, error } = await supabase
        .from("profiles")
        .select("username, bio, avatar_url")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      setUserId(id);
      if (error) {
        setMessage({ type: "error", text: error.message });
      } else if (data) {
        setUsername(data.username ?? "");
        setBio(data.bio ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const onAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file || !userId) return;

    if (!file.type.startsWith("image/")) {
      setMessage({ type: "error", text: "Please choose an image file." });
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setMessage({ type: "error", text: "Image must be 2 MB or smaller." });
      return;
    }

    setUploading(true);
    setMessage(null);
    try {
      // First folder segment = user id, so the storage policy can scope writes
      const path = `${userId}/avatar`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarUrl(`${data.publicUrl}?v=${Date.now()}`); // cache-bust: the path is reused
      setMessage({
        type: "ok",
        text: "Photo uploaded. Click Save to keep it.",
      });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Upload failed.",
      });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || saving) return;

    const name = username.trim().toLowerCase();
    if (!USERNAME_RE.test(name)) {
      setMessage({
        type: "error",
        text: "Username must be 3–30 characters: lowercase letters, numbers and underscores.",
      });
      return;
    }

    setSaving(true);
    setMessage(null);
    const { error } = await supabase.from("profiles").upsert({
      id: userId,
      username: name,
      bio: bio.trim() || null,
      avatar_url: avatarUrl,
    });
    setSaving(false);

    if (error) {
      setMessage({
        type: "error",
        text:
          error.code === "23505"
            ? "That username is already taken."
            : error.message,
      });
      return;
    }
    setUsername(name);
    setMessage({ type: "ok", text: "Profile saved." });
  };

  if (loading) return <p className="p-6 text-sm text-gray-500">Loading…</p>;

  if (!userId) {
    return (
      <p className="p-6 text-sm text-red-600">
        {message?.text ?? "Sign in to edit your profile."}
      </p>
    );
  }

  return (
    <div className="mx-auto max-w-lg p-6">
      <h1 className="mb-6 text-2xl font-semibold">Edit profile</h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="Your avatar"
              className="h-20 w-20 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-200 text-2xl font-medium text-gray-600">
              {username[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          <div className="flex flex-col items-start gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onAvatarChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Change photo"}
            </button>
            {avatarUrl && (
              <button
                type="button"
                onClick={() => setAvatarUrl(null)}
                className="text-xs text-gray-500 hover:text-red-600"
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={30}
            required
            autoComplete="off"
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
          <span className="text-xs text-gray-500">
            Shown on your wireframes and comments. Lowercase letters, numbers
            and underscores.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={280}
            rows={4}
            className="resize-none rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
          />
          <span className="self-end text-xs text-gray-400">
            {bio.length}/280
          </span>
        </label>

        {message && (
          <p
            className={`text-sm ${message.type === "ok" ? "text-green-600" : "text-red-600"}`}
          >
            {message.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving || uploading}
          className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
    </div>
  );
}
