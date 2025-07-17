import { execSync } from "node:child_process";
import type { ProcessInfo } from "../types";

function getProcessInfo(pid: number): ProcessInfo | null {
  try {
    const output = execSync(
      `wmic process where (ProcessId=${pid}) get ProcessId,ParentProcessId,CommandLine /format:csv`,
      { 
        encoding: "utf8",
        timeout: 10000, // 10 second timeout (wmic can be slower)
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
    
    // Validate parsed values
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
  } catch (error) {
    // Log error for debugging but don't throw
    if (error instanceof Error && error.message.includes("timeout")) {
      console.warn(`Process lookup timed out for PID ${pid}`);
    }
    return null;
  }
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
    console.warn(`Reached maximum depth limit while traversing process tree from PID ${startPid}`);
  }

  return result;
}
