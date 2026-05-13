# ArtGallery Backend API

Backend API server for the ArtGallery platform built with Express and TypeScript.

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
JWT_SECRET=your-secret-key-change-this-in-production
JWT_EXPIRES_IN=7d
```

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
│   ├── storage/               # JSON storage utility
│   ├── types/                 # TypeScript type definitions
│   └── utils/                 # Utility functions
├── data/                      # JSON data files
└── dist/                      # Compiled JavaScript (generated)
```

## API Endpoints

### Health Check
- `GET /health` - Server health check

### Authentication (Task 2)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Exhibitions (Task 3)
- `GET /api/exhibitions` - Get all exhibitions
- `GET /api/exhibitions/:id` - Get exhibition by ID
- `POST /api/exhibitions` - Create exhibition (admin)
- `PUT /api/exhibitions/:id` - Update exhibition (admin)
- `DELETE /api/exhibitions/:id` - Delete exhibition (admin)

### Artworks (Task 4)
- `GET /api/artworks` - Get all artworks
- `GET /api/artworks/:id` - Get artwork by ID
- `POST /api/artworks` - Create artwork (admin)
- `PUT /api/artworks/:id` - Update artwork (admin)
- `DELETE /api/artworks/:id` - Delete artwork (admin)

### Users (Task 5)
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

## Data Storage

The application uses JSON files for temporary data storage:
- `data/users.json` - User data
- `data/exhibitions.json` - Exhibition data
- `data/artworks.json` - Artwork data

These files are automatically created on first run.
