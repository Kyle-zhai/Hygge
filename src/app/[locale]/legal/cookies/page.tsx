import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Cookie Policy",
};

const LAST_UPDATED = "April 17, 2026";

export default function CookiesPage() {
  return (
    <>
      <h1>Cookie Policy</h1>
      <p className="text-sm text-[#A8A89E]">Last updated: {LAST_UPDATED}</p>

      <p>
        Hygge uses a small set of cookies and similar storage (local storage) that are strictly necessary to
        provide the Service. We do not use advertising or cross-site tracking cookies.
      </p>

      <h2>1. Essential Cookies</h2>
      <ul>
        <li>
          <strong>Authentication:</strong> Supabase session tokens are stored as HTTP-only cookies so you stay
          signed in across page loads.
        </li>
        <li>
          <strong>Locale preference:</strong> the language you pick is stored so the interface renders in the
          same locale on your next visit.
        </li>
        <li>
          <strong>Theme preference:</strong> light or dark mode preference, stored in local storage.
        </li>
      </ul>

      <h2>2. Functional Storage</h2>
      <ul>
        <li>Sidebar collapse state and other UI preferences (local storage only, never sent to our servers).</li>
        <li>Draft evaluation input (local storage) so accidental refreshes don&rsquo;t lose your work.</li>
      </ul>

      <h2>3. Third-Party Cookies</h2>
      <ul>
        <li>
          <strong>Stripe</strong> sets cookies on its hosted checkout page to prevent fraud. Those cookies are
          governed by Stripe&rsquo;s privacy policy.
        </li>
        <li>
          <strong>Sentry</strong> (when enabled) sets a session-scoped cookie purely to correlate errors to the
          current page load. No cross-site tracking.
        </li>
      </ul>

      <h2>4. Managing Cookies</h2>
      <p>
        You can clear cookies and local storage through your browser at any time. Doing so will sign you out and
        reset your UI preferences.
      </p>

      <h2>5. Contact</h2>
      <p>
        Questions can be sent to <a href="mailto:privacy@hygge.ai">privacy@hygge.ai</a>.
      </p>
    </>
  );
}
