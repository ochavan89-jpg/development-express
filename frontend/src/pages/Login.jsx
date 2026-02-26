import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const DEMOS = [
  { role:'Admin', u:'admin',    p:'admin123' },
  { role:'Owner', u:'owner',    p:'owner123' },
  { role:'Client',u:'client',   p:'client123' },
  { role:'Oper.', u:'operator', p:'operator123' },
]

export default function Login() {
  const [f, setF] = useState({ username:'', password:'' })
  const [busy, setBusy] = useState(false)
  const { login } = useAuth()
  const nav = useNavigate()

  const submit = async e => {
    e.preventDefault()
    if (!f.username || !f.password) return toast.error('Enter credentials')
    setBusy(true)
    try {
      const u = await login(f.username, f.password)
      toast.success(`Welcome, ${u.full_name}!`)
      nav('/dashboard')
    } catch { /* interceptor shows error */ }
    finally { setBusy(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--navy)', display:'flex', alignItems:'center', justifyContent:'center', position:'relative', overflow:'hidden' }}>
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(201,168,76,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(201,168,76,0.04) 1px,transparent 1px)', backgroundSize:'40px 40px' }}/>
      <div style={{ position:'absolute', top:'15%', left:'50%', transform:'translateX(-50%)', width:500, height:500, background:'radial-gradient(circle,rgba(201,168,76,0.05) 0%,transparent 70%)', pointerEvents:'none' }}/>

      <div className="anim-up" style={{ width:420, position:'relative', zIndex:1, background:'var(--navy-mid)', border:'1px solid var(--border)', borderRadius:16, padding:'46px 40px', boxShadow:'0 40px 80px rgba(0,0,0,0.5)' }}>
        {/* Logo */}
        <div style={{ textAlign:'center', marginBottom:38 }}>
          <svg width="60" height="66" viewBox="0 0 80 88" fill="none" style={{ margin:'0 auto', display:'block', filter:'drop-shadow(0 0 16px rgba(201,168,76,0.5))' }}>
            <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f0c040"/><stop offset="100%" stopColor="#8a6a20"/></linearGradient></defs>
            <path d="M40 4L72 16L72 46Q72 70 40 84Q8 70 8 46L8 16Z" fill="url(#lg)" opacity=".15" stroke="url(#lg)" strokeWidth="1.5"/>
            <path d="M40 10L66 20L66 46Q66 66 40 78Q14 66 14 46L14 20Z" fill="none" stroke="url(#lg)" strokeWidth="1"/>
            <path d="M24 14L28 8L40 12L52 8L56 14" stroke="url(#lg)" strokeWidth="1.5" fill="none"/>
            <circle cx="28" cy="8" r="2.5" fill="#f0c040"/>
            <circle cx="40" cy="11" r="3" fill="#f0c040"/>
            <circle cx="52" cy="8" r="2.5" fill="#f0c040"/>
            <text x="22" y="57" fill="url(#lg)" fontSize="28" fontWeight="900" fontFamily="serif">DE</text>
          </svg>
          <div className="gold-text" style={{ fontFamily:'Cinzel', fontSize:18, fontWeight:700, letterSpacing:4, marginTop:14 }}>DEVELOPMENT EXPRESS</div>
          <div style={{ fontSize:10, letterSpacing:3, color:'var(--text-dim)', marginTop:4 }}>SMART EQUIPMENT MANAGEMENT PLATFORM</div>
        </div>

        <form onSubmit={submit}>
          <div style={{ marginBottom:18 }}>
            <label style={{ display:'block', fontSize:11, letterSpacing:2, color:'var(--text-dim)', marginBottom:7, textTransform:'uppercase' }}>Username</label>
            <input className="inp" placeholder="Enter username" value={f.username} onChange={e=>setF(p=>({...p,username:e.target.value}))} autoFocus/>
          </div>
          <div style={{ marginBottom:26 }}>
            <label style={{ display:'block', fontSize:11, letterSpacing:2, color:'var(--text-dim)', marginBottom:7, textTransform:'uppercase' }}>Password</label>
            <input className="inp" type="password" placeholder="Enter password" value={f.password} onChange={e=>setF(p=>({...p,password:e.target.value}))}/>
          </div>
          <button type="submit" className="btn btn-gold" style={{ width:'100%', padding:'12px', fontSize:13, letterSpacing:3 }} disabled={busy}>
            {busy ? 'AUTHENTICATING...' : 'SIGN IN'}
          </button>
        </form>

        {/* Demo creds */}
        <div style={{ marginTop:26, padding:'13px 15px', background:'rgba(0,0,0,0.2)', borderRadius:8, border:'1px solid rgba(201,168,76,0.07)' }}>
          <div style={{ fontSize:9, letterSpacing:2, color:'var(--text-dim)', marginBottom:9 }}>DEMO CREDENTIALS — CLICK TO AUTO-FILL</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
            {DEMOS.map(d => (
              <button key={d.role} onClick={() => setF({ username:d.u, password:d.p })}
                style={{ background:'rgba(201,168,76,0.06)', border:'1px solid var(--border)', borderRadius:6, padding:'7px 10px', cursor:'pointer', textAlign:'left', transition:'border-color .2s' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor='var(--gold)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                <div style={{ fontSize:11, color:'var(--gold)', fontWeight:600 }}>{d.role}</div>
                <div className="mono" style={{ fontSize:10, color:'var(--text-dim)' }}>{d.u} / {d.p}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ textAlign:'center', marginTop:18, fontSize:10, color:'var(--text-dim)', letterSpacing:1 }}>
          Karad, Satara · Maharashtra · © 2026 Development Express
        </div>
      </div>
    </div>
  )
}
