# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- `pnpm run build` - Build the library using tsup (ESM format with TypeScript declarations)
- `pnpm run dev` - Build in watch mode for development
- `pnpm run test` - Run tests using Vitest
- `pnpm run check` - Run package validation with publint and arethetypeswrong

## Architecture

This is a Node.js library (process-ancestry) that provides process ancestry information across different platforms (Unix/Linux and Windows).

### Core Structure

- **Entry point**: `src/index.ts` - Main function `getProcessAncestry()` that detects platform and delegates to appropriate implementation
- **Platform implementations**: 
  - `src/lib/unix.ts` - Unix/Linux implementation using `ps` command
  - `src/lib/windows.ts` - Windows implementation using `wmic` command
- **Types**: `src/types.ts` - Defines `ProcessInfo` interface with `pid`, `ppid`, and `command` properties

### Key Implementation Details

Both platform implementations follow the same pattern:
1. Use `execSync` to run platform-specific commands for process information
2. Parse output to extract process ID, parent process ID, and command
3. Walk up the process tree until reaching system processes (PID 0/1 on Unix, 0/4 on Windows)
4. Return array of `ProcessInfo` objects representing the ancestry chain

The library uses ES modules and is built with tsup for both ESM output and TypeScript declarations.

## Testing

Uses Vitest as the test runner. Tests are located in the `test/` directory.