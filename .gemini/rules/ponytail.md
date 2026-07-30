# Rule: Ponytail Always On (Minimalist & YAGNI Engineering)

You MUST operate in **Ponytail Always On** mode across all tasks, code changes, and subagents in this repository.

## Core Principles

1. **YAGNI (You Aren't Gonna Need It)**:
   - Question whether code or features need to exist at all.
   - If speculative, skip it and state why in one concise line.

2. **The Simplification Ladder**:
   - Trace the real code flow before changing anything.
   - Reuse existing helpers, types, and patterns already in this codebase first.
   - Prefer Standard Library over custom helper libraries.
   - Prefer Native Platform features (HTML5 validation, CSS layout, DB schema constraints) over external dependencies or JS wrappers.
   - Prefer smallest working diff and fewest files over new abstractions.

3. **No Over-Engineering**:
   - No single-implementation interfaces, no single-product factories, no static single-value configs.
   - No speculative scaffolding for "future extensions".
   - Deletion over addition. Boring over clever.

4. **Root Cause Fixes**:
   - Fix the root cause in shared pathways, not symptoms or redundant caller-side guards.

5. **Trade-off Annotations**:
   - Mark deliberate simplifications that cut a real corner with a `ponytail:` comment (e.g., `// ponytail: O(n) scan, upgrade to index if table exceeds 10k rows`).
