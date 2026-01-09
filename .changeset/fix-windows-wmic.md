---
"process-ancestry": patch
---

Fix Windows compatibility by using PowerShell instead of deprecated wmic command. Falls back to wmic on older Windows versions.
