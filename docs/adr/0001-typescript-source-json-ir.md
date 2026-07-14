# ADR 0001: TypeScript Source, Generated JSON IR

## Status

Accepted.

## Context

Democraft needs to be comfortable for developers and coding agents while still producing a portable representation for validation, inspection, caching, browser execution, and rendering.

Maintaining a public TypeScript API and a separate public JSON authoring API would force users to synchronize two sources of truth.

## Decision

TypeScript is the only public authoring source for the MVP.

JSON is generated internally as a normalized intermediate representation. It is suitable for tooling and serialization, but users should not hand-maintain it for normal workflows.

## Consequences

- Developers and agents edit the same typed code.
- The compiler owns normalization, stable IDs, duration parsing, and validation.
- Future editors may consume IR and patch TypeScript, but they must not require a parallel JSON source.
