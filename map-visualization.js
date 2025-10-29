/**
 * 地图可视化模块 - 使用D3.js绘制中国地图
 */

class MapVisualization {
    constructor(containerId, width = 800, height = 600) {
        this.containerId = containerId;
        this.width = width;
        this.height = height;
        this.margin = { top: 20, right: 20, bottom: 20, left: 20 };
        
        // 中国地图的经纬度边界
        this.bounds = {
            minLat: 18, maxLat: 54,
            minLon: 70, maxLon: 140
        };
        
        this.projection = d3.geoMercator()
            .center([105, 35])
            .scale(650)
            .translate([this.width / 2, this.height / 2]);
        
        this.svg = null;
        this.colorScale = null;
    }

    /**
     * 初始化SVG
     */
    init() {
        const container = d3.select(this.containerId)
            .style("width", `${this.width}px`)
            .style("height", `${this.height}px`);
        
        this.svg = container.append("svg")
            .attr("width", this.width)
            .attr("height", this.height);
        
        // 添加背景
        this.svg.append("rect")
            .attr("width", this.width)
            .attr("height", this.height)
            .attr("fill", "#f8f9fa");
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
        
        this.colorScale = d3.scaleSequential(d3.interpolateRdYlGn)
            .domain([maxVal, minVal]);
        
        return { minVal: minVal || 0, maxVal: maxVal || 0 };
    }

    /**
     * 绘制数据点
     */
    drawDataPoints(data, pollutant) {
        if (!this.svg) this.init();
        
        // 清除旧的点
        this.svg.selectAll("circle.data-point").remove();
        
        // 检查数据是否有效
        if (!data || data.length === 0) {
            console.warn('没有数据可绘制');
            // 清空图例
            if (this.svg) {
                this.svg.selectAll(".legend").remove();
                this.svg.selectAll("#legend-gradient").remove();
            }
            return { minVal: 0, maxVal: 0 };
        }
        
        // 采样数据
        const sampleData = this.sampleData(data, 1500);
        
        if (sampleData.length === 0) {
            console.warn('采样后没有数据');
            // 清空图例
            if (this.svg) {
                this.svg.selectAll(".legend").remove();
                this.svg.selectAll("#legend-gradient").remove();
            }
            return { minVal: 0, maxVal: 0 };
        }
        
        // 设置颜色比例尺
        const { minVal, maxVal } = this.setColorScale(sampleData, pollutant);
        
        // 绘制点
        const circles = this.svg.selectAll("circle.data-point")
            .data(sampleData)
            .enter()
            .append("circle")
            .attr("class", "data-point")
            .attr("cx", d => this.projection([d.lon, d.lat])[0])
            .attr("cy", d => this.projection([d.lon, d.lat])[1])
            .attr("r", 2)
            .attr("fill", d => this.colorScale(d.value))
            .attr("fill-opacity", 0.7)
            .attr("stroke", "#fff")
            .attr("stroke-width", 0.5)
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .attr("r", 4)
                    .attr("stroke-width", 1);
                
                // 显示工具提示
                const tooltip = d3.select("body")
                    .append("div")
                    .attr("class", "tooltip")
                    .style("opacity", 0)
                    .style("position", "absolute")
                    .style("background", "rgba(0,0,0,0.8)")
                    .style("color", "white")
                    .style("padding", "8px")
                    .style("border-radius", "4px")
                    .style("font-size", "12px")
                    .style("pointer-events", "none");
                
                tooltip.transition()
                    .duration(200)
                    .style("opacity", 1);
                
                tooltip.html(`
                    <strong>${pollutant}</strong><br>
                    数值: ${d.value.toFixed(2)}<br>
                    日期: ${d.date}<br>
                    位置: (${d.lat.toFixed(2)}, ${d.lon.toFixed(2)})
                `)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY - 10) + "px");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .attr("r", 2)
                    .attr("stroke-width", 0.5);
                
                d3.select("body").selectAll(".tooltip").remove();
            });
        
        // 更新图例
        this.updateLegend(minVal, maxVal, pollutant);
        
        return { minVal, maxVal };
    }

    /**
     * 采样数据
     */
    sampleData(data, maxPoints = 1500) {
        if (data.length <= maxPoints) return data;
        const step = Math.ceil(data.length / maxPoints);
        return data.filter((d, i) => i % step === 0);
    }

    /**
     * 更新图例
     */
    updateLegend(minVal, maxVal, pollutant) {
        if (!this.svg) this.init();
        
        // 清除旧图例
        this.svg.selectAll(".legend").remove();
        this.svg.selectAll("#legend-gradient").remove();
        
        // 检查值是否有效
        if (!this.colorScale || minVal === maxVal || isNaN(minVal) || isNaN(maxVal)) {
            console.warn('无法创建图例，数据无效');
            return;
        }
        
        const legendHeight = 150;
        const legendWidth = 20;
        
        // 创建图例渐变
        const defs = this.svg.append("defs");
        const linearGradient = defs.append("linearGradient")
            .attr("id", "legend-gradient")
            .attr("x1", "0%")
            .attr("x2", "0%")
            .attr("y1", "0%")
            .attr("y2", "100%");
        
        const colorScale = this.colorScale;
        const steps = 10;
        for (let i = 0; i <= steps; i++) {
            const value = minVal + (maxVal - minVal) * (i / steps);
            linearGradient.append("stop")
                .attr("offset", `${(i / steps) * 100}%`)
                .attr("stop-color", colorScale(value))
                .attr("stop-opacity", 0.7);
        }
        
        const legend = this.svg.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${this.width - 80}, 30)`);
        
        legend.append("text")
            .attr("x", 0)
            .attr("y", -10)
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .text(pollutant);
        
        legend.append("rect")
            .attr("width", legendWidth)
            .attr("height", legendHeight)
            .attr("fill", "url(#legend-gradient)");
        
        // 添加刻度
        const ticks = 5;
        for (let i = 0; i <= ticks; i++) {
            const value = minVal + (maxVal - minVal) * ((ticks - i) / ticks);
            legend.append("text")
                .attr("x", legendWidth + 5)
                .attr("y", (legendHeight / ticks) * i + 5)
                .style("font-size", "10px")
                .text(value.toFixed(1));
        }
    }

    /**
     * 清空地图
     */
    clear() {
        if (this.svg) {
            this.svg.selectAll("*").remove();
        }
    }
}

export default MapVisualization;

