import { useEffect, useState } from 'react';

export function useSessionRestore<User>(
  api: { restoreSession(): Promise<User | null> },
  restored: (user: User | null) => void,
) {
  const [restoring, setRestoring] = useState(true);
  const [restoreError, setRestoreError] = useState<unknown>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setRestoring(true);
    setRestoreError(null);
    void api.restoreSession().then(
      (user) => {
        if (active) {
          restored(user);
          setRestoring(false);
        }
      },
      (error: unknown) => {
        if (active) {
          setRestoreError(error);
          setRestoring(false);
        }
      },
    );
    return () => {
      active = false;
    };
  }, [api, restored, attempt]);
  return {
    restoring,
    restoreError,
    retryRestore: () => setAttempt((n) => n + 1),
  };
}
