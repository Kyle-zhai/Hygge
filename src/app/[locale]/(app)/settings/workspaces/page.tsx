"use client";

import { useCallback, useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Users, Plus, UserPlus, Trash2, LogOut, Loader2, Check, AlertCircle, Crown } from "lucide-react";

interface WorkspaceSummary {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
  role: "owner" | "member";
  is_owner: boolean;
}

interface MemberDetail {
  user_id: string;
  email: string | null;
  role: "owner" | "member";
  added_at: string;
}

interface WorkspaceDetail {
  workspace: WorkspaceSummary;
  members: MemberDetail[];
}

export default function WorkspacesSettingsPage() {
  const locale = useLocale();
  const zh = locale === "zh";

  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, WorkspaceDetail>>({});
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspaces = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    if (res.ok) {
      const d = await res.json();
      setWorkspaces(d.workspaces ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  async function loadDetail(id: string) {
    const res = await fetch(`/api/workspaces/${id}`);
    if (!res.ok) return;
    const d = await res.json();
    setDetails((prev) => ({ ...prev, [id]: d }));
  }

  function toggleExpand(id: string) {
    if (expanded === id) {
      setExpanded(null);
    } else {
      setExpanded(id);
      if (!details[id]) loadDetail(id);
    }
  }

  async function createWorkspace() {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    const res = await fetch("/api/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || (zh ? "创建失败" : "Failed to create"));
      return;
    }
    setNewName("");
    await loadWorkspaces();
  }

  async function deleteWorkspace(id: string) {
    if (!confirm(zh ? "删除此工作区？成员将失去访问权限。" : "Delete this workspace? Members will lose access.")) return;
    const res = await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
    if (res.ok) {
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      if (expanded === id) setExpanded(null);
    }
  }

  async function leaveWorkspace(id: string) {
    if (!confirm(zh ? "离开此工作区？" : "Leave this workspace?")) return;
    const detail = details[id];
    const self = detail?.members.find((m) => m.role !== "owner");
    if (!self) return;
    const res = await fetch(`/api/workspaces/${id}/members/${self.user_id}`, { method: "DELETE" });
    if (res.ok) {
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
      if (expanded === id) setExpanded(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-[#666462]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-[#EAEAE8] tracking-[-0.02em]">
          {zh ? "团队工作区" : "Team Workspaces"}
        </h1>
        <p className="mt-1 text-sm text-[#9B9594]">
          {zh
            ? "与队友共享项目与评估 — 邀请成员，所有人就能看到该工作区下的报告。"
            : "Share projects and evaluations with teammates — invited members see every report scoped to the workspace."}
        </p>
      </div>

      {workspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#2A2A2A] bg-[#0F0F0F] p-8 text-center">
          <Users className="mx-auto mb-3 h-7 w-7 text-[#666462]" />
          <p className="text-sm text-[#9B9594]">
            {zh ? "你还没有加入任何工作区。" : "You're not in any workspace yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-3 mb-8">
          {workspaces.map((w) => {
            const isOpen = expanded === w.id;
            const detail = details[w.id];
            return (
              <div key={w.id} className="rounded-xl border border-[#2A2A2A] bg-[#141414] overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleExpand(w.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#1A1A1A] transition-colors"
                >
                  <Users className="h-4 w-4 text-[#C4A882]" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#EAEAE8] truncate">{w.name}</p>
                    <p className="text-[11px] text-[#666462]">
                      {w.is_owner ? (zh ? "所有者" : "Owner") : (zh ? "成员" : "Member")}
                      {detail && ` · ${detail.members.length} ${zh ? "人" : "member" + (detail.members.length === 1 ? "" : "s")}`}
                    </p>
                  </div>
                  {w.is_owner && <Crown className="h-3.5 w-3.5 text-[#C4A882]" />}
                </button>
                {isOpen && (
                  <WorkspacePanel
                    detail={detail}
                    onRefresh={() => loadDetail(w.id)}
                    onDelete={() => deleteWorkspace(w.id)}
                    onLeave={() => leaveWorkspace(w.id)}
                    zh={zh}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-[#2A2A2A] bg-[#141414] p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#666462]">
          {zh ? "新建工作区" : "Create a workspace"}
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={zh ? "例如：设计团队" : "e.g. Design team"}
            className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-3 py-2 text-sm text-[#EAEAE8] placeholder:text-[#666462] outline-none transition-colors focus:border-[#C4A882]/50"
          />
          <button
            type="button"
            onClick={createWorkspace}
            disabled={creating || !newName.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#E2DDD5] px-4 py-2 text-sm font-semibold text-[#0C0C0C] transition-colors hover:bg-[#D4CFC7] disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {zh ? "创建" : "Create"}
          </button>
        </div>
        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-[#F87171]/30 bg-[#F87171]/5 p-2.5 text-xs text-[#F87171]">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspacePanel({
  detail,
  onRefresh,
  onDelete,
  onLeave,
  zh,
}: {
  detail: WorkspaceDetail | undefined;
  onRefresh: () => void;
  onDelete: () => void;
  onLeave: () => void;
  zh: boolean;
}) {
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  if (!detail) {
    return (
      <div className="px-4 py-4 border-t border-[#2A2A2A] flex justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-[#666462]" />
      </div>
    );
  }

  const { workspace, members } = detail;

  async function invite() {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);
    const res = await fetch(`/api/workspaces/${workspace.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setInviting(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setInviteError(d.error || (zh ? "邀请失败" : "Invite failed"));
      return;
    }
    setInviteSuccess(true);
    setInviteEmail("");
    onRefresh();
  }

  async function removeMember(userId: string) {
    const res = await fetch(`/api/workspaces/${workspace.id}/members/${userId}`, { method: "DELETE" });
    if (res.ok) onRefresh();
  }

  return (
    <div className="border-t border-[#2A2A2A] px-4 py-4 space-y-4">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#666462]">
          {zh ? "成员" : "Members"}
        </p>
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center gap-2 text-sm">
              <span className="flex-1 truncate text-[#EAEAE8]">
                {m.email ?? m.user_id.slice(0, 8)}
              </span>
              {m.role === "owner" && (
                <span className="inline-flex items-center gap-1 rounded-md border border-[#C4A882]/30 bg-[#C4A882]/5 px-1.5 py-0.5 text-[10px] text-[#C4A882]">
                  <Crown className="h-2.5 w-2.5" />
                  {zh ? "所有者" : "Owner"}
                </span>
              )}
              {workspace.is_owner && m.role !== "owner" && (
                <button
                  type="button"
                  onClick={() => removeMember(m.user_id)}
                  className="text-[#666462] hover:text-[#F87171] transition-colors"
                  aria-label={zh ? "移除成员" : "Remove member"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {workspace.is_owner && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[#666462]">
            {zh ? "邀请成员" : "Invite member"}
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="flex-1 rounded-lg border border-[#2A2A2A] bg-[#0C0C0C] px-3 py-2 text-sm text-[#EAEAE8] placeholder:text-[#666462] outline-none transition-colors focus:border-[#C4A882]/50"
            />
            <button
              type="button"
              onClick={invite}
              disabled={inviting || !inviteEmail.trim()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] bg-[#1C1C1C] px-3 py-2 text-xs text-[#9B9594] transition-colors hover:border-[#C4A882]/30 hover:text-[#EAEAE8] disabled:opacity-50"
            >
              {inviting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
              {zh ? "邀请" : "Invite"}
            </button>
          </div>
          <p className="mt-1.5 text-[10px] text-[#666462]">
            {zh ? "对方必须已用该邮箱注册。" : "The invitee must already have signed up with that email."}
          </p>
          {inviteError && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#F87171]/30 bg-[#F87171]/5 p-2 text-[11px] text-[#F87171]">
              <AlertCircle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>{inviteError}</span>
            </div>
          )}
          {inviteSuccess && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#4ADE80]/30 bg-[#4ADE80]/5 p-2 text-[11px] text-[#4ADE80]">
              <Check className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>{zh ? "已添加！" : "Added!"}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end pt-1">
        {workspace.is_owner ? (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#9B9594] transition-colors hover:border-[#F87171]/50 hover:text-[#F87171]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {zh ? "删除工作区" : "Delete workspace"}
          </button>
        ) : (
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#2A2A2A] px-3 py-1.5 text-xs text-[#9B9594] transition-colors hover:border-[#F87171]/50 hover:text-[#F87171]"
          >
            <LogOut className="h-3.5 w-3.5" />
            {zh ? "离开工作区" : "Leave workspace"}
          </button>
        )}
      </div>
    </div>
  );
}
