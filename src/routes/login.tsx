import { createFileRoute, useNavigate, Navigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Sign in — HRMS" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated, isReady } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isReady && isAuthenticated) {
    return <Navigate to="/dashboard" />;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate({ to: "/dashboard" });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Sign in failed";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            H
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Sign in to HRMS
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Use your work email and password.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="rounded-xl border border-border bg-card p-6 shadow-sm"
        >
          <label className="block text-sm font-medium text-foreground">
            Email
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus:ring-2"
              placeholder="you@company.com"
            />
          </label>

          <label className="mt-4 block text-sm font-medium text-foreground">
            Password
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-ring focus:ring-2"
              placeholder="••••••••"
            />
          </label>

          {error && (
            <p className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 inline-flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          API: <code>{import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1"}</code>
        </p>
      </div>
    </div>
  );
}
