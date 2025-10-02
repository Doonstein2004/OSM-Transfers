// js/firebaseService.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, onSnapshot, query, orderBy, writeBatch, doc, getDocs, setDoc, getDoc, deleteDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { firebaseConfig } from './config.js';
import { uiManager } from "./uiManager.js";

export const firebaseService = {
    db: null,
    auth: null,
    
    init() {
        if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("...")) {
            uiManager.showError("Configuración de Firebase no encontrada. Reemplaza `firebaseConfig` en `js/config.js` con tus credenciales.");
            return false;
        }
        try {
            const firebaseApp = initializeApp(firebaseConfig);
            this.db = getFirestore(firebaseApp);
            this.auth = getAuth(firebaseApp);
            return true;
        } catch (e) {
            uiManager.showError("Error al conectar con Firebase: " + e.message);
            return false;
        }
    },
    
    authenticate(callback) {
        signInAnonymously(this.auth)
            .then(() => callback())
            .catch((error) => {
                uiManager.showError("Error de autenticación: " + error.message);
            });
    },

    async getAllLeagues() {
        const q = query(collection(this.db, 'leagues'), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    },

    async createNewLeague(name) {
        const newLeagueRef = doc(collection(this.db, 'leagues'));
        await setDoc(newLeagueRef, { name, type: 'standard', teams: [], managersByTeam: {} });
        return newLeagueRef.id;
    },

    async deleteLeague(leagueId) {
        await runTransaction(this.db, async (transaction) => {
            const leagueDocRef = doc(this.db, 'leagues', leagueId);
            const transfersColRef = collection(leagueDocRef, 'transfers');
            const transfersSnapshot = await getDocs(transfersColRef);
            transfersSnapshot.forEach(d => transaction.delete(d.ref));
            transaction.delete(leagueDocRef);
        });
    },

    getLeagueDocRef(leagueId) { return doc(this.db, 'leagues', leagueId); },
    getTransfersColRef(leagueId) { return collection(this.getLeagueDocRef(leagueId), 'transfers'); },
    async getLeagueDataOnce(leagueId) {
        if (!leagueId) return null;
        const snap = await getDoc(this.getLeagueDocRef(leagueId));
        return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    async saveLeagueSetup(leagueId, leagueData) {
        await setDoc(this.getLeagueDocRef(leagueId), leagueData, { merge: true });
    },
    async saveTransfers(leagueId, transfers) {
        const batch = writeBatch(this.db);
        transfers.forEach(t => {
            const newDocRef = doc(this.getTransfersColRef(leagueId));
            batch.set(newDocRef, { ...t, createdAt: new Date() });
        });
        await batch.commit();
    },
    listenToLeagueData(leagueId, callback) {
        if (!leagueId) return () => {}; // Devuelve una función vacía si no hay ID
        const leagueDocRef = this.getLeagueDocRef(leagueId);
        return onSnapshot(leagueDocRef, (doc) => {
            if (doc.exists()) {
                callback({ id: doc.id, ...doc.data() });
            } else {
                callback(null); 
            }
        }, (error) => {
            uiManager.showError(`Error al escuchar datos de la liga: ${error.message}`);
        });
    },
    listenToTransfers(leagueId, callback) {
        const q = query(this.getTransfersColRef(leagueId), orderBy("createdAt", "asc"));
        return onSnapshot(q, (snapshot) => {
            const transfers = snapshot.docs.map(d => ({...d.data(), id: d.id, createdAt: d.data().createdAt?.toDate()}));
            callback(transfers);
        }, (error) => { uiManager.showError(`Error al escuchar datos de la liga: ${error.message}`); });
    }
};