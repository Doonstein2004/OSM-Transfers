// js/apiService.js
const API_BASE_URL = 'https://api-osm.fly.dev'; // La URL base de tu API de FastAPI

export const apiService = {
    /**
     * Obtiene la lista de todas las ligas.
     * @returns {Promise<Array>} Una promesa que resuelve a un array de ligas.
     */
    async getAllLeagues() {
        try {
            const response = await fetch(`${API_BASE_URL}/leagues`);
            if (!response.ok) throw new Error(`Error al obtener las ligas: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error en getAllLeagues:", error);
            return []; // Devuelve un array vacío en caso de error
        }
    },

    /**
     * Obtiene los datos detallados de una liga específica.
     * @param {string|number} leagueId - El ID de la liga.
     * @returns {Promise<Object|null>} Una promesa que resuelve a los datos de la liga.
     */
    async getLeagueData(leagueId) {
        // CORRECCIÓN: Guardia robusta para prevenir llamadas inútiles a la API.
        if (!leagueId || leagueId === 'undefined') {
            console.warn("getLeagueData fue llamado con un ID inválido. Abortando llamada.");
            return null;
        }
        try {
            const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}`);
            if (!response.ok) throw new Error(`Error al obtener datos de la liga ${leagueId}: ${response.statusText}`);
            return await response.json();
        } catch (error) {
            console.error("Error en getLeagueData:", error);
            return null;
        }
    },

    /**
     * Obtiene todos los fichajes de una liga específica.
     * @param {string|number} leagueId - El ID de la liga.
     * @returns {Promise<Array>} Una promesa que resuelve a un array de fichajes.
     */
    async getLeagueTransfers(leagueId) {
        if (!leagueId || leagueId === 'undefined') {
            console.warn("getLeagueTransfers fue llamado con un ID inválido. Abortando llamada.");
            return [];
        }
        try {
            const response = await fetch(`${API_BASE_URL}/leagues/${leagueId}/transfers`);
            if (!response.ok) throw new Error(`Error al obtener fichajes de la liga ${leagueId}: ${response.statusText}`);
            const transfers = await response.json();
            
            // CORRECCIÓN: Ahora la API devuelve `createdAt`, no `created_at`.
            return transfers.map(t => ({
                ...t,
                // El parseo a Date sigue siendo necesario porque JSON no tiene un tipo de fecha.
                createdAt: new Date(t.createdAt) 
            }));
        } catch (error) {
            console.error("Error en getLeagueTransfers:", error);
            return [];
        }
    }
};

