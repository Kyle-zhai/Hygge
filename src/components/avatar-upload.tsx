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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  const isImageUrl = value.startsWith("http://") || value.startsWith("https://");

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#EAEAE8]">Avatar</label>
      <div className="flex items-center gap-4">
        <div className="relative">
          {value ? (
            <PersonaAvatar avatar={value} size={64} />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1C1C1C] text-[#666462]">
              <Camera className="h-6 w-6" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
              <Loader2 className="h-5 w-5 animate-spin text-[#C4A882]" />
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#9B9594] transition-colors hover:border-[#444] hover:text-[#EAEAE8] disabled:opacity-40"
          >
            {isImageUrl ? "Change image" : "Upload image"}
          </button>
          {isImageUrl && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="text-left text-xs text-[#666462] transition-colors hover:text-[#9B9594]"
            >
              Remove image
            </button>
          )}
          <p className="text-[10px] text-[#666462]">PNG, JPG, WebP · Max 2MB</p>
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
