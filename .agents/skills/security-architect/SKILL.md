---
name: security-architect
description: Comprehensive security checklist and architecture guide for Kuruttina. Covers credentials, privacy, RLS, zero-eval commands, server validation, REST mutation scope, untrusted upload/file auditing, ping immunity, rate limiting and component namespacing. Use when reviewing security, creating commands, configuring Supabase, auditing code, or handling user/guild data and files.
---

# Security Architect Skill (`security-architect`)

This skill defines the complete security framework, checklists, and compliance rules for `Kuruttina`.

---

## 🛡️ Master Security Checklist

### 1. Environment & Credential Shield (Zero-Leak)
- [ ] Primary runtime secrets exist ONLY in root `.env` (never in `apps/bot`, `apps/website`, or `packages/shared`). Auxiliary emoji-vault tokens exist exclusively in the ignored `config/emoji-vaults.json`, never in `.env` or source code.
- [ ] `.gitignore` explicitly includes `.env`, `.env.local`, `.env.*.local`.
- [ ] `.env.example` contains ONLY non-sensitive placeholder values (`your_token_here`).
- [ ] No hardcoded tokens, passwords, API keys, or connection strings in source code or commits.
- [ ] Zero sensitive output in console/error logs (sanitized output).
- [ ] Gateway Intents minimized (no unneeded `MessageContent` or `GuildMembers`).
- [ ] Mandatory Gitleaks Integration: Gitleaks scanner linked & active in pre-commit hooks and GitHub Actions workflows.


---

### 2. User & Server Data Privacy (100% Care & Compliance)

> 🔒 **100% MANDATORY RLS ENFORCEMENT**
> Every Supabase table MUST execute `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`. Zero unshielded tables permitted.

- [ ] Data Minimization: Store only minimal data required for operations (no raw DMs or arbitrary chat logs).
- [ ] Supabase Row Level Security (RLS) enabled on 100% of tables (`ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;`).
- [ ] Anti-Wildcard RLS: Explicit policies verifying `auth.uid()` or checked server permissions (no `FOR ALL USING (true)`).

- [ ] Service Role Key Shield: `SUPABASE_SERVICE_ROLE_KEY` & `DATABASE_URL` strictly on server-side / Next.js server actions.
- [ ] Anonymized Telemetry: No raw user/guild IDs exposed in public logs or error traces.
- [ ] LGPD/GDPR Right to Erasure: Architecture supports deletion/anonymization upon server bot removal or user request.

---

### 3. Zero-Trust Frontend & Command Security (Zero-Eval Engine)

> 🚨 **ABSOLUTE RULE: ZERO DATABASE ON FRONTEND & ZERO FRONTEND TRUST**
> NEVER expose database credentials, DB queries, or Supabase Service Role keys to client-side code (`apps/website`). NEVER trust client validation/state. ALL database actions MUST execute server-side (Node backend / Next.js Server Actions).

- [ ] Zero Direct DB on Frontend: NO raw DB queries or table definitions in client browser components.
- [ ] Zero-Eval Policy: NO `eval()`, `new Function()`, or dynamic code execution for custom commands.

- [ ] Declarative Custom Commands: Stored strictly as JSON templates matching `customCommandPayloadSchema`.
- [ ] Server-Side Validation: All inputs validated with Zod schemas and sanitized with `sanitizeText()`.
- [ ] SQL Injection Immunity: Use `@supabase/supabase-js` SDK queries ONLY (zero raw SQL string concatenation).
- [ ] Server-Side Authorization (`PermissionGuard`): Re-verify identity & permissions on server before executing.
- [ ] REST Mutation Scope Protection: Discord REST resource mutations (emojis, roles, channels) gatekept by `DEV_ACCOUNT_ID` or verified Guild Admin. Custom commands cannot trigger REST calls.
- [ ] Ping Spam Immunity: Responses enforce `{ allowedMentions: { parse: [] } }` by default.
- [ ] Cooldown & Rate Limit: Enforced per-user & per-guild in memory (`CooldownManager`).
- [ ] Component V2 Namespacing: Custom IDs use `scope:guildId:commandId:action` pattern (`createCustomId` / `parseCustomId`).
- [ ] Zero-Trust Input & File Rejection: Assume ALL user inputs & files are untrusted/hostile ("guilty until proven innocent"). Reject arbitrary files and untrusted input without strict Zod schema validation & MIME-type checks.
- [ ] Mandatory File Audit Before Side Effects: Before the bot downloads, decodes, stores, proxies, re-uploads or forwards a user-controlled file, run the domain-specific audit/sanitization helper. Treat filename, extension, `Attachment.contentType`, `Attachment.size`, HTTP headers and remote URLs only as untrusted hints to cross-check against bounded bytes and the decoded format. For Discord bot uploads, follow `../discord-bot-architect/references/file-auditing.md`.
- [ ] Anti-IDOR & Identity Proofing: Every HTTP request/API route MUST verify server session tokens. Identity is extracted ONLY from signed tokens — users CANNOT swap, alter, or spoof `userId` on the frontend/payloads. Zero access via arbitrary client-supplied IDs.




---

### 4. Database & AWS Infrastructure Hardening
- [ ] Non-Destructive Migrations: Zero `DROP TABLE`, `TRUNCATE`, or destructive schema changes.
- [ ] Query Optimization: Explicit column selection (`select('id, guild_id')` instead of `select('*')`), indexed queries.
- [ ] Zero Polling Loops on AWS Fargate: Commands updated On-Demand via webhooks or guild events (`guildCreate`).
- [ ] Main Loop Protection: Zero synchronous heavy execution on Node.js main event loop.

---

## 🚀 Pre-Commit & Code Review Checklist

Before approving any PR or staging code for commit:

```bash
# 1. Verify git status for leaked secrets
git status

# 2. Run Gitleaks secret scanner on staged changes
gitleaks detect --staged --verbose

# 3. Check TypeScript compilation cleanly without disk emission
npx tsc --noEmit


# 3. Check for forbidden keywords in staged diffs
# Ensure no eval, raw SQL concatenation, or plain text credentials exist
```

---

## 📌 Security Incident Protocol

If a secret/token is accidentally exposed:
1. **Immediate Revocation**: Reset / revoke the Discord Bot Token, Supabase API key, or credential immediately in the external provider dashboard.
2. **Git History Scrub**: Remove secret from Git history if unpushed; force rewrite if necessary.
3. **Audit Logs**: Inspect Supabase and Discord Developer Portal logs for unauthorized access during window.
