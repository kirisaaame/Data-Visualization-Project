/**
 * 时间序列可视化模块 - 使用D3.js绘制折线图
 */

class TimeseriesVisualization {
    constructor(containerId, width = 800, height = 300) {
        this.containerId = containerId;
        this.width = width;
        this.height = height;
        this.margin = { top: 30, right: 30, bottom: 50, left: 60 };
        
        this.svg = null;
        this.xScale = null;
        this.yScale = null;
        this.displayDays = 30; // 默认显示30天
        this.currentData = null;
    }

    /**
     * 初始化SVG
     */
    init() {
        const container = d3.select(this.containerId);
        
        container.selectAll("svg").remove();
        
        this.svg = container.append("svg")
            .attr("width", this.width)
            .attr("height", this.height);
        
        return this.svg;
    }

    /**
     * 设置显示天数
     */
    setDisplayDays(days) {
        this.displayDays = days;
    }
    
    /**
     * 绘制时间序列
     */
    draw(data, pollutant) {
        if (!this.svg) this.init();
        
        if (!data || data.length === 0) {
            console.warn('时间序列数据为空');
            this.svg.append("text")
                .attr("x", this.width / 2)
                .attr("y", this.height / 2)
                .attr("text-anchor", "middle")
                .attr("font-size", "14px")
                .attr("fill", "#999")
                .text("暂无数据");
            return;
        }
        
        // 保存当前数据
        this.currentData = data;
        
        // 清除旧内容
        this.svg.selectAll("*").remove();
        
        // 按日期聚合（均值）
        const dataByDate = d3.group(data, d => d.date);
        const aggregatedData = Array.from(dataByDate.entries()).map(([date, values]) => {
            const meanValue = d3.mean(values, d => d.value);
            return { date, value: meanValue, pollutant };
        }).sort((a, b) => a.date.localeCompare(b.date));
        
        // 设置比例尺 - 使用time scale显示日期
        const parseDate = d3.timeParse("%Y%m%d");
        const dates = aggregatedData.map(d => parseDate(d.date));
        
        this.xScale = d3.scaleTime()
            .domain(d3.extent(dates))
            .range([this.margin.left, this.width - this.margin.right]);
        
        const [minVal, maxVal] = d3.extent(aggregatedData, d => d.value);
        this.yScale = d3.scaleLinear()
            .domain([0, maxVal * 1.1])
            .nice()
            .range([this.height - this.margin.bottom, this.margin.top]);
        
        // 创建线生成器
        const line = d3.line()
            .x(d => this.xScale(parseDate(d.date)))
            .y(d => this.yScale(d.value))
            .curve(d3.curveMonotoneX);
        
        // 绘制网格线
        this.svg.append("g")
            .attr("class", "grid")
            .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
            .call(d3.axisBottom(this.xScale).tickSize(-this.height + this.margin.top + this.margin.bottom))
            .attr("stroke-dasharray", "3,3")
            .attr("opacity", 0.1);
        
        // 绘制折线
        this.svg.append("path")
            .datum(aggregatedData)
            .attr("fill", "none")
            .attr("stroke", "#2c5aa0")
            .attr("stroke-width", 2)
            .attr("d", line);
        
        // 绘制数据点（交互）
        this.svg.selectAll("circle")
            .data(aggregatedData)
            .enter()
            .append("circle")
            .attr("cx", d => this.xScale(parseDate(d.date)))
            .attr("cy", d => this.yScale(d.value))
            .attr("r", 4)
            .attr("fill", "#2c5aa0")
            .attr("cursor", "pointer")
            .on("mouseover", function(event, d) {
                d3.select(this)
                    .attr("r", 6)
                    .attr("fill", "#ff6b6b");
            })
            .on("mouseout", function() {
                d3.select(this)
                    .attr("r", 4)
                    .attr("fill", "#2c5aa0");
            });
        
        // 绘制X轴
        this.svg.append("g")
            .attr("transform", `translate(0, ${this.height - this.margin.bottom})`)
            .attr("class", "axis")
            .call(d3.axisBottom(this.xScale).ticks(8))
            .selectAll("text")
            .attr("fill", "white")
            .style("font-size", "10px");
        
        // 绘制Y轴
        this.svg.append("g")
            .attr("transform", `translate(${this.margin.left}, 0)`)
            .attr("class", "axis")
            .call(d3.axisLeft(this.yScale))
            .selectAll("text")
            .attr("fill", "white")
            .style("font-size", "10px");
        
        // 添加标题
        this.svg.append("text")
            .attr("x", this.width / 2)
            .attr("y", 20)
            .attr("text-anchor", "middle")
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .attr("fill", "white")
            .text(`${pollutant} 时间序列 (过去 ${aggregatedData.length-1} 天)`);
        
        // 添加Y轴标签
        this.svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("y", 15)
            .attr("x", -this.height / 2)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", "white")
            .text("浓度值");
    }

    /**
     * 清空图表
     */
    clear() {
        if (this.svg) {
            this.svg.selectAll("*").remove();
        }
        this.currentData = null;
    }
}

export default TimeseriesVisualization;

