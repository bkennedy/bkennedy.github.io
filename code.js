const PAYLOAD_SIZE = 63;
const PROFILE_DATA_SIZE = 956;

let device = null;

// Profile library - array of profile objects
let profileLibrary = [];

// Assigned profiles to slots (indices into profileLibrary, or null if empty)
let slotAssignments = [null, null, null];

// Current editing profile index (null if creating new)
let editingProfileIndex = null;

// Original profile state when editor opened (for detecting changes)
let originalProfileState = null;

// Current screen: 'main', 'editor', 'viewer'
let currentScreen = 'main';

// PlayStation to Switch button mapping
const switchMapping = {
    "0": { ps: "nothing", switch: "" },
    "1": { ps: "circle", switch: "A" },
    "2": { ps: "cross", switch: "B" },
    "3": { ps: "triangle", switch: "X" },
    "4": { ps: "square", switch: "Y" },
    "5": { ps: "up", switch: "up" },
    "6": { ps: "down", switch: "down" },
    "7": { ps: "left", switch: "left" },
    "8": { ps: "right", switch: "right" },
    "9": { ps: "L1", switch: "L" },
    "10": { ps: "R1", switch: "R" },
    "11": { ps: "L2", switch: "ZL" },
    "12": { ps: "R2", switch: "ZR" },
    "13": { ps: "L3", switch: "LS" },
    "14": { ps: "R3", switch: "RS" },
    "15": { ps: "options", switch: "+" },
    "16": { ps: "create", switch: "-" },
    "17": { ps: "PS", switch: "Home" },
    "18": { ps: "touchpad", switch: "Capture" },
    "101": { ps: "left stick", switch: "L Stick" },
    "102": { ps: "right stick", switch: "R Stick" }
};

// Standard labels (PlayStation only)
const standardLabels = {
    "0": "nothing",
    "1": "circle",
    "2": "cross",
    "3": "triangle",
    "4": "square",
    "5": "up",
    "6": "down",
    "7": "left",
    "8": "right",
    "9": "L1",
    "10": "R1",
    "11": "L2",
    "12": "R2",
    "13": "L3",
    "14": "R3",
    "15": "options",
    "16": "create",
    "17": "PS",
    "18": "touchpad",
    "101": "left stick",
    "102": "right stick"
};

document.addEventListener("DOMContentLoaded", function () {
    // Generate editor button rows
    generateEditorButtons();
    generateEditorExpansionPorts();
    
    // Device buttons
    document.getElementById("open_device").addEventListener("click", open_device);
    document.getElementById("load_from_device").addEventListener("click", load_from_device);
    document.getElementById("save_to_device").addEventListener("click", save_to_device);
    
    // Import/Export
    document.getElementById("export_profiles").addEventListener("click", export_profiles);
    document.getElementById("import_profiles").addEventListener("click", () => document.getElementById("import_file_input").click());
    document.getElementById("import_file_input").addEventListener("change", import_profiles);
    
    // Add profile button
    document.getElementById("add_profile_btn").addEventListener("click", openEditorForNew);
    
    // Editor buttons
    document.getElementById("back_to_list").addEventListener("click", handleBackButton);
    document.getElementById("save_profile_to_library").addEventListener("click", saveProfileToLibrary);
    
    // Discard changes button in modal
    document.getElementById("discardChangesBtn").addEventListener("click", function() {
        const modal = bootstrap.Modal.getInstance(document.getElementById('unsavedChangesModal'));
        modal.hide();
        doCloseEditor();
    });
    
    // Switch mapping checkbox
    document.getElementById("show_switch_mapping").addEventListener("change", function() {
        updateAllDropdownLabels(this.checked);
    });
    
    // Expansion port visibility toggles
    for (let port = 1; port <= 4; port++) {
        document.getElementById(`editor_e${port}_mapping1_dropdown`).addEventListener("change", () => {
            updateExpansionPortVisibility(port);
        });
    }
    
    // Name validation on input
    document.getElementById("editor_name_input").addEventListener("input", validateProfileName);

    device_buttons_set_disabled_state(true);

    if ("hid" in navigator) {
        navigator.hid.addEventListener('disconnect', hid_on_disconnect);
    } else {
        display_error("Your browser doesn't support WebHID. Try Chrome (desktop version) or a Chrome-based browser.");
    }
    
    renderProfileList();
    updateSlotDisplay();
});

function generateEditorButtons() {
    const container = document.getElementById("editor-buttons-container");
    let html = "";
    
    for (let btn = 1; btn <= 9; btn++) {
        html += `
            <div class="row mb-3">
                <div class="col-3 text-end">
                    <label class="col-form-label">Button ${btn}</label>
                </div>
                <div class="col-auto">
                    <select class="form-select" id="editor_b${btn}_mapping1_dropdown">
                        ${getButtonOptions()}
                    </select>
                </div>
                <div class="col-auto">
                    <label class="col-form-label">+</label>
                </div>
                <div class="col-auto">
                    <select class="form-select" id="editor_b${btn}_mapping2_dropdown">
                        ${getButtonOptions()}
                    </select>
                </div>
                <div class="col-auto col-form-label">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="editor_b${btn}_toggle_checkbox">
                        <label class="form-check-label" for="editor_b${btn}_toggle_checkbox">toggle</label>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function generateEditorExpansionPorts() {
    const container = document.getElementById("editor-expansion-container");
    let html = "";
    
    for (let port = 1; port <= 4; port++) {
        html += `
            <div class="row mb-3" id="editor_e${port}_row">
                <div class="col-3 text-end">
                    <label class="col-form-label">E${port}</label>
                </div>
                <div class="col-auto">
                    <select class="form-select" id="editor_e${port}_mapping1_dropdown">
                        ${getExpansionPortOptions()}
                    </select>
                </div>
                <div class="col-auto editor_e${port}_button_setting d-none">
                    <label class="col-form-label">+</label>
                </div>
                <div class="col-auto editor_e${port}_button_setting d-none">
                    <select class="form-select" id="editor_e${port}_mapping2_dropdown">
                        ${getButtonOptions()}
                    </select>
                </div>
                <div class="col-auto col-form-label editor_e${port}_button_setting d-none">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="editor_e${port}_toggle_checkbox">
                        <label class="form-check-label" for="editor_e${port}_toggle_checkbox">toggle</label>
                    </div>
                </div>
                <div class="col-auto col-form-label editor_e${port}_button_setting d-none">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="editor_e${port}_analog_checkbox">
                        <label class="form-check-label" for="editor_e${port}_analog_checkbox">analog</label>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = html;
}

function getButtonOptions(showSwitch = false) {
    return `
        <option value="0">${getLabel("0", showSwitch)}</option>
        <option value="1">${getLabel("1", showSwitch)}</option>
        <option value="2">${getLabel("2", showSwitch)}</option>
        <option value="3">${getLabel("3", showSwitch)}</option>
        <option value="4">${getLabel("4", showSwitch)}</option>
        <option value="5">${getLabel("5", showSwitch)}</option>
        <option value="6">${getLabel("6", showSwitch)}</option>
        <option value="7">${getLabel("7", showSwitch)}</option>
        <option value="8">${getLabel("8", showSwitch)}</option>
        <option value="9">${getLabel("9", showSwitch)}</option>
        <option value="10">${getLabel("10", showSwitch)}</option>
        <option value="11">${getLabel("11", showSwitch)}</option>
        <option value="12">${getLabel("12", showSwitch)}</option>
        <option value="13">${getLabel("13", showSwitch)}</option>
        <option value="14">${getLabel("14", showSwitch)}</option>
        <option value="15">${getLabel("15", showSwitch)}</option>
        <option value="16">${getLabel("16", showSwitch)}</option>
        <option value="17">${getLabel("17", showSwitch)}</option>
        <option value="18">${getLabel("18", showSwitch)}</option>
    `;
}

function getExpansionPortOptions(showSwitch = false) {
    return `
        <option value="0">${getLabel("0", showSwitch)}</option>
        <option value="101">${getLabel("101", showSwitch)}</option>
        <option value="102">${getLabel("102", showSwitch)}</option>
        <option value="1">${getLabel("1", showSwitch)}</option>
        <option value="2">${getLabel("2", showSwitch)}</option>
        <option value="3">${getLabel("3", showSwitch)}</option>
        <option value="4">${getLabel("4", showSwitch)}</option>
        <option value="5">${getLabel("5", showSwitch)}</option>
        <option value="6">${getLabel("6", showSwitch)}</option>
        <option value="7">${getLabel("7", showSwitch)}</option>
        <option value="8">${getLabel("8", showSwitch)}</option>
        <option value="9">${getLabel("9", showSwitch)}</option>
        <option value="10">${getLabel("10", showSwitch)}</option>
        <option value="11">${getLabel("11", showSwitch)}</option>
        <option value="12">${getLabel("12", showSwitch)}</option>
        <option value="13">${getLabel("13", showSwitch)}</option>
        <option value="14">${getLabel("14", showSwitch)}</option>
        <option value="15">${getLabel("15", showSwitch)}</option>
        <option value="16">${getLabel("16", showSwitch)}</option>
        <option value="17">${getLabel("17", showSwitch)}</option>
        <option value="18">${getLabel("18", showSwitch)}</option>
    `;
}

function getLabel(value, showSwitch) {
    if (showSwitch && switchMapping[value]) {
        const mapping = switchMapping[value];
        if (mapping.switch && mapping.ps !== mapping.switch) {
            return `${mapping.ps} / ${mapping.switch}`;
        }
        return mapping.ps;
    }
    return standardLabels[value] || "nothing";
}

function updateAllDropdownLabels(showSwitch) {
    // Update button 10 dropdowns (static in HTML)
    updateDropdownLabels('editor_b10_mapping1_dropdown', false, showSwitch);
    updateDropdownLabels('editor_b10_mapping2_dropdown', false, showSwitch);
    
    // Update dynamically generated button dropdowns (1-9)
    for (let btn = 1; btn <= 9; btn++) {
        updateDropdownLabels(`editor_b${btn}_mapping1_dropdown`, false, showSwitch);
        updateDropdownLabels(`editor_b${btn}_mapping2_dropdown`, false, showSwitch);
    }
    
    // Update stick dropdown (e0)
    updateDropdownLabels('editor_e0_mapping1_dropdown', true, showSwitch);
    
    // Update expansion port dropdowns (1-4)
    for (let port = 1; port <= 4; port++) {
        updateDropdownLabels(`editor_e${port}_mapping1_dropdown`, true, showSwitch);
        updateDropdownLabels(`editor_e${port}_mapping2_dropdown`, false, showSwitch);
    }
}

function updateDropdownLabels(dropdownId, includeSticks, showSwitch) {
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown) return;
    
    const currentValue = dropdown.value;
    
    // Update each option's text
    for (let option of dropdown.options) {
        const value = option.value;
        option.textContent = getLabel(value, showSwitch);
    }
    
    // Restore the selected value
    dropdown.value = currentValue;
}

function updateExpansionPortVisibility(port) {
    const value = parseInt(document.getElementById(`editor_e${port}_mapping1_dropdown`).value);
    const elements = document.querySelectorAll(`.editor_e${port}_button_setting`);
    
    if (value > 0 && value < 100) {
        elements.forEach(el => el.classList.remove('d-none'));
    } else {
        elements.forEach(el => el.classList.add('d-none'));
    }
}

function openEditorForNew() {
    editingProfileIndex = null;
    document.getElementById("editor-title").textContent = "New Profile";
    document.getElementById("save_profile_to_library").textContent = "Add Profile to Library";
    clearEditorForm();
    originalProfileState = JSON.stringify(getProfileFromEditor());
    showEditor();
}

function openEditorForEdit(index) {
    editingProfileIndex = index;
    document.getElementById("editor-title").textContent = "Edit Profile";
    document.getElementById("save_profile_to_library").textContent = "Update Profile";
    loadProfileToEditor(profileLibrary[index]);
    originalProfileState = JSON.stringify(getProfileFromEditor());
    showEditor();
}

function handleBackButton() {
    if (currentScreen === 'editor') {
        closeEditor();
    } else if (currentScreen === 'viewer') {
        closeViewer();
    }
}

function showEditor() {
    document.getElementById("main-view").classList.add("hidden");
    document.getElementById("profile-editor").classList.add("active");
    document.getElementById("controller-buttons").style.display = "none";
    document.getElementById("back-button-container").style.display = "block";
    currentScreen = 'editor';
}

function closeEditor() {
    const currentState = JSON.stringify(getProfileFromEditor());
    
    if (currentState !== originalProfileState) {
        // Show the unsaved changes modal
        const modal = new bootstrap.Modal(document.getElementById('unsavedChangesModal'));
        modal.show();
    } else {
        doCloseEditor();
    }
}

function doCloseEditor() {
    document.getElementById("main-view").classList.remove("hidden");
    document.getElementById("profile-editor").classList.remove("active");
    document.getElementById("controller-buttons").style.display = "";
    document.getElementById("back-button-container").style.display = "none";
    originalProfileState = null;
    currentScreen = 'main';
}

function closeViewer() {
    document.getElementById("main-view").classList.remove("hidden");
    document.getElementById("profile-viewer").classList.remove("active");
    document.getElementById("controller-buttons").style.display = "";
    document.getElementById("back-button-container").style.display = "none";
    currentScreen = 'main';
}

function showViewer() {
    document.getElementById("main-view").classList.add("hidden");
    document.getElementById("profile-viewer").classList.add("active");
    document.getElementById("controller-buttons").style.display = "none";
    document.getElementById("back-button-container").style.display = "block";
    currentScreen = 'viewer';
}

function viewSlotProfile(slotNumber) {
    const profileIndex = slotAssignments[slotNumber - 1];
    if (profileIndex === null) {
        return; // No profile assigned to this slot
    }
    
    const profile = profileLibrary[profileIndex];
    document.getElementById("viewer-title").textContent = `Slot ${slotNumber}: ${profile.name}`;
    document.getElementById("viewer-content").innerHTML = generateProfileViewHtml(profile);
    showViewer();
}

function editSlotProfile(slotNumber) {
    const profileIndex = slotAssignments[slotNumber - 1];
    if (profileIndex === null) {
        return;
    }
    openEditorForEdit(profileIndex);
}

function generateProfileViewHtml(profile) {
    const showSwitch = profile.showSwitchMapping || false;
    
    const getButtonName = (value) => {
        if (showSwitch && switchMapping[value]) {
            const mapping = switchMapping[value];
            if (mapping.switch && mapping.ps !== mapping.switch) {
                return `${mapping.ps} / ${mapping.switch}`;
            }
            return mapping.ps;
        }
        return standardLabels[value] || "nothing";
    };
    
    const orientationNames = {
        "0": "stick below", "1": "stick on the right", "2": "stick above", "3": "stick on the left"
    };
    
    let html = '<div class="viewer-content-inner">';
    
    // Basic info
    html += `<div class="viewer-row"><div class="viewer-label">Profile Name</div><div class="viewer-value">${escapeHtml(profile.name)}</div></div>`;
    html += `<div class="viewer-row"><div class="viewer-label">Orientation</div><div class="viewer-value">${orientationNames[profile.orientation] || 'stick on the left'}</div></div>`;
    html += `<div class="viewer-row"><div class="viewer-label">Stick</div><div class="viewer-value">${getButtonName(profile.expansionPorts?.e0?.mapping1)}</div></div>`;
    
    // Buttons
    html += '<h5 class="mt-4 mb-2">Buttons</h5>';
    for (let btn = 1; btn <= 10; btn++) {
        const btnData = profile.buttons?.[`b${btn}`] || {};
        const mapping1 = getButtonName(btnData.mapping1);
        const mapping2 = getButtonName(btnData.mapping2);
        const label = btn === 10 ? 'Stick press in' : `Button ${btn}`;
        let value = mapping1;
        if (btnData.mapping2 && btnData.mapping2 !== "0") {
            value += ` + ${mapping2}`;
        }
        if (btnData.toggle) {
            value += ' (toggle)';
        }
        html += `<div class="viewer-row"><div class="viewer-label">${label}</div><div class="viewer-value">${value}</div></div>`;
    }
    
    // Expansion ports
    html += '<h5 class="mt-4 mb-2">Expansion Ports</h5>';
    for (let port = 1; port <= 4; port++) {
        const portData = profile.expansionPorts?.[`e${port}`] || {};
        const mapping1 = getButtonName(portData.mapping1);
        let value = mapping1;
        if (portData.mapping1 && portData.mapping1 !== "0" && parseInt(portData.mapping1) < 100) {
            const mapping2 = getButtonName(portData.mapping2);
            if (portData.mapping2 && portData.mapping2 !== "0") {
                value += ` + ${mapping2}`;
            }
            if (portData.toggle) {
                value += ' (toggle)';
            }
            if (portData.analog) {
                value += ' (analog)';
            }
        }
        html += `<div class="viewer-row"><div class="viewer-label">E${port}</div><div class="viewer-value">${value}</div></div>`;
    }
    
    html += '</div>';
    return html;
}

function clearEditorForm() {
    document.getElementById("editor_name_input").value = "New Profile";
    document.getElementById("editor_name_input").classList.remove("is-invalid");
    document.getElementById("editor_name_error").style.display = "none";
    document.getElementById("editor_name_error").textContent = "A profile with this name already exists.";
    document.getElementById("editor_orientation_dropdown").value = "3";
    document.getElementById("editor_e0_mapping1_dropdown").value = "101";
    
    // Reset switch mapping checkbox and labels
    document.getElementById("show_switch_mapping").checked = false;
    updateAllDropdownLabels(false);
    
    for (let btn = 1; btn <= 10; btn++) {
        document.getElementById(`editor_b${btn}_mapping1_dropdown`).value = "0";
        document.getElementById(`editor_b${btn}_mapping2_dropdown`).value = "0";
        document.getElementById(`editor_b${btn}_toggle_checkbox`).checked = false;
    }
    
    for (let port = 1; port <= 4; port++) {
        document.getElementById(`editor_e${port}_mapping1_dropdown`).value = "0";
        document.getElementById(`editor_e${port}_mapping2_dropdown`).value = "0";
        document.getElementById(`editor_e${port}_toggle_checkbox`).checked = false;
        document.getElementById(`editor_e${port}_analog_checkbox`).checked = false;
        updateExpansionPortVisibility(port);
    }
}

function loadProfileToEditor(profile) {
    document.getElementById("editor_name_input").value = profile.name || "Profile";
    document.getElementById("editor_name_input").classList.remove("is-invalid");
    document.getElementById("editor_name_error").style.display = "none";
    document.getElementById("editor_name_error").textContent = "A profile with this name already exists.";
    document.getElementById("editor_orientation_dropdown").value = profile.orientation || "3";
    document.getElementById("editor_e0_mapping1_dropdown").value = profile.expansionPorts?.e0?.mapping1 || "101";
    
    // Restore switch mapping checkbox preference
    const showSwitch = profile.showSwitchMapping || false;
    document.getElementById("show_switch_mapping").checked = showSwitch;
    updateAllDropdownLabels(showSwitch);
    
    for (let btn = 1; btn <= 10; btn++) {
        const btnData = profile.buttons?.[`b${btn}`] || {};
        document.getElementById(`editor_b${btn}_mapping1_dropdown`).value = btnData.mapping1 || "0";
        document.getElementById(`editor_b${btn}_mapping2_dropdown`).value = btnData.mapping2 || "0";
        document.getElementById(`editor_b${btn}_toggle_checkbox`).checked = btnData.toggle || false;
    }
    
    for (let port = 1; port <= 4; port++) {
        const portData = profile.expansionPorts?.[`e${port}`] || {};
        document.getElementById(`editor_e${port}_mapping1_dropdown`).value = portData.mapping1 || "0";
        document.getElementById(`editor_e${port}_mapping2_dropdown`).value = portData.mapping2 || "0";
        document.getElementById(`editor_e${port}_toggle_checkbox`).checked = portData.toggle || false;
        document.getElementById(`editor_e${port}_analog_checkbox`).checked = portData.analog || false;
        updateExpansionPortVisibility(port);
    }
}

function getProfileFromEditor() {
    const profile = {
        name: document.getElementById("editor_name_input").value || "Profile",
        orientation: document.getElementById("editor_orientation_dropdown").value,
        showSwitchMapping: document.getElementById("show_switch_mapping").checked,
        buttons: {},
        expansionPorts: {
            e0: { mapping1: document.getElementById("editor_e0_mapping1_dropdown").value }
        }
    };
    
    for (let btn = 1; btn <= 10; btn++) {
        profile.buttons[`b${btn}`] = {
            mapping1: document.getElementById(`editor_b${btn}_mapping1_dropdown`).value,
            mapping2: document.getElementById(`editor_b${btn}_mapping2_dropdown`).value,
            toggle: document.getElementById(`editor_b${btn}_toggle_checkbox`).checked
        };
    }
    
    for (let port = 1; port <= 4; port++) {
        profile.expansionPorts[`e${port}`] = {
            mapping1: document.getElementById(`editor_e${port}_mapping1_dropdown`).value,
            mapping2: document.getElementById(`editor_e${port}_mapping2_dropdown`).value,
            toggle: document.getElementById(`editor_e${port}_toggle_checkbox`).checked,
            analog: document.getElementById(`editor_e${port}_analog_checkbox`).checked
        };
    }
    
    return profile;
}

function validateProfileName() {
    const nameInput = document.getElementById("editor_name_input");
    const errorDiv = document.getElementById("editor_name_error");
    const name = nameInput.value.trim();
    
    // Check if name already exists (excluding the profile being edited)
    const existingIndex = profileLibrary.findIndex((p, idx) => 
        p.name.toLowerCase() === name.toLowerCase() && idx !== editingProfileIndex
    );
    
    if (existingIndex >= 0) {
        nameInput.classList.add("is-invalid");
        errorDiv.style.display = "block";
        return false;
    } else {
        nameInput.classList.remove("is-invalid");
        errorDiv.style.display = "none";
        return true;
    }
}

function saveProfileToLibrary() {
    // Validate name first
    if (!validateProfileName()) {
        return;
    }
    
    const name = document.getElementById("editor_name_input").value.trim();
    if (!name) {
        document.getElementById("editor_name_input").classList.add("is-invalid");
        document.getElementById("editor_name_error").textContent = "Profile name cannot be empty.";
        document.getElementById("editor_name_error").style.display = "block";
        return;
    }
    
    const profile = getProfileFromEditor();
    
    if (editingProfileIndex !== null) {
        profileLibrary[editingProfileIndex] = profile;
        show_success("Profile updated!");
    } else {
        profileLibrary.push(profile);
        show_success("Profile added to library!");
    }
    
    renderProfileList();
    updateSlotDisplay();
    originalProfileState = null;
    doCloseEditor();
}

function deleteProfile(index) {
    if (!confirm("Are you sure you want to delete this profile?")) {
        return;
    }
    
    for (let i = 0; i < 3; i++) {
        if (slotAssignments[i] === index) {
            slotAssignments[i] = null;
        } else if (slotAssignments[i] !== null && slotAssignments[i] > index) {
            slotAssignments[i]--;
        }
    }
    
    profileLibrary.splice(index, 1);
    renderProfileList();
    updateSlotDisplay();
}

function assignProfileToSlot(profileIndex, slotNumber, checked) {
    if (checked) {
        slotAssignments[slotNumber - 1] = profileIndex;
    } else {
        slotAssignments[slotNumber - 1] = null;
    }
    
    renderProfileList();
    updateSlotDisplay();
}

function renderProfileList() {
    const container = document.getElementById("profile-list");
    
    if (profileLibrary.length === 0) {
        container.innerHTML = '<p class="text-muted" id="empty-library-message">No profiles in library. Click + to create one or load from file.</p>';
        return;
    }
    
    let html = "";
    profileLibrary.forEach((profile, index) => {
        const slot1Checked = slotAssignments[0] === index;
        const slot2Checked = slotAssignments[1] === index;
        const slot3Checked = slotAssignments[2] === index;
        
        html += `
            <div class="profile-list-item">
                <div class="profile-info">${escapeHtml(profile.name)}</div>
                <div class="profile-actions">
                    <div class="slot-checkbox-group">
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="profile${index}_slot1" 
                                ${slot1Checked ? 'checked' : ''} 
                                onchange="assignProfileToSlot(${index}, 1, this.checked)">
                            <label class="form-check-label" for="profile${index}_slot1">Slot 1</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="profile${index}_slot2" 
                                ${slot2Checked ? 'checked' : ''} 
                                onchange="assignProfileToSlot(${index}, 2, this.checked)">
                            <label class="form-check-label" for="profile${index}_slot2">Slot 2</label>
                        </div>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="profile${index}_slot3" 
                                ${slot3Checked ? 'checked' : ''} 
                                onchange="assignProfileToSlot(${index}, 3, this.checked)">
                            <label class="form-check-label" for="profile${index}_slot3">Slot 3</label>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="openEditorForEdit(${index})">Edit</button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteProfile(${index})">Delete</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function updateSlotDisplay() {
    for (let slot = 1; slot <= 3; slot++) {
        const slotEl = document.getElementById(`slot-${slot}`);
        const nameEl = slotEl.querySelector('.profile-name');
        const editBtn = document.getElementById(`slot-${slot}-edit-btn`);
        const profileIndex = slotAssignments[slot - 1];
        
        if (profileIndex !== null && profileLibrary[profileIndex]) {
            slotEl.classList.add('filled');
            nameEl.textContent = profileLibrary[profileIndex].name;
            nameEl.classList.remove('text-muted');
            editBtn.style.display = 'block';
        } else {
            slotEl.classList.remove('filled');
            nameEl.textContent = 'Empty';
            nameEl.classList.add('text-muted');
            editBtn.style.display = 'none';
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============ Device Functions ============

async function open_device() {
    clear_error();
    let success = false;
    const devices = await navigator.hid.requestDevice({
        filters: [{ vendorId: 0x054c, productId: 0x0e5f }]
    }).catch((err) => { display_error(err); });
    if (devices !== undefined && devices.length > 0) {
        device = devices[0];
        if (!device.opened) {
            await device.open().catch((err) => { display_error(err + "\nIf you're on Linux, you might need to give yourself permissions to the appropriate /dev/hidraw* device."); });
        }
        success = device.opened;
        if (success && device.collections[0].featureReports.some(x => x.reportId == 99)) {
            display_error("Please connect your Access controller with a USB cable.");
            success = false;
        }
    }
    device_buttons_set_disabled_state(!success);
    if (!success) {
        device = null;
    }
}

async function load_from_device() {
    if (device == null) return;
    clear_error();

    try {
        for (let profile_number = 1; profile_number <= 3; profile_number++) {
            let buffer = new ArrayBuffer(PAYLOAD_SIZE);
            let dataview = new DataView(buffer);
            dataview.setUint8(0, 0x10 + profile_number - 1);
            await device.sendFeatureReport(0x60, buffer);

            let profile_data = new ArrayBuffer(PROFILE_DATA_SIZE);
            let profile_data_view = new DataView(profile_data);
            for (let i = 0; i < 18; i++) {
                let data_with_report_id = await device.receiveFeatureReport(0x61);
                for (let j = 0; j < 56; j++) {
                    if (i * 56 + j < PROFILE_DATA_SIZE) {
                        profile_data_view.setUint8(i * 56 + j, data_with_report_id.getUint8(4 + j));
                    }
                }
            }
            
            const profile = deviceDataToProfile(profile_data_view);
            
            // Check if this profile matches an existing one in the library
            const matchingIndex = findMatchingProfile(profile);
            
            if (matchingIndex >= 0) {
                // Profile matches an existing one, just assign it to this slot
                slotAssignments[profile_number - 1] = matchingIndex;
            } else {
                // Profile doesn't match any existing one, add it to library
                // Check if name already exists and make it unique if needed
                let newName = profile.name;
                let counter = 1;
                while (profileLibrary.some(p => p.name.toLowerCase() === newName.toLowerCase())) {
                    newName = `${profile.name} (${counter})`;
                    counter++;
                }
                profile.name = newName;
                
                profileLibrary.push(profile);
                slotAssignments[profile_number - 1] = profileLibrary.length - 1;
            }
        }
        
        renderProfileList();
        updateSlotDisplay();
        show_success("Profiles loaded from controller!");
    } catch (e) {
        display_error(e);
    }
}

function findMatchingProfile(newProfile) {
    // Check each profile in the library to see if it matches
    for (let i = 0; i < profileLibrary.length; i++) {
        if (profilesMatch(profileLibrary[i], newProfile)) {
            return i;
        }
    }
    return -1;
}

function profilesMatch(profileA, profileB) {
    // Compare orientation
    if (profileA.orientation !== profileB.orientation) return false;
    
    // Compare stick (e0)
    if (profileA.expansionPorts?.e0?.mapping1 !== profileB.expansionPorts?.e0?.mapping1) return false;
    
    // Compare buttons 1-10
    for (let btn = 1; btn <= 10; btn++) {
        const btnA = profileA.buttons?.[`b${btn}`] || {};
        const btnB = profileB.buttons?.[`b${btn}`] || {};
        
        if (btnA.mapping1 !== btnB.mapping1) return false;
        if (btnA.mapping2 !== btnB.mapping2) return false;
        if (btnA.toggle !== btnB.toggle) return false;
    }
    
    // Compare expansion ports 1-4
    for (let port = 1; port <= 4; port++) {
        const portA = profileA.expansionPorts?.[`e${port}`] || {};
        const portB = profileB.expansionPorts?.[`e${port}`] || {};
        
        if (portA.mapping1 !== portB.mapping1) return false;
        if (portA.mapping2 !== portB.mapping2) return false;
        if (portA.toggle !== portB.toggle) return false;
        if (portA.analog !== portB.analog) return false;
    }
    
    return true;
}

async function save_to_device() {
    if (device == null) return;
    clear_error();

    try {
        for (let profile_number = 1; profile_number <= 3; profile_number++) {
            const profileIndex = slotAssignments[profile_number - 1];
            if (profileIndex === null) {
                display_error(`Profile slot ${profile_number} is empty. Please assign a profile first.`);
                return;
            }
            
            const profile = profileLibrary[profileIndex];
            let profile_data = profileToDeviceData(profile);
            
            for (let i = 0; i < 18; i++) {
                let buffer = new ArrayBuffer(PAYLOAD_SIZE);
                let dataview = new DataView(buffer);
                dataview.setUint8(0, 0x08 + profile_number);
                dataview.setUint8(1, i);
                for (let j = 0; j < 56; j++) {
                    if (i * 56 + j < PROFILE_DATA_SIZE) {
                        dataview.setUint8(2 + j, profile_data.getUint8(i * 56 + j));
                    }
                }
                if (i == 17) {
                    dataview.setUint32(6, crc32(profile_data, PROFILE_DATA_SIZE), true);
                }
                await device.sendFeatureReport(0x60, buffer);
            }
        }
        show_success("Profiles saved to controller!");
    } catch (e) {
        display_error(e);
    }
}

function deviceDataToProfile(data) {
    if (data.getUint8(0) != 2) {
        throw new Error("expected byte 0 to be 0x02");
    }

    let profile_name = "";
    for (let i = 0; i < 40; i++) {
        const charCode = data.getUint16(4 + 2 * i, true);
        if (charCode === 0) break;
        profile_name += String.fromCharCode(charCode);
    }

    const profile = {
        name: profile_name || "Profile",
        orientation: "3",
        buttons: {},
        expansionPorts: { e0: { mapping1: "0" } }
    };

    let toggle = {};
    for (let i = 0; i < 16; i++) {
        toggle[i] = (data.getUint8(150 + Math.floor(i / 8)) & (1 << (i % 8))) != 0;
    }

    for (let button_number = 1; button_number <= 10; button_number++) {
        let button_data = new DataView(data.buffer.slice(100 + (button_number - 1) * 5, 100 + button_number * 5));
        profile.buttons[`b${button_number}`] = {
            mapping1: String(button_data.getUint8(0)),
            mapping2: String(button_data.getUint8(1)),
            toggle: toggle[button_number - 1]
        };
    }

    for (let port_number = 0; port_number < 5; port_number++) {
        let port_data = new DataView(data.buffer.slice(152 + port_number * 45, 152 + (port_number + 1) * 45));
        
        if (port_number === 0) {
            switch (port_data.getInt8(0)) {
                case 0x00:
                    profile.expansionPorts.e0 = { mapping1: "0" };
                    break;
                case 0x01:
                    profile.expansionPorts.e0 = { mapping1: String(100 + port_data.getUint8(1)) };
                    profile.orientation = String(port_data.getUint8(2));
                    break;
            }
        } else {
            switch (port_data.getInt8(0)) {
                case 0x00:
                    profile.expansionPorts[`e${port_number}`] = { mapping1: "0", mapping2: "0", toggle: false, analog: false };
                    break;
                case 0x01:
                    profile.expansionPorts[`e${port_number}`] = { mapping1: String(100 + port_data.getUint8(1)), mapping2: "0", toggle: false, analog: false };
                    break;
                case 0x02:
                case 0x03:
                    profile.expansionPorts[`e${port_number}`] = {
                        mapping1: String(port_data.getUint8(2)),
                        mapping2: String(port_data.getUint8(3)),
                        toggle: toggle[9 + port_number],
                        analog: (port_data.getInt8(0) == 0x02)
                    };
                    break;
            }
        }
    }

    return profile;
}

function profileToDeviceData(profile) {
    let data_array_buffer = new ArrayBuffer(PROFILE_DATA_SIZE);
    let data = new DataView(data_array_buffer);
    data.setUint8(0, 0x02);
    
    const profile_name = profile.name || "Profile";
    for (let i = 0; (i < profile_name.length) && (i < 40); i++) {
        data.setUint16(4 + 2 * i, profile_name.charCodeAt(i), true);
    }
    
    for (let i = 0; i < 16; i++) {
        data.setUint8(84 + i, Math.floor(Math.random() * 256));
    }
    
    let toggle = 0;
    
    for (let button_number = 1; button_number <= 10; button_number++) {
        const btn = profile.buttons[`b${button_number}`] || {};
        const mapping1 = parseInt(btn.mapping1) || 0;
        const mapping2 = parseInt(btn.mapping2) || 0;
        if (btn.toggle) {
            toggle |= 1 << (button_number - 1);
        }
        data.setUint8(100 + (5 * (button_number - 1)), mapping1);
        data.setUint8(100 + (5 * (button_number - 1)) + 1, mapping2);
    }
    
    for (let port_number = 0; port_number <= 4; port_number++) {
        const portKey = `e${port_number}`;
        const portData = profile.expansionPorts[portKey] || {};
        const mapping1 = parseInt(portData.mapping1) || 0;
        
        if (mapping1 > 100) {
            data.setUint8(152 + port_number * 45, 0x01);
            data.setUint8(152 + port_number * 45 + 1, mapping1 - 100);
            const orientation = parseInt(profile.orientation) || 3;
            data.setUint8(152 + port_number * 45 + 2, orientation);
            data.setUint8(152 + port_number * 45 + 5, 3);
            data.setUint8(152 + port_number * 45 + 8, 0x80);
            data.setUint8(152 + port_number * 45 + 9, 0x80);
            data.setUint8(152 + port_number * 45 + 10, 0xc4);
            data.setUint8(152 + port_number * 45 + 11, 0xc4);
            data.setUint8(152 + port_number * 45 + 12, 0xe1);
            data.setUint8(152 + port_number * 45 + 13, 0xe1);
        }
        if ((mapping1 > 0) && (mapping1 < 100)) {
            const button_type = portData.analog ? 0x02 : 0x03;
            data.setUint8(152 + port_number * 45, button_type);
            data.setUint8(152 + port_number * 45 + 2, mapping1);
            const mapping2 = parseInt(portData.mapping2) || 0;
            data.setUint8(152 + port_number * 45 + 3, mapping2);
            if (portData.toggle) {
                toggle |= 1 << (9 + port_number);
            }
        }
    }
    
    data.setUint16(150, toggle, true);
    data.setBigInt64(948, BigInt(Date.now()), true);
    
    return data;
}

// ============ Import/Export Functions ============

async function export_profiles() {
    clear_error();
    
    try {
        const exportData = {
            version: 1,
            exportDate: new Date().toISOString(),
            library: profileLibrary,
            slotAssignments: slotAssignments
        };
        
        const jsonString = JSON.stringify(exportData, null, 2);
        
        if ('showSaveFilePicker' in window) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: `ps_access_profiles_${new Date().toISOString().slice(0, 10)}.json`,
                    types: [{
                        description: 'JSON Files',
                        accept: { 'application/json': ['.json'] }
                    }]
                });
                const writable = await handle.createWritable();
                await writable.write(jsonString);
                await writable.close();
                show_success("Library saved!");
            } catch (err) {
                if (err.name !== 'AbortError') {
                    throw err;
                }
            }
        } else {
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ps_access_profiles_${new Date().toISOString().slice(0, 10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    } catch (error) {
        display_error("Export failed: " + error.message);
    }
}

function import_profiles(event) {
    clear_error();
    
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importData = JSON.parse(e.target.result);
            let importedProfiles = [];
            let importedSlotAssignments = [null, null, null];
            
            if (importData.library) {
                // New format with library
                importedProfiles = importData.library;
                importedSlotAssignments = importData.slotAssignments || [null, null, null];
            } else if (importData.profiles) {
                // Old format - convert to library
                for (let i = 1; i <= 3; i++) {
                    const profile = importData.profiles[`profile${i}`];
                    if (profile) {
                        importedProfiles.push(profile);
                        importedSlotAssignments[i - 1] = importedProfiles.length - 1;
                    }
                }
            } else {
                throw new Error("Invalid file format");
            }
            
            // Merge imported profiles into existing library
            let addedCount = 0;
            const newSlotAssignments = [...slotAssignments]; // Keep existing slot assignments
            
            for (let i = 0; i < importedProfiles.length; i++) {
                const importedProfile = importedProfiles[i];
                
                // Check if this profile already exists in the library (by matching settings)
                const matchingIndex = findMatchingProfile(importedProfile);
                
                if (matchingIndex === -1) {
                    // Profile doesn't exist, add it
                    // Make sure name is unique
                    let newName = importedProfile.name;
                    let counter = 1;
                    while (profileLibrary.some(p => p.name.toLowerCase() === newName.toLowerCase())) {
                        newName = `${importedProfile.name} (${counter})`;
                        counter++;
                    }
                    importedProfile.name = newName;
                    
                    profileLibrary.push(importedProfile);
                    addedCount++;
                    
                    // Update slot assignments for newly added profile
                    for (let slot = 0; slot < 3; slot++) {
                        if (importedSlotAssignments[slot] === i && newSlotAssignments[slot] === null) {
                            newSlotAssignments[slot] = profileLibrary.length - 1;
                        }
                    }
                } else {
                    // Profile exists, update slot assignments if needed
                    for (let slot = 0; slot < 3; slot++) {
                        if (importedSlotAssignments[slot] === i && newSlotAssignments[slot] === null) {
                            newSlotAssignments[slot] = matchingIndex;
                        }
                    }
                }
            }
            
            slotAssignments = newSlotAssignments;
            
            renderProfileList();
            updateSlotDisplay();
            
            if (addedCount > 0) {
                show_success(`Library loaded! ${addedCount} new profile(s) added.`);
            } else {
                show_success("Library loaded! All profiles already exist.");
            }
            
        } catch (error) {
            display_error("Failed to import: " + error.message);
        }
    };
    
    reader.onerror = function() {
        display_error("Failed to read the file");
    };
    
    reader.readAsText(file);
    event.target.value = '';
}

// ============ Utility Functions ============

function clear_error() {
    document.getElementById("error").classList.add("d-none");
    document.getElementById("success").classList.add("d-none");
}

function display_error(message) {
    document.getElementById("error").innerText = message;
    document.getElementById("error").classList.remove("d-none");
}

function show_success(message) {
    const successDiv = document.getElementById("success");
    successDiv.innerText = message;
    successDiv.classList.remove("d-none");
    setTimeout(() => {
        successDiv.classList.add("d-none");
    }, 3000);
}

function hid_on_disconnect(event) {
    if (event.device === device) {
        device = null;
        device_buttons_set_disabled_state(true);
    }
}

function device_buttons_set_disabled_state(state) {
    document.getElementById("load_from_device").disabled = state;
    document.getElementById("save_to_device").disabled = state;
}
