import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { enablePreservedDrawingBuffers } from './components/preserve-drawing-buffer.ts'

// Must run before anything requests a WebGL context.
enablePreservedDrawingBuffers()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
