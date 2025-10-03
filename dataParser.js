// js/dataParser.js
export const dataParser = {
    parseValue(valueStr) {
        if (!valueStr) return 0;
        const valueStrClean = String(valueStr).replace(',', '.');
        const value = parseFloat(valueStrClean);
        if (valueStrClean.toLowerCase().includes('m')) return value;
        if (valueStrClean.toLowerCase().includes('k')) return value / 1000;
        return value;
    },

    // --- CORRECCIÓN LÓGICA FINAL AQUÍ ---
    convertToJSON(text, leagueTeams = []) {
        const transfers = [];
        const managersByTeam = {};
        const allLines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);

        // Crear un Set con los nombres de los equipos de la liga para búsquedas rápidas.
        const teamNames = new Set(leagueTeams.map(t => t.name));

        let currentBlock = [];
        const detailsRegex = /^([A-Z]{1,4})\s+(\d+)\s+([\d,.]+[MK])\s+([\d,.]+[MK]).*$/i;

        for (const line of allLines) {
            currentBlock.push(line);

            if (detailsRegex.test(line)) {
                const [_, position, roundNumber, baseValueStr, finalPriceStr] = line.match(detailsRegex);
                const baseValue = this.parseValue(baseValueStr);
                const finalPrice = this.parseValue(finalPriceStr);
                
                let playerName = "", transactionType = "", managerTeam = "", managerName = "";

                // PATRÓN 1: COMPRA de la lista de transferibles (4 líneas) - Es inequívoco.
                if (currentBlock.length === 4) {
                    playerName = currentBlock[0];
                    managerTeam = currentBlock[1];
                    managerName = currentBlock[2];
                    transactionType = 'purchase';
                }
                // PATRÓN 2: Venta O Compra entre equipos (5 líneas) - Se necesita lógica.
                else if (currentBlock.length === 5) {
                    playerName = currentBlock[0];
                    const line2 = currentBlock[1];
                    const line3 = currentBlock[2];
                    const line4 = currentBlock[3];

                    // --- LÓGICA DETERMINISTA ---
                    // Si la línea 2 es un equipo de nuestra liga, es una VENTA.
                    if (teamNames.has(line2)) {
                        transactionType = 'sale';
                        managerTeam = line2; // Equipo VENDEDOR
                        managerName = line3; // Mánager VENDEDOR
                    }
                    // Si la línea 3 es un equipo de nuestra liga, es una COMPRA.
                    else if (teamNames.has(line3)) {
                        transactionType = 'purchase';
                        managerTeam = line3; // Equipo COMPRADOR
                        managerName = line4; // Mánager COMPRADOR
                    }
                }

                // Si se pudo identificar un patrón válido, se añade el fichaje.
                if (transactionType) {
                    transfers.push({
                        playerName, transactionType, managerTeam, managerName,
                        position, round: parseInt(roundNumber, 10),
                        baseValue, finalPrice
                    });
                    managersByTeam[managerTeam] = managerName;
                }
                
                currentBlock = []; // Reiniciar
            }
        }
        return { transfers: JSON.stringify(transfers, null, 2), managersByTeam };
    },




    parseLeagueTemplate(text) {
        const teams = [];
        const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
        const teamNameRegex = /^(Team (Blue|Red) \d+)$/;
        let isBattleLeague = false;
        const endRegex = /\s+(\d+)\s+([\d,.]+[MK])\s+([\d,.]+[MK])$/;

        for (const line of lines) {
            const match = line.match(endRegex);
            if (!match) continue;
            
            const [_, positionStr, valueStr, cashStr] = match;
            const namePart = line.substring(0, match.index).trim();
            let name, alias;
            
            const words = namePart.split(' ');
            if (words.length > 1 && words.length % 2 === 0) {
                const half = words.length / 2;
                const firstHalf = words.slice(0, half).join(' ');
                const secondHalf = words.slice(half).join(' ');
                if (firstHalf === secondHalf) { name = alias = firstHalf; }
            }
            if (!name) { name = alias = namePart; }

            teams.push({
                name,
                alias,
                initialValue: this.parseValue(valueStr),
                // CORRECCIÓN: Esta columna ahora es el ingreso fijo por jornada.
                // Asumimos que la caja inicial para una nueva liga es 0.
                fixedIncomePerRound: this.parseValue(cashStr), 
                initialCash: 0, 
            });

            if (teamNameRegex.test(name)) { isBattleLeague = true; }
        }
        return { teams, type: isBattleLeague ? 'battle' : 'standard' };
    },

    
    parseMyTeam(text) {
        const players = [];
        const lines = text.trim().split('\n').map(l => l.trim());
        let currentPositionGroup = 'Midfielder'; // Default
        const statsLineRegex = /^([A-Z]{2,3})\s+.*?\s+(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})\s*$/;
        const valueRegex = /([\d,.]+[MK])\s*$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^Forwards/i.test(line)) { currentPositionGroup = 'Forward'; continue; }
            if (/^Midfielders/i.test(line)) { currentPositionGroup = 'Midfielder'; continue; }
            if (/^Defenders/i.test(line)) { currentPositionGroup = 'Defender'; continue; }
            if (/^Goalkeepers/i.test(line)) { currentPositionGroup = 'Goalkeeper'; continue; }
            
            const statsMatch = line.match(statsLineRegex);
            if (statsMatch) {
                const [_, pos, attStr, defStr, ovrStr] = statsMatch;
                let finalOvr;
                if (currentPositionGroup === 'Forward') finalOvr = parseInt(attStr);
                else if (currentPositionGroup === 'Defender' || currentPositionGroup === 'Goalkeeper') finalOvr = parseInt(defStr);
                else finalOvr = parseInt(ovrStr);

                let name = lines[i - 1];
                if (/^\d{1,2}$/.test(name) && i > 1) { // Catches player number and gets name from line above
                    name = lines[i - 2];
                }
                
                const valueLine = lines[i + 1];
                const valueMatch = valueLine ? valueLine.match(valueRegex) : null;

                if (name && valueMatch && !/^(Forwards|Midfielders|Defenders|Goalkeepers)/i.test(name)) {
                    players.push({ name, pos, ovr: finalOvr, value: this.parseValue(valueMatch[1]) });
                }
            }
        }
        return players;
    }
};
