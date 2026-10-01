import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import morgan from 'morgan'
import { connectDB } from './db.js'
import { seedIfEmpty } from './seed.js'
import { GENRES, publishingFee } from './utils.js'
import authRoutes from './routes/auth.js'
import ebookRoutes from './routes/ebooks.js'
import writerRoutes from './routes/writers.js'
import userRoutes from './routes/user.js'
import writerDashboardRoutes from './routes/writer.js'
import adminRoutes from './routes/admin.js'
import paymentRoutes, { stripeWebhook } from './routes/payments.js'
import uploadRoutes from './routes/upload.js'

const app = express()
const origins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), stripeWebhook)
app.use(cors({ origin: origins, credentials: true }))
app.use(express.json({ limit: '2mb' }))
app.use(morgan('dev'))

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'fable-server' })
})

app.get('/api/config', (_req, res) => {
  res.json({
    genres: GENRES,
    publishingFee: publishingFee(),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
    imgbb: Boolean(process.env.IMGBB_API_KEY),
    google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/ebooks', ebookRoutes)
app.use('/api/writers', writerRoutes)
app.use('/api/user', userRoutes)
app.use('/api/writer', writerDashboardRoutes)
app.use('/api/admin', adminRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api', uploadRoutes)

app.use('/api', (_req, res) => {
  res.status(404).json({ message: 'Not found' })
})

app.use((error, _req, res, _next) => {
  const status = error.status || 500
  if (status >= 500) console.error(error)
  res.status(status).json({ message: status >= 500 ? 'Something went wrong' : error.message })
})

const port = Number(process.env.PORT || 5000)

await connectDB()
await seedIfEmpty()

app.listen(port, () => {
  console.log(`Fable API listening on http://localhost:${port}`)
})
