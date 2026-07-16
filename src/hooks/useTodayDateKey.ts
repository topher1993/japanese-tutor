import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDateKey } from '../services/dailyTodoService';

/** Keeps date-scoped UI correct across local midnight and app resume. */
export function useTodayDateKey(): string {
  const [dateKey, setDateKey] = useState(() => localDateKey());

  useEffect(() => {
    const refresh = () => {
      const next = localDateKey();
      setDateKey(current => current === next ? current : next);
    };
    const timer = setInterval(refresh, 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  return dateKey;
}

