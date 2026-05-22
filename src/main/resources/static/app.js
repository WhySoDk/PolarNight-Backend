// UI Navigation
document.querySelectorAll('.nav-links li').forEach(link => {
    link.addEventListener('click', () => {
        document.querySelectorAll('.nav-links li').forEach(l => l.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        
        link.classList.add('active');
        document.getElementById(`${link.dataset.tab}-view`).classList.add('active');
    });
});

// Drag and Drop Uploads
const dropzone = document.getElementById('dropzone');
const modal = document.getElementById('confirmation-modal');

dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'white';
});

dropzone.addEventListener('dragleave', () => {
    dropzone.style.borderColor = 'var(--primary-blue)';
});

dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.style.borderColor = 'var(--primary-blue)';
    
    const files = e.dataTransfer.files;
    if(files.length > 0) {
        // Here we would upload files to /api/upload/archive or /api/upload/images
        // For now, trigger the confirmation modal
        modal.style.display = 'flex';
    }
});

// Modal Logic
document.querySelector('.cancel-btn').addEventListener('click', () => {
    modal.style.display = 'none';
});

// Pill Management
function addPill(containerId, text) {
    const container = document.getElementById(containerId);
    const pill = document.createElement('div');
    pill.className = 'pill';
    pill.innerHTML = `${text} <span>✕</span>`;
    pill.querySelector('span').addEventListener('click', () => pill.remove());
    container.appendChild(pill);
}

document.getElementById('meta-artist').addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && e.target.value.trim()) {
        addPill('artist-pill-container', e.target.value.trim());
        e.target.value = '';
    }
});

document.getElementById('meta-tags').addEventListener('keydown', (e) => {
    if(e.key === 'Enter' && e.target.value.trim()) {
        addPill('tag-pill-container', e.target.value.trim());
        e.target.value = '';
    }
});

// Reader Logic
const readerOverlay = document.getElementById('reader-overlay');
const closeReader = document.querySelector('.close-reader');

function openReader(mangaId) {
    readerOverlay.style.display = 'block';
    
    // Fetch pages
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
            
            // Fetch related for end-of-book
            fetch(`/api/mangas/${mangaId}/related`)
                .then(res => res.json())
                .then(related => {
                    const grid = document.getElementById('related-grid');
                    grid.innerHTML = '';
                    
                    if(related.sequel) {
                        grid.innerHTML += `<div><h4>Sequel</h4><img src="/stream/${related.sequel.id}/${related.sequel.cover}" width="100"></div>`;
                    }
                    related.otherWorks.forEach(work => {
                        grid.innerHTML += `<div><img src="/stream/${work.id}/${work.cover}" width="100"></div>`;
                    });
                });
        });
}

closeReader.addEventListener('click', () => {
    readerOverlay.style.display = 'none';
});
