import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function handleEscape(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [menuOpen]);

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate('/');
  }

  return (
    <header className="navbar">
      <div className="container navbar-row">
        <Link to="/" className="navbar-brand">
          <span className="navbar-logo-badge">G</span>
          <span className="navbar-logo-text">GSI</span>
        </Link>

        <nav className="navbar-actions">
          {isAdmin && (
            <Link to="/admin" className="btn btn-ghost btn-sm navbar-desktop-only">
              Mi panel
            </Link>
          )}
          {user ? (
            <>
              <span className="muted navbar-greeting navbar-desktop-only">
                Hola, {user.name.split(' ')[0]}
              </span>
              <button className="btn btn-outline btn-sm" onClick={handleLogout}>
                Salir
              </button>

              <div className="navbar-mobile-menu" ref={menuRef}>
                <button
                  type="button"
                  className="navbar-toggle"
                  aria-expanded={menuOpen}
                  aria-haspopup="true"
                  aria-label="Más opciones de cuenta"
                  onClick={() => setMenuOpen((open) => !open)}
                >
                  ☰
                </button>
                {menuOpen && (
                  <div className="navbar-dropdown">
                    <span className="navbar-dropdown-greeting">Hola, {user.name.split(' ')[0]}</span>
                    {isAdmin && (
                      <Link to="/admin" className="navbar-dropdown-link" onClick={() => setMenuOpen(false)}>
                        Mi panel
                      </Link>
                    )}
                  </div>
                )}
              </div>
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
