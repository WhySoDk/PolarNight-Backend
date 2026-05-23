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
    let url = `/api/mangas?page=${currentPage}&limit=${limit}`;
    
    if (artistFilter) {
        url += `&artistId=${artistFilter}`;
    }
    
    let includeAll = [];
    let includeAny = [];
    let exclude = [];
    
    const checkedTags = Array.from(document.querySelectorAll('#tag-checkbox-list input:checked')).map(cb => cb.value);
    includeAll.push(...checkedTags);

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
        
        const andMatches = remaining.match(/\[(.*?)\]|(\w+)/g) || [];
        andMatches.forEach(m => {
            const tag = m.replace(/\[|\]/g, '').trim();
            if (tag.toLowerCase() !== 'and' && tag.toLowerCase() !== 'or' && tag.toLowerCase() !== 'not') {
                includeAll.push(tag);
            }
        });
    }

    if (includeAll.length > 0) url += `&includeAll=${encodeURIComponent(includeAll.join(','))}`;
    if (includeAny.length > 0) url += `&includeAny=${encodeURIComponent(includeAny.join(','))}`;
    if (exclude.length > 0) url += `&exclude=${encodeURIComponent(exclude.join(','))}`;

    fetch(url)
        .then(res => res.json())
        .then(res => {
            const grid = document.getElementById('manga-grid');
            grid.innerHTML = '';
            res.data.forEach(manga => {
                grid.innerHTML += `
                    <div class="manga-card" onclick="openReader(${manga.id})" oncontextmenu="showContextMenu(event, ${manga.id}, \`${manga.title.replace(/`/g, '\\`')}\`)">
                        <img src="/api/mangas/${manga.id}/thumbnail?type=web" alt="${manga.title}">
                        <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.7); padding:10px;">
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

// // Populate Tag Sidebar
fetch('/api/management/tags').then(res => res.json()).then(tags => {
    const list = document.getElementById('tag-checkbox-list');
    list.innerHTML = tags.map(t => `
        <label><input type="checkbox" value="${t.name}"> ${t.name}</label>
    `).join('');
    list.querySelectorAll('input').forEach(cb => cb.addEventListener('change', () => { currentPage = 1; loadLibrary(); }));
});

// Populate Artist Filter Sidebar
window.globalArtists = [];
fetch('/api/management/artists').then(res => res.json()).then(artists => {
    window.globalArtists = artists;
    const select = document.getElementById('library-artist-filter');
    artists.forEach(a => {
        select.innerHTML += `<option value="${a.id}">${a.primaryName}</option>`;
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
document.querySelectorAll('#main-dropdown-menu li, #home-title').forEach(link => {
    link.addEventListener('click', (e) => {
        const tab = e.target.dataset.tab || 'library';
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
    });
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
        document.getElementById('confirmation-modal').style.display = 'flex';
    }
});
document.querySelector('.cancel-btn').addEventListener('click', () => {
    document.getElementById('confirmation-modal').style.display = 'none';
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
let currentAddingArtistId = null;

function loadManagement() {
    fetch('/api/management/tags').then(res => res.json()).then(tags => {
        const list = document.getElementById('manage-tag-list');
        list.innerHTML = tags.map(t => `<li>${t.name} <button class="btn glass-btn" onclick="fetch('/api/management/tags/${t.id}', {method:'DELETE'}).then(loadManagement)">Del</button></li>`).join('');
    });
    fetch('/api/management/artists').then(res => res.json()).then(artists => {
        const grid = document.getElementById('manage-artist-grid');
        grid.innerHTML = artists.map(a => `
            <div class="artist-card">
                <h4>${a.primaryName}</h4>
                <ul>
                    ${a.variants.map(v => `<li>${v.name} <button onclick="fetch('/api/management/artists/variants/${v.id}', {method:'DELETE'}).then(loadManagement)">✕</button></li>`).join('')}
                </ul>
                <button class="artist-card-add-btn" onclick="openVariantModal(${a.id})">+ Add Variant</button>
            </div>
        `).join('');
    });
}

// Top search to create new artist
setupAutocomplete('manage-artist-search', 'manage-artist-autocomplete', '/api/autocomplete/artists', (name) => {
    fetch('/api/management/artists', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name })
    }).then(loadManagement);
});

// Add Variant Modal
function openVariantModal(artistId) {
    currentAddingArtistId = artistId;
    document.getElementById('variant-search-input').value = '';
    document.getElementById('add-variant-modal').style.display = 'flex';
}

document.getElementById('cancel-variant-btn').addEventListener('click', () => {
    document.getElementById('add-variant-modal').style.display = 'none';
});

document.getElementById('save-variant-btn').addEventListener('click', () => {
    const variantName = document.getElementById('variant-search-input').value.trim();
    if (variantName && currentAddingArtistId) {
        saveVariant(variantName);
    }
});

function saveVariant(name) {
    fetch(`/api/management/artists/${currentAddingArtistId}/variants`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ name })
    }).then(() => {
        document.getElementById('add-variant-modal').style.display = 'none';
        loadManagement();
    }).catch(err => showError(err.message));
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
function openReader(mangaId) {
    readerOverlay.style.display = 'block';
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
                    let artistNameToSearch = artistStr;
                    const matchedArtistObj = window.globalArtists?.find(a => 
                        a.primaryName.toLowerCase() === artistStr.toLowerCase() || 
                        a.variants.some(v => v.toLowerCase() === artistStr.toLowerCase())
                    );
                    if (matchedArtistObj) {
                        artistNameToSearch = matchedArtistObj.primaryName;
                    }

                    grid.innerHTML = `<div style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                        <h3 style="margin: 0;">More from this artist</h3>
                        ${artistStr ? `<button class="btn btn-primary" onclick="searchArtist('${artistNameToSearch.replace(/'/g, "\\'")}')">Show More</button>` : ''}
                    </div>`;
                    if (related.sequel) {
                        grid.innerHTML += `<div class="manga-card" onclick="openReader(${related.sequel.id})"><img src="/api/mangas/${related.sequel.id}/thumbnail?type=web"><h4>Sequel: ${related.sequel.title}</h4></div>`;
                    }
                    related.otherWorks.forEach(w => {
                        grid.innerHTML += `<div class="manga-card" onclick="openReader(${w.id})"><img src="/api/mangas/${w.id}/thumbnail?type=web"><h4>${w.title}</h4></div>`;
                    });
                });
        })
        .catch(err => showError("Failed to open reader: " + err.message));
}
closeReader.addEventListener('click', () => { readerOverlay.style.display = 'none'; });

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
    document.getElementById('delete-book-modal').style.display = 'flex';
});

document.getElementById('cancel-delete-btn').addEventListener('click', () => {
    document.getElementById('delete-book-modal').style.display = 'none';
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
                    document.getElementById('delete-book-modal').style.display = 'none';
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

document.getElementById('ctx-edit').addEventListener('click', () => {
    if(!activeContextMenuMangaId) return;
    
    fetch(`/api/mangas/${activeContextMenuMangaId}/pages`)
        .then(res => res.json())
        .then(pages => {
            const previewContainer = document.getElementById('edit-preview-container');
            previewContainer.innerHTML = pages.map(p => `<img src="/stream/${activeContextMenuMangaId}/${p}" class="edit-preview-img">`).join('');
        });
        
    document.getElementById('edit-meta-title').value = activeContextMenuMangaTitle;
    editSelectedArtist = null;
    editSelectedTags.clear();
    renderEditPills();
    
    document.getElementById('edit-metadata-modal').style.display = 'flex';
});

document.getElementById('cancel-edit-btn').addEventListener('click', () => {
    document.getElementById('edit-metadata-modal').style.display = 'none';
});

function renderEditPills() {
    const artistContainer = document.getElementById('edit-artist-pill-container');
    artistContainer.innerHTML = editSelectedArtist ? `<span class="pill">${editSelectedArtist} <span onclick="editSelectedArtist=null; renderEditPills()">✕</span></span>` : '';
    
    const tagContainer = document.getElementById('edit-tag-pill-container');
    tagContainer.innerHTML = Array.from(editSelectedTags).map(t => `<span class="pill">${t} <span onclick="editSelectedTags.delete('${t}'); renderEditPills()">✕</span></span>`).join('');
}

setupAutocomplete('edit-meta-artist', 'edit-artist-autocomplete', '/api/autocomplete/artists', (name) => {
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
        document.getElementById('edit-metadata-modal').style.display = 'none';
        showToast('Metadata updated');
        loadLibrary();
    }).catch(err => showError(err.message));
});

// Reorder Pages Logic
let draggedReorderItem = null;

document.getElementById('ctx-reorder').addEventListener('click', () => {
    if(!activeContextMenuMangaId) return;
    document.getElementById('reorder-pages-overlay').style.display = 'block';
    loadReorderGrid();
});

function loadReorderGrid() {
    fetch(`/api/mangas/${activeContextMenuMangaId}/pages`)
        .then(res => res.json())
        .then(pages => {
            const grid = document.getElementById('reorder-grid');
            grid.innerHTML = pages.map(p => `
                <div class="reorder-item" draggable="true" data-filename="${p}">
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
    document.getElementById('reorder-pages-overlay').style.display = 'none';
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
        body: JSON.stringify({ newOrder })
    }).then(() => {
        showToast('Pages reordered successfully!');
        document.getElementById('reorder-pages-overlay').style.display = 'none';
    }).catch(err => showError(err.message));
});

// Close any modal when clicking outside of it
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });
});
