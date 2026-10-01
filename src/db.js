import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let memoryServer

export async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim()
  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 })
      console.log('MongoDB connected')
      return
    } catch (error) {
      console.warn(`MongoDB at MONGODB_URI is unreachable (${error.message}). Starting an in-memory database.`)
    }
  }

  memoryServer = await MongoMemoryServer.create()
  await mongoose.connect(memoryServer.getUri())
  console.log('In-memory MongoDB connected. Set MONGODB_URI to use Atlas or a local server.')
}
