"use client";

import { useState, useRef, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Paperclip, FileText, Image, ArrowUp, X } from "lucide-react";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleSubmit() {
    if (!text.trim() && files.length === 0) return;
    onSubmit({
      rawInput: text.trim(),
      url: extractUrl(text),
      files,
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
    e.target.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="p-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("inputPlaceholder")}
          className="min-h-[120px] resize-none border-0 bg-transparent p-0 text-base shadow-none focus-visible:ring-0"
          disabled={disabled}
        />

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-1.5 text-xs"
              >
                {file.type.startsWith("image/") ? (
                  <Image className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button onClick={() => removeFile(i)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t px-4 py-2.5">
        <div className="flex gap-1">
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
            multiple
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        </div>
        <Button
          size="icon"
          className="h-8 w-8 rounded-lg"
          onClick={handleSubmit}
          disabled={disabled || (!text.trim() && files.length === 0)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
