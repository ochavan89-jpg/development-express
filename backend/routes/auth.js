const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { pool } = require('../config/db')
const { protect } = require('../middleware/auth')

// Demo users for when DB is unavailable
const DEMO_USERS = [
  { id:1, username:'admin',    email:'om.chavan2026@zohomail.in', role:'admin',    full_name:'Om Chavan',    phone:'9766926636', is_active:true, password_hash: '$2a$10$Xyz' },
  { id:2, username:'owner',    email:'owner@developmentexpress.in', role:'owner',  full_name:'Rajesh Patil', phone:'9876543211', is_active:true, password_hash: '$2a$10$Xyz' },
  { id:3, username:'client',   email:'client@developmentexpress.in', role:'client',full_name:'Suresh Kumar', phone:'9876543212', is_active:true, password_hash: '$2a$10$Xyz' },
  { id:4, username:'operator', email:'operator@developmentexpress.in', role:'operator', full_name:'Ramesh Kumar', phone:'9876543213', is_active:true, password_hash: '$2a$10$Xyz' },
]
const DEMO_PASSWORDS = { admin:'admin123', owner:'owner123', client:'client123', operator:'operator123' }

const signToken = (user) => jwt.sign(
  { id: user.id, username: user.username, role: user.role, full_name: user.full_name, email: user.email },
  process.env.JWT_SECRET || 'devexpress_fallback_secret',
  { expiresIn: process.env.JWT_EXPIRE || '7d' }
)

// ─── POST /api/auth/login ────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body
    if (!username || !password) return res.status(400).json({ success:false, message:'Username and password required' })

    let user = null
    let passwordMatch = false

    try {
      const { rows } = await pool.query(
        'SELECT * FROM de_users WHERE (username = $1 OR email = $1) AND is_active = true',
        [username]
      )
      if (rows.length) {
        user = rows[0]
        passwordMatch = await bcrypt.compare(password, user.password_hash)
      }
    } catch {
      // Demo mode fallback
      user = DEMO_USERS.find(u => u.username === username)
      passwordMatch = user && DEMO_PASSWORDS[username] === password
    }

    if (!user || !passwordMatch) {
      return res.status(401).json({ success:false, message:'Invalid username or password' })
    }

    // Update last login (ignore errors)
    try { await pool.query('UPDATE de_users SET last_login = NOW() WHERE id = $1', [user.id]) } catch {}

    const { password_hash, ...safeUser } = user
    const token = signToken(user)

    res.json({ success:true, data:{ token, user: safeUser } })
  } catch (err) {
    res.status(500).json({ success:false, message:err.message })
  }
})

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name, phone, role = 'client', company_name } = req.body
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ success:false, message:'Required fields missing' })
    }
    const hash = await bcrypt.hash(password, parseInt(process.env.BCRYPT_SALT_ROUNDS || '10'))
    const { rows } = await pool.query(
      `INSERT INTO de_users (username,email,password_hash,full_name,phone,role,company_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,username,email,full_name,role`,
      [username, email, hash, full_name, phone, role, company_name]
    )
    const token = signToken(rows[0])
    res.status(201).json({ success:true, data:{ token, user: rows[0] } })
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ success:false, message:'Username or email already exists' })
    res.status(500).json({ success:false, message:err.message })
  }
})

// ─── GET /api/auth/profile ───────────────────────────────────────────────────
router.get('/profile', protect, async (req, res) => {
  res.json({ success:true, data: req.user })
})

// ─── POST /api/auth/change-password ──────────────────────────────────────────
router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body
    const { rows } = await pool.query('SELECT password_hash FROM de_users WHERE id=$1', [req.user.id])
    if (!rows.length) return res.status(404).json({ success:false, message:'User not found' })
    const match = await bcrypt.compare(currentPassword, rows[0].password_hash)
    if (!match) return res.status(400).json({ success:false, message:'Current password incorrect' })
    const hash = await bcrypt.hash(newPassword, parseInt(process.env.BCRYPT_SALT_ROUNDS||'10'))
    await pool.query('UPDATE de_users SET password_hash=$1 WHERE id=$2', [hash, req.user.id])
    res.json({ success:true, message:'Password changed successfully' })
  } catch (err) {
    res.status(500).json({ success:false, message:err.message })
  }
})

module.exports = router
