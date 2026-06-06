import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import App from './App.jsx'
import { DispatchProvider } from './context/DispatchContext.jsx'
import 'leaflet/dist/leaflet.css'
import './index.css'
import './app.css'

// HashRouter keeps deep links working on plain S3 static hosting
// (no server-side rewrite rules required).
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <HashRouter>
      <DispatchProvider>
        <App />
      </DispatchProvider>
    </HashRouter>
  </React.StrictMode>
)
