import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/_app/attendance")({
  head: () => ({ meta: [{ title: "Attendance — HRMS" }] }),
  component: AttendancePage,
});

interface BreakRec {
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
  overtime_hours: string | null;
  is_late: boolean;
  notes: string;
  breaks: BreakRec[];
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

interface Paginated<T> {
  count: number;
  results: T[];
}

function unwrap<T>(data: Paginated<T> | T[] | undefined): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return data.results ?? [];
}

function AttendancePage() {
  const qc = useQueryClient();
  const today = todayStr();
  const [notes, setNotes] = useState("");
  const [feedback, setFeedback] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const todayQuery = useQuery({
    queryKey: ["attendance", "today", today],
    queryFn: () =>
      api<Paginated<AttendanceRecord> | AttendanceRecord[]>(
        `/attendance/records/?date=${today}`,
      ),
  });

  const history = useQuery({
    queryKey: ["attendance", "history"],
    queryFn: () =>
      api<Paginated<AttendanceRecord> | AttendanceRecord[]>(
        `/attendance/records/?ordering=-date`,
      ),
  });

  const todayRecords = unwrap(todayQuery.data);
  const historyRecords = unwrap(history.data);
  const mine = todayRecords[0];
  const openBreak = mine?.breaks?.find((b) => !b.break_end);
  const hasIn = !!mine?.punch_in;
  const hasOut = !!mine?.punch_out;

  function run(path: string, body?: unknown) {
    return async () => {
      setFeedback(null);
      try {
        await api(path, { method: "POST", body: body ?? {} });
        await qc.invalidateQueries({ queryKey: ["attendance"] });
        setFeedback({ kind: "ok", text: "Done." });
        setNotes("");
      } catch (e) {
        const msg =
          e instanceof ApiError ? e.message : (e as Error).message ?? "Failed";
        setFeedback({ kind: "err", text: msg });
      }
    };
  }

  const punchIn = useMutation({ mutationFn: run("/attendance/punch-in/", { notes }) });
  const punchOut = useMutation({ mutationFn: run("/attendance/punch-out/", { notes }) });
  const breakStart = useMutation({ mutationFn: run("/attendance/break-start/") });
  const breakEnd = useMutation({ mutationFn: run("/attendance/break-end/") });

  const pending =
    punchIn.isPending || punchOut.isPending || breakStart.isPending || breakEnd.isPending;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Attendance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Punch in/out and manage your breaks.
        </p>
      </div>

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Today · {today}
            </div>
            <div className="mt-1 text-3xl font-semibold tracking-tight text-foreground">
              {mine?.status ?? (hasIn ? "PRESENT" : "Not punched in")}
            </div>
            <div className="mt-1 text-sm text-muted-foreground">
              {hasIn ? `In: ${fmtTime(mine?.punch_in)}` : "—"} ·{" "}
              {hasOut ? `Out: ${fmtTime(mine?.punch_out)}` : "Open"}
              {mine?.working_hours ? ` · ${mine.working_hours} h` : ""}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              disabled={pending || hasIn}
              onClick={() => punchIn.mutate()}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Punch in
            </button>
            <button
              disabled={pending || !hasIn || hasOut}
              onClick={() => punchOut.mutate()}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
            >
              Punch out
            </button>
            {openBreak ? (
              <button
                disabled={pending}
                onClick={() => breakEnd.mutate()}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                End break
              </button>
            ) : (
              <button
                disabled={pending || !hasIn || hasOut}
                onClick={() => breakStart.mutate()}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50"
              >
                Start break
              </button>
            )}
          </div>
        </div>

        <label className="mt-5 block text-sm font-medium text-foreground">
          Notes (optional)
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Working from office"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
          />
        </label>

        {feedback && (
          <p
            className={`mt-4 rounded-md px-3 py-2 text-sm ${
              feedback.kind === "ok"
                ? "bg-primary/10 text-primary"
                : "bg-destructive/10 text-destructive"
            }`}
          >
            {feedback.text}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Recent days</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">In</th>
                <th className="px-6 py-3 font-medium">Out</th>
                <th className="px-6 py-3 font-medium">Hours</th>
                <th className="px-6 py-3 font-medium">Late</th>
              </tr>
            </thead>
            <tbody>
              {history.isLoading && (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={6}>
                    Loading…
                  </td>
                </tr>
              )}
              {historyRecords.slice(0, 20).map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-6 py-3 font-medium text-foreground">{r.date}</td>
                  <td className="px-6 py-3 text-foreground">{r.status}</td>
                  <td className="px-6 py-3 text-muted-foreground">{fmtTime(r.punch_in)}</td>
                  <td className="px-6 py-3 text-muted-foreground">{fmtTime(r.punch_out)}</td>
                  <td className="px-6 py-3 text-foreground">{r.working_hours ?? "—"}</td>
                  <td className="px-6 py-3">
                    {r.is_late ? (
                      <span className="rounded bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                        Late
                      </span>
                    ) : (
                      <span className="text-muted-foreground">On time</span>
                    )}
                  </td>
                </tr>
              ))}
              {!history.isLoading && historyRecords.length === 0 && (
                <tr>
                  <td className="px-6 py-4 text-muted-foreground" colSpan={6}>
                    No records yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
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
