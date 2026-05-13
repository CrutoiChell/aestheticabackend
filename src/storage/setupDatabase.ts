import { supabase } from './supabaseClient';

/**
 * Database setup script
 * Creates tables for users, exhibitions, and artworks
 */
export async function setupDatabase() {
  console.log('Setting up database schema...');

  try {
    // Create users table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL DEFAULT 'user',
          preferences JSONB DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      `
    });
    console.log('✓ Users table created');

    // Create exhibitions table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS exhibitions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          gallery TEXT NOT NULL,
          start_date DATE NOT NULL,
          end_date DATE NOT NULL,
          image_url TEXT NOT NULL,
          location TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_exhibitions_gallery ON exhibitions(gallery);
        CREATE INDEX IF NOT EXISTS idx_exhibitions_dates ON exhibitions(start_date, end_date);
      `
    });
    console.log('✓ Exhibitions table created');

    // Create artworks table
    await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS artworks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          artist TEXT NOT NULL,
          year INTEGER NOT NULL,
          description TEXT NOT NULL,
          image_url TEXT NOT NULL,
          dimensions JSONB,
          medium TEXT,
          exhibition_id UUID REFERENCES exhibitions(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_artworks_exhibition ON artworks(exhibition_id);
      `
    });
    console.log('✓ Artworks table created');

    console.log('Database setup complete!');
  } catch (error) {
    console.error('Database setup error:', error);
    throw error;
  }
}

// Run setup if this file is executed directly
if (require.main === module) {
  setupDatabase()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}
