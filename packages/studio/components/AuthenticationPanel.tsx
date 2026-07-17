"use client";

import * as React from "react";
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  XCircle,
} from "lucide-react";
import { studioMutationFetch, studioMutationRequest } from "../lib/studio-api";
import { Button } from "./ui/button";

type ProfileStatus =
  | "not-configured"
  | "authenticating"
  | "authenticated"
  | "expired"
  | "invalid"
  | "error";
export type AuthenticationPanelProfile = {
  id: string;
  name: string;
  origin: string;
  status: ProfileStatus;
  validation: {
    url: string;
    expect?: { selector: string } | { urlNotMatching: string };
  };
  lastValidatedAt?: string;
  usage: { demoId: string; selected: boolean }[];
};
type Profile = AuthenticationPanelProfile;
type Association = { demoId: string; profileId?: string };
type ApiError = { error?: { message?: string; code?: string } };

export function AuthenticationPanel() {
  const [profiles, setProfiles] = React.useState<Profile[]>([]);
  const [association, setAssociation] = React.useState<Association>();
  const [state, setState] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = React.useState<string>();
  const [busy, setBusy] = React.useState<string>();
  const createRef = React.useRef<HTMLDialogElement>(null);
  const loginRef = React.useRef<HTMLDialogElement>(null);
  const actionRef = React.useRef<HTMLDialogElement>(null);
  const [action, setAction] = React.useState<{
    kind: "rename" | "remove";
    profile: Profile;
  }>();
  const [login, setLogin] = React.useState<{
    operationId: string;
    profile: Profile;
    phase: string;
    error?: string;
  }>();

  const load = React.useCallback(async () => {
    setState("loading");
    setError(undefined);
    try {
      const [profilesResponse, associationResponse] = await Promise.all([
        fetch("/api/auth/profiles", { cache: "no-store" }),
        fetch("/api/auth/association", { cache: "no-store" }),
      ]);
      if (!profilesResponse.ok || !associationResponse.ok)
        throw new Error("Could not load authentication profiles.");
      setProfiles(
        ((await profilesResponse.json()) as { profiles: Profile[] }).profiles,
      );
      setAssociation((await associationResponse.json()) as Association);
      setState("ready");
      window.dispatchEvent(new Event("studio:authentication-updated"));
    } catch (cause) {
      setError(message(cause));
      setState("error");
    }
  }, []);
  React.useEffect(() => {
    void load();
  }, [load]);

  const mutate = React.useCallback(
    async (key: string, action: () => Promise<void>) => {
      setBusy(key);
      setError(undefined);
      try {
        await action();
        await load();
      } catch (cause) {
        setError(message(cause));
      } finally {
        setBusy(undefined);
      }
    },
    [load],
  );

  const beginLogin = React.useCallback(
    async (profile: Profile, renew: boolean) => {
      setBusy(profile.id);
      setError(undefined);
      try {
        const response = await studioMutationRequest(
          `/api/auth/profiles/${profile.id}/login${renew ? "?renew=true" : ""}`,
          { method: "POST" },
          "Could not start authentication.",
        );
        const operation = (await response.json()) as {
          operationId: string;
          phase: string;
        };
        setLogin({ ...operation, profile });
        loginRef.current?.showModal();
      } catch (cause) {
        setError(message(cause));
      } finally {
        setBusy(undefined);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (!login) return;
    const abort = new AbortController();
    void streamLoginEvents(login.operationId, abort.signal, (type, data) => {
      if (type === "phase")
        setLogin((current) =>
          current
            ? { ...current, phase: (data as { phase: string }).phase }
            : current,
        );
      if (type === "complete") {
        loginRef.current?.close();
        setLogin(undefined);
        void load();
      }
      if (type === "error")
        setLogin((current) =>
          current
            ? {
                ...current,
                error:
                  (data as ApiError).error?.message ??
                  "Authentication did not complete.",
              }
            : current,
        );
    }).catch((cause) => {
      if (!abort.signal.aborted) setError(message(cause));
    });
    return () => abort.abort();
  }, [login?.operationId, load]);

  const associate = (profileId?: string) =>
    mutate("association", async () => {
      await studioMutationRequest(
        "/api/auth/association",
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ profileId }),
        },
        "Could not update demo authentication.",
      );
    });

  return (
    <div className="auth-panel">
      <div className="auth-section auth-demo-association">
        <div className="auth-heading">
          <div>
            <h2>Demo authentication</h2>
            <p>One local session is restored for every scene.</p>
          </div>
          <ShieldCheck aria-hidden="true" />
        </div>
        <label className="auth-field">
          <span>Profile for {association?.demoId ?? "this demo"}</span>
          <select
            value={association?.profileId ?? ""}
            disabled={busy === "association" || state !== "ready"}
            onChange={(event) =>
              void associate(event.target.value || undefined)
            }
          >
            <option value="">No authentication</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name} — {statusLabel(profile.status)}
              </option>
            ))}
          </select>
        </label>
        {association?.profileId && (
          <ProfileSummary
            profile={profiles.find(
              (profile) => profile.id === association.profileId,
            )}
          />
        )}
      </div>

      <div className="auth-section">
        <div className="auth-heading">
          <div>
            <h2>Authentication profiles</h2>
            <p>Browser sessions stay local and outside demo source.</p>
          </div>
          <Button size="sm" onClick={() => createRef.current?.showModal()}>
            <Plus className="h-3.5 w-3.5" />
            New profile
          </Button>
        </div>
        {error && (
          <div className="auth-alert" role="alert">
            <AlertCircle aria-hidden="true" />
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError(undefined)}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}
        {state === "loading" && <LoadingRows />}
        {state === "error" && (
          <Empty
            title="Profiles unavailable"
            detail="Check the local Studio session and try again."
            action={
              <Button size="sm" onClick={() => void load()}>
                Try again
              </Button>
            }
          />
        )}
        {state === "ready" && profiles.length === 0 && (
          <Empty
            title="No authentication profiles"
            detail="Create one, sign in in the controlled browser, then reuse it across recordings."
            action={
              <Button size="sm" onClick={() => createRef.current?.showModal()}>
                <Plus className="h-3.5 w-3.5" />
                Create profile
              </Button>
            }
          />
        )}
        {state === "ready" && profiles.length > 0 && (
          <div className="auth-profile-list">
            {profiles.map((profile) => (
              <ProfileRow
                key={profile.id}
                profile={profile}
                busy={busy === profile.id}
                onLogin={(renew) => void beginLogin(profile, renew)}
                onValidate={() =>
                  void mutate(profile.id, async () => {
                    await studioMutationRequest(
                      `/api/auth/profiles/${profile.id}/validate`,
                      { method: "POST" },
                      "Session test failed.",
                    );
                  })
                }
                onRename={() => {
                  setAction({ kind: "rename", profile });
                  actionRef.current?.showModal();
                }}
                onRemove={() => {
                  setAction({ kind: "remove", profile });
                  actionRef.current?.showModal();
                }}
              />
            ))}
          </div>
        )}
      </div>

      <CreateProfileDialog
        dialogRef={createRef}
        onCreated={async (profile) => {
          await associate(profile.id);
          await beginLogin(profile, false);
        }}
      />
      <LoginDialog
        dialogRef={loginRef}
        login={login}
        onDismiss={() => {
          setLogin(undefined);
          void load();
        }}
        onComplete={() => {
          if (!login) return;
          void studioMutationRequest(
            `/api/auth/login/${login.operationId}/complete`,
            { method: "POST" },
            "Could not complete authentication.",
          ).catch((cause) =>
            setLogin((current) =>
              current ? { ...current, error: message(cause) } : current,
            ),
          );
        }}
        onCancel={() => {
          if (!login) return;
          void studioMutationRequest(
            `/api/auth/login/${login.operationId}/cancel`,
            { method: "POST" },
            "Could not cancel authentication.",
          ).catch((cause) =>
            setLogin((current) =>
              current ? { ...current, error: message(cause) } : current,
            ),
          );
        }}
      />
      <ProfileActionDialog
        dialogRef={actionRef}
        action={action}
        onDismiss={() => setAction(undefined)}
        onRename={(profile, name) =>
          mutate(profile.id, async () => {
            await studioMutationRequest(
              `/api/auth/profiles/${profile.id}`,
              {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ name }),
              },
              "Rename failed.",
            );
          })
        }
        onRemove={(profile) =>
          mutate(profile.id, async () => {
            await studioMutationRequest(
              `/api/auth/profiles/${profile.id}${profile.usage.length ? "?force=true" : ""}`,
              { method: "DELETE" },
              "Remove failed.",
            );
          })
        }
      />
    </div>
  );
}

export function ProfileActionDialog({
  dialogRef,
  action,
  onDismiss,
  onRename,
  onRemove,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  action?: { kind: "rename" | "remove"; profile: Profile };
  onDismiss: () => void;
  onRename: (profile: Profile, name: string) => Promise<void>;
  onRemove: (profile: Profile) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [step, setStep] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  React.useEffect(() => {
    if (action) {
      setName(action.profile.name);
      setStep(1);
      setError(undefined);
    }
  }, [action]);
  if (!action) return <dialog ref={dialogRef} />;
  const submit = async () => {
    if (action.kind === "rename" && !name.trim()) {
      setError("Enter a profile name.");
      return;
    }
    if (action.kind === "remove" && action.profile.usage.length && step === 1) {
      setStep(2);
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      if (action.kind === "rename") await onRename(action.profile, name);
      else await onRemove(action.profile);
      dialogRef.current?.close();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  const usage = action.profile.usage.length;
  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-labelledby="profile-action-title"
      onClose={onDismiss}
    >
      <div className="auth-dialog-shell">
        <header>
          <div>
            <span className="auth-step">
              {action.kind === "rename"
                ? "Profile details"
                : usage
                  ? `Confirmation ${step} of 2`
                  : "Remove profile"}
            </span>
            <h2 id="profile-action-title">
              {action.kind === "rename"
                ? `Rename ${action.profile.name}`
                : `Remove ${action.profile.name}?`}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className="auth-dialog-content">
          {action.kind === "rename" ? (
            <label className="auth-field">
              <span>Profile name</span>
              <input
                autoFocus
                value={name}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "profile-action-error" : undefined}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          ) : (
            <>
              <p className="auth-dialog-intro">
                {usage
                  ? step === 1
                    ? `This profile is used by ${usage} demo${usage === 1 ? "" : "s"}: ${action.profile.usage.map((item) => item.demoId).join(", ")}.`
                    : "Removing it deletes its local browser session. Demo source references remain and will require repair."
                  : "This permanently deletes the local browser session. It cannot be recovered."}
              </p>
              {usage > 0 && step === 2 && (
                <label className="auth-field">
                  <span>Type the profile name to confirm</span>
                  <input
                    autoFocus
                    value={name}
                    aria-invalid={name !== action.profile.name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
              )}
            </>
          )}
          {error && (
            <div id="profile-action-error" className="auth-alert" role="alert">
              <AlertCircle />
              {error}
            </div>
          )}
        </div>
        <footer>
          {step === 2 && (
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          <span />
          <Button type="button" onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={action.kind === "rename" ? "primary" : "default"}
            disabled={
              busy ||
              (action.kind === "remove" &&
                usage > 0 &&
                step === 2 &&
                name !== action.profile.name)
            }
            onClick={() => void submit()}
          >
            {busy && <LoaderCircle className="auth-spin" />}
            {action.kind === "rename"
              ? "Save name"
              : step === 1 && usage
                ? "Continue"
                : "Remove profile"}
          </Button>
        </footer>
      </div>
    </dialog>
  );
}

function ProfileRow({
  profile,
  busy,
  onLogin,
  onValidate,
  onRename,
  onRemove,
}: {
  profile: Profile;
  busy: boolean;
  onLogin: (renew: boolean) => void;
  onValidate: () => void;
  onRename: () => void;
  onRemove: () => void;
}) {
  const configured = profile.status !== "not-configured";
  return (
    <article className="auth-profile-row">
      <div className="auth-profile-main">
        <div className="auth-profile-name">
          <KeyRound aria-hidden="true" />
          <strong>{profile.name}</strong>
        </div>
        <p title={profile.origin}>{profile.origin}</p>
        <AuthenticationStatus status={profile.status} />
      </div>
      <div className="auth-profile-meta">
        <span>
          {profile.lastValidatedAt
            ? `Validated ${relativeTime(profile.lastValidatedAt)}`
            : "Never validated"}
        </span>
        <span>
          {profile.usage.length
            ? `Used by ${profile.usage.map((item) => item.demoId).join(", ")}`
            : "Not used by this demo"}
        </span>
      </div>
      <div className="auth-profile-actions">
        {busy ? (
          <span className="auth-working" role="status">
            <LoaderCircle className="auth-spin" />
            Working…
          </span>
        ) : (
          <>
            {configured && (
              <Button size="sm" onClick={onValidate}>
                Test session
              </Button>
            )}
            <Button
              variant={configured ? "ghost" : "default"}
              size="sm"
              onClick={() => onLogin(configured)}
            >
              {configured ? <RefreshCw /> : <KeyRound />}
              {configured ? "Renew" : "Sign in"}
            </Button>
            <details className="auth-more">
              <summary aria-label={`More actions for ${profile.name}`}>
                <MoreHorizontal />
              </summary>
              <div>
                <button type="button" onClick={onRename}>
                  <Pencil />
                  Rename
                </button>
                <button type="button" onClick={onRemove}>
                  <Trash2 />
                  Remove
                </button>
              </div>
            </details>
          </>
        )}
      </div>
    </article>
  );
}

function CreateProfileDialog({
  dialogRef,
  onCreated,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  onCreated: (profile: Profile) => Promise<void>;
}) {
  const [step, setStep] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [form, setForm] = React.useState({
    name: "",
    origin: "",
    validationUrl: "",
    selector: "",
  });
  const suggestedName = React.useMemo(() => {
    try {
      return (
        new URL(form.origin).hostname
          .split(".")[0]
          ?.replace(/^./, (value) => value.toUpperCase()) ?? ""
      );
    } catch {
      return "";
    }
  }, [form.origin]);
  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const response = await studioMutationRequest(
        "/api/auth/profiles",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...form, name: form.name || suggestedName }),
        },
        "Could not create profile.",
      );
      const { profile } = (await response.json()) as { profile: Profile };
      dialogRef.current?.close();
      setStep(1);
      setForm({ name: "", origin: "", validationUrl: "", selector: "" });
      await onCreated(profile);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      onClose={() => {
        setStep(1);
        setError(undefined);
      }}
    >
      <form
        className="auth-dialog-shell"
        onSubmit={(event) => event.preventDefault()}
      >
        <header>
          <div>
            <span className="auth-step">Step {step} of 2</span>
            <h2>Create authentication profile</h2>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        {step === 1 ? (
          <div className="auth-dialog-content">
            <p className="auth-dialog-intro">
              Identify the application. No passwords, cookies, or tokens are
              stored in demo.ts.
            </p>
            <label className="auth-field">
              <span>Application URL</span>
              <input
                autoFocus
                required
                type="url"
                placeholder="https://app.example.com"
                value={form.origin}
                onChange={(event) =>
                  setForm({ ...form, origin: event.target.value })
                }
              />
            </label>
            <label className="auth-field">
              <span>Profile name</span>
              <input
                value={form.name}
                placeholder={suggestedName || "Production admin"}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
              />
            </label>
            <div className="auth-strategy">
              <KeyRound />
              <div>
                <strong>Interactive login</strong>
                <p>
                  Supports OAuth, MFA, SSO, magic links, and CAPTCHA through a
                  visible browser.
                </p>
              </div>
              <CheckCircle2 />
            </div>
          </div>
        ) : (
          <div className="auth-dialog-content">
            <p className="auth-dialog-intro">
              Choose a protected page to confirm the session after you finish
              signing in.
            </p>
            <label className="auth-field">
              <span>
                Validation URL <small>optional</small>
              </span>
              <input
                autoFocus
                type="url"
                placeholder={`${form.origin.replace(/\/$/, "")}/dashboard`}
                value={form.validationUrl}
                onChange={(event) =>
                  setForm({ ...form, validationUrl: event.target.value })
                }
              />
            </label>
            <label className="auth-field">
              <span>
                Expected element <small>optional selector</small>
              </span>
              <input
                placeholder="[data-testid=user-menu]"
                value={form.selector}
                onChange={(event) =>
                  setForm({ ...form, selector: event.target.value })
                }
              />
            </label>
            <div className="auth-note">
              <AlertCircle />
              <span>
                Without an expected element, validation uses a less reliable
                redirect heuristic. Playwright storage state does not preserve
                sessionStorage.
              </span>
            </div>
          </div>
        )}
        {error && (
          <div className="auth-alert" role="alert">
            <AlertCircle />
            {error}
          </div>
        )}
        <footer>
          {step === 2 && (
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
          )}
          <span />
          <Button type="button" onClick={() => dialogRef.current?.close()}>
            Cancel
          </Button>
          {step === 1 ? (
            <Button
              type="button"
              variant="primary"
              disabled={!form.origin}
              onClick={() => setStep(2)}
            >
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy && <LoaderCircle className="auth-spin" />}Create and sign in
            </Button>
          )}
        </footer>
      </form>
    </dialog>
  );
}

export function LoginDialog({
  dialogRef,
  login,
  onComplete,
  onCancel,
  onDismiss,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  login?: { profile: Profile; phase: string; error?: string };
  onComplete: () => void;
  onCancel: () => void;
  onDismiss: () => void;
}) {
  const complete = () => {
    onComplete();
  };
  const cancel = () => {
    if (login?.error) dialogRef.current?.close();
    else onCancel();
  };
  return (
    <dialog
      ref={dialogRef}
      className="auth-dialog"
      aria-labelledby="login-dialog-title"
      onClose={() => {
        if (login?.error) onDismiss();
      }}
      onCancel={(event) => {
        event.preventDefault();
        cancel();
      }}
    >
      <div className="auth-dialog-shell">
        <header>
          <div>
            <span className="auth-step">Interactive login</span>
            <h2 id="login-dialog-title">Sign in to {login?.profile.name}</h2>
          </div>
        </header>
        <div className="auth-dialog-content auth-login-progress">
          <div className="auth-login-icon">
            <LoaderCircle className="auth-spin" />
          </div>
          <div aria-live="polite" role="status">
            <strong>{phaseLabel(login?.phase)}</strong>
            <p>
              Complete the login in the browser window. Return here only after
              the protected page is ready.
            </p>
          </div>
          <ol>
            <li className="done">Browser opened</li>
            <li
              className={
                login?.phase === "waiting-for-login" ? "current" : "done"
              }
            >
              Complete login in the browser
            </li>
            <li
              className={
                login?.phase === "validating-session" ||
                login?.phase === "saving-profile"
                  ? "current"
                  : ""
              }
            >
              Validate and save session
            </li>
          </ol>
          {login?.error && (
            <div className="auth-alert" role="alert">
              <AlertCircle />
              {login.error}
            </div>
          )}
        </div>
        <footer>
          <Button onClick={cancel}>{login?.error ? "Close" : "Cancel"}</Button>
          <span />
          <Button
            variant="primary"
            onClick={complete}
            disabled={
              login?.phase !== "waiting-for-login" || Boolean(login.error)
            }
          >
            <CheckCircle2 />
            Complete authentication
          </Button>
        </footer>
      </div>
    </dialog>
  );
}

export function AuthenticationStatus({ status }: { status: ProfileStatus }) {
  const Icon =
    status === "authenticated"
      ? CheckCircle2
      : status === "expired" || status === "invalid" || status === "error"
        ? XCircle
        : KeyRound;
  return (
    <span className={`auth-status auth-status-${status}`}>
      <Icon />
      {statusLabel(status)}
    </span>
  );
}
function ProfileSummary({ profile }: { profile?: Profile }) {
  return profile ? (
    <div className="auth-selected">
      <AuthenticationStatus status={profile.status} />
      <span>{profile.origin}</span>
      {profile.lastValidatedAt && (
        <small>Validated {relativeTime(profile.lastValidatedAt)}</small>
      )}
    </div>
  ) : (
    <div className="auth-selected auth-selected-missing">
      <AlertCircle />
      Selected profile is unavailable. Choose another profile.
    </div>
  );
}
function LoadingRows() {
  return (
    <div aria-label="Loading profiles" aria-busy="true">
      {[0, 1].map((item) => (
        <div className="auth-profile-row auth-skeleton" key={item}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
function Empty({
  title,
  detail,
  action,
}: {
  title: string;
  detail: string;
  action: React.ReactNode;
}) {
  return (
    <div className="auth-empty">
      <ShieldCheck />
      <strong>{title}</strong>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function statusLabel(status: ProfileStatus) {
  return (
    {
      authenticated: "Session valid",
      "not-configured": "Login required",
      authenticating: "Authenticating",
      expired: "Session expired",
      invalid: "Session invalid",
      error: "Needs attention",
    } as const
  )[status];
}
function phaseLabel(phase?: string) {
  return (
    (
      {
        "opening-browser": "Opening browser…",
        "waiting-for-login": "Waiting for you to sign in",
        "capturing-state": "Capturing browser session…",
        "validating-session": "Validating session…",
        "saving-profile": "Saving profile…",
      } as Record<string, string>
    )[phase ?? ""] ?? "Preparing authentication…"
  );
}
function relativeTime(value: string) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Authentication operation failed.";
}

async function streamLoginEvents(
  operationId: string,
  signal: AbortSignal,
  onEvent: (type: string, data: unknown) => void,
) {
  const response = await studioMutationFetch(
    `/api/auth/login/${operationId}/events`,
    { method: "POST", signal },
  );
  if (!response.ok || !response.body)
    throw new Error("Authentication progress stream is unavailable.");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    for (;;) {
      const boundary = buffer.indexOf("\n\n");
      if (boundary < 0) break;
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const type = block.match(/^event: (.+)$/m)?.[1];
      const raw = block.match(/^data: (.+)$/m)?.[1];
      if (type && raw) onEvent(type, JSON.parse(raw));
    }
  }
}
