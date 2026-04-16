/**
 * @description 插入表格行菜单
 * @author dongmj
 */

import { Editor, Transforms, Range, Path } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { ADD_ROW_SVG } from '../../constants/svg'
import { TableRowElement, TableCellElement, TableElement } from '../custom-types'
import { isTableWithHeader, analyzeTableStructure, getMaxVisualColumns } from '../helpers'

/**
 * 从 allCells 中查找原始单元格信息
 * @param cell 单元格
 * @param allCells 所有单元格列表
 */
function getOriginalCellInfo(
  cell: TableCellElement,
  allCells: Array<{
    cell: TableCellElement
    rowIndex: number
    colIndex: number
    rowspan: number
    colspan: number
    isPrimary: boolean
    isFilled: boolean
  }>
) {
  // 如果单元格有 originCell 属性，说明是被填充的单元格，需要通过 originCell 查找原始单元格
  if (cell.isFilled && cell.originCell) {
    return allCells.find(c => c.cell === cell.originCell && c.isPrimary === true)
  }
  // 否则直接查找 isPrimary === true 的单元格
  return allCells.find(c => c.cell === cell && c.isPrimary === true)
}

/**
 * 检查当前列位置的单元格是否有 rowspan 跨越到插入位置
 * @param rowAbove 插入位置正上方的那一行单元格数组
 * @param colIndex 当前列索引
 * @param insertIndex 插入行的索引位置
 * @param allCells 所有有 rowspan 的单元格列表
 * @returns 如果存在跨越到插入位置的单元格，返回其信息；否则返回 null
 */
function getSpanningCellFromRow(
  rowAbove: (TableCellElement | null)[],
  colIndex: number,
  insertIndex: number,
  allCells: Array<{
    cell: TableCellElement
    rowIndex: number
    colIndex: number
    rowspan: number
    colspan: number
    isPrimary: boolean
    isFilled: boolean
  }>
): { cell: TableCellElement; rowspan: number; colspan: number; rowIndex: number } | null {
  // 当前列位置没有单元格
  if (!rowAbove || !rowAbove[colIndex]) return null

  const cell = rowAbove[colIndex]
  if (!cell) return null

  // 获取该单元格的 rowspan 和 colspan
  const rowspan = cell.rowSpan || 1
  const colspan = cell.colSpan || 1
  // 如果 rowspan 为 1，不会跨越到其他行
  if (rowspan === 1) return null

  // 从 allCells 中查找该单元格的原始信息（isPrimary === true）
  const cellInfo = getOriginalCellInfo(cell, allCells)
  if (!cellInfo) return null

  // 计算该单元格的结束行索引
  const sourceRowIndex = cellInfo.rowIndex
  const endRowIndex = sourceRowIndex + rowspan - 1

  // 如果结束行 >= 插入位置，说明该单元格会跨越到新插入的行
  if (endRowIndex >= insertIndex) {
    return { cell, rowspan, colspan, rowIndex: sourceRowIndex }
  }

  return null
}

/**
 * 创建延续单元格（用于保持 rowspan 跨越到新行时的结构）
 * 例如：原单元格 rowSpan=3，从第1行开始，在第2行插入时需要创建一个 rowSpan=2 的延续单元格
 * @param sourceInfo 源单元格信息
 * @param insertIndex 插入位置
 * @returns 延续单元格
 */
function createSpanningCellContinuation(
  sourceInfo: { cell: TableCellElement; rowspan: number; colspan: number; rowIndex: number },
  insertIndex: number
): TableCellElement {
  const { cell, rowspan, rowIndex, colspan } = sourceInfo
  // 剩余的 rowSpan = 原 rowspan - 已跨越的行数
  const remainingRowspan = rowspan - (insertIndex - rowIndex)

  // 如果剩余 rowSpan <= 0，不创建延续单元格
  if (remainingRowspan <= 0) {
    return {
      type: 'table-cell',
      children: [{ text: '' }],
    }
  }

  const newCell: TableCellElement = {
    type: 'table-cell',
    children: [{ text: '' }],
  }

  // 只有 rowSpan > 1 时才设置 rowSpan 属性
  if (remainingRowspan > 1) {
    newCell.rowSpan = remainingRowspan
  }

  // 保留 colspan
  if (colspan > 1) {
    newCell.colSpan = colspan
  }

  // 保留表头属性
  if (cell.isHeader) {
    newCell.isHeader = true
  }

  return newCell
}

/**
 * 创建空单元格
 * @param isHeader 是否为表头单元格
 * @returns 新的空单元格
 */
function createEmptyCell(isHeader: boolean = false): TableCellElement {
  const cell: TableCellElement = {
    type: 'table-cell',
    children: [{ text: '' }],
  }
  if (isHeader) {
    cell.isHeader = true
  }
  return cell
}

/**
 * 扩展跨越到插入位置的单元格的 rowSpan
 * 例如：原单元格 rowSpan=3，在其范围内插入新行后，rowSpan 变为 4
 * @param editor 编辑器实例
 * @param insertRowIndex 插入行的索引
 * @param tableInfo 表格结构信息
 */
function extendSpanningCells(
  editor: IDomEditor,
  insertRowIndex: number,
  tableInfo: ReturnType<typeof analyzeTableStructure>
) {
  const { allCells } = tableInfo

  // 只处理原始单元格（isPrimary === true）
  const originalCells = allCells.filter(c => c.isPrimary === true)

  for (const cellInfo of originalCells) {
    const { cell, rowIndex, rowspan } = cellInfo
    if (rowspan <= 1) continue

    const endRowIndex = rowIndex + rowspan - 1

    // 如果单元格的起始行在插入位置之前，且结束行在插入位置或之后，则扩展其 rowSpan
    if (rowIndex < insertRowIndex && endRowIndex >= insertRowIndex) {
      const path = DomEditor.findPath(editor, cell)
      Transforms.setNodes(editor, { rowSpan: rowspan + 1 }, { at: path })
    }
  }
}

function createNewRow(
  tableNode: TableElement,
  insertIndex: number,
  tableInfo: ReturnType<typeof analyzeTableStructure>,
  isHeaderRow: boolean
): TableRowElement {
  const { structure, maxColumns, allCells } = tableInfo
  // 获取插入位置正上方的那一行（因为新行会插入在该行之后）
  const rowAbove = structure[insertIndex - 1]

  const newRowCells: TableCellElement[] = []
  let colIndex = 0

  // 遍历表格的每一列，为新行生成单元格
  while (colIndex < maxColumns) {
    // 检查当前列位置的单元格是否有 rowspan 跨越到插入位置
    const spanningCell = getSpanningCellFromRow(rowAbove, colIndex, insertIndex, allCells)

    if (spanningCell) {
      const { rowIndex, rowspan } = spanningCell
      const endRowIndex = rowIndex + rowspan - 1

      // 如果该单元格的结束行在插入位置之前，说明它原本不会跨越到新行
      // 此时需要创建一个延续单元格来保持原有结构
      if (endRowIndex < insertIndex) {
        newRowCells.push(createSpanningCellContinuation(spanningCell, insertIndex))
      }
      // 移动列索引，跳过该单元格占用的列数（colspan）
      colIndex += spanningCell.colspan
    } else {
      // 如果当前列没有跨越的单元格，创建全新的空单元格
      // 如果是表头行且是第0行，则创建表头单元格
      newRowCells.push(createEmptyCell(isHeaderRow && insertIndex === 0))
      colIndex += 1
    }
  }

  return {
    type: 'table-row',
    children: newRowCells,
  }
}

class InsertRow implements IButtonMenu {
  readonly title = t('tableModule.insertRow')
  readonly iconSvg = ADD_ROW_SVG
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
    if (tableNode == null) {
      return true
    }
    return false
  }

  exec(editor: IDomEditor, value: string | boolean) {
    if (this.isDisabled(editor)) return

    const tableNode = DomEditor.getSelectedNodeByType(editor, 'table')
    if (tableNode == null) return

    const cellsLength = getMaxVisualColumns(tableNode as TableElement)
    if (cellsLength === 0) return

    const isHeaderRow = isTableWithHeader(tableNode as TableElement)

    Editor.withoutNormalizing(editor, () => {
      const [cellEntry] = Editor.nodes(editor, {
        match: n => DomEditor.checkNodeType(n, 'table-cell'),
        universal: true,
      })
      const [selectedCell, cellPath] = cellEntry
      const rowPath = Path.parent(cellPath)
      const cellNode = selectedCell as TableCellElement
      const cellRowSpan = cellNode.rowSpan || 1
      const insertRowIndex = rowPath[rowPath.length - 1] + cellRowSpan

      const tableInfo = analyzeTableStructure(tableNode as TableElement)

      const newRow = createNewRow(tableNode as TableElement, insertRowIndex, tableInfo, isHeaderRow)

      if (newRow.children.length > 0) {
        const newRowPath = [...rowPath.slice(0, -1), insertRowIndex]
        Transforms.insertNodes(editor, newRow, { at: newRowPath })
      }

      extendSpanningCells(editor, insertRowIndex, tableInfo)
    })
  }
}

export default InsertRow
