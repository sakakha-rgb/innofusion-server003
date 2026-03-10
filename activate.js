import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { license_key, hardware_id } = req.body;
  if (!license_key || !hardware_id) {
    return res.status(400).json({ success: false, error: 'Missing fields' });
  }

  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db('innofusion');
    const licenses = db.collection('licenses');
    
    const license = await licenses.findOne({ key: license_key });
    if (!license) return res.status(400).json({ success: false, error: 'Invalid key' });
    if (new Date() > new Date(license.expiresAt)) return res.status(400).json({ success: false, error: 'Expired' });
    
    const existing = license.activations?.find(a => a.hardwareId === hardware_id);
    if (existing) return res.json({ success: true, reactivated: true, expires_at: license.expiresAt });
    
    if (license.activations?.length >= 2) return res.status(403).json({ success: false, error: 'Max devices' });
    
    await licenses.updateOne(
      { key: license_key },
      { $push: { activations: { hardwareId: hardware_id, activatedAt: new Date() } } }
    );
    
    res.json({ success: true, expires_at: license.expiresAt });
  } catch (error) {
    res.status(500).json({ error: error.message });
  } finally {
    await client.close();
  }
}
