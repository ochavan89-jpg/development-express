import { useState, useEffect } from 'react'
import { machinesAPI } from '../services/api'
import toast from 'react-hot-toast'

const DEMO = [
  { id:1, machine_type:'JCB Backhoe', model:'3DX', registration_number:'MH12AB1234', status:'active', current_fuel_level:170, fuel_capacity:200, rate_per_hour:1500, current_location_lat:17.2847, current_location_lng:74.1946 },
  { id:2, machine_type:'Excavator', model:'CAT 320', registration_number:'MH14CD5678', status:'active', current_fuel_level:66, fuel_capacity:300, rate_per_hour:2000, current_location_lat:17.2901, current_location_lng:74.1823 },
  { id:3, machine_type:'Bulldozer', model:'CAT D6T', registration_number:'MH31GH3456', status:'maintenance', current_fuel_level:50, fuel_capacity:250, rate_per_hour:1800, current_location_lat:17.2756, current_location_lng:74.2012 },
  { id:4, machine_type:'Crane', model:'XCMG QY25K', registration_number:'MH22EF9012', status:'active', current_fuel_level:54, fuel_capacity:300, rate_per_hour:2500, current_location_lat:17.2680, current_location_lng:74.1755 },
  { id:5, machine_type:'Tipper', model:'Ashok Leyland', registration_number:'MH18HJ7654', status:'idle', current_fuel_level:120, fuel_capacity:200, rate_per_hour:900, current_location_lat:17.2934, current_location_lng:74.2089 },
]
const SC = { active:'b-active', idle:'b-idle', maintenance:'b-maint', offline:'b-offline' }
const SL = { active:'● Active', idle:'◌ Idle', maintenance:'⚠ Maint.', offline:'○ Offline' }

export default function Machines() {
  const [machines, setMachines] = useState([])
  const [loading, setLoading] = useState(true)
  const [evidence, setEvidence] = useState(null)

  useEffect(() => {
    machinesAPI.getAll().then(r => setMachines(r.data.data?.length ? r.data.data : DEMO)).catch(() => setMachines(DEMO)).finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div>
          <h1 style={{ fontFamily:'Cinzel', fontSize:17, letterSpacing:3, color:'var(--gold)' }}>MACHINE FLEET</h1>
          <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>{machines.length} machines · Teltonika GPS + Omnicomm Fuel</p>
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <button className="btn btn-outline" onClick={() => machinesAPI.getAll().then(r=>setMachines(r.data.data||DEMO)).catch(()=>{})}>↻ REFRESH</button>
          <button className="btn btn-gold" onClick={() => toast.success('Add machine form — coming soon!')}>+ ADD MACHINE</button>
        </div>
      </div>

      {loading ? <div style={{ textAlign:'center', padding:60, color:'var(--text-dim)' }}>Loading machines...</div> : (
        <div className="panel anim-up" style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>Machine</th><th>Reg. No.</th><th>Status</th><th>GPS Location</th><th>Fuel Level</th><th>Rate/Hr</th><th>Evidence</th><th>Actions</th></tr></thead>
            <tbody>
              {machines.map(m => {
                const fp = m.fuel_capacity ? Math.round((m.current_fuel_level/m.fuel_capacity)*100) : 0
                const fc = fp > 50 ? 'var(--green)' : fp > 25 ? 'var(--orange)' : 'var(--red)'
                return (
                  <tr key={m.id}>
                    <td><div style={{ fontWeight:600 }}>{m.machine_type}</div><div style={{ fontSize:11, color:'var(--text-dim)' }}>{m.model}</div></td>
                    <td className="mono" style={{ color:'var(--gold)', fontSize:12 }}>{m.registration_number}</td>
                    <td><span className={`badge ${SC[m.status]||'b-idle'}`}>{SL[m.status]||m.status}</span></td>
                    <td className="mono" style={{ fontSize:11, color:'var(--blue)' }}>{m.current_location_lat ? <>{parseFloat(m.current_location_lat).toFixed(4)}°N<br/>{parseFloat(m.current_location_lng).toFixed(4)}°E</> : '—'}</td>
                    <td>
                      <div className="fuel-wrap"><div className="fuel-bg"><div className="fuel-fill" style={{ width:`${fp}%`, background:fc }}/></div><span className="mono" style={{ fontSize:12, color:fc, width:36, textAlign:'right' }}>{fp}%</span></div>
                      <div style={{ fontSize:10, color:'var(--text-dim)', marginTop:3 }}>{m.current_fuel_level}L / {m.fuel_capacity}L</div>
                    </td>
                    <td className="mono" style={{ color:'var(--gold)' }}>₹{m.rate_per_hour?.toLocaleString()}</td>
                    <td><button className="btn btn-outline" style={{ fontSize:10, padding:'5px 10px' }} onClick={() => setEvidence(m)}>📁 VIEW</button></td>
                    <td><div style={{ display:'flex', gap:6 }}><button className="btn btn-outline" style={{ fontSize:10, padding:'4px 9px' }} onClick={() => toast.success('Edit form coming soon!')}>EDIT</button><button className="btn btn-red" style={{ fontSize:10, padding:'4px 9px' }} onClick={() => toast.error('Cannot delete active machine')}>DEL</button></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Evidence Modal */}
      {evidence && (
        <div onClick={() => setEvidence(null)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.85)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', backdropFilter:'blur(8px)' }}>
          <div onClick={e=>e.stopPropagation()} style={{ background:'var(--navy-mid)', border:'1px solid var(--border)', borderRadius:12, width:620, maxHeight:'85vh', overflow:'hidden' }}>
            <div style={{ padding:'17px 22px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <div style={{ fontFamily:'Cinzel', fontSize:13, color:'var(--gold)', letterSpacing:2 }}>📁 {evidence.machine_type} — EVIDENCE HUB</div>
                <div className="mono" style={{ fontSize:11, color:'var(--text-dim)', marginTop:4 }}>{evidence.registration_number} · 360° Dashcam + Teltonika</div>
              </div>
              <button onClick={() => setEvidence(null)} style={{ background:'none', border:'none', color:'var(--text-dim)', cursor:'pointer', fontSize:20 }}>✕</button>
            </div>
            <div style={{ display:'flex', gap:8, padding:'11px 20px', borderBottom:'1px solid var(--border)' }}>
              {['📹 VIDEOS','📷 PHOTOS','📄 LOGS'].map(t=><button key={t} className="btn btn-outline" style={{ fontSize:10 }}>{t}</button>)}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, padding:18 }}>
              {['08:02 AM · Start','09:30 AM · Site','11:00 AM · Work','12:45 PM · Break','01:30 PM · Resume','14:28 · Latest'].map((t,i)=>(
                <div key={i} style={{ aspectRatio:'16/9', background:'var(--navy-light)', borderRadius:6, border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, cursor:'pointer', position:'relative', transition:'border-color .2s' }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor='var(--gold)'}
                  onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                  {i%3===0?'📹':'📷'}
                  <div style={{ position:'absolute', bottom:4, left:4, fontSize:9, color:'var(--text-dim)', background:'rgba(0,0,0,0.6)', padding:'2px 5px', borderRadius:3 }}>{t}</div>
                </div>
              ))}
            </div>
            <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div style={{ fontSize:11, color:'var(--text-dim)' }}>6 files · AWS S3 Storage</div>
              <button className="btn btn-gold" onClick={() => toast.success('Downloading all files...')}>DOWNLOAD ALL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
