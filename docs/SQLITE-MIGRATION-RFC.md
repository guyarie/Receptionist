# RFC: Migrate from JSON Files to SQLite

**Status:** Draft — for review  
**Author:** Azriel (AI) / PJ  
**Date:** 2026-03-18  

---

## Problem

The receptionist currently stores all persistent data as JSON files on disk:

| Data | Current Storage | Files |
|---|---|---|
| Call summaries | One JSON file per call | `call-summaries/call-*.json` |
| Webchat leads | Single JSON file | `leads/leads.json` |
| Webchat sessions | In-memory only | Lost on restart |
| Admin auth | Hardcoded / env | `.env` |

### What breaks at scale:

1. **Call summaries** — `getAllSummaries()` reads EVERY file into memory, parses each one, then sorts. At 1,000+ calls, this gets slow and memory-hungry.
2. **Leads** — `leads.json` is read/written as a whole on every update. Race condition risk if two conversations finish simultaneously.
3. **No querying** — Want "show me all leads from last week"? You load everything and filter in JS.
4. **No relationships** — A lead from webchat and the same person calling by phone are two unlinked records.
5. **Webchat sessions vanish on restart** — No persistence for active conversations.
6. **File I/O on every write** — `fs.writeFileSync` blocks the event loop.

---

## Proposal

Replace JSON file storage with a single SQLite database using `better-sqlite3` (synchronous, no native compilation headaches, perfect for single-server Node.js).

### Why SQLite (not Postgres/MySQL):
- Zero infrastructure — no separate DB server to manage
- Single file — easy backup (`cp receptionist.db receptionist.db.bak`)
- Fast enough for this scale (100s of calls/month, not millions)
- `better-sqlite3` is synchronous — simpler code than async DB drivers
- Typical deployment is a single $6/mo droplet — SQLite is the right tool

---

## Schema

### Core Tables (recommended for all deployments)

These tables replace the existing JSON storage and benefit every receptionist deployment regardless of industry.

```sql
-- Calls: replaces call-summaries/*.json
CREATE TABLE calls (
  id            TEXT PRIMARY KEY,  -- callSid
  caller_phone  TEXT,
  twilio_number TEXT,
  channel       TEXT NOT NULL DEFAULT 'phone',  -- 'phone', 'sms', 'webchat'
  start_time    TEXT NOT NULL,  -- ISO 8601
  end_time      TEXT,
  duration_sec  INTEGER,
  summary       TEXT,           -- AI-generated summary
  transcript    TEXT,           -- JSON array of {speaker, message}
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  deleted_at    TEXT            -- soft delete
);

CREATE INDEX idx_calls_start ON calls(start_time);
CREATE INDEX idx_calls_channel ON calls(channel);
CREATE INDEX idx_calls_phone ON calls(caller_phone);

-- Leads: replaces leads/leads.json
CREATE TABLE leads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id    TEXT UNIQUE,     -- webchat session ID
  call_id       TEXT REFERENCES calls(id),  -- link to call if from phone
  name          TEXT,
  phone         TEXT,
  email         TEXT,
  address       TEXT,
  source        TEXT NOT NULL DEFAULT 'webchat',  -- 'webchat', 'phone', 'sms', 'email'
  status        TEXT NOT NULL DEFAULT 'new',      -- 'new', 'contacted', 'quoted', 'won', 'lost'
  message_count INTEGER DEFAULT 0,
  notes         TEXT,
  notified      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_created ON leads(created_at);

-- Webchat sessions: currently in-memory only
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,  -- session UUID
  lead_id       INTEGER REFERENCES leads(id),
  messages      TEXT,              -- JSON array of conversation
  started_at    TEXT NOT NULL DEFAULT (datetime('now')),
  last_active   TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at      TEXT,
  ip_address    TEXT,
  user_agent    TEXT
);

CREATE INDEX idx_sessions_active ON sessions(last_active);

-- Prompt version history: audit trail for system prompt changes
CREATE TABLE prompt_versions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt_name   TEXT NOT NULL DEFAULT 'system-prompt',  -- which prompt file
  prompt_text   TEXT NOT NULL,
  change_note   TEXT,              -- why it was changed
  changed_by    TEXT DEFAULT 'admin',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Post-call agent results (Guy's branch)
CREATE TABLE agent_actions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  call_id       TEXT REFERENCES calls(id),
  agent_type    TEXT NOT NULL,     -- 'post-call', 'daily-digest'
  action        TEXT NOT NULL,     -- 'email_sent', 'follow_up_scheduled', etc.
  details       TEXT,              -- JSON blob
  executed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Service Business Extensions (what we're running at ChargeWizards)

These tables solve problems specific to service businesses — field visits, repeat customers across channels, multi-language support, spam management. **Not required for core, but sharing because they may be valuable as you scale to other service business clients.**

Adopt what makes sense, ignore what doesn't.

```sql
-- Customers: deduplicate across channels (same phone = same person)
-- WHY: A customer calls Monday, chats Wednesday, texts Friday.
-- Without this, that's 3 unlinked leads. With this, it's 1 customer.
-- ADOPT IF: Your clients handle repeat/multi-channel contacts.
-- IGNORE IF: Most interactions are one-and-done (e.g., info hotline).
CREATE TABLE customers (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT,
  phone         TEXT UNIQUE,
  email         TEXT,
  address       TEXT,
  language      TEXT DEFAULT 'en', -- conversation language (en, es, zh, etc.)
  blocked       INTEGER NOT NULL DEFAULT 0,  -- 1 = spam/blocked caller
  block_reason  TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_customers_phone ON customers(phone);
CREATE INDEX idx_customers_email ON customers(email);

-- When using customers table, add FK to leads:
-- ALTER TABLE leads ADD COLUMN customer_id INTEGER REFERENCES customers(id);

-- SMS threads: persist SMS conversations
-- WHY: Twilio stores SMS history, but querying it is slow and costs API calls.
-- Local persistence = instant lookups, offline access, full history.
-- ADOPT IF: Your deployment uses SMS (Twilio).
-- IGNORE IF: Phone-only or webchat-only.
CREATE TABLE sms_threads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER REFERENCES customers(id),
  phone         TEXT NOT NULL,
  direction     TEXT NOT NULL,     -- 'inbound', 'outbound'
  message       TEXT NOT NULL,
  twilio_sid    TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_sms_phone ON sms_threads(phone);
CREATE INDEX idx_sms_created ON sms_threads(created_at);

-- Follow-ups: scheduled callbacks and reminders
-- WHY: "Call back Tuesday" or "send quote after site visit" — needs to live
-- in the system, not in someone's head.
-- ADOPT IF: Your clients do appointments, site visits, or follow-up calls.
-- IGNORE IF: No outbound follow-up workflow.
CREATE TABLE follow_ups (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id   INTEGER REFERENCES customers(id),
  lead_id       INTEGER REFERENCES leads(id),
  due_at        TEXT NOT NULL,     -- when to follow up (ISO 8601)
  action        TEXT NOT NULL,     -- 'call_back', 'send_quote', 'site_visit', etc.
  notes         TEXT,
  completed     INTEGER NOT NULL DEFAULT 0,
  completed_at  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_followups_due ON follow_ups(due_at);
CREATE INDEX idx_followups_pending ON follow_ups(completed, due_at);
```

---

## Migration Path

### Phase 1: Add SQLite alongside JSON (non-breaking)
1. Add `better-sqlite3` dependency
2. Create `src/database.js` — DB init, schema creation, migration runner
3. Dual-write: keep JSON writes, ADD SQLite writes
4. New reads can go to SQLite, fallback to JSON
5. One-time migration script: import existing JSON files → SQLite

### Phase 2: SQLite-primary
1. Switch all reads to SQLite
2. Remove JSON writes
3. Delete JSON file management code
4. Update admin API endpoints to query SQLite directly

### Phase 3: Unlock new features
1. Lead status tracking (new → contacted → quoted → won/lost)
2. Lead deduplication via `customers` table *(service business extension)*
3. Session persistence across restarts
4. Queryable call history (date ranges, by phone, by channel)
5. Soft delete (already in schema) instead of actual file deletion
6. SMS thread persistence *(service business extension)*
7. Spam/blocked caller list *(service business extension)*
8. Prompt version history — audit trail for every system prompt change
9. Scheduled follow-ups *(service business extension)*
10. Foundation for post-call agent results

---

## Files Affected

### Core
| File | Changes |
|---|---|
| `package.json` | Add `better-sqlite3` |
| `src/database.js` | **NEW** — DB singleton, schema, migrations |
| `src/call-summary.js` | Replace `fs` read/write with DB queries |
| `src/lead-tracker.js` | Replace `leads.json` with DB queries |
| `src/server.js` | Add session persistence, update API routes |
| `src/admin-auth.js` | Optional: move admin users to DB |

### Service Business Extensions (optional)
| File | Changes |
|---|---|
| `src/customer-manager.js` | **NEW** — Customer dedup across channels |
| `src/sms-store.js` | **NEW** — SMS thread persistence |
| `src/follow-up-manager.js` | **NEW** — Scheduled follow-ups |
| `src/prompt-history.js` | **NEW** — Prompt version tracking |

---

## API Changes

Existing endpoints stay the same, but gain query params:

```
GET /api/calls?page=1&limit=20&since=2026-03-01&channel=phone
GET /api/leads?status=new&source=webchat
GET /api/sessions?active=true
DELETE /api/calls/:id  →  soft delete (sets deleted_at)
```

---

## `src/database.js` — Skeleton

```javascript
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'receptionist.db');

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new Database(DB_PATH);

// Performance pragmas
db.pragma('journal_mode = WAL');     // Better concurrent read/write
db.pragma('busy_timeout = 5000');    // Wait up to 5s if locked
db.pragma('foreign_keys = ON');

// Schema initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS calls ( ... );
  CREATE TABLE IF NOT EXISTS leads ( ... );
  CREATE TABLE IF NOT EXISTS sessions ( ... );
  CREATE TABLE IF NOT EXISTS prompt_versions ( ... );
  CREATE TABLE IF NOT EXISTS agent_actions ( ... );
`);

// Prepared statements (reusable, fast)
const stmts = {
  insertCall: db.prepare(`
    INSERT INTO calls (id, caller_phone, twilio_number, channel, start_time, end_time, duration_sec, summary, transcript)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  
  getCallsPaginated: db.prepare(`
    SELECT * FROM calls WHERE deleted_at IS NULL
    ORDER BY start_time DESC LIMIT ? OFFSET ?
  `),
  
  upsertLead: db.prepare(`
    INSERT INTO leads (session_id, name, phone, email, source, message_count)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(session_id) DO UPDATE SET
      name = COALESCE(excluded.name, leads.name),
      phone = COALESCE(excluded.phone, leads.phone),
      email = COALESCE(excluded.email, leads.email),
      message_count = excluded.message_count,
      updated_at = datetime('now')
  `),
  
  getUnnotifiedLeads: db.prepare(`
    SELECT * FROM leads WHERE notified = 0 ORDER BY created_at DESC
  `),
  
  markLeadsNotified: db.prepare(`
    UPDATE leads SET notified = 1 WHERE session_id = ?
  `)
};

module.exports = { db, stmts };
```

---

## Backup Strategy

```bash
# Cron job — daily backup (SQLite supports hot copy with WAL mode)
cp /opt/receptionist/data/receptionist.db /opt/receptionist/backups/receptionist-$(date +%Y%m%d).db
```

Or use SQLite's built-in backup API:
```javascript
db.backup(`/opt/receptionist/backups/receptionist-${Date.now()}.db`);
```

---

## Open Questions for Guy

1. **`better-sqlite3` vs `sql.js`?** — `better-sqlite3` needs native compilation (fine on Linux/Mac, slightly annoying on some deploys). `sql.js` is pure WASM but slower. Recommendation: `better-sqlite3`.

2. **Schema for post-call agents?** — I've included an `agent_actions` table stub. Does this match what you're building in `feature/post-call-agents`?

3. **Migration script scope?** — Should we migrate ALL historical call summaries, or just start fresh from the switch date?

4. **Data directory?** — Proposing `data/receptionist.db` (gitignored). Alternative: `/var/lib/receptionist/receptionist.db` for production.

5. **Service business extensions?** — We're running the full set (customers, SMS, follow-ups, blocked callers) at ChargeWizards. They're separated cleanly from core. Worth including as optional modules in the main repo, or keep them in our deployment only?

---

*This is a design doc, not a PR. Review, poke holes, then we build it.*
