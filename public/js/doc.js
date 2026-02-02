let quill = null;
let currentSecno = null;
let loading = false;
let cachedSections = null;
let sectionsMap = new Map();
const floatingMessage = document.getElementById('floatingMessage');

function showMessage(message, type) {
    floatingMessage.textContent = message;
    floatingMessage.className = `floating-message ${type} show`;
    setTimeout(() => {
        floatingMessage.classList.remove('show');
        setTimeout(() => {
            floatingMessage.textContent = '';
            floatingMessage.className = 'floating-message';
        }, 300);
    }, 3000);
}

function destroyEditor() {
    if (quill) {
        quill.disable();
        quill = null;
    }

    const oldContainer = document.getElementById('editorContainer');
    if (oldContainer && oldContainer.parentNode) {
        const parent = oldContainer.parentNode;
        const newContainer = document.createElement('div');
        newContainer.id = 'editorContainer';
        newContainer.className = 'hidden mt-4';

        const newEditorDiv = document.createElement('div');
        newEditorDiv.id = 'editor';
        newEditorDiv.className = 'border rounded';

        const saveBtn = document.createElement('button');
        saveBtn.id = 'saveContentBtn';
        saveBtn.className = 'bg-green-500 text-white px-4 py-2 rounded mt-4';
        saveBtn.textContent = 'Save Content';

        newContainer.appendChild(newEditorDiv);
        newContainer.appendChild(saveBtn);

        parent.replaceChild(newContainer, oldContainer);

        saveBtn.addEventListener('click', handleSaveContent);
    }
}

function handleSaveContent() {
    if (!quill) return;
    const content = quill.root.innerHTML;
    saveContent(content);
}

function updateMetadata(section) {
    document.title = `${section.name} - SmartCare Documentation`;

    let metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
        metaDesc.setAttribute('content', section.metadescription || 'SmartCare documentation and help articles');
    } else {
        metaDesc = document.createElement('meta');
        metaDesc.name = 'description';
        metaDesc.content = section.metadescription || 'SmartCare documentation and help articles';
        document.head.appendChild(metaDesc);
    }

    let metaKeywords = document.querySelector('meta[name="keywords"]');
    if (metaKeywords) {
        metaKeywords.setAttribute('content', section.metakeywords || 'smartcare, documentation, health, medical');
    } else {
        metaKeywords = document.createElement('meta');
        metaKeywords.name = 'keywords';
        metaKeywords.content = section.metakeywords || 'smartcare, documentation, health, medical';
        document.head.appendChild(metaKeywords);
    }

    // Optional: Update canonical URL
    // let canonical = document.querySelector('link[rel="canonical"]');
    // if (canonical) {
    //     canonical.setAttribute('href', `/docs/${section.slug}`);
    // } else {
    //     canonical = document.createElement('link');
    //     canonical.rel = 'canonical';
    //     canonical.href = `/docs/${section.slug}`;
    //     document.head.appendChild(canonical);
    // }

    // Optional: Open Graph 
    // const ogTitle = document.querySelector('meta[property="og:title"]');
    // if (ogTitle) ogTitle.setAttribute('content', document.title);

    // const ogDesc = document.querySelector('meta[property="og:description"]');
    // if (ogDesc) ogDesc.setAttribute('content', section.metadescription || '');

    // const ogUrl = document.querySelector('meta[property="og:url"]');
    // if (ogUrl) ogUrl.setAttribute('content', window.location.origin + `/docs/${section.slug}`);
}

function resetModalForm() {
    document.getElementById('modalTitle').textContent = 'Add New Section';
    document.getElementById('sectionName').value = '';
    document.getElementById('displayOrder').value = '999';
    document.getElementById('parentSecno').value = '';
    document.getElementById('metaDescription').value = '';
    document.getElementById('metaKeywords').value = '';
    document.getElementById('editSecno').value = '';
}

async function fetchWithToken(url, options = {}) {
    const token = localStorage.getItem('accessToken');
    const isFormData = options.body instanceof FormData;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (!isFormData) headers['Content-Type'] = 'application/json';
    return fetch(url, { ...options, headers });
}

async function loadSections(force = false) {
    if (cachedSections && !force) {
        console.log("Using cached sections");
        const sectionList = document.getElementById('sectionList');
        sectionList.innerHTML = '';
        const tree = buildTree(cachedSections);
        tree.forEach((section, index) => {
            const isFirst = index === 0;
            sectionList.appendChild(renderSection(section, isFirst));
        });
        updateParentDropdown(cachedSections);
        return;
    }

    try {
        const response = await fetchWithToken('/api/v1/docs');
        const data = await response.json();
        if (data.error) {
            showMessage(data.message, 'error');
            return;
        }

        cachedSections = data.data;

        sectionsMap.clear();
        cachedSections.forEach(sec => {
            sectionsMap.set(sec.secno, sec);
        });

        const sectionList = document.getElementById('sectionList');
        sectionList.innerHTML = '';
        const tree = buildTree(cachedSections);
        tree.forEach((section, index) => {
            const isFirst = index === 0;
            sectionList.appendChild(renderSection(section, isFirst));
        });

        updateParentDropdown(cachedSections);

    } catch (err) {
        console.error(err);
        showMessage('Failed to load sections', 'error');
    }
}

function updateParentDropdown(sections) {
    const parentSelect = document.getElementById('parentSecno');
    parentSelect.innerHTML = '<option value="">No Parent</option>';
    sections.filter(s => !s.parent_secno).forEach(s => {
        const option = document.createElement('option');
        option.value = s.secno;
        option.textContent = s.name;
        parentSelect.appendChild(option);
    });
}

function buildTree(sections) {
    const map = {};
    sections.forEach(s => map[s.secno] = { ...s, children: [] });
    const tree = [];
    sections.forEach(s => {
        if (s.parent_secno) {
            if (map[s.parent_secno]) map[s.parent_secno].children.push(map[s.secno]);
        } else {
            tree.push(map[s.secno]);
        }
    });
    tree.forEach(parent => parent.children.sort((a, b) => a.display_order - b.display_order));
    return tree.sort((a, b) => a.display_order - b.display_order);
}

function renderSection(section, isFirstTopLevel = false) {
    const li = document.createElement('li');
    li.className = 'relative group';

    if (!section.parent_secno && !isFirstTopLevel) {
        const divider = document.createElement('div');
        divider.className = 'h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent my-2 mx-2';  
        li.appendChild(divider);
    }

    const div = document.createElement('div');
    div.className = 'flex items-center justify-between gap-2 px-3 py-1 rounded-md hover:bg-gray-50 transition-colors';

    const a = document.createElement('a');
    a.href = `/docs/${section.slug}`;
    a.textContent = section.name;
    a.dataset.secno = section.secno;
    a.className = 'block text-gray-800 font-medium hover:text-blue-600 flex-1';
    a.addEventListener('click', (e) => {
        e.preventDefault();
        loadContent(section.secno);
        history.pushState(null, '', `/docs/${section.slug}`);
    });

    div.appendChild(a);
    // const hasToken = !!localStorage.getItem('accessToken');

    // if (hasToken) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.title = 'Edit this section';
        editBtn.className = 
            'opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md ' +
            'hover:bg-blue-100 text-blue-600 hover:text-blue-800 focus:outline-none mr-1';
        editBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
        `;
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openEditModal(section);
        });
        div.insertBefore(editBtn, a.nextSibling); 
    // }

    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.title = 'Copy shareable link';
    copyBtn.className = 
        'opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md ' +
        'hover:bg-gray-200 text-gray-500 hover:text-gray-800 focus:outline-none';
    copyBtn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
    `;
    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const shareUrl = `${window.location.origin}/docs/${section.slug}`;
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            showMessage('Link copied to clipboard!', 'success');
        }).catch(() => {
            showMessage('Failed to copy link', 'error');
        });
    });
    div.appendChild(copyBtn);

    li.appendChild(div);

    if (section.children?.length > 0) {
        const ul = document.createElement('ul');
        ul.className = 'ml-5 mt-1 space-y-0.5 border-l border-gray-200 pl-3';
        section.children.forEach(child => {
            ul.appendChild(renderSection(child));   
        });
        li.appendChild(ul);
    }

    return li;
}

function openEditModal(section) {
    document.getElementById('modalTitle').textContent = `Edit: ${section.name}`;
    document.getElementById('sectionName').value = section.name;
    document.getElementById('displayOrder').value = section.display_order || 999;
    document.getElementById('metaDescription').value = section.metadescription || '';
    document.getElementById('metaKeywords').value = section.metakeywords || '';

    const parentSelect = document.getElementById('parentSecno');
    parentSelect.value = section.parent_secno || '';

    document.getElementById('editSecno').value = section.secno;

    document.getElementById('addSectionModal').classList.remove('hidden');
}

async function saveContent(content) {
    try {
        const response = await fetchWithToken('/api/v1/docs/upload/doc-html', {
            method: 'POST',
            body: JSON.stringify({ content, secno: currentSecno })
        });
        const data = await response.json();
        if (data.error) return showMessage(data.message, 'error');

        const updateResponse = await fetchWithToken(`/api/v1/docs/${currentSecno}`, {
            method: 'PUT',
            body: JSON.stringify({ content_path: data.content_path })
        });
        const updateData = await updateResponse.json();
        if (updateData.error) return showMessage(updateData.message, 'error');

        loadContent(currentSecno);
    } catch (err) {
        console.error(err);
        showMessage('Failed to save content', 'error');
    }
}

async function loadContent(secno) {
    if (loading) return;
    loading = true;
    try {
        const response = await fetchWithToken(`/api/v1/docs/${secno}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.error) return showMessage(data.message, 'error');

        const section = data.data;
        currentSecno = secno;
        updateMetadata(section);

        const contentArea = document.getElementById('contentArea');
        const editorContainer = document.getElementById('editorContainer');

        contentArea.innerHTML = '';
        editorContainer.classList.add('hidden');
        destroyEditor();

        if (section.content_path) {
            const cacheBustUrl = `${section.content_path}?v=${Date.now()}`;
            const htmlResponse = await fetch(cacheBustUrl);
            if (!htmlResponse.ok) throw new Error('Failed to load content file');

            const html = await htmlResponse.text();
            contentArea.innerHTML = html;

            const editBtn = document.createElement('button');
            editBtn.id = 'editContentBtn';
            editBtn.className = 'bg-yellow-500 text-white px-4 py-2 rounded mt-4';
            editBtn.textContent = 'Edit Content';
            editBtn.addEventListener('click', () => showEditor(html));
            // const hasToken = !!localStorage.getItem('accessToken');
            // if (hasToken) {
            //     contentArea.appendChild(editBtn);
            // }
            contentArea.appendChild(editBtn);
        } else {
            showEditor('');
        }

        fetchWithToken(`/api/v1/docs/${secno}/view`).catch(() => {});
    } catch (err) {
        console.error('Load content error:', err);
        document.getElementById('contentArea').innerHTML = `
            <p class="text-red-600">Failed to load content: ${err.message}</p>
            <p class="text-gray-600 mt-2">Please try again or contact support if the issue persists.</p>
        `;
    } finally {
        loading = false;
    }
}

function showEditor(initialContent = '') {
    destroyEditor(); 

    const editorContainer = document.getElementById('editorContainer');
    if (!editorContainer) {
        console.error('editorContainer not found after recreate');
        return;
    }

    editorContainer.classList.remove('hidden');

    const editorEl = document.getElementById('editor');
    if (!editorEl) {
        console.error('editor element not found');
        return;
    }

    editorEl.innerHTML = ''; 

    quill = new Quill('#editor', {
        theme: 'snow',
        modules: {
            toolbar: [
                ['bold', 'italic', 'underline', 'strike'],
                ['link', 'image', 'video'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'header': [1, 2, 3, 4, 5, 6, false] }]
            ]
        }
    });

    if (initialContent) {
        quill.root.innerHTML = initialContent;
    }
}

document.getElementById('saveContentBtn')?.addEventListener('click', () => {
    if (quill) {
        const content = quill.root.innerHTML;
        saveContent(content);
    }
});

document.getElementById('addSectionBtn').addEventListener('click', () => {
    resetModalForm();
    document.getElementById('addSectionModal').classList.remove('hidden');
});

document.getElementById('cancelAddSection').addEventListener('click', () => {
    resetModalForm();
    document.getElementById('addSectionModal').classList.add('hidden');
});

document.getElementById('addSectionForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const editSecno = document.getElementById('editSecno').value;
    const isEdit = !!editSecno;

    const nameInput = document.getElementById('sectionName');
    const parentSelect = document.getElementById('parentSecno');
    const orderInput = document.getElementById('displayOrder');

    const meta_description = document.getElementById('metaDescription').value.trim();
    const meta_keywords = document.getElementById('metaKeywords').value.trim();

    const name = nameInput.value.trim();
    const parent_secno = parentSelect.value || null;
    const display_order = parseInt(orderInput.value) || 999;

    const payload = { 
        name, 
        display_order 
    };
    payload.metadescription = meta_description;
    payload.metakeywords = meta_keywords;

    if (parentSelect.value.trim() !== '') {
        payload.parent_secno = parentSelect.value;
    }

    try {
        if (isEdit) {
            response = await fetchWithToken(`/api/v1/docs/${editSecno}`, {
                method: 'PUT',
                body: JSON.stringify(payload)
            });
        } else {
            response = await fetchWithToken('/api/v1/docs', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        }

        const data = await response.json();
        if (data.error) return showMessage(data.message, 'error');

        nameInput.value = '';
        parentSelect.value = '';          
        orderInput.value = '999';

        document.getElementById('editSecno').value = '';
        document.getElementById('modalTitle').textContent = 'Add New Section';
        document.getElementById('addSectionModal').classList.add('hidden');
        showMessage(data.message, 'success');
        loadSections(true);
    } catch (err) {
        console.error(err);
        showMessage('Failed to add section', 'error');
    }
});

loadSections();
const urlParams = new URLSearchParams(window.location.search);
const initialSecno = urlParams.get('secno');
if (initialSecno) {
    setTimeout(() => {
        loadContent(initialSecno);
    }, 800); 
}
