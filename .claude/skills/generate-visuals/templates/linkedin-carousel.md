# LinkedIn Carousel Style Template

Based on Joe M-C (@joemc.io) carousel design system.

## Core Design Specifications

### Canvas
- **Dimensions**: 1080×1350px (4:5 portrait)
- **Background**: Off-white paper texture (#F9F9F7 to #FAFAF8)
- **Margins**: 80px safe zone on all sides

### Typography

| Element | Style |
|---------|-------|
| **Headline** | Bold serif display font, black (#000000), 48-64px |
| **Subhead** | Medium weight, black, 28-36px |
| **Body text** | Clean sans-serif, dark gray (#333333), 24px |
| **CTA/Caption** | Italic, lighter weight, 20px |
| **Slide number** | Sans-serif, white on teal circle, 16px |

### Color Palette

```
Primary Text:     #000000 (black)
Background:       #F9F9F7 (off-white)
Accent (teal):    #2DD4BF (key phrases, highlights)
Highlight:        #FEF08A (yellow marker on metrics)
Emphasis:         #EF4444 (red underline)
Secondary text:   #6B7280 (gray for handles, captions)
```

### Visual Elements

- **Hand-drawn arrows**: Curved, imperfect lines pointing to next action
- **Highlighter effect**: Yellow (#FEF08A) behind key metrics/numbers
- **Underlines**: Red (#EF4444) wavy or straight under emphasis words
- **Teal accent**: Applied to 2-4 words per slide, not entire sentences
- **Headshot**: Circular, 60-80px, positioned bottom-left or top-left

### Branding Block
```
[Circular headshot] Name Here ✓
                    @handle
```

## Slide Templates

### Cover Slide (Slide 1)

**Purpose**: Hook the reader, create curiosity

**Layout**:
```
┌─────────────────────────┐
│                         │
│   I [verb] [outcome]    │  ← Bold headline
│   [contrarian hook]...  │
│                         │
│   Here's the X-step     │  ← Subhead with teal accent
│   method I used...      │
│                         │
│         ↓               │  ← Hand-drawn arrow
│   ○ Name                │  ← Branding block
│     @handle             │
└─────────────────────────┘
```

**Prompt Template**:
```
Portrait 4:5 LinkedIn carousel cover. Off-white paper texture background (#F9F9F7).

Top half: Bold black serif headline in two lines:
"[LINE 1 - contrarian statement or result]"
"[LINE 2 - continues the hook]..."

Middle: Subhead text "Here's the [X]-step method I used..."
with "[X]-step method" in teal (#2DD4BF).

Below subhead: Simple hand-drawn curved arrow pointing downward, black ink style.

Bottom left corner: Small circular headshot placeholder (60px),
next to "Harrison Wells" in bold and "@harrisonwells" in gray below.

Style: Clean, minimal, designer aesthetic. Lots of whitespace.
Paper grain texture visible. NOT AI-generated looking.
```

### Story Cover (Variant)

**Purpose**: Personal story hook with photo

**Layout**:
```
┌─────────────────────────┐
│                         │
│   I used to think       │  ← Headline with teal phrase
│   [belief] was the      │
│   goal...               │
│                         │
│   ┌───────────────┐     │
│   │   [PHOTO]     │     │  ← Personal photo
│   └───────────────┘     │
│                         │
│   (Turns out I was      │  ← Italic parenthetical
│   only half right...)   │
│                         │
│   STORY TIME...    ↷    │  ← CTA with arrow
└─────────────────────────┘
```

### Content Slides (Slides 2-7)

**Purpose**: Deliver value, one point per slide

**IMPORTANT**: Step number = badge number (Step 1 shows "1", Step 2 shows "2", etc.)
Cover and CTA slides have NO number badge.

**Layout**:
```
┌─────────────────────────┐
│                      ①  │  ← Number matches step (Step 1 = "1")
│                         │
│   Step 1:               │  ← Small label
│   [Main Point]          │  ← Bold headline
│                         │
│   • Supporting detail   │
│   • Another detail      │
│   • Third point         │
│                         │
│   💡 Key insight here   │  ← Callout (optional)
│                         │
└─────────────────────────┘
```

**Prompt Template**:
```
Portrait 4:5 LinkedIn carousel slide. Off-white paper texture background (#F9F9F7).

Top right: Small blue (#3B82F6) circle with white number "[STEP_NUMBER]" inside.
(Number matches the step - Step 1 shows "1", Step 2 shows "2", etc.)

Upper area: Small gray label "Step [STEP_NUMBER]:"
Below: Bold black serif headline "[MAIN POINT]"

Middle: 2-3 bullet points in clean sans-serif:
• [Point 1]
• [Point 2]
• [Point 3]

Blue highlight on one key term per slide.
Consistent styling with previous slides.
Clean, readable, professional.
```

### CTA Slide (Final)

**Purpose**: Drive action (follow, comment, save)

**Layout**:
```
┌─────────────────────────┐
│                         │
│   Found this helpful?   │  ← Question hook
│                         │
│   ┌─────────────────┐   │
│   │ 👤 Follow for   │   │  ← Action box
│   │ daily [topic]   │   │
│   │ tips            │   │
│   └─────────────────┘   │
│              ↑          │
│         ────┘           │  ← Arrow to action
│                         │
│   ○ Name                │
│     @handle             │
└─────────────────────────┘
```

## Anti-AI Design Principles

To avoid the "AI-generated" look:

1. **Imperfect lines**: "Hand-drawn" arrows, not geometric
2. **Paper texture**: Never pure white (#FFFFFF)
3. **Asymmetry**: Elements slightly off-center
4. **Limited palette**: 3-4 colors max, used consistently
5. **Whitespace**: 40%+ of canvas should be empty
6. **Human elements**: Photos, personal branding
7. **Organic shapes**: Rounded corners, soft edges

## Full Carousel Generation Workflow

```bash
# 1. Generate cover
npx @the-focus-ai/nano-banana "[cover prompt]" --output media/carousels/01-cover.png

# 2. Generate content slides (iterate 2-7)
for i in {2..7}; do
  npx @the-focus-ai/nano-banana "[slide $i prompt]" --output media/carousels/0$i-content.png
done

# 3. Generate CTA slide
npx @the-focus-ai/nano-banana "[cta prompt]" --output media/carousels/08-cta.png

# 4. Review and refine any slides
npx @the-focus-ai/nano-banana "Make headline 20% larger" \
  --file media/carousels/01-cover.png --output media/carousels/01-cover.png

# 5. Combine to PDF
convert media/carousels/*.png media/carousels/carousel-final.pdf
```

## Example Prompts

### "Signed 20 Clients" Style
```
Portrait 4:5 LinkedIn carousel cover. Off-white textured paper background.

Large bold black serif text centered:
"I signed 20+ clients
before I had a
funnel."

Below in slightly smaller text:
"Here's the 3-step method I used..."
with "3-step method" highlighted in teal (#2DD4BF).

Simple hand-drawn arrow curving downward from the text.
Small green dot accent at arrow's origin point.

Bottom left: circular headshot placeholder with
"Joe M-C ✓" in bold black
"@joemc.io" in gray below

Clean, minimal, lots of whitespace. Paper texture visible.
Designer-made aesthetic, not AI-generated.
```
