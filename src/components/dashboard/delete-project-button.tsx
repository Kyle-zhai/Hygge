"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

interface DeleteProjectButtonProps {
  projectId: string;
  confirmText: string;
}

export function DeleteProjectButton({ projectId, confirmText }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm(confirmText)) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-md p-1 text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#F87171] disabled:opacity-50"
      title="Delete"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
