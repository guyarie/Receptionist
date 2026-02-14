# Provider Availability Files

This directory contains markdown files with provider availability information. Each file represents a therapist or clinician's schedule and availability details.

## Purpose

The AI phone receptionist reads these files and includes their content in the conversation context. This allows the AI to provide accurate scheduling information to callers without booking appointments directly.

## File Format

- **File Extension**: `.md` (Markdown)
- **File Naming**: Use descriptive names like `dr-smith.md`, `jane-doe-lmft.md`, or `provider-name.md`
- **Content Format**: Free-form markdown text

## What to Include

Each availability file should contain:

1. **Provider Name and Credentials**: Full name and professional title
2. **Specialties**: Areas of focus or therapeutic approaches
3. **Current Availability**: Days and times available for new clients
4. **Waitlist Status**: Whether accepting new clients or maintaining a waitlist
5. **Contact Preferences**: How clients should schedule (phone, email, portal, etc.)
6. **Special Notes**: Any relevant scheduling information

## Example Structure

```markdown
# Dr. Jane Smith, LMFT

## Specialties
- Couples therapy
- Trauma-informed care
- EMDR

## Current Availability
- **New Clients**: Accepting
- **Days**: Tuesdays and Thursdays
- **Times**: 2:00 PM - 6:00 PM
- **Session Length**: 50 minutes

## Scheduling
Please call the office at (555) 123-4567 to schedule an initial consultation.

## Notes
Currently offering both in-person and telehealth sessions.
```

## How It Works

1. **Automatic Loading**: The system reads all `.md` files from this directory on startup
2. **AI Context**: File contents are included in the AI's system prompt
3. **Read-Only**: The AI can reference this information but cannot modify it
4. **Live Updates**: Use the admin UI at `/admin/availability` to edit files, or edit them directly and reload

## Editing Availability

### Option 1: Admin UI (Recommended for Office Managers)
1. Navigate to `http://your-server:3000/admin/availability`
2. Edit the text area for any provider
3. Click "Save" to update the file
4. Changes take effect immediately

### Option 2: Direct File Editing (For Developers)
1. Edit the `.md` files in this directory
2. Reload the server or use the reload button in the admin UI
3. Changes will be reflected in the AI's responses

## Best Practices

1. **Keep It Current**: Update availability weekly or as schedules change
2. **Be Specific**: Include exact days and times when possible
3. **Clear Language**: Write in plain language that callers will understand
4. **Avoid Booking**: Don't include specific appointment slots - the AI should direct callers to call the office
5. **Update Regularly**: Remove outdated information promptly

## Privacy Considerations

- Do not include personal contact information (personal phone/email)
- Use office contact information only
- Avoid including sensitive personal details about providers
- Focus on professional availability and scheduling information

## Troubleshooting

**Files not appearing in admin UI?**
- Ensure files have `.md` extension
- Check file permissions (must be readable by the server process)
- Click the "Reload" button in the admin UI

**AI not mentioning availability?**
- Verify files contain actual content (not empty)
- Check that the availability directory exists
- Restart the server or use the reload endpoint

**Changes not taking effect?**
- Use the reload button in the admin UI after editing
- Verify the file was saved successfully
- Check server logs for any error messages

## Support

For questions about managing provider availability, contact your system administrator or refer to the main project documentation.
