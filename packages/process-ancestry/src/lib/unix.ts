import { execSync } from "node:child_process";
import type { ProcessInfo } from "../types";

function getProcessInfo(pid: number): ProcessInfo | null {
  try {
    const output = execSync(`ps -p ${pid} -o pid=,ppid=,command=`, {
      encoding: "utf8",
      timeout: 5000, // 5 second timeout
    }).trim();

    if (!output) {
      return null;
    }

    const [pidStr, ppidStr, ...commandParts] = output.split(/\s+/);

    // Validate parsed values
    const parsedPid = pidStr ? parseInt(pidStr, 10) : NaN;
    const parsedPpid = ppidStr ? parseInt(ppidStr, 10) : NaN;

    if (isNaN(parsedPid) || isNaN(parsedPpid)) {
      return null;
    }

    return {
      pid: parsedPid,
      ppid: parsedPpid,
      command: commandParts.join(" ") || undefined,
    };
  } catch (error) {
    // Log error for debugging but don't throw
    if (error instanceof Error && error.message.includes("timeout")) {
      console.warn(`Process lookup timed out for PID ${pid}`);
    }
    return null;
  }
}

export default function getAncestryUnix(startPid: number): Array<ProcessInfo> {
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
    if (!info || info.ppid === 0 || info.ppid === 1) break;

    result.push(info);
    currentPid = info.ppid;
    maxDepth--;
  }

  if (maxDepth === 0) {
    console.warn(`Reached maximum depth limit while traversing process tree from PID ${startPid}`);
  }

  return result;
}
