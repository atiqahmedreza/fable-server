import { Router } from 'express'
import { Bookmark, Ebook, Transaction, User } from '../models.js'
import { asyncHandler, requireAuth, requireRole } from '../utils.js'

const router = Router()

router.use(requireAuth, requireRole('admin'))

router.get(
  '/analytics',
  asyncHandler(async (_req, res) => {
    const [totalUsers, totalWriters, totalEbooksSold, revenueAgg, genreAgg, monthlyAgg] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'writer' }),
      Ebook.countDocuments({ sold: true }),
      Transaction.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]),
      Ebook.aggregate([
        { $match: { published: true } },
        { $group: { _id: '$genre', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Transaction.aggregate([
        { $match: { type: 'purchase' } },
        {
          $group: {
            _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
            sales: { $sum: 1 },
            revenue: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ])

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const now = new Date()
    const series = []
    for (let index = 5; index >= 0; index -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - index, 1)
      const found = monthlyAgg.find((row) => row._id.year === date.getFullYear() && row._id.month === date.getMonth() + 1)
      series.push({
        month: `${months[date.getMonth()]} ${date.getFullYear()}`,
        sales: found?.sales || 0,
        revenue: found?.revenue || 0,
      })
    }

    res.json({
      cards: {
        totalUsers,
        totalWriters,
        totalEbooksSold,
        totalRevenue: revenueAgg[0]?.total || 0,
      },
      monthly: series,
      genres: genreAgg.map((row) => ({ genre: row._id, count: row.count })),
    })
  })
)

router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await User.find().select('-password').sort({ createdAt: -1 })
    res.json({
      users: users.map((user) => ({
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar || '',
        writerPaid: user.writerPaid,
        createdAt: user.createdAt,
      })),
    })
  })
)

router.patch(
  '/users/:id/role',
  asyncHandler(async (req, res) => {
    const role = req.body.role
    if (!['user', 'writer', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Role must be user, writer, or admin' })
    }
    if (String(req.params.id) === String(req.user._id) && role !== 'admin') {
      return res.status(400).json({ message: 'You cannot change your own admin role' })
    }
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    user.role = role
    await user.save()
    res.json({ id: user._id, role: user.role })
  })
)

router.delete(
  '/users/:id',
  asyncHandler(async (req, res) => {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot delete your own account' })
    }
    const user = await User.findById(req.params.id)
    if (!user) return res.status(404).json({ message: 'User not found' })
    const ebooks = await Ebook.find({ writer: user._id }).select('_id')
    const ebookIds = ebooks.map((ebook) => ebook._id)
    await Ebook.deleteMany({ writer: user._id })
    await Bookmark.deleteMany({ $or: [{ user: user._id }, { ebook: { $in: ebookIds } }] })
    await User.updateMany({}, { $pull: { wishlist: { $in: ebookIds } } })
    await User.findByIdAndDelete(user._id)
    res.json({ message: 'User deleted' })
  })
)

router.get(
  '/ebooks',
  asyncHandler(async (_req, res) => {
    const ebooks = await Ebook.find().populate('writer', 'name email').sort({ createdAt: -1 })
    res.json({
      ebooks: ebooks.map((ebook) => ({
        id: ebook._id,
        title: ebook.title,
        price: ebook.price,
        genre: ebook.genre,
        published: ebook.published,
        featured: ebook.featured,
        sold: ebook.sold,
        status: ebook.published ? (ebook.sold ? 'Sold' : 'Published') : 'Unpublished',
        writer: ebook.writer?.name || 'Unknown',
        writerEmail: ebook.writer?.email || '',
        coverImage: ebook.coverImage,
      })),
    })
  })
)

router.patch(
  '/ebooks/:id/publish',
  asyncHandler(async (req, res) => {
    const ebook = await Ebook.findById(req.params.id)
    if (!ebook) return res.status(404).json({ message: 'Ebook not found' })
    ebook.published = Boolean(req.body.published)
    await ebook.save()
    res.json({ id: ebook._id, published: ebook.published })
  })
)

router.patch(
  '/ebooks/:id/featured',
  asyncHandler(async (req, res) => {
    const ebook = await Ebook.findById(req.params.id)
    if (!ebook) return res.status(404).json({ message: 'Ebook not found' })
    ebook.featured = Boolean(req.body.featured)
    await ebook.save()
    res.json({ id: ebook._id, featured: ebook.featured })
  })
)

router.delete(
  '/ebooks/:id',
  asyncHandler(async (req, res) => {
    const ebook = await Ebook.findByIdAndDelete(req.params.id)
    if (!ebook) return res.status(404).json({ message: 'Ebook not found' })
    await Bookmark.deleteMany({ ebook: ebook._id })
    await User.updateMany({}, { $pull: { wishlist: ebook._id } })
    res.json({ message: 'Ebook deleted' })
  })
)

router.get(
  '/transactions',
  asyncHandler(async (_req, res) => {
    const transactions = await Transaction.find()
      .populate('user', 'name email')
      .populate('ebook', 'title')
      .sort({ createdAt: -1 })
    res.json({
      transactions: transactions.map((transaction) => ({
        id: transaction._id,
        transactionId: transaction.transactionId,
        type: transaction.type,
        email: transaction.user?.email || '',
        name: transaction.user?.name || '',
        amount: transaction.amount,
        ebook: transaction.ebook?.title || '',
        createdAt: transaction.createdAt,
        status: transaction.status,
      })),
    })
  })
)

export default router
