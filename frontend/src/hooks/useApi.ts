import { useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { setAuthToken } from '../lib/api';

export function useApiSetup() {
  const { token } = useAuth();

  useEffect(() => {
    if (token) {
      setAuthToken(token);
    }
  }, [token]);
}
