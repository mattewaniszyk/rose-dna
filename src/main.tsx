import { createRoot } from 'react-dom/client'
import './index.css'
import { enablePreservedDrawingBuffers } from './components/preserve-drawing-buffer.ts'
import { Startup } from './Startup.tsx'

// Must run before anything requests a WebGL context.
enablePreservedDrawingBuffers()

createRoot(document.getElementById('root')!).render(
  <Startup />,
)
