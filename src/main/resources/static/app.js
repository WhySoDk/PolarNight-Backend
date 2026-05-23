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
    // In a full implementation, parsing the boolean string would happen here or in backend.
    // We will pass the search query straight to the backend if needed, or rely on checkboxes.
    
    // For simplicity right now, we just pass the page.
    fetch(`/api/mangas?page=${currentPage}&limit=${limit}`)
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

// Load initial
loadLibrary();

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
                        li.innerText = r.name;
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
    console.log("Saving metadata:", { title, artist: selectedArtist, tags: selectedTags });
    
    // Perform API POST here
    fetch('/api/upload/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, artist: selectedArtist, tags: selectedTags })
    }).then(res => {
        if(!res.ok) throw new Error("Server returned " + res.status);
        document.getElementById('confirmation-modal').style.display = 'none';
        loadLibrary();
    }).catch(err => showError("Failed to save metadata: " + err.message));
});

// Drag and drop trigger
const dropzone = document.getElementById('dropzone');
dropzone.addEventListener('dragover', (e) => { e.preventDefault(); });
dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    if(e.dataTransfer.files.length > 0) {
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
    log.style.display = 'block';
    
    // Mock call to the pipeline service
    setTimeout(() => {
        document.getElementById('migration-success-count').innerText = "Successfully Migrated: 42";
        const list = document.getElementById('migration-failed-list');
        list.innerHTML = "<li>[Invalid] Book Name</li><li>Some other folder</li>";
    }, 2000);
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
        })
        .catch(err => showError("Failed to open reader: " + err.message));
}
closeReader.addEventListener('click', () => { readerOverlay.style.display = 'none'; });
