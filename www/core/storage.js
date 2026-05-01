// storage.js - V4.0 数据基建层 (负责纯粹的物理落盘与读取)

// 暴露为全局变量，供其他模块调用
window.db = {};

// 初始化文件系统并读取数据
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
    } else { 
        let oldData = localStorage.getItem('WangShiShuJia_DB'); 
        window.db = oldData ? JSON.parse(oldData) : {}; 
    }
    
    // 初始化完成后，调用主引擎进行初次渲染 (需要确保 app.js 已加载)
    if (typeof render === 'function') {
        render();
    }
};

// 物理落盘
window.saveToLocal = async function() {
    try {
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const Filesystem = Capacitor.Plugins.Filesystem;
            try { await Filesystem.mkdir({ path: 'EchoAppData', directory: 'DATA', recursive: true }); } catch (e) {}
            await Filesystem.writeFile({ path: 'EchoAppData/database.json', data: JSON.stringify(window.db), directory: 'DATA', encoding: 'utf8' });
        } else {
            localStorage.setItem('WangShiShuJia_DB', JSON.stringify(window.db));
        }
    } catch (e) {
        console.error("保存失败", e);
        alert("⚠️ 数据库写入失败！\n真实原因: " + e.message);
    }
};

// 保存多媒体文件到沙盒并返回本地路径
window.saveMediaToDisk = async function(base64Data, type) {
    if (!window.Capacitor || !window.Capacitor.isNativePlatform()) return base64Data; 
    const Filesystem = Capacitor.Plugins.Filesystem;
    const timestamp = Date.now();
    let folder = '', ext = '';

    if (type === 'image') { folder = 'Images'; ext = 'jpg'; } 
    else if (type === 'video') { folder = 'Videos'; ext = 'mp4'; } 
    else if (type === 'voice') { folder = 'Audios'; ext = 'webm'; }

    const fileName = `${folder.substring(0, 3).toLowerCase()}_${timestamp}.${ext}`;
    const path = `EchoAppData/${folder}/${fileName}`;
    const base64Content = base64Data.split(',')[1];

    try {
        const result = await Filesystem.writeFile({ path: path, data: base64Content, directory: 'DATA' });
        return Capacitor.convertFileSrc(result.uri);
    } catch (e) {
        return base64Data; 
    }
};

// 启动基建
initFileSystem();