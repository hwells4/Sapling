#!/usr/bin/env python3
"""
Granola Sync - Local Edition
Syncs Granola meeting notes directly to the vault's brain/calls/ folder.
Runs via launchd when Granola writes to its cache file.
"""

import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

# Granola cache location (macOS)
GRANOLA_CACHE_PATH = Path.home() / "Library/Application Support/Granola/cache-v3.json"

# Default output path (relative to this script's location)
DEFAULT_OUTPUT_PATH = Path(__file__).parent.parent.parent / "brain/calls"


def load_config() -> dict:
    """Load configuration from environment or .env file."""
    env_file = Path(__file__).parent / ".env"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())

    output_path = os.environ.get("OUTPUT_PATH", str(DEFAULT_OUTPUT_PATH))
    return {
        "output_path": Path(output_path),
        "sync_delay": int(os.environ.get("SYNC_DELAY", "60")),
    }


def read_granola_cache() -> tuple[dict, dict]:
    """
    Read and parse Granola's local cache file.
    Returns (documents dict, document_panels dict).
    """
    if not GRANOLA_CACHE_PATH.exists():
        print(f"Granola cache not found at {GRANOLA_CACHE_PATH}")
        return {}, {}

    try:
        # Cache is double-encoded: outer JSON has 'cache' key with JSON string value
        outer = json.loads(GRANOLA_CACHE_PATH.read_text())
        cache_str = outer.get("cache", "{}")
        cache = json.loads(cache_str)

        state = cache.get("state", {})
        documents = state.get("documents", {})
        document_panels = state.get("documentPanels", {})

        print(f"Found {len(documents)} documents, {len(document_panels)} document panels")
        return documents, document_panels
    except json.JSONDecodeError as e:
        print(f"ERROR: Failed to parse Granola cache: {e}")
        return {}, {}


def prosemirror_to_markdown(node: dict, depth: int = 0) -> str:
    """Convert ProseMirror JSON to markdown."""
    if not isinstance(node, dict):
        return ""

    node_type = node.get("type", "")
    content = node.get("content", [])
    text = node.get("text", "")
    attrs = node.get("attrs", {})

    result = ""

    if node_type == "doc":
        for child in content:
            result += prosemirror_to_markdown(child, depth)
    elif node_type == "heading":
        level = attrs.get("level", 1)
        heading_text = "".join(prosemirror_to_markdown(c, depth) for c in content)
        result = "#" * level + " " + heading_text + "\n\n"
    elif node_type == "paragraph":
        para_text = "".join(prosemirror_to_markdown(c, depth) for c in content)
        if para_text.strip():
            result = para_text + "\n\n"
    elif node_type == "text":
        result = text
    elif node_type == "bulletList":
        for child in content:
            result += prosemirror_to_markdown(child, depth)
    elif node_type == "orderedList":
        for i, child in enumerate(content, 1):
            result += prosemirror_to_markdown(child, depth)
    elif node_type == "listItem":
        item_text = "".join(prosemirror_to_markdown(c, depth + 1) for c in content).strip()
        result = "- " + item_text + "\n"
    elif node_type == "blockquote":
        quote_text = "".join(prosemirror_to_markdown(c, depth) for c in content)
        result = "> " + quote_text.replace("\n", "\n> ") + "\n"
    elif node_type == "codeBlock":
        code_text = "".join(prosemirror_to_markdown(c, depth) for c in content)
        result = "```\n" + code_text + "\n```\n\n"
    elif node_type == "hardBreak":
        result = "\n"
    elif node_type == "horizontalRule":
        result = "\n---\n\n"
    else:
        # For unknown types, try to extract text from children
        for child in content:
            result += prosemirror_to_markdown(child, depth)

    return result


def extract_panel_content(document_panels: dict, doc_id: str) -> str:
    """Extract and convert panel content to markdown."""
    panels = document_panels.get(doc_id, {})
    if not panels:
        return ""

    markdown_parts = []
    for panel_id, panel in panels.items():
        content = panel.get("content", {})
        if content:
            md = prosemirror_to_markdown(content)
            if md.strip():
                markdown_parts.append(md.strip())

    return "\n\n".join(markdown_parts)


def slugify(text: str) -> str:
    """Convert text to a URL-friendly slug."""
    import re
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text[:50].rstrip('-')


def extract_call_data(doc_id: str, doc: dict, document_panels: dict) -> dict | None:
    """Extract call record fields from a Granola document."""
    try:
        title = doc.get("title") or "Untitled Meeting"
        created_at = doc.get("created_at")

        # Skip if no created_at (likely a placeholder/template)
        if not created_at:
            return None

        # Get notes from document panels (AI-generated summaries)
        enhanced_notes = extract_panel_content(document_panels, doc_id)

        # If no panel content, try notes_markdown
        if not enhanced_notes:
            enhanced_notes = doc.get("notes_markdown") or ""

        # Skip if no enhanced notes (no AI summary generated yet)
        if not enhanced_notes:
            return None

        # Get calendar event data
        gcal = doc.get("google_calendar_event", {}) or {}

        # Extract attendees
        attendees = []
        for att in gcal.get("attendees", []):
            if isinstance(att, dict):
                email = att.get("email", "")
                name = att.get("displayName", "")
                if email:
                    attendees.append({"email": email, "name": name})

        # Get event time
        start = gcal.get("start", {})
        event_time = start.get("dateTime") if isinstance(start, dict) else None

        # Calculate duration from start/end
        duration = None
        end = gcal.get("end", {})
        if event_time and end.get("dateTime"):
            try:
                start_dt = datetime.fromisoformat(event_time.replace("Z", "+00:00"))
                end_dt = datetime.fromisoformat(end["dateTime"].replace("Z", "+00:00"))
                duration = int((end_dt - start_dt).total_seconds() / 60)
            except:
                pass

        # Get meeting link
        meeting_link = gcal.get("hangoutLink") or gcal.get("conferenceData", {}).get("entryPoints", [{}])[0].get("uri")

        # Parse date for filename
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            date_str = dt.strftime("%Y-%m-%d")
            date_display = dt.strftime("%B %d, %Y")
        except:
            date_str = datetime.now().strftime("%Y-%m-%d")
            date_display = datetime.now().strftime("%B %d, %Y")

        return {
            "doc_id": doc_id,
            "title": title,
            "date_str": date_str,
            "date_display": date_display,
            "enhanced_notes": enhanced_notes,
            "attendees": attendees,
            "event_time": event_time,
            "duration": duration,
            "meeting_link": meeting_link,
            "created_at": created_at,
        }
    except Exception as e:
        print(f"ERROR extracting call data for {doc_id}: {e}")
        return None


def get_existing_doc_ids(output_path: Path) -> set[str]:
    """Get all Granola doc IDs already synced (from frontmatter)."""
    existing = set()
    if not output_path.exists():
        return existing

    for file in output_path.glob("*.md"):
        try:
            content = file.read_text()
            # Look for granola_id in frontmatter
            if "granola_id:" in content:
                for line in content.split("\n"):
                    if line.startswith("granola_id:"):
                        doc_id = line.split(":", 1)[1].strip()
                        existing.add(doc_id)
                        break
        except:
            pass

    return existing


def generate_filename(output_path: Path, date_str: str, title: str) -> Path:
    """Generate a unique filename for the call note."""
    slug = slugify(title)
    base_name = f"{date_str}-{slug}"
    file_path = output_path / f"{base_name}.md"

    # Handle duplicates
    counter = 1
    while file_path.exists():
        file_path = output_path / f"{base_name}-{counter:02d}.md"
        counter += 1

    return file_path


def write_call_note(output_path: Path, call_data: dict) -> Path | None:
    """Write a call note as markdown with frontmatter."""
    try:
        output_path.mkdir(parents=True, exist_ok=True)

        file_path = generate_filename(
            output_path,
            call_data["date_str"],
            call_data["title"]
        )

        # Format attendees for frontmatter
        attendee_names = [a.get("name") or a.get("email", "Unknown") for a in call_data["attendees"]]
        attendees_str = ", ".join(attendee_names) if attendee_names else "None"

        # Build frontmatter
        frontmatter = f"""---
schema_version: 1.0.0
date: {call_data["date_str"]}
type: call
granola_id: {call_data["doc_id"]}
source: granola
people: []
companies: []
tags:
  - date/{call_data["date_str"]}
  - call
---"""

        # Build content
        content_parts = [
            frontmatter,
            "",
            f"# {call_data['title']}",
            "",
            f"**Date:** {call_data['date_display']}",
            f"**Attendees:** {attendees_str}",
        ]

        if call_data.get("duration"):
            content_parts.append(f"**Duration:** {call_data['duration']} minutes")

        if call_data.get("meeting_link"):
            content_parts.append(f"**Meeting Link:** {call_data['meeting_link']}")

        content_parts.extend([
            "",
            "---",
            "",
            "## Notes",
            "",
            call_data["enhanced_notes"],
            "",
            "---",
            "*Synced from Granola*",
            "",
        ])

        content = "\n".join(content_parts)
        file_path.write_text(content)

        return file_path
    except Exception as e:
        print(f"ERROR writing call note: {e}")
        return None


def main():
    """Main sync loop."""
    config = load_config()

    # Wait for Granola to finish writing (transcript + AI notes generation)
    print(f"Waiting {config['sync_delay']} seconds for Granola to finish writing...")
    time.sleep(config["sync_delay"])

    print(f"\n{'='*50}")
    print(f"Granola Sync (Local) - {datetime.now().isoformat()}")
    print(f"{'='*50}")

    # Read Granola cache
    documents, document_panels = read_granola_cache()
    if not documents:
        print("No documents to process")
        return

    # Get existing synced doc IDs
    existing_ids = get_existing_doc_ids(config["output_path"])
    print(f"Found {len(existing_ids)} existing calls in {config['output_path']}")

    # Process new documents
    new_count = 0
    for doc_id, doc in documents.items():
        # Skip if already synced
        if doc_id in existing_ids:
            continue

        call_data = extract_call_data(doc_id, doc, document_panels)
        if not call_data:
            continue

        print(f"\nNew call: {call_data['title']}")
        print(f"  ID: {doc_id}")
        print(f"  Attendees: {len(call_data['attendees'])}")
        print(f"  Notes length: {len(call_data['enhanced_notes'])}")

        # Write to vault
        file_path = write_call_note(config["output_path"], call_data)
        if file_path:
            print(f"  Saved to: {file_path}")
            new_count += 1
        else:
            print(f"  Failed to save")

    print(f"\n{'='*50}")
    print(f"Sync complete: {new_count} new calls saved")
    print(f"{'='*50}\n")


if __name__ == "__main__":
    main()
