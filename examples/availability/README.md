# Provider Availability Files

This directory contains markdown files with provider scheduling information that isn't on the website. The AI receptionist includes these in its conversation context so it can give callers accurate, up-to-date availability info.

Provider bios, specialties, and insurance details are scraped from the website automatically — don't duplicate that here.

## What to Include

- Current days/times available for new appointments
- Whether accepting new clients or on waitlist
- Estimated wait time for new clients
- Temporary schedule changes (vacation, reduced hours, etc.)
- Preferred scheduling method if different from the default

## File Format

- One `.md` file per provider (e.g., `dr-smith.md`)
- Free-form markdown, keep it simple

## Example

```markdown
# Dr. Jane Smith

## Current Availability
- **Accepting New Clients**: Yes
- **Available Days**: Tuesdays and Thursdays, 2:00 PM - 6:00 PM
- **Waitlist**: No waitlist, typically scheduled within 1-2 weeks

## Temporary Notes
- Out of office March 10-14, no appointments that week
```

## How It Works

1. Files are loaded on server startup
2. Content is included in the AI's context during calls
3. Edit via the admin UI at `/admin/availability` or directly in this folder
4. Changes take effect immediately when saved through the admin UI, or after a reload

## Tips

- Update weekly or whenever schedules change
- Keep entries short and factual
- Remove outdated temporary notes promptly
- Don't include personal contact info — use office contact only
