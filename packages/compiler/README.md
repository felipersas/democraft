# @democraft/compiler

Captures authored demos into normalized JSON-compatible IR, validates them, and renders readable inspection text.

`compileDemo` remains the compatibility API and returns the IR, compiled config,
and diagnostics. New library integrations can use `compileDemoResult`, which
returns `OperationResult<CompiledDemo>` and omits `value` when error diagnostics
are present. Neither entry point exits the process.
