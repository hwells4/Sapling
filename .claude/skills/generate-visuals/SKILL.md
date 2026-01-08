---
name: generate-visuals
description: Generate professional images using Google's Gemini image models via nano-banana CLI. Use when creating LinkedIn carousel covers, infographics, or professional graphics.
---

# Visual Generation

Generate professional images using Google's Gemini image models via the `nano-banana` CLI.

## When to Use

Trigger on requests to:
- Create LinkedIn carousel covers or slides
- Generate infographics or diagrams
- Make professional graphics, icons, or visual assets
- Edit or refine existing images

## Before Generating

**Check `output-history.md`** to see the last 4 outputs. Vary the style:
- Different accent colors (blue → teal → orange → etc.)
- Different layouts (centered → left-aligned → asymmetric)
- Different visual elements (arrows → icons → photos)

After generating, **update output-history.md** with the new entry.

## Prerequisites

API key stored in `.claude/skills/generate-visuals/.env`:
```
GEMINI_API_KEY=your-key-here
```

## Output Location

All generated media goes to the `media/` folder at project root:
- **Images**: `media/images/`
- **Carousels**: `media/carousels/`

## Quick Reference

```bash
# Load API key and generate (always use gemini-3-pro-image-preview)
source ~/.claude/skills/generate-visuals/.env && \
npx @the-focus-ai/nano-banana "detailed prompt" \
  --model gemini-3-pro-image-preview \
  --output media/images/output.png

# Edit an existing image
source ~/.claude/skills/generate-visuals/.env && \
npx @the-focus-ai/nano-banana "edit instruction" \
  --model gemini-3-pro-image-preview \
  --file media/images/input.png \
  --output media/images/output.png
```

**Always use `--model gemini-3-pro-image-preview`** (Nano Banana Pro) for best quality.

## LinkedIn Carousel Workflow

### Dimensions
- **Cover + Slides**: 1080×1350px (4:5 portrait ratio)
- **Output**: Generate as PNG, combine into PDF for upload

### Step 1: Generate Cover Slide

Use the Joe M-C style template (see `templates/linkedin-carousel.md`):

```bash
source ~/.claude/skills/generate-visuals/.env && \
npx @the-focus-ai/nano-banana "
Portrait 4:5 LinkedIn carousel cover slide. Off-white paper texture background.
Bold black serif headline: '[HOOK TEXT HERE]'
Teal (#2DD4BF) highlight on key phrase: '[KEY PHRASE]'
Yellow marker highlight on metric: '[NUMBER/METRIC]'
Hand-drawn curved arrow pointing down.
Small circular headshot placeholder bottom-left with name 'Harrison Wells' and handle '@harrisonwells'.
Clean, minimal, lots of whitespace. Designer aesthetic, NOT AI-looking.
" --model gemini-3-pro-image-preview --output media/carousels/cover.png
```

### Step 2: Generate Content Slides

Each slide follows consistent styling:

```bash
npx @the-focus-ai/nano-banana "
Portrait 4:5 LinkedIn carousel slide. Off-white paper texture background.
Slide number '2' in small teal circle top-right.
Bold black serif headline: '[SLIDE HEADLINE]'
2-3 bullet points in clean sans-serif font.
Teal accent on key terms.
Consistent with previous slide styling.
" --output media/carousels/slide-02.png
```

### Step 3: Generate CTA Slide (Final)

```bash
npx @the-focus-ai/nano-banana "
Portrait 4:5 LinkedIn carousel final slide. Off-white paper texture background.
Bold black serif headline: 'Want more [TOPIC]?'
Call to action: 'Follow for daily tips' in italic.
Hand-drawn arrow pointing to follow button area.
Headshot with name and handle.
Clean, inviting, professional.
" --output media/carousels/slide-final.png
```

### Step 4: Combine to PDF for LinkedIn Upload

LinkedIn carousels are uploaded as **PDF documents**. LinkedIn converts the PDF pages into swipeable slides.

```bash
# Option 1: ImageMagick (if installed)
convert media/carousels/*.png media/carousels/carousel.pdf

# Option 2: macOS built-in (no install needed)
# Open all PNGs in Preview → File → Export as PDF

# Option 3: Python script (reliable)
python3 << 'EOF'
from PIL import Image
import os

carousel_dir = 'media/carousels'
# Get all slide images in order
slides = sorted([f for f in os.listdir(carousel_dir) if f.endswith('.png')])
images = [Image.open(os.path.join(carousel_dir, s)).convert('RGB') for s in slides]

# Save as PDF
output_path = os.path.join(carousel_dir, 'carousel.pdf')
images[0].save(output_path, save_all=True, append_images=images[1:])
print(f"Created {output_path} with {len(images)} slides")
EOF
```

### Step 5: Upload to LinkedIn

1. Create new LinkedIn post
2. Click the **document icon** (📄) - NOT the image icon
3. Upload `carousel.pdf`
4. Add title (shown above carousel)
5. Write post caption
6. Post!

**Important**: The document icon creates a carousel. The image icon would upload a single image.

## Prompting Best Practices

### DO:
- Be extremely specific about layout and positioning
- Specify exact colors with hex codes
- Describe typography (serif vs sans-serif, bold, italic)
- Include "NOT AI-looking" or "designer aesthetic"
- Mention "hand-drawn" elements to break perfection
- Describe background texture (paper, off-white, subtle grain)

### DON'T:
- Use vague terms like "professional" without specifics
- Forget aspect ratio (always specify 4:5 portrait for LinkedIn)
- Skip color specifications
- Request pure white backgrounds (use off-white/cream)

## Iterative Refinement

If the first generation isn't right:

1. **Analyze what's wrong** - Color? Layout? Typography?
2. **Edit the existing image** rather than regenerating:
   ```bash
   npx @the-focus-ai/nano-banana "Make the headline bolder and move it up 50px" \
     --file media/carousels/cover.png --output media/carousels/cover-v2.png
   ```
3. **Be specific** about the change needed

## Style Templates

See `templates/` directory for pre-built style configurations:
- `linkedin-carousel.md` - Joe M-C inspired carousel style
- `infographic.md` - Data visualization style (coming soon)

## Troubleshooting

### Text not rendering correctly
- Break into shorter phrases
- Specify font style explicitly
- Use Nano Banana Pro model for better text: `--model gemini-3-pro-image-preview`

### Colors look off
- Always use hex codes (#2DD4BF not "teal")
- Specify "consistent color palette throughout"

### Looks too AI-generated
- Add "hand-drawn elements"
- Specify "paper texture" or "subtle grain"
- Request "imperfect" or "organic" details
- Avoid symmetry: "slightly asymmetrical layout"
