import os
import glob
import re
from pathlib import Path

# 尝试导入 pandas；若失败，则启用纯文本回退方案
try:
    import pandas as pd  # type: ignore
    HAS_PANDAS = True
except Exception:
    pd = None  # type: ignore
    HAS_PANDAS = False

def clean_column_name(column_name):
    """
    清理列名，去掉括号及其内容
    """
    # 去掉括号及括号内的所有内容（包括中文）
    cleaned = re.sub(r'\([^)]*\)', '', column_name)
    # 去掉首尾空格
    cleaned = cleaned.strip()
    # 去掉末尾的逗号
    if cleaned.endswith(','):
        cleaned = cleaned[:-1].strip()
    return cleaned

def preprocess_csv_file(file_path, output_dir=None):
    """
    预处理单个CSV文件
    """
    print(f"正在处理: {file_path}")
    
    # 先尝试使用 pandas；若失败，回退到纯文本方式
    if HAS_PANDAS:
        try:
            df = pd.read_csv(file_path)
            df.columns = [clean_column_name(col) for col in df.columns]

            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
                output_path = os.path.join(output_dir, os.path.basename(file_path))
                df.to_csv(output_path, index=False)
                print(f"已保存到: {output_path}")
            else:
                df.to_csv(file_path, index=False)
                print(f"已更新: {file_path}")

            print(f"清理后的列名: {list(df.columns)}\n")
            return True
        except Exception as e:
            print(f"pandas 处理失败，使用纯文本回退方案。原因: {e}")

    # 纯文本回退方案：仅修改首行表头，其余原样保留
    try:
        # 决定输出路径
        if output_dir:
            os.makedirs(output_dir, exist_ok=True)
            output_path = os.path.join(output_dir, os.path.basename(file_path))
        else:
            output_path = file_path + ".tmp"

        # 逐行处理，首行重写
        with open(file_path, 'r', encoding='utf-8', newline='') as fin, \
             open(output_path, 'w', encoding='utf-8', newline='') as fout:
            first_line = fin.readline()

            # 若首行为空，直接复制
            if not first_line:
                pass
            else:
                # 粗略按逗号拆分列名，去除可能的尾部空列
                raw_cols = [c for c in first_line.split(',')]
                cleaned_cols = []
                for c in raw_cols:
                    name = clean_column_name(c)
                    if name != '':
                        cleaned_cols.append(name)

                # 用逗号+空格连接，避免尾随逗号
                fout.write(', '.join(cleaned_cols) + "\n")

            # 复制剩余内容
            for chunk in fin:
                fout.write(chunk)

        # 如果是覆盖原文件，将临时文件替换回去
        if not output_dir:
            os.replace(output_path, file_path)
            print(f"已更新: {file_path}")
        else:
            print(f"已保存到: {output_path}")

        print("(文本回退) 表头已清理\n")
        return True
    except Exception as e:
        print(f"回退方案处理文件 {file_path} 时出错: {str(e)}\n")
        return False

def process_directory(directory_path, output_dir=None):
    """
    处理目录中的所有CSV文件
    """
    # 查找所有CSV文件
    csv_files = glob.glob(os.path.join(directory_path, '**/*.csv'), recursive=True)
    
    if not csv_files:
        print(f"在目录 {directory_path} 中未找到CSV文件")
        return
    
    print(f"找到 {len(csv_files)} 个CSV文件")
    
    success_count = 0
    for csv_file in csv_files:
        if preprocess_csv_file(csv_file, output_dir):
            success_count += 1
    
    print(f"\n处理完成: 成功处理 {success_count}/{len(csv_files)} 个文件")

def main():
    """
    主函数
    """
    # 指定要处理的目录
    base_dir = os.path.dirname(os.path.abspath(__file__))
    
    print("=== 大气污染数据预处理 ===")
    print("功能: 清理CSV文件列名中的中文和括号\n")
    
    # 可以选择处理整个目录或指定特定子目录
    target_dir = input("请输入要处理的目录路径（直接回车使用当前目录下的所有CSV文件）: ").strip()
    
    if not target_dir:
        target_dir = base_dir
    
    # 询问是否创建备份
    create_backup = input("是否创建处理后的文件到 'processed_data' 目录? (y/n，默认n): ").strip().lower()
    
    output_dir = None
    if create_backup == 'y':
        output_dir = os.path.join(base_dir, 'processed_data')
    
    # 处理文件
    if os.path.isdir(target_dir):
        process_directory(target_dir, output_dir)
    elif os.path.isfile(target_dir) and target_dir.endswith('.csv'):
        preprocess_csv_file(target_dir, output_dir)
    else:
        print("错误: 无效的路径")
    
    print("\n处理完成！")

if __name__ == "__main__":
    main()

