// 🌟 回响 APP V2.3.0 数据中枢 (含长文本排版引擎)
let db = {};
let state = { level: 'home', year: null, month: null, day: null, editingId: null };
// 🌟 注入文章模式状态
let editorMeta = { date: '', location: '', weather: '', wordCount: 0, isArticleMode: false, hasPromptedArticle: false };
let historyStack = [];
let mediaRecorder = null;
let audioChunks = [];
let recordTimer = null;
let recordSeconds = 0;
let isRecordingCancelled = false;
let amap = null;
let amapMarker = null;
let tempSelectedLoc = '';

async function saveToLocal() {
    try {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const Filesystem = Capacitor.Plugins.Filesystem;
            try {
                await Filesystem.mkdir({ path: 'EchoAppData', directory: 'DATA', recursive: true });
            } catch (ignoreErr) {}
            await Filesystem.writeFile({
                path: 'EchoAppData/database.json',
                data: JSON.stringify(db),
                directory: 'DATA',
                encoding: 'utf8'
            });
        } else {
            localStorage.setItem('WangShiShuJia_DB', JSON.stringify(db));
        }
    } catch (e) {
        console.error("保存失败", e);
        alert("⚠️ 数据库写入失败！\n真实原因: " + e.message);
    }
}

async function saveMediaToDisk(base64Data, type) {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) {
        return base64Data; 
    }
    const Filesystem = Capacitor.Plugins.Filesystem;
    const timestamp = Date.now();
    let folder = '';
    let ext = '';

    if (type === 'image') { folder = 'Images'; ext = 'jpg'; } 
    else if (type === 'video') { folder = 'Videos'; ext = 'mp4'; } 
    else if (type === 'voice') { folder = 'Audios'; ext = 'webm'; }

    const fileName = `${folder.substring(0, 3).toLowerCase()}_${timestamp}.${ext}`;
    const path = `EchoAppData/${folder}/${fileName}`;
    const base64Content = base64Data.split(',')[1];

    try {
        const result = await Filesystem.writeFile({
            path: path,
            data: base64Content,
            directory: 'DATA'
        });
        return Capacitor.convertFileSrc(result.uri);
    } catch (e) {
        console.error("文件落盘失败，已降级回 Base64", e);
        return base64Data; 
    }
}

async function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        return alert("⚠️ 你的设备环境不支持录音功能。");
    }

    let stream;
    try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (retryErr) {
            return alert("⚠️ 录音权限被拒绝或被系统占用。\n错误代码: " + retryErr.name);
        }
    }

    try {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        
        mediaRecorder.onstop = () => {
            const reader = new FileReader();
            const finalDuration = recordSeconds;
            const now = new Date();
            const recordTime = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日${now.getHours()}点${String(now.getMinutes()).padStart(2, '0')}分`;
            
            reader.onload = async function(e) {
                if (!isRecordingCancelled) {
                    const localUrl = await saveMediaToDisk(e.target.result, 'voice');
                    document.getElementById('journal-canvas').insertAdjacentHTML('beforeend', createBlockHTML('voice', localUrl, finalDuration, recordTime));
                }
                isRecordingCancelled = false; 
            };
            reader.readAsDataURL(new Blob(audioChunks, { type: 'audio/webm' }));
            stream.getTracks().forEach(track => track.stop());
        };

        document.getElementById('recordingModal').classList.remove('hidden'); 
        recordSeconds = 0; 
        document.getElementById('recordTimeDisplay').innerText = "00:00";
        mediaRecorder.start(); 
        
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

function cancelRecording() {
    isRecordingCancelled = true; 
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop(); 
        clearInterval(recordTimer);
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

function simplifyAddress(components) {
    let city = components.city && typeof components.city === 'string' ? components.city : components.province;
    let district = components.district || components.township || "";
    city = city.replace(/省|市/g, '');
    district = district.replace(/区|街道|镇|乡/g, '');
    return city + district;
}

async function getLocationFromDevice() {
    const title = document.getElementById('locationModalTitle');
    const oldTitle = title.innerText;
    title.innerText = "卫星连接中...";

    let isResolved = false;
    const timeoutSafeLock = setTimeout(() => {
        if (!isResolved) {
            isResolved = true;
            title.innerText = oldTitle;
            closeLocationModal();
            alert("⚠️ 定位超时（请检查网络或是否开启了手机GPS服务）");
        }
    }, 10000);

    try {
        let lat, lon;

        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const Geolocation = Capacitor.Plugins.Geolocation;
            const permission = await Geolocation.requestPermissions();
            if (permission.location !== 'granted') {
                clearTimeout(timeoutSafeLock); isResolved = true;
                title.innerText = oldTitle;
                return alert("⚠️ 你拒绝了定位权限，无法获取位置。");
            }

            let position;
            try {
                position = await Geolocation.getCurrentPosition({
                    enableHighAccuracy: true,
                    timeout: 4000,
                    maximumAge: 30000 
                });
            } catch (highAccErr) {
                console.log("高精度获取失败，降级为基站/Wi-Fi粗略定位...");
                position = await Geolocation.getCurrentPosition({
                    enableHighAccuracy: false, 
                    timeout: 5000,
                    maximumAge: 300000 
                });
            }
            lat = position.coords.latitude;
            lon = position.coords.longitude;
        } else {
            await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    pos => { lat = pos.coords.latitude; lon = pos.coords.longitude; resolve(); },
                    err => reject(err),
                    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
                );
            });
        }

        if (typeof AMap !== 'undefined') {
            AMap.plugin('AMap.Geocoder', function() {
                var geocoder = new AMap.Geocoder({ city: "010" });
                geocoder.getAddress([lon, lat], function(status, result) {
                if (status === 'complete' && result.regeocode) {
                    editorMeta.location = simplifyAddress(result.regeocode.addressComponent);
                } else {
                    editorMeta.location = `东经${lon.toFixed(2)} 北纬${lat.toFixed(2)}`;
                }
                finalizeLocation(oldTitle);
            });
            });
        } else {
            if (isResolved) return;
            clearTimeout(timeoutSafeLock); isResolved = true;
            editorMeta.location = `东经${lon.toFixed(2)} 北纬${lat.toFixed(2)}`;
            title.innerText = oldTitle;
            closeLocationModal();
            render();
        }

    } catch (error) {
        if (isResolved) return;
        clearTimeout(timeoutSafeLock); isResolved = true;
        console.error(error);
        alert("⚠️ 定位失败: " + error.message);
        title.innerText = oldTitle;
    }
}

function finalizeLocation(oldTitle) {
    document.getElementById('locationModalTitle').innerText = oldTitle;
    closeLocationModal();
    render();
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

function goToSettings() {
    closeSidebar();
    historyStack.push({...state});
    state.level = 'settings';
    render();
}

// 🌟 核心渲染引擎
function render() {
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
        let dayEntries = (db[state.year][state.month]||[]).filter(e => e.day === state.day);
        if(dayEntries.length === 0) return goBack('month');

        dayEntries.sort((a, b) => b.timeStr.localeCompare(a.timeStr));

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
                    <button onclick="exportToPDF()" class="flex items-center gap-2 text-sm bg-cyan-600 text-white px-3 py-2 rounded-full shadow-md hover:bg-cyan-500 font-bold tracking-wider">
                        <span></span> 导出PDF
                    </button>
                </div>
                <h1 class="hidden print:block text-3xl font-serif font-bold text-center mb-10 border-b-2 border-stone-800 pb-4 mx-4 mt-8">${state.year}年 ${state.month}月${state.day}日 手账归档</h1>
                <div class="px-2 sm:px-0">${entriesHtml}</div>
            </div>
            ${renderAddButton()}
        `;
    }
    // 🌟 核心：注入长文本文章排版的 Editor 界面
    else if (state.level === 'editor') {
        app.innerHTML = `
            <div class="flex flex-col h-full journal-bg relative">
                
                <div id="articlePrompt" class="hidden absolute top-16 left-1/2 -translate-x-1/2 bg-cyan-600/95 backdrop-blur text-white px-5 py-2.5 rounded-full shadow-lg z-50 text-xs font-bold flex items-center gap-3 animate-bounce">
                    <span>字数超66啦，要切成排版更好的文章模式吗？</span>
                    <button onclick="toggleArticleMode()" class="bg-white text-cyan-600 px-3 py-1.5 rounded-full shadow-sm active:scale-95 transition-transform">切换</button>
                    <button onclick="document.getElementById('articlePrompt').classList.add('hidden')" class="text-cyan-200 ml-1 text-base">✕</button>
                </div>

                <div class="flex justify-between items-center p-4 bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-20 no-print">
                    <button onclick="cancelEdit()" class="text-stone-400 font-bold hover:text-stone-600">取消</button>
                    <span class="font-serif font-bold text-stone-700 text-sm tracking-widest">${state.editingId ? '修改手账' : '新的一页'}</span>
                    <button onclick="saveJournal()" class="bg-cyan-600 text-white px-6 py-1.5 rounded-full text-sm font-bold shadow-md hover:bg-cyan-500 active:scale-95 transition-transform">保存</button>
                </div>

                <div id="journal-canvas" class="flex-1 p-6 pb-40 overflow-y-auto space-y-2" onkeyup="calculateWordCount()"></div>

                <div class="absolute bottom-[68px] left-0 w-full bg-white/95 backdrop-blur-sm border-t border-stone-200 p-2.5 flex justify-between items-center text-[11px] text-stone-500 z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.02)] no-print">
                    <div class="relative flex items-center justify-center gap-1 cursor-pointer hover:text-cyan-600 transition-colors w-1/4">
                        <span>🕒</span>
                        <span class="text-stone-400 truncate">时间</span>
                        <input type="datetime-local" id="entryDate" value="${editorMeta.date}" onchange="updateMetaDate(this.value)" class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10">
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
                    <div class="flex items-center justify-center w-1/4 px-1 font-bold text-stone-400 cursor-pointer hover:text-cyan-600 transition-colors" onclick="toggleArticleMode()">
                        <span id="wordCountDisplay">字数：${editorMeta.wordCount}</span>
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
            
            // 动态重组输入框样式
            const taStyle = editorMeta.isArticleMode ? 'text-sm indent-8 leading-loose' : 'text-base leading-relaxed';
            canvas.querySelectorAll('p').forEach(p => {
                const ta = document.createElement('textarea');
                ta.className = `w-full bg-transparent border-none resize-none text-stone-700 ${taStyle} placeholder-stone-400`;
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
                    <p class="text-xs text-stone-400 mb-6 bg-stone-100 px-3 py-1 rounded-full">当前版本：v2.4.1 </p>
                    
                    <div class="w-full border-t border-stone-100 my-4"></div>
                    
                    <div class="w-full flex justify-between items-center py-3">
                        <span class="text-stone-500 font-medium">更新日期</span>
                        <span class="text-stone-400 text-sm font-mono">2026年4月26日</span>
                    </div>
                    <div class="w-full flex justify-between items-center py-3">
                        <span class="text-stone-500 font-medium">核心开发者</span>
                        <span class="text-stone-400 text-sm">TDYSN</span>
                    </div>
                    <div class="w-full flex justify-between items-center py-3">
                        <span class="text-stone-500 font-medium">数据存储</span>
                        <span class="text-stone-400 text-sm">Echoappdata文件</span>
                    </div>
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
    if (display) {
        display.innerHTML = `字数：${totalWords} <span class="ml-1 text-[9px] ${editorMeta.isArticleMode ? 'bg-cyan-100 text-cyan-600' : 'bg-stone-100 text-stone-500'} px-1.5 py-0.5 rounded border border-stone-200/50">${editorMeta.isArticleMode ? '文章' : '短篇'}</span>`;
    }

    if (totalWords >= 66 && !editorMeta.isArticleMode && !editorMeta.hasPromptedArticle) {
        editorMeta.hasPromptedArticle = true;
        const prompt = document.getElementById('articlePrompt');
        if(prompt) prompt.classList.remove('hidden');
    }
}

function toggleArticleMode() {
    editorMeta.isArticleMode = !editorMeta.isArticleMode;
    editorMeta.hasPromptedArticle = true; 
    
    const prompt = document.getElementById('articlePrompt');
    if(prompt) prompt.classList.add('hidden');

    const canvas = document.getElementById('journal-canvas');
    if(canvas) {
        canvas.querySelectorAll('textarea').forEach(ta => {
            if (editorMeta.isArticleMode) {
                ta.classList.remove('text-base', 'leading-relaxed');
                ta.classList.add('text-sm', 'indent-8', 'leading-loose');
            } else {
                ta.classList.remove('text-sm', 'indent-8', 'leading-loose');
                ta.classList.add('text-base', 'leading-relaxed');
            }
            ta.style.height = ''; ta.style.height = ta.scrollHeight + 'px';
        });
    }
    calculateWordCount(); 
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
    editorMeta = { date: formatDateTimeLocal(new Date()), location: '', weather: '', wordCount: 0, isArticleMode: false, hasPromptedArticle: false };
    historyStack.push({...state}); state.level = 'editor'; state.editingId = null; render(); 
}

function cancelEdit() { state = historyStack.pop() || { level: 'home', year: null, month: null, day: null }; render(); }
function goBack(target) { if (target) state.level = target; render(); }

// 🌟 黑科技：长文本回车自动切段
function saveJournal() {
    const canvas = document.getElementById('journal-canvas');
    if (!editorMeta.date) return alert("请输入确切的时间！");
    calculateWordCount();

    canvas.querySelectorAll('textarea').forEach(ta => {
        const isArticle = editorMeta.isArticleMode;
        const pStyle = isArticle ? 'text-sm indent-8 leading-loose mb-1' : 'text-base leading-relaxed';
        
        if (isArticle) {
            const lines = ta.value.split('\n');
            const fragment = document.createDocumentFragment();
            lines.forEach(line => {
                const p = document.createElement('p');
                p.className = `text-stone-700 ${pStyle} whitespace-pre-wrap outline-none`;
                p.innerText = line;
                if(line.trim() === '') p.innerHTML = '<br>'; 
                fragment.appendChild(p);
            });
            ta.parentNode.replaceChild(fragment, ta);
        } else {
            const p = document.createElement('p');
            p.className = `text-stone-700 ${pStyle} whitespace-pre-wrap outline-none`;
            p.innerText = ta.value;
            ta.parentNode.replaceChild(p, ta);
        }
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
        wordCount: editorMeta.wordCount, 
        isArticleMode: editorMeta.isArticleMode, 
        html: htmlContent
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
        wordCount: entry.wordCount || 0,
        isArticleMode: entry.isArticleMode || false, 
        hasPromptedArticle: true 
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

// 🌟 完整的块生成引擎，绝无删减！
function createBlockHTML(type, url = '', duration = 0, timestamp = '') {
    let inner = '';
    const textStyle = editorMeta.isArticleMode ? 'text-sm indent-8 leading-loose' : 'text-base leading-relaxed';
    
    if (type === 'text') {
        inner = `<textarea class="w-full bg-transparent border-none resize-none text-stone-700 ${textStyle} placeholder-stone-400" rows="2" placeholder="记录此刻..." oninput="this.style.height='';this.style.height=this.scrollHeight+'px';calculateWordCount();"></textarea>`;
    } else if (type === 'image') {
        inner = `<img src="${url}" class="max-w-full rounded-lg shadow-sm border border-stone-200 mt-2">`;
    } else if (type === 'video') {
        inner = `<div class="py-2"><video controls class="w-full rounded-lg shadow-sm border border-stone-200 mt-2" src="${url}"></video></div>`;
    } else if (type === 'voice') {
        const pad = n => String(Math.floor(n)).padStart(2, '0');
        const timeStr = duration > 0 ? `0:${pad(duration)}` : '0:00';
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

            <div class="flex items-center gap-0.5 ml-1">
                <button onclick="toggleMute(this)" class="flex-shrink-0 active:scale-90 transition-transform">
                    <svg class="svg-on w-4 h-4 text-cyan-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM18.584 5.106a.75.75 0 011.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 11-1.06-1.06 8.25 8.25 0 000-11.668.75.75 0 010-1.06z" />
                        <path d="M15.932 7.757a.75.75 0 011.061 0 4.5 4.5 0 010 6.364.75.75 0 01-1.06-1.06 3 3 0 000-4.243.75.75 0 010-1.061z" />
                    </svg>
                    <svg class="svg-off w-4 h-4 text-cyan-400 hidden" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 001.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06zM17.78 9.22a.75.75 0 10-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 101.06 1.06l1.72-1.72 1.72 1.72a.75.75 0 101.06-1.06L20.56 12l1.72-1.72a.75.75 0 10-1.06-1.06l-1.72 1.72-1.72-1.72z" />
                    </svg>
                </button>
                
                <div class="relative flex items-center">
                    <button onclick="toggleMenu(this)" class="flex-shrink-0 active:scale-90 transition-transform">
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
        reader.onload = async function(e) {
            const localUrl = await saveMediaToDisk(e.target.result, type);
            canvas.insertAdjacentHTML('beforeend', createBlockHTML(type, localUrl));
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
        svgPlay.classList.add('hidden');
        svgPause.classList.remove('hidden');
    } else {
        audio.pause();
        svgPlay.classList.remove('hidden');
        svgPause.classList.add('hidden');
    }
}

function updateVoiceProgress(audio) {
    const container = audio.closest('.voice-container');
    const timeDisplay = container.querySelector('.time-display');
    const progressBar = container.querySelector('.progress-bar');
    
    const currentSeconds = Math.floor(audio.currentTime);
    const totalSeconds = parseFloat(container.getAttribute('data-duration')) || (audio.duration || 1);
    const percent = (audio.currentTime / totalSeconds) * 100;
    
    progressBar.style.width = `${percent}%`;
    const pad = n => String(n).padStart(2, '0');
    timeDisplay.innerText = `0:${pad(currentSeconds)}`;
}

function resetVoiceProgress(audio) {
    const container = audio.closest('.voice-container');
    const svgPlay = container.querySelector('.svg-play');
    const svgPause = container.querySelector('.svg-pause');
    const timeDisplay = container.querySelector('.time-display');
    const progressBar = container.querySelector('.progress-bar');
    const duration = container.getAttribute('data-duration');
    
    audio.currentTime = 0; 
    progressBar.style.width = '0%'; 
    
    if(svgPlay && svgPause) {
        svgPlay.classList.remove('hidden');
        svgPause.classList.add('hidden');
    }
    
    const pad = n => String(n).padStart(2, '0');
    timeDisplay.innerText = duration > 0 ? `0:${pad(duration)}` : '0:00';
}

function toggleMute(btn) {
    const container = btn.closest('.voice-container');
    const audio = container.querySelector('.voice-player');
    const svgOn = btn.querySelector('.svg-on');
    const svgOff = btn.querySelector('.svg-off');

    audio.muted = !audio.muted;
    
    if (audio.muted) {
        svgOn.classList.add('hidden');
        svgOff.classList.remove('hidden');
    } else {
        svgOn.classList.remove('hidden');
        svgOff.classList.add('hidden');
    }
}

function toggleMenu(btn) {
    const menu = btn.nextElementSibling;
    document.querySelectorAll('.voice-menu').forEach(m => {
        if (m !== menu) m.classList.add('hidden');
    });
    menu.classList.toggle('hidden');
}

function closeMapPicker() {
    document.getElementById('mapPickerModal').classList.add('hidden');
}

function openMapPicker() {
    closeLocationModal(); 
    const modal = document.getElementById('mapPickerModal');
    modal.classList.remove('hidden');
    
    if (!amap) {
        setTimeout(() => {
            amap = new AMap.Map('mapContainer', { zoom: 16 });
            
            AMap.plugin('AMap.Geolocation', function() {
                var geolocation = new AMap.Geolocation({
                    enableHighAccuracy: true, 
                    timeout: 10000,           
                    buttonPosition: 'RB',     
                    zoomToAccuracy: true      
                });
                amap.addControl(geolocation);
                
                document.getElementById('selectedAddrInfo').innerText = "正在获取您的当前位置...";
                
                geolocation.getCurrentPosition(function(status, result) {
                    if (status === 'complete') {
                        const lnglat = result.position;
                        if (!amapMarker) {
                            amapMarker = new AMap.Marker({ position: lnglat });
                            amap.add(amapMarker);
                        } else {
                            amapMarker.setPosition(lnglat);
                        }
                        AMap.plugin('AMap.Geocoder', function() {
                            new AMap.Geocoder().getAddress(lnglat, function(status, result) {
                                if (status === 'complete' && result.regeocode) {
                                    tempSelectedLoc = simplifyAddress(result.regeocode.addressComponent);
                                    document.getElementById('selectedAddrInfo').innerText = `已选：${tempSelectedLoc}`;
                                }
                            });
                        });
                    } else {
                        document.getElementById('selectedAddrInfo').innerText = "自动定位失败，请手动滑动地图选择";
                    }
                });
            });

            amap.on('click', function(e) {
                const lnglat = e.lnglat;
                if (!amapMarker) {
                    amapMarker = new AMap.Marker({ position: lnglat });
                    amap.add(amapMarker);
                } else {
                    amapMarker.setPosition(lnglat);
                }

                document.getElementById('selectedAddrInfo').innerText = "正在解析地址...";
                AMap.plugin('AMap.Geocoder', function() {
                    new AMap.Geocoder().getAddress(lnglat, function(status, result) {
                        if (status === 'complete' && result.regeocode) {
                            tempSelectedLoc = simplifyAddress(result.regeocode.addressComponent);
                            document.getElementById('selectedAddrInfo').innerText = `已选：${tempSelectedLoc}`;
                        } else {
                            document.getElementById('selectedAddrInfo').innerText = "地址解析失败";
                        }
                    });
                });
            });
        }, 100);
    }
}

document.getElementById('confirmMapLoc').onclick = function() {
    if (tempSelectedLoc) {
        editorMeta.location = tempSelectedLoc;
        closeMapPicker();
        render(); 
    } else {
        alert("请先在地图上点一个位置哦");
    }
};

async function downloadAudio(btn) {
    const container = btn.closest('.voice-container');
    const audio = container.querySelector('.voice-player');
    const menu = btn.closest('.voice-menu');

    menu.classList.add('hidden');

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

            await Share.share({
                title: '回响语音分享',
                text: `这是我在【回响】录制的一段珍贵语音，时间是${recordedTime}。`,
                url: uriResult.uri,
                dialogTitle: '保存或分享语音'
            });

        } else {
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

async function initFileSystem() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const Filesystem = Capacitor.Plugins.Filesystem;
        const dirs = ['EchoAppData', 'EchoAppData/Images', 'EchoAppData/Videos', 'EchoAppData/Audios'];

        await Promise.all(dirs.map(async (dir) => {
            try {
                await Filesystem.stat({ path: dir, directory: 'DATA' });
            } catch (e) {
                try { await Filesystem.mkdir({ path: dir, directory: 'DATA', recursive: true }); } 
                catch (err) {}
            }
        }));

        try {
            const result = await Filesystem.readFile({ path: 'EchoAppData/database.json', directory: 'DATA', encoding: 'utf8' });
            db = JSON.parse(result.data);
        } catch (e) {
            let oldData = localStorage.getItem('WangShiShuJia_DB');
            db = oldData ? JSON.parse(oldData) : {};
            await saveToLocal(); 
            alert("欢迎来到，时间的回响");
        }

    } else {
        let oldData = localStorage.getItem('WangShiShuJia_DB');
        db = oldData ? JSON.parse(oldData) : {};
    }
    
    render();
}

initFileSystem();

async function initHardwareBackButton() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const App = Capacitor.Plugins.App;
        
        App.addListener('backButton', () => {
            if (state.level === 'home') {
                App.exitApp(); 
            } else if (state.level === 'editor') {
                cancelEdit(); 
            } else if (['year', 'gallery', 'roam', 'map', 'settings'].includes(state.level)) {
                goBack('home'); 
            } else if (state.level === 'month') {
                goBack('year');
            } else if (state.level === 'day') {
                goBack('month');
            } else if (state.level === 'locationDetails') {
                state.level = 'map'; 
                renderMapView();
            }
        });
    }
}

initHardwareBackButton();

document.addEventListener('click', function(event) {
    const isClickOnMenuBtn = event.target.closest('button[onclick="toggleMenu(this)"]');
    if (!isClickOnMenuBtn) {
        document.querySelectorAll('.voice-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
    }
});