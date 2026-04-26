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
    let mediaCount = { img: 0, vid: 0 };
    let groupedMedia = {};

    Object.keys(db).sort((a,b) => b-a).forEach(y => {
        Object.keys(db[y]).sort((a,b) => b-a).forEach(m => {
            db[y][m].forEach(entry => {
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
                        if(media.tagName.toLowerCase() === 'img') mediaCount.img++;
                        if(media.tagName.toLowerCase() === 'video') {
                            mediaCount.vid++;
                            media.removeAttribute('controls'); 
                        }

                        // 💡 升级点：去掉了强制截切的 aspect-square 和 object-cover
                        // 换成了 w-full h-auto 自动高度，以及 break-inside-avoid 防截断（瀑布流核心）
                        media.className = "w-full h-auto block mb-3 rounded-xl shadow-sm border border-stone-200 cursor-pointer hover:opacity-90 transition-opacity break-inside-avoid";
                        groupedMedia[groupKey].items.push(media.outerHTML);
                    });
                }
            });
        });
    });

    let galleryHtml = '';
    
    if(Object.keys(groupedMedia).length === 0) {
        galleryHtml = `
            <div class="flex flex-col items-center justify-center h-full text-center text-stone-400 py-32">
                <span class="text-6xl opacity-50 mb-4">📭</span>
                <h2 class="text-xl font-bold text-stone-600 mb-2">图库空空如也</h2>
                <p class="text-sm">快去手账里添加一些照片和视频吧</p>
            </div>`;
    } else {
        Object.values(groupedMedia).forEach(group => {
            galleryHtml += `
                <div class="flex gap-4 mb-8">
                    <div class="w-16 flex-shrink-0 flex flex-col items-center pt-1">
                        <span class="text-4xl font-light text-stone-700">${group.day}</span>
                        <span class="text-[10px] text-stone-400 mt-2">${group.yearMonth}</span>
                        <span class="text-[10px] text-stone-400">${group.weekDay}</span>
                    </div>
                    <div class="flex-1 columns-2 gap-3 pb-4">
                        ${group.items.join('')}
                    </div>
                </div>
            `;
        });
    }

    app.innerHTML = `
        <div class="p-6 h-full overflow-y-auto bg-stone-50">
            <div class="flex items-center justify-between mb-4 sticky top-0 bg-stone-50/90 backdrop-blur py-2 z-10">
                <button onclick="goBack('home')" class="text-stone-500 hover:text-stone-800 transition-colors">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                </button>
                <div class="flex gap-4 text-stone-500">
                    <span class="cursor-pointer hover:text-stone-800 text-lg">📅</span>
                    <span class="cursor-pointer hover:text-stone-800 text-lg">🔍</span>
                </div>
            </div>
            
            <div class="text-center text-xs text-stone-400 mb-8 tracking-widest">
                共 ${mediaCount.img} 张图片，${mediaCount.vid} 个视频
            </div>
            
            ${galleryHtml}
        </div>
    `;
}