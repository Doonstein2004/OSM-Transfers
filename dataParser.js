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
    convertToJSON(text) {
        const transfers = [];
        const managersByTeam = {};
        const allLines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);

        let currentBlock = [];
        const detailsRegex = /^([A-Z]{1,4})\s+\d+\s+([\d,.]+[MK])\s+([\d,.]+[MK]).*$/i;

        // PRIMER PASO: Recolectar todos los bloques
        const blocks = [];
        for (const line of allLines) {
            currentBlock.push(line);
            if (detailsRegex.test(line)) {
                blocks.push([...currentBlock]);
                currentBlock = [];
            }
        }

        // SEGUNDO PASO: Identificar pares equipo-manager por frecuencia de aparición JUNTOS
        const pairFrequency = {
            positions23: {}, // line2 + line3 como par
            positions34: {}  // line3 + line4 como par
        };

        blocks.forEach(block => {
            if (block.length === 5) {
                const pair23 = `${block[1]}|${block[2]}`;
                const pair34 = `${block[2]}|${block[3]}`;
                
                pairFrequency.positions23[pair23] = (pairFrequency.positions23[pair23] || 0) + 1;
                pairFrequency.positions34[pair34] = (pairFrequency.positions34[pair34] || 0) + 1;
            }
        });

        // TERCER PASO: Procesar cada bloque
        blocks.forEach(block => {
            const detailsLine = block[block.length - 1];
            const detailsMatch = detailsLine.match(detailsRegex);
            const [_, position, baseValueStr, finalPriceStr] = detailsMatch;
            const baseValue = this.parseValue(baseValueStr);
            const finalPrice = this.parseValue(finalPriceStr);
            
            let playerName = "", transactionType = "", managerTeam = "", managerName = "";

            if (block.length === 4) {
                // Compra desde lista de transferibles
                playerName = block[0];
                managerTeam = block[1];
                managerName = block[2];
                transactionType = 'purchase';
            }
            else if (block.length === 5) {
                playerName = block[0];
                const line2 = block[1];
                const line3 = block[2];
                const line4 = block[3];

                const pair23 = `${line2}|${line3}`;
                const pair34 = `${line3}|${line4}`;

                // Verificar relaciones conocidas primero
                const knownManager3 = managersByTeam[line2] === line3;
                const knownManager4 = managersByTeam[line3] === line4;

                if (knownManager3) {
                    // VENTA confirmada
                    managerTeam = line2;
                    managerName = line3;
                    transactionType = 'sale';
                } else if (knownManager4) {
                    // COMPRA confirmada
                    managerTeam = line3;
                    managerName = line4;
                    transactionType = 'purchase';
                } else {
                    // Usar frecuencia de pares
                    const freq23 = pairFrequency.positions23[pair23] || 0;
                    const freq34 = pairFrequency.positions34[pair34] || 0;

                    // El par que aparece más frecuentemente es el de la liga
                    if (freq23 > freq34) {
                        // El par line2+line3 es más frecuente → VENTA
                        managerTeam = line2;
                        managerName = line3;
                        transactionType = 'sale';
                    } else if (freq34 > freq23) {
                        // El par line3+line4 es más frecuente → COMPRA
                        managerTeam = line3;
                        managerName = line4;
                        transactionType = 'purchase';
                    } else {
                        // Frecuencias iguales o ambas son 1 (primera aparición)
                        // Usar heurística: comparar longitudes
                        // Managers tienden a ser más cortos que nombres de equipos
                        const avgLength23 = (line2.length + line3.length) / 2;
                        const avgLength34 = (line3.length + line4.length) / 2;
                        
                        if (line3.length < line4.length) {
                            // line3 más corto → probablemente manager en posición 3 (VENTA)
                            managerTeam = line2;
                            managerName = line3;
                            transactionType = 'sale';
                        } else {
                            // line4 más corto → probablemente manager en posición 4 (COMPRA)
                            managerTeam = line3;
                            managerName = line4;
                            transactionType = 'purchase';
                        }
                    }
                }
            }

            if (transactionType) {
                transfers.push({
                    playerName, 
                    transactionType, 
                    managerTeam, 
                    managerName,
                    position, 
                    baseValue, 
                    finalPrice
                });
                // Guardar relación para futuras referencias
                managersByTeam[managerTeam] = managerName;
            }
        });

        return { transfers: JSON.stringify(transfers, null, 2), managersByTeam };
    },


    parseLeagueTemplate(text) {
        const teams = [];
        const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
        const teamNameRegex = /^(Team (Blue|Red) \d+)$/;
        let isBattleLeague = false;
        const regexDupe = /^(.+?)\s+\1\s+\d+\s+([\d,.]+[MK])\s+([\d,.]+[MK])$/;
        const regexSingleAlias = /^(.*?)\s+([^\s]+)\s+\d+\s+([\d,.]+[MK])\s+([\d,.]+[MK])$/;

        for (const line of lines) {
            let match = line.match(regexDupe);
            let name, alias;
            if (match) {
                name = match[1].trim();
                alias = name;
                teams.push({ name, alias, initialValue: this.parseValue(match[2]), initialCash: this.parseValue(match[3]) });
            } else {
                match = line.match(regexSingleAlias);
                if (match) {
                    name = match[1].trim();
                    alias = match[2].trim();
                    teams.push({ name, alias, initialValue: this.parseValue(match[3]), initialCash: this.parseValue(match[4]) });
                }
            }
            if (name && teamNameRegex.test(name)) { isBattleLeague = true; }
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
