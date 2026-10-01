import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import bcrypt from 'bcryptjs'
import { connectDB } from './db.js'
import { Bookmark, Ebook, Transaction, User } from './models.js'

const cover = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=800&q=80`
const portrait = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=400&h=400&q=80`

const monthsAgo = (count, day = 12) => {
  const date = new Date()
  date.setMonth(date.getMonth() - count)
  date.setDate(day)
  date.setHours(10, 0, 0, 0)
  return date
}

async function stamp(model, id, date) {
  await model.updateOne({ _id: id }, { $set: { createdAt: date, updatedAt: date } })
}

export async function seedIfEmpty() {
  if ((await User.countDocuments()) > 0) return false

  const password = await bcrypt.hash('Writer@123', 10)
  const readerPassword = await bcrypt.hash('Reader@123', 10)
  const adminPassword = await bcrypt.hash('Admin@123', 10)

  const [admin, elena, jonah, amira, marcus, reader, lina, owen] = await User.create([
    { name: 'Fable Admin', email: 'admin@fable.com', password: adminPassword, role: 'admin', avatar: portrait('photo-1521119989659-a83eee488004') },
    { name: 'Elena Voss', email: 'elena@fable.com', password, role: 'writer', writerPaid: true, avatar: portrait('photo-1544005313-94ddf0286df2') },
    { name: 'Jonah Hale', email: 'jonah@fable.com', password, role: 'writer', writerPaid: true, avatar: portrait('photo-1500648767791-00dcc994a43e') },
    { name: 'Amira Sol', email: 'amira@fable.com', password, role: 'writer', writerPaid: true, avatar: portrait('photo-1531123897727-8f129e1688ce') },
    { name: 'Marcus Adeyemi', email: 'marcus@fable.com', password, role: 'writer', writerPaid: true, avatar: portrait('photo-1506794778202-cad84cf45f1d') },
    { name: 'Nora Quinn', email: 'reader@fable.com', password: readerPassword, role: 'user', avatar: portrait('photo-1438761681033-6461ffad8d80') },
    { name: 'Lina Park', email: 'lina@fable.com', password: readerPassword, role: 'user', avatar: portrait('photo-1524504388940-b1c1722653e1') },
    { name: 'Owen Brooks', email: 'owen@fable.com', password: readerPassword, role: 'user', avatar: portrait('photo-1507003211169-0a1dd7228f2d') },
  ])

  const story = (paragraphs) => paragraphs.join('\n\n')

  const books = [
    {
      title: 'The Lantern Archive',
      genre: 'Fiction',
      price: 12,
      featured: true,
      writer: elena,
      cover: cover('photo-1544947950-fa07a98d237f'),
      createdAt: monthsAgo(5, 4),
      description: story([
        'In a coastal city that keeps its memories in glass lanterns, archivist Iva Sen is hired to catalog a room nobody admits exists. Each lantern holds a borrowed evening: a train platform, a kitchen argument, a first swim.',
        'When one lantern repeats a night that has not happened yet, Iva has to decide whether the archive preserves the city or quietly edits it. The clerks upstairs want the room sealed. A boy who sells paper boats wants it opened.',
        'The Lantern Archive follows Iva through stacks, tide charts, and the ethics of remembering someone who asked to be forgotten. It is a novel about work, weather, and the private museums people build when public history fails them.',
      ]),
    },
    {
      title: 'Salt & Cipher',
      genre: 'Mystery',
      price: 9.5,
      featured: true,
      sold: true,
      buyer: reader,
      writer: jonah,
      cover: cover('photo-1512820790803-83ca734da794'),
      createdAt: monthsAgo(5, 18),
      description: story([
        'A coded cookbook arrives at the harbor police desk, its margins stained with brine and a dead translator’s thumbprint. Detective Mara Ell wants a simple smuggling case. The recipes refuse to be simple.',
        'Every dish names a dock, a tide, and a person who should still be alive. Mara cooks nothing and still ends up in someone’s kitchen at midnight, reading salt like a ledger.',
        'Salt & Cipher is a harbor mystery about inheritance, counterfeit maps, and the one clue that only makes sense if you have eaten in that city long enough to know which pepper is a warning.',
      ]),
    },
    {
      title: 'Paper Moons',
      genre: 'Romance',
      price: 8,
      featured: true,
      writer: amira,
      cover: cover('photo-1495446815901-a7297e633e8d'),
      createdAt: monthsAgo(4, 9),
      description: story([
        'Two letterpress printers share a night shift and a single working moon chart. Nadia sets wedding invitations. Leo prints funeral programs. They meet when a tray of type spills between their tables and neither will admit whose fault it was.',
        'Over one humid summer they trade proofs, bad coffee, and the kind of honesty that arrives after 2 a.m. Neither is looking for a story with a balcony. The city gives them a rooftop anyway.',
        'Paper Moons is a romance about making beautiful things for other people’s milestones while trying, carefully, to earn one of your own.',
      ]),
    },
    {
      title: 'Orbit Glass',
      genre: 'Sci-Fi',
      price: 14,
      featured: true,
      sold: true,
      buyer: lina,
      writer: elena,
      cover: cover('photo-1451187580459-43490279c0fa'),
      createdAt: monthsAgo(4, 21),
      description: story([
        'The conservatory on Station Vesper grows fruit that remembers the gravity of its home world. Botanist Sera Quinn is sent to prune a harvest that has started growing windows instead of seeds.',
        'Through those windows the crew can see choices they did not make. Command wants the glass destroyed. Sera wants to know which future is asking to be watered.',
        'Orbit Glass is a science-fiction novel about caretaking, surveillance disguised as safety, and a garden that refuses to stay ornamental.',
      ]),
    },
    {
      title: 'The Thorn Court',
      genre: 'Fantasy',
      price: 16.5,
      featured: true,
      writer: amira,
      cover: cover('photo-1519681393784-d120267933ba'),
      createdAt: monthsAgo(3, 6),
      description: story([
        'Every midwinter the Thorn Court opens its gates to one cartographer and one liar. This year the cartographer is late and the liar brought a true map, which is a worse offense than theft.',
        'Inside the court, corridors rearrange around promises. Nisrine has three nights to chart a way out for the children who wandered in looking for a warmer story.',
        'The Thorn Court is a fantasy of etiquette, briars, and the cost of drawing a border that a living palace does not recognize.',
      ]),
    },
    {
      title: 'Night Orchard',
      genre: 'Horror',
      price: 11,
      featured: true,
      sold: true,
      buyer: owen,
      writer: jonah,
      cover: cover('photo-1509248961158-e54f6934749c'),
      createdAt: monthsAgo(3, 19),
      description: story([
        'The orchard behind the parish sells apples that ripen only after midnight. Picker Adel refuses the bonus paid to anyone who stays past the bell. Then the bell stops ringing and the trees start answering to her childhood nickname.',
        'What grows there is not hungry in the usual way. It wants an audience, a family recipe, and the last person who claimed they were not afraid of the dark between rows.',
        'Night Orchard is a quiet horror novel about seasonal work, inherited warnings, and fruit that should never be brought into a warm kitchen.',
      ]),
    },
    {
      title: 'Red Frequency',
      genre: 'Thriller',
      price: 13,
      writer: marcus,
      cover: cover('photo-1478720568477-152d9b164e26'),
      createdAt: monthsAgo(2, 8),
      description: story([
        'A late-night radio host starts receiving song requests from a caller who died in the station elevator three years ago. Producer Ken Abe pulls the tapes, expecting a prank, and finds his own voice on a broadcast that never aired.',
        'The requests name streets before the accidents happen. Ken has until the sunrise slot to decide whether to warn the city or keep the frequency alive long enough to identify the engineer behind it.',
        'Red Frequency is a thriller about live radio, edited truth, and the panic of hearing tomorrow’s headline in your headphones.',
      ]),
    },
    {
      title: 'Ink Meridian',
      genre: 'Biography',
      price: 10,
      sold: true,
      buyer: reader,
      writer: marcus,
      cover: cover('photo-1457369804613-52c61a468e7d'),
      createdAt: monthsAgo(2, 16),
      description: story([
        'Ink Meridian traces the life of cartographer-poet Leona Ibe, who redrew a disputed coastline and then disappeared into the margin of her own atlas. Marcus Adeyemi reconstructs her years from press plates, ferry tickets, and the letters she wrote to a sister who never mailed a reply.',
        'The biography refuses a single hero. Leona was precise, sometimes cruel, and devoted to the idea that a map could be an argument instead of a verdict.',
        'Readers get the workshops, the exile, the last known sketch, and the people who kept her pencils when the ministry burned the proofs.',
      ]),
    },
    {
      title: 'The Quiet Atlas',
      genre: 'History',
      price: 15,
      sold: true,
      buyer: lina,
      writer: elena,
      cover: cover('photo-1461360370896-922624d12aa1'),
      createdAt: monthsAgo(1, 5),
      description: story([
        'Before satellites, a circle of harbor clerks kept an unofficial atlas of routes the empire preferred not to name. The Quiet Atlas collects their annotations: storm years, strike days, the piers where passengers were counted twice.',
        'Elena Voss reads those notes against customs ledgers and oral histories from dock families. What emerges is less a discovery than a correction.',
        'This history is about paperwork as power, and about the clerks who risked their posts to leave a truer coastline in the binding.',
      ]),
    },
    {
      title: 'Small Fires',
      genre: 'Poetry',
      price: 6.5,
      sold: true,
      buyer: owen,
      writer: amira,
      cover: cover('photo-1473186505569-9c61870c11f9'),
      createdAt: monthsAgo(1, 22),
      description: story([
        'Small Fires is a collection of poems set in kitchens, ferry queues, and the hour after a citywide blackout. Amira Sol writes about matches, moths, borrowed coats, and the particular brightness of a stove left on for someone who is late.',
        'The poems move between tenderness and inventory. A grocery list becomes a chronology. A burned letter becomes a map of what the speaker will not repeat.',
        'Read together, they argue that attention is a kind of shelter: brief, smoke-stained, and worth keeping lit.',
      ]),
    },
    {
      title: 'Harbor Static',
      genre: 'Mystery',
      price: 9,
      sold: true,
      buyer: reader,
      writer: jonah,
      cover: cover('photo-1507525428034-b723cf961d3e'),
      createdAt: monthsAgo(0, 7),
      description: story([
        'When the lighthouse radio begins broadcasting yesterday’s weather, apprentice keeper Ruth Okon records the loop and hears a name the harbor has not used since the flood. The official log says the transmitter is offline.',
        'Ruth’s investigation stays small on purpose: one café, one mechanic, one uncle who mends nets and lies badly. The static gets clearer each night, and so does the debt someone is trying to wash out with the tide.',
        'Harbor Static is a compact mystery about maintenance, family silence, and a signal that only appears when the sea is too calm to trust.',
      ]),
    },
    {
      title: 'Velvet Algorithm',
      genre: 'Sci-Fi',
      price: 17.99,
      writer: marcus,
      cover: cover('photo-1532012197267-da84d127e765'),
      createdAt: monthsAgo(0, 3),
      description: story([
        'In a city where tailoring shops run prediction engines, a suit can be cut for the person you are likely to become. Seamster Idris Bakare is ordered to sew a jacket for a client who does not exist yet.',
        'The measurements arrive as music. The lining hides a court order. Idris has to finish the garment without letting the algorithm decide who gets to wear a future.',
        'Velvet Algorithm blends speculative technology with the old drama of cloth, credit, and craft. It asks who owns a pattern once a machine has dreamed it.',
      ]),
    },
    {
      title: 'Draft of Winter',
      genre: 'Fiction',
      price: 7,
      published: false,
      writer: elena,
      cover: cover('photo-1481627834876-b7833e8f5570'),
      createdAt: monthsAgo(0, 1),
      description: story([
        'An unpublished manuscript about a librarian who catalogs snowstorms as if they were patrons. Elena is still revising the third chapter, in which the radiator learns to speak only in due dates.',
        'This draft is hidden from the public shelves until the writer chooses to publish it. The ending is intentionally unfinished.',
        'Readers of the live site will not see Draft of Winter on the browse page. It exists so the writer dashboard can show an unpublished row.',
      ]),
    },
  ]

  const createdBooks = []
  for (const book of books) {
    const ebook = await Ebook.create({
      title: book.title,
      description: book.description,
      price: book.price,
      genre: book.genre,
      coverImage: book.cover,
      writer: book.writer._id,
      published: book.published !== false,
      featured: Boolean(book.featured),
      sold: Boolean(book.sold),
      buyer: book.buyer?._id || null,
    })
    await stamp(Ebook, ebook._id, book.createdAt)
    createdBooks.push({ ...book, ebook })
  }

  const byTitle = Object.fromEntries(createdBooks.map((book) => [book.title, book]))

  const purchases = [
    ['Salt & Cipher', reader, 5],
    ['Orbit Glass', lina, 4],
    ['Night Orchard', owen, 3],
    ['Ink Meridian', reader, 2],
    ['The Quiet Atlas', lina, 1],
    ['Small Fires', owen, 1],
    ['Harbor Static', reader, 0],
  ]

  for (const [title, buyer, months] of purchases) {
    const book = byTitle[title]
    const transaction = await Transaction.create({
      transactionId: `seed_purchase_${book.ebook._id}`,
      type: 'purchase',
      user: buyer._id,
      ebook: book.ebook._id,
      amount: book.price,
      status: 'paid',
    })
    await stamp(Transaction, transaction._id, monthsAgo(months, 14))
  }

  for (const writer of [elena, jonah, amira, marcus]) {
    const transaction = await Transaction.create({
      transactionId: `seed_fee_${writer._id}`,
      type: 'publishing_fee',
      user: writer._id,
      amount: 9,
      status: 'paid',
    })
    await stamp(Transaction, transaction._id, monthsAgo(6, 2))
  }

  await Bookmark.create([
    { user: reader._id, ebook: byTitle['The Thorn Court'].ebook._id },
    { user: reader._id, ebook: byTitle['Velvet Algorithm'].ebook._id },
    { user: elena._id, ebook: byTitle['Paper Moons'].ebook._id },
  ])

  reader.wishlist = [byTitle['Red Frequency'].ebook._id, byTitle['The Lantern Archive'].ebook._id]
  await reader.save()

  console.log('Seeded Fable demo data')
  console.log('Admin: admin@fable.com / Admin@123')
  console.log('Reader: reader@fable.com / Reader@123')
  console.log('Writers: elena@fable.com, jonah@fable.com, amira@fable.com, marcus@fable.com / Writer@123')
  return true
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isDirect) {
  await connectDB()
  const seeded = await seedIfEmpty()
  if (!seeded) console.log('Database already has users. Seed skipped.')
  process.exit(0)
}
