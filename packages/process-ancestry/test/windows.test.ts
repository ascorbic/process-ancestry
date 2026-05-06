import { describe, it, expect } from "vitest";
import {
  parseWmicCsv,
  snapshotFromRows,
  walkSnapshot,
  type ProcessSnapshot,
} from "../src/lib/windows.js";

describe("snapshotFromRows", () => {
  it("builds a snapshot from typical PowerShell rows", () => {
    const snapshot = snapshotFromRows([
      { ProcessId: 100, ParentProcessId: 4, CommandLine: "wininit.exe" },
      {
        ProcessId: 200,
        ParentProcessId: 100,
        CommandLine: "C\\System32\\services.exe",
      },
      { ProcessId: 300, ParentProcessId: 200, CommandLine: null },
    ]);

    expect(snapshot.size).toBe(3);
    expect(snapshot.get(100)).toEqual({ ppid: 4, command: "wininit.exe" });
    expect(snapshot.get(200)).toEqual({
      ppid: 100,
      command: "C\\System32\\services.exe",
    });
    expect(snapshot.get(300)).toEqual({ ppid: 200, command: undefined });
  });

  it("accepts string PIDs (wmic delivers them as strings)", () => {
    const snapshot = snapshotFromRows([
      { ProcessId: "1234", ParentProcessId: "5678", CommandLine: "node" },
    ]);
    expect(snapshot.get(1234)).toEqual({ ppid: 5678, command: "node" });
  });

  it("ignores rows missing required fields", () => {
    const snapshot = snapshotFromRows([
      { ProcessId: null, ParentProcessId: 1, CommandLine: "x" },
      { ProcessId: 1, ParentProcessId: undefined, CommandLine: "x" },
      { ProcessId: 5, ParentProcessId: 1, CommandLine: "x" },
    ]);
    expect(Array.from(snapshot.keys())).toEqual([5]);
  });

  it("normalizes whitespace-only command lines to undefined", () => {
    const snapshot = snapshotFromRows([
      { ProcessId: 1, ParentProcessId: 0, CommandLine: "   " },
    ]);
    expect(snapshot.get(1)?.command).toBeUndefined();
  });
});

describe("parseWmicCsv", () => {
  it("parses standard CSV output", () => {
    const csv = [
      "",
      "Node,CommandLine,ParentProcessId,ProcessId",
      "WIN-HOST,wininit.exe,300,400",
      "WIN-HOST,C:\\Windows\\System32\\services.exe,400,500",
      "",
    ].join("\r\n");

    const rows = parseWmicCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      ProcessId: "400",
      ParentProcessId: "300",
      CommandLine: "wininit.exe",
    });
    expect(rows[1]).toEqual({
      ProcessId: "500",
      ParentProcessId: "400",
      CommandLine: "C:\\Windows\\System32\\services.exe",
    });
  });

  it("recovers command lines that themselves contain commas", () => {
    const csv = [
      "Node,CommandLine,ParentProcessId,ProcessId",
      'WIN-HOST,node.exe --flag=a,b,c,1000,2000',
    ].join("\r\n");

    const rows = parseWmicCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      ProcessId: "2000",
      ParentProcessId: "1000",
      CommandLine: "node.exe --flag=a,b,c",
    });
  });

  it("treats an empty command line as null", () => {
    const csv = [
      "Node,CommandLine,ParentProcessId,ProcessId",
      "WIN-HOST,,1,2",
    ].join("\r\n");

    const rows = parseWmicCsv(csv);
    expect(rows[0]?.CommandLine).toBeNull();
  });

  it("skips malformed rows without throwing", () => {
    const csv = [
      "Node,CommandLine,ParentProcessId,ProcessId",
      "too,few",
      "WIN-HOST,cmd.exe,1,2",
    ].join("\n");

    const rows = parseWmicCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.ProcessId).toBe("2");
  });
});

describe("walkSnapshot", () => {
  function makeSnapshot(
    entries: Array<[number, number, string?]>,
  ): ProcessSnapshot {
    const map: ProcessSnapshot = new Map();
    for (const [pid, ppid, command] of entries) {
      map.set(pid, { ppid, command });
    }
    return map;
  }

  it("returns an empty array when the snapshot is empty", () => {
    expect(walkSnapshot(new Map(), 1234)).toEqual([]);
  });

  it("walks parent links until reaching System (ppid 4)", () => {
    const snapshot = makeSnapshot([
      [1000, 800, "node script.js"],
      [800, 400, "cmd.exe"],
      [400, 4, "wininit.exe"],
    ]);

    const ancestry = walkSnapshot(snapshot, 1000);
    expect(ancestry).toEqual([
      { pid: 1000, ppid: 800, command: "node script.js" },
      { pid: 800, ppid: 400, command: "cmd.exe" },
    ]);
  });

  it("stops at ppid 0 (System Idle) too", () => {
    const snapshot = makeSnapshot([
      [200, 100, "a"],
      [100, 0, "root"],
    ]);

    const ancestry = walkSnapshot(snapshot, 200);
    expect(ancestry).toEqual([{ pid: 200, ppid: 100, command: "a" }]);
  });

  it("returns an empty array when the start PID isn't in the snapshot", () => {
    const snapshot = makeSnapshot([[100, 4, "foo"]]);
    expect(walkSnapshot(snapshot, 999)).toEqual([]);
  });

  it("breaks out of cycles instead of looping forever", () => {
    const snapshot = makeSnapshot([
      [1, 2, "one"],
      [2, 1, "two"], // cycle
    ]);

    const ancestry = walkSnapshot(snapshot, 1);
    // Should record one hop, then bail when the cycle is detected.
    expect(ancestry.length).toBeGreaterThan(0);
    expect(ancestry.length).toBeLessThanOrEqual(2);
  });

  it("preserves command strings on each ancestor", () => {
    const snapshot = makeSnapshot([
      [10, 20, "cmd-a"],
      [20, 30, "cmd-b"],
      [30, 4, "wininit.exe"],
    ]);

    const ancestry = walkSnapshot(snapshot, 10);
    expect(ancestry.map((a) => a.command)).toEqual([
      "cmd-a",
      "cmd-b",
    ]);
  });
});
