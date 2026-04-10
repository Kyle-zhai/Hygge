"use client";

import { useState, type KeyboardEvent } from "react";
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
    <div className="rounded-2xl border border-[#2A2A2A] bg-[#141414] transition-all duration-300 focus-within:border-[#E2DDD5]/50 focus-within:ring-2 focus-within:ring-[#E2DDD5]/10">
      <div className="px-3 pt-3 pb-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("inputPlaceholder")}
          className="min-h-[140px] resize-none border-0 bg-transparent px-3 py-2 text-base text-[#EAEAE8] placeholder:text-[#666462] shadow-none focus-visible:ring-0"
          disabled={disabled}
        />

        {files.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-[#2A2A2A] pt-3">
            {files.map((file, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#1C1C1C] px-3 py-1.5 text-xs"
              >
                {file.type.startsWith("image/") ? (
                  <Image className="h-3.5 w-3.5 text-[#666462]" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-[#666462]" />
                )}
                <span className="max-w-[120px] truncate text-[#9B9594]">{file.name}</span>
                <button onClick={() => removeFile(i)} className="text-[#666462] hover:text-[#EAEAE8] transition-colors">
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-[#2A2A2A] px-5 py-3">
        <div className="flex gap-1">
          <label className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#666462] hover:text-[#EAEAE8] hover:bg-[#1C1C1C] transition-colors ${disabled ? "pointer-events-none opacity-50" : ""}`}>
            <Paperclip className="h-4 w-4" />
            <input
              type="file"
              className="absolute h-0 w-0 overflow-hidden opacity-0"
              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
              multiple
              onChange={handleFileChange}
            />
          </label>
        </div>
        <Button
          size="icon"
          className="h-8 w-8 rounded-lg bg-[#E2DDD5] hover:bg-[#D4CFC7] text-[#0C0C0C]"
          onClick={handleSubmit}
          disabled={disabled || (!text.trim() && files.length === 0)}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
