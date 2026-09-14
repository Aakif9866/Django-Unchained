import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserCountBadge } from '../components/UserCountBadge';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate('/notes');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-subtitle">Log in to see your notes.</p>
        <UserCountBadge />

        {error && <div className="form-error">{error}</div>}

        <label className="field">
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            required
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>

        <p className="auth-footer">
          No account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}
