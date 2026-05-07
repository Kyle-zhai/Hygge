"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { DecisionMessage, QuestionOption } from "@/lib/decide/types";
import { cn } from "@/lib/utils";

interface Props {
  message: DecisionMessage;
  onAnswerOption: (optionId: string) => void;
  onAnswerText: (text: string) => void;
  onSkipRunNow: () => void;
}

export function QuestionCard({
  message,
  onAnswerOption,
  onAnswerText,
  onSkipRunNow,
}: Props) {
  const t = useTranslations("decide");
  const [showFreeText, setShowFreeText] = useState(false);
  const [freeText, setFreeText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const options = (message.options ?? []) as QuestionOption[];

  function pick(optionId: string) {
    if (submitted) return;
    setSubmitted(true);
    onAnswerOption(optionId);
  }

  function submitText() {
    if (submitted || !freeText.trim()) return;
    setSubmitted(true);
    onAnswerText(freeText.trim());
  }

  function skip() {
    if (submitted) return;
    setSubmitted(true);
    onSkipRunNow();
  }

  return (
    <Card className="max-w-[80%] self-start">
      <CardHeader className="pb-2">
        <p className="text-sm font-medium">{message.content}</p>
      </CardHeader>
      <CardContent className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => pick(opt.id)}
            disabled={submitted}
            className={cn(
              "block w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
              opt.is_recommended
                ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                : "border-input hover:bg-accent",
              submitted && "cursor-not-allowed opacity-50",
            )}
          >
            {opt.is_recommended && (
              <span className="mr-1 text-primary">✨</span>
            )}
            {opt.label}
          </button>
        ))}

        {showFreeText ? (
          <div className="flex gap-2 pt-1">
            <Input
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder={t("typeYourOwn")}
              disabled={submitted}
              onKeyDown={(e) => e.key === "Enter" && submitText()}
            />
            <Button onClick={submitText} disabled={submitted || !freeText.trim()}>
              {t("send")}
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFreeText(true)}
            disabled={submitted}
            className="text-xs"
          >
            💬 {t("typeMyOwn")}
          </Button>
        )}

        <div className="border-t pt-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={skip}
            disabled={submitted}
            className="w-full text-xs"
          >
            🚀 {t("skipRunNow")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
