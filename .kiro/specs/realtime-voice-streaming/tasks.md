# Implementation Plan: Realtime Voice Streaming

## Overview

Upgrade the AI Phone Receptionist from Twilio Gather-based turn-by-turn speech to real-time bidirectional audio streaming using Twilio Media Streams and a pluggable Realtime AI Provider (initially OpenAI Realtime API). The implementation proceeds incrementally: config → abstractions → OpenAI adapter → relay service → server integration → call summary integration → cleanup/fallback.

## Tasks

- [x] 1. Configuration and environment setup
  - [x] 1.1 Add new config fields to `src/config.js`
    - Add `openai.apiKey` from `OPENAI_API_KEY` (nullable, not required)
    - Add `openai.realtimeVoice` from `OPENAI_REALTIME_VOICE` (default: `alloy`)
    - Add `realtime.provider` from `REALTIME_AI_PROVIDER` (default: `openai`)
    - Log warning if `OPENAI_API_KEY` is not set
    - Do NOT add `OPENAI_API_KEY` to the required validation list
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  - [x] 1.2 Update `.env.example` with new environment variables
    - Add `OPENAI_API_KEY`, `OPENAI_REALTIME_VOICE`, `REALTIME_AI_PROVIDER` with comments
    - _Requirements: 8.5_

- [x] 2. Provider Adapter abstraction and factory
  - [x] 2.1 Create `src/realtime/provider-adapter.js` base class
    - Define `connect(options)`, `sendAudio(payload)`, `cancelResponse()`, `close()` methods
    - Define callback properties: `onAudioOutput`, `onTranscript`, `onSpeechStarted`, `onError`, `onClose`
    - _Requirements: 3.1_
  - [x] 2.2 Create `src/realtime/provider-factory.js`
    - Implement `createProviderAdapter(providerName, config)` that returns the correct adapter or `null`
    - Default to `'openai'` when providerName is not specified
    - Return `null` when API key is missing or provider is unknown
    - _Requirements: 3.3, 8.3_
  - [ ]* 2.3 Write property test for provider factory (Property 4)
    - **Property 4: Provider factory selection**
    - **Validates: Requirements 3.3, 8.3**

- [x] 3. Session Manager
  - [x] 3.1 Create `src/realtime/session-manager.js`
    - Implement `addSession(streamSid, relayService)`, `getSession(streamSid)`, `removeSession(streamSid)`, `getActiveCount()`
    - Use a Map for session storage
    - _Requirements: 10.1_

- [x] 4. OpenAI Realtime API Provider Adapter
  - [x] 4.1 Create `src/realtime/openai-adapter.js` extending ProviderAdapter
    - Implement `connect(options)`: open WebSocket to `wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview-2024-12-17` with API key in headers
    - On connection open: send `session.update` with voice, `g711_ulaw` input/output format, server VAD turn detection, `whisper-1` transcription, and system instructions from options
    - Implement `sendAudio(payload)`: send `input_audio_buffer.append` event
    - Implement `cancelResponse()`: send `response.cancel` event
    - Implement `close()`: close WebSocket
    - Wire incoming events to callbacks: `response.audio.delta` → `onAudioOutput`, `response.audio_transcript.done` → `onTranscript('assistant', ...)`, `conversation.item.input_audio_transcription.completed` → `onTranscript('caller', ...)`, `input_audio_buffer.speech_started` → `onSpeechStarted`, errors → `onError`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
  - [ ]* 4.2 Write property test for OpenAI session.update message structure (Property 6)
    - **Property 6: OpenAI session.update message structure**
    - **Validates: Requirements 4.2**
  - [ ]* 4.3 Write property test for OpenAI audio input encoding (Property 7)
    - **Property 7: OpenAI audio input message encoding**
    - **Validates: Requirements 4.3**
  - [ ]* 4.4 Write unit tests for OpenAI adapter event handling
    - Test that mock OpenAI WebSocket events trigger correct callbacks
    - Test error and close event handling
    - _Requirements: 4.4, 4.5, 4.6, 4.7, 4.8_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Relay Service
  - [x] 6.1 Create `src/realtime/relay-service.js`
    - Constructor takes: twilioWs, providerAdapter, callSid, streamSid, callerInfo
    - Implement `initialize(options)`: wire provider callbacks, call `provider.connect(options)`
    - Implement `handleTwilioMedia(payload)`: forward audio to provider via `sendAudio`
    - Implement `sendAudioToTwilio(audio)`: format and send Twilio media message `{ event: 'media', streamSid, media: { payload } }`
    - Implement `handleInterruption()`: send Twilio clear message `{ event: 'clear', streamSid }`, call `provider.cancelResponse()`
    - Implement `addTranscript(role, text)`: append to `conversationHistory` array
    - Implement `cleanup()`: idempotent (use `closed` flag), close provider, generate call summary, remove session from session manager, add errors to error buffer
    - _Requirements: 2.2, 2.3, 2.4, 2.5, 3.4, 5.1, 5.2, 5.3, 5.4, 6.1, 6.2, 6.3, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3_
  - [ ]* 6.2 Write property test for audio forwarding (Property 3)
    - **Property 3: Audio forwarding to provider**
    - **Validates: Requirements 2.3, 5.1**
  - [ ]* 6.3 Write property test for Twilio media message formatting (Property 8)
    - **Property 8: Twilio media message formatting**
    - **Validates: Requirements 5.2**
  - [ ]* 6.4 Write property test for transcript storage and ordering (Property 9)
    - **Property 9: Transcript storage preserves order and content**
    - **Validates: Requirements 6.1, 6.2, 6.3**
  - [ ]* 6.5 Write property test for session cleanup (Property 11)
    - **Property 11: Session cleanup removes all references**
    - **Validates: Requirements 10.4**
  - [ ]* 6.6 Write property test for error buffer population (Property 12)
    - **Property 12: Streaming errors added to error buffer**
    - **Validates: Requirements 11.3**
  - [ ]* 6.7 Write unit tests for relay service
    - Test interruption flow (speech-started → clear + cancel)
    - Test idempotent cleanup (double cleanup does not throw)
    - Test cleanup on abnormal disconnection
    - _Requirements: 5.3, 5.4, 10.2, 10.3, 11.1, 11.2_

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Server integration
  - [x] 8.1 Update `/incoming-call` handler in `src/server.js`
    - Compute `realtimeAvailable` flag based on whether `createProviderAdapter` returns non-null
    - When realtime is available: return TwiML with `<Connect><Stream url="wss://${host}/media-stream"><Parameter name="callSid" value="${callSid}" /></Stream></Connect>`
    - When realtime is NOT available: return existing Gather-based TwiML (unchanged)
    - _Requirements: 1.1, 1.2, 1.3, 9.5_
  - [x] 8.2 Replace stubbed WebSocket handler in `src/server.js`
    - On `start` event: extract callSid from customParameters, extract streamSid, create provider adapter via factory, create RelayService, add to SessionManager, call `relay.initialize()` with system prompt + website context + availability context
    - On `media` event: call `relay.handleTwilioMedia(data.media.payload)`
    - On `stop` event: call `relay.cleanup()`
    - On WebSocket `close`: call `relay.cleanup()`
    - On WebSocket `error`: log error, call `relay.cleanup()`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.2, 3.4_
  - [ ]* 8.3 Write property test for streaming TwiML generation (Property 1)
    - **Property 1: Streaming TwiML generation correctness**
    - **Validates: Requirements 1.1, 1.2, 1.3**
  - [ ]* 8.4 Write property test for Gather fallback (Property 10)
    - **Property 10: Gather fallback when realtime unavailable**
    - **Validates: Requirements 9.5**

- [x] 9. Call summary integration for streaming calls
  - [x] 9.1 Wire call summary generation into RelayService cleanup
    - Convert `conversationHistory` array to the format expected by `call-summary.js` (`{ role: 'user'|'assistant', content: text }`)
    - Call `callSummary.saveCallSummary()` with callSid, callerInfo, timestamps, and formatted history
    - Handle empty transcript case (create log noting no conversation)
    - _Requirements: 7.1, 7.2, 7.3_
  - [ ]* 9.2 Write unit tests for call summary integration
    - Test transcript format conversion
    - Test empty transcript handling
    - _Requirements: 7.1, 7.3_

- [ ] 10. Backward compatibility verification
  - [ ]* 10.1 Write unit tests verifying existing endpoints are unchanged
    - Verify `/api/chat` still works
    - Verify admin endpoints still work
    - Verify Gather fallback produces correct TwiML
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 11. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All new source files go in `src/realtime/` to keep the feature organized
- Existing files (`server.js`, `config.js`) are modified minimally
- The `ws` package is already installed — no new dependencies needed for WebSocket handling
