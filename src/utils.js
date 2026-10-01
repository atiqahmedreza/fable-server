import jwt from 'jsonwebtoken'
import { User } from './models.js'

export const GENRES = [
  'Fiction',
  'Mystery',
  'Romance',
  'Sci-Fi',
  'Fantasy',
  'Horror',
  'Thriller',
  'Biography',
  'History',
  'Poetry',
]

export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next)
}

export function signToken(user) {
  return jwt.sign(
    { id: user._id.toString(), role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES || '7d' }
  )
}

export function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || '',
    provider: user.provider,
    writerPaid: user.writerPaid,
  }
}

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ message: 'Please log in to continue' })
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET)
    const user = await User.findById(payload.id).select('-password')
    if (!user) return res.status(401).json({ message: 'Please log in to continue' })
    req.user = user
    next()
  } catch {
    return res.status(401).json({ message: 'Session expired. Please log in again' })
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return next()
  jwt.verify(token, process.env.JWT_SECRET, async (error, payload) => {
    if (error) return next()
    try {
      req.user = await User.findById(payload.id).select('-password')
    } catch {
      req.user = null
    }
    next()
  })
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have access to this action' })
    }
    next()
  }
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function sendDummyEmail({ to, subject, text }) {
  console.log('\n----- Simulated email (Ethereal / console) -----')
  console.log(`To: ${to}`)
  console.log(`Subject: ${subject}`)
  console.log(text)
  console.log('------------------------------------------------\n')
}

export function publishingFee() {
  const fee = Number(process.env.PUBLISHING_FEE || 9)
  return Number.isFinite(fee) && fee > 0 ? fee : 9
}

export function mapWriter(writer) {
  if (writer && writer.name) {
    return { id: writer._id, name: writer.name, avatar: writer.avatar || '' }
  }
  return { id: writer || null, name: 'Unknown writer', avatar: '' }
}

export function mapEbook(ebook, user, { includeContent = false } = {}) {
  const full = ebook.description || ''
  const preview = full.length > 420 ? `${full.slice(0, 420).trim()}…` : full
  const purchased = Boolean(user && ebook.buyer && String(ebook.buyer) === String(user._id))
  const isOwner = Boolean(user && String(ebook.writer?._id || ebook.writer) === String(user._id))
  const isAdmin = user?.role === 'admin'
  const canRead = purchased || isOwner || isAdmin
  return {
    id: ebook._id,
    title: ebook.title,
    preview,
    content: includeContent || canRead ? full : null,
    price: ebook.price,
    genre: ebook.genre,
    coverImage: ebook.coverImage,
    published: ebook.published,
    featured: ebook.featured,
    sold: ebook.sold,
    status: ebook.sold ? 'Sold' : 'Available',
    createdAt: ebook.createdAt,
    writer: mapWriter(ebook.writer),
    purchased,
    isOwner,
  }
}
