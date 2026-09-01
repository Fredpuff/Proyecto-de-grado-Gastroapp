import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

function Root() {
  const app = (
    <AuthProvider>
      <App />
    </AuthProvider>
  )

  // Sin VITE_GOOGLE_CLIENT_ID el login tradicional debe seguir funcionando:
  // solo se omite el provider de Google (el botón no se muestra).
  return googleClientId ? (
    <GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>
  ) : (
    app
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </StrictMode>,
)
