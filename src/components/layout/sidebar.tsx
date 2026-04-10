"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  PanelLeft,
  Package,
  MessageCircle,
  Search,
  LogOut,
  Zap,
  Loader2,
  FileText,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface HistoryItem {
  id: string;
  name: string;
  evaluationId: string | null;
  status: string | null;
}

interface SidebarProps {
  userEmail: string | null;
  history: HistoryItem[];
}

export function Sidebar({ userEmail, history }: SidebarProps) {
  const t = useTranslations("common");
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/en/auth/login");
    router.refresh();
  }

  const filteredHistory = searchQuery
    ? history.filter((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header: Logo + collapse */}
      <div className="flex h-14 items-center justify-between px-4">
        <Link href="/en" className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <circle cx="10" cy="10" r="7" stroke="#C4A882" strokeWidth="1.5" opacity="0.5" />
            <circle cx="14" cy="10" r="7" stroke="#E2DDD5" strokeWidth="1.5" opacity="0.7" />
            <circle cx="12" cy="14" r="7" stroke="#E2DDD5" strokeWidth="1.5" opacity="0.9" />
          </svg>
          <span className="text-lg font-semibold italic text-[#EAEAE8]">Hygge</span>
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8] md:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* New Discussion + Product Evaluation */}
      <div className="space-y-1 px-3 pt-2 pb-3">
        <Link
          href="/en/evaluate/new?mode=topic"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            pathname.includes("/evaluate/new") && !pathname.includes("mode=product")
              ? "bg-[#1C1C1C] text-[#EAEAE8]"
              : "text-[#EAEAE8] hover:bg-[#1C1C1C]/60"
          }`}
        >
          <Plus className="h-4 w-4" />
          <span>New Discussion</span>
        </Link>
        <Link
          href="/en/evaluate/new?mode=product"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
            pathname.includes("mode=product")
              ? "bg-[#1C1C1C] text-[#EAEAE8]"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Product Evaluation</span>
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-4 border-t border-[#1C1C1C]" />

      {/* Your Discussions */}
      <div className="flex-1 overflow-y-auto px-3 pt-3">
        <p className="mb-2 px-3 text-xs font-medium text-[#666462]">Your Discussions</p>

        {/* Search */}
        <div className="mb-2 px-1">
          <div className="flex items-center gap-2 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-[#666462]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search discussions..."
              className="w-full bg-transparent text-xs text-[#EAEAE8] placeholder:text-[#666462] outline-none"
            />
          </div>
        </div>

        {/* History items */}
        <div className="space-y-0.5">
          {filteredHistory.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-[#666462]">
              {searchQuery ? "No results found" : "No discussions yet"}
            </p>
          )}
          {filteredHistory.map((item) => {
            const href = item.evaluationId
              ? item.status === "completed"
                ? `/en/evaluate/${item.evaluationId}/result`
                : `/en/evaluate/${item.evaluationId}/progress`
              : "#";
            const active = item.evaluationId && pathname.includes(item.evaluationId);
            return (
              <Link
                key={item.id}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={`group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-[#1C1C1C] text-[#EAEAE8]"
                    : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
                }`}
              >
                {item.status === "processing" || item.status === "pending" ? (
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#C4A882]" />
                ) : (
                  <FileText className="h-3.5 w-3.5 shrink-0 opacity-40" />
                )}
                <span className="truncate">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom section */}
      <div className="border-t border-[#1C1C1C] px-3 py-3 space-y-1">
        {/* Upgrade */}
        <Link
          href="/en/pricing"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#9B9594] transition-colors hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
        >
          <Zap className="h-4 w-4" />
          <span>{t("pricing")}</span>
        </Link>

        {/* User */}
        {userEmail && (
          <div className="flex items-center justify-between rounded-lg px-3 py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-xs font-medium text-[#E2DDD5]">
                {userEmail[0].toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-[#EAEAE8]">{userEmail.split("@")[0]}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
              title={t("logout")}
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg bg-[#0C0C0C]/80 text-[#9B9594] backdrop-blur transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8] md:hidden"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      {/* Desktop sidebar — fixed */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-[#1C1C1C] bg-[#0C0C0C] md:flex md:flex-col">
        {sidebarContent}
      </aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] border-r border-[#1C1C1C] bg-[#0C0C0C] md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
