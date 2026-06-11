import { Home } from './pages/Home'
import { Training } from './pages/Training'

function App() {
  const path = window.location.pathname
  if (path === '/training') return <Training />
  return <Home />
}

export default App
