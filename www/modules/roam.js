// roam.js - 专门负责“时光漫游”模块的逻辑 (V5.1 完整修复版，包含长按回信与正确布局)

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
    if (typeof closeSidebar === 'function') closeSidebar(); 
    roamEntries = [];
    
    // 收集所有手账
    for(let y in window.db) {
        for(let m in window.db[y]) {
            window.db[y][m].forEach(entry => {
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
    if (typeof historyStack !== 'undefined') historyStack.push({...state}); 
    state.level = 'roam';
    if (typeof renderRoamView === 'function') renderRoamView(); 
}

function goToDayFromRoam(y, m, d) {
    state.year = String(y);
    state.month = String(m);
    state.day = Number(d);
    state.level = 'day';
    if (typeof render === 'function') render(); 
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
    const offsetPercent = -currentRoamIndex * 100;
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
    
}

// 🌟 核心渲染引擎
function renderRoamView() {
    const app = document.getElementById('app');
    
    if (roamEntries.length === 0) {
        app.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full bg-stone-100 p-6 text-center relative">
                <button onclick="goBack('home')" class="absolute top-6 left-6 text-stone-500 font-bold flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm">
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
                <!-- 注入长按回信属性，保留双击跳转 -->
                <div class="w-[90%] h-[80%] max-h-[75vh] shadow-[0_10px_40px_rgba(0,0,0,0.08)] rounded-3xl overflow-hidden cursor-pointer flex flex-col bg-white"
                     ontouchstart="startLongPress('${entry.id}')" 
                     ontouchend="cancelLongPress()" 
                     ontouchmove="cancelLongPress()" 
                     oncontextmenu="event.preventDefault(); openReplyModal('${entry.id}');"
                     ondblclick="goToDayFromRoam('${entry.year}', '${entry.month}', ${entry.day})">
                    
                    <div class="read-only-mode ${bgClass} p-6 sm:p-10 border-b border-stone-50 flex-1 overflow-y-auto">
                        ${entry.html}
                    </div>
                    
                    <div class="bg-white p-5 flex justify-between items-center text-xs text-stone-400 flex-shrink-0 pointer-events-none">
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
            
            <!-- 修复布局：pointer-events-none 让空白处可以滑动，pointer-events-auto 让按钮可以点击 -->
            <div class="flex items-center justify-between p-5 absolute top-0 w-full z-20 pointer-events-none">
                <button onclick="goBack('home')" class="pointer-events-auto font-bold flex items-center gap-1 text-stone-400 hover:text-stone-800 transition-colors text-sm bg-white/80 px-4 py-2 rounded-full shadow-sm backdrop-blur">
                    <span>←</span> 结束
                </button>

                <button onclick="goToRepliedList()" class="pointer-events-auto bg-white/80 p-2.5 rounded-full shadow-sm border border-stone-100 hover:text-rose-500 text-stone-500 transition-colors active:scale-95 backdrop-blur" title="时光信箱">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"></path></svg>
                </button>
            </div>

            <div id="roamTrack" class="flex h-full w-full will-change-transform" style="transform: translateX(-${currentRoamIndex * 100}%);">
                ${trackHtml}
            </div>
        </div>
    `;
}