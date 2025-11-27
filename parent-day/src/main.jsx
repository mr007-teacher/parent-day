import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// 确保这里没有 import './index.css' 或 import './App.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)