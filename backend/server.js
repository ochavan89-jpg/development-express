require('dotenv').config()
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const morgan = require('morgan')
const rateLimit = require('express-rate-limit')
const http = require('http')
const { Server } = require('socket.io')
const { testConnection } = require('./config/db')

const app = express()

app.set('trust proxy', 1)

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
})
app.use('/api', limiter)

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'))
app.use('/api/machines', require('./routes/machines'))
app.use('/api/bookings', require('./routes/bookings'))
app.use('/api/wallet', require('./routes/wallet'))
app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/alerts', require('./routes/alerts'))
app.use('/api/users', require('./routes/users'))
app.use('/api/attendance', require('./routes/attendance'))

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get(['/health', '/api/health'], (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    app: 'Development Express API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

app.get('/', (req, res) => {
  res.send('Development Express Backend Live')
})

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

// ─── Error Handler ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
})

function startServer() {
  const server = http.createServer(app)
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN?.split(',') || '*', methods: ['GET', 'POST'] },
  })

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id)
    socket.on('subscribe-machine', (machineId) => {
      socket.join(`machine-${machineId}`)
    })
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id)
    })
  })

  app.set('io', io)

  const PORT = process.env.PORT || 10000
  server.listen(PORT, async () => {
    console.log('\n╔══════════════════════════════════════════╗')
    console.log('║   DEVELOPMENT EXPRESS — API SERVER       ║')
    console.log('╚══════════════════════════════════════════╝')
    console.log(`Server running on port ${PORT}`)
    console.log(`Environment: ${process.env.NODE_ENV}`)
    await testConnection()
    console.log('Socket.IO ready')
    console.log(`Health: http://localhost:${PORT}/health\n`)
  })

  return server
}

if (require.main === module) {
  startServer()
}

module.exports = app
module.exports.startServer = startServer