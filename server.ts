import dotenv from 'dotenv';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

dotenv.config();

// We use process.cwd() so that data files are stored at the root of the project, 
// outside the 'dist' folder. This prevents Vite's build process from deleting the SQLite database.
const rootDir = process.cwd();

const DATA_FILE = path.join(rootDir, 'zara_database.json');
const MESSAGES_FILE = path.join(rootDir, 'zara_messages.json');

// We allow customized SQLite database path via environment variables to prevent deletion during container/local deployments.
// Example: SQLITE_DB_PATH=/var/lib/zara/zara_database.sqlite
let SQLITE_DB_FILE = process.env.SQLITE_DB_PATH;

if (!SQLITE_DB_FILE) {
  // Fallbacks: If /app_data exists (e.g. Docker Volume is mounted), we write the database file there.
  // Otherwise, fallback to the project's root folder.
  if (fsSync.existsSync('/app_data')) {
    SQLITE_DB_FILE = path.join('/app_data', 'zara_database.sqlite');
  } else {
    SQLITE_DB_FILE = path.join(rootDir, 'zara_database.sqlite');
  }
} else {
  // Ensure the parent directory of the custom database path exists!
  const parentFolder = path.dirname(SQLITE_DB_FILE);
  try {
    if (!fsSync.existsSync(parentFolder)) {
      fsSync.mkdirSync(parentFolder, { recursive: true });
    }
  } catch (err) {
    console.error(`Failed to create parent folder for custom SQLite path: ${parentFolder}`, err);
  }
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  app.use(express.json({ limit: '50mb' }));

  // --- SQLITE CONNECTION SETUP ---
  const db = new Database(SQLITE_DB_FILE);
  console.log('✅ Connected to SQLite database successfully!');
  db.pragma('journal_mode = WAL');

  // Initialize table structure
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Initialize app_messages structure
  db.exec(`
    CREATE TABLE IF NOT EXISTS app_messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      receiver_id TEXT NOT NULL,
      text TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `);

  // Initialize transactions_history structure
  db.exec(`
    CREATE TABLE IF NOT EXISTS transactions_history (
      id TEXT PRIMARY KEY,
      date TEXT,
      client_name TEXT,
      total REAL,
      payment_method TEXT,
      items TEXT,
      created_at TEXT
    );
  `);

  // Seed / Migrate app_state if empty
  const row = db.prepare('SELECT COUNT(*) as count FROM app_state WHERE id = 1').get() as { count: number };
  if (row.count === 0) {
    let initialData = '{}';
    try { 
      initialData = await fs.readFile(DATA_FILE, 'utf-8'); 
      console.log('✅ Migrated initial data from backup JSON to SQLite');
    } catch(e) {}
    
    db.prepare('INSERT INTO app_state (id, data) VALUES (1, ?)').run(initialData);

    // Sync orders into the partitioned transactions_history table if present
    try {
      const parsed = JSON.parse(initialData);
      if (parsed.orders && Array.isArray(parsed.orders)) {
        const insertTx = db.prepare(`
          INSERT INTO transactions_history (id, date, client_name, total, payment_method, items, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            client_name = excluded.client_name,
            total = excluded.total,
            payment_method = excluded.payment_method,
            items = excluded.items
        `);
        const insertMany = db.transaction((orders) => {
          for (const order of orders) {
            const orderDate = new Date(order.date).toISOString().slice(0, 19).replace('T', ' ');
            const clientName = order.customer?.name || null;
            const paymentMethodStr = order.payments?.map((p: any) => p.method).join(', ') || 'CASH';
            insertTx.run(
              order.id, 
              orderDate,
              clientName,
              order.total,
              paymentMethodStr,
              JSON.stringify(order.items),
              orderDate
            );
          }
        });
        insertMany(parsed.orders);
        console.log('✅ Synced orders to transactions_history table');
      }
    } catch(e) {
      console.error('Error syncing orders during migration:', e);
    }
  }

  // Seed / Migrate app_messages if empty
  const msgRow = db.prepare('SELECT COUNT(*) as count FROM app_messages').get() as { count: number };
  if (msgRow.count === 0) {
    try {
      const messagesData = await fs.readFile(MESSAGES_FILE, 'utf-8');
      const messages = JSON.parse(messagesData);
      if (Array.isArray(messages) && messages.length > 0) {
        const insertMsg = db.prepare(`
          INSERT INTO app_messages (id, sender_id, receiver_id, text, timestamp)
          VALUES (?, ?, ?, ?, ?)
        `);
        const insertMany = db.transaction((msgs) => {
          for (const msg of msgs) {
            insertMsg.run(msg.id, msg.senderId, msg.receiverId || 'GLOBAL', msg.text, msg.timestamp);
          }
        });
        insertMany(messages);
        console.log('✅ Migrated messages from backup JSON to SQLite');
      }
    } catch(e) {}
  }

  // --- API ROUTES ---

  // Create uploads directory if it doesn't exist
  const uploadsDir = process.env.UPLOADS_DIR ? path.resolve(process.env.UPLOADS_DIR) : path.join(rootDir, 'uploads');
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }

  app.use('/uploads', express.static(uploadsDir));

  // Load all data
  app.get('/api/data', (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    try {
      const dbRow = db.prepare('SELECT data FROM app_state WHERE id = 1').get() as { data: string } | undefined;
      if (dbRow && dbRow.data) {
        return res.json(JSON.parse(dbRow.data));
      } else {
        return res.json({});
      }
    } catch (error) {
      console.error('Failed to read database', error);
      res.status(500).json({ error: 'Failed to read database' });
    }
  });

  // Save all data
  app.post('/api/data', (req, res) => {
    try {
      const dataStr = JSON.stringify(req.body, null, 2);
      
      // Use UPSERT
      db.prepare(`
        INSERT INTO app_state (id, data) VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data
      `).run(dataStr);
      
      // Sync orders into the partitioned transactions_history table
      if (req.body.orders && Array.isArray(req.body.orders)) {
        const insertTx = db.prepare(`
          INSERT INTO transactions_history (id, date, client_name, total, payment_method, items, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET 
            client_name = excluded.client_name,
            total = excluded.total,
            payment_method = excluded.payment_method,
            items = excluded.items
        `);
        
        const syncOrders = db.transaction((orders) => {
          for (const order of orders) {
            const orderDate = new Date(order.date).toISOString().slice(0, 19).replace('T', ' ');
            const clientName = order.customer?.name || null;
            const paymentMethodStr = order.payments?.map((p: any) => p.method).join(', ') || 'CASH';
            
            insertTx.run(
              order.id, 
              orderDate,
              clientName,
              order.total,
              paymentMethodStr,
              JSON.stringify(order.items),
              orderDate
            );
          }
        });
        syncOrders(req.body.orders);
      }
      
      // We also keep backing up to DATA_FILE periodically as an added redundancy
      fs.writeFile(DATA_FILE, dataStr).catch(err => console.error('Backup write error', err));
      
      res.json({ success: true, timestamp: new Date().toISOString() });
    } catch (error) {
      console.error('Save error:', error);
      res.status(500).json({ error: 'Failed to save data' });
    }
  });

  // --- MESSAGES COMPONENT API (INDEPENDENT FROM CORE DATA SYSTEM FOR HIGH CONCURRENCY SAFETY) ---
  app.get('/api/messages', (req, res) => {
    try {
      const rows = db.prepare('SELECT * FROM app_messages ORDER BY timestamp ASC').all() as any[];
      const messages = rows.map(r => ({
        id: r.id,
        senderId: r.sender_id,
        receiverId: r.receiver_id === 'GLOBAL' ? undefined : r.receiver_id,
        text: r.text,
        timestamp: r.timestamp
      }));
      return res.json(messages);
    } catch (err) {
      console.error('Get messages error:', err);
      res.status(500).json({ error: 'Failed to retrieve messages' });
    }
  });

  app.post('/api/messages', (req, res) => {
    try {
      const { id, senderId, receiverId, text, timestamp } = req.body;
      if (!id || !senderId || !text || !timestamp) {
        return res.status(400).json({ error: 'Missing required message parameters' });
      }

      db.prepare(`
        INSERT INTO app_messages (id, sender_id, receiver_id, text, timestamp)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET text = excluded.text
      `).run(id, senderId, receiverId || 'GLOBAL', text, timestamp);
      
      res.json({ success: true });
    } catch (err) {
      console.error('Post message error:', err);
      res.status(500).json({ error: 'Failed to save message' });
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

  // Download raw SQLite database file directly from browser
  app.get('/api/db/download', (req, res) => {
    try {
      res.download(SQLITE_DB_FILE, 'zara_database.sqlite');
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to download SQLite file: ' + err.message });
    }
  });

  // Manually import the local JSON backup (zara_database.json) into the active SQLite database
  app.post('/api/db/import-json', async (req, res) => {
    try {
      if (!fsSync.existsSync(DATA_FILE)) {
        return res.status(404).json({ error: `Le fichier de sauvegarde JSON n'a pas été trouvé sur le serveur à l'emplacement: ${DATA_FILE}` });
      }

      const rawData = await fs.readFile(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(rawData);

      // Perform schema-like checks to make sure the JSON format is compliant
      if (!parsed.products || !Array.isArray(parsed.products)) {
        return res.status(400).json({ error: "Le fichier JSON n'appartient pas à Zara Gallery ou a un format incorrect." });
      }

      // Upsert the whole payload into the SQLite data table with ID = 1
      db.prepare(`
        INSERT INTO app_state (id, data) VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET data = excluded.data
      `).run(rawData);

      // Synchronize orders into the transactions_history partition
      let syncedOrdersCount = 0;
      if (parsed.orders && Array.isArray(parsed.orders)) {
        const insertTx = db.prepare(`
          INSERT INTO transactions_history (id, date, client_name, total, payment_method, items, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            client_name = excluded.client_name,
            total = excluded.total,
            payment_method = excluded.payment_method,
            items = excluded.items
        `);
        const insertMany = db.transaction((orders) => {
          for (const order of orders) {
            const orderDate = new Date(order.date).toISOString().slice(0, 19).replace('T', ' ');
            const clientName = order.customer?.name || null;
            const paymentMethodStr = order.payments?.map((p: any) => p.method).join(', ') || 'CASH';
            insertTx.run(
              order.id, 
              orderDate,
              clientName,
              order.total,
              paymentMethodStr,
              JSON.stringify(order.items),
              orderDate
            );
          }
        });
        insertMany(parsed.orders);
        syncedOrdersCount = parsed.orders.length;
      }

      res.json({
        success: true,
        message: 'Importation et synchronisation complètes effectuées !',
        stats: {
          products: parsed.products?.length || 0,
          orders: syncedOrdersCount,
          users: parsed.users?.length || 0,
          customers: parsed.customers?.length || 0,
          promotions: parsed.promotions?.length || 0,
          wholesalers: parsed.wholesalers?.length || 0,
        }
      });
    } catch (e: any) {
      console.error('Failed to import JSON schema:', e);
      res.status(500).json({ error: "Échec de l'intégration du fichier de sauvegarde : " + e.message });
    }
  });

  // Generate and download a readable SQL dump of the live SQLite database
  app.get('/api/db/dump', (req, res) => {
    try {
      let sqlDump = `-- ====================================================\n`;
      sqlDump += `-- ZARA GALLERY - SQLITE DATABASE DUMP\n`;
      sqlDump += `-- Exported on: ${new Date().toISOString()}\n`;
      sqlDump += `-- ====================================================\n\n`;
      sqlDump += `PRAGMA foreign_keys=OFF;\n\n`;

      const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as any[];

      for (const table of tables) {
        const tableName = table.name;
        const colInfo = db.prepare(`PRAGMA table_info("${tableName}")`).all() as any[];
        const colNames = colInfo.map(c => `"${c.name}"`).join(', ');

        const rows = db.prepare(`SELECT * FROM "${tableName}"`).all() as any[];
        
        sqlDump += `-- ----------------------------------------------------\n`;
        sqlDump += `-- Table structure for table "${tableName}"\n`;
        sqlDump += `-- ----------------------------------------------------\n`;
        sqlDump += `DROP TABLE IF EXISTS "${tableName}";\n`;
        
        const createInfo = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(tableName) as any;
        if (createInfo && createInfo.sql) {
          sqlDump += `${createInfo.sql};\n\n`;
        }

        if (rows.length > 0) {
          sqlDump += `-- Dumping data for table "${tableName}"\n`;
          for (const row of rows) {
            const values = colInfo.map(c => {
              const val = row[c.name];
              if (val === null || val === undefined) return 'NULL';
              if (typeof val === 'number') return val;
              return `'${String(val).replace(/'/g, "''")}'`;
            }).join(', ');
            sqlDump += `INSERT INTO "${tableName}" (${colNames}) VALUES (${values});\n`;
          }
          sqlDump += `\n`;
        }
      }
      
      sqlDump += `PRAGMA foreign_keys=ON;\n`;

      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="zara_database_dump.sql"');
      res.send(sqlDump);
    } catch (e: any) {
      res.status(500).json({ error: 'Failed to generate schema/data dump: ' + e.message });
    }
  });

  // --- VITE MIDDLEWARE ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(rootDir, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const listenWithFallback = (portToTry: number) => {
    const serverInstance = app.listen(portToTry, '0.0.0.0', () => {
      console.log('----------------------------------------------------');
      console.log(`ZARA GALLERY - SERVEUR LOCAL ACTIVÉ`);
      console.log(`Accès local : http://localhost:${portToTry}`);
      console.log(`Accès Boutique (Wi-Fi) : http://[VOTRE-IP]:${portToTry}`);
      console.log('----------------------------------------------------');
    });

    serverInstance.on('error', (err: any) => {
      const fallbackPort = PORT + 1;
      if (err.code === 'EADDRINUSE' && portToTry === PORT) {
        console.warn(`⚠️ Le port ${portToTry} est déjà occupé. Tentative de repli automatique sur le port ${fallbackPort}...`);
        listenWithFallback(fallbackPort);
      } else {
        console.error('❌ Erreur de démarrage du serveur :', err);
      }
    });
  };

  listenWithFallback(PORT);
}

startServer();
