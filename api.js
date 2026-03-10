import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
}
