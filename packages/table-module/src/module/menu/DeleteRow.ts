/**
 * @description 删除表格行菜单
 * @author dongmj
 */

import { Editor, Transforms, Range, Path, Element as SlateElement } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { DEL_ROW_SVG } from '../../constants/svg'
import { TableCellElement, TableRowElement, TableElement } from '../custom-types'

class DeleteRow implements IButtonMenu {
  readonly title = t('tableModule.deleteRow')
  readonly iconSvg = DEL_ROW_SVG
  readonly tag = 'button'

  getValue(editor: IDomEditor): string | boolean {
    return ''
  }

  isActive(editor: IDomEditor): boolean {
    return false
  }

  /**
   * 判断菜单是否禁用
   * 禁用条件：没有选中文本 或 选中了多个节点 或 未选中表格行
   */
  isDisabled(editor: IDomEditor): boolean {
    const { selection } = editor
    if (selection == null) return true
    if (!Range.isCollapsed(selection)) return true

    const rowNode = DomEditor.getSelectedNodeByType(editor, 'table-row')
    if (rowNode == null) {
      return true
    }
    return false
  }

  /**
   * 执行删除行操作
   * 流程：
   * 1. 获取选中行和父表格
   * 2. 如果表格只有一行，删除整个表格
   * 3. 否则调用 removeRow 删除行
   */
  exec(editor: IDomEditor, value: string | boolean) {
    if (this.isDisabled(editor)) return

    // 获取选中的表格行节点
    const [rowEntry] = Editor.nodes(editor, {
      match: n => DomEditor.checkNodeType(n, 'table-row'),
      universal: true,
    })
    const [rowNode, rowPath] = rowEntry

    // 获取父表格节点
    const tableNode = DomEditor.getParentNode(editor, rowNode)
    if (!tableNode) return

    // 获取表格行数和目标行索引
    const rowsLength = tableNode.children.length
    const targetRowIndex = rowPath[rowPath.length - 1]

    // 如果表格只有一行，直接删除整个表格
    if (rowsLength <= 1) {
      const tablePath = rowPath.slice(0, -1)
      Transforms.removeNodes(editor, { at: tablePath })
      return
    }

    // 调用 removeRow 删除行
    this.removeRow(editor, rowPath, targetRowIndex, tableNode)
  }

  /**
   * 删除行的核心逻辑
   * 1. 收集受影响的 rowspan 和 colspan 单元格
   * 2. 处理这些单元格的合并属性调整
   * 3. 删除目标行
   * 4. 清理可能产生的空列
   */
  private removeRow(editor: IDomEditor, rowPath: Path, targetRowIndex: number, tableNode: any) {
    // 使用 withoutNormalizing 批量执行操作，避免中间状态引发不必要的 normalize
    Editor.withoutNormalizing(editor, () => {
      const tablePath = rowPath.slice(0, -1)
      const rows = tableNode.children

      // 收集受删除行影响的 rowspan 单元格（纵向合并的单元格）
      const affectedCells = this.collectAffectedRowspanCells(editor, tablePath, targetRowIndex)
      // 收集受删除行影响的 colspan 单元格（横向合并的单元格）
      const affectedColspanCells = this.collectAffectedColspanCells(
        editor,
        tablePath,
        targetRowIndex
      )

      // 处理 rowspan 单元格的调整
      for (const cellInfo of affectedCells) {
        this.processRowspanCell(editor, cellInfo, targetRowIndex)
      }

      // 处理 colspan 单元格的调整
      for (const cellInfo of affectedColspanCells) {
        this.processColspanCell(editor, cellInfo)
      }

      // 删除目标行
      Transforms.removeNodes(editor, { at: rowPath })

      // 清理空列（删除行后可能产生空列）
      this.cleanupEmptyColumns(editor, tablePath, tableNode)
    })
  }

  /**
   * 收集受删除行影响的 rowspan 单元格
   * 遍历目标行及其之前的行，找出所有跨越目标行的单元格
   * 因为这些单元格的 rowSpan 需要调整
   */
  private collectAffectedRowspanCells(editor: IDomEditor, tablePath: Path, targetRowIndex: number) {
    const [table] = Editor.node(editor, tablePath) as [TableElement, Path]
    const rows = table.children as TableRowElement[]
    const affectedCells: any[] = []

    // 遍历目标行及其之前的所有行
    for (let rowIndex = 0; rowIndex <= targetRowIndex; rowIndex++) {
      const rowPath = [...tablePath, rowIndex]
      const [row] = Editor.node(editor, rowPath) as [TableRowElement, Path]

      for (let colIndex = 0; colIndex < row.children.length; colIndex++) {
        const cellPath = [...rowPath, colIndex]
        const [cell] = Editor.node(editor, cellPath) as [TableCellElement, Path]

        // 检查单元格是否有 rowspan 属性且跨越目标行
        if (cell.rowSpan && cell.rowSpan > 1) {
          const startRow = rowIndex
          const endRow = rowIndex + (cell.rowSpan - 1)

          // 判断目标行是否在此单元格的跨越范围内
          if (startRow <= targetRowIndex && targetRowIndex <= endRow) {
            affectedCells.push({
              cell,
              path: cellPath,
              startRow,
              endRow,
              rowIndex,
              colIndex,
              rowspan: cell.rowSpan,
              colspan: cell.colSpan || 1,
            })
          }
        }
      }
    }

    return affectedCells
  }

  /**
   * 收集受删除行影响的 colspan 单元格
   * 只关注目标行中的 colspan 单元格
   */
  private collectAffectedColspanCells(editor: IDomEditor, tablePath: Path, targetRowIndex: number) {
    const targetRowPath = [...tablePath, targetRowIndex]
    const [targetRow] = Editor.node(editor, targetRowPath) as [TableRowElement, Path]
    const affectedCells: any[] = []

    for (let colIndex = 0; colIndex < targetRow.children.length; colIndex++) {
      const cellPath = [...targetRowPath, colIndex]
      const [cell] = Editor.node(editor, cellPath) as [TableCellElement, Path]

      if (cell.colSpan && cell.colSpan > 1) {
        affectedCells.push({
          cell,
          path: cellPath,
          targetRowIndex,
          colIndex,
          colspan: cell.colSpan,
          rowspan: cell.rowSpan || 1,
        })
      }
    }

    return affectedCells
  }

  /**
   * 处理 rowspan 单元格的删除影响
   * 根据被删除行在 rowspan 中的位置，有三种情况：
   * 1. 被删除的是起始行：调整 rowspan 值或拆分单元格
   * 2. 被删除的在中间：rowspan - 1
   * 3. 被删除的是结束行：rowspan - 1
   *
   * 例如：rowspan=4 的单元格占据 4 行（行号 0,1,2,3）
   * - 删除行 0：变成起始行，内容下移，rowSpan 变为 3
   * - 删除行 1 或 2：rowSpan 减 1
   * - 删除行 3：rowSpan 减 1
   */
  private processRowspanCell(editor: IDomEditor, cellInfo: any, targetRowIndex: number) {
    const { cell, path, startRow, endRow, rowspan, colspan } = cellInfo

    // 情况1：被删除的是 rowspan 的起始行
    if (startRow === targetRowIndex) {
      if (rowspan > 1) {
        // 如果同时有 colspan，需要拆分同时有 rowspan 和 colspan 的单元格
        if (colspan > 1) {
          this.splitColspanRowspanCell(editor, cellInfo, targetRowIndex)
        } else {
          // 只有 rowspan，将单元格向下移动并调整 rowspan
          this.moveRowspanCellDown(editor, cellInfo, targetRowIndex)
        }
      }
    }
    // 情况2/3：被删除的是中间行或结束行，处理一致
    else {
      Transforms.setNodes(editor, { rowSpan: rowspan - 1 }, { at: path })
      // 如果 rowspan - 1 等于 1，删除 rowSpan 属性
      if (rowspan - 1 === 1) {
        Transforms.unsetNodes(editor, 'rowSpan', { at: path })
      }
    }
  }

  /**
   * 处理colspan单元格的删除影响
   * 当删除的行的 rowspan 为 1 时，需要拆分 colspan 单元格
   */
  private processColspanCell(editor: IDomEditor, cellInfo: any) {
    const { cell, path, colspan, rowspan } = cellInfo

    if (colspan > 1) {
      // rowspan 为 1：直接拆分 colspan 单元格
      if (rowspan === 1) {
        this.splitColspanCell(editor, cellInfo)
      }
      // rowspan > 1：暂不处理（已在上方处理）
      else if (rowspan > 1) {
        return
      }
    }
  }

  /**
   * 拆分只含有 colspan（不含 rowspan）的单元格
   * 将一个横向合并的单元格拆分为多个独立单元格
   * 例如：colspan=3 的单元格拆分为 3 个单元格
   */
  private splitColspanCell(editor: IDomEditor, cellInfo: any) {
    const { cell, path, colspan, colIndex } = cellInfo
    const { children, colSpan, rowSpan, isHeader, ...restProps } = cell as TableCellElement

    // 先删除原始单元格
    Transforms.removeNodes(editor, { at: path })

    // 插入拆分后的多个单元格
    for (let i = 0; i < colspan; i++) {
      const newCellPath = [...path.slice(0, -1), colIndex + i]
      const newCell: TableCellElement = {
        ...restProps,
        type: 'table-cell',
        children: [{ text: i === 0 ? children[0]?.text || '' : '' }],
      }

      Transforms.insertNodes(editor, newCell, { at: newCellPath })
    }
  }

  /**
   * 拆分同时含有 colspan 和 rowspan 的单元格
   * 创建新的单元格网格来替代原来的合并单元格
   * 例如：rowspan=3, colspan=2 的单元格拆分为 3x2 的单元格网格
   */
  private splitColspanRowspanCell(editor: IDomEditor, cellInfo: any, targetRowIndex: number) {
    const { cell, path, colspan, rowspan, colIndex } = cellInfo
    const { children, colSpan, rowSpan, isHeader, ...restProps } = cell as TableCellElement
    const rowPath = path.slice(0, -2)

    // 在当前行位置创建新单元格（第一行保留内容）
    for (let c = 0; c < colspan; c++) {
      const newCellPath = [...path.slice(0, -1), colIndex + c]
      const newCell: TableCellElement = {
        ...restProps,
        type: 'table-cell',
        children: [{ text: c === 0 ? children[0]?.text || '' : '' }],
      }

      // 第一个单元格保留 rowspan - 1
      if (c === 0 && rowspan > 1) {
        newCell.rowSpan = rowspan - 1
      }

      Transforms.insertNodes(editor, newCell, { at: newCellPath })
    }

    // 如果 rowspan > 1，在下方创建额外的行
    if (rowspan > 1) {
      for (let r = 1; r < rowspan; r++) {
        const belowRowIndex = targetRowIndex + r
        const belowRowPath = [...rowPath, belowRowIndex]

        for (let c = 0; c < colspan; c++) {
          const newCellPath = [...belowRowPath, colIndex + c]
          const newCell: TableCellElement = {
            ...restProps,
            type: 'table-cell',
            children: [{ text: '' }],
          }

          // 中间的行设置 rowspan
          if (r < rowspan - 1) {
            newCell.rowSpan = rowspan - r - 1
          }

          Transforms.insertNodes(editor, newCell, { at: newCellPath })
        }
      }
    }
  }

  /**
   * 将起始行的 rowspan 单元格向下移动
   * 删除原单元格，在起始行创建新的 rowspan 减 1 的单元格
   *
   * 例如：原始单元格在行 0，rowspan=3，删除行 0 后
   * 在行 1 创建新单元格，rowSpan=2
   */
  private moveRowspanCellDown(editor: IDomEditor, cellInfo: any, targetRowIndex: number) {
    const { cell, path, rowspan, startRow, colIndex } = cellInfo
    const { children, colSpan, rowSpan, isHeader, ...restProps } = cell as TableCellElement
    const rowPath = path.slice(0, -2)

    // 删除原始单元格
    Transforms.removeNodes(editor, { at: path })

    if (rowspan > 1) {
      // 在起始行位置插入新的 rowspan 单元格
      const newRowPath = [...rowPath, startRow + 1]
      const newCellPath = [...newRowPath, colIndex]

      const newCell: TableCellElement = {
        ...restProps,
        type: 'table-cell',
        children: children as any,
        rowSpan: rowspan - 1,
      }

      // 如果 rowspan - 1 === 1，删除 rowSpan 属性
      if (newCell.rowSpan === 1) {
        delete newCell.rowSpan
      }

      Transforms.insertNodes(editor, newCell, { at: newCellPath })
    }
  }

  /**
   * 清理删除行后可能产生的空列
   * 检查每一列是否为空，如果是则删除该列
   *
   * 注意：这个方法检查单元格是否包含文本内容来决定列是否为空
   */
  private cleanupEmptyColumns(editor: IDomEditor, tablePath: Path, tableNode: any) {
    const rows = tableNode.children as TableRowElement[]

    if (rows.length === 0) return

    const columnCount = rows[0].children.length

    // 从右到左遍历每一列
    for (let col = columnCount - 1; col >= 0; col--) {
      let isEmptyColumn = true

      // 检查该列的每个单元格是否有内容
      for (let row = 0; row < rows.length; row++) {
        if ((rows[row].children as TableCellElement[]).length <= col) {
          isEmptyColumn = false
          break
        }

        const cellPath = [...tablePath, row, col]
        const [cell] = Editor.node(editor, cellPath) as [TableCellElement, Path]

        const hasContent = cell.children.some(child => child.text && child.text.trim() !== '')

        if (hasContent) {
          isEmptyColumn = false
          break
        }
      }

      // 如果是空列，删除该列
      if (isEmptyColumn) {
        this.removeColumn(editor, tablePath, col)
      }
    }
  }

  /**
   * 删除指定列
   * 如果单元格有 colspan，需要递减 colspan 值
   * 如果递减后 colspan 为 1，则删除 colSpan 属性
   */
  private removeColumn(editor: IDomEditor, tablePath: Path, columnIndex: number) {
    const [table] = Editor.node(editor, tablePath) as [TableElement, Path]
    const rows = table.children as TableRowElement[]

    // 从下到上删除每一行的该列单元格
    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
      const rowPath = [...tablePath, rowIndex]
      const [row] = Editor.node(editor, rowPath) as [TableRowElement, Path]

      if ((row.children as TableCellElement[]).length > columnIndex) {
        const cellPath = [...rowPath, columnIndex]
        const [cell] = Editor.node(editor, cellPath) as [TableCellElement, Path]

        // 如果单元格有 colspan，递减 colspan；否则直接删除
        if (cell.colSpan && cell.colSpan > 1) {
          const newColspan = cell.colSpan - 1
          if (newColspan > 1) {
            Transforms.setNodes(editor, { colSpan: newColspan }, { at: cellPath })
          } else {
            Transforms.unsetNodes(editor, 'colSpan', { at: cellPath })
          }
        } else {
          Transforms.removeNodes(editor, { at: cellPath })
        }
      }
    }
  }
}

export default DeleteRow
