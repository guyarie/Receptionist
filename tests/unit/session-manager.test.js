import { describe, it, expect, beforeEach } from 'vitest';
import SessionManager from '../../src/realtime/session-manager.js';

describe('SessionManager', () => {
  let manager;

  beforeEach(() => {
    manager = new SessionManager();
  });

  it('should start with zero active sessions', () => {
    expect(manager.getActiveCount()).toBe(0);
  });

  it('should add and retrieve a session by streamSid', () => {
    const relay = { callSid: 'CA123' };
    manager.addSession('MS001', relay);
    expect(manager.getSession('MS001')).toBe(relay);
    expect(manager.getActiveCount()).toBe(1);
  });

  it('should return null for unknown streamSid', () => {
    expect(manager.getSession('nonexistent')).toBeNull();
  });

  it('should remove a session', () => {
    const relay = { callSid: 'CA123' };
    manager.addSession('MS001', relay);
    manager.removeSession('MS001');
    expect(manager.getSession('MS001')).toBeNull();
    expect(manager.getActiveCount()).toBe(0);
  });

  it('should handle removing a non-existent session without error', () => {
    expect(() => manager.removeSession('nonexistent')).not.toThrow();
  });

  it('should track multiple sessions independently', () => {
    const relay1 = { callSid: 'CA1' };
    const relay2 = { callSid: 'CA2' };
    manager.addSession('MS001', relay1);
    manager.addSession('MS002', relay2);
    expect(manager.getActiveCount()).toBe(2);
    expect(manager.getSession('MS001')).toBe(relay1);
    expect(manager.getSession('MS002')).toBe(relay2);
  });

  it('should overwrite session if same streamSid is added again', () => {
    const relay1 = { callSid: 'CA1' };
    const relay2 = { callSid: 'CA2' };
    manager.addSession('MS001', relay1);
    manager.addSession('MS001', relay2);
    expect(manager.getSession('MS001')).toBe(relay2);
    expect(manager.getActiveCount()).toBe(1);
  });
});
