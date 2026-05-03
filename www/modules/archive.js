// modules/archive.js - 万物归档 (经验书架) V5.0 搜罗万象版

window.archiveDb = window.archiveDb || {};
window.archiveState = { level: 'home', bookId: null, chapterId: null, isSortingMode: false, searchScope: 'global', searchKeyword: '' };
window.archiveHistoryStack = [];
window.archiveActionTarget = null; 
window.archivePromptState = null; 

const bookColors = ['bg-slate-700 border-slate-900', 'bg-indigo-800 border-indigo-950', 'bg-rose-800 border-rose-950', 'bg-cyan-800 border-cyan-950'];

// ==========================================
// 🌟 核心引擎 1：全局 & 局部搜索引擎
// ==========================================
window.openArchiveSearch = function(scope) {
    window.archiveHistoryStack.push({...window.archiveState});
    window.archiveState.level = 'search';
    window.archiveState.searchScope = scope; // 'global' 或 具体的 bookId
    window.archiveState.searchKeyword = '';  // 每次新开搜索清空词条
    renderArchiveApp();
};

window.executeArchiveSearch = function(keyword) {
    window.archiveState.searchKeyword = keyword; // 记录状态，保证返回时能记住
    const resultsContainer = document.getElementById('archiveSearchResults');
    if (!resultsContainer) return;
    
    keyword = keyword.trim().toLowerCase();
    if (!keyword) {
        resultsContainer.innerHTML = `<div class="text-center text-stone-400 py-20 mt-10">输入关键词开始搜索</div>`;
        return;
    }

    const scope = window.archiveState.searchScope;
    let results = [];
    
    // 智能划定搜索范围
    const booksToSearch = scope === 'global' ? Object.values(window.archiveDb) : (window.archiveDb[scope] ? [window.archiveDb[scope]] : []);

    booksToSearch.forEach(book => {
        if (!book || !book.chapters) return;
        Object.values(book.chapters).forEach(chapter => {
            if (!chapter.entries) return;
            chapter.entries.forEach(entry => {
                // 隐身解析剥离HTML，实现真正纯净的文本匹配
                let tempDiv = document.createElement('div');
                tempDiv.innerHTML = entry.html || '';
                let plainText = tempDiv.innerText.toLowerCase();
                let titleText = (entry.title || '').toLowerCase();

                if (titleText.includes(keyword) || plainText.includes(keyword)) {
                    results.push({ book, chapter, entry });
                }
            });
        });
    });

    if (results.length === 0) {
        resultsContainer.innerHTML = `<div class="text-center text-stone-400 py-20 mt-10">未找到与“${keyword}”相关的内容</div>`;
        return;
    }

    resultsContainer.innerHTML = results.map(res => `
        <div class="bg-white px-5 py-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-stone-100 flex flex-col gap-2 mb-3 cursor-pointer active:scale-[0.98] transition-transform" 
             onclick="openArchiveEntry('${res.entry.id}', '${res.book.id}', '${res.chapter.id}')">
            <div class="flex items-center gap-2">
                <span class="text-lg opacity-60">📄</span>
                <h3 class="font-bold text-stone-700 text-[15px] truncate">${res.entry.title || '无标题记录'}</h3>
            </div>
            <div class="text-[10px] text-stone-400 font-bold tracking-widest bg-stone-50 inline-block px-2.5 py-1.5 rounded-full w-max">
                《${res.book.title}》 - ${res.chapter.title}
            </div>
        </div>
    `).join('');
};

// ==========================================
// 🌟 核心引擎 2：高质感自定义弹窗
// ==========================================
window.openArchivePrompt = function(title, placeholder, defaultValue, confirmCallback) {
    window.archivePromptState = { title, placeholder, defaultValue, confirmCallback };
    renderArchiveApp();
    setTimeout(() => {
        const input = document.getElementById('archiveCustomInput');
        if(input) { input.focus(); input.setSelectionRange(0, input.value.length); }
    }, 50);
};

window.closeArchivePrompt = function() {
    window.archivePromptState = null;
    renderArchiveApp();
};

window.confirmArchivePrompt = function() {
    if(!window.archivePromptState) return;
    const input = document.getElementById('archiveCustomInput');
    const val = input ? input.value.trim() : '';
    if (val) window.archivePromptState.confirmCallback(val);
    else window.closeArchivePrompt(); 
};

// ==========================================
// 🌟 核心引擎 3：拖拽排序
// ==========================================
window.toggleArchiveSortMode = function() {
    window.archiveState.isSortingMode = !window.archiveState.isSortingMode;
    renderArchiveApp();
};

window.initDragSortable = function(containerId, type) {
    if (!window.archiveState.isSortingMode) return;
    const el = document.getElementById(containerId);
    if (!el) return;

    if (typeof Sortable === 'undefined') {
        const script = document.createElement('script');
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.0/Sortable.min.js";
        script.onload = () => bindSortable(el, type);
        document.head.appendChild(script);
    } else {
        bindSortable(el, type);
    }
};

function bindSortable(el, type) {
    Sortable.create(el, {
        animation: 250, delay: 150, delayOnTouchOnly: true, ghostClass: 'opacity-40', 
        onEnd: function (evt) {
            const oldIdx = evt.oldIndex; const newIdx = evt.newIndex;
            if (oldIdx === newIdx) return;

            if (type === 'book') {
                const keys = Object.keys(window.archiveDb);
                const movedKey = keys.splice(oldIdx, 1)[0]; keys.splice(newIdx, 0, movedKey);
                const newDb = {}; keys.forEach(k => newDb[k] = window.archiveDb[k]); window.archiveDb = newDb;
            } else if (type === 'chapter') {
                const book = window.archiveDb[window.archiveState.bookId];
                const keys = Object.keys(book.chapters);
                const movedKey = keys.splice(oldIdx, 1)[0]; keys.splice(newIdx, 0, movedKey);
                const newChaps = {}; keys.forEach(k => newChaps[k] = book.chapters[k]); book.chapters = newChaps;
            } else if (type === 'entry') {
                const chapter = window.archiveDb[window.archiveState.bookId].chapters[window.archiveState.chapterId];
                const movedItem = chapter.entries.splice(oldIdx, 1)[0]; chapter.entries.splice(newIdx, 0, movedItem);
            }
            if (typeof window.saveToLocal === 'function') window.saveToLocal();
        }
    });
}

// ==========================================
// 🌟 核心引擎 4：长按菜单 (重命名/删除)
// ==========================================
let archivePressTimer = null;
window.isArchiveLongPressing = false; 

window.startArchiveLongPress = function(type, id) {
    window.isArchiveLongPressing = false;
    if (window.archiveState.isSortingMode) return; 

    archivePressTimer = setTimeout(() => {
        window.isArchiveLongPressing = true;
        if(window.navigator.vibrate) navigator.vibrate(50); 
        window.archiveActionTarget = { type, id };
        renderArchiveApp(); 
    }, 500); 
};

window.cancelArchiveLongPress = function() {
    if(archivePressTimer) clearTimeout(archivePressTimer);
    setTimeout(() => { window.isArchiveLongPressing = false; }, 50);
};

window.renameArchiveTarget = function() {
    const { type, id } = window.archiveActionTarget;
    let targetObj = null;
    if (type === 'book') targetObj = window.archiveDb[id];
    else if (type === 'chapter') targetObj = window.archiveDb[window.archiveState.bookId].chapters[id];
    else if (type === 'entry') targetObj = window.archiveDb[window.archiveState.bookId].chapters[window.archiveState.chapterId].entries.find(e => e.id === id);

    if (!targetObj) return;
    window.archiveActionTarget = null;
    window.openArchivePrompt("修改名称", "请输入新名称", targetObj.title, (newName) => {
        targetObj.title = newName;
        if (typeof window.saveToLocal === 'function') window.saveToLocal();
        window.closeArchivePrompt(); renderArchiveApp();
    });
};

window.deleteArchiveTarget = function() {
    const { type, id } = window.archiveActionTarget;
    let confirmMsg = type === 'book' ? '⚠️ 确定要删除这本书及其所有章节吗？此操作不可恢复！' :
                     type === 'chapter' ? '⚠️ 确定要删除这个章节吗？' : '确定要删除这篇记录吗？';

    if (confirm(confirmMsg)) {
        if (type === 'book') delete window.archiveDb[id];
        else if (type === 'chapter') delete window.archiveDb[window.archiveState.bookId].chapters[id];
        else if (type === 'entry') {
            const chapter = window.archiveDb[window.archiveState.bookId].chapters[window.archiveState.chapterId];
            chapter.entries = chapter.entries.filter(e => e.id !== id);
        }
        if (typeof window.saveToLocal === 'function') window.saveToLocal();
    }
    window.archiveActionTarget = null; renderArchiveApp();
};

// ==========================================
// 🌟 UI 组件：极简顶栏导航
// ==========================================
function renderArchiveHeader(title, backAction) {
    const isSorting = window.archiveState.isSortingMode;
    const scope = window.archiveState.bookId || 'global';
    // 🌟 完美修复的搜索与排序 SVG
    return `
        <div class="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#faf9f6]/95 backdrop-blur z-20 border-b border-stone-100/50">
            <button onclick="${backAction}" class="p-1.5 -ml-1 text-stone-400 hover:text-stone-700 active:scale-90 transition-transform shrink-0">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"></path></svg>
            </button>
            
            <h1 class="text-[17px] font-serif font-bold text-stone-800 flex-1 text-center truncate px-2">${title}</h1>
            
            <div class="flex gap-1 items-center shrink-0">
                ${!isSorting ? `
                <button onclick="openArchiveSearch('${scope}')" class="p-1.5 text-stone-400 hover:text-indigo-600 active:scale-90 transition-transform">
                    <svg class="w-[20px] h-[20px]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path></svg>
                </button>` : ''}
                <button onclick="toggleArchiveSortMode()" class="p-1.5 ${isSorting ? 'bg-indigo-50 text-indigo-600 rounded-lg' : 'text-stone-400 hover:text-indigo-600'} active:scale-90 transition-all">
                    ${isSorting ? '<svg class="w-[20px] h-[20px]" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>' : '<svg class="w-[20px] h-[20px]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V3"></path></svg>'}
                </button>
            </div>
        </div>
    `;
}

// ==========================================
// 🌟 主渲染引擎
// ==========================================
window.renderArchiveApp = function() {
    const app = document.getElementById('app');
    const isSorting = window.archiveState.isSortingMode;
    let htmlContent = '';

    // ---------------- Level 1: 归档大书架 ----------------
    if (window.archiveState.level === 'home') {
        const books = Object.keys(window.archiveDb).map(k => window.archiveDb[k]);
        let booksHtml = books.length === 0 ? 
            `<div class="col-span-2 text-center text-stone-400 py-10 mt-10"><span class="text-5xl opacity-50 block mb-2">📚</span>书架空空如也</div>` : 
            books.map((book, index) => {
                const colorClass = bookColors[index % bookColors.length];
                const chapterCount = Object.keys(book.chapters || {}).length;
                return `
                <div ontouchstart="startArchiveLongPress('book', '${book.id}')" ontouchend="cancelArchiveLongPress()" ontouchmove="cancelArchiveLongPress()"
                     onclick="if(!window.isArchiveLongPressing && !${isSorting}) openArchiveBook('${book.id}')" 
                     class="book-spine relative ${colorClass} h-48 rounded-xl shadow-lg p-4 text-white flex flex-col justify-between ${!isSorting ? 'hover:-translate-y-2 cursor-pointer' : 'cursor-move ring-2 ring-indigo-400/50'} transition-all">
                    <h2 class="text-2xl font-serif font-bold leading-tight">${book.title}</h2>
                    <p class="text-xs opacity-70 font-mono tracking-widest">${chapterCount} 章节</p>
                    ${isSorting ? `<div class="absolute right-3 top-3 w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur shadow-sm pointer-events-none"><svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5"></path></svg></div>` : ''}
                </div>`;
            }).join('');

        htmlContent = `
            <div class="h-full flex flex-col bg-[#faf9f6] relative animate-fade-in">
                <div class="absolute top-4 w-full left-0 px-6 flex justify-between items-center z-20">
                    <button onclick="switchToTimeMode()" class="flex items-center justify-center w-10 h-10 bg-white/60 backdrop-blur-md rounded-full shadow-sm border border-white/50 text-stone-500 hover:text-stone-800 active:scale-90 transition-transform shrink-0">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"></path></svg>
                    </button>
                    <div class="flex gap-2 items-center shrink-0">
                        ${!isSorting ? `
                        <!-- 🌟 这里引入了全局搜索的入口 -->
                        <button onclick="openArchiveSearch('global')" class="flex items-center justify-center w-10 h-10 bg-white/60 backdrop-blur-md rounded-full shadow-sm border border-white/50 text-stone-500 hover:text-indigo-600 active:scale-90 transition-transform">
                            <svg class="w-[20px] h-[20px]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path></svg>
                        </button>` : ''}
                        <button onclick="toggleArchiveSortMode()" class="flex items-center justify-center w-10 h-10 ${isSorting ? 'bg-indigo-50 text-indigo-600' : 'bg-white/60 backdrop-blur-md text-stone-500'} rounded-full shadow-sm border border-white/50 hover:text-indigo-600 active:scale-90 transition-all">
                            ${isSorting ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>' : '<svg class="w-[20px] h-[20px]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7.5L7.5 3m0 0L12 7.5M7.5 3v13.5m13.5 0L16.5 21m0 0L12 16.5m4.5 4.5V3"></path></svg>'}
                        </button>
                    </div>
                </div>

                <div class="flex-1 overflow-y-auto p-6 pt-24 pb-32">
                    <div class="text-center mb-10">
                        <h1 class="text-4xl font-serif font-bold text-stone-800 tracking-wider">万物归档</h1>
                        <p class="text-[11px] text-stone-400 mt-3 tracking-widest uppercase">积累与沉淀</p>
                    </div>
                    ${isSorting ? `<div class="text-xs text-indigo-500 font-bold mb-4 flex justify-center items-center gap-1 bg-indigo-50 py-2 rounded-full"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.805-4.522 4.041.528-2.336 2.24zm-4.14-11.2l-1.358 5.071m0 0l2.51-2.224-.805 4.521-4.041-.527 2.336-2.24z"></path></svg>长按卡片可自由拖拽排序</div>` : ''}
                    <div id="drag-books-container" class="grid grid-cols-2 gap-6 mt-2">${booksHtml}</div>
                </div>

                ${!isSorting ? `
                <div class="fixed bottom-8 right-8 z-40">
                    <button onclick="createNewArchiveBook()" class="bg-indigo-600 text-white w-14 h-14 rounded-full shadow-[0_4px_20px_rgba(79,70,229,0.4)] flex items-center justify-center text-3xl font-light hover:scale-105 active:scale-95 transition-transform pb-1">+</button>
                </div>` : ''}
            </div>
        `;
        setTimeout(() => window.initDragSortable('drag-books-container', 'book'), 100);
    } 
    // ---------------- Level 2: 章节列表 ----------------
    else if (window.archiveState.level === 'book') {
        const book = window.archiveDb[window.archiveState.bookId];
        const chapters = Object.keys(book.chapters || {}).map(k => book.chapters[k]);

        let chaptersHtml = chapters.length === 0 ? 
            `<div class="text-center text-stone-400 py-20">还没有任何章节哦</div>` : 
            chapters.map(chap => `
            <div ontouchstart="startArchiveLongPress('chapter', '${chap.id}')" ontouchend="cancelArchiveLongPress()" ontouchmove="cancelArchiveLongPress()"
                 onclick="if(!window.isArchiveLongPressing && !${isSorting}) openArchiveChapter('${chap.id}')" 
                 class="bg-white px-5 py-5 rounded-2xl shadow-[0_2px_12px_-4px_rgba(0,0,0,0.06)] border border-stone-100 flex justify-between items-center relative mb-4 ${!isSorting ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]' : 'cursor-move ring-1 ring-indigo-200'} transition-all">
                <div class="flex flex-col gap-1 pr-4 flex-1">
                    <span class="text-base font-bold text-stone-700 tracking-wide">${chap.title}</span>
                </div>
                ${isSorting ? `<div class="absolute right-4 text-stone-300 pointer-events-none"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5"></path></svg></div>` : `<div class="flex items-center gap-2 shrink-0"><span class="text-[11px] font-bold text-stone-400 bg-stone-50 px-2.5 py-1 rounded-full">${(chap.entries || []).length} 篇</span><span class="text-stone-300 font-bold text-lg leading-none">›</span></div>`}
            </div>`).join('');

        htmlContent = `
            <div class="h-full flex flex-col bg-[#faf9f6] relative animate-fade-in">
                ${renderArchiveHeader(`《${book.title}》`, 'goBackArchive()')}
                <div class="flex-1 overflow-y-auto px-6 py-4 pb-32">
                    ${isSorting ? `<div class="bg-indigo-50 text-indigo-500 text-xs font-bold py-2 text-center rounded-xl mb-4 shadow-sm">长按条目可自由拖拽排序</div>` : ''}
                    <div id="drag-chapters-container" class="flex flex-col">${chaptersHtml}</div>
                </div>
                ${!isSorting ? `
                <div class="fixed bottom-8 right-8 z-40">
                    <button onclick="createNewChapter()" class="bg-stone-800 text-white px-6 py-3.5 rounded-full shadow-[0_4px_15px_rgba(0,0,0,0.2)] flex items-center gap-2 text-sm font-bold active:scale-95 transition-transform tracking-widest">
                        <span>+</span> 新建章节
                    </button>
                </div>` : ''}
            </div>
        `;
        setTimeout(() => window.initDragSortable('drag-chapters-container', 'chapter'), 100);
    }
    // ---------------- Level 3: 文章列表 ----------------
    else if (window.archiveState.level === 'chapter') {
        const book = window.archiveDb[window.archiveState.bookId];
        const chapter = book.chapters[window.archiveState.chapterId];
        
        let entriesHtml = (chapter.entries || []).length === 0 ? 
            `<div class="text-center text-stone-400 py-20 mt-10">这个章节还没有记录<br>点击右下角立刻创建</div>` : 
            (chapter.entries || []).map(entry => `
                <div class="bg-white px-5 py-4 rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-stone-100 flex items-center justify-between mb-3 relative ${!isSorting ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]' : 'cursor-move ring-1 ring-indigo-200'} transition-all" 
                     ontouchstart="startArchiveLongPress('entry', '${entry.id}')" ontouchend="cancelArchiveLongPress()" ontouchmove="cancelArchiveLongPress()"
                     onclick="if(!window.isArchiveLongPressing && !${isSorting}) openArchiveEntry('${entry.id}')">
                    <div class="flex items-center gap-3 overflow-hidden pr-8 flex-1">
                        <span class="text-xl opacity-60 drop-shadow-sm shrink-0">📄</span>
                        <h3 class="font-bold text-stone-700 text-[15px] truncate">${entry.title || '无标题记录'}</h3>
                    </div>
                    ${isSorting ? `<div class="absolute right-4 text-stone-300 pointer-events-none"><svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3.75 9h16.5m-16.5 6.75h16.5"></path></svg></div>` : `<div class="text-stone-300 font-bold text-lg leading-none shrink-0 absolute right-4">›</div>`}
                </div>`).join('');

        htmlContent = `
            <div class="h-full flex flex-col bg-[#faf9f6] relative animate-fade-in">
                ${renderArchiveHeader(chapter.title, 'goBackArchive()')}
                <div class="flex-1 overflow-y-auto px-6 py-4 pb-32">
                    ${isSorting ? `<div class="bg-indigo-50 text-indigo-500 text-xs font-bold py-2 text-center rounded-xl mb-4 shadow-sm">长按条目可自由拖拽排序</div>` : ''}
                    <div id="drag-entries-container" class="flex flex-col">${entriesHtml}</div>
                </div>
                ${!isSorting ? `
                <div class="fixed bottom-8 right-8 z-40">
                    <button onclick="createNewArchiveEntry()" class="bg-indigo-600 text-white px-6 py-3.5 rounded-full shadow-[0_4px_15px_rgba(79,70,229,0.3)] flex items-center gap-2 text-sm font-bold active:scale-95 transition-transform tracking-widest">
                        <span>写一篇</span>
                    </button>
                </div>` : ''}
            </div>
        `;
        setTimeout(() => window.initDragSortable('drag-entries-container', 'entry'), 100);
    }
    // ---------------- Level 4: 归档文章阅读页 ----------------
    else if (window.archiveState.level === 'entryView') {
        const book = window.archiveDb[window.archiveState.bookId];
        const chapter = book.chapters[window.archiveState.chapterId];
        const entry = chapter.entries.find(e => e.id === window.archiveState.entryId);

        if(!entry) return goBackArchive();

        htmlContent = `
            <div class="h-full bg-[#faf9f6] flex flex-col relative overflow-y-auto">
                <div class="flex items-center justify-between px-4 py-3 sticky top-0 bg-[#faf9f6]/95 backdrop-blur z-20 border-b border-stone-100/50">
                    <button onclick="goBackArchive()" class="p-1.5 -ml-1 text-stone-400 hover:text-stone-700 active:scale-90 transition-transform">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"></path></svg>
                    </button>
                    <button onclick="editArchiveEntry('${entry.id}')" class="text-stone-500 hover:text-cyan-600 font-bold text-sm bg-white px-4 py-1.5 rounded-full shadow-sm border border-stone-100 active:scale-90 transition-transform">编辑</button>
                </div>
                <div class="px-6 pb-32 pt-6">
                    <h1 class="text-2xl font-bold text-stone-800 mb-8 tracking-wide">《${entry.title || '无标题'}》</h1>
                    <div class="read-only-mode article-content text-stone-700 leading-loose">${entry.html}</div>
                </div>
            </div>
        `;
    }
    // ---------------- Level 5: 🌟 搜索界面 🌟 ----------------
    else if (window.archiveState.level === 'search') {
        const scope = window.archiveState.searchScope;
        let scopeName = '全局搜索';
        if (scope !== 'global' && window.archiveDb[scope]) {
            scopeName = `搜索《${window.archiveDb[scope].title}》`;
        }
        
        const savedKeyword = window.archiveState.searchKeyword || '';

        htmlContent = `
            <div class="h-full flex flex-col bg-[#faf9f6] relative animate-fade-in">
                <div class="flex items-center gap-3 px-4 py-3 sticky top-0 bg-[#faf9f6]/95 backdrop-blur z-20 border-b border-stone-100/50">
                    <button onclick="goBackArchive()" class="p-1.5 -ml-1 text-stone-400 hover:text-stone-700 active:scale-90 transition-transform shrink-0">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"></path></svg>
                    </button>
                    <div class="flex-1 relative">
                        <input type="text" id="archiveSearchInput" placeholder="${scopeName}..." value="${savedKeyword}"
                               class="w-full bg-white border border-stone-200 rounded-full px-4 py-2 text-stone-700 text-sm outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 shadow-inner transition-all pl-10" 
                               oninput="executeArchiveSearch(this.value)">
                        <svg class="w-[18px] h-[18px] text-stone-400 absolute left-4 top-2.5" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"></path></svg>
                    </div>
                </div>
                <div class="flex-1 overflow-y-auto px-6 py-4 pb-32" id="archiveSearchResults">
                    <div class="text-center text-stone-400 py-20 mt-10">输入关键词开始搜索</div>
                </div>
            </div>
        `;
        
        // 如果是从阅读页返回来的，自动重新执行一次搜索填充列表
        if (savedKeyword) {
            setTimeout(() => executeArchiveSearch(savedKeyword), 50);
        }
        
        setTimeout(() => {
            const input = document.getElementById('archiveSearchInput');
            if (input && !savedKeyword) input.focus();
        }, 100);
    }

    // 🌟 弹出层 HTML (包含长按菜单 和 自定义重命名输入框)
    let modalsHtml = '';
    
    if (window.archiveActionTarget) {
        modalsHtml += `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[200] flex items-end justify-center animate-fade-in" onclick="window.archiveActionTarget=null; renderArchiveApp();">
            <div class="bg-[#f5f5f4] w-full rounded-t-3xl p-6 pb-12 transform transition-transform shadow-2xl" onclick="event.stopPropagation()">
                <div class="w-12 h-1.5 bg-stone-300 rounded-full mx-auto mb-6"></div>
                <h3 class="text-sm font-bold text-stone-400 mb-4 tracking-widest text-center border-b border-stone-200 pb-3">归档操作</h3>
                <div class="flex flex-col gap-3">
                    <button onclick="renameArchiveTarget()" class="w-full py-4 text-stone-700 font-bold text-lg bg-white rounded-2xl shadow-sm hover:bg-stone-50 active:scale-95 transition-all">重命名</button>
                    <button onclick="deleteArchiveTarget()" class="w-full py-4 text-rose-500 font-bold text-lg bg-white rounded-2xl shadow-sm hover:bg-rose-50 active:scale-95 transition-all">删除</button>
                </div>
            </div>
        </div>`;
    }

    if (window.archivePromptState) {
        modalsHtml += `
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[300] flex items-center justify-center animate-fade-in" onclick="closeArchivePrompt()">
            <div class="bg-white w-[80%] max-w-sm rounded-2xl p-6 shadow-2xl transform transition-transform" onclick="event.stopPropagation()">
                <h3 class="text-lg font-bold text-stone-800 mb-5 text-center tracking-wide">${window.archivePromptState.title}</h3>
                <input type="text" id="archiveCustomInput" placeholder="${window.archivePromptState.placeholder}" value="${window.archivePromptState.defaultValue}" 
                       class="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 text-stone-700 outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 transition-all text-[15px] mb-6 shadow-inner"
                       onkeydown="if(event.key === 'Enter') confirmArchivePrompt()">
                <div class="flex gap-3">
                    <button onclick="closeArchivePrompt()" class="flex-1 py-2.5 text-stone-500 font-bold bg-stone-100 rounded-xl hover:bg-stone-200 active:scale-95 transition-all tracking-wider">取消</button>
                    <button onclick="confirmArchivePrompt()" class="flex-1 py-2.5 text-white font-bold bg-indigo-600 rounded-xl shadow-md hover:bg-indigo-500 active:scale-95 transition-all tracking-wider">确定</button>
                </div>
            </div>
        </div>`;
    }

    app.innerHTML = htmlContent + modalsHtml;
};

// ==========================================
// 🌟 跳转与新建控制区
// ==========================================
window.switchToTimeMode = function() {
    window.appMode = 'time';
    if (typeof render === 'function') render(); 
};

window.goBackArchive = function() {
    window.archiveState.isSortingMode = false; 
    if (window.archiveHistoryStack.length > 0) {
        window.archiveState = window.archiveHistoryStack.pop();
        renderArchiveApp();
    } else {
        window.archiveState.level = 'home';
        renderArchiveApp();
    }
};

window.createNewArchiveBook = function() {
    window.openArchivePrompt("新建归档书", "如：编程笔记、读书心得等", "", (title) => {
        const newId = 'book_' + Date.now();
        window.archiveDb[newId] = { id: newId, title: title, createdAt: new Date().toISOString(), chapters: {} };
        if (typeof window.saveToLocal === 'function') window.saveToLocal();
        window.closeArchivePrompt();
        renderArchiveApp();
    });
};

window.openArchiveBook = function(id) {
    window.archiveHistoryStack.push({...window.archiveState});
    window.archiveState.level = 'book';
    window.archiveState.bookId = id;
    renderArchiveApp();
};

window.createNewChapter = function() {
    window.openArchivePrompt("新建章节", "输入章节名称", "", (title) => {
        const newId = 'chap_' + Date.now();
        const book = window.archiveDb[window.archiveState.bookId];
        if(!book.chapters) book.chapters = {};
        book.chapters[newId] = { id: newId, title: title, entries: [] };
        if (typeof window.saveToLocal === 'function') window.saveToLocal();
        window.closeArchivePrompt();
        renderArchiveApp();
    });
};

window.openArchiveChapter = function(id) {
    window.archiveHistoryStack.push({...window.archiveState});
    window.archiveState.level = 'chapter';
    window.archiveState.chapterId = id;
    renderArchiveApp();
};

window.createNewArchiveEntry = function() {
    const bId = window.archiveState.bookId;
    const cId = window.archiveState.chapterId;
    if (!bId || !cId) return alert("请先进入具体的章节列表再创建文章哦！");

    window.appMode = 'archive';
    window.state.archiveBookId = bId;
    window.state.archiveChapterId = cId;
    window.archiveTempTitle = ''; 
    window.state.editingId = null; 

    window.goToEditor('article'); 
};

// 🌟 这里升级了：兼容从搜索列表直接传 bId 和 cId 进来跳页
window.openArchiveEntry = function(id, bId = null, cId = null) {
    window.archiveHistoryStack.push({...window.archiveState});
    if (bId) window.archiveState.bookId = bId;
    if (cId) window.archiveState.chapterId = cId;
    window.archiveState.level = 'entryView';
    window.archiveState.entryId = id;
    renderArchiveApp();
};

window.editArchiveEntry = function(id) {
    const book = window.archiveDb[window.archiveState.bookId];
    const chapter = book.chapters[window.archiveState.chapterId];
    const entry = chapter.entries.find(e => e.id === id);

    window.appMode = 'archive';
    window.state.archiveBookId = window.archiveState.bookId;
    window.state.archiveChapterId = window.archiveState.chapterId;
    window.state.editingId = id; 

    window.isEditorDirty = false;
    window.editorMeta = {
        date: entry.time ? window.formatDateTimeLocal(new Date(entry.time)) : window.formatDateTimeLocal(new Date()),
        location: '', weather: '',
        wordCount: entry.wordCount || 0,
        isArticleMode: true,
        hasPromptedArticle: true,
        title: entry.title || '', 
        device: entry.device || 'Echo 客户端'
    };

    window.historyStack.push({...window.state});
    window.state.level = 'editor';
    if(typeof render === 'function') render();
};