"use client";

import { useState, useRef, useId, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Paperclip, FileText, Image, Film, ArrowUp, X } from "lucide-react";

interface ProjectInputProps {
  onSubmit: (data: { rawInput: string; url: string | null; files: File[] }) => void;
  disabled?: boolean;
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match ? match[0] : null;
}

export function ProjectInput({ onSubmit, disabled }: ProjectInputProps) {
  const t = useTranslations("evaluation");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const inputId = useId() + "-file";
  const composingRef = useRef(false);

  function handleSubmit() {
    if (!text.trim() && files.length === 0) return;
    onSubmit({
      rawInput: text.trim(),
      url: extractUrl(text),
      files,
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !composingRef.current) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles]);
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function triggerFileInput() {
    const el = document.getElementById(inputId) as HTMLInputElement | null;
    el?.click();
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] transition-all duration-300 focus-within:border-[rgb(var(--accent-primary-rgb)/0.50)] focus-within:ring-2 focus-within:ring-[rgb(var(--accent-primary-rgb)/0.10)]">
      <div className="px-3 pt-3 pb-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => { composingRef.current = true; }}
          onCompositionEnd={() => { composingRef.current = false; }}
          placeholder={t("inputPlaceholder")}
          className="min-h-[140px] resize-none border-0 bg-transparent px-3 py-2 text-base text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] shadow-none focus-visible:ring-0"
          disabled={disabled}
        />

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[color:var(--border-default)] pt-3">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)] px-3 py-1.5 text-xs"
              >
                {file.type.startsWith("image/") ? (
                  <Image className="h-3.5 w-3.5 text-[color:var(--text-tertiary)]" />
                ) : file.type.startsWith("video/") ? (
                  <Film className="h-3.5 w-3.5 text-[color:var(--text-tertiary)]" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-[color:var(--text-tertiary)]" />
                )}
                <span className="max-w-[120px] truncate text-[color:var(--text-secondary)]">{file.name}</span>
                <button onClick={() => removeFile(i)} className="text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[color:var(--border-default)] px-5 py-3">
        <div className="flex gap-1">
          <input
            id={inputId}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.pptx,.mp4,.mov,.avi,.webm"
            multiple
            onChange={handleFileChange}
            style={{ display: "none" }}
          />
          <button
            type="button"
            disabled={disabled}
            onClick={triggerFileInput}
            className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)] hover:bg-[color:var(--bg-tertiary)] transition-colors ${disabled ? "pointer-events-none opacity-50" : ""}`}
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </div>
        <Button
          size="icon"
          className="h-8 w-8 rounded-lg bg-[color:var(--accent-primary)] hover:bg-[color:var(--accent-primary-hover)] text-[color:var(--bg-primary)]"
          onClick={handleSubmit}
          disabled={disabled || (!text.trim() && files.length === 0)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
