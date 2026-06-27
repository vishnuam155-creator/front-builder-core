import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/admin")({
  head: () => ({ meta: [{ title: "Admin Dashboard — HRMS" }] }),
  component: AdminDashboardPage,
});

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface Department {
  id: number;
  name: string;
}

interface Employee {
  id: number;
  employee_id?: string;
  full_name?: string;
  user?: { id: number; full_name?: string; email?: string };
  email?: string;
  department?: number | { id: number; name: string };
  department_name?: string;
  designation?: string;
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
  notes?: string;
  employee?:
    | number
    | {
        id: number;
        employee_id?: string;
        full_name?: string;
        department_name?: string;
        department?: number | { id: number; name: string };
      };
  employee_id?: string;
  employee_name?: string;
  department_name?: string;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

async function fetchAll<T>(path: string): Promise<T[]> {
  // Walk through DRF pagination via ?page= until exhausted.
  const acc: T[] = [];
  let page = 1;
  for (let i = 0; i < 50; i++) {
    const sep = path.includes("?") ? "&" : "?";
    const data = await api<Paginated<T> | T[]>(
      `${path}${sep}page=${page}&page_size=200`,
    );
    if (Array.isArray(data)) {
      acc.push(...data);
      break;
    }
    acc.push(...(data.results ?? []));
    if (!data.next) break;
    page += 1;
  }
  return acc;
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

function getDeptName(
  rec: AttendanceRecord,
  empMap: Map<number, Employee>,
  deptMap: Map<number, Department>,
): string {
  if (rec.department_name) return rec.department_name;
  const empObj =
    typeof rec.employee === "object" && rec.employee !== null
      ? rec.employee
      : null;
  if (empObj?.department_name) return empObj.department_name;
  if (empObj && typeof empObj.department === "object" && empObj.department)
    return empObj.department.name;
  const empId =
    typeof rec.employee === "number"
      ? rec.employee
      : empObj
        ? empObj.id
        : undefined;
  if (empId != null) {
    const emp = empMap.get(empId);
    if (emp?.department_name) return emp.department_name;
    if (typeof emp?.department === "object" && emp?.department)
      return emp.department.name;
    if (typeof emp?.department === "number") {
      return deptMap.get(emp.department)?.name ?? "—";
    }
  }
  return "—";
}

function getEmpInfo(
  rec: AttendanceRecord,
  empMap: Map<number, Employee>,
): { name: string; code: string; email: string } {
  const empObj =
    typeof rec.employee === "object" && rec.employee !== null
      ? rec.employee
      : null;
  const empId =
    typeof rec.employee === "number"
      ? rec.employee
      : empObj
        ? empObj.id
        : undefined;
  const emp = empId != null ? empMap.get(empId) : undefined;
  const name =
    rec.employee_name ??
    empObj?.full_name ??
    emp?.full_name ??
    emp?.user?.full_name ??
    "—";
  const code =
    rec.employee_id ?? empObj?.employee_id ?? emp?.employee_id ?? String(empId ?? "—");
  const email = emp?.email ?? emp?.user?.email ?? "";
  return { name, code, email };
}

function AdminDashboardPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "HR_ADMIN" || user?.role === "SUPER_ADMIN";

  const [startDate, setStartDate] = useState(daysAgo(7));
  const [endDate, setEndDate] = useState(todayStr());
  const [deptFilter, setDeptFilter] = useState<string>("all");

  const employeesQuery = useQuery({
    queryKey: ["admin", "employees"],
    queryFn: () => fetchAll<Employee>("/employees/"),
    enabled: isAdmin,
  });

  const departmentsQuery = useQuery({
    queryKey: ["admin", "departments"],
    queryFn: () => fetchAll<Department>("/departments/"),
    enabled: isAdmin,
  });

  const recordsQuery = useQuery({
    queryKey: ["admin", "records", startDate, endDate],
    queryFn: () =>
      fetchAll<AttendanceRecord>(
        `/attendance/records/?start_date=${startDate}&end_date=${endDate}&ordering=-date`,
      ),
    enabled: isAdmin,
  });

  const empMap = useMemo(() => {
    const m = new Map<number, Employee>();
    for (const e of employeesQuery.data ?? []) m.set(e.id, e);
    return m;
  }, [employeesQuery.data]);

  const deptMap = useMemo(() => {
    const m = new Map<number, Department>();
    for (const d of departmentsQuery.data ?? []) m.set(d.id, d);
    return m;
  }, [departmentsQuery.data]);

  const rows = useMemo(() => {
    const recs = recordsQuery.data ?? [];
    return recs
      .map((r) => {
        const info = getEmpInfo(r, empMap);
        return {
          rec: r,
          department: getDeptName(r, empMap, deptMap),
          employeeName: info.name,
          employeeCode: info.code,
          email: info.email,
        };
      })
      .filter((r) =>
        deptFilter === "all" ? true : r.department === deptFilter,
      );
  }, [recordsQuery.data, empMap, deptMap, deptFilter]);

  const grouped = useMemo(() => {
    const g = new Map<string, typeof rows>();
    for (const r of rows) {
      const arr = g.get(r.department) ?? [];
      arr.push(r);
      g.set(r.department, arr);
    }
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  const summary = useMemo(() => {
    let totalHours = 0;
    const statusCount: Record<string, number> = {};
    const uniqueEmployees = new Set<string>();
    for (const r of rows) {
      const h = parseFloat(r.rec.working_hours ?? "0");
      if (!Number.isNaN(h)) totalHours += h;
      statusCount[r.rec.status] = (statusCount[r.rec.status] ?? 0) + 1;
      uniqueEmployees.add(r.employeeCode);
    }
    return {
      totalRecords: rows.length,
      totalHours: totalHours.toFixed(2),
      uniqueEmployees: uniqueEmployees.size,
      statusCount,
    };
  }, [rows]);

  function exportExcel() {
    const data = rows.map((r) => ({
      "Employee ID": r.employeeCode,
      "Employee Name": r.employeeName,
      Email: r.email,
      Department: r.department,
      Date: r.rec.date,
      "Punch In": fmtTime(r.rec.punch_in),
      "Punch Out": fmtTime(r.rec.punch_out),
      "Working Hours": r.rec.working_hours ?? "",
      "Overtime Hours": r.rec.overtime_hours ?? "",
      Status: r.rec.status,
      Late: r.rec.is_late ? "Yes" : "No",
      Notes: r.rec.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [
      { wch: 12 },
      { wch: 22 },
      { wch: 26 },
      { wch: 18 },
      { wch: 12 },
      { wch: 10 },
      { wch: 10 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
      { wch: 8 },
      { wch: 30 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Attendance");
    XLSX.writeFile(wb, `attendance_${startDate}_to_${endDate}.xlsx`);
  }

  if (!user) return null;
  if (!isAdmin) return <Navigate to="/dashboard" />;

  const loading =
    recordsQuery.isLoading ||
    employeesQuery.isLoading ||
    departmentsQuery.isLoading;
  const error =
    (recordsQuery.error as Error | null) ??
    (employeesQuery.error as Error | null) ??
    (departmentsQuery.error as Error | null);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Admin Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Attendance overview across all employees and departments.
          </p>
        </div>
        <button
          onClick={exportExcel}
          disabled={rows.length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
        >
          Download Excel
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Start date
            </span>
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              End date
            </span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              max={todayStr()}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Department
            </span>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All departments</option>
              {(departmentsQuery.data ?? []).map((d) => (
                <option key={d.id} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Quick range
            </span>
            <div className="flex gap-2">
              {[
                ["Today", 0],
                ["7d", 7],
                ["30d", 30],
              ].map(([label, n]) => (
                <button
                  key={label as string}
                  onClick={() => {
                    setEndDate(todayStr());
                    setStartDate(daysAgo(n as number));
                  }}
                  className="flex-1 rounded-md border border-input bg-background px-2 text-xs font-medium hover:bg-accent"
                >
                  {label as string}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Records" value={String(summary.totalRecords)} />
        <Stat label="Employees" value={String(summary.uniqueEmployees)} />
        <Stat label="Total hours" value={`${summary.totalHours} h`} />
        <Stat
          label="Status mix"
          value={
            Object.entries(summary.statusCount)
              .map(([k, v]) => `${k}:${v}`)
              .join(" · ") || "—"
          }
        />
      </div>

      {loading && (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading…
        </div>
      )}
      {error && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {!loading &&
        !error &&
        (grouped.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            No attendance records in this range.
          </div>
        ) : (
          grouped.map(([dept, deptRows]) => (
            <div
              key={dept}
              className="overflow-hidden rounded-xl border border-border bg-card"
            >
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h2 className="text-base font-semibold text-foreground">
                  {dept}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {deptRows.length} record{deptRows.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Emp ID</th>
                      <th className="px-4 py-2 text-left font-medium">Name</th>
                      <th className="px-4 py-2 text-left font-medium">Date</th>
                      <th className="px-4 py-2 text-left font-medium">In</th>
                      <th className="px-4 py-2 text-left font-medium">Out</th>
                      <th className="px-4 py-2 text-left font-medium">Hours</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptRows.map((r) => (
                      <tr
                        key={r.rec.id}
                        className="border-t border-border/60 hover:bg-muted/30"
                      >
                        <td className="px-4 py-2 font-mono text-xs">
                          {r.employeeCode}
                        </td>
                        <td className="px-4 py-2 font-medium text-foreground">
                          {r.employeeName}
                        </td>
                        <td className="px-4 py-2">{r.rec.date}</td>
                        <td className="px-4 py-2">{fmtTime(r.rec.punch_in)}</td>
                        <td className="px-4 py-2">
                          {fmtTime(r.rec.punch_out)}
                        </td>
                        <td className="px-4 py-2">
                          {r.rec.working_hours ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          <span className="inline-flex rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            {r.rec.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {r.rec.is_late ? (
                            <span className="text-destructive">Yes</span>
                          ) : (
                            <span className="text-muted-foreground">No</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        ))}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-2 text-xl font-semibold tracking-tight text-foreground">
        {value}
      </div>
    </div>
  );
}
