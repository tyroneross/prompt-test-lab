# Claude Project Memory

## Active Session
- **Current**: Night Development
- **Started**: 2025-10-21
- **Project**: My Project

## Key Project Knowledge

### Critical Information
- **Project Name**: My Project
- **Claude Memory**: v1.11.1
- **Memory Created**: 2025-10-21

### Knowledge Base
#### design-principles (1 items)
- **Calm-Precision-Principle-9**: Functional Integrity: Only make interactive if action exists AND backend connected. Use disabled buttons with 'Coming So...


### Recent Changes
#### Recent Decisions
- **2025-10-21**: Fix API endpoints first

#### Recent Patterns
- **2025-10-21**: API-Endpoint-Mismatch (medium)
- **2025-10-21**: Mock-Data-Without-Indicators (medium)

#### Recent Knowledge Updates
- **2025-10-21**: design-principles/Calm-Precision-Principle-9


### Open Patterns


### Recently Resolved
- **API-Endpoint-Mismatch**: Fixed by updating frontend API client to call /auth/me instead of /auth/profile. Also updated PATCH methods for projects and prompts routes. (2025-10-21)
- **Mock-Data-Without-Indicators**: Added prominent Demo Mode banner to Dashboard with AlertTriangle icon, amber color scheme, and clear messaging per Calm Precision 6.1 guidelines. (2025-10-21)

### Project Conventions
<!-- Discovered during development -->

## Task Management

### Active Tasks
- [ ] **Fix /auth/profile endpoint mismatch to /auth/me** (medium)
- [ ] **Add Demo Mode banner to Dashboard** (high)
- [ ] **Hide non-functional Test buttons** (high)

### In Progress
- No tasks in progress


## Recent Decisions Log

### 2025-10-21: Fix API endpoints first
**Decision**: Fix API endpoints first
**Reasoning**: Profile endpoint mismatch is blocking production. Must fix /auth/profile vs /auth/me before other issues.



## Commands & Workflows

### Claude Memory Commands
```bash
# Session management
claude-memory session start "Session Name"
claude-memory session end ["outcome"]
claude-memory session cleanup

# Task management
claude-memory task add "description" [--priority high|medium|low] [--assignee name]
claude-memory task complete <task-id>
claude-memory task list [status]

# Pattern management
claude-memory pattern add "Pattern" "Description" [--effectiveness 0.8] [--priority high]
claude-memory pattern list [--priority high]
claude-memory pattern search "query"
claude-memory pattern resolve <pattern-id> "solution"

# Decision tracking
claude-memory decision "Choice" "Reasoning" "alternatives"

# Knowledge management
claude-memory knowledge add "key" "value" --category category
claude-memory knowledge get "key" [category]
claude-memory knowledge list [category]

# Export and reporting (v1.10.0)
claude-memory export [file.json] [--types tasks,patterns] [--format json|yaml|csv|markdown]
claude-memory import <file.json> [--mode merge|replace] [--types tasks,patterns]
claude-memory report [--type summary|tasks|patterns|decisions|progress|sprint] [--save]

# Memory utilities
claude-memory stats
claude-memory search "query"
claude-memory handoff [--format markdown|json]
```

## Full Context Files
For complete information without truncation:
- 📚 **Knowledge Base**: `.claude/context/knowledge.md` (1 items)
- 🧩 **All Patterns**: `.claude/context/patterns.md` (2 patterns)
- 🎯 **Decision Log**: `.claude/context/decisions.md` (1 decisions)
- ✅ **Task Details**: `.claude/context/tasks.md` (3 tasks)

## Session Continuation
To resume work, tell Claude:
"Load project memory for My Project and continue development"
