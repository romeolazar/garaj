import { AppLogo } from "@/components/ui/app-logo";

// Centered card used by the login and first-run setup pages.
export function AuthCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <main className="auth-page">
      <section className="card auth-card">
        <div className="auth-logo"><AppLogo id="auth" /></div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
        {children}
      </section>
    </main>
  );
}
