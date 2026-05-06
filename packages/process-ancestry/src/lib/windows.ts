import { execFileSync, execSync } from "node:child_process";
import type { ProcessInfo } from "../types";

/**
 * A snapshot of every process on the system, keyed by PID. Building one of
 * these requires a single subprocess invocation; walking the ancestry chain
 * after that is pure in-memory work.
 *
 * The previous implementation called `wmic` once per ancestor, which on
 * Windows could cost hundreds of milliseconds per hop. Building one snapshot
 * is dramatically faster, and `wmic` is deprecated (removed by default in
 * recent Windows 11 / Server 2025 builds), so PowerShell + CIM is now the
 * primary path.
 */
export type ProcessSnapshot = Map<number, { ppid: number; command?: string }>;

interface RawProcessRow {
  ProcessId?: number | string | null;
  ParentProcessId?: number | string | null;
  CommandLine?: string | null;
}

function parsePid(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = parseInt(value.trim(), 10);
    if (!isNaN(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

/**
 * Build a {@link ProcessSnapshot} from already-parsed rows. Exposed for tests.
 *
 * @internal
 */
export function snapshotFromRows(rows: RawProcessRow[]): ProcessSnapshot {
  const snapshot: ProcessSnapshot = new Map();
  for (const row of rows) {
    const pid = parsePid(row.ProcessId);
    const ppid = parsePid(row.ParentProcessId);
    if (pid === null || ppid === null) continue;
    const command =
      typeof row.CommandLine === "string" && row.CommandLine.trim()
        ? row.CommandLine.trim()
        : undefined;
    snapshot.set(pid, { ppid, command });
  }
  return snapshot;
}

/**
 * Try to obtain a process snapshot via PowerShell + CIM. This is the modern,
 * supported path on Windows 10/11 and Windows Server 2016+.
 *
 * We prefer `pwsh` (PowerShell Core) when available because it has a faster
 * cold start than legacy `powershell.exe`, and fall back to `powershell` if
 * `pwsh` is not on PATH.
 */
function snapshotViaPowerShell(): ProcessSnapshot | null {
  // Output an array of objects, even when only one process matches, so JSON
  // parsing is consistent regardless of process count. `-Compress` keeps the
  // payload small for very large process tables.
  const script =
    "Get-CimInstance Win32_Process | " +
    "Select-Object ProcessId,ParentProcessId,CommandLine | " +
    "ConvertTo-Json -Compress -AsArray";

  const args = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    script,
  ];

  for (const exe of ["pwsh.exe", "powershell.exe"]) {
    try {
      const output = execFileSync(exe, args, {
        encoding: "utf8",
        timeout: 10000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      if (!output) continue;

      const parsed: unknown = JSON.parse(output);
      const rows: RawProcessRow[] = Array.isArray(parsed)
        ? (parsed as RawProcessRow[])
        : [parsed as RawProcessRow];
      return snapshotFromRows(rows);
    } catch {
      // Try the next executable, then fall through to the wmic fallback.
    }
  }

  return null;
}

/**
 * Parse the CSV output from
 * `wmic process get ProcessId,ParentProcessId,CommandLine /format:csv`.
 *
 * wmic emits columns alphabetically, so the row layout is:
 *   Node,CommandLine,ParentProcessId,ProcessId
 *
 * `CommandLine` may itself contain commas. We rely on the fact that the two
 * trailing columns are numeric and parse each row from the end.
 *
 * @internal
 */
export function parseWmicCsv(output: string): RawProcessRow[] {
  const rows: RawProcessRow[] = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("Node,")) continue;

    const fields = line.split(",");
    if (fields.length < 4) continue;

    const pid = fields[fields.length - 1];
    const ppid = fields[fields.length - 2];
    const commandLine = fields
      .slice(1, fields.length - 2)
      .join(",")
      .trim();

    rows.push({
      ProcessId: pid,
      ParentProcessId: ppid,
      CommandLine: commandLine || null,
    });

    // Cap memory on hosts with very large process tables.
    if (rows.length > 50000) break;
  }
  return rows;
}

/**
 * Legacy `wmic` fallback. `wmic` is deprecated on modern Windows and missing
 * by default on Windows 11 24H2 / Server 2025+, so this path is best-effort.
 *
 * Critically, we still issue ONE call (no `where` filter) and parse the full
 * table client-side, rather than spawning `wmic` per ancestor.
 */
function snapshotViaWmic(): ProcessSnapshot | null {
  try {
    const output = execSync(
      "wmic process get ProcessId,ParentProcessId,CommandLine /format:csv",
      {
        encoding: "utf8",
        timeout: 15000,
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      },
    );

    if (!output) return null;
    const rows = parseWmicCsv(output);
    return rows.length === 0 ? null : snapshotFromRows(rows);
  } catch {
    return null;
  }
}

function getProcessSnapshot(): ProcessSnapshot {
  return snapshotViaPowerShell() ?? snapshotViaWmic() ?? new Map();
}

/**
 * Walk a pre-built {@link ProcessSnapshot} to recover an ancestry chain. Pure
 * function, exposed for tests.
 *
 * @internal
 */
export function walkSnapshot(
  snapshot: ProcessSnapshot,
  startPid: number,
): Array<ProcessInfo> {
  if (snapshot.size === 0) return [];

  const result: ProcessInfo[] = [];
  const visited = new Set<number>();
  let currentPid: number | undefined = startPid;
  let maxDepth = 1000;

  while (currentPid && maxDepth > 0) {
    if (visited.has(currentPid)) {
      console.warn(`Detected cycle in process tree at PID ${currentPid}`);
      break;
    }
    visited.add(currentPid);

    const entry = snapshot.get(currentPid);
    // PID 0 (System Idle) and PID 4 (System) are the terminal cases on
    // Windows. Stop traversal when we hit them, matching the previous
    // implementation's behaviour.
    if (!entry || entry.ppid === 0 || entry.ppid === 4) break;

    result.push({
      pid: currentPid,
      ppid: entry.ppid,
      command: entry.command,
    });

    currentPid = entry.ppid;
    maxDepth--;
  }

  if (maxDepth === 0) {
    console.warn(
      `Reached maximum depth limit while traversing process tree from PID ${startPid}`,
    );
  }

  return result;
}

export default function getAncestryWindows(
  startPid: number,
): Array<ProcessInfo> {
  return walkSnapshot(getProcessSnapshot(), startPid);
}
