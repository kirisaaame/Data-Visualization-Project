/**
 * 风场2D Canvas可视化模块
 */

class WindfieldCanvasVisualization {
    constructor(containerId, width = 900, height = 600) {
        this.containerId = containerId;
        this.width = width;
        this.height = height;
        this.canvas = null;
        this.ctx = null;
        this.currentData = null;
        this.bgImage = null;
        this.bgReady = false;
        this.backgroundOpacity = 0.0; // 背景图透明度，突出风场矢量
    }

    /**
     * 初始化Canvas
     */
    init() {
        const container = document.querySelector(this.containerId);
        if (!container) {
            console.error('Container not found:', this.containerId);
            return;
        }

        // 清空容器
        container.innerHTML = '';

        // 创建canvas
        this.canvas = document.createElement('canvas');
        container.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // 设置canvas尺寸（考虑高DPI屏幕）
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.scale(dpr, dpr);

        // 预加载背景图
        this.bgImage = new Image();
        this.bgImage.onload = () => {
            this.bgReady = true;
            if (this.currentData) {
                // 背景加载后重绘
                this.draw(this.currentData);
            }
        };
        this.bgImage.src = 'map.jpg';
        
        // 初始底色
        this.ctx.fillStyle = '#1a1a2e';
        this.ctx.fillRect(0, 0, this.width, this.height);
    }

    /**
     * 绘制风场向量
     */
    draw(data, pollutant) {
        if (!this.canvas) this.init();
        
        if (!data || data.length === 0) {
            console.warn('没有风场数据');
            this.clear();
            return;
        }

        this.currentData = data;

        // 清除并绘制背景
        this.ctx.clearRect(0, 0, this.width, this.height);
        if (this.bgReady) {
            this.ctx.save();
            this.ctx.globalAlpha = this.backgroundOpacity;
            this.ctx.drawImage(this.bgImage, 0, 0, this.width, this.height);
            this.ctx.restore();
        } else {
            this.ctx.fillStyle = '#1a1a2e';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }

        // 计算数据范围
        const coords = data.map(d => ({ lat: d.lat, lon: d.lon }));
        // 使用固定的中国范围以匹配背景图
        const latRange = [18, 54];
        const lonRange = [70, 140];

        // 创建比例尺（地图投影）
        const margin = { top: 20, right: 20, bottom: 20, left: 20 };
        const plotWidth = this.width - margin.left - margin.right;
        const plotHeight = this.height - margin.top - margin.bottom;

        const scaleX = d3.scaleLinear()
            .domain(lonRange)
            .range([margin.left, this.width - margin.right]);

        // Canvas Y轴向下，需要反转
        const scaleY = d3.scaleLinear()
            .domain(latRange)
            .range([this.height - margin.bottom, margin.top]);

        // 使用网格采样，确保空间分布均匀（避免低纬度重叠）
        const sampledData = this.sampleData(data, 600);
        
        console.log(`绘制 ${sampledData.length} 个风场向量`);

        // 计算风速范围用于颜色映射
        const speeds = sampledData.map(d => {
            const u = d.u || d['U(m/s)'] || 0;
            const v = d.v || d['V(m/s)'] || 0;
            return Math.sqrt(u * u + v * v);
        }).filter(s => s > 0.01);
        
        const [minSpeed, maxSpeed] = d3.extent(speeds);
        
        // 创建颜色映射
        const colorScale = d3.scaleSequential()
            .domain([maxSpeed, minSpeed]) // 反转：最大值为红色
            .interpolator(d3.interpolateRdYlGn);

        // 绘制向量
        sampledData.forEach(d => {
            const u = d.u || d['U(m/s)'] || 0;
            const v = d.v || d['V(m/s)'] || 0;
            const speed = Math.sqrt(u * u + v * v);

            // 跳过风速为0的点
            if (speed < 0.01) return;

            // 计算位置
            const x = scaleX(d.lon);
            const y = scaleY(d.lat);

            // 绘制向量箭头
            this.drawVector(x, y, u, v, speed, colorScale(speed));
        });
    }

    /**
     * 智能采样数据 - 基于地理分布（避免重叠）
     */
    sampleData(data, maxPoints = 600) {
        if (data.length <= maxPoints) return data;
        
        // 使用网格采样，确保空间分布均匀
        const gridSize = 50; // 50x50的网格
        const latRange = d3.extent(data, d => d.lat);
        const lonRange = d3.extent(data, d => d.lon);
        const latCellSize = (latRange[1] - latRange[0]) / gridSize;
        const lonCellSize = (lonRange[1] - lonRange[0]) / gridSize;
        
        // 将数据点分配到网格
        const grid = new Map();
        
        data.forEach(d => {
            // 计算网格索引
            const gridX = Math.floor((d.lat - latRange[0]) / latCellSize);
            const gridY = Math.floor((d.lon - lonRange[0]) / lonCellSize);
            const key = `${gridX},${gridY}`;
            
            // 每个网格只保留第一个数据点
            if (!grid.has(key)) {
                grid.set(key, d);
            }
        });
        
        let sampledData = Array.from(grid.values());
        
        // 如果采样后仍然太多，再次采样
        if (sampledData.length > maxPoints) {
            const step = Math.ceil(sampledData.length / maxPoints);
            sampledData = sampledData.filter((d, i) => i % step === 0);
        }
        
        return sampledData;
    }

    /**
     * 绘制单个向量箭头
     */
    drawVector(x, y, u, v, speed, color) {
        const ctx = this.ctx;

        // 固定向量长度
        const vectorLength = 8;
        
        // 计算角度
        // Canvas坐标系：X向右为正，Y向下为正
        // 所以对于风向，需要调整角度的计算
        const angle = Math.atan2(v, u);

        // 保存上下文
        ctx.save();

        // 移动到起点
        ctx.translate(x, y);
        ctx.rotate(angle);

        // 绘制向量线
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1;
        
        // 绘制主体（直线）
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(vectorLength * 0.8, 0);
        ctx.stroke();

        // 绘制箭头头部
        const headLength = vectorLength * 0.2;
        const headWidth = 3;
        
        ctx.beginPath();
        ctx.moveTo(vectorLength * 0.8, 0);
        ctx.lineTo(vectorLength * 0.8 - headLength, -headWidth);
        ctx.lineTo(vectorLength * 0.8 - headLength, headWidth);
        ctx.closePath();
        ctx.fill();

        // 恢复上下文
        ctx.restore();
    }

    /**
     * 清空画布
     */
    clear() {
        if (this.ctx) {
            this.ctx.fillStyle = '#1a1a2e';
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        this.currentData = null;
    }

    /**
     * 销毁
     */
    dispose() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
        this.canvas = null;
        this.ctx = null;
    }
}

export default WindfieldCanvasVisualization;

