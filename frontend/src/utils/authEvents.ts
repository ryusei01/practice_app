type AuthEventListener = () => void;

const listeners = new Set<AuthEventListener>();

export const authEvents = {
  onSessionExpired(listener: AuthEventListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  emitSessionExpired(): void {
    listeners.forEach((listener) => listener());
  },
};
