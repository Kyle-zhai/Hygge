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
        <Avatar className="h-8 w-8 border border-[#2A2A2A] bg-[#1C1C1C]">
          <AvatarFallback className="bg-[#1C1C1C] text-[#E2DDD5] text-sm font-medium">
            {email[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="border-[#2A2A2A] bg-[#141414]">
        <DropdownMenuItem className="text-sm text-[#666462]" disabled>
          {email}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push("/settings")}
          className="text-[#9B9594] hover:text-[#EAEAE8] focus:bg-[#1C1C1C] focus:text-[#EAEAE8]"
        >
          {t("settings")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handleLogout}
          className="text-[#9B9594] hover:text-[#EAEAE8] focus:bg-[#1C1C1C] focus:text-[#EAEAE8]"
        >
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
