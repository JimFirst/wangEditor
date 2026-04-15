/**
 * @description insert col menu
 * @author wangfupeng
 */

import { Editor, Transforms, Range } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { ADD_COL_SVG } from '../../constants/svg'
import { TableCellElement, TableElement, TableRowElement } from '../custom-types'
import { isTableWithHeader, analyzeTableStructure, getMaxVisualColumns } from '../helpers'

/**
 * 获取当前行中所有跨越到插入位置的单元格（colspan > 1 且结束列 >= 插入位置）
 * @param structure 表格结构二维数组
 * @param rowIndex 当前行索引
 * @param insertIndex 插入列的视觉索引
 * @param colspanCells 所有有 colspan 的单元格列表
 * @returns 跨越到插入位置的单元格信息数组（按 colIndex 排序）
 */
function getSpanningCellsInRange(
  structure: (TableCellElement | null)[][],
  rowIndex: number,
  insertIndex: number,
  colspanCells: Array<{
    cell: TableCellElement
    rowIndex: number
    colIndex: number
    rowspan: number
    colspan: number
  }>
): Array<{ cell: TableCellElement; rowspan: number; colspan: number; colIndex: number }> {
  const result: Array<{
    cell: TableCellElement
    rowspan: number
    colspan: number
    colIndex: number
  }> = []

  for (let colIdx = 0; colIdx < insertIndex - 1; colIdx++) {
    const cell = structure[rowIndex][colIdx]
    if (!cell) continue

    const cellInfo = colspanCells.find(c => c.cell === cell)
    if (!cellInfo) continue

    const { rowIndex: sourceRowIndex, colIndex, colspan, rowspan } = cellInfo
    if (sourceRowIndex !== rowIndex) continue
    if (colspan === 1) continue

    const endColIndex = colIndex + colspan - 1
    if (endColIndex >= insertIndex) {
      result.push({ cell, rowspan, colspan, colIndex })
    }
  }

  return result.sort((a, b) => a.colIndex - b.colIndex)
}

/**
 * 创建空单元格
 * @param rowspan 行跨度（用于 rowspan > 1 的情况）
 * @param isHeader 是否为表头单元格
 * @returns 新的空单元格
 */
function createEmptyCell(rowspan: number = 1, isHeader: boolean = false): TableCellElement {
  const cell: TableCellElement = {
    type: 'table-cell',
    children: [{ text: '' }],
  }

  if (rowspan > 1) {
    cell.rowSpan = rowspan
  }

  if (isHeader) {
    cell.isHeader = true
  }

  return cell
}

/**
 * 创建新列的所有单元格
 * @param tableNode 表格节点
 * @param insertIndex 插入列的视觉索引
 * @param tableInfo 表格结构信息
 * @param isFirstRowHeader 是否第一行为表头
 * @returns 包含单元格和插入位置的数组
 */
function createNewCol(
  tableNode: TableElement,
  insertIndex: number,
  tableInfo: ReturnType<typeof analyzeTableStructure>,
  isFirstRowHeader: boolean
): Array<{ cell: TableCellElement; insertIndex: number }> {
  const { structure, maxRows, colspanCells, rows } = tableInfo

  const newColCells: Array<{ cell: TableCellElement; insertIndex: number }> = []
  let rowIndex = 0

  while (rowIndex < maxRows) {
    let realCellCount = 0
    for (let colIdx = 0; colIdx < insertIndex; colIdx++) {
      if (!structure[rowIndex][colIdx]) continue
      if (!structure[rowIndex][colIdx]?.isFilled) {
        realCellCount++
      }
    }
    // 实际插入位置 = 该行实际单元格数量（插入到末尾）
    const realInsertIndex = realCellCount

    newColCells.push({
      cell: createEmptyCell(1, isFirstRowHeader && rowIndex === 0),
      insertIndex: realInsertIndex,
    })
    rowIndex += 1
  }
  return newColCells
}

class InsertCol implements IButtonMenu {
  readonly title = t('tableModule.insertCol')
  readonly iconSvg = ADD_COL_SVG
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

    const tableInfo = analyzeTableStructure(tableNode as TableElement)
    if (tableInfo.maxRows === 0) return

    const isFirstRowHeader = isTableWithHeader(tableNode as TableElement)

    Editor.withoutNormalizing(editor, () => {
      const [cellEntry] = Editor.nodes(editor, {
        match: n => DomEditor.checkNodeType(n, 'table-cell'),
        universal: true,
      })
      const [selectedCell, cellPath] = cellEntry
      const cellNode = selectedCell as TableCellElement

      const tablePath = cellPath.slice(0, -2)
      const rowIndex = cellPath[cellPath.length - 2]

      let insertColIndex = 0
      const cellColSpan = cellNode.colSpan || 1

      for (let colIdx = 0; colIdx < tableInfo.maxColumns; colIdx++) {
        const cellAtPos = tableInfo.structure[rowIndex][colIdx]
        if (cellAtPos === cellNode) {
          insertColIndex = colIdx + cellColSpan
          break
        }
      }

      const newColCells = createNewCol(
        tableNode as TableElement,
        insertColIndex,
        tableInfo,
        isFirstRowHeader
      )

      if (newColCells.length > 0) {
        for (let rowIdx = 0; rowIdx < newColCells.length; rowIdx++) {
          const { cell, insertIndex } = newColCells[rowIdx]
          const cellPathAtRow = [...tablePath, rowIdx, insertIndex]
          Transforms.insertNodes(editor, cell, { at: cellPathAtRow })
        }
      }
    })
  }
}

export default InsertCol
