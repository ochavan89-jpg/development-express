import { useState, useEffect } from 'react'
import { Outlet, NavLink } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

/* ─── SHIELD SVG ─── */
function Shield({ size = 44 }) {
  return (
    <svg width={size} height={size * 1.1} viewBox="0 0 80 88" fill="none"
      style={{ filter: 'drop-shadow(0 0 8px rgba(201,168,76,0.45))' }}>
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f0c040"/>
          <stop offset="100%" stopColor="#8a6a20"/>
        </linearGradient>
      </defs>
      <path d="M40 4L72 16L72 46Q72 70 40 84Q8 70 8 46L8 16Z" fill="url(#sg)" opacity=".12" stroke="url(#sg)" strokeWidth="1.5"/>
      <path d="M40 10L66 20L66 46Q66 66 40 78Q14 66 14 46L14 20Z" fill="none" stroke="url(#sg)" strokeWidth="1"/>
      <path d="M24 14L28 8L40 12L52 8L56 14" stroke="url(#sg)" strokeWidth="1.5" fill="none"/>
      <circle cx="28" cy="8" r="2.5" fill="#f0c040"/>
      <circle cx="40" cy="11" r="3" fill="#f0c040"/>
      <circle cx="52" cy="8" r="2.5" fill="#f0c040"/>
      <text x="22" y="57" fill="url(#sg)" fontSize="28" fontWeight="900" fontFamily="serif">DE</text>
    </svg>
  )
}

/* ─── SIDEBAR ─── */
const NAV = [
  { path:'/dashboard', icon:'⚡', label:'Command Center', roles:['admin','owner','client','operator'] },
  { path:'/machines',  icon:'🚛', label:'Machine Fleet',  roles:['admin','owner'] },
  { path:'/bookings',  icon:'📋', label:'Bookings',       roles:['admin','owner','client'] },
  { path:'/wallet',    icon:'💳', label:'Wallet & Ledger',roles:['admin','owner','client'] },
  { path:'/reports',   icon:'📊', label:'Reports',        roles:['admin','owner'] },
  { path:'/operators', icon:'👷', label:'Operators',      roles:['admin'] },
  { path:'/users',     icon:'👥', label:'Users',          roles:['admin'] },
]

function Sidebar({ collapsed }) {
  const { user } = useAuth()
  const items = NAV.filter(n => n.roles.includes(user?.role || 'admin'))
  return (
    <aside style={{ width: collapsed ? 58 : 210, background:'var(--navy-mid)', borderRight:'1px solid var(--border)', transition:'width .25s', overflow:'hidden', flexShrink:0, position:'relative' }}>
      <nav style={{ padding:'12px 0' }}>
        {items.map(n => (
          <NavLink key={n.path} to={n.path} style={({ isActive }) => ({
            display:'flex', alignItems:'center', gap:12,
            padding: collapsed ? '11px 0' : '11px 16px',
            justifyContent: collapsed ? 'center' : 'flex-start',
            textDecoration:'none',
            color: isActive ? 'var(--gold-bright)' : 'var(--text-dim)',
            background: isActive ? 'rgba(201,168,76,0.08)' : 'transparent',
            borderRight: isActive ? '2px solid var(--gold-bright)' : '2px solid transparent',
            transition:'all .2s', fontSize:14, fontWeight:600,
          })}>
            <span style={{ fontSize:18, flexShrink:0 }}>{n.icon}</span>
            {!collapsed && <span style={{ whiteSpace:'nowrap' }}>{n.label}</span>}
          </NavLink>
        ))}
      </nav>
      {!collapsed && (
        <div style={{ position:'absolute', bottom:14, left:0, right:0, padding:'0 12px' }}>
          <div style={{ background:'rgba(201,168,76,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:'9px 12px' }}>
            <div style={{ fontSize:9, letterSpacing:2, color:'var(--text-dim)', marginBottom:3 }}>LOGGED IN AS</div>
            <div style={{ fontSize:12, color:'var(--gold)', fontWeight:700 }}>{user?.full_name}</div>
            <div style={{ fontSize:10, color:'var(--text-dim)', textTransform:'uppercase', letterSpacing:1 }}>{user?.role}</div>
          </div>
        </div>
      )}
    </aside>
  )
}

/* ─── HEADER ─── */
function Header({ onToggle }) {
  const { user, logout } = useAuth()
  const [time, setTime] = useState(new Date())
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t) }, [])

  const initials = (user?.full_name || 'OC').split(' ').map(n=>n[0]).join('').slice(0,2)

  return (
    <header style={{ height:66, background:'rgba(10,14,26,0.97)', borderBottom:'1px solid var(--border)', backdropFilter:'blur(20px)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 22px', position:'sticky', top:0, zIndex:100, flexShrink:0 }}>
      {/* Left */}
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <button onClick={onToggle} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:20, padding:'4px 6px' }}>☰</button>
        <Shield size={38} />
        <div>
          <div className="gold-text" style={{ fontFamily:'Cinzel', fontSize:15, fontWeight:700, letterSpacing:3 }}>DEVELOPMENT EXPRESS</div>
          <div style={{ fontSize:9, letterSpacing:3, color:'var(--text-dim)' }}>THE GOLD STANDARD OF INFRASTRUCTURE</div>
        </div>
      </div>

      {/* Center status */}
      <div style={{ display:'flex', alignItems:'center', gap:20 }}>
        {[['SYSTEM','var(--green)'],['GPS','var(--green)'],['DB','var(--green)']].map(([l,c])=>(
          <div key={l} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, letterSpacing:1, color:'var(--text-dim)' }}>
            <span className="anim-pulse" style={{ width:7, height:7, borderRadius:'50%', background:c, boxShadow:`0 0 6px ${c}`, display:'block' }}/>
            {l}
          </div>
        ))}
        <div className="mono" style={{ fontSize:13, color:'var(--gold)', letterSpacing:2 }}>
          {time.toLocaleTimeString('en-IN',{hour12:false})} IST
        </div>
      </div>

      {/* Right: founder + logout */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ background:'rgba(201,168,76,0.05)', border:'1px solid var(--border)', borderRadius:8, padding:'6px 12px', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:13, fontWeight:600, color:'var(--gold)' }}>{user?.full_name || 'Om Chavan'}</div>
            <div style={{ fontSize:10, color:'var(--text-dim)' }}>
              {user?.role === 'admin' ? 'B.Tech Civil Engg. · MD' : user?.role}
            </div>
            <div className="mono" style={{ fontSize:9, color:'var(--text-dim)' }}>om.chavan2026@zohomail.in</div>
          </div>
          <div style={{ width:34, height:34, borderRadius:'50%', background:'linear-gradient(135deg,var(--gold),var(--gold-dim))', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Cinzel', fontWeight:700, fontSize:13, color:'var(--navy)' }}>
            {initials}
          </div>
        </div>
        <button onClick={logout} title="Logout" style={{ background:'rgba(255,68,85,0.1)', border:'1px solid rgba(255,68,85,0.2)', borderRadius:6, padding:'8px 12px', cursor:'pointer', fontSize:14, color:'var(--red)' }}>
          ⏻
        </button>
      </div>
    </header>
  )
}

/* ─── LAYOUT ─── */
export default function Layout() {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh' }}>
      <Header onToggle={() => setCollapsed(p=>!p)} />
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <Sidebar collapsed={collapsed} />
        <main style={{ flex:1, overflow:'auto', padding:24, position:'relative', zIndex:1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
