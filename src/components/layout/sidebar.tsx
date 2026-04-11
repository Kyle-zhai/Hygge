"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  PanelLeft,
  Package,
  MessageCircle,
  Search,
  LogOut,
  Zap,
  Loader2,
  X,
  MoreHorizontal,
  Share2,
  Trash2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface HistoryItem {
  id: string;
  name: string;
  evaluationId: string | null;
  status: string | null;
  mode: string;
}

interface SidebarProps {
  userEmail: string | null;
  history: HistoryItem[];
}

export function Sidebar({ userEmail, history }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const isNewPage = pathname.includes("/evaluate/new");
  const currentMode = searchParams.get("mode") || "topic";
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    if (collapsed) {
      main.style.marginLeft = "0px";
    } else {
      main.style.removeProperty("margin-left");
    }
  }, [collapsed]);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/en/auth/login");
    router.refresh();
  }

  async function handleDelete(projectId: string) {
    setDeleting(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        setMenuOpenId(null);
        router.refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  function handleShare(item: HistoryItem) {
    const url = item.evaluationId
      ? `${window.location.origin}/en/evaluate/${item.evaluationId}/result`
      : window.location.href;
    navigator.clipboard.writeText(url);
    setMenuOpenId(null);
  }

  const filteredHistory = searchQuery
    ? history.filter((h) => h.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : history;

  const sidebarContent = (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header: Logo */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link href="/en" className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <circle cx="10" cy="10" r="7" stroke="#C4A882" strokeWidth="1.5" opacity="0.5" />
            <circle cx="14" cy="10" r="7" stroke="#E2DDD5" strokeWidth="1.5" opacity="0.7" />
            <circle cx="12" cy="14" r="7" stroke="#E2DDD5" strokeWidth="1.5" opacity="0.9" />
          </svg>
          <span className="text-lg font-semibold italic text-[#EAEAE8]">Hygge</span>
        </Link>
        <div className="flex items-center">
          <button
            onClick={() => setCollapsed(true)}
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8] md:flex"
          >
            <PanelLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8] md:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* General Discussion + Product Evaluation */}
      <div className="shrink-0 space-y-1 px-3 pt-2 pb-3">
        <Link
          href="/en/evaluate/new?mode=topic"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            isNewPage && currentMode === "topic"
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <MessageCircle className="h-4 w-4" />
          <span>General Discussion</span>
        </Link>
        <Link
          href="/en/evaluate/new?mode=product"
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            isNewPage && currentMode === "product"
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <Package className="h-4 w-4" />
          <span>Product Evaluation</span>
        </Link>
      </div>

      {/* Divider */}
      <div className="shrink-0 mx-4 border-t border-[#1C1C1C]" />

      {/* Your Discussions */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-3">
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
            const ModeIcon = item.mode === "product" ? Package : MessageCircle;
            const menuOpen = menuOpenId === item.id;
            return (
              <div key={item.id} className="group relative">
                <Link
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                    active
                      ? "bg-[#1C1C1C] text-[#EAEAE8]"
                      : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
                  }`}
                >
                  {item.status === "processing" || item.status === "pending" ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#C4A882]" />
                  ) : (
                    <ModeIcon className="h-3.5 w-3.5 shrink-0 opacity-40" />
                  )}
                  <span className="truncate pr-5">{item.name}</span>
                </Link>

                {/* Three-dot menu — visible on hover */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setMenuOpenId(menuOpen ? null : item.id);
                  }}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-[#666462] transition-all hover:bg-[#2A2A2A] hover:text-[#EAEAE8] ${
                    menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>

                {/* Dropdown menu */}
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setMenuOpenId(null)} />
                    <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-lg border border-[#2A2A2A] bg-[#141414] py-1 shadow-lg">
                      <button
                        onClick={() => handleShare(item)}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[#9B9594] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>Share</span>
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        disabled={deleting === item.id}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-[#F87171] transition-colors hover:bg-[#F87171]/10"
                      >
                        {deleting === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        <span>Delete</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-[#1C1C1C] px-3 py-3 space-y-1">
        {/* Upgrade */}
        <Link
          href="/en/pricing"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#9B9594] transition-colors hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
        >
          <Zap className="h-4 w-4" />
          <span>Upgrade</span>
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
              title="Log Out"
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

      {/* Desktop expand button (shown when sidebar is collapsed) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="fixed left-3 top-3 z-40 hidden h-9 w-9 items-center justify-center rounded-lg bg-[#0C0C0C]/80 text-[#9B9594] backdrop-blur transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8] md:flex"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      )}

      {/* Desktop sidebar — fixed */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden w-[260px] border-r border-[#1C1C1C] bg-[#0C0C0C] transition-transform duration-300 md:flex md:flex-col ${
          collapsed ? "-translate-x-full" : "translate-x-0"
        }`}
      >
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
