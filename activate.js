import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { license_key, hardware_id } = req.body;
  
  try {
    await client.connect();
    const db = client.db('innofusion');
    const licenses = db.collection('licenses');
    
    const license = await licenses.findOne({ key: license_key });
    
    if (!license) {
      return res.status(400).json({ success: false, error: 'Invalid key' });
    }
    
    if (new Date() > new Date(license.expiresAt)) {
      return res.status(400).json({ success: false, error: 'Expired' });
    }
    
    // Update activation
    await licenses.updateOne(
      { key: license_key },
      { $push: { activations: { hardwareId: hardware_id, date: new Date() } } }
    );
    
    res.json({ 
      success: true, 
      expires_at: license.expiresAt,
      tier: license.tier || 'pro'
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  } finally {
    await client.close();
  }
}