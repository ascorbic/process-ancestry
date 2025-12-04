import os from "node:os";
import getAncestryUnix from "./lib/unix.js";
import getAncestryWindows from "./lib/windows.js";
import type { ProcessInfo } from "./types.js";
export type { ProcessInfo };

export function getProcessAncestry(pid = process.pid): Array<ProcessInfo> {
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 0) {
    throw new Error("PID must be a positive integer");
  }

  if (os.platform() === "win32") {
    return getAncestryWindows(pid);
  } else {
    return getAncestryUnix(pid);
  }
}
