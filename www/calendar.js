// calendar.js - 全屏沉浸式瀑布流日历 (V3.2 中文月份 + 修复返回Bug)

let currentCalYear = new Date().getFullYear();
let isYearPickerOpen = false;

window.goToCalendar = function() {
    historyStack.push({...state});
    state.level = 'calendar';
    
    currentCalYear = new Date().getFullYear();
    window.hasScrolledToCurrentMonth = false; 
    
    renderCalendarView();
}

// 🌟 修复一：专属的退出日历逻辑，确保完美切回图库
window.exitCalendar = function() {
    historyStack.pop(); // 弹出日历的历史记录
    state.level = 'gallery'; // 状态拨回图库
    // 强制调用图库专属的渲染引擎
    if (typeof renderGalleryView === 'function') {
        renderGalleryView(); 
    } else {
        render(); // 兜底
    }
}

window.renderCalendarView = function() {
    const app = document.getElementById('app');
    let monthsHtml = '';
    
    // 🌟 修复二：中文月份映射表
    const chineseMonths = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];

    for (let m = 1; m <= 12; m++) {
        const firstDayDate = new Date(currentCalYear, m - 1, 1);
        const startingDayOfWeek = firstDayDate.getDay(); 
        const daysInMonth = new Date(currentCalYear, m, 0).getDate();

        let daysHtml = '';
        let recordedDaysCount = 0;

        for (let i = 0; i < startingDayOfWeek; i++) {
            daysHtml += `<div></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            let hasEntry = false;
            
            if (db[currentCalYear] && db[currentCalYear][m]) {
                hasEntry = db[currentCalYear][m].some(entry => entry.day == d);
            }

            if (hasEntry) recordedDaysCount++;

            let dayStyle = hasEntry 
                ? `bg-cyan-600 text-white font-bold shadow-md cursor-pointer active:scale-95` 
                : `bg-stone-100 text-cyan-500 font-medium`; 
                
            let clickEvent = hasEntry ? `onclick="goToDayFromCalendar(${currentCalYear}, ${m}, ${d})"` : '';

            daysHtml += `
                <div class="py-1 flex justify-center transition-all">
                    <div class="w-10 h-10 flex items-center justify-center rounded-xl ${dayStyle}" ${clickEvent}>
                        ${d}
                    </div>
                </div>
            `;
        }

        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

        monthsHtml += `
            <div id="cal-month-${m}" class="mb-10 pt-2">
                <div class="mb-4 px-2 text-center">
                    <!-- 🌟 这里应用了中文月份 -->
                    <h3 class="text-3xl font-black text-stone-800 tracking-wider">${chineseMonths[m-1]}月</h3>
                    <!-- 🌟 优化了“未记录”的显示逻辑 -->
                    <p class="text-sm text-stone-400 mt-1 font-medium">${recordedDaysCount > 0 ? `已记录 ${recordedDaysCount} 天` : '未记录'}</p>
                </div>
                <div class="grid grid-cols-7 text-center pb-3 text-xs font-bold text-stone-400">
                    ${weekDays.map(w => `<div>${w}</div>`).join('')}
                </div>
                <div class="grid grid-cols-7 gap-y-2 gap-x-1">
                    ${daysHtml}
                </div>
            </div>
        `;
    }

    let availableYears = Object.keys(db).map(Number);
    if (!availableYears.includes(new Date().getFullYear())) {
        availableYears.push(new Date().getFullYear());
    }
    availableYears.sort((a, b) => b - a);

    let yearOptionsHtml = availableYears.map(y => `
        <div class="py-4 text-center text-lg font-medium ${y === currentCalYear ? 'text-cyan-600 font-bold bg-cyan-50 rounded-xl' : 'text-stone-600'} cursor-pointer hover:bg-stone-50 transition-colors" onclick="selectCalYear(${y})">
            ${y} 年
        </div>
    `).join('');

    let yearPickerHtml = isYearPickerOpen ? `
        <div class="absolute inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center animate-fade-in" onclick="toggleYearPicker(false)">
            <div class="bg-white w-full rounded-t-3xl p-6 transform transition-transform translate-y-0 shadow-2xl" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center mb-6 border-b border-stone-100 pb-4">
                    <h3 class="text-xl font-bold text-stone-800">选择年份</h3>
                    <button onclick="toggleYearPicker(false)" class="text-stone-400 hover:text-stone-700 bg-stone-100 rounded-full p-1.5 active:scale-90">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
                <div class="max-h-[40vh] overflow-y-auto pb-6 space-y-1">
                    ${yearOptionsHtml}
                </div>
            </div>
        </div>
    ` : '';

    app.innerHTML = `
        <div class="h-full bg-white flex flex-col relative overflow-hidden animate-fade-in">
            
            <div class="flex items-center justify-between p-5 bg-white/90 backdrop-blur-md z-20 absolute top-0 w-full">
                <!-- 🌟 这里的 onclick 已经替换成新写的 exitCalendar() -->
                <button onclick="exitCalendar()" class="text-stone-400 hover:text-stone-800 transition-colors bg-white rounded-full p-1 shadow-sm border border-stone-100">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </button>
                
                    <div class="flex-1 flex justify-end">
                        <button onclick="toggleYearPicker(true)" class="flex items-center gap-1 text-stone-800 font-serif text-lg font-bold tracking-widest hover:text-cyan-600 transition-colors ">
                            ${currentCalYear} 年
                            <svg class="w-4 h-4 text-stone-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                    </div>
            </div>

            <div class="flex-1 overflow-y-auto px-5 pt-24 pb-20 bg-white relative z-10" id="calendarScrollBody">
                ${monthsHtml}
            </div>
            
            ${yearPickerHtml}
        </div>
    `;

    if (currentCalYear === new Date().getFullYear() && !window.hasScrolledToCurrentMonth) {
        setTimeout(() => {
            const currentMonth = new Date().getMonth() + 1;
            const scrollBody = document.getElementById('calendarScrollBody');
            const targetMonthDiv = document.getElementById('cal-month-' + currentMonth);
            
            if (targetMonthDiv && scrollBody) {
                scrollBody.scrollTo({
                    top: targetMonthDiv.offsetTop - 100,
                    behavior: 'smooth'
                });
            }
            window.hasScrolledToCurrentMonth = true;
        }, 150);
    }
}

window.toggleYearPicker = function(show) {
    isYearPickerOpen = show;
    renderCalendarView();
}

window.selectCalYear = function(y) {
    currentCalYear = y;
    isYearPickerOpen = false;
    window.hasScrolledToCurrentMonth = false; 
    renderCalendarView();
}

window.goToDayFromCalendar = function(y, m, d) {
    historyStack.push({...state});
    state.level = 'day';
    state.year = y;
    state.month = m;
    state.day = d;
    render(); 
}