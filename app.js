// ===== MODELS & TYPES =====
class Lote {
    constructor(data = {}) {
        this.id = data.id || this.generateId();
        this.referencia = data.referencia || '';
        this.tipo = data.tipo || 'superior';
        this.tamanhos = data.tamanhos || [];
        
        this.qtdSuperior = data.qtdSuperior || 0;
        this.qtdInferior = data.qtdInferior || 0;
        this.qtdTamanho6 = data.qtdTamanho6 || 0;
        this.qtdTamanho8 = data.qtdTamanho8 || 0;
        
        this.valorPeca = data.valorPeca || 0;
        this.valorUnitarioSuperior = data.valorUnitarioSuperior || data.valorPeca || 0;
        this.valorUnitarioInferior = data.valorUnitarioInferior || data.valorPeca || 0;
        this.valorAdicionalTamanho6 = data.valorAdicionalTamanho6 || 0;
        this.cobraAdicionalTam6 = data.cobraAdicionalTam6 !== false;
        
        this.valorTotal = data.valorTotal || 0;
        
        this.dataInicio = data.dataInicio || new Date().toISOString();
        this.dataFim = data.dataFim || null;
        this.status = data.status || 'aberto';
        this.foto = data.foto || null;
    }
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    calcularValorTotal() {
        let total = 0;
        
        if (this.tipo === 'superior') {
            total = this.qtdSuperior * this.valorUnitarioSuperior;
        } else if (this.tipo === 'inferior') {
            total = this.qtdInferior * this.valorUnitarioInferior;
        } else if (this.tipo === 'conjunto') {
            total = (this.qtdSuperior * this.valorUnitarioSuperior) + 
                    (this.qtdInferior * this.valorUnitarioInferior);
        }
        
        if (this.qtdTamanho6 > 0 && this.cobraAdicionalTam6) {
            total += this.qtdTamanho6 * this.valorAdicionalTamanho6;
        }
        
        if (this.qtdTamanho8 > 0) {
            total += this.qtdTamanho8 * (this.valorAdicionalTamanho6 || 0);
        }
        
        this.valorTotal = total;
        return total;
    }
}

class AppSettings {
    constructor(data = {}) {
        this.appName = data.appName || 'Gestão Costura';
        this.logo = data.logo || 'icon-192.png';
        this.monthlyGoal = data.monthlyGoal || 3000;
        this.whatsappNumber = data.whatsappNumber || '';
        this.manualRevenue = data.manualRevenue || {};
    }
}

// ===== SERVICES =====
class StorageService {
    constructor() {
        this.LOTES_KEY = 'atelie_lotes_data';
        this.SETTINGS_KEY = 'atelie_settings';
        this.USER_KEY = 'atelie_user';
    }
    
    saveLotes(lotes) {
        try {
            localStorage.setItem(this.LOTES_KEY, JSON.stringify(lotes));
        } catch (e) {
            console.error('Erro ao salvar lotes', e);
            alert('Erro: Memória cheia. Limpe dados antigos.');
        }
    }
    
    loadLotes() {
        try {
            const data = localStorage.getItem(this.LOTES_KEY);
            return data ? JSON.parse(data).map(l => new Lote(l)) : [];
        } catch (e) {
            console.error('Erro ao carregar lotes', e);
            return [];
        }
    }
    
    saveSettings(settings) {
        try {
            localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
        } catch (e) {
            console.error('Erro ao salvar configurações', e);
        }
    }
    
    loadSettings() {
        try {
            const data = localStorage.getItem(this.SETTINGS_KEY);
            return data ? new AppSettings(JSON.parse(data)) : new AppSettings();
        } catch (e) {
            console.error('Erro ao carregar configurações', e);
            return new AppSettings();
        }
    }
    
    saveUser(user) {
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
    
    loadUser() {
        try {
            const data = localStorage.getItem(this.USER_KEY);
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }
    
    clearUser() {
        localStorage.removeItem(this.USER_KEY);
    }
}

class LoteService {
    constructor(storage) {
        this.storage = storage;
        this.lotes = storage.loadLotes();
        this.settings = storage.loadSettings();
        this.filter = 'este_mes';
    }
    
    addLote(lote) {
        lote.calcularValorTotal();
        this.lotes.unshift(lote);
        this.storage.saveLotes(this.lotes);
    }
    
    editLote(lote) {
        lote.calcularValorTotal();
        const index = this.lotes.findIndex(l => l.id === lote.id);
        if (index !== -1) {
            this.lotes[index] = lote;
            this.storage.saveLotes(this.lotes);
        }
    }
    
    deleteLote(id) {
        this.lotes = this.lotes.filter(l => l.id !== id);
        this.storage.saveLotes(this.lotes);
    }
    
    getLote(id) {
        return this.lotes.find(l => l.id === id);
    }
    
    getFilteredLotes() {
        const now = new Date();
        
        return this.lotes.filter(l => {
            if (this.filter === 'em_andamento') {
                return l.status === 'em_andamento';
            }
            
            if (this.filter === 'este_mes') {
                const lotDate = new Date(l.dataFim || l.dataInicio);
                return lotDate.getMonth() === now.getMonth() && 
                       lotDate.getFullYear() === now.getFullYear();
            }
            
            if (this.filter === 'mes_passado') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                const lotDate = new Date(l.dataFim || l.dataInicio);
                return lotDate.getMonth() === lastMonth.getMonth() && 
                       lotDate.getFullYear() === lastMonth.getFullYear();
            }
            
            return true;
        });
    }
    
    getTotalGanhos() {
        return this.getFilteredLotes()
            .filter(l => l.status === 'finalizado')
            .reduce((sum, l) => sum + l.valorTotal, 0);
    }
    
    getLotesEmAndamento() {
        return this.lotes.filter(l => l.status === 'em_andamento').length;
    }
    
    getLotesFinalizados() {
        return this.lotes.filter(l => l.status === 'finalizado').length;
    }
    
    getMonthData(year, month) {
        return this.lotes.filter(l => {
            if (l.status !== 'finalizado') return false;
            const date = new Date(l.dataFim || l.dataInicio);
            return date.getFullYear() === year && date.getMonth() === month;
        }).reduce((sum, l) => sum + l.valorTotal, 0);
    }
    
    updateSettings(settings) {
        this.settings = new AppSettings(settings);
        this.storage.saveSettings(this.settings);
    }
}

class UIController {
    constructor() {
        this.storage = new StorageService();
        this.user = this.storage.loadUser();
        this.loteService = new LoteService(this.storage);
        this.showFormModal = false;
        this.showSettingsModal = false;
        this.showReportModal = false;
        this.editingLote = null;
        
        this.render();
        this.setupServiceWorker();
    }
    
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(err => {
                console.log('SW registration failed:', err);
            });
        }
    }
    
    hideSplash() {
        setTimeout(() => {
            const splash = document.getElementById('splash');
            if (splash) {
                splash.classList.add('hidden');
            }
        }, 2200);
    }
    
    render() {
        const app = document.getElementById('app');
        
        if (!this.user) {
            this.renderLogin(app);
        } else {
            this.renderMain(app);
        }
        
        this.hideSplash();
    }
    
    renderLogin(container) {
        container.innerHTML = `
            <div class="login-screen">
                <div class="login-content">
                    <div class="login-logo">
                        <img src="${this.loteService.settings.logo}" alt="Logo">
                    </div>
                    <h1 class="login-title">Gestão Costura</h1>
                    <p class="login-subtitle">Controle seus lotes e ganhos</p>
                </div>
                
                <form id="loginForm" class="login-form">
                    <div class="form-group">
                        <label>Nome</label>
                        <input type="text" id="loginName" placeholder="Seu nome" required>
                    </div>
                    
                    <button type="submit" class="btn btn-primary" style="width: 100%;">
                        Entrar
                    </button>
                </form>
                
                <p class="login-footer">Seus dados são salvos localmente no dispositivo</p>
            </div>
        `;
        
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('loginName').value.trim();
            if (name) {
                this.user = { name, loginDate: new Date().toISOString() };
                this.storage.saveUser(this.user);
                this.render();
            }
        });
    }
    
    renderMain(container) {
        container.innerHTML = `
            <div class="main-screen">
                <header class="header">
                    <div class="header-logo">
                        <img src="${this.loteService.settings.logo}" alt="Logo">
                    </div>
                </header>
                
                <main class="main-content">
                    <div id="dashboardContainer"></div>
                    <div id="filterContainer"></div>
                    <div id="loteListContainer"></div>
                    <div style="height: 120px;"></div>
                </main>
            </div>
            
            <div class="bottom-actions">
                <button id="btnNewLote" class="btn-new-lote">
                    <span>➕</span>
                    <span>Novo Lote</span>
                </button>
                <button id="btnLogout" class="btn btn-secondary" style="width: 100%;">
                    Sair
                </button>
            </div>
        `;
        
        this.renderDashboard();
        this.renderFilters();
        this.renderLoteList();
        
        document.getElementById('btnNewLote').addEventListener('click', () => this.openFormModal(null));
        document.getElementById('btnLogout').addEventListener('click', () => this.logout());
        document.querySelector('.header-logo').addEventListener('click', () => this.openSettingsModal());
    }
    
    renderDashboard() {
        const container = document.getElementById('dashboardContainer');
        const totalGanhos = this.loteService.getTotalGanhos();
        const emAndamento = this.loteService.getLotesEmAndamento();
        const finalizados = this.loteService.getLotesFinalizados();
        const meta = this.loteService.settings.monthlyGoal;
        const percentualMeta = Math.round((totalGanhos / meta) * 100);
        
        container.innerHTML = `
            <div class="dashboard">
                <div class="dashboard-card">
                    <div class="dashboard-card-label">Ganhos do Mês</div>
                    <div class="dashboard-card-value">R$ ${totalGanhos.toFixed(2)}</div>
                    <div class="dashboard-card-footer">${percentualMeta}% da meta</div>
                </div>
                
                <div class="dashboard-card accent">
                    <div class="dashboard-card-label">Meta Mensal</div>
                    <div class="dashboard-card-value">R$ ${meta.toFixed(2)}</div>
                    <div class="dashboard-card-footer">${finalizados} finalizados</div>
                </div>
                
                <div class="dashboard-card">
                    <div class="dashboard-card-label">Em Andamento</div>
                    <div class="dashboard-card-value">${emAndamento}</div>
                    <div class="dashboard-card-footer">lotes ativos</div>
                </div>
            </div>
        `;
    }
    
    renderFilters() {
        const container = document.getElementById('filterContainer');
        const filters = [
            { value: 'este_mes', label: 'Este Mês' },
            { value: 'mes_passado', label: 'Mês Passado' },
            { value: 'em_andamento', label: 'Em Andamento' },
            { value: 'todos', label: 'Todos' }
        ];
        
        let html = '<div class="filters">';
        filters.forEach(f => {
            const active = this.loteService.filter === f.value ? 'active' : '';
            html += `<button class="filter-btn ${active}" data-filter="${f.value}">${f.label}</button>`;
        });
        html += '</div>';
        
        container.innerHTML = html;
        
        container.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.loteService.filter = e.target.dataset.filter;
                this.renderFilters();
                this.renderLoteList();
                this.renderDashboard();
            });
        });
    }
    
    renderLoteList() {
        const container = document.getElementById('loteListContainer');
        const lotes = this.loteService.getFilteredLotes();
        
        if (lotes.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: var(--gray-text); padding: 2rem;">Nenhum lote encontrado</p>';
            return;
        }
        
        let html = '<div class="lote-list">';
        lotes.forEach(lote => {
            const statusClass = lote.status;
            const statusLabel = {
                'aberto': 'Aberto',
                'em_andamento': 'Em Andamento',
                'finalizado': 'Finalizado'
            }[lote.status] || lote.status;
            
            html += `
                <div class="lote-item">
                    <div class="lote-header">
                        <div class="lote-reference">${lote.referencia}</div>
                        <span class="lote-status ${statusClass}">${statusLabel}</span>
                    </div>
                    
                    <div class="lote-details">
                        <div class="lote-detail">
                            <span class="lote-detail-label">Tipo</span>
                            <span class="lote-detail-value">${lote.tipo.charAt(0).toUpperCase() + lote.tipo.slice(1)}</span>
                        </div>
                        <div class="lote-detail">
                            <span class="lote-detail-label">Valor Total</span>
                            <span class="lote-detail-value">R$ ${lote.valorTotal.toFixed(2)}</span>
                        </div>
                        <div class="lote-detail">
                            <span class="lote-detail-label">Data Início</span>
                            <span class="lote-detail-value">${new Date(lote.dataInicio).toLocaleDateString('pt-BR')}</span>
                        </div>
                        ${lote.dataFim ? `
                            <div class="lote-detail">
                                <span class="lote-detail-label">Data Fim</span>
                                <span class="lote-detail-value">${new Date(lote.dataFim).toLocaleDateString('pt-BR')}</span>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="lote-actions">
                        <button class="btn btn-secondary btn-sm" onclick="ui.openFormModal('${lote.id}')">Editar</button>
                        ${lote.status !== 'finalizado' ? `
                            <button class="btn btn-primary btn-sm" onclick="ui.finalizarLote('${lote.id}')">Finalizar</button>
                        ` : ''}
                        <button class="btn btn-secondary btn-sm" onclick="ui.deleteLote('${lote.id}')">Deletar</button>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        container.innerHTML = html;
    }
    
    openFormModal(loteId) {
        const lote = loteId ? this.loteService.getLote(loteId) : null;
        this.editingLote = lote || new Lote();
        
        const modalsContainer = document.getElementById('modals');
        const isFinalizando = lote && lote.status === 'em_andamento';
        
        modalsContainer.innerHTML = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">${lote ? 'Editar Lote' : 'Novo Lote'}</h2>
                        <button type="button" class="modal-close">✕</button>
                    </div>
                    
                    <form id="loteForm" class="form-section">
                        <div class="form-section">
                            <label class="form-section-title">Informações Básicas</label>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Referência</label>
                                    <input type="text" id="referencia" value="${this.editingLote.referencia}" placeholder="Ex: REF-001" required>
                                </div>
                                <div class="form-group">
                                    <label>Tipo</label>
                                    <select id="tipo">
                                        <option value="superior" ${this.editingLote.tipo === 'superior' ? 'selected' : ''}>Superior</option>
                                        <option value="inferior" ${this.editingLote.tipo === 'inferior' ? 'selected' : ''}>Inferior</option>
                                        <option value="conjunto" ${this.editingLote.tipo === 'conjunto' ? 'selected' : ''}>Conjunto</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <label class="form-section-title">Quantidades</label>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Qtd Superior</label>
                                    <input type="number" id="qtdSuperior" value="${this.editingLote.qtdSuperior}" min="0">
                                </div>
                                <div class="form-group">
                                    <label>Qtd Inferior</label>
                                    <input type="number" id="qtdInferior" value="${this.editingLote.qtdInferior}" min="0">
                                </div>
                                <div class="form-group">
                                    <label>Qtd Tamanho 6</label>
                                    <input type="number" id="qtdTamanho6" value="${this.editingLote.qtdTamanho6}" min="0">
                                </div>
                                <div class="form-group">
                                    <label>Qtd Tamanho 8</label>
                                    <input type="number" id="qtdTamanho8" value="${this.editingLote.qtdTamanho8}" min="0">
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <label class="form-section-title">Valores</label>
                            <div class="form-grid">
                                <div class="form-group">
                                    <label>Valor Unitário Superior</label>
                                    <input type="number" id="valorUnitarioSuperior" value="${this.editingLote.valorUnitarioSuperior}" min="0" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Valor Unitário Inferior</label>
                                    <input type="number" id="valorUnitarioInferior" value="${this.editingLote.valorUnitarioInferior}" min="0" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Adicional Tamanho 6/8</label>
                                    <input type="number" id="valorAdicionalTamanho6" value="${this.editingLote.valorAdicionalTamanho6}" min="0" step="0.01">
                                </div>
                                <div class="form-group">
                                    <label>Status</label>
                                    <select id="status">
                                        <option value="aberto" ${this.editingLote.status === 'aberto' ? 'selected' : ''}>Aberto</option>
                                        <option value="em_andamento" ${this.editingLote.status === 'em_andamento' ? 'selected' : ''}>Em Andamento</option>
                                        <option value="finalizado" ${this.editingLote.status === 'finalizado' ? 'selected' : ''}>Finalizado</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <label class="form-section-title">Valor Total</label>
                            <div class="dashboard-card accent">
                                <div class="dashboard-card-label">Valor a Receber</div>
                                <div class="dashboard-card-value" id="valorTotalPreview">R$ ${this.editingLote.valorTotal.toFixed(2)}</div>
                            </div>
                        </div>
                    </form>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
                        <button type="submit" form="loteForm" class="btn btn-primary">${lote ? 'Atualizar' : 'Criar'}</button>
                    </div>
                </div>
            </div>
        `;
        
        // Setup form events
        const form = document.getElementById('loteForm');
        const closeBtn = modalsContainer.querySelector('.modal-close');
        
        closeBtn.addEventListener('click', () => this.closeModal());
        modalsContainer.addEventListener('click', (e) => {
            if (e.target === modalsContainer) this.closeModal();
        });
        
        // Auto-calculate value on input change
        ['qtdSuperior', 'qtdInferior', 'qtdTamanho6', 'qtdTamanho8', 'valorUnitarioSuperior', 'valorUnitarioInferior', 'valorAdicionalTamanho6'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.addEventListener('change', () => this.updateValorPreview());
        });
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveLote();
        });
    }
    
    updateValorPreview() {
        const qtdSuperior = parseFloat(document.getElementById('qtdSuperior').value) || 0;
        const qtdInferior = parseFloat(document.getElementById('qtdInferior').value) || 0;
        const qtdTamanho6 = parseFloat(document.getElementById('qtdTamanho6').value) || 0;
        const qtdTamanho8 = parseFloat(document.getElementById('qtdTamanho8').value) || 0;
        const valorSuperior = parseFloat(document.getElementById('valorUnitarioSuperior').value) || 0;
        const valorInferior = parseFloat(document.getElementById('valorUnitarioInferior').value) || 0;
        const valorAdicional = parseFloat(document.getElementById('valorAdicionalTamanho6').value) || 0;
        
        let total = (qtdSuperior * valorSuperior) + (qtdInferior * valorInferior);
        if (qtdTamanho6 > 0) total += qtdTamanho6 * valorAdicional;
        if (qtdTamanho8 > 0) total += qtdTamanho8 * valorAdicional;
        
        document.getElementById('valorTotalPreview').textContent = `R$ ${total.toFixed(2)}`;
    }
    
    saveLote() {
        const lote = this.editingLote;
        lote.referencia = document.getElementById('referencia').value;
        lote.tipo = document.getElementById('tipo').value;
        lote.qtdSuperior = parseFloat(document.getElementById('qtdSuperior').value) || 0;
        lote.qtdInferior = parseFloat(document.getElementById('qtdInferior').value) || 0;
        lote.qtdTamanho6 = parseFloat(document.getElementById('qtdTamanho6').value) || 0;
        lote.qtdTamanho8 = parseFloat(document.getElementById('qtdTamanho8').value) || 0;
        lote.valorUnitarioSuperior = parseFloat(document.getElementById('valorUnitarioSuperior').value) || 0;
        lote.valorUnitarioInferior = parseFloat(document.getElementById('valorUnitarioInferior').value) || 0;
        lote.valorAdicionalTamanho6 = parseFloat(document.getElementById('valorAdicionalTamanho6').value) || 0;
        lote.status = document.getElementById('status').value;
        
        if (lote.status === 'finalizado' && !lote.dataFim) {
            lote.dataFim = new Date().toISOString();
        }
        
        if (this.editingLote.id) {
            this.loteService.editLote(lote);
        } else {
            this.loteService.addLote(lote);
        }
        
        this.closeModal();
        this.renderMain(document.getElementById('app'));
    }
    
    finalizarLote(loteId) {
        const lote = this.loteService.getLote(loteId);
        if (lote) {
            lote.status = 'finalizado';
            lote.dataFim = new Date().toISOString();
            this.loteService.editLote(lote);
            this.renderMain(document.getElementById('app'));
        }
    }
    
    deleteLote(loteId) {
        if (confirm('Deseja realmente deletar este lote?')) {
            this.loteService.deleteLote(loteId);
            this.renderMain(document.getElementById('app'));
        }
    }
    
    openSettingsModal() {
        const modalsContainer = document.getElementById('modals');
        const settings = this.loteService.settings;
        
        modalsContainer.innerHTML = `
            <div class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title">Configurações</h2>
                        <button type="button" class="modal-close">✕</button>
                    </div>
                    
                    <form id="settingsForm" class="settings-modal">
                        <div class="settings-section">
                            <label class="settings-section-title">Logo e Nome</label>
                            <div class="form-group">
                                <label>Nome do App</label>
                                <input type="text" id="appName" value="${settings.appName}">
                            </div>
                            <div class="form-group">
                                <label>URL da Logo (opcional)</label>
                                <input type="text" id="logoUrl" value="${settings.logo}" placeholder="icon-192.png">
                            </div>
                        </div>
                        
                        <div class="settings-section">
                            <label class="settings-section-title">Metas e Contato</label>
                            <div class="form-group">
                                <label>Meta Mensal (R$)</label>
                                <input type="number" id="monthlyGoal" value="${settings.monthlyGoal}" min="0" step="100">
                            </div>
                            <div class="form-group">
                                <label>Número WhatsApp (opcional)</label>
                                <input type="tel" id="whatsappNumber" value="${settings.whatsappNumber}" placeholder="11999999999">
                            </div>
                        </div>
                    </form>
                    
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" onclick="ui.closeModal()">Cancelar</button>
                        <button type="submit" form="settingsForm" class="btn btn-primary">Salvar</button>
                    </div>
                </div>
            </div>
        `;
        
        const form = document.getElementById('settingsForm');
        const closeBtn = modalsContainer.querySelector('.modal-close');
        
        closeBtn.addEventListener('click', () => this.closeModal());
        modalsContainer.addEventListener('click', (e) => {
            if (e.target === modalsContainer) this.closeModal();
        });
        
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSettings();
        });
    }
    
    saveSettings() {
        const newSettings = {
            appName: document.getElementById('appName').value,
            logo: document.getElementById('logoUrl').value || 'icon-192.png',
            monthlyGoal: parseFloat(document.getElementById('monthlyGoal').value) || 3000,
            whatsappNumber: document.getElementById('whatsappNumber').value
        };
        
        this.loteService.updateSettings(newSettings);
        this.closeModal();
        this.renderMain(document.getElementById('app'));
    }
    
    closeModal() {
        document.getElementById('modals').innerHTML = '';
    }
    
    logout() {
        if (confirm('Deseja realmente sair? Seus dados serão mantidos.')) {
            this.storage.clearUser();
            this.user = null;
            this.render();
        }
    }
}

// ===== INITIALIZATION =====
let ui;
document.addEventListener('DOMContentLoaded', () => {
    ui = new UIController();
});
