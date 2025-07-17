# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

From the root directory:
- `pnpm run build` - Build all packages in the monorepo
- `pnpm run test` - Run tests for all packages
- `pnpm run check` - Run package validation for all packages

For the process-ancestry package specifically:
- `pnpm run --filter process-ancestry build` - Build the process-ancestry package
- `pnpm run --filter process-ancestry dev` - Build in watch mode for development
- `pnpm run --filter process-ancestry test` - Run tests for process-ancestry
- `pnpm run --filter process-ancestry check` - Run package validation

Or run commands directly in the package directory:
- `cd packages/process-ancestry && pnpm run build` - Build the process-ancestry package
- `cd packages/process-ancestry && pnpm run test` - Run tests for process-ancestry

## Repository Structure

This is a monorepo containing the process-ancestry library:

- `packages/process-ancestry/` - Main process-ancestry library
- Root workspace manages all packages with pnpm workspaces

## Architecture

The process-ancestry library provides process ancestry information across different platforms (Unix/Linux and Windows).

### Core Structure

- **Entry point**: `packages/process-ancestry/src/index.ts` - Main function `getProcessAncestry()` that detects platform and delegates to appropriate implementation
- **Platform implementations**: 
  - `packages/process-ancestry/src/lib/unix.ts` - Unix/Linux implementation using `ps` command
  - `packages/process-ancestry/src/lib/windows.ts` - Windows implementation using `wmic` command
- **Types**: `packages/process-ancestry/src/types.ts` - Defines `ProcessInfo` interface with `pid`, `ppid`, and `command` properties

### Key Implementation Details

Both platform implementations follow the same pattern:
1. Use `execSync` to run platform-specific commands for process information
2. Parse output to extract process ID, parent process ID, and command
3. Walk up the process tree until reaching system processes (PID 0/1 on Unix, 0/4 on Windows)
4. Return array of `ProcessInfo` objects representing the ancestry chain
5. Include robust error handling, timeout protection, and cycle detection

The library uses ES modules and is built with tsup for both ESM output and TypeScript declarations.

## Testing

Uses Vitest as the test runner. Tests are located in the `packages/process-ancestry/test/` directory and include comprehensive edge case testing.