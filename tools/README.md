# 数据处理脚本

网页运行时只需要 `index.html` 和 `assets/`。这里的脚本用来从公开数据重新生成 `assets/data.js`。

## 环境

Python 3.11 以上和 Node 20 以上。

```bash
pip install numpy pandas shapely timezonefinder holidays geonamescache pyreadr opencc-python-reimplemented pillow fonttools brotli
```

## 运行顺序

在 `tools/pipeline/` 目录下依次运行：

| 步骤 | 命令 | 作用 |
|---|---|---|
| 1 | `bash fetch_raw.sh` | 下载公开原始数据到 `raw/`，约 75 MB |
| 2 | `python3 s01_countries.py` | 各国 2026 年分年龄人口、就业和入学指标 |
| 3 | `python3 s02_cities.py` | 合并联合国城市名单和 Natural Earth，选出城市 |
| 4 | `python3 s03_final_cities.py` | 增删和修正城市 |
| 5 | `python3 s04_geo.py` | 分配人口光点、时区分区 |
| 6 | `python3 s05_extra.py` | 生成 2026 年公共假期 |
| 7 | `python3 s06_climate.py` | 给城市匹配最近的气温站点 |
| 8 | `python3 s07_bundle.py` | 作息类型、校历、陆地图、国界、白昼比例，打包成 `data/bundle.json` |
| 9 | `node s08_validate.mjs` | 模型和时间利用调查的对比表 |

然后回到 `tools/`：

```bash
python3 build_site.py      # 生成 index.html 和 assets/
python3 subset_fonts.py    # 换了文字后，重新裁剪字体
```

## 文件

- `site/`：页面源文件。`model.js` 是作息模型，`app.js` 是地球仪和界面，`notes.html` 是数据说明。
- `pipeline/data/climate_rows.txt`：人工整理的城市月均气温表，来源见主 README。
- `pipeline/data/bundle.json`：生成结果，和 `assets/data.js` 内容相同。

2026 年的时区规则和公共假期写死在数据里。要换年份，需要改 `s04_geo.py`、`s05_extra.py`、`s07_bundle.py` 里的年份，以及 `site/model.js` 里的斋月日期。
