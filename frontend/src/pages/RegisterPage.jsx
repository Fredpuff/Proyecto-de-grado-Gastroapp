import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'cliente' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const user = await register(form.name, form.email, form.password, form.role);
      navigate(user.role === 'admin' ? '/admin' : '/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420, padding: '60px 20px' }}>
      <h1>Crear cuenta</h1>
      <p className="muted">Regístrate como cliente o como administrador de un restaurante.</p>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 22, marginTop: 20 }}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="name">Nombre</label>
          <input id="name" required value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={form.password}
            onChange={(e) => set('password', e.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="role">Tipo de cuenta</label>
          <select id="role" value={form.role} onChange={(e) => set('role', e.target.value)}>
            <option value="cliente">Cliente</option>
            <option value="admin">Administrador de restaurante</option>
          </select>
        </div>

        <button className="btn btn-primary" type="submit" disabled={submitting} style={{ width: '100%' }}>
          {submitting ? 'Creando cuenta...' : 'Crear cuenta'}
        </button>
      </form>

      <p className="muted" style={{ marginTop: 16, fontSize: 14 }}>
        ¿Ya tienes cuenta? <Link to="/login">Ingresa aquí</Link>
      </p>
    </div>
  );
}
