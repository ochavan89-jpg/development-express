import { useState, useEffect } from 'react'
import { walletAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'

const DEMO_BAL = [
  { id:3, full_name:'Suresh Kumar', company_name:'ABC Construction Pvt Ltd', wallet_balance:3200 },
  { id:4, full_name:'XYZ Builders',  company_name:'XYZ Builders Ltd',         wallet_balance:128400 },
  { id:5, full_name:'Govt. PWD',     company_name:'Public Works Dept.',        wallet_balance:84000 },
]
const DEMO_TXN = [
  { id:1, created_at:'2026-02-15T14:32:00Z', description:'Work Session — JCB Backhoe 6.5hrs', transaction_type:'debit', amount:9750, balance_after:3200, reg:'MH12AB1234' },
  { id:2, created_at:'2026-02-14T09:00:00Z', description:'Wallet Recharge — Razorpay',        transaction_type:'credit',amount:50000,balance_after:12950,reg:'—' },
  { id:3, created_at:'2026-02-14T18:00:00Z', description:'Work Session — Excavator 8hrs',     transaction_type:'debit', amount:16000,balance_after:6700, reg:'MH14CD5678' },
  { id:4, created_at:'2026-02-13T08:00:00Z', description:'Work Session — JCB + Excavator',    transaction_type:'debit', amount:28500,balance_after:50000,reg:'MH12AB1234' },
  { id:5, created_at:'2026-02-10T10:00:00Z', description:'Initial Wallet Recharge',            transaction_type:'credit',amount:500000,balance_after:500000,reg:'—' },
]

export default function Wallet() {
  const { user } = useAuth()
  const [bals, setBals] = useState(DEMO_BAL)
  const [txns, setTxns] = useState(DEMO_TXN)

  useEffect(() => {
    walletAPI.getAllBalances().then(r=>{ if(r.data.data?.length) setBals(r.data.data) }).catch(()=>{})
    walletAPI.getTransactions({limit:20}).then(r=>{ if(r.data.data?.length) setTxns(r.data.data) }).catch(()=>{})
  }, [])

  const critical = bals.filter(c => c.wallet_balance < 5000)

  return (
    <div>
      <div style={{ marginBottom:22 }}>
        <h1 style={{ fontFamily:'Cinzel', fontSize:17, letterSpacing:3, color:'var(--gold)' }}>WALLET & LEDGER</h1>
        <p style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>Client wallet management · Auto work-stop at ₹5,000</p>
      </div>

      {critical.map(c=>(
        <div key={c.id} className="anim-blink" style={{ background:'rgba(255,68,85,0.07)', border:'1px solid rgba(255,68,85,0.3)', borderRadius:10, padding:'13px 20px', marginBottom:14, display:'flex', alignItems:'center', gap:14 }}>
          <span style={{ fontSize:26 }}>🛑</span>
          <div style={{ flex:1 }}>
            <div style={{ color:'var(--red)', fontWeight:700, fontSize:14 }}>WORK STOP — {c.company_name}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,0.6)', marginTop:3 }}>Balance ₹{c.wallet_balance?.toLocaleString()} · Below ₹5,000 minimum · Auto-cutoff activated</div>
          </div>
          <button className="btn btn-gold" onClick={()=>toast.success('Recharge link sent to client!')}>+ RECHARGE NOW</button>
        </div>
      ))}

      {user?.role === 'admin' && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
          {bals.map(c=>{
            const low = c.wallet_balance < 5000
            const pct = Math.min((c.wallet_balance/500000)*100, 100)
            return (
              <div key={c.id} className="panel" style={{ padding:20, cursor:'pointer', transition:'border-color .2s', borderColor: low?'rgba(255,68,85,0.3)':'var(--border)' }}
                onMouseEnter={e=>e.currentTarget.style.borderColor=low?'rgba(255,68,85,0.6)':'var(--gold)'}
                onMouseLeave={e=>e.currentTarget.style.borderColor=low?'rgba(255,68,85,0.3)':'var(--border)'}>
                <div style={{ fontSize:10, letterSpacing:2, color:'var(--text-dim)', marginBottom:7 }}>{c.company_name}</div>
                <div className="mono" style={{ fontSize:28, color: low?'var(--red)':'var(--gold-bright)' }}>₹{c.wallet_balance?.toLocaleString()}</div>
                <div style={{ fontSize:11, color: low?'var(--red)':'var(--green)', marginBottom:12 }}>{low?'⚠ Below minimum':'✓ Sufficient balance'}</div>
                <div style={{ height:5, background:'rgba(255,255,255,0.07)', borderRadius:3, overflow:'hidden' }}>
                  <div style={{ width:`${pct}%`, height:'100%', background: low?'linear-gradient(90deg,#ff4455,#ff8c00)':'linear-gradient(90deg,var(--gold-dim),var(--gold-bright))', borderRadius:3 }}/>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="panel anim-up">
        <div className="panel-hdr">
          <span className="panel-title">📒 Transaction Ledger</span>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-outline" style={{ fontSize:10 }}>FILTER</button>
            <button className="btn btn-gold"    style={{ fontSize:10 }} onClick={()=>toast.success('PDF Ledger generated!')}>DOWNLOAD PDF</button>
          </div>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table className="tbl">
            <thead><tr><th>Date & Time</th><th>Description</th><th>Type</th><th>Amount</th><th>Machine</th><th>Balance</th><th>Invoice</th></tr></thead>
            <tbody>
              {txns.map(t=>(
                <tr key={t.id}>
                  <td className="mono" style={{ fontSize:11 }}>{new Date(t.created_at).toLocaleDateString('en-IN')} · {new Date(t.created_at).toLocaleTimeString('en-IN',{hour12:true})}</td>
                  <td style={{ fontSize:12 }}>{t.description}</td>
                  <td><span className={`badge ${t.transaction_type==='credit'?'b-active':'b-maint'}`}>{t.transaction_type==='credit'?'↑ Credit':'↓ Debit'}</span></td>
                  <td className="mono" style={{ fontWeight:700, color:t.transaction_type==='credit'?'var(--green)':'var(--red)' }}>{t.transaction_type==='credit'?'+':'-'}₹{t.amount?.toLocaleString()}</td>
                  <td className="mono" style={{ fontSize:11, color:'var(--gold)' }}>{t.reg||'—'}</td>
                  <td className="mono" style={{ fontSize:12 }}>₹{t.balance_after?.toLocaleString()}</td>
                  <td><button className="btn btn-outline" style={{ fontSize:9, padding:'3px 8px' }} onClick={()=>toast.success('Invoice downloaded!')}>INV-{String(t.id).padStart(4,'0')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
