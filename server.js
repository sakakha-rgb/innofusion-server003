const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

// MongoDB Schema
const LicenseSchema = new mongoose.Schema({
    key: { type: String, unique: true, required: true },
    tier: { type: String, enum: ['basic', 'pro', 'enterprise'], default: 'basic' },
    hardwareId: { type: String, default: null },
    activated: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    features: [{ type: String }],
    maxActivations: { type: Number, default: 1 },
    activations: [{ hardwareId: String, activatedAt: Date }]
});

const License = mongoose.model('License', LicenseSchema);

// Generate License Key (Admin only)
app.post('/admin/generate', async (req, res) => {
    const { count = 1, tier = 'pro', days = 365, features = [] } = req.body;
    
    const keys = [];
    for (let i = 0; i < count; i++) {
        const key = generateKey();
        const license = new License({
            key: key,
            tier: tier,
            expiresAt: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
            features: features.length ? features : getDefaultFeatures(tier)
        });
        await license.save();
        keys.push(key);
    }
    
    res.json({ generated: keys });
});

function generateKey() {
    const segments = 4;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1
    let key = '';
    
    for (let i = 0; i < segments; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < segments - 1) key += '-';
    }
    
    return key;
}

function getDefaultFeatures(tier) {
    const features = {
        basic: ['preview', 'import'],
        pro: ['preview', 'import', 'favorites', 'custom_categories'],
        enterprise: ['preview', 'import', 'favorites', 'custom_categories', 'team_sharing', 'api_access']
    };
    return features[tier] || features.basic;
}

// Activate License
app.post('/activate', async (req, res) => {
    const { license_key, hardware_id, product, version } = req.body;
    
    try {
        const license = await License.findOne({ key: license_key });
        
        if (!license) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid license key',
                code: 'INVALID_KEY'
            });
        }
        
        if (new Date() > license.expiresAt) {
            return res.status(400).json({ 
                success: false, 
                error: 'License expired',
                code: 'EXPIRED',
                expired_at: license.expiresAt
            });
        }
        
        // Check if already activated on this hardware
        const existingActivation = license.activations.find(a => a.hardwareId === hardware_id);
        if (existingActivation) {
            return res.json({
                success: true,
                reactivated: true,
                tier: license.tier,
                features: license.features,
                expires_at: license.expiresAt
            });
        }
        
        // Check max activations
        if (license.activations.length >= license.maxActivations) {
            return res.status(403).json({
                success: false,
                error: 'Maximum activations reached',
                code: 'MAX_ACTIVATIONS'
            });
        }
        
        // Add activation
        license.activations.push({
            hardwareId: hardware_id,
            activatedAt: new Date()
        });
        license.activated = true;
        await license.save();
        
        res.json({
            success: true,
            tier: license.tier,
            features: license.features,
            expires_at: license.expiresAt
        });
        
    } catch (error) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// Validate License (background check)
app.post('/validate', async (req, res) => {
    const { license_key, hardware_id } = req.body;
    
    const license = await License.findOne({ key: license_key });
    
    if (!license || 
        new Date() > license.expiresAt || 
        !license.activations.find(a => a.hardwareId === hardware_id)) {
        return res.json({ valid: false });
    }
    
    res.json({ valid: true });
});

// Start server
const PORT = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/innofusion')
    .then(() => {
        app.listen(PORT, () => console.log(`iNNO FUSION License Server running on port ${PORT}`));
    });