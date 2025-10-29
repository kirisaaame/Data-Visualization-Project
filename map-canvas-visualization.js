/**
 * Canvas地图可视化模块 - 高性能版本
 */

class CanvasMapVisualization {
    constructor(containerId, width = 900, height = 600) {
        this.containerId = containerId;
        this.width = width;
        this.height = height;
        
        // 中国地图的经纬度边界
        this.bounds = {
            minLat: 18, maxLat: 54,
            minLon: 70, maxLon: 140
        };
        
        this.canvas = null;
        this.ctx = null;
        this.colorScale = null;
        this.backgroundOpacity = 0.0; // 背景图透明度，突出前景要素
        
        // 墨卡托投影
        this.projection = d3.geoMercator()
            .center([105, 35])
            .scale(650)
            .translate([this.width / 2, this.height / 2]);
    }

    /**
     * 初始化Canvas
     */
    init() {
        const container = d3.select(this.containerId);
        
        // 清除旧内容
        container.selectAll("canvas").remove();
        
        // 创建canvas元素
        this.canvas = container.append("canvas")
            .style("width", `${this.width}px`)
            .style("height", `${this.height}px`)
            .style("border", "1px solid #e0e0e0")
            .style("border-radius", "4px")
            .style("background", "#1a1a2e")  // 深色背景，提高对比度
            .node();
        
        this.ctx = this.canvas.getContext('2d');
        
        // 设置canvas实际尺寸（支持高DPI屏幕）
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    /**
     * 设置颜色比例尺
     */
    setColorScale(data, pollutant) {
        if (!data || data.length === 0) {
            return { minVal: 0, maxVal: 0 };
        }
        
        const values = data.map(d => d.value).filter(v => v != null && !isNaN(v));
        
        if (values.length === 0) {
            return { minVal: 0, maxVal: 0 };
        }
        
        const [minVal, maxVal] = d3.extent(values);
        
        // 使用RdYlGn颜色方案：最大值=红色，最小值=绿色
        // 注意：domain设置为[maxVal, minVal]，这样大值对应红，小值对应绿
        this.colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
            .domain([maxVal, minVal]);
        
        return { minVal: minVal || 0, maxVal: maxVal || 0 };
    }

    /**
     * 智能采样数据 - 基于地理分布
     */
    sampleData(data, maxPoints = 600) {
        if (data.length <= maxPoints) return data;
        
        // 使用网格采样，确保空间分布均匀
        const gridSize = 50; // 50x50的网格
        const cellSize = (this.bounds.maxLat - this.bounds.minLat) / gridSize;
        
        // 将数据点分配到网格
        const grid = new Map();
        
        data.forEach((d, i) => {
            if (i % 3 === 0) { // 先粗采样
                const gridX = Math.floor((d.lat - this.bounds.minLat) / cellSize);
                const gridY = Math.floor((d.lon - this.bounds.minLon) / cellSize);
                const key = `${gridX},${gridY}`;
                
                if (!grid.has(key)) {
                    grid.set(key, d);
                }
            }
        });
        
        const sampledData = Array.from(grid.values());
        
        // 如果采样后仍然太多，再次采样
        if (sampledData.length > maxPoints) {
            const step = Math.ceil(sampledData.length / maxPoints);
            return sampledData.filter((d, i) => i % step === 0);
        }
        
        return sampledData;
    }

    /**
     * 绘制数据点 - 使用Canvas批量绘制
     */
    drawDataPoints(data, pollutant) {
        if (!this.canvas) this.init();
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // 绘制背景图（若已加载），否则使用纯色
        if (!this.bgImage) {
            this.bgImage = new Image();
            this.bgReady = false;
            this.bgImage.onload = () => {
                this.bgReady = true;
                // 背景加载后重绘一帧
                if (data && data.length) {
                    this.drawDataPoints(data, pollutant);
                }
            };
            this.bgImage.src = 'map.jpg';
        }
        if (this.bgReady) {
            this.ctx.save();
            this.ctx.globalAlpha = this.backgroundOpacity;
            this.ctx.drawImage(this.bgImage, 0, 0, this.width, this.height);
            this.ctx.restore();
        } else {
            this.ctx.fillStyle = "#1a1a2e";
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        
        // 检查数据是否有效
        if (!data || data.length === 0) {
            console.warn('没有数据可绘制');
            return { minVal: 0, maxVal: 0 };
        }
        
        // 智能采样数据
        const sampleData = this.sampleData(data, 600);
        
        console.log(`渲染 ${sampleData.length} 个数据点 (原始 ${data.length} 个)`);
        
        if (sampleData.length === 0) {
            console.warn('采样后没有数据');
            return { minVal: 0, maxVal: 0 };
        }
        
        // 设置颜色比例尺
        const { minVal, maxVal } = this.setColorScale(sampleData, pollutant);
        
        if (!this.colorScale) {
            return { minVal: 0, maxVal: 0 };
        }
        
        // 使用Canvas绘制点（更快）
        this.ctx.lineWidth = 0.5;
        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';  // 白色边框，半透明
        
        // 提高透明度，使颜色更鲜艳清晰
        const opacity = 0.95;
        
        for (const d of sampleData) {
            const [x, y] = this.projection([d.lon, d.lat]);
            
            if (!isNaN(x) && !isNaN(y) && x >= 0 && x < this.width && y >= 0 && y < this.height) {
                // 获取颜色并添加统一的不透明度
                const color = d3.rgb(this.colorScale(d.value));
                this.ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${opacity})`;
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, 2, 0, 2 * Math.PI);
                this.ctx.fill();
                this.ctx.stroke();
            }
        }
        
        // 更新图例
        this.updateLegend(minVal, maxVal, pollutant);
        
        return { minVal, maxVal };
    }

    /**
     * 更新图例
     */
    updateLegend(minVal, maxVal, pollutant) {
        // 清除旧图例
        d3.select(this.containerId).selectAll("div.legend-container").remove();
        
        if (!this.colorScale || minVal === maxVal || isNaN(minVal) || isNaN(maxVal)) {
            return;
        }
        
        // 创建图例容器
        const legend = d3.select(this.containerId)
            .append("div")
            .attr("class", "legend-container")
            .style("position", "absolute")
            .style("right", "20px")
            .style("top", "30px")
            .style("background", "rgba(26,26,46,0.95)")
            .style("padding", "10px")
            .style("padding-right", "60px") // 增加右侧内边距，为刻度留空间
            .style("border-radius", "4px")
            .style("box-shadow", "0 2px 8px rgba(0,0,0,0.3)")
            .style("font-size", "12px")
            .style("color", "white");
        
        // 标题
        legend.append("div")
            .style("font-weight", "bold")
            .style("margin-bottom", "5px")
            .text(pollutant);
        
        // 创建渐变色条
        const legendHeight = 150;
        const legendWidth = 20;
        
        const legendCanvas = legend.append("canvas")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .node();
        
        const legendCtx = legendCanvas.getContext('2d');
        
        // 绘制渐变：顶部为最大值（红色），底部为最小值（绿色）
        for (let i = 0; i <= legendHeight; i++) {
            // i从0到legendHeight，value从maxVal到minVal（因为我们从顶部画到底部）
            const value = maxVal - (maxVal - minVal) * (i / legendHeight);
            const color = d3.rgb(this.colorScale(value));
            legendCtx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.95)`;
            // 顶部绘制maxVal（红色），底部绘制minVal（绿色）
            legendCtx.fillRect(0, i, legendWidth, 1);
        }
        
        // 添加刻度（白色文字）：顶部显示maxVal，底部显示minVal
        // 使用绝对定位，相对于图例容器
        const topTick = legend.append("div")
            .style("position", "absolute")
            .style("left", "35px")  // 颜色条宽度20 + 间距15
            .style("top", "25px")   // 向下移动，避免与标题重合
            .style("color", "white")
            .style("font-size", "10px")
            .style("white-space", "nowrap"); // 防止换行
        topTick.text(maxVal.toFixed(1));
        
        const bottomTick = legend.append("div")
            .style("position", "absolute")
            .style("left", "35px")
            .style("top", "165px")  // padding 10px + 标题 5px + 150px颜色条
            .style("color", "white")
            .style("font-size", "10px")
            .style("white-space", "nowrap"); // 防止换行
        bottomTick.text(minVal.toFixed(1));
    }

    /**
     * 清空地图
     */
    clear() {
        if (this.canvas) {
            this.ctx.clearRect(0, 0, this.width, this.height);
            this.ctx.fillStyle = "#f8f9fa";
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        
        // 清除图例
        d3.select(this.containerId).selectAll("div.legend-container").remove();
    }
}

export default CanvasMapVisualization;

