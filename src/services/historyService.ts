export interface ScanHistoryItem {
    id: string;
    timestamp: number;
    result: any; // Storing the full AnalysisResult
}

const STORAGE_KEY = 'scan_history';

export const saveScan = (result: any) => {
    try {
        const history = getHistory();
        const newItem: ScanHistoryItem = {
            id: Date.now().toString(),
            timestamp: Date.now(),
            result
        };
        // Prepend new item, limit to 50
        const updated = [newItem, ...history].slice(0, 50);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
        console.error("Failed to save history", e);
    }
};

export const getHistory = (): ScanHistoryItem[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
};

// Update a history item (e.g., rename)
export const updateHistoryItem = (id: string, updates: Partial<ScanHistoryItem> | { result: Partial<any> }) => {
    try {
        const history = getHistory();
        const index = history.findIndex(h => h.id === id);
        if (index !== -1) {
            // Merge updates
            const item = history[index];
            if ('result' in updates) {
                // If updating result properties (like productName)
                item.result = { ...item.result, ...updates.result };
            }
            // If updating top-level properties (none exposed yet but good for future)
            // Object.assign(item, updates);

            history[index] = item;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
        }
    } catch (e) {
        console.error("Failed to update history", e);
    }
};

export const clearHistory = () => {
    localStorage.removeItem(STORAGE_KEY);
};
