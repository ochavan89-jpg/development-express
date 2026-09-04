import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { bookingAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

const BKS = [
  { id:1, client:'ABC Construction', machine:'JCB Backhoe 3DX',    reg:'MH12AB1234', start_time:'2026-02-15T08:00:00Z', status:'active',    hourly_rate:1500, actual_hours:6.5, site:'Karad Site A' },
  { id:2, client:'XYZ Builders',     machine:'Excavator CAT 320',  reg:'MH14CD5678', start_time:'2026-02-15T07:30:00Z', status:'active',    hourly_rate:2000, actual_hours:8.0, site:'Satara Highway' },
  { id:3, client:'Govt. PWD',        machine:'Crane XCMG QY25K',   reg:'MH22EF9012', start_time:'2026-02-15T09:00:00Z', status:'active',    hourly_rate:2500, actual_hours:5.5, site:'Bridge Project' },
  { id:4, client:'Patil Infra',      machine:'Tipper Ashok Leyland',reg:'MH18HJ7654', start_time:'2026-02-14T08:00:00Z', status:'completed', hourly_rate:900,  actual_hours:8.0, site:'NH-48' },
]
const SC = { active:'b-active', pending:'b-idle', completed:'b-offline', cancelled:'b-maint' }

const normalizeBooking = (b) => ({
  ...b,
  client: b.client || b.client_name || b.company_name || 'Unknown Client',
  machine: b.machine || [b.machine_type, b.model].filter(Boolean).join(' ') || 'Unknown Machine',
  reg: b.reg || b.registration_number || '—',
  site: b.site || b.site_address || '—',
  actual_hours: b.actual_hours ?? b.estimated_hours ?? 0,
})

export default function Bookings() {
  const { user } = useAuth()
  const [bks, setBks] = useState([])
  const [loading, setLoading] = useState(true)
  const [completing, setCompleting] = useState(null)
  const canComplete = ['admin', 'operator'].includes(user?.role)

  const loadBookings = () => {
    setLoading(true)
    bookingAPI.getAll()
      .then(r => {
        const rows = r.data.data || []
        setBks(rows.length ? rows.map(normalizeBooking) : BKS)
      })
      .catch(() => setBks(BKS))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadBookings() }, [])

  const completeBooking = async (booking) => {
    const defaultHours = booking.actual_hours || booking.estimated_hours || ''
    const input = window.prompt('Enter actual hours worked', String(defaultHours))
    if (input === null) return
    const actual_hours = parseFloat(input)
    if (!Number.isFinite(actual_hours) || actual_hours <= 0) return toast.error('Enter valid actual hours')

    setCompleting(booking.id)
    try {
      const r = await bookingAPI.complete(booking.id, { actual_hours })
      setBks(prev => prev.map(b => b.id === booking.id ? normalizeBooking({ ...b, ...r.data.data }) : b))
      toast.success('Booking completed and wallet updated')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to complete booking')
    } finally {
      setCompleting(null)
    }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div><h1 style={{ fontFamily:'Cinzel', fontSize:17, letterSpacing:3, color:'var(--gold)' }}>BOOKINGS</h1><p style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>Active & completed work orders</p></div>
        <button className="btn btn-gold" onClick={()=>toast.success('New booking form coming soon!')}>+ NEW BOOKING</button>
      </div>
      {loading ? <div style={{ textAlign:'center', padding:60, color:'var(--text-dim)' }}>Loading bookings...</div> : <div className="panel anim-up" style={{ overflowX:'auto' }}>
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
                <td>{canComplete && b.status==='active' && <button className="btn btn-green" style={{ fontSize:10 }} disabled={completing===b.id} onClick={()=>completeBooking(b)}>{completing===b.id ? 'SAVING...' : 'COMPLETE'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>}
    </div>
  )
}
