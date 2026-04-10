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
