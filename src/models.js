import mongoose from 'mongoose'

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, default: '' },
    role: { type: String, enum: ['user', 'writer', 'admin'], default: 'user' },
    avatar: { type: String, default: '' },
    provider: { type: String, enum: ['local', 'google'], default: 'local' },
    writerPaid: { type: Boolean, default: false },
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Ebook' }],
  },
  { timestamps: true }
)

const ebookSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    genre: { type: String, required: true },
    coverImage: { type: String, required: true },
    writer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    published: { type: Boolean, default: true },
    featured: { type: Boolean, default: false },
    sold: { type: Boolean, default: false },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
)

const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ebook: { type: mongoose.Schema.Types.ObjectId, ref: 'Ebook', required: true },
  },
  { timestamps: true }
)

bookmarkSchema.index({ user: 1, ebook: 1 }, { unique: true })

const transactionSchema = new mongoose.Schema(
  {
    transactionId: { type: String, required: true, unique: true },
    type: { type: String, enum: ['publishing_fee', 'purchase'], required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ebook: { type: mongoose.Schema.Types.ObjectId, ref: 'Ebook', default: null },
    amount: { type: Number, required: true },
    status: { type: String, default: 'paid' },
  },
  { timestamps: true }
)

export const User = mongoose.model('User', userSchema)
export const Ebook = mongoose.model('Ebook', ebookSchema)
export const Bookmark = mongoose.model('Bookmark', bookmarkSchema)
export const Transaction = mongoose.model('Transaction', transactionSchema)
