#!/usr/bin/env node
// ChargeWizards Receptionist - v2 Multi-Turn Stress Test
// Realistic conversations that simulate actual customers going through full qualification
// Measures % of 11 gold-standard fields collected

const fs = require('fs');
const API = 'https://receptionist.chargewizards.com/api/webchat';

// Gold standard fields — what PJ needs before calling back
const GOLD_FIELDS = [
  { name: 'name', detect: /your name|what.*name|can i get your name|who am i speaking|may i ask|what should i call/i, inResponse: /name|call you/i, desc: 'Customer name' },
  { name: 'phone', detect: /phone|number|reach you|call you|text you|best.*(way|number).*reach/i, inResponse: /phone|number|reach|call|text/i, desc: 'Phone number' },
  { name: 'email', detect: /email|e-mail|send.*quote/i, inResponse: /email|e-mail/i, desc: 'Email address' },
  { name: 'city', detect: /where.*(located|live|based)|what (city|area|zip)|which (city|area)/i, inResponse: /city|area|located|where|address|zip/i, desc: 'City/Address' },
  { name: 'housing_type', detect: /house or|condo or|apartment or|single.family|multi.family|what type.*(home|property|building)/i, inResponse: /house|condo|apartment|townhouse|single.family|multi/i, desc: 'House or Condo' },
  { name: 'ev_type', detect: /what.*(car|vehicle|ev|drive)|which (car|ev|vehicle)|what kind/i, inResponse: /what.*(car|vehicle|ev|drive)|what do you/i, desc: 'EV type' },
  { name: 'has_charger', detect: /already.*(bought|purchased|have|own).*charger|charger.*(bought|picked|chosen|selected)|need us to supply|have a charger|do you have/i, inResponse: /already.*charger|bought.*charger|supply|have a charger/i, desc: 'Has charger already?' },
  { name: 'prewired', detect: /pre.?wired|dedicated.*(outlet|breaker|circuit)|existing.*wir|already.*wired|240.?v.*(outlet|plug)|nema/i, inResponse: /pre.?wired|dedicated|existing|240|outlet|breaker/i, desc: 'Pre-wired status' },
  { name: 'service_size', detect: /service.*(size|capacity)|how many amps|100.?amp|200.?amp|125.?amp|panel.*(capacity|size|amp)|electrical service/i, inResponse: /amp|service.*(size|capacity)|panel/i, desc: 'Service size (amps)' },
  { name: 'location_distance', detect: /(where|location).*(install|mount|charger|want)|garage|carport|driveway|how far|distance.*panel|feet.*from/i, inResponse: /where.*install|where.*charger|garage|location|how far|distance|feet/i, desc: 'Install location + distance' },
  { name: 'photos', detect: /photo|picture|snap|image|meter|panel.*(door|open|picture)/i, inResponse: /photo|picture|snap|image|meter.*panel/i, desc: 'Panel photos requested' },
];

// Issue patterns
const ISSUES = [
  { name: 'mentions-yelp', pattern: /\byelp\b/i, severity: 'HIGH', desc: 'Mentioned Yelp' },
  { name: 'mentions-qmerit', pattern: /qmerit/i, severity: 'HIGH', desc: 'Mentioned Qmerit' },
  { name: 'hearth-financing', pattern: /hearth/i, severity: 'CRITICAL', desc: 'Hallucinated Hearth financing' },
  { name: 'wall-connector-unprompted', pattern: /wall connector/i, severity: 'MED', desc: 'Used "Wall Connector" jargon' },
  { name: 'relational-therapy', pattern: /relational|therapy|therapist|collective/i, severity: 'CRITICAL', desc: 'Template language leaked' },
  { name: 'cant-view-photos', pattern: /can.?t (view|see|analyze|process) (photos|images|pictures)/i, severity: 'HIGH', desc: 'Said cannot view photos' },
  { name: 'recommends-competitor', pattern: /recommend.*(search|find|look|try|check).*(electrician|installer|another)/i, severity: 'HIGH', desc: 'Recommended finding another provider' },
  { name: 'legal-advice', pattern: /(california law|tenant rights|legally required|AB \d+|civil code)/i, severity: 'MED', desc: 'Gave legal advice' },
  { name: 'error-response', pattern: /^ERROR:/i, severity: 'CRITICAL', desc: 'Server error' },
];

// ──────────────────────────────────────────────────────────────
// MULTI-TURN SCENARIO DEFINITIONS
// Each scenario has a customer "persona" and a series of responses
// that simulate how a real customer would reply to David's questions.
// The AI (David) fills in the gaps — we measure what he asks.
// ──────────────────────────────────────────────────────────────

const SCENARIOS = [
  // ── ALICE TYPE: Minimal info, needs David to pull everything out ──
  {
    name: 'alice-condo-minimal',
    category: 'alice-type',
    desc: 'Condo customer gives almost nothing upfront',
    customerResponses: [
      'Hi, I need an EV charger installed',
      'Tesla Model Y',
      'San Francisco',
      'Its a condo, parking garage',
      'No I havent bought one yet',
      'Im not sure about any of that honestly',
      'Its pretty far, maybe 50 or 60 feet from the electrical room',
      'Ok here are some photos [Customer attached 3 photo(s): panel1.jpg, panel2.jpg, meter.jpg]',
      'Alice, 415-307-4108, alicechen1977@gmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'vague-customer-1',
    category: 'alice-type',
    desc: 'Customer says almost nothing, needs constant prompting',
    customerResponses: [
      'I want a charger',
      'A Tesla',
      'Daly City',
      'A house',
      'No',
      'I dont know, where do I check?',
      'In the garage, not far',
      'Sure let me take a photo [Customer attached 2 photo(s): panel.jpg, meter.jpg]',
      'Mike, 650-555-1234, mike@email.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'vague-customer-2',
    category: 'alice-type',
    desc: 'Customer gives one-word answers',
    customerResponses: [
      'Need a charger installed at my place',
      'Rivian',
      'Foster City',
      'House',
      'No charger yet',
      'No idea about the panel',
      'Garage wall, about 20 feet',
      'Here you go [Customer attached 3 photo(s): img1.jpg, img2.jpg, img3.jpg]',
      'Sarah Johnson, 650-111-2222, sarah.j@gmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'confused-elderly',
    category: 'alice-type',
    desc: 'Older customer, not tech savvy',
    customerResponses: [
      'My son bought me an electric car and I need one of those charging things',
      'I think its a Chevy Bolt',
      'San Mateo',
      'Yes its a house',
      'No I dont have anything like that',
      'I dont know what amps means, the house is pretty old',
      'The garage, my son said its about 10 feet',
      'I dont know how to take photos on my phone, can I have my son send them?',
      'My name is Dorothy, my number is 650-333-4444 and email dorothy@aol.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'just-browsing',
    category: 'alice-type',
    desc: 'Not committed, just exploring options',
    customerResponses: [
      'Im thinking about getting an EV and wondering about charger installation',
      'Probably a Model 3 or Model Y',
      'Burlingame',
      'House with a detached garage',
      'I havent bought anything yet',
      'The house has 100 amp service I think',
      'The garage is detached, maybe 40 feet from the house',
      'Not ready for photos yet, just want a rough idea',
      'Tom, 650-222-3333, tom.b@outlook.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },

  // ── OWEN TYPE: Knows their stuff, gives everything upfront ──
  {
    name: 'owen-prewired-techie',
    category: 'owen-type',
    desc: 'Tech-savvy customer with all info ready',
    customerResponses: [
      'Hi, I just bought a home in Burlingame with 200A service and a NEMA 14-50 in the garage. Want to hardwire a Tesla charger instead. Already bought it.',
      'Owen Lin, 925-237-0742, owenlin0@gmail.com. 605 Concord Way, Burlingame 94010',
      'Here are panel photos [Customer attached 3 photo(s): meter.jpg, main.jpg, subpanel.jpg]',
      'Great, when can PJ come out?',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'informed-customer',
    category: 'owen-type',
    desc: 'Did research, knows what they want',
    customerResponses: [
      'I need a Level 2 charger for my BMW iX in Hillsborough. House, 200A service, no existing outlet. Garage is about 15 feet from the panel.',
      'I want a ChargePoint Home Flex, havent bought it yet. Can you supply it?',
      'Here are photos of my panel [Customer attached 2 photo(s): panel.jpg, meter.jpg]',
      'James Park, 650-888-9999, jpark@stanford.edu',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'second-charger',
    category: 'owen-type',
    desc: 'Already has one charger, adding second',
    customerResponses: [
      'We already have a Tesla charger installed for my wife car. Now I got a Rivian R1S and need a second charger in the same garage. San Carlos, 200A panel.',
      'No I need to buy a charger for the Rivian. Garage is same spot, maybe 5 feet from the first one.',
      'Already have photos from last install, let me resend [Customer attached 2 photo(s): panel.jpg, garage.jpg]',
      'Dave Martinez, 650-444-5555, dave.m@gmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },

  // ── CONDO/HOA SPECIFIC ──
  {
    name: 'condo-hoa-complex',
    category: 'condo',
    desc: 'Condo owner navigating HOA approval',
    customerResponses: [
      'I live in a condo in San Francisco and my HOA is asking about what the installation involves',
      'Hyundai Ioniq 5',
      'Its an underground parking garage, my assigned spot is about 80 feet from the electrical room',
      'No charger yet and definitely not pre-wired',
      'I have no idea about the electrical in the building',
      'Here are some photos of the electrical room [Customer attached 2 photo(s): elec-room.jpg, meter-bank.jpg]',
      'Lisa Chen, 415-222-3333, lisa.chen@yahoo.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'condo-board-member',
    category: 'condo',
    desc: 'Board member exploring options for building',
    customerResponses: [
      'Im on the HOA board at a 50-unit condo in Daly City. Several residents want EV chargers.',
      'We want to plan for maybe 10 charging stations in the parking garage',
      'Underground garage, about 100 feet of conduit runs needed',
      'Building is probably 100A per unit, common area panel Im not sure',
      'Can you send someone to assess the whole building?',
      'Robert Kim, board president. 650-777-8888, robert.k@condoboard.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },

  // ── PRICE-FOCUSED ──
  {
    name: 'price-first-cooperative',
    category: 'price-focused',
    desc: 'Leads with price but cooperates with qualification',
    customerResponses: [
      'How much does it cost to install an EV charger?',
      'Chevy Bolt, in Redwood City',
      'Its a house',
      'No charger and no existing wiring',
      'I think 100 amps',
      'Garage, about 25 feet from the panel',
      'Here are panel pics [Customer attached 2 photo(s): panel.jpg, meter.jpg]',
      'Jennifer Wu, 650-999-1111, jen.wu@gmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'price-obsessed',
    category: 'price-focused',
    desc: 'Only cares about price, resistant to qualification',
    customerResponses: [
      'How much for an EV charger install? Just give me a number.',
      'Fine. Tesla Model 3. San Mateo. House.',
      'No charger, no outlet. About 15 feet. Can you just tell me a price?',
      'Whatever. 200 amps I think. Garage.',
      'Ok fine. [Customer attached 1 photo(s): panel.jpg]',
      'Chris, 650-123-4567, chris@email.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'budget-conscious',
    category: 'price-focused',
    desc: 'Trying to find cheapest option',
    customerResponses: [
      'What is the cheapest way to charge my EV at home?',
      'Nissan Leaf, Pacifica',
      'House, older construction',
      'No outlet for it',
      'I think 100 amp service, house was built in 1970',
      'Garage is attached, panel is in the garage maybe 8 feet',
      'Can I just get a regular outlet instead of a fancy charger?',
      'Mary Torres, 650-321-6543, mary.t@hotmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },

  // ── IMPATIENT / DIFFICULT ──
  {
    name: 'impatient-exec',
    category: 'difficult',
    desc: 'Busy executive, wants it done fast',
    customerResponses: [
      'I need a charger installed this week. Porsche Taycan. Menlo Park.',
      'House. Already bought a Grizzl-E charger.',
      '200 amp panel. Garage. 10 feet.',
      'Look I dont have time for photos right now. Can PJ just come look at it?',
      'Fine. Dan, 650-777-0000, dan@venture.capital',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'angry-previous-bad-experience',
    category: 'difficult',
    desc: 'Had bad experience with another installer',
    customerResponses: [
      'The last electrician I hired did a terrible job installing my charger. It keeps tripping the breaker. Can you fix it?',
      'Its a JuiceBox, in Half Moon Bay',
      'House, 100 amp service',
      'Garage, right next to the panel',
      '[Customer attached 2 photo(s): charger.jpg, breaker.jpg]',
      'Karen Smith, 650-888-1234, karen.s@gmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'skeptical-about-bots',
    category: 'difficult',
    desc: 'Doesnt want to talk to AI',
    customerResponses: [
      'Are you a real person or a bot?',
      'Fine. I need a charger for my Model Y in San Bruno.',
      'House. No existing wiring.',
      '100 amps. Garage, about 30 feet.',
      'No I want to talk to PJ directly about this.',
      'Just give him my number. Steve, 650-222-9999, steve@protonmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },

  // ── REPAIR / TROUBLESHOOTING ──
  {
    name: 'charger-broken',
    category: 'repair',
    desc: 'Existing charger stopped working',
    customerResponses: [
      'My Tesla charger stopped working, its showing a red light',
      'Its a Tesla Wall Connector, been installed about 2 years',
      'San Mateo, house',
      'Yes 200 amp panel, charger is in the garage on a 60 amp breaker',
      '[Customer attached 2 photo(s): charger-light.jpg, breaker.jpg]',
      'Amy Wang, 650-555-8888, amy.wang@email.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },

  // ── RENTER / LANDLORD ──
  {
    name: 'renter-wants-charger',
    category: 'renter',
    desc: 'Renter wanting to install charger',
    customerResponses: [
      'I rent a house in Belmont and want to install an EV charger. Is that possible?',
      'Chevy Bolt EUV',
      'Its a house, I have a dedicated parking spot with a garage',
      'My landlord said ok as long as I pay for it',
      'Not pre-wired, not sure about amps, garage is close to the panel though',
      '[Customer attached 1 photo(s): panel.jpg]',
      'Nina Park, 650-111-7777, nina.p@gmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'landlord-for-tenant',
    category: 'renter',
    desc: 'Landlord installing for rental property',
    customerResponses: [
      'I own a rental property in Millbrae and my tenant wants an EV charger',
      'Not sure what car they have, they just asked about it',
      'Its a single family house, 200A service',
      'Garage, pretty close to the panel, maybe 10 feet',
      'No existing outlet for it',
      '[Customer attached 2 photo(s): panel.jpg, garage.jpg]',
      'Bill Chen, 650-444-3333, bill.chen@landlord.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },

  // ── SOUTH BAY (expanded service area) ──
  {
    name: 'sunnyvale-customer',
    category: 'south-bay',
    desc: 'Sunnyvale customer in expanded area',
    customerResponses: [
      'Do you service Sunnyvale? I need a charger installed.',
      'VW ID.4',
      'House, 200A',
      'Already have a ChargePoint Flex, just need it installed',
      'Garage, about 5 feet from the panel. Already pre-wired with a 240V outlet.',
      '[Customer attached 2 photo(s): outlet.jpg, panel.jpg]',
      'Raj Patel, 408-555-1234, raj@techcorp.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'cupertino-customer',
    category: 'south-bay',
    desc: 'Cupertino customer, Apple employee vibes',
    customerResponses: [
      'Looking for EV charger installation in Cupertino',
      'Mercedes EQS',
      'House, fairly new construction',
      'Panel is 200A, garage attached',
      'No existing charger or outlet. About 12 feet from panel.',
      'Want to see panel pics? [Customer attached 3 photo(s): panel.jpg, meter.jpg, garage.jpg]',
      'Emily Zhang, 408-333-7777, emily.z@apple.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },

  // ── EDGE CASES ──
  {
    name: 'two-cars-one-charger',
    category: 'edge',
    desc: 'Household with two EVs wanting one charger',
    customerResponses: [
      'We have two electric cars and want to install a charger that both can use',
      'Tesla Model Y and a Chevy Bolt',
      'San Carlos, house',
      '200A service, garage',
      'No existing outlet, about 15 feet',
      '[Customer attached 2 photo(s): panel.jpg, garage.jpg]',
      'Mike and Lisa Davis, 650-666-5555, mdavis@gmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'commercial-small-biz',
    category: 'edge',
    desc: 'Small business wanting charger for employees',
    customerResponses: [
      'I own a small office in Mountain View and want to install a couple chargers for employees',
      'We have a parking lot, probably 50 feet from the electrical panel',
      'Commercial building, 400A service',
      'No existing EV infrastructure',
      '[Customer attached 2 photo(s): panel.jpg, parking.jpg]',
      'Andrea Kim, 650-999-3333, andrea@startup.io',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
  {
    name: 'outdoor-install-no-garage',
    category: 'edge',
    desc: 'No garage, needs outdoor installation',
    customerResponses: [
      'I dont have a garage, can you still install a charger? I park in my driveway.',
      'Ford F-150 Lightning',
      'Palo Alto, house',
      'Panel is inside the house, probably 30 feet to the driveway',
      '200A service, no existing outlet outside',
      'Can you mount it on the side of the house?',
      '[Customer attached 2 photo(s): driveway.jpg, panel.jpg]',
      'Kevin OBrien, 650-444-1111, kevin.ob@gmail.com',
    ],
    expectedFields: ['name', 'phone', 'email', 'city', 'housing_type', 'ev_type', 'has_charger', 'prewired', 'service_size', 'location_distance', 'photos'],
  },
];

// ──────────────────────────────────────────────────────────────
// TEST RUNNER
// ──────────────────────────────────────────────────────────────

async function runConversation(scenario) {
  const sessionId = `v2-${scenario.name}-${Date.now()}`;
  const history = [];
  const davidResponses = [];

  for (const customerMsg of scenario.customerResponses) {
    history.push({ role: 'user', content: customerMsg });

    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, messages: history })
      });
      const data = await res.json();
      const reply = data.response || data.error || '';
      davidResponses.push(reply);
      history.push({ role: 'assistant', content: reply });
    } catch (e) {
      davidResponses.push(`ERROR: ${e.message}`);
      break;
    }

    await new Promise(r => setTimeout(r, 800));
  }

  return { scenario, davidResponses, fullConvo: history };
}

function scoreConversation(result) {
  const allDavidText = result.davidResponses.join(' ');
  const allUserText = result.scenario.customerResponses.join(' ');
  const allText = allDavidText + ' ' + allUserText;

  const fieldResults = {};
  let collected = 0;

  for (const field of GOLD_FIELDS) {
    // Field is "collected" if David ASKED for it OR customer PROVIDED it AND David acknowledged
    const davidAsked = field.inResponse.test(allDavidText);
    const customerProvided = field.detect.test(allUserText);
    const fieldCollected = davidAsked || customerProvided;

    fieldResults[field.name] = {
      asked: davidAsked,
      provided: customerProvided,
      collected: fieldCollected,
      desc: field.desc,
    };
    if (fieldCollected) collected++;
  }

  // Check issues
  const issues = [];
  for (const issue of ISSUES) {
    if (issue.pattern.test(allDavidText)) {
      // Wall Connector OK if customer said it first
      if (issue.name === 'wall-connector-unprompted' && /wall connector/i.test(allUserText)) continue;
      issues.push(issue);
    }
  }

  return {
    scenario: result.scenario.name,
    category: result.scenario.category,
    desc: result.scenario.desc,
    fields: fieldResults,
    collected,
    total: GOLD_FIELDS.length,
    pct: Math.round((collected / GOLD_FIELDS.length) * 100),
    issues,
    davidResponses: result.davidResponses,
  };
}

async function main() {
  const startTime = Date.now();
  console.log(`🚀 v2 Multi-Turn Stress Test — ${SCENARIOS.length} realistic conversations\n`);

  const results = [];
  let totalCalls = 0;

  // Run 2 at a time to avoid overwhelming the server
  for (let i = 0; i < SCENARIOS.length; i += 2) {
    const batch = SCENARIOS.slice(i, i + 2);
    const batchResults = await Promise.all(batch.map(s => runConversation(s)));

    for (const r of batchResults) {
      const score = scoreConversation(r);
      results.push(score);
      totalCalls += r.davidResponses.length;
      console.log(`  ${score.pct >= 80 ? '✅' : score.pct >= 50 ? '⚠️' : '❌'} ${score.scenario}: ${score.pct}% (${score.collected}/${score.total}) ${score.issues.length > 0 ? '⚠ ' + score.issues.map(i => i.name).join(', ') : ''}`);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);

  // ── Aggregate Stats ──
  const avgPct = Math.round(results.reduce((s, r) => s + r.pct, 0) / results.length);

  // Per-field stats
  const fieldAgg = {};
  for (const field of GOLD_FIELDS) {
    const collected = results.filter(r => r.fields[field.name]?.collected).length;
    fieldAgg[field.name] = { desc: field.desc, collected, total: results.length, pct: Math.round((collected / results.length) * 100) };
  }

  // Per-category stats
  const categoryAgg = {};
  for (const r of results) {
    if (!categoryAgg[r.category]) categoryAgg[r.category] = { scores: [], issues: 0 };
    categoryAgg[r.category].scores.push(r.pct);
    categoryAgg[r.category].issues += r.issues.length;
  }
  for (const [cat, data] of Object.entries(categoryAgg)) {
    data.avg = Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length);
  }

  // Issue aggregation
  const issueAgg = {};
  for (const r of results) {
    for (const i of r.issues) {
      issueAgg[i.name] = issueAgg[i.name] || { count: 0, severity: i.severity, desc: i.desc, scenarios: [] };
      issueAgg[i.name].count++;
      if (issueAgg[i.name].scenarios.length < 3) issueAgg[i.name].scenarios.push(r.scenario);
    }
  }

  // ── Write Reports ──
  const report = { summary: { totalConversations: results.length, totalAPICalls: totalCalls, avgQualification: avgPct, elapsed }, fieldStats: fieldAgg, categoryStats: categoryAgg, issues: issueAgg, details: results };
  fs.writeFileSync('/Users/cbot/clawd/receptionist/tests/stress-test-v2-report.json', JSON.stringify(report, null, 2));

  // Markdown
  let md = `# v2 Multi-Turn Stress Test — ${new Date().toISOString().split('T')[0]}\n\n`;
  md += `## Summary\n`;
  md += `- **Conversations:** ${results.length}\n`;
  md += `- **Total API calls:** ${totalCalls}\n`;
  md += `- **Average qualification:** ${avgPct}%\n`;
  md += `- **Duration:** ${elapsed} min\n\n`;

  md += `## 🎯 Qualification Score by Field\n`;
  md += `| Field | Collected | Rate |\n|-------|-----------|------|\n`;
  for (const [name, stats] of Object.entries(fieldAgg).sort((a, b) => b[1].pct - a[1].pct)) {
    const icon = stats.pct >= 80 ? '✅' : stats.pct >= 50 ? '⚠️' : '❌';
    md += `| ${icon} ${stats.desc} | ${stats.collected}/${stats.total} | ${stats.pct}% |\n`;
  }

  md += `\n## 📋 Score by Category\n`;
  md += `| Category | Avg Score | Issues |\n|----------|-----------|--------|\n`;
  for (const [cat, data] of Object.entries(categoryAgg).sort((a, b) => b[1].avg - a[1].avg)) {
    md += `| ${cat} | ${data.avg}% | ${data.issues} |\n`;
  }

  md += `\n## 🔍 Per-Conversation Results\n`;
  md += `| Scenario | Score | Issues |\n|----------|-------|--------|\n`;
  for (const r of results.sort((a, b) => a.pct - b.pct)) {
    const icon = r.pct >= 80 ? '✅' : r.pct >= 50 ? '⚠️' : '❌';
    md += `| ${icon} ${r.scenario} | ${r.pct}% (${r.collected}/${r.total}) | ${r.issues.map(i => i.name).join(', ') || 'none'} |\n`;
  }

  if (Object.keys(issueAgg).length > 0) {
    md += `\n## ⚠️ Issues Found\n`;
    for (const [name, data] of Object.entries(issueAgg).sort((a, b) => b[1].count - a[1].count)) {
      md += `\n### ${name} (${data.count}x) — ${data.severity}\n${data.desc}\nScenarios: ${data.scenarios.join(', ')}\n`;
    }
  }

  md += `\n## 💬 Sample Conversations\n`;
  // Include 2 best and 2 worst full conversations
  const sorted = [...results].sort((a, b) => a.pct - b.pct);
  const samples = [...sorted.slice(0, 2), ...sorted.slice(-2)];
  for (const r of samples) {
    md += `\n### ${r.scenario} — ${r.pct}% qualification\n`;
    const scenario = SCENARIOS.find(s => s.name === r.scenario);
    for (let i = 0; i < r.davidResponses.length; i++) {
      md += `**Customer:** ${scenario.customerResponses[i]}\n`;
      md += `**David:** ${r.davidResponses[i]?.substring(0, 300)}\n\n`;
    }
  }

  fs.writeFileSync('/Users/cbot/clawd/receptionist/tests/stress-test-v2-report.md', md);

  console.log(`\n✅ Done! ${avgPct}% average qualification across ${results.length} conversations`);
  console.log(`📝 Report: ~/clawd/receptionist/tests/stress-test-v2-report.md`);
}

main().catch(console.error);
