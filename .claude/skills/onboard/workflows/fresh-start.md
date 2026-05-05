# Fresh Start Onboarding Workflow

<objective>
Complete onboarding flow for new users. Collects context through interactive questions, stores creature selection, and populates context files. Uses AskUserQuestion throughout for a smooth, clickable experience.
</objective>

<workflow>
## Phase 1: Welcome & Introduction

### Step 1: Get Their Name
Start by learning who they are. Use AskUserQuestion:

```yaml
question: "First things first—what should I call you?"
header: "Your name"
multiSelect: false
options:
  - label: "Use my system username"
    description: "I'll call you by your computer's username"
  - label: "Something else"
    description: "Type your preferred name (click Other)"
```

**On selection:**
- If "Use my system username": Extract from environment, store as `name`
- If "Something else" or "Other": Use the provided text as `name`

### Step 2: Welcome & Set Expectations
Now that you have their name, give a warm welcome:

```
Hey {name}! Welcome to Sapling OS.

This setup takes about 3-5 minutes. I'm going to ask you a few questions
to tailor this system to your preferences and get you started on the right foot.

Here's what we'll cover:
  1. Pick your companion creature (the fun part!)
  2. Learn a bit about your work
  3. Set up optional features and local hooks
  4. Generate your personal context files

Everything except the creature is skippable—you can always add more later.
Ready? Let's go!
```

### Step 3: Creature Selection (Required)
Use AskUserQuestion:

```yaml
question: "Choose your elemental egg. It will hatch into your companion creature after your first calibration."
header: "Creature"
multiSelect: false
options:
  - label: "🔥 Fire Egg"
    description: "Hatches into Ember. Burns through blockers, iterates fast."
  - label: "💧 Water Egg"
    description: "Hatches into Drift. Flows around obstacles, adaptable."
  - label: "🌿 Nature Egg"
    description: "Hatches into Bloom. Grows organically, cultivates knowledge."
```

**On selection:**
1. Map selection to creature name (ember/drift/bloom)
2. Update `.claude/stats.yaml`:
   ```yaml
   creature: ember  # or drift/bloom
   creature_selected_at: 2025-01-08
   ```
3. Show creature egg art from `.claude/creatures/{name}/egg.txt`
4. Brief message: "Great choice! {Creature} will grow alongside you."

## Phase 2: Understanding Your Work

### Step 4: Business Context
Use AskUserQuestion:

```yaml
question: "Do you run a business or have a company website I can learn from?"
header: "Business"
multiSelect: false
options:
  - label: "Yes, I have a website"
    description: "I'll pull context from your site (enter URL via Other)"
  - label: "Yes, but no website"
    description: "I'll ask a few questions instead"
  - label: "No, this is personal use"
    description: "Skip business context"
```

**If "Yes, I have a website":**
1. They should enter the URL via the "Other" option
2. If they selected this but didn't enter a URL, prompt: "What's your website URL?"
3. WebFetch the website (try /about page if exists)
4. Extract: company name, description, industry indicators
5. Store for business.md generation
6. On failure: "Couldn't load that—no worries, I'll ask a couple questions instead."

**If "Yes, but no website":**
Ask follow-up via AskUserQuestion:
```yaml
question: "What does your business do? (One sentence is fine)"
header: "Business"
multiSelect: false
options:
  - label: "Consulting/Services"
    description: "I help clients with specific expertise"
  - label: "Product/SaaS"
    description: "I build and sell a product"
  - label: "Agency/Creative"
    description: "I do creative or marketing work"
  - label: "Other"
    description: "Describe via Other option"
```
Store response for business.md.

**If "No, this is personal use":** Mark `business_skipped: true`, continue

### Step 5: Your Role
Use AskUserQuestion:

```yaml
question: "What best describes your role?"
header: "Role"
multiSelect: false
options:
  - label: "Founder/CEO"
    description: "I run the show"
  - label: "Engineer/Developer"
    description: "I build things"
  - label: "Designer/Creative"
    description: "I design and create"
  - label: "Other"
    description: "Something else (describe via Other)"
```

Store for about-me.md.

### Step 6: Primary Use Case
Use AskUserQuestion:

```yaml
question: "What are you most hoping Sapling OS helps you with?"
header: "Use case"
multiSelect: false
options:
  - label: "Task & project management"
    description: "Stay organized, track work"
  - label: "Writing & content"
    description: "Blog posts, docs, communication"
  - label: "Client work"
    description: "Manage clients, calls, deliverables"
  - label: "Personal productivity"
    description: "Notes, ideas, life organization"
```

Store for preferences.md.

### Step 7: Writing Samples (Optional)
Use AskUserQuestion:

```yaml
question: "Got any writing samples I can analyze? Blog posts, articles, tweets—helps me learn your voice."
header: "Writing"
multiSelect: false
options:
  - label: "Yes, I have some URLs"
    description: "Enter 1-3 URLs via Other"
  - label: "Skip for now"
    description: "My voice can be learned over time"
```

**If URLs provided:**
1. WebFetch each URL (comma-separated)
2. Analyze: sentence length, formality, common phrases
3. Store for voice-and-style.md
4. On failure: Note partial success, continue

**If "Skip":** Mark `writing_skipped: true`, continue

## Phase 3: Optional Features

### Step 8: Image Generation Setup
Use AskUserQuestion:

```yaml
question: "Want to set up image generation? Great for creating slide decks, LinkedIn carousels, and graphics."
header: "Images"
multiSelect: false
options:
  - label: "Yes, set it up (~2 min)"
    description: "I'll walk you through getting a free Gemini API key"
  - label: "Skip for now"
    description: "I can set this up anytime"
```

**If "Yes, set it up":**

1. Display setup instructions:
   ```
   To generate images, you need a free Gemini API key from Google.

   Steps:
   1. Go to: https://aistudio.google.com/apikey
   2. Sign in with your Google account
   3. Click "Create API Key"
   4. Copy the key (starts with "AIza...")
   ```

2. Use AskUserQuestion:
   ```yaml
   question: "Paste your Gemini API key (stays local, never committed to git)"
   header: "API Key"
   multiSelect: false
   options:
     - label: "I have my key"
       description: "Paste it via Other"
     - label: "Skip for now"
       description: "I'll set this up later"
   ```

3. **On key provided** (via "Other"):
   - Validate key format (should start with "AIza" and be ~39 chars)
   - Create `.env.local`:
     ```
     # Gemini API key for image generation (nano-banana)
     # Get yours at: https://aistudio.google.com/apikey
     GEMINI_API_KEY=<their-key>
     ```
   - Create `.claude/skills/generate-visuals/.env` with same content
   - Confirm: "Image generation is ready!"

**If "Skip":** Mark `image_gen_skipped: true`, continue

### Step 8.5: Local Hook Setup
Explain:

```
Sapling hooks are core to the system. This step tunes the local hook profile
so optional behavior matches the tools available on this machine.
```

Use AskUserQuestion:

```yaml
question: "Which local hook profile should I install?"
header: "Hooks"
multiSelect: false
options:
  - label: "Recommended"
    description: "Daily note, schema/prose checks, and skill routing when supported"
  - label: "Minimal"
    description: "Safest setup: daily note session hook only"
  - label: "Full automation"
    description: "Adds git auto-commit/push hooks; only choose this if you want that"
```

Run the selected command:

```bash
python3 .claude/hooks/setup-local-hooks.py --profile recommended
python3 .claude/hooks/setup-local-hooks.py --profile minimal
python3 .claude/hooks/setup-local-hooks.py --profile full
```

Confirm that `.claude/settings.local.json` was written. If the script reports missing optional tools, continue; it disables unsupported hooks automatically.

## Phase 4: Generate Context Files

### Step 9: Generate Files
Create files in `brain/context/` using templates from `templates/`:

**about-me.md:**
- Name from Step 1
- Role from Step 5
- Any extracted/provided background
- TODOs for missing sections

**business.md:**
- Company data from website (if fetched)
- Business type from follow-ups
- TODOs for missing sections

**voice-and-style.md:**
- Writing sample analysis (if provided)
- Defaults + TODOs if skipped

**preferences.md:**
- Primary use case from Step 6
- Tool preferences (defaults)
- TODOs for expansion

## Phase 5: Explain & Complete

### Step 10: Explain How It Works

```
How Sapling OS Works:

1. **Your Context Files** (brain/context/)
   These files help me understand you. I reference them when helping
   with tasks, writing in your voice, or making recommendations.

2. **Daily Notes** (/today)
   Start with /today to create or open the current daily note.
   This becomes the memory that makes me more useful over time.

3. **Tasks** (beads)
   Beads tracks active work across sessions. Run bd ready to see what
   can be worked next, and bd close when work is complete.

4. **Advanced Learning** (/task)
   If you want Sapling to learn from choices over time, /task can capture
   meaningful decisions as part of larger tracked work.

The more you use it, the better it gets.
```

### Step 11: Show Welcome Banner
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎉 WELCOME TO SAPLING OS, {NAME}!                          ║
║                                                               ║
║   Your creature: {emoji} {CREATURE_NAME} (Egg)                ║
║   Context files: {count}/4 created                            ║
║                                                               ║
║   Complete tasks with /task to hatch your egg!                ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Step 12: GitHub CLI Setup (Optional)
Check if GitHub CLI is available and authenticated:

```bash
# Check if gh is installed
which gh >/dev/null 2>&1
```

**If `gh` is NOT installed:** Skip to Step 13.

**If `gh` is installed, check auth status:**
```bash
gh auth status >/dev/null 2>&1
```

**If NOT authenticated:**
Use AskUserQuestion:

```yaml
question: "Want to connect your GitHub account? Enables repo management, PR workflows, and more."
header: "GitHub"
multiSelect: false
options:
  - label: "Yes, sign in to GitHub"
    description: "Opens browser to authenticate (~30 seconds)"
  - label: "Skip for now"
    description: "I can set this up later"
```

**If "Yes, sign in to GitHub":**
```bash
gh auth login --web
```
- Wait for auth to complete
- On success: "GitHub connected! You now have access to GitHub features."
- On failure: "No worries, you can run `gh auth login` anytime."

**If already authenticated or "Skip":** Continue to Step 13.

### Step 13: Support the Project (Optional)
Use AskUserQuestion:

```yaml
question: "Would you like to ⭐ star the Sapling repository on GitHub to support the project?"
header: "Support"
multiSelect: false
options:
  - label: "Yes, star that repo!"
    description: "Takes 2 seconds, helps the project grow"
  - label: "No thanks"
    description: "No worries, you're all set!"
```

**If "Yes, star that repo!":**
1. Check if `gh` is available AND authenticated:
   ```bash
   gh auth status >/dev/null 2>&1
   ```

2. **If authenticated:**
   ```bash
   gh api -X PUT /user/starred/anthropics/sapling-os
   ```
   - On success: "Done! Thanks for the support! ⭐"
   - On failure: Provide manual link as fallback

3. **If NOT authenticated or `gh` unavailable:**
   ```
   No worries! You can star it manually here:
   https://github.com/anthropics/sapling-os

   Just click the ⭐ Star button in the top right!
   ```

**If "No thanks":**
```
No problem at all! You're completely set up and ready to go.
```

### Step 14: Commit with /commit

Use the `/commit` skill to save all onboarding files:

**Files to stage:**
- `brain/context/*.md` - Generated context files
- `.claude/stats.yaml` - Creature selection and timestamps

**Do NOT stage:**
- `.env.local` - Contains API keys
- `.claude/skills/generate-visuals/.env` - Contains API keys
- `.claude/onboard-state.json` - Temporary state file

Invoke `/commit` - it will create an appropriate commit message.

### Step 15: Clean Up & Next Steps
- Delete `.claude/onboard-state.json` if exists
- Mark onboarding complete in stats.yaml: `onboarded_at: {date}`

```
Ready to get started? Here's what to do next:

  /today     - Create your first daily note
  bd ready   - See available tracked work
  /task      - Start a larger tracked task

Your egg is waiting. Let's get to work!
```
</workflow>

<state_persistence>
Save state after each step to `.claude/onboard-state.json`:

```json
{
  "started_at": "2025-01-08T10:00:00Z",
  "name": "Harrison",
  "creature": "ember",
  "completed_steps": ["name", "welcome", "creature", "business", "role", "usecase", "writing", "image_gen", "github_auth", "star_repo"],
  "collected_data": {
    "company_url": "https://example.com",
    "company_extracted": {...},
    "business_type": "consulting",
    "role": "founder",
    "use_case": "client_work",
    "writing_skipped": true,
    "image_gen_configured": true
  },
  "current_step": "generate_files"
}
```

On resume, load state and skip to `current_step`.
</state_persistence>

<validation>
**Company URL:**
- Must be valid URL format
- Attempt to fetch /about page first

**Writing sample URLs:**
- Must be valid URL format
- Accept 1-3 URLs comma-separated

**Gemini API Key:**
- Should start with "AIza"
- Length approximately 39 characters
</validation>
