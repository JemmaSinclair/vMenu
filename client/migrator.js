// Stand-in migrator for vMenu -> vMenu.Enhanced
// Scans legacy vMenu KVP data and prompts player via NUI modal to migrate to vMenu.Enhanced.

const LEGACY_PREFIXES = [
    "veh_",
    "ped_",
    "mp_ped_",
    "vmenu_string_saved_weapon_loadout_",
    "saved_veh_category_",
    "mp_character_category_",
    "vmenu_default_character",
    "vmenu_string_default_loadout",
    "settings_",
];

const INT_SETTINGS = new Set([
    "settings_clothingAnimationType",
    "settings_miscLastTimeCycleModifierIndex",
    "settings_miscLastTimeCycleModifierStrength",
    "settings_vehicleDefaultRadio",
]);

const FLOAT_SETTINGS = new Set([
    "settings_voiceChatProximity",
]);

let cachedLegacyData = null;
let cachedLookups = null;

function safeGetKvp(key) {
    if (INT_SETTINGS.has(key)) {
        try {
            return GetResourceKvpInt(key);
        } catch (e) {
            return null;
        }
    }
    if (FLOAT_SETTINGS.has(key)) {
        try {
            return GetResourceKvpFloat(key);
        } catch (e) {
            return null;
        }
    }

    // Try string first
    try {
        const strVal = GetResourceKvpString(key);
        if (strVal !== null && strVal !== undefined) {
            return strVal;
        }
    } catch (err) {
        // "bad cast" native error if it was stored as int or float
        try {
            return GetResourceKvpInt(key);
        } catch (e1) {
            try {
                return GetResourceKvpFloat(key);
            } catch (e2) {
                return null;
            }
        }
    }
    return null;
}

function scanLegacyKvps() {
    const data = new Map();

    for (const prefix of LEGACY_PREFIXES) {
        const handle = StartFindKvp(prefix);
        if (handle === -1 || handle === 0) continue;

        try {
            let key;
            while ((key = FindKvp(handle))) {
                const val = safeGetKvp(key);
                if (val !== null && val !== undefined) {
                    data.set(key, val);
                }
            }
        } finally {
            EndFindKvp(handle);
        }
    }

    return data;
}

function hasViableData(data) {
    for (const key of data.keys()) {
        if (
            key.startsWith("veh_") ||
            key.startsWith("ped_") ||
            key.startsWith("mp_ped_") ||
            key.startsWith("vmenu_string_saved_weapon_loadout_")
        ) {
            return true;
        }
    }
    return false;
}

function getExistingEnhancedKeys() {
    try {
        if (exports["vMenu.Enhanced"] && typeof exports["vMenu.Enhanced"].GetExistingKeys === "function") {
            const keys = exports["vMenu.Enhanced"].GetExistingKeys();
            if (Array.isArray(keys)) {
                return new Set(keys);
            }
        }
    } catch (err) {
        console.warn("[vMenu Migrator] Could not retrieve existing Enhanced keys via export:", err);
    }
    return new Set();
}

let isModalOpen = false;
let focusInterval = null;

function setModalOpenState(open) {
    isModalOpen = open;
    if (open) {
        SetNuiFocus(true, true);
        if (!focusInterval) {
            focusInterval = setInterval(() => {
                if (isModalOpen) {
                    SetNuiFocus(true, true);
                }
            }, 1000);
        }
    } else {
        if (focusInterval) {
            clearInterval(focusInterval);
            focusInterval = null;
        }
        SetNuiFocus(false, false);
    }
}

async function promptMigration(force = false) {
    const status = GetResourceKvpString("vmenu_migration_status");
    if (!force && (status === "migrated" || status === "declined")) {
        return;
    }

    cachedLegacyData = scanLegacyKvps();

    if (!hasViableData(cachedLegacyData)) {
        if (force) {
            console.log("[vMenu Migrator] No legacy vMenu data found to migrate.");
        }
        return;
    }

    if (!cachedLookups) {
        cachedLookups = getLookupData();
    }

    const existingKeys = getExistingEnhancedKeys();
    const { summary } = convertLegacyData(cachedLegacyData, existingKeys, cachedLookups);

    if (summary.total === 0) {
        if (force) {
            console.log("[vMenu Migrator] No convertible data found in legacy KVP.");
        }
        return;
    }

    const theme = GetConvar("vMenu.Enhanced.MenuAppearance.Skin", "default");

    setModalOpenState(true);
    SendNuiMessage(JSON.stringify({
        type: "OPEN_MODAL",
        theme: theme.toLowerCase(),
        counts: {
            vehicles: summary.vehicles,
            peds: summary.peds,
            characters: summary.characters,
            loadouts: summary.loadouts,
            settings: summary.settings,
            categories: summary.categories,
            total: summary.total,
        },
        renamed: summary.renamed,
        skipped: summary.skipped,
        notes: summary.notes,
    }));
}

// NUI Callback: Player clicks "Migrate My Data"
RegisterNuiCallbackType("migrate");
on("__cfx_nui:migrate", (data, cb) => {
    try {
        if (!cachedLegacyData) {
            cachedLegacyData = scanLegacyKvps();
        }
        if (!cachedLookups) {
            cachedLookups = getLookupData();
        }

        const existingKeys = getExistingEnhancedKeys();
        const { bundleJson, summary } = convertLegacyData(cachedLegacyData, existingKeys, cachedLookups);

        let result = null;
        if (exports["vMenu.Enhanced"] && typeof exports["vMenu.Enhanced"].ImportMigrationBundle === "function") {
            result = exports["vMenu.Enhanced"].ImportMigrationBundle(bundleJson);
        } else {
            TriggerEvent("vMenu.Enhanced:ImportMigrationBundle", bundleJson);
            result = { success: true, appliedCount: summary.total };
        }

        SetResourceKvp("vmenu_migration_status", "migrated");
        setModalOpenState(false);

        cb({ ok: true, result });
    } catch (error) {
        console.error("[vMenu Migrator] Migration failed:", error);
        setModalOpenState(false);
        cb({ ok: false, error: String(error) });
    }
});

// NUI Callback: Player clicks "Remind Me Later"
RegisterNuiCallbackType("remindLater");
on("__cfx_nui:remindLater", (data, cb) => {
    setModalOpenState(false);
    cb({ ok: true });
});

// NUI Callback: Player clicks "Decline Migration"
RegisterNuiCallbackType("decline");
on("__cfx_nui:decline", (data, cb) => {
    SetResourceKvp("vmenu_migration_status", "declined");
    setModalOpenState(false);
    cb({ ok: true });
});

on("onResourceStop", (resourceName) => {
    if (GetCurrentResourceName() === resourceName) {
        setModalOpenState(false);
    }
});

// Automatic check on client load (delayed briefly to let vMenu.Enhanced start and load convars)
setTimeout(() => {
    promptMigration(false);
}, 3000);

// Command to clear only vMenu.Enhanced data (leaving legacy vMenu untouched)
RegisterCommand("vmenu_clear_enhanced", () => {
    try {
        if (exports["vMenu.Enhanced"] && typeof exports["vMenu.Enhanced"].ClearAllData === "function") {
            const cleared = exports["vMenu.Enhanced"].ClearAllData();
            console.log(`^2[vMenu Migrator] Cleared ${cleared} saved items from vMenu.Enhanced storage. Legacy vMenu data was NOT touched.^7`);
        } else {
            console.warn("[vMenu Migrator] vMenu.Enhanced export 'ClearAllData' not found. Make sure vMenu.Enhanced is running.");
        }
    } catch (err) {
        console.error("[vMenu Migrator] Failed to clear Enhanced data:", err);
    }
}, false);

// Manual command to re-open or force check: /vmenu_migrate
// Usage:
//   /vmenu_migrate        -> Re-opens the migration modal if viable data exists
//   /vmenu_migrate reset  -> Clears vMenu.Enhanced data, resets migration status, and re-runs check
RegisterCommand("vmenu_migrate", (source, args) => {
    if (args[0] === "reset") {
        try {
            if (exports["vMenu.Enhanced"] && typeof exports["vMenu.Enhanced"].ClearAllData === "function") {
                const count = exports["vMenu.Enhanced"].ClearAllData();
                console.log(`^2[vMenu Migrator] Cleared ${count} saved items from vMenu.Enhanced.^7`);
            }
        } catch (e) {
            console.warn("[vMenu Migrator] Could not invoke ClearAllData export:", e);
        }
        DeleteResourceKvp("vmenu_migration_status");
        console.log("^2[vMenu Migrator] Migration status reset. Running check...^7");
    }
    promptMigration(true);
}, false);

