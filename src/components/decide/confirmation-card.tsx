"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { DecisionMessage, QuestionOption } from "@/lib/decide/types";
import { cn } from "@/lib/utils";

interface Props {
  message: DecisionMessage;
  onAnswerOption: (optionId: string) => void;
}

export function ConfirmationCard({ message, onAnswerOption }: Props) {
  const [submitted, setSubmitted] = useState(false);
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
            className={cn(submitted && "opacity-50")}
          >
            {opt.is_recommended && <span className="mr-1">✨</span>}
            {opt.label}
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
