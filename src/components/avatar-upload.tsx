"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, X } from "lucide-react";
import { PersonaAvatar } from "./persona-avatar";

export function AvatarUpload({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/personas/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onChange(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  const isImageUrl = value.startsWith("http://") || value.startsWith("https://");

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[color:var(--text-primary)]">Avatar</label>
      <div className="flex items-center gap-4">
        <div className="relative">
          {value ? (
            <PersonaAvatar avatar={value} size={64} />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--bg-tertiary)] text-[color:var(--text-tertiary)]">
              <Camera className="h-6 w-6" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <Loader2 className="h-5 w-5 animate-spin text-[color:var(--accent-warm)]" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-[color:var(--border-default)] px-3 py-1.5 text-xs text-[color:var(--text-secondary)] transition-colors hover:border-[#444] hover:text-[color:var(--text-primary)] disabled:opacity-40"
          >
            {isImageUrl ? "Change image" : "Upload image"}
          </button>
          {isImageUrl && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-left text-xs text-[color:var(--text-tertiary)] transition-colors hover:text-[color:var(--text-secondary)]"
            >
              Remove image
            </button>
          )}
          <p className="text-[10px] text-[color:var(--text-tertiary)]">PNG, JPG, WebP · Max 2MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFile}
          className="hidden"
        />
      </div>
      {error && <p className="mt-2 text-xs text-[#F87171]">{error}</p>}
    </div>
  );
}
