// js/main.js
import { firebaseService } from './firebaseService.js';
import { dataParser } from './dataParser.js';
import { statsEngine } from './statsEngine.js';
import { uiManager } from './uiManager.js';

export const app = {
    currentTab: 'dashboard', currentSort: 'totalAssets',
    leagues: [], currentLeagueId: null, currentLeagueData: null, allTransfers: [],
    unsubscribeLeague: null, // Listener para la info de la liga
    unsubscribeTransfers: null, // Listener para los fichajes

    // --- Inicialización ---
    async init() {
        uiManager.init();
        this.setupEventListeners();
        uiManager.elements.loader.innerHTML = '<p>Conectando...</p>';
        if (firebaseService.init()) {
            firebaseService.authenticate(() => this.loadInitialData());
        }
    },

    async loadInitialData() {
        uiManager.showLoader(true);
        this.leagues = await firebaseService.getAllLeagues();
        uiManager.renderLeagueSelector(this.leagues, this.currentLeagueId);
        let leagueToLoad = localStorage.getItem('selectedLeagueId') || (this.leagues[0]?.id);
        if (leagueToLoad && this.leagues.some(l => l.id === leagueToLoad)) {
            await this.switchLeague(leagueToLoad);
        } else {
            uiManager.showLoader(false);
            uiManager.elements.tabContent.innerHTML = `<p class="text-center p-8">Bienvenido. Por favor, crea una liga usando el botón "Gestionar Ligas".</p>`;
            this.updateHeaderButtonsState(false);
        }
    },
    
    async switchLeague(leagueId) {
        if (!leagueId) { this.updateHeaderButtonsState(false); return; }
        
        uiManager.showLoader(true);
        this.currentLeagueId = leagueId;
        localStorage.setItem('selectedLeagueId', leagueId);
        uiManager.renderLeagueSelector(this.leagues, leagueId);
        this.updateHeaderButtonsState(true);

        // Anular suscripciones anteriores para evitar fugas de memoria
        if (this.unsubscribeLeague) this.unsubscribeLeague();
        if (this.unsubscribeTransfers) this.unsubscribeTransfers();

        // 1. Establecer listener para el documento de la LIGA
        this.unsubscribeLeague = firebaseService.listenToLeagueData(leagueId, (leagueData) => {
            if (leagueData) {
                this.currentLeagueData = leagueData;
                this.processAndRender(); // Re-renderizar con los datos actualizados de la liga
            } else {
                // La liga fue eliminada, recargar todo
                this.loadInitialData();
            }
        });

        // 2. Establecer listener para la sub-colección de FICHAJES
        this.unsubscribeTransfers = firebaseService.listenToTransfers(leagueId, transfers => {
            this.allTransfers = transfers;
            this.processAndRender(); // Re-renderizar con los fichajes actualizados
        });
    },

    processAndRender() {
        // Chequeo de seguridad: No renderizar si no tenemos los datos básicos de la liga
        if (!this.currentLeagueId || !this.currentLeagueData) {
            uiManager.showLoader(false);
            return;
        }
        const stats = statsEngine.calculate(this.allTransfers, this.currentLeagueData);
        if (stats) {
            uiManager.renderContent(stats, this.allTransfers, this.currentLeagueData, this.currentTab, this.currentSort);
        }
        uiManager.showLoader(false);
    },


    
    // --- Manejo de Eventos ---
    setupEventListeners() {
        // CORRECCIÓN: ID del botón de Añadir Fichajes
        document.getElementById('addTransfersBtn').addEventListener('click', () => this.showConverterModal());
        // El resto de los listeners directos
        uiManager.elements.leagueSelector.addEventListener('change', (e) => this.switchLeague(e.target.value));
        document.getElementById('manageLeaguesBtn').addEventListener('click', () => this.showManageLeaguesModal());
        document.getElementById('assignManagersBtn').addEventListener('click', () => this.showAssignManagersModal());

        document.body.addEventListener('click', e => {
            const target = e.target;
            // Unificado: manejar clics en pestañas
            const tab = target.closest('.tab');
            if (tab) {
                this.currentTab = tab.dataset.tab;
                this.processAndRender();
                return;
            }

            const action = target.dataset.action || target.closest('[data-action]')?.dataset.action;

            const sortButton = target.closest('.sort-btn');
            if (sortButton) {
                this.currentSort = sortButton.dataset.sort;
                this.processAndRender();
                return;
            }

            const managerCard = target.closest('.manager-card');
            if(managerCard) { this.showManagerDetails(managerCard.dataset.managerName); return; }

            if (!action) return;

            const actions = {
                'closeModal': () => target.closest('.modal-backdrop').classList.add('hidden'),
                'addNewLeague': () => this.handleAddNewLeague(),
                'openImportLeagueModal': () => this.showImportLeagueModal(),
                'importLeague': () => this.handleImportLeague(),
                'deleteLeague': () => this.handleDeleteLeague(target.dataset.leagueId, target.dataset.leagueName),
                'confirmDelete': () => this.confirmDeleteLeague(target.dataset.leagueId),
                'saveManagers': () => this.saveManagerAssignments(),
                'convertToJson': () => this.convertTransfersToJSON(),
                'saveJson': () => this.saveTransfers(),
            };
            if (actions[action]) actions[action]();
        });
    },

    updateHeaderButtonsState(isEnabled) {
        document.getElementById('assignManagersBtn').disabled = !isEnabled;
        document.getElementById('addTransfersBtn').disabled = !isEnabled;
    },
    
    // --- Lógica de Acciones ---
    async handleAddNewLeague() {
        const input = document.getElementById('newLeagueNameInput');
        const newName = input.value.trim();
        if (newName) {
            const newId = await firebaseService.createNewLeague(newName);
            this.leagues.push({ id: newId, name: newName, teams: [], managersByTeam: {} });
            input.value = '';
            uiManager.showStatusMessage(`Liga "${newName}" creada.`, 'success');
            await this.switchLeague(newId);
            this.showManageLeaguesModal();
        }
    },
    
    handleDeleteLeague(leagueId, leagueName) {
        uiManager.elements.confirmDeleteModal.innerHTML = `<div class="card w-11/12 max-w-md mx-auto p-6 text-center"><h2 class="text-xl font-bold mb-4">Confirmar Eliminación</h2><p class="text-gray-600 mb-6">¿Seguro que quieres eliminar la liga "<strong class="text-red-600">${leagueName}</strong>"? Esta acción es irreversible.</p><div class="flex justify-center gap-4"><button data-action="closeModal" class="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg">Cancelar</button><button data-action="confirmDelete" data-league-id="${leagueId}" class="bg-red-600 text-white px-6 py-2 rounded-lg">Sí, Eliminar</button></div></div>`;
        uiManager.elements.confirmDeleteModal.classList.remove('hidden');
    },

    async confirmDeleteLeague(leagueId) {
        await firebaseService.deleteLeague(leagueId);
        uiManager.elements.confirmDeleteModal.classList.add('hidden');
        uiManager.showStatusMessage('Liga eliminada.', 'success');
        if (this.currentLeagueId === leagueId) { localStorage.removeItem('selectedLeagueId'); this.currentLeagueId = null; }
        await this.loadInitialData();
    },

    async handleImportLeague() {
        if (!this.currentLeagueId) { uiManager.showStatusMessage('Debes seleccionar o crear una liga antes de importar.', 'error'); return; }
        const text = document.getElementById('leagueTemplateInput').value;
        const { teams, type } = dataParser.parseLeagueTemplate(text);
        if (teams.length > 0) {
            this.currentLeagueData.teams = teams;
            this.currentLeagueData.type = type;
            this.currentLeagueData.managersByTeam = {}; 
            await firebaseService.saveLeagueSetup(this.currentLeagueId, this.currentLeagueData);
            uiManager.showStatusMessage(`${teams.length} equipos importados.`, 'success');
            uiManager.elements.importLeagueModal.classList.add('hidden');
            this.processAndRender();
        } else { uiManager.showStatusMessage('No se pudo importar. Formato incorrecto.', 'error'); }
    },

    async saveManagerAssignments() {
        if (!this.currentLeagueData) return;
        const managersByTeam = {};
        let allTeams = [...this.currentLeagueData.teams];
        document.querySelectorAll('.manager-row').forEach(row => {
            const teamName = row.dataset.teamName;
            const managerName = row.querySelector('.manager-name-input').value.trim();
            const currentValue = parseFloat(row.querySelector('.current-value-input').value) || 0;
            if (managerName) managersByTeam[teamName] = managerName;
            const teamIndex = allTeams.findIndex(t => t.name === teamName);
            if (teamIndex > -1) allTeams[teamIndex].currentValue = currentValue;
        });
        this.currentLeagueData.managersByTeam = managersByTeam;
        this.currentLeagueData.teams = allTeams;
        await firebaseService.saveLeagueSetup(this.currentLeagueId, this.currentLeagueData);
        uiManager.showStatusMessage('Mánagers guardados.', 'success');
        uiManager.elements.assignManagersModal.classList.add('hidden');
        this.processAndRender();
    },

    async convertTransfersToJSON() {
        const rawText = document.getElementById('rawTextInput').value;
        const { transfers, managersByTeam } = dataParser.convertToJSON(rawText);
        const parsedTransfers = JSON.parse(transfers);
        
        document.getElementById('jsonOutputArea').value = transfers;

        // Si se encontraron nuevos mánagers, se actualiza la configuración de la liga INMEDIATAMENTE.
        if (Object.keys(managersByTeam).length > 0) {
            const updatedManagers = { ...this.currentLeagueData.managersByTeam, ...managersByTeam };
            this.currentLeagueData.managersByTeam = updatedManagers; // Actualiza el estado local
            await firebaseService.saveLeagueSetup(this.currentLeagueId, { managersByTeam: updatedManagers }); // Guarda en Firebase
            uiManager.showStatusMessage("Asociaciones de mánagers actualizadas.", "success");
        }

        if (parsedTransfers.length > 0) {
            uiManager.showStatusMessage(`${parsedTransfers.length} operaciones listas para guardar.`, "success");
        } else {
            uiManager.showStatusMessage("No se encontraron fichajes válidos en el texto.", "error");
        }
    },

    async saveLeagueSetup() {
        const newLeagueData = { managerInitialValues: {}, managersByTeam: {}, managerCurrentValues: {} };
        document.getElementById('leagueSetupForm').querySelectorAll('.manager-row').forEach(row => {
            const managerName = row.querySelector('.manager-name-input').value.trim();
            const teamName = row.dataset.teamName;
            if (managerName) {
                newLeagueData.managersByTeam[teamName] = managerName;
                newLeagueData.managerInitialValues[managerName] = parseFloat(row.dataset.value);
                newLeagueData.managerCurrentValues[managerName] = parseFloat(row.querySelector('.current-value-input').value) || 0;
            }
        });
        await firebaseService.saveLeagueSetup(newLeagueData);
        uiManager.showStatusMessage("Configuración guardada", "success");
        uiManager.elements.leagueSetupModal.classList.add('hidden');
        this.leagueData = await firebaseService.getLeagueData();
        this.processAndRender();
    },

    async saveTransfers() {
        if (!this.currentLeagueId) { uiManager.showStatusMessage('No hay una liga activa para guardar los fichajes.', 'error'); return; }
        try {
            const jsonArea = document.getElementById('jsonOutputArea');
            const transfers = JSON.parse(jsonArea.value);
            if (transfers.length === 0) {
                uiManager.showStatusMessage("No hay fichajes en el área de JSON para guardar.", "error");
                return;
            }
            
            await firebaseService.saveTransfers(this.currentLeagueId, transfers);
            
            jsonArea.value = ''; 
            document.getElementById('rawTextInput').value = '';
            uiManager.elements.converterModal.classList.add('hidden');
            uiManager.showStatusMessage(`${transfers.length} operaciones guardadas con éxito.`, 'success');
        } catch (e) { 
            uiManager.showStatusMessage(`Error al guardar: ${e.message}`, "error"); 
            console.error(e);
        }
    },

    async resetLeague() {
        await firebaseService.resetLeague();
        uiManager.showStatusMessage("Liga reseteada", "success");
        uiManager.elements.confirmResetModal.classList.add('hidden');
        this.leagueData = {};
    },

    showConverterModal() {
        if (!this.currentLeagueId) { uiManager.showStatusMessage('Selecciona una liga para añadir fichajes.', 'error'); return; }
        uiManager.elements.converterModal.innerHTML = `<div class="card w-11/12 max-w-4xl mx-auto p-6 relative">
            <button data-action="closeModal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800 font-bold text-2xl">&times;</button>
            <h2 class="text-xl font-bold mb-4">Conversor de Fichajes</h2>
            <p class="text-sm text-gray-600 mb-4">Pega el texto de los fichajes del foro para convertirlos a JSON.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 h-72">
                <div class="flex flex-col"><label for="rawTextInput" class="block text-sm font-medium text-gray-700 mb-1">Texto Original</label><textarea id="rawTextInput" class="w-full flex-grow p-2 border rounded font-mono text-xs"></textarea></div>
                <div class="flex flex-col"><label for="jsonOutputArea" class="block text-sm font-medium text-gray-700 mb-1">Resultado JSON</label><textarea id="jsonOutputArea" class="w-full flex-grow p-2 border rounded bg-gray-50 font-mono text-xs" readonly></textarea></div>
            </div>
            <div class="mt-6 flex justify-between items-center">
                <button data-action="convertToJson" class="bg-blue-600 text-white px-6 py-2 rounded-lg shadow hover:bg-blue-700">Convertir a JSON</button>
                <button data-action="saveJson" class="bg-green-600 text-white px-6 py-2 rounded-lg shadow hover:bg-green-700">Guardar Fichajes</button>
            </div>
        </div>`;
        uiManager.elements.converterModal.classList.remove('hidden');
    },


    async showLeagueSetupModal() {
        const managersByTeam = this.leagueData.managersByTeam || {}; const managerCurrentValues = this.leagueData.managerCurrentValues || {};
        const rowsHTML = config.friendlyBattleTemplate.map(team => {
            const managerName = managersByTeam[team.teamName] || ''; const currentValue = managerCurrentValues[managerName] || '';
            return `<div class="grid grid-cols-3 gap-3 items-center manager-row" data-team-name="${team.teamName}" data-value="${team.value}"><label class="text-sm font-medium">${team.teamName} (${team.value}M)</label><input type="text" class="manager-name-input p-2 border rounded" placeholder="Nombre Mánager" value="${managerName}"><input type="number" step="0.1" class="current-value-input p-2 border rounded" placeholder="Valor Actual" value="${currentValue}"></div>`;
        }).join('');
        uiManager.elements.leagueSetupModal.innerHTML = `<div class="card w-11/12 max-w-3xl mx-auto p-6 relative"><button id="closeLeagueSetupModalBtn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button><h2 class="text-xl font-bold mb-2">Configuración de Liga</h2><p class="text-sm text-gray-600 mb-4">Asigna mánagers e introduce el valor actual de sus equipos.</p><div class="grid grid-cols-3 gap-3 items-center mb-2 px-2 text-sm font-medium text-gray-500"><span>Equipo (Valor Inicial)</span><span>Nombre Mánager</span><span>Valor Actual (M)</span></div><div id="leagueSetupForm" class="space-y-3 max-h-80 overflow-y-auto pr-2">${rowsHTML}</div><div class="mt-6 flex justify-end"><button id="saveLeagueSetupBtn" class="bg-blue-600 text-white px-6 py-2 rounded-lg shadow">Guardar</button></div></div>`;
        uiManager.elements.leagueSetupModal.classList.remove('hidden');
    },

    showConfirmResetModal() {
        uiManager.elements.confirmResetModal.innerHTML = `<div class="card w-11/12 max-w-md mx-auto p-6 relative text-center"><h2 class="text-xl font-bold mb-4">¿Estás seguro?</h2><p class="text-gray-600 mb-6">Esta acción eliminará <strong class="text-red-600">TODOS</strong> los datos de la liga. No se puede deshacer.</p><div class="flex justify-center gap-4"><button id="cancelResetBtn" class="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg hover:bg-gray-400">Cancelar</button><button id="confirmResetBtn" class="bg-red-600 text-white px-6 py-2 rounded-lg shadow hover:bg-red-700">Sí, Resetear</button></div></div>`;
        uiManager.elements.confirmResetModal.classList.remove('hidden');
    },

    showManagerDetails(managerName) {
        const stats = statsEngine.calculate(this.allTransfers, this.leagueData);
        const details = statsEngine.getManagerDetails(managerName, stats.managerList);
        if (!details) return;
        const { manager, biggestPurchase, bestSales, worstSales, immediateSales, immediateSalesValue } = details;
        if (uiManager.chartInstance) uiManager.chartInstance.destroy();
        const cashFlow = manager.transfers.reduce((acc, t) => {
            const lastCash = acc.length > 0 ? acc[acc.length - 1].cash : 0; const change = t.transactionType === 'sale' ? t.finalPrice : -t.finalPrice;
            acc.push({ date: (t.createdAt || new Date()).toLocaleDateString(), cash: lastCash + change }); return acc; }, []);
        uiManager.elements.managerDetailModal.innerHTML = `<div class="card w-11/12 max-w-4xl mx-auto p-6 relative"><button id="closeManagerDetailModalBtn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button><h2 class="text-2xl font-bold mb-4">${manager.name} - Informe Detallado</h2><div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-center mb-6"><div class="p-4 bg-gray-100 rounded-lg"><div class="text-xs">Sobreprecio Compra</div><div class="text-2xl font-bold text-red-600">${manager.avgPremium.toFixed(1)}%</div></div><div class="p-4 bg-gray-100 rounded-lg"><div class="text-xs">Beneficio Venta</div><div class="text-2xl font-bold text-green-600">${manager.avgProfit.toFixed(1)}%</div></div><div class="p-4 bg-gray-100 rounded-lg"><div class="text-xs">Ventas Inmediatas</div><div class="text-2xl font-bold">${immediateSales} (${immediateSalesValue.toFixed(1)}M)</div></div></div><div class="mb-6"><h4 class="font-semibold mb-2 text-center">Evolución de Caja</h4><canvas id="managerHistoryChart"></canvas></div><div class="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm"><div><h4 class="font-semibold mb-2">Compra más Cara</h4>${biggestPurchase ? `<div>${biggestPurchase.playerName} - <span class="font-bold text-red-600">${biggestPurchase.finalPrice.toFixed(1)}M</span></div>` : '<span>N/A</span>'}</div><div><h4 class="font-semibold mb-2">Top 3 Mejores Ventas (% Beneficio)</h4><ul class="space-y-1">${bestSales.length ? bestSales.map(s => `<li>${s.playerName} <span class="font-semibold text-green-600">(+${s.profitPercent.toFixed(0)}%)</span></li>`).join('') : '<li>N/A</li>'}</ul></div><div><h4 class="font-semibold mb-2">Top 3 Peores Ventas (% Beneficio)</h4><ul class="space-y-1">${worstSales.length ? worstSales.map(s => `<li>${s.playerName} <span class="font-semibold ${s.profitPercent >= 0 ? 'text-green-600' : 'text-red-600'}">(${s.profitPercent.toFixed(0)}%)</span></li>`).join('') : '<li>N/A</li>'}</ul></div></div></div>`;
        uiManager.elements.managerDetailModal.classList.remove('hidden');
        const ctx = document.getElementById('managerHistoryChart').getContext('2d');
        uiManager.chartInstance = new Chart(ctx, { type: 'line', data: { labels: cashFlow.map(d => d.date), datasets: [{ label: 'Caja Estimada (M)', data: cashFlow.map(d => d.cash), borderColor: '#3b82f6', tension: 0.1 }] } });
    },

    showManageLeaguesModal() {
        const listHTML = this.leagues.map(l => `<li class="flex justify-between items-center p-2 border-b">${l.name}<button data-action="deleteLeague" data-league-id="${l.id}" data-league-name="${l.name}" class="text-red-500 hover:text-red-700 text-xs">Eliminar</button></li>`).join('');
        const isImportDisabled = !this.currentLeagueId;
        uiManager.elements.manageLeaguesModal.innerHTML = `<div class="card w-11/12 max-w-lg mx-auto p-6 relative">
            <button data-action="closeModal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
            <h2 class="text-xl font-bold mb-4">Gestionar Ligas</h2>
            <div class="mb-4"><h3>Ligas Existentes</h3><ul class="max-h-48 overflow-y-auto">${listHTML || '<li>No hay ligas.</li>'}</ul></div>
            <div class="border-t pt-4">
                <h3 class="mb-2">Añadir Nueva Liga</h3>
                <div class="flex gap-2"><input id="newLeagueNameInput" type="text" placeholder="Nombre de la nueva liga" class="flex-grow p-2 border rounded"><button data-action="addNewLeague" class="bg-blue-600 text-white px-4 rounded">Añadir</button></div>
                <button data-action="openImportLeagueModal" class="w-full bg-green-600 text-white mt-4 py-2 rounded" ${isImportDisabled ? 'disabled title="Crea o selecciona una liga primero"' : ''}>Importar Plantilla para Liga Actual</button>
            </div>
        </div>`;
        uiManager.elements.manageLeaguesModal.classList.remove('hidden');
    },

    showImportLeagueModal() {
        uiManager.elements.importLeagueModal.innerHTML = `<div class="card w-11/12 max-w-2xl mx-auto p-6"><button data-action="closeModal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800">&times;</button><h2 class="text-xl font-bold mb-2">Importar Plantilla de Liga</h2><p class="text-sm text-gray-600 mb-4">Pega la plantilla de equipos. Formato: <code>Nombre Alias Pos Valor Caja</code>.</p><textarea id="leagueTemplateInput" class="w-full h-64 p-2 border rounded font-mono text-xs"></textarea><div class="text-right mt-4"><button data-action="importLeague" class="bg-green-600 text-white px-6 py-2 rounded">Importar</button></div></div>`;
        uiManager.elements.importLeagueModal.classList.remove('hidden');
    },


    showAssignManagersModal() {
        if (!this.currentLeagueData || !this.currentLeagueData.teams || this.currentLeagueData.teams.length === 0) {
            uiManager.showStatusMessage('Importa una plantilla de equipos para esta liga primero.', 'error');
            return;
        }

        // CORRECCIÓN 1: Se usa el `team.name` real y los valores guardados.
        const rows = this.currentLeagueData.teams.map(team => {
            const managerName = this.currentLeagueData.managersByTeam[team.name] || '';
            const currentValue = team.currentValue || ''; // `team.currentValue` en lugar de un valor estático
            return `
                <div class="grid grid-cols-3 gap-3 items-center manager-row" data-team-name="${team.name}">
                    <label class="text-sm font-medium truncate" title="${team.name}">${team.name}</label>
                    <input type="text" class="manager-name-input p-2 border rounded" placeholder="Nombre Mánager" value="${managerName}">
                    <input type="number" step="0.1" class="current-value-input p-2 border rounded" placeholder="Valor Actual" value="${currentValue}">
                </div>`;
        }).join('');
        
        uiManager.elements.assignManagersModal.innerHTML = `
            <div class="card w-11/12 max-w-3xl mx-auto p-6 relative">
                <!-- CORRECCIÓN 2: Botón de cerrar añadido -->
                <button data-action="closeModal" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800 text-2xl font-bold">&times;</button>
                <h2 class="text-xl font-bold mb-2">Asignar Mánagers y Valores</h2>
                <div class="grid grid-cols-3 gap-3 mb-2 px-2 text-sm font-bold text-gray-500">
                    <span>Equipo</span>
                    <span>Mánager</span>
                    <span>Valor Actual (M)</span>
                </div>
                <div class="space-y-3 max-h-80 overflow-y-auto pr-2">${rows}</div>
                <div class="mt-6 flex justify-end">
                    <button data-action="saveManagers" class="bg-blue-600 text-white px-6 py-2 rounded">Guardar</button>
                </div>
            </div>`;
        uiManager.elements.assignManagersModal.classList.remove('hidden');
    },



    showMyTeamModal(recommendations) {
        const recHTML = recommendations.length ? recommendations.map(p => `<tr class="tier-${p.playerTier.toLowerCase()}"><td class="px-4 py-3"><div>${p.name} (${p.pos}, ${p.ovr})</div><div class="text-xs font-semibold text-gray-500">${p.playerTier}</div></td><td class="px-4 py-3 text-center" title="Tendencia del mercado para este tipo de jugador en los últimos 7 días.">${p.trend}</td><td class="px-4 py-3 text-center font-bold">${p.liquidity}</td><td class="px-4 py-3">${p.value.toFixed(1)}M</td><td class="px-4 py-3 font-semibold text-green-600">${p.cautiousPrice.toFixed(1)}M</td><td class="px-4 py-3 font-bold text-blue-600">${p.optimalPrice.toFixed(1)}M</td></tr>`).join('') : '<tr><td colspan="6" class="text-center p-4 text-gray-500">No hay datos para mostrar. Pega tu plantilla y analiza.</td></tr>';
        const teamInputText = document.getElementById('myTeamInput')?.value || '';
        uiManager.elements.myTeamModal.innerHTML = `<div class="card w-11/12 max-w-6xl mx-auto p-6 relative"><style>.tier-estrella { background-color: #fffbeb; } .tier-calidad { background-color: #f0f9ff; }</style><button id="closeMyTeamModalBtn" class="absolute top-4 right-4 text-gray-500 hover:text-gray-800 font-bold text-2xl">&times;</button><h2 class="text-2xl font-bold mb-2 text-gray-800">Análisis de Venta Avanzado</h2><div class="text-sm text-gray-600 mb-4 grid grid-cols-1 md:grid-cols-2 gap-x-4"><p><span class="font-semibold text-gray-800">Tendencia:</span> 🔥 Mercado al alza, ❄️ Mercado a la baja, ➡️ Estable.</p><p><span class="font-semibold text-gray-800">Liquidez:</span> Nº de ventas de jugadores similares. Mide la demanda.</p><p><span class="font-semibold text-green-600">Precio Cauteloso:</span> Precio para una venta con alta probabilidad y rapidez.</p><p><span class="font-semibold text-blue-600">Precio Óptimo:</span> Precio ambicioso para maximizar beneficio a medio plazo.</p></div><textarea id="myTeamInputModal" class="w-full h-40 p-3 border rounded-lg font-mono text-xs" placeholder="Pega aquí la plantilla...">${teamInputText}</textarea><div class="text-right mt-4 mb-6"><button id="analyzeMyTeamBtnModal" class="bg-green-600 text-white px-6 py-2 rounded-lg shadow">Volver a Analizar</button></div><div id="myTeamRecommendations"><div class="card overflow-x-auto"><table class="min-w-full text-sm"><thead class="bg-gray-50"><tr><th class="px-4 py-2 text-left">Jugador (Tier)</th><th class="px-4 py-2 text-center" title="Momento del Mercado (últimos 7 días)">Tend.</th><th class="px-4 py-2 text-center" title="Número de ventas de jugadores similares.">Liquidez</th><th class="px-4 py-2 text-left">Valor Actual</th><th class="px-4 py-2 text-left">P. Cauteloso</th><th class="px-4 py-2 text-left">P. Óptimo</th></tr></thead><tbody class="bg-white divide-y">${recHTML}</tbody></table></div></div></div>`;
        uiManager.elements.myTeamModal.classList.remove('hidden');
    }
};

app.init();