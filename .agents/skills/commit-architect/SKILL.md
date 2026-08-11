---
name: commit-architect
description: Specialized skill for executing atomic Conventional Commits, pre-commit security checks (.env shielding), and automatic repository synchronization. Use when the user requests a commit, says "commit", "/commit", or wants to save work to Git.
---

# Commit Architect Skill (`commit-architect`)

This skill provides step-by-step instructions for performing atomic, conventional, and security-verified Git commits in the `KuruttinaBot` project.

---

## 🛡️ Pre-Commit Security Check (MANDATORY)

Before running `git add` or `git commit`, ALWAYS execute the following security verification:

1. **Verify `.gitignore`**:
   Ensure `.env`, `.env.local`, and sensitive credential files are explicitly ignored in `.gitignore`.
2. **Check Staged & Untracked Files**:
   Run `git status` and inspect the list of changed files.
3. **Run Gitleaks Secret Scanner**:
   Execute `gitleaks detect --staged --verbose` to verify zero credentials exist in staged changes.
4. **ZERO-LEAK GUARANTEE**:
   Under NO CIRCUMSTANCES should `.env` files, API keys, Discord Bot Tokens, or database password strings ever be staged or committed.


---

## 📝 Conventional Commit Format

All commit messages MUST strictly adhere to the **Conventional Commits** specification:

```
<type>(<scope>): <short description in imperative mood>

[optional detailed body explaining WHY the change was made]
```

### Commit Types

- **`feat`**: A new feature for the bot (`apps/bot`) or dashboard (`apps/website`).
- **`fix`**: A bug fix in bot commands, event handlers, or UI components.
- **`docs`**: Documentation changes (`README.md`, `AGENTS.md`, `PRODUCT.md`, skill docs).
- **`style`**: Code formatting, whitespace, or visual polish (no logic changes).
- **`refactor`**: Code refactoring without fixing a bug or adding a feature (e.g., applying DRY principle).
- **`perf`**: Performance optimizations (AWS memory/CPU efficiency, database query indexing).
- **`test`**: Adding or updating unit/integration tests.
- **`chore`**: Maintenance tasks (updating dependencies, `.gitignore`, build scripts, Turborepo configs).
- **`security`**: Security hardening (RLS policies, server-side validation, env protection).

### Message Guidelines
- Subject line must be **concise** (50 characters or less).
- Use imperative, present tense ("add feature" not "added feature" or "adds feature").
- Do not end the subject line with a period.

---

## 🚀 Step-by-Step Commit Workflow

When this skill is triggered:

1. **Inspect Status**:
   ```bash
   git status
   ```

2. **Stage Specific Files (Atomic Commit)**:
   Stage only the relevant files for the logical unit of work.
   ```bash
   git add <path/to/file1> <path/to/file2>
   ```

3. **Verify Security**:
   Ensure no `.env` or credential file is staged.

4. **Execute Commit**:
   ```bash
   git commit -m "<type>: <description>"
   ```

5. **NO Automatic `git push` (Local Commit Only)**:
   Do NOT execute `git push` automatically. Keep all commits strictly local (`git commit`). Only push to remote (`git push origin main`) when the user explicitly requests a push!

6. **Report to User**:
   Provide a brief summary of the committed files and the commit hash.
