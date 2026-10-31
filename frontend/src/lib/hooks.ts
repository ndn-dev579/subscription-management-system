import { useState } from 'react';

export function useAction() {
  const [error, setError] = useState('');
  const run = (fn: () => void) => {
    try {
      setError('');
      fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };
  return { error, run };
}

export function usePaged<T>(items: T[], size = 25) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(page, pages);
  return {
    page: current,
    pages,
    setPage,
    total: items.length,
    rows: items.slice((current - 1) * size, current * size),
  };
}
