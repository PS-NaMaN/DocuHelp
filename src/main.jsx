import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { registerGlobalErrorLogging } from './utils/logger'
import { installRuntimePolyfills } from './utils/runtimePolyfills'

installRuntimePolyfills()
registerGlobalErrorLogging()

/**
 * Mount the React application into the root DOM node.
 *
 * @returns {void}
 */
function renderApplication() {
  const rootElement = document.getElementById('root')
  const applicationRoot = createRoot(rootElement)

  applicationRoot.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

renderApplication()
