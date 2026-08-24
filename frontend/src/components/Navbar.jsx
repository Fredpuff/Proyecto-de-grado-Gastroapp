import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/');
  }

  return (
    <header
      style={{
        background: 'var(--color-surface)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 20
      }}
    >
      <div
        className="container"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64 }}
      >
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'inherit' }}>
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: 9,
              background: 'var(--color-primary)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-heading)',
              fontWeight: 700
            }}
          >
            G
          </span>
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: 19 }}>GSI</span>
        </Link>

        <nav style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {isAdmin && (
            <Link to="/admin" className="btn btn-ghost btn-sm">
              Mi panel
            </Link>
          )}
          {user ? (
            <>
              <span className="muted" style={{ fontSize: 14 }}>
                Hola, {user.name.split(' ')[0]}
              </span>
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                Salir
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">
                Ingresar
              </Link>
              <Link to="/registro" className="btn btn-primary btn-sm">
                Crear cuenta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
