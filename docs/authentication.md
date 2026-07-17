# Authentication profiles

Democraft can record private applications without placing credentials, cookies,
or tokens in a demo. A demo references only an opaque local profile ID:

```ts
export default defineDemo({
  // ...
  authentication: { profileId: "auth_01arz3ndektsv4rrffq69g5fav" },
});
```

## CLI workflow

Create profile metadata, perform the interactive login once, then validate or
reuse it in future captures:

```sh
democraft auth create --name "Example admin" \
  --origin https://app.example.com \
  --validation-url /dashboard \
  --selector '[data-testid="user-menu"]'
democraft auth login auth_01arz3ndektsv4rrffq69g5fav
democraft auth validate auth_01arz3ndektsv4rrffq69g5fav
democraft auth list
democraft capture demo.ts
```

The other lifecycle commands are:

```sh
democraft auth rename <profile-id> --name "New display name"
democraft auth remove <profile-id>
democraft auth remove <profile-id> --force
```

The Studio exposes the same services in **Authentication**: create, associate,
validate, renew, rename, and remove. Association updates the demo source
configuration; browser state is never copied into that file. A demo has at most
one profile in v1, shared by all scenes in an execution.

The login command opens a headed browser. Complete email/password, OAuth, MFA,
CAPTCHA, or SSO there, then return to the terminal and press Enter. Democraft
captures browser storage only after that explicit action and validates the
protected URL before saving it.

For agents, add `--json`. Success returns `{ "ok": true, ... }`. Failures return
`{ "ok": false, "code", "profileId", "status", "actionRequired", "message",
"stage" }` on stdout with a semantic exit code. The response never contains
browser state or credentials. Common actions are `interactive-login`,
`choose-profile`, `repair-state`, and `retry`.

### Structured workflow for coding agents

Agents should use profile metadata and semantic results, never inspect
`.democraft/auth`:

1. Run `democraft auth list --json` and choose an `authenticated` profile by
   stable `id` and intended origin.
2. Put only `{ authentication: { profileId: "..." } }` in the demo.
3. Run `democraft auth validate <id> --json` before a long capture when session
   freshness matters.
4. If `actionRequired` is `interactive-login`, ask the user to renew in Studio
   or with `auth login`, then continue the original task.
5. Treat `AUTH_SESSION_EXPIRED` as an authentication prerequisite failure and
   `DCxxxx` diagnostics or browser-step failures as demo failures.

Example expired result (safe to send to an LLM):

```json
{
  "ok": false,
  "code": "AUTH_SESSION_EXPIRED",
  "profileId": "auth_01arz3ndektsv4rrffq69g5fav",
  "status": "expired",
  "actionRequired": "interactive-login",
  "message": "The authentication session expired. Renew login and retry.",
  "stage": "validation"
}
```

## Runtime behavior

Before creating capture artifacts, the runtime loads one immutable state
generation and validates it in a separate unrecorded browser context. Only a
successful validation creates the recorded context. Every scene in the run
shares that context; it is discarded at the end and never written back to the
profile. A login redirect marks the profile expired and stops without producing
a capture artifact. Renew with `democraft auth login <profile-id>` or the Studio
authentication panel, then retry.

The deprecated `--storage-state <path>` escape hatch remains available for
legacy unaffiliated captures. It cannot be combined with a demo profile.

## Storage and security

Profiles are local to the canonical workspace under `.democraft/auth/v1/`.
Democraft adds the authentication directory to `.gitignore`, uses restrictive
filesystem permissions, validates state hashes, and never copies state into
capture artifacts, Studio data, diagnostics, or CLI output. Removing a profile
deletes its local state; use `--force` only after explicitly resolving demo
associations.

Playwright storage state includes cookies and local storage, but not
`sessionStorage`. Applications that depend exclusively on session storage are
not supported by v1 profiles.

### Security guarantees and threat model

V1 protects against accidental Git publication, cross-profile state mixing,
path traversal and symlink substitution, partial writes, ordinary concurrent
mutations, and exposure through public DTOs and expected error surfaces.
Profile directories use mode `0700` and state files `0600` on filesystems that
honor POSIX permissions. State generations are hash-checked and replaced only
after an explicit successful login or renewal.

This is local isolation, not encryption at rest. It does not protect state from
malware, a privileged process, backups, disk forensics, or another process
running as the same operating-system user. Anyone with access to browser state
may be able to impersonate the signed-in user. Use a least-privileged demo
account, remove unused profiles, and rely on full-disk encryption and normal
workstation access controls.

Democraft must not log or return cookies, authorization headers, tokens,
passwords, secret values, local-storage contents, raw state, or state paths.
URLs in public errors omit credentials, query strings, and fragments. Do not
open profile state files for debugging or paste them into prompts, issues, CI
logs, snapshots, or documentation.

Profile state can span multiple domains after OAuth or SSO, because Playwright
captures compatible cookie and local-storage origins. CAPTCHA, MFA, magic
links, and SSO are completed by the user in the headed login browser; Democraft
does not bypass or automate them.

## Complete protected-dashboard example

The workspace includes `examples/demo-app/src/private-demo.ts` and protected
routes in its local fixture server. From the repository root:

```sh
pnpm --filter @democraft/example-demo-app start
democraft auth create --name "Local private dashboard" \
  --origin http://localhost:4173 \
  --validation-url /private/dashboard \
  --selector '[data-testid="private-dashboard"]'
democraft auth login <profile-id>
```

In the browser, select **Sign in**, return to the terminal, and complete the
login. Replace the placeholder `profileId` in `private-demo.ts` with the ID
printed by create, then run:

```sh
pnpm --filter @democraft/example-demo-app validate:private
pnpm --filter @democraft/example-demo-app capture:private
```

The source contains no username, password, cookie, token, or state path. Future
runs reuse the profile until the fixture session is invalidated or the profile
is removed.

## CI

Interactive login intentionally fails in CI with `AUTH_UNAVAILABLE_IN_CI` and
`actionRequired: "provide-state"`. V1 profiles are project-local and are not a
cloud secret-distribution mechanism. Provision a compatible legacy storage
state through the CI secret system and use `--storage-state`, or perform capture
on the trusted workstation where the profile was created. Never commit either
form of browser state.

The legacy state file is a deliberate v1 limitation, not profile portability:
Democraft does not encrypt, upload, or select profiles by environment. CI must
fail clearly when a referenced local profile is unavailable. Encrypted import,
custom authentication setup, provider-secret integration, and environment
profile mapping are extension points for a future release, not current
features.

## Failure diagnosis

Safe events identify the profile, stage, status, sanitized destination, failed
criterion, and recommended action. `AUTH_PROFILE_NOT_FOUND` means the source
references a profile absent from this workspace; `AUTH_STATE_CORRUPT` requires
renewal/removal rather than hand-editing; `AUTH_VALIDATION_FAILED` means the
protected-page criterion or network could not prove a session; and
`AUTH_SESSION_EXPIRED` specifically means login redirection was detected.
Validation happens before capture artifact creation, so an authentication
preflight failure cannot produce a misleading recording.
