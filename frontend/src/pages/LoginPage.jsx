import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function goAfterLogin(user) {
    const redirectTo = location.state?.from || (user.role === 'admin' ? '/admin' : '/');
    navigate(redirectTo, { replace: true });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await login(email, password);
      goAfterLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSuccess(credentialResponse) {
    setError('');
    try {
      const user = await loginWithGoogle(credentialResponse.credential);
      goAfterLogin(user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, padding: '60px 20px' }}>
      <h1>Ingresar</h1>
      <p className="muted">Accede a tu cuenta de GSI.</p>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 22, marginTop: 20 }}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Ingresando...' : 'Ingresar'}
        </button>

        {import.meta.env.VITE_GOOGLE_CLIENT_ID && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border, #ddd)' }} />
              <span className="muted" style={{ fontSize: 13 }}>o</span>
              <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border, #ddd)' }} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => setError('No se pudo iniciar sesión con Google. Intenta de nuevo.')}
                text="continue_with"
                locale="es"
                width="320"
              />
            </div>
          </>
        )}
      </form>

      <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>
        ¿No tienes cuenta? <Link to="/registro">Regístrate aquí</Link>
      </p>
    </div>
  );
}
