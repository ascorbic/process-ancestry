import { execSync } from "node:child_process";
import type { ProcessInfo } from "../types";

// Cache which PowerShell executable is available (pwsh is faster than powershell)
let psExecutable: "pwsh" | "powershell" | null = null;

/**
 * Get the PowerShell executable to use, preferring pwsh (PowerShell Core) for faster startup
 */
function getPowerShellExecutable(): "pwsh" | "powershell" | null {
  if (psExecutable !== null) {
    return psExecutable;
  }

  // Try pwsh first (PowerShell Core) - much faster startup time
  try {
    execSync("pwsh -Version", { encoding: "utf8", timeout: 5000, windowsHide: true });
    psExecutable = "pwsh";
    return psExecutable;
  } catch {
    // pwsh not available
  }

  // Fall back to Windows PowerShell
  try {
    execSync("powershell -Version", { encoding: "utf8", timeout: 5000, windowsHide: true });
    psExecutable = "powershell";
    return psExecutable;
  } catch {
    // powershell not available
  }

  return null;
}

/**
 * Get process info using PowerShell's Get-CimInstance (modern method)
 */
function getProcessInfoPowerShell(pid: number): ProcessInfo | null {
  const ps = getPowerShellExecutable();
  if (!ps) {
    return null;
  }

  try {
    const output = execSync(
      `${ps} -NoLogo -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter 'ProcessId=${pid}' | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Csv -NoTypeInformation"`,
      {
        encoding: "utf8",
        timeout: 10000,
        windowsHide: true,
      },
    );

    if (!output) {
      return null;
    }

    const lines = output.trim().split("\n").filter((line) => line.trim());

    // Need at least header and data row
    if (lines.length < 2) {
      return null;
    }

    // Parse CSV - second line is the data
    // Format: "CommandLine","ParentProcessId","ProcessId"
    const dataLine = lines[1];

    // Parse CSV properly handling quoted fields with commas
    const fields = parseCSVLine(dataLine);

    if (fields.length < 3) {
      return null;
    }

    const [commandLine, parentPid, thisPid] = fields;

    const parsedPid = thisPid ? parseInt(thisPid.trim(), 10) : NaN;
    const parsedPpid = parentPid ? parseInt(parentPid.trim(), 10) : NaN;

    if (isNaN(parsedPid) || isNaN(parsedPpid)) {
      return null;
    }

    return {
      pid: parsedPid,
      ppid: parsedPpid,
      command: commandLine?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Get process info using wmic (legacy fallback for older Windows)
 */
function getProcessInfoWmic(pid: number): ProcessInfo | null {
  try {
    const output = execSync(
      `wmic process where (ProcessId=${pid}) get ProcessId,ParentProcessId,CommandLine /format:csv`,
      {
        encoding: "utf8",
        timeout: 10000,
        windowsHide: true,
      },
    );

    if (!output) {
      return null;
    }

    const lines = output
      .split("\n")
      .filter((line) => line.trim() && !line.startsWith("Node"));
    const fields = lines.pop()?.split(",");

    if (!fields || fields.length < 4) return null;

    const [_node, commandLine, parentPid, thisPid] = fields;

    const parsedPid = thisPid ? parseInt(thisPid.trim(), 10) : NaN;
    const parsedPpid = parentPid ? parseInt(parentPid.trim(), 10) : NaN;

    if (isNaN(parsedPid) || isNaN(parsedPpid)) {
      return null;
    }

    return {
      pid: parsedPid,
      ppid: parsedPpid,
      command: commandLine?.trim() || undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Parse a CSV line handling quoted fields that may contain commas
 */
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

// Cache which method works to avoid repeated failures
let preferredMethod: "powershell" | "wmic" | null = null;

function getProcessInfo(pid: number): ProcessInfo | null {
  // Try preferred method first if we know one works
  if (preferredMethod === "powershell") {
    return getProcessInfoPowerShell(pid);
  }
  if (preferredMethod === "wmic") {
    return getProcessInfoWmic(pid);
  }

  // Try PowerShell first (modern, available on Windows 10+)
  const psResult = getProcessInfoPowerShell(pid);
  if (psResult) {
    preferredMethod = "powershell";
    return psResult;
  }

  // Fall back to wmic (legacy, for older Windows)
  const wmicResult = getProcessInfoWmic(pid);
  if (wmicResult) {
    preferredMethod = "wmic";
    return wmicResult;
  }

  return null;
}

export default function getAncestryWindows(
  startPid: number,
): Array<ProcessInfo> {
  const result: ProcessInfo[] = [];
  const visited = new Set<number>();
  let currentPid: number | undefined = startPid;
  let maxDepth = 1000; // Prevent infinite loops

  while (currentPid && maxDepth > 0) {
    // Check for cycles
    if (visited.has(currentPid)) {
      console.warn(`Detected cycle in process tree at PID ${currentPid}`);
      break;
    }

    visited.add(currentPid);

    const info = getProcessInfo(currentPid);
    if (!info || info.ppid === 0 || info.ppid === 4) break;

    result.push(info);
    currentPid = info.ppid;
    maxDepth--;
  }

  if (maxDepth === 0) {
    console.warn(
      `Reached maximum depth limit while traversing process tree from PID ${startPid}`,
    );
  }

  return result;
}
