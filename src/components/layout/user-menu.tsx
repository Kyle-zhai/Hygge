"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
  email: string;
}

export function UserMenu({ email }: UserMenuProps) {
  const t = useTranslations("common");
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <Avatar className="h-8 w-8 border border-[color:var(--border-default)] bg-[color:var(--bg-tertiary)]">
          <AvatarFallback className="bg-[color:var(--bg-tertiary)] text-[color:var(--accent-primary)] text-sm font-medium">
            {email[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-[color:var(--border-default)] bg-[color:var(--bg-secondary)]">
        <DropdownMenuItem className="text-sm text-[color:var(--text-tertiary)]" disabled>
          {email}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/settings")}
          className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] focus:bg-[color:var(--bg-tertiary)] focus:text-[color:var(--text-primary)]"
        >
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] focus:bg-[color:var(--bg-tertiary)] focus:text-[color:var(--text-primary)]"
        >
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
