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
    console.error(message);
    const toast = document.getElementById('error-toast');
    toast.innerText = message;
    toast.classList.add('show');
    setTimeout(() => { toast.classList.remove('show'); }, 5000);
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
                    <div class="manga-card" onclick="openReader(${manga.id})">
                        <img src="/api/mangas/${manga.id}/thumbnail?type=web" alt="${manga.title}">
                        <div style="position:absolute; bottom:0; width:100%; background:rgba(0,0,0,0.7); padding:10px;">
                            <h4 style="font-size:0.9rem">${manga.title}</h4>
                            <small style="color:var(--text-muted)">${manga.artist || 'Unknown'}</small>
                        </div>
                    </div>`;
            });
            document.getElementById('page-indicator').innerText = `Page ${res.page} of ${res.totalPages}`;
        })
        .catch(err => showError("Failed to load library: " + err.message));
}

document.getElementById('prev-page').addEventListener('click', () => { if(currentPage > 1) { currentPage--; loadLibrary(); }});
document.getElementById('next-page').addEventListener('click', () => { currentPage++; loadLibrary(); });

document.getElementById('search-btn').addEventListener('click', () => { currentPage = 1; loadLibrary(); });
document.getElementById('apply-filters-btn').addEventListener('click', () => { currentPage = 1; loadLibrary(); });

// Load initial
loadLibrary();

// Populate Tag Sidebar
fetch('/api/management/tags').then(res => res.json()).then(tags => {
    const list = document.getElementById('tag-checkbox-list');
    list.innerHTML = tags.map(t => `
        <label><input type="checkbox" value="${t.name}"> ${t.name}</label><br>
    `).join('');
});

// Populate Artist Filter Sidebar
fetch('/api/management/artists').then(res => res.json()).then(artists => {
    const select = document.getElementById('library-artist-filter');
    artists.forEach(a => {
        select.innerHTML += `<option value="${a.id}">${a.primaryName}</option>`;
    });
});
document.getElementById('library-artist-filter').addEventListener('change', () => { currentPage = 1; loadLibrary(); });

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

// Modal Pill Logic
let selectedArtist = null;
let selectedTags = [];
let uploadFiles = [];

function addPill(containerId, text, isArtist = false) {
    const container = document.getElementById(containerId);
    if(isArtist) container.innerHTML = ''; // Only one artist
    
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.innerHTML = `${text} <span>✕</span>`;
    
    if(isArtist) selectedArtist = text;
    else if(!selectedTags.includes(text)) selectedTags.push(text);
    
    pill.querySelector('span').addEventListener('click', () => {
        pill.remove();
        if(isArtist) selectedArtist = null;
        else selectedTags = selectedTags.filter(t => t !== text);
    });
    
    container.appendChild(pill);
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
    formData.append('metadata', JSON.stringify({ title, artist: selectedArtist, tags: selectedTags }));
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
        document.getElementById('artist-pill-container').innerHTML = '';
        document.getElementById('tag-pill-container').innerHTML = '';
        selectedTags = []; selectedArtist = null;
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
                    grid.innerHTML = '';
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
