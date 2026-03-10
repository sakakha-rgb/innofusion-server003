const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// DB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('DB Connected'))
  .catch(err => console.error(err));

// Schema
const License = mongoose.model('License', new mongoose.Schema({
  key: String,
  expiresAt: Date,
  activations: Array
}));

// Routes
app.get('/', (req, res) => res.json({ status: 'iNNO FUSION API' }));

app.post('/activate', async (req, res) => {
  const { license_key, hardware_id } = req.body;
  const license = await License.findOne({ key: license_key });
  
  if (!license) return res.status(400).json({ error: 'Invalid' });
  if (new Date() > license.expiresAt) return res.status(400).json({ error: 'Expired' });
  
  res.json({ success: true, expires_at: license.expiresAt });
});

module.exports = app;