/**
 * 相关性分析可视化模块 - 散点图矩阵和热力图
 */

class CorrelationVisualization {
    constructor(containerId, width = 900, height = 600) {
        this.containerId = containerId;
        this.width = width;
        this.height = height;
        this.margin = { top: 60, right: 40, bottom: 40, left: 60 };
        this.cellSize = 80;
        this.currentData = null;
    }

    /**
     * 初始化SVG
     */
    init() {
        const container = document.querySelector(this.containerId);
        if (!container) {
            console.error('Container not found:', this.containerId);
            return;
        }

        // 清空容器
        container.innerHTML = '';

        // 创建SVG
        this.svg = d3.select(this.containerId)
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('background', '#1a1a2e');
    }

    /**
     * 绘制相关性热力图
     */
    draw(data) {
        if (!this.svg) this.init();

        if (!data || data.length === 0) {
            console.warn('没有数据用于相关性分析');
            this.clear();
            return;
        }

        this.currentData = data;

        // 清除旧内容
        this.svg.selectAll('*').remove();

        // 定义要分析的变量
        // 去除风场分量U、V，它们不是污染物，不参与相关性矩阵
        const variables = ['PM2.5', 'PM10', 'SO2', 'NO2', 'CO', 'O3', '温度', '湿度'];
        
        // 获取数据中实际存在的变量
        const availableVars = variables.filter(v => {
            return data.some(d => d[v] !== undefined || d[this.getColumnName(d, v)] !== undefined);
        });

        if (availableVars.length < 2) {
            console.warn('可用变量太少，无法进行相关性分析');
            return;
        }

        console.log(`分析 ${availableVars.length} 个变量的相关性`);

        // 计算相关性矩阵
        const correlationMatrix = this.computeCorrelationMatrix(data, availableVars);

        // 绘制热力图
        this.drawHeatmap(correlationMatrix, availableVars);
    }

    /**
     * 获取列名（处理不一致的列名）
     */
    getColumnName(sample, varName) {
        const keys = Object.keys(sample);
        for (let key of keys) {
            if (key.includes(varName) || key.includes(varName.toUpperCase())) {
                return key;
            }
        }
        return null;
    }

    /**
     * 提取数值（处理不同格式的列名）
     */
    extractValue(d, varName) {
        const value = d[varName] || 
                      d[this.getColumnName(d, varName)] ||
                      d[varName + '(微克每立方米)'] ||
                      d[varName + '(mg/m3)'];
        
        if (value === null || value === undefined || isNaN(value)) {
            return null;
        }
        return Number(value);
    }

    /**
     * 计算相关性矩阵
     */
    computeCorrelationMatrix(data, variables) {
        const n = variables.length;
        const matrix = [];

        // 提取数据值
        const values = {};
        variables.forEach(v => {
            values[v] = data.map(d => this.extractValue(d, v)).filter(val => val !== null);
        });

        // 计算每对变量的相关性
        for (let i = 0; i < n; i++) {
            const row = [];
            for (let j = 0; j < n; j++) {
                if (i === j) {
                    row.push(1.0);
                } else {
                    const corr = this.correlation(values[variables[i]], values[variables[j]]);
                    row.push(corr);
                }
            }
            matrix.push(row);
        }

        return matrix;
    }

    /**
     * 计算皮尔逊相关系数
     */
    correlation(x, y) {
        if (x.length !== y.length || x.length === 0) return 0;
        
        const meanX = d3.mean(x);
        const meanY = d3.mean(y);
        
        let numerator = 0;
        let sumSqX = 0;
        let sumSqY = 0;
        
        for (let i = 0; i < x.length; i++) {
            const dx = x[i] - meanX;
            const dy = y[i] - meanY;
            numerator += dx * dy;
            sumSqX += dx * dx;
            sumSqY += dy * dy;
        }
        
        const denominator = Math.sqrt(sumSqX * sumSqY);
        if (denominator === 0) return 0;
        
        return numerator / denominator;
    }

    /**
     * 绘制热力图
     */
    drawHeatmap(matrix, variables) {
        const n = variables.length;
        
        // 创建颜色比例尺
        const colorScale = d3.scaleSequential()
            .domain([-1, 1])
            .interpolator(d3.interpolateRdBu);

        // 创建比例尺
        const xScale = d3.scaleBand()
            .domain(d3.range(n))
            .range([this.margin.left, this.width - this.margin.right])
            .padding(0.05);

        const yScale = d3.scaleBand()
            .domain(d3.range(n))
            .range([this.margin.top, this.height - this.margin.bottom])
            .padding(0.05);

        // 添加标题
        this.svg.append('text')
            .attr('x', this.width / 2)
            .attr('y', 30)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '18px')
            .attr('font-weight', 'bold')
            .text('污染物与气象因子相关性矩阵');

        // 绘制热力格子
        const cells = this.svg.selectAll('.cell')
            .data(matrix.flatMap((row, i) => row.map((value, j) => ({ value, i, j }))))
            .enter()
            .append('g')
            .attr('class', 'cell')
            .attr('transform', d => `translate(${xScale(d.j)},${yScale(d.i)})`);

        // 绘制矩形
        cells.append('rect')
            .attr('width', xScale.bandwidth())
            .attr('height', yScale.bandwidth())
            .attr('fill', d => colorScale(d.value))
            .attr('stroke', '#333')
            .attr('stroke-width', 1);

        // 添加数值
        cells.append('text')
            .attr('x', xScale.bandwidth() / 2)
            .attr('y', yScale.bandwidth() / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', d => Math.abs(d.value) > 0.5 ? 'white' : 'black')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .text(d => d.value.toFixed(2));

        // 添加X轴标签（底部）
        this.svg.selectAll('.x-label')
            .data(variables)
            .enter()
            .append('text')
            .attr('class', 'x-label')
            .attr('x', (d, i) => xScale(i) + xScale.bandwidth() / 2)
            .attr('y', this.height - this.margin.bottom + 30)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '11px')
            .attr('transform', (d, i) => {
                const x = xScale(i) + xScale.bandwidth() / 2;
                const y = this.height - this.margin.bottom + 30;
                return `rotate(-45, ${x}, ${y})`;
            })
            .text(d => d);

        // 添加Y轴标签（左侧）
        this.svg.selectAll('.y-label')
            .data(variables)
            .enter()
            .append('text')
            .attr('class', 'y-label')
            .attr('x', this.margin.left - 10)
            .attr('y', (d, i) => yScale(i) + yScale.bandwidth() / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '11px')
            .text(d => d);

        // 添加图例
        this.drawLegend(colorScale);
    }

    /**
     * 绘制图例
     */
    drawLegend(colorScale) {
        const legendWidth = 200;
        const legendHeight = 20;
        const legendX = this.width - this.margin.right - legendWidth;
        const legendY = this.margin.top - 30;

        // 创建渐变定义
        const defs = this.svg.append('defs');
        const gradient = defs.append('linearGradient')
            .attr('id', 'correlation-gradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '100%')
            .attr('y2', '0%');

        // 添加渐变色标
        for (let i = 0; i <= 10; i++) {
            const t = i / 10;
            const value = -1 + t * 2;
            gradient.append('stop')
                .attr('offset', `${t * 100}%`)
                .attr('stop-color', colorScale(value));
        }

        // 绘制渐变矩形
        this.svg.append('rect')
            .attr('x', legendX)
            .attr('y', legendY)
            .attr('width', legendWidth)
            .attr('height', legendHeight)
            .attr('fill', 'url(#correlation-gradient)')
            .attr('stroke', '#666');

        // 添加图例标签
        this.svg.append('text')
            .attr('x', legendX)
            .attr('y', legendY + 35)
            .attr('fill', 'white')
            .attr('font-size', '11px')
            .text('-1');

        this.svg.append('text')
            .attr('x', legendX + legendWidth)
            .attr('y', legendY + 35)
            .attr('text-anchor', 'end')
            .attr('fill', 'white')
            .attr('font-size', '11px')
            .text('+1');

        this.svg.append('text')
            .attr('x', legendX + legendWidth / 2)
            .attr('y', legendY + 50)
            .attr('text-anchor', 'middle')
            .attr('fill', 'white')
            .attr('font-size', '10px')
            .text('相关系数');
    }

    /**
     * 清空可视化
     */
    clear() {
        if (this.svg) {
            this.svg.selectAll('*').remove();
        }
        this.currentData = null;
    }

    /**
     * 销毁
     */
    dispose() {
        this.clear();
        if (this.svg) {
            this.svg.remove();
        }
        this.svg = null;
    }
}

export default CorrelationVisualization;

