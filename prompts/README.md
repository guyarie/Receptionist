# AI Receptionist Prompts

This directory contains editable text files that control what your AI receptionist says.

## Files

### `system-prompt.txt`
**What it does:** Defines the AI's personality, role, and behavior guidelines.

**When to edit:** 
- Change the AI's tone (more formal, more casual, etc.)
- Add specific instructions about how to handle certain topics
- Define what the AI should or shouldn't do

**Tips:**
- Keep it clear and concise
- Use bullet points for instructions
- Be specific about tone and style

---

### `greeting.txt`
**What it does:** The first thing callers hear when they call.

**When to edit:**
- Change the practice name
- Add/remove information in the greeting
- Make it shorter or longer

**Tips:**
- Keep it under 20 seconds when spoken
- Include who you are and how you can help
- Make it warm and welcoming

---

### `follow-up.txt`
**What it does:** What the AI says after responding to a question, to keep the conversation going.

**When to edit:**
- Change how the AI prompts for more questions
- Make it more or less formal

**Tips:**
- Keep it short and natural
- Should invite further questions without being pushy

---

### `closing.txt`
**What it does:** What the AI says before ending the call.

**When to edit:**
- Add a specific message (e.g., "Visit our website at...")
- Change the farewell tone

**Tips:**
- Keep it brief
- End on a positive note

---

### `no-speech-detected.txt`
**What it does:** What the AI says when it doesn't hear anything or can't understand.

**When to edit:**
- Make it more or less apologetic
- Add troubleshooting hints

**Tips:**
- Be polite and patient
- Keep it short

---

### `error.txt`
**What it does:** What the AI says when there's a technical problem.

**When to edit:**
- Add alternative contact information
- Change the apology tone

**Tips:**
- Be apologetic but brief
- Provide next steps if possible

---

## How to Apply Changes

After editing any of these files:

1. **Restart the server:**
   ```bash
   # Stop the current server (Ctrl+C in the terminal)
   npm start
   ```

2. **Test by calling:** +1 (855) 707-2970

3. **Iterate:** Keep editing and testing until it sounds right!

---

## Examples

### Making the greeting more casual:
```
Hey there! Thanks for calling Relational Therapy Collective. I'm the AI receptionist. What can I do for you?
```

### Making the greeting more formal:
```
Good day. You've reached the Relational Therapy Collective. I am the automated receptionist system. How may I assist you today?
```

### Adding practice info to greeting:
```
Hello! Thank you for calling the Relational Therapy Collective, where we specialize in individual, couples, and family therapy. I'm your AI receptionist. How can I help you today?
```

---

## Tips for Great Prompts

1. **Be conversational** - Write how people actually talk on the phone
2. **Keep it brief** - Long messages lose callers' attention
3. **Test it out loud** - Read your prompts aloud to hear how they sound
4. **Get feedback** - Have others call and give you feedback
5. **Iterate** - Don't be afraid to keep tweaking until it's perfect!
