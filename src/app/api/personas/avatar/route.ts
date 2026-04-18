import { NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { enforceRateLimit } from "@/lib/rate-limit";

const ALLOWED_AVATAR_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const ALLOWED_AVATAR_EXT = new Set(["png", "jpg", "jpeg", "webp", "gif"]);

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limitResponse = await enforceRateLimit("personas", user.id);
  if (limitResponse) return limitResponse;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_AVATAR_MIME.has(file.type)) {
    return NextResponse.json({ error: "File must be an image (png, jpg, webp, gif)" }, { status: 400 });
  }

  if (file.size > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "File must be under 2MB" }, { status: 400 });
  }

  const rawExt = (file.name.split(".").pop() || "png").toLowerCase();
  const ext = ALLOWED_AVATAR_EXT.has(rawExt) ? rawExt : "png";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = getAdminClient();
  const { error: uploadError } = await admin.storage
    .from("persona-avatars")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = admin.storage
    .from("persona-avatars")
    .getPublicUrl(path);

  return NextResponse.json({ url: urlData.publicUrl });
}
