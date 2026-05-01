// gallery.js - 专门负责图库模块的逻辑

document.getElementById('btnGallery').onclick = goToGallery;

function goToGallery() {
    closeSidebar(); 
    historyStack.push({...state}); 
    state.level = 'gallery';
    renderGalleryView(); 
}

function renderGalleryView() {
    const app = document.getElementById('app');
    let groupedMedia = {};

    Object.keys(db).sort((a,b) => b-a).forEach(y => {
        Object.keys(db[y]).sort((a,b) => b-a).forEach(m => {
            
            // 🌟 核心修复：将该月内的手账严格按照 "日期 (day)" 进行倒序排列
            // 彻底解决事后补写手账导致图库时间线错乱的问题
            let sortedEntries = [...db[y][m]].sort((a, b) => b.day - a.day);

            sortedEntries.forEach(entry => {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = entry.html;
                const medias = tempDiv.querySelectorAll('img, video');

                if (medias.length > 0) {
                    const dateObj = new Date(y, m - 1, entry.day);
                    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
                    const weekDay = weekDays[dateObj.getDay()];

                    const groupKey = `${y}-${m}-${entry.day}`;
                    if (!groupedMedia[groupKey]) {
                        groupedMedia[groupKey] = {
                            day: entry.day,
                            yearMonth: `${y}年${m}月`,
                            weekDay: weekDay,
                            items: []
                        };
                    }

                    medias.forEach(media => {
                        if (media.tagName.toLowerCase() === 'img') {
                            groupedMedia[groupKey].items.push(`
                                <div class="mb-3 overflow-hidden rounded-xl shadow-sm border border-stone-100 bg-white">
                                    <img src="${media.src}" class="w-full h-auto object-cover" onclick="viewFullMedia('${media.src}', 'img')">
                                </div>
                            `);
                        } else if (media.tagName.toLowerCase() === 'video') {
                            groupedMedia[groupKey].items.push(`
                                <div class="mb-3 overflow-hidden rounded-xl shadow-sm border border-stone-100 bg-white relative">
                                    <video src="${media.src}" class="w-full h-auto object-cover" onclick="viewFullMedia('${media.src}', 'vid')"></video>
                                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                                        <div class="bg-black/40 rounded-full p-2 backdrop-blur-sm"><span class="text-white text-xs">▶</span></div>
                                    </div>
                                </div>
                            `);
                        }
                    });
                }
            });
        });
    });

    // 将分组对象转换为数组并渲染
    let htmlContent = '';
    const sortedGroupKeys = Object.keys(groupedMedia).sort((a, b) => {
        const [y1, m1, d1] = a.split('-');
        const [y2, m2, d2] = b.split('-');
        return new Date(y2, m2-1, d2) - new Date(y1, m1-1, d1);
    });

    if (sortedGroupKeys.length === 0) {
        htmlContent = `<div class="flex flex-col items-center justify-center h-[60vh] text-stone-300"><div class="text-4xl mb-4 animate-float">📭</div><p>图库空空如也</p></div>`;
    } else {
        sortedGroupKeys.forEach(key => {
            const group = groupedMedia[key];
            htmlContent += `
                <div class="flex gap-4 mb-8">
                    <div class="w-12 flex flex-col items-center pt-2">
                        <span class="text-2xl font-serif font-bold text-stone-700">${group.day}</span>
                        <span class="text-[10px] text-stone-400 mt-2">${group.yearMonth}</span>
                        <span class="text-[10px] text-stone-400">${group.weekDay}</span>
                    </div>
                    <div class="flex-1 columns-2 gap-3 pb-4 border-l border-stone-200 pl-4">
                        ${group.items.join('')}
                    </div>
                </div>
            `;
        });
    }

    app.innerHTML = `
        <div class="p-6 h-full overflow-y-auto bg-stone-50">
            <div class="flex items-center justify-between mb-6 sticky top-0 bg-stone-50/90 backdrop-blur py-2 z-10">
                <button onclick="goBack('home')" class="text-stone-500 hover:text-stone-800 transition-colors">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </button>
                <div class="flex gap-4 text-stone-500">
                    <button onclick="goToCalendar()" class="hover:text-stone-800 transition-colors" title="日历视图">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                    </button>
                </div>
            </div>
            ${htmlContent}
        </div>
    `;
}