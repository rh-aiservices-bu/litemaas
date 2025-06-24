import { useCallback } from 'react';

export const useAsyncError = () => {
  const throwError = useCallback((error: Error) => {
    setTimeout(() => {
      throw error;
    });
  }, []);

  return throwError;
};
