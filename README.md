# Fable Server

Express API for Fable, an ebook sharing platform. Readers browse and purchase original ebooks, writers publish after a one-time verification fee, and an admin oversees users, books, and transactions.

Live site: https://fable-client-pi.vercel.app


## Features

- JWT email/password authentication (7-day expiry) and Google profile exchange
- Role access for readers, writers, and admin
- Ebook browse with search, genre, price, availability, sort, and pagination
- Stripe Checkout for purchases and the writer publishing fee
- imgBB cover and avatar uploads
- Bookmarks, wishlist, sales history, and admin analytics
- Simulated purchase and publishing emails in the server console

## Scripts

- `npm run dev` starts the API with reload
- `npm start` starts the API
- `npm run seed` seeds an empty database

## Environment

Copy `.env.example` to `.env`.

- `MONGODB_URI` MongoDB connection string
- `JWT_SECRET` signing secret
- `CLIENT_URL` frontend origin, comma-separated if needed
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`
- `IMGBB_API_KEY`
- `PUBLISHING_FEE` one-time writer fee in USD

If MongoDB is not reachable, the API falls back to an in-memory database and seeds demo data.

## Demo accounts

- Admin: `admin@fable.com` / `Admin@123`
- Reader: `reader@fable.com` / `Reader@123`
- Writers: `elena@fable.com`, `jonah@fable.com`, `amira@fable.com`, `marcus@fable.com` / `Writer@123`

## npm packages

express, mongoose, mongodb-memory-server, jsonwebtoken, bcryptjs, cors, dotenv, morgan, multer, stripe
