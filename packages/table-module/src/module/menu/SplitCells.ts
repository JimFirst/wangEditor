/**
 * @description split cells menu
 * @author wangfupeng
 */

import { Editor, Transforms, Range, Node, Element } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { SPLIT_CELLS_SVG } from '../../constants/svg'
import { TableCellElement } from '../custom-types'

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
