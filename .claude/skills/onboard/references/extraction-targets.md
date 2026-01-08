# Data Extraction Targets

## LinkedIn Profile

Extract these fields when scraping a LinkedIn profile:

| Field | Maps To | Priority |
|-------|---------|----------|
| Name | about-me.md → Identity.Name | Required |
| Headline | about-me.md → Identity.Role | Required |
| Summary/About | about-me.md → Background | High |
| Current Company | about-me.md → Identity.Company | High |
| Current Position | about-me.md → Current Focus | Medium |
| Skills (top 5) | about-me.md → Strengths | Medium |
| Experience summary | about-me.md → Background | Low |

**Scraping approach:**
1. Use WebFetch on the LinkedIn URL
2. Look for structured data in page content
3. Extract text from key sections
4. If blocked/limited, fall back to asking user directly

## Company Website

Extract these fields when scraping a company website:

| Field | Maps To | Priority |
|-------|---------|----------|
| Company name | business.md → Company | Required |
| About/Mission | business.md → Overview | High |
| Services/Products | business.md → Services | High |
| Target audience | business.md → Ideal Client | Medium |
| Team size indicator | business.md → Overview | Low |

**Scraping approach:**
1. First try /about or /about-us page
2. Fall back to homepage
3. Look for meta description as backup
4. Extract visible text from main content

## Writing Samples

Analyze these characteristics from writing samples:

| Characteristic | Maps To | How to Detect |
|---------------|---------|---------------|
| Avg sentence length | voice.md → Tone | Count words per sentence |
| Formality level | voice.md → Tone | Vocabulary complexity |
| Common phrases | voice.md → Phrases I Use | Frequency analysis |
| Structure preference | voice.md → What Works | Lists vs paragraphs |
| First-person usage | voice.md → Tone | "I" frequency |

**Analysis approach:**
1. WebFetch each URL
2. Extract main content (strip nav, footer, etc.)
3. Run text analysis
4. Compile style profile
