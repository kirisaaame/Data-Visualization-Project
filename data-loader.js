/**
 * 数据加载器 - 纯前端CSV数据处理模块
 */

class DataLoader {
    constructor() {
        this.dataCache = new Map();
        // 允许通过 URL 参数 ?basePath=... 或全局 window.DATASET_BASE_PATH 覆盖
        const params = new URLSearchParams(window.location.search || '');
        const fromQuery = params.get('basePath');
        const fromGlobal = typeof window !== 'undefined' ? window.DATASET_BASE_PATH : null;
        this.basePath = (fromQuery || fromGlobal || './Dataset/');
        // 记录一次探测到的可用根路径，避免重复探测
        this.resolvedBasePath = null;
    }

    /**
     * 外部显式设置数据根路径
     */
    setBasePath(path) {
        if (typeof path === 'string' && path.length > 0) {
            this.basePath = path.endsWith('/') ? path : (path + '/');
            this.resolvedBasePath = this.basePath;
        }
    }

    /**
     * 在首次加载失败时，尝试若干候选根路径进行回退探测
     */
    async resolveBasePathIfNeeded(yearMonthDay) {
        if (this.resolvedBasePath) return this.resolvedBasePath;
        const candidates = [];
        // 当前设置
        candidates.push(this.basePath);
        // 常见备选（大小写/相对层级不同或去掉中文子目录）
        candidates.push('./Dataset/');
        candidates.push('./dataset/');
        candidates.push('./data/');
        candidates.push('/Dataset/');
        candidates.push('/data/');

        // 构造当日文件相对路径（不含根）
        const yearMonth = yearMonthDay.substring(0, 6);
        const fileName = `CN-Reanalysis-daily-${yearMonthDay}00.csv`;
        const relative = `${yearMonth}/${fileName}`;

        for (const root of candidates) {
            const rootNorm = root.endsWith('/') ? root : (root + '/');
            const testUrl = `${rootNorm}${relative}`;
            try {
                const resp = await fetch(testUrl, { method: 'GET' });
                if (resp && resp.ok) {
                    this.resolvedBasePath = rootNorm;
                    this.basePath = rootNorm;
                    return this.resolvedBasePath;
                }
            } catch (e) {
                // 忽略，尝试下一个候选
            }
        }
        // 若均失败，保持原值
        return this.basePath;
    }

    /**
     * 解析CSV文本
     */
    parseCSV(text) {
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim()).filter(h => h);
        
        const data = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            const row = {};
            
            headers.forEach((header, index) => {
                const value = parseFloat(values[index]);
                row[header] = isNaN(value) ? values[index] : value;
            });
            
            data.push(row);
        }
        
        return { headers, data };
    }

    /**
     * 加载单个CSV文件
     */
    async loadCSVFile(filePath) {
        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const text = await response.text();
            return this.parseCSV(text);
        } catch (error) {
            console.error(`加载文件失败: ${filePath}`, error);
            return null;
        }
    }

    /**
     * 加载指定日期的数据
     */
    async loadDayData(yearMonthDay) {
        // 检查缓存
        if (this.dataCache.has(yearMonthDay)) {
            return this.dataCache.get(yearMonthDay);
        }

        const yearMonth = yearMonthDay.substring(0, 6);
        const day = yearMonthDay.substring(6, 8);

        // 优先尝试当前/已解析的根路径
        let folderPath = `${(this.resolvedBasePath || this.basePath)}${yearMonth}/`;
        let fileName = `CN-Reanalysis-daily-${yearMonthDay}00.csv`;
        let filePath = `${folderPath}${fileName}`;

        // 首次尝试
        let result = await this.loadCSVFile(filePath);
        
        // 如果失败，进行根路径回退探测一次
        if (!result || !result.data) {
            await this.resolveBasePathIfNeeded(yearMonthDay);
            folderPath = `${(this.resolvedBasePath || this.basePath)}${yearMonth}/`;
            filePath = `${folderPath}${fileName}`;
            result = await this.loadCSVFile(filePath);
        }
        
        if (!result || !result.data) {
            console.warn(`文件不存在: ${filePath}`);
            return [];
        }
        
        // 添加日期信息
        result.data.forEach(row => {
            row.date = yearMonthDay;
            row.yearMonth = yearMonth;
            row.day = day;
        });
        
        // 缓存数据
        this.dataCache.set(yearMonthDay, result.data);
        console.log(`加载了 ${result.data.length} 条数据 (${yearMonthDay})`);
        return result.data;
    }
    
    /**
     * 加载连续多天的数据（用于时间序列）- 优化版本
     */
    async loadConsecutiveDays(startDate, days) {
        console.time(`加载${days}天数据`);
        
        const allData = [];
        const parseDate = d3.timeParse("%Y%m%d");
        const formatDate = d3.timeFormat("%Y%m%d");
        
        const start = parseDate(startDate);
        const endDate = new Date(start);
        endDate.setDate(start.getDate() - days); // 向前推days天
        
        const currentDate = new Date(start);
        const availableDates = [];
        
        // 生成日期列表（从startDate往前推）
        while (currentDate >= endDate) {
            const dateStr = formatDate(currentDate);
            availableDates.push(dateStr);
            currentDate.setDate(currentDate.getDate() - 1);
            
            // 避免超出数据范围（2013-01-01是起点）
            if (dateStr < '20130101') break;
        }
        
        // 并行加载所有日期（提高速度）
        const loadPromises = availableDates.map(async (date) => {
            try {
                const data = await this.loadDayData(date);
                return data || [];
            } catch (error) {
                console.warn(`加载日期 ${date} 失败:`, error);
                return [];
            }
        });
        
        const results = await Promise.all(loadPromises);
        
        // 将所有数据合并
        for (const data of results) {
            if (data && data.length > 0) {
                allData.push(...data);
            }
        }
        
        // 按日期倒序排序（最新的在前）
        allData.sort((a, b) => b.date.localeCompare(a.date));
        
        console.timeEnd(`加载${days}天数据`);
        console.log(`总共加载了 ${allData.length} 条数据，覆盖 ${availableDates.length} 天`);
        
        return allData;
    }
    
    /**
     * 采样数据以减少时间序列数据的数量（提升性能）
     */
    sampleTimeseriesData(data, sampleRate = 10) {
        if (data.length <= 10000) return data; // 小于1万条不采样
        
        // 每sampleRate条数据取1条
        const sampledData = data.filter((d, i) => i % sampleRate === 0);
        console.log(`时间序列采样: ${data.length} -> ${sampledData.length} (采样率 1/${sampleRate})`);
        return sampledData;
    }
    
    /**
     * 加载指定月份的数据（兼容旧API）
     */
    async loadMonthData(yearMonth) {
        // 检查缓存
        if (this.dataCache.has(yearMonth)) {
            return this.dataCache.get(yearMonth);
        }

        const folderPath = `${this.basePath}${yearMonth}/`;
        const year = yearMonth.substring(0, 4);
        const month = yearMonth.substring(4, 6);
        
        // 获取该月的天数
        const daysInMonth = new Date(year, parseInt(month), 0).getDate();
        
        const allData = [];
        
        // 加载该月第一天的数据（用于月度预览）
        const firstDay = yearMonth + '01';
        const fileName = `CN-Reanalysis-daily-${firstDay}00.csv`;
        const filePath = `${folderPath}${fileName}`;
        
        const result = await this.loadCSVFile(filePath);
        
        if (result && result.data) {
            result.data.forEach(row => {
                row.date = firstDay;
                row.yearMonth = yearMonth;
                allData.push(row);
            });
        }
        
        // 缓存数据
        this.dataCache.set(yearMonth, allData);
        return allData;
    }

    /**
     * 为特定污染物获取数据
     */
    extractPollutantData(rawData, pollutantName) {
        if (!rawData || rawData.length === 0) {
            console.warn('没有原始数据');
            return [];
        }
        
        // 获取所有可用的列名
        const allKeys = Object.keys(rawData[0]);
        
        // 尝试多种可能的列名格式
        // 例如：PM2.5 可能对应 "PM2.5(微克每立方米)"、"PM2.5(微克每立方米) "、" PM2.5(微克每立方米)" 等
        const possibleKeys = [
            pollutantName,
            pollutantName.trim(),
            ` ${pollutantName}`,
            `${pollutantName} `,
            `${pollutantName}(`,
            ` ${pollutantName}(`
        ];
        
        // 尝试直接匹配
        let matchedKey = null;
        for (const key of possibleKeys) {
            if (rawData[0].hasOwnProperty(key)) {
                matchedKey = key;
                break;
            }
        }
        
        // 如果直接匹配失败，尝试模糊匹配（检查列名是否包含污染物名称）
        if (!matchedKey) {
            for (const key of allKeys) {
                if (key.includes(pollutantName.trim())) {
                    matchedKey = key;
                    break;
                }
            }
        }
        
        if (!matchedKey) {
            console.warn('找不到列名:', pollutantName, '可用列:', allKeys);
            return [];
        }
        
        console.log('使用列名:', matchedKey);
        
        return rawData.map(row => ({
            lat: row.lat,
            lon: row.lon,
            value: row[matchedKey],
            date: row.date,
            yearMonth: row.yearMonth,
            temp: row.TEMP || row['TEMP(K)'],
            rh: row.RH || row['RH(%)'],
            u: row.U || row['U(m/s)'],
            v: row.V || row['V(m/s)']
        })).filter(d => d.value != null && !isNaN(d.value));
    }

    /**
     * 采样数据以减少渲染压力
     */
    sampleData(data, maxPoints = 2000) {
        if (data.length <= maxPoints) return data;
        
        const step = Math.ceil(data.length / maxPoints);
        return data.filter((d, i) => i % step === 0);
    }
}

export default DataLoader;

