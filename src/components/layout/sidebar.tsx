"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { AnimatePresence, motion } from "framer-motion";
import {
  Plus,
  PanelLeftClose,
  PanelLeft,
  LayoutDashboard,
  CreditCard,
  Settings,
  LogOut,
  FileText,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  const te = useTranslations("evaluation");
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/en/auth/login");
    router.refresh();
  }

  const navItems = [
    { href: "/en/dashboard", icon: LayoutDashboard, label: t("dashboard") },
    { href: "/en/pricing", icon: CreditCard, label: t("pricing") },
    { href: "/en/settings", icon: Settings, label: t("settings") },
  ];

  const isActive = (href: string) => pathname.startsWith(href);

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Header: Logo + collapse toggle */}
      <div className="flex h-14 items-center gap-2 px-3">
        <button
          onClick={() => {
            if (window.innerWidth < 768) {
              setMobileOpen(false);
            } else {
              setCollapsed(!collapsed);
            }
          }}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#9B9594] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
        >
          {collapsed ? <PanelLeft className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
        {!collapsed && (
          <Link href="/en" className="flex items-center gap-2">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
              <circle cx="10" cy="10" r="7" stroke="#C4A882" strokeWidth="1.5" opacity="0.5" />
              <circle cx="14" cy="10" r="7" stroke="#E2DDD5" strokeWidth="1.5" opacity="0.7" />
              <circle cx="12" cy="14" r="7" stroke="#E2DDD5" strokeWidth="1.5" opacity="0.9" />
            </svg>
            <span className="text-lg font-semibold italic text-[#EAEAE8]">Hygge</span>
          </Link>
        )}
      </div>

      {/* New Discussion button */}
      <div className="px-3 py-2">
        <Link
          href="/en/evaluate/new"
          className={`flex items-center gap-2.5 rounded-xl border border-[#2A2A2A] bg-[#141414] px-3 py-2.5 text-sm font-medium text-[#EAEAE8] transition-all hover:border-[#3A3A3A] hover:bg-[#1C1C1C] ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <Plus className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{t("startNew")}</span>}
        </Link>
      </div>

      {/* History section */}
      {!collapsed && history.length > 0 && (
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-[#666462]">
            Recent
          </p>
          <div className="space-y-0.5">
            {history.map((item) => {
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
                  className={`group flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors ${
                    active
                      ? "bg-[#1C1C1C] text-[#EAEAE8]"
                      : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
                  }`}
                >
                  {item.status === "processing" || item.status === "pending" ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#C4A882]" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 shrink-0 opacity-50" />
                  )}
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {collapsed && <div className="flex-1" />}

      {/* Navigation links */}
      <div className="border-t border-[#1C1C1C] px-3 py-2">
        {navItems.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors ${
              collapsed ? "justify-center" : ""
            } ${
              isActive(href)
                ? "bg-[#1C1C1C] text-[#EAEAE8]"
                : "text-[#9B9594] hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </Link>
        ))}
      </div>

      {/* User section */}
      {userEmail && (
        <div className="border-t border-[#1C1C1C] px-3 py-3">
          <div className={`flex items-center gap-2.5 ${collapsed ? "justify-center" : ""}`}>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1C1C1C] text-sm font-medium text-[#E2DDD5]">
              {userEmail[0].toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm text-[#EAEAE8]">{userEmail}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="mt-2 flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-[#9B9594] transition-colors hover:bg-[#1C1C1C]/60 hover:text-[#EAEAE8]"
            >
              <LogOut className="h-4 w-4" />
              <span>{t("logout")}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 flex h-9 w-9 items-center justify-center rounded-lg text-[#9B9594] transition-colors hover:bg-[#1C1C1C] hover:text-[#EAEAE8] md:hidden"
      >
        <PanelLeft className="h-5 w-5" />
      </button>

      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 60 : 240 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:flex h-screen shrink-0 flex-col border-r border-[#1C1C1C] bg-[#0C0C0C]"
      >
        {sidebarContent}
      </motion.aside>

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
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="fixed left-0 top-0 z-50 h-screen w-[240px] border-r border-[#1C1C1C] bg-[#0C0C0C] md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
