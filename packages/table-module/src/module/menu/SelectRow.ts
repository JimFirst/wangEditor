/**
 * @description select row menu
 * @author wangfupeng
 */

import { Editor, Transforms, Range, Path } from 'slate'
import { IButtonMenu, IDomEditor, DomEditor, t } from '@wangeditor/core'
import { SELECT_ROW_SVG } from '../../constants/svg'

class SelectRow implements IButtonMenu {
  readonly title = t('tableModule.selectRow')
  readonly iconSvg = SELECT_ROW_SVG
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

    const rowNode = DomEditor.getSelectedNodeByType(editor, 'table-row')
    if (rowNode == null) {
      return true
    }
    return false
  }

  exec(editor: IDomEditor, value: string | boolean) {
    if (this.isDisabled(editor)) return

    const [rowEntry] = Editor.nodes(editor, {
      match: n => DomEditor.checkNodeType(n, 'table-row'),
      universal: true,
    })
    const [, rowPath] = rowEntry

    // 选中整行：从行的开始到结束
    const start = Editor.start(editor, rowPath)
    const end = Editor.end(editor, rowPath)

    Transforms.select(editor, {
      anchor: start,
      focus: end,
    })
  }
}

export default SelectRow
