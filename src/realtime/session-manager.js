/**
 * Session Manager - Tracks active streaming sessions.
 * Maps streamSid to RelayService instances for session lookup and cleanup.
 */
class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  addSession(streamSid, relayService) {
    this.sessions.set(streamSid, relayService);
  }

  getSession(streamSid) {
    return this.sessions.get(streamSid) || null;
  }

  removeSession(streamSid) {
    this.sessions.delete(streamSid);
  }

  getActiveCount() {
    return this.sessions.size;
  }
}

module.exports = SessionManager;
