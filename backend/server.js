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

app.use(helmet())
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'))

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
})

app.use('/api', limiter)

app.use('/api/auth', require('./routes/auth'))
app.use('/api/machines', require('./routes/machines'))
app.use('/api/bookings', require('./routes/bookings'))
app.use('/api/wallet', require('./routes/wallet'))
app.use('/api/dashboard', require('./routes/dashboard'))
app.use('/api/alerts', require('./routes/alerts'))
app.use('/api/users', require('./routes/users'))
app.use('/api/attendance', require('./routes/attendance'))

const healthHandler = (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    app: 'Development Express API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
}

app.get('/api/health', healthHandler)
app.get('/health', healthHandler)

app.get('/', (req, res) => {
  res.send('Development Express Backend Live')
})

app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` })
})

app.use((err, req, res, next) => {
  console.error('Server error:', err)
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  })
})

const createHttpServer = () => {
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
  return server
}

if (require.main === module) {
  const PORT = process.env.PORT || 10000
  const server = createHttpServer()

  server.listen(PORT, async () => {
    console.log('=================================')
    console.log('DEVELOPMENT EXPRESS API SERVER')
    console.log(`Server running on port ${PORT}`)
    console.log('=================================')
    await testConnection()
  })
}

module.exports = app
module.exports.createHttpServer = createHttpServer