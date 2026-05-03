// core/storage.js - V4.2 数据基建层 (彻底抛弃 Base64，全面物理落盘)

window.db = {};

window.initFileSystem = async function() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const Filesystem = Capacitor.Plugins.Filesystem; 
        const dirs = ['EchoAppData', 'EchoAppData/Images', 'EchoAppData/Videos', 'EchoAppData/Audios'];
        
        await Promise.all(dirs.map(async (dir) => { 
            try { 
                await Filesystem.stat({ path: dir, directory: 'DATA' }); 
            } catch (e) { 
                try { 
                    await Filesystem.mkdir({ path: dir, directory: 'DATA', recursive: true }); 
                } catch (err) {} 
            } 
        }));
        
        try { 
            const result = await Filesystem.readFile({ path: 'EchoAppData/database.json', directory: 'DATA', encoding: 'utf8' }); 
            window.db = JSON.parse(result.data); 
        } catch (e) { 
            let oldData = localStorage.getItem('WangShiShuJia_DB'); 
            window.db = oldData ? JSON.parse(oldData) : {}; 
            await saveToLocal(); 
            alert("欢迎来到，时间的回响"); 
        }

        // 🌟 读取归档数据库 (原生环境)
        try { 
            const arcResult = await Filesystem.readFile({ path: 'EchoAppData/archive_db.json', directory: 'DATA', encoding: 'utf8' }); 
            window.archiveDb = JSON.parse(arcResult.data); 
        } catch (e) { 
            let oldArc = localStorage.getItem('WangShiShuJia_Archive'); 
            window.archiveDb = oldArc ? JSON.parse(oldArc) : {}; 
        }

    } else { 
        // 🌟 网页端兜底测试环境
        let oldData = localStorage.getItem('WangShiShuJia_DB'); 
        window.db = oldData ? JSON.parse(oldData) : {}; 
        
        // 【关键修复】网页端也要读取归档数据！否则PC测试一保存就瘫痪！
        let oldArc = localStorage.getItem('WangShiShuJia_Archive'); 
        window.archiveDb = oldArc ? JSON.parse(oldArc) : {}; 
    }
    
    if (typeof render === 'function') {
        render(); // 先把底层的主页数据画好
        
        // 🌟 新增：数据加载完成且主页渲染后，优雅地淡出并销毁启动页
        const splash = document.getElementById('appSplashScreen');
        if (splash) {
            splash.style.opacity = '0'; // 触发渐隐动画
            // 700ms 后彻底从 DOM 树拔除，不占用任何内存
            setTimeout(() => splash.remove(), 700); 
        }
    }
};

window.saveToLocal = async function() {
    try {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const Filesystem = Capacitor.Plugins.Filesystem;
            try { await Filesystem.mkdir({ path: 'EchoAppData', directory: 'DATA', recursive: true }); } catch (e) {}
            // 存时光书架
            await Filesystem.writeFile({ path: 'EchoAppData/database.json', data: JSON.stringify(window.db), directory: 'DATA', encoding: 'utf8' });
            // 🌟 新增：存归档书架
            await Filesystem.writeFile({ path: 'EchoAppData/archive_db.json', data: JSON.stringify(window.archiveDb), directory: 'DATA', encoding: 'utf8' });
        } else {
            localStorage.setItem('WangShiShuJia_DB', JSON.stringify(window.db));
            localStorage.setItem('WangShiShuJia_Archive', JSON.stringify(window.archiveDb)); // 网页端兜底
        }
    } catch (e) {
        console.error("保存失败", e);
        alert("⚠️ 数据库写入失败！\n真实原因: " + e.message);
    }
};

// 🌟 V4.2 核心重构：彻底抛弃 Base64，所有媒体文件强制物理落盘
window.saveMediaToDisk = async function(base64Data, type) {
    // 如果不是在原生 App 环境，只能无奈返回 base64 兜底
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return base64Data; 
    
    const Filesystem = Capacitor.Plugins.Filesystem;
    const timestamp = Date.now();
    let folder = '', ext = '';

    if (type === 'image') { folder = 'Images'; ext = 'jpg'; } 
    else if (type === 'video') { folder = 'Videos'; ext = 'mp4'; } 
    else if (type === 'voice') { folder = 'Audios'; ext = 'webm'; }

    const fileName = `${folder.substring(0, 3).toLowerCase()}_${timestamp}.${ext}`;
    const path = `EchoAppData/${folder}/${fileName}`;
    
    // 强制剥离 Base64 的头部，提取纯粹的数据体
    let base64Content = base64Data;
    if (base64Data.includes(',')) {
        base64Content = base64Data.split(',')[1];
    }

    try {
        // 🌟 统一写入沙盒物理文件
        const result = await Filesystem.writeFile({ 
            path: path, 
            data: base64Content, 
            directory: 'DATA' 
        });
        // 🌟 返回轻量级的 Capacitor 本地虚拟协议路径 (例如: _capacitor_file_://...)
        return Capacitor.convertFileSrc(result.uri);
    } catch (e) {
        console.error("文件落盘失败:", e);
        alert("⚠️ 文件写入失败，请检查手机存储空间！");
        return base64Data; // 失败时无奈降级
    }
};

initFileSystem();