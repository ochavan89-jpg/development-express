import { useState, useEffect } from 'react'
import { dashboardAPI, alertAPI } from '../services/api'

/* KPI Card */
function KPI({ label, value, sub, icon, color, delay }) {
  return (
    <div className={`anim-up d${delay}`} style={{ background:'var(--navy-mid)', border:'1px solid var(--border)', borderRadius:10, padding:20, position:'relative', overflow:'hidden', cursor:'default', transition:'border-color .2s' }}
      onMouseEnter={e=>e.currentTarget.style.borderColor='var(--gold)'}
      onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
      <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color||'var(--gold)'},transparent)` }}/>
      <div style={{ position:'absolute', top:14, right:14, fontSize:22, opacity:.22 }}>{icon}</div>
      <div style={{ fontSize:10, letterSpacing:2, color:'var(--text-dim)', textTransform:'uppercase', marginBottom:7 }}>{label}</div>
      <div className="mono" style={{ fontSize:28, color:color||'var(--gold-bright)', lineHeight:1 }}>{value}</div>
      {sub && <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:6 }}>{sub}</div>}
    </div>
  )
}

const DEMO_ALERTS = [
  { id:1, alert_type:'low_wallet',     title:'Wallet Balance Critical', message:'ABC Construction · ₹3,200 remaining · Auto work-stop activated', is_resolved:false },
  { id:2, alert_type:'low_fuel',       title:'Low Fuel — 22%',          message:'MH14CD5678 Excavator CAT 320 · 66L remaining', is_resolved:false },
  { id:3, alert_type:'low_fuel',       title:'Low Fuel — 18%',          message:'MH22EF9012 Crane XCMG QY25K · 54L remaining', is_resolved:false },
  { id:4, alert_type:'maintenance_due',title:'Service Due in 3 days',    message:'MH12AB1234 JCB · Next: 28 Feb 2026', is_resolved:false },
  { id:5, alert_type:'geofence_breach',title:'Geofence Exit Detected',   message:'MH18HJ7654 Tipper · Left site boundary at 11:42', is_resolved:false },
]
const DEMO_STATS = { total_machines:47, active_machines:38, idle_machines:6, active_bookings:12, hours_today:284, revenue_today:426000 }

const ALERT_ICONS  = { low_fuel:'⛽', low_wallet:'💳', maintenance_due:'🔧', geofence_breach:'📍', unauthorized_use:'⚠' }
const ALERT_COLORS = { low_fuel:'var(--orange)', low_wallet:'var(--red)', maintenance_due:'var(--blue)', geofence_breach:'var(--blue)', unauthorized_use:'var(--red)' }

const GPS_PINS = [
  { top:'38%',left:'33%',color:'var(--green)', label:'JCB MH12AB1234' },
  { top:'52%',left:'58%',color:'var(--green)', label:'Excavator MH14CD5678' },
  { top:'29%',left:'52%',color:'var(--orange)',label:'Crane MH22EF9012 (Idle)' },
  { top:'63%',left:'38%',color:'var(--red)',   label:'Bulldozer MH31GH3456 (Maint.)' },
  { top:'43%',left:'70%',color:'var(--green)', label:'Tipper MH18HJ7654' },
]

export default function Dashboard() {
  const [stats,  setStats]  = useState(null)
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      dashboardAPI.getAdmin().catch(() => ({ data:{ data: DEMO_STATS } })),
      alertAPI.getAll({ limit:6 }).catch(() => ({ data:{ data: DEMO_ALERTS } })),
    ]).then(([s,a]) => {
      setStats(s.data.data || DEMO_STATS)
      setAlerts(a.data.data || DEMO_ALERTS)
    }).finally(() => setLoading(false))
  }, [])

  const workStop = alerts.find(a => a.alert_type === 'low_wallet' && !a.is_resolved)
  const s = stats || DEMO_STATS

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:300, flexDirection:'column', gap:16 }}>
      <div className="anim-spin" style={{ width:36, height:36, border:'3px solid #8a6a20', borderTopColor:'#f0c040', borderRadius:'50%' }}/>
      <p style={{ color:'var(--gold)', fontSize:12, letterSpacing:2 }}>LOADING DATA...</p>
    </div>
  )

  return (
    <div>
      {/* Page title */}
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontFamily:'Cinzel', fontSize:17, letterSpacing:3, color:'var(--gold)' }}>COMMAND CENTER</h1>
        <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:4, letterSpacing:1 }}>Real-time operations overview · Development Express</p>
      </div>

      {/* Work Stop Banner */}
      {workStop && (
        <div className="anim-blink" style={{ background:'rgba(255,68,85,0.08)', border:'1px solid rgba(255,68,85,0.35)', borderRadius:10, padding:'15px 20px', marginBottom:20, display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:30 }}>🛑</span>
          <div style={{ flex:1 }}>
            <div style={{ color:'var(--red)', fontWeight:700, fontSize:15 }}>⚠ WORK STOP ALERT</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:3 }}>{workStop.message}</div>
          </div>
          <button className="btn btn-gold" onClick={() => setAlerts(p => p.filter(a => a.id !== workStop.id))}>ACKNOWLEDGE</button>
        </div>
      )}

      {/* KPI Row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:16, marginBottom:22 }}>
        <KPI label="Total Machines" value={s.total_machines}   sub={`${s.active_machines} Active · ${s.idle_machines} Idle`} icon="🚛" delay={1}/>
        <KPI label="Active Bookings" value={s.active_bookings} sub="Today's work orders" icon="📋" color="var(--blue)" delay={2}/>
        <KPI label="Hours Today"    value={s.hours_today}      sub="↑ 12% vs yesterday"  icon="⏱" color="var(--green)" delay={3}/>
        <KPI label="Revenue Today"  value={`₹${((s.revenue_today||0)/100000).toFixed(2)}L`} sub={`₹${(((s.revenue_today||0)*0.15)/1000).toFixed(0)}K commission`} icon="₹" color="var(--gold-bright)" delay={4}/>
        <KPI label="Active Alerts"  value={alerts.filter(a=>!a.is_resolved).length} sub="Requires attention" icon="🔔" color="var(--red)" delay={5}/>
      </div>

      {/* Map + Alerts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 355px', gap:20 }}>

        {/* GPS Map */}
        <div className="panel anim-up">
          <div className="panel-hdr">
            <span className="panel-title">📍 Live GPS Tracking — Karad Region</span>
            <span className="mono" style={{ fontSize:10, color:'var(--green)' }}>● TELTONIKA LIVE</span>
          </div>
          <div style={{ padding:16 }}>
            <div style={{ background:'var(--navy-light)', borderRadius:8, height:330, position:'relative', overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center' }}>
              {/* Grid */}
              <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(68,136,255,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(68,136,255,0.05) 1px,transparent 1px)', backgroundSize:'28px 28px' }}/>
              {/* Pins */}
              {GPS_PINS.map((p,i) => (
                <div key={i} title={p.label} className="anim-ping" style={{ position:'absolute', top:p.top, left:p.left, width:12, height:12, borderRadius:'50%', background:p.color, border:`2px solid ${p.color}`, cursor:'pointer', zIndex:2, color:p.color }}/>
              ))}
              <div style={{ opacity:.18, textAlign:'center', zIndex:1 }}>
                <div style={{ fontFamily:'Cinzel', fontSize:15, letterSpacing:4, color:'var(--blue)' }}>KARAD · SATARA</div>
                <div style={{ fontSize:11, color:'var(--text-dim)', marginTop:4 }}>Maharashtra, India</div>
              </div>
              <div className="mono" style={{ position:'absolute', bottom:10, left:12, fontSize:9, color:'var(--blue)', letterSpacing:2 }}>TELTONIKA GPS FEED · LIVE</div>
            </div>
            <div style={{ display:'flex', gap:18, marginTop:11 }}>
              {[['var(--green)','Active (38)'],['var(--orange)','Idle (6)'],['var(--red)','Alert / Maint.']].map(([c,l])=>(
                <div key={l} style={{ fontSize:11, color:'var(--text-dim)', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'block' }}/>
                  {l}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Alerts */}
        <div className="panel anim-up">
          <div className="panel-hdr">
            <span className="panel-title">🔔 Live Alerts</span>
            <button className="btn btn-outline" style={{ fontSize:10, padding:'4px 10px' }}
              onClick={() => alertAPI.getAll({limit:8}).then(r=>setAlerts(r.data.data||DEMO_ALERTS)).catch(()=>{})}>
              ↻
            </button>
          </div>
          <div style={{ padding:'0 16px', maxHeight:390, overflowY:'auto' }}>
            {alerts.length === 0 ? (
              <div style={{ padding:'40px 0', textAlign:'center', color:'var(--text-dim)', fontSize:13 }}>
                <div style={{ fontSize:30, marginBottom:8 }}>✅</div>No active alerts
              </div>
            ) : alerts.map((a,i) => (
              <div key={a.id||i} style={{ display:'flex', gap:10, padding:'11px 0', borderBottom:'1px solid rgba(201,168,76,0.06)' }}>
                <div style={{ width:28, height:28, borderRadius:6, background:'rgba(0,0,0,0.18)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, flexShrink:0 }}>
                  {ALERT_ICONS[a.alert_type]||'🔔'}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:ALERT_COLORS[a.alert_type]||'var(--text)' }}>{a.title}</div>
                  <div className="mono" style={{ fontSize:10, color:'var(--text-dim)', marginTop:2 }}>{a.message?.slice(0,65)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
