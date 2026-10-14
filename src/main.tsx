import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import PhoneTracker from './PhoneTracker'
import AuthGate from './AuthGate'
import './styles.css'

const isPhoneTracker = window.location.pathname.replace(/\/+$/, '') === '/track'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate>{isPhoneTracker ? <PhoneTracker /> : <App />}</AuthGate>
  </React.StrictMode>,
)
