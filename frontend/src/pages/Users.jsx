import { useState, useEffect } from 'react'
import { userAPI } from '../services/api'
import toast from 'react-hot-toast'
const DEMO = [
  { id:1, username:'admin',    full_name:'Om Chavan',    email:'om.chavan2026@zohomail.in',          role:'admin',    phone:'9766926636', is_active:true },
  { id:2, username:'owner',    full_name:'Rajesh Patil', email:'owner@developmentexpress.in',        role:'owner',    phone:'9876543211', is_active:true },
  { id:3, username:'client',   full_name:'Suresh Kumar', email:'client@developmentexpress.in',       role:'client',   phone:'9876543212', is_active:true },
  { id:4, username:'operator', full_name:'Ramesh Kumar', email:'operator@developmentexpress.in',     role:'operator', phone:'9876543213', is_active:true },
]
const RC = { admin:'b-maint', owner:'b-active', client:'b-idle', operator:'b-offline' }
export default function Users() {
  const [users, setUsers] = useState(DEMO)
  useEffect(() => { userAPI.getAll().then(r=>{ if(r.data.data?.length) setUsers(r.data.data) }).catch(()=>{}) }, [])
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:22 }}>
        <div><h1 style={{ fontFamily:'Cinzel', fontSize:17, letterSpacing:3, color:'var(--gold)' }}>USER MANAGEMENT</h1><p style={{ fontSize:12, color:'var(--text-dim)', marginTop:4 }}>Role-based access · Admin only</p></div>
        <button className="btn btn-gold" onClick={()=>toast.success('Add user form coming soon!')}>+ ADD USER</button>
      </div>
      <div className="panel anim-up">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Phone</th><th>Role</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map(u=>(
              <tr key={u.id}>
                <td style={{ fontWeight:600 }}>{u.full_name}</td>
                <td className="mono" style={{ fontSize:12, color:'var(--gold)' }}>{u.username}</td>
                <td style={{ fontSize:12 }}>{u.email}</td>
                <td className="mono" style={{ fontSize:12 }}>{u.phone}</td>
                <td><span className={`badge ${RC[u.role]}`}>{u.role}</span></td>
                <td><span className={`badge ${u.is_active?'b-active':'b-offline'}`}>{u.is_active?'Active':'Inactive'}</span></td>
                <td><div style={{ display:'flex',gap:6 }}><button className="btn btn-outline" style={{ fontSize:10, padding:'4px 8px' }} onClick={()=>toast.success('Edit coming soon!')}>EDIT</button><button className="btn btn-red" style={{ fontSize:10, padding:'4px 8px' }} onClick={()=>toast.error('Cannot delete own account')}>DEL</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
