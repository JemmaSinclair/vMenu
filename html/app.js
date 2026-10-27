// Client UI logic for vMenu Migrator modal

const overlay = document.getElementById("migrator-overlay");
const countVehicles = document.getElementById("count-vehicles");
const countCharacters = document.getElementById("count-characters");
const countPeds = document.getElementById("count-peds");
const countLoadouts = document.getElementById("count-loadouts");
const countSettings = document.getElementById("count-settings");

const detailsDrawer = document.getElementById("details-drawer");
const btnToggleDetails = document.getElementById("btn-toggle-details");
const toggleArrow = btnToggleDetails.querySelector(".toggle-arrow");
const toggleLabel = btnToggleDetails.querySelector("span:first-child");

const renamedContainer = document.getElementById("renamed-list-container");
const renamedList = document.getElementById("renamed-list");

const officialUrlInput = document.getElementById("official-url");
const btnCopyLink = document.getElementById("btn-copy-link");
const toast = document.getElementById("toast");

const btnMigrate = document.getElementById("btn-migrate");
const btnRemind = document.getElementById("btn-remind");
const btnDecline = document.getElementById("btn-decline");

let isBusy = false;

function showToast(message) {
    toast.textContent = message;
    toast.classList.add("shown");
    setTimeout(() => {
        toast.classList.remove("shown");
    }, 2200);
}

function applyTheme(themeName) {
    const safeTheme = (themeName || "default").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    document.body.className = "";
    document.body.classList.add("theme-" + safeTheme);
}

window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "OPEN_MODAL") return;

    applyTheme(data.theme);

    const counts = data.counts || {};
    countVehicles.textContent = counts.vehicles || 0;
    countCharacters.textContent = counts.characters || 0;
    countPeds.textContent = counts.peds || 0;
    countLoadouts.textContent = counts.loadouts || 0;
    countSettings.textContent = counts.settings || 0;

    // Renamed items
    renamedList.innerHTML = "";
    if (data.renamed && data.renamed.length > 0) {
        renamedContainer.style.display = "block";
        for (const item of data.renamed) {
            const li = document.createElement("li");
            li.textContent = `${item.original} → ${item.renamed} (${item.group})`;
            renamedList.appendChild(li);
        }
    } else {
        renamedContainer.style.display = "none";
    }

    // Reset drawer state
    detailsDrawer.classList.remove("open");
    toggleLabel.textContent = "Show more details";

    // Reset button states
    isBusy = false;
    btnMigrate.disabled = false;
    btnMigrate.textContent = "Migrate My Data";
    btnRemind.disabled = false;
    btnDecline.disabled = false;

    overlay.classList.add("shown");
});

// Toggle details drawer
btnToggleDetails.addEventListener("click", () => {
    const isOpen = detailsDrawer.classList.toggle("open");
    toggleLabel.textContent = isOpen ? "Hide details" : "Show more details";
});

// Copy official tool URL
btnCopyLink.addEventListener("click", () => {
    const url = officialUrlInput.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(() => {
            showToast("Copied link to clipboard!");
        }).catch(() => {
            fallbackCopy();
        });
    } else {
        fallbackCopy();
    }
});

function fallbackCopy() {
    officialUrlInput.select();
    officialUrlInput.setSelectionRange(0, 99999);
    try {
        document.execCommand("copy");
        showToast("Copied link to clipboard!");
    } catch {
        showToast("Please copy the link manually.");
    }
}

// Action: Migrate
btnMigrate.addEventListener("click", () => {
    if (isBusy) return;
    isBusy = true;
    btnMigrate.disabled = true;
    btnRemind.disabled = true;
    btnDecline.disabled = true;
    btnMigrate.textContent = "Migrating...";

    fetch("https://vMenu/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({}),
    }).then((res) => res.json()).then(() => {
        overlay.classList.remove("shown");
    }).catch(() => {
        overlay.classList.remove("shown");
    });
});

// Action: Remind Later
btnRemind.addEventListener("click", () => {
    if (isBusy) return;
    isBusy = true;
    fetch("https://vMenu/remindLater", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({}),
    }).finally(() => {
        overlay.classList.remove("shown");
    });
});

// Action: Decline
btnDecline.addEventListener("click", () => {
    if (isBusy) return;
    isBusy = true;
    fetch("https://vMenu/decline", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=UTF-8" },
        body: JSON.stringify({}),
    }).finally(() => {
        overlay.classList.remove("shown");
    });
});

// ESC key support (equivalent to Remind Later)
window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("shown") && !isBusy) {
        btnRemind.click();
    }
});

