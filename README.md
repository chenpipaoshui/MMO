# MMO——Map Measurer for Orienteering

Vibe Coding的Web 应用：可以上传地图、设置比例尺、绘制折线、自动计算实际长度并导出。

## 功能

- 上传 PNG / JPG / WEBP / PDF 地图
- 导入时选择图纸尺寸
- 输入地图比例尺（如 1:4000），自动换算实际长度
- 折线绘制与长度测量
- 画布缩放（滚轮）与平移（平移工具 / 按住空格拖拽）
- 线段列表、显示/隐藏、删除
- 框选范围或全图导出为jpg图片

## 使用

```bash
npm install
npm run dev
```

浏览器打开终端显示的本地地址（默认 `http://localhost:5173`）。

### 操作说明

1. 点击 **上传地图**，选择文件和 **图纸尺寸**（A4、A3 等）
2. 在右侧面板输入 **地图比例尺**（如 `1:4000` 填 `4000`）
3. 选择 **折线** 工具，在地图上点击落点
4. **双击** 或按 **Enter** 完成当前折线
5. **Esc** 取消当前绘制，**Backspace** 撤销上一个点

## 构建

```bash
npm run build
npm run preview
```

`dist/` 目录可部署到任意静态服务器。

## 技术栈

- Vue 3 + TypeScript + Vite
- Pinia
- Tailwind CSS
- Canvas 2D
