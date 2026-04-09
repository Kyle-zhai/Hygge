"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface DeleteProjectButtonProps {
  projectId: string;
  locale: string;
}

export function DeleteProjectButton({ projectId, locale }: DeleteProjectButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isZh = locale === "zh";

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (res.ok) {
        setOpen(false);
        router.refresh();
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="rounded-md p-1 text-[#666462] transition-colors hover:bg-[#1C1C1C] hover:text-[#F87171]"
        title={isZh ? "删除" : "Delete"}
      >
        <X className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[#2A2A2A] bg-[#141414] sm:max-w-[400px]">
          <DialogHeader>
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#F87171]/10 mb-2">
              <Trash2 className="h-5 w-5 text-[#F87171]" />
            </div>
            <DialogTitle className="text-center text-[#EAEAE8]">
              {isZh ? "确认删除" : "Delete Record"}
            </DialogTitle>
            <DialogDescription className="text-center text-[#9B9594]">
              {isZh
                ? "此操作将永久删除该记录及其所有评估数据，无法撤销。"
                : "This will permanently delete this record and all associated evaluation data. This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={deleting}
              className="border-[#2A2A2A] bg-transparent text-[#9B9594] hover:bg-[#1C1C1C] hover:text-[#EAEAE8]"
            >
              {isZh ? "取消" : "Cancel"}
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-[#F87171] hover:bg-[#EF4444] text-white"
            >
              {deleting
                ? (isZh ? "删除中..." : "Deleting...")
                : (isZh ? "确认删除" : "Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
