import { useState } from 'react'
import toast from 'react-hot-toast'

const CARDS = [
  { k:'daily',      icon:'📋', title:'Daily Machine Report', desc:'Hours worked, fuel consumed, HMR readings · Auto at 6 PM daily' },
  { k:'wallet',     icon:'💳', title:'Client Wallet Report', desc:'Full ledger with GST breakdown for all clients' },
  { k:'fuel',       icon:'⛽', title:'Fuel Analytics',       desc:'Omnicomm sensor data · Consumption vs efficiency per machine' },
  { k:'gst',        icon:'🧾', title:'GST Invoice Report',   desc:'Monthly CGST / SGST / IGST breakdown for filing' },
  { k:'commission', icon:'💰', title:'Commission Statement', desc:'15% commission per machine owner with payout schedule' },
  { k:'operator',   icon:'👷', title:'Operator Attendance',  desc:'Punch-in/out records, hours, site GPS log' },
]
const ROWS = [
  { machine:'JCB Backhoe 3DX',   reg:'MH12AB1234', hrs:6.5,  fs:170, fe:130, cons:40,  eff:6.15,  rev:9750  },
  { machine:'Excavator CAT 320', reg:'MH14CD5678', hrs:8.0,  fs:186, fe:66,  cons:120, eff:15.0,  rev:16000 },
  { machine:'Bulldozer CAT D6T', reg:'MH31GH3456', hrs:0.0,  fs:50,  fe:50,  cons:0,   eff:0,     rev:0     },
  { machine:'Crane XCMG QY25K',  reg:'MH22EF9012', hrs:5.5,  fs:220, fe:165, cons:55,  eff:10.0,  rev:13750 },
]

export default function Reports() {
  const [gen, setGen] = useState(null)
  const generate = (k, title) => {
    setGen(k)
    setTimeout(() => { setGen(null); toast.success(`✅ ${title} PDF generated!`) }, 2000)
  }
  const totals = ROWS.reduce((a,r)=>({hrs:a.hrs+r.hrs,cons:a.cons+r.cons,rev:a.rev+r.rev}),{hrs:0,cons:0,rev:0})
  return (
    <div>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontFamily:'Cinzel', fontSize:17, letterSpacing:3, color:'var(--gold)' }}>REPORTS & ANALYTICS</h1>
        <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>PDF generation · Auto daily report at 6:00 PM IST</p>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:26 }}>
        {CARDS.map(c=>(
          <div key={c.k} className="panel anim-up" style={{ padding:22, textAlign:'center', cursor:'pointer', transition:'border-color .2s' }}
            onMouseEnter={e=>e.currentTarget.style.borderColor='var(--gold)'}
            onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
            <div style={{ fontSize:34, marginBottom:10 }}>{c.icon}</div>
            <div style={{ fontFamily:'Cinzel', fontSize:12, color:'var(--gold)', marginBottom:7, letterSpacing:1 }}>{c.title}</div>
            <div style={{ fontSize:11, color:'var(--text-dim)', lineHeight:1.5, marginBottom:14 }}>{c.desc}</div>
            <button className="btn btn-gold" style={{ width:'100%', fontSize:10 }} disabled={gen===c.k} onClick={()=>generate(c.k,c.title)}>
              {gen===c.k ? <span style={{ display:'flex',alignItems:'center',justifyContent:'center',gap:8 }}><span className="anim-spin" style={{ width:12,height:12,border:'2px solid rgba(0,0,0,0.3)',borderTopColor:'rgba(0,0,0,0.7)',borderRadius:'50%',display:'block' }}/>GENERATING...</span> : 'GENERATE PDF'}
            </button>
          </div>
        ))}
      </div>
      <div className="panel anim-up">
        <div className="panel-hdr">
          <span className="panel-title">📊 Today's Summary — {new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'})}</span>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <span className="mono" style={{ fontSize:10, color:'var(--green)' }}>● AUTO PDF AT 18:00</span>
            <button className="btn btn-gold" style={{ fontSize:10 }} onClick={()=>generate('daily','Daily Machine Report')}>GENERATE NOW</button>
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>Machine</th><th>Reg. No.</th><th>Hours</th><th>Fuel Start</th><th>Fuel End</th><th>Consumed</th><th>Efficiency</th><th>Revenue</th></tr></thead>
            <tbody>
              {ROWS.map((r,i)=>(
                <tr key={i}>
                  <td style={{ fontWeight:600 }}>{r.machine}</td>
                  <td className="mono" style={{ color:'var(--gold)', fontSize:12 }}>{r.reg}</td>
                  <td className="mono" style={{ color:r.hrs>0?'var(--green)':'var(--text-dim)' }}>{r.hrs.toFixed(1)} hrs</td>
                  <td className="mono" style={{ fontSize:12 }}>{r.fs} L</td>
                  <td className="mono" style={{ fontSize:12 }}>{r.fe} L</td>
                  <td className="mono" style={{ color:'var(--orange)' }}>{r.cons} L</td>
                  <td className="mono" style={{ fontSize:12 }}>{r.eff>0?`${r.eff} L/hr`:'—'}</td>
                  <td className="mono" style={{ color:'var(--gold)', fontWeight:600 }}>₹{r.rev.toLocaleString()}</td>
                </tr>
              ))}
              <tr style={{ background:'rgba(201,168,76,0.05)', fontWeight:700 }}>
                <td colSpan={2} style={{ fontFamily:'Cinzel', fontSize:12, color:'var(--gold)', letterSpacing:1 }}>TOTAL</td>
                <td className="mono" style={{ color:'var(--green)' }}>{totals.hrs.toFixed(1)} hrs</td>
                <td colSpan={2}>—</td>
                <td className="mono" style={{ color:'var(--orange)' }}>{totals.cons} L</td>
                <td>—</td>
                <td className="mono" style={{ color:'var(--gold-bright)', fontSize:14 }}>₹{totals.rev.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
