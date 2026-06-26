import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HRMS" }] }),
  component: DashboardPage,
});

interface AttendanceBreak {
  id: number;
  break_start: string;
  break_end: string | null;
  break_duration: string | null;
}
interface AttendanceRecord {
  id: number;
  date: string;
  punch_in: string | null;
  punch_out: string | null;
  status: string;
  working_hours: string | null;
  is_late: boolean;
  breaks: AttendanceBreak[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function DashboardPage() {
  const { user } = useAuth();
  const today = todayStr();

  const todayQuery = useQuery({
    queryKey: ["attendance", "today", today],
    queryFn: () =>
      api<AttendanceRecord[]>(`/attendance/records/?date=${today}`),
  });

  const monthly = useQuery({
    queryKey: ["attendance", "monthly"],
    queryFn: () => {
      const d = new Date();
      return api<{
        total_working_days: number;
        present_days: number;
        absent_days: number;
        late_days: number;
        total_working_hours: string;
      }>(
        `/attendance/records/monthly-report/?year=${d.getFullYear()}&month=${d.getMonth() + 1}`,
      );
    },
  });

  const mine = todayQuery.data?.[0];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Welcome back, {user?.full_name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Here's your attendance at a glance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Today's status"
          value={mine?.status ?? "—"}
          hint={mine?.punch_in ? `In at ${fmtTime(mine.punch_in)}` : "Not punched in"}
        />
        <Stat
          label="Today's hours"
          value={mine?.working_hours ? `${mine.working_hours} h` : "—"}
          hint={mine?.punch_out ? `Out at ${fmtTime(mine.punch_out)}` : "In progress"}
        />
        <Stat
          label="Present this month"
          value={
            monthly.data
              ? `${monthly.data.present_days}/${monthly.data.total_working_days}`
              : "—"
          }
          hint={monthly.isLoading ? "Loading…" : "Working days"}
        />
        <Stat
          label="Hours this month"
          value={monthly.data ? `${monthly.data.total_working_hours} h` : "—"}
          hint={monthly.data ? `${monthly.data.late_days} late` : ""}
        />
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="text-base font-semibold text-foreground">Today's punches</h2>
        {todayQuery.isLoading && (
          <p className="mt-3 text-sm text-muted-foreground">Loading…</p>
        )}
        {todayQuery.error && (
          <p className="mt-3 text-sm text-destructive">
            {(todayQuery.error as Error).message}
          </p>
        )}
        {!todayQuery.isLoading && !mine && (
          <p className="mt-3 text-sm text-muted-foreground">
            No record yet. Head to <strong>Attendance</strong> to punch in.
          </p>
        )}
        {mine && (
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Punch in" value={fmtTime(mine.punch_in)} />
            <Row label="Punch out" value={fmtTime(mine.punch_out)} />
            <Row label="Late" value={mine.is_late ? "Yes" : "No"} />
            <Row label="Breaks" value={String(mine.breaks?.length ?? 0)} />
          </dl>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b border-border/60 pb-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}

function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
