import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { secret, count = 1, days = 365 } = req.body;
  
  if (secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const generateKey = () => {
    let key = '';
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) key += chars[Math.floor(Math.random() * chars.length)];
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
      let key, exists = true;
      while (exists) {
        key = generateKey();
        exists = await licenses.findOne({ key });
      }
      
      await licenses.insertOne({
        key,
        tier: 'pro',
        features: ['preview', 'import', 'favorites'],
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
}
