import { Router } from 'express'
import Stripe from 'stripe'
import { Ebook, Transaction, User } from '../models.js'
import { asyncHandler, publishingFee, requireAuth, sendDummyEmail } from '../utils.js'

const router = Router()

function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) return null
  return new Stripe(process.env.STRIPE_SECRET_KEY)
}

async function recordPurchase({ transactionId, userId, ebookId, amount }) {
  const existing = await Transaction.findOne({ transactionId })
  if (existing) return existing

  const ebook = await Ebook.findOneAndUpdate(
    { _id: ebookId, sold: false, writer: { $ne: userId } },
    { $set: { sold: true, buyer: userId } },
    { new: true }
  ).populate('writer', 'name')

  if (!ebook) {
    const current = await Ebook.findById(ebookId)
    if (current?.sold && String(current.buyer) === String(userId)) {
      return Transaction.findOne({ type: 'purchase', user: userId, ebook: ebookId })
    }
    const error = new Error(current ? 'This ebook has already been sold' : 'Ebook not found')
    error.status = 400
    throw error
  }

  const buyer = await User.findById(userId)
  const transaction = await Transaction.create({
    transactionId,
    type: 'purchase',
    user: userId,
    ebook: ebook._id,
    amount: amount ?? ebook.price,
    status: 'paid',
  })

  sendDummyEmail({
    to: buyer?.email || 'reader',
    subject: `Your Fable copy of ${ebook.title}`,
    text: `Thanks for reading with Fable.\n\n${ebook.title} by ${ebook.writer?.name || 'a Fable writer'} is now in your library.\nAmount: $${Number(amount ?? ebook.price).toFixed(2)}\nTransaction: ${transactionId}`,
  })

  return transaction
}

async function recordPublishingFee({ transactionId, userId, amount }) {
  const existing = await Transaction.findOne({ transactionId })
  if (existing) return existing
  const user = await User.findById(userId)
  if (!user || user.role !== 'writer') {
    const error = new Error('Only writer accounts can pay the publishing fee')
    error.status = 400
    throw error
  }
  user.writerPaid = true
  await user.save()
  const transaction = await Transaction.create({
    transactionId,
    type: 'publishing_fee',
    user: userId,
    amount,
    status: 'paid',
  })
  sendDummyEmail({
    to: user.email,
    subject: 'Fable writer verification is complete',
    text: `Your one-time publishing fee of $${Number(amount).toFixed(2)} was received.\nYou can now upload and manage ebooks.\nTransaction: ${transactionId}`,
  })
  return transaction
}

router.post(
  '/checkout',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.role === 'admin') {
      return res.status(400).json({ message: 'Admin accounts purchase through a reader profile' })
    }
    const ebook = await Ebook.findById(req.body.ebookId)
    if (!ebook || !ebook.published) return res.status(404).json({ message: 'Ebook not found' })
    if (String(ebook.writer) === String(req.user._id)) {
      return res.status(400).json({ message: 'You cannot purchase your own ebook' })
    }
    if (ebook.sold && String(ebook.buyer) === String(req.user._id)) {
      return res.status(400).json({ message: 'You already purchased this ebook' })
    }
    if (ebook.sold) return res.status(400).json({ message: 'This ebook has already been sold' })

    const stripe = stripeClient()
    if (!stripe) return res.json({ demo: true, ebookId: ebook._id, amount: ebook.price })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(ebook.price * 100),
            product_data: { name: ebook.title, description: `Ebook by Fable` },
          },
        },
      ],
      success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      metadata: {
        type: 'purchase',
        ebookId: ebook._id.toString(),
        userId: req.user._id.toString(),
      },
    })

    res.json({ url: session.url, id: session.id })
  })
)

router.post(
  '/publishing-fee',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (req.user.role !== 'writer') return res.status(403).json({ message: 'Only writers pay the publishing fee' })
    if (req.user.writerPaid) return res.status(400).json({ message: 'Publishing fee is already paid' })
    const amount = publishingFee()
    const stripe = stripeClient()
    if (!stripe) return res.json({ demo: true, amount })

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: req.user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(amount * 100),
            product_data: { name: 'Fable writer verification', description: 'One-time publishing fee' },
          },
        },
      ],
      success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      metadata: { type: 'publishing_fee', userId: req.user._id.toString() },
    })
    res.json({ url: session.url, id: session.id })
  })
)

router.post(
  '/demo',
  requireAuth,
  asyncHandler(async (req, res) => {
    if (process.env.STRIPE_SECRET_KEY) {
      return res.status(400).json({ message: 'Demo checkout is disabled when Stripe is configured' })
    }
    if (req.body.type === 'publishing_fee') {
      const transaction = await recordPublishingFee({
        transactionId: `demo_fee_${req.user._id}`,
        userId: req.user._id,
        amount: publishingFee(),
      })
      const user = await User.findById(req.user._id).select('-password')
      return res.json({ transactionId: transaction.transactionId, writerPaid: user.writerPaid })
    }

    const ebook = await Ebook.findById(req.body.ebookId)
    if (!ebook) return res.status(404).json({ message: 'Ebook not found' })
    const transaction = await recordPurchase({
      transactionId: `demo_purchase_${ebook._id}_${req.user._id}`,
      userId: req.user._id,
      ebookId: ebook._id,
      amount: ebook.price,
    })
    res.json({ transactionId: transaction.transactionId })
  })
)

router.post(
  '/confirm',
  requireAuth,
  asyncHandler(async (req, res) => {
    const stripe = stripeClient()
    if (!stripe) return res.status(400).json({ message: 'Stripe is not configured' })
    const session = await stripe.checkout.sessions.retrieve(String(req.body.sessionId || ''))
    if (session.payment_status !== 'paid') return res.status(400).json({ message: 'Payment is not complete' })
    if (session.metadata?.userId !== String(req.user._id)) {
      return res.status(403).json({ message: 'This payment belongs to another account' })
    }
    if (session.metadata.type === 'purchase') {
      const transaction = await recordPurchase({
        transactionId: session.id,
        userId: req.user._id,
        ebookId: session.metadata.ebookId,
        amount: (session.amount_total || 0) / 100,
      })
      return res.json({ type: 'purchase', transactionId: transaction.transactionId })
    }
    if (session.metadata.type === 'publishing_fee') {
      const transaction = await recordPublishingFee({
        transactionId: session.id,
        userId: req.user._id,
        amount: (session.amount_total || 0) / 100,
      })
      return res.json({ type: 'publishing_fee', transactionId: transaction.transactionId })
    }
    return res.status(400).json({ message: 'Unknown payment type' })
  })
)

export async function stripeWebhook(req, res) {
  const stripe = stripeClient()
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).json({ message: 'Stripe webhook is not configured' })
  }
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)
  } catch (error) {
    return res.status(400).json({ message: `Webhook error: ${error.message}` })
  }
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    try {
      if (session.metadata?.type === 'purchase') {
        await recordPurchase({
          transactionId: session.id,
          userId: session.metadata.userId,
          ebookId: session.metadata.ebookId,
          amount: (session.amount_total || 0) / 100,
        })
      }
      if (session.metadata?.type === 'publishing_fee') {
        await recordPublishingFee({
          transactionId: session.id,
          userId: session.metadata.userId,
          amount: (session.amount_total || 0) / 100,
        })
      }
    } catch (error) {
      console.error(error)
      return res.status(500).json({ message: 'Could not record payment' })
    }
  }
  res.json({ received: true })
}

export default router
