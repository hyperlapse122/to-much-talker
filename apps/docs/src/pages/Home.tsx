import type { JSX } from 'react'
import { Link } from 'react-router-dom'

export function Home(): JSX.Element {
  return (
    <div>
      <h1>To Much Talker</h1>
      <p style={{ color: '#aaa' }}>A Discord TTS bot powered by OpenRouter AI models.</p>
      <div style={{ display: 'flex', gap: '16px', marginTop: '24px' }}>
        <Link to="/guide/setup" style={{ padding: '12px 24px', background: '#fff', color: '#000', borderRadius: '8px', textDecoration: 'none', fontWeight: '500' }}>
          Get Started
        </Link>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '48px' }}>
        <div style={{ padding: '24px', border: '1px solid #222', borderRadius: '8px' }}>
          <h3>Multiple TTS Models</h3>
          <p style={{ color: '#aaa', fontSize: '14px' }}>Choose from Gemini Flash TTS or GPT-4o Mini TTS via OpenRouter.</p>
        </div>
        <div style={{ padding: '24px', border: '1px solid #222', borderRadius: '8px' }}>
          <h3>Per-Guild Settings</h3>
          <p style={{ color: '#aaa', fontSize: '14px' }}>Configure TTS settings at server, channel, and user level.</p>
        </div>
        <div style={{ padding: '24px', border: '1px solid #222', borderRadius: '8px' }}>
          <h3>BYOK</h3>
          <p style={{ color: '#aaa', fontSize: '14px' }}>Bring your own OpenRouter API key. AES-256-GCM encrypted at rest.</p>
        </div>
      </div>
    </div>
  )
}
