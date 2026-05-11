import type { JSX } from 'react'
import { Routes, Route, Link } from 'react-router-dom'
import { Home } from './pages/Home.js'
import { Guide } from './pages/Guide.js'

export function App(): JSX.Element {
  return (
    <div style={{ minHeight: '100vh' }}>
      <header style={{ borderBottom: '1px solid #222', padding: '16px 24px' }}>
        <nav style={{ display: 'flex', gap: '24px', maxWidth: '1000px', margin: '0 auto' }}>
          <Link to="/" style={{ fontWeight: 'bold', fontSize: '18px', color: '#fff', textDecoration: 'none' }}>
            To Much Talker
          </Link>
          <Link to="/guide/setup" style={{ color: '#aaa', textDecoration: 'none' }}>Setup</Link>
          <Link to="/guide/commands" style={{ color: '#aaa', textDecoration: 'none' }}>Commands</Link>
        </nav>
      </header>
      <main style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/guide/:slug" element={<Guide />} />
        </Routes>
      </main>
    </div>
  )
}
