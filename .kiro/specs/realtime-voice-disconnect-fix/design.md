# Realtime Voice Disconnect Fix - Bugfix Design

## Overview

This bugfix addresses WebSocket connection timeouts that occur approximately 55 seconds into real-time voice calls. The issue stems from the absence of keepalive mechanisms on both the OpenAI Realtime API WebSocket and the Twilio Media Stream WebSocket connections. When no data is transmitted for ~60 seconds, these connections silently timeout, causing the AI assistant to become unresponsive until the caller speaks again.

The fix implements periodic keepalive ping mechanisms for both WebSocket connections to prevent inactivity timeouts while preserving all existing audio relay, interruption handling, and cleanup functionality.

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug - when WebSocket connections experience 60+ seconds of silence without keepalive messages
- **Property (P)**: The desired behavior - WebSocket connections remain active indefinitely regardless of silence periods
- **Preservation**: Existing audio relay, interruption handling, transcription, and cleanup behaviors that must remain unchanged
- **RelayService**: The class in `src/realtime/relay-service.js` that bridges Twilio and provider WebSocket connections
- **OpenAIAdapter**: The class in `src/realtime/openai-adapter.js` that manages the OpenAI Realtime API WebSocket connection
- **Keepalive Interval**: The time period between ping messages sent to prevent connection timeout (must be < 60 seconds)
- **Ping Message**: A lightweight message sent to keep a WebSocket connection alive without affecting application logic

## Bug Details

### Fault Condition

The bug manifests when both the caller and AI assistant are silent for approximately 60 seconds. During this silence period, no audio data flows through either WebSocket connection (Twilio Media Stream or OpenAI Realtime API), causing both connections to timeout due to inactivity. The connections silently drop without triggering error handlers, and the system only recovers when the caller speaks, which re-establishes the connection.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type { twilioWsState, openaiWsState, silenceDuration }
  OUTPUT: boolean
  
  RETURN input.silenceDuration >= 60_000 milliseconds
         AND input.twilioWsState == 'OPEN'
         AND input.openaiWsState == 'OPEN'
         AND noAudioTransmitted(input.silenceDuration)
         AND noKeepaliveMessagesSent(input.silenceDuration)
END FUNCTION
```

### Examples

- **Scenario 1**: Caller asks a question at 10s, AI responds until 25s, then both parties are silent. At 85s (60s of silence), the connection drops. Caller speaks at 90s and connection recovers.
- **Scenario 2**: AI gives a long explanation ending at 40s, caller is thinking. At 100s (60s of silence), connection drops. Caller says "hello?" at 105s and connection recovers.
- **Scenario 3**: Call starts at 0s with greeting, ends at 15s. Silence from 15s to 75s. At 75s (60s of silence), connection drops silently.
- **Edge Case**: Continuous conversation with no silence periods longer than 60s - connection remains stable (expected behavior, no bug).

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Audio relay from Twilio to OpenAI must continue to work exactly as before
- Audio relay from OpenAI to Twilio must continue to work exactly as before
- Caller interruption handling (clearing Twilio playback and cancelling OpenAI response) must remain unchanged
- Transcription capture for both caller and assistant must remain unchanged
- Call summary generation at call end must remain unchanged
- Error handling and logging must remain unchanged
- Session cleanup and resource management must remain unchanged

**Scope:**
All inputs that involve active audio transmission or existing WebSocket events should be completely unaffected by this fix. This includes:
- Media events from Twilio containing audio payloads
- Audio delta events from OpenAI
- Transcription events from both services
- Speech detection events (VAD)
- Error events and connection close events
- All existing message types and event handlers

## Hypothesized Root Cause

Based on the bug description and timing analysis, the root causes are:

1. **Missing Keepalive on OpenAI WebSocket**: The OpenAI Realtime API WebSocket connection in `openai-adapter.js` does not send any keepalive messages during silence periods. WebSocket connections typically timeout after 60 seconds of no data transmission.

2. **Missing Keepalive on Twilio WebSocket**: The Twilio Media Stream WebSocket connection managed in `relay-service.js` does not send any keepalive messages during silence periods. Twilio's infrastructure may also timeout inactive connections.

3. **No Ping/Pong Implementation**: Neither WebSocket connection implements the standard WebSocket ping/pong protocol, which is designed specifically to prevent inactivity timeouts.

4. **Silent Failure Mode**: When the connections timeout, they don't trigger error events immediately, causing the system to appear functional while actually being disconnected. The connection only recovers when new audio data is sent, which re-establishes the connection.

## Correctness Properties

Property 1: Fault Condition - WebSocket Keepalive Prevents Timeout

_For any_ real-time voice call where silence periods exceed 60 seconds, the fixed system SHALL send periodic keepalive ping messages on both WebSocket connections at intervals shorter than the timeout threshold (recommended: every 30 seconds), preventing connection drops and maintaining continuous bidirectional audio capability.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

Property 2: Preservation - Existing WebSocket Behavior

_For any_ WebSocket event or audio transmission that is NOT a keepalive ping, the fixed code SHALL produce exactly the same behavior as the original code, preserving all audio relay, interruption handling, transcription capture, error handling, and cleanup functionality.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File 1**: `src/realtime/openai-adapter.js`

**Function**: `connect()` and new `_startKeepalive()` / `_stopKeepalive()` methods

**Specific Changes**:
1. **Add Keepalive Timer**: Create an interval timer that sends ping messages to the OpenAI WebSocket every 30 seconds
   - Store timer reference as instance variable: `this.keepaliveInterval`
   - Start timer after WebSocket connection opens
   - Use `setInterval()` with 30000ms interval (30 seconds)

2. **Implement Ping Message Sending**: Send a lightweight message that doesn't affect conversation state
   - Use `session.update` with empty update as keepalive (safe, idempotent)
   - Alternative: Use WebSocket native ping if supported by OpenAI
   - Log ping messages at debug level for troubleshooting

3. **Stop Keepalive on Close**: Clear the interval timer when connection closes
   - Add cleanup in `close()` method
   - Use `clearInterval(this.keepaliveInterval)`
   - Set `this.keepaliveInterval = null`

4. **Handle Keepalive Errors**: Catch and log any errors from ping sending
   - Wrap ping send in try-catch
   - Don't propagate keepalive errors to main error handler
   - Log at debug level to avoid noise

**File 2**: `src/realtime/relay-service.js`

**Function**: `initialize()` and new `_startKeepalive()` / `_stopKeepalive()` methods

**Specific Changes**:
1. **Add Keepalive Timer**: Create an interval timer that sends ping messages to the Twilio WebSocket every 30 seconds
   - Store timer reference as instance variable: `this.keepaliveInterval`
   - Start timer after initialization completes
   - Use `setInterval()` with 30000ms interval (30 seconds)

2. **Implement Ping Message Sending**: Send a lightweight message that doesn't affect media stream
   - Use Twilio's `mark` event as keepalive (documented, safe, no side effects)
   - Format: `{ event: 'mark', streamSid: this.streamSid, mark: { name: 'keepalive' } }`
   - Log ping messages at debug level for troubleshooting

3. **Stop Keepalive on Cleanup**: Clear the interval timer during cleanup
   - Add cleanup in `cleanup()` method
   - Use `clearInterval(this.keepaliveInterval)`
   - Set `this.keepaliveInterval = null`

4. **Handle Keepalive Errors**: Catch and log any errors from ping sending
   - Wrap ping send in try-catch
   - Check WebSocket readyState before sending
   - Don't propagate keepalive errors to main error handler

**File 3**: `src/config.js` (optional enhancement)

**Configuration**: Add keepalive interval configuration

**Specific Changes**:
1. **Add Keepalive Config**: Add configurable keepalive interval to config object
   - Default: 30000ms (30 seconds)
   - Environment variable: `WEBSOCKET_KEEPALIVE_INTERVAL_MS`
   - Validate: must be positive integer less than 60000ms

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code by simulating long silence periods, then verify the fix works correctly by confirming keepalive messages are sent and connections remain stable.

### Exploratory Fault Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm that WebSocket connections timeout after 60 seconds of silence without keepalive messages.

**Test Plan**: Write tests that establish WebSocket connections, simulate silence periods of 60+ seconds, and observe connection state. Run these tests on the UNFIXED code to observe failures and confirm the root cause.

**Test Cases**:
1. **OpenAI WebSocket Timeout Test**: Connect to OpenAI WebSocket, wait 65 seconds without sending data, verify connection drops (will fail on unfixed code)
2. **Twilio WebSocket Timeout Test**: Establish Twilio Media Stream, wait 65 seconds without sending media, verify connection drops (will fail on unfixed code)
3. **Combined Silence Test**: Start a call, send initial greeting, then simulate 65 seconds of silence from both parties, verify both connections drop (will fail on unfixed code)
4. **Short Silence Test**: Simulate 30 seconds of silence - connections should remain stable (may pass on unfixed code, validates timeout threshold)

**Expected Counterexamples**:
- WebSocket connections transition to CLOSED state after 60+ seconds of inactivity
- No error events are triggered, connections silently drop
- Possible causes: no keepalive mechanism, no ping/pong implementation, inactivity timeout

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds (60+ seconds of silence), the fixed system sends keepalive messages and maintains connection stability.

**Pseudocode:**
```
FOR ALL call_scenario WHERE silenceDuration >= 60_000 DO
  connections := startRealtimeCall()
  simulateSilence(silenceDuration)
  ASSERT connections.openai.state == 'OPEN'
  ASSERT connections.twilio.state == 'OPEN'
  ASSERT keepaliveMessagesSent(connections) >= floor(silenceDuration / 30_000)
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where active audio transmission occurs, the fixed system produces the same result as the original system.

**Pseudocode:**
```
FOR ALL audio_event WHERE NOT isSilence(audio_event) DO
  ASSERT handleAudio_original(audio_event) == handleAudio_fixed(audio_event)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across different audio patterns
- It catches edge cases like rapid interruptions, overlapping speech, and various silence durations
- It provides strong guarantees that existing behavior is unchanged for all non-silence scenarios

**Test Plan**: Observe behavior on UNFIXED code first for active conversations, interruptions, and transcription, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Audio Relay Preservation**: Verify that audio continues to flow correctly in both directions with keepalive enabled
2. **Interruption Preservation**: Verify that caller interruptions still trigger clear and cancel events correctly
3. **Transcription Preservation**: Verify that transcription events are still captured correctly
4. **Cleanup Preservation**: Verify that call end cleanup still generates summaries and removes sessions correctly

### Unit Tests

- Test keepalive timer initialization in OpenAIAdapter
- Test keepalive timer initialization in RelayService
- Test keepalive message format for OpenAI (session.update)
- Test keepalive message format for Twilio (mark event)
- Test keepalive timer cleanup on connection close
- Test keepalive error handling (WebSocket closed during ping)
- Test that keepalive doesn't interfere with normal message flow

### Property-Based Tests

- Generate random silence durations (0-120 seconds) and verify keepalive messages are sent at correct intervals
- Generate random audio patterns (speech, silence, interruptions) and verify connections remain stable
- Generate random call durations and verify keepalive continues throughout entire call
- Test that keepalive messages don't affect conversation history or transcription

### Integration Tests

- Test full call flow with 90 seconds of silence - verify connection remains stable
- Test call with multiple silence periods - verify keepalive works across entire call
- Test rapid interruptions during keepalive period - verify no conflicts
- Test call end during keepalive interval - verify cleanup works correctly
- Test that keepalive stops when connection closes naturally
