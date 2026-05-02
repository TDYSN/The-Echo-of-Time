// app.js - V4.3 纯净视图渲染层 (新增一键提速清洗引擎)

window.state = { level: 'home', year: null, month: null, day: null, editingId: null, currentArticleId: null };
window.editorMeta = { date: '', location: '', weather: '', wordCount: 0, isArticleMode: false, hasPromptedArticle: false, title: '', device: '' };
window.historyStack = [];
window.tempSelectedLoc = '';
window.savedRange = null;
window.isEditorDirty = false;
window.isEditorInitializing = false; 

// ========================
// 🌟 核心提速引擎：清洗历史 Base64 数据
// ========================
window.migrateOldBase64Data = async function() {
    if(!confirm("准备将历史图片和录音转移至物理沙盒，这会大幅提升App加载速度。\n\n处理过程中请不要退出App，确定开始吗？")) return;

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 bg-white/90 backdrop-blur-sm z-[200] flex flex-col items-center justify-center';
    overlay.innerHTML = `
        <div class="text-6xl animate-bounce mb-4">🛁</div>
        <h2 class="text-xl font-bold text-stone-700 mb-2">正在清洗历史数据...</h2>
        <p class="text-sm text-stone-500" id="migrationProgress">这可能需要几分钟，请耐心等待</p>
    `;
    document.body.appendChild(overlay);

    let totalReplaced = 0;
    const progressEl = document.getElementById('migrationProgress');

    try {
        for (let y in db) {
            for (let m in db[y]) {
                for (let entry of db[y][m]) {
                    // 只要发现有 base64 的特征头，就进行处理
                    if (entry.html.includes('data:image') || entry.html.includes('data:video') || entry.html.includes('data:audio')) {
                        
                        let tempDiv = document.createElement('div');
                        tempDiv.innerHTML = entry.html;
                        
                        // 提取所有 src 是 base64 的多媒体元素
                        let medias = tempDiv.querySelectorAll('img[src^="data:"], video[src^="data:"], audio[src^="data:"]');

                        for (let media of medias) {
                            let type = media.tagName.toLowerCase();
                            if(type === 'audio') type = 'voice'; // 映射到底层的类型
                            
                            let base64Data = media.src;
                            progressEl.innerText = `正在抽取并落盘第 ${totalReplaced + 1} 个文件...`;
                            
                            // 调用 storage.js 里的物理落盘函数
                            let newUrl = await window.saveMediaToDisk(base64Data, type);
                            media.src = newUrl; // 替换为极短的物理路径
                            totalReplaced++;
                        }
                        
                        entry.html = tempDiv.innerHTML; // 更新日记内容
                    }
                }
            }
        }

        if (totalReplaced > 0) {
            progressEl.innerText = "数据清洗完毕，正在保存数据库...";
            if(typeof window.saveToLocal === 'function') await window.saveToLocal();
            alert(`✅ 提速大成功！\n\n共抽出并清洗了 ${totalReplaced} 个旧媒体文件！\n现在的数据库已经极致瘦身，彻底身轻如燕啦！`);
        } else {
            alert('🎉 扫描完毕！没有发现需要清洗的旧数据，你的 App 已经处于最快状态！');
        }

    } catch (e) {
        console.error(e);
        alert("❌ 清洗过程中发生错误：" + e.message);
    } finally {
        document.body.removeChild(overlay);
    }
};

// UI 交互辅助函数
function toggleSidebar() { const sidebar = document.getElementById('sidebar'); sidebar.classList.contains('-translate-x-full') ? openSidebar() : closeSidebar(); }
function openSidebar() {
    let totalDays = 0;
    for(let y in db) { for(let m in db[y]) { totalDays += new Set(db[y][m].map(e => e.day)).size; } }
    document.getElementById('statDays').innerText = totalDays;
    document.getElementById('sidebar').classList.remove('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.remove('hidden');
}
function closeSidebar() { document.getElementById('sidebar').classList.add('-translate-x-full'); document.getElementById('sidebarOverlay').classList.add('hidden'); }

// 修改 app.js 中的 openLocationModal 函数
window.openLocationModal = function() { 
    const input = document.getElementById('customLocationInput');
    // 如果当前已经有定位了，就把原定位填进去方便修改；如果没有就留空
    if (input) {
        input.value = (window.editorMeta && window.editorMeta.location) ? window.editorMeta.location : '';
    }
    document.getElementById('locationModal').classList.remove('hidden'); 
};
window.closeLocationModal = function() { document.getElementById('locationModal').classList.add('hidden'); };
window.finalizeLocation = function(oldTitle) { 
    const title = document.getElementById('locationModalTitle');
    if(title) title.innerText = oldTitle; 
    closeLocationModal(); 
    updateLocationDOM(); 
};
window.setCustomLocation = function() { const input = document.getElementById('customLocationInput'); if (input.value.trim()) { editorMeta.location = input.value.trim(); isEditorDirty = true; input.value = ''; closeLocationModal(); updateLocationDOM(); } };
window.clearLocation = function() { editorMeta.location = ''; isEditorDirty = true; closeLocationModal(); updateLocationDOM(); };

window.openWeatherModal = function() { document.getElementById('weatherModal').classList.remove('hidden'); };
window.closeWeatherModal = function() { document.getElementById('weatherModal').classList.add('hidden'); };
window.selectWeather = function(w) { 
    editorMeta.weather = w; isEditorDirty = true; closeWeatherModal(); 
    const wd = document.getElementById('weatherDisplay');
    if (wd) wd.innerText = w || '🌤️ 天气';
    const awd = document.getElementById('articleWeatherDisplay');
    if (awd) awd.innerText = w || '(无天气信息)';
};

window.updateLocationDOM = function() {
    const ld = document.getElementById('locDisplay');
    if (ld) ld.innerText = editorMeta.location || '定位';
    const ald = document.getElementById('articleLocDisplay');
    if (ald) ald.innerText = editorMeta.location || '(无位置信息)';
};

window.updateDateDOM = function() {
    const entryD = new Date(editorMeta.date);
    const mm = entryD.getMonth() + 1, dd = entryD.getDate();
    const hrs = String(entryD.getHours()).padStart(2, '0'), mins = String(entryD.getMinutes()).padStart(2, '0');
    const wd = ['周日','周一','周二','周三','周四','周五','周六'][entryD.getDay()];
    const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    let relativeDay = '';
    if (entryD.toDateString() === today.toDateString()) relativeDay = '今天';
    else if (entryD.toDateString() === yesterday.toDateString()) relativeDay = '昨天';
    const dateStr = `${mm}月${dd}日 / ${hrs}:${mins} ${wd} ${relativeDay}`.trim();

    const display = document.getElementById('topBarDateDisplay');
    if (display) display.innerText = dateStr;
};

window.goToSettings = function() { closeSidebar(); historyStack.push({...state}); state.level = 'settings'; render(); };

// 🌟 主渲染引擎
window.render = function() {
    const app = document.getElementById('app');
    
    if (state.level === 'home') {
        const years = Object.keys(db).sort((a,b) => b-a);
        const currentYear = new Date().getFullYear();
        if (!years.includes(String(currentYear))) years.unshift(String(currentYear));

        let booksHtml = years.map(y => `
            <div onclick="goToYear(${y})" class="book-spine ${y == currentYear ? 'bg-amber-700 border-amber-900' : 'bg-emerald-800 border-emerald-950'} h-48 rounded-r-lg shadow-xl border-l-8 p-4 text-white flex flex-col justify-between hover:-translate-y-2 transition-transform">
                <h2 class="text-3xl font-serif font-bold">${y}</h2>
                <p class="text-xs opacity-70">${y == currentYear ? '手账本正在使用中' : '已封存'}</p>
            </div>`).join('');

        app.innerHTML = `
            <div class="p-6 pb-32 h-full overflow-y-auto relative bg-[#f5f5f4]">
                <button onclick="toggleSidebar()" class="absolute left-6 top-8 text-stone-500 hover:text-stone-800 transition-transform active:scale-90 z-20">
                    <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path></svg>
                </button>
                <div class="text-center my-8">
                    <h1 class="text-4xl font-serif font-bold text-stone-800 tracking-wider">往事书架</h1>
                    <p class="text-[10px] text-stone-400 mt-2 tracking-widest uppercase">年份页面</p>
                </div>
                <div class="grid grid-cols-2 gap-8 mt-10 px-2">${booksHtml}</div>
            </div>
            ${renderAddButton()}
        `;
    } 
    else if (state.level === 'year') {
        const activeMonths = Object.keys(db[state.year]||{}).map(Number).sort((a,b) => b-a);
        let monthsHtml = activeMonths.length === 0 ? `<div class="col-span-3 text-center text-stone-400 py-10 mt-10">空空如也...</div>` : activeMonths.map(m => `
                <div onclick="goToMonth(${m})" class="month-card aspect-[4/3] rounded-xl shadow-sm border border-stone-200 flex flex-col items-center justify-center cursor-pointer hover:shadow-md hover:-translate-y-1 relative overflow-hidden">
                    <div class="absolute top-0 w-full h-3 bg-rose-500/80"></div>
                    <h3 class="text-3xl font-bold text-stone-700 mt-2">${m}</h3>
                    <span class="text-[10px] text-stone-400 uppercase tracking-widest mt-1">MONTH</span>
                    <div class="absolute bottom-2 right-3 text-[10px] font-bold text-stone-300">${db[state.year][m].length} 篇</div>
                </div>`).join('');

        app.innerHTML = `
            <div class="p-6 h-full overflow-y-auto bg-stone-50">
                <div class="flex items-center justify-between mb-8 sticky top-0 bg-stone-50/90 backdrop-blur py-2 z-10">
                    <button onclick="goBack('home')" class="flex items-center gap-1 text-stone-500 font-bold hover:text-stone-800 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm border border-stone-100">
                        <span>←</span> 返回
                    </button>
                    <div class="text-right">
                        <h1 class="text-2xl font-serif font-bold text-stone-800">${state.year} 卷</h1>
                    </div>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-5 mt-4">${monthsHtml}</div>
            </div>
            ${renderAddButton()}
        `;
    }
    else if (state.level === 'month') {
        const entries = db[state.year][state.month] || [];
        const activeDays = [...new Set(entries.map(e => e.day))].sort((a,b) => b-a);
        let daysHtml = activeDays.length === 0 ? `<div class="text-center text-stone-400 py-10">还没有记录哦</div>` : activeDays.map(d => `
                <div onclick="goToDay(${d})" class="bg-white px-6 py-5 rounded-3xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] flex justify-between items-center cursor-pointer hover:-translate-y-1 mb-4 border border-stone-100">
                    <div class="flex items-baseline gap-2"><span class="text-4xl font-bold text-cyan-600 font-serif">${d}</span><span class="text-sm text-stone-400 font-medium">日</span></div>
                    <div class="flex items-center gap-2"><span class="text-xs font-bold text-stone-400 bg-stone-50 px-3 py-1.5 rounded-full">${entries.filter(e=>e.day===d).length} 篇</span><span class="text-stone-300 font-bold">›</span></div>
                </div>`).join('');

        app.innerHTML = `
            <div class="p-6 h-full overflow-y-auto pb-32 bg-[#faf9f6]">
                <div class="flex items-center justify-between mb-10 sticky top-0 bg-[#faf9f6]/90 backdrop-blur py-2 z-10">
                    <button onclick="goBack('year')" class="flex items-center gap-1 text-stone-500 font-bold hover:text-stone-800 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm border border-stone-100">
                        <span>←</span> 返回
                    </button>
                    <div class="text-right">
                        <h1 class="text-2xl font-serif font-bold text-stone-800">${state.year}年 <span class="text-cyan-600">${state.month}月</span></h1>
                    </div>
                </div>
                <div class="space-y-2 mt-2">${daysHtml}</div>
            </div>
            ${renderAddButton()}
        `;
    }
    else if (state.level === 'day') {
        let dayEntries = (db[state.year][state.month]||[]).filter(e => e.day === state.day);
        if(dayEntries.length === 0) return goBack('month');

        dayEntries.sort((a, b) => b.timeStr.localeCompare(a.timeStr));

        let entriesHtml = dayEntries.map(entry => {
            // 解析回信模块的 HTML
            let repliesHtml = '';
            if (entry.replies && entry.replies.length > 0) {
                repliesHtml = entry.replies.map(r => `
                    <div class="mt-4 pt-4 border-t border-dashed border-stone-200 bg-rose-50/50 -mx-5 px-5 pb-3 rounded-b-[24px] relative group">
                        <!-- 🌟 新增：删除回信的悬浮小按钮 -->
                        <button onclick="event.stopPropagation(); deleteReply('${state.year}', '${state.month}', '${entry.id}', '${r.id}')" class="absolute right-4 top-4 text-rose-300 hover:text-rose-500 p-1.5 active:scale-90 transition-transform">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                        <div class="flex items-center gap-2 mb-2 pr-8">
                            <span class="text-sm font-serif font-bold text-rose-500">💌 来自未来的回信</span>
                            <span class="text-[10px] text-rose-400/60 font-mono">${r.dateStr}</span>
                        </div>
                        <div class="text-sm text-stone-600 leading-relaxed indent-6 font-medium pr-2">
                            ${r.content}
                        </div>
                    </div>
                `).join('');
            }

            if (entry.isArticleMode) {
                let coverImageHtml = '';
                const imgMatch = entry.html.match(/<img[^>]+src=["']([^"']+)["']/i);
                if (imgMatch && imgMatch[1]) coverImageHtml = `<img src="${imgMatch[1]}" class="w-full h-48 object-cover border-b border-stone-100">`;

                let tempDiv = document.createElement('div');
                tempDiv.innerHTML = entry.html;
                tempDiv.querySelectorAll('img, video, audio').forEach(el => el.remove());
                
                // 🚨 核心修复：将元素隐身挂载，逼迫浏览器进行排版计算得出真实的 \n
                tempDiv.style.position = 'absolute';
                tempDiv.style.opacity = '0';
                document.body.appendChild(tempDiv);
                let plainText = tempDiv.innerText.trim();
                document.body.removeChild(tempDiv); // 提取完立刻无痕销毁

                const entryD = new Date(entry.fullDateStr.replace(' ', 'T'));
                const wd = ['周日','周一','周二','周三','周四','周五','周六'][entryD.getDay()];
                const dateDisplay = `${entryD.getMonth() + 1}月${entryD.getDate()}日 ${wd}`;

                return `
                <div class="mb-8 bg-white rounded-[10px] shadow-[0_2px_15px_-4px_rgba(0,0,0,0.08)] border border-stone-100 cursor-pointer overflow-hidden transition-all hover:shadow-md hover:-translate-y-1" 
                     ontouchstart="startLongPress('${entry.id}')" ontouchend="cancelLongPress()" ontouchmove="cancelLongPress()" oncontextmenu="event.preventDefault(); openReplyModal('${entry.id}');"
                     onclick="if(!window.isLongPressing) openArticle('${entry.id}')">
                    ${coverImageHtml}
                    <div class="p-5">
                        <div class="flex justify-between items-center mb-3 text-[11px] text-stone-400 font-medium tracking-wide">
                            <span>${dateDisplay}</span>
                        </div>
                        ${entry.title ? `<h3 class="text-lg font-bold text-stone-800 mb-2 tracking-wide">《${entry.title}》</h3>` : ''}
                        <div class="text-sm text-stone-700 line-clamp-3 leading-relaxed mb-3 whitespace-pre-wrap break-words text-justify">${plainText}</div>
                        <div class="text-right text-[10px] text-stone-300 font-mono">${entry.timeStr}</div>
                        ${repliesHtml}
                    </div>
                </div>`;
            } else {
                return `
                <div class="mb-12 cursor-pointer" ontouchstart="startLongPress('${entry.id}')" ontouchend="cancelLongPress()" ontouchmove="cancelLongPress()" oncontextmenu="event.preventDefault(); openReplyModal('${entry.id}');">
                    <div class="flex justify-between items-end mb-3 px-2 no-print">
                        <span class="text-[10px] text-stone-400 font-bold tracking-widest bg-stone-100 px-2 py-0.5 rounded">📓 手账碎片</span>
                        <div class="flex gap-4">
                            <button onclick="editEntry('${entry.id}')" class="text-xs text-stone-400 hover:text-cyan-600 font-bold">编辑</button>
                            <button onclick="deleteEntry('${entry.id}')" class="text-xs text-stone-400 hover:text-rose-500 font-bold">删除</button>
                        </div>
                    </div>
                    <div class="read-only-mode ${(entry.html.includes('<img') || entry.html.includes('<video')) ? 'journal-bg' : 'bg-white'} p-6 rounded-t-3xl shadow-sm border border-stone-200 border-b-0 transition-colors duration-300">
                        ${entry.html}
                    </div>
                    <div class="bg-stone-50 p-4 rounded-b-3xl border border-stone-200 shadow-sm">
                        <div class="flex flex-col sm:flex-row justify-between sm:items-center text-xs text-stone-400 gap-3">
                            <div class="flex items-center gap-2 font-mono font-bold text-stone-500"><span class="text-base">🕒</span> <span>${entry.fullDateStr || entry.timeStr}</span></div>
                            <div class="flex flex-wrap gap-4 items-center font-medium">
                                ${entry.location ? `<div class="flex items-center gap-1"><span class="text-base">📍</span> <span class="truncate max-w-[100px]">${entry.location}</span></div>` : ''}
                                ${entry.weather ? `<div class="flex items-center gap-1"><span>${entry.weather}</span></div>` : ''}
                            </div>
                        </div>
                        ${repliesHtml}
                    </div>
                </div>`;
            }
        }).join('');

        app.innerHTML = `
            <div class="h-full bg-stone-50 flex flex-col relative overflow-y-auto pb-32" id="printable-area">
                <!-- 🌟 全新紧凑型吸顶导航，100%物理贴顶，彻底消灭缝隙，挤出更多阅读空间 -->
                <div class="flex items-center justify-between p-4 sticky top-0 bg-stone-50/95 backdrop-blur z-20 no-print shadow-sm">
                    <div class="flex items-center gap-4">
                        <button onclick="goBack('month')" class="flex items-center gap-1 text-stone-500 font-bold hover:text-stone-800 bg-white px-3 py-1.5 rounded-full shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] text-sm border border-stone-100 active:scale-95 transition-transform">
                            <span>←</span> 返回
                        </button>
                        <h1 class="text-lg font-serif font-bold text-stone-700">${state.month}月${state.day}日</h1>
                    </div>
                </div>
                
                <!-- 🌟 内容区单独加 Padding，不再污染外层容器 -->
                <div class="px-6 pt-6">${entriesHtml}</div>
            </div>
            ${renderAddButton()}
        `;
    }
    else if (state.level === 'articleView') {
        const entry = db[state.year][state.month].find(x => x.id === state.currentArticleId);
        if (!entry) return goBack('day');
        
        const entryDate = new Date(entry.fullDateStr.replace(' ', 'T'));
        const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];

        // 🌟 新增：解析回信模块的 HTML (包含删除回信的粉色垃圾桶)
        let repliesHtml = '';
        if (entry.replies && entry.replies.length > 0) {
            repliesHtml = entry.replies.map(r => `
                <div class="pt-4 border-t border-dashed border-rose-200 bg-rose-50/30 px-5 pb-4 relative group first:border-t-0">
                    <button onclick="event.stopPropagation(); deleteReply('${state.year}', '${state.month}', '${entry.id}', '${r.id}')" class="absolute right-4 top-4 text-rose-300 hover:text-rose-500 p-1.5 active:scale-90 transition-transform">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                    </button>
                    <div class="flex items-center gap-2 mb-2 pr-8">
                        <span class="text-sm font-serif font-bold text-rose-500">💌 来自未来的回信</span>
                        <span class="text-[10px] text-rose-400/60 font-mono">${r.dateStr}</span>
                    </div>
                    <div class="text-[13px] text-stone-600 leading-relaxed indent-6 font-medium pr-2">
                        ${r.content}
                    </div>
                </div>
            `).join('');
        }
        
        app.innerHTML = `
            <div class="h-full bg-[#faf9f6] flex flex-col relative overflow-y-auto" id="printable-area">
                
                <div class="flex items-center justify-between p-4 sticky top-0 bg-[#faf9f6]/95 backdrop-blur z-20 no-print border-b border-stone-100">
                    <button onclick="goBack('day')" class="text-stone-500 hover:text-stone-800 active:scale-90 transition-transform">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                    </button>
                    
                    <div class="flex items-center gap-5 text-stone-500 relative">
                        <button onclick="shareArticle('${entry.id}')" title="分享" class="hover:text-stone-800 active:scale-90 transition-transform">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                        </button>
                        <button onclick="copyArticle('${entry.id}')" title="复制文本" class="hover:text-stone-800 active:scale-90 transition-transform">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                        </button>
                        <button onclick="toggleArticleMenu()" title="更多选项" class="hover:text-stone-800 active:scale-90 transition-transform relative">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z"></path></svg>
                        </button>
                        
                        <div id="articleMoreMenu" class="hidden absolute right-0 top-10 w-32 bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] border border-stone-100 overflow-hidden z-50 text-[13px] font-bold text-stone-600">
                            <div onclick="showArticleDetails('${entry.id}')" class="px-5 py-3.5 hover:bg-stone-50 hover:text-cyan-600 cursor-pointer border-b border-stone-50">详细</div>
                            <div onclick="exportArticleTXT('${entry.id}')" class="px-5 py-3.5 hover:bg-stone-50 hover:text-cyan-600 cursor-pointer border-b border-stone-50">导出 TXT</div>
                            <div onclick="exportToPDF()" class="px-5 py-3.5 hover:bg-stone-50 hover:text-cyan-600 cursor-pointer border-b border-stone-50">导出 PDF</div>
                            <div onclick="if(confirm('确认删除这篇文章？\\n(此操作不可逆)')) { deleteEntry('${entry.id}'); goBack('day'); }" class="px-5 py-3.5 hover:bg-rose-50 text-rose-500 cursor-pointer">删除文章</div>
                        </div>
                    </div>
                </div>

                <div class="px-6 pb-32 pt-4">
                    <!-- 🌟 压缩优化后的文章时间栏 -->
                    <div class="flex items-center justify-between mb-6 text-stone-400 border-b border-stone-100 pb-3">
                        <div class="flex items-center gap-3">
                            <div class="text-3xl font-serif font-bold text-cyan-600">${entryDate.getDate()}</div>
                            <div class="flex flex-col text-[10px] font-medium leading-tight tracking-wide gap-0.5">
                                <span class="text-stone-500 uppercase">${entryDate.getFullYear()}年${entryDate.getMonth() + 1}月 / ${weekDays[entryDate.getDay()]}</span>
                                <span>${entry.timeStr}</span>
                            </div>
                        </div>
                    </div>
                    
                    ${entry.title ? `<h1 class="text-xl font-bold text-stone-800 mb-6 tracking-wide">《${entry.title}》</h1>` : ''}
                    
                    <div class="read-only-mode article-content text-stone-700 leading-loose">${entry.html}</div>

                    <!-- 🌟 新增的文章底部回信展示区 & 回信按钮 -->
                    <div class="mt-12 border-t border-stone-100 pt-8 no-print">
                        <h3 class="text-sm font-bold text-stone-400 tracking-widest uppercase mb-4 pl-1">TIME REPLIES</h3>
                        ${repliesHtml ? `<div class="rounded-2xl overflow-hidden border border-rose-100/60 shadow-sm mb-6 bg-white">${repliesHtml}</div>` : ''}
                        
                        <button onclick="openReplyModal('${entry.id}')" class="w-full py-3.5 bg-rose-50 text-rose-500 font-bold rounded-2xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-2 shadow-sm border border-rose-100/50 active:scale-[0.98]">
                            <span class="text-lg">❤</span> 给当时的自己写封回信吧~
                        </button>
                    </div>
                </div>

                <div class="fixed bottom-8 right-8 z-40 no-print">
                    <button onclick="editEntry('${entry.id}')" class="bg-[#3ebcb5] text-white w-14 h-14 rounded-full shadow-[0_4px_15px_rgba(62,188,181,0.4)] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                    </button>
                </div>
            </div>
        `;
    }

    else if (state.level === 'editor') {
        const isArticle = editorMeta.isArticleMode;
        
        let topBarHtml = '';
        if (isArticle) {
            const entryD = new Date(editorMeta.date);
            const mm = entryD.getMonth() + 1, dd = entryD.getDate();
            const hrs = String(entryD.getHours()).padStart(2, '0'), mins = String(entryD.getMinutes()).padStart(2, '0');
            const weekDays = ['周日','周一','周二','周三','周四','周五','周六'], wd = weekDays[entryD.getDay()];
            
            const today = new Date(); const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
            let relativeDay = '';
            if (entryD.toDateString() === today.toDateString()) relativeDay = '今天';
            else if (entryD.toDateString() === yesterday.toDateString()) relativeDay = '昨天';
            
            const dateStr = `${mm}月${dd}日 / ${hrs}:${mins} ${wd} ${relativeDay}`.trim();

            topBarHtml = `
                <div class="flex justify-between items-center p-3 bg-[#faf9f6]/95 backdrop-blur-md sticky top-0 z-20 no-print border-b border-stone-200">
                    <div class="flex items-center gap-4">
                        <button onclick="saveJournal()" class="text-stone-500 hover:text-stone-800 active:scale-90 transition-transform" title="完成并保存">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        </button>
                        <div class="relative cursor-pointer hover:text-stone-800 text-stone-700 flex items-center">
                            <span id="topBarDateDisplay" class="text-sm font-bold tracking-wide">${dateStr}</span>
                            <input type="datetime-local" id="entryDate" value="${editorMeta.date}" onchange="updateMetaDate(this.value); updateDateDOM(); isEditorDirty = true;" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10">
                        </div>
                    </div>
                    <div class="flex items-center gap-4 text-stone-400">
                        <button class="hover:text-stone-600 active:scale-90 transition-transform">
                            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M6 3a2 2 0 00-2 2v14a1 1 0 001.5.864l4.5-2.5 4.5 2.5A1 1 0 0016 19V5a2 2 0 00-2-2H6z" clip-rule="evenodd" /></svg>
                        </button>
                        <button class="hover:text-stone-600 active:scale-90 transition-transform">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 12.75a.75.75 0 110-1.5.75.75 0 010 1.5zM12 18.75a.75.75 0 110-1.5.75.75 0 010 1.5z" /></svg>
                        </button>
                    </div>
                </div>
            `;
        } else {
            topBarHtml = `
                <div class="flex justify-between items-center p-4 bg-white/80 backdrop-blur-md sticky top-0 z-20 no-print">
                    <button onclick="attemptCancelEdit()" class="text-stone-400 font-bold hover:text-stone-600">取消</button>
                    <span class="font-serif font-bold text-stone-700 text-sm tracking-widest">${state.editingId ? '修改' : '新建'}手账</span>
                    <button onclick="saveJournal()" class="bg-cyan-600 text-white px-6 py-1.5 rounded-full text-sm font-bold shadow-md hover:bg-cyan-500 active:scale-95 transition-transform">保存</button>
                </div>
            `;
        }

        let contentHtml = '';
        if (isArticle) {
            contentHtml = `
                <div class="flex-1 overflow-y-auto bg-[#faf9f6] relative">
                    <div class="flex flex-col min-h-full p-6 pb-24">
                        <input type="text" id="articleTitleInput" placeholder="《请输入文章标题》" value="${editorMeta.title || ''}" class="flex-shrink-0 w-full text-xl font-bold text-stone-800 bg-transparent border-none outline-none mb-6 placeholder-stone-300 tracking-wider mt-2" oninput="editorMeta.title = this.value; if(!window.isEditorInitializing) isEditorDirty = true;">
                        
                        <div id="article-canvas" contenteditable="true" class="w-full flex-1 outline-none text-stone-700 text-base leading-loose mb-10" 
                             style="word-break: break-word; min-height: 40vh;"
                             placeholder="从这里开始撰写..." 
                             onpaste="handleArticlePaste(event)"
                             onkeyup="calculateWordCount(); saveCursorPosition();" 
                             onmouseup="saveCursorPosition()" 
                             oninput="calculateWordCount(); if(!window.isEditorInitializing) isEditorDirty = true;"></div>
                             
                        <div class="mt-auto pt-8 pb-4 flex flex-col gap-4 text-stone-400 text-[13px] font-medium tracking-wider select-none no-print border-t border-stone-100 flex-shrink-0">
                            
                            <div class="flex items-center gap-3 cursor-pointer hover:text-cyan-600 transition-colors" onclick="openWeatherModal()">
                                <svg class="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-2.25l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" /></svg>
                                <span id="articleWeatherDisplay">${editorMeta.weather || '(无天气信息)'}</span>
                            </div>
                            
                            <div class="flex items-center gap-3 cursor-pointer hover:text-cyan-600 transition-colors" onclick="openLocationModal()">
                                <svg class="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                                <span id="articleLocDisplay">${editorMeta.location || '(无位置信息)'}</span>
                            </div>
                            
                            <div class="flex items-center gap-3">
                                <svg class="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
                                <span>${editorMeta.device || 'Echo 客户端'}</span>
                            </div>
                            
                            <div class="flex items-center gap-3">
                                <svg class="w-5 h-5 opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" /></svg>
                                <span id="articleWordCountDisplay">${editorMeta.wordCount} 字</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        } else {
            contentHtml = `
                <!-- 🚨 加入了 journal-bg 恢复网格纸质感 -->
                <div class="flex-1 p-6 pb-40 overflow-y-auto space-y-2 journal-bg" onkeyup="calculateWordCount()">
                    <div id="journal-canvas" class="space-y-2"></div>
                </div>
            `;
        }

        let bottomBarsHtml = '';
        if (!isArticle) {
            bottomBarsHtml = `
                <div class="absolute bottom-[68px] left-0 w-full bg-white/95 backdrop-blur-sm border-t border-stone-200 p-2.5 flex justify-between items-center text-[11px] text-stone-500 z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] no-print">
                    <div class="relative flex items-center justify-center gap-1 cursor-pointer hover:text-cyan-600 transition-colors w-1/4">
                        <span>🕒</span><span class="text-stone-400 truncate">时间</span>
                        <input type="datetime-local" id="entryDate" value="${editorMeta.date}" onchange="updateMetaDate(this.value); render(); isEditorDirty = true;" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10">
                    </div>
                    <div class="w-px h-4 bg-stone-200 flex-shrink-0"></div>
                    <div onclick="openLocationModal()" class="flex items-center justify-center cursor-pointer hover:text-cyan-600 transition-colors w-1/4 px-1">
                        <div class="flex items-center gap-1 truncate"><span>📍</span> <span id="locDisplay" class="truncate">${editorMeta.location || '定位'}</span></div>
                    </div>
                    <div class="w-px h-4 bg-stone-200 flex-shrink-0"></div>
                    <div onclick="openWeatherModal()" class="flex items-center justify-center cursor-pointer hover:text-cyan-600 transition-colors w-1/4 px-1">
                        <span id="weatherDisplay" class="truncate">${editorMeta.weather || '🌤️ 天气'}</span>
                    </div>
                    <div class="w-px h-4 bg-stone-200 flex-shrink-0"></div>
                    <div class="flex items-center justify-center w-1/4 px-1 font-bold text-stone-400">
                        <span id="wordCountDisplay">字数：${editorMeta.wordCount}</span>
                    </div>
                </div>

                <div class="absolute bottom-0 left-0 w-full bg-white border-t border-stone-100 p-3 flex justify-around z-20 no-print">
                    <button onclick="addBlock('text')" class="flex flex-col items-center gap-1 text-stone-400 hover:text-cyan-600 transition-colors"><span class="text-xl">✍️</span><span class="text-[10px] font-bold">文字</span></button>
                    <label class="flex flex-col items-center gap-1 text-stone-400 hover:text-cyan-600 cursor-pointer transition-colors"><span class="text-xl">🖼️</span><span class="text-[10px] font-bold">图片</span><input type="file" accept="image/*" class="hidden" onchange="addBlock('image', event)"></label>
                    <label class="flex flex-col items-center gap-1 text-stone-400 hover:text-cyan-600 cursor-pointer transition-colors"><span class="text-xl">🎥</span><span class="text-[10px] font-bold">视频</span><input type="file" accept="video/*" class="hidden" onchange="addBlock('video', event)"></label>
                    <button onclick="startRecording()" class="flex flex-col items-center gap-1 text-stone-400 hover:text-cyan-600 transition-colors"><span class="text-xl">🎙️</span><span class="text-[10px] font-bold">语音</span></button>
                </div>
            `;
        } else {
            bottomBarsHtml = `
                <div class="absolute bottom-0 left-0 w-full bg-[#faf9f6] border-t border-stone-200 p-3 flex justify-around items-center z-20 no-print text-stone-500">
                    <button onclick="applyIndent()" class="p-2 active:scale-95 transition-transform" title="首行缩进">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 6.75h16.5M7.5 12h12m-12 5.25h12M3.75 12l2.25 2.25L3.75 16.5" />
                        </svg>
                    </button>
                    <button onclick="alert('创建项目编号功能开发中...')" class="p-2 hover:text-cyan-600 active:scale-95 transition-all" title="项目标题">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5" /></svg>
                    </button>
                    <button onclick="alert('列表编号排版开发中...')" class="p-2 hover:text-cyan-600 active:scale-95 transition-all" title="无序列表">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.008v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.008v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.008v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                    </button>
                    <label class="p-2 hover:text-cyan-600 active:scale-95 transition-all cursor-pointer" title="插入图片">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" /></svg>
                        <input type="file" accept="image/*" class="hidden" onchange="window.insertArticleImage(event)">
                    </label>
                </div>
            `;
        }

        let unsavedModalHtml = `
            <div id="unsavedChangesModal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] flex items-center justify-center animate-fade-in" onclick="closeUnsavedModal()">
                <div class="bg-white w-[85%] max-w-sm rounded-lg shadow-2xl overflow-hidden" onclick="event.stopPropagation()">
                    <div class="p-6 pb-8">
                        <h3 class="text-lg font-bold text-stone-800 mb-3">提示</h3>
                        <p class="text-stone-600 text-[15px]">确定放弃此次编辑？</p>
                    </div>
                    <div class="flex pt-2 pb-4 px-2">
                        <button onclick="confirmDiscard()" class="flex-1 py-2 text-cyan-600 font-medium hover:bg-stone-50 transition-colors rounded">放弃</button>
                        <button onclick="closeUnsavedModal()" class="flex-1 py-2 text-cyan-600 font-medium hover:bg-stone-50 transition-colors rounded">取消</button>
                        <button onclick="confirmSave()" class="flex-1 py-2 text-cyan-600 font-medium hover:bg-stone-50 transition-colors rounded">保存</button>
                    </div>
                </div>
            </div>
        `;

        app.innerHTML = `
            <div class="flex flex-col h-full bg-transparent relative">
                
                <div id="articlePrompt" class="hidden absolute top-16 left-1/2 -translate-x-1/2 bg-cyan-600/95 backdrop-blur text-white px-5 py-2.5 rounded-full shadow-lg z-50 text-xs font-bold flex items-center gap-3 animate-bounce">
                    <span>字数超66啦，要切成排版更好的文章模式吗？</span>
                    <button onclick="toggleArticleMode()" class="bg-white text-cyan-600 px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform">切换</button>
                    <button onclick="document.getElementById('articlePrompt').classList.add('hidden')" class="text-cyan-200 ml-1 text-base">✕</button>
                </div>

                ${topBarHtml}
                ${contentHtml}
                ${bottomBarsHtml}
                ${unsavedModalHtml}
            </div>
        `;

        if (state.editingId) {
            window.isEditorInitializing = true;
            const entry = db[state.year][state.month].find(x => x.id === state.editingId);
            if (isArticle) {
                setTimeout(() => {
                    document.getElementById('article-canvas').innerHTML = entry.html;
                    calculateWordCount();
                    window.isEditorInitializing = false;
                }, 10);
            } else {
                setTimeout(() => {
                    const canvas = document.getElementById('journal-canvas');
                    canvas.innerHTML = entry.html;
                    canvas.querySelectorAll('p').forEach(p => {
                        const ta = document.createElement('textarea');
                        ta.className = `w-full bg-transparent border-none resize-none text-stone-700 text-base leading-relaxed placeholder-stone-400`;
                        ta.value = p.innerText;
                        ta.oninput = function() { 
                            this.style.height = ''; this.style.height = this.scrollHeight + 'px'; calculateWordCount(); 
                            if(!window.isEditorInitializing) isEditorDirty = true;
                        };
                        p.parentNode.replaceChild(ta, p);
                        setTimeout(() => ta.oninput(), 10);
                    });
                    calculateWordCount();
                    setTimeout(() => { window.isEditorInitializing = false; }, 50); 
                }, 10);
            }
        } else {
            if (!isArticle) setTimeout(() => { document.getElementById('journal-canvas').innerHTML = createBlockHTML('text'); }, 10);
        }
    }
    else if (state.level === 'settings') {
        app.innerHTML = `
            <div class="p-6 h-full overflow-y-auto bg-stone-50">
            <div class="-mx-6 -mt-6 px-6 pt-2 pb-3 mb-4 sticky top-0 bg-stone-50/95 backdrop-blur z-10 flex items-center justify-between shadow-[0_4px_15px_-10px_rgba(0,0,0,0.05)] border-b border-stone-100/50">
                <button onclick="goBack('home')" class="flex items-center gap-1 text-stone-500 font-bold hover:text-stone-800 bg-white px-3 py-1.5 rounded-full shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] text-sm border border-stone-100 active:scale-95 transition-transform">
                    <span>←</span> 返回
                </button>
                <div class="text-right">
                    <h1 class="text-xl font-serif font-bold text-stone-800">系统设置</h1>
                </div>
            </div>

            <div class="bg-white rounded-3xl shadow-sm border border-stone-100 p-8 flex flex-col items-center justify-center">
                    <div class="w-24 h-24 bg-cyan-50 rounded-full flex items-center justify-center text-5xl mb-4 shadow-inner">📚</div>
                    <h2 class="text-2xl font-serif font-bold text-stone-700 mb-2">往事书架</h2>
                    <p class="text-xs text-stone-400 mb-6 bg-stone-100 px-3 py-1 rounded-full">当前版本：v3.3.3</p>
                    
                    <div class="w-full border-t border-stone-100 my-4"></div>
                    
                    <div class="w-full flex justify-between items-center py-3">
                        <span class="text-stone-500 font-medium">更新日期</span>
                        <span class="text-stone-400 text-sm font-mono">2026年5月2日</span>
                    </div>
                    <div class="w-full flex justify-between items-center py-3">
                        <span class="text-stone-500 font-medium">核心开发者</span>
                        <span class="text-stone-400 text-sm">TDYSN</span>
                    </div>
                    <div class="w-full flex justify-between items-center py-3">
                        <span class="text-stone-500 font-medium">数据存储</span>
                        <span class="text-stone-400 text-sm">Echoappdata文件</span>
                    </div>


                    <div class="w-full border-t border-stone-100 my-4"></div>
                    
                    <div onclick="alert('字体编辑模块准备就绪，等待你的具体细节需求！')" class="w-full flex justify-between items-center py-4 cursor-pointer hover:bg-stone-50 rounded-xl px-2 -mx-2 transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg shadow-inner font-serif">A</div>
                            <span class="text-stone-700 font-bold">手账排版与字体</span>
                        </div>
                        <span class="text-stone-300 font-bold">›</span>
                    </div>

                
                    <!-- 🌟 V4.3 新增：一键提速大扫除按钮 -->
                    <div class="w-full border-t border-stone-100 my-4"></div>
                    <div class="w-full">
                        <button onclick="migrateOldBase64Data()" class="w-full bg-rose-50 text-rose-500 font-bold py-3 rounded-xl hover:bg-rose-100 transition-colors flex items-center justify-center gap-2">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                            清理历史旧数据 (一键提速)
                        </button>
                        <p class="text-[10px] text-stone-400 mt-2 text-center">将早期的庞大Base64缓存转换为物理文件，极大提升App打开速度。数据不会丢失，请放心执行。</p>
                    </div>
                </div>
            </div>
        `;
    }
    else if (state.level === 'repliedList') {
        let repliedEntries = [];
        // 收集所有带回信的记录，并把年份和月份属性注入进去方便跳转
        for(let y in db) {
            for(let m in db[y]) {
                db[y][m].forEach(e => {
                    if (e.replies && e.replies.length > 0) {
                        repliedEntries.push({ ...e, year: y, month: m });
                    }
                });
            }
        }
        
        // 按照“最新回信的时间”倒序排列
        repliedEntries.sort((a,b) => {
            let lastA = a.replies[a.replies.length - 1].dateStr;
            let lastB = b.replies[b.replies.length - 1].dateStr;
            return new Date(lastB.replace(/年|月/g,'-').replace('日','')) - new Date(lastA.replace(/年|月/g,'-').replace('日',''));
        });

        let listHtml = repliedEntries.length === 0 
            ? `<div class="text-center text-stone-400 py-32 flex flex-col items-center gap-4"><span class="text-7xl grayscale opacity-30 drop-shadow-sm">📭</span><p class="tracking-widest text-sm font-medium">信箱空空如也<br>去漫游给自己写封信吧</p></div>` 
            : repliedEntries.map(entry => {
                let textPreview = document.createElement('div');
                textPreview.innerHTML = entry.html;
                textPreview.querySelectorAll('img, video, audio').forEach(el => el.remove());
                let pureText = textPreview.innerText.trim() || '[多媒体记录]';

                let latestReply = entry.replies[entry.replies.length - 1]; // 只展示最新的一条回信

                return `
                <div class="mb-8 relative group" onclick="jumpToEntryFromMailbox('${entry.year}', '${entry.month}', ${entry.day}, '${entry.id}', ${entry.isArticleMode})">
                    <!-- 🌟 绝美设计：实体信封阴影层 -->
                    <div class="absolute inset-0 bg-rose-200/40 rounded-3xl translate-y-2 translate-x-1.5 -z-10 group-hover:translate-y-3 group-hover:translate-x-2 transition-transform duration-300"></div>
                    
                    <div class="bg-white p-6 rounded-3xl border border-rose-50 shadow-sm relative overflow-hidden z-0 cursor-pointer active:scale-[0.98] transition-transform">
                        <!-- 🌟 绝美设计：右上角半透明盖章邮戳 -->
                        <div class="absolute -right-4 -top-4 w-20 h-20 border-[3px] border-rose-100 rounded-full opacity-40 flex items-center justify-center rotate-12 pointer-events-none">
                            <div class="border-[1.5px] border-rose-100 w-14 h-14 rounded-full text-[9px] text-rose-200 font-mono flex items-center justify-center font-bold tracking-widest">ECHO</div>
                        </div>

                        <!-- 回信内容区 -->
                        <div class="mb-5 relative z-10 group">
                            <!-- 🌟 新增：删除回信的悬浮小按钮 -->
                            <button onclick="event.stopPropagation(); deleteReply('${entry.year}', '${entry.month}', '${entry.id}', '${latestReply.id}')" class="absolute right-0 top-0 text-rose-300 hover:text-rose-500 p-1.5 active:scale-90 transition-transform bg-white/50 rounded-full backdrop-blur-sm z-20">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            </button>
                            <div class="flex items-center gap-2 mb-3 pr-8">
                                <span class="text-2xl drop-shadow-sm">💌</span>
                                <span class="text-base font-serif font-bold text-rose-500 tracking-wider">我的回信</span>
                            </div>
                            <div class="text-[15px] text-stone-700 leading-relaxed font-medium pl-1 mb-2 pr-6">
                                “${latestReply.content}”
                            </div>
                            <div class="text-[11px] text-rose-400/80 font-mono pl-1 font-bold">${latestReply.dateStr}</div>
                        </div>

                        <!-- 虚线折痕 -->
                        <div class="w-full border-t-[1.5px] border-dashed border-stone-200 my-4 relative z-10"></div>

                        <!-- 🌟 绝美设计：溯源锚点链接区 -->
                        <div class="bg-stone-50/80 rounded-2xl p-4 hover:bg-stone-100 transition-colors relative z-10 border border-stone-100/50">
                            <div class="flex justify-between items-center mb-2">
                                <span class="text-[10px] text-stone-400 font-bold tracking-widest uppercase flex items-center gap-1">
                                    <svg class="w-3 h-3 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"></path></svg>
                                    溯源至过去
                                </span>
                                <span class="text-[10px] text-stone-400 font-mono font-bold">${entry.fullDateStr}</span>
                            </div>
                            <div class="text-xs text-stone-500 line-clamp-2 leading-relaxed">
                                ${entry.title ? `<span class="font-bold text-stone-700">《${entry.title}》</span> ` : ''}${pureText}
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');

        app.innerHTML = `
            <div class="h-full bg-[#faf9f6] flex flex-col relative overflow-y-auto pb-32">
                <!-- 🌟 全新紧凑型吸顶导航，100%物理贴顶，留出最大内容空间 -->
                <div class="flex items-center justify-between p-4 sticky top-0 bg-[#faf9f6]/95 backdrop-blur z-20 border-b border-stone-200/60 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
                    <button onclick="goBack()" class="flex items-center gap-1 text-stone-500 font-bold hover:text-stone-800 bg-white px-3 py-1.5 rounded-full shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05)] text-sm border border-stone-100 active:scale-95 transition-transform">
                        <span>←</span> 返回
                    </button>
                    <div class="text-right flex items-center gap-2">
                        <span class="text-2xl drop-shadow-sm">📮</span>
                        <h1 class="text-xl font-serif font-bold text-rose-600 tracking-wide">时光信箱</h1>
                    </div>
                </div>
                <!-- 内容区单独设定内边距 -->
                <div class="px-6 pt-6 max-w-md mx-auto w-full">${listHtml}</div>
            </div>
        `;
    }
};

window.handleArticlePaste = function(e) {
    e.preventDefault();
    const text = (e.originalEvent || e).clipboardData.getData('text/plain');
    document.execCommand('insertText', false, text);
    if(!window.isEditorInitializing) isEditorDirty = true;
    setTimeout(calculateWordCount, 50);
};

window.attemptCancelEdit = function() {
    if (isEditorDirty) {
        document.getElementById('unsavedChangesModal').classList.remove('hidden');
    } else {
        cancelEdit();
    }
};

window.confirmDiscard = function() {
    document.getElementById('unsavedChangesModal').classList.add('hidden');
    cancelEdit();
};

window.closeUnsavedModal = function() {
    document.getElementById('unsavedChangesModal').classList.add('hidden');
};

window.confirmSave = function() {
    document.getElementById('unsavedChangesModal').classList.add('hidden');
    saveJournal();
};

window.getArticlePlainText = function(id) {
    const entry = db[state.year][state.month].find(x => x.id === id);
    let tempDiv = document.createElement('div');
    tempDiv.innerHTML = entry.html;
    tempDiv.querySelectorAll('img, video, audio').forEach(el => el.remove());
    
    // 同样隐身挂载提取真实换行
    tempDiv.style.position = 'absolute';
    tempDiv.style.opacity = '0';
    document.body.appendChild(tempDiv);
    let text = tempDiv.innerText.trim();
    document.body.removeChild(tempDiv);
    
    return text;
};

window.copyArticle = function(id) {
    const entry = db[state.year][state.month].find(x => x.id === id);
    const text = getArticlePlainText(id);
    const content = `《${entry.title || '无题'}》\n\n${text}`;
    navigator.clipboard.writeText(content).then(() => {
        alert('✅ 文章已复制到剪贴板');
        toggleArticleMenu(); 
    }).catch(() => alert('❌ 复制失败，请重试'));
};

window.shareArticle = function(id) {
    const entry = db[state.year][state.month].find(x => x.id === id);
    const text = getArticlePlainText(id);
    const shareText = `《${entry.title || '无题'}》\n\n${text}`;
    if (window.Capacitor && Capacitor.Plugins.Share) {
        Capacitor.Plugins.Share.share({ title: entry.title || '回响文章', text: shareText, dialogTitle: '分享文章' });
    } else if (navigator.share) {
        navigator.share({ title: entry.title, text: shareText });
    } else {
        alert('⚠️ 当前环境暂不支持直接调用系统分享，请使用“复制文本”功能。');
    }
    toggleArticleMenu(); 
};

window.exportArticleTXT = function(id) {
    const entry = db[state.year][state.month].find(x => x.id === id);
    const text = getArticlePlainText(id);
    const content = `《${entry.title || '无题'}》\n创建时间：${entry.fullDateStr}\n字数统计：${entry.wordCount || 0}字\n\n${text}`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${entry.title || '回响文章'}_${entry.day}日.txt`;
    a.click();
    toggleArticleMenu(); 
};

window.showArticleDetails = function(id) {
    const entry = db[state.year][state.month].find(x => x.id === id);
    alert(`【文章详细信息】\n\n标题：${entry.title || '无题'}\n字数：${entry.wordCount || 0} 字\n时间：${entry.fullDateStr}\n定位：${entry.location || '未记录'}\n天气：${entry.weather || '未记录'}`);
    toggleArticleMenu();
};

window.toggleArticleMenu = function() {
    const menu = document.getElementById('articleMoreMenu');
    if (menu) menu.classList.toggle('hidden');
};

document.addEventListener('click', function(event) {
    if (!event.target.closest('button[onclick="toggleMenu(this)"]')) document.querySelectorAll('.voice-menu').forEach(menu => menu.classList.add('hidden'));
    
    if (!event.target.closest('button[onclick="toggleArticleMenu()"]') && !event.target.closest('#articleMoreMenu')) {
        const articleMenu = document.getElementById('articleMoreMenu');
        if (articleMenu) articleMenu.classList.add('hidden');
    }
});

window.saveCursorPosition = function() {
    const sel = window.getSelection();
    if (sel.getRangeAt && sel.rangeCount) savedRange = sel.getRangeAt(0);
};

// 🌟 修复：文章模式最后一行无法插入图片的 Bug
window.insertArticleImage = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function(e) { 
        // 这里依赖 storage.js 里的 saveMediaToDisk
        const localUrl = typeof window.saveMediaToDisk === 'function' ? await window.saveMediaToDisk(e.target.result, 'image') : e.target.result;
        const imgHtml = `<div contenteditable="false" class="py-2 my-2"><img src="${localUrl}" class="max-w-full rounded-lg shadow-sm border border-stone-200 mx-auto block"></div><p><br></p>`;
        
        const canvas = document.getElementById('article-canvas');
        canvas.focus();
        
        let insertSuccess = false;
        
        // 1. 尝试使用标准富文本命令插入 (适用于文章中间)
        if (savedRange) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(savedRange);
            
            const beforeLength = canvas.innerHTML.length;
            document.execCommand('insertHTML', false, imgHtml);
            
            // 校验 WebView 是否发生了静默失败
            if (canvas.innerHTML.length !== beforeLength) {
                insertSuccess = true;
            }
        }
        
        // 2. 🌟 核心修复兜底：如果是在最后一行、全空状态，或者 execCommand 失败
        if (!insertSuccess) {
            canvas.insertAdjacentHTML('beforeend', imgHtml);
            
            // 强制将光标移至文末，防止用户接下来打字找不到光标
            const sel = window.getSelection();
            const newRange = document.createRange();
            newRange.selectNodeContents(canvas);
            newRange.collapse(false); // false 意味着折叠到末尾
            sel.removeAllRanges();
            sel.addRange(newRange);
            savedRange = newRange; // 更新全局游标
        }
        
        if(!window.isEditorInitializing) isEditorDirty = true; 
        calculateWordCount(); 
        
        // 贴心小优化：插入图片后自动滚动到底部
        canvas.scrollTop = canvas.scrollHeight;
    };
    reader.readAsDataURL(file); 
    event.target.value = '';
};
window.applyIndent = function() {
    const canvas = document.getElementById('article-canvas');
    canvas.focus();
    if (savedRange) {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(savedRange);
    }
    document.execCommand('insertText', false, '　　');
    if(!window.isEditorInitializing) isEditorDirty = true; 
    saveCursorPosition();
};

window.calculateWordCount = function() {
    let totalWords = 0;
    if (editorMeta.isArticleMode) {
        const canvas = document.getElementById('article-canvas');
        if (canvas) totalWords = canvas.innerText.replace(/\s/g, '').length;
    } else {
        const canvas = document.getElementById('journal-canvas');
        if (canvas) canvas.querySelectorAll('textarea').forEach(ta => { totalWords += ta.value.trim().length; });
    }
    editorMeta.wordCount = totalWords;
    
    const display = document.getElementById('wordCountDisplay');
    if (display) {
        display.innerHTML = `字数：${totalWords}`;
    }

    const articleWordDisplay = document.getElementById('articleWordCountDisplay');
    if (articleWordDisplay) {
        articleWordDisplay.innerText = `${totalWords} 字`;
    }

    if (totalWords >= 66 && !editorMeta.isArticleMode && !editorMeta.hasPromptedArticle) {
        editorMeta.hasPromptedArticle = true;
        const prompt = document.getElementById('articlePrompt');
        if(prompt) prompt.classList.remove('hidden');
    }
};

window.toggleArticleMode = function() {
    const wasArticle = editorMeta.isArticleMode;
    editorMeta.isArticleMode = !editorMeta.isArticleMode;
    editorMeta.hasPromptedArticle = true; 
    
    let currentText = '';
    if (!wasArticle) {
        const canvas = document.getElementById('journal-canvas');
        if (canvas) canvas.querySelectorAll('textarea').forEach(ta => { if (ta.value.trim()) currentText += `<p>${ta.value.replace(/\n/g, '<br>')}</p>`; });
    } else {
        const canvas = document.getElementById('article-canvas');
        if (canvas) currentText = canvas.innerText; 
    }
    
    render();
    setTimeout(() => {
        if (editorMeta.isArticleMode) document.getElementById('article-canvas').innerHTML = currentText;
        else { document.getElementById('journal-canvas').innerHTML = createBlockHTML('text'); const ta = document.getElementById('journal-canvas').querySelector('textarea'); if (ta) ta.value = currentText; }
        calculateWordCount();
    }, 50);
};

window.renderAddButton = function() {
    return `
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 no-print">
        <button onclick="document.getElementById('createMenuModal').classList.remove('hidden')" class="bg-cyan-600 text-white w-16 h-16 rounded-full shadow-[0_8px_20px_rgba(8,145,178,0.4)] text-4xl font-light hover:scale-110 hover:bg-cyan-500 transition-all flex items-center justify-center pb-2">+</button>
    </div>
    
    <div id="createMenuModal" class="hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-end justify-center animate-fade-in" onclick="this.classList.add('hidden')">
        <div class="bg-white w-full rounded-t-3xl p-6 transform transition-transform shadow-2xl" onclick="event.stopPropagation()">
            <div class="flex justify-between items-center mb-6">
                <h3 class="text-sm font-bold text-stone-500 tracking-widest ml-2">选择记录方式</h3>
                <button onclick="document.getElementById('createMenuModal').classList.add('hidden')" class="text-stone-400 hover:text-stone-700 bg-stone-100 rounded-full p-1.5 active:scale-90 transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>
            <div class="flex gap-4 mb-4">
                <button onclick="goToEditor('journal')" class="flex-1 bg-stone-50 border border-stone-100 p-6 rounded-3xl flex flex-col items-center gap-3 hover:bg-cyan-50 hover:border-cyan-100 transition-all active:scale-95 shadow-sm">
                    <span class="text-4xl drop-shadow-sm">📓</span>
                    <span class="text-sm font-bold text-stone-700 tracking-wider">手账碎片</span>
                </button>
                <button onclick="goToEditor('article')" class="flex-1 bg-stone-50 border border-stone-100 p-6 rounded-3xl flex flex-col items-center gap-3 hover:bg-emerald-50 hover:border-emerald-100 transition-all active:scale-95 shadow-sm">
                    <span class="text-4xl drop-shadow-sm">📝</span>
                    <span class="text-sm font-bold text-stone-700 tracking-wider">深度文章</span>
                </button>
            </div>
        </div>
    </div>`;
};

window.formatDateTimeLocal = function(d) { const pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };
window.updateMetaDate = function(val) { editorMeta.date = val; };
window.goToYear = function(y) { state.level = 'year'; state.year = y; render(); };
window.goToMonth = function(m) { state.level = 'month'; state.month = m; render(); };
window.goToDay = function(d) { state.level = 'day'; state.day = d; render(); };
window.openArticle = function(id) { historyStack.push({...state}); state.level = 'articleView'; state.currentArticleId = id; render(); };

window.goToEditor = function(type = 'journal') { 
    document.getElementById('createMenuModal')?.classList.add('hidden');
    isEditorDirty = false; 
    
    let devName = 'Echo 客户端';
    if (/android/i.test(navigator.userAgent)) devName = 'Android 设备';
    if (/ipad|iphone|ipod/i.test(navigator.userAgent)) devName = 'iOS 设备';
    
    editorMeta = { date: formatDateTimeLocal(new Date()), location: '', weather: '', wordCount: 0, isArticleMode: type === 'article', hasPromptedArticle: type === 'article', title: '', device: devName };
    historyStack.push({...state}); state.level = 'editor'; state.editingId = null; render(); 
};

window.cancelEdit = function() { state = historyStack.pop() || { level: 'home', year: null, month: null, day: null }; render(); };

// 🌟 V3.3.1 智能导航引擎：能识别时空穿越的返回
window.goBack = function(target) {
    if (window.historyStack.length > 0) {
        let prev = window.historyStack[window.historyStack.length - 1];
        let shouldPop = false;
        
        // 智能判定：是否需要提取历史记录进行返回
        if (!target) shouldPop = true; // 信箱点返回
        else if (state.level === 'articleView') shouldPop = true; // 文章页无脑弹出上一层
        else if (state.level === 'day' && prev.level === 'repliedList') shouldPop = true; // 从信箱进入手账页的返回
        else if (state.level === 'settings') shouldPop = true;
        
        if (shouldPop) {
            state = window.historyStack.pop();
            // 如果历史记录是漫游，必须移交渲染权给 roam.js
            if (state.level === 'roam' && typeof renderRoamView === 'function') renderRoamView();
            else render();
            return;
        }
    }
    
    if (target) state.level = target;
    else state.level = 'home';
    
    if (state.level === 'roam' && typeof renderRoamView === 'function') renderRoamView();
    else render();
};

window.saveJournal = function() {
    let htmlContent = '';

    if (editorMeta.isArticleMode) {
        const titleInput = document.getElementById('articleTitleInput');
        editorMeta.title = titleInput ? titleInput.value.trim() : (editorMeta.title || '');
        const canvas = document.getElementById('article-canvas');
        htmlContent = canvas.innerHTML;
        if (canvas.innerText.trim() === '' && !htmlContent.includes('<img')) return alert("总得写点什么再保存吧？");
    } else {
        const canvas = document.getElementById('journal-canvas');
        canvas.querySelectorAll('textarea').forEach(ta => {
            const p = document.createElement('p'); p.className = `text-stone-700 text-base leading-relaxed whitespace-pre-wrap outline-none`; p.innerText = ta.value; ta.parentNode.replaceChild(p, ta);
        });
        htmlContent = canvas.innerHTML;
        if (canvas.innerText.trim() === '' && !htmlContent.includes('<img') && !htmlContent.includes('<video') && !htmlContent.includes('<audio')) return alert("总得写点什么再保存吧？");
    }

    if (!editorMeta.date) return alert("请输入确切的时间！");
    calculateWordCount();

    const selectedDate = new Date(editorMeta.date);
    const y = selectedDate.getFullYear(), m = selectedDate.getMonth() + 1, d = selectedDate.getDate();
    const pad = n => String(n).padStart(2, '0');
    const timeStr = `${pad(selectedDate.getHours())}:${pad(selectedDate.getMinutes())}`;
    const fullDateStr = `${y}-${pad(m)}-${pad(d)} ${timeStr}`;

    if (!db[y]) db[y] = {}; if (!db[y][m]) db[y][m] = [];
    const newId = state.editingId || 'e_' + Date.now();
    
    if (state.editingId) {
        const oldY = state.year, oldM = state.month;
        if (db[oldY] && db[oldY][oldM]) db[oldY][oldM] = db[oldY][oldM].filter(x => x.id !== state.editingId);
    }

    db[y][m].unshift({ id: newId, day: d, timeStr: timeStr, fullDateStr: fullDateStr, location: editorMeta.location, weather: editorMeta.weather, wordCount: editorMeta.wordCount, isArticleMode: editorMeta.isArticleMode, title: editorMeta.title, device: editorMeta.device, html: htmlContent });
    
    if(typeof window.saveToLocal === 'function') window.saveToLocal();
    
    state.year = y; state.month = m; state.day = d; 
    
    if (editorMeta.isArticleMode) { state.level = 'articleView'; state.currentArticleId = newId; } else { state.level = 'day'; }
    render();
};

window.editEntry = function(id) {
    const entry = db[state.year][state.month].find(x => x.id === id);
    const pad = n => String(n).padStart(2, '0');
    isEditorDirty = false; 
    editorMeta = { date: `${state.year}-${pad(state.month)}-${pad(entry.day)}T${entry.timeStr}`, location: entry.location || '', weather: entry.weather || '', wordCount: entry.wordCount || 0, isArticleMode: entry.isArticleMode || false, hasPromptedArticle: true, title: entry.title || '', device: entry.device || 'Echo 客户端' };
    historyStack.push({...state}); state.level = 'editor'; state.editingId = id; render();
};

window.deleteEntry = function(id) { 
    if (confirm("确定要删除这条记录吗？无法恢复哦。")) { 
        db[state.year][state.month] = db[state.year][state.month].filter(x => x.id !== id); 
        if(typeof window.saveToLocal === 'function') window.saveToLocal(); 
        render(); 
    } 
};

window.createBlockHTML = function(type, url = '', duration = 0, timestamp = '') {
    let inner = ''; 
    if (type === 'text') inner = `<textarea class="w-full bg-transparent border-none resize-none text-stone-700 text-base leading-relaxed placeholder-stone-300" rows="2" placeholder="记录此刻..." oninput="this.style.height='';this.style.height=this.scrollHeight+'px';calculateWordCount(); if(!window.isEditorInitializing) isEditorDirty = true;"></textarea>`;
    else if (type === 'image') inner = `<img src="${url}" class="max-w-full rounded-lg shadow-sm border border-stone-200 mt-2">`;
    else if (type === 'video') inner = `<div class="py-2"><video controls class="w-full rounded-lg shadow-sm border border-stone-200 mt-2" src="${url}"></video></div>`;
    else if (type === 'voice') {
        const pad = n => String(Math.floor(n)).padStart(2, '0'); const timeStr = duration > 0 ? `0:${pad(duration)}` : '0:00';
        inner = `<div class="voice-container bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2 w-[280px] max-w-[90vw] shadow-sm flex items-center gap-2 no-print" data-duration="${duration}" data-recorded-at="${timestamp}">
            <button onclick="toggleVoice(this)" class="w-6 h-6 flex-shrink-0 bg-cyan-600 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform"><svg class="svg-play w-3 h-3 text-white ml-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" /></svg><svg class="svg-pause w-3 h-3 text-white hidden" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" /></svg></button>
            <span class="time-display text-sm text-cyan-700 font-mono font-bold min-w-[36px] text-center">${timeStr}</span>
            <div class="flex-1 h-[3px] bg-cyan-200 rounded-full relative overflow-hidden"><div class="progress-bar absolute left-0 top-0 h-full bg-cyan-600 w-0 pointer-events-none"></div></div>
            <div class="flex items-center gap-0.5 ml-1">
                <button onclick="toggleMute(this)" class="flex-shrink-0 active:scale-90 transition-transform"><svg class="svg-on w-4 h-4 text-cyan-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" /><path d="M15.932 7.757a.75.75 0 011.061 0 4.5 4.5 0 010 6.364.75.75 0 01-1.06-1.06 3 3 0 000-4.243.75.75 0 010-1.061z" /></svg><svg class="svg-off w-4 h-4 text-cyan-400 hidden" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 101.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 10-1.06-1.06l-1.72 1.72-1.72-1.72z" /></svg></button>
                <div class="relative flex items-center"><button onclick="toggleMenu(this)" class="flex-shrink-0 active:scale-90 transition-transform"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="-5 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-cyan-600"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" /></svg></button><div class="voice-menu hidden absolute right-0 bottom-8 bg-white border border-stone-100 shadow-xl rounded-lg w-28 text-sm overflow-hidden z-50"><button onclick="downloadAudio(this)" class="w-full text-left px-4 py-2 hover:bg-stone-50 text-stone-600 flex items-center gap-2 font-bold">下载音频</button></div></div>
            </div>
            <audio class="hidden voice-player" src="${url}" ontimeupdate="updateVoiceProgress(this)" onended="resetVoiceProgress(this)"></audio>
        </div>`;
    }
    return `<div class="block-item relative group bg-white/40 backdrop-blur-sm p-2 rounded-xl border border-transparent hover:border-stone-200 transition-colors"><div class="absolute -left-2 top-1/2 -translate-y-1/2 flex-col gap-1 hidden group-hover:flex z-10 no-print"><button onclick="moveBlock(this, 'up')" class="bg-white border border-stone-200 text-stone-500 rounded-t text-[10px] w-5 h-5 shadow-sm hover:bg-stone-50">▲</button><button onclick="moveBlock(this, 'down')" class="bg-white border border-stone-200 text-stone-500 rounded-b text-[10px] w-5 h-5 shadow-sm hover:bg-stone-50">▼</button></div><button onclick="this.parentElement.remove(); if(!window.isEditorInitializing) isEditorDirty = true; setTimeout(calculateWordCount, 50);" class="absolute -right-2 -top-2 bg-stone-300 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm hidden group-hover:flex hover:bg-rose-500 transition-colors z-10 no-print">✕</button>${inner}</div>`;
};

window.addBlock = function(type, event) {
    const canvas = document.getElementById('journal-canvas');
    if (!canvas) return;
    if ((type === 'image' || type === 'video') && event.target.files[0]) {
        const reader = new FileReader();
        reader.onload = async function(e) { 
            const localUrl = typeof window.saveMediaToDisk === 'function' ? await window.saveMediaToDisk(e.target.result, type) : e.target.result; 
            canvas.insertAdjacentHTML('beforeend', createBlockHTML(type, localUrl)); 
            if(!window.isEditorInitializing) isEditorDirty = true; 
            canvas.scrollTop = canvas.scrollHeight; 
        };
        reader.readAsDataURL(event.target.files[0]); event.target.value = '';
    } else { 
        canvas.insertAdjacentHTML('beforeend', createBlockHTML(type)); 
        if(!window.isEditorInitializing) isEditorDirty = true; 
        canvas.scrollTop = canvas.scrollHeight; 
    }
};
window.moveBlock = function(button, direction) { const block = button.parentElement.parentElement; if (direction === 'up' && block.previousElementSibling) block.previousElementSibling.before(block); else if (direction === 'down' && block.nextElementSibling) block.nextElementSibling.after(block); };
window.toggleVoice = function(btn) { const container = btn.closest('.voice-container'); const audio = container.querySelector('.voice-player'); const svgPlay = btn.querySelector('.svg-play'); const svgPause = btn.querySelector('.svg-pause'); if (audio.paused) { document.querySelectorAll('.voice-player').forEach(a => { if(!a.paused && a !== audio) { a.pause(); resetVoiceProgress(a); } }); audio.play(); svgPlay.classList.add('hidden'); svgPause.classList.remove('hidden'); } else { audio.pause(); svgPlay.classList.remove('hidden'); svgPause.classList.add('hidden'); } };
window.updateVoiceProgress = function(audio) { const container = audio.closest('.voice-container'); const timeDisplay = container.querySelector('.time-display'); const progressBar = container.querySelector('.progress-bar'); const currentSeconds = Math.floor(audio.currentTime); const totalSeconds = parseFloat(container.getAttribute('data-duration')) || (audio.duration || 1); progressBar.style.width = `${(audio.currentTime / totalSeconds) * 100}%`; timeDisplay.innerText = `0:${String(currentSeconds).padStart(2, '0')}`; };
window.resetVoiceProgress = function(audio) { const container = audio.closest('.voice-container'); const svgPlay = container.querySelector('.svg-play'); const svgPause = container.querySelector('.svg-pause'); const timeDisplay = container.querySelector('.time-display'); const progressBar = container.querySelector('.progress-bar'); const duration = container.getAttribute('data-duration'); audio.currentTime = 0; progressBar.style.width = '0%'; if(svgPlay && svgPause) { svgPlay.classList.remove('hidden'); svgPause.classList.add('hidden'); } timeDisplay.innerText = duration > 0 ? `0:${String(Math.floor(duration)).padStart(2, '0')}` : '0:00'; };
window.toggleMute = function(btn) { const container = btn.closest('.voice-container'); const audio = container.querySelector('.voice-player'); const svgOn = btn.querySelector('.svg-on'); const svgOff = btn.querySelector('.svg-off'); audio.muted = !audio.muted; if (audio.muted) { svgOn.classList.add('hidden'); svgOff.classList.remove('hidden'); } else { svgOn.classList.remove('hidden'); svgOff.classList.add('hidden'); } };
window.toggleMenu = function(btn) { const menu = btn.nextElementSibling; document.querySelectorAll('.voice-menu').forEach(m => { if (m !== menu) m.classList.add('hidden'); }); menu.classList.toggle('hidden'); };
window.closeMapPicker = function() { document.getElementById('mapPickerModal').classList.add('hidden'); };
window.openMapPicker = function() {
    closeLocationModal(); document.getElementById('mapPickerModal').classList.remove('hidden');
    if (!amap) {
        setTimeout(() => {
            amap = new AMap.Map('mapContainer', { zoom: 16 });
            AMap.plugin('AMap.Geolocation', function() {
                var geolocation = new AMap.Geolocation({ enableHighAccuracy: true, timeout: 10000, buttonPosition: 'RB', zoomToAccuracy: true });
                amap.addControl(geolocation);
                document.getElementById('selectedAddrInfo').innerText = "获取当前位置...";
                geolocation.getCurrentPosition(function(status, result) {
                    if (status === 'complete') {
                        const lnglat = result.position;
                        if (!amapMarker) { amapMarker = new AMap.Marker({ position: lnglat }); amap.add(amapMarker); } else amapMarker.setPosition(lnglat);
                        AMap.plugin('AMap.Geocoder', function() { new AMap.Geocoder().getAddress(lnglat, function(status, result) { if (status === 'complete' && result.regeocode) { tempSelectedLoc = window.simplifyAddress(result.regeocode.addressComponent); document.getElementById('selectedAddrInfo').innerText = `已选：${tempSelectedLoc}`; } }); });
                    } else document.getElementById('selectedAddrInfo').innerText = "自动定位失败，请手动选择";
                });
            });
            amap.on('click', function(e) {
                const lnglat = e.lnglat;
                if (!amapMarker) { amapMarker = new AMap.Marker({ position: lnglat }); amap.add(amapMarker); } else amapMarker.setPosition(lnglat);
                document.getElementById('selectedAddrInfo').innerText = "解析中...";
                AMap.plugin('AMap.Geocoder', function() { new AMap.Geocoder().getAddress(lnglat, function(status, result) { if (status === 'complete' && result.regeocode) { tempSelectedLoc = window.simplifyAddress(result.regeocode.addressComponent); document.getElementById('selectedAddrInfo').innerText = `已选：${tempSelectedLoc}`; } else document.getElementById('selectedAddrInfo').innerText = "解析失败"; }); });
            });
        }, 100);
    }
};
document.getElementById('confirmMapLoc').onclick = function() { if (tempSelectedLoc) { editorMeta.location = tempSelectedLoc; isEditorDirty = true; closeMapPicker(); updateLocationDOM(); } else alert("请先在地图上点一个位置"); };

window.downloadAudio = async function(btn) {
    const container = btn.closest('.voice-container'); const audio = container.querySelector('.voice-player'); const menu = btn.closest('.voice-menu'); menu.classList.add('hidden');
    const recordedTime = container.getAttribute('data-recorded-at') || '未知时间'; const fileName = `回响APP_语音_${Date.now()}.webm`;
    try {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const Filesystem = Capacitor.Plugins.Filesystem; const Share = Capacitor.Plugins.Share;
            const base64Data = audio.src.split(',')[1];
            await Filesystem.writeFile({ path: fileName, data: base64Data, directory: 'CACHE' });
            const uriResult = await Filesystem.getUri({ path: fileName, directory: 'CACHE' });
            await Share.share({ title: '回响语音分享', text: `语音记录，时间是${recordedTime}。`, url: uriResult.uri, dialogTitle: '保存或分享' });
        } else { const a = document.createElement('a'); a.href = audio.src; a.download = fileName; a.click(); }
    } catch (error) { alert("❌ 操作失败: " + error.message); }
};
// ========================
// 🌟 V3.2 时光回信引擎 (长按手势、回信弹窗、回信保存)
// ========================
window.longPressTimer = null;
window.isLongPressing = false;
window.replyingEntryId = null;

window.startLongPress = function(id) {
    window.isLongPressing = false;
    window.longPressTimer = setTimeout(() => {
        window.isLongPressing = true;
        if(window.navigator.vibrate) navigator.vibrate(50); // 震动反馈
        window.openReplyModal(id);
    }, 600); // 长按 600 毫秒触发
};

window.cancelLongPress = function() {
    clearTimeout(window.longPressTimer);
};

window.openReplyModal = function(id) {
    window.replyingEntryId = id;
    let modal = document.getElementById('timeReplyModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'timeReplyModal';
        modal.className = 'hidden fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-[200] flex items-end sm:items-center justify-center animate-fade-in';
        modal.innerHTML = `
            <div class="bg-[#faf9f6] w-full sm:w-[90%] sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl transform transition-transform" onclick="event.stopPropagation()">
                <h3 class="text-lg font-serif font-bold text-stone-800 mb-4 flex items-center gap-2"><span class="text-2xl drop-shadow-sm">💌</span> 致那天的自己</h3>
                <textarea id="replyContentInput" class="w-full h-36 bg-white border border-stone-200 rounded-2xl p-4 text-stone-700 focus:outline-none focus:border-rose-300 focus:ring-1 focus:ring-rose-300 resize-none leading-relaxed placeholder-stone-300 shadow-inner" placeholder="写下现在的感想，告诉当年的自己..."></textarea>
                <div class="flex justify-end gap-4 mt-6">
                    <button onclick="closeReplyModal()" class="px-5 py-2.5 text-stone-500 font-bold hover:bg-stone-100 rounded-full transition-colors active:scale-95">取消</button>
                    <button onclick="submitReply()" class="px-6 py-2.5 bg-rose-500 text-white font-bold rounded-full shadow-[0_4px_15px_rgba(244,63,94,0.3)] hover:bg-rose-400 transition-all active:scale-95 flex items-center gap-1">寄出回信 ✨</button>
                </div>
            </div>
        `;
        modal.onclick = closeReplyModal;
        document.body.appendChild(modal);
    }
    document.getElementById('replyContentInput').value = '';
    modal.classList.remove('hidden');
    setTimeout(() => document.getElementById('replyContentInput').focus(), 100);
};

window.closeReplyModal = function() {
    const modal = document.getElementById('timeReplyModal');
    if(modal) modal.classList.add('hidden');
    window.replyingEntryId = null;
};

window.submitReply = function() {
    const content = document.getElementById('replyContentInput').value.trim();
    if (!content) return alert("回信不能为空哦！");
    
    // 找到对应日记
    let targetEntry = null;
    for(let y in db) {
        for(let m in db[y]) {
            let found = db[y][m].find(e => e.id === window.replyingEntryId);
            if(found) targetEntry = found;
        }
    }
    if(!targetEntry) return alert("找不到原记录了！");

    if(!targetEntry.replies) targetEntry.replies = [];
    
    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    targetEntry.replies.push({
        id: 'reply_' + Date.now(),
        dateStr: `${now.getFullYear()}年${now.getMonth()+1}月${now.getDate()}日 ${pad(now.getHours())}:${pad(now.getMinutes())}`,
        content: content
    });

    if(typeof window.saveToLocal === 'function') window.saveToLocal();
    closeReplyModal();
    render(); // 刷新页面展示回信
};

window.goToRepliedList = function() {
    if (typeof closeSidebar === 'function') closeSidebar(); // 点击后关闭侧边栏
    historyStack.push({...state});
    state.level = 'repliedList';
    render();
};

// 🌟 时空穿梭引擎：从信箱跳回原文
window.jumpToEntryFromMailbox = function(y, m, d, id, isArticle) {
    state.year = String(y);
    state.month = String(m);
    state.day = Number(d);
    
    // 把当前信箱压入历史栈，保证可以从文章按“返回”退回信箱
    historyStack.push({...state}); 
    
    if (isArticle) {
        state.level = 'articleView';
        state.currentArticleId = id;
    } else {
        state.level = 'day';
        // 手账模式跳回具体的某一天
    }
    render();
};
// 🌟 删除回信引擎
window.deleteReply = function(year, month, entryId, replyId) {
    if (!confirm("确定要删除这封回信吗？删了就找不回咯。")) return;
    
    let entry = db[year][month].find(e => e.id === entryId);
    if (entry && entry.replies) {
        entry.replies = entry.replies.filter(r => r.id !== replyId);
        if (typeof window.saveToLocal === 'function') window.saveToLocal();
        render(); // 无缝刷新页面，如果信全删光了，它会自动从信箱消失！
    }
};