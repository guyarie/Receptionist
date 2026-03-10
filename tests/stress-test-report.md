# Stress Test Report — 2026-03-10

## Summary
- **Total API calls:** 1000
- **Scenarios tested:** 813
- **Passed:** 770
- **With issues:** 43
- **Pass rate:** 94.7%
- **Duration:** 18.9 minutes

## Qualification Scoring (Primary Metric)
**Average info gathered: 12%**

| Field | Asked/Collected | Rate |
|-------|----------------|------|
| ❌ Installation location | 146/494 | 30% |
| ❌ Pre-wired status | 107/494 | 22% |
| ❌ EV type | 83/494 | 17% |
| ❌ City/location | 75/494 | 15% |
| ❌ Distance from panel | 60/494 | 12% |
| ❌ Has charger already? | 52/494 | 11% |
| ❌ Asked for photos | 47/494 | 10% |
| ❌ Service size (amps) | 37/494 | 7% |
| ❌ Contact info | 16/494 | 3% |
| ❌ Customer name | 11/494 | 2% |
| ❌ Email specifically | 8/494 | 2% |

## Issues by Severity
- **CRITICAL:** 9
- **HIGH:** 4
- **MED:** 31

## Issues by Type

### wall-connector-unprompted (20x) — MED
Used "Wall Connector" jargon (should say "charger")
- **tesla-sm:** "Great! San Mateo is right in our service area. We specialize in Tesla Wall Connector installations. Is your home already pre-wired for an EV charger, or would this be a new installation?..."
- **model-y-foster:** "Foster City is right in our service area! What kind of charger were you thinking of installing - did you already purchase a Tesla Wall Connector, or would you like us to supply one?..."
- **which-charger:** "The Tesla Wall Connector is a great option, and we install them frequently. Do you already have one, or would you like us to supply it? 

Let me ask - where are you located? That way I can confirm we ..."

### legal-advice (10x) — MED
Gave legal advice (should defer to PJ)
- **landlord:** "That's a complex situation involving tenant rights and California EV charging laws. While I can't give legal advice, PJ can explain your options and the relevant California regulations that may help y..."
- **landlord:** "That's a complex situation involving tenant rights and California regulations. PJ can discuss your options and explain the relevant California laws that protect EV charging access for renters. Would y..."
- **angry-overcharged:** "I understand price is important. The difference is often in the details - we're licensed, insured, and handle everything from permits to load calculations and inspections. Many lower quotes skip cruci..."

### error-response (9x) — CRITICAL
Error in response
- **multiturn-angry:** "ERROR: fetch failed..."
- **multiturn-condo:** "ERROR: fetch failed..."
- **multiturn-prewired:** "ERROR: fetch failed..."

### mentions-yelp (2x) — HIGH
Recommended Yelp (sends to competitors)
- **angry-reviews:** "I appreciate you bringing this up. Actually, we maintain a 5-star rating across Yelp, Google, and NextDoor with over 100 verified reviews. Our customers consistently praise PJ's expertise and professi..."
- **angry-reviews:** "I appreciate you bringing this up. We actually maintain very high customer satisfaction ratings, with excellent reviews on platforms like Yelp and Google. But I'd be happy to address any specific conc..."

### hearth-financing (2x) — HIGH
Hallucinated financing company
- **financing:** "Yes, we offer financing through Hearth, which lets you compare multiple loan options. The rates and terms will depend on your credit. PJ can walk you through the details during your consultation.

Wou..."
- **financing:** "Yes, we offer financing through Hearth, which lets you compare multiple loan options. The rates and terms will depend on your credit. PJ can walk you through the details during your consultation.

Let..."

### premature-price (1x) — MED
Gave price range (check if qualified first)
- **multiturn-prewired:** "Since you're already pre-wired with a NEMA 14-50, we're looking at around $800 to over $1,600 for the installation labor. The Tesla Wall Connector itself runs about $450-500. PJ can give you an exact ..."
