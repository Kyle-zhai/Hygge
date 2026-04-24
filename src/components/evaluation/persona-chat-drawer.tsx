"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useLocale } from "next-intl";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowUp, Loader2 } from "lucide-react";
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

interface PersonaChatDrawerProps {
  evaluationId: string;
  persona: PersonaData;
  onClose: () => void;
}

export function PersonaChatDrawer({ evaluationId, persona, onClose }: PersonaChatDrawerProps) {
  const locale = useLocale();
  const [debateId, setDebateId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [loading, setLoading] = useState(true);
  const waitingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);

  const personaName = persona.identity.locale_variants?.[locale]?.name || persona.identity.name;

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    async function init() {
      const res = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evaluationId, personaId: persona.id }),
      });
      if (!res.ok) { setLoading(false); return; }
      const debate = await res.json();
      setDebateId(debate.id);

      const msgRes = await fetch(`/api/debates/${debate.id}`);
      if (msgRes.ok) {
        const data = await msgRes.json();
        setMessages(data.messages || []);
      }
      setLoading(false);
    }
    init();
  }, [evaluationId, persona.id]);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!debateId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`drawer-debate-${debateId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "debate_messages", filter: `debate_id=eq.${debateId}` },
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
  }, [debateId]);

  useEffect(() => {
    if (!waiting || !debateId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/debates/${debateId}`);
        if (!res.ok) return;
        const data = await res.json();
        const fresh: Message[] = data.messages || [];
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          const newMsgs = fresh.filter((m: Message) => !ids.has(m.id));
          if (newMsgs.length === 0) return prev;
          if (newMsgs.some((m: Message) => m.role === "persona")) {
            if (waitingTimer.current) clearTimeout(waitingTimer.current);
            setWaiting(false);
          }
          return [...prev, ...newMsgs];
        });
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [waiting, debateId]);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !debateId) return;
    setSending(true);
    setWaiting(true);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    if (waitingTimer.current) clearTimeout(waitingTimer.current);
    waitingTimer.current = setTimeout(() => setWaiting(false), 60_000);

    const optimisticId = `temp-${Date.now()}`;
    setMessages((prev) => [...prev, { id: optimisticId, role: "user", content: text, created_at: new Date().toISOString() }]);

    try {
      const res = await fetch(`/api/debates/${debateId}/messages`, {
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
      textareaRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey && !composingRef.current) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 300 }}
          className="flex h-full w-full max-w-md flex-col bg-[color:var(--bg-primary)] border-l border-[color:var(--border-default)] shadow-2xl"
        >
          {/* Header */}
          <div className="shrink-0 flex items-center gap-3 border-b border-[color:var(--bg-tertiary)] px-4 py-3">
            <PersonaAvatar avatar={persona.identity.avatar} size={32} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[color:var(--text-primary)] truncate">{personaName}</p>
              <p className="text-[10px] text-[color:var(--text-tertiary)]">{persona.demographics.occupation}</p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-[color:var(--text-tertiary)] hover:bg-[color:var(--bg-tertiary)] hover:text-[color:var(--text-primary)] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-[color:var(--accent-warm)]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-[color:var(--text-tertiary)]">
                  {locale === "zh"
                    ? `向 ${personaName} 提出你的观点或问题`
                    : `Share your perspective or ask ${personaName} a question`}
                </p>
              </div>
            ) : null}

            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "persona" && (
                    <span className="shrink-0 text-base mt-1">{persona.identity.avatar}</span>
                  )}
                  <div
                    className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
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

            {waiting && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-2.5 items-center"
              >
                <span className="text-base">{persona.identity.avatar}</span>
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
          <div className="shrink-0 border-t border-[color:var(--bg-tertiary)] p-3">
            <div className="flex items-end gap-2">
              <div className="flex-1 rounded-2xl border border-[color:var(--border-default)] bg-[color:var(--bg-secondary)] px-4 py-2.5 focus-within:border-[rgb(var(--accent-warm-rgb)/0.40)] transition-colors">
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => { setInput(e.target.value); autoResize(); }}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => { composingRef.current = true; }}
                  onCompositionEnd={() => { composingRef.current = false; }}
                  placeholder={locale === "zh" ? "输入你的观点..." : "Share your thoughts..."}
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
