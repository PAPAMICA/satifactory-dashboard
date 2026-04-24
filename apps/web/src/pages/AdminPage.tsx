import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { FicsitPageLoader } from "@/components/FicsitPageLoader";
import { apiFetch } from "@/lib/api";

type Me = { id: number; isAdmin: boolean };
type User = { id: number; username: string; isAdmin: boolean };

export function AdminPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<Me>("/api/me"),
  });
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiFetch<{ users: User[] }>("/api/admin/users"),
    enabled: Boolean(me?.isAdmin),
  });

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  const add = useMutation({
    mutationFn: () =>
      apiFetch("/api/admin/users", {
        method: "POST",
        json: { username, password, isAdmin },
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      setUsername("");
      setPassword("");
      setIsAdmin(false);
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => apiFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["admin", "users"] }),
  });

  if (me && !me.isAdmin) {
    return <Navigate to="/" replace />;
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    add.mutate();
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain sm:gap-6">
      <h1 className="sf-display shrink-0 text-lg font-semibold uppercase tracking-[0.12em] text-sf-orange sm:text-xl sm:tracking-[0.15em]">
        {t("admin.title")}
      </h1>

      <form onSubmit={onSubmit} className="sf-panel space-y-3 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs uppercase text-sf-muted">{t("admin.user")}</label>
            <input
              className="sf-input min-h-11 w-full sm:min-h-0"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs uppercase text-sf-muted">{t("admin.password")}</label>
            <input
              className="sf-input min-h-11 w-full sm:min-h-0"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm text-sf-muted sm:min-h-0">
          <input
            type="checkbox"
            className="h-5 w-5 shrink-0"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          {t("admin.isAdmin")}
        </label>
        <button
          type="submit"
          className="sf-btn sf-btn-primary min-h-11 w-full sm:min-h-0 sm:w-auto"
          disabled={add.isPending}
        >
          {t("admin.add")}
        </button>
        {add.isError ? (
          <p className="text-sm text-sf-danger">{(add.error as Error).message}</p>
        ) : null}
      </form>

      <div className="sf-panel overflow-hidden">
        <div className="sf-panel-header">{t("admin.list")}</div>
        {isLoading ? (
          <FicsitPageLoader density="compact" className="min-h-56 border-0 bg-transparent" />
        ) : (
          <ul className="divide-y divide-sf-border">
            {data?.users.map((u) => (
              <li
                key={u.id}
                className="flex flex-col gap-2 px-3 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-2"
              >
                <span className="min-w-0 break-words">
                  {u.username}{" "}
                  {u.isAdmin ? (
                    <span className="text-xs text-sf-cyan">({t("admin.isAdmin")})</span>
                  ) : null}
                </span>
                {u.id === me?.id ? null : (
                  <button
                    type="button"
                    className="sf-btn min-h-10 w-full text-xs text-sf-danger sm:min-h-0 sm:w-auto"
                    onClick={() => del.mutate(u.id)}
                  >
                    {t("admin.delete")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
