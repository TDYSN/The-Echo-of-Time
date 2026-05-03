// roam.js - V5.4 极简留白版 (左对齐大字时间 + 极简导航 + 动态地貌)

document.getElementById('btnRoam').onclick = goToRoam;

let roamEntries = []; 
let currentRoamIndex = 0;

// 手势滑动核心变量
let isDragging = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;
let trackElement = null;
let isVerticalScroll = false;
let isHorizontalSwipe = false;

// 🌟 时间转化引擎 (精确呈现几天前、几个月前、几年前)
function getRelativeTime(dateStr) {
    const safeStr = (dateStr || '').replace(/年|月/g, '-').replace(/日/g, '').replace(/-/g, '/');
    const entryDate = new Date(safeStr);
    if (isNaN(entryDate.getTime())) return "过去"; // 兜底
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    entryDate.setHours(0, 0, 0, 0);

    let diff = now - entryDate;
    let days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return "今天";
    if (days < 30) return `${days} 天前`;
    
    let months = (now.getFullYear() - entryDate.getFullYear()) * 12 + now.getMonth() - entryDate.getMonth();
    if (months < 12) return `${months} 个月前`;
    
    let years = Math.floor(months / 12);
    return `${years} 年前`;
}

function goToRoam() {
    if (typeof closeSidebar === 'function') closeSidebar(); 
    roamEntries = [];
    
    for(let y in window.db) {
        for(let m in window.db[y]) {
            window.db[y][m].forEach(entry => {
                roamEntries.push({ ...entry, year: y, month: m });
            });
        }
    }
    
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

function handleTouchStart(e) {
    trackElement = document.getElementById('roamTrack');
    if (!trackElement) return;
    startX = e.touches[0].clientX; startY = e.touches[0].clientY;
    currentX = startX; currentY = startY;
    isDragging = true; isVerticalScroll = false; isHorizontalSwipe = false;
    trackElement.style.transition = 'none'; 
}

function handleTouchMove(e) {
    if (!isDragging || !trackElement) return;
    currentX = e.touches[0].clientX; currentY = e.touches[0].clientY;
    let deltaX = currentX - startX; let deltaY = currentY - startY;

    if (!isHorizontalSwipe && !isVerticalScroll) {
        if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) {
            isVerticalScroll = true; return; 
        } else if (Math.abs(deltaX) > 10) {
            isHorizontalSwipe = true; 
        }
    }
    if (isVerticalScroll) return; 

    if ((currentRoamIndex === 0 && deltaX > 0) || (currentRoamIndex === roamEntries.length - 1 && deltaX < 0)) deltaX *= 0.3; 

    const offsetPercent = -currentRoamIndex * 100;
    const movePercent = (deltaX / trackElement.offsetWidth) * 100;
    trackElement.style.transform = `translateX(${offsetPercent + movePercent}%)`;
}

function handleTouchEnd(e) {
    if (!isDragging || !trackElement) return;
    isDragging = false;
    if (isVerticalScroll) return;

    let deltaX = currentX - startX;
    let threshold = 60; 

    if (deltaX > threshold && currentRoamIndex > 0) currentRoamIndex--; 
    else if (deltaX < -threshold && currentRoamIndex < roamEntries.length - 1) currentRoamIndex++; 

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
        const bgClass = entry.isArticleMode ? 'bg-white' : (hasMedia ? 'journal-bg' : 'bg-[#faf9f6]');
        const radiusClass = entry.isArticleMode ? 'rounded-md' : 'rounded-3xl';
        
        // 🌟 1. 动态卡片尺寸调节区 (请在这里自由修改)
        // 手账碎片的尺寸控制：宽度改成了 w-[95%] 和 max-w-lg (明显变大)，高度上限拉到了 75vh
        const journalWidthClass = "w-[95%] sm:w-[90%] max-w-lg"; 
        const journalHeightClass = "min-h-[45vh] max-h-[73vh]";
        
        // 深度文章的尺寸控制：保持不变的小巧内敛
        const articleWidthClass = "w-[90%] sm:w-[85%] max-w-md";
        const articleHeightClass = "min-h-[35vh] max-h-[62vh]";
        
        const wrapperWidth = entry.isArticleMode ? articleWidthClass : journalWidthClass;
        const cardHeight = entry.isArticleMode ? articleHeightClass : journalHeightClass;

        const relativeTimeStr = getRelativeTime(entry.fullDateStr || entry.timeStr);
        let cardContentHtml = '';

        if (entry.isArticleMode) {
            // 🌟 2. 深度文章：提取第一张图作为海报背景
            let coverImage = '';
            const imgMatch = entry.html.match(/<img[^>]+src=["']([^"']+)["']/i);
            if (imgMatch && imgMatch[1]) coverImage = imgMatch[1];

            // 提取纯文本，去除原有的 html 标签，避免图片被二次渲染在文字区
            let tempDiv = document.createElement('div');
            tempDiv.innerHTML = entry.html;
            tempDiv.querySelectorAll('img, video, audio').forEach(el => el.remove());
            
            // 使用“隐身挂载提取法”保证文字换行不丢失
            tempDiv.style.position = 'absolute';
            tempDiv.style.opacity = '0';
            document.body.appendChild(tempDiv);
            let plainText = tempDiv.innerText.trim();
            document.body.removeChild(tempDiv);

            // 解析右下角的日期格式: 2025 / 11 / 27
           const safeBottomStr = (entry.fullDateStr || entry.timeStr || '').replace(/年|月/g, '-').replace(/日/g, '').replace(/-/g, '/');
           const dDate = new Date(safeBottomStr);
           const bottomDateStr = isNaN(dDate.getTime()) ? '未知时间' : `${dDate.getFullYear()} / ${String(dDate.getMonth()+1).padStart(2, '0')} / ${String(dDate.getDate()).padStart(2, '0')}`;

            // 根据有没有封面图，智能切换字体的颜色
            let bgStyle = coverImage ? `background-image: url('${coverImage}'); background-size: cover; background-position: center;` : 'background-color: white;';
            let overlayHtml = coverImage ? `<div class="absolute inset-0 bg-black/60 pointer-events-none"></div>` : '';
            let textColor = coverImage ? 'text-white/90 drop-shadow-sm' : 'text-stone-700';
            let titleColor = coverImage ? 'text-white drop-shadow-md' : 'text-stone-800';
            let dateColor = coverImage ? 'text-white/60' : 'text-stone-300';

            let titleHtml = entry.title ? `<h3 class="text-base font-bold ${titleColor} mb-4 tracking-wide text-left relative z-10">${entry.title}</h3>` : '';

            cardContentHtml = `
                <!-- 文章专属外观 -->
                <div class="w-full h-auto ${cardHeight} shadow-[0_10px_40px_rgba(0,0,0,0.08)] ${radiusClass} overflow-hidden cursor-pointer flex flex-col transition-all duration-300 relative"
                     style="${bgStyle}"
                     ontouchstart="startLongPress('${entry.id}')" 
                     ontouchend="cancelLongPress()" 
                     ontouchmove="cancelLongPress()" 
                     oncontextmenu="event.preventDefault(); openReplyModal('${entry.id}');"
                     ondblclick="goToDayFromRoam('${entry.year}', '${entry.month}', ${entry.day})">
                    
                    ${overlayHtml}
                    
                    <div class="read-only-mode relative z-10 p-6 sm:p-8 flex-1 overflow-y-auto flex flex-col">
                        ${titleHtml}
                        <div class="${textColor} leading-relaxed text-[15px] whitespace-pre-wrap break-words text-justify flex-1 indent-[2em]">${plainText}</div>
                        
                        <!-- 🌟 右下角专属日期印记 (无定位) -->
                        <div class="mt-4 pt-4 text-right pointer-events-none relative z-10">
                            <span class="text-[12px] ${dateColor} font-mono tracking-widest">${bottomDateStr}</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // 🌟 3. 手账碎片：应用了增强尺寸，保留底部定位栏
            let titleHtml = entry.title ? `<h3 class="text-base font-bold text-stone-800 mb-3 tracking-wide text-left">《${entry.title}》</h3>` : '';
            
            cardContentHtml = `
                <div class="w-full h-auto ${cardHeight} shadow-[0_10px_40px_rgba(0,0,0,0.08)] ${radiusClass} overflow-hidden cursor-pointer flex flex-col transition-all duration-300 relative bg-white"
                     ontouchstart="startLongPress('${entry.id}')" 
                     ontouchend="cancelLongPress()" 
                     ontouchmove="cancelLongPress()" 
                     oncontextmenu="event.preventDefault(); openReplyModal('${entry.id}');"
                     ondblclick="goToDayFromRoam('${entry.year}', '${entry.month}', ${entry.day})">
                    
                    <div class="read-only-mode ${bgClass} p-6 sm:p-8 border-b border-stone-50 flex-1 overflow-y-auto">
                        ${titleHtml}
                        ${entry.html}
                    </div>
                    
                    <!-- 底部定位栏 -->
                    <div class="bg-white p-4 flex justify-between items-center text-xs text-stone-400 flex-shrink-0 pointer-events-none">
                        <div class="flex items-center gap-2 font-mono font-bold text-stone-500">
                            <span class="text-lg">🕒</span> <span>${entry.fullDateStr || entry.timeStr}</span>
                        </div>
                        <div class="flex items-center gap-1 font-medium">
                            <span class="text-base">📍</span> <span class="truncate max-w-[120px]">${entry.location || '无'}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="flex-shrink-0 w-full h-full flex flex-col items-center justify-center p-4 relative z-10 pt-20 pb-16">
                <!-- 容器宽度自动适应 -->
                <div class="${wrapperWidth} flex flex-col items-start transition-all duration-300">
                    
                    <div class="mb-4 ml-1">
                        <span class="text-[24px] font-light text-stone-600 tracking-wider">${relativeTimeStr}</span>
                    </div>

                    ${cardContentHtml}

                    <div class="mt-5 w-full text-center">
                        <p class="text-[13px] text-stone-500 font-serif tracking-[0.2em] ml-[0.2em]">来自过去的声音</p>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // 六大地貌 SVG 绘制
    const landscapeSVG = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 100" preserveAspectRatio="none" class="w-1/2 h-full fill-stone-300">
            <rect x="0" y="90" width="1200" height="10"/>
            <path d="M0,90 Q50,75 100,85 T200,80 L200,100 L0,100 Z"/>
            <path d="M190,85 Q240,55 280,75 Q330,45 400,85 L400,100 L190,100 Z"/>
            <path d="M220,90 Q270,65 320,85" fill="none" stroke="currentColor" stroke-width="1.5" class="text-stone-100"/> 
            <polygon points="380,90 430,35 480,90"/>
            <polygon points="450,90 490,20 540,90"/>
            <polygon points="510,90 560,45 610,90"/>
            <polygon points="610,90 625,60 640,90"/>
            <polygon points="630,90 645,50 660,90"/>
            <polygon points="650,90 665,65 680,90"/>
            <polygon points="670,90 690,40 710,90"/>
            <polygon points="700,90 720,55 740,90"/>
            <polygon points="730,90 750,45 770,90"/>
            <polygon points="760,90 780,60 800,90"/>
            <rect x="800" y="60" width="20" height="30"/>
            <rect x="825" y="45" width="25" height="45"/>
            <rect x="855" y="30" width="15" height="60"/>
            <rect x="875" y="55" width="30" height="35"/>
            <rect x="910" y="25" width="20" height="65"/>
            <rect x="935" y="65" width="15" height="25"/>
            <rect x="955" y="40" width="30" height="50"/>
            <path d="M990,90 Q1000,75 1010,90 Q1020,75 1030,90 Q1040,75 1050,90 Q1060,75 1070,90 Q1080,75 1090,90 Q1100,75 1110,90 Q1120,75 1130,90 Q1140,75 1150,90 Q1160,75 1170,90 Q1180,75 1190,90 Q1200,75 1200,90 L1200,100 L990,100 Z"/>
        </svg>
    `;

  app.innerHTML = `
        <style>
            @keyframes scrollLandscape {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
            }
            .animate-landscape {
                animation: scrollLandscape 80s linear infinite;
                width: 200%;
                display: flex;
            }
        </style>
        
        <div class="h-full flex flex-col bg-stone-100 relative overflow-hidden"
             ontouchstart="handleTouchStart(event)" 
             ontouchmove="handleTouchMove(event)"
             ontouchend="handleTouchEnd(event)">
            
            <div class="absolute bottom-0 left-0 w-full h-[70px] overflow-hidden pointer-events-none opacity-40 z-0">
                <div class="animate-landscape h-full">
                    ${landscapeSVG}
                    ${landscapeSVG}
                </div>
            </div>

            <!-- 🌟 4. 导航栏极限压缩：p-6 缩小为 pt-3 px-4，向上推至贴近边缘 -->
            <div class="flex items-center justify-between pt-3 px-4 absolute top-0 w-full z-20 pointer-events-none">
                <!-- 极简长箭头返回 -->
                <button onclick="goBack('home')" class="pointer-events-auto p-2 text-stone-400 hover:text-stone-700 transition-colors active:scale-95" title="退出漫游">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M6.75 15.75L3 12m0 0l3.75-3.75M3 12h18"></path>
                    </svg>
                </button>

                <!-- 极简线条信封入口 -->
                <button onclick="goToRepliedList()" class="pointer-events-auto p-2 text-stone-400 hover:text-rose-500 transition-colors active:scale-95" title="时光信箱">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"></path>
                    </svg>
                </button>
            </div>

            <div id="roamTrack" class="flex h-full w-full will-change-transform z-10" style="transform: translateX(-${currentRoamIndex * 100}%);">
                ${trackHtml}
            </div>
        </div>
    `;
}