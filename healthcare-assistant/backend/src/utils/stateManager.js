class StateManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(phoneNumber) {
    const sessionId = `sess_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const session = {
      id: sessionId,
      phoneNumber,
      state: "greeting",
      context: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  updateSession(sessionId, updates) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const updatedSession = {
      ...session,
      ...updates,
      updatedAt: new Date(),
    };
    this.sessions.set(sessionId, updatedSession);
    return updatedSession;
  }

  deleteSession(sessionId) {
    return this.sessions.delete(sessionId);
  }

  cleanupExpiredSessions(expiryMinutes = 30) {
    const now = new Date();
    for (const [sessionId, session] of this.sessions.entries()) {
      const ageInMinutes = (now - session.updatedAt) / (1000 * 60);
      if (ageInMinutes > expiryMinutes) {
        this.sessions.delete(sessionId);
      }
    }
  }
}

module.exports = new StateManager();
