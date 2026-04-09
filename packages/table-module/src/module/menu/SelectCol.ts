/**
 * @description select col menu
 * @author wangfupeng
 */

import { Editor, Transforms, Range, Path, Element, Node } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { SELECT_COL_SVG } from '../../constants/svg'

class SelectCol implements IButtonMenu {
  readonly title = t('tableModule.selectCol')
  readonly iconSvg = SELECT_COL_SVG
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

    const cellNode = DomEditor.getSelectedNodeByType(editor, 'table-cell')
    if (cellNode == null) {
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
    const [selectedCellNode, selectedCellPath] = cellEntry

    const rowNode = DomEditor.getParentNode(editor, selectedCellNode)
    if (rowNode == null) return

    const tableNode = DomEditor.getParentNode(editor, rowNode)
    if (tableNode == null) return

    // 获取当前单元格在所在行中的索引
    const cellIndex = selectedCellPath[selectedCellPath.length - 1]

    // 遍历所有行，收集同一列的所有单元格
    const rows = tableNode.children || []
    const cellPaths: Path[] = []

    rows.forEach((row: Node) => {
      if (!Element.isElement(row)) return

      const cells = row.children || []
      // 获取当前行中对应列索引的单元格
      const targetCell = cells[cellIndex]
      if (targetCell) {
        const path = DomEditor.findPath(editor, targetCell)
        cellPaths.push(path)
      }
    })

    if (cellPaths.length === 0) return

    // 选中整列：从第一个单元格的开始到最后一个单元格的结束
    const firstCellPath = cellPaths[0]
    const lastCellPath = cellPaths[cellPaths.length - 1]

    const start = Editor.start(editor, firstCellPath)
    const end = Editor.end(editor, lastCellPath)

    Transforms.select(editor, {
      anchor: start,
      focus: end,
    })
  }
}

export default SelectCol
