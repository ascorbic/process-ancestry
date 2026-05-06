---
"process-ancestry": minor
---

Speed up Windows process ancestry lookups dramatically.

Previously, getting the ancestry chain on Windows spawned one `wmic` subprocess per ancestor. `wmic` startup is slow and the command itself is deprecated (removed by default in Windows 11 24H2 and Windows Server 2025), which made deep trees painful and brittle on modern hosts.

The Windows path now takes a single PowerShell snapshot of every running process via `Get-CimInstance Win32_Process`, builds an in-memory pid -> parent map, and walks the chain locally. That collapses N subprocess spawns into one. PowerShell Core (`pwsh`) is preferred when available; legacy Windows PowerShell is used as a fallback. If PowerShell is somehow unavailable, `wmic` is still tried as a last-resort fallback, but only ever in a single batched call (no per-ancestor invocations).

No public API changes.
