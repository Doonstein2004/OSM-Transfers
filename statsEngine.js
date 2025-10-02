// js/statsEngine.js
export const statsEngine = {
    calculate(transfers, leagueData) {
        if (!leagueData || !leagueData.teams) return { managerList: [], totalSpent: 0, totalIncome: 0, avgPurchasePrice: 0, avgSalePrice: 0, panicBuys: [], masterSales: [], mostTraded: [] };

        const { teams, managersByTeam = {} } = leagueData;
        const managers = {};
        
        // 1. Inicializa las estadísticas para cada mánager con datos de la plantilla
        for (const team of teams) {
            const managerName = managersByTeam[team.name];
            if (managerName) {
                managers[managerName] = {
                    name: managerName,
                    teamName: team.name,
                    initialValue: team.initialValue || 0,
                    currentValue: team.currentValue || 0,
                    initialCash: team.initialCash || 0,
                    spent: 0, income: 0, count: 0, purchasePremiums: [], saleProfits: [], transfers: []
                };
            }
        }

        let totalSpent = 0, totalIncome = 0;
        
        // 2. Procesa todas las transferencias para acumular gastos e ingresos
        transfers.forEach(t => {
            const manager = managers[t.managerName];
            if (manager) {
                manager.transfers.push(t); manager.count++;
                if (t.transactionType === 'purchase') {
                    totalSpent += t.finalPrice; manager.spent += t.finalPrice;
                    const premium = t.baseValue > 0 ? ((t.finalPrice / t.baseValue) - 1) * 100 : 0;
                    manager.purchasePremiums.push(premium);
                } else if (t.transactionType === 'sale') {
                    totalIncome += t.finalPrice; manager.income += t.finalPrice;
                    const profit = t.baseValue > 0 ? ((t.finalPrice / t.baseValue) - 1) * 100 : 0;
                    manager.saleProfits.push(profit);
                }
            }
        });
        
        const calcAvg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

        // 3. Calcula las métricas finales para cada mánager
        const managerList = Object.values(managers).map(m => {
            // --- CORRECCIÓN DE LÓGICA FINANCIERA ---
            const transferNet = m.income - m.spent;
            // La caja actual es la caja inicial MÁS el balance de fichajes.
            const cash = m.initialCash + transferNet;
            // Los activos totales son el valor actual del equipo MÁS la caja actual.
            const totalAssets = m.currentValue + cash;
            // El punto de partida eran los activos iniciales totales.
            const initialTotalAssets = m.initialValue + m.initialCash;
            // La evolución se calcula sobre los activos totales.
            const evolution = initialTotalAssets > 0 ? ((totalAssets - initialTotalAssets) / initialTotalAssets) * 100 : 0;
            
            return { 
                ...m, 
                transferNet, 
                cash, 
                totalAssets, 
                evolution, 
                avgPremium: calcAvg(m.purchasePremiums), 
                avgProfit: calcAvg(m.saleProfits) 
            };
        });
        
        // El resto de cálculos generales no cambian
        const purchaseCount = transfers.filter(t => t.transactionType === 'purchase').length;
        const saleCount = transfers.filter(t => t.transactionType === 'sale').length;
        const avgPurchasePrice = purchaseCount > 0 ? totalSpent / purchaseCount : 0;
        const avgSalePrice = saleCount > 0 ? totalIncome / saleCount : 0;
        const panicBuys = transfers.filter(t=>t.transactionType === 'purchase').map(t=> ({...t, premiumPercent: t.baseValue>0 ? ((t.finalPrice/t.baseValue)-1)*100:0})).sort((a,b) => b.premiumPercent - a.premiumPercent).slice(0, 5);
        const masterSales = transfers.filter(t=>t.transactionType === 'sale').map(t=> ({...t, profitPercent: t.baseValue>0 ? ((t.finalPrice/t.baseValue)-1)*100:0})).sort((a,b) => b.profitPercent - a.profitPercent).slice(0, 5);
        const tradeCounts = transfers.reduce((acc, t) => { acc[t.playerName] = (acc[t.playerName] || 0) + 1; return acc; }, {});
        const mostTraded = Object.entries(tradeCounts).sort(([,a],[,b]) => b-a).slice(0,5).map(([name, count]) => ({name, count}));

        return { managerList, totalSpent, totalIncome, avgPurchasePrice, avgSalePrice, panicBuys, masterSales, mostTraded };
    },
    
    getManagerDetails(managerName, allManagerData) {
        const manager = allManagerData.find(m => m.name === managerName);
        if (!manager) return null;
        const purchases = manager.transfers.filter(t => t.transactionType === 'purchase').sort((a,b) => b.finalPrice - a.finalPrice);
        const sales = manager.transfers.filter(t => t.transactionType === 'sale').map(s => ({...s, profitPercent: s.baseValue > 0 ? ((s.finalPrice - s.baseValue) / s.baseValue) * 100 : 0})).sort((a,b) => b.profitPercent - a.profitPercent);
        const immediateSalesTransfers = manager.transfers.filter(t => t.baseValue === 0 && t.transactionType === 'sale');
        const immediateSalesValue = immediateSalesTransfers.reduce((sum, t) => sum + t.finalPrice, 0);

        return { 
            manager, 
            biggestPurchase: purchases[0], 
            bestSales: sales.slice(0, 3), 
            worstSales: [...sales].sort((a,b) => a.profitPercent - b.profitPercent).slice(0, 3),
            immediateSales: immediateSalesTransfers.length,
            immediateSalesValue: immediateSalesValue
        }
    },

    generateSaleRecommendations(myTeam, allTransfers) {
        const sales = allTransfers.filter(t => t.transactionType === 'sale' && t.baseValue > 0);
        const posToGroup = {'ST': 'Forward', 'CF': 'Forward', 'RW': 'Forward', 'LW': 'Forward','CAM': 'Midfielder', 'CM': 'Midfielder', 'CDM': 'Midfielder', 'RM': 'Midfielder', 'LM': 'Midfielder','CB': 'Defender', 'RB': 'Defender', 'LB': 'Defender', 'RWB': 'Defender', 'LWB': 'Defender','GK': 'Goalkeeper'};
        
        const getOvrTier = (ovr) => {
            if (ovr > 90) return 'Estrella';
            if (ovr > 80) return 'Calidad';
            return 'Promesa';
        };

        const now = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);

        return myTeam.map(player => {
            const playerGroup = posToGroup[player.pos] || 'Midfielder';
            const playerTier = getOvrTier(player.ovr);
            const valueRange = [player.value * 0.8, player.value * 1.5];
            const similarSales = sales.filter(s =>
                (posToGroup[s.position] === playerGroup) &&
                (s.baseValue >= valueRange[0] && s.baseValue <= valueRange[1])
            );

            const liquidity = similarSales.length;
            let cautiousPrice = player.value * 1.8;
            let optimalPrice = player.value * 2.2;
            let trend = '➡️';

            if (liquidity > 0) {
                const historicalMultipliers = similarSales.map(s => s.finalPrice / s.baseValue).sort((a, b) => a - b);
                cautiousPrice = player.value * (historicalMultipliers[Math.floor(historicalMultipliers.length * 0.5)] || 1.8);
                optimalPrice = player.value * (historicalMultipliers[Math.floor(historicalMultipliers.length * 0.75)] || 2.2);

                const recentSales = similarSales.filter(s => s.createdAt && s.createdAt >= sevenDaysAgo);
                if (recentSales.length > 1) {
                    const avgHistoricalMultiplier = historicalMultipliers.reduce((a,b) => a+b, 0) / historicalMultipliers.length;
                    const recentMultipliers = recentSales.map(s => s.finalPrice / s.baseValue);
                    const avgRecentMultiplier = recentMultipliers.reduce((a,b) => a+b, 0) / recentMultipliers.length;
                    
                    if (avgRecentMultiplier > avgHistoricalMultiplier * 1.10) trend = '🔥';
                    else if (avgRecentMultiplier < avgHistoricalMultiplier * 0.90) trend = '❄️';
                }
            }

            return { ...player, playerTier, liquidity, trend,
                cautiousPrice: Math.min(cautiousPrice, player.value * 3),
                optimalPrice: Math.min(optimalPrice, player.value * 3.5),
            };
        }).sort((a,b) => b.optimalPrice - a.optimalPrice);
    }
};



