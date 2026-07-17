"use client";
import * as React from "react";
import { CheckCircle2, KeyRound, XCircle } from "lucide-react";

export function AuthenticationHeaderStatus() {
  const [status, setStatus] = React.useState<string>();
  const refresh = React.useCallback(() => {
    void Promise.all([
      fetch("/api/auth/association", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : undefined,
      ),
      fetch("/api/auth/profiles", { cache: "no-store" }).then((response) =>
        response.ok ? response.json() : undefined,
      ),
    ])
      .then(([association, result]) => {
        const profile = result?.profiles?.find(
          (item: { id: string }) => item.id === association?.profileId,
        );
        setStatus(
          profile?.status ?? (association?.profileId ? "invalid" : undefined),
        );
      })
      .catch(() => undefined);
  }, []);
  React.useEffect(() => {
    refresh();
    window.addEventListener("studio:authentication-updated", refresh);
    return () =>
      window.removeEventListener("studio:authentication-updated", refresh);
  }, [refresh]);
  if (!status)
    return (
      <span className="auth-header-status">
        <KeyRound />
        No authentication
      </span>
    );
  const valid = status === "authenticated";
  const Icon = valid
    ? CheckCircle2
    : status === "not-configured"
      ? KeyRound
      : XCircle;
  const label = valid
    ? "Session valid"
    : status === "expired"
      ? "Session expired"
      : status === "not-configured"
        ? "Login required"
        : "Authentication issue";
  return (
    <span className={`auth-header-status auth-header-${status}`}>
      <Icon />
      {label}
    </span>
  );
}
