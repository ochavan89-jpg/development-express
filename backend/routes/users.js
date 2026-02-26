const router = require('express').Router()
const { pool } = require('../config/db')
const { protect, authorize } = require('../middleware/auth')

router.get('/', protect, authorize('admin'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id,username,email,full_name,phone,role,company_name,wallet_balance,is_active,created_at FROM de_users ORDER BY id')
    res.json({ success:true, data: rows })
  } catch { res.json({ success:true, data:[] }) }
})

router.put('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const { full_name, phone, company_name, is_active } = req.body
    const { rows } = await pool.query(
      'UPDATE de_users SET full_name=$1,phone=$2,company_name=$3,is_active=$4 WHERE id=$5 RETURNING id,username,full_name,role',
      [full_name, phone, company_name, is_active, req.params.id]
    )
    res.json({ success:true, data: rows[0] })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    if (req.params.id == req.user.id) return res.status(400).json({ success:false, message:'Cannot delete own account' })
    await pool.query('DELETE FROM de_users WHERE id=$1', [req.params.id])
    res.json({ success:true, message:'User deleted' })
  } catch (err) { res.status(500).json({ success:false, message:err.message }) }
})

module.exports = router
