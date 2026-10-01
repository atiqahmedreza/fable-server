import { Router } from 'express'
import mongoose from 'mongoose'
import { Ebook, Transaction, User } from '../models.js'
import { asyncHandler, mapEbook, optionalAuth } from '../utils.js'

const router = Router()

router.get(
  '/top',
  asyncHandler(async (_req, res) => {
    const ranked = await Transaction.aggregate([
      { $match: { type: 'purchase' } },
      {
        $lookup: {
          from: 'ebooks',
          localField: 'ebook',
          foreignField: '_id',
          as: 'ebook',
        },
      },
      { $unwind: '$ebook' },
      {
        $group: {
          _id: '$ebook.writer',
          sales: { $sum: 1 },
          revenue: { $sum: '$amount' },
        },
      },
      { $sort: { sales: -1, revenue: -1 } },
      { $limit: 3 },
    ])

    const writers = await User.find({ _id: { $in: ranked.map((row) => row._id) } }).select('name avatar')
    const byId = new Map(writers.map((writer) => [String(writer._id), writer]))
    res.json({
      writers: ranked
        .map((row) => {
          const writer = byId.get(String(row._id))
          if (!writer) return null
          return {
            id: writer._id,
            name: writer.name,
            avatar: writer.avatar || '',
            sales: row.sales,
            revenue: row.revenue,
          }
        })
        .filter(Boolean),
    })
  })
)

router.get(
  '/:id',
  optionalAuth,
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Writer not found' })
    }
    const writer = await User.findOne({ _id: req.params.id, role: 'writer' }).select('name avatar email')
    if (!writer) return res.status(404).json({ message: 'Writer not found' })

    const ebooks = await Ebook.find({ writer: writer._id, published: true })
      .populate('writer', 'name avatar')
      .sort({ createdAt: -1 })

    const sales = await Transaction.countDocuments({
      type: 'purchase',
      ebook: { $in: ebooks.map((ebook) => ebook._id) },
    })

    res.json({
      writer: { id: writer._id, name: writer.name, avatar: writer.avatar || '', sales },
      ebooks: ebooks.map((ebook) => mapEbook(ebook, req.user)),
    })
  })
)

export default router
