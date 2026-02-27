/**
 * Preservation Property Tests - Existing WebSocket Behavior Unchanged
 * 
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**
 * 
 * IMPORTANT: These tests verify that existing WebSocket behavior is preserved
 * after implementing the keepalive fix. They should PASS on UNFIXED code to
 * establish the baseline behavior, and continue to PASS on FIXED code to
 * confirm no regressions.
 * 
 * This test suite uses property-based testing to generate many test cases
 * across different audio patterns, interruption scenarios, and call durations
 * to provide strong guarantees that the keepalive fix doesn't break existing
 * functionality.
 * 
 * Property 2: Preservation - For any WebSocket event or audio transmission
 * that is NOT a keepalive ping, the fixed code SHALL produce exactly the same
 * behavior as the original code.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import WebSocket from 'ws';
import OpenAIAdapter from '../../src/realtime/openai-adapter.js';
import RelayService from '../../src/realtime/relay-service.js';

describe('Preservation Property Tests - Existing WebSocket Behavior', () => {
  let mockOpenAIServer;
  let mockTwilioWs;
  let openaiAdapter;
  let relayService;

  beforeEach(() => {
    mockOpenAIServer = null;
    mockTwilioWs = null;
    openaiAdapter = null;
    relayService = null;
  });

  afterEach(async () => {
    // Clean up resources
    if (openaiAdapter) {
      try {
        openaiAdapter.close();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    if (relayService) {
      try {
        await relayService.cleanup();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    if (mockOpenAIServer) {
      try {
        await new Promise((resolve) => {
          mockOpenAIServer.close(resolve);
        });
      } catch (err) {
        // Ignore cleanup errors
      }
    }
    if (mockTwilioWs) {
      try {
        mockTwilioWs.close();
      } catch (err) {
        // Ignore cleanup errors
      }
    }
  });

  /**
   * Property 1: Audio Relay Preservation (Twilio → OpenAI)
   * 
   * Validates Requirement 3.1: Audio relay from Twilio to OpenAI must continue
   * to work exactly as before.
   * 
   * Tests that audio payloads sent from Twilio are correctly forwarded to the
   * OpenAI adapter without modification, regardless of the keepalive mechanism.
   */
  it('should preserve audio relay from Twilio to OpenAI', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random audio patterns: array of base64-encoded audio chunks
        fc.array(
          fc.base64String({ minLength: 100, maxLength: 500 }),
          { minLength: 1, maxLength: 10 }
        ),
        async (audioChunks) => {
          // Create mock OpenAI server
          mockOpenAIServer = new WebSocket.Server({ port: 0 });
          const openaiPort = mockOpenAIServer.address().port;
          
          const receivedAudioChunks = [];
          
          mockOpenAIServer.on('connection', (ws) => {
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                
                // Capture audio chunks sent to OpenAI
                if (message.type === 'input_audio_buffer.append') {
                  receivedAudioChunks.push(message.audio);
                }
                
                // Respond to session.update
                if (message.type === 'session.update') {
                  ws.send(JSON.stringify({ type: 'session.updated', session: {} }));
                }
              } catch (err) {
                // Ignore parse errors
              }
            });
          });
          
          // Create OpenAI adapter
          openaiAdapter = new OpenAIAdapter('test-key', 'alloy');
          openaiAdapter.connect = async function() {
            this.ws = new WebSocket(`ws://localhost:${openaiPort}`);
            return new Promise((resolve, reject) => {
              this.ws.on('open', () => {
                this.ws.send(JSON.stringify({
                  type: 'session.update',
                  session: { voice: this.voice }
                }));
                resolve();
              });
              this.ws.on('error', reject);
              this.ws.on('close', () => { if (this.onClose) this.onClose(); });
            });
          };
          
          await openaiAdapter.connect({ systemPrompt: 'Test' });
          
          // Send audio chunks through the adapter
          for (const chunk of audioChunks) {
            openaiAdapter.sendAudio(chunk);
          }
          
          // Wait for messages to be processed
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Verify all audio chunks were received by OpenAI
          expect(receivedAudioChunks).toHaveLength(audioChunks.length);
          expect(receivedAudioChunks).toEqual(audioChunks);
          
          // Clean up
          openaiAdapter.close();
          await new Promise(resolve => mockOpenAIServer.close(resolve));
          mockOpenAIServer = null;
          openaiAdapter = null;
        }
      ),
      { numRuns: 10 } // Run 10 test cases with different audio patterns
    );
  });

  /**
   * Property 2: Audio Relay Preservation (OpenAI → Twilio)
   * 
   * Validates Requirement 3.1: Audio relay from OpenAI to Twilio must continue
   * to work exactly as before.
   * 
   * Tests that audio deltas received from OpenAI are correctly forwarded to
   * Twilio without modification.
   */
  it('should preserve audio relay from OpenAI to Twilio', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random audio delta patterns
        fc.array(
          fc.base64String({ minLength: 100, maxLength: 500 }),
          { minLength: 1, maxLength: 10 }
        ),
        async (audioDeltas) => {
          // Create mock servers
          mockOpenAIServer = new WebSocket.Server({ port: 0 });
          const openaiPort = mockOpenAIServer.address().port;
          
          const mockTwilioServer = new WebSocket.Server({ port: 0 });
          const twilioPort = mockTwilioServer.address().port;
          
          const receivedTwilioAudio = [];
          let openaiServerConnection = null;
          
          // Track audio sent to Twilio
          mockTwilioServer.on('connection', (ws) => {
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                if (message.event === 'media' && message.media?.payload) {
                  receivedTwilioAudio.push(message.media.payload);
                }
              } catch (err) {
                // Ignore parse errors
              }
            });
          });
          
          // Mock OpenAI server that sends audio deltas
          mockOpenAIServer.on('connection', (ws) => {
            openaiServerConnection = ws;
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                if (message.type === 'session.update') {
                  ws.send(JSON.stringify({ type: 'session.updated', session: {} }));
                }
              } catch (err) {}
            });
          });
          
          // Create Twilio WebSocket
          mockTwilioWs = new WebSocket(`ws://localhost:${twilioPort}`);
          await new Promise((resolve, reject) => {
            mockTwilioWs.on('open', resolve);
            mockTwilioWs.on('error', reject);
          });
          
          // Create OpenAI adapter
          openaiAdapter = new OpenAIAdapter('test-key', 'alloy');
          openaiAdapter.connect = async function() {
            this.ws = new WebSocket(`ws://localhost:${openaiPort}`);
            return new Promise((resolve, reject) => {
              this.ws.on('open', () => {
                this.ws.send(JSON.stringify({
                  type: 'session.update',
                  session: { voice: this.voice }
                }));
                resolve();
              });
              this.ws.on('error', reject);
              this.ws.on('close', () => { if (this.onClose) this.onClose(); });
              this.ws.on('message', (data) => this._handleMessage(data));
            });
          };
          
          // Create RelayService
          relayService = new RelayService(
            mockTwilioWs,
            openaiAdapter,
            'test-call-sid',
            'test-stream-sid',
            { from: '+1234567890', to: '+0987654321' }
          );
          
          await relayService.initialize({ systemPrompt: 'Test' });
          
          // Wait for connection to be established
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Simulate OpenAI sending audio deltas
          for (const delta of audioDeltas) {
            openaiServerConnection.send(JSON.stringify({
              type: 'response.audio.delta',
              delta: delta
            }));
          }
          
          // Wait for messages to be processed
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Verify all audio deltas were forwarded to Twilio
          expect(receivedTwilioAudio).toHaveLength(audioDeltas.length);
          expect(receivedTwilioAudio).toEqual(audioDeltas);
          
          // Clean up
          await relayService.cleanup();
          mockTwilioWs.close();
          mockOpenAIServer.close();
          mockTwilioServer.close();
          mockOpenAIServer = null;
          mockTwilioWs = null;
          relayService = null;
        }
      ),
      { numRuns: 10, timeout: 15000 }
    );
  }, 20000);

  /**
   * Property 3: Interruption Handling Preservation
   * 
   * Validates Requirement 3.2: Caller interruptions must continue to trigger
   * clear and cancel events correctly.
   * 
   * Tests that when the caller interrupts (speech_started event), the system
   * sends a 'clear' event to Twilio and a 'response.cancel' to OpenAI.
   */
  it('should preserve interruption handling behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random number of interruptions (1-5)
        fc.integer({ min: 1, max: 5 }),
        async (numInterruptions) => {
          // Create mock servers
          mockOpenAIServer = new WebSocket.Server({ port: 0 });
          const openaiPort = mockOpenAIServer.address().port;
          
          const mockTwilioServer = new WebSocket.Server({ port: 0 });
          const twilioPort = mockTwilioServer.address().port;
          
          const twilioClears = [];
          const openaiCancels = [];
          let openaiServerConnection = null;
          
          // Track clear events sent to Twilio
          mockTwilioServer.on('connection', (ws) => {
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                if (message.event === 'clear') {
                  twilioClears.push(message);
                }
              } catch (err) {}
            });
          });
          
          // Track cancel events sent to OpenAI
          mockOpenAIServer.on('connection', (ws) => {
            openaiServerConnection = ws;
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                if (message.type === 'session.update') {
                  ws.send(JSON.stringify({ type: 'session.updated', session: {} }));
                }
                if (message.type === 'response.cancel') {
                  openaiCancels.push(message);
                }
              } catch (err) {}
            });
          });
          
          // Create Twilio WebSocket
          mockTwilioWs = new WebSocket(`ws://localhost:${twilioPort}`);
          await new Promise((resolve, reject) => {
            mockTwilioWs.on('open', resolve);
            mockTwilioWs.on('error', reject);
          });
          
          // Create OpenAI adapter
          openaiAdapter = new OpenAIAdapter('test-key', 'alloy');
          openaiAdapter.connect = async function() {
            this.ws = new WebSocket(`ws://localhost:${openaiPort}`);
            return new Promise((resolve, reject) => {
              this.ws.on('open', () => {
                this.ws.send(JSON.stringify({
                  type: 'session.update',
                  session: { voice: this.voice }
                }));
                resolve();
              });
              this.ws.on('error', reject);
              this.ws.on('close', () => { if (this.onClose) this.onClose(); });
              this.ws.on('message', (data) => this._handleMessage(data));
            });
          };
          
          // Create RelayService
          relayService = new RelayService(
            mockTwilioWs,
            openaiAdapter,
            'test-call-sid',
            'test-stream-sid',
            { from: '+1234567890', to: '+0987654321' }
          );
          
          await relayService.initialize({ systemPrompt: 'Test' });
          
          // Wait for connection
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Simulate interruptions by sending speech_started events
          for (let i = 0; i < numInterruptions; i++) {
            openaiServerConnection.send(JSON.stringify({
              type: 'input_audio_buffer.speech_started'
            }));
            
            // Small delay between interruptions
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          
          // Wait for messages to be processed
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Verify correct number of clear and cancel events
          expect(twilioClears).toHaveLength(numInterruptions);
          expect(openaiCancels).toHaveLength(numInterruptions);
          
          // Verify clear events have correct structure
          for (const clear of twilioClears) {
            expect(clear.event).toBe('clear');
            expect(clear.streamSid).toBe('test-stream-sid');
          }
          
          // Clean up
          await relayService.cleanup();
          mockTwilioWs.close();
          mockOpenAIServer.close();
          mockTwilioServer.close();
          mockOpenAIServer = null;
          mockTwilioWs = null;
          relayService = null;
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 4: Transcription Capture Preservation
   * 
   * Validates Requirement 3.5: Transcription events must continue to be
   * captured correctly for both caller and assistant.
   * 
   * Tests that transcription events from OpenAI are correctly captured in
   * the conversation history.
   */
  it('should preserve transcription capture behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random conversation: array of {role, text} pairs
        fc.array(
          fc.record({
            role: fc.constantFrom('caller', 'assistant'),
            text: fc.string({ minLength: 5, maxLength: 100 })
          }),
          { minLength: 2, maxLength: 10 }
        ),
        async (conversation) => {
          // Create mock servers
          mockOpenAIServer = new WebSocket.Server({ port: 0 });
          const openaiPort = mockOpenAIServer.address().port;
          
          const mockTwilioServer = new WebSocket.Server({ port: 0 });
          const twilioPort = mockTwilioServer.address().port;
          
          let openaiServerConnection = null;
          
          mockTwilioServer.on('connection', () => {});
          
          mockOpenAIServer.on('connection', (ws) => {
            openaiServerConnection = ws;
            ws.on('message', (data) => {
              try {
                const message = JSON.parse(data.toString());
                if (message.type === 'session.update') {
                  ws.send(JSON.stringify({ type: 'session.updated', session: {} }));
                }
              } catch (err) {}
            });
          });
          
          // Create Twilio WebSocket
          mockTwilioWs = new WebSocket(`ws://localhost:${twilioPort}`);
          await new Promise((resolve, reject) => {
            mockTwilioWs.on('open', resolve);
            mockTwilioWs.on('error', reject);
          });
          
          // Create OpenAI adapter
          openaiAdapter = new OpenAIAdapter('test-key', 'alloy');
          openaiAdapter.connect = async function() {
            this.ws = new WebSocket(`ws://localhost:${openaiPort}`);
            return new Promise((resolve, reject) => {
              this.ws.on('open', () => {
                this.ws.send(JSON.stringify({
                  type: 'session.update',
                  session: { voice: this.voice }
                }));
                resolve();
              });
              this.ws.on('error', reject);
              this.ws.on('close', () => { if (this.onClose) this.onClose(); });
              this.ws.on('message', (data) => this._handleMessage(data));
            });
          };
          
          // Create RelayService
          relayService = new RelayService(
            mockTwilioWs,
            openaiAdapter,
            'test-call-sid',
            'test-stream-sid',
            { from: '+1234567890', to: '+0987654321' }
          );
          
          await relayService.initialize({ systemPrompt: 'Test' });
          
          // Wait for connection
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // Simulate transcription events from OpenAI
          for (const entry of conversation) {
            if (entry.role === 'caller') {
              openaiServerConnection.send(JSON.stringify({
                type: 'conversation.item.input_audio_transcription.completed',
                transcript: entry.text
              }));
            } else {
              openaiServerConnection.send(JSON.stringify({
                type: 'response.audio_transcript.done',
                transcript: entry.text
              }));
            }
            
            // Small delay between transcripts
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          
          // Wait for messages to be processed
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Verify conversation history was captured correctly
          expect(relayService.conversationHistory).toHaveLength(conversation.length);
          
          for (let i = 0; i < conversation.length; i++) {
            expect(relayService.conversationHistory[i].role).toBe(conversation[i].role);
            expect(relayService.conversationHistory[i].text).toBe(conversation[i].text);
          }
          
          // Clean up
          await relayService.cleanup();
          mockTwilioWs.close();
          mockOpenAIServer.close();
          mockTwilioServer.close();
          mockOpenAIServer = null;
          mockTwilioWs = null;
          relayService = null;
        }
      ),
      { numRuns: 5, timeout: 15000 }
    );
  }, 20000);

  /**
   * Property 5: Cleanup Preservation
   * 
   * Validates Requirements 3.3, 3.4: Call end cleanup must continue to work
   * correctly, including session removal and resource cleanup.
   * 
   * Tests that cleanup is idempotent and properly closes connections.
   */
  it('should preserve cleanup behavior', async () => {
    // Create mock servers
    mockOpenAIServer = new WebSocket.Server({ port: 0 });
    const openaiPort = mockOpenAIServer.address().port;
    
    const mockTwilioServer = new WebSocket.Server({ port: 0 });
    const twilioPort = mockTwilioServer.address().port;
    
    let openaiConnectionClosed = false;
    
    mockTwilioServer.on('connection', () => {});
    
    mockOpenAIServer.on('connection', (ws) => {
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'session.update') {
            ws.send(JSON.stringify({ type: 'session.updated', session: {} }));
          }
        } catch (err) {}
      });
      
      ws.on('close', () => {
        openaiConnectionClosed = true;
      });
    });
    
    // Create Twilio WebSocket
    mockTwilioWs = new WebSocket(`ws://localhost:${twilioPort}`);
    await new Promise((resolve, reject) => {
      mockTwilioWs.on('open', resolve);
      mockTwilioWs.on('error', reject);
    });
    
    // Create OpenAI adapter
    openaiAdapter = new OpenAIAdapter('test-key', 'alloy');
    openaiAdapter.connect = async function() {
      this.ws = new WebSocket(`ws://localhost:${openaiPort}`);
      return new Promise((resolve, reject) => {
        this.ws.on('open', () => {
          this.ws.send(JSON.stringify({
            type: 'session.update',
            session: { voice: this.voice }
          }));
          resolve();
        });
        this.ws.on('error', reject);
        this.ws.on('close', () => { if (this.onClose) this.onClose(); });
        this.ws.on('message', (data) => this._handleMessage(data));
      });
    };
    
    // Create RelayService with mock session manager
    relayService = new RelayService(
      mockTwilioWs,
      openaiAdapter,
      'test-call-sid',
      'test-stream-sid',
      { from: '+1234567890', to: '+0987654321' }
    );
    
    // Mock session manager
    let sessionRemoved = false;
    relayService.sessionManager = {
      removeSession: (streamSid) => {
        expect(streamSid).toBe('test-stream-sid');
        sessionRemoved = true;
      }
    };
    
    await relayService.initialize({ systemPrompt: 'Test' });
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Call cleanup
    await relayService.cleanup();
    
    // Wait for cleanup to complete
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Verify cleanup behavior
    expect(relayService.closed).toBe(true);
    expect(openaiConnectionClosed).toBe(true);
    expect(sessionRemoved).toBe(true);
    
    // Verify cleanup is idempotent (calling again should not throw)
    await expect(relayService.cleanup()).resolves.not.toThrow();
    
    // Clean up
    mockTwilioWs.close();
    mockOpenAIServer.close();
    mockTwilioServer.close();
    mockOpenAIServer = null;
    mockTwilioWs = null;
    relayService = null;
  });
});
