// map.js - 足迹地图及定位归档模块

let mapLocations = [];
let currentMapIndex = 0;

function goToMap() {
    closeSidebar();
    mapLocations = [];
    let locMap = {};

    // 扫描所有日记，把带定位的数据提取出来，按地点聚类
    for(let y in db) {
        for(let m in db[y]) {
            db[y][m].forEach(entry => {
                if (entry.location && entry.location.trim() !== '') {
                    if (!locMap[entry.location]) {
                        locMap[entry.location] = [];
                    }
                    locMap[entry.location].push({ ...entry, year: y, month: m });
                }
            });
        }
    }

    // 转化为数组，方便在地图上点击“下一个”进行轮播
    for (let loc in locMap) {
        mapLocations.push({
            name: loc,
            count: locMap[loc].length,
            entries: locMap[loc]
        });
    }

    currentMapIndex = 0;
    historyStack.push({...state});
    state.level = 'map';
    renderMapView();
}

function nextMapLocation() {
    if (mapLocations.length > 0) {
        currentMapIndex = (currentMapIndex + 1) % mapLocations.length;
        renderMapView();
    }
}

// 🌟 点击地图弹窗进入该位置的归档页
function goToLocationDetails(locName) {
    state.level = 'locationDetails';
    state.currentLocName = locName;
    renderLocationDetailsView();
}

function renderMapView() {
    const app = document.getElementById('app');

    if (mapLocations.length === 0) {
        app.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full bg-stone-100 p-6 text-center relative">
                <button onclick="goBack('home')" class="absolute top-6 left-6 text-stone-500 font-bold flex items-center gap-1">
                    <span>←</span> 返回
                </button>
                <div class="text-6xl mb-4 opacity-50">🗺️</div>
                <h2 class="text-xl font-bold text-stone-600 mb-2">还没有足迹喔</h2>
                <p class="text-sm text-stone-400">写手账时加上定位，就能点亮地图了</p>
            </div>
        `;
        return;
    }

    const currentLoc = mapLocations[currentMapIndex];

    // 1:1 像素级模拟参考图的 UI 界面
    app.innerHTML = `
        <div class="h-full flex flex-col relative overflow-hidden bg-[#e5e3df]">
            <div class="absolute inset-0 opacity-20" style="background-image: radial-gradient(#9ca3af 1px, transparent 1px); background-size: 30px 30px;"></div>
            
            <div class="flex items-center gap-4 p-4 absolute top-0 w-full z-20 text-stone-800 bg-white/60 backdrop-blur-md border-b border-white/50">
                <button onclick="goBack('home')" class="font-bold flex items-center gap-1 hover:text-stone-500 transition-colors text-lg">
                    <span>←</span>
                </button>
                <div class="text-lg font-bold tracking-wider">共记录 ${mapLocations.length} 个位置</div>
            </div>

            <div class="flex-1 flex items-center justify-center relative z-10">
                <div class="flex flex-col items-center animate-bounce cursor-pointer hover:scale-110 transition-transform">
                    <div class="text-5xl drop-shadow-lg relative -bottom-2">📍</div>
                    <div class="w-6 h-1.5 bg-black/20 rounded-[100%] blur-[1px]"></div>
                </div>
            </div>

            <div class="absolute bottom-8 left-0 w-full px-4 z-20">
                <div onclick="goToLocationDetails('${currentLoc.name}')" class="bg-white/95 backdrop-blur-xl rounded-2xl p-5 shadow-[0_8px_30px_rgba(0,0,0,0.12)] flex justify-between items-center border border-white/50 cursor-pointer hover:scale-[1.02] transition-transform">
                    <div class="flex flex-col gap-1 max-w-[65%]">
                        <div class="text-lg font-bold text-stone-800 truncate">${currentLoc.name}</div>
                        <div class="text-xs text-stone-500 font-medium tracking-wide">共 ${currentLoc.count} 篇日记</div>
                    </div>
                    <button onclick="event.stopPropagation(); nextMapLocation();" class="bg-[#31b1b1] text-white px-6 py-2 rounded-full text-sm font-bold shadow-md shadow-[#31b1b1]/30 hover:bg-[#289797] active:scale-95 transition-all tracking-widest">
                        下一个
                    </button>
                </div>
            </div>
            
        </div>
    `;
}

// 🌟 位置归档展示页 (按日期模块化)
function renderLocationDetailsView() {
    const app = document.getElementById('app');
    const locName = state.currentLocName;
    const currentLocData = mapLocations.find(l => l.name === locName);
    let locEntries = currentLocData ? currentLocData.entries : [];

    // 倒序排列，最新在最上面
    locEntries.sort((a, b) => new Date(b.fullDateStr) - new Date(a.fullDateStr));

    // 按日期聚类模块化
    let grouped = {};
    locEntries.forEach(entry => {
        const dateKey = `${entry.year}年${entry.month}月${entry.day}日`;
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(entry);
    });

    let listHtml = '';
    for (let dateKey in grouped) {
        listHtml += `<h3 class="text-sm font-bold text-stone-500 mt-8 mb-4 flex items-center gap-2 tracking-widest"><span class="w-1.5 h-4 bg-cyan-500 rounded-full"></span>${dateKey}</h3>`;
        
        grouped[dateKey].forEach(entry => {
            const hasMedia = entry.html.includes('<img') || entry.html.includes('<video') || entry.html.includes('<audio');
            const bgClass = hasMedia ? 'journal-bg' : 'bg-[#faf9f6]';
            
            // 点击这里的任意卡片，无缝进入手账详情！
            listHtml += `
            <div class="mb-6 bg-white rounded-3xl shadow-sm border border-stone-200 overflow-hidden cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all" 
                 onclick="state.year='${entry.year}'; state.month='${entry.month}'; state.day=${entry.day}; state.level='day'; render();">
                <div class="read-only-mode ${bgClass} p-6 border-b border-stone-100 max-h-48 overflow-hidden relative">
                    ${entry.html}
                    <div class="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-${bgClass === 'journal-bg' ? '[#faf9f6]' : 'white'} to-transparent"></div>
                </div>
                <div class="p-3 bg-white flex justify-between items-center text-xs text-stone-400">
                    <div class="font-mono font-bold text-stone-500 flex items-center gap-1">🕒 <span>${entry.timeStr}</span></div>
                    <div class="flex items-center gap-2">
                        <span>${entry.weather || '🌤️ 无'}</span>
                        <span class="bg-stone-50 px-2 py-1 rounded text-stone-300">›</span>
                    </div>
                </div>
            </div>`;
        });
    }

    app.innerHTML = `
        <div class="p-6 h-full overflow-y-auto bg-[#f5f5f4]">
            <div class="flex items-center justify-between mb-6 sticky top-0 bg-[#f5f5f4]/90 backdrop-blur py-2 z-10">
                <button onclick="state.level='map'; renderMapView();" class="flex items-center gap-1 text-stone-500 font-bold hover:text-stone-800 bg-white px-3 py-1.5 rounded-full shadow-sm text-sm border border-stone-100">
                    <span>←</span> 返回地图
                </button>
                <div class="text-right flex flex-col items-end">
                    <h1 class="text-xl font-serif font-bold text-stone-800 truncate max-w-[200px]">${locName}</h1>
                    <div class="text-[10px] text-stone-400 mt-1 tracking-widest flex items-center gap-1">📍 足迹归档</div>
                </div>
            </div>
            <div>
                ${listHtml}
            </div>
        </div>
    `;
}