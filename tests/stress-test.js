#!/usr/bin/env node
// ChargeWizards Receptionist - 1000 Chat Stress Test
// Tests diverse scenarios and flags issues

const fs = require('fs');
const API = 'https://receptionist.chargewizards.com/api/webchat';

const SCENARIOS = [
  // Basic qualification flows
  { name: 'tesla-sm', msgs: ['I have a Tesla Model 3 and need a charger installed in San Mateo'] },
  { name: 'rivian-sf', msgs: ['I just got a Rivian R1T. Live in San Francisco, need charging at home'] },
  { name: 'chevy-bolt', msgs: ['Got a Chevy Bolt, need a Level 2 charger. I live in Burlingame'] },
  { name: 'model-y-foster', msgs: ['Need a charger for my Model Y in Foster City'] },
  { name: 'id4-redwood', msgs: ['I have a VW ID.4 in Redwood City, looking for charger installation'] },
  { name: 'leaf-pacifica', msgs: ['Nissan Leaf owner in Pacifica, need home charging'] },
  { name: 'mach-e-belmont', msgs: ['Ford Mustang Mach-E, Belmont CA, need charger'] },
  { name: 'bmw-ix-hillsborough', msgs: ['BMW iX in Hillsborough, want a charger installed'] },
  { name: 'polestar-ssf', msgs: ['Polestar 2, South San Francisco, looking for installation'] },
  { name: 'hyundai-ioniq-sc', msgs: ['Hyundai Ioniq 5 in San Carlos, need a charger'] },
  
  // Pricing questions
  { name: 'price-direct', msgs: ['How much does it cost to install an EV charger?'] },
  { name: 'price-specific', msgs: ['What would it cost to install a Tesla charger in my garage?'] },
  { name: 'price-cheap', msgs: ['What is the cheapest option for EV charging at home?'] },
  { name: 'price-compare', msgs: ['How do your prices compare to other installers?'] },
  { name: 'price-breakdown', msgs: ['Can you break down what goes into the installation cost?'] },
  
  // Pre-wired vs not
  { name: 'prewired-yes', msgs: ['I already have a 240v outlet in my garage for an EV charger. How much to install?'] },
  { name: 'prewired-no', msgs: ['No existing wiring for a charger, panel is in the basement. How much?'] },
  { name: 'prewired-unsure', msgs: ['Not sure if my house is wired for a charger. Previous owner might have done something'] },
  
  // Distance/run questions
  { name: 'short-run', msgs: ['Panel is right next to where I want the charger, maybe 5 feet'] },
  { name: 'long-run', msgs: ['I need the charger in my detached garage about 80 feet from the panel'] },
  { name: 'very-long', msgs: ['The parking spot is about 150 feet from the electrical panel in the building'] },
  
  // Condo/HOA
  { name: 'condo-sf', msgs: ['I live in a condo in San Francisco and want to install an EV charger'] },
  { name: 'condo-hoa', msgs: ['My HOA wants details about EV charger installation for our building'] },
  { name: 'condo-parking', msgs: ['I have a deeded parking spot in an underground garage, can I get a charger?'] },
  { name: 'condo-shared', msgs: ['Our condo board wants to install chargers for all residents'] },
  { name: 'apartment-renter', msgs: ['I rent an apartment, can I still get a charger installed?'] },
  
  // Panel concerns
  { name: 'panel-100a', msgs: ['I have a 100 amp panel, can I still get a Level 2 charger?'] },
  { name: 'panel-full', msgs: ['My panel is completely full, no open breaker slots'] },
  { name: 'panel-upgrade-told', msgs: ['Another electrician told me I need a panel upgrade. Is that true?'] },
  { name: 'panel-old', msgs: ['My house was built in 1960, the panel looks old'] },
  
  // Charger questions
  { name: 'which-charger', msgs: ['What charger should I get for my Tesla?'] },
  { name: 'already-bought', msgs: ['I already bought a ChargePoint Home Flex, just need it installed'] },
  { name: 'nema-outlet', msgs: ['Can you just install a 240v outlet so I can use my portable charger?'] },
  { name: 'charger-outdoor', msgs: ['I need an outdoor charger on the side of my house'] },
  
  // Service area edge cases
  { name: 'area-sunnyvale', msgs: ['Do you service Sunnyvale?'] },
  { name: 'area-sanjose', msgs: ['I live in San Jose, can you help?'] },
  { name: 'area-oakland', msgs: ['Do you come to Oakland?'] },
  { name: 'area-sacramento', msgs: ['I am in Sacramento, do you service this area?'] },
  { name: 'area-cupertino', msgs: ['Cupertino, do you cover this area?'] },
  { name: 'area-fremont', msgs: ['Do you service Fremont?'] },
  
  // Non-EV requests
  { name: 'reject-solar', msgs: ['Can you install solar panels?'] },
  { name: 'reject-generator', msgs: ['I need a generator installed'] },
  { name: 'reject-lighting', msgs: ['Can you install recessed lighting?'] },
  { name: 'reject-rewire', msgs: ['I need my house rewired'] },
  { name: 'reject-outlet', msgs: ['I need a 240v outlet for my welder'] },
  { name: 'reject-hvac', msgs: ['Can you do HVAC electrical work?'] },
  
  // Completely off-topic
  { name: 'offtopic-recipe', msgs: ['Can you give me a good pasta recipe?'] },
  { name: 'offtopic-dating', msgs: ['Any dating advice?'] },
  { name: 'offtopic-bitcoin', msgs: ['What do you think about Bitcoin?'] },
  { name: 'offtopic-weather', msgs: ['What is the weather like today?'] },
  { name: 'offtopic-joke', msgs: ['Tell me a joke'] },
  
  // Angry/frustrated customers
  { name: 'angry-noreturn', msgs: ['This is ridiculous, I have been trying to get someone to install my charger for weeks'] },
  { name: 'angry-cursing', msgs: ['Your f***ing website sucks, I just want a damn charger installed'] },
  { name: 'angry-reviews', msgs: ['I saw terrible reviews about your company online'] },
  { name: 'angry-overcharged', msgs: ['Another company quoted me $800 and you guys are way too expensive'] },
  
  // Spam/solicitation
  { name: 'spam-seo', msgs: ['Hi I want to sell you our SEO services to get more leads'] },
  { name: 'spam-insurance', msgs: ['I am calling about your business insurance policy'] },
  { name: 'spam-marketing', msgs: ['We can get your company on the first page of Google'] },
  { name: 'spam-emergency', msgs: ['Having an emergency at my home need immediate service'] },
  
  // Bot identity
  { name: 'bot-question', msgs: ['Are you a real person or a bot?'] },
  { name: 'bot-human', msgs: ['I want to talk to a real person, not a chatbot'] },
  
  // Permits/process
  { name: 'permit-needed', msgs: ['Do I need a permit for an EV charger?'] },
  { name: 'permit-who', msgs: ['Do I have to pull the permit myself?'] },
  { name: 'permit-timeline', msgs: ['How long does the permit process take?'] },
  { name: 'diy-permit', msgs: ['Can I install the charger myself and just have you do the permit?'] },
  
  // Financing/legal
  { name: 'financing', msgs: ['Do you offer financing or payment plans?'] },
  { name: 'landlord', msgs: ['My landlord will not let me install a charger, what can I do?'] },
  { name: 'license', msgs: ['What is your license number?'] },
  { name: 'insurance', msgs: ['Are you licensed and insured?'] },
  
  // Multi-turn conversations
  { name: 'multiturn-full', msgs: [
    'Hi I need an EV charger installed',
    'Tesla Model Y',
    'San Mateo',
    'No I have not bought a charger yet',
    'I think 100 amps',
    'Garage, about 15 feet from the panel',
    'How much would that cost?'
  ]},
  { name: 'multiturn-condo', msgs: [
    'I live in a condo in SF and want to install a charger',
    'Its a parking garage, assigned spot',
    'About 60 feet from the nearest electrical room',
    'Rivian R1S',
    'No I have not bought a charger',
    'What would this cost?'
  ]},
  { name: 'multiturn-prewired', msgs: [
    'I already have a 240v outlet in my garage',
    'Yes its a NEMA 14-50',
    'I want to hardwire a Tesla Wall Connector instead',
    'San Mateo',
    'How much?'
  ]},
  { name: 'multiturn-angry', msgs: [
    'I need a charger installed ASAP',
    'I dont have time for 20 questions just tell me how much',
    'Fine. San Mateo. Tesla. Garage. 10 feet. Can I get a quote now?'
  ]},
];

// Issue detection patterns
const ISSUES = [
  { name: 'mentions-yelp', pattern: /yelp/i, severity: 'HIGH', desc: 'Recommended Yelp (sends to competitors)' },
  { name: 'mentions-qmerit', pattern: /qmerit/i, severity: 'HIGH', desc: 'Recommended Qmerit (sends to competitors)' },
  { name: 'says-cant-view-photos', pattern: /can.?t (view|see|analyze|process) (photos|images|pictures)/i, severity: 'HIGH', desc: 'Said it cannot view photos' },
  { name: 'wall-connector-unprompted', pattern: /wall connector/i, severity: 'MED', desc: 'Used "Wall Connector" jargon (should say "charger")' },
  { name: 'relational-therapy', pattern: /relational|therapy|therapist|collective/i, severity: 'CRITICAL', desc: 'Old template language leaked' },
  { name: 'premature-price', pattern: /\$\d{3,}.*\$\d{3,}/i, severity: 'MED', desc: 'Gave price range (check if qualified first)' },
  { name: 'recommends-competitor', pattern: /recommend.*(search|find|look|try|check).*(electrician|installer|another|competitor)/i, severity: 'HIGH', desc: 'Recommended finding another provider' },
  { name: 'hang-up-911', pattern: /hang up|dial 911/i, severity: 'MED', desc: 'Phone script in webchat' },
  { name: 'thank-you-calling', pattern: /thank you for calling/i, severity: 'MED', desc: 'Phone greeting in webchat' },
  { name: 'hearth-financing', pattern: /hearth/i, severity: 'HIGH', desc: 'Hallucinated financing company' },
  { name: 'legal-advice', pattern: /(california law|tenant rights|legally required|AB \d+|civil code)/i, severity: 'MED', desc: 'Gave legal advice (should defer to PJ)' },
  { name: 'mentions-rebate-sfh', pattern: /rebate|incentive|tax credit/i, severity: 'LOW', desc: 'Mentioned rebates (check if condo context)' },
  { name: 'empty-response', pattern: /^$/i, severity: 'CRITICAL', desc: 'Empty response' },
  { name: 'error-response', pattern: /error|sorry.*encountered/i, severity: 'CRITICAL', desc: 'Error in response' },
];

async function sendChat(sessionId, messages) {
  const chatMessages = [];
  const responses = [];
  
  for (const msg of messages) {
    chatMessages.push({ role: 'user', content: msg });
    
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: chatMessages })
      });
      const data = await res.json();
      const response = data.response || data.error || '';
      responses.push(response);
      chatMessages.push({ role: 'assistant', content: response });
    } catch (e) {
      responses.push(`ERROR: ${e.message}`);
      break;
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 500));
  }
  
  return responses;
}

// Qualification info scoring — did David ASK for or COLLECT these?
const QUAL_FIELDS = [
  { name: 'name', asked: /your name|what.*name|can i get your name|who am i speaking/i, desc: 'Customer name' },
  { name: 'city', asked: /what city|which city|where.*(located|live|based)|which area|what area/i, desc: 'City/location' },
  { name: 'ev_type', asked: /what (type|kind).*(ev|car|vehicle)|what (ev|car|vehicle)|what.*drive|which (ev|car)/i, desc: 'EV type' },
  { name: 'has_charger', asked: /already (bought|purchased|have|own).*charger|need us to supply|have a charger|charger in mind|charger picked/i, desc: 'Has charger already?' },
  { name: 'prewired', asked: /pre.?wired|dedicated (outlet|breaker|circuit)|existing.*wir|already.*wired|240v outlet/i, desc: 'Pre-wired status' },
  { name: 'service_size', asked: /service size|100.?amp|200.?amp|125.?amp|how many amps|panel.*capacity|electrical service/i, desc: 'Service size (amps)' },
  { name: 'photos', asked: /photo|picture|snap|image|meter.*panel|panel.*meter/i, desc: 'Asked for photos' },
  { name: 'location', asked: /where.*(install|mount|charger|want it)|garage|outside|wall|carport|driveway|parking/i, desc: 'Installation location' },
  { name: 'distance', asked: /how far|distance.*panel|feet.*from|run.*from|close.*panel|far.*panel/i, desc: 'Distance from panel' },
  { name: 'contact', asked: /best (way|number|method|email).*reach|phone number|email|contact|call you|text you/i, desc: 'Contact info' },
  { name: 'email', asked: /email|e-mail/i, desc: 'Email specifically' },
];

function scoreQualification(allText, scenario) {
  const scores = {};
  let asked = 0;
  let total = QUAL_FIELDS.length;
  
  // Skip qualification scoring for non-lead scenarios
  const isLeadScenario = !/reject|offtopic|spam|bot|financing|landlord|license|insurance|permit|area-(sanjose|oakland|sacramento|fremont)/i.test(scenario.name);
  if (!isLeadScenario) return null;
  
  for (const field of QUAL_FIELDS) {
    const wasAsked = field.asked.test(allText);
    // Also check if info was provided by user in the scenario
    const userText = scenario.msgs.join(' ');
    const wasProvided = field.asked.test(userText);
    scores[field.name] = { asked: wasAsked, provided: wasProvided, desc: field.desc };
    if (wasAsked || wasProvided) asked++;
  }
  
  return { scores, asked, total, pct: Math.round((asked / total) * 100) };
}

function checkIssues(responses, scenario) {
  const found = [];
  const fullText = responses.join(' ');
  
  for (const issue of ISSUES) {
    if (issue.pattern.test(fullText)) {
      if (issue.name === 'mentions-rebate-sfh' && /condo|hoa|multi|apartment/i.test(scenario.name)) continue;
      if (issue.name === 'wall-connector-unprompted' && /wall connector/i.test(scenario.msgs.join(' '))) continue;
      found.push(issue);
    }
  }
  return found;
}

async function runTests() {
  const startTime = Date.now();
  console.log(`🚀 Starting stress test: ${SCENARIOS.length} scenarios`);
  console.log(`Target: ~1000 total API calls\n`);
  
  const results = { pass: 0, issues: [], errors: [], qualScores: [] };
  let totalCalls = 0;
  let iteration = 0;
  
  // Repeat scenarios to get ~1000 calls
  const targetCalls = 1000;
  
  while (totalCalls < targetCalls) {
    iteration++;
    const batchSize = 5; // concurrent conversations
    
    for (let i = 0; i < SCENARIOS.length && totalCalls < targetCalls; i += batchSize) {
      const batch = SCENARIOS.slice(i, i + batchSize);
      const promises = batch.map(async (scenario) => {
        const sid = `stress-${iteration}-${scenario.name}-${Date.now()}`;
        const responses = await sendChat(sid, scenario.msgs);
        totalCalls += scenario.msgs.length;
        
        const allText = responses.join(' ');
        const issues = checkIssues(responses, scenario);
        const qual = scoreQualification(allText, scenario);
        
        const result = {
          scenario: scenario.name,
          iteration,
          msgs: scenario.msgs,
          responses,
          issues: issues.map(i => ({ name: i.name, severity: i.severity, desc: i.desc })),
          qualification: qual
        };
        
        if (qual) results.qualScores.push(qual);
        
        if (issues.length > 0) {
          results.issues.push(result);
        } else {
          results.pass++;
        }
        
        // Progress
        if (totalCalls % 50 === 0) {
          console.log(`  📊 Progress: ${totalCalls}/${targetCalls} calls (${results.issues.length} issues found)`);
        }
      });
      
      await Promise.all(promises);
      // Rate limit pause between batches
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  
  // Qualification scoring
  const qualResults = results.qualScores.filter(Boolean);
  const avgQual = qualResults.length > 0 
    ? Math.round(qualResults.reduce((s, q) => s + q.pct, 0) / qualResults.length)
    : 0;
  
  // Per-field stats
  const fieldStats = {};
  for (const field of QUAL_FIELDS) {
    const relevant = qualResults;
    const askedCount = relevant.filter(q => q.scores[field.name]?.asked || q.scores[field.name]?.provided).length;
    fieldStats[field.name] = {
      desc: field.desc,
      asked: askedCount,
      total: relevant.length,
      pct: relevant.length > 0 ? Math.round((askedCount / relevant.length) * 100) : 0
    };
  }

  // Generate report
  const report = {
    summary: {
      totalCalls,
      totalScenarios: results.pass + results.issues.length,
      passed: results.pass,
      withIssues: results.issues.length,
      passRate: ((results.pass / (results.pass + results.issues.length)) * 100).toFixed(1) + '%',
      avgQualification: avgQual + '%',
      elapsed: `${elapsed} minutes`
    },
    qualification: {
      avgScore: avgQual,
      fieldStats,
      scenarioScores: qualResults.map((q, i) => ({
        pct: q.pct,
        asked: q.asked,
        total: q.total
      }))
    },
    issuesBySeveity: {},
    issuesByType: {},
    details: results.issues
  };
  
  // Aggregate
  for (const r of results.issues) {
    for (const i of r.issues) {
      report.issuesBySeveity[i.severity] = (report.issuesBySeveity[i.severity] || 0) + 1;
      report.issuesByType[i.name] = report.issuesByType[i.name] || { count: 0, desc: i.desc, severity: i.severity, examples: [] };
      report.issuesByType[i.name].count++;
      if (report.issuesByType[i.name].examples.length < 3) {
        report.issuesByType[i.name].examples.push({
          scenario: r.scenario,
          lastResponse: r.responses[r.responses.length - 1]?.substring(0, 200)
        });
      }
    }
  }
  
  // Write report
  const reportPath = '/Users/cbot/clawd/receptionist/tests/stress-test-report.json';
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Write markdown summary
  let md = `# Stress Test Report — ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `## Summary\n`;
  md += `- **Total API calls:** ${report.summary.totalCalls}\n`;
  md += `- **Scenarios tested:** ${report.summary.totalScenarios}\n`;
  md += `- **Passed:** ${report.summary.passed}\n`;
  md += `- **With issues:** ${report.summary.withIssues}\n`;
  md += `- **Pass rate:** ${report.summary.passRate}\n`;
  md += `- **Duration:** ${report.summary.elapsed}\n\n`;
  
  md += `## Qualification Scoring (Primary Metric)\n`;
  md += `**Average info gathered: ${avgQual}%**\n\n`;
  md += `| Field | Asked/Collected | Rate |\n`;
  md += `|-------|----------------|------|\n`;
  for (const [name, stats] of Object.entries(fieldStats).sort((a,b) => b[1].pct - a[1].pct)) {
    const bar = stats.pct >= 80 ? '✅' : stats.pct >= 50 ? '⚠️' : '❌';
    md += `| ${bar} ${stats.desc} | ${stats.asked}/${stats.total} | ${stats.pct}% |\n`;
  }
  md += `\n`;
  
  md += `## Issues by Severity\n`;
  for (const [sev, count] of Object.entries(report.issuesBySeveity).sort()) {
    md += `- **${sev}:** ${count}\n`;
  }
  
  md += `\n## Issues by Type\n`;
  for (const [type, data] of Object.entries(report.issuesByType).sort((a,b) => b[1].count - a[1].count)) {
    md += `\n### ${type} (${data.count}x) — ${data.severity}\n`;
    md += `${data.desc}\n`;
    for (const ex of data.examples) {
      md += `- **${ex.scenario}:** "${ex.lastResponse}..."\n`;
    }
  }
  
  const mdPath = '/Users/cbot/clawd/receptionist/tests/stress-test-report.md';
  fs.writeFileSync(mdPath, md);
  
  console.log(`\n✅ Test complete!`);
  console.log(`📊 ${report.summary.totalCalls} calls, ${report.summary.passRate} pass rate`);
  console.log(`📝 Report: ${mdPath}`);
  
  return report;
}

runTests().catch(console.error);
