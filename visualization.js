// 可视化主逻辑
const API_BASE = 'http://localhost:5000/api';
let map;
let heatmapLayer = null;

// 污染物颜色映射
const pollutantColors = {
    pm25: {
        color: ['#d73027', '#fc8d59', '#fee08b', '#e0f3f8', '#4575b4'],
        range: [0, 35, 75, 115, 150, 999],
        label: 'PM2.5 (μg/m³)'
    },
    pm10: {
        color: ['#d73027', '#fc8d59', '#fee08b', '#e0f3f8', '#4575b4'],
        range: [0, 50, 100, 150, 200, 999],
        label: 'PM10 (μg/m³)'
    },
    so2: {
        color: ['#d73027', '#fc8d59', '#fee08b', '#e0f3f8', '#4575b4'],
        range: [0, 50, 100, 150, 200, 999],
        label: 'SO₂ (μg/m³)'
    },
    no2: {
        color: ['#d73027', '#fc8d59', '#fee08b', '#e0f3f8', '#4575b4'],
        range: [0, 40, 80, 120, 200, 999],
        label: 'NO₂ (μg/m³)'
    },
    co: {
        color: ['#d73027', '#fc8d59', '#fee08b', '#e0f3f8', '#4575b4'],
        range: [0, 1, 2, 4, 10, 999],
        label: 'CO (mg/m³)'
    },
    o3: {
        color: ['#d73027', '#fc8d59', '#fee08b', '#e0f3f8', '#4575b4'],
        range: [0, 100, 160, 215, 800, 999],
        label: 'O₃ (μg/m³)'
    }
};

// 初始化地图
function initMap() {
    // 创建地图实例，设置中心点为中国中部
    map = L.map('map').setView([35.0, 110.0], 5);
    
    // 添加OpenStreetMap底图
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 10,
        minZoom: 3
    }).addTo(map);
    
    // 设置边界限制在中国范围内
    const bounds = [[18, 70], [54, 140]];
    map.setMaxBounds(bounds);
    map.setMinZoom(4);
}

// 获取数值对应的颜色
function getColorByValue(value, config) {
    const { color, range } = config;
    
    if (value <= range[1]) return color[0];
    if (value <= range[2]) return color[1];
    if (value <= range[3]) return color[2];
    if (value <= range[4]) return color[3];
    return color[4];
}

// 在统计面板显示数据
function displayStats(data, pollutant) {
    const statsContainer = document.getElementById('stats');
    
    if (!data || data.length === 0) {
        statsContainer.innerHTML = '<p style="color: #999;">暂无数据</p>';
        return;
    }
    
    // 计算统计数据
    const values = data.map(d => d.value);
    const mean = d3.mean(values);
    const median = d3.median(values);
    const min = d3.min(values);
    const max = d3.max(values);
    const std = d3.deviation(values);
    
    const config = pollutantColors[pollutant];
    
    statsContainer.innerHTML = `
        <div class="stat-item">
            <div class="stat-label">平均值</div>
            <div class="stat-value">${mean ? mean.toFixed(2) : 'N/A'}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">中位数</div>
            <div class="stat-value">${median ? median.toFixed(2) : 'N/A'}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">最小值</div>
            <div class="stat-value">${min ? min.toFixed(2) : 'N/A'}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">最大值</div>
            <div class="stat-value">${max ? max.toFixed(2) : 'N/A'}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">标准差</div>
            <div class="stat-value">${std ? std.toFixed(2) : 'N/A'}</div>
        </div>
        <div class="stat-item">
            <div class="stat-label">数据点数</div>
            <div class="stat-value">${data.length}</div>
        </div>
    `;
}

// 更新图例
function updateLegend(pollutant) {
    const legendContainer = document.getElementById('map-legend');
    const config = pollutantColors[pollutant];
    
    let html = `<div class="legend-title">${config.label}</div>`;
    
    for (let i = 0; i < config.color.length; i++) {
        const min = config.range[i];
        const max = config.range[i + 1];
        html += `
            <div class="legend-item">
                <div class="legend-color" style="background: ${config.color[i]};"></div>
                <span>${min} - ${max === 999 ? '∞' : max}</span>
            </div>
        `;
    }
    
    legendContainer.innerHTML = html;
}

// 在地图上绘制数据点
function drawDataPoints(data, pollutant) {
    // 清除之前的热力图层
    if (heatmapLayer) {
        map.removeLayer(heatmapLayer);
    }
    
    if (!data || data.length === 0) return;
    
    const config = pollutantColors[pollutant];
    const markers = [];
    
    // 采样数据，避免绘制过多点导致性能问题
    const sampleSize = Math.min(1000, data.length);
    const sampledData = data.slice(0, sampleSize);
    
    sampledData.forEach(point => {
        if (point.lat && point.lon && point.value) {
            const color = getColorByValue(point.value, config);
            
            const circle = L.circleMarker([point.lat, point.lon], {
                radius: 4,
                fillColor: color,
                color: '#fff',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.6
            }).bindPopup(`
                <strong>位置:</strong> ${point.lat.toFixed(2)}, ${point.lon.toFixed(2)}<br>
                <strong>数值:</strong> ${point.value.toFixed(2)}<br>
                <strong>日期:</strong> ${point.date}
            `);
            
            markers.push(circle);
        }
    });
    
    // 使用 MarkerClusterGroup 进行聚合
    if (typeof L.markerClusterGroup !== 'undefined') {
        heatmapLayer = L.markerClusterGroup();
        markers.forEach(m => heatmapLayer.addLayer(m));
        map.addLayer(heatmapLayer);
    } else {
        heatmapLayer = L.layerGroup(markers);
        map.addLayer(heatmapLayer);
    }
}

// 加载数据
async function loadData() {
    const month = document.getElementById('month-selector').value;
    const pollutant = document.getElementById('pollutant-selector').value;
    const loadingDiv = document.getElementById('loading');
    
    loadingDiv.classList.remove('hidden');
    
    try {
        // 计算日期范围（月初到月末）
        const year = month.slice(0, 4);
        const mon = month.slice(4, 6);
        const startDate = `${year}${mon}01`;
        
        // 获取该月天数
        const daysInMonth = new Date(year, parseInt(mon), 0).getDate();
        const endDate = `${year}${mon}${daysInMonth}`;
        
        // 调用API
        const url = `${API_BASE}/data?start=${startDate}&end=${endDate}&pollutant=${pollutant}&min_lat=18&max_lat=54&min_lon=70&max_lon=140`;
        
        console.log('正在请求数据:', url);
        
        const response = await fetch(url);
        const result = await response.json();
        
        console.log('收到数据:', result);
        
        if (result.status === 'success' && result.data) {
            drawDataPoints(result.data, pollutant);
            displayStats(result.data, pollutant);
            updateLegend(pollutant);
        } else {
            alert('数据加载失败: ' + (result.message || '未知错误'));
        }
    } catch (error) {
        console.error('加载数据时出错:', error);
        alert('加载数据时出错，请确保后端API服务正在运行');
    } finally {
        loadingDiv.classList.add('hidden');
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initMap();
    updateLegend('pm25');
    
    // 绑定加载按钮事件
    document.getElementById('load-button').addEventListener('click', loadData);
    
    // 默认加载一次数据
    // loadData();
    
    console.log('可视化系统初始化完成');
});

