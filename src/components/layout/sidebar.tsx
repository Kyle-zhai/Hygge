"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
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
  ExternalLink,
  ChevronRight,
  Trash2,
  Scale,
  Store,
  UserCircle,
  BarChart3,
  ListFilter,
  Swords,
  LayoutDashboard,
  Settings,
  Users,
  Languages,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface HistoryItem {
  id: string;
  name: string;
  evaluationId: string | null;
  status: string | null;
  mode: string;
  isCompare: boolean;
  isDebate?: boolean;
  debateId?: string;
  createdAt?: string;
}

interface SidebarProps {
  userEmail: string | null;
  history: HistoryItem[];
  plan: string;
  evaluationsUsed: number;
  evaluationsLimit: number;
  isBYOK?: boolean;
}

export function Sidebar({ userEmail, history, plan, evaluationsUsed, evaluationsLimit, isBYOK }: SidebarProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const locale = useLocale();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menu, setMenu] = useState<{ itemId: string; top: number; left: number } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const isNewPage = pathname.includes("/evaluate/new");
  const currentMode = searchParams.get("mode") || "topic";
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [typeFilter, setTypeFilter] = useState<Set<string>>(new Set());
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const discussionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;
    if (collapsed) {
      main.style.marginLeft = "0px";
    } else {
      main.style.removeProperty("margin-left");
    }
  }, [collapsed]);

  useEffect(() => {
    if (!userMenuOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setUserMenuOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userMenuOpen]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const scrollEl = discussionRef.current;
    scrollEl?.addEventListener("scroll", close);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("keydown", onKey);
    return () => {
      scrollEl?.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function openMenuFor(e: React.MouseEvent<HTMLButtonElement>, itemId: string) {
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const MENU_W = 192;
    const MENU_H = 104;
    const GAP = 8;
    const MARGIN = 12;

    // Prefer the right side of the button; fall back to the left if it would overflow.
    let left = rect.right + GAP;
    if (left + MENU_W > window.innerWidth - MARGIN) {
      left = Math.max(MARGIN, rect.left - MENU_W - GAP);
    }

    // Align to button top; if the menu would overflow the viewport bottom,
    // clamp it upward so the whole menu stays visible.
    let top = rect.top - 6;
    if (top + MENU_H > window.innerHeight - MARGIN) {
      top = window.innerHeight - MARGIN - MENU_H;
    }
    if (top < MARGIN) top = MARGIN;

    setMenu({ itemId, top, left });
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push(`/${locale}/auth/login`);
    router.refresh();
  }

  function switchLocale(next: "en" | "zh") {
    if (next === locale) { setUserMenuOpen(false); return; }
    const stripped = pathname.replace(/^\/(en|zh)(?=\/|$)/, "");
    const target = `/${next}${stripped || ""}`;
    const qs = searchParams.toString();
    router.push(qs ? `${target}?${qs}` : target);
    router.refresh();
    setUserMenuOpen(false);
  }

  async function handleDelete(itemId: string) {
    const item = history.find((h) => h.id === itemId);
    if (!item) return;
    setDeleting(itemId);
    setConfirmDeleteId(null);
    try {
      const url = item.isDebate && item.debateId
        ? `/api/debates/${item.debateId}`
        : `/api/projects/${itemId}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        setMenu(null);
        router.push(`/${locale}/evaluate/new?mode=topic`);
        router.refresh();
      }
    } finally {
      setDeleting(null);
    }
  }

  function handleShare(item: HistoryItem) {
    const url = item.evaluationId
      ? `${window.location.origin}/${locale}/evaluate/${item.evaluationId}/result`
      : window.location.href;
    navigator.clipboard.writeText(url);
    setMenu(null);
  }

  const filteredHistory = history.filter((h) => {
    if (searchQuery && !h.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (typeFilter.size === 0) return true;
    if (h.isDebate) return typeFilter.has("debate");
    if (h.isCompare) return typeFilter.has("compare");
    if (h.mode === "product") return typeFilter.has("product");
    return typeFilter.has("topic");
  });

  function toggleTypeFilter(type: string) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div
        ref={discussionRef}
        data-lenis-prevent
        className="scrollbar-sidebar flex-1 min-h-0 overflow-y-auto overscroll-contain"
      >
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
          href={`/${locale}/dashboard`}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname.endsWith("/dashboard") || pathname.includes("/dashboard/")
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <LayoutDashboard className="h-4 w-4" />
          <span>{locale === "zh" ? "总览" : "Overview"}</span>
        </Link>
        <Link
          href={`/${locale}/evaluate/new?mode=topic`}
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
          href={`/${locale}/evaluate/new?mode=product`}
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
        <Link
          href={`/${locale}/compare`}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname.includes("/compare")
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <Scale className="h-4 w-4" />
          <span>Compare</span>
        </Link>
        <Link
          href={`/${locale}/debates`}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname.includes("/debates")
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <Swords className="h-4 w-4" />
          <span>Debate</span>
        </Link>
        <Link
          href={`/${locale}/marketplace`}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname.includes("/marketplace")
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <Store className="h-4 w-4" />
          <span>Marketplace</span>
        </Link>
        <Link
          href={`/${locale}/personas`}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname.includes("/personas")
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <UserCircle className="h-4 w-4" />
          <span>My Personas</span>
        </Link>
        <Link
          href={`/${locale}/publications`}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname.includes("/publications")
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          <span>My Publications</span>
        </Link>
        <Link
          href={`/${locale}/settings/llm`}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname.includes("/settings/llm")
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <Settings className="h-4 w-4" />
          <span>{locale === "zh" ? "LLM 设置" : "LLM Settings"}</span>
        </Link>
        <Link
          href={`/${locale}/settings/workspaces`}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
            pathname.includes("/settings/workspaces")
              ? "bg-[#1C1C1C] text-[#EAEAE8] font-medium"
              : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>{locale === "zh" ? "团队工作区" : "Workspaces"}</span>
        </Link>
      </div>

      {/* Divider */}
      <div className="shrink-0 mx-4 border-t border-[#1C1C1C]" />

      {/* Your Discussions */}
      <div className="px-3 pt-3 pb-3">
        <div className="mb-2 flex items-center justify-between px-3">
          <p className="text-xs font-medium text-[#666462]">Your Discussions</p>
          <div className="relative">
            <button
              ref={filterBtnRef}
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                typeFilter.size > 0
                  ? "text-[#C4A882] bg-[#C4A882]/10"
                  : "text-[#666462] hover:text-[#9B9594] hover:bg-[#1C1C1C]"
              }`}
            >
              <ListFilter className="h-3.5 w-3.5" />
            </button>
            <AnimatePresence>
              {filterOpen && (
                <>
                  <div className="fixed inset-0 z-[55]" onClick={() => setFilterOpen(false)} />
                  <motion.div
                    initial={{ opacity: 0, x: -4, scale: 0.96 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -4, scale: 0.96 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                    className="absolute right-0 top-full mt-1 z-[60] w-[130px] rounded-lg border border-[#2A2A2A] bg-[#141414] p-1 shadow-xl shadow-black/50"
                  >
                    {(["topic", "product", "compare", "debate"] as const).map((type) => {
                      const active = typeFilter.has(type);
                      const labels: Record<string, string> = { topic: "Topic", product: "Product", compare: "Compare", debate: "Debate" };
                      const Icons: Record<string, typeof MessageCircle> = { topic: MessageCircle, product: Package, compare: Scale, debate: Swords };
                      const Icon = Icons[type];
                      return (
                        <button
                          key={type}
                          onClick={() => toggleTypeFilter(type)}
                          className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs transition-colors ${
                            active
                              ? "bg-[#C4A882]/10 text-[#C4A882]"
                              : "text-[#9B9594] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
                          }`}
                        >
                          <Icon className="h-3 w-3" />
                          <span className="font-medium">{labels[type]}</span>
                        </button>
                      );
                    })}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

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
            const href = item.isDebate && item.debateId
              ? `/${locale}/debates/${item.debateId}`
              : item.evaluationId
                ? item.status === "completed"
                  ? `/${locale}/evaluate/${item.evaluationId}/result`
                  : `/${locale}/evaluate/${item.evaluationId}/progress`
                : "#";
            const active = item.isDebate
              ? item.debateId && pathname.includes(item.debateId)
              : item.evaluationId && pathname.includes(item.evaluationId);
            const ModeIcon = item.isDebate ? Swords : item.isCompare ? Scale : item.mode === "product" ? Package : MessageCircle;
            const menuOpen = menu?.itemId === item.id;
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
                  onClick={(e) => (menuOpen ? setMenu(null) : openMenuFor(e, item.id))}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-[#666462] transition-all hover:bg-[#2A2A2A] hover:text-[#EAEAE8] ${
                    menuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  }`}
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      </div>

      {/* Bottom section — pinned, never scrolls */}
      <div className="shrink-0 border-t border-[#1C1C1C] px-3 py-3">
        {userEmail && (
          <button
            onClick={() => setUserMenuOpen((v) => !v)}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-[#1C1C1C]/60"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-xs font-medium text-[#E2DDD5]">
                {userEmail[0].toUpperCase()}
              </div>
              <p className="truncate text-sm text-[#EAEAE8]">{userEmail.split("@")[0]}</p>
            </div>
            <LogOut className="h-3.5 w-3.5 shrink-0 text-[#666462]" />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="no-print fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg bg-[#0C0C0C]/80 text-[#9B9594] backdrop-blur transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8] md:hidden"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      {/* Desktop expand button (shown when sidebar is collapsed) */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="no-print fixed left-3 top-3 z-40 hidden h-9 w-9 items-center justify-center rounded-lg bg-[#0C0C0C]/80 text-[#9B9594] backdrop-blur transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8] md:flex"
        >
          <PanelLeft className="h-5 w-5" />
        </button>
      )}

      {/* Desktop sidebar — fixed */}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-[#1C1C1C] bg-[#0C0C0C] transition-transform duration-300 md:flex ${
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
              className="no-print fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r border-[#1C1C1C] bg-[#0C0C0C] md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Floating history item menu — rendered at top level so it escapes
          the sidebar's scroll clip, positioned via fixed coords computed from
          the trigger button's viewport rect. */}
      <AnimatePresence>
        {menu && (() => {
          const item = history.find((i) => i.id === menu.itemId);
          if (!item) return null;
          return (
            <>
              <div
                className="fixed inset-0 z-[55]"
                onClick={() => setMenu(null)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setMenu(null);
                }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: -2 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: -2 }}
                transition={{ duration: 0.12, ease: "easeOut" }}
                style={{ top: menu.top, left: menu.left }}
                className="fixed z-[60] w-48 rounded-xl border border-[#2A2A2A] bg-[#141414] p-1.5 shadow-2xl shadow-black/50"
              >
                <button
                  onClick={() => handleShare(item)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#EAEAE8] transition-colors hover:bg-[#1C1C1C]"
                >
                  <ExternalLink className="h-4 w-4 text-[#9B9594]" />
                  <span className="flex-1 text-left font-medium">Share</span>
                  <ChevronRight className="h-4 w-4 text-[#666462]" />
                </button>
                <button
                  onClick={() => {
                    setMenu(null);
                    setConfirmDeleteId(item.id);
                  }}
                  disabled={deleting === item.id}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#F87171] transition-colors hover:bg-[#F87171]/10"
                >
                  {deleting === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  <span className="flex-1 text-left font-medium">Delete</span>
                </button>
              </motion.div>
            </>
          );
        })()}
      </AnimatePresence>

      {/* Delete confirmation dialog */}
      <AnimatePresence>
        {confirmDeleteId && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmDeleteId(null)}
              className="fixed inset-0 z-[60] bg-black/60"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-1/2 z-[70] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#2A2A2A] bg-[#141414] p-6 shadow-2xl"
            >
              <h3 className="text-base font-semibold text-[#EAEAE8] mb-2">
                Delete Discussion
              </h3>
              <p className="text-sm text-[#9B9594] mb-6">
                This action cannot be undone. All data associated with this discussion will be permanently deleted.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setConfirmDeleteId(null)}
                  className="rounded-lg border border-[#2A2A2A] bg-[#1C1C1C] px-4 py-2 text-sm text-[#EAEAE8] transition-colors hover:bg-[#222222]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDeleteId)}
                  disabled={deleting === confirmDeleteId}
                  className="rounded-lg bg-[#F87171] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#EF4444] disabled:opacity-50"
                >
                  {deleting === confirmDeleteId ? "Deleting..." : "Delete"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* User menu popup — fixed position to escape sidebar overflow-hidden */}
      <AnimatePresence>
        {userMenuOpen && userEmail && (
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setUserMenuOpen(false)} />
            <motion.div
              key="user-menu"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="fixed bottom-[60px] left-[12px] z-[60] w-[236px] rounded-xl border border-[#2A2A2A] bg-[#141414] shadow-2xl shadow-black/60"
            >
              {/* User info */}
              <div className="flex items-center gap-3 px-4 py-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-sm font-medium text-[#E2DDD5]">
                  {userEmail[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[#EAEAE8]">{userEmail.split("@")[0]}</p>
                  <p className="truncate text-xs text-[#666462]">{userEmail}</p>
                </div>
              </div>

              <div className="mx-3 border-t border-[#2A2A2A]" />

              {/* Plan + Credits */}
              <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs text-[#666462]">
                    {isBYOK ? (locale === "zh" ? "使用自带密钥" : "Using your own key") : "Credits Left"}
                  </span>
                  <span
                    className={
                      isBYOK
                        ? "rounded-md border border-[#C4A882]/40 bg-[#C4A882]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#C4A882]"
                        : "rounded-md bg-[#1C1C1C] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-[#C4A882]"
                    }
                  >
                    {isBYOK ? "BYOK" : plan}
                  </span>
                </div>
                {isBYOK ? (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-semibold text-[#EAEAE8]">∞</span>
                      <span className="text-xs text-[#666462]">
                        {locale === "zh" ? "不限次数 · 全部功能解锁" : "Unlimited · all features unlocked"}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1C1C1C]">
                      <div className="h-full w-full rounded-full bg-gradient-to-r from-[#C4A882] to-[#8B7355]" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-semibold text-[#EAEAE8]">
                        {evaluationsLimit - evaluationsUsed}
                      </span>
                      <span className="text-xs text-[#666462]">/ {evaluationsLimit}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1C1C1C]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#C4A882] to-[#8B7355] transition-all duration-300"
                        style={{ width: `${Math.max(2, ((evaluationsLimit - evaluationsUsed) / evaluationsLimit) * 100)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="mx-3 border-t border-[#2A2A2A]" />

              {/* Actions */}
              <div className="p-1.5">
                <Link
                  href={`/${locale}/pricing`}
                  onClick={() => setUserMenuOpen(false)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#9B9594] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
                >
                  <Zap className="h-4 w-4" />
                  <span>{locale === "zh" ? "升级套餐" : "Upgrade Plan"}</span>
                </Link>
                <div className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-[#9B9594]">
                  <Languages className="h-4 w-4 shrink-0" />
                  <span className="flex-1">{locale === "zh" ? "语言" : "Language"}</span>
                  <div className="flex items-center rounded-md border border-[#2A2A2A] bg-[#0C0C0C] p-0.5 text-[11px] font-medium">
                    <button
                      onClick={() => switchLocale("en")}
                      className={`rounded px-2 py-0.5 transition-colors ${
                        locale === "en"
                          ? "bg-[#C4A882]/20 text-[#C4A882]"
                          : "text-[#666462] hover:text-[#EAEAE8]"
                      }`}
                    >
                      EN
                    </button>
                    <button
                      onClick={() => switchLocale("zh")}
                      className={`rounded px-2 py-0.5 transition-colors ${
                        locale === "zh"
                          ? "bg-[#C4A882]/20 text-[#C4A882]"
                          : "text-[#666462] hover:text-[#EAEAE8]"
                      }`}
                    >
                      中文
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => { setUserMenuOpen(false); handleLogout(); }}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#9B9594] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{locale === "zh" ? "退出登录" : "Sign out"}</span>
                </button>
              </div>

              <div className="mx-3 border-t border-[#2A2A2A]" />

              <div className="flex items-center justify-center gap-3 px-3 py-2 text-[10px] text-[#666462]">
                <Link href={`/${locale}/legal/terms`} className="hover:text-[#9B9594]" onClick={() => setUserMenuOpen(false)}>
                  Terms
                </Link>
                <span>·</span>
                <Link href={`/${locale}/legal/privacy`} className="hover:text-[#9B9594]" onClick={() => setUserMenuOpen(false)}>
                  Privacy
                </Link>
                <span>·</span>
                <Link href={`/${locale}/legal/cookies`} className="hover:text-[#9B9594]" onClick={() => setUserMenuOpen(false)}>
                  Cookies
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
