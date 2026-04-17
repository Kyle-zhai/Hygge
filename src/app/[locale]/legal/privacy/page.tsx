import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
};

const LAST_UPDATED = "April 17, 2026";

export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p className="text-sm text-[#A8A89E]">Last updated: {LAST_UPDATED}</p>

      <h2>1. Who We Are</h2>
      <p>
        Hygge is the data controller for information collected through the Service. You can reach us at
        {" "}<a href="mailto:privacy@hygge.ai">privacy@hygge.ai</a>.
      </p>

      <h2>2. Data We Collect</h2>
      <ul>
        <li><strong>Account data:</strong> email address, authentication tokens, and plan metadata.</li>
        <li><strong>User Content:</strong> the prompts, URLs, and files you submit for evaluation, plus generated outputs.</li>
        <li><strong>Custom personas:</strong> any persona definitions you create and save to your account.</li>
        <li><strong>BYOK credentials:</strong> if you provide an LLM API key, it is encrypted with AES-256-GCM using a key
          derived from a server-side secret before being stored. We do not display it again after you save it.</li>
        <li><strong>Usage data:</strong> minimal logs (timestamps, route, status codes, error messages) to operate and debug the Service.</li>
        <li><strong>Billing data:</strong> handled entirely by Stripe; we store only the Stripe customer/subscription IDs, not card numbers.</li>
      </ul>

      <h2>3. How We Use Data</h2>
      <ul>
        <li>To deliver the Service and produce AI-generated evaluations.</li>
        <li>To enforce plan quotas, rate limits, and abuse prevention.</li>
        <li>To process payments through Stripe.</li>
        <li>To contact you about your account, security, or material changes to the Service.</li>
        <li>To diagnose errors and improve reliability (error monitoring via Sentry, when enabled).</li>
      </ul>

      <h2>4. Sub-Processors</h2>
      <p>We rely on the following third parties to operate the Service. Each is bound by its own privacy and security policies:</p>
      <ul>
        <li>Supabase — hosted Postgres, object storage, and authentication.</li>
        <li>Upstash — Redis and rate-limit counters.</li>
        <li>Stripe — payments and subscription management.</li>
        <li>LLM providers — whichever provider the default backend or your BYOK configuration routes to (e.g., OpenAI-compatible endpoints, Anthropic, Google). Your prompts and attachments are forwarded to these providers.</li>
        <li>Sentry (optional) — error monitoring, used only when a DSN is configured.</li>
        <li>Vercel — application hosting.</li>
      </ul>

      <h2>5. Your Prompts and LLM Providers</h2>
      <p>
        When you submit a prompt or attachment, it is forwarded to the selected LLM provider for inference. Those
        providers may log the request per their own retention policies. If you use BYOK, your API key governs
        which provider receives the data.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        We retain account, evaluation, and persona data for as long as your account is active. When you delete
        your account, we delete or anonymize your data within 30 days, except where longer retention is required
        by law (e.g., invoicing records).
      </p>

      <h2>7. Your Rights</h2>
      <p>Depending on where you live, you may have the right to:</p>
      <ul>
        <li>Access, correct, or delete your personal data.</li>
        <li>Export your evaluations and custom personas.</li>
        <li>Object to or restrict certain processing.</li>
        <li>Lodge a complaint with a supervisory authority.</li>
      </ul>
      <p>To exercise these rights, email <a href="mailto:privacy@hygge.ai">privacy@hygge.ai</a>.</p>

      <h2>8. Security</h2>
      <p>
        We use TLS in transit, Supabase Row-Level Security, and AES-256-GCM encryption for BYOK keys. No system
        is perfectly secure — report suspected vulnerabilities to <a href="mailto:security@hygge.ai">security@hygge.ai</a>.
      </p>

      <h2>9. Children</h2>
      <p>
        The Service is not intended for users under the age of 16, and we do not knowingly collect data from them.
      </p>

      <h2>10. International Transfers</h2>
      <p>
        Our infrastructure is hosted in Hong Kong (primary) with sub-processors in the United States and Europe.
        By using the Service, you consent to your data being transferred to and processed in those jurisdictions.
      </p>

      <h2>11. Changes</h2>
      <p>
        We will post updates to this policy on this page and update the &ldquo;Last updated&rdquo; date above. Material
        changes will be announced via email.
      </p>
    </>
  );
}
