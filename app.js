// ===== MODELS =====
class Lote {
    constructor(data = {}) {
        this.id = data.id || Date.now().toString(36) + Math.random().toString(36).substr(2);
        this.tipo = data.tipo || 'superior';
        this.referencia = data.referencia || '';
        this.letra = data.letra || '';
        this.tamanhos = data.tamanhos || [];
        
        this.qtdSuperior = data.qtdSuperior || 0;
        this.valorSuperior = data.valorSuperior || 0;
        this.qtdInferior = data.qtdInferior || 0;
        this.valorInferior = data.valorInferior || 0;
        
        this.qtdTamanho6 = data.qtdTamanho6 || 0;
        this.qtdTamanho8 = data.qtdTamanho8 || 0;
        this.cobraAdicional = data.cobraAdicional !== false;
        this.valorAdicional = data.valorAdicional || 0;
        
        this.dataInicio = data.dataInicio || new Date().toISOString().split('T')[0];
        this.dataFim = data.dataFim || '';
        this.status = data.status || 'aberto';
        this.valorTotal = data.valorTotal || 0;
        this.foto = data.foto || null;
    }
    
    calcularTotal() {
        let total = 0;
        
        if (this.tipo === 'superior' || this.tipo === 'conjunto') {
            total += this.qtdSuperior * this.valorSuperior;
        }
        
        if (this.tipo === 'inferior' || this.tipo === 'conjunto') {
            total += this.qtdInferior * this.valorInferior;
        }
        
        if (this.cobraAdicional) {
            if (this.qtdTamanho6 > 0) total += this.qtdTamanho6 * this.valorAdicional;
            if (this.qtdTamanho8 > 0) total += this.qtdTamanho8 * this.valorAdicional;
        }
        
        this.valorTotal = parseFloat(total.toFixed(2));
        return this.valorTotal;
    }
}

class StorageService {
    LOTES_KEY = 'costura_lotes';
    USER_KEY = 'costura_user';
    SETTINGS_KEY = 'costura_settings';
    
    saveLotes(lotes) {
        try {
            localStorage.setItem(this.LOTES_KEY, JSON.stringify(lotes));
        } catch (e) {
            console.error('Erro ao salvar lotes', e);
        }
    }
    
    loadLotes() {
        try {
            const data = localStorage.getItem(this.LOTES_KEY);
            return data ? JSON.parse(data).map(l => new Lote(l)) : [];
        } catch (e) {
            return [];
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
    
    saveSettings(settings) {
        localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
    }
    
    loadSettings() {
        try {
            const data = localStorage.getItem(this.SETTINGS_KEY);
            return data ? JSON.parse(data) : { metaMensal: 9000 };
        } catch (e) {
            return { metaMensal: 9000 };
        }
    }
}

class App {
    constructor() {
        this.storage = new StorageService();
        this.user = this.storage.loadUser();
        this.settings = this.storage.loadSettings();
        this.lotes = this.storage.loadLotes();
        this.filter = 'este_mes';
        this.currentEditingLote = null;
        
        this.render();
        this.setupServiceWorker();
    }
    
    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }
    
    render() {
        const app = document.getElementById('app');
        // Sempre vai pro main
        if (!this.user) {
            this.user = { name: 'Costureira', date: new Date().toISOString() };
        }
        this.renderMain(app);
    }
    
    renderMain(container) {
        container.innerHTML = `
            <div class="main-screen">
                <div class="header">
                    <div class="header-logo">
                        <img src="icon-192.png" alt="Logo" onerror="this.src='icon-192.png'">
                    </div>
                </div>
                <div class="main-content" id="mainContent"></div>
            </div>
        `;
        
        this.renderDashboard();
    }
    
    renderDashboard() {
        const content = document.getElementById('mainContent');
        const ganhosFiltrado = this.getTotalGanhosFiltrado();
        const meta = this.settings.metaMensal;
        const percentual = Math.round((ganhosFiltrado / meta) * 100);
        const falta = Math.max(0, meta - ganhosFiltrado);
        
        content.innerHTML = `
            ${this.renderMetaCard(ganhosFiltrado, meta, percentual, falta)}
            ${this.renderPerformanceCard()}
            ${this.renderFiltersCard()}
            ${this.renderLotesList()}
            <div style="height: 100px;"></div>
        `;
        
        // Attach event listeners
        this.attachDashboardEvents();
    }
    
    renderMetaCard(ganhos, meta, percentual, falta) {
        return `
            <div class="meta-card">
                <div class="meta-header">
                    <div>
                        <div class="meta-label">META MENSAL</div>
                    </div>
                    <div class="meta-icons">
                        <div class="meta-icon">📊</div>
                        <div class="meta-icon" onclick="app.showMetaModal()">⚙️</div>
                    </div>
                </div>
                <div class="meta-value">R$ ${ganhos.toFixed(2)}</div>
                <div class="meta-info">
                    <span>${percentual}% CONCLUÍDO</span>
                    <span>FALTAM R$ ${falta.toFixed(2)}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${percentual}%"></div>
                </div>
            </div>
        `;
    }
    
    renderPerformanceCard() {
        return `
            <div class="performance-card">
                <div class="performance-title">DESEMPENHO SEMANAL</div>
                <div class="performance-items">
                    <div class="performance-item">
                        <div class="performance-item-label">S1</div>
                        <div class="performance-item-value">R$ 0</div>
                    </div>
                </div>
            </div>
        `;
    }
    
    renderFiltersCard() {
        const filters = ['Em andamento', 'Este mês', 'Mês passado', 'Todos'];
        let html = '<div class="filters">';
        
        filters.forEach(f => {
            const key = f.toLowerCase().replace(/\s/g, '_');
            const active = this.filter === key ? 'active' : '';
            html += `<button class="filter-btn ${active}" onclick="app.setFilter('${key}')">${f}</button>`;
        });
        
        html += '<button class="filter-btn" onclick="app.showReport()">📋 Relatório</button>';
        html += '</div>';
        
        return html;
    }
    
    renderLotesList() {
        const lotes = this.getFilteredLotes();
        
        if (lotes.length === 0) {
            return `
                <div style="text-align: center; padding: 2rem; color: var(--gray-text);">
                    <div style="font-size: 2rem; margin-bottom: 1rem;">📦</div>
                    <div>NENHUM LOTE ENCONTRADO</div>
                    <div style="font-size: 0.875rem; margin-top: 0.5rem;">Ajuste os filtros ou crie um novo.</div>
                </div>
            `;
        }
        
        let html = '<div class="lote-list">';
        lotes.forEach(lote => {
            html += `
                <div class="lote-item" onclick="app.editLote('${lote.id}')">
                    <div class="lote-header">
                        <div class="lote-ref">${lote.referencia}</div>
                        <span class="lote-status ${lote.status}">${lote.status === 'finalizado' ? '✓' : '○'} ${lote.status}</span>
                    </div>
                    <div style="font-size: 0.875rem; color: var(--gray-text);">
                        ${lote.tipo} • R$ ${lote.valorTotal.toFixed(2)}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        
        return html + `
            <div style="position: fixed; bottom: 0; left: 0; right: 0; padding: 1rem; background: var(--white); border-top: 1px solid var(--gray-border); display: flex; gap: 0.75rem;">
                <button class="btn-new-lote" onclick="app.newLote()">➕ NOVO LOTE</button>
                <button class="btn-new-lote" style="background: var(--accent); color: var(--primary);" onclick="app.logout()">SAIR</button>
            </div>
        `;
    }
    
    attachDashboardEvents() {
        // Events attached via onclick handlers
    }
    
    getTotalGanhosFiltrado() {
        const lotes = this.getFilteredLotes().filter(l => l.status === 'finalizado');
        return lotes.reduce((sum, l) => sum + l.valorTotal, 0);
    }
    
    getFilteredLotes() {
        const now = new Date();
        
        return this.lotes.filter(l => {
            if (this.filter === 'em_andamento') {
                return l.status === 'em_andamento';
            }
            
            if (this.filter === 'este_mes') {
                const loteDate = new Date(l.dataFim || l.dataInicio);
                return loteDate.getMonth() === now.getMonth() && 
                       loteDate.getFullYear() === now.getFullYear();
            }
            
            if (this.filter === 'mes_passado') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
                const loteDate = new Date(l.dataFim || l.dataInicio);
                return loteDate.getMonth() === lastMonth.getMonth() && 
                       loteDate.getFullYear() === lastMonth.getFullYear();
            }
            
            return true;
        });
    }
    
    setFilter(filter) {
        this.filter = filter;
        this.renderDashboard();
    }
    
    newLote() {
        this.showTypeSelector();
    }
    
    showTypeSelector() {
        const content = document.getElementById('mainContent');
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <div class="modal-title">NOVO LOTE</div>
                    <button class="modal-close" onclick="app.closeModal()">✕</button>
                </div>
                
                <div class="type-selection">
                    <button class="type-card" onclick="app.selectType('superior')" style="grid-column: 1 / -1;">
                        <div class="type-card-icon">👕</div>
                        <div class="type-card-label">SUPERIOR</div>
                    </button>
                    <button class="type-card" onclick="app.selectType('inferior')">
                        <div class="type-card-icon">👖</div>
                        <div class="type-card-label">INFERIOR</div>
                    </button>
                    <button class="type-card" onclick="app.selectType('conjunto')">
                        <div class="type-card-icon">🧥</div>
                        <div class="type-card-label">CONJUNTO</div>
                    </button>
                </div>
            </div>
        `;
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) app.closeModal();
        });
        
        document.body.appendChild(overlay);
    }
    
    selectType(tipo) {
        this.currentEditingLote = new Lote({ tipo });
        this.showLoteForm();
    }
    
    editLote(id) {
        this.currentEditingLote = this.lotes.find(l => l.id === id);
        if (this.currentEditingLote) {
            this.showLoteForm();
        }
    }
    
    showLoteForm() {
        const lote = this.currentEditingLote;
        
        // Remove overlay anterior se existir
        const oldOverlay = document.querySelector('.modal-overlay');
        if (oldOverlay) oldOverlay.remove();
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <button class="btn-secondary" style="padding: 0.5rem 1rem; background: none; border: none; color: var(--primary); cursor: pointer; font-size: 1.5rem;" onclick="app.closeModal()">←</button>
                    <div class="modal-title">${lote.tipo.toUpperCase()}</div>
                    <button class="modal-close" onclick="app.closeModal()">✕</button>
                </div>
                
                <div id="loteFormContainer"></div>
            </div>
        `;
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) app.closeModal();
        });
        
        document.body.appendChild(overlay);
        
        this.renderLoteFormContent();
    }
    
    closeModal() {
        const overlay = document.querySelector('.modal-overlay');
        if (overlay) overlay.remove();
    }
    
    renderLoteFormContent() {
        const lote = this.currentEditingLote;
        const container = document.getElementById('loteFormContainer');
        
        let html = `
            <form id="loteForm" onsubmit="app.saveLote(event)">
                <!-- REFERÊNCIA -->
                <div class="form-section">
                    <div class="form-section-title">REFERÊNCIA</div>
                    <div class="form-row two-col">
                        <div class="form-field">
                            <label>Número</label>
                            <input type="text" placeholder="0000" value="${lote.referencia}" onchange="this.closest('form').referencia = this.value">
                        </div>
                        <div class="form-field">
                            <label>Letra</label>
                            <input type="text" placeholder="A" value="${lote.letra}" maxlength="1" onchange="this.closest('form').letra = this.value">
                        </div>
                    </div>
                </div>
                
                <!-- TAMANHOS -->
                <div class="form-section">
                    <div class="form-section-title">TAMANHOS</div>
                    <div class="size-buttons" id="sizeButtons">
        `;
        
        [2, 3, 4, 6, 8].forEach(size => {
            const active = lote.tamanhos.includes(size) ? 'active' : '';
            html += `<button type="button" class="size-btn ${active}" onclick="app.toggleSize(${size})">${size}</button>`;
        });
        
        html += `</div></div>`;
        
        // Adicional para tamanho 6/8
        html += `
            <div class="form-section">
                <div class="toggle-container">
                    <div class="toggle-label">
                        <div class="toggle-label-main">ADICIONAL TAM 6/8</div>
                        <div class="toggle-label-sub">Cobrar + R$ 0.20 por peça?</div>
                    </div>
                    <div class="toggle ${lote.cobraAdicional ? 'active' : ''}" onclick="app.toggleAdicional()">
                        <div class="toggle-dot"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Quantidade e Valor
        if (lote.tipo === 'superior') {
            html += `
                <div class="form-section">
                    <div class="qty-value-container">
                        <div class="qty-value-item">
                            <label>QUANTIDADE</label>
                            <input type="number" value="${lote.qtdSuperior}" onchange="app.currentEditingLote.qtdSuperior = parseFloat(this.value); app.updateTotal();">
                        </div>
                        <div class="qty-value-item">
                            <label>VALOR</label>
                            <input type="number" step="0.01" value="${lote.valorSuperior}" placeholder="R$ 0.00" onchange="app.currentEditingLote.valorSuperior = parseFloat(this.value); app.updateTotal();">
                        </div>
                    </div>
                    
                    <div style="margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-field">
                            <label>QTD TAMANHO 6:</label>
                            <input type="number" value="${lote.qtdTamanho6}" onchange="app.currentEditingLote.qtdTamanho6 = parseFloat(this.value); app.updateTotal();">
                        </div>
                        <div class="form-field">
                            <label>QTD TAMANHO 8:</label>
                            <input type="number" value="${lote.qtdTamanho8}" onchange="app.currentEditingLote.qtdTamanho8 = parseFloat(this.value); app.updateTotal();">
                        </div>
                    </div>
                </div>
            `;
        } else if (lote.tipo === 'inferior') {
            html += `
                <div class="form-section">
                    <div class="qty-value-container">
                        <div class="qty-value-item">
                            <label>QUANTIDADE</label>
                            <input type="number" value="${lote.qtdInferior}" onchange="app.currentEditingLote.qtdInferior = parseFloat(this.value); app.updateTotal();">
                        </div>
                        <div class="qty-value-item">
                            <label>VALOR</label>
                            <input type="number" step="0.01" value="${lote.valorInferior}" placeholder="R$ 0.00" onchange="app.currentEditingLote.valorInferior = parseFloat(this.value); app.updateTotal();">
                        </div>
                    </div>
                    
                    <div style="margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-field">
                            <label>QTD TAMANHO 6:</label>
                            <input type="number" value="${lote.qtdTamanho6}" onchange="app.currentEditingLote.qtdTamanho6 = parseFloat(this.value); app.updateTotal();">
                        </div>
                        <div class="form-field">
                            <label>QTD TAMANHO 8:</label>
                            <input type="number" value="${lote.qtdTamanho8}" onchange="app.currentEditingLote.qtdTamanho8 = parseFloat(this.value); app.updateTotal();">
                        </div>
                    </div>
                </div>
            `;
        } else if (lote.tipo === 'conjunto') {
            html += `
                <div class="form-section">
                    <div style="background: var(--gray-light); border-radius: 1rem; padding: 1rem; display: flex; gap: 1rem;">
                        <div style="flex: 1; text-align: center; border-right: 1px solid var(--gray-border); padding-right: 1rem;">
                            <div style="color: var(--primary); font-weight: 700; margin-bottom: 0.75rem;">👕 SUPERIOR</div>
                            <input type="number" value="${lote.qtdSuperior}" placeholder="Qtd" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 2px solid var(--gray-border); border-radius: 0.5rem;" onchange="app.currentEditingLote.qtdSuperior = parseFloat(this.value); app.updateTotal();">
                            <input type="number" step="0.01" value="${lote.valorSuperior}" placeholder="R$ 0.00" style="width: 100%; padding: 0.5rem; border: 2px solid var(--gray-border); border-radius: 0.5rem;" onchange="app.currentEditingLote.valorSuperior = parseFloat(this.value); app.updateTotal();">
                        </div>
                        <div style="flex: 1; text-align: center;">
                            <div style="color: var(--primary); font-weight: 700; margin-bottom: 0.75rem;">👖 INFERIOR</div>
                            <input type="number" value="${lote.qtdInferior}" placeholder="Qtd" style="width: 100%; padding: 0.5rem; margin-bottom: 0.5rem; border: 2px solid var(--gray-border); border-radius: 0.5rem;" onchange="app.currentEditingLote.qtdInferior = parseFloat(this.value); app.updateTotal();">
                            <input type="number" step="0.01" value="${lote.valorInferior}" placeholder="R$ 0.00" style="width: 100%; padding: 0.5rem; border: 2px solid var(--gray-border); border-radius: 0.5rem;" onchange="app.currentEditingLote.valorInferior = parseFloat(this.value); app.updateTotal();">
                        </div>
                    </div>
                    
                    <div style="margin-top: 1rem; display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                        <div class="form-field">
                            <label>QTD TAMANHO 6:</label>
                            <input type="number" value="${lote.qtdTamanho6}" onchange="app.currentEditingLote.qtdTamanho6 = parseFloat(this.value); app.updateTotal();">
                        </div>
                        <div class="form-field">
                            <label>QTD TAMANHO 8:</label>
                            <input type="number" value="${lote.qtdTamanho8}" onchange="app.currentEditingLote.qtdTamanho8 = parseFloat(this.value); app.updateTotal();">
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += `
                <!-- FOTO -->
                <div class="form-section">
                    <div class="form-section-title">FOTO DE REFERÊNCIA</div>
                    <div style="border: 2px dashed var(--gray-border); border-radius: 1rem; padding: 2rem; text-align: center; color: var(--gray-text);">
                        📷 TIRAR FOTO
                    </div>
                </div>
                
                <!-- TOTAL -->
                <div class="form-section">
                    <div class="total-preview" id="totalPreview">
                        <div class="total-preview-label">VALOR TOTAL PREVISTO</div>
                        <div class="total-preview-value">R$ ${lote.valorTotal.toFixed(2)}</div>
                    </div>
                </div>
                
                <!-- DATAS -->
                <div class="form-section">
                    <div style="text-align: center; cursor: pointer; color: var(--primary); font-size: 0.875rem; font-weight: 600;">
                        Ocultar Datas ▲
                    </div>
                    <div class="form-row two-col">
                        <div class="form-field">
                            <label>INÍCIO</label>
                            <input type="text" value="${lote.dataInicio}" placeholder="Hoje">
                        </div>
                        <div class="form-field">
                            <label>FIM</label>
                            <input type="text" value="${lote.dataFim || '--/--'}" placeholder="--/--">
                        </div>
                    </div>
                </div>
                
                <!-- ACTIONS -->
                <div class="modal-actions">
                    <button type="button" class="btn btn-secondary" onclick="window.history.back()">CANCELAR</button>
                    <button type="submit" class="btn btn-primary">✓ SALVAR LOTE</button>
                </div>
            </form>
        `;
        
        container.innerHTML = html;
    }
    
    toggleSize(size) {
        const idx = this.currentEditingLote.tamanhos.indexOf(size);
        if (idx > -1) {
            this.currentEditingLote.tamanhos.splice(idx, 1);
        } else {
            this.currentEditingLote.tamanhos.push(size);
        }
        this.renderLoteFormContent();
    }
    
    toggleAdicional() {
        this.currentEditingLote.cobraAdicional = !this.currentEditingLote.cobraAdicional;
        this.renderLoteFormContent();
    }
    
    updateTotal() {
        this.currentEditingLote.calcularTotal();
        const preview = document.getElementById('totalPreview');
        if (preview) {
            preview.innerHTML = `
                <div class="total-preview-label">VALOR TOTAL PREVISTO</div>
                <div class="total-preview-value">R$ ${this.currentEditingLote.valorTotal.toFixed(2)}</div>
            `;
        }
    }
    
    saveLote(e) {
        e.preventDefault();
        const form = e.target;
        
        this.currentEditingLote.referencia = form.querySelector('input').value;
        this.currentEditingLote.calcularTotal();
        
        const isNew = !this.lotes.find(l => l.id === this.currentEditingLote.id);
        if (isNew) {
            this.lotes.unshift(this.currentEditingLote);
        }
        
        this.storage.saveLotes(this.lotes);
        this.closeModal();
        this.renderDashboard();
    }
    
    showMetaModal() {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal" style="max-height: 300px; margin-top: auto; margin-bottom: auto; width: 80%; margin-left: auto; margin-right: auto; border-radius: 2rem;">
                <div style="text-align: center;">
                    <div class="modal-title">DEFINIR META</div>
                    <input type="number" step="100" value="${this.settings.metaMensal}" style="margin: 1rem 0; width: 80%; padding: 1rem; border: 2px solid var(--gray-border); border-radius: 1rem; font-size: 1.25rem;" id="metaInput">
                    <div class="modal-actions">
                        <button class="btn btn-secondary" onclick="app.closeModal()">CANCELAR</button>
                        <button class="btn btn-primary" onclick="app.saveMeta()">SALVAR</button>
                    </div>
                </div>
            </div>
        `;
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) app.closeModal();
        });
        
        document.body.appendChild(overlay);
    }
    
    saveMeta() {
        const metaInput = document.getElementById('metaInput');
        this.settings.metaMensal = parseFloat(metaInput.value) || 9000;
        this.storage.saveSettings(this.settings);
        this.closeModal();
        this.renderDashboard();
    }
    
    showReport() {
        const today = new Date();
        const monthName = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'][today.getMonth()];
        const dateStr = String(today.getDate()).padStart(2, '0') + '/' + String(today.getMonth() + 1).padStart(2, '0') + '/' + today.getFullYear();
        
        const lotes = this.getFilteredLotes().filter(l => l.status === 'finalizado');
        const total = lotes.reduce((sum, l) => sum + l.valorTotal, 0);
        const qtd = lotes.reduce((sum, l) => sum + (l.qtdSuperior + l.qtdInferior), 0);
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.backgroundColor = 'var(--primary)';
        overlay.innerHTML = `
            <div class="report-screen" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: var(--primary); overflow-y: auto;">
                <div class="report-header">
                    <button class="report-back" onclick="app.closeModal()">← Voltar</button>
                </div>
                
                <div class="report-content">
                    <div class="report-title">GESTÃO COSTURA</div>
                    <div style="text-align: center; margin-bottom: 1rem;">
                        <span style="background: var(--primary); color: var(--white); padding: 0.25rem 0.75rem; border-radius: 0.5rem; font-size: 0.625rem; font-weight: 700;">RELATÓRIO FINANCEIRO</span>
                        <span style="color: var(--accent); font-weight: 700; margin-left: 0.5rem;">${monthName}</span>
                    </div>
                    <div class="report-date">DATA DE EMISSÃO<br>${dateStr}</div>
                    
                    <div class="report-cards">
                        <div class="report-card">
                            <div class="report-card-label">FATURAMENTO TOTAL</div>
                            <div class="report-card-value">R$ ${total.toFixed(2)}</div>
                            <div style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.7;">Líquido</div>
                        </div>
                        <div class="report-card">
                            <div class="report-card-label">PRODUÇÃO TOTAL</div>
                            <div class="report-card-value">${qtd}</div>
                            <div style="font-size: 0.75rem; margin-top: 0.5rem; opacity: 0.7;">peças</div>
                        </div>
                    </div>
                    
                    ${lotes.length === 0 ? `
                        <div style="text-align: center; padding: 2rem; color: var(--gray-text);">
                            NENHUM REGISTRO ENCONTRADO
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
    }
    
    logout() {
        if (confirm('Deseja realmente sair? Seus dados serão mantidos.')) {
            this.user = null;
            this.render();
        }
    }
}

// ===== INIT =====
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();
});
