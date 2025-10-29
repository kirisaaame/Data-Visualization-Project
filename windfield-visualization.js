/**
 * 风场3D可视化模块 - 使用Babylon.js
 */

import { Engine, Scene, ArcRotateCamera, HemisphericLight, Vector3, 
         Mesh, StandardMaterial, Color3 } from '@babylonjs/core';

// 将Babylon对象导出到全局，供其他代码使用
window.BABYLON = { Engine, Scene, ArcRotateCamera, HemisphericLight, 
                   Vector3, Mesh, StandardMaterial, Color3 };

class WindfieldVisualization {
    constructor(canvasId, width = 900, height = 600) {
        this.canvasId = canvasId;
        this.width = width;
        this.height = height;
        this.engine = null;
        this.scene = null;
        this.camera = null;
        this.currentData = null;
    }

    /**
     * 检查Babylon.js是否已加载
     */
    checkBabylon() {
        // 检查Babylon.js是否已加载（通过模块导入，存储在window.BABYLON）
        if (typeof window.BABYLON === 'undefined') {
            console.error('Babylon.js未加载。请确保node_modules中的@babylonjs/core已安装。');
            return false;
        }
        console.log('Babylon.js已加载');
        return true;
    }

    /**
     * 初始化3D场景
     */
    init() {
        // 检查Babylon.js是否已加载
        if (!this.checkBabylon()) {
            return;
        }

        const canvas = document.getElementById(this.canvasId);
        if (!canvas) {
            console.error('Canvas element not found');
            return;
        }

        // 创建Babylon引擎
        this.engine = new Engine(canvas, true);
        
        // 创建场景
        this.scene = new Scene(this.engine);
        this.scene.clearColor = new Color3(0.1, 0.1, 0.15);

        // 创建相机（圆弧旋转相机）
        this.camera = new ArcRotateCamera(
            'camera',
            -Math.PI / 2.5,  // alpha（水平角度）
            Math.PI / 3,     // beta（垂直角度）
            200,             // radius（距离）
            Vector3.Zero(),  // 目标点
            this.scene
        );
        
        // 设置相机限制
        this.camera.setTarget(Vector3.Zero());
        this.camera.lowerRadiusLimit = 50;
        this.camera.upperRadiusLimit = 500;
        
        // 将相机设置为场景的活动相机（这会自动启用鼠标控制）
        this.scene.activeCamera = this.camera;

        // 添加光源
        const light = new HemisphericLight(
            'light',
            new Vector3(0, 1, 0),
            this.scene
        );
        light.intensity = 0.8;

        // 添加环境光
        const ambientLight = new HemisphericLight(
            'ambient',
            new Vector3(0, -1, 0),
            this.scene
        );
        ambientLight.intensity = 0.3;
        
        // 添加地面作为参考
        const ground = Mesh.CreateGround('ground', 200, 200, 10, this.scene);
        const groundMaterial = new StandardMaterial('groundMat', this.scene);
        groundMaterial.emissiveColor = new Color3(0.2, 0.2, 0.2);
        groundMaterial.alpha = 0.2;
        ground.material = groundMaterial;

        // 启动渲染循环
        this.engine.runRenderLoop(() => {
            this.scene.render();
        });

        // 响应窗口大小变化
        window.addEventListener('resize', () => {
            this.engine.resize();
        });
    }

    /**
     * 绘制风场
     */
    draw(data, pollutant) {
        // 确保Babylon.js已加载
        if (!this.checkBabylon()) {
            console.error('无法绘制风场：Babylon.js未加载');
            return;
        }

        if (!this.scene) this.init();
        
        if (!data || data.length === 0) {
            console.warn('没有风场数据');
            return;
        }

        this.currentData = data;

        // 清除之前的箭头
        this.clearArrows();

        // 采样数据（避免绘制过多箭头）
        const sampleRate = Math.ceil(data.length / 800); // 最多800个箭头
        const sampledData = data.filter((d, i) => i % sampleRate === 0);
        
        console.log(`绘制 ${sampledData.length} 个风场向量`);

        // 创建箭头网格
        const arrows = [];
        sampledData.forEach((d, index) => {
            const arrow = this.createWindArrow(d, pollutant);
            if (arrow) arrows.push(arrow);
        });

        return arrows;
    }

    /**
     * 创建单个风场箭头
     */
    createWindArrow(data, pollutant) {
        if (!this.checkBabylon()) {
            return null;
        }

        if (!data.u || !data.v || !data.lat || !data.lon) {
            return null;
        }

        const u = data.u || 0;
        const v = data.v || 0;
        const speed = Math.sqrt(u * u + v * v);
        
        // 跳过风速为0的点
        if (speed < 0.01) return null;

        // 转换为场景坐标（归一化到合适范围）
        const x = (data.lon - 105) * 3; // 经度转换为X
        const z = (data.lat - 35) * 3;  // 纬度转换为Z
        const y = 0;                     // 所有向量在同一平面上（Y=0，即地面）

        // 创建向量箭头（圆柱体）- 平行于地面
        // 使用固定的向量长度，通过颜色表示风速大小
        const arrowLength = 2; // 固定长度，所有向量长度相同
        const arrowDiameter = 0.1; // 更细的向量
        
        // 先创建垂直的圆柱
        const arrow = Mesh.CreateCylinder(
            `arrow_${data.date}_${data.lon}_${data.lat}`,
            arrowLength,    // height（圆柱高度）
            arrowDiameter,  // diameterTop
            arrowDiameter,  // diameterBottom
            16,             // tessellation
            1,              // subdivisions
            this.scene
        );

        // 设置位置（在地面上）
        arrow.position = new Vector3(x, y, z);

        // 计算风向角度（从U、V分量）
        // U是东西向，V是南北向
        // atan2(东西向, 南北向) 得到风向角
        const angle = Math.atan2(u, v);
        
        // 将垂直的圆柱旋转到水平方向
        // 先绕Z轴旋转90度，使其水平
        arrow.rotation.z = Math.PI / 2;
        // 再绕Y轴旋转到风向角度
        arrow.rotation.y = angle;

        // 根据风速设置颜色（风速越大颜色越深红）
        const speedColor = this.getSpeedColor(speed);
        const material = new StandardMaterial(`mat_${x}_${z}`, this.scene);
        material.emissiveColor = speedColor;
        material.diffuseColor = speedColor;
        arrow.material = material;

        return arrow;
    }

    /**
     * 根据风速获取颜色
     */
    getSpeedColor(speed) {
        // 风速范围约0-20 m/s，映射到颜色
        const normalizedSpeed = Math.min(speed / 20, 1);
        
        // 使用蓝色（低风速）到红色（高风速）的渐变
        const r = normalizedSpeed;
        const g = 0.3;
        const b = 1 - normalizedSpeed;
        
        return new Color3(r, g, b);
    }

    /**
     * 清除所有箭头
     */
    clearArrows() {
        if (!this.scene) return;
        
        const meshes = this.scene.meshes.filter(m => 
            m.id && m.id.startsWith('arrow_')
        );
        meshes.forEach(mesh => mesh.dispose());
    }

    /**
     * 清空场景
     */
    clear() {
        this.clearArrows();
        this.currentData = null;
    }

    /**
     * 销毁场景
     */
    dispose() {
        // 清除箭头
        this.clearArrows();
        
        // 断开相机控制
        if (this.camera) {
            this.camera.dispose();
        }
        
        // 销毁引擎
        if (this.engine) {
            this.engine.dispose();
        }
        
        this.scene = null;
        this.engine = null;
        this.camera = null;
    }
}

export default WindfieldVisualization;

