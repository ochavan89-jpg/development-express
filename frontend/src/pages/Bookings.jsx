import { useState } from 'react'
import toast from 'react-hot-toast'
const BKS = [
  { id:1, client:'ABC Construction', machine:'JCB Backhoe 3DX',    reg:'MH12AB1234', start_time:'2026-02-15T08:00:00Z', status:'active',    hourly_rate:1500, actual_hours:6.5, site:'Karad Site A' },
  { id:2, client:'XYZ Builders',     machine:'Excavator CAT 320',  reg:'MH14CD5678', start_time:'2026-02-15T07:30:00Z', status:'active',    hourly_rate:2000, actual_hours:8.0, site:'Satara Highway' },
  { id:3, client:'Govt. PWD',        machine:'Crane XCMG QY25K',   reg:'MH22EF9012', start_time:'2026-02-15T09:00:00Z', status:'active',    hourly_rate:2500, actual_hours:5.5, site:'Bridge Project' },
  { id:4, client:'Patil Infra',      machine:'Tipper Ashok Leyland',reg:'MH18HJ7654', start_time:'2026-02-14T08:00:00Z', status:'completed', hourly_rate:900,  actual_hours:8.0, site:'NH-48' },
]
const SC = { active:'b-active', pending:'b-idle', completed:'b-offline', cancelled:'b-maint' }
export default function Bookings() {
  const [bks] = useState(BKS)
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div><h1 style={{ fontFamily:'Cinzel', fontSize:17, letterSpacing:3, color:'var(--gold)' }}>BOOKINGS</h1><p style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>Active & completed work orders</p></div>
        <button className="btn btn-gold" onClick={()=>toast.success('New booking form coming soon!')}>+ NEW BOOKING</button>
      </div>
      <div className="panel anim-up" style={{ overflowX:'auto' }}>
        <table className="tbl">
          <thead><tr><th>ID</th><th>Client</th><th>Machine</th><th>Site</th><th>Start</th><th>Hours</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            {bks.map(b=>(
              <tr key={b.id}>
                <td className="mono" style={{ color:'var(--text-dim)', fontSize:12 }}>#{String(b.id).padStart(4,'0')}</td>
                <td style={{ fontWeight:600 }}>{b.client}</td>
                <td><div>{b.machine}</div><div className="mono" style={{ fontSize:11, color:'var(--gold)' }}>{b.reg}</div></td>
                <td style={{ fontSize:12, color:'var(--text-dim)' }}>{b.site}</td>
                <td className="mono" style={{ fontSize:11 }}>{new Date(b.start_time).toLocaleDateString('en-IN')}</td>
                <td className="mono" style={{ color:'var(--green)' }}>{b.actual_hours} hrs</td>
                <td className="mono" style={{ color:'var(--gold)' }}>₹{(b.hourly_rate*b.actual_hours).toLocaleString()}</td>
                <td><span className={`badge ${SC[b.status]}`}>{b.status}</span></td>
                <td>{b.status==='active' && <button className="btn btn-green" style={{ fontSize:10 }} onClick={()=>toast.success('Booking completed!')}>COMPLETE</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
