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
    if (req.user.role === 'owner') { params.push(req.user.id); q += ` AND m.owner_id=$${params.length}` }
    if (req.user.role === 'operator') { params.push(req.user.id); q += ` AND b.operator_id=$${params.length}` }
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
    let billingRate = hourly_rate
    if (req.user.role === 'client' || billingRate === undefined || billingRate === null) {
      const { rows: machines } = await pool.query('SELECT rate_per_hour FROM machines WHERE id=$1', [machine_id])
      if (!machines.length) return res.status(404).json({ success:false, message:'Machine not found' })
      billingRate = machines[0].rate_per_hour
    }
    const rate = parseFloat(billingRate)
    if (!Number.isFinite(rate) || rate <= 0) return res.status(400).json({ success:false, message:'Invalid hourly rate' })
    const { rows } = await pool.query(
      `INSERT INTO bookings (client_id,machine_id,operator_id,start_time,estimated_hours,hourly_rate,site_address,work_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [client_id, machine_id, operator_id, start_time, estimated_hours, rate, site_address, work_description]
    )
    res.status(201).json({ success:true, data: rows[0] })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

router.put('/:id/complete', protect, authorize('admin','operator'), async (req, res) => {
  let client
  try {
    const { actual_hours, end_fuel_reading, end_hmr } = req.body
    const hours = parseFloat(actual_hours)
    if (!Number.isFinite(hours) || hours <= 0) return res.status(400).json({ success:false, message:'Invalid actual hours' })

    client = await pool.connect()
    await client.query('BEGIN')

    const { rows: br } = await client.query('SELECT * FROM bookings WHERE id=$1 FOR UPDATE', [req.params.id])
    if (!br.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success:false, message:'Booking not found' })
    }
    const booking = br[0]
    if (req.user.role === 'operator' && Number(booking.operator_id) !== Number(req.user.id)) {
      await client.query('ROLLBACK')
      return res.status(403).json({ success:false, message:'Cannot complete another operator booking' })
    }
    if (booking.status === 'completed') {
      await client.query('ROLLBACK')
      return res.status(400).json({ success:false, message:'Booking already completed' })
    }
    if (booking.status === 'cancelled') {
      await client.query('ROLLBACK')
      return res.status(400).json({ success:false, message:'Cannot complete a cancelled booking' })
    }

    const totalAmount = hours * parseFloat(booking.hourly_rate)
    const { rows: walletRows } = await client.query('SELECT wallet_balance FROM de_users WHERE id=$1 FOR UPDATE', [booking.client_id])
    if (!walletRows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ success:false, message:'Client not found' })
    }
    const balanceBefore = parseFloat(walletRows[0].wallet_balance || 0)
    const balanceAfter = balanceBefore - totalAmount
    if (balanceAfter < 0) {
      await client.query('ROLLBACK')
      return res.status(400).json({ success:false, message:'Insufficient wallet balance' })
    }

    const { rows } = await client.query(
      `UPDATE bookings SET status='completed', end_time=NOW(), actual_hours=$1, total_amount=$2, end_fuel_reading=$3, end_hmr=$4 WHERE id=$5 RETURNING *`,
      [hours, totalAmount, end_fuel_reading, end_hmr, req.params.id]
    )
    await client.query('UPDATE de_users SET wallet_balance=$1 WHERE id=$2', [balanceAfter, booking.client_id])
    await client.query(
      `INSERT INTO wallet_transactions (user_id,transaction_type,amount,balance_before,balance_after,description,booking_id)
       VALUES ($1,'debit',$2,$3,$4,$5,$6)`,
      [booking.client_id, totalAmount, balanceBefore, balanceAfter, 'Booking completed', booking.id]
    )
    await client.query('COMMIT')
    res.json({ success:true, data: rows[0] })
  } catch (err) {
    if (client) await client.query('ROLLBACK').catch(() => {})
    res.status(500).json({ success:false, message:err.message })
  } finally {
    if (client) client.release()
  }
})

router.put('/:id/cancel', protect, async (req, res) => {
  try {
    const { rows: br } = await pool.query(
      `SELECT b.client_id, b.status, m.owner_id
       FROM bookings b
       LEFT JOIN machines m ON b.machine_id=m.id
       WHERE b.id=$1`,
      [req.params.id]
    )
    if (!br.length) return res.status(404).json({ success:false, message:'Booking not found' })
    const booking = br[0]
    const allowed =
      req.user.role === 'admin' ||
      (req.user.role === 'client' && Number(booking.client_id) === Number(req.user.id)) ||
      (req.user.role === 'owner' && Number(booking.owner_id) === Number(req.user.id))
    if (!allowed) return res.status(403).json({ success:false, message:'Cannot cancel this booking' })
    if (booking.status === 'completed') return res.status(400).json({ success:false, message:'Cannot cancel a completed booking' })

    await pool.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [req.params.id])
    res.json({ success:true, message:'Booking cancelled' })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

module.exports = router
