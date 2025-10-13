function _initializeManagers(leagueData) {
    const managers = {};
    if (!leagueData || !leagueData.teams) return managers;

    const { teams, managersByTeam = {} } = leagueData;
    const teamDataMap = new Map(teams.map(team => [team.name, team]));

    for (const managerName of Object.values(managersByTeam)) {
        const teamName = Object.keys(managersByTeam).find(key => managersByTeam[key] === managerName);
        const team = teamDataMap.get(teamName);

        if (team) {
            const fixedIncome = team.fixedIncomePerRound || 0;
            const initialCash = fixedIncome * 4;

            managers[managerName] = {
                name: managerName,
                teamName: teamName,
                initialValue: team.initialValue || 0,
                currentValue: team.currentValue || 0,
                initialCash: initialCash,
                fixedIncome: fixedIncome,
                cashFlow: [{ round: -1, cash: initialCash }], // Estado inicial
                transfers: [],
                purchasePremiums: [],
                saleProfits: [],
                totalSpent: 0,
                totalIncome: 0,
            };
        }
    }
    return managers;
}

function _runChronologicalSimulation(managers, transfers) {
    const VARIABLE_INCOME_MULTIPLIER = 0.7;

    const transfersByRound = transfers.reduce((acc, t) => {
        const round = t.round != null ? String(t.round) : '0';
        if (!acc[round]) acc[round] = [];
        acc[round].push(t);
        return acc;
    }, {});

    const maxRound = Math.max(0, ...transfers.map(t => t.round || 0));

    for (let round = 0; round <= maxRound; round++) {
        const roundStr = String(round);
        const roundTransfers = transfersByRound[roundStr] || [];
        const roundTransferDetails = {};

        roundTransfers.forEach(t => {
            const manager = managers[t.managerName];
            if (manager) {
                if (!roundTransferDetails[t.managerName]) {
                    roundTransferDetails[t.managerName] = { spent: 0, income: 0 };
                }
                if (t.transactionType === 'purchase') {
                    roundTransferDetails[t.managerName].spent += t.finalPrice;
                    manager.purchasePremiums.push(t.baseValue > 0 ? ((t.finalPrice / t.baseValue) - 1) * 100 : 0);
                    manager.totalSpent += t.finalPrice;
                } else if (t.transactionType === 'sale') {
                    roundTransferDetails[t.managerName].income += t.finalPrice;
                    manager.saleProfits.push(t.baseValue > 0 ? ((t.finalPrice / t.baseValue) - 1) * 100 : 0);
                    manager.totalIncome += t.finalPrice;
                }
                manager.transfers.push(t);
            }
        });

        for (const managerName in managers) {
            const manager = managers[managerName];
            const lastState = manager.cashFlow[manager.cashFlow.length - 1];
            let currentCash = lastState.cash;

            const fixedIncome = manager.fixedIncome;
            const variableIncome = fixedIncome * VARIABLE_INCOME_MULTIPLIER;
            currentCash += (fixedIncome + variableIncome);

            const transferDetails = roundTransferDetails[managerName] || { spent: 0, income: 0 };
            const transferNet = transferDetails.income - transferDetails.spent;
            currentCash += transferNet;
            
            const interestEarned = currentCash > 0 ? currentCash * 0.02 : 0;
            currentCash += interestEarned;
            
            manager.cashFlow.push({
                round: round,
                cash: Math.max(0, currentCash),
            });
        }
    }
    return managers;
}

function _calculateFinalMetrics(simulatedManagers, allTransfers) {
    const calcAvg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    const managerList = Object.values(simulatedManagers).map(m => {
        const finalCashState = m.cashFlow[m.cashFlow.length - 1];
        const cash = finalCashState.cash;
        const totalAssets = m.currentValue + cash;
        const evolution = m.initialValue > 0 ? ((m.currentValue - m.initialValue) / m.initialValue) * 100 : 0;
        
        return { 
            ...m,
            spent: m.totalSpent,
            income: m.totalIncome,
            count: m.transfers.length,
            transferNet: m.totalIncome - m.totalSpent, 
            cash, 
            totalAssets, 
            evolution, 
            avgPremium: calcAvg(m.purchasePremiums), 
            avgProfit: calcAvg(m.saleProfits),
        };
    });

    const totalSpent = managerList.reduce((sum, m) => sum + m.spent, 0);
    const totalIncome = managerList.reduce((sum, m) => sum + m.income, 0);
    const purchaseCount = allTransfers.filter(t => t.transactionType === 'purchase').length;
    const saleCount = allTransfers.filter(t => t.transactionType === 'sale').length;
    const avgPurchasePrice = purchaseCount > 0 ? totalSpent / purchaseCount : 0;
    const avgSalePrice = saleCount > 0 ? totalIncome / saleCount : 0;
    const panicBuys = allTransfers.filter(t=>t.transactionType === 'purchase').map(t=> ({...t, premiumPercent: t.baseValue>0 ? ((t.finalPrice/t.baseValue)-1)*100:0})).sort((a,b) => b.premiumPercent - a.premiumPercent).slice(0, 5);
    const masterSales = allTransfers.filter(t=>t.transactionType === 'sale').map(t=> ({...t, profitPercent: t.baseValue>0 ? ((t.finalPrice/t.baseValue)-1)*100:0})).sort((a,b) => b.profitPercent - a.profitPercent).slice(0, 5);
    const tradeCounts = allTransfers.reduce((acc, t) => { acc[t.playerName] = (acc[t.playerName] || 0) + 1; return acc; }, {});
    const mostTraded = Object.entries(tradeCounts).sort(([,a],[,b]) => b-a).slice(0,5).map(([name, count]) => ({name, count}));

    return { managerList, totalSpent, totalIncome, avgPurchasePrice, avgSalePrice, panicBuys, masterSales, mostTraded };
}

// --- EXPORTACIÓN DEL MÓDULO ---

export const statsEngine = {
    calculate(transfers, leagueData) {
        // 1. Prepara el estado inicial de cada mánager.
        let managers = _initializeManagers(leagueData);
        
        // 2. Ejecuta la simulación cronológica para calcular el flujo de caja.
        managers = _runChronologicalSimulation(managers, transfers);

        // 3. Calcula las métricas finales y los datos agregados.
        return _calculateFinalMetrics(managers, transfers);
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
        };
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



