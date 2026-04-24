"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Loader2, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PersonaAvatar } from "@/components/persona-avatar";

interface Message {
  id: string;
  role: "user" | "persona";
  content: string;
  created_at: string;
}

interface PersonaData {
  id: string;
  identity: { name: string; avatar: string; locale_variants?: Record<string, { name: string }> };
  demographics: { occupation: string };
}

export default function DebateChatPage() {
  const { id } = useParams<{ id: string }>();
  const locale = useLocale();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [persona, setPersona] = useState<PersonaData | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [waiting, setWaiting] = useState(false);
  const waitingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/debates/${id}`);
      if (!res.ok) { router.push(`/${locale}/debates`); return; }
      const data = await res.json();
      setMessages(data.messages);
      setPersona(data.persona);
      setLoading(false);
    }
    load();
  }, [id, locale, router]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`debate-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "debate_messages", filter: `debate_id=eq.${id}` },
        (payload) => {
          const msg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (msg.role === "persona") {
            if (waitingTimer.current) clearTimeout(waitingTimer.current);
            setWaiting(false);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  useEffect(() => {
    if (!waiting) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/debates/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        const freshMessages: Message[] = data.messages || [];
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = freshMessages.filter((m: Message) => !existingIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          const merged = [...prev, ...newMsgs];
          if (newMsgs.some((m: Message) => m.role === "persona")) {
            if (waitingTimer.current) clearTimeout(waitingTimer.current);
            setWaiting(false);
          }
          return merged;
        });
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [waiting, id]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setWaiting(true);
    setInput("");
    if (waitingTimer.current) clearTimeout(waitingTimer.current);
    waitingTimer.current = setTimeout(() => setWaiting(false), 60_000);

    const optimisticId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: text, created_at: new Date().toISOString() }]);

    try {
      const res = await fetch(`/api/debates/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const realMsg = await res.json();
        setMessages((prev) => prev.map((m) => m.id === optimisticId ? { ...realMsg } : m));
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !composingRef.current) {
      e.preventDefault();
      handleSend();
    }
  }

  const personaName = persona
    ? (persona.identity.locale_variants?.[locale]?.name || persona.identity.name)
    : "";

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[color:var(--accent-warm)]" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-56px)] flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-[color:var(--bg-tertiary)] px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="h-8 w-8 flex items-center justify-center rounded-lg text-[color:var(--text-tertiary)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {persona && (
          <>
            <PersonaAvatar avatar={persona.identity.avatar} size={28} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-[color:var(--text-primary)] truncate">{personaName}</p>
              <p className="text-[10px] text-[color:var(--text-tertiary)]">{persona.demographics.occupation}</p>
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-[color:var(--text-tertiary)]">
              {locale === "zh"
                ? `开始与 ${personaName} 辩论，试着说服对方改变立场`
                : `Start debating with ${personaName} — try to change their mind`}
            </p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "persona" && persona && (
                <span className="shrink-0 text-lg mt-1">{persona.identity.avatar}</span>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[rgb(var(--accent-warm-rgb)/0.15)] text-[color:var(--text-primary)] rounded-br-md"
                    : "bg-[color:var(--bg-tertiary)] text-[color:var(--text-secondary)] rounded-bl-md"
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {waiting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3 items-center"
          >
            {persona && <span className="text-lg">{persona.identity.avatar}</span>}
            <div className="flex gap-1 bg-[color:var(--bg-tertiary)] rounded-2xl px-4 py-3 rounded-bl-md">
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--text-tertiary)] animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--text-tertiary)] animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-[color:var(--text-tertiary)] animate-bounce [animation-delay:300ms]" />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input — Gemini style auto-expanding */}
      <div className="shrink-0 border-t border-[color:var(--bg-tertiary)] p-4">
        <div className="mx-auto max-w-3xl flex items-end gap-2">
          <div className="flex-1 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-primary)] px-4 py-2.5 focus-within:border-[rgb(var(--accent-warm-rgb)/0.40)] transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const el = e.target;
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              }}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => { composingRef.current = true; }}
              onCompositionEnd={() => { composingRef.current = false; }}
              placeholder={locale === "zh" ? "输入你的论点..." : "Make your argument..."}
              rows={1}
              className="w-full resize-none bg-transparent text-sm text-[color:var(--text-primary)] placeholder:text-[color:var(--text-tertiary)] outline-none"
              style={{ lineHeight: "1.5", maxHeight: "160px" }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--accent-warm)] text-[color:var(--bg-primary)] transition-all hover:bg-[color:var(--accent-warm-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUp className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
