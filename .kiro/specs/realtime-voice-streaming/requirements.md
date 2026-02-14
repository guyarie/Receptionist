# Requirements Document: Realtime Voice Streaming

## Introduction

This document specifies the requirements for upgrading the AI Phone Receptionist from the current Twilio Gather-based (turn-by-turn) speech recognition to a real-time bidirectional audio streaming approach. The current system uses Twilio's `<Gather>` verb for speech-to-text and `<Say>` with Polly voices for TTS, creating a clunky turn-based experience. The upgrade replaces this with Twilio Media Streams connected to a Realtime AI Provider, enabling low-latency, interruptible, natural conversation. The initial implementation will use OpenAI's Realtime API as the provider, but the architecture will support swapping to alternative providers (e.g., Google Gemini Live, or a custom STT+LLM+TTS pipeline) in the future. The existing text-based web chat, admin UI, call summaries, and all other non-voice features remain unchanged.

## Glossary

- **System**: The AI Phone Receptionist Node.js application
- **Caller**: A person calling the RTC phone number via Twilio
- **Twilio_Media_Stream**: A Twilio feature that streams raw call audio bidirectionally over a WebSocket connection
- **Realtime_AI_Provider**: An external service that accepts streaming audio input and produces streaming audio and text output in real time; the initial implementation uses OpenAI's Realtime API
- **Media_Stream_WebSocket**: The WebSocket endpoint on the System that receives audio from Twilio and relays it to the Realtime_AI_Provider
- **Relay_Service**: The component within the System that bridges the Twilio_Media_Stream WebSocket and the Realtime_AI_Provider connection
- **Provider_Adapter**: An abstraction layer that translates between the Relay_Service's internal interface and a specific Realtime_AI_Provider's protocol
- **Session**: A single phone call's lifecycle from connection to hangup, including both WebSocket connections and conversation state
- **Mulaw_Audio**: Audio encoded in G.711 μ-law format at 8kHz, the format used by Twilio_Media_Stream
- **Stream_SID**: A unique identifier assigned by Twilio to each media stream instance
- **Call_SID**: A unique identifier assigned by Twilio to each phone call
- **Transcript**: The text representation of a voice conversation, captured from Realtime_AI_Provider events
- **Call_Log**: A JSON file in `call-summaries/` containing a call transcript and AI-generated summary
- **OpenRouter**: AI model API service used for text-based chat and call summary generation (unchanged)
- **Admin_UI**: The web-based dashboard served at `/admin` (unchanged)

## Requirements

### Requirement 1: Incoming Call TwiML Response

**User Story:** As a Caller, I want my phone call to be connected to a real-time audio stream so that I can have a natural, low-latency conversation with the AI receptionist.

#### Acceptance Criteria

1. WHEN a Caller dials the Twilio phone number and a Realtime_AI_Provider is configured, THE System SHALL return a TwiML response containing a `<Connect><Stream>` element that directs Twilio to open a Twilio_Media_Stream WebSocket to the System's `/media-stream` endpoint
2. WHEN the TwiML response is generated, THE System SHALL include the Call_SID as a custom parameter in the `<Stream>` element so the Relay_Service can associate the stream with the call
3. WHEN the TwiML response is generated, THE System SHALL construct the WebSocket URL using the request's `Host` header with the `wss://` protocol scheme

### Requirement 2: Twilio Media Stream WebSocket Handling

**User Story:** As a System operator, I want the server to accept and manage Twilio Media Stream WebSocket connections so that caller audio can be received and responses sent back.

#### Acceptance Criteria

1. WHEN Twilio opens a WebSocket connection to `/media-stream`, THE Media_Stream_WebSocket SHALL accept the connection and wait for stream events
2. WHEN a `start` event is received on the Twilio WebSocket, THE Relay_Service SHALL extract the Stream_SID, Call_SID, and audio encoding parameters and initialize a new Session
3. WHEN a `media` event is received on the Twilio WebSocket, THE Relay_Service SHALL extract the base64-encoded Mulaw_Audio payload and forward it to the Realtime_AI_Provider connection for that Session
4. WHEN a `stop` event is received on the Twilio WebSocket, THE Relay_Service SHALL initiate Session cleanup including closing the Realtime_AI_Provider connection
5. WHEN the Twilio WebSocket connection closes unexpectedly, THE Relay_Service SHALL clean up the associated Session and log the disconnection

### Requirement 3: Realtime AI Provider Abstraction

**User Story:** As a System operator, I want the real-time voice AI provider to be abstracted behind a common interface so that I can swap providers in the future without rewriting the relay logic.

#### Acceptance Criteria

1. THE Provider_Adapter SHALL define a common interface with methods for: opening a connection, sending audio input, receiving audio output events, receiving transcript events, and closing the connection
2. WHEN a new Session is initialized, THE Relay_Service SHALL instantiate the configured Provider_Adapter and use only the common interface to communicate with the Realtime_AI_Provider
3. THE System SHALL read a `REALTIME_AI_PROVIDER` environment variable to determine which Provider_Adapter to use, defaulting to `openai` if not set
4. WHEN the Provider_Adapter connection is established, THE Relay_Service SHALL pass the system prompt content, website context, and availability context to the Provider_Adapter for inclusion in the AI session configuration

### Requirement 4: OpenAI Realtime API Provider Adapter

**User Story:** As a System operator, I want an OpenAI Realtime API adapter so that the system can use OpenAI as the initial real-time voice provider.

#### Acceptance Criteria

1. WHEN the OpenAI Provider_Adapter is initialized, THE Provider_Adapter SHALL open a WebSocket connection to the OpenAI Realtime API using the configured `OPENAI_API_KEY`
2. WHEN the OpenAI connection is established, THE Provider_Adapter SHALL send a `session.update` event configuring the voice, audio input format, turn detection settings, and system instructions
3. WHEN audio input is received via the common interface, THE Provider_Adapter SHALL encode it as a base64 `input_audio_buffer.append` event and send it to the OpenAI WebSocket
4. WHEN an `response.audio.delta` event is received from OpenAI, THE Provider_Adapter SHALL emit an audio output event through the common interface
5. WHEN a `response.audio_transcript.done` event is received from OpenAI, THE Provider_Adapter SHALL emit a transcript event for the assistant's speech through the common interface
6. WHEN a `conversation.item.input_audio_transcription.completed` event is received from OpenAI, THE Provider_Adapter SHALL emit a transcript event for the caller's speech through the common interface
7. WHEN an `input_audio_buffer.speech_started` event is received from OpenAI, THE Provider_Adapter SHALL emit a speech-started event through the common interface
8. IF the OpenAI WebSocket connection fails or returns an error event, THEN THE Provider_Adapter SHALL emit an error event through the common interface

### Requirement 5: Audio Relay Between Twilio and Provider

**User Story:** As a Caller, I want my voice to be heard by the AI and the AI's voice to be heard by me in real time so that the conversation feels natural.

#### Acceptance Criteria

1. WHEN Mulaw_Audio is received from the Twilio_Media_Stream, THE Relay_Service SHALL forward it to the Provider_Adapter via the common audio input method
2. WHEN the Provider_Adapter emits an audio output event, THE Relay_Service SHALL encode the audio payload as a Twilio `media` message and send it back through the Twilio_Media_Stream WebSocket
3. WHEN the Provider_Adapter emits a speech-started event (indicating the Caller has started speaking), THE Relay_Service SHALL send a `clear` message to the Twilio_Media_Stream to stop playing any in-progress AI audio, enabling natural interruption
4. WHEN the Caller interrupts the AI while it is speaking, THE Relay_Service SHALL instruct the Provider_Adapter to cancel the current response generation

### Requirement 6: Transcript Capture

**User Story:** As an Office Manager, I want call transcripts to be captured during real-time streaming calls so that call summaries and logs continue to work.

#### Acceptance Criteria

1. WHEN the Provider_Adapter emits an assistant transcript event, THE Relay_Service SHALL store the assistant's transcript text in the Session's conversation history
2. WHEN the Provider_Adapter emits a caller transcript event, THE Relay_Service SHALL store the caller's transcribed text in the Session's conversation history
3. WHEN a Session ends, THE System SHALL have a complete conversation history containing both caller and assistant transcript entries in chronological order

### Requirement 7: Call Summary Generation

**User Story:** As an Office Manager, I want call summaries to be generated for real-time streaming calls just like they are for the current Gather-based calls so that I can review interactions.

#### Acceptance Criteria

1. WHEN a real-time streaming call ends, THE System SHALL generate a Call_Log using the captured Transcript, following the same format as existing Call_Log files
2. WHEN generating a Call_Log for a streaming call, THE System SHALL use the OpenRouter API (not the Realtime_AI_Provider) to generate the AI summary, consistent with existing behavior
3. WHEN a streaming call ends with no Transcript entries, THE System SHALL still create a Call_Log noting that no conversation occurred

### Requirement 8: Configuration

**User Story:** As a System operator, I want to configure the real-time voice provider and voice settings through environment variables so that the feature can be set up without code changes.

#### Acceptance Criteria

1. THE System SHALL read the `OPENAI_API_KEY` environment variable for authenticating with the OpenAI Realtime_AI_Provider
2. THE System SHALL read an optional `OPENAI_REALTIME_VOICE` environment variable to configure the AI voice for the OpenAI adapter, defaulting to `alloy` if not set
3. THE System SHALL read an optional `REALTIME_AI_PROVIDER` environment variable to select the Provider_Adapter, defaulting to `openai`
4. IF the required API key for the configured Realtime_AI_Provider is not set, THEN THE System SHALL log a warning at startup indicating that real-time voice streaming is unavailable, but SHALL continue to start and serve all other functionality
5. THE System SHALL document the new environment variables in the `.env.example` file

### Requirement 9: Backward Compatibility

**User Story:** As a System operator, I want all existing features to continue working after the upgrade so that nothing breaks for the office manager or callers using the web chat.

#### Acceptance Criteria

1. THE System SHALL continue to serve the text-based web chat API at `/api/chat` using OpenRouter, unchanged
2. THE System SHALL continue to serve the Admin_UI at `/admin` with all existing functionality unchanged
3. THE System SHALL continue to use OpenRouter for text-based AI interactions (web chat, call summaries)
4. THE System SHALL continue to load and serve website context, availability context, and prompt files as before
5. WHEN the System starts without the required API key for the configured Realtime_AI_Provider, THE System SHALL fall back to the existing Gather-based call flow for incoming calls

### Requirement 10: Session Lifecycle and Cleanup

**User Story:** As a System operator, I want call sessions to be properly managed and cleaned up so that the server does not leak memory or connections.

#### Acceptance Criteria

1. WHEN a new streaming call begins, THE Relay_Service SHALL create a Session object tracking the Twilio WebSocket, Provider_Adapter instance, Stream_SID, Call_SID, and conversation history
2. WHEN a streaming call ends normally (Twilio sends `stop` event), THE Relay_Service SHALL close the Provider_Adapter connection, generate the Call_Log, and remove the Session from memory
3. WHEN a streaming call ends abnormally (WebSocket error or unexpected close), THE Relay_Service SHALL attempt to generate a Call_Log from any captured Transcript, close all connections, and remove the Session from memory
4. THE Relay_Service SHALL not retain references to closed WebSocket connections or completed Session data after cleanup

### Requirement 11: Error Handling During Streaming

**User Story:** As a Caller, I want errors during my call to be handled gracefully so that the call does not hang or produce silence indefinitely.

#### Acceptance Criteria

1. IF the Provider_Adapter emits an error event during an active Session, THEN THE Relay_Service SHALL log the error with the Session's Call_SID for debugging
2. IF the Realtime_AI_Provider connection closes during an active call, THEN THE Relay_Service SHALL close the Twilio WebSocket, ending the call
3. THE System SHALL add all streaming-related errors to the in-memory error buffer so they appear in the Admin_UI dashboard
