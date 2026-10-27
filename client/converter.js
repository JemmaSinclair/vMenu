// Port of Tom Grobbe / Vespura's legacy-convert.js for FiveM client runtime.
// Converts legacy vMenu KVP data into vMenu.Enhanced KvpBundle envelopes.

const VEHICLE_VERSION = 2;
const PED_VERSION = 2;
const CHARACTER_VERSION = 2;
const LOADOUT_VERSION = 1;
const SETTING_VERSION = 1;
const TIMECYCLE_VERSION = 2;
const CATEGORY_VERSION = 1;

const IMPORTED_CATEGORY = "Imported from old vMenu";
const IMPORTED_DESCRIPTION = "Brought over from the original vMenu.";
const UNPAINTED = 7;
const STOCK_HEADLIGHT = 255;
const PROP_SLOTS = [0, 1, 2, 6, 7];
const CORE_OVERLAYS = [0, 3, 6, 7, 9, 11];

const OVERLAYS = [
    { slot: 0, style: "blemishesStyle", opacity: "blemishesOpacity" },
    { slot: 1, style: "beardStyle", opacity: "beardOpacity", colour: "beardColor" },
    { slot: 2, style: "eyebrowsStyle", opacity: "eyebrowsOpacity", colour: "eyebrowsColor" },
    { slot: 3, style: "ageingStyle", opacity: "ageingOpacity" },
    { slot: 4, style: "makeupStyle", opacity: "makeupOpacity", colour: "makeupColor" },
    { slot: 5, style: "blushStyle", opacity: "blushOpacity", colour: "blushColor" },
    { slot: 6, style: "complexionStyle", opacity: "complexionOpacity" },
    { slot: 7, style: "sunDamageStyle", opacity: "sunDamageOpacity" },
    { slot: 8, style: "lipstickStyle", opacity: "lipstickOpacity", colour: "lipstickColor" },
    { slot: 9, style: "molesFrecklesStyle", opacity: "molesFrecklesOpacity" },
    { slot: 10, style: "chestHairStyle", opacity: "chestHairOpacity", colour: "chestHairColor" },
    { slot: 11, style: "bodyBlemishesStyle", opacity: "bodyBlemishesOpacity" },
];

const TATTOO_ZONES = [
    ["HairTattoos", "hair"],
    ["HeadTattoos", "head"],
    ["TorsoTattoos", "torso"],
    ["LeftArmTattoos", "leftArm"],
    ["RightArmTattoos", "rightArm"],
    ["LeftLegTattoos", "leftLeg"],
    ["RightLegTattoos", "rightLeg"],
    ["BadgeTattoos", "badges"],
    ["AddonTattoos", "addons"],
];

const SAME_BOOLS = [
    "playerGodMode",
    "playerStayInVehicle",
    "vehicleGodMode",
    "vehicleGodInvincible",
    "vehicleGodEngine",
    "vehicleGodVisual",
    "vehicleGodStrongWheels",
    "vehicleGodRamp",
    "vehicleGodAutoRepair",
    "vehicleEngineAlwaysOn",
    "vehicleAnchorBoat",
    "vehicleSpawnerSpawnInside",
    "vehicleSpawnerReplacePrevious",
    "weaponsNoReload",
    "weaponsUnlimitedAmmo",
    "weaponsUnlimitedParachutes",
];

const RENAMED_BOOLS = {
    fastRun: "playerFastRun",
    fastSwim: "playerFastSwim",
    superJump: "playerSuperJump",
    noRagdoll: "playerNoRagdoll",
    neverWanted: "playerNeverWanted",
    everyoneIgnorePlayer: "playerEveryoneIgnores",
    vehicleNeverDirty: "vehicleKeepClean",
    vehicleNoBikeHelmet: "playerNoHelmet",
    vehicleNoBikeHelemet: "playerNoHelmet",
    autoEquipParachuteWhenInPlane: "weaponsAutoEquipParachute",
    miscJoinQuitNotifications: "displayJoinLeaveNotifications",
    miscDeathNotifications: "displayDeathNotifications",
    miscShowLocation: "displayShowLocation",
    miscLocationBlips: "displayLocationBlips",
    miscShowPlayerBlips: "displayShowPlayerBlips",
    miscShowOverheadNames: "displayShowOverheadNames",
    miscShowTime: "displayShowTime",
    miscRightAlignMenu: "displayRightAlignMenu",
    weaponLoadoutsSetLoadoutOnRespawn: "weaponLoadoutOnRespawn",
    pvEnableVehicleBlip: "personalVehicleBlip",
};

const HANDLED_ELSEWHERE = new Set([
    "miscSpeedoKmh",
    "miscSpeedoMph",
    "vehicleDisablePlaneTurbulence",
    "vehicleDisableHelicopterTurbulence",
    "clothingAnimationType",
    "miscLastTimeCycleModifierIndex",
    "miscLastTimeCycleModifierStrength",
    "miscRespawnDefaultCharacter",
]);

const OLD_GLOW_TO_NEW = { 0: 1, 1: 0, 2: 2, 3: 3 };

function int(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

function float(value, fallback = 0, low = -Infinity, high = Infinity) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(high, Math.max(low, Math.round(number * 1000) / 1000));
}

function bool(value) {
    return value === true || String(value).toLowerCase() === "true";
}

function text(value) {
    return typeof value === "string" ? value : "";
}

function envelope(key, type, version, value) {
    return JSON.stringify({ key, value, type, version });
}

function isUncategorized(name) {
    return !name || name.trim().length === 0 || name.trim().toLowerCase() === "uncategorized";
}

function vehicleFrom(name, old) {
    const colors = old.colors && typeof old.colors === "object" ? old.colors : {};
    const channel = (prefix, red, green, blue) => {
        const values = [colors[red] ?? old[red], colors[green] ?? old[green], colors[blue] ?? old[blue]];
        return values.every(val => Number.isFinite(Number(val)) && Number(val) >= 0)
            ? { [prefix + "Red"]: int(values[0]), [prefix + "Green"]: int(values[1]), [prefix + "Blue"]: int(values[2]) }
            : { [prefix + "Red"]: null, [prefix + "Green"]: null, [prefix + "Blue"]: null };
    };

    const mods = Object.entries(old.mods && typeof old.mods === "object" ? old.mods : {})
        .map(([slot, value]) => ({ slot: int(slot, -1), value: int(value, -1) }))
        .filter(mod => mod.slot >= 0 && mod.slot <= 49 && (mod.slot < 17 || mod.slot > 22))
        .sort((a, b) => a.slot - b.slot);

    const extras = Object.entries(old.extras && typeof old.extras === "object" ? old.extras : {})
        .map(([id, on]) => ({ id: int(id, -1), on: bool(on) }))
        .filter(extra => extra.id >= 0 && extra.id < 20)
        .sort((a, b) => a.id - b.id);

    const headlight = int(old.headlightColor, -1);

    return {
        name,
        description: "",
        category: isUncategorized(text(old.Category)) ? IMPORTED_CATEGORY : old.Category.trim(),
        appearance: {
            modelName: "",
            modelHash: int(old.model) >>> 0,
            mods,
            customTyres: bool(old.customWheels),
            wheelType: int(old.wheelType),
            turbo: bool(old.turbo),
            tyreSmoke: bool(old.tyreSmoke),
            xenonLights: bool(old.xenonHeadlights),
            bulletproofTyres: bool(old.bulletProofTires),
            driftTyres: false,
            primaryPaintType: old.PrimaryPaintFinish === undefined ? UNPAINTED : int(old.PrimaryPaintFinish, UNPAINTED),
            primaryColor: int(colors.primary),
            secondaryPaintType: old.SecondaryPaintFinish === undefined ? UNPAINTED : int(old.SecondaryPaintFinish, UNPAINTED),
            secondaryColor: int(colors.secondary),
            pearlescentColor: int(colors.pearlescent),
            wheelColor: int(colors.wheels),
            dashboardColor: int(colors.dash),
            interiorColor: int(colors.trim),
            ...channel("customPrimary", "customPrimaryR", "customPrimaryGreen" in colors ? "customPrimaryGreen" : "customPrimaryG", "customPrimaryB"),
            ...channel("customSecondary", "customSecondaryR", "customSecondaryGreen" in colors ? "customSecondaryGreen" : "customSecondaryG", "customSecondaryB"),
            paintFade: float(old.enveffScale, 0, 0, 1),
            headlightColor: headlight >= 0 && headlight <= 12 ? headlight : STOCK_HEADLIGHT,
            ...channel("customXenon", "customheadlightR", "customheadlightG", "customheadlightB"),
            neonFront: bool(old.neonFront),
            neonRear: bool(old.neonBack),
            neonLeft: bool(old.neonLeft),
            neonRight: bool(old.neonRight),
            neonRed: int(colors.neonR, 255),
            neonGreen: int(colors.neonG, 255),
            neonBlue: int(colors.neonB, 255),
            tyreSmokeRed: int(colors.tyresmokeR, 255),
            tyreSmokeGreen: int(colors.tyresmokeG, 255),
            tyreSmokeBlue: int(colors.tyresmokeB, 255),
            livery: int(old.livery, -1),
            roofLivery: -1,
            extras,
            windowTint: int(old.windowTint, -1),
            plateText: text(old.plateText),
            plateStyle: int(old.plateStyle),
            dirtLevel: 0,
        },
    };
}

function propsFrom(source, read) {
    const props = [];
    for (const slot of PROP_SLOTS) {
        const prop = read(source, slot);
        if (prop && prop.drawable >= 0) {
            props.push({ slot, drawable: prop.drawable, texture: Math.max(0, prop.texture), collection: "", localDrawable: -1 });
        }
    }
    return props;
}

function pedFrom(name, old, lookups) {
    const drawables = old.drawableVariations || {};
    const textures = old.drawableVariationTextures || {};
    const components = [];

    for (let slot = 0; slot <= 11; slot++) {
        if (drawables[slot] === undefined) continue;
        components.push({
            slot,
            drawable: Math.max(0, int(drawables[slot])),
            texture: Math.max(0, int(textures[slot])),
            palette: 0,
            collection: "",
            localDrawable: -1,
        });
    }

    const props = propsFrom(old, (source, slot) => {
        const drawable = int((source.props || {})[slot], -1);
        const texture = int((source.propTextures || {})[slot], -1);
        return { drawable: texture < 0 ? -1 : drawable, texture };
    });

    const hash = int(old.model) >>> 0;

    return {
        name,
        description: "",
        category: IMPORTED_CATEGORY,
        appearance: { modelName: lookups.pedNames.get(hash) || "", modelHash: hash, components, props },
        movementClipset: "",
    };
}

function pairs(list) {
    return (Array.isArray(list) ? list : [])
        .map(pair => ({ collection: text(pair && pair.Key), name: text(pair && pair.Value) }))
        .filter(pair => pair.collection && pair.name);
}

function characterFrom(name, old) {
    const blend = old.PedHeadBlendData || {};
    const looks = old.PedAppearance || {};
    const features = (old.FaceShapeFeatures && old.FaceShapeFeatures.features) || {};
    const clothes = (old.DrawableVariations && old.DrawableVariations.clothes) || {};
    const oldProps = (old.PropVariations && old.PropVariations.props) || {};

    const overlay = spec => ({
        slot: spec.slot,
        style: Math.max(0, int(looks[spec.style])),
        opacity: float(looks[spec.opacity], 0, 0, 1),
        colour: spec.colour ? Math.max(0, int(looks[spec.colour])) : 0,
    });

    const tattoos = {};
    for (const [from, to] of TATTOO_ZONES) {
        tattoos[to] = pairs((old.PedTatttoos || {})[from]);
    }

    const components = [];
    for (let slot = 0; slot <= 11; slot++) {
        const piece = clothes[slot];
        if (!piece || int(piece.Key, -1) < 0) continue;
        components.push({
            slot,
            drawable: int(piece.Key),
            texture: Math.max(0, int(piece.Value)),
            palette: 0,
            collection: "",
            localDrawable: -1,
        });
    }

    const props = propsFrom(oldProps, (source, slot) => {
        const piece = source[slot];
        return piece ? { drawable: int(piece.Key, -1), texture: int(piece.Value, 0) } : null;
    });

    const hairPiece = clothes[2];
    const hairOverlay = looks.HairOverlay || {};
    const hasDecoration = text(hairOverlay.Key) && text(hairOverlay.Value);

    const style = {
        name: "Default",
        description: "",
        hairStyle: hairPiece && int(hairPiece.Key, -1) >= 0 ? int(hairPiece.Key) : Math.max(0, int(looks.hairStyle)),
        hairColour: Math.max(0, int(looks.hairColor)),
        hairHighlight: Math.max(0, int(looks.hairHighlightColor)),
        hairDecorationCollection: hasDecoration ? hairOverlay.Key : "",
        hairDecorationName: hasDecoration ? hairOverlay.Value : "",
        overlays: OVERLAYS.filter(spec => !CORE_OVERLAYS.includes(spec.slot)).map(overlay),
    };

    const outfit = { name: "Default", description: "", outfit: { components, props } };

    return {
        name,
        description: "",
        category: isUncategorized(text(old.Category)) ? IMPORTED_CATEGORY : old.Category.trim(),
        core: {
            isMale: old.IsMale === undefined ? true : bool(old.IsMale),
            blend: {
                firstShape: Math.max(0, int(blend.FirstFaceShape)),
                secondShape: Math.max(0, int(blend.SecondFaceShape)),
                thirdShape: Math.max(0, int(blend.ThirdFaceShape)),
                firstSkin: Math.max(0, int(blend.FirstSkinTone)),
                secondSkin: Math.max(0, int(blend.SecondSkinTone)),
                thirdSkin: Math.max(0, int(blend.ThirdSkinTone)),
                shapeMix: float(blend.ParentFaceShapePercent, 0.5, 0, 1),
                skinMix: float(blend.ParentSkinTonePercent, 0.5, 0, 1),
                thirdMix: 0,
                isParent: bool(blend.IsParentInheritance),
            },
            faceFeatures: Array.from({ length: 20 }, (_, index) => float(features[index], 0, -1, 1)),
            eyeColour: Math.max(0, int(looks.eyeColor)),
            overlays: OVERLAYS.filter(spec => CORE_OVERLAYS.includes(spec.slot)).map(overlay),
            tattoos,
        },
        currentStyle: style,
        currentOutfit: outfit,
        styles: [style],
        outfits: [outfit],
        lastStyle: style.name,
        lastOutfit: outfit.name,
        facialExpression: text(old.FacialExpression) || "mood_Normal_1",
        movementClipset: "",
    };
}

function loadoutFrom(name, old, lookups) {
    const notes = [];
    const weapons = [];
    let lostComponents = 0;

    const list = Array.isArray(old) ? old : [];
    for (const weapon of list) {
        const spawnName = text(weapon && weapon.SpawnName).toLowerCase();
        if (!spawnName) continue;

        if (lookups.weaponNames.size > 0 && !lookups.weaponNames.has(spawnName)) {
            notes.push(spawnName + " is not a standard weapon. It only loads if the server has it.");
        }

        const components = [];
        for (const hash of Object.values((weapon && weapon.Components) || {})) {
            const known = lookups.componentNames.get(int(hash) >>> 0);
            if (known) {
                components.push(known);
            } else {
                lostComponents++;
            }
        }

        const ammo = int(weapon.CurrentAmmo, -1);
        weapons.push({
            spawnName,
            ammo: ammo < 0 ? Math.max(0, int(weapon.GetMaxAmmo, 250)) : ammo,
            tint: Math.max(0, int(weapon.CurrentTint)),
            components,
        });
    }

    if (lostComponents > 0) {
        notes.push(lostComponents + " attachment(s) could not be recognised and were left off.");
    }

    return { value: { name, weapons }, notes };
}

function categoryEntry(name) {
    return { name, description: name === IMPORTED_CATEGORY ? IMPORTED_DESCRIPTION : "" };
}

function categoryFrom(old) {
    return { name: text(old.Name).trim(), description: text(old.Description) };
}

function parseJsonSafe(value) {
    if (typeof value !== "string") return null;
    try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === "object" ? parsed : null;
    } catch {
        return null;
    }
}

/**
 * Resolves a save name avoiding collisions with existing Enhanced keys.
 * If 'vmenu_vehicle_Adder' already exists, renames to 'Adder (Legacy)', 'Adder (Legacy 2)', etc.
 */
function resolveCollision(prefix, baseName, existingKeys, pendingKeys) {
    let candidate = baseName;
    let key = prefix + candidate;
    let counter = 1;

    while (existingKeys.has(key) || pendingKeys.has(key)) {
        counter++;
        candidate = counter === 2 ? `${baseName} (Legacy)` : `${baseName} (Legacy ${counter - 1})`;
        key = prefix + candidate;
    }

    pendingKeys.add(key);
    return { resolvedName: candidate, resolvedKey: key, renamed: candidate !== baseName };
}

/**
 * Converts a map of raw legacy KVP keys/values into an Enhanced KvpBundle.
 * @param {Map<string, any>} legacyData - Map of legacy KVP key to raw value
 * @param {Set<string>} existingEnhancedKeys - Set of keys currently present in vMenu.Enhanced
 * @param {object} lookups - Lookup data from lookup_data.js
 * @returns {{ bundle: object, bundleJson: string, summary: object }}
 */
function convertLegacyData(legacyData, existingEnhancedKeys = new Set(), lookups) {
    const items = [];
    const pendingKeys = new Set();
    const characters = new Map();
    const loadouts = new Map();
    const vehicleCategories = new Map();
    const characterCategories = new Map();
    let anyPed = false;

    const summary = {
        vehicles: 0,
        peds: 0,
        characters: 0,
        loadouts: 0,
        settings: 0,
        categories: 0,
        total: 0,
        skipped: [],
        renamed: [],
        notes: [],
    };

    const add = (group, name, key, type, version, value, notes = []) => {
        const raw = envelope(key, type, version, value);
        items.push({ Key: key, Raw: raw });
        if (notes.length > 0) {
            summary.notes.push({ name, group, notes });
        }
    };

    // 1. Process explicit categories first
    for (const [key, rawVal] of legacyData.entries()) {
        if (key.startsWith("saved_veh_category_") || key.startsWith("mp_character_category_")) {
            const isVehicle = key.startsWith("saved_veh_category_");
            const parsed = parseJsonSafe(rawVal);
            if (parsed) {
                const cat = categoryFrom(parsed);
                if (!isUncategorized(cat.name)) {
                    (isVehicle ? vehicleCategories : characterCategories).set(cat.name.toLowerCase(), cat);
                }
            }
        }
    }

    // 2. Process Saved Vehicles (veh_*)
    for (const [key, rawVal] of legacyData.entries()) {
        if (key.startsWith("veh_")) {
            const origName = key.slice(4).trim();
            if (!origName) {
                summary.skipped.push({ name: key, reason: "Save has no name." });
                continue;
            }
            const parsed = parseJsonSafe(rawVal);
            if (!parsed) {
                summary.skipped.push({ name: origName, reason: "Save data is corrupted." });
                continue;
            }
            if (parsed.version === undefined || !parsed.colors) {
                summary.skipped.push({ name: origName, reason: "Saved by very old vMenu (pre-2018), format cannot be converted." });
                continue;
            }
            if (!int(parsed.model)) {
                summary.skipped.push({ name: origName, reason: "Save has no vehicle model." });
                continue;
            }

            const collision = resolveCollision("vmenu_vehicle_", origName, existingEnhancedKeys, pendingKeys);
            if (collision.renamed) {
                summary.renamed.push({ original: origName, renamed: collision.resolvedName, group: "Vehicles" });
            }

            const notes = [];
            const vehicle = vehicleFrom(collision.resolvedName, parsed);
            if (vehicle.category && !vehicleCategories.has(vehicle.category.toLowerCase())) {
                vehicleCategories.set(vehicle.category.toLowerCase(), categoryEntry(vehicle.category));
            }

            add("Saved vehicles", vehicle.name, collision.resolvedKey, "json", VEHICLE_VERSION, vehicle, notes);
            summary.vehicles++;
        }
    }

    // 3. Process Saved Peds (ped_*)
    for (const [key, rawVal] of legacyData.entries()) {
        if (key.startsWith("ped_")) {
            const origName = key.slice(4).trim();
            if (!origName) {
                summary.skipped.push({ name: key, reason: "Save has no name." });
                continue;
            }
            const parsed = parseJsonSafe(rawVal);
            if (!parsed) {
                summary.skipped.push({ name: origName, reason: "Save data is corrupted." });
                continue;
            }
            if (int(parsed.version) !== 1 || !int(parsed.model)) {
                summary.skipped.push({ name: origName, reason: "Saved by very old vMenu in an incompatible format." });
                continue;
            }

            const collision = resolveCollision("vmenu_ped_", origName, existingEnhancedKeys, pendingKeys);
            if (collision.renamed) {
                summary.renamed.push({ original: origName, renamed: collision.resolvedName, group: "Peds" });
            }

            const notes = parsed.isMpPed
                ? ["Multiplayer ped saved as a normal ped (lacks face/hair)."]
                : [];

            const ped = pedFrom(collision.resolvedName, parsed, lookups);
            anyPed = true;
            add("Saved peds", ped.name, collision.resolvedKey, "json", PED_VERSION, ped, notes);
            summary.peds++;
        }
    }

    // 4. Process Custom MP Characters (mp_ped_*)
    for (const [key, rawVal] of legacyData.entries()) {
        if (key.startsWith("mp_ped_")) {
            const origName = key.slice(7).trim();
            if (!origName) {
                summary.skipped.push({ name: key, reason: "Save has no name." });
                continue;
            }
            const parsed = parseJsonSafe(rawVal);
            if (!parsed) {
                summary.skipped.push({ name: origName, reason: "Save data is corrupted." });
                continue;
            }
            if (!parsed.PedHeadBlendData || !parsed.PedAppearance) {
                summary.skipped.push({ name: origName, reason: "Missing face or appearance data." });
                continue;
            }

            const collision = resolveCollision("vmenu_mpchar_", origName, existingEnhancedKeys, pendingKeys);
            if (collision.renamed) {
                summary.renamed.push({ original: origName, renamed: collision.resolvedName, group: "Characters" });
            }

            const notes = ["DLC clothes matched by number may shift across updates."];
            const character = characterFrom(collision.resolvedName, parsed);

            if (character.category && !characterCategories.has(character.category.toLowerCase())) {
                characterCategories.set(character.category.toLowerCase(), categoryEntry(character.category));
            }

            characters.set(origName, character.name);
            add("Custom characters", character.name, collision.resolvedKey, "json", CHARACTER_VERSION, character, notes);
            summary.characters++;
        }
    }

    // 5. Process Weapon Loadouts (vmenu_string_saved_weapon_loadout_*)
    for (const [key, rawVal] of legacyData.entries()) {
        if (key.startsWith("vmenu_string_saved_weapon_loadout_")) {
            const origName = key.slice("vmenu_string_saved_weapon_loadout_".length).trim();
            if (!origName) {
                summary.skipped.push({ name: key, reason: "Save has no name." });
                continue;
            }
            const parsed = parseJsonSafe(rawVal);
            if (!parsed) {
                summary.skipped.push({ name: origName, reason: "Save data is corrupted." });
                continue;
            }

            const collision = resolveCollision("vmenu_weaponloadout_", origName, existingEnhancedKeys, pendingKeys);
            if (collision.renamed) {
                summary.renamed.push({ original: origName, renamed: collision.resolvedName, group: "Loadouts" });
            }

            const { value: loadout, notes } = loadoutFrom(collision.resolvedName, parsed, lookups);
            loadouts.set(origName, loadout.name);
            add("Weapon loadouts", loadout.name, collision.resolvedKey, "json", LOADOUT_VERSION, loadout, notes);
            summary.loadouts++;
        }
    }

    // 6. Add Categories (vehicles, characters, peds)
    for (const category of vehicleCategories.values()) {
        const key = "vmenu_vehcat_" + category.name;
        if (!existingEnhancedKeys.has(key) && !pendingKeys.has(key)) {
            pendingKeys.add(key);
            add("Vehicle categories", category.name, key, "json", CATEGORY_VERSION, category);
            summary.categories++;
        }
    }

    if (anyPed) {
        const pedCat = categoryEntry(IMPORTED_CATEGORY);
        const key = "vmenu_pedcat_" + pedCat.name;
        if (!existingEnhancedKeys.has(key) && !pendingKeys.has(key)) {
            pendingKeys.add(key);
            add("Ped categories", pedCat.name, key, "json", CATEGORY_VERSION, pedCat);
            summary.categories++;
        }
    }

    for (const category of characterCategories.values()) {
        const key = "vmenu_charcat_" + category.name;
        if (!existingEnhancedKeys.has(key) && !pendingKeys.has(key)) {
            pendingKeys.add(key);
            add("Character categories", category.name, key, "json", CATEGORY_VERSION, category);
            summary.categories++;
        }
    }

    // 7. Process Settings
    const writtenSettings = new Set();
    const addSetting = (name, type, value, from) => {
        const key = "vmenu_default_" + name;
        if (writtenSettings.has(name) || existingEnhancedKeys.has(key)) return;
        writtenSettings.add(name);
        pendingKeys.add(key);
        add("Settings", name, key, type, SETTING_VERSION, value, from ? ["From legacy " + from] : []);
        summary.settings++;
    };

    for (const name of SAME_BOOLS) {
        const val = legacyData.get("settings_" + name);
        if (val !== undefined && val !== null) {
            addSetting(name, "bool", bool(val), name);
        }
    }

    for (const [from, to] of Object.entries(RENAMED_BOOLS)) {
        const val = legacyData.get("settings_" + from);
        if (val !== undefined && val !== null) {
            addSetting(to, "bool", bool(val), from);
        }
    }

    const kmh = legacyData.get("settings_miscSpeedoKmh");
    const mph = legacyData.get("settings_miscSpeedoMph");
    if (kmh !== undefined || mph !== undefined) {
        addSetting("displaySpeedometer", "int", (bool(kmh) ? 1 : 0) + (bool(mph) ? 2 : 0), "speedometer");
    }

    const planeTurb = legacyData.get("settings_vehicleDisablePlaneTurbulence");
    if (planeTurb !== undefined && planeTurb !== null) {
        addSetting("vehiclePlaneTurbulence", "int", bool(planeTurb) ? 0 : 100, "vehicleDisablePlaneTurbulence");
    }

    const heliTurb = legacyData.get("settings_vehicleDisableHelicopterTurbulence");
    if (heliTurb !== undefined && heliTurb !== null) {
        addSetting("vehicleHeliTurbulence", "int", bool(heliTurb) ? 0 : 100, "vehicleDisableHelicopterTurbulence");
    }

    const glow = legacyData.get("settings_clothingAnimationType");
    if (glow !== undefined && glow !== null && OLD_GLOW_TO_NEW[int(glow, -1)] !== undefined) {
        addSetting("playerClothingGlow", "int", OLD_GLOW_TO_NEW[int(glow)], "clothingAnimationType");
    }

    const cycle = legacyData.get("settings_miscLastTimeCycleModifierIndex");
    const strength = legacyData.get("settings_miscLastTimeCycleModifierStrength");
    if (cycle !== undefined && cycle !== null) {
        const cycleName = lookups.legacyTimecycles ? lookups.legacyTimecycles[int(cycle, -1)] : null;
        if (cycleName && !existingEnhancedKeys.has("vmenu_timecycles")) {
            const intensity = Math.min(20, Math.max(0, int(strength, 10)));
            add("Settings", "Time cycle", "vmenu_timecycles", "json", TIMECYCLE_VERSION, { names: [cycleName], intensity }, [
                "Legacy timecycle: " + cycleName,
            ]);
            summary.settings++;
        }
    }

    const defChar = text(legacyData.get("vmenu_default_character")).replace(/^mp_ped_/, "");
    const respawnAsDef = legacyData.get("settings_miscRespawnDefaultCharacter");
    if (defChar) {
        if (respawnAsDef !== undefined && !bool(respawnAsDef)) {
            summary.skipped.push({ name: "Default character", reason: "Disabled in legacy settings." });
        } else if (characters.has(defChar)) {
            addSetting("defaultCharacterName", "string", characters.get(defChar), "default character");
        }
    }

    const defLoadout = text(legacyData.get("vmenu_string_default_loadout")).replace(/^vmenu_string_saved_weapon_loadout_/, "");
    if (defLoadout && loadouts.has(defLoadout)) {
        addSetting("weaponLoadoutDefaultName", "string", loadouts.get(defLoadout), "default loadout");
    }

    summary.total = summary.vehicles + summary.peds + summary.characters + summary.loadouts + summary.settings + summary.categories;

    const bundle = {
        Format: "vmenu.enhanced.kvp",
        Version: 1,
        CreatedAt: new Date().toISOString(),
        Entries: items,
    };

    return {
        bundle,
        bundleJson: JSON.stringify(bundle),
        summary,
    };
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { convertLegacyData, resolveCollision, vehicleFrom, pedFrom, characterFrom, loadoutFrom };
}

