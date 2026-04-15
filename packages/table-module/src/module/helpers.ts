/**
 * @description table menu helpers
 * @author wangfupeng
 */

import { Element } from 'slate'
import { DomEditor, IDomEditor } from '@wangeditor/core'
import { TableElement, TableCellElement, TableRowElement } from './custom-types'

/**
 * 获取单元格的视觉列索引（考虑 colSpan）
 * @param cellNode cell node
 * @param rowNode row node
 */
export function getCellColIndex(cellNode: TableCellElement, rowNode: TableRowElement): number {
  const cells = rowNode.children || []
  let colIndex = 0

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    if (cell === cellNode) {
      return colIndex
    }
    const span = cell.colSpan || 1
    colIndex += span
  }

  return colIndex
}

/**
 * 根据视觉列索引获取对应位置的单元格
 * @param rowNode row node
 * @param colIndex visual column index
 * @returns cell and its end col index (start + span - 1)
 */
export function getCellAtColIndex(
  rowNode: TableRowElement,
  colIndex: number
): { cell: TableCellElement; endColIndex: number } | null {
  const cells = rowNode.children || []
  let currentColIndex = 0

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]
    const span = cell.colSpan || 1
    const endColIndex = currentColIndex + span - 1

    if (colIndex >= currentColIndex && colIndex <= endColIndex) {
      return { cell, endColIndex }
    }

    currentColIndex += span
  }

  return null
}

/**
 * 获取第一行所有 cells
 * @param tableNode table node
 */
export function getFirstRowCells(tableNode: TableElement): TableCellElement[] {
  const rows = tableNode.children || [] // 所有行
  if (rows.length === 0) return []
  const firstRow = rows[0] || {} // 第一行
  const cells = firstRow.children || [] // 第一行所有 cell
  return cells
}

/**
 * 表格是否带有表头？
 * @param tableNode table node
 */
export function isTableWithHeader(tableNode: TableElement): boolean {
  const firstRowCells = getFirstRowCells(tableNode)
  return firstRowCells.every(cell => !!cell.isHeader)
}

/**
 * 单元格是否在第一行
 * @param editor editor
 * @param cellNode cell node
 */
export function isCellInFirstRow(editor: IDomEditor, cellNode: TableCellElement): boolean {
  const rowNode = DomEditor.getParentNode(editor, cellNode)
  if (rowNode == null) return false
  const tableNode = DomEditor.getParentNode(editor, rowNode)
  if (tableNode == null) return false

  const firstRowCells = getFirstRowCells(tableNode as TableElement)
  return firstRowCells.some(c => c === cellNode)
}

/**
 * 获取表格的最大视觉列数（考虑 colspan）
 */
export function getMaxVisualColumns(tableNode: TableElement): number {
  const rows = tableNode.children || []
  let maxCols = 0
  for (const row of rows) {
    const rowNode = row as TableRowElement
    let count = 0
    const cells = rowNode.children || []
    for (const cell of cells) {
      const cellElem = cell as TableCellElement
      count += cellElem.colSpan || 1
    }
    maxCols = Math.max(maxCols, count)
  }
  return maxCols
}

/**
 * 分析表格结构，返回用于插入行/列的关键信息
 * - structure: 二维数组，记录每个位置对应的单元格（用于处理 rowspan/colspan 占位）
 * - rowspanCells: 所有有 rowspan 的单元格信息列表
 * - colspanCells: 所有有 colspan 的单元格信息列表
 * - allCells: 所有单元格信息列表，包含 isPrimary（原单元格）和 isFilled（被填充单元格）标记
 * - maxColumns: 表格的最大列数
 * - maxRows: 表格的最大行数
 */
export function analyzeTableStructure(tableNode: TableElement) {
  const rows = tableNode.children || []
  const maxRows = rows.length
  const maxColumns = getMaxVisualColumns(tableNode)

  // structure[row][col] = 单元格对象，用于快速查找某位置的单元格
  const structure: (TableCellElement | null)[][] = Array(maxRows)
    .fill(null)
    .map(() => Array(maxColumns).fill(null))

  // 存储所有跨越多行的单元格信息
  const rowspanCells: Array<{
    cell: TableCellElement
    rowIndex: number
    colIndex: number
    rowspan: number
    colspan: number
  }> = []

  // 存储所有跨越多列的单元格信息
  const colspanCells: Array<{
    cell: TableCellElement
    rowIndex: number
    colIndex: number
    rowspan: number
    colspan: number
  }> = []

  const allCells: Array<{
    cell: TableCellElement
    rowIndex: number
    colIndex: number
    rowspan: number
    colspan: number
    isPrimary: boolean
    isFilled: boolean
  }> = []

  // 遍历表格的每一行
  rows.forEach((row, rowIndex) => {
    const rowNode = row as TableRowElement
    const cells = rowNode.children || []
    let colIndex = 0

    // 遍历该行的每个单元格
    cells.forEach((cell, cellIndex) => {
      const cellElem = cell as TableCellElement
      const rowspan = cellElem.rowSpan || 1
      const colspan = cellElem.colSpan || 1

      // 跳过已被占用的位置（可能是上方单元格的 rowspan 占位）
      while (structure[rowIndex][colIndex] !== null) {
        colIndex++
      }

      const cellInfo = {
        cell: cellElem,
        rowIndex,
        colIndex,
        rowspan,
        colspan,
        isPrimary: true,
        isFilled: false,
      }

      allCells.push(cellInfo)
      // 在结构数组中记录该单元格
      structure[rowIndex][colIndex] = cellElem

      // 如果单元格跨越多行，记录到 rowspanCells
      if (rowspan > 1) {
        rowspanCells.push({
          cell: cellElem,
          rowIndex,
          colIndex,
          rowspan,
          colspan,
        })
      }

      // 如果单元格跨越多列，记录到 colspanCells
      if (colspan > 1) {
        colspanCells.push({
          cell: cellElem,
          rowIndex,
          colIndex,
          rowspan,
          colspan,
        })
      }

      // 将该单元格填充到 rowspan/colspan 范围内的所有位置
      for (let r = 0; r < rowspan; r++) {
        for (let c = 0; c < colspan; c++) {
          if (r === 0 && c === 0) continue // 跳过自身位置
          if (rowIndex + r < maxRows && colIndex + c < maxColumns) {
            const filledCell = {
              ...cellElem,
              isFilled: true,
              originCell: cellElem,
            } as TableCellElement
            structure[rowIndex + r][colIndex + c] = filledCell

            allCells.push({
              cell: filledCell,
              rowIndex: rowIndex + r,
              colIndex: colIndex + c,
              rowspan,
              colspan,
              isPrimary: false,
              isFilled: true,
            })
          }
        }
      }

      // 移动到下一个可用列位置
      colIndex += colspan
    })
  })

  return {
    rows,
    structure,
    rowspanCells,
    colspanCells,
    allCells,
    maxColumns,
    maxRows,
  }
}
