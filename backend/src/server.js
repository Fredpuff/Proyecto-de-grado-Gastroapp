const app = require('./app');
require('dotenv').config();

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`GSI backend escuchando en http://localhost:${PORT}`);
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('Chat de recomendaciones con IA: ANTHROPIC_API_KEY detectada, listo para usarse.');
  } else {
    console.warn(
      'Chat de recomendaciones con IA: ANTHROPIC_API_KEY NO configurada. ' +
      'El endpoint /api/chat/recommend funcionará en modo degradado (sin IA) hasta que la agregues en backend/.env.'
    );
  }

  if (process.env.GOOGLE_CLIENT_ID) {
    console.log('Login con Google: GOOGLE_CLIENT_ID detectado, listo para usarse.');
  } else {
    console.warn(
      'Login con Google: GOOGLE_CLIENT_ID NO configurado. ' +
      'El endpoint /api/auth/google responderá 503 hasta que lo agregues en backend/.env.'
    );
  }
});
