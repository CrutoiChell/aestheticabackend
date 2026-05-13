import fs from 'fs/promises';
import path from 'path';

/**
 * JSON Storage utility for reading and writing data files
 * Provides atomic operations with file locking to prevent data corruption
 */
class JsonStorage {
  private dataDir: string;
  private locks: Map<string, Promise<void>>;

  constructor(dataDir: string = path.join(__dirname, '../../data')) {
    this.dataDir = dataDir;
    this.locks = new Map();
  }

  /**
   * Initialize storage directory and create empty JSON files if they don't exist
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      
      const files = ['users.json', 'exhibitions.json', 'artworks.json'];
      for (const file of files) {
        const filePath = path.join(this.dataDir, file);
        try {
          await fs.access(filePath);
        } catch {
          // File doesn't exist, create it with empty array
          await fs.writeFile(filePath, JSON.stringify([], null, 2), 'utf-8');
        }
      }
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      throw new Error('Storage initialization failed');
    }
  }

  /**
   * Read data from a JSON file
   */
  async read<T>(filename: string): Promise<T[]> {
    const filePath = path.join(this.dataDir, filename);
    
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data) as T[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, return empty array
        return [];
      }
      console.error(`Failed to read ${filename}:`, error);
      throw new Error(`Failed to read data from ${filename}`);
    }
  }

  /**
   * Write data to a JSON file with atomic operation
   * Uses file locking to prevent concurrent write conflicts
   */
  async write<T>(filename: string, data: T[]): Promise<void> {
    const filePath = path.join(this.dataDir, filename);
    
    // Acquire lock for this file
    await this.acquireLock(filename);
    
    try {
      const jsonData = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, jsonData, 'utf-8');
    } catch (error) {
      console.error(`Failed to write ${filename}:`, error);
      throw new Error(`Failed to write data to ${filename}`);
    } finally {
      // Release lock
      this.releaseLock(filename);
    }
  }

  /**
   * Update data in a JSON file using a callback function
   * Provides atomic read-modify-write operation
   */
  async update<T>(
    filename: string,
    updateFn: (data: T[]) => T[]
  ): Promise<T[]> {
    // Acquire lock for this file
    await this.acquireLock(filename);
    
    try {
      const data = await this.read<T>(filename);
      const updatedData = updateFn(data);
      await this.write(filename, updatedData);
      return updatedData;
    } finally {
      // Release lock
      this.releaseLock(filename);
    }
  }

  /**
   * Acquire a lock for a file to prevent concurrent access
   */
  private async acquireLock(filename: string): Promise<void> {
    while (this.locks.has(filename)) {
      await this.locks.get(filename);
    }
    
    let resolveLock: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    
    // Store resolve function on the promise for later use
    (lockPromise as any).resolve = resolveLock!;
    
    this.locks.set(filename, lockPromise);
  }

  /**
   * Release a lock for a file
   */
  private releaseLock(filename: string): void {
    const lock = this.locks.get(filename);
    if (lock) {
      // Call the resolve function to release waiting promises
      if ((lock as any).resolve) {
        (lock as any).resolve();
      }
      this.locks.delete(filename);
    }
  }
}

// Export singleton instance
export const jsonStorage = new JsonStorage();
