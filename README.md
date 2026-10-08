# ArtGallery Backend API

Backend API server for the ArtGallery platform built with Express, TypeScript and Supabase PostgreSQL.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://<your-project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
JWT_SECRET=<long-random-secret>
CORS_ORIGINS=http://localhost:3000
```

Create a separate Supabase project and prepare the database schema using the SQL files in this repository. Review the base schema and subsequent migrations before applying them. The service-role key belongs only on the server; never include it in frontend code or commit `.env`.

## Development

Start the development server with hot reload:
```bash
npm run dev
```

The server will run on `http://localhost:3001` by default.

## Build

Build the TypeScript code:
```bash
npm run build
```

## Production

Run the production server:
```bash
npm start
```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Linting

Run ESLint:
```bash
npm run lint
```

Fix linting issues:
```bash
npm run lint:fix
```

## Project Structure

```
backend/
├── src/
│   ├── server.ts              # Express app entry point
│   ├── routes/                # API route handlers
│   ├── services/              # Business logic
│   ├── middleware/            # Express middleware
│   ├── storage/               # Supabase client and storage utilities
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
└── dist/                      # Compiled JavaScript (generated)
```

## API Endpoints

### Health Check
- `GET /health` - Server health check

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Exhibitions
- `GET /api/exhibitions` - Get all exhibitions
- `GET /api/exhibitions/:id` - Get exhibition by ID
- `POST /api/exhibitions` - Create exhibition (authorization required)
- `PUT /api/exhibitions/:id` - Update exhibition (authorization required)
- `DELETE /api/exhibitions/:id` - Delete exhibition (authorization required)

### Artworks
- `GET /api/artworks` - Get all artworks
- `GET /api/artworks/:id` - Get artwork by ID
- `POST /api/artworks` - Create artwork (authorization required)
- `PUT /api/artworks/:id` - Update artwork (authorization required)
- `DELETE /api/artworks/:id` - Delete artwork (authorization required)

### Users
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

## Data Storage

The current services use Supabase PostgreSQL for users, exhibitions and artworks. A configured Supabase project and database schema are required; data is not automatically stored in local JSON files.

The repository includes Jest/Supertest tests. The commands above describe the available scripts, not a guarantee that every check passes in a fresh environment.
