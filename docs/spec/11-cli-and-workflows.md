# CLI and Workflows

## CLI goals

The CLI should support:

- project setup;
- target discovery;
- validation;
- capture;
- preview;
- rendering;
- inspection;
- artifact cleanup;
- structured output for agents.

## Initial commands

```bash
democraft init
democraft discover
democraft inspect
democraft validate
democraft capture
democraft preview
democraft render
democraft clean
```

## `init`

Creates:

```text
democraft.config.ts
demos/example/demo.ts
demos/example/targets.ts
```

## `discover`

Opens or scans an application route and proposes semantic targets.

```bash
democraft discover \
  --url http://localhost:3000/dashboard
```

## `inspect`

Displays:

- scenes;
- steps;
- targets;
- cues;
- expected capture invalidation;
- output formats;
- visual registry dependencies.

## `validate`

Modes:

```bash
democraft validate --static
democraft validate --journey
democraft validate --capture
democraft validate --composition
```

## `capture`

Executes the browser journey and writes reusable artifacts.

```bash
democraft capture create-project
```

## `preview`

```bash
democraft preview create-project
democraft preview create-project --scene result
democraft preview create-project --from dialog-opened --to project-created
```

## `render`

```bash
democraft render create-project
democraft render create-project --output vertical
```

## `clean`

Removes generated artifacts by category.

```bash
democraft clean --previews
democraft clean --captures
democraft clean --all
```

## Machine-readable output

Every command should eventually support:

```bash
--json
--quiet
--output-file
```

## Exit codes

Use stable exit codes for:

- static validation failure;
- journey failure;
- capture failure;
- composition failure;
- render failure;
- configuration error.

## Cache behavior

Commands should report whether they reused:

- compiled IR;
- browser recording;
- geometry;
- timeline;
- Remotion bundle;
- rendered output.

## Example workflow

```bash
democraft validate create-project --static
democraft validate create-project --journey
democraft capture create-project
democraft preview create-project --scene result
democraft render create-project --output landscape
democraft render create-project --output vertical
```
