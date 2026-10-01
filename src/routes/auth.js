import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { User } from '../models.js'
import { asyncHandler, publicUser, requireAuth, signToken } from '../utils.js'

const router = Router()

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim()
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    const confirmPassword = String(req.body.confirmPassword || '')
    const role = req.body.role === 'writer' ? 'writer' : req.body.role === 'user' ? 'user' : ''

    if (!name || !email || !password || !confirmPassword || !role) {
      return res.status(400).json({ message: 'Full name, email, password, confirm password, and role are required' })
    }
    if (!isEmail(email)) return res.status(400).json({ message: 'Enter a valid email address' })
    if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' })
    if (password !== confirmPassword) return res.status(400).json({ message: 'Passwords do not match' })

    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ message: 'An account with this email already exists' })

    const user = await User.create({
      name,
      email,
      password: await bcrypt.hash(password, 10),
      role,
      provider: 'local',
    })

    return res.status(201).json({ token: signToken(user), user: publicUser(user) })
  })
)

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase()
    const password = String(req.body.password || '')
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' })

    const user = await User.findOne({ email })
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Incorrect email or password' })
    }
    const match = await bcrypt.compare(password, user.password)
    if (!match) return res.status(401).json({ message: 'Incorrect email or password' })

    return res.json({ token: signToken(user), user: publicUser(user) })
  })
)

router.post(
  '/google/status',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase()
    if (!email) return res.status(400).json({ message: 'Email is required' })
    const user = await User.findOne({ email }).select('_id role')
    res.json({ exists: Boolean(user), role: user?.role || null })
  })
)

router.post(
  '/google',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').trim().toLowerCase()
    const name = String(req.body.name || '').trim()
    const avatar = String(req.body.avatar || '')
    const requestedRole = req.body.role === 'writer' ? 'writer' : 'user'

    if (!email || !isEmail(email) || !name) {
      return res.status(400).json({ message: 'Google profile is missing a name or email' })
    }

    let user = await User.findOne({ email })
    let isNew = false
    if (!user) {
      isNew = true
      user = await User.create({
        name,
        email,
        avatar,
        role: requestedRole,
        provider: 'google',
        password: '',
      })
    } else if (!user.avatar && avatar) {
      user.avatar = avatar
      await user.save()
    }

    return res.json({ token: signToken(user), user: publicUser(user), isNew })
  })
)

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: publicUser(req.user) })
  })
)

export default router
