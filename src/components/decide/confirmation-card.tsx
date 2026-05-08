"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  resolveOptionLabel,
  type DecisionMessage,
  type QuestionOption,
} from "@/lib/decide/types";
import { cn } from "@/lib/utils";

interface Props {
  message: DecisionMessage;
  onAnswerOption: (optionId: string) => void;
}

export function ConfirmationCard({ message, onAnswerOption }: Props) {
  const [submitted, setSubmitted] = useState(false);
  const locale = useLocale() === "zh" ? "zh" : "en";
  const options = (message.options ?? []) as QuestionOption[];

  function pick(optionId: string) {
    if (submitted) return;
    setSubmitted(true);
    onAnswerOption(optionId);
  }

  return (
    <Card className="max-w-[85%] self-start border-primary/40 bg-primary/5">
      <CardHeader className="pb-2">
        <p className="whitespace-pre-line text-sm">{message.content}</p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <Button
            key={opt.id}
            variant={opt.is_recommended ? "default" : "outline"}
            size="sm"
            onClick={() => pick(opt.id)}
            disabled={submitted}
            className={cn("gap-1", submitted && "opacity-50")}
          >
            {opt.is_recommended && <Sparkles className="size-3.5" aria-hidden="true" />}
            {resolveOptionLabel(opt.id, opt.label, locale)}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
