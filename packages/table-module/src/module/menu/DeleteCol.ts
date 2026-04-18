/**
 * @description 删除表格列菜单
 * @author wangfupeng
 */

import { Editor, Transforms, Range, Path } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { DEL_COL_SVG } from '../../constants/svg'
import { TableCellElement, TableRowElement, TableElement } from '../custom-types'
import { analyzeTableStructure } from '../helpers'

interface RemoveCellInfo {
  path: Path
  rowIndex: number
  colIndex: number
}

interface TableInfo {
  rows: TableRowElement[]
  maxColumns: number
}

class DeleteCol implements IButtonMenu {
  readonly title = t('tableModule.deleteCol')
  readonly iconSvg = DEL_COL_SVG
  readonly tag = 'button'

  getValue(editor: IDomEditor): string | boolean {
    return ''
  }

  isActive(editor: IDomEditor): boolean {
    return false
  }

  /**
   * 判断菜单是否禁用
   * 禁用条件：没有选中文本 或 选中了多个节点 或 未选中表格单元格
   */
  isDisabled(editor: IDomEditor): boolean {
    const { selection } = editor
    if (selection == null) return true
    if (!Range.isCollapsed(selection)) return true

    const cellNode = DomEditor.getSelectedNodeByType(editor, 'table-cell')
    if (cellNode == null) {
      return true
    }
    return false
  }

  /**
   * 执行删除列操作
   * 流程：
   * 1. 获取选中单元格和父表格
   * 2. 如果表格只有一列，删除整个表格
   * 3. 否则调用 removeCells 和 removeEmptyRows 删除列和空行
   */
  exec(editor: IDomEditor, value: string | boolean) {
    if (this.isDisabled(editor)) return

    // 获取选中的表格单元格节点
    const [cellEntry] = Editor.nodes(editor, {
      match: n => DomEditor.checkNodeType(n, 'table-cell'),
      universal: true,
    })
    const [, selectedCellPath] = cellEntry

    // 获取父行节点
    const rowNode = DomEditor.getParentNode(editor, cellEntry[0])
    const colLength = rowNode?.children.length || 0

    // 如果表格只有一列，删除整个表格
    if (!rowNode || colLength <= 1) {
      Transforms.removeNodes(editor, { mode: 'highest' })
      return
    }

    // 获取父表格节点
    const tableNode = DomEditor.getParentNode(editor, rowNode)
    if (tableNode == null) return

    // 获取表格路径和虚拟列索引
    const tablePath = DomEditor.findPath(editor, tableNode)
    const tableInfo = analyzeTableStructure(tableNode as TableElement)
    const targetColIndex = this.getVirtualColIndex(editor, selectedCellPath, tablePath, tableInfo)

    // 批量执行：先删除列，后清理空行
    Editor.withoutNormalizing(editor, () => {
      // 收集要删除的单元格信息
      const removeCols = this.collectRemoveCells(editor, tablePath, tableInfo, targetColIndex)
      // 删除单元格
      this.removeCells(editor, removeCols)
      // 删除空行（删除列后可能产生空行）
      this.removeEmptyRows(editor, tablePath, targetColIndex)
    })
  }

  /**
   * 获取选中单元格的虚拟列索引（考虑 colspan 合并）
   * 通过 tableInfo 的 allCells 数组查找单元格的真实列位置
   */
  private getVirtualColIndex(
    editor: IDomEditor,
    selectedCellPath: Path,
    tablePath: Path,
    tableInfo: ReturnType<typeof analyzeTableStructure>
  ): number {
    const rowIndex = selectedCellPath[tablePath.length]
    const cellIndex = selectedCellPath[tablePath.length + 1]

    const [table] = Editor.node(editor, tablePath) as [TableElement, Path]
    const row = table.children[rowIndex] as TableRowElement
    const selectedCell = row.children[cellIndex] as TableCellElement

    const { allCells } = tableInfo
    const cellInfo = allCells.find(c => c.cell === selectedCell && c.isPrimary)

    return cellInfo?.colIndex ?? cellIndex
  }

  /**
   * 收集要删除的单元格信息
   * 遍历表格结构，收集目标列所有需要删除的单元格
   *
   * 逻辑：
   * - 如果单元格 colspan = 1，直接删除
   * - 如果单元格 colspan > 1，递减 colspan
   */
  private collectRemoveCells(
    editor: IDomEditor,
    tablePath: Path,
    tableInfo: ReturnType<typeof analyzeTableStructure>,
    targetColIndex: number
  ): RemoveCellInfo[] {
    const { maxRows, structure } = tableInfo
    const removeCols: RemoveCellInfo[] = []
    let rowIndex = 0
    while (rowIndex < maxRows) {
      const cells = structure[rowIndex]
      if (cells == null) continue
      const cell = cells[targetColIndex]
      const rowSpan = cell?.rowSpan || 1
      const colSpan = cell?.colSpan || 1
      const originCell = cell?.originCell
      const realCell = originCell || cell
      if (realCell == null) continue
      const path = DomEditor.findPath(editor, realCell)
      if (colSpan === 1) {
        removeCols.push({
          path: path,
          rowIndex,
          colIndex: targetColIndex,
        })
      } else {
        Transforms.setNodes(editor, { colSpan: colSpan - 1 }, { at: path })
      }
      rowIndex += rowSpan
    }

    return removeCols
  }

  /**
   * 删除单元格列表
   * 从后往前遍历，逐个删除单元格
   * 从后往前删除是为了保持路径有效性
   */
  private removeCells(editor: IDomEditor, removeCols: RemoveCellInfo[]) {
    const sorted = removeCols.reverse()
    for (const info of sorted) {
      Transforms.removeNodes(editor, { at: info.path })
    }
  }

  /**
   * 清理删除列后产生的空行
   * 从行尾到行首遍历，检查每一行是否为空
   *
   * 判断空行的逻辑：
   * - 如果该行所有单元格都被填充（isFilled=true），说明是 rowspan 占位符，该行为空
   * - 对于空行，先递减占据该行的单元格的 rowSpan，然后删除该行
   * - 每次删除后重新分析表格结构
   *
   * 示例：删除第三列后，剩余的 rowspan 单元格需要调整
   * Row 1: A1(rowSpan=4) | B1(rowSpan=3)
   * 删除列后 Row 3 DOM 空，需要对 A1 和 B1 rowSpan - 1
   */
  private removeEmptyRows(editor: IDomEditor, tablePath: Path, deletedColIndex: number) {
    const [table] = Editor.node(editor, tablePath) as [TableElement, Path]
    let tableInfo = analyzeTableStructure(table)
    const rows = table.children as TableRowElement[]
    let removeRowsPath: Path[] = []
    const rowSpanMap = new Map()
    for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
      const { structure } = tableInfo
      const structureRow = structure[rowIndex]
      if (structureRow == null) continue
      let isEmpty = structureRow.every(cell => cell?.isFilled)
      if (!isEmpty) continue
      const rowPath = [...tablePath, rowIndex]
      const [row] = Editor.node(editor, rowPath) as [TableRowElement, Path]
      const map = new Map()
      for (const cell of structureRow) {
        if (cell == null) continue
        const originCell = cell?.originCell
        const realCell = originCell || cell
        const rowspan = realCell.rowSpan || 1
        if (realCell == null) continue
        if (map.has(realCell)) continue
        map.set(realCell, 1)
        if (rowSpanMap.has(realCell)) {
          const rowSpan = rowSpanMap.get(realCell)
          rowSpanMap.set(realCell, rowSpan + 1)
        } else {
          rowSpanMap.set(realCell, 1)
        }
        const path = DomEditor.findPath(editor, realCell)
        Transforms.setNodes(editor, { rowSpan: rowspan - rowSpanMap.get(realCell) }, { at: path })
      }
      removeRowsPath.push(rowPath)
      // Transforms.removeNodes(editor, { at: rowPath })
      // 重新分析表格结构
      // const [table] = Editor.node(editor, tablePath) as [TableElement, Path]
      // tableInfo = analyzeTableStructure(table)
    }
    // 删除空行
    for (const path of removeRowsPath) {
      Transforms.removeNodes(editor, { at: path })
    }
  }
}
export default DeleteCol
