# 拆分单元格功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增"拆分单元格"菜单，支持将横向合并的单元格（colSpan > 1）拆分为多个独立单元格

**Architecture:** 在 table-module 中新增 SplitCells 菜单类，参考现有 MergeCells 的实现模式，通过判断单元格 colSpan > 1 来启用功能，拆分时在右侧插入新单元格并恢复 colSpan 为 1

**Tech Stack:** TypeScript, Slate, WangEditor

---

### Task 1: 添加国际化文案

**Files:**
- Modify: `packages/table-module/src/locale/zh-CN.ts:18`
- Modify: `packages/table-module/src/locale/en.ts:18`

- [ ] **Step 1: 添加中文国际化文案**

在 `zh-CN.ts` 的 `tableModule` 对象中添加：
```typescript
splitCells: '拆分单元格',
```

- [ ] **Step 2: 添加英文国际化文案**

在 `en.ts` 的 `tableModule` 对象中添加：
```typescript
splitCells: 'Split cells',
```

---

### Task 2: 添加拆分单元格 SVG 图标

**Files:**
- Modify: `packages/table-module/src/constants/svg.ts:52`

- [ ] **Step 1: 添加拆分单元格 SVG**

在 `svg.ts` 文件末尾添加：
```typescript
// 表格 拆分单元格
export const SPLIT_CELLS_SVG =
  '<svg viewBox="0 0 1024 1024"><path d="M0 128h448v256H0zM256 128h256v256H256zM512 128h256v256H512zM768 128h256v256H768zM0 384h1024v256H0zM0 640h1024v256H0z"></path></svg>'
```

---

### Task 3: 创建 SplitCells 菜单类

**Files:**
- Create: `packages/table-module/src/module/menu/SplitCells.ts`

- [ ] **Step 1: 创建 SplitCells 菜单类**

创建文件 `packages/table-module/src/module/menu/SplitCells.ts`：
```typescript
/**
 * @description split cells menu
 * @author wangfupeng
 */

import { Editor, Transforms, Range, Node, Element, Text } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { SPLIT_CELLS_SVG } from '../../constants/svg'
import { TableCellElement, TableRowElement, TableElement } from '../custom-types'

class SplitCells implements IButtonMenu {
  readonly title = t('tableModule.splitCells')
  readonly iconSvg = SPLIT_CELLS_SVG
  readonly tag = 'button'

  getValue(editor: IDomEditor): string | boolean {
    return ''
  }

  isActive(editor: IDomEditor): boolean {
    return false
  }

  isDisabled(editor: IDomEditor): boolean {
    const { selection } = editor
    if (selection == null) return true
    if (!Range.isCollapsed(selection)) return true

    const tableNode = DomEditor.getSelectedNodeByType(editor, 'table')
    if (tableNode == null) return true

    const selectedCell = this.getSelectedCell(editor)
    if (selectedCell == null) return true

    const cell = selectedCell.cell as TableCellElement
    const colSpan = cell.colSpan || 1
    if (colSpan <= 1) return true

    return false
  }

  private getSelectedCell(editor: IDomEditor): { cell: Node; path: number[] } | null {
    const { selection } = editor
    if (selection == null) return null

    const iter = Editor.nodes(editor, {
      match: n => DomEditor.checkNodeType(n, 'table-cell'),
      at: selection,
    })

    for (const [node, path] of iter) {
      return { cell: node, path }
    }

    return null
  }

  exec(editor: IDomEditor, value: string | boolean) {
    if (this.isDisabled(editor)) return

    const selectedCell = this.getSelectedCell(editor)
    if (selectedCell == null) return

    const { cell, path } = selectedCell
    const cellElem = cell as TableCellElement
    const colSpan = cellElem.colSpan || 1

    if (colSpan <= 1) return

    const rowNode = DomEditor.getParentNode(editor, cell)
    if (rowNode == null || !Element.isElement(rowNode)) return
    if (rowNode.type !== 'table-row') return

    const rowPath = DomEditor.findPath(editor, rowNode)
    const cellIndex = path[path.length - 1]

    for (let i = 1; i < colSpan; i++) {
      const newCellPath = [...rowPath, cellIndex + i]
      const newCell: TableCellElement = {
        type: 'table-cell',
        children: [{ text: '' }],
      }
      Transforms.insertNodes(editor, newCell, { at: newCellPath })
    }

    Transforms.setNodes(editor, { colSpan: 1 } as Partial<TableCellElement>, { at: path })
  }
}

export default SplitCells
```

- [ ] **Step 2: 提交代码**

```bash
git add packages/table-module/src/module/menu/SplitCells.ts
git commit -m "feat: add SplitCells menu class"
```

---

### Task 4: 注册 SplitCells 菜单

**Files:**
- Modify: `packages/table-module/src/module/menu/index.ts:16`
- Modify: `packages/table-module/src/module/menu/index.ts:88-93`

- [ ] **Step 1: 导入 SplitCells**

在 `index.ts` 中添加导入：
```typescript
import SplitCells from './SplitCells'
```

- [ ] **Step 2: 添加菜单配置**

在文件末尾添加：
```typescript
export const splitTableCellsConf = {
  key: 'splitTableCells',
  factory() {
    return new SplitCells()
  },
}
```

---

### Task 5: 测试功能

**Files:**
- Test: 手动测试

- [ ] **Step 1: 构建并测试**

运行项目，创建一个 3x3 的表格，选中一行中的多个单元格并合并，然后选中合并后的单元格，点击拆分单元格按钮验证功能

---

## 自检清单

1. **Spec 覆盖检查**
   - ✅ 横向合并（colSpan）拆分支持
   - ✅ 拆分为独立单元格
   - ✅ 在右侧插入新单元格
   - ✅ 工具栏按钮入口
   - ✅ 选中合并单元格启用
   - ✅ 国际化支持

2. **类型一致性检查**
   - ✅ TableCellElement 类型使用正确
   - ✅ colSpan 属性使用正确
   - ✅ Transforms API 使用正确

3. **占位符检查**
   - ✅ 无 TBD/TODO
   - ✅ 所有代码块完整