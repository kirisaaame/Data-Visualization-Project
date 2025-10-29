import pandas as pd
import os

# 测试清理列名功能
def clean_column_name(column_name):
    import re
    # 去掉括号及括号内的所有内容（包括中文）
    cleaned = re.sub(r'\([^)]*\)', '', column_name)
    # 去掉首尾空格
    cleaned = cleaned.strip()
    # 去掉末尾的逗号
    if cleaned.endswith(','):
        cleaned = cleaned[:-1].strip()
    return cleaned

# 读取测试文件
sample_file = 'CN-Reanalysis201612/201612/CN-Reanalysis-daily-2016120600.csv'

if os.path.exists(sample_file):
    # 读取文件
    df = pd.read_csv(sample_file, nrows=1)
    
    print("=" * 60)
    print("原始列名（前5个）:")
    print("=" * 60)
    for i, col in enumerate(df.columns[:5]):
        print(f"{i+1}. {col}")
    
    # 清理列名
    df.columns = [clean_column_name(col) for col in df.columns]
    
    print("\n" + "=" * 60)
    print("清理后列名（前5个）:")
    print("=" * 60)
    for i, col in enumerate(df.columns[:5]):
        print(f"{i+1}. {col}")
    
    print("\n" + "=" * 60)
    print("所有清理后的列名:")
    print("=" * 60)
    print(list(df.columns))
else:
    print(f"文件不存在: {sample_file}")

