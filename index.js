import express from 'express';
import { MongoClient } from 'mongodb';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI;

// ========== ROUTES ==========

// GET / - Status
app.get('/', (req, res) => {
  res.json({ 
    status: "iNNO FUSION API",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// POST /activate
app.post('/activate', async (req, res) => {
  const { license_key, hardware_id } = req.body;
  
  if (!license_key || !hardware_id) {
    return res.status(400).json({ 
      success: false, 
      error: 'Missing license_key or hardware_id' 
    });
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('innofusion');
    const licenses = db.collection('licenses');
    
    const license = await licenses.findOne({ key: license_key });
    
    if (!license) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid license key',
        code: 'INVALID_KEY'
      });
    }
    
    // Check expiry
    if (new Date() > new Date(license.expiresAt)) {
      return res.status(400).json({ 
        success: false, 
        error: 'License expired',
        code: 'EXPIRED'
      });
    }
    
    // Check existing activation
    const existing = license.activations?.find(a => a.hardwareId === hardware_id);
    if (existing) {
      return res.json({
        success: true,
        reactivated: true,
        tier: license.tier || 'pro',
        expires_at: license.expiresAt
      });
    }
    
    // Max 2 devices
    if (license.activations?.length >= 2) {
      return res.status(403).json({
        success: false,
        error: 'Maximum 2 devices allowed',
        code: 'MAX_DEVICES'
      });
    }
    
    // Add activation
    await licenses.updateOne(
      { key: license_key },
      { 
        $push: { 
          activations: { 
            hardwareId: hardware_id, 
            activatedAt: new Date()
          } 
        },
        $set: { activated: true }
      }
    );
    
    res.json({
      success: true,
      tier: license.tier || 'pro',
      features: license.features || ['preview', 'import', 'favorites'],
      expires_at: license.expiresAt
    });
    
  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ success: false, error: 'Server error' });
  } finally {
    await client.close();
  }
});

// POST /validate
app.post('/validate', async (req, res) => {
  const { license_key, hardware_id } = req.body;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('innofusion');
    const license = await db.collection('licenses').findOne({ key: license_key });
    
    const isValid = license && 
                   new Date() < new Date(license.expiresAt) &&
                   license.activations?.some(a => a.hardwareId === hardware_id);
    
    res.json({ valid: isValid });
    
  } catch (error) {
    res.status(500).json({ valid: false });
  } finally {
    await client.close();
  }
});

// POST /generate (Admin)
app.post('/generate', async (req, res) => {
  const { secret, count = 1, tier = 'pro', days = 365 } = req.body;
  
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const generateKey = () => {
    let key = '';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      if (i < 3) key += '-';
    }
    return key;
  };

  const client = new MongoClient(uri);
  const keys = [];
  
  try {
    await client.connect();
    const db = client.db('innofusion');
    const licenses = db.collection('licenses');
    
    for (let i = 0; i < count; i++) {
      let key;
      let exists = true;
      
      // Ensure unique key
      while (exists) {
        key = generateKey();
        exists = await licenses.findOne({ key });
      }
      
      await licenses.insertOne({
        key,
        tier,
        features: tier === 'pro' ? 
          ['preview', 'import', 'favorites'] : 
          ['preview', 'import'],
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        activated: false,
        activations: []
      });
      
      keys.push(key);
    }
    
    res.json({ success: true, generated: keys.length, keys });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await client.close();
  }
});

// Export for Vercel
export default app;

// Local dev
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}