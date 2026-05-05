# Scripts Pattern

Scripts are executable code Claude runs as-is rather than regenerating each time.

## When to Use Scripts

Use scripts when:
- Same code runs across multiple invocations
- Operations are error-prone when rewritten
- Consistency matters more than flexibility

Common types:
- **Deployment** - Deploy, publish, release
- **Setup** - Initialize, install, configure
- **API calls** - Authenticated requests, webhooks
- **Data processing** - Transforms, migrations

## Directory Structure

```
skill-name/
├── SKILL.md
├── workflows/
├── references/
├── templates/
└── scripts/
    ├── deploy.sh
    ├── setup.py
    └── fetch-data.ts
```

## Script Requirements

1. Clear purpose comment at top
2. Input validation
3. Error handling
4. Idempotent where possible
5. Clear output/feedback

## Example

```bash
#!/bin/bash
# deploy.sh - Deploy project to Vercel
# Usage: ./deploy.sh [environment]

set -euo pipefail

ENVIRONMENT="${1:-preview}"

if [[ "$ENVIRONMENT" != "preview" && "$ENVIRONMENT" != "production" ]]; then
    echo "Error: Environment must be 'preview' or 'production'"
    exit 1
fi

echo "Deploying to $ENVIRONMENT..."

if [[ "$ENVIRONMENT" == "production" ]]; then
    vercel --prod
else
    vercel
fi

echo "Deployment complete."
```

## Workflow Integration

```xml
<process>
## Step 5: Deploy

1. Ensure all tests pass
2. Run `scripts/deploy.sh production`
3. Verify deployment succeeded
</process>
```

Workflow says WHEN. Script handles HOW.

## The Loader + Knowledge Pattern

For scripts that interact with external formats (file exports, API responses, tool output), keep the script dumb and put the intelligence in a knowledge file Claude can read and update.

**Boundary rule:** If this knowledge might change, it belongs in a `.md` file Claude can read/write — not in the script.

### Structure

```
scripts/discover.py         ← Pure I/O: reads file, outputs structure as JSON
references/schema.md        ← Living knowledge: what the structure means
```

### Script Responsibilities (narrow)
- Read input (file, API, stdin)
- Report what it finds (structure, headers, sample values)
- Output structured JSON to stdout
- NO interpretation, NO business logic, NO expected values

### Knowledge File Responsibilities (broad)
- What the expected structure looks like
- Known variants and renames
- Mapping rules for handling changes
- Change history with dates
- Escalation criteria (when to stop and ask user)

### Why This Works

Scripts break when external formats change. Knowledge files adapt because Claude reads them, compares to reality, updates them, and proceeds. Each run makes the next run more resilient.

See `references/skill-evolution.md` for the full self-healing flow and living knowledge file patterns.

## Best Practices

**Do:**
- Make scripts idempotent
- Include usage comments
- Validate inputs
- Use `set -euo pipefail` in bash
- Add `--dry-run` for destructive ops
- Keep scripts as pure I/O — no domain logic
- Pair fragile scripts with a living knowledge file

**Don't:**
- Hardcode secrets (use env vars)
- Create scripts for one-off operations
- Skip error handling
- Forget `chmod +x`
- Encode expected values in scripts (put them in knowledge files)
- Let scripts make decisions Claude should make
