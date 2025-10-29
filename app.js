/**
 * 主应用模块
 */

import DataLoader from './data-loader.js';
import CanvasMapVisualization from './map-canvas-visualization.js';
import TimeseriesVisualization from './timeseries-visualization.js';
import WindfieldCanvasVisualization from './windfield-canvas-visualization.js';
import CorrelationVisualization from './correlation-visualization.js';

class AirQualityApp {
    constructor() {
        this.dataLoader = new DataLoader();
        this.currentDate = '20130101'; // 默认从2013年1月1日开始
        this.currentPollutant = 'PM2.5';
        this.currentData = null;
        this.rawData = null; // 保存原始数据，用于切换污染物时重新提取
        this.timeseriesDays = 30; // 时间序列显示天数
        this.isAnimating = false;
        this.animationInterval = null;
        
        // 初始化可视化组件 - 使用Canvas提高性能
        this.mapViz = new CanvasMapVisualization('#map-canvas', 900, 600);
        this.timeseriesViz = new TimeseriesVisualization('#timeseries-canvas', 900, 300);
        this.windfieldViz = new WindfieldCanvasVisualization('#windfield-canvas', 900, 600);
        this.correlationViz = new CorrelationVisualization('#correlation-canvas', 900, 600);
        
        // 生成可用日期列表 (2013-2017)
        this.availableDates = this.generateDateList();
    }
    
    /**
     * 生成可用日期列表
     */
    generateDateList() {
        const dates = [];
        const startYear = 2013;
        const endYear = 2017;
        
        for (let year = startYear; year <= endYear; year++) {
            for (let month = 1; month <= 12; month++) {
                const daysInMonth = new Date(year, month, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const monthStr = month.toString().padStart(2, '0');
                    const dayStr = day.toString().padStart(2, '0');
                    dates.push(`${year}${monthStr}${dayStr}`);
                }
            }
        }
        
        return dates;
    }

    /**
     * 初始化应用
     */
    async init() {
        this.setupEventListeners();
        this.populateDateSelector();
        
        // 预加载缓存
        this.preloadCache();
        
        // 加载初始数据
        await this.loadData();
    }
    
    /**
     * 预加载缓存 - 提前加载常用日期数据
     */
    async preloadCache() {
        console.log('开始预加载常用日期数据...');
        // 预加载2016年每月的第一天
        const commonDates = [
            '20130101', '20130115',
            '20160101', '20160115', '20160615', 
            '20161215', '20170101'
        ];
        
        // 后台异步加载，不阻塞UI
        setTimeout(async () => {
            for (const date of commonDates) {
                try {
                    await this.dataLoader.loadDayData(date);
                    console.log(`预加载: ${date}`);
                } catch (e) {
                    console.warn(`预加载失败: ${date}`, e);
                }
            }
            console.log('预加载完成');
        }, 500);
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        // 日期选择器
        document.getElementById('date-selector').addEventListener('change', (e) => {
            this.currentDate = e.target.value;
            this.loadData();
        });
        
        // 污染物选择器
        document.getElementById('pollutant-selector').addEventListener('change', (e) => {
            this.currentPollutant = e.target.value;
            // 重新从原始数据提取新污染物的数据
            if (this.rawData && this.rawData.length > 0) {
                const pollutantData = this.dataLoader.extractPollutantData(
                    this.rawData,
                    this.currentPollutant
                );
                this.currentData = pollutantData;
                this.updateVisualizations();
            } else {
                console.warn('没有原始数据，无法切换污染物');
            }
        });
        
        // 时间序列天数选择器
        document.getElementById('timeseries-days').addEventListener('change', (e) => {
            this.timeseriesDays = parseInt(e.target.value);
            this.timeseriesViz.setDisplayDays(this.timeseriesDays);
            // 重新加载时间序列数据
            this.loadData();
        });
        
        // 动画按钮
        document.getElementById('animate-btn').addEventListener('click', () => {
            this.startAnimation();
        });
        
        document.getElementById('stop-btn').addEventListener('click', () => {
            this.stopAnimation();
        });
        
        // 视图选择
        document.getElementById('show-map').addEventListener('change', (e) => {
            document.getElementById('map-view').style.display = e.target.checked ? 'block' : 'none';
        });
        
        document.getElementById('show-timeseries').addEventListener('change', (e) => {
            document.getElementById('timeseries-view').style.display = e.target.checked ? 'block' : 'none';
        });
        
        document.getElementById('show-windfield').addEventListener('change', (e) => {
            const isVisible = e.target.checked;
            document.getElementById('windfield-view').style.display = isVisible ? 'block' : 'none';
            
            // 如果显示风场视图，绘制风场数据
            if (isVisible && this.rawData) {
                this.loadWindfieldData();
            }
        });
        
        document.getElementById('show-correlation').addEventListener('change', (e) => {
            const isVisible = e.target.checked;
            document.getElementById('correlation-view').style.display = isVisible ? 'block' : 'none';
            
            // 如果显示相关性视图，绘制相关性数据
            if (isVisible && this.rawData) {
                this.loadCorrelationData();
            }
        });
    }

    /**
     * 填充日期选择器
     */
    populateDateSelector() {
        const selector = document.getElementById('date-selector');
        selector.innerHTML = '';
        
        // 显示所有日期（不再采样）
        this.availableDates.forEach(date => {
            const year = date.substring(0, 4);
            const month = date.substring(4, 6);
            const day = date.substring(6, 8);
            const option = document.createElement('option');
            option.value = date;
            option.textContent = `${year}年${month}月${day}日`;
            if (date === this.currentDate) {
                option.selected = true;
            }
            selector.appendChild(option);
        });
    }

    /**
     * 加载数据
     */
    async loadData(skipLoadingIndicator = false) {
        try {
            if (!skipLoadingIndicator) {
                this.showLoading();
            }
            
            console.time(`加载数据: ${this.currentDate}`);
            
            this.updateLoadingProgress(`正在加载 ${this.currentDate} 的数据...`);
            
            // 加载单日数据（速度更快）
            const rawData = await this.dataLoader.loadDayData(this.currentDate);
            
            // 保存原始数据
            this.rawData = rawData;
            
            this.updateLoadingProgress(`正在处理 ${rawData ? rawData.length : 0} 条数据...`);
            
            if (!rawData || rawData.length === 0) {
                throw new Error('没有数据');
            }
            
            // 提取污染物数据
            const pollutantData = this.dataLoader.extractPollutantData(
                rawData, 
                this.currentPollutant
            );
            
            this.updateLoadingProgress(`正在渲染可视化...`);
            
            if (!pollutantData || pollutantData.length === 0) {
                console.warn(`没有 ${this.currentPollutant} 的数据`);
                this.currentData = [];
            } else {
                this.currentData = pollutantData;
            }
            
            // 更新可视化
            this.updateVisualizations();
            
            console.timeEnd(`加载数据: ${this.currentDate}`);
            
        } catch (error) {
            console.error('加载数据失败:', error);
            if (!this.isAnimating) {
                alert('加载数据失败，请检查数据文件是否存在');
            }
            // 清空数据
            this.currentData = [];
            this.rawData = null;
            this.updateVisualizations();
        } finally {
            if (!skipLoadingIndicator) {
                this.hideLoading();
            }
        }
    }

    /**
     * 更新所有可视化
     */
    updateVisualizations() {
        if (!this.currentData || this.currentData.length === 0) {
            console.warn('没有数据可显示');
            return;
        }
        
        // 更新地图
        const stats = this.mapViz.drawDataPoints(this.currentData, this.currentPollutant);
        
        // 加载并更新时间序列（连续多天数据）
        this.loadTimeseriesData();
        
        // 更新风场可视化（如果风场视图可见）
        const windfieldView = document.getElementById('windfield-view');
        if (windfieldView && windfieldView.style.display !== 'none' && this.rawData) {
            this.loadWindfieldData();
        }
        
        // 更新相关性可视化（如果相关性视图可见）
        const correlationView = document.getElementById('correlation-view');
        if (correlationView && correlationView.style.display !== 'none' && this.rawData) {
            this.loadCorrelationData();
        }
        
        // 更新统计信息
        this.updateStats(this.currentData);
    }

    /**
     * 加载时间序列数据（连续多天）
     */
    async loadTimeseriesData() {
        try {
            this.updateLoadingProgress(`正在加载最近${this.timeseriesDays}天的时间序列数据...`);
            
            console.time(`时间序列加载-${this.timeseriesDays}天`);
            
            // 加载连续多天的数据（并行加载）
            const timeseriesData = await this.dataLoader.loadConsecutiveDays(
                this.currentDate,
                this.timeseriesDays
            );
            
            if (timeseriesData && timeseriesData.length > 0) {
                this.updateLoadingProgress('正在提取污染物数据...');
                
                // 提取当前污染物的数据
                const pollutantData = this.dataLoader.extractPollutantData(
                    timeseriesData,
                    this.currentPollutant
                );
                
                this.updateLoadingProgress('正在渲染时间序列...');
                
                // 根据数据量决定是否采样
                let finalData = pollutantData;
                if (pollutantData.length > 50000) {
                    const sampleRate = Math.ceil(pollutantData.length / 30000); // 采样到3万条左右
                    finalData = this.dataLoader.sampleTimeseriesData(pollutantData, sampleRate);
                }
                
                // 绘制时间序列
                this.timeseriesViz.draw(finalData, this.currentPollutant);
            } else {
                console.warn('时间序列数据加载失败');
            }
            
            console.timeEnd(`时间序列加载-${this.timeseriesDays}天`);
            
        } catch (error) {
            console.error('加载时间序列数据失败:', error);
        }
    }

    /**
     * 加载风场数据
     */
    loadWindfieldData() {
        if (!this.rawData || this.rawData.length === 0) {
            console.warn('没有原始数据用于风场可视化');
            return;
        }

        // 提取风场相关数据
        const windfieldData = this.rawData.map(d => ({
            lat: d.lat,
            lon: d.lon,
            u: d.u || d['U(m/s)'] || 0,
            v: d.v || d['V(m/s)'] || 0,
            date: d.date,
            pollutant: this.currentPollutant
        }));

        // 绘制风场
        this.windfieldViz.draw(windfieldData, this.currentPollutant);
    }

    /**
     * 加载相关性分析数据
     */
    loadCorrelationData() {
        if (!this.rawData || this.rawData.length === 0) {
            console.warn('没有原始数据用于相关性分析');
            return;
        }

        // 准备相关性分析数据（使用采样数据以提高性能）
        const sampleRate = Math.ceil(this.rawData.length / 1000);
        const sampledData = this.rawData.filter((d, i) => i % sampleRate === 0);

        // 绘制相关性热力图
        this.correlationViz.draw(sampledData);
    }

    /**
     * 更新统计信息面板
     */
    updateStats(data) {
        if (!data || data.length === 0) {
            const statsContent = document.getElementById('stats-content');
            statsContent.innerHTML = '<p style="color: #999;">暂无数据</p>';
            return;
        }
        
        const values = data.map(d => d.value).filter(v => v != null && !isNaN(v));
        
        if (values.length === 0) {
            const statsContent = document.getElementById('stats-content');
            statsContent.innerHTML = '<p style="color: #999;">数据无效</p>';
            return;
        }
        
        const stats = {
            mean: (d3.mean(values) || 0).toFixed(2),
            median: (d3.median(values) || 0).toFixed(2),
            min: (d3.min(values) || 0).toFixed(2),
            max: (d3.max(values) || 0).toFixed(2),
            std: (d3.deviation(values) || 0).toFixed(2),
            count: data.length
        };
        
        const statsContent = document.getElementById('stats-content');
        statsContent.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">平均值:</span>
                <span class="stat-value">${stats.mean}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">中位数:</span>
                <span class="stat-value">${stats.median}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">最小值:</span>
                <span class="stat-value">${stats.min}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">最大值:</span>
                <span class="stat-value">${stats.max}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">标准差:</span>
                <span class="stat-value">${stats.std}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">数据点数:</span>
                <span class="stat-value">${stats.count}</span>
            </div>
        `;
    }

    /**
     * 开始动画
     */
    startAnimation() {
        if (this.isAnimating) return;
        
        this.isAnimating = true;
        let dateIndex = this.availableDates.indexOf(this.currentDate);
        if (dateIndex === -1) dateIndex = 0;
        
        this.animationInterval = setInterval(async () => {
            dateIndex = (dateIndex + 1) % this.availableDates.length;
            this.currentDate = this.availableDates[dateIndex];
            document.getElementById('date-selector').value = this.currentDate;
            
            // 显示加载状态
            this.showLoading();
            
            try {
                // 加载数据并等待完成
                await this.loadData();
            } catch (error) {
                console.error('动画加载数据失败:', error);
            }
        }, 1500); // 1.5秒切换一次（单日数据加载快）
    }

    /**
     * 停止动画
     */
    stopAnimation() {
        this.isAnimating = false;
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    /**
     * 显示加载状态
     */
    showLoading(message = '正在加载数据...') {
        const loadingBar = document.getElementById('loading-bar');
        const loadingText = document.getElementById('loading-text');
        if (loadingText) loadingText.textContent = message;
        loadingBar.classList.remove('hidden');
    }

    /**
     * 更新加载进度
     */
    updateLoadingProgress(message) {
        const progress = document.getElementById('loading-progress');
        if (progress) progress.textContent = message;
    }

    /**
     * 隐藏加载状态
     */
    hideLoading() {
        document.getElementById('loading-bar').classList.add('hidden');
        const progress = document.getElementById('loading-progress');
        if (progress) progress.textContent = '';
    }
}

// 初始化应用
const app = new AirQualityApp();
app.init();

