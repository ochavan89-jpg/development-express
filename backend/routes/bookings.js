const router = require('express').Router()
const { pool } = require('../config/db')
const { protect, authorize } = require('../middleware/auth')

const DEMO = [
  { id:1, client:'ABC Construction', machine:'JCB Backhoe 3DX', reg:'MH12AB1234', start_time:'2026-02-15T08:00:00Z', status:'active', hourly_rate:1500, actual_hours:6.5, site_address:'Karad Site A' },
  { id:2, client:'XYZ Builders', machine:'Excavator CAT 320', reg:'MH14CD5678', start_time:'2026-02-15T07:30:00Z', status:'active', hourly_rate:2000, actual_hours:8.0, site_address:'Satara Highway' },
]

router.get('/', protect, async (req, res) => {
  try {
    const { status } = req.query
    let q = `SELECT b.*, uc.full_name client_name, uc.company_name, m.machine_type, m.registration_number FROM bookings b LEFT JOIN de_users uc ON b.client_id=uc.id LEFT JOIN machines m ON b.machine_id=m.id WHERE 1=1`
    const params = []
    if (req.user.role === 'client') { params.push(req.user.id); q += ` AND b.client_id=$${params.length}` }
    if (status) { params.push(status); q += ` AND b.status=$${params.length}` }
    q += ' ORDER BY b.created_at DESC'
    const { rows } = await pool.query(q, params)
    res.json({ success:true, data: rows })
  } catch { res.json({ success:true, data: DEMO }) }
})

router.post('/', protect, authorize('admin','client'), async (req, res) => {
  try {
    const { machine_id, operator_id, start_time, estimated_hours, hourly_rate, site_address, work_description } = req.body
    const client_id = req.user.role === 'client' ? req.user.id : req.body.client_id
    const { rows } = await pool.query(
      `INSERT INTO bookings (client_id,machine_id,operator_id,start_time,estimated_hours,hourly_rate,site_address,work_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [client_id, machine_id, operator_id, start_time, estimated_hours, hourly_rate, site_address, work_description]
    )
    res.status(201).json({ success:true, data: rows[0] })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

router.put('/:id/complete', protect, authorize('admin','operator'), async (req, res) => {
  let client
  try {
    const { actual_hours, end_fuel_reading, end_hmr } = req.body
    client = await pool.connect()
    await client.query('BEGIN')

    const { rows: br } = await client.query(
      `SELECT b.*, u.wallet_balance
       FROM bookings b
       JOIN de_users u ON u.id=b.client_id
       WHERE b.id=$1
       FOR UPDATE`,
      [req.params.id]
    )
    if (!br.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success:false, message:'Booking not found' })
    }
    if (req.user.role === 'operator' && br[0].operator_id !== req.user.id) {
      await client.query('ROLLBACK')
      return res.status(403).json({ success:false, message:'Access denied' })
    }

    const totalAmount = parseFloat(actual_hours) * parseFloat(br[0].hourly_rate)
    const balanceBefore = parseFloat(br[0].wallet_balance || 0)
    const balanceAfter = balanceBefore - totalAmount
    const { rows } = await client.query(
      `UPDATE bookings SET status='completed', end_time=NOW(), actual_hours=$1, total_amount=$2, end_fuel_reading=$3, end_hmr=$4 WHERE id=$5 RETURNING *`,
      [actual_hours, totalAmount, end_fuel_reading, end_hmr, req.params.id]
    )
    await client.query('UPDATE de_users SET wallet_balance=$1 WHERE id=$2', [balanceAfter, br[0].client_id])
    await client.query(
      `INSERT INTO wallet_transactions (user_id,transaction_type,amount,balance_before,balance_after,description,booking_id)
       VALUES ($1,'debit',$2,$3,$4,$5,$6)`,
      [br[0].client_id, totalAmount, balanceBefore, balanceAfter, `Booking #${req.params.id} completion`, req.params.id]
    )
    await client.query('COMMIT')
    res.json({ success:true, data: rows[0] })
  } catch (err) {
    if (client) {
      try { await client.query('ROLLBACK') } catch {}
    }
    res.status(500).json({ success:false, message:err.message })
  } finally {
    if (client) client.release()
  }
})

router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.*, m.owner_id
       FROM bookings b
       LEFT JOIN machines m ON m.id=b.machine_id
       WHERE b.id=$1`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ success:false, message:'Booking not found' })

    const booking = rows[0]
    const allowed =
      req.user.role === 'admin' ||
      (req.user.role === 'client' && booking.client_id === req.user.id) ||
      (req.user.role === 'owner' && booking.owner_id === req.user.id) ||
      (req.user.role === 'operator' && booking.operator_id === req.user.id)

    if (!allowed) return res.status(403).json({ success:false, message:'Access denied' })

    await pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [req.params.id])
    res.json({ success:true, message:'Booking cancelled' })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

module.exports = router
