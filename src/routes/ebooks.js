import { Router } from 'express'
import mongoose from 'mongoose'
import { Bookmark, Ebook, User } from '../models.js'
import { asyncHandler, escapeRegex, mapEbook, optionalAuth } from '../utils.js'

const router = Router()

router.get(
  '/featured',
  optionalAuth,
  asyncHandler(async (req, res) => {
    let ebooks = await Ebook.find({ published: true, featured: true })
      .populate('writer', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(6)

    if (ebooks.length < 6) {
      const ids = ebooks.map((ebook) => ebook._id)
      const extra = await Ebook.find({ published: true, _id: { $nin: ids } })
        .populate('writer', 'name avatar')
        .sort({ createdAt: -1 })
        .limit(6 - ebooks.length)
      ebooks = ebooks.concat(extra)
    }

    res.json({ ebooks: ebooks.map((ebook) => mapEbook(ebook, req.user)) })
  })
)

router.get(
  '/',
  optionalAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1)
    const requested = parseInt(req.query.limit, 10) || 8
    const limit = Math.min(12, Math.max(6, requested))
    const filter = { published: true }

    if (req.query.genre && req.query.genre !== 'all') filter.genre = req.query.genre
    if (req.query.availability === 'sold') filter.sold = true
    if (req.query.availability === 'in_stock') filter.sold = false

    const minPrice = req.query.minPrice !== undefined && req.query.minPrice !== '' ? Number(req.query.minPrice) : null
    const maxPrice = req.query.maxPrice !== undefined && req.query.maxPrice !== '' ? Number(req.query.maxPrice) : null
    if (minPrice !== null || maxPrice !== null) {
      filter.price = {}
      if (minPrice !== null && !Number.isNaN(minPrice)) filter.price.$gte = minPrice
      if (maxPrice !== null && !Number.isNaN(maxPrice)) filter.price.$lte = maxPrice
    }

    const search = String(req.query.search || '').trim()
    if (search) {
      const writers = await User.find({
        role: 'writer',
        name: new RegExp(escapeRegex(search), 'i'),
      }).select('_id')
      filter.$or = [
        { title: new RegExp(escapeRegex(search), 'i') },
        { writer: { $in: writers.map((writer) => writer._id) } },
      ]
    }

    let sort = { createdAt: -1 }
    if (req.query.sort === 'price_asc') sort = { price: 1 }
    if (req.query.sort === 'price_desc') sort = { price: -1 }

    const total = await Ebook.countDocuments(filter)
    const ebooks = await Ebook.find(filter)
      .populate('writer', 'name avatar')
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)

    res.json({
      ebooks: ebooks.map((ebook) => mapEbook(ebook, req.user)),
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
      total,
      limit,
    })
  })
)

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Ebook not found' })
    }
    const ebook = await Ebook.findById(req.params.id).populate('writer', 'name avatar')
    if (!ebook || (!ebook.published && req.user?.role !== 'admin' && String(ebook.writer?._id) !== String(req.user?._id))) {
      return res.status(404).json({ message: 'Ebook not found' })
    }

    let bookmarked = false
    let wishlisted = false
    if (req.user) {
      bookmarked = Boolean(await Bookmark.exists({ user: req.user._id, ebook: ebook._id }))
      const fresh = await User.findById(req.user._id).select('wishlist')
      wishlisted = fresh?.wishlist?.some((id) => String(id) === String(ebook._id)) || false
    }

    res.json({ ebook: { ...mapEbook(ebook, req.user), bookmarked, wishlisted } })
  })
)

export default router
