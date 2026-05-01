import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "fxipvrbqpwjdlvrrzodg.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  // officeparser does dynamic require() of pdfjs/tesseract workers at
  // runtime; bundling it makes those resolves fail and OfficeParser ends
  // up undefined in the function. Keep it external so Node resolves it
  // normally at runtime.
  serverExternalPackages: ["officeparser"],
};

export default withNextIntl(nextConfig);
