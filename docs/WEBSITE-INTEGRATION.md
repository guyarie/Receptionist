# Website Integration Complete! 🌐

## ✅ What Was Added

Your AI receptionist now has access to all the information from https://www.rtcbellevue.com/

### New Features

1. **Automatic Website Scraping**
   - Fetches website content on server startup
   - Caches data locally for reliability
   - Includes all clinician information, services, and practice details

2. **AI Context Integration**
   - Website content is automatically added to the AI's system prompt
   - AI can now answer questions about:
     - Clinicians and their specialties
     - Services offered (individual, couples, family therapy, etc.)
     - Practice approach and philosophy
     - Contact information
     - Languages offered (English, Hebrew, Spanish, Russian, Ukrainian, Tagalog)

3. **New API Endpoints**
   - `GET /website-data` - View scraped website data
   - `POST /refresh-website` - Manually refresh website data

### What the AI Now Knows

From the website, the AI has information about:

**Practice Info:**
- Name: Relational Therapy Collective (RTC)
- Location: Bellevue, WA
- Approach: Relational, evidence-based, trauma-informed care
- Philosophy: Collaborative, team-based approach

**Services:**
- Individual Therapy
- Couples Therapy
- Family Therapy
- Child & Teen Therapy
- Parent Coaching
- Life Coaching
- Group Therapy
- Medication Management
- EMDR
- Selective Mutism treatment

**Clinicians (15 providers):**
The AI knows about all clinicians including:
- Miri Arie, PhD - Child, adult, family, group therapy
- Nina Helms, LMHC - EMDR specialist
- Claire de Leon, LMHC - Child/teen, selective mutism
- Jeffrey Gillman, PhD - Teens, parents, adults
- Jessica Lazaro, PsyD - Individual therapy
- Maki Park, LMHCA - Identity, cultural issues
- Michal Alpert, LICSW - Anxiety, depression, prenatal/postnatal
- Michal Goldring Keidar, LICSW - Teens, adults, parents, couples
- Rebeca Marin, PhD - Couples therapy, bilingual (Spanish)
- Morgan Coburn, M.Ed - Parent coaching
- Lilach Geppert-Shapira, MA - Psycho-educator
- Limor Raviv, LMHCA - Child, family therapy
- Yogi Patel, DNP-PMHNP - Medication management
- David Neal, PsyD - Teen, adult, group therapy
- Elina Kogan, MSW - Teen, adult, couple therapy

**Languages Offered:**
- English
- Hebrew
- Spanish
- Russian
- Ukrainian
- Tagalog
- Hungarian (limited)

**Contact Info:**
- General email: therapy@rtcbellevue.com
- Phone: (425) 279-5017 (for inquiries, not scheduling)
- Individual clinician contact info available

## 🧪 Testing the Integration

### Test Questions to Ask

Call your number (+1 855-707-2970) and try asking:

1. **About Services:**
   - "What types of therapy do you offer?"
   - "Do you do couples therapy?"
   - "Can you help with child anxiety?"

2. **About Clinicians:**
   - "Do you have any therapists who speak Spanish?"
   - "Who specializes in trauma?"
   - "Do you have anyone who does EMDR?"

3. **About the Practice:**
   - "Where are you located?"
   - "What's your approach to therapy?"
   - "How do I schedule an appointment?"

4. **Specific Needs:**
   - "I need help with selective mutism"
   - "Do you offer medication management?"
   - "Can you help with couples communication?"

### Expected Behavior

The AI should now:
- ✅ Answer questions using actual website information
- ✅ Mention specific clinicians by name
- ✅ Describe services accurately
- ✅ Provide correct contact information
- ✅ Mention language options when relevant

## 🔄 Updating Website Data

### Automatic Updates
Website data is fetched every time the server starts.

### Manual Refresh
If the website changes and you want to update without restarting:

```bash
curl -X POST http://localhost:3000/refresh-website
```

### View Current Data
To see what data the AI has:

```bash
curl http://localhost:3000/website-data
```

Or visit: http://localhost:3000/website-data in your browser

## 📁 Files Created

- `src/website-scraper.js` - Website scraping logic
- `data/website-cache.json` - Cached website data
- Updated `src/ai-client.js` - Now includes website context
- Updated `src/server.js` - Scrapes website on startup

## 🎯 What's Next

Now that the AI has website data, you can:

1. **Test thoroughly** - Call and ask various questions
2. **Refine prompts** - Adjust how the AI presents information
3. **Add Excel integration** - For real-time availability (next step)
4. **Implement booking** - Allow callers to schedule appointments

## 💡 Tips

- The AI has ALL the website content, so it can answer detailed questions
- If the website is updated, restart the server or use the refresh endpoint
- The cached data ensures the system works even if the website is temporarily down
- You can edit `data/website-cache.json` manually if needed

## 🆘 Troubleshooting

**AI not using website info?**
- Check server logs for "Website scraped successfully"
- Verify data exists: `curl http://localhost:3000/website-data`
- Restart the server to reload

**Website scraping failed?**
- Server will use cached data if available
- Check internet connection
- Verify website URL is accessible

**Want to add more data?**
- Edit `data/website-cache.json` directly
- Or improve the scraper in `src/website-scraper.js`

---

**Ready to test?** Call +1 (855) 707-2970 and ask about your services!
