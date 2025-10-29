# 中国空气质量数据可视化系统

基于D3.js + Babylon.js的多视图联动数据可视化平台

## 项目简介

本项目基于2013-2017年中国空气质量网格数据，开发了一个纯前端的多视图联动可视分析系统。

## 功能特性

### 第一阶段 ✅
- 纯前端CSV数据加载和处理
- D3.js地图可视化 - 污染物分布展示
- 时间序列分析 - 折线图展示
- 控制面板 - 月份和污染物选择
- 动画播放 - 自动月份轮播
- 统计信息面板 - 实时数据统计

### 第二阶段 🚧
- 风场3D可视化（Babylon.js）
- 相关性分析（散点图、热力图）
- 多视图联动功能
- 性能优化

## 快速开始

### 方法一：使用VS Code Live Server

1. 使用VS Code打开项目文件夹
2. 安装 "Live Server" 插件（如未安装）
3. 右键点击 `index.html`，选择 "Open with Live Server"

### 方法二：使用Python HTTP服务器

```bash
cd Data-Visualization-Project
python -m http.server 8000
```

然后在浏览器访问：`http://localhost:8000`

### 方法三：使用Node.js

```bash
cd Data-Visualization-Project
npx http-server -p 8000
```

然后在浏览器访问：`http://localhost:8000`

## 项目结构

```
Data-Visualization-Project/
├── index.html                    # 主页面
├── app.js                        # 主应用逻辑
├── data-loader.js               # 数据加载模块
├── map-visualization.js         # 地图可视化模块
├── timeseries-visualization.js  # 时间序列模块
├── style.css                    # 样式文件
├── PHASE1_SUMMARY.md           # 第一阶段开发总结
├── demand.md                    # 项目需求文档
└── Dataset/                     # 数据文件夹
    └── 大气污染再分析/
        ├── 201301/
        ├── 201302/
        └── ...
```

## 使用说明

1. **选择月份**：从控制面板的月份选择器中选择要查看的月份
2. **选择污染物**：选择要分析的污染物类型（PM2.5, PM10, SO2, NO2, CO, O3）
3. **查看地图**：观察地图上的污染物浓度分布
4. **查看时间序列**：查看下方的折线图了解时间变化趋势
5. **播放动画**：点击"播放动画"按钮自动切换月份查看
6. **查看统计**：在右侧统计面板查看数据概况

## 技术栈

- **D3.js v7** - 数据可视化
- **Babylon.js** - 3D场景渲染
- **原生ES6 JavaScript** - 模块化开发
- **HTML5 + CSS3** - 现代UI设计

## 浏览器兼容性

需要支持ES6模块的现代浏览器：
- Chrome 61+
- Firefox 60+
- Safari 11+
- Edge 16+

## 数据格式

数据文件位于 `Dataset/大气污染再分析/` 文件夹中，按月份（YYYYMM格式）组织。

每个CSV文件包含以下列：
- PM2.5, PM10, SO2, NO2, CO, O3：污染物浓度
- U, V：风速分量
- TEMP：温度（开尔文）
- RH：相对湿度
- PSFC：表面气压
- lat, lon：经纬度

## 开发文档

详细的开发说明请参考：
- [第一阶段开发总结](PHASE1_SUMMARY.md)
- [项目需求文档](demand.md)

## 贡献

欢迎提出问题和改进建议！

## 许可证

MIT License
