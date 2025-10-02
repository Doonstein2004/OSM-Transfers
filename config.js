// js/config.js

// IMPORTANTE: Rellena esto con la configuración de tu proyecto de Firebase
export const firebaseConfig = {
            apiKey: "exapmle",
            authDomain: "exapmle",
            projectId: "exapmle",
            storageBucket: "exapmle",
            messagingSenderId: "exapmle",
            appId: "exapmle",
            measurementId: "exapmle"
};

// Configuración general de la aplicación
export const config = {
    // Un ID único para esta liga, para que puedas tener varias en la misma base de datos.
    appId: 'osm-tracker-default', 
    
    // Plantilla para la configuración de una liga de batalla amistosa.
    // Esto se usa en el modal "Configurar Liga" como punto de partida.
    friendlyBattleTemplate: [
        { teamName: "Team Blue 1", value: 114 }, { teamName: "Team Red 1", value: 117 },
        { teamName: "Team Blue 2", value: 94.7 }, { teamName: "Team Red 2", value: 92.2 },
        { teamName: "Team Blue 3", value: 69.9 }, { teamName: "Team Red 3", value: 71.9 },
        { teamName: "Team Blue 4", value: 55.8 }, { teamName: "Team Red 4", value: 54.6 },
        { teamName: "Team Blue 5", value: 38.5 }, { teamName: "Team Red 5", value: 37.6 },
    ]
};