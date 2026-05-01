// roam.js - 专门负责“时光漫游”模块的逻辑 (V5.0 轨道对齐修正版)

document.getElementById('btnRoam').onclick = goToRoam;

let roamEntries = []; 
let currentRoamIndex = 0;

// 🌟 手势与轨道物理动画核心变量
let isDragging = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;
let trackElement = null;
let isVerticalScroll = false;
let isHorizontalSwipe = false;

function goToRoam() {
    closeSidebar(); 
    roamEntries = [];
    
    // 收集所有手账
    for(let y in db) {
        for(let m in db[y]) {
            db[y][m].forEach(entry => {
                roamEntries.push({ ...entry, year: y, month: m });
            });
        }
    }
    
    // 随机打乱算法（洗牌）
    for (let i = roamEntries.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [roamEntries[i], roamEntries[j]] = [roamEntries[j], roamEntries[i]];
    }
    
    currentRoamIndex = 0;
    historyStack.push({...state}); 
    state.level = 'roam';
    renderRoamView(); 
}

function goToDayFromRoam(y, m, d) {
    state.year = String(y);
    state.month = String(m);
    state.day = Number(d);
    state.level = 'day';
    render(); 
}

// 🌟 1. 手指按下：关闭动画，准备跟手
function handleTouchStart(e) {
    trackElement = document.getElementById('roamTrack');
    if (!trackElement) return;

    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = startX;
    currentY = startY;
    isDragging = true;
    isVerticalScroll = false;
    isHorizontalSwipe = false;

    // 关掉过渡动画，让卡片零延迟死死贴住手指
    trackElement.style.transition = 'none'; 
}

// 🌟 2. 手指移动：计算偏移量，实现实时物理拖拽
function handleTouchMove(e) {
    if (!isDragging || !trackElement) return;

    currentX = e.touches[0].clientX;
    currentY = e.touches[0].clientY;
    let deltaX = currentX - startX;
    let deltaY = currentY - startY;

    // 智能防误触：判断是在上下看日记，还是左右切卡片
    if (!isHorizontalSwipe && !isVerticalScroll) {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            isVerticalScroll = true; 
            return; 
        } else if (Math.abs(deltaX) > 10) {
            isHorizontalSwipe = true; 
        }
    }

    if (isVerticalScroll) return; 

    // 边缘阻尼效果
    if ((currentRoamIndex === 0 && deltaX > 0) || (currentRoamIndex === roamEntries.length - 1 && deltaX < 0)) {
        deltaX = deltaX * 0.3; 
    }

    // 🌟 核心修正：基于 100% 宽度的平移计算
    // 计算当前轨道应该在的位置 (百分比)
    const offsetPercent = -currentRoamIndex * 100;
    // 计算手指移动的像素转换成容器宽度的百分比
    const movePercent = (deltaX / trackElement.offsetWidth) * 100;
    
    trackElement.style.transform = `translateX(${offsetPercent + movePercent}%)`;
}

// 🌟 3. 手指松开：执行自动对齐吸附
function handleTouchEnd(e) {
    if (!isDragging || !trackElement) return;
    isDragging = false;

    if (isVerticalScroll) return;

    let deltaX = currentX - startX;
    let threshold = 60; // 滑动超过 60 像素判定为切页

    if (deltaX > threshold && currentRoamIndex > 0) {
        currentRoamIndex--; 
    } else if (deltaX < -threshold && currentRoamIndex < roamEntries.length - 1) {
        currentRoamIndex++; 
    }

    // 打开丝滑的物理阻尼过渡动画，自动吸附对齐到 100% 的整数倍
    trackElement.style.transition = 'transform 0.4s cubic-bezier(0.18, 0.89, 0.32, 1.05)';
    trackElement.style.transform = `translateX(-${currentRoamIndex * 100}%)`;
    
    const counter = document.getElementById('roamCounter');
    if (counter) counter.innerText = `🧭 漫游 (${currentRoamIndex + 1}/${roamEntries.length})`;
}

// 🌟 核心渲染引擎
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

    let trackHtml = roamEntries.map((entry, index) => {
        const hasMedia = entry.html.includes('<img') || entry.html.includes('<video') || entry.html.includes('<audio');
        const bgClass = hasMedia ? 'journal-bg' : 'bg-[#faf9f6]';
        
        return `
            <div class="flex-shrink-0 w-full h-full flex items-center justify-center">
                <div class="w-[90%] h-[80%] max-h-[75vh] shadow-[0_10px_40px_rgba(0,0,0,0.08)] rounded-3xl overflow-hidden cursor-pointer flex flex-col bg-white"
                     ondblclick="goToDayFromRoam('${entry.year}', '${entry.month}', ${entry.day})">
                    
                    <div class="read-only-mode ${bgClass} p-6 sm:p-10 border-b border-stone-50 flex-1 overflow-y-auto">
                        ${entry.html}
                    </div>
                    
                    <div class="bg-white p-5 flex justify-between items-center text-xs text-stone-400 flex-shrink-0">
                        <div class="flex items-center gap-2 font-mono font-bold text-stone-500">
                            <span class="text-lg">🕒</span> <span>${entry.fullDateStr || entry.timeStr}</span>
                        </div>
                        <div class="flex items-center gap-1 font-medium">
                            <span class="text-base">📍</span> <span class="truncate max-w-[120px]">${entry.location || '无'}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    app.innerHTML = `
        <div class="h-full flex flex-col bg-stone-100 relative overflow-hidden"
             ontouchstart="handleTouchStart(event)" 
             ontouchmove="handleTouchMove(event)"
             ontouchend="handleTouchEnd(event)">
            
            <div class="flex items-center justify-between p-5 absolute top-0 w-full z-20">
                <button onclick="goBack('home')" class="font-bold flex items-center gap-1 text-stone-400 hover:text-stone-800 transition-colors text-sm">
                    <span>←</span> 结束
                </button>
                <div id="roamCounter" class="text-xs font-bold tracking-widest text-stone-300">🧭 漫游 (1/${roamEntries.length})</div>
            </div>

            <div id="roamTrack" class="flex h-full w-full will-change-transform" style="transform: translateX(-${currentRoamIndex * 100}%);">
                ${trackHtml}
            </div>
        </div>
    `;
}