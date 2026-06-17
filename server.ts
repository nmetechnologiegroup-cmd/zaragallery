import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE = path.join(__dirname, 'zara_database.json');

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '50mb' }));

  // --- MARIADB CONNECTION SETUP ---
  let dbPool: mysql.Pool | null = null;
  
  if (process.env.DB_HOST || process.env.USE_MARIADB === 'true') {
    try {
      dbPool = mysql.createPool({
        host: process.env.DB_HOST || 'db', // default docker compose service name
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || 'zara_password',
        database: process.env.DB_NAME || 'zara_db',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
      });
      
      const connection = await dbPool.getConnection();
      console.log('✅ Connected to MariaDB successfully!');
      
      // Initialize table structure
      await connection.query(`
        CREATE TABLE IF NOT EXISTS app_state (
          id INT PRIMARY KEY,
          data LONGTEXT NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
      
      // Seed if empty
      const [rows] = await connection.query('SELECT COUNT(*) as count FROM app_state WHERE id = 1');
      if ((rows as any[])[0].count === 0) {
        // Try to load existing JSON if exists to seed DB, else empty
        let initialData = '{}';
        try { initialData = await fs.readFile(DATA_FILE, 'utf-8'); } catch(e) {}
        await connection.query('INSERT INTO app_state (id, data) VALUES (1, ?)', [initialData]);
        console.log('✅ Synchronized initial data to MariaDB');
      }
      connection.release();
    } catch (e) {
      console.warn('⚠️ Could not connect to MariaDB, falling back to local JSON file.', e);
      dbPool = null;
    }
  }

  // --- API ROUTES ---

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(__dirname, 'uploads');
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }

  app.use('/uploads', express.static(uploadsDir));

  // Load all data
  app.get('/api/data', async (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    try {
      if (dbPool) {
        const [rows] = await dbPool.query('SELECT data FROM app_state WHERE id = 1');
        const dbDataStr = (rows as any[])[0]?.data;
        if (dbDataStr) {
           return res.json(JSON.parse(dbDataStr));
        }
      }
      // Fallback
      const data = await fs.readFile(DATA_FILE, 'utf-8');
      res.json(JSON.parse(data));
    } catch (error) {
      // If file doesn't exist, return empty config or default
      res.status(404).json({ error: 'Database not found' });
    }
  });

  // Save all data
  app.post('/api/data', async (req, res) => {
    try {
      const dataStr = JSON.stringify(req.body, null, 2);
      
      if (dbPool) {
        await dbPool.query('UPDATE app_state SET data = ? WHERE id = 1', [dataStr]);
        
        // Sync orders into the partitioned transactions_history table
        if (req.body.orders && Array.isArray(req.body.orders)) {
          const connection = await dbPool.getConnection();
          try {
            await connection.beginTransaction();
            for (const order of req.body.orders) {
              const orderDate = new Date(order.date).toISOString().slice(0, 19).replace('T', ' ');
              await connection.query(`
                INSERT INTO transactions_history (id, date, client_name, total, payment_method, items, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE 
                  client_name = VALUES(client_name),
                  total = VALUES(total),
                  payment_method = VALUES(payment_method),
                  items = VALUES(items)
              `, [
                order.id, 
                orderDate,
                order.customerName || null,
                order.total,
                order.paymentMethod,
                JSON.stringify(order.items),
                orderDate
              ]);
            }
            await connection.commit();
          } catch (syncErr) {
            await connection.rollback();
            console.error('Error syncing orders to partitioned table:', syncErr);
          } finally {
            connection.release();
          }
        }
      } else {
        await fs.writeFile(DATA_FILE, dataStr);
      }
      
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Save error:', error);
      res.status(500).json({ error: 'Failed to save data' });
    }
  });

  // Upload an image file (logo, product, banner, etc.)
  app.post('/api/upload', async (req, res) => {
    try {
      const { filename, base64 } = req.body;
      if (!filename || !base64) {
        return res.status(400).json({ error: 'Missing filename or base64 data' });
      }

      // Strip off base64 content-type header if present
      const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      let dataBuffer: Buffer;

      if (matches && matches.length === 3) {
        dataBuffer = Buffer.from(matches[2], 'base64');
      } else {
        dataBuffer = Buffer.from(base64, 'base64');
      }

      const cleanName = path.basename(filename).replace(/[^a-zA-Z0-9.\-_]/g, '');
      const uniqueName = `${Date.now()}-${cleanName}`;
      const filePath = path.join(uploadsDir, uniqueName);

      await fs.writeFile(filePath, dataBuffer);

      res.json({ 
        success: true, 
        url: `/uploads/${uniqueName}` 
      });
    } catch (e) {
      console.error('Upload failed:', e);
      res.status(500).json({ error: 'Upload failed' });
    }
  });

  // Health check for local network clients
  app.get('/api/health', (req, res) => {
    res.json({ status: 'running', serverTime: new Date().toISOString(), mode: 'local-offline' });
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log('----------------------------------------------------');
    console.log('ZARA GALLERIE - SERVEUR LOCAL ACTIVÉ');
    console.log(`Accès local : http://localhost:${PORT}`);
    console.log(`Accès Boutique (Wi-Fi) : http://[VOTRE-IP]:${PORT}`);
    console.log('----------------------------------------------------');
  });
}

startServer();
