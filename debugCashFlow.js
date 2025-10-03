// Función de depuración para rastrear el flujo de caja día por día
export function debugCashFlow(managerName, transfers, leagueData) {
    const { teams, managersByTeam = {} } = leagueData;
    const dailyInterestRate = 0.02;
    const preseasonRounds = 3;

    // Encuentra el manager
    const team = teams.find(t => managersByTeam[t.name] === managerName);
    if (!team) {
        console.error(`? Manager "${managerName}" no encontrado`);
        return null;
    }

    console.log(`?? Depurando flujo de caja para: ${managerName}`);
    console.log(`?? Equipo: ${team.name}`);
    console.log(`?? Cash inicial: $${(team.initialCash || 0).toLocaleString()}`);
    console.log(`?? Valor inicial equipo: $${(team.initialValue || 0).toLocaleString()}`);
    console.log(`?? Ingreso fijo por ronda: $${(team.fixedIncomePerRound || 0).toLocaleString()}`);
    console.log(`\n${'='.repeat(80)}\n`);

    // Filtra transfers del manager
    const managerTransfers = transfers.filter(t => t.managerName === managerName);
    console.log(`?? Total de transfers: ${managerTransfers.length}`);
    
    const purchases = managerTransfers.filter(t => t.transactionType === 'purchase');
    const sales = managerTransfers.filter(t => t.transactionType === 'sale');
    
    console.log(`   ?? Compras: ${purchases.length}`);
    console.log(`   ?? Ventas: ${sales.length}`);
    console.log(`\n${'='.repeat(80)}\n`);

    // Calcula días totales
    const maxRound = transfers.reduce((max, t) => Math.max(max, t.round || 0), 0);
    const totalDays = maxRound + preseasonRounds;

    // Estado inicial
    let cash = team.initialCash || 0;
    const log = [];

    // Simula día por día
    for (let day = 1; day <= totalDays; day++) {
        const gameRound = (day <= preseasonRounds) ? 0 : (day - preseasonRounds);
        
        let dayLog = {
            day,
            gameRound,
            cashStart: cash,
            interest: 0,
            fixedIncome: team.fixedIncomePerRound || 0,
            transfers: [],
            cashEnd: cash
        };

        // 1. Interés
        if (cash > 0) {
            const interest = cash * dailyInterestRate;
            cash *= (1 + dailyInterestRate);
            dayLog.interest = interest;
        }

        // 2. Ingreso fijo
        cash += (team.fixedIncomePerRound || 0);

        // 3. Transfers del día
        const todayTransfers = managerTransfers.filter(t => t.round === gameRound);
        
        for (const t of todayTransfers) {
            const amount = t.transactionType === 'sale' ? t.finalPrice : -t.finalPrice;
            cash += amount;
            dayLog.transfers.push({
                type: t.transactionType,
                player: t.playerName,
                amount: amount,
                finalPrice: t.finalPrice,
                baseValue: t.baseValue
            });
        }

        dayLog.cashEnd = cash;
        log.push(dayLog);

        // Imprime el día si hay cambios significativos
        if (dayLog.interest !== 0 || dayLog.transfers.length > 0 || day <= 5 || day === totalDays) {
            console.log(`?? DÍA ${day} (Ronda ${gameRound})`);
            console.log(`   ?? Cash inicial: $${dayLog.cashStart.toLocaleString()}`);
            
            if (dayLog.interest > 0) {
                console.log(`   ?? Interés (2%): +$${dayLog.interest.toLocaleString()}`);
            } else if (dayLog.cashStart < 0) {
                console.log(`   ??  Cash negativo - NO HAY INTERÉS`);
            }
            
            if (dayLog.fixedIncome > 0) {
                console.log(`   ?? Ingreso fijo: +$${dayLog.fixedIncome.toLocaleString()}`);
            }
            
            if (dayLog.transfers.length > 0) {
                console.log(`   ?? Transfers (${dayLog.transfers.length}):`);
                dayLog.transfers.forEach(t => {
                    const emoji = t.type === 'sale' ? '??' : '??';
                    const sign = t.type === 'sale' ? '+' : '';
                    console.log(`      ${emoji} ${t.type.toUpperCase()}: ${t.player}`);
                    console.log(`         Precio: ${sign}$${t.amount.toLocaleString()} (base: $${t.baseValue.toLocaleString()})`);
                });
            }
            
            const change = dayLog.cashEnd - dayLog.cashStart;
            const changeEmoji = change >= 0 ? '?' : '?';
            console.log(`   ${changeEmoji} Cash final: $${dayLog.cashEnd.toLocaleString()} (cambio: ${change >= 0 ? '+' : ''}$${change.toLocaleString()})`);
            console.log('');
        }
    }

    console.log(`${'='.repeat(80)}`);
    console.log(`\n?? RESUMEN FINAL:`);
    console.log(`   Cash inicial: $${(team.initialCash || 0).toLocaleString()}`);
    console.log(`   Cash final: $${cash.toLocaleString()}`);
    console.log(`   Diferencia: ${cash >= 0 ? '+' : ''}$${(cash - (team.initialCash || 0)).toLocaleString()}`);
    
    // Calcula totales
    const totalSpent = purchases.reduce((sum, p) => sum + p.finalPrice, 0);
    const totalIncome = sales.reduce((sum, s) => sum + s.finalPrice, 0);
    const totalInterest = log.reduce((sum, d) => sum + d.interest, 0);
    const totalFixedIncome = log.reduce((sum, d) => sum + d.fixedIncome, 0);
    
    console.log(`\n?? Movimientos:`);
    console.log(`   Total gastado en compras: -$${totalSpent.toLocaleString()}`);
    console.log(`   Total recibido en ventas: +$${totalIncome.toLocaleString()}`);
    console.log(`   Balance de transfers: ${totalIncome - totalSpent >= 0 ? '+' : ''}$${(totalIncome - totalSpent).toLocaleString()}`);
    console.log(`   Intereses acumulados: +$${totalInterest.toLocaleString()}`);
    console.log(`   Ingresos fijos totales: +$${totalFixedIncome.toLocaleString()}`);
    
    const expectedCash = (team.initialCash || 0) + totalInterest + totalFixedIncome + (totalIncome - totalSpent);
    console.log(`\n?? Verificación:`);
    console.log(`   Cash esperado: $${expectedCash.toLocaleString()}`);
    console.log(`   Cash real: $${cash.toLocaleString()}`);
    console.log(`   Diferencia: $${(cash - expectedCash).toLocaleString()}`);
    
    if (Math.abs(cash - expectedCash) > 0.01) {
        console.log(`   ??  ¡HAY UNA DISCREPANCIA!`);
    } else {
        console.log(`   ? Los números cuadran`);
    }

    // Identifica el problema
    console.log(`\n?? ANÁLISIS:`);
    
    if (cash < 0) {
        console.log(`   ? El manager terminó EN ROJO`);
        
        // Encuentra cuándo se volvió negativo
        const firstNegativeDay = log.find(d => d.cashEnd < 0);
        if (firstNegativeDay) {
            console.log(`   ?? Primera vez en negativo: Día ${firstNegativeDay.day} (Ronda ${firstNegativeDay.gameRound})`);
            console.log(`   ?? Cash en ese momento: $${firstNegativeDay.cashEnd.toLocaleString()}`);
            
            if (firstNegativeDay.transfers.length > 0) {
                console.log(`   ?? Transfers ese día:`);
                firstNegativeDay.transfers.forEach(t => {
                    console.log(`      - ${t.type}: ${t.player} por $${Math.abs(t.amount).toLocaleString()}`);
                });
            }
        }
        
        // Días en rojo
        const daysInRed = log.filter(d => d.cashEnd < 0).length;
        console.log(`   ?? Días en negativo: ${daysInRed}/${totalDays}`);
        console.log(`   ??  Intereses perdidos por estar en rojo!`);
    }
    
    if (totalSpent > totalIncome + (team.initialCash || 0)) {
        console.log(`   ??  Gastó más de lo que tenía + vendió`);
    }

    return { log, finalCash: cash, expectedCash };
}

// Uso:
// debugCashFlow("NombreDelManager", transfers, leagueData);