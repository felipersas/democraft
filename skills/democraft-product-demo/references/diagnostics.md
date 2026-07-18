# Diagnostics (`DCxxxx` codes)

Diagnostics are the stable, machine-readable way DemoCraft reports problems.
Every diagnostic has a `code`, `severity` (`info`/`warning`/`error`),
`message`, and often a `path` and `suggestion`.

> **Envelope note:** `doctor` and `discover` return a `{ ok, ... }` envelope,
> but `validate --json` deliberately returns a **bare `Diagnostic[]` array**
> (success = empty array + exit code 0; failure = non-empty array + exit 1).
> Check both: `exitCode === 0 && diagnostics.filter(d => d.severity === "error").length === 0`.

## Authoring (`DC0xx`, `DC1xx`)

| Code | Meaning | Fix |
| --- | --- | --- |
| `DC001` | invalid config | fix the demo/config definition |
| `DC002` | duplicate id | rename the duplicate scene/step/target |
| `DC003` | authoring failed (the `run` callback threw) | inspect the error |
| `DC101` | unknown target | the step references a target id not in `defineTargets` |
| `DC102` | invalid duration | use `250ms`, `1s`, `1.5s` |
| `DC103` | invalid scene | scene missing required fields |
| `DC104` | invalid step | step missing required fields |
| `DC106` | invalid target | locator is malformed |
| `DC109` | invalid authentication profile | profile id not found |

## Runtime / capture (`DC2xx`)

| Code | Meaning | Fix |
| --- | --- | --- |
| `DC201` | runtime step failed | element not visible/ready; add `expectVisible` |

## Audio (`DC3xx`, presentation-only)

| Code | Meaning |
| --- | --- |
| `DC300`–`DC306` | audio track issues (duplicate id, missing source, invalid volume/time/fade, unsupported format) |

## Discovery (`DC4xx`)

| Code | Meaning | Fix |
| --- | --- | --- |
| `DC401` | origin blocked | add `--allow-origin <origin>` |
| `DC402` | unsafe scheme | use `http://` or `https://` |
| `DC403` | discovery timeout | page never settled; check the app is up |
| `DC404` | discovery aborted | re-run (Ctrl+C was pressed) |
| `DC405` | environment problem | run `democraft doctor --json` |
| `DC406` | ambiguous target | scope to region or pick a different candidate |
| `DC407` | no interactive elements | page may need login or is a loading state |
| `DC408` | elements inside a closed overlay | author the open-overlay step first; elements are surfaced marked `insideClosedOverlay` |

Docs: `https://democraft.dev/en/docs/reference/diagnostics?code=DCxxxx`
