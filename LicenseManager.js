class LicenseManager {
    constructor() {
        this.apiEndpoint = 'https://api.innofusion.com/v1';
        innofusion-server003.vercel.app
        this.storageKey = 'innofusion_license';
        this.hardwareId = null;
        this.currentLicense = null;
    }

    async initialize() {
        this.hardwareId = await this.generateHardwareId();
        const saved = localStorage.getItem(this.storageKey);
        
        if (saved) {
            this.currentLicense = JSON.parse(saved);
            return await this.validateLocalLicense();
        }
        
        return { valid: false, reason: 'no_license' };
    }

    async generateHardwareId() {
        // UXP-তে সীমিত সিস্টেম অ্যাক্সেস
        // Adobe API ব্যবহার করে ইউনিক ID জেনারেট
        const info = await require('os').userInfo();
        const hostname = require('os').hostname();
        const data = `${hostname}-${info.username}-${navigator.userAgent}`;
        
        // Simple hash
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return Math.abs(hash).toString(16).toUpperCase().padStart(8, '0');
    }

    formatLicenseKey(input) {
        // XXXX-XXXX-XXXX-XXXX ফরম্যাট
        const cleaned = input.replace(/[^A-Z0-9]/gi, '').toUpperCase();
        const parts = cleaned.match(/.{1,4}/g) || [];
        return parts.join('-').substring(0, 19);
    }

    async activateLicense(key) {
        try {
            const formattedKey = this.formatLicenseKey(key);
            
            // API কল
            const response = await fetch(`${this.apiEndpoint}/activate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    license_key: formattedKey,
                    hardware_id: this.hardwareId,
                    product: 'innofusion',
                    version: '1.0.0'
                })
            });

            const data = await response.json();

            if (data.success) {
                this.currentLicense = {
                    key: formattedKey,
                    hardwareId: this.hardwareId,
                    activatedAt: new Date().toISOString(),
                    expiresAt: data.expires_at,
                    tier: data.tier,
                    features: data.features
                };
                
                localStorage.setItem(this.storageKey, JSON.stringify(this.currentLicense));
                return { success: true, license: this.currentLicense };
            } else {
                return { 
                    success: false, 
                    error: data.error || 'Invalid license key',
                    code: data.code 
                };
            }
        } catch (error) {
            console.error('Activation error:', error);
            
            // অফলাইন মোড: লোকাল ভ্যালিডেশন (ব্যাকআপ)
            return this.offlineValidation(key);
        }
    }

    offlineValidation(key) {
        // সিম্পল অফলাইন চেক (ডেমো/ট্রায়ালের জন্য)
        const demoKeys = ['DEMO-2024-UNLT-XXXX'];
        
        if (demoKeys.includes(key)) {
            this.currentLicense = {
                key: key,
                hardwareId: this.hardwareId,
                activatedAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
                tier: 'trial',
                features: ['basic', 'preview']
            };
            
            localStorage.setItem(this.storageKey, JSON.stringify(this.currentLicense));
            return { success: true, license: this.currentLicense, offline: true };
        }
        
        return { success: false, error: 'Offline activation failed. Please check your internet connection.' };
    }

    async validateLocalLicense() {
        if (!this.currentLicense) return { valid: false };
        
        // HWID চেক
        if (this.currentLicense.hardwareId !== this.hardwareId) {
            this.clearLicense();
            return { valid: false, reason: 'hardware_mismatch' };
        }
        
        // এক্সপায়ারি চেক
        const now = new Date();
        const expiry = new Date(this.currentLicense.expiresAt);
        
        if (now > expiry) {
            return { valid: false, reason: 'expired', expiredAt: this.currentLicense.expiresAt };
        }
        
        // সার্ভারে রি-ভ্যালিডেট (ব্যাকগ্রাউন্ডে)
        this.backgroundValidation();
        
        return { 
            valid: true, 
            license: this.currentLicense,
            daysLeft: Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
        };
    }

    async backgroundValidation() {
        try {
            const response = await fetch(`${this.apiEndpoint}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    license_key: this.currentLicense.key,
                    hardware_id: this.hardwareId
                })
            });
            
            const data = await response.json();
            
            if (!data.valid) {
                // রিভোকড হলে ক্লিয়ার
                this.clearLicense();
                window.location.reload();
            }
        } catch (e) {
            // অফলাইনে ইগনোর
        }
    }

    clearLicense() {
        localStorage.removeItem(this.storageKey);
        this.currentLicense = null;
    }

    getLicenseInfo() {
        return this.currentLicense;
    }

    hasFeature(feature) {
        if (!this.currentLicense) return false;
        return this.currentLicense.features.includes(feature);
    }
}

// Global instance
window.licenseManager = new LicenseManager();