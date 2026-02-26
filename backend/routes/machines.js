const router = require('express').Router()
const { pool } = require('../config/db')
const { protect, authorize } = require('../middleware/auth')

const DEMO = [
  { id:1, machine_type:'JCB Backhoe', model:'3DX', registration_number:'MH12AB1234', status:'active', current_fuel_level:170, fuel_capacity:200, rate_per_hour:1500, current_location_lat:17.2847, current_location_lng:74.1946, is_available:true },
  { id:2, machine_type:'Excavator', model:'CAT 320', registration_number:'MH14CD5678', status:'active', current_fuel_level:66, fuel_capacity:300, rate_per_hour:2000, current_location_lat:17.2901, current_location_lng:74.1823, is_available:true },
  { id:3, machine_type:'Bulldozer', model:'CAT D6T', registration_number:'MH31GH3456', status:'maintenance', current_fuel_level:50, fuel_capacity:250, rate_per_hour:1800, current_location_lat:17.2756, current_location_lng:74.2012, is_available:false },
  { id:4, machine_type:'Crane', model:'XCMG QY25K', registration_number:'MH22EF9012', status:'active', current_fuel_level:54, fuel_capacity:300, rate_per_hour:2500, current_location_lat:17.2680, current_location_lng:74.1755, is_available:true },
  { id:5, machine_type:'Tipper', model:'Ashok Leyland', registration_number:'MH18HJ7654', status:'idle', current_fuel_level:120, fuel_capacity:200, rate_per_hour:900, current_location_lat:17.2934, current_location_lng:74.2089, is_available:true },
]

router.get('/', protect, async (req, res) => {
  try {
    const { status, owner_id } = req.query
    let q = 'SELECT m.*, u.full_name as owner_name FROM machines m LEFT JOIN de_users u ON m.owner_id=u.id WHERE 1=1'
    const params = []
    if (status) { params.push(status); q += ` AND m.status=$${params.length}` }
    if (owner_id) { params.push(owner_id); q += ` AND m.owner_id=$${params.length}` }
    if (req.user.role === 'owner') { params.push(req.user.id); q += ` AND m.owner_id=$${params.length}` }
    q += ' ORDER BY m.id'
    const { rows } = await pool.query(q, params)
    res.json({ success:true, data: rows })
  } catch { res.json({ success:true, data: DEMO }) }
})

router.get('/:id', protect, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM machines WHERE id=$1', [req.params.id])
    if (!rows.length) return res.status(404).json({ success:false, message:'Machine not found' })
    res.json({ success:true, data: rows[0] })
  } catch { res.json({ success:true, data: DEMO.find(m=>m.id==req.params.id)||DEMO[0] }) }
})

router.post('/', protect, authorize('admin','owner'), async (req, res) => {
  try {
    const { machine_type,model,registration_number,fuel_capacity,rate_per_hour,owner_id } = req.body
    const oid = req.user.role==='owner' ? req.user.id : owner_id
    const { rows } = await pool.query(
      `INSERT INTO machines (machine_type,model,registration_number,fuel_capacity,current_fuel_level,rate_per_hour,owner_id)
       VALUES ($1,$2,$3,$4,$4,$5,$6) RETURNING *`,
      [machine_type, model, registration_number, fuel_capacity, rate_per_hour, oid]
    )
    res.status(201).json({ success:true, data: rows[0], message:'Machine added successfully' })
  } catch (err) {
    if (err.code==='23505') return res.status(400).json({ success:false, message:'Registration number already exists' })
    res.status(500).json({ success:false, message:err.message })
  }
})

router.put('/:id', protect, authorize('admin','owner'), async (req, res) => {
  try {
    const fields = ['machine_type','model','status','current_fuel_level','fuel_capacity','rate_per_hour','current_location_lat','current_location_lng','current_location_address','hour_meter_reading','is_available']
    const updates = []
    const vals = []
    fields.forEach(f => { if (req.body[f] !== undefined) { vals.push(req.body[f]); updates.push(`${f}=$${vals.length}`) } })
    if (!updates.length) return res.status(400).json({ success:false, message:'No fields to update' })
    vals.push(req.params.id)
    const { rows } = await pool.query(`UPDATE machines SET ${updates.join(',')} WHERE id=$${vals.length} RETURNING *`, vals)
    const io = req.app.get('io')
    if (io) io.to(`machine-${req.params.id}`).emit('machine-updated', rows[0])
    res.json({ success:true, data: rows[0] })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    await pool.query('DELETE FROM machines WHERE id=$1', [req.params.id])
    res.json({ success:true, message:'Machine deleted' })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

module.exports = router
