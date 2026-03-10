import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
        code: 'EXPIRED',
        expired_at: license.expiresAt
      });
    }
    
    // Check existing
    const existing = license.activations?.find(a => a.hardwareId === hardware_id);
    if (existing) {
      return res.json({
        success: true,
        reactivated: true,
        tier: license.tier || 'pro',
        features: license.features || ['preview', 'import'],
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
            activatedAt: new Date(),
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress
          } 
        },
        $set: { activated: true, lastUsed: new Date() }
      }
    );
    
    res.json({
      success: true,
      tier: license.tier || 'pro',
      features: license.features || ['preview', 'import', 'favorites'],
      expires_at: license.expiresAt,
      activated_at: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Activation error:', error);
    res.status(500).json({ success: false, error: 'Server error', details: error.message });
  } finally {
    await client.close();
  }
}