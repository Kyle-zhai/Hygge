"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Scale, Package, MessageCircle, Upload, X, FileText, Image, Film, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

interface CompletedEvaluation {
  evaluationId: string;
  title: string;
  mode: "product" | "topic";
  completedAt: string | null;
  personaCount: number;
}

interface CompareCreateViewProps {
  evaluations: CompletedEvaluation[];
  locale: string;
}

function fileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (/^(png|jpg|jpeg|gif|webp)$/.test(ext)) return Image;
  if (/^(mp4|mov|avi|webm|mkv)$/.test(ext)) return Film;
  return FileText;
}

export function CompareCreateView({ evaluations, locale }: CompareCreateViewProps) {
  const t = useTranslations("evaluation");
  const router = useRouter();
  const currentLocale = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const inputId = useId() + "-file";

  const selected = evaluations.find((e) => e.evaluationId === selectedId);

  async function handleSubmit() {
    if (!selectedId || !text.trim()) return;
    setSubmitting(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      let attachmentPaths: string[] = [];
      if (files.length > 0) {
        for (const file of files) {
          const path = `${user.id}/${crypto.randomUUID()}.${file.name.split(".").pop()}`;
          await supabase.storage.from("attachments").upload(path, file);
          attachmentPaths.push(path);
        }
      }

      const res = await fetch("/api/evaluations/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseEvaluationId: selectedId,
          rawInput: text,
          attachments: attachmentPaths.length > 0 ? attachmentPaths : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Failed to create compare evaluation");
        setSubmitting(false);
        return;
      }

      const { evaluation } = await res.json();
      router.push(`/${currentLocale}/evaluate/${evaluation.id}/progress`);
    } catch {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 text-center">
        <Scale className="mx-auto mb-3 h-8 w-8 text-[#C4A882]" />
        <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
          {locale === "zh" ? "版本对比" : "Compare Versions"}
        </h1>
        <p className="mt-1 text-sm text-[#9B9594]">
          {locale === "zh"
            ? "选择一份历史评估作为基线，提交新版本进行对比"
            : "Select a past evaluation as baseline, then submit a new version to compare"}
        </p>
      </div>

      {/* Step 1: Select base evaluation */}
      <div className="mb-6">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#666462]">
          {locale === "zh" ? "第一步：选择基线" : "Step 1: Select Baseline"}
        </p>
        {evaluations.length === 0 ? (
          <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] px-6 py-10 text-center">
            <p className="text-sm text-[#9B9594]">
              {locale === "zh" ? "暂无已完成的评估" : "No completed evaluations yet"}
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[280px] overflow-y-auto scrollbar-sidebar rounded-xl border border-[#2A2A2A] bg-[#141414] p-2">
            {evaluations.map((ev) => {
              const active = selectedId === ev.evaluationId;
              const ModeIcon = ev.mode === "product" ? Package : MessageCircle;
              return (
                <button
                  key={ev.evaluationId}
                  onClick={() => setSelectedId(active ? null : ev.evaluationId)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                    active
                      ? "bg-[#C4A882]/10 border border-[#C4A882]/30"
                      : "hover:bg-[#1C1C1C] border border-transparent"
                  }`}
                >
                  {active ? (
                    <Check className="h-4 w-4 shrink-0 text-[#C4A882]" />
                  ) : (
                    <ModeIcon className="h-4 w-4 shrink-0 text-[#666462]" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm truncate ${active ? "text-[#EAEAE8] font-medium" : "text-[#9B9594]"}`}>
                      {ev.title}
                    </p>
                    <p className="text-[10px] text-[#666462]">
                      {ev.personaCount} personas · {ev.completedAt ? new Date(ev.completedAt).toLocaleDateString() : ""}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Step 2: New version input */}
      {selected && (
        <div className="mb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-[#666462]">
            {locale === "zh" ? "第二步：输入新版本" : "Step 2: Enter New Version"}
          </p>
          <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4 space-y-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={locale === "zh" ? "描述产品/话题的新版本..." : "Describe the new version of your product/topic..."}
              rows={5}
              className="w-full resize-none rounded-lg bg-[#0C0C0C] border border-[#2A2A2A] px-4 py-3 text-sm text-[#EAEAE8] placeholder:text-[#666462] outline-none focus:border-[#C4A882]/40"
            />

            {/* File upload */}
            <div className="flex items-center gap-2">
              <label
                htmlFor={inputId}
                className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#9B9594] transition-colors hover:border-[#3A3A3A] hover:text-[#EAEAE8]"
              >
                <Upload className="h-3.5 w-3.5" />
                {locale === "zh" ? "上传文件" : "Upload Files"}
              </label>
              <input
                id={inputId}
                type="file"
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.docx,.pptx,.mp4,.mov,.avi,.webm"
                onChange={(e) => {
                  if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
                  e.target.value = "";
                }}
                className="hidden"
              />
              {files.length > 0 && (
                <span className="text-[10px] text-[#666462]">{files.length} file(s)</span>
              )}
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {files.map((f, i) => {
                  const Icon = fileIcon(f.name);
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-md bg-[#1C1C1C] px-2 py-1 text-xs text-[#9B9594]"
                    >
                      <Icon className="h-3 w-3" />
                      <span className="max-w-[120px] truncate">{f.name}</span>
                      <button onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}>
                        <X className="h-3 w-3 text-[#666462] hover:text-[#F87171]" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Submit */}
      {selected && (
        <div className="flex justify-center">
          <Button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="bg-[#C4A882] text-[#0C0C0C] hover:bg-[#D4B892] font-semibold px-8 disabled:opacity-40"
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {locale === "zh" ? "创建中..." : "Creating..."}
              </>
            ) : (
              <>
                <Scale className="mr-2 h-4 w-4" />
                {locale === "zh" ? "开始对比" : "Start Compare"}
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
