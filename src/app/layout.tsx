import type { Metadata, Viewport } from "next";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth/current-user";
import { asUser } from "@/lib/db";
import { DEFAULT_A11Y, htmlDataAttributes, parseA11y } from "@/lib/domain/accessibility";
import { A11yProvider } from "@/components/a11y-provider";
import { config } from "@/lib/config";
import { DemoBanner } from "@/components/demo-banner";

export const metadata: Metadata = {
  title: { default: "Bloom", template: "%s · Bloom" },
  description: "Inclusive classroom collaboration with a supportive AI facilitator.",
};

export const viewport: Viewport = {
  themeColor: "#f6f6f2",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  let prefs = DEFAULT_A11Y;
  if (user?.role === "student") {
    const row = await asUser(user.id, (db) =>
      db.maybeOne<{ accessibility: unknown }>("select accessibility from student_preferences where student_id = $1", [user.id]),
    ).catch(() => null);
    prefs = parseA11y(row?.accessibility);
  }
  return (
    <html lang="en-GB" {...htmlDataAttributes(prefs)}>
      <body className="antialiased">
        <a
          href="#main"
          className="sr-only-focusable fixed left-3 top-3 z-[100] rounded-lg bg-ink px-4 py-2 font-semibold text-white"
        >
          Skip to main content
        </a>
        {config.demoMode ? <DemoBanner aiMode={config.aiMode} /> : null}
        <A11yProvider initial={prefs} persist={user?.role === "student" ? "server" : "local"}>
          {children}
        </A11yProvider>
      </body>
    </html>
  );
}
