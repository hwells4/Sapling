# Follow-up Question Bank

Questions to ask based on what was skipped during onboarding.

## If LinkedIn Skipped

### Question: Role
```yaml
question: "What's your current role or title?"
header: "Role"
options:
  - label: "I'll tell you"
    description: "Enter your role/title"
  - label: "Skip"
    description: "Move to next question"
```
Maps to: about-me.md → Identity.Role

### Question: Background
```yaml
question: "In 1-2 sentences, what's your professional background?"
header: "Background"
options:
  - label: "I'll describe it"
    description: "Brief professional summary"
  - label: "Skip"
    description: "Move to next question"
```
Maps to: about-me.md → Background

## If Company Skipped

### Question: Business Description
```yaml
question: "What does your business or company do?"
header: "Business"
options:
  - label: "I'll describe it"
    description: "Brief description of your business"
  - label: "Skip"
    description: "Move to next question"
```
Maps to: business.md → Overview

### Question: Ideal Client
```yaml
question: "Who are your ideal clients or customers?"
header: "Clients"
options:
  - label: "I'll describe them"
    description: "Your target audience"
  - label: "Skip"
    description: "Move to next question"
```
Maps to: business.md → Ideal Client

## Always Ask

### Question: Personal OS Purpose
```yaml
question: "What are you hoping to use Personal OS for?"
header: "Goals"
options:
  - label: "Content creation"
    description: "LinkedIn posts, newsletters, etc."
  - label: "Client work"
    description: "Updates, emails, project management"
  - label: "Personal productivity"
    description: "Task management, notes, planning"
  - label: "All of the above"
    description: "Everything!"
```
Maps to: preferences.md → Pain Points, about-me.md → Current Focus

### Question: Daily Tools
```yaml
question: "Any tools you use daily that I should know about?"
header: "Tools"
options:
  - label: "I'll list them"
    description: "CRM, calendar, project management, etc."
  - label: "Skip"
    description: "We can configure integrations later"
```
Maps to: preferences.md → Tools I Use

## Optional Deep Dives

### Question: Communication Style (if no writing samples)
```yaml
question: "How would you describe your communication style?"
header: "Style"
options:
  - label: "Direct & concise"
    description: "Get to the point quickly"
  - label: "Detailed & thorough"
    description: "Provide full context"
  - label: "Casual & conversational"
    description: "Like talking to a friend"
  - label: "Formal & professional"
    description: "Traditional business tone"
```
Maps to: voice-and-style.md → Tone

### Question: Pain Points
```yaml
question: "What's your biggest productivity pain point right now?"
header: "Pain Point"
options:
  - label: "I'll describe it"
    description: "What's frustrating you"
  - label: "Skip"
    description: "Move to next question"
```
Maps to: preferences.md → Pain Points
