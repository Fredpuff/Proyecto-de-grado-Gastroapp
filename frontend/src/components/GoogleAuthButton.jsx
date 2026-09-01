import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';

// Botón "Continuar con Google" compartido entre Login y Registro: el backend
// (POST /api/auth/google) resuelve solo si el usuario existe o hay que crearlo,
// así que ambas páginas reutilizan exactamente el mismo flujo.
export default function GoogleAuthButton({ onSuccess, onError }) {
  const { loginWithGoogle } = useAuth();

  if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) return null;

  async function handleSuccess(credentialResponse) {
    try {
      const user = await loginWithGoogle(credentialResponse.credential);
      onSuccess(user);
    } catch (err) {
      onError(err.message);
    }
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0' }}>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border, #ddd)' }} />
        <span className="muted" style={{ fontSize: 13 }}>o</span>
        <hr style={{ flex: 1, border: 'none', borderTop: '1px solid var(--border, #ddd)' }} />
      </div>

      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => onError('No se pudo iniciar sesión con Google. Intenta de nuevo.')}
          text="continue_with"
          locale="es"
          width="320"
        />
      </div>
    </>
  );
}
