import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

export const Route = createFileRoute("/_app/profile")({
  head: () => ({ meta: [{ title: "Profile — HRMS" }] }),
  component: ProfilePage,
});

interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: string;
  is_active: boolean;
}

function ProfilePage() {
  const qc = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => api<Profile>("/auth/profile/"),
  });

  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "" });
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (profile.data) {
      setForm({
        first_name: profile.data.first_name ?? "",
        last_name: profile.data.last_name ?? "",
        phone: profile.data.phone ?? "",
      });
    }
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () =>
      api<Profile>("/auth/profile/", { method: "PATCH", body: form }),
    onSuccess: () => {
      setMsg("Profile updated.");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: unknown) => {
      setMsg(e instanceof ApiError ? e.message : (e as Error).message);
    },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Profile
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your personal information.
        </p>
      </div>

      {profile.isLoading && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {profile.data && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setMsg(null);
            save.mutate();
          }}
          className="space-y-5 rounded-xl border border-border bg-card p-6"
        >
          <Field label="Email" value={profile.data.email} readOnly />
          <Field label="Role" value={profile.data.role} readOnly />

          <label className="block text-sm font-medium text-foreground">
            First name
            <input
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Last name
            <input
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </label>
          <label className="block text-sm font-medium text-foreground">
            Phone
            <input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
            />
          </label>

          {msg && (
            <p className="rounded-md bg-secondary px-3 py-2 text-sm text-secondary-foreground">
              {msg}
            </p>
          )}

          <button
            type="submit"
            disabled={save.isPending}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  readOnly,
}: {
  label: string;
  value: string;
  readOnly?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-foreground">
      {label}
      <input
        value={value}
        readOnly={readOnly}
        className="mt-1 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground"
      />
    </label>
  );
}
