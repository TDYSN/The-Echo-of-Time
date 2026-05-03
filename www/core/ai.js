// 引入 Transformers.js (指定轻量版 v2.17.2)
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';

// --- 核心环境配置 ---
// 开启浏览器 Cache API 缓存。只要连网下载过一次模型 (约22MB)，
// 以后无论重启 APP 还是断网，都会直接从本地沙盒秒速加载，实现纯离线。
env.useBrowserCache = true;
// 关闭本地路径加载 (因为我们在 Capacitor WebView 中，默认走远端拉取存入缓存)
env.allowLocalModels = false; 

class AIEngine {
    static instance = null;
    // 选择的轻量级特征提取模型，专为句意相似度优化，极其精简
    static modelName = 'Xenova/all-MiniLM-L6-v2';

    /**
     * 获取或初始化单例 AI 提取器
     * @param {Function} progressCallback - 可选：用于向 UI 层实时反馈模型下载进度 (0~100)
     */
    static async getInstance(progressCallback = null) {
        if (this.instance === null) {
            console.log("🧠 正在唤醒本地 AI 引擎...");
            // pipeline 参数: 任务类型, 模型名称, 配置选项
            this.instance = await pipeline('feature-extraction', this.modelName, {
                progress_callback: (data) => {
                    // data 包含 status ('downloading', 'done' 等) 和 progress 进度条
                    if (progressCallback && data.status === 'downloading') {
                        progressCallback(data);
                    }
                }
            });
            console.log("✅ AI 引擎就绪 (模型已驻留内存)");
        }
        return this.instance;
    }

    /**
     * 将文本降维打击：转换为 384 维度的向量 (Embedding)
     * @param {string} text - 日记内容或搜索关键词
     * @returns {Promise<Array>} - 返回一个包含 384 个浮点数的一维数组
     */
    static async getEmbedding(text) {
        try {
            // 确保引擎已加载 (如果已加载会瞬间返回)
            const extractor = await this.getInstance();
            // pooling: 'mean' 和 normalize: true 是计算句意相似度的业界标准操作
            const output = await extractor(text, { pooling: 'mean', normalize: true });
            
            // 将内部的 Float32Array 转换为普通 JS 数组，方便后续存入 JSON 数据库
            return Array.from(output.data);
        } catch (error) {
            console.error("❌ 向量提取失败:", error);
            throw error;
        }
    }

    /**
     * 【纯数学】计算两个向量的余弦相似度 (Cosine Similarity)
     * 无需任何外部库，纯 CPU 计算，瞬间完成上千次比对。
     * @param {Array} vecA - 向量 A
     * @param {Array} vecB - 向量 B
     * @returns {number} - 返回 0 到 1 之间的得分。越接近 1 代表语义越相似。
     */
    static cosineSimilarity(vecA, vecB) {
        if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
        
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        if (normA === 0 || normB === 0) return 0;
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

// 导出类供业务层调用
export default AIEngine;

// ==========================================
// 🌟 向量数据库存储引擎 (完全独立于业务数据库)
// ==========================================
export const VectorStorage = {
    VECTOR_FILE_NAME: 'vectorIndex.json',
    _vectorCache: null,

    async loadVectorIndex() {
        if (this._vectorCache) return this._vectorCache;
        try {
            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                const { Filesystem } = Capacitor.Plugins;
                const result = await Filesystem.readFile({ path: `EchoAppData/${this.VECTOR_FILE_NAME}`, directory: 'DATA', encoding: 'utf8' });
                this._vectorCache = JSON.parse(result.data);
            } else {
                const data = localStorage.getItem(this.VECTOR_FILE_NAME);
                this._vectorCache = data ? JSON.parse(data) : {};
            }
        } catch (e) {
            console.log("🧠 初始化全新的向量数据库...");
            this._vectorCache = {};
        }
        return this._vectorCache;
    },

    async updateIndex(id, rawText) {
        if (!rawText || rawText.trim() === '') return;
        console.log(`[AI 后台] 正在为 [${id}] 生成语义共鸣坐标...`);
        try {
            const vector = await AIEngine.getEmbedding(rawText);
            const index = await this.loadVectorIndex();
            index[id] = vector;

            if (window.Capacitor && window.Capacitor.isNativePlatform()) {
                const { Filesystem } = Capacitor.Plugins;
                await Filesystem.writeFile({ path: `EchoAppData/${this.VECTOR_FILE_NAME}`, data: JSON.stringify(index), directory: 'DATA', encoding: 'utf8' });
            } else {
                localStorage.setItem(this.VECTOR_FILE_NAME, JSON.stringify(index));
            }
            console.log(`[AI 后台] [${id}] 坐标落盘完成！`);
        } catch (err) {
            console.error(`[AI 后台] 生成坐标失败:`, err);
        }
    }
};