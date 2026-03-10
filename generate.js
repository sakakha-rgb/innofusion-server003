import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

function generateKey() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let key = '';
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 4; j++) {
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    if (i < 3) key += '-';
  }
  return key;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { secret, count = 1, tier = 'pro', days = 365, features } = req.body;
  
  // Verify admin secret
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid admin secret',
      code: 'UNAUTHORIZED'
    });
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('innofusion');
    const licenses = db.collection('licenses');
    
    const defaultFeatures = {
      basic: ['preview', 'import'],
      pro: ['preview', 'import', 'favorites', 'custom_categories'],
      enterprise: ['preview', 'import', 'favorites', 'custom_categories', 'team_sharing', 'api_access']
    };
    
    const keys = [];
    
    for (let i = 0; i < count; i++) {
      let key;
      let exists = true;
      
      // Unique key ensure
      while (exists) {
        key = generateKey();
        exists = await licenses.findOne({ key });
      }
      
      await licenses.insertOne({
        key,
        tier,
        features: features || defaultFeatures[tier] || defaultFeatures.pro,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        activated: false,
        activations: [],
        metadata: {
          generatedBy: 'admin_api',
          ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
        }
      });
      
      keys.push(key);
    }
    
    res.json({ 
      success: true, 
      generated: keys.length,
      keys,
      tier,
      expires_in_days: days,
      features: features || defaultFeatures[tier],
      created_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Generate error:', error);
    res.status(500).json({ success: false, error: 'Server error', details: error.message });
  } finally {
    await client.close();
  }
}