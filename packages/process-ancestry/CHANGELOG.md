# process-ancestry

## 0.2.0

### Minor Changes

- [#12](https://github.com/ascorbic/process-ancestry/pull/12) [`0c79e1d`](https://github.com/ascorbic/process-ancestry/commit/0c79e1d60660c336390c277a8123c6b48ed4978a) Thanks [@ascorbic](https://github.com/ascorbic)! - Speed up Windows process ancestry lookups dramatically.

  Previously, getting the ancestry chain on Windows spawned one `wmic` subprocess per ancestor. `wmic` startup is slow and the command itself is deprecated (removed by default in Windows 11 24H2 and Windows Server 2025), which made deep trees painful and brittle on modern hosts.

  The Windows path now takes a single PowerShell snapshot of every running process via `Get-CimInstance Win32_Process`, builds an in-memory pid -> parent map, and walks the chain locally. That collapses N subprocess spawns into one. PowerShell Core (`pwsh`) is preferred when available; legacy Windows PowerShell is used as a fallback. If PowerShell is somehow unavailable, `wmic` is still tried as a last-resort fallback, but only ever in a single batched call (no per-ancestor invocations).

  No public API changes.

## 0.1.0

### Minor Changes

- [#9](https://github.com/ascorbic/process-ancestry/pull/9) [`029dd13`](https://github.com/ascorbic/process-ancestry/commit/029dd13763a3cac3863129435aef29b05ef74379) Thanks [@ascorbic](https://github.com/ascorbic)! - Exports `ProcessInfo` type

## 0.0.2

### Patch Changes

- [#7](https://github.com/ascorbic/process-ancestry/pull/7) [`f768595`](https://github.com/ascorbic/process-ancestry/commit/f76859526d46913c75e69a9ca3330ee7dcc308e9) Thanks [@ascorbic](https://github.com/ascorbic)! - Include full arguments in Unix command output

## 0.0.1

### Patch Changes

- [#3](https://github.com/ascorbic/process-ancestry/pull/3) [`7fa0659`](https://github.com/ascorbic/process-ancestry/commit/7fa0659046720943eef1e4aa096103ce8b2b9a86) Thanks [@ascorbic](https://github.com/ascorbic)! - Initial release of process-ancestry library
  - Cross-platform process ancestry tracking for Unix/Linux, macOS, and Windows
  - Robust error handling with timeout protection and cycle detection
  - Input validation and comprehensive test coverage
  - TypeScript support with zero external dependencies
  - Comprehensive documentation and examples
