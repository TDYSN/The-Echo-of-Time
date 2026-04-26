// roam.js - 专门负责“时光漫游”模块的逻辑

document.getElementById('btnRoam').onclick = goToRoam;

let roamEntries = []; 
let currentRoamIndex = 0;

function goToRoam() {
    closeSidebar(); 
    roamEntries = [];
    
    for(let y in db) {
        for(let m in db[y]) {
            db[y][m].forEach(entry => {
                roamEntries.push({ ...entry, year: y, month: m });
            });
        }
    }
    
    for (let i = roamEntries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roamEntries[i], roamEntries[j]] = [roamEntries[j], roamEntries[i]];
    }
    
    currentRoamIndex = 0;
    historyStack.push({...state}); 
    state.level = 'roam';
    renderRoamView(); 
}

function roamSwitch(direction) {
    currentRoamIndex += direction;
    renderRoamView();
}

function goToDayFromRoam(y, m, d) {
    state.year = String(y);
    state.month = String(m);
    state.day = Number(d);
    state.level = 'day';
    render(); 
}

function renderRoamView() {
    const app = document.getElementById('app');
    
    if (roamEntries.length === 0) {
        app.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full bg-stone-100 p-6 text-center relative">
                <button onclick="goBack('home')" class="absolute top-6 left-6 text-stone-500 font-bold flex items-center gap-1">
                    <span>←</span> 返回
                </button>
                <div class="text-6xl mb-4 opacity-50">🕳️</div>
                <h2 class="text-xl font-bold text-stone-600 mb-2">当前还没有记录喔</h2>
                <p class="text-sm text-stone-400">快去记录一下生活吧</p>
            </div>
        `;
        return;
    }

    const entry = roamEntries[currentRoamIndex];
    const hasMedia = entry.html.includes('<img') || entry.html.includes('<video') || entry.html.includes('<audio');
    const bgClass = hasMedia ? 'journal-bg' : 'bg-[#faf9f6]';

    // 💡 修复：背景改为和天气弹窗一样的半透明毛玻璃效果 bg-black/50 backdrop-blur-sm
    app.innerHTML = `
        <div class="h-full flex flex-col bg-black/50 backdrop-blur-sm relative overflow-hidden">
            
            <div class="flex items-center justify-between p-4 absolute top-0 w-full z-20 text-white">
                <button onclick="goBack('home')" class="font-bold flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity text-sm">
                    <span>←</span> 结束漫游
                </button>
                <div class="text-xs font-bold tracking-widest opacity-80">🧭 漫游 (${currentRoamIndex + 1}/${roamEntries.length})</div>
            </div>

            <div class="flex-1 flex items-center justify-center p-4 mt-12 overflow-y-auto">
                <div class="w-full max-w-2xl shadow-2xl rounded-3xl overflow-hidden animate-float cursor-pointer relative"
                     ondblclick="goToDayFromRoam('${entry.year}', '${entry.month}', ${entry.day})">
                    
                    <div class="read-only-mode ${bgClass} p-6 sm:p-10 border-b border-stone-200 min-h-[300px] max-h-[70vh] overflow-y-auto">
                        ${entry.html}
                    </div>
                    
                    <div class="bg-white p-4 sm:px-6 flex flex-col sm:flex-row justify-between sm:items-center text-xs text-stone-400 gap-3">
                        <div class="flex items-center gap-2 font-mono font-bold text-stone-500">
                            <span class="text-lg">🕒</span> <span>${entry.fullDateStr || entry.timeStr}</span>
                        </div>
                        <div class="flex flex-wrap gap-4 items-center font-medium">
                            <div class="flex items-center gap-1"><span class="text-base">📍</span> <span class="truncate max-w-[150px]">${entry.location || '无'}</span></div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="absolute bottom-10 w-full flex justify-center gap-12 z-20">
                <button onclick="roamSwitch(-1)" class="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl hover:bg-white/30 transition-all active:scale-90 ${currentRoamIndex === 0 ? 'opacity-30 pointer-events-none' : ''}">←</button>
                <button onclick="roamSwitch(1)" class="w-14 h-14 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-2xl hover:bg-white/30 transition-all active:scale-90 ${currentRoamIndex === roamEntries.length - 1 ? 'opacity-30 pointer-events-none' : ''}">→</button>
            </div>
            
        </div>
    `;
}