let db = JSON.parse(localStorage.getItem('WangShiShuJia_DB')) || {}; 
let state = { level: 'home', year: null, month: null, day: null, editingId: null };
let editorMeta = { date: '', location: '', weather: '', wordCount: 0 };
let historyStack = [];
let mediaRecorder = null;
let audioChunks = [];
let recordTimer = null;
let recordSeconds = 0;

function saveToLocal() {
    try { localStorage.setItem('WangShiShuJia_DB', JSON.stringify(db)); } 
    catch (e) { if (e.name === 'QuotaExceededError') alert("⚠️ 浏览器的本地存储空间已满（限制约5MB）。"); }
}

// 🌟录音函数：解决安卓授权时差 Bug
async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return alert("⚠️ 你的设备环境不支持录音功能。");
    }

    let stream;
    try {
        // 1. 第一次尝试呼叫麦克风（这里会触发系统的红色授权弹窗）
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        // 2. 核心修复：如果用户刚点完授权，WebView 还没反应过来报错了，我们等 0.5 秒再试一次！
        try {
            console.log("第一次请求被中断，等待 500ms 后重试...");
            await new Promise(resolve => setTimeout(resolve, 500));
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (retryErr) {
            // 如果第二次还失败，把真实的错误代码打印出来，方便我们排查
            return alert("⚠️ 录音权限被拒绝或被系统占用。\n错误代码: " + retryErr.name + "\n请在手机设置中检查权限。");
        }
    }

    try {
        // 3. 麦克风连接成功，开始录制
        
        // 👇👇👇 就是这里！你丢失的核心代码，用来初始化录音机和装载音频数据！
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        // 👆👆👆 丢失代码结束
        
        mediaRecorder.onstop = () => {
            const reader = new FileReader();
            const finalDuration = recordSeconds;
            
            // 🌟 核心：在录音停止的一瞬间，生成当前的北京时间字符串
            const now = new Date();
            const recordTime = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日${now.getHours()}点${String(now.getMinutes()).padStart(2, '0')}分`;
            
            reader.onload = function(e) {
                // 🌟 将 recordTime 传给生成器
                document.getElementById('journal-canvas').insertAdjacentHTML('beforeend', createBlockHTML('voice', e.target.result, finalDuration, recordTime));
            };
            reader.readAsDataURL(new Blob(audioChunks, { type: 'audio/webm' }));
            stream.getTracks().forEach(track => track.stop());
        };

        // 4. 显示录音动画浮层
        document.getElementById('recordingModal').classList.remove('hidden'); 
        recordSeconds = 0; 
        document.getElementById('recordTimeDisplay').innerText = "00:00";
        mediaRecorder.start(); // 现在它有真实的音频流了，不会再报错了！
        
        // 5. 计时器
        recordTimer = setInterval(() => {
            recordSeconds++; 
            document.getElementById('recordTimeDisplay').innerText = `00:${String(recordSeconds).padStart(2, '0')}`;
            if (recordSeconds >= 60) stopRecording();
        }, 1000);

    } catch (err) {
        alert("⚠️ 录音引擎初始化失败：" + err.message);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop(); clearInterval(recordTimer);
        document.getElementById('recordingModal').classList.add('hidden');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('-translate-x-full')) openSidebar();
    else closeSidebar();
}

function openSidebar() {
    let totalDays = 0;
    for(let y in db) { for(let m in db[y]) { totalDays += new Set(db[y][m].map(e => e.day)).size; } }
    document.getElementById('statDays').innerText = totalDays;
    const icons = ['🐱','🐶','🌻','🌿','☕','🏕️','🚲','🌅','🍀','🧸'];
    document.getElementById('drawerHeaderIcon').innerText = icons[Math.floor(Math.random() * icons.length)];
    document.getElementById('sidebar').classList.remove('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.remove('hidden');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.add('-translate-x-full');
    document.getElementById('sidebarOverlay').classList.add('hidden');
}

function exportToPDF() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
    const element = document.getElementById('printable-area');
    const navBar = element.querySelector('.sticky');
    if(navBar) navBar.classList.add('hidden');
    html2pdf().set({ margin: 10, filename: `往事书架.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).from(element).save().then(() => {
        if(navBar) navBar.classList.remove('hidden');
        document.getElementById('loadingOverlay').classList.add('hidden');
    }).catch(err => {
        alert("生成PDF失败");
        if(navBar) navBar.classList.remove('hidden');
        document.getElementById('loadingOverlay').classList.add('hidden');
    });
}

function openLocationModal() { document.getElementById('locationModal').classList.remove('hidden'); }
function closeLocationModal() { document.getElementById('locationModal').classList.add('hidden'); }

function getLocationFromDevice() {
    if (navigator.geolocation) {
        const title = document.getElementById('locationModalTitle');
        const oldTitle = title.innerText;
        title.innerText = "获取中...";
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude.toFixed(4);
            const lon = position.coords.longitude.toFixed(4);
            editorMeta.location = `东经${lon} 北纬${lat}`;
            title.innerText = oldTitle;
            closeLocationModal();
            render();
        }, error => {
            alert("获取位置失败，可能是由于没有权限或未在 HTTPS 环境下运行。");
            title.innerText = oldTitle;
        });
    } else {
        alert("你的浏览器不支持原生定位功能。");
    }
}

function setCustomLocation() {
    const input = document.getElementById('customLocationInput');
    if (input.value.trim() !== '') {
        editorMeta.location = input.value.trim();
        input.value = '';
        closeLocationModal();
        render();
    }
}

function clearLocation() {
    editorMeta.location = '';
    closeLocationModal();
    render();
}

function openWeatherModal() { document.getElementById('weatherModal').classList.remove('hidden'); }
function closeWeatherModal() { document.getElementById('weatherModal').classList.add('hidden'); }
function selectWeather(w) { editorMeta.weather = w; closeWeatherModal(); render(); }

// 🌟 新增：进入设置页面的功能函数
function goToSettings() {
    closeSidebar();
    historyStack.push({...state});
    state.level = 'settings';
    render();
}

// 核心渲染引擎
function render() {
    const app = document.getElementById('app');
    
    if (state.level === 'home') {
        const years = Object.keys(db).sort((a,b) => b-a);
        const currentYear = new Date().getFullYear();
        if (!years.includes(String(currentYear))) years.unshift(String(currentYear));

        let booksHtml = years.map(y => `
            <div onclick="goToYear(${y})" class="book-spine ${y == currentYear ? 'bg-amber-700 border-amber-900' : 'bg-emerald-800 border-emerald-950'} h-64 rounded-r-lg shadow-xl border-l-8 p-4 text-white flex flex-col justify-between hover:-translate-y-2 transition-transform">
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
                        <p class="text-[10px] text-stone-400 mt-1 uppercase tracking-widest">月份页面</p>
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
                        <p class="text-[10px] text-stone-400 mt-1 uppercase tracking-widest">日期页面</p>
                    </div>
                </div>
                <div class="space-y-2 mt-2">${daysHtml}</div>
            </div>
            ${renderAddButton()}
        `;
    }
    else if (state.level === 'day') {
        const dayEntries = (db[state.year][state.month]||[]).filter(e => e.day === state.day);
        if(dayEntries.length === 0) return goBack('month');

        let entriesHtml = dayEntries.map(entry => `
            <div class="mb-12">
                <div class="flex justify-between items-end mb-3 px-2 no-print">
                    <span class="text-xs text-stone-400 font-bold tracking-widest uppercase">手账记录</span>
                    <div class="flex gap-4">
                        <button onclick="editEntry('${entry.id}')" class="text-xs text-stone-400 hover:text-cyan-600 font-bold">编辑</button>
                        <button onclick="deleteEntry('${entry.id}')" class="text-xs text-stone-400 hover:text-rose-500 font-bold">删除</button>
                    </div>
                </div>
                <div class="read-only-mode ${(entry.html.includes('<img') || entry.html.includes('<video')) ? 'journal-bg' : 'bg-[#faf9f6]'} p-6 rounded-t-3xl shadow-sm border border-stone-200 border-b-0 transition-colors duration-300">
                    ${entry.html}
                </div>
                <div class="bg-white p-4 rounded-b-3xl border border-stone-200 shadow-sm flex flex-col sm:flex-row justify-between sm:items-center text-xs text-stone-400 gap-3">
                    <div class="flex items-center gap-2 font-mono font-bold text-stone-500">
                        <span class="text-base">🕒</span> <span>${entry.fullDateStr || entry.timeStr}</span>
                    </div>
                    <div class="flex flex-wrap gap-4 items-center font-medium">
                        <div class="flex items-center gap-1"><span class="text-base">📍</span> <span class="truncate max-w-[100px]">${entry.location || '无定位'}</span></div>
                        <div class="flex items-center gap-1"><span>${entry.weather || '🌤️ 无天气'}</span></div>
                        <div class="border-l border-stone-200 pl-4 font-bold text-stone-500">字数：${entry.wordCount || 0} 字</div>
                    </div>
                </div>
            </div>`).join('');

        app.innerHTML = `
            <div class="p-6 h-full overflow-y-auto pb-32 bg-stone-50" id="printable-area">
                <div class="flex justify-between items-center mb-8 sticky top-0 bg-stone-50/90 backdrop-blur py-2 z-10 no-print">
                    <div class="flex items-center gap-4">
                        <button onclick="goBack('month')" class="flex items-center gap-1 text-stone-500 font-bold hover:text-stone-800 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm border border-stone-100">
                            <span>←</span> 返回
                        </button>
                        <h1 class="text-xl font-serif font-bold text-stone-700">${state.month}月${state.day}日</h1>
                    </div>
                    <button onclick="exportToPDF()" class="flex items-center gap-2 text-sm bg-cyan-600 text-white px-4 py-2 rounded-full shadow-md hover:bg-cyan-500 font-bold tracking-wider">
                        <span>📥</span> 导出PDF
                    </button>
                </div>
                <h1 class="hidden print:block text-3xl font-serif font-bold text-center mb-10 border-b-2 border-stone-800 pb-4 mx-4 mt-8">${state.year}年 ${state.month}月${state.day}日 手账归档</h1>
                <div class="px-2 sm:px-0">${entriesHtml}</div>
            </div>
            ${renderAddButton()}
        `;
    }
    else if (state.level === 'editor') {
        app.innerHTML = `
            <div class="flex flex-col h-full journal-bg relative">
                <div class="flex justify-between items-center p-4 bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-20 no-print">
                    <button onclick="cancelEdit()" class="text-stone-400 font-bold hover:text-stone-600">取消</button>
                    <span class="font-serif font-bold text-stone-700 text-sm tracking-widest">${state.editingId ? '修改手账' : '新的一页'}</span>
                    <button onclick="saveJournal()" class="bg-cyan-600 text-white px-6 py-1.5 rounded-full text-sm font-bold shadow-md hover:bg-cyan-500 active:scale-95 transition-transform">保存</button>
                </div>

                <div id="journal-canvas" class="flex-1 p-6 pb-40 overflow-y-auto space-y-2" onkeyup="calculateWordCount()"></div>

                <div class="absolute bottom-[68px] left-0 w-full bg-white/95 backdrop-blur-sm border-t border-stone-200 p-2.5 flex justify-between items-center text-[11px] text-stone-500 z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] no-print">
                    <div class="relative flex items-center justify-center gap-1 cursor-pointer hover:text-cyan-600 transition-colors w-1/4">
                        <span>🕒</span>
                        <input type="datetime-local" id="entryDate" value="${editorMeta.date}" onchange="updateMetaDate(this.value)" class="bg-transparent outline-none text-stone-400 font-mono w-full truncate text-center">
                    </div>
                    <div class="w-px h-4 bg-stone-200 flex-shrink-0"></div>
                    <div onclick="openLocationModal()" class="flex items-center justify-center cursor-pointer hover:text-cyan-600 transition-colors w-1/4 px-1">
                        <div class="flex items-center gap-1 truncate">
                            <span>📍</span> <span id="locDisplay" class="truncate">${editorMeta.location || '定位'}</span>
                        </div>
                    </div>
                    <div class="w-px h-4 bg-stone-200 flex-shrink-0"></div>
                    <div onclick="openWeatherModal()" class="flex items-center justify-center cursor-pointer hover:text-cyan-600 transition-colors w-1/4 px-1">
                        <span id="weatherDisplay" class="truncate">${editorMeta.weather || '🌤️ 天气'}</span>
                    </div>
                    <div class="w-px h-4 bg-stone-200 flex-shrink-0"></div>
                    <div class="flex items-center justify-center w-1/4 px-1 font-bold text-stone-400">
                        <span id="wordCountDisplay">字数：${editorMeta.wordCount} 字</span>
                    </div>
                </div>

                <div class="absolute bottom-0 left-0 w-full bg-white border-t border-stone-100 p-3 flex justify-around z-20 no-print">
                    <button onclick="addBlock('text')" class="flex flex-col items-center gap-1 text-stone-400 hover:text-cyan-600 transition-colors">
                        <span class="text-xl">✍️</span><span class="text-[10px] font-bold">文字</span>
                    </button>
                    <label class="flex flex-col items-center gap-1 text-stone-400 hover:text-cyan-600 cursor-pointer transition-colors">
                        <span class="text-xl">🖼️</span><span class="text-[10px] font-bold">图片</span>
                        <input type="file" accept="image/*" class="hidden" onchange="addBlock('image', event)">
                    </label>
                    <label class="flex flex-col items-center gap-1 text-stone-400 hover:text-cyan-600 cursor-pointer transition-colors">
                        <span class="text-xl">🎥</span><span class="text-[10px] font-bold">视频</span>
                        <input type="file" accept="video/*" class="hidden" onchange="addBlock('video', event)">
                    </label>
                    <button onclick="startRecording()" class="flex flex-col items-center gap-1 text-stone-400 hover:text-cyan-600 transition-colors">
                        <span class="text-xl">🎙️</span><span class="text-[10px] font-bold">语音</span>
                    </button>
                </div>
            </div>
        `;

        const canvas = document.getElementById('journal-canvas');
        if (state.editingId) {
            const entry = db[state.year][state.month].find(x => x.id === state.editingId);
            canvas.innerHTML = entry.html;
            canvas.querySelectorAll('p').forEach(p => {
                const ta = document.createElement('textarea');
                ta.className = 'w-full bg-transparent border-none resize-none text-stone-700 text-base leading-relaxed placeholder-stone-400';
                ta.value = p.innerText;
                ta.oninput = function() { this.style.height = ''; this.style.height = this.scrollHeight + 'px'; calculateWordCount(); };
                p.parentNode.replaceChild(ta, p);
                setTimeout(() => ta.oninput(), 10);
            });
            calculateWordCount(); 
        } else {
            canvas.innerHTML = createBlockHTML('text');
        }
    }
    // 🌟 新增：设置页面的 UI 渲染
    else if (state.level === 'settings') {
        app.innerHTML = `
            <div class="p-6 h-full overflow-y-auto bg-stone-50">
                <div class="flex items-center justify-between mb-8 sticky top-0 bg-stone-50/90 backdrop-blur py-2 z-10">
                    <button onclick="goBack('home')" class="flex items-center gap-1 text-stone-500 font-bold hover:text-stone-800 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm border border-stone-100">
                        <span>←</span> 返回
                    </button>
                    <div class="text-right">
                        <h1 class="text-2xl font-serif font-bold text-stone-800">系统设置</h1>
                    </div>
                </div>
                
                <div class="bg-white rounded-3xl shadow-sm border border-stone-100 p-8 flex flex-col items-center justify-center mt-4">
                    <div class="w-24 h-24 bg-cyan-50 rounded-full flex items-center justify-center text-5xl mb-4 shadow-inner">📚</div>
                    <h2 class="text-2xl font-serif font-bold text-stone-700 mb-2">往事书架</h2>
                    <p class="text-xs text-stone-400 mb-6 bg-stone-100 px-3 py-1 rounded-full">当前版本：v19.0.0 (Pro)</p>
                    
                    <div class="w-full border-t border-stone-100 my-4"></div>
                    
                    <div class="w-full flex justify-between items-center py-3">
                        <span class="text-stone-500 font-medium">更新日期</span>
                        <span class="text-stone-400 text-sm font-mono">2026年4月25日</span>
                    </div>
                    <div class="w-full flex justify-between items-center py-3">
                        <span class="text-stone-500 font-medium">核心开发者</span>
                        <span class="text-stone-400 text-sm">Gemini CTO</span>
                    </div>
                    <div class="w-full flex justify-between items-center py-3">
                        <span class="text-stone-500 font-medium">数据存储</span>
                        <span class="text-stone-400 text-sm">本地浏览器缓存</span>
                    </div>
                </div>
                
                <div class="text-center mt-10 text-stone-300 text-xs">
                    <p>每一次记录，都是时间的馈赠。</p>
                </div>
            </div>
        `;
    }
}

function calculateWordCount() {
    const canvas = document.getElementById('journal-canvas');
    if (!canvas) return;
    let totalWords = 0;
    canvas.querySelectorAll('textarea').forEach(ta => {
        totalWords += ta.value.trim().length;
    });
    editorMeta.wordCount = totalWords;
    const display = document.getElementById('wordCountDisplay');
    if (display) display.innerText = `字数：${totalWords} 字`;
}

function renderAddButton() {
    return `
    <div class="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 no-print">
        <button onclick="goToEditor()" class="bg-cyan-600 text-white w-16 h-16 rounded-full shadow-[0_8px_20px_rgba(8,145,178,0.4)] text-4xl font-light hover:scale-110 hover:bg-cyan-500 transition-all flex items-center justify-center pb-2">+</button>
    </div>`;
}

function formatDateTimeLocal(d) {
    const pad = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function updateMetaDate(val) { editorMeta.date = val; }

function goToYear(y) { state.level = 'year'; state.year = y; render(); }
function goToMonth(m) { state.level = 'month'; state.month = m; render(); }
function goToDay(d) { state.level = 'day'; state.day = d; render(); }

function goToEditor() { 
    editorMeta = { date: formatDateTimeLocal(new Date()), location: '', weather: '', wordCount: 0 };
    historyStack.push({...state}); state.level = 'editor'; state.editingId = null; render(); 
}

function cancelEdit() { state = historyStack.pop() || { level: 'home', year: null, month: null, day: null }; render(); }
function goBack(target) { if (target) state.level = target; render(); }

function saveJournal() {
    const canvas = document.getElementById('journal-canvas');
    if (!editorMeta.date) return alert("请输入确切的时间！");
    calculateWordCount();

    canvas.querySelectorAll('textarea').forEach(ta => {
        const p = document.createElement('p');
        p.className = 'text-stone-700 text-base leading-relaxed whitespace-pre-wrap outline-none';
        p.innerText = ta.value;
        ta.parentNode.replaceChild(p, ta);
    });

    const htmlContent = canvas.innerHTML;
    if (canvas.innerText.trim() === '' && !htmlContent.includes('<img') && !htmlContent.includes('<video') && !htmlContent.includes('<audio')) {
        return alert("总得写点什么再保存吧？");
    }

    const selectedDate = new Date(editorMeta.date);
    const y = selectedDate.getFullYear(), m = selectedDate.getMonth() + 1, d = selectedDate.getDate();
    const pad = n => String(n).padStart(2, '0');
    const timeStr = `${pad(selectedDate.getHours())}:${pad(selectedDate.getMinutes())}`;
    const fullDateStr = `${y}-${pad(m)}-${pad(d)} ${timeStr}`;

    if (!db[y]) db[y] = {};
    if (!db[y][m]) db[y][m] = [];

    const newId = state.editingId || 'e_' + Date.now();

    if (state.editingId) {
        const oldY = state.year, oldM = state.month;
        if (db[oldY] && db[oldY][oldM]) {
            db[oldY][oldM] = db[oldY][oldM].filter(x => x.id !== state.editingId);
        }
    }

    db[y][m].unshift({
        id: newId, day: d, timeStr: timeStr, fullDateStr: fullDateStr, 
        location: editorMeta.location, weather: editorMeta.weather, 
        wordCount: editorMeta.wordCount, html: htmlContent
    });

    saveToLocal();
    state.year = y; state.month = m; state.day = d; state.level = 'day';
    render();
}

function editEntry(id) {
    const entry = db[state.year][state.month].find(x => x.id === id);
    const pad = n => String(n).padStart(2, '0');
    editorMeta = {
        date: `${state.year}-${pad(state.month)}-${pad(entry.day)}T${entry.timeStr}`,
        location: entry.location || '',
        weather: entry.weather || '',
        wordCount: entry.wordCount || 0
    };
    historyStack.push({...state}); state.level = 'editor'; state.editingId = id; render();
}

function deleteEntry(id) {
    if (confirm("确定要删除这条记录吗？无法恢复哦。")) {
        db[state.year][state.month] = db[state.year][state.month].filter(x => x.id !== id);
        saveToLocal();
        render();
    }
}

// 注意参数里加上了 duration = 0
function createBlockHTML(type, url = '', duration = 0, timestamp = '') {
    let inner = '';
    if (type === 'text') {
        inner = `<textarea class="w-full bg-transparent border-none resize-none text-stone-700 text-base leading-relaxed placeholder-stone-400" rows="2" placeholder="记录此刻..." oninput="this.style.height='';this.style.height=this.scrollHeight+'px';calculateWordCount();"></textarea>`;
    } else if (type === 'image') {
        inner = `<img src="${url}" class="max-w-full rounded-lg shadow-sm border border-stone-200 mt-2">`;
    } else if (type === 'video') {
        inner = `<div class="py-2"><video controls class="w-full rounded-lg shadow-sm border border-stone-200 mt-2" src="${url}"></video></div>`;
   } else if (type === 'voice') {
        const pad = n => String(Math.floor(n)).padStart(2, '0');
        const timeStr = duration > 0 ? `0:${pad(duration)}` : '0:00';
        
        // 🌟 修复了缺失的反引号，并完美融合了你的所有 UI 和时间数据
        inner = `
        <div class="voice-container bg-cyan-50 border border-cyan-100 rounded-xl px-3 py-2 w-[280px] max-w-[90vw] shadow-sm flex items-center gap-2 no-print" 
             data-duration="${duration}" 
             data-recorded-at="${timestamp}">
            
            <button onclick="toggleVoice(this)" class="w-6 h-6 flex-shrink-0 bg-cyan-600 rounded-full flex items-center justify-center shadow-md active:scale-95 transition-transform">
                <svg class="svg-play w-3 h-3 text-white ml-0.5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clip-rule="evenodd" />
                </svg>
                <svg class="svg-pause w-3 h-3 text-white hidden" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fill-rule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0a.75.75 0 01.75-.75h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V5.25z" clip-rule="evenodd" />
                </svg>
            </button>
            
            <span class="time-display text-sm text-cyan-700 font-mono font-bold min-w-[36px] text-center">${timeStr}</span>
            
            <div class="flex-1 h-[3px] bg-cyan-200 rounded-full relative overflow-hidden">
                <div class="progress-bar absolute left-0 top-0 h-full bg-cyan-600 w-0 pointer-events-none"></div>
            </div>

            <button onclick="toggleMute(this)" class="flex-shrink-0 active:scale-90 transition-transform px-1">
                <svg class="svg-on w-4 h-4 text-cyan-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                    <path d="M15.932 7.757a.75.75 0 011.061 0 4.5 4.5 0 010 6.364.75.75 0 01-1.06-1.06 3 3 0 000-4.243.75.75 0 010-1.061z" />
                </svg>
                <svg class="svg-off w-4 h-4 text-cyan-400 hidden" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 101.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 10-1.06-1.06l-1.72 1.72-1.72-1.72z" />
                </svg>
            </button>
            
            <div class="relative flex items-center">
                <button onclick="toggleMenu(this)" class="flex-shrink-0 active:scale-90 transition-transform px-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="-5 0 24 24" stroke-width="2" stroke="currentColor" class="w-6 h-6 text-cyan-600">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
                    </svg>
                </button>

                <div class="voice-menu hidden absolute right-0 bottom-8 bg-white border border-stone-100 shadow-xl rounded-lg w-28 text-sm overflow-hidden z-50">
                    <button onclick="downloadAudio(this)" class="w-full text-left px-4 py-2 hover:bg-stone-50 text-stone-600 flex items-center gap-2 font-bold">
                        <span class="text-lg"></span> 下载音频
                    </button>
                </div>
            </div>
            
            <audio class="hidden voice-player" src="${url}" ontimeupdate="updateVoiceProgress(this)" onended="resetVoiceProgress(this)"></audio>
        </div>`;
    }

    return `
    <div class="block-item relative group bg-white/40 backdrop-blur-sm p-2 rounded-xl border border-transparent hover:border-stone-200 transition-colors">
        <div class="absolute -left-2 top-1/2 -translate-y-1/2 flex-col gap-1 hidden group-hover:flex z-10 no-print">
            <button onclick="moveBlock(this, 'up')" class="bg-white border border-stone-200 text-stone-500 rounded-t text-[10px] w-5 h-5 shadow-sm hover:bg-stone-50">▲</button>
            <button onclick="moveBlock(this, 'down')" class="bg-white border border-stone-200 text-stone-500 rounded-b text-[10px] w-5 h-5 shadow-sm hover:bg-stone-50">▼</button>
        </div>
        <button onclick="this.parentElement.remove(); setTimeout(calculateWordCount, 50);" class="absolute -right-2 -top-2 bg-stone-300 text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] shadow-sm hidden group-hover:flex hover:bg-rose-500 transition-colors z-10 no-print">✕</button>
        ${inner}
    </div>`;
}

function addBlock(type, event) {
    const canvas = document.getElementById('journal-canvas');
    if (!canvas) return;
    
    if ((type === 'image' || type === 'video') && event.target.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            canvas.insertAdjacentHTML('beforeend', createBlockHTML(type, e.target.result));
            canvas.scrollTop = canvas.scrollHeight;
        };
        reader.readAsDataURL(event.target.files[0]);
        event.target.value = '';
    } else {
        canvas.insertAdjacentHTML('beforeend', createBlockHTML(type));
        canvas.scrollTop = canvas.scrollHeight;
    }
}

function moveBlock(button, direction) {
    const block = button.parentElement.parentElement;
    if (direction === 'up' && block.previousElementSibling) {
        block.previousElementSibling.before(block);
    } else if (direction === 'down' && block.nextElementSibling) {
        block.nextElementSibling.after(block);
    }
}

// 1. 播放/暂停控制 (升级为控制 SVG 显示/隐藏)
function toggleVoice(btn) {
    const container = btn.closest('.voice-container');
    const audio = container.querySelector('.voice-player');
    const svgPlay = btn.querySelector('.svg-play');
    const svgPause = btn.querySelector('.svg-pause');

    if (audio.paused) {
        document.querySelectorAll('.voice-player').forEach(a => {
            if(!a.paused && a !== audio) {
                a.pause();
                resetVoiceProgress(a); 
            }
        });
        audio.play();
        // 播放时：藏起播放键，露出暂停键
        svgPlay.classList.add('hidden');
        svgPause.classList.remove('hidden');
    } else {
        audio.pause();
        // 暂停时：藏起暂停键，露出播放键
        svgPlay.classList.remove('hidden');
        svgPause.classList.add('hidden');
    }
}

// 2. 🌟 进度条动态更新引擎 (每秒触发几十次)
function updateVoiceProgress(audio) {
    const container = audio.closest('.voice-container');
    const timeDisplay = container.querySelector('.time-display');
    const progressBar = container.querySelector('.progress-bar');
    
    // 计算当前播放了百分之几
    const currentSeconds = Math.floor(audio.currentTime);
    const totalSeconds = parseFloat(container.getAttribute('data-duration')) || (audio.duration || 1);
    const percent = (audio.currentTime / totalSeconds) * 100;
    
    // 推送给 UI：拉长进度条，改变数字
    progressBar.style.width = `${percent}%`;
    const pad = n => String(n).padStart(2, '0');
    timeDisplay.innerText = `0:${pad(currentSeconds)}`;
}

// 3. 播放结束/被打断时的复位引擎 (升级为还原 SVG 状态)
function resetVoiceProgress(audio) {
    const container = audio.closest('.voice-container');
    const svgPlay = container.querySelector('.svg-play');
    const svgPause = container.querySelector('.svg-pause');
    const timeDisplay = container.querySelector('.time-display');
    const progressBar = container.querySelector('.progress-bar');
    const duration = container.getAttribute('data-duration');
    
    audio.currentTime = 0; 
    progressBar.style.width = '0%'; 
    
    // 复位图标：露出播放键
    if(svgPlay && svgPause) {
        svgPlay.classList.remove('hidden');
        svgPause.classList.add('hidden');
    }
    
    const pad = n => String(n).padStart(2, '0');
    timeDisplay.innerText = duration > 0 ? `0:${pad(duration)}` : '0:00';
}

// 4. 🔈 静音/取消静音切换
function toggleMute(btn) {
    const container = btn.closest('.voice-container');
    const audio = container.querySelector('.voice-player');
    const svgOn = btn.querySelector('.svg-on');
    const svgOff = btn.querySelector('.svg-off');

    // 切换静音状态
    audio.muted = !audio.muted;
    
    // 切换图标显示
    if (audio.muted) {
        svgOn.classList.add('hidden');
        svgOff.classList.remove('hidden');
    } else {
        svgOn.classList.remove('hidden');
        svgOff.classList.add('hidden');
    }
}

// 🌟 显示/隐藏三个点的菜单
function toggleMenu(btn) {
    const menu = btn.nextElementSibling;
    // 如果页面上有好几段录音，点开这个菜单时，自动关掉其他打开的菜单
    document.querySelectorAll('.voice-menu').forEach(m => {
        if (m !== menu) m.classList.add('hidden');
    });
    // 切换当前菜单的显示/隐藏状态
    menu.classList.toggle('hidden');
}

// 🌟 下载音频引擎 (召唤原生分享/保存弹窗版)
async function downloadAudio(btn) {
    const container = btn.closest('.voice-container');
    const audio = container.querySelector('.voice-player');
    const menu = btn.closest('.voice-menu');

    menu.classList.add('hidden');

    // 🌟 获取我们之前存好的“录制时间”
    const recordedTime = container.getAttribute('data-recorded-at') || '未知时间';
    const fileName = `回响APP_语音_${Date.now()}.webm`;

    try {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const Filesystem = Capacitor.Plugins.Filesystem;
            const Share = Capacitor.Plugins.Share;

            const base64Data = audio.src.split(',')[1];
            await Filesystem.writeFile({
                path: fileName,
                data: base64Data,
                directory: 'CACHE'
            });

            const uriResult = await Filesystem.getUri({
                path: fileName,
                directory: 'CACHE'
            });

            // 🌟 4. 召唤分享面板，带上精准的时间描述
            await Share.share({
                title: '回响语音分享',
                text: `这是我在【回响】录制的一段珍贵语音，时间是${recordedTime}。`,
                url: uriResult.uri,
                dialogTitle: '保存或分享语音'
            });

        } else {
            // 电脑端逻辑
            const a = document.createElement('a');
            a.href = audio.src;
            a.download = fileName;
            a.click();
        }
    } catch (error) {
        console.error(error);
        alert("❌ 操作失败: " + error.message);
    }
}
render();

// 🌟 全局点击监听：点页面任何空白处，关闭所有弹出的下载菜单
document.addEventListener('click', function(event) {
    // 判断当前点击的东西，是不是那个“三个点”按钮，或者它里面的图标
    const isClickOnMenuBtn = event.target.closest('button[onclick="toggleMenu(this)"]');
    
    // 如果点的【不是】菜单按钮，就把所有打开的菜单关掉
    if (!isClickOnMenuBtn) {
        document.querySelectorAll('.voice-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
    }
});