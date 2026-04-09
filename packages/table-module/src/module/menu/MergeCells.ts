/**
 * @description merge cells menu
 * @author wangfupeng
 */

import { Editor, Transforms, Range, Node, Element } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { MERGE_CELLS_SVG } from '../../constants/svg'
import { TableCellElement } from '../custom-types'

class MergeCells implements IButtonMenu {
  readonly title = t('tableModule.mergeCells')
  readonly iconSvg = MERGE_CELLS_SVG
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
    if (Range.isCollapsed(selection)) return true

    const tableNode = DomEditor.getSelectedNodeByType(editor, 'table')
    if (tableNode == null) return true

    const selectedCells = this.getSelectedCells(editor)
    if (selectedCells.length < 2) return true

    if (!this.isSameRow(editor, selectedCells)) return true

    return false
  }

  private getSelectedCells(editor: IDomEditor): Node[] {
    const { selection } = editor
    if (selection == null) return []

    const cells: Node[] = []
    const iter = Editor.nodes(editor, {
      match: n => DomEditor.checkNodeType(n, 'table-cell'),
      at: selection,
    })

    for (let [node] of iter) {
      cells.push(node)
    }

    return cells
  }

  private isSameRow(editor: IDomEditor, cells: Node[]): boolean {
    if (cells.length < 2) return false

    let firstRowPath: number[] | null = null
    for (const cell of cells) {
      const rowNode = DomEditor.getParentNode(editor, cell)
      if (rowNode == null || !Element.isElement(rowNode)) return false
      if (rowNode.type !== 'table-row') return false

      const rowPath = DomEditor.findPath(editor, rowNode)
      if (firstRowPath === null) {
        firstRowPath = rowPath
      } else {
        if (rowPath.join() !== firstRowPath.join()) {
          return false
        }
      }
    }
    return true
  }

  exec(editor: IDomEditor, value: string | boolean) {
    if (this.isDisabled(editor)) return

    const selectedCells = this.getSelectedCells(editor)
    if (selectedCells.length < 2) return

    const firstCell = selectedCells[0] as TableCellElement
    const firstCellPath = DomEditor.findPath(editor, firstCell)

    const cellPaths = selectedCells.map(cell => DomEditor.findPath(editor, cell))
    for (let i = cellPaths.length - 1; i > 0; i--) {
      Transforms.removeNodes(editor, { at: cellPaths[i] })
    }

    const newColSpan = (firstCell.colSpan || 1) + selectedCells.length - 1
    Transforms.setNodes(editor, { colSpan: newColSpan } as Partial<TableCellElement>, {
      at: firstCellPath,
    })
  }
}

export default MergeCells
