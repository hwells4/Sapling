# Fresh Start Onboarding Workflow

<objective>
Complete onboarding flow for new users. Collects context through sequential questions, stores creature selection, and populates context files.
</objective>

<workflow>
## Phase 1: Welcome & Creature Selection

### Step 1: Welcome Message
Display welcome and set expectations:

```
Welcome to Personal OS!

This setup takes about 5 minutes. I'll ask a few questions to learn about you and your work. Every question is skippable except one: choosing your companion creature.

Your creature starts as an egg and evolves as your OS learns. Ready?
```

### Step 2: Creature Selection (Required)
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
   creature_selected_at: 2025-12-30
   ```
3. Show creature egg art from `.claude/creatures/{name}/egg.txt`
4. Continue to Phase 2

## Phase 2: Data Collection

### Step 3: LinkedIn URL
Use AskUserQuestion:

```yaml
question: "What's your LinkedIn profile URL? This helps me understand your background and experience."
header: "LinkedIn"
multiSelect: false
options:
  - label: "I'll provide it"
    description: "Enter your LinkedIn URL (e.g., linkedin.com/in/yourname)"
  - label: "Skip"
    description: "I'll ask follow-up questions instead"
```

**If "I'll provide it":**
1. Ask for URL in follow-up (free text via "Other")
2. Validate URL contains `linkedin.com/in/`
3. WebFetch the profile
4. Extract: name, headline, summary, current company, top skills
5. Store extracted data for about-me.md generation
6. On failure: Offer retry/skip/manual entry

**If "Skip":** Mark `linkedin_skipped: true`, continue

### Step 4: Company Website
Use AskUserQuestion:

```yaml
question: "Do you have a company or business website?"
header: "Company"
multiSelect: false
options:
  - label: "Yes, I'll provide it"
    description: "Enter your company website URL"
  - label: "Skip"
    description: "I'll ask about your business instead"
```

**If provided:**
1. Ask for URL
2. WebFetch the website (try /about page if exists)
3. Extract: company name, description, industry indicators
4. Store for business.md generation
5. On failure: Offer retry/skip/manual

**If "Skip":** Mark `company_skipped: true`, continue

### Step 5: Writing Samples
Use AskUserQuestion:

```yaml
question: "Do you have any writing samples I can analyze? (Blog posts, LinkedIn articles, etc.)"
header: "Writing"
multiSelect: false
options:
  - label: "Yes, I have URLs"
    description: "Provide 1-3 URLs to your writing"
  - label: "Skip"
    description: "My voice/style can be learned over time"
```

**If provided:**
1. Ask for URLs (comma-separated)
2. WebFetch each URL
3. Analyze: sentence length, formality, common phrases, structure
4. Store for voice-and-style.md generation
5. On failure: Note partial success, continue

**If "Skip":** Mark `writing_skipped: true`, continue

## Phase 3: Follow-up Questions

Ask 5 questions to fill gaps. Skip questions where we already have data.

### Question Selection Logic
Load `references/follow-up-questions.md` for the question bank.

**If LinkedIn skipped, ask:**
- "What's your current role/title?"
- "What's your professional background in 1-2 sentences?"

**If company skipped, ask:**
- "What does your business/company do?"
- "Who are your ideal clients/customers?"

**Always ask:**
- "What are you hoping to use Personal OS for?"
- "Any tools you use daily that I should know about? (CRM, calendar, etc.)"

For each question, use AskUserQuestion with "Skip" as an option.

## Phase 4: Image Generation Setup (Optional)

### Step 6: Nano-Banana Setup
Use AskUserQuestion:

```yaml
question: "Would you like to set up image generation? This enables creating PDFs, slide decks, LinkedIn carousels, and professional graphics."
header: "Images"
multiSelect: false
options:
  - label: "Yes, set it up"
    description: "I'll walk you through getting a free Gemini API key (~2 min)"
  - label: "Skip for now"
    description: "I can set this up later"
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

2. Use AskUserQuestion to collect the key:
   ```yaml
   question: "Paste your Gemini API key here (it stays local in .env.local, never committed to git)"
   header: "API Key"
   multiSelect: false
   options:
     - label: "I have my key ready"
       description: "Enter via 'Other' option"
     - label: "Skip for now"
       description: "I'll set this up later"
   ```

3. **On key provided** (via "Other" free text):
   - Validate key format (should start with "AIza" and be ~39 chars)
   - Create `.env.local` with:
     ```
     # Gemini API key for image generation (nano-banana)
     # Get yours at: https://aistudio.google.com/apikey
     GEMINI_API_KEY=<their-key>
     ```
   - Also create/update `.claude/skills/generate-visuals/.env`:
     ```
     GEMINI_API_KEY=<their-key>
     ```
   - Confirm: "Image generation is ready! Try `/generate-visuals` anytime."

4. **On skip:** Mark `image_gen_skipped: true`, continue

**If "Skip for now":** Mark `image_gen_skipped: true`, continue

## Phase 5: Context File Generation

### Step 7: Generate about-me.md
Load template from `templates/about-me.md`
Fill with:
- LinkedIn data (if collected)
- Follow-up answers (if provided)
- TODOs for missing sections

### Generate business.md
Load template from `templates/business.md`
Fill with:
- Company website data (if collected)
- Follow-up answers (if provided)
- TODOs for missing sections

### Generate voice-and-style.md
Load template from `templates/voice-and-style.md`
Fill with:
- Writing sample analysis (if collected)
- Defaults + TODOs if skipped

### Generate preferences.md
Load template from `templates/preferences.md`
Fill with:
- Tool mentions from follow-ups
- Defaults + TODOs

## Phase 6: Explain & Complete

### Step 8: Explain How It Works

Before showing the welcome banner, explain the system:

```
How Sapling OS Works:

1. **Your Context Files** (brain/context/)
   These files help me understand you better. I'll reference them when helping
   with tasks, writing in your voice, or making recommendations.

2. **Decision Tracing** (/task)
   When you start work with /task, I track the meaningful decisions you make.
   Not what you did, but *why* you chose one approach over another.

3. **Calibration** (/calibrate)
   This is the magic. Run /calibrate periodically and I'll:
   - Review your decision traces
   - Identify patterns in your preferences
   - Propose updates to my skills and behaviors
   - Tailor myself to work the way YOU work

   Your creature evolves with each calibration. After 10 decision traces,
   your egg hatches into your companion!

4. **Daily Notes** (/today)
   Start each day with /today to capture tasks, notes, and context.
   This becomes the memory that makes me more useful over time.

The more you use the system, the better it gets at anticipating your needs.
```

### Step 9: Show Welcome Banner
```
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🎉 PERSONAL OS INITIALIZED                                  ║
║                                                               ║
║   Your creature: {emoji} {CREATURE_NAME} (Egg)                ║
║   Context files: {count}/4 populated                          ║
║                                                               ║
║   Complete a few tasks and run /calibrate to hatch your egg!  ║
║                                                               ║
║   Next step: /today to create your first daily note           ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```

### Step 10: Commit with /commit

Use the `/commit` skill to save all onboarding files:

**Files to stage:**
- `brain/context/*.md` - Generated context files
- `.claude/stats.yaml` - Creature selection and timestamps
- `.claude/creatures/` - Creature artwork (if not already tracked)

**Do NOT stage:**
- `.env.local` - Contains API keys
- `.claude/skills/generate-visuals/.env` - Contains API keys
- `.claude/onboard-state.json` - Temporary state file

Invoke `/commit` - it will create an appropriate commit message.

### Step 11: Clean Up
- Delete `.claude/onboard-state.json` if exists
- Mark onboarding complete in stats.yaml: `onboarded_at: {date}`

### Step 12: Suggest Next Steps

```
Ready to get started? Here's what to do next:

  /today     - Create your first daily note
  /task      - Start a task (decisions get traced!)
  /calibrate - Run after 10+ traces to hatch your egg

Your egg is waiting. Let's get to work!
```
</workflow>

<state_persistence>
Save state after each step to `.claude/onboard-state.json`:

```json
{
  "started_at": "2025-12-30T10:00:00Z",
  "creature": "ember",
  "completed_steps": ["welcome", "creature", "linkedin", "company", "writing", "followup", "image_gen"],
  "collected_data": {
    "linkedin_url": "...",
    "linkedin_extracted": {...},
    "company_url": null,
    "company_skipped": true,
    "writing_skipped": true,
    "image_gen_configured": true
  },
  "current_step": "generate_files"
}
```

On resume, load state and skip to `current_step`.
</state_persistence>

<validation>
**LinkedIn URL:**
- Must contain `linkedin.com/in/` or `linkedin.com/company/`
- Example shown: `https://linkedin.com/in/yourname`

**Company URL:**
- Must be valid URL format
- Attempt to fetch /about page first

**Writing sample URLs:**
- Must be valid URL format
- Accept 1-3 URLs comma-separated
</validation>
