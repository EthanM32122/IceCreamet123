import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import initDevToolsBlock from '@/lib/devToolsBlock'

initDevToolsBlock();

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)