# process-ancestry

A cross-platform Node.js library for retrieving process ancestry information. Get the parent process chain for any process ID on Unix/Linux, macOS, and Windows systems.

## Features

- **Cross-platform**: Works on Unix/Linux/macOS (using `ps`) and Windows (using `wmic`)
- **Robust**: Includes timeout handling, cycle detection, and comprehensive error handling
- **TypeScript**: Full TypeScript support with type definitions
- **Zero dependencies**: No external dependencies beyond Node.js built-ins
- **ESM**: Native ES module support

## Installation

```bash
npm install process-ancestry
```

## Usage

### Basic Usage

```javascript
import getProcessAncestry from "process-ancestry";

// Get ancestry for current process
const ancestry = getProcessAncestry();
console.log(ancestry);

// Get ancestry for specific PID
const ancestry = getProcessAncestry(1234);
console.log(ancestry);
```

### Example Output

```javascript
[
  {
    pid: 1234,
    ppid: 5678,
    command: "node script.js",
  },
  {
    pid: 5678,
    ppid: 1,
    command: "bash",
  },
];
```

### TypeScript Usage

```typescript
import getProcessAncestry from "process-ancestry";
import type { ProcessInfo } from "process-ancestry";

const ancestry: ProcessInfo[] = getProcessAncestry();

ancestry.forEach((process: ProcessInfo) => {
  console.log(
    `PID: ${process.pid}, Parent: ${process.ppid}, Command: ${process.command}`,
  );
});
```

## API Reference

### `getProcessAncestry(pid?: number): ProcessInfo[]`

Retrieves the process ancestry chain for a given process ID.

#### Parameters

- `pid` (optional): Process ID to get ancestry for. Defaults to `process.pid` (current process).

#### Returns

An array of `ProcessInfo` objects representing the process ancestry chain, ordered from the given process up to the root.

#### Throws

- `Error`: If `pid` is not a positive integer

### `ProcessInfo`

```typescript
interface ProcessInfo {
  /** Process ID */
  pid: number;
  /** Parent Process ID */
  ppid: number;
  /** Command line or executable name */
  command?: string;
}
```

## Error Handling

The library includes comprehensive error handling:

- **Input validation**: Ensures PID is a positive integer
- **Timeout protection**: Commands timeout after 5s (Unix/macOS) or 10s (Windows)
- **Cycle detection**: Prevents infinite loops in corrupted process trees
- **Depth limits**: Maximum traversal depth of 1000 levels
- **Graceful failures**: Returns empty array for non-existent processes

## Platform Support

- **Unix/Linux/macOS**: Uses `ps -p <pid> -o pid=,ppid=,comm=`
- **Windows**: Uses `wmic process where (ProcessId=<pid>) get ProcessId,ParentProcessId,CommandLine /format:csv`

## Examples

### Find all parent processes

```javascript
import getProcessAncestry from "process-ancestry";

const ancestry = getProcessAncestry();
if (ancestry.length > 0) {
  console.log(`Current process has ${ancestry.length} parent processes:`);
  ancestry.forEach((proc, index) => {
    console.log(`${index + 1}. PID ${proc.pid}: ${proc.command || "unknown"}`);
  });
} else {
  console.log("No parent processes found (likely init process)");
}
```

### Find root parent process

```javascript
import getProcessAncestry from "process-ancestry";

const ancestry = getProcessAncestry();
const rootParent = ancestry[ancestry.length - 1];
if (rootParent) {
  console.log(`Root parent: PID ${rootParent.pid} (${rootParent.command})`);
}
```

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Run checks
pnpm check
```

## License

MIT

## Author

Matt Kane
