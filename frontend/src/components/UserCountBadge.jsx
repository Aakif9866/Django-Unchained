import { useEffect, useState } from 'react';
import { api } from '../api/client';

/** Shown on the auth screens, before anyone's signed in — a quiet piece
 * of social proof ("N people have joined"). Fails silently: if the
 * count can't be fetched, the badge just doesn't render, rather than
 * showing an error on the one screen a new user sees first. */
export function UserCountBadge() {
  const [count, setCount] = useState(null);

  useEffect(() => {
    api.getUserCount()
      .then((data) => setCount(data.user_count))
      .catch(() => setCount(null));
  }, []);

  if (count === null) return null;

  return (
    <div className="user-count-badge">
      <span className="user-count-dot" />
      {count.toLocaleString()} {count === 1 ? 'person has' : 'people have'} joined so far
    </div>
  );
}
