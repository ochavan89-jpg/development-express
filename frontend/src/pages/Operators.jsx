import { useState } from 'react'
import toast from 'react-hot-toast'
const OPS = [
  { id:1, full_name:'Ramesh Kumar',  phone:'9876543213', machine:'JCB MH12AB1234',          punchIn:'08:02 AM', hours:6.5, lat:17.2847, status:'active' },
  { id:2, full_name:'Suresh Jadhav', phone:'9876543214', machine:'Excavator MH14CD5678',    punchIn:'07:45 AM', hours:8.0, lat:17.2901, status:'active' },
  { id:3, full_name:'Prakash More',  phone:'9876543215', machine:'Crane MH22EF9012',        punchIn:'09:15 AM', hours:5.5, lat:17.2680, status:'active' },
  { id:4, full_name:'Vijay Patil',   phone:'9876543216', machine:'Tipper MH18HJ7654',       punchIn:'08:30 AM', hours:2.0, lat:17.2934, status:'idle' },
]
export default function Operators() {
  const [ops] = useState(OPS)
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div><h1 style={{ fontFamily:'Cinzel', fontSize:17, letterSpacing:3, color:'var(--gold)' }}>OPERATORS</h1><p style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>Attendance · GPS tracking · Performance</p></div>
        <button className="btn btn-gold" onClick={()=>toast.success('Add operator form coming soon!')}>+ ADD OPERATOR</button>
      </div>
      <div className="panel anim-up" style={{ overflowX:'auto' }}>
        <table className="tbl">
          <thead><tr><th>Operator</th><th>Phone</th><th>Machine</th><th>Punch In</th><th>Hours Today</th><th>GPS</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {ops.map(o=>(
              <tr key={o.id}>
                <td style={{ fontWeight:600 }}>{o.full_name}</td>
                <td className="mono" style={{ fontSize:12 }}>{o.phone}</td>
                <td style={{ fontSize:12 }}>{o.machine}</td>
                <td className="mono" style={{ fontSize:12, color:'var(--gold)' }}>{o.punchIn}</td>
                <td className="mono" style={{ color:'var(--green)' }}>{o.hours.toFixed(1)} hrs</td>
                <td className="mono" style={{ fontSize:11, color:'var(--blue)' }}>{o.lat.toFixed(4)}°N</td>
                <td><span className={`badge ${o.status==='active'?'b-active':'b-idle'}`}>{o.status==='active'?'● On Site':'◌ Break'}</span></td>
                <td><button className="btn btn-outline" style={{ fontSize:10 }} onClick={()=>toast.success('Log view coming soon!')}>VIEW LOG</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
