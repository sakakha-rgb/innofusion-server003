import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method !== 'POST') {
    return res.status(405).json({ valid: false, error: 'Method not allowed' });
  }

  const { license_key, hardware_id } = req.body;
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('innofusion');
    const license = await db.collection('licenses').findOne({ key: license_key });
    
    const now = new Date();
    const isValid = license && 
                   now < new Date(license.expiresAt) &&
                   license.activations?.some(a => a.hardwareId === hardware_id);
    
    res.json({ 
      valid: isValid,
      checked_at: now.toISOString()
    });
    
  } catch (error) {
    res.status(500).json({ valid: false, error: 'Server error' });
  } finally {
    await client.close();
  }
}