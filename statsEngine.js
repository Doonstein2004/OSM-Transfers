// js/statsEngine.js
export const statsEngine = {
    calculate(transfers, leagueData) {
        if (!leagueData || !leagueData.teams) {
            return { managerList: [], historicalData: null, totalSpent: 0, totalIncome: 0, avgPurchasePrice: 0, avgSalePrice: 0, panicBuys: [], masterSales: [], mostTraded: [], totalDays: 0, preseasonRounds: 3 };
        }

        const { teams, managersByTeam = {} } = leagueData;
        const dailyInterestRate = 0.02;
        const preseasonRounds = 3;

        const maxRoundFromTransfers = transfers.reduce((max, t) => Math.max(max, t.round || 0), 0);
        const totalDaysToSimulate = maxRoundFromTransfers + preseasonRounds;

        const historicalSnapshots = {};

        let managerStates = teams
            .filter(team => managersByTeam[team.name])
            .map(team => ({
                name: managersByTeam[team.name],
                teamName: team.name,
                teamData: team,
                cash: team.initialCash || 0,
            }));

        for (let day = 1; day <= totalDaysToSimulate; day++) {
            const gameRoundForToday = (day <= preseasonRounds) ? 0 : (day - preseasonRounds);
            for (const managerState of managerStates) {
                if (managerState.cash > 0) managerState.cash *= (1 + dailyInterestRate);
                managerState.cash += (managerState.teamData.fixedIncomePerRound || 0);
                const transfersToday = transfers.filter(t => t.managerName === managerState.name && t.round === gameRoundForToday);
                for (const t of transfersToday) {
                    managerState.cash += (t.transactionType === 'sale' ? t.finalPrice : -t.finalPrice);
                }
            }
            historicalSnapshots[day] = managerStates.map(ms => ({
                name: ms.name,
                cash: ms.cash,
                currentValue: ms.teamData.currentValue || 0,
                totalAssets: (ms.teamData.currentValue || 0) + ms.cash
            }));
        }

        const calcAvg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        
        const finalManagerList = managerStates.map(finalState => {
            const managerTransfers = transfers.filter(t => t.managerName === finalState.name);
            let totalSpent = 0, totalIncome = 0;
            let purchasePremiums = [], saleProfits = [];
            
            managerTransfers.forEach(t => {
                if (t.transactionType === 'purchase') {
                    totalSpent += t.finalPrice;
                    purchasePremiums.push(t.baseValue > 0 ? ((t.finalPrice / t.baseValue) - 1) * 100 : 0);
                } else {
                    totalIncome += t.finalPrice;
                    saleProfits.push(t.baseValue > 0 ? ((t.finalPrice / t.baseValue) - 1) * 100 : 0);
                }
            });

            const totalAssets = (finalState.teamData.currentValue || 0) + finalState.cash;
            const initialTotalAssets = (finalState.teamData.initialValue || 0) + (finalState.teamData.initialCash || 0);
            const evolution = initialTotalAssets > 0 ? ((totalAssets - initialTotalAssets) / initialTotalAssets) * 100 : 0;
            
            return {
                name: finalState.name,
                teamName: finalState.teamName,
                initialValue: finalState.teamData.initialValue,
                currentValue: finalState.teamData.currentValue || 0,
                initialCash: finalState.teamData.initialCash,
                cash: finalState.cash,
                totalAssets: totalAssets,
                evolution: evolution,
                spent: totalSpent,
                income: totalIncome,
                transferNet: totalIncome - totalSpent,
                count: managerTransfers.length,
                transfers: managerTransfers,
                avgPremium: calcAvg(purchasePremiums),
                avgProfit: calcAvg(saleProfits)
            };
        });

        const totalLeagueSpent = finalManagerList.reduce((sum, m) => sum + m.spent, 0);
        const totalLeagueIncome = finalManagerList.reduce((sum, m) => sum + m.income, 0);
        const purchaseCount = transfers.filter(t => t.transactionType === 'purchase').length;
        const saleCount = transfers.filter(t => t.transactionType === 'sale').length;
        const avgPurchasePrice = purchaseCount > 0 ? totalLeagueSpent / purchaseCount : 0;
        const avgSalePrice = saleCount > 0 ? totalLeagueIncome / saleCount : 0;
        const panicBuys = transfers.filter(t=>t.transactionType === 'purchase').map(t=> ({...t, premiumPercent: t.baseValue>0 ? ((t.finalPrice/t.baseValue)-1)*100:0})).sort((a,b) => b.premiumPercent - a.premiumPercent).slice(0, 5);
        const masterSales = transfers.filter(t=>t.transactionType === 'sale').map(t=> ({...t, profitPercent: t.baseValue>0 ? ((t.finalPrice/t.baseValue)-1)*100:0})).sort((a,b) => b.profitPercent - a.profitPercent).slice(0, 5);
        const tradeCounts = transfers.reduce((acc, t) => { acc[t.playerName] = (acc[t.playerName] || 0) + 1; return acc; }, {});
        const mostTraded = Object.entries(tradeCounts).sort(([,a],[,b]) => b-a).slice(0,5).map(([name, count]) => ({name, count}));
        
        // --- FINAL CORRECTION HERE ---
        return { 
            managerList: finalManagerList, 
            historicalData: historicalSnapshots, 
            totalDays: totalDaysToSimulate, 
            preseasonRounds, 
            totalSpent: totalLeagueSpent,    // Corrected property name
            totalIncome: totalLeagueIncome,  // Corrected property name
            avgPurchasePrice, 
            avgSalePrice, 
            panicBuys, 
            masterSales, 
            mostTraded 
        };
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


