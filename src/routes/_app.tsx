import {
  createFileRoute,
  Outlet,
  Link,
  Navigate,
  useNavigate,
} from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { isAuthenticated, isReady, user, logout } = useAuth();
  const navigate = useNavigate();

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/login" />;

  async function handleLogout() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-60 shrink-0 border-r border-border bg-card md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
            H
          </div>
          <span className="font-semibold tracking-tight text-foreground">HRMS</span>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <NavItem to="/dashboard" label="Dashboard" />
          <NavItem to="/attendance" label="Attendance" />
          <NavItem to="/profile" label="Profile" />
        </nav>
        <div className="border-t border-border p-3">
          <div className="px-2 pb-2 text-xs text-muted-foreground">
            <div className="truncate font-medium text-foreground">
              {user?.full_name}
            </div>
            <div className="truncate">{user?.email}</div>
            <div className="mt-1 inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-secondary-foreground">
              {user?.role}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-border bg-card px-4 md:px-8">
          <div className="md:hidden flex items-center gap-2">
            <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold">
              H
            </div>
            <span className="font-semibold text-foreground">HRMS</span>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            {user?.full_name}
          </div>
        </header>
        <main className="flex-1 p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      activeProps={{
        className:
          "block rounded-md px-3 py-2 text-sm font-medium bg-primary/10 text-primary",
      }}
    >
      {label}
    </Link>
  );
}
