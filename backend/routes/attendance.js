const router = require('express').Router()
const { pool } = require('../config/db')
const { protect, authorize } = require('../middleware/auth')

router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT a.*, u.full_name operator_name, m.machine_type, m.registration_number FROM attendance a LEFT JOIN de_users u ON a.operator_id=u.id LEFT JOIN machines m ON a.machine_id=m.id ORDER BY a.punch_in_time DESC LIMIT 50`)
    res.json({ success:true, data: rows })
  } catch { res.json({ success:true, data: [] }) }
})

router.post('/punch-in', protect, authorize('operator'), async (req, res) => {
  try {
    const { machine_id, location_lat, location_lng } = req.body
    const { rows } = await pool.query(
      'INSERT INTO attendance (operator_id,machine_id,punch_in_time,location_lat,location_lng) VALUES ($1,$2,NOW(),$3,$4) RETURNING *',
      [req.user.id, machine_id, location_lat, location_lng]
    )
    res.status(201).json({ success:true, data: rows[0], message:'Punched in successfully' })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

router.put('/:id/punch-out', protect, authorize('operator'), async (req, res) => {
  try {
    const { rows: ar } = await pool.query('SELECT * FROM attendance WHERE id=$1', [req.params.id])
    if (!ar.length) return res.status(404).json({ success:false, message:'Record not found' })
    const hrs = (new Date() - new Date(ar[0].punch_in_time)) / 3600000
    const { rows } = await pool.query(
      'UPDATE attendance SET punch_out_time=NOW(), total_hours=$1 WHERE id=$2 RETURNING *',
      [hrs.toFixed(2), req.params.id]
    )
    res.json({ success:true, data: rows[0], message:`Punched out. Total: ${hrs.toFixed(1)} hours` })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

module.exports = router
