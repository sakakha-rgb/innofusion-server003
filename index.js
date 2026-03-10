// iNNO FUSION - Main Entry Point
class InnoFusionApp {
    constructor() {
        this.licenseManager = window.licenseManager;
        this.scanner = null;
        this.library = null;
        this.selectedTemplate = null;
        this.currentCategory = 'all';
        this.searchQuery = '';
    }

    async initialize() {
        // Splash screen
        await this.showSplash();
        
        // License check
        const auth = await this.licenseManager.initialize();
        
        if (auth.valid) {
            await this.showMainApp();
        } else {
            this.showAuthPanel();
        }
    }

    async showSplash() {
        return new Promise(resolve => {
            setTimeout(() => {
                document.getElementById('splash-screen').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('splash-screen').classList.add('hidden');
                    resolve();
                }, 500);
            }, 2000);
        });
    }

    showAuthPanel() {
        const panel = document.getElementById('auth-panel');
        panel.classList.remove('hidden');
        
        // Input formatting
        const input = document.getElementById('license-input');
        input.addEventListener('input', (e) => {
            e.target.value = this.licenseManager.formatLicenseKey(e.target.value);
        });

        // Activation
        document.getElementById('activate-btn').addEventListener('click', async () => {
            await this.handleActivation();
        });

        input.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter') await this.handleActivation();
        });
    }

    async handleActivation() {
        const btn = document.getElementById('activate-btn');
        const input = document.getElementById('license-input');
        const message = document.getElementById('auth-message');
        
        const key = input.value.trim();
        if (key.length < 19) {
            this.showMessage('Please enter a valid license key', 'error');
            return;
        }

        btn.disabled = true;
        btn.querySelector('.btn-text').classList.add('hidden');
        btn.querySelector('.btn-loader').classList.remove('hidden');

        const result = await this.licenseManager.activateLicense(key);

        btn.disabled = false;
        btn.querySelector('.btn-text').classList.remove('hidden');
        btn.querySelector('.btn-loader').classList.add('hidden');

        if (result.success) {
            this.showMessage('Activation successful! Loading...', 'success');
            setTimeout(() => this.showMainApp(), 1000);
        } else {
            this.showMessage(result.error || 'Activation failed', 'error');
        }
    }

    showMessage(text, type) {
        const msg = document.getElementById('auth-message');
        msg.textContent = text;
        msg.className = `message ${type}`;
        msg.classList.remove('hidden');
    }

    async showMainApp() {
        document.getElementById('auth-panel').classList.add('hidden');
        const app = document.getElementById('main-app');
        app.classList.remove('hidden');
        app.classList.add('fade-in');

        // Initialize scanner
        const libraryPath = require('path').join(__dirname, '../mogrt_library');
        this.scanner = new MogrtScanner(libraryPath);
        await this.scanner.initialize();

        // Load library
        await this.loadLibrary();

        // Setup event listeners
        this.setupEventListeners();

        // Setup search
        this.setupSearch();

        // Setup categories
        this.renderCategories();
    }

    async loadLibrary() {
        try {
            this.library = await this.scanner.scanLibrary();
            this.renderGrid();
            this.updateStats();
        } catch (error) {
            console.error('Failed to load library:', error);
            this.showEmptyState('Failed to load library. Please check the folder path.');
        }
    }

    renderGrid() {
        const grid = document.getElementById('mogrt-grid');
        grid.innerHTML = '';

        const templates = this.getFilteredTemplates();

        if (templates.length === 0) {
            this.showEmptyState();
            return;
        }

        document.getElementById('empty-state').classList.add('hidden');

        templates.forEach(template => {
            const card = this.createCard(template);
            grid.appendChild(card);
        });
    }

    createCard(template) {
        const card = document.createElement('div');
        card.className = 'mogrt-card';
        card.dataset.id = template.id;
        
        card.innerHTML = `
            <div class="card-thumbnail">
                <img src="${template.thumbnail}" 
                     alt="${template.name}"
                     onerror="this.src='assets/placeholder.jpg'">
                <div class="card-overlay">
                    <div class="play-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                    </div>
                </div>
                <span class="card-badge">${template.duration}</span>
            </div>
            <div class="card-info">
                <div class="card-title">${template.name}</div>
                <div class="card-meta">
                    <span>${template.category}</span>
                    <span>${this.formatFileSize(template.fileSize)}</span>
                </div>
            </div>
        `;

        card.addEventListener('click', () => this.selectTemplate(template));
        card.addEventListener('mouseenter', () => this.previewTemplate(template));

        return card;
    }

    selectTemplate(template) {
        // Remove previous selection
        document.querySelectorAll('.mogrt-card').forEach(c => c.classList.remove('selected'));
        
        // Add selection
        const card = document.querySelector(`[data-id="${template.id}"]`);
        if (card) card.classList.add('selected');

        this.selectedTemplate = template;
        this.updatePreviewPanel(template);
    }

    updatePreviewPanel(template) {
        document.getElementById('preview-title').textContent = template.name;
        document.getElementById('preview-desc').textContent = template.description || 'No description available';
        document.getElementById('preview-duration').textContent = template.duration;
        document.getElementById('preview-res').textContent = template.resolution;
        document.getElementById('preview-fps').textContent = template.fps;

        // Tags
        const tagsContainer = document.getElementById('preview-tags');
        tagsContainer.innerHTML = template.tags.map(tag => 
            `<span class="tag">${tag}</span>`
        ).join('');

        // Enable buttons
        document.getElementById('import-btn').disabled = false;
        
        // Video preview (if available)
        const video = document.getElementById('preview-video');
        video.poster = template.thumbnail;
    }

    async importToTimeline() {
        if (!this.selectedTemplate) return;

        const bridge = new PremiereBridge();
        const result = await bridge.importMogrt(this.selectedTemplate);
        
        if (result.success) {
            this.showNotification('Template imported successfully!', 'success');
        } else {
            this.showNotification('Import failed: ' + result.error, 'error');
        }
    }

    getFilteredTemplates() {
        let templates = this.library.templates;

        // Category filter
        if (this.currentCategory !== 'all') {
            templates = templates.filter(t => t.category === this.currentCategory);
        }

        // Search filter
        if (this.searchQuery) {
            const query = this.searchQuery.toLowerCase();
            templates = templates.filter(t => 
                t.name.toLowerCase().includes(query) ||
                t.tags.some(tag => tag.toLowerCase().includes(query)) ||
                t.category.toLowerCase().includes(query)
            );
        }

        return templates;
    }

    renderCategories() {
        const list = document.getElementById('category-list');
        
        // Clear except "All"
        const allItem = list.querySelector('[data-category="all"]');
        list.innerHTML = '';
        list.appendChild(allItem);

        // Add categories
        this.library.categories.forEach(cat => {
            const count = this.library.templates.filter(t => t.category === cat).length;
            
            const li = document.createElement('li');
            li.className = 'category-item';
            li.dataset.category = cat;
            li.innerHTML = `
                <span class="cat-icon">📂</span>
                <span>${cat}</span>
                <span class="count">${count}</span>
            `;
            
            li.addEventListener('click', () => {
                document.querySelectorAll('.category-item').forEach(i => i.classList.remove('active'));
                li.classList.add('active');
                this.currentCategory = cat;
                this.renderGrid();
            });
            
            list.appendChild(li);
        });

        // Update all count
        document.getElementById('count-all').textContent = this.library.templates.length;
    }

    setupEventListeners() {
        // Import button
        document.getElementById('import-btn').addEventListener('click', () => {
            this.importToTimeline();
        });

        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', async () => {
            await this.loadLibrary();
            this.showNotification('Library refreshed', 'success');
        });

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const grid = document.getElementById('mogrt-grid');
                if (btn.dataset.view === 'list') {
                    grid.classList.add('list-view');
                } else {
                    grid.classList.remove('list-view');
                }
            });
        });

        // Sort
        document.getElementById('sort-by').addEventListener('change', (e) => {
            this.sortTemplates(e.target.value);
        });

        // Close preview
        document.getElementById('close-preview').addEventListener('click', () => {
            document.getElementById('preview-panel').classList.add('collapsed');
        });
    }

    setupSearch() {
        const searchInput = document.getElementById('global-search');
        let debounceTimer;

        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.searchQuery = e.target.value;
                this.renderGrid();
            }, 300);
        });
    }

    sortTemplates(method) {
        switch(method) {
            case 'name':
                this.library.templates.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'newest':
                this.library.templates.sort((a, b) => new Date(b.modifiedAt) - new Date(a.modifiedAt));
                break;
            case 'duration':
                this.library.templates.sort((a, b) => a.duration.localeCompare(b.duration));
                break;
        }
        this.renderGrid();
    }

    updateStats() {
        // Storage info
        const totalSize = this.library.templates.reduce((acc, t) => acc + t.fileSize, 0);
        document.getElementById('lib-size').textContent = this.formatFileSize(totalSize);
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    showEmptyState(message) {
        const empty = document.getElementById('empty-state');
        if (message) {
            empty.querySelector('p').textContent = message;
        }
        empty.classList.remove('hidden');
    }

    showNotification(message, type = 'info') {
        // Custom notification implementation
        console.log(`[${type}] ${message}`);
    }

    previewTemplate(template) {
        // Hover preview logic
        // Could load video preview here
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    const app = new InnoFusionApp();
    app.initialize();
});