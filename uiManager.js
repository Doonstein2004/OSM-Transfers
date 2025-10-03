// js/uiManager.js
import { app } from "./main.js";

export const uiManager = {
    elements: {},
    chartInstance: null,

    init() {
        this.elements = {
            loader: document.getElementById('loader'),
            mainContent: document.getElementById('mainContent'),
            tabContent: document.getElementById('tab-content'),
            leagueSelector: document.getElementById('leagueSelector'),
            // Modals
            manageLeaguesModal: document.getElementById('manageLeaguesModal'),
            importLeagueModal: document.getElementById('importLeagueModal'),
            assignManagersModal: document.getElementById('assignManagersModal'),
            converterModal: document.getElementById('converterModal'),
            managerDetailModal: document.getElementById('managerDetailModal'),
            confirmDeleteModal: document.getElementById('confirmDeleteModal'),
            statusMessage: document.getElementById('statusMessage'),
        };
    },

    showLoader(show) { this.elements.loader.classList.toggle('hidden', !show); this.elements.mainContent.classList.toggle('hidden', show); },
    showError(message) { this.showLoader(false); this.elements.mainContent.classList.add('hidden'); this.elements.loader.innerHTML = `<div class="p-4 bg-red-100 border-l-4 border-red-500 text-red-700 max-w-2xl mx-auto"><h3 class="font-bold">Error</h3><p>${message}</p></div>`; },
    showStatusMessage(message, type = "success") {
        const el = this.elements.statusMessage;
        el.innerHTML = `<p class="py-2 px-5 rounded-lg shadow-xl ${type === 'success' ? 'bg-green-500' : 'bg-red-500'} text-white">${message}</p>`;
        el.classList.remove('opacity-0'); setTimeout(() => { el.classList.add('opacity-0'); }, 3000);
    },
    setActiveTab(tabName) { document.querySelectorAll('.tab').forEach(tab => tab.classList.toggle('tab-active', tab.dataset.tab === tabName)); },
    updateSortButtons(currentSort) {
        document.querySelectorAll('.sort-btn').forEach(btn => {
            btn.classList.toggle('sort-btn-active', btn.dataset.sort === currentSort);
        });
    },

    renderContent(stats, transfers, leagueData, currentTab, currentSort) {
        this.setActiveTab(currentTab);
        const content = this.elements.tabContent;

        if (currentTab === 'dashboard') content.innerHTML = this.getDashboardHTML(stats, leagueData);
        else if (currentTab === 'rivalries') content.innerHTML = this.getRivalriesHTML(stats, leagueData);
        else if (currentTab === 'ranking') content.innerHTML = this.getRankingHTML(stats.managerList, leagueData, currentSort); // LLAMADA AÑADIDA
        else if (currentTab === 'evolution') content.innerHTML = this.getEvolutionHTML(stats);
        else if (currentTab === 'history') content.innerHTML = this.getHistoryHTML(transfers);
        
        // El sort se aplica solo en la pestaña ranking
        if (currentTab === 'ranking') this.updateSortButtons(currentSort);
    },

    getRankingHTML(managerList, leagueData, currentSort) {
        const managersByTeam = leagueData?.managersByTeam || {};
        const teamByManager = Object.fromEntries(Object.entries(managersByTeam).map(([team, name]) => [name, team]));
        const sortFunctions = { totalAssets: (a, b) => b.totalAssets - a.totalAssets, spent: (a, b) => b.spent - a.spent, income: (a, b) => b.income - a.income, count: (a, b) => b.count - a.count };
        
        const listHTML = [...managerList].sort(sortFunctions[currentSort]).map(m => {
            const teamName = teamByManager[m.name] || '';
            const teamClass = teamName.includes('Blue') ? 'team-blue-bg' : teamName.includes('Red') ? 'team-red-bg' : 'team-neutral-bg';
            return `
            <div class="card p-4 manager-card ${teamClass}" data-manager-name="${m.name}">
                <h3 class="font-bold text-lg">${m.name}</h3>
                <div class="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-center text-sm">
                    <div><p class="text-xs">Activos Totales</p><p class="font-semibold text-blue-600">${m.totalAssets.toFixed(1)}M</p></div>
                    <div><p class="text-xs">Caja Estimada</p><p class="font-semibold ${m.cash >= 0 ? 'text-green-600' : 'text-red-600'}">${m.cash.toFixed(1)}M</p></div>
                    <div><p class="text-xs">Gasto</p><p class="font-semibold text-red-600">${m.spent.toFixed(1)}M</p></div>
                    <div><p class="text-xs">Ingresos</p><p class="font-semibold text-green-600">${m.income.toFixed(1)}M</p></div>
                    <div class="col-span-2 md:col-span-1"><p class="text-xs">Operaciones</p><p class="font-semibold">${m.count}</p></div>
                </div>
            </div>`;
        }).join('');
        
        return `
            <h2 class="text-2xl font-bold mb-4 text-gray-800">Ranking de Mánagers</h2>
            <p class="text-sm text-gray-500 mb-4">Clasificación general de los mánagers de la liga. Haz clic en un mánager para ver sus detalles.</p>
            <div class="flex flex-wrap gap-2 mb-4 bg-gray-200 p-1 rounded-lg">
                <button class="sort-btn flex-1 px-3 py-1.5 rounded-md text-sm" data-sort="totalAssets">Activos Totales</button>
                <button class="sort-btn flex-1 px-3 py-1.5 rounded-md text-sm" data-sort="spent">Gasto</button>
                <button class="sort-btn flex-1 px-3 py-1.5 rounded-md text-sm" data-sort="income">Ingresos</button>
                <button class="sort-btn flex-1 px-3 py-1.5 rounded-md text-sm" data-sort="count">Operaciones</button>
            </div>
            <div class="space-y-4">${listHTML}</div>`;
    },


    getEvolutionHTML(stats) {
        if (!stats.historicalData || Object.keys(stats.historicalData).length === 0) {
            return '<p class="text-center text-gray-500 mt-8">No hay suficientes datos de jornadas para mostrar la evolución.</p>';
        }
        
        const { totalDays, preseasonRounds } = stats;
        const lastDay = totalDays;

        return `
            <h2 class="text-2xl font-bold mb-4 text-gray-800">Evolución de Activos Totales</h2>
            <div class="card p-4 md:p-6 mb-6">
                <canvas id="evolutionChart"></canvas>
            </div>

            <h2 class="text-2xl font-bold mb-4 text-gray-800">Clasificación por Jornada</h2>
            <div class="card p-4 md:p-6">
                <div class="flex items-center gap-4 mb-4">
                    <label for="roundSlider" class="font-semibold">Seleccionar Jornada:</label>
                    <input type="range" id="roundSlider" min="1" max="${totalDays}" value="${lastDay}" class="w-full">
                    <span id="roundLabel" class="font-bold text-lg text-blue-600 w-32 text-center"></span>
                </div>
                <div id="evolutionTableContainer" class="overflow-x-auto">
                    <!-- La tabla se renderizará aquí vía JavaScript -->
                </div>
            </div>
        `;
    },

    renderEvolutionTable(day, stats) {
        const { historicalData, preseasonRounds } = stats;
        const roundLabel = document.getElementById('roundLabel');
        const tableContainer = document.getElementById('evolutionTableContainer');

        const gameRound = (day <= preseasonRounds) ? `Pretemporada ${day}` : `Jornada ${day - preseasonRounds}`;
        if(roundLabel) roundLabel.textContent = gameRound;
        
        const dayData = historicalData[day];
        if (!dayData) { tableContainer.innerHTML = 'No hay datos.'; return; }

        // Ordenar por activos totales para crear el ranking
        const rankedData = [...dayData].sort((a, b) => b.totalAssets - a.totalAssets);

        const tableRows = rankedData.map((manager, index) => `
            <tr class="border-b">
                <td class="p-3 font-bold">${index + 1}</td>
                <td class="p-3">${manager.name}</td>
                <td class="p-3 text-right">${manager.currentValue.toFixed(1)}M</td>
                <td class="p-3 text-right font-semibold ${manager.cash >= 0 ? 'text-green-600' : 'text-red-600'}">${manager.cash.toFixed(1)}M</td>
                <td class="p-3 text-right font-bold text-blue-600">${manager.totalAssets.toFixed(1)}M</td>
            </tr>
        `).join('');

        tableContainer.innerHTML = `
            <table class="min-w-full text-sm">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="p-3 text-left">Pos</th>
                        <th class="p-3 text-left">Mánager</th>
                        <th class="p-3 text-right">Valor Equipo</th>
                        <th class="p-3 text-right">Caja</th>
                        <th class="p-3 text-right">Activos Totales</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        `;
    },

    // --- NUEVA FUNCIÓN PARA RENDERIZAR EL GRÁFICO ---
    renderEvolutionChart(stats) {
        const { historicalData, managerList, totalDays, preseasonRounds } = stats;
        const ctx = document.getElementById('evolutionChart')?.getContext('2d');
        if (!ctx) return;
        
        if (this.chartInstance) this.chartInstance.destroy();

        const labels = Array.from({ length: totalDays }, (_, i) => {
            const day = i + 1;
            return (day <= preseasonRounds) ? `Pre ${day}` : `J${day - preseasonRounds}`;
        });
        
        // Paleta de colores para los mánagers
        const colors = ['#3b82f6', '#ef4444', '#10b981', '#f97316', '#8b5cf6', '#eab308', '#ec4899', '#64748b', '#14b8a6', '#d946ef'];
        
        const datasets = managerList.map((manager, index) => {
            const data = [];
            for (let day = 1; day <= totalDays; day++) {
                const dayData = historicalData[day]?.find(m => m.name === manager.name);
                data.push(dayData ? dayData.totalAssets : null);
            }
            return {
                label: manager.name,
                data: data,
                borderColor: colors[index % colors.length],
                tension: 0.1,
                fill: false,
            };
        });

        this.chartInstance = new Chart(ctx, {
            type: 'line',
            data: { labels, datasets },
            options: { responsive: true, maintainAspectRatio: false }
        });
    },



    // --- Selectores y Vistas Principales ---
    renderLeagueSelector(leagues, selectedLeagueId) {
        const selector = this.elements.leagueSelector;
        if (!selector) return;
        selector.innerHTML = leagues.map(l => `<option value="${l.id}" ${l.id === selectedLeagueId ? 'selected' : ''}>${l.name}</option>`).join('');
        if (leagues.length === 0) {
            selector.innerHTML = `<option disabled selected>Crea una liga para empezar</option>`;
            this.elements.mainContent.classList.add('hidden');
        }
    },

    getDashboardHTML(stats, leagueData) {
        // CORRECCIÓN: Usar los datos pasados y proveer un fallback.
        const managersByTeam = leagueData?.managersByTeam || {};
        const teamNameLookup = Object.fromEntries(Object.entries(managersByTeam).map(([team, name]) => [name, team]));

        const { panicBuys, masterSales, mostTraded } = stats;
        const renderTop5List = (items, valueFormatter, isPurchase) => {
             if (!items || items.length === 0) return '<li>No hay datos suficientes.</li>';
             return items.map(t => { /* ...resto de la función sin cambios... */ }).join('');
        };
        const panicBuysHTML = renderTop5List(panicBuys, t => `+${t.premiumPercent.toFixed(0)}%`, true);
        const masterSalesHTML = renderTop5List(masterSales, t => `+${t.profitPercent.toFixed(0)}%`, false);
        const mostTradedHTML = mostTraded.map(p => `<li class="flex justify-between items-center py-1.5"><div class="text-sm"><b>${p.name}</b></div><span class="font-bold text-sm">${p.count} ops.</span></li>`).join('') || '<li>No hay datos.</li>';
        return `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div class="card p-5"><h3 class="text-sm font-semibold text-gray-500">Gasto Total</h3><p class="text-3xl font-bold">${stats.totalSpent.toFixed(1)}M</p></div>
            <div class="card p-5"><h3 class="text-sm font-semibold text-gray-500">Ingreso Total</h3><p class="text-3xl font-bold text-green-600">${stats.totalIncome.toFixed(1)}M</p></div>
            <div class="card p-5"><h3 class="text-sm font-semibold text-gray-500">Precio Medio Compra</h3><p class="text-3xl font-bold text-red-600">${stats.avgPurchasePrice.toFixed(1)}M</p></div>
            <div class="card p-5"><h3 class="text-sm font-semibold text-gray-500">Precio Medio Venta</h3><p class="text-3xl font-bold text-green-600">${stats.avgSalePrice.toFixed(1)}M</p></div>
        </div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
             <div class="card p-5"><h3 class="text-lg font-semibold mb-1">Top 5 Compras Caras</h3><p class="text-xs text-gray-500 mb-3">Compras con el mayor sobreprecio.</p><ul class="space-y-2">${panicBuysHTML}</ul></div>
             <div class="card p-5"><h3 class="text-lg font-semibold mb-1">Top 5 Ventas Maestras</h3><p class="text-xs text-gray-500 mb-3">Ventas con el mayor beneficio.</p><ul class="space-y-2">${masterSalesHTML}</ul></div>
             <div class="card p-5"><h3 class="text-lg font-semibold mb-1">Jugadores Calientes</h3><p class="text-xs text-gray-500 mb-3">Los más traspasados.</p><ul class="space-y-2">${mostTradedHTML}</ul></div>
        </div>`;
    },

    getRivalriesHTML(stats, leagueData) {
        if (!leagueData || !leagueData.teams || leagueData.teams.length === 0) {
            return '<p class="text-center text-gray-500 mt-8">Esta liga no tiene equipos. Importa una plantilla en "Gestionar Ligas".</p>';
        }

        if (leagueData.type === 'battle') {
            let rivalryHTML = '';
            const processedManagers = new Set();
            // CORREGIDO: Itera sobre los equipos de la liga para encontrar las parejas
            for (const team of leagueData.teams) {
                if (team.name.startsWith('Team Blue')) {
                    const pairNumber = team.name.split(' ')[2];
                    const redTeamName = `Team Red ${pairNumber}`;
                    const blueManagerName = leagueData.managersByTeam[team.name];
                    const redManagerName = leagueData.managersByTeam[redTeamName];

                    if (blueManagerName && redManagerName && !processedManagers.has(blueManagerName)) {
                        const blueM = stats.managerList.find(m => m.name === blueManagerName);
                        const redM = stats.managerList.find(m => m.name === redManagerName);
                        if (blueM && redM) {
                            rivalryHTML += this.generateRivalryCard(blueM, redM);
                            processedManagers.add(blueManagerName);
                            processedManagers.add(redManagerName);
                        }
                    }
                }
            }
            return `<h2 class="text-2xl font-bold mb-4 text-gray-800">Batallas: Cara a Cara</h2>${rivalryHTML || '<p class="text-center text-gray-500 mt-8">Asigna mánagers a los equipos Blue y Red para ver las batallas.</p>'}`;
        } else {
            const individualHTML = stats.managerList.map(manager => this.generateIndividualManagerCard(manager, manager.teamName)).join('');
            return `<h2 class="text-2xl font-bold mb-4 text-gray-800">Resumen de Mánagers</h2><div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">${individualHTML || '<p class="text-center text-gray-500 mt-8">No hay mánagers asignados en esta liga.</p>'}</div>`;
        }
    },

    generateIndividualManagerCard(manager, teamName) {
         return `
            <div class="card p-5 team-neutral-bg flex flex-col justify-between">
                <div>
                    <h3 class="text-xl font-bold text-gray-800 truncate" title="${teamName}">${teamName}</h3>
                    <p class="text-sm text-gray-500 mb-4">${manager.name}</p>
                </div>

                <div class="grid grid-cols-2 gap-y-5 gap-x-4 text-center border-t pt-4">
                    <div>
                        <h4 class="text-xs font-semibold text-gray-500">Valor Equipo</h4>
                        <p class="text-xl font-bold text-blue-600">${manager.currentValue.toFixed(1)}M</p>
                    </div>
                    <div>
                        <h4 class="text-xs font-semibold text-gray-500">Caja Estimada</h4>
                        <p class="text-xl font-bold ${manager.cash >= 0 ? 'text-green-600' : 'text-red-600'}">${manager.cash.toFixed(1)}M</p>
                    </div>
                    <div>
                        <h4 class="text-xs font-semibold text-gray-500">Factor Compra</h4>
                        <p class="text-lg font-semibold text-red-500">${manager.avgPremium.toFixed(1)}%</p>
                    </div>
                    <div>
                        <h4 class="text-xs font-semibold text-gray-500">Factor Venta</h4>
                        <p class="text-lg font-semibold text-green-500">${manager.avgProfit.toFixed(1)}%</p>
                    </div>
                    
                    <!-- NUEVA SECCIÓN - La Evolución ocupa las dos columnas -->
                    <div class="col-span-2 mt-2">
                        <h4 class="text-sm font-semibold text-gray-500">Evolución Total</h4>
                        <p class="text-3xl font-bold ${manager.evolution >= 0 ? 'text-green-600' : 'text-red-600'}">${manager.evolution.toFixed(1)}%</p>
                        <p class="text-xs text-gray-400">(Activos actuales vs. iniciales)</p>
                    </div>
                </div>
            </div>`;
    },
    
    generateRivalryCard(blueM, redM) {
        // --- Cálculos ---
        const blueBetterBuyer = blueM.avgPremium < redM.avgPremium;
        const blueBetterSeller = blueM.avgProfit > redM.avgProfit;
        const allTransfers = [...blueM.transfers, ...redM.transfers];
        
        const sales = allTransfers.filter(t=>t.transactionType==='sale').map(s=>({...s, profitPercent: s.baseValue > 0 ? ((s.finalPrice / s.baseValue)-1)*100:0}));
        const bestSale = sales.length > 0 ? [...sales].sort((a,b)=>b.profitPercent-a.profitPercent)[0] : null;
        
        const purchases = allTransfers.filter(t=>t.transactionType==='purchase').map(p=>({...p, premiumPercent: p.baseValue > 0 ? ((p.finalPrice / p.baseValue)-1)*100:0}));
        const worstPurchase = purchases.length > 0 ? [...purchases].sort((a,b)=>b.premiumPercent-a.premiumPercent)[0]:null;

        const totalAssetsSum = blueM.totalAssets + redM.totalAssets;
        const blueAssetsPercent = totalAssetsSum > 0 ? (blueM.totalAssets / totalAssetsSum) * 100 : 50;

        const totalValueSum = blueM.currentValue + redM.currentValue;
        const blueValuePercent = totalValueSum > 0 ? (blueM.currentValue / totalValueSum) * 100 : 50;
        
        const totalCashSum = blueM.cash + redM.cash;
        const blueCashPercent = totalCashSum > 0 ? (blueM.cash / totalCashSum) * 100 : 50;

        // --- Renderizado HTML ---
        return `
        <div class="card p-4 md:p-6 mb-8">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-xl font-bold text-blue-600">${blueM.name}</h3>
                <span class="text-lg font-bold text-gray-500">VS</span>
                <h3 class="text-xl font-bold text-red-600">${redM.name}</h3>
            </div>
            
            <!-- SECCIÓN FINANZAS -->
            <div class="border-t pt-4">
                <h4 class="font-bold mb-4 text-center text-gray-700">Análisis Financiero</h4>
                <div class="space-y-4 text-xs">
                    <div>
                        <div class="flex justify-between font-semibold text-gray-600 mb-1"><span>Balanza de Poder (Activos Totales)</span></div>
                        <div class="flex w-full bg-gray-200 rounded-full h-5 border overflow-hidden"><div class="bg-blue-500 text-white flex items-center justify-start pl-2" style="width: ${blueAssetsPercent}%">${blueM.totalAssets.toFixed(1)}M</div><div class="bg-red-500 text-white flex items-center justify-end pr-2" style="width: ${100-blueAssetsPercent}%">${redM.totalAssets.toFixed(1)}M</div></div>
                    </div>
                    <div>
                        <div class="flex justify-between font-semibold text-gray-600 mb-1"><span>Valor de Equipo</span><span>Caja Estimada</span></div>
                        <div class="flex gap-4">
                            <div class="w-1/2 flex bg-gray-200 rounded-full h-5 border overflow-hidden"><div class="bg-blue-500 text-white flex items-center justify-start pl-2" style="width: ${blueValuePercent}%">${blueM.currentValue.toFixed(1)}M</div><div class="bg-red-500 text-white flex items-center justify-end pr-2" style="width: ${100-blueValuePercent}%">${redM.currentValue.toFixed(1)}M</div></div>
                            <div class="w-1/2 flex bg-gray-200 rounded-full h-5 border overflow-hidden"><div class="bg-blue-500 text-white flex items-center justify-start pl-2" style="width: ${blueCashPercent}%">${blueM.cash.toFixed(1)}M</div><div class="bg-red-500 text-white flex items-center justify-end pr-2" style="width: ${100-blueCashPercent}%">${redM.cash.toFixed(1)}M</div></div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECCIÓN RENDIMIENTO -->
            <div class="border-t mt-6 pt-4">
                 <h4 class="font-bold mb-4 text-center text-gray-700">Rendimiento de Mercado</h4>
                 <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-center">
                    <div class="p-3 bg-gray-50 rounded-lg">
                        <h5 class="font-bold text-gray-800">Veredicto</h5>
                        <div class="text-xs space-y-2 mt-2">
                            <p>Mejor Comprador:<br><span class="font-extrabold text-base ${blueBetterBuyer ? 'text-blue-600' : 'text-red-600'}">${blueBetterBuyer ? blueM.name : redM.name}</span></p>
                            <p>Mejor Vendedor:<br><span class="font-extrabold text-base ${blueBetterSeller ? 'text-blue-600' : 'text-red-600'}">${blueBetterSeller ? blueM.name : redM.name}</span></p>
                        </div>
                    </div>
                    <div class="p-3 bg-gray-50 rounded-lg">
                         <h5 class="font-bold text-gray-800">Movimientos Clave</h5>
                         <div class="text-xs space-y-2 mt-2">
                             <p>Mejor Venta:<br>${bestSale ? `<span class="font-bold text-lg text-green-600">+${bestSale.profitPercent.toFixed(0)}%</span><span class="block text-gray-500">(${bestSale.playerName} por <b class="${bestSale.managerName === blueM.name ? 'text-blue-600' : 'text-red-600'}">${bestSale.managerName}</b>)<br><span class="text-xs">(+${(bestSale.finalPrice - bestSale.baseValue).toFixed(1)}M)</span></span>` : 'N/A'}</p>
                             <p>Peor Compra:<br>${worstPurchase ? `<span class="font-bold text-lg text-red-600">+${worstPurchase.premiumPercent.toFixed(0)}%</span><span class="block text-gray-500">(${worstPurchase.playerName} por <b class="${worstPurchase.managerName === blueM.name ? 'text-blue-600' : 'text-red-600'}">${worstPurchase.managerName}</b>)<br><span class="text-xs">(${(worstPurchase.finalPrice - worstPurchase.baseValue).toFixed(1)}M pagados de más)</span></span>`:'N/A'}</p>
                         </div>
                    </div>
                    <div class="p-3 bg-gray-50 rounded-lg">
                        <h5 class="font-bold text-gray-800">Crecimiento Total</h5>
                        <p class="text-xs mt-2 mb-1">Evolución de activos.</p>
                        <div class="flex justify-around items-center h-full">
                            <div class="text-center"><div class="text-2xl font-bold ${blueM.evolution >= 0 ? 'text-green-600':'text-red-600'}">${blueM.evolution.toFixed(1)}%</div><div class="text-xs font-bold text-blue-600">${blueM.name}</div></div>
                            <div class="text-center"><div class="text-2xl font-bold ${redM.evolution >= 0 ? 'text-green-600' : 'text-red-600'}">${redM.evolution.toFixed(1)}%</div><div class="text-xs font-bold text-red-600">${redM.name}</div></div>
                        </div>
                    </div>
                 </div>
            </div>
        </div>`;
    },

    getManagersHTML(managerList, leagueData, currentSort) {
        // CORRECCIÓN: Usar datos pasados
        const managersByTeam = leagueData?.managersByTeam || {};
        const teamByManager = Object.fromEntries(Object.entries(managersByTeam).map(([team, name]) => [name, team]));
        const sortFunctions = { totalAssets: (a, b) => b.totalAssets - a.totalAssets, spent: (a, b) => b.spent - a.spent, income: (a, b) => b.income - a.income, count: (a, b) => b.count - a.count };
        const listHTML = [...managerList].sort(sortFunctions[currentSort]).map(m => {
            const teamName = teamByManager[m.name] || '';
            const teamClass = teamName.includes('Blue') ? 'team-blue-bg' : teamName.includes('Red') ? 'team-red-bg' : 'team-neutral-bg';
            return `<div class="card p-4 manager-card ${teamClass}" data-manager-name="${m.name}"><h3 class="font-bold text-lg">${m.name}</h3>
            <div class="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-center">
                <div><p class="text-xs">Activos Totales</p><p class="font-semibold text-black-600">${m.totalAssets.toFixed(1)}M</p></div>
                <div><p class="text-xs">Caja Estimada</p><p class="font-semibold text-blue-600">${m.cash.toFixed(1)}M</p></div>
                <div><p class="text-xs">Gasto</p><p class="font-semibold text-red-600">${m.spent.toFixed(1)}M</p></div>
                <div><p class="text-xs">Ingresos</p><p class="font-semibold text-green-600">${m.income.toFixed(1)}M</p></div>
                <div><p class="text-xs">Operaciones</p><p class="font-semibold">${m.count}</p></div>
            </div></div>`}).join('');
        return `<h2 class="text-2xl font-bold mb-4 text-gray-800">Ranking de Mánagers</h2>
             <div class="flex flex-wrap gap-2 mb-4 bg-gray-200 p-1 rounded-lg">
                 <button class="sort-btn flex-1 px-3 py-1.5 rounded-md text-sm" data-sort="totalAssets">Activos Totales</button>
                 <button class="sort-btn flex-1 px-3 py-1.5 rounded-md text-sm" data-sort="spent">Gasto</button>
                 <button class="sort-btn flex-1 px-3 py-1.5 rounded-md text-sm" data-sort="income">Ingresos</button>
                 <button class="sort-btn flex-1 px-3 py-1.5 rounded-md text-sm" data-sort="count">Operaciones</button>
             </div><div class="space-y-4">${listHTML}</div>`;
    },
    
    getHistoryHTML(transfers) {
        const historyHTML = [...transfers].sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0)).map(t => {
            const isPurchase = t.transactionType === 'purchase';
            const typeClass = isPurchase ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
            return `<tr><td class="px-4 py-3"><div class="font-medium">${t.playerName}</div><div class="text-xs text-gray-500">${t.position}</div></td>
                <td class="px-4 py-3">${t.managerName}</td>
                <td class="px-4 py-3"><span class="px-2 inline-flex text-xs font-semibold rounded-full ${typeClass}">${isPurchase ? 'Compra':'Venta'}</span></td>
                <td class="px-4 py-3 font-semibold ${isPurchase ? 'text-red-600' : 'text-green-600'}">${isPurchase ? '-' : '+'}${t.finalPrice.toFixed(1)}M</td></tr>`;
        }).join('');
        return `<h2 class="text-2xl font-bold mb-4 text-gray-800">Historial de Transacciones</h2><div class="card p-2 md:p-4 overflow-x-auto"><table class="min-w-full divide-y"><thead class="bg-gray-50"><tr><th class="px-4 py-3 text-left text-xs uppercase">Jugador</th><th class="px-4 py-3 text-left text-xs uppercase">Mánager</th><th class="px-4 py-3 text-left text-xs uppercase">Tipo</th><th class="px-4 py-3 text-left text-xs uppercase">Precio Final</th></tr></thead><tbody class="bg-white divide-y">${historyHTML}</tbody></table></div>`;
    },

    getMyTeamHTML() {
        return `<div class="card p-6">
            <h2 class="text-2xl font-bold mb-4 text-gray-800">Análisis de Venta de Plantilla</h2>
            <p class="text-sm text-gray-600 mb-4">Pega la plantilla de tu equipo desde OSM para recibir recomendaciones de precios de venta basadas en el historial de fichajes de esta liga.</p>
            <textarea id="myTeamInput" class="w-full h-64 p-3 border rounded-lg font-mono text-xs focus:ring-2 focus:ring-green-500" placeholder="Pega aquí la plantilla de tu equipo..."></textarea>
            <div class="text-right mt-4"><button id="analyzeMyTeamBtn" class="bg-green-600 text-white px-6 py-2 rounded-lg shadow hover:bg-green-700">Analizar Plantilla</button></div>
        </div>`;
    }
};
