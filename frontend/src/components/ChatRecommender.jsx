import { useEffect, useRef, useState } from 'react';
import { chatApi } from '../api/resources';
import { useAuth, CHAT_PENDING_GREETING_KEY } from '../context/AuthContext';
import RestaurantCard from './RestaurantCard';

let nextId = 1;

const WELCOME_MESSAGE =
  '¡Hola! 👋 Soy el asistente de recomendaciones de GSI. Cuéntame qué se te antoja — ' +
  'zona, presupuesto, tipo de comida o si necesitas parqueadero cerca — y te propongo ' +
  'opciones reales de nuestro catálogo de restaurantes.';

export default function ChatRecommender() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef(null);

  // Saludo automático: persistSession() en AuthContext deja esta marca SOLO en un
  // login/registro real (nunca al restaurar sesión desde un token guardado al
  // recargar la página). La consumimos apenas se muestra, así que no se repite ni
  // al navegar entre páginas ni al refrescar con la sesión ya activa.
  useEffect(() => {
    if (!user) return;
    if (sessionStorage.getItem(CHAT_PENDING_GREETING_KEY) !== '1') return;

    const timer = setTimeout(() => {
      sessionStorage.removeItem(CHAT_PENDING_GREETING_KEY);
      setMessages((prev) => [...prev, { id: nextId++, role: 'assistant', text: WELCOME_MESSAGE, recommendations: [] }]);
      setOpen(true);
    }, 600);

    return () => clearTimeout(timer);
  }, [user]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading, open]);

  async function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history = messages.map((m) => ({ role: m.role, content: m.text }));
    setMessages((prev) => [...prev, { id: nextId++, role: 'user', text }]);
    setInput('');
    setLoading(true);
    setError('');

    try {
      const data = await chatApi.recommend(text, history);
      setMessages((prev) => [
        ...prev,
        { id: nextId++, role: 'assistant', text: data.message, recommendations: data.recommendations || [] }
      ]);
    } catch (err) {
      setError(err.message || 'No pudimos conectar con el chat. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-widget">
      {open && (
        <div className="chat-panel">
          <div className="chat-header">
            <div>
              <h4>Recomendador GSI</h4>
              <p>Cuéntame qué se te antoja</p>
            </div>
            <button className="chat-header-close" onClick={() => setOpen(false)} aria-label="Cerrar chat">
              ✕
            </button>
          </div>

          <div className="chat-messages" ref={scrollRef}>
            {messages.length === 0 && (
              <p className="chat-empty-hint">
                Ej: "algo económico con parqueadero en el Barzal, que no sea muy picante"
              </p>
            )}

            {messages.map((m) => (
              <div key={m.id}>
                <div className={`chat-msg ${m.role === 'user' ? 'chat-msg-user' : 'chat-msg-ai'}`}>{m.text}</div>

                {m.role === 'assistant' && m.recommendations?.length > 0 && (
                  <div className="chat-recommendations" style={{ marginTop: 8 }}>
                    {m.recommendations.map((r) => (
                      <div key={r.id} className="chat-rec-card">
                        <RestaurantCard restaurant={r} />
                        {r.reason && <p className="chat-rec-reason">{r.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="chat-typing" aria-label="Escribiendo...">
                <span></span>
                <span></span>
                <span></span>
              </div>
            )}
          </div>

          {error && (
            <div className="alert alert-error" style={{ margin: '0 12px', marginTop: 8 }}>
              {error}
            </div>
          )}

          <form className="chat-input-row" onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribe lo que buscas..."
              disabled={loading}
            />
            <button type="submit" className="btn btn-primary btn-sm" disabled={loading || !input.trim()}>
              Enviar
            </button>
          </form>
        </div>
      )}

      <button
        className="chat-bubble-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Cerrar chat de recomendaciones' : 'Abrir chat de recomendaciones'}
      >
        {open ? '✕' : '💬'}
      </button>
    </div>
  );
}
