const router = require('express').Router()
const { pool } = require('../config/db')
const { protect } = require('../middleware/auth')

const DEMO_ALERTS = [
  { id:1, alert_type:'low_wallet',     title:'Wallet Balance Critical', message:'ABC Construction · ₹3,200 remaining · Auto work-stop activated', severity:'critical', is_read:false, is_resolved:false, created_at:new Date() },
  { id:2, alert_type:'low_fuel',       title:'Low Fuel — 22%',          message:'MH14CD5678 Excavator CAT 320 · 66L remaining', severity:'high', is_read:false, is_resolved:false, created_at:new Date() },
  { id:3, alert_type:'low_fuel',       title:'Low Fuel — 18%',          message:'MH22EF9012 Crane XCMG QY25K · 54L remaining', severity:'high', is_read:false, is_resolved:false, created_at:new Date() },
  { id:4, alert_type:'maintenance_due',title:'Service Due in 3 days',    message:'MH12AB1234 JCB · Next: 28 Feb 2026', severity:'medium', is_read:false, is_resolved:false, created_at:new Date() },
  { id:5, alert_type:'geofence_breach',title:'Geofence Exit Detected',   message:'MH18HJ7654 · Left site boundary at 11:42', severity:'low', is_read:true, is_resolved:false, created_at:new Date() },
]

router.get('/', protect, async (req, res) => {
  try {
    const { is_read, limit=10 } = req.query
    let q = 'SELECT a.*, m.registration_number, m.machine_type FROM alerts a LEFT JOIN machines m ON a.machine_id=m.id WHERE a.user_id=$1'
    const params = [req.user.id]
    if (is_read !== undefined) { params.push(is_read); q += ` AND a.is_read=$${params.length}` }
    q += ` ORDER BY a.created_at DESC LIMIT $${params.length+1}`
    params.push(limit)
    const { rows } = await pool.query(q, params)
    res.json({ success:true, data: rows })
  } catch { res.json({ success:true, data: DEMO_ALERTS }) }
})

router.put('/:id/read', protect, async (req, res) => {
  try {
    await pool.query('UPDATE alerts SET is_read=true WHERE id=$1', [req.params.id])
    res.json({ success:true, message:'Alert marked as read' })
  } catch { res.json({ success:true, message:'Updated' }) }
})

router.put('/:id/resolve', protect, async (req, res) => {
  try {
    await pool.query('UPDATE alerts SET is_resolved=true, resolved_at=NOW(), resolved_by=$1 WHERE id=$2', [req.user.id, req.params.id])
    res.json({ success:true, message:'Alert resolved' })
  } catch { res.json({ success:true, message:'Resolved' }) }
})

module.exports = router
