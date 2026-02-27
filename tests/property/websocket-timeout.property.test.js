/**
 * Bug Condition Exploration Test - WebSocket Timeout After 60s Silence
 * 
 * **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2**
 * 
 * CRITICAL: This test MUST FAIL on unfixed code - failure confirms the bug exists.
 * 
 * This test explores the fault condition where WebSocket connections timeout
 * after 60+ seconds of silence without keepalive messages. The test simulates
 * extended silence periods and verifies that connections remain OPEN (expected
 * behavior with keepalive).
 * 
 * On UNFIXED code, this test will FAIL because:
 * - WebSocket connections will transition to CLOSED state after ~60s of inactivity
 * - No keepalive messages are sent to prevent timeout
 * - Connections silently drop without error events
 * 
 * On FIXED code, this test will PASS because:
 * - Keepalive messages are sent every 30 seconds
 * - Connections remain OPEN indefinitely during silence
 * - No timeout occurs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import WebSocket from 'ws';
import OpenAIAdapter from '../../src/realtime/openai-adapter.js';
import RelayService from '../../src/realtime/relay-service.js';

// Test configuration
const SILENCE_DURATION_MS = 65000; // 65 seconds - exceeds 60s timeout threshold
const KEEPALIVE_INTERVAL_MS = 30000; // Expected keepalive interval (30 seconds)
const CONNECTION_SETUP_TIMEOUT_MS = 10000; // Time to establish connections

describe('Bug Condition Exploration - WebSocket Timeout After 60s Silence', () => {
  let mockOpenAIServer;
  let mockTwilioWs;
  let openaiAdapter;
  let relayService;

  beforeEach(() => {
    // Clean up any existing instances
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
   * Property 1: OpenAI WebSocket Timeout Test
   * 
   * Tests that the OpenAI WebSocket connection drops after 65 seconds of silence
   * without keepalive messages (on unfixed code).
   * 
   * Expected behavior (with fix): Connection remains OPEN
   * Actual behavior (without fix): Connection transitions to CLOSED
   */
  it('should keep OpenAI WebSocket connection alive after 65 seconds of silence', async () => {
    // This test uses a scoped approach - testing the specific failing case
    // rather than generating random inputs
    
    // Create a mock OpenAI WebSocket server
    mockOpenAIServer = new WebSocket.Server({ port: 0 });
    const serverPort = mockOpenAIServer.address().port;
    
    let serverSideConnection = null;
    let keepaliveMessagesReceived = 0;
    
    // Track messages received by the server
    mockOpenAIServer.on('connection', (ws) => {
      serverSideConnection = ws;
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Count keepalive messages (session.update with no meaningful changes)
          // On unfixed code, we expect 0 keepalive messages
          // On fixed code, we expect ~2 keepalive messages (at 30s and 60s)
          if (message.type === 'session.update' && 
              Object.keys(message.session || {}).length === 0) {
            keepaliveMessagesReceived++;
          }
          
          // Respond to session.update to complete handshake
          if (message.type === 'session.update') {
            ws.send(JSON.stringify({
              type: 'session.updated',
              session: {}
            }));
          }
        } catch (err) {
          // Ignore parse errors
        }
      });
    });
    
    // Create OpenAI adapter pointing to our mock server
    const mockApiKey = 'test-key';
    openaiAdapter = new OpenAIAdapter(mockApiKey, 'alloy');
    
    // Override the WebSocket URL to point to our mock server
    const originalConnect = openaiAdapter.connect.bind(openaiAdapter);
    openaiAdapter.connect = async function(options) {
      // Create WebSocket to mock server instead of real OpenAI
      this.ws = new WebSocket(`ws://localhost:${serverPort}`);
      
      return new Promise((resolve, reject) => {
        this.ws.on('open', () => {
          // Send minimal session.update to complete handshake
          this.ws.send(JSON.stringify({
            type: 'session.update',
            session: {
              voice: this.voice,
              input_audio_format: 'g711_ulaw',
              output_audio_format: 'g711_ulaw'
            }
          }));
          
          // Start keepalive mechanism (this is what the real connect() does)
          this._startKeepalive();
          
          resolve();
        });
        
        this.ws.on('error', reject);
        
        this.ws.on('close', () => {
          if (this.onClose) this.onClose();
        });
      });
    };
    
    // Connect to mock server
    await openaiAdapter.connect({
      systemPrompt: 'Test prompt'
    });
    
    // Verify connection is initially OPEN
    expect(openaiAdapter.ws.readyState).toBe(WebSocket.OPEN);
    expect(serverSideConnection).not.toBeNull();
    expect(serverSideConnection.readyState).toBe(WebSocket.OPEN);
    
    // Simulate 65 seconds of silence (no audio data sent)
    console.log(`⏱️  Simulating ${SILENCE_DURATION_MS}ms of silence...`);
    await new Promise(resolve => setTimeout(resolve, SILENCE_DURATION_MS));
    
    // Check connection state after silence period
    const clientState = openaiAdapter.ws.readyState;
    const serverState = serverSideConnection.readyState;
    
    console.log(`📊 After ${SILENCE_DURATION_MS}ms silence:`);
    console.log(`   Client WebSocket state: ${clientState} (${getReadyStateString(clientState)})`);
    console.log(`   Server WebSocket state: ${serverState} (${getReadyStateString(serverState)})`);
    console.log(`   Keepalive messages received: ${keepaliveMessagesReceived}`);
    
    // EXPECTED BEHAVIOR (with fix): Connection remains OPEN
    // - Client state should be OPEN (1)
    // - Server state should be OPEN (1)
    // - Should have received ~2 keepalive messages (at 30s and 60s)
    
    // ACTUAL BEHAVIOR (without fix): Connection drops
    // - Client state will be CLOSED (3) or CLOSING (2)
    // - Server state will be CLOSED (3) or CLOSING (2)
    // - No keepalive messages received (0)
    
    expect(clientState).toBe(WebSocket.OPEN);
    expect(serverState).toBe(WebSocket.OPEN);
    expect(keepaliveMessagesReceived).toBeGreaterThanOrEqual(2); // At least 2 keepalives (30s, 60s)
  }, 80000); // 80 second timeout for test execution

  /**
   * Property 2: Twilio WebSocket Timeout Test
   * 
   * Tests that the Twilio Media Stream WebSocket connection drops after 65 seconds
   * of silence without keepalive messages (on unfixed code).
   * 
   * Expected behavior (with fix): Connection remains OPEN
   * Actual behavior (without fix): Connection transitions to CLOSED
   */
  it('should keep Twilio WebSocket connection alive after 65 seconds of silence', async () => {
    // Create a mock Twilio WebSocket
    const mockTwilioServer = new WebSocket.Server({ port: 0 });
    const serverPort = mockTwilioServer.address().port;
    
    let serverSideConnection = null;
    let keepaliveMessagesReceived = 0;
    
    // Track messages received by the server
    mockTwilioServer.on('connection', (ws) => {
      serverSideConnection = ws;
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          
          // Count keepalive messages (mark events with name 'keepalive')
          // On unfixed code, we expect 0 keepalive messages
          // On fixed code, we expect ~2 keepalive messages (at 30s and 60s)
          if (message.event === 'mark' && message.mark?.name === 'keepalive') {
            keepaliveMessagesReceived++;
          }
        } catch (err) {
          // Ignore parse errors
        }
      });
    });
    
    // Create mock Twilio WebSocket client
    mockTwilioWs = new WebSocket(`ws://localhost:${serverPort}`);
    
    await new Promise((resolve, reject) => {
      mockTwilioWs.on('open', resolve);
      mockTwilioWs.on('error', reject);
    });
    
    // Create a mock provider adapter
    const mockProvider = {
      connect: async () => {},
      sendAudio: () => {},
      cancelResponse: () => {},
      close: () => {},
      onAudioOutput: null,
      onTranscript: null,
      onSpeechStarted: null,
      onError: null,
      onClose: null
    };
    
    // Create RelayService
    relayService = new RelayService(
      mockTwilioWs,
      mockProvider,
      'test-call-sid',
      'test-stream-sid',
      { from: '+1234567890', to: '+0987654321' }
    );
    
    await relayService.initialize({
      systemPrompt: 'Test prompt'
    });
    
    // Verify connection is initially OPEN
    expect(mockTwilioWs.readyState).toBe(WebSocket.OPEN);
    expect(serverSideConnection).not.toBeNull();
    expect(serverSideConnection.readyState).toBe(WebSocket.OPEN);
    
    // Simulate 65 seconds of silence (no media data sent)
    console.log(`⏱️  Simulating ${SILENCE_DURATION_MS}ms of silence...`);
    await new Promise(resolve => setTimeout(resolve, SILENCE_DURATION_MS));
    
    // Check connection state after silence period
    const clientState = mockTwilioWs.readyState;
    const serverState = serverSideConnection.readyState;
    
    console.log(`📊 After ${SILENCE_DURATION_MS}ms silence:`);
    console.log(`   Client WebSocket state: ${clientState} (${getReadyStateString(clientState)})`);
    console.log(`   Server WebSocket state: ${serverState} (${getReadyStateString(serverState)})`);
    console.log(`   Keepalive messages received: ${keepaliveMessagesReceived}`);
    
    // EXPECTED BEHAVIOR (with fix): Connection remains OPEN
    expect(clientState).toBe(WebSocket.OPEN);
    expect(serverState).toBe(WebSocket.OPEN);
    expect(keepaliveMessagesReceived).toBeGreaterThanOrEqual(2); // At least 2 keepalives (30s, 60s)
    
    // Clean up
    mockTwilioServer.close();
  }, 80000); // 80 second timeout for test execution

  /**
   * Property 3: Combined Scenario Test
   * 
   * Tests a realistic call scenario where both connections experience silence
   * after an initial greeting exchange.
   * 
   * Expected behavior (with fix): Both connections remain OPEN
   * Actual behavior (without fix): Both connections drop
   */
  it('should keep both WebSocket connections alive during extended silence in a call', async () => {
    // Create mock servers
    const mockOpenAIServer = new WebSocket.Server({ port: 0 });
    const openaiPort = mockOpenAIServer.address().port;
    
    const mockTwilioServer = new WebSocket.Server({ port: 0 });
    const twilioPort = mockTwilioServer.address().port;
    
    let openaiServerConnection = null;
    let twilioServerConnection = null;
    let openaiKeepalives = 0;
    let twilioKeepalives = 0;
    
    // Track OpenAI keepalives
    mockOpenAIServer.on('connection', (ws) => {
      openaiServerConnection = ws;
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.type === 'session.update' && 
              Object.keys(message.session || {}).length === 0) {
            openaiKeepalives++;
          }
          if (message.type === 'session.update') {
            ws.send(JSON.stringify({ type: 'session.updated', session: {} }));
          }
        } catch (err) {}
      });
    });
    
    // Track Twilio keepalives
    mockTwilioServer.on('connection', (ws) => {
      twilioServerConnection = ws;
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          if (message.event === 'mark' && message.mark?.name === 'keepalive') {
            twilioKeepalives++;
          }
        } catch (err) {}
      });
    });
    
    // Create OpenAI adapter
    openaiAdapter = new OpenAIAdapter('test-key', 'alloy');
    openaiAdapter.connect = async function(options) {
      this.ws = new WebSocket(`ws://localhost:${openaiPort}`);
      return new Promise((resolve, reject) => {
        this.ws.on('open', () => {
          this.ws.send(JSON.stringify({
            type: 'session.update',
            session: { voice: this.voice }
          }));
          
          // Start keepalive mechanism (this is what the real connect() does)
          this._startKeepalive();
          
          resolve();
        });
        this.ws.on('error', reject);
        this.ws.on('close', () => { if (this.onClose) this.onClose(); });
      });
    };
    
    // Create Twilio WebSocket
    mockTwilioWs = new WebSocket(`ws://localhost:${twilioPort}`);
    await new Promise((resolve, reject) => {
      mockTwilioWs.on('open', resolve);
      mockTwilioWs.on('error', reject);
    });
    
    // Create RelayService
    relayService = new RelayService(
      mockTwilioWs,
      openaiAdapter,
      'test-call-sid',
      'test-stream-sid',
      { from: '+1234567890', to: '+0987654321' }
    );
    
    await relayService.initialize({
      systemPrompt: 'Test prompt'
    });
    
    // Verify both connections are initially OPEN
    expect(openaiAdapter.ws.readyState).toBe(WebSocket.OPEN);
    expect(mockTwilioWs.readyState).toBe(WebSocket.OPEN);
    
    // Simulate call scenario:
    // 1. Initial greeting exchange (first 5 seconds)
    // 2. Extended silence (65 seconds)
    console.log('📞 Simulating call with initial greeting...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log(`⏱️  Simulating ${SILENCE_DURATION_MS}ms of silence...`);
    await new Promise(resolve => setTimeout(resolve, SILENCE_DURATION_MS));
    
    // Check connection states
    const openaiClientState = openaiAdapter.ws.readyState;
    const openaiServerState = openaiServerConnection.readyState;
    const twilioClientState = mockTwilioWs.readyState;
    const twilioServerState = twilioServerConnection.readyState;
    
    console.log(`📊 After ${SILENCE_DURATION_MS}ms silence:`);
    console.log(`   OpenAI Client: ${openaiClientState} (${getReadyStateString(openaiClientState)})`);
    console.log(`   OpenAI Server: ${openaiServerState} (${getReadyStateString(openaiServerState)})`);
    console.log(`   OpenAI Keepalives: ${openaiKeepalives}`);
    console.log(`   Twilio Client: ${twilioClientState} (${getReadyStateString(twilioClientState)})`);
    console.log(`   Twilio Server: ${twilioServerState} (${getReadyStateString(twilioServerState)})`);
    console.log(`   Twilio Keepalives: ${twilioKeepalives}`);
    
    // EXPECTED BEHAVIOR (with fix): All connections remain OPEN
    expect(openaiClientState).toBe(WebSocket.OPEN);
    expect(openaiServerState).toBe(WebSocket.OPEN);
    expect(twilioClientState).toBe(WebSocket.OPEN);
    expect(twilioServerState).toBe(WebSocket.OPEN);
    expect(openaiKeepalives).toBeGreaterThanOrEqual(2);
    expect(twilioKeepalives).toBeGreaterThanOrEqual(2);
    
    // Clean up
    mockOpenAIServer.close();
    mockTwilioServer.close();
  }, 85000); // 85 second timeout for test execution
});

/**
 * Helper function to convert WebSocket readyState to string
 */
function getReadyStateString(state) {
  switch (state) {
    case WebSocket.CONNECTING: return 'CONNECTING';
    case WebSocket.OPEN: return 'OPEN';
    case WebSocket.CLOSING: return 'CLOSING';
    case WebSocket.CLOSED: return 'CLOSED';
    default: return 'UNKNOWN';
  }
}
