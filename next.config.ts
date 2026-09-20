import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Persona avatars are served from Supabase Storage. Derive the allowed image
// host from the same env var the client uses, so a fresh clone pointed at its
// own Supabase project renders avatars without editing this file.
const supabaseHost = (() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
  // officeparser does dynamic require() of pdfjs/tesseract workers at
  // runtime; bundling it makes those resolves fail and OfficeParser ends
  // up undefined in the function. Keep it external so Node resolves it
  // normally at runtime.
  serverExternalPackages: ["officeparser"],
};

export default withNextIntl(nextConfig);
