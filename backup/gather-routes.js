// Gather fallback routes — extracted from server.js
// These routes handled turn-by-turn speech recognition calls via Twilio Gather.
// See backup/README.md for restoration instructions.

// ── /incoming-call else branch ────────────────────────────────────────────────
// Replace the realtimeAvailable check in /incoming-call with:
//
// if (realtimeAvailable) {
//   ... realtime TwiML (unchanged) ...
// } else {
//   callHandler.startCall(callSid, { from, to });
//   const twiml = `<?xml version="1.0" encoding="UTF-8"?>
// <Response>
//   <Say voice="Polly.Joanna">${escapeXml(prompts.greeting)}</Say>
//   <Gather input="speech" action="/handle-speech" timeout="5" speechTimeout="auto">
//   </Gather>
//   <Say voice="Polly.Joanna">I didn't hear anything. Goodbye!</Say>
//   <Hangup/>
// </Response>`;
//   res.type('text/xml');
//   res.send(twiml);
// }

// ── /call-status ──────────────────────────────────────────────────────────────
// app.post('/call-status', async (req, res) => {
//   const callSid = req.body.CallSid;
//   const callStatus = req.body.CallStatus;
//   console.log(`📊 Call status update: ${callSid} - ${callStatus}`);
//   if (callStatus === 'completed') {
//     await callHandler.endCall(callSid);
//   }
//   res.sendStatus(200);
// });

// ── /call-summaries (legacy HTML view) ────────────────────────────────────────
// app.get('/call-summaries', (req, res) => {
//   const callSummaryManager = require('./call-summary');
//   const summaries = callSummaryManager.getAllSummaries();
//   const html = `<!DOCTYPE html><html>...`; // full HTML view of call summaries
//   res.send(html);
// });

// ── /handle-speech ────────────────────────────────────────────────────────────
// app.post('/handle-speech', async (req, res) => {
//   const speechResult = req.body.SpeechResult;
//   const callSid = req.body.CallSid;
//   console.log(`💬 Caller said: "${speechResult}"`);
//
//   if (!speechResult) {
//     const twiml = `<?xml version="1.0" encoding="UTF-8"?>
// <Response>
//   <Say voice="Polly.Joanna">${escapeXml(prompts.noSpeechDetected)}</Say>
//   <Gather input="speech" action="/handle-speech" timeout="5" speechTimeout="auto">
//     <Say voice="Polly.Joanna">I'm listening.</Say>
//   </Gather>
//   <Hangup/>
// </Response>`;
//     res.type('text/xml');
//     res.send(twiml);
//     return;
//   }
//
//   try {
//     const aiResponse = await callHandler.processText(callSid, speechResult);
//     const twiml = `<?xml version="1.0" encoding="UTF-8"?>
// <Response>
//   <Say voice="Polly.Joanna">${escapeXml(aiResponse)}</Say>
//   <Gather input="speech" action="/handle-speech" timeout="5" speechTimeout="auto">
//   </Gather>
//   <Say voice="Polly.Joanna">${escapeXml(prompts.closing)}</Say>
//   <Hangup/>
// </Response>`;
//     res.type('text/xml');
//     res.send(twiml);
//   } catch (error) {
//     console.error('❌ Error handling speech:', error);
//     errorBuffer.add(error, 'handle-speech');
//     const twiml = `<?xml version="1.0" encoding="UTF-8"?>
// <Response>
//   <Say voice="Polly.Joanna">${escapeXml(prompts.error)}</Say>
//   <Hangup/>
// </Response>`;
//     res.type('text/xml');
//     res.send(twiml);
//   }
// });
