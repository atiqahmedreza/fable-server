import { Router } from 'express'
import mongoose from 'mongoose'
import { Bookmark, Ebook, Transaction, User } from '../models.js'
import { asyncHandler, mapEbook, publicUser, requireAuth } from '../utils.js'

const router = Router()

router.use(requireAuth)

router.patch(
  '/profile',
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim()
    const avatar = req.body.avatar !== undefined ? String(req.body.avatar) : undefined
    if (!name) return res.status(400).json({ message: 'Name is required' })
    req.user.name = name
    if (avatar !== undefined) req.user.avatar = avatar
    await req.user.save()
    res.json({ user: publicUser(req.user) })
  })
)

router.get(
  '/purchases',
  asyncHandler(async (req, res) => {
    const purchases = await Transaction.find({ user: req.user._id, type: 'purchase' })
      .populate({ path: 'ebook', populate: { path: 'writer', select: 'name avatar' } })
      .sort({ createdAt: -1 })

    res.json({
      purchases: purchases.map((purchase) => ({
        id: purchase._id,
        transactionId: purchase.transactionId,
        amount: purchase.amount,
        status: purchase.status,
        createdAt: purchase.createdAt,
        ebook: purchase.ebook
          ? {
              id: purchase.ebook._id,
              title: purchase.ebook.title,
              coverImage: purchase.ebook.coverImage,
              price: purchase.ebook.price,
              writer: purchase.ebook.writer?.name || 'Unknown writer',
              writerId: purchase.ebook.writer?._id || '',
            }
          : null,
      })),
    })
  })
)

router.get(
  '/bookmarks',
  asyncHandler(async (req, res) => {
    const bookmarks = await Bookmark.find({ user: req.user._id })
      .populate({ path: 'ebook', populate: { path: 'writer', select: 'name avatar' } })
      .sort({ createdAt: -1 })
    const ebooks = bookmarks
      .map((bookmark) => bookmark.ebook)
      .filter((ebook) => ebook && ebook.published)
    res.json({ ebooks: ebooks.map((ebook) => mapEbook(ebook, req.user)) })
  })
)

router.post(
  '/bookmarks/:ebookId',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.ebookId)) {
      return res.status(404).json({ message: 'Ebook not found' })
    }
    const ebook = await Ebook.findById(req.params.ebookId)
    if (!ebook || !ebook.published) return res.status(404).json({ message: 'Ebook not found' })
    await Bookmark.updateOne(
      { user: req.user._id, ebook: ebook._id },
      { $setOnInsert: { user: req.user._id, ebook: ebook._id } },
      { upsert: true }
    )
    res.json({ bookmarked: true })
  })
)

router.delete(
  '/bookmarks/:ebookId',
  asyncHandler(async (req, res) => {
    await Bookmark.deleteOne({ user: req.user._id, ebook: req.params.ebookId })
    res.json({ bookmarked: false })
  })
)

router.get(
  '/wishlist',
  asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id).populate({
      path: 'wishlist',
      populate: { path: 'writer', select: 'name avatar' },
    })
    const ebooks = (user.wishlist || []).filter((ebook) => ebook && ebook.published)
    res.json({ ebooks: ebooks.map((ebook) => mapEbook(ebook, req.user)) })
  })
)

router.post(
  '/wishlist/:ebookId',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.ebookId)) {
      return res.status(404).json({ message: 'Ebook not found' })
    }
    const ebook = await Ebook.findById(req.params.ebookId)
    if (!ebook || !ebook.published) return res.status(404).json({ message: 'Ebook not found' })
    await User.updateOne({ _id: req.user._id }, { $addToSet: { wishlist: ebook._id } })
    res.json({ wishlisted: true })
  })
)

router.delete(
  '/wishlist/:ebookId',
  asyncHandler(async (req, res) => {
    await User.updateOne({ _id: req.user._id }, { $pull: { wishlist: req.params.ebookId } })
    res.json({ wishlisted: false })
  })
)

export default router
