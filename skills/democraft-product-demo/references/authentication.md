# Authentication

Use authentication only when the target workflow genuinely requires it.

## Rules

- Use DemoCraft auth profiles through the CLI or existing demo configuration.
- Never print cookies, tokens, storage state, or profile files.
- Never include auth state in notes, prompts, eval reports, or rendered captions.
- If Discovery cannot access a page because auth is missing, stop and ask for an
  approved auth profile or a public route.
- Treat login, logout, billing, deletion, publishing, uploads, and settings
  changes as mutable unless the user explicitly authorizes them.

## Workflow

1. Run `democraft doctor --json --url <url>` and check reachability.
2. If the app redirects to login, use the repository's documented auth profile
   flow instead of hand-editing browser state.
3. Run `democraft discover <url> --json` only after the profile is available.
4. Report profile ids or names only when needed; do not report secret paths or
   state contents.
