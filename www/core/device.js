// device.js - V4.0 原生硬件与系统层 (录音、定位、PDF导出、分享、物理键)

window.mediaRecorder = null;
window.audioChunks = [];
window.recordTimer = null;
window.recordSeconds = 0;
window.isRecordingCancelled = false;
window.amap = null;
window.amapMarker = null;

// ==================== 1. 录音引擎 ====================
window.startRecording = async function() { 
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return alert("⚠️ 不支持录音。");
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (err) { return alert("⚠️ 录音权限被拒绝。"); }

    try {
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstop = () => {
            const reader = new FileReader();
            const finalDuration = recordSeconds;
            const now = new Date();
            const recordTime = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日${now.getHours()}点${String(now.getMinutes()).padStart(2, '0')}分`;
            
            reader.onload = async function(e) {
                if (!isRecordingCancelled) {
                    const localUrl = await saveMediaToDisk(e.target.result, 'voice');
                    // 依赖 app.js 中的 createBlockHTML 函数
                    if (typeof createBlockHTML === 'function') {
                        document.getElementById('journal-canvas').insertAdjacentHTML('beforeend', createBlockHTML('voice', localUrl, finalDuration, recordTime));
                        if(typeof isEditorDirty !== 'undefined') isEditorDirty = true; 
                    }
                }
                isRecordingCancelled = false; 
            };
            reader.readAsDataURL(new Blob(audioChunks, { type: 'audio/webm' }));
            stream.getTracks().forEach(track => track.stop());
        };

        const modal = document.getElementById('recordingModal');
        if(modal) modal.classList.remove('hidden'); 
        
        recordSeconds = 0; 
        const display = document.getElementById('recordTimeDisplay');
        if(display) display.innerText = "00:00";
        
        mediaRecorder.start(); 
        
        recordTimer = setInterval(() => {
            recordSeconds++; 
            if(display) display.innerText = `00:${String(recordSeconds).padStart(2, '0')}`;
            if (recordSeconds >= 60) stopRecording();
        }, 1000);
    } catch (err) { alert("⚠️ 录音失败：" + err.message); }
};

window.stopRecording = function() { 
    if (mediaRecorder && mediaRecorder.state !== 'inactive') { 
        mediaRecorder.stop(); 
        clearInterval(recordTimer); 
        const modal = document.getElementById('recordingModal');
        if(modal) modal.classList.add('hidden'); 
    } 
};

window.cancelRecording = function() { 
    isRecordingCancelled = true; 
    stopRecording(); 
};

// ==================== 2. PDF 引擎 ====================
window.exportToPDF = function() {
    const overlay = document.getElementById('loadingOverlay');
    if(overlay) overlay.classList.remove('hidden');
    
    const element = document.getElementById('printable-area');
    const navBar = element.querySelector('.sticky');
    if(navBar) navBar.classList.add('hidden');
    
    const fab = element.querySelector('.fixed.bottom-8');
    if(fab) fab.classList.add('hidden');

    html2pdf().set({ 
        margin: 10, 
        filename: `回响导出.pdf`, 
        image: { type: 'jpeg', quality: 0.98 }, 
        html2canvas: { scale: 2 }, 
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
    }).from(element).save().then(() => {
        if(navBar) navBar.classList.remove('hidden');
        if(fab) fab.classList.remove('hidden');
        if(overlay) overlay.classList.add('hidden');
        if(typeof toggleArticleMenu === 'function') toggleArticleMenu(); 
    }).catch(() => {
        if(navBar) navBar.classList.remove('hidden');
        if(fab) fab.classList.remove('hidden');
        if(overlay) overlay.classList.add('hidden');
        if(typeof toggleArticleMenu === 'function') toggleArticleMenu();
    });
};

// ==================== 3. 高德定位引擎 ====================
window.getLocationFromDevice = async function() {
    const title = document.getElementById('locationModalTitle'); 
    const oldTitle = title ? title.innerText : '定位中'; 
    if(title) title.innerText = "卫星连接中...";
    
    let isResolved = false;
    const timeoutSafeLock = setTimeout(() => { 
        if (!isResolved) { 
            isResolved = true; 
            if(title) title.innerText = oldTitle; 
            closeLocationModal(); 
            alert("⚠️ 定位超时"); 
        } 
    }, 10000);

    try {
        let lat, lon;
        if (window.Capacitor && window.Capacitor.isNativePlatform()) {
            const Geolocation = Capacitor.Plugins.Geolocation;
            const permission = await Geolocation.requestPermissions();
            if (permission.location !== 'granted') { 
                clearTimeout(timeoutSafeLock); isResolved = true; 
                if(title) title.innerText = oldTitle; 
                return alert("⚠️ 拒绝定位"); 
            }
            let position;
            try { position = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 4000, maximumAge: 30000 }); } 
            catch (e) { position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 5000, maximumAge: 300000 }); }
            lat = position.coords.latitude; lon = position.coords.longitude;
        } else {
            await new Promise((resolve, reject) => { 
                navigator.geolocation.getCurrentPosition(
                    pos => { lat = pos.coords.latitude; lon = pos.coords.longitude; resolve(); }, 
                    err => reject(err), 
                    { enableHighAccuracy: true, timeout: 8000 }
                ); 
            });
        }
        
        if (typeof AMap !== 'undefined') {
            AMap.plugin('AMap.Geocoder', function() {
                var geocoder = new AMap.Geocoder({ city: "010" });
                geocoder.getAddress([lon, lat], function(status, result) {
                    // 依赖 app.js 中的 editorMeta 和 updateLocationDOM
                    if(typeof editorMeta !== 'undefined') {
                        editorMeta.location = (status === 'complete' && result.regeocode) ? window.simplifyAddress(result.regeocode.addressComponent) : `E${lon.toFixed(2)} N${lat.toFixed(2)}`;
                        if(typeof isEditorDirty !== 'undefined') isEditorDirty = true;
                    }
                    finalizeLocation(oldTitle);
                });
            });
        } else {
            if (isResolved) return; clearTimeout(timeoutSafeLock); isResolved = true;
            if(typeof editorMeta !== 'undefined') {
                editorMeta.location = `东经${lon.toFixed(2)} 北纬${lat.toFixed(2)}`;
                if(typeof isEditorDirty !== 'undefined') isEditorDirty = true;
            }
            finalizeLocation(oldTitle);
        }
    } catch (error) { 
        if (isResolved) return; clearTimeout(timeoutSafeLock); isResolved = true; 
        alert("⚠️ 定位失败: " + error.message); 
        if(title) title.innerText = oldTitle; 
    }
};

window.simplifyAddress = function(components) {
    let city = components.city && typeof components.city === 'string' ? components.city : components.province;
    let district = components.district || components.township || "";
    return city.replace(/省|市/g, '') + district.replace(/区|街道|镇|乡/g, '');
};

// ==================== 4. 硬件返回键拦截 ====================
window.initHardwareBackButton = async function() {
    if (window.Capacitor && window.Capacitor.isNativePlatform()) {
        const App = Capacitor.Plugins.App;
        App.removeAllListeners(); // 清除旧监听，防止重复触发
        App.addListener('backButton', () => {
            if (state.level === 'home') App.exitApp(); 
            else if (state.level === 'editor') {
                if(typeof attemptCancelEdit === 'function') attemptCancelEdit();
            } 
            else if (['year', 'gallery', 'roam', 'map', 'calendar'].includes(state.level)) window.goBack('home'); 
            else if (state.level === 'month') window.goBack('year');
            // 👇 下面这四个页面直接调用咱们 V3.3.1 写好的高级 goBack() 引擎，它会自动判断要退到上一级还是退回信箱！
            else if (state.level === 'day') window.goBack('month'); 
            else if (state.level === 'articleView') window.goBack('day'); 
            else if (state.level === 'repliedList' || state.level === 'settings') window.goBack(); 
            else if (state.level === 'locationDetails') { state.level = 'map'; if(typeof renderMapView === 'function') renderMapView(); }
        });
    }
};
initHardwareBackButton();
