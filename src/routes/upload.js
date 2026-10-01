import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../utils.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Only images are allowed'))
  },
})

function placeholderCover(title) {
  const safe = String(title || 'Fable').replace(/[<>&]/g, '').slice(0, 28)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900"><rect width="100%" height="100%" fill="#1e2a24"/><text x="50%" y="48%" fill="#e7d7b8" font-family="Georgia" font-size="42" text-anchor="middle">${safe}</text><text x="50%" y="56%" fill="#f4efe6" font-family="Georgia" font-size="18" text-anchor="middle">Fable</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

router.post('/upload', requireAuth, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'Choose an image to upload' })
    const key = process.env.IMGBB_API_KEY
    if (!key) {
      return res.json({ url: placeholderCover(req.body.title || 'Cover'), provider: 'placeholder' })
    }

    const form = new FormData()
    form.append('image', req.file.buffer.toString('base64'))
    const response = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, { method: 'POST', body: form })
    const data = await response.json()
    if (!response.ok || !data?.data?.url) {
      return res.status(502).json({ message: 'imgBB could not store this image' })
    }
    res.json({ url: data.data.url, provider: 'imgbb' })
  } catch (error) {
    if (error?.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ message: 'Image must be under 5MB' })
    if (error?.message === 'Only images are allowed') return res.status(400).json({ message: error.message })
    console.error(error)
    res.status(500).json({ message: 'Image upload failed' })
  }
})

export default router
