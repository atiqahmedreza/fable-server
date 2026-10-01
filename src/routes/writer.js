import { Router } from 'express'
import mongoose from 'mongoose'
import { Ebook, Transaction } from '../models.js'
import { GENRES, asyncHandler, mapEbook, requireAuth, requireRole } from '../utils.js'

const router = Router()

router.use(requireAuth, requireRole('writer'))

function readEbookBody(body) {
  const title = String(body.title || '').trim()
  const description = String(body.description || '').trim()
  const genre = String(body.genre || '').trim()
  const coverImage = String(body.coverImage || '').trim()
  const price = Number(body.price)
  if (!title || !description || !genre || !coverImage) {
    return { error: 'Title, description, genre, price, and cover image are required' }
  }
  if (!GENRES.includes(genre)) return { error: 'Choose a valid genre' }
  if (!Number.isFinite(price) || price <= 0) return { error: 'Price must be greater than 0' }
  if (description.length < 40) return { error: 'Description should be at least 40 characters' }
  return { title, description, genre, coverImage, price }
}

router.get(
  '/ebooks',
  asyncHandler(async (req, res) => {
    const ebooks = await Ebook.find({ writer: req.user._id })
      .populate('writer', 'name avatar')
      .sort({ createdAt: -1 })
    res.json({ ebooks: ebooks.map((ebook) => mapEbook(ebook, req.user, { includeContent: true })) })
  })
)

router.get(
  '/ebooks/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Ebook not found' })
    const ebook = await Ebook.findOne({ _id: req.params.id, writer: req.user._id }).populate('writer', 'name avatar')
    if (!ebook) return res.status(404).json({ message: 'Ebook not found' })
    res.json({ ebook: mapEbook(ebook, req.user, { includeContent: true }) })
  })
)

router.post(
  '/ebooks',
  asyncHandler(async (req, res) => {
    if (!req.user.writerPaid) {
      return res.status(402).json({ message: 'Pay the one-time publishing fee before uploading an ebook' })
    }
    const parsed = readEbookBody(req.body)
    if (parsed.error) return res.status(400).json({ message: parsed.error })
    const ebook = await Ebook.create({ ...parsed, writer: req.user._id, published: true })
    await ebook.populate('writer', 'name avatar')
    res.status(201).json({ ebook: mapEbook(ebook, req.user, { includeContent: true }) })
  })
)

router.patch(
  '/ebooks/:id',
  asyncHandler(async (req, res) => {
    const ebook = await Ebook.findOne({ _id: req.params.id, writer: req.user._id })
    if (!ebook) return res.status(404).json({ message: 'Ebook not found' })
    const parsed = readEbookBody({
      title: req.body.title ?? ebook.title,
      description: req.body.description ?? ebook.description,
      genre: req.body.genre ?? ebook.genre,
      coverImage: req.body.coverImage ?? ebook.coverImage,
      price: req.body.price ?? ebook.price,
    })
    if (parsed.error) return res.status(400).json({ message: parsed.error })
    Object.assign(ebook, parsed)
    await ebook.save()
    await ebook.populate('writer', 'name avatar')
    res.json({ ebook: mapEbook(ebook, req.user, { includeContent: true }) })
  })
)

router.patch(
  '/ebooks/:id/publish',
  asyncHandler(async (req, res) => {
    const ebook = await Ebook.findOne({ _id: req.params.id, writer: req.user._id })
    if (!ebook) return res.status(404).json({ message: 'Ebook not found' })
    ebook.published = Boolean(req.body.published)
    await ebook.save()
    res.json({ id: ebook._id, published: ebook.published })
  })
)

router.delete(
  '/ebooks/:id',
  asyncHandler(async (req, res) => {
    const ebook = await Ebook.findOneAndDelete({ _id: req.params.id, writer: req.user._id })
    if (!ebook) return res.status(404).json({ message: 'Ebook not found' })
    res.json({ message: 'Ebook deleted' })
  })
)

router.get(
  '/sales',
  asyncHandler(async (req, res) => {
    const mine = await Ebook.find({ writer: req.user._id }).select('_id')
    const sales = await Transaction.find({ type: 'purchase', ebook: { $in: mine.map((ebook) => ebook._id) } })
      .populate('user', 'name email')
      .populate('ebook', 'title')
      .sort({ createdAt: -1 })

    res.json({
      sales: sales.map((sale) => ({
        id: sale._id,
        transactionId: sale.transactionId,
        title: sale.ebook?.title || 'Removed ebook',
        buyer: sale.user?.name || 'Unknown reader',
        email: sale.user?.email || '',
        amount: sale.amount,
        createdAt: sale.createdAt,
      })),
    })
  })
)

export default router
