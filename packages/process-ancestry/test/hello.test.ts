import { describe, it, expect } from "vitest";
import getProcessAncestry from "../src/index.js";

describe("getProcessAncestry", () => {
  it("should return process ancestry for current process", () => {
    const ancestry = getProcessAncestry();
    expect(Array.isArray(ancestry)).toBe(true);
    
    // Should have at least one parent process
    if (ancestry.length > 0) {
      const first = ancestry[0]!;
      expect(first).toHaveProperty("pid");
      expect(first).toHaveProperty("ppid");
      expect(typeof first.pid).toBe("number");
      expect(typeof first.ppid).toBe("number");
    }
  });

  it("should validate PID parameter", () => {
    expect(() => getProcessAncestry(-1)).toThrow("PID must be a positive integer");
    expect(() => getProcessAncestry(0)).toThrow("PID must be a positive integer");
    expect(() => getProcessAncestry(1.5)).toThrow("PID must be a positive integer");
    expect(() => getProcessAncestry("123" as any)).toThrow("PID must be a positive integer");
    expect(() => getProcessAncestry(null as any)).toThrow("PID must be a positive integer");
  });

  it("should handle non-existent PID gracefully", () => {
    // Use a very high PID that likely doesn't exist
    const ancestry = getProcessAncestry(999999);
    expect(Array.isArray(ancestry)).toBe(true);
    // Should return empty array for non-existent process
    expect(ancestry.length).toBe(0);
  });

  it("should handle PID 1 (init process)", () => {
    const ancestry = getProcessAncestry(1);
    expect(Array.isArray(ancestry)).toBe(true);
    // Init process should have no parents or very few
    expect(ancestry.length).toBeLessThanOrEqual(1);
  });
})
