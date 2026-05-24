// Basic Navigation
document.querySelectorAll('.nav-links li').forEach(link => {
    link.addEventListener('click', () => {
        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        link.classList.add('active');
        document.getElementById(`${link.dataset.tab}-view`).classList.add('active');
        if(link.dataset.tab === 'library') loadLibrary();
        if(link.dataset.tab === 'management') loadManagement();
    });
});

let currentPage = 1;
const limit = 24;

document.getElementById('home-title').addEventListener('click', () => {
    document.getElementById('advanced-search-bar').value = '';
    document.getElementById('library-artist-filter').value = '';
    document.getElementById('library-favorite-filter').checked = false;
    document.getElementById('library-read-filter').checked = false;
    document.getElementById('library-unread-filter').checked = false;
    document.querySelectorAll('#tag-checkbox-list input[type="checkbox"]').forEach(cb => cb.checked = false);
    currentPage = 1;
    switchTab('library');
    loadLibrary();
});

// Error Toast Logic
function showError(message) {
    const toast = document.getElementById('error-toast');
    toast.innerText = message;
    toast.style.background = 'rgba(220, 38, 38, 0.9)';
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 5000);
}

function showToast(message) {
    const toast = document.getElementById('error-toast');
    toast.innerText = message;
    toast.style.background = 'rgba(16, 185, 129, 0.9)'; // Green for success
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

// Load Library
function loadLibrary() {
    const search = document.getElementById('advanced-search-bar').value;
    const artistFilter = document.getElementById('library-artist-filter').value;
    const favFilter = document.getElementById('library-favorite-filter').checked;
    const readFilter = document.getElementById('library-read-filter').checked;
    const unreadFilter = document.getElementById('library-unread-filter').checked;
    let url = `/api/mangas?page=${currentPage}&limit=${limit}`;
    
    if (favFilter) {
        url += '&isFavorite=true';
    }
    if (readFilter) {
        url += '&isRead=true';
    } else if (unreadFilter) {
        url += '&isRead=false';
    }
    
    if (artistFilter) {
        if (artistFilter.startsWith('group_')) {
            url += `&groupId=${artistFilter.split('_')[1]}`;
        } else {
            url += `&artistId=${artistFilter.split('_')[1]}`;
        }
    }
    
    let includeAll = [];
    let includeAny = [];
    let exclude = [];
    
    const checkedTags = Array.from(document.querySelectorAll('#tag-checkbox-list input[data-type="tag"]:checked')).map(cb => cb.value);
    includeAll.push(...checkedTags);

    const checkedTagGroups = Array.from(document.querySelectorAll('#tag-checkbox-list input[data-type="group"]:checked')).map(cb => cb.value.split('_')[1]);
    if (checkedTagGroups.length > 0) url += `&tagGroups=${checkedTagGroups.join(',')}`;

    const excludedTags = Array.from(document.querySelectorAll('#tag-checkbox-list input[data-type="tag-exclude"]:checked')).map(cb => cb.value);
    exclude.push(...excludedTags);

    const excludedTagGroups = Array.from(document.querySelectorAll('#tag-checkbox-list input[data-type="group-exclude"]:checked')).map(cb => cb.value.split('_')[1]);
    if (excludedTagGroups.length > 0) url += `&excludeTagGroups=${excludedTagGroups.join(',')}`;

    if (search.trim() !== '') {
        const notMatches = search.match(/(?:NOT\s+|-)(?:\[(.*?)\]|(\w+))/gi) || [];
        notMatches.forEach(m => exclude.push(m.replace(/NOT\s+|-|\[|\]/gi, '').trim()));
        
        const orMatches = search.match(/\((.*?)\)/g) || [];
        orMatches.forEach(m => {
            const tags = m.replace(/\(|\)/g, '').split(/\s+OR\s+/i);
            tags.forEach(t => includeAny.push(t.replace(/\[|\]/g, '').trim()));
        });
        
        let remaining = search;
        notMatches.forEach(m => remaining = remaining.replace(m, ''));
        orMatches.forEach(m => remaining = remaining.replace(m, ''));
        
        const strictMatches = remaining.match(/\[(.*?)\]/g) || [];
        strictMatches.forEach(m => {
            includeAll.push(m.replace(/\[|\]/g, '').trim());
            remaining = remaining.replace(m, '');
        });

        remaining = remaining.replace(/\b(?:AND|OR|NOT)\b/gi, '').replace(/\s+/g, ' ').trim();
        if (remaining.length > 0) {
            url += `&search=${encodeURIComponent(remaining)}`;
        }
    }

    if (includeAll.length > 0) url += `&includeAll=${encodeURIComponent(includeAll.join(','))}`;
    if (includeAny.length > 0) url += `&includeAny=${encodeURIComponent(includeAny.join(','))}`;
    if (exclude.length > 0) url += `&exclude=${encodeURIComponent(exclude.join(','))}`;

    const toggleBtn = document.getElementById('toggle-filter-btn');
    if (favFilter || readFilter || unreadFilter || artistFilter || includeAll.length > 0 || includeAny.length > 0 || exclude.length > 0 || checkedTagGroups.length > 0) {
        toggleBtn.classList.add('filter-active');
    } else {
        toggleBtn.classList.remove('filter-active');
    }

    fetch(url)
        .then(res => res.json())
        .then(res => {
            const grid = document.getElementById('manga-grid');
            grid.innerHTML = '';
            res.data.forEach(manga => {
                const favClass = manga.isFavorite ? '' : 'inactive';
                const readClass = manga.isRead ? '' : 'inactive';
                const readRibbon = `<div class="read-ribbon ${readClass}" onclick="toggleRead(event, ${manga.id}, ${!manga.isRead})">✓</div>`;
                let langBadges = '';
                if (manga.languages && manga.languages.length > 0) {
                    langBadges = `<div class="language-badges" style="top: 45px;">` + manga.languages.map(l => `<div class="language-badge">${l}</div>`).join('') + `</div>`;
                }
                grid.innerHTML += `
                    <div class="manga-card" oncontextmenu="showContextMenu(event, ${manga.id}, \`${manga.title.replace(/`/g, '\\`')}\`)">
                        ${readRibbon}
                        ${langBadges}
                        <div class="favorite-star ${favClass}" onclick="toggleFavorite(event, ${manga.id}, ${!manga.isFavorite})">★</div>
                        <img src="/api/mangas/${manga.id}/thumbnail?type=web" alt="${manga.title}" onclick="openReader(${manga.id})">
                        <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.7); padding:10px; pointer-events:none;">
                            <h4 style="font-size:0.9rem">${manga.title}</h4>
                            <small style="color:var(--text-muted)">${manga.artist || 'Unknown'}</small>
                        </div>
                    </div>`;
            });
            document.getElementById('jump-page-input').value = res.page;
            document.getElementById('total-pages-indicator').innerText = res.totalPages;
        })
        .catch(err => showError("Failed to load library: " + err.message));
}

document.getElementById('prev-page').addEventListener('click', () => { if(currentPage > 1) { currentPage--; loadLibrary(); }});
function toggleFavorite(e, id, isFavorite) {
    e.stopPropagation();
    fetch(`/api/mangas/${id}/favorite`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ isFavorite })
    }).then(() => loadLibrary());
}

function toggleRead(e, id, isRead) {
    e.stopPropagation();
    fetch(`/api/mangas/${id}/read`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ isRead })
    }).then(() => loadLibrary());
}

document.getElementById('next-page').addEventListener('click', () => { 
    const totalPages = parseInt(document.getElementById('total-pages-indicator').innerText);
    if(currentPage < totalPages) { currentPage++; loadLibrary(); }
});

document.getElementById('jump-page-input').addEventListener('change', (e) => {
    const val = parseInt(e.target.value);
    const totalPages = parseInt(document.getElementById('total-pages-indicator').innerText) || 1;
    if(val >= 1 && val <= totalPages) {
        currentPage = val;
        loadLibrary();
    } else {
        e.target.value = currentPage; // revert
    }
});

document.getElementById('search-btn').addEventListener('click', () => { currentPage = 1; loadLibrary(); });
document.getElementById('advanced-search-bar').addEventListener('keyup', (e) => { if(e.key === 'Enter') { currentPage = 1; loadLibrary(); } });

// Load initial
loadLibrary();

setTimeout(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#modal-reader')) {
        openReader(hash.split('-')[2], true);
    } else if (['#upload', '#management', '#migration'].includes(hash)) {
        switchTab(hash.substring(1), true);
    } else {
        switchTab('library', true);
    }
}, 100);

document.getElementById('library-favorite-filter').addEventListener('change', () => {
    currentPage = 1;
    loadLibrary();
});
document.getElementById('library-read-filter').addEventListener('change', (e) => {
    if(e.target.checked) document.getElementById('library-unread-filter').checked = false;
    currentPage = 1;
    loadLibrary();
});
document.getElementById('library-unread-filter').addEventListener('change', (e) => {
    if(e.target.checked) document.getElementById('library-read-filter').checked = false;
    currentPage = 1;
    loadLibrary();
});

// Populate Tag Sidebar
fetch('/api/management/tags').then(res => res.json()).then(data => {
    const list = document.getElementById('tag-checkbox-list');
    let html = '';
    data.groups.forEach(g => {
        html += `<div style="display: flex; align-items: center; margin-top: 10px;">
                    <input type="checkbox" value="group_${g.id}" data-type="group" class="include-checkbox" style="margin-right: 5px;" title="Include">
                    <input type="checkbox" value="group_${g.id}" data-type="group-exclude" class="exclude-checkbox" style="margin-right: 8px;" title="Exclude">
                    <label style="color: var(--primary-blue); font-weight: bold; margin: 0; cursor: pointer;">${g.name.toUpperCase()}</label>
                 </div>`;
    });
    if(data.standalone.length > 0) {
        html += `<h4 style="margin: 15px 0 5px 0; color: var(--primary-blue); font-size: 0.9em; text-transform: uppercase;">Standalone Tags</h4>`;
        data.standalone.forEach(t => {
            html += `<div style="display: flex; align-items: center; margin-top: 5px;">
                        <input type="checkbox" value="${t.name}" data-type="tag" class="include-checkbox" style="margin-right: 5px;" title="Include">
                        <input type="checkbox" value="${t.name}" data-type="tag-exclude" class="exclude-checkbox" style="margin-right: 8px;" title="Exclude">
                        <label style="margin: 0; cursor: pointer;">${t.name}</label>
                     </div>`;
        });
    }
    list.innerHTML = html;
    list.querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => { currentPage = 1; loadLibrary(); }));
});

// Populate Artist Filter Sidebar
window.globalArtists = [];
fetch('/api/management/artists').then(res => res.json()).then(data => {
    window.globalArtists = data.standalone.concat(data.groups.flatMap(g => g.artists));
    const select = document.getElementById('library-artist-filter');
    data.groups.forEach(g => {
        select.innerHTML += `<option value="group_${g.id}">[Group] ${g.name}</option>`;
    });
    data.standalone.forEach(a => {
        select.innerHTML += `<option value="artist_${a.id}">${a.primaryName}</option>`;
    });
    select.addEventListener('change', () => { currentPage = 1; loadLibrary(); });
});

function searchArtist(name) {
    document.getElementById('reader-overlay').style.display = 'none';
    document.getElementById('advanced-search-bar').value = name;
    currentPage = 1;
    loadLibrary();
}

// UI Floating Elements Logic
const filterBtn = document.getElementById('toggle-filter-btn');
const closeFilterBtn = document.getElementById('close-filter-btn');
const filterPanel = document.getElementById('filter-panel');
if(filterBtn) filterBtn.addEventListener('click', (e) => { e.stopPropagation(); filterPanel.classList.add('open'); });
if(closeFilterBtn) closeFilterBtn.addEventListener('click', () => { filterPanel.classList.remove('open'); });

const menuBtn = document.getElementById('main-menu-btn');
const dropdownMenu = document.getElementById('main-dropdown-menu');
if(menuBtn) menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownMenu.style.display = dropdownMenu.style.display === 'flex' ? 'none' : 'flex';
});

document.addEventListener('click', (e) => {
    if(dropdownMenu && !dropdownMenu.contains(e.target) && !menuBtn.contains(e.target)) dropdownMenu.style.display = 'none';
});

// View Switching
let isNavigatingHistory = false;
function pushModalState(modalName, id = null) {
    if (!isNavigatingHistory) {
        let hash = `#modal-${modalName}`;
        if (id) hash += `-${id}`;
        history.pushState({ modal: modalName, id: id }, '', hash);
    }
}
function switchTab(tab, pushState = true) {
    if (pushState && !isNavigatingHistory) history.pushState({ tab: tab }, '', `#${tab}`);
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    
    const searchContainer = document.querySelector('.pill-search-container');
    const filterBtn = document.getElementById('toggle-filter-btn');
    if (tab === 'library') {
        document.getElementById('library-view').classList.add('active');
        document.querySelector('.bottom-floating-container').style.display = 'flex';
        if (searchContainer) searchContainer.style.display = 'flex';
        if (filterBtn) filterBtn.style.display = 'flex';
    } else {
        document.querySelector('.bottom-floating-container').style.display = 'none';
        if (searchContainer) searchContainer.style.display = 'none';
        if (filterBtn) filterBtn.style.display = 'none';
        if (tab === 'upload') document.getElementById('upload-view').classList.add('active');
        else if (tab === 'migration') document.getElementById('migration-view').classList.add('active');
        else if (tab === 'management') {
            document.getElementById('management-view').classList.add('active');
            loadManagement();
        }
    }
    if(dropdownMenu) dropdownMenu.style.display = 'none';
}

history.replaceState({ tab: 'library' }, '', '#library');

document.querySelectorAll('#main-dropdown-menu li, #home-title').forEach(link => {
    link.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab || 'library';
        switchTab(tab);
    });
});

function closeAllModals() {
    const reader = document.getElementById('reader-overlay');
    if (reader) reader.style.display = 'none';
    const del = document.getElementById('delete-book-modal');
    if (del) del.style.display = 'none';
    const edit = document.getElementById('edit-metadata-modal');
    if (edit) edit.style.display = 'none';
    const conf = document.getElementById('confirmation-modal');
    if (conf) conf.style.display = 'none';
    const ctx = document.getElementById('custom-context-menu');
    if (ctx) ctx.style.display = 'none';
    const reorder = document.getElementById('reorder-pages-overlay');
    if (reorder) reorder.style.display = 'none';
}

function closeModalAction() {
    if (history.state && history.state.modal) {
        history.back();
    } else {
        closeAllModals();
    }
}

window.addEventListener('popstate', (e) => {
    isNavigatingHistory = true;
    closeAllModals();
    if (e.state) {
        if (e.state.modal === 'reader') {
            openReader(e.state.id, false);
        } else if (e.state.modal === 'edit') {
            openEditMetadata(e.state.id, false);
        } else if (e.state.modal === 'delete') {
            document.getElementById('delete-book-modal').style.display = 'flex';
        } else if (e.state.modal === 'upload') {
            document.getElementById('confirmation-modal').style.display = 'flex';
        } else if (e.state.modal === 'reorder') {
            activeContextMenuMangaId = e.state.id;
            document.getElementById('reorder-pages-overlay').style.display = 'block';
            loadReorderGrid();
        } else if (e.state.tab) {
            switchTab(e.state.tab, false);
        }
    } else {
        switchTab('library', false);
    }
    isNavigatingHistory = false;
});

// Autocomplete Logic with Keyboard Navigation
function setupAutocomplete(inputId, dropdownId, endpoint, onSelect) {
    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    let selectedIndex = -1;

    input.addEventListener('input', () => {
        fetch(`${endpoint}?q=${input.value}`)
            .then(res => res.json())
            .then(results => {
                dropdown.innerHTML = '';
                if(results.length > 0) {
                    dropdown.style.display = 'block';
                    results.forEach((r, idx) => {
                        const li = document.createElement('li');
                        li.innerHTML = r.type ? `${r.name} <span class="badge ${r.type.toLowerCase()}">${r.type}</span>` : r.name;
                        li.dataset.index = idx;
                        li.addEventListener('click', () => {
                            onSelect(r.name);
                            input.value = '';
                            dropdown.style.display = 'none';
                        });
                        dropdown.appendChild(li);
                    });
                } else {
                    dropdown.style.display = 'none';
                }
                selectedIndex = -1;
            })
            .catch(err => showError(`Failed to autocomplete: ${err.message}`));
    });

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('li');
        if(e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIndex = (selectedIndex + 1) % items.length;
            updateSelection(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIndex = (selectedIndex - 1 + items.length) % items.length;
            updateSelection(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if(selectedIndex > -1 && dropdown.style.display === 'block') {
                items[selectedIndex].click();
            } else if (input.value.trim() !== '') {
                // Confirm new tag logic would be triggered here
                onSelect(input.value.trim(), true); 
                input.value = '';
                dropdown.style.display = 'none';
            }
        }
    });

    function updateSelection(items) {
        items.forEach((item, idx) => {
            if(idx === selectedIndex) item.classList.add('selected');
            else item.classList.remove('selected');
        });
    }

    document.addEventListener('click', (e) => {
        if(e.target !== input && e.target !== dropdown) dropdown.style.display = 'none';
    });
}

// State for Add Modal
let selectedArtist = null;
let selectedTags = new Set();
let uploadFiles = [];

// Validation Logic
function validateUploadModal() {
    const title = document.getElementById('meta-title').value.trim();
    const btn = document.getElementById('save-metadata-btn');
    if (title && selectedArtist) {
        btn.disabled = false;
        btn.classList.remove('disabled');
    } else {
        btn.disabled = true;
        btn.classList.add('disabled');
    }
}

document.getElementById('meta-title').addEventListener('input', validateUploadModal);

// Modal Pill Logic
function renderArtistPill() {
    const container = document.getElementById('artist-pill-container');
    container.innerHTML = '';
    if (selectedArtist) {
        const pill = document.createElement('div');
        pill.className = 'pill';
        pill.innerHTML = `${selectedArtist} <span>✕</span>`;
        pill.querySelector('span').addEventListener('click', () => {
            selectedArtist = null;
            renderArtistPill();
            validateUploadModal();
        });
        container.appendChild(pill);
    }
}

function renderTagPills() {
    const container = document.getElementById('tag-pill-container');
    container.innerHTML = '';
    selectedTags.forEach(text => {
        const pill = document.createElement('div');
        pill.className = 'pill';
        pill.innerHTML = `${text} <span>✕</span>`;
        pill.querySelector('span').addEventListener('click', () => {
            selectedTags.delete(text);
            renderTagPills();
        });
        container.appendChild(pill);
    });
}

function addPill(containerId, text, isArtist = false) {
    if(isArtist) {
        selectedArtist = text;
        renderArtistPill();
    } else {
        selectedTags.add(text);
        renderTagPills();
    }
    validateUploadModal();
}

// Setup the autocompletes
setupAutocomplete('meta-artist', 'artist-autocomplete', '/api/autocomplete/artists', (name) => {
    addPill('artist-pill-container', name, true);
});

setupAutocomplete('meta-tags', 'tag-autocomplete', '/api/autocomplete/tags', (name, isNew) => {
    if(isNew) {
        // Safe-guard popup
        document.getElementById('new-tag-message').innerText = `"${name}" doesn't exist in the database. Are you sure you want to create it?`;
        document.getElementById('new-tag-modal').style.display = 'flex';
        
        document.getElementById('confirm-new-tag-btn').onclick = () => {
            addPill('tag-pill-container', name, false);
            document.getElementById('new-tag-modal').style.display = 'none';
        };
        document.getElementById('cancel-new-tag-btn').onclick = () => {
            document.getElementById('new-tag-modal').style.display = 'none';
        };
        
        // Enter to accept new tag
        const enterHandler = (e) => {
            if (e.key === 'Enter' && document.getElementById('new-tag-modal').style.display === 'flex') {
                e.preventDefault();
                document.getElementById('confirm-new-tag-btn').click();
                document.removeEventListener('keydown', enterHandler);
            }
        };
        document.addEventListener('keydown', enterHandler);

    } else {
        addPill('tag-pill-container', name, false);
    }
});

// Save Upload Logic
document.getElementById('save-metadata-btn').addEventListener('click', () => {
    const title = document.getElementById('meta-title').value;
    
    // Using FormData for Multipart Image Upload
    const formData = new FormData();
    formData.append('metadata', JSON.stringify({ title, artist: selectedArtist, tags: Array.from(selectedTags) }));
    uploadFiles.forEach(file => {
        formData.append('files', file);
    });

    document.getElementById('save-metadata-btn').innerText = 'Uploading...';
    
    const isArchive = uploadFiles.length === 1 && /\.(zip|rar|cbz|7z)$/i.test(uploadFiles[0].name);
    const endpoint = isArchive ? '/api/upload/archive' : '/api/upload/images';
    
    fetch(endpoint, {
        method: 'POST',
        body: formData
    }).then(res => {
        if(!res.ok) throw new Error("Server returned " + res.status);
        document.getElementById('save-metadata-btn').innerText = 'Save to Library';
        document.getElementById('confirmation-modal').style.display = 'none';
        uploadFiles = [];
        loadLibrary();
    }).catch(err => {
        document.getElementById('save-metadata-btn').innerText = 'Save to Library';
        showError("Failed to save metadata: " + err.message);
    });
});

// Drag and drop trigger
const dropzone = document.getElementById('dropzone');
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); });
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    if(e.dataTransfer.files.length > 0) {
        uploadFiles = Array.from(e.dataTransfer.files);
        document.getElementById('meta-title').value = '';
        selectedArtist = null;
        selectedTags.clear();
        renderArtistPill();
        renderTagPills();
        validateUploadModal();
        pushModalState('upload');
        document.getElementById('confirmation-modal').style.display = 'flex';
    }
});
document.querySelector('.cancel-btn').addEventListener('click', () => {
    closeModalAction();
});

// Migration logic
document.getElementById('run-migration-btn').addEventListener('click', () => {
    const log = document.getElementById('migration-log');
    const btn = document.getElementById('run-migration-btn');
    log.style.display = 'block';
    btn.innerText = "Running...";
    
    fetch('/api/management/migration/run', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            btn.innerText = "🚀 Run Mass Migration";
            document.getElementById('migration-success-count').innerText = `Successfully Migrated: ${data.migrated}`;
            const list = document.getElementById('migration-failed-list');
            list.innerHTML = data.failed.map(f => `<li>${f}</li>`).join('');
        })
        .catch(err => {
            btn.innerText = "🚀 Run Mass Migration";
            showError("Migration Failed: " + err.message);
        });
});

// Management Logic
function loadManagement() {
    fetch('/api/management/tags').then(res => res.json()).then(data => {
        const pool = document.getElementById('standalone-tag-pool');
        if(pool) pool.innerHTML = data.standalone.map(t => `
            <div class="pill draggable-pill" draggable="true" ondragstart="dragTag(event, ${t.id})" id="tag-pill-${t.id}">
                ${t.name} <span onclick="deleteTag(${t.id})">✕</span>
            </div>
        `).join('');

        const groupGrid = document.getElementById('tag-group-grid');
        if(groupGrid) groupGrid.innerHTML = data.groups.map(g => `
            <div class="artist-group-card">
                <div style="display: flex; justify-content: space-between;">
                    <h4 style="margin: 0;">${g.name}</h4>
                    <button class="btn glass-btn" onclick="deleteTagGroup(${g.id})">Del</button>
                </div>
                <div class="artist-group-dropzone" ondragover="allowDrop(event)" ondrop="dropToTagGroup(event, ${g.id})">
                    ${g.tags.map(t => `
                        <div class="pill draggable-pill" draggable="true" ondragstart="dragTag(event, ${t.id})" id="tag-pill-${t.id}">
                            ${t.name} <span onclick="deleteTag(${t.id})">✕</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    });
    
    fetch('/api/management/artists').then(res => res.json()).then(data => {
        const pool = document.getElementById('standalone-artist-pool');
        pool.innerHTML = data.standalone.map(a => `
            <div class="pill draggable-pill" draggable="true" ondragstart="dragArtist(event, ${a.id})" id="artist-pill-${a.id}">
                ${a.primaryName} <span onclick="deleteArtist(${a.id})">✕</span>
            </div>
        `).join('');

        const groupGrid = document.getElementById('artist-group-grid');
        groupGrid.innerHTML = data.groups.map(g => `
            <div class="artist-group-card">
                <div style="display: flex; justify-content: space-between;">
                    <h4 style="margin: 0;">${g.name}</h4>
                    <button class="btn glass-btn" onclick="deleteArtistGroup(${g.id})">Del</button>
                </div>
                <div class="artist-group-dropzone" ondragover="allowDrop(event)" ondrop="dropToGroup(event, ${g.id})">
                    ${g.artists.map(a => `
                        <div class="pill draggable-pill" draggable="true" ondragstart="dragArtist(event, ${a.id})" id="artist-pill-${a.id}">
                            ${a.primaryName} <span onclick="deleteArtist(${a.id})">✕</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');
    });
}

function createNewArtist() {
    const input = document.getElementById('new-artist-input');
    const name = input.value.trim();
    if (!name) return;
    fetch('/api/management/artists', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name })
    }).then(() => {
        input.value = '';
        loadManagement();
    });
}

function createNewArtistGroup() {
    const input = document.getElementById('new-group-input');
    const name = input.value.trim();
    if (!name) return;
    fetch('/api/management/artist-groups', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name })
    }).then(() => {
        input.value = '';
        loadManagement();
    });
}

function deleteArtist(id) {
    if(confirm('Are you sure you want to delete this artist?')) {
        fetch(`/api/management/artists/${id}`, { method: 'DELETE' }).then(loadManagement);
    }
}

function deleteArtistGroup(id) {
    if(confirm('Are you sure you want to delete this artist group? All associated artists will be moved to the standalone pool.')) {
        fetch(`/api/management/artist-groups/${id}`, { method: 'DELETE' }).then(loadManagement);
    }
}

// Drag and Drop Logic
function dragArtist(e, id) {
    e.dataTransfer.setData('artistId', id);
}

function allowDrop(e) {
    e.preventDefault();
}

function dropToPool(e) {
    e.preventDefault();
    const artistId = e.dataTransfer.getData('artistId');
    if (artistId) {
        updateArtistGroup(artistId, null);
    }
}

function dropToGroup(e, groupId) {
    e.preventDefault();
    const artistId = e.dataTransfer.getData('artistId');
    if (artistId) {
        updateArtistGroup(artistId, groupId);
    }
}

function updateArtistGroup(artistId, groupId) {
    fetch(`/api/management/artists/${artistId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId })
    }).then(loadManagement);
}

// Tag Management functions
function createNewTag() {
    const input = document.getElementById('new-tag-input');
    const name = input.value.trim();
    if (!name) return;
    fetch('/api/management/tags', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name })
    }).then(() => {
        input.value = '';
        loadManagement();
    });
}

function createNewTagGroup() {
    const input = document.getElementById('new-tag-group-input');
    const name = input.value.trim();
    if (!name) return;
    fetch('/api/management/tag-groups', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name })
    }).then(() => {
        input.value = '';
        loadManagement();
    });
}

function deleteTag(id) {
    if(confirm('Are you sure you want to delete this tag?')) {
        fetch(`/api/management/tags/${id}`, { method: 'DELETE' }).then(loadManagement);
    }
}

function deleteTagGroup(id) {
    if(confirm('Are you sure you want to delete this tag group?')) {
        fetch(`/api/management/tag-groups/${id}`, { method: 'DELETE' }).then(loadManagement);
    }
}

function dragTag(e, id) {
    e.dataTransfer.setData('tagId', id);
}

function dropToTagPool(e) {
    e.preventDefault();
    const tagId = e.dataTransfer.getData('tagId');
    if (tagId) {
        updateTagGroup(tagId, null);
    }
}

function dropToTagGroup(e, groupId) {
    e.preventDefault();
    const tagId = e.dataTransfer.getData('tagId');
    if (tagId) {
        updateTagGroup(tagId, groupId);
    }
}

function updateTagGroup(tagId, groupId) {
    fetch(`/api/management/tags/${tagId}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId })
    }).then(loadManagement);
}

// Modal autocomplete
setupAutocomplete('variant-search-input', 'variant-autocomplete', '/api/autocomplete/artists', (name) => {
    if (currentAddingArtistId) {
        saveVariant(name);
    }
});

// Reader Logic
const readerOverlay = document.getElementById('reader-overlay');
const closeReader = document.querySelector('.close-reader');
function openReader(mangaId, pushState = true) {
    if (pushState) pushModalState('reader', mangaId);
    readerOverlay.style.display = 'block';
    readerOverlay.scrollTop = 0;
    
    readerOverlay.onscroll = () => {
        if (readerOverlay.scrollTop + readerOverlay.clientHeight >= readerOverlay.scrollHeight - 100) {
            if (!readerOverlay.dataset.readMarked || readerOverlay.dataset.readMarked !== mangaId.toString()) {
                readerOverlay.dataset.readMarked = mangaId.toString();
                fetch(`/api/mangas/${mangaId}/read`, {
                    method: 'PUT',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ isRead: true })
                }).then(() => loadLibrary());
            }
        }
    };

    fetch(`/api/mangas/${mangaId}/pages`)
        .then(res => res.json())
        .then(pages => {
            const container = document.getElementById('reader-scroll-container');
            container.innerHTML = '';
            pages.forEach(page => {
                const img = document.createElement('img');
                img.src = `/stream/${mangaId}/${page}`;
                container.appendChild(img);
            });
            // Load Related Works
            fetch(`/api/mangas/${mangaId}/related`)
                .then(r => r.json())
                .then(related => {
                    const grid = document.getElementById('related-grid');
                    const artistStr = related.otherWorks[0]?.artist || related.sequel?.artist || '';
                    grid.innerHTML = `<div style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0;">More from this artist</h3>
                        ${artistStr ? `<button class="btn btn-primary" onclick="searchArtist('${artistStr.replace(/'/g, "\\'")}')">Show More</button>` : ''}
                    </div>`;
                    if (related.sequel) {
                        grid.innerHTML += `<div class="related-manga-card" onclick="openReader(${related.sequel.id})"><img src="/api/mangas/${related.sequel.id}/thumbnail?type=web"><h4>Sequel: ${related.sequel.title}</h4></div>`;
                    }
                    related.otherWorks.forEach(w => {
                        grid.innerHTML += `<div class="related-manga-card" onclick="openReader(${w.id})"><img src="/api/mangas/${w.id}/thumbnail?type=web"><h4>${w.title}</h4></div>`;
                    });
                });
        })
        .catch(err => showError("Failed to open reader: " + err.message));
}
closeReader.addEventListener('click', () => { closeModalAction(); });

// ==========================================
// Context Menu & Book Actions
// ==========================================

let activeContextMenuMangaId = null;
let activeContextMenuMangaTitle = null;

function showContextMenu(e, id, title) {
    e.preventDefault();
    e.stopPropagation(); // Prevent opening reader
    activeContextMenuMangaId = id;
    activeContextMenuMangaTitle = title;
    
    const menu = document.getElementById('custom-context-menu');
    menu.style.display = 'block';
    
    // Position menu
    let x = e.pageX;
    let y = e.pageY;
    if (x + 200 > window.innerWidth) x = window.innerWidth - 200;
    menu.style.left = `${x}px`;
    menu.style.top = `${y}px`;
}

// Hide context menu on click anywhere
document.addEventListener('click', () => {
    const menu = document.getElementById('custom-context-menu');
    if(menu) menu.style.display = 'none';
});

// Delete Logic
let deleteHoldTimer = null;
const deleteBtn = document.getElementById('confirm-delete-btn');
const deleteProgress = document.getElementById('delete-progress');

document.getElementById('ctx-delete').addEventListener('click', () => {
    pushModalState('delete', activeContextMenuMangaId);
    document.getElementById('delete-book-modal').style.display = 'flex';
});

document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    closeModalAction();
});

deleteBtn.addEventListener('mousedown', startDeleteHold);
deleteBtn.addEventListener('touchstart', startDeleteHold);

deleteBtn.addEventListener('mouseup', cancelDeleteHold);
deleteBtn.addEventListener('mouseleave', cancelDeleteHold);
deleteBtn.addEventListener('touchend', cancelDeleteHold);

function startDeleteHold(e) {
    e.preventDefault();
    deleteProgress.style.transition = 'width 1.5s linear';
    deleteProgress.style.width = '100%';
    
    deleteHoldTimer = setTimeout(() => {
        // Confirmed Delete
        if(activeContextMenuMangaId) {
            fetch(`/api/mangas/${activeContextMenuMangaId}`, { method: 'DELETE' })
                .then(() => {
                    showToast('Book deleted permanently.');
                    closeModalAction();
                    cancelDeleteHold();
                    loadLibrary();
                })
                .catch(err => showError(err.message));
        }
    }, 1500);
}

function cancelDeleteHold() {
    clearTimeout(deleteHoldTimer);
    deleteProgress.style.transition = 'width 0.1s linear';
    deleteProgress.style.width = '0%';
}

// Edit Metadata Logic
let editSelectedArtist = null;
let editSelectedTags = new Set();
let editPreviewPages = [];
let editPreviewCurrentPage = 0;

function openEditMetadata(mangaId, pushState = true) {
    activeContextMenuMangaId = mangaId;
    fetch(`/api/mangas/${activeContextMenuMangaId}/pages`)
        .then(res => res.json())
        .then(pages => {
            editPreviewPages = pages;
            editPreviewCurrentPage = 0;
            renderEditPreview();
        });
        
    fetch(`/api/mangas/${activeContextMenuMangaId}`)
        .then(res => res.json())
        .then(manga => {
            document.getElementById('edit-meta-title').value = manga.title || activeContextMenuMangaTitle;
            editSelectedArtist = manga.artist || null;
            editSelectedTags.clear();
            if (manga.tags) manga.tags.forEach(t => editSelectedTags.add(t));
            renderEditPills();
        });
        
    document.getElementById('edit-meta-title').value = activeContextMenuMangaTitle;
    editSelectedArtist = null;
    editSelectedTags.clear();
    renderEditPills();
    
    if (pushState) pushModalState('edit', activeContextMenuMangaId);
    document.getElementById('edit-metadata-modal').style.display = 'flex';
}

document.getElementById('ctx-regen-thumb').addEventListener('click', () => {
    if(!activeContextMenuMangaId) return;
    fetch(`/api/mangas/${activeContextMenuMangaId}/thumbnail/regenerate`, { method: 'POST' })
        .then(() => {
            showToast('Thumbnail regenerated');
            loadLibrary();
        })
        .catch(err => showError(err.message));
});

document.getElementById('ctx-edit').addEventListener('click', () => {
    if(!activeContextMenuMangaId) return;
    openEditMetadata(activeContextMenuMangaId);
});

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    closeModalAction();
});

function renderEditPreview() {
    const previewContainer = document.getElementById('edit-preview-container');
    const start = editPreviewCurrentPage * 5;
    const end = Math.min(start + 5, editPreviewPages.length);
    const visiblePages = editPreviewPages.slice(start, end);
    
    previewContainer.innerHTML = visiblePages.map(p => `<img src="/stream/${activeContextMenuMangaId}/${p}" class="edit-preview-img">`).join('');
    
    document.getElementById('edit-prev-preview-btn').disabled = (editPreviewCurrentPage === 0);
    document.getElementById('edit-next-preview-btn').disabled = (end >= editPreviewPages.length);
    
    document.getElementById('edit-prev-preview-btn').style.opacity = (editPreviewCurrentPage === 0) ? '0.5' : '1';
    document.getElementById('edit-next-preview-btn').style.opacity = (end >= editPreviewPages.length) ? '0.5' : '1';
}

document.getElementById('edit-prev-preview-btn').addEventListener('click', () => {
    if (editPreviewCurrentPage > 0) {
        editPreviewCurrentPage--;
        renderEditPreview();
    }
});

document.getElementById('edit-next-preview-btn').addEventListener('click', () => {
    if ((editPreviewCurrentPage + 1) * 5 < editPreviewPages.length) {
        editPreviewCurrentPage++;
        renderEditPreview();
    }
});

function renderEditPills() {
    const artistContainer = document.getElementById('edit-artist-pill-container');
    artistContainer.innerHTML = editSelectedArtist ? `<span class="pill">${editSelectedArtist} <span onclick="editSelectedArtist=null; renderEditPills()">✕</span></span>` : '';
    
    const tagContainer = document.getElementById('edit-tag-pill-container');
    tagContainer.innerHTML = Array.from(editSelectedTags).map(t => `<span class="pill">${t} <span onclick="editSelectedTags.delete('${t}'); renderEditPills()">✕</span></span>`).join('');
}

setupAutocomplete('edit-meta-artist', 'edit-artist-autocomplete', '/api/autocomplete/artists', (name) => {
    document.getElementById('edit-meta-artist').value = '';
    editSelectedArtist = name;
    renderEditPills();
});

setupAutocomplete('edit-meta-tags', 'edit-tag-autocomplete', '/api/autocomplete/tags', (name) => {
    editSelectedTags.add(name);
    renderEditPills();
});

document.getElementById('save-edit-btn').addEventListener('click', () => {
    const title = document.getElementById('edit-meta-title').value.trim();
    if(!title || !editSelectedArtist) {
        showError('Title and Artist are required');
        return;
    }
    
    fetch(`/api/mangas/${activeContextMenuMangaId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist: editSelectedArtist, tags: Array.from(editSelectedTags) })
    }).then(() => {
        closeModalAction();
        showToast('Metadata updated');
        loadLibrary();
    }).catch(err => showError(err.message));
});

// Reorder Pages Logic
let draggedReorderItem = null;
let pendingDeletedPages = [];

document.getElementById('ctx-reorder').addEventListener('click', () => {
    if(!activeContextMenuMangaId) return;
    pushModalState('reorder', activeContextMenuMangaId);
    document.getElementById('reorder-pages-overlay').style.display = 'block';
    loadReorderGrid();
});

window.markPageForDeletion = function(e, btnElement, filename) {
    e.stopPropagation();
    pendingDeletedPages.push(filename);
    btnElement.parentElement.remove();
};

function loadReorderGrid() {
    pendingDeletedPages = [];
    fetch(`/api/mangas/${activeContextMenuMangaId}/pages`)
        .then(res => res.json())
        .then(pages => {
            const grid = document.getElementById('reorder-grid');
            grid.innerHTML = pages.map(p => `
                <div class="reorder-item" draggable="true" data-filename="${p}">
                    <div class="delete-page-btn" onclick="markPageForDeletion(event, this, '${p}')">✖</div>
                    <img src="/stream/${activeContextMenuMangaId}/${p}" class="reorder-img">
                    <div class="reorder-name">${p}</div>
                </div>
            `).join('');
            
            setupDragAndDrop();
        });
}

function setupDragAndDrop() {
    const items = document.querySelectorAll('.reorder-item');
    items.forEach(item => {
        item.addEventListener('dragstart', function(e) {
            draggedReorderItem = this;
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', this.innerHTML);
            setTimeout(() => this.style.opacity = '0.5', 0);
        });
        
        item.addEventListener('dragend', function() {
            this.style.opacity = '1';
            items.forEach(i => i.classList.remove('drag-over'));
        });
        
        item.addEventListener('dragover', function(e) {
            e.preventDefault();
            this.classList.add('drag-over');
        });
        
        item.addEventListener('dragleave', function() {
            this.classList.remove('drag-over');
        });
        
        item.addEventListener('drop', function(e) {
            e.preventDefault();
            this.classList.remove('drag-over');
            if (draggedReorderItem !== this) {
                const grid = document.getElementById('reorder-grid');
                const allItems = Array.from(grid.querySelectorAll('.reorder-item'));
                const draggedIdx = allItems.indexOf(draggedReorderItem);
                const droppedIdx = allItems.indexOf(this);
                
                if (draggedIdx < droppedIdx) {
                    this.parentNode.insertBefore(draggedReorderItem, this.nextSibling);
                } else {
                    this.parentNode.insertBefore(draggedReorderItem, this);
                }
            }
        });
    });
}

document.getElementById('cancel-reorder-btn').addEventListener('click', () => {
    closeModalAction();
});

document.getElementById('normalize-pages-btn').addEventListener('click', () => {
    const grid = document.getElementById('reorder-grid');
    const items = Array.from(grid.querySelectorAll('.reorder-item'));
    
    // Sort items alphabetically by filename to "normalize" them in the UI
    items.sort((a, b) => {
        return a.dataset.filename.localeCompare(b.dataset.filename, undefined, {numeric: true});
    });
    
    // Re-append in sorted order
    grid.innerHTML = '';
    items.forEach(item => grid.appendChild(item));
    
    showToast('Pages sorted alphabetically. Click "Save New Order" to apply and rename files.');
});

document.getElementById('save-reorder-btn').addEventListener('click', () => {
    const items = document.querySelectorAll('.reorder-item');
    const newOrder = Array.from(items).map(item => item.dataset.filename);
    
    fetch(`/api/mangas/${activeContextMenuMangaId}/pages/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newOrder, deletedPages: pendingDeletedPages })
    }).then(() => {
        showToast('Pages reordered successfully!');
        closeModalAction();
    }).catch(err => showError(err.message));
});

// Close any modal when clicking outside of it
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeModalAction();
        }
    });
});
