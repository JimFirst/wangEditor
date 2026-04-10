/**
 * @description insert col menu
 * @author wangfupeng
 */

import { Editor, Element, Transforms, Range } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { ADD_COL_SVG } from '../../constants/svg'
import { TableCellElement, TableElement, TableRowElement } from '../custom-types'
import { isTableWithHeader, getCellColIndex, getCellAtColIndex } from '../helpers'

class InsertCol implements IButtonMenu {
  readonly title = t('tableModule.insertCol')
  readonly iconSvg = ADD_COL_SVG
  readonly tag = 'button'

  getValue(editor: IDomEditor): string | boolean {
    // 无需获取 val
    return ''
  }

  isActive(editor: IDomEditor): boolean {
    // 无需 active
    return false
  }

  isDisabled(editor: IDomEditor): boolean {
    const { selection } = editor
    if (selection == null) return true
    if (!Range.isCollapsed(selection)) return true

    const tableNode = DomEditor.getSelectedNodeByType(editor, 'table')
    if (tableNode == null) {
      // 选区未处于 table cell node ，则禁用
      return true
    }
    return false
  }

  exec(editor: IDomEditor, value: string | boolean) {
    if (this.isDisabled(editor)) return

    const [cellEntry] = Editor.nodes(editor, {
      match: n => DomEditor.checkNodeType(n, 'table-cell'),
      universal: true,
    })
    const [selectedCellNode] = cellEntry

    const rowNode = DomEditor.getParentNode(editor, selectedCellNode) as TableRowElement
    if (rowNode == null) return
    const tableNode = DomEditor.getParentNode(editor, rowNode) as TableElement
    if (tableNode == null) return

    const targetColIndex = getCellColIndex(selectedCellNode as TableCellElement, rowNode)
    const rows = tableNode.children || []

    const insertPoints: { rowIndex: number; path: number[]; isHeaderRow: boolean }[] = []

    rows.forEach((row, rowIndex) => {
      if (!Element.isElement(row)) return

      const targetRow = row as TableRowElement
      const cellInfo = getCellAtColIndex(targetRow, targetColIndex)

      if (cellInfo == null) return

      const cellPath = DomEditor.findPath(editor, cellInfo.cell)
      insertPoints.push({
        rowIndex,
        path: cellPath,
        isHeaderRow: rowIndex === 0 && isTableWithHeader(tableNode),
      })
    })

    insertPoints.reverse().forEach(point => {
      const newCell: TableCellElement = {
        type: 'table-cell',
        children: [{ text: '' }],
      }
      if (point.isHeaderRow) {
        newCell.isHeader = true
      }
      Transforms.insertNodes(editor, newCell, { at: point.path })
    })
  }
}

export default InsertCol
