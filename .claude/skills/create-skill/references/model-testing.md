# Model Testing Patterns

Skills act as additions to models. What works for Opus might need more detail for Haiku.

## Testing by Model

| Model | Tendency | What It Needs |
|-------|----------|---------------|
| Haiku | Needs guidance | Explicit instructions, complete examples, step-by-step |
| Sonnet | Balanced | XML structure, progressive disclosure, concise |
| Opus | Works with principles | High freedom, trust reasoning, minimal prescription |

## Haiku Testing

Questions to ask:
- Does skill provide enough guidance?
- Are examples complete (no partial code)?
- Are implicit assumptions explicit?

## Sonnet Testing

Questions to ask:
- Is skill clear and efficient?
- Does it avoid over-explanation?
- Does progressive disclosure work?

## Opus Testing

Questions to ask:
- Does skill avoid over-explaining?
- Can Opus infer obvious steps?
- Is context minimal but sufficient?

## Balancing Example

**Good balance (works for all):**
```xml
<quick_start>
Use pdfplumber for text extraction:

```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

For scanned PDFs requiring OCR, use pdf2image with pytesseract.
</quick_start>
```

**Too minimal for Haiku:**
```xml
<quick_start>
Use pdfplumber for text extraction.
</quick_start>
```

**Too verbose for Opus:**
```xml
<quick_start>
PDF files are documents that contain text. To extract that text, we use a library called pdfplumber. First, import the library at the top of your Python file...
</quick_start>
```

## Best Practice

Write for Sonnet (medium detail), then:
1. Test with Haiku (catches under-specification)
2. Test with Opus (catches over-specification)
3. Adjust based on actual performance
