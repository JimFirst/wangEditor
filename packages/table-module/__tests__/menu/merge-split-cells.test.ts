import MergeCells from '../../src/module/menu/MergeCells'
import SplitCells from '../../src/module/menu/SplitCells'
import createEditor from '../../../../tests/utils/create-editor'
import { MERGE_CELLS_SVG, SPLIT_CELLS_SVG } from '../../src/constants/svg'
import locale from '../../src/locale/zh-CN'
import * as slate from 'slate'
import * as core from '@wangeditor/core'

function setEditorSelection(
  editor: core.IDomEditor,
  selection: slate.Selection = {
    anchor: { path: [0, 0], offset: 0 },
    focus: { path: [0, 0], offset: 0 },
  }
) {
  editor.selection = selection
}

describe('Table Module MergeCells Menu', () => {
  test('it should create MergeCells object', () => {
    const mergeCellsMenu = new MergeCells()
    expect(typeof mergeCellsMenu).toBe('object')
    expect(mergeCellsMenu.tag).toBe('button')
    expect(mergeCellsMenu.iconSvg).toBe(MERGE_CELLS_SVG)
    expect(mergeCellsMenu.title).toBe(locale.tableModule.mergeCells)
  })

  test('it should get empty string if invoke getValue method', () => {
    const mergeCellsMenu = new MergeCells()
    const editor = createEditor()
    expect(mergeCellsMenu.getValue(editor)).toBe('')
  })

  test('it should get falsy value if invoke isActive method', () => {
    const mergeCellsMenu = new MergeCells()
    const editor = createEditor()
    expect(mergeCellsMenu.isActive(editor)).toBeFalsy()
  })

  test('isDisabled should get truthy value if editor selection is null', () => {
    const mergeCellsMenu = new MergeCells()
    const editor = createEditor()
    editor.selection = null
    expect(mergeCellsMenu.isDisabled(editor)).toBeTruthy()
  })

  test('isDisabled should get truthy value if editor selection is collapsed', () => {
    const mergeCellsMenu = new MergeCells()
    const editor = createEditor()
    setEditorSelection(editor)

    jest.spyOn(slate.Range, 'isCollapsed').mockImplementation(() => true)

    const tableNode = {
      type: 'table',
      width: '100%',
      children: [
        {
          type: 'table-row',
          children: [
            { type: 'table-cell', children: [{ text: 'A' }] },
            { type: 'table-cell', children: [{ text: 'B' }] },
          ],
        },
      ],
    }
    jest.spyOn(core.DomEditor, 'getSelectedNodeByType').mockImplementation(() => tableNode as any)

    const mockNodes = [
      [{ type: 'table-cell', children: [{ text: 'A' }] }, [0, 0, 0]] as [any, number[]],
      [{ type: 'table-cell', children: [{ text: 'B' }] }, [0, 0, 1]] as [any, number[]],
    ]
    jest.spyOn(slate.Editor, 'nodes').mockImplementation(() => mockNodes[Symbol.iterator]())

    expect(mergeCellsMenu.isDisabled(editor)).toBeTruthy()
  })

  test('isDisabled should get truthy value if no table selected', () => {
    const mergeCellsMenu = new MergeCells()
    const editor = createEditor()
    setEditorSelection(editor)

    jest.spyOn(slate.Range, 'isCollapsed').mockImplementation(() => false)
    jest.spyOn(core.DomEditor, 'getSelectedNodeByType').mockImplementation(() => null)

    expect(mergeCellsMenu.isDisabled(editor)).toBeTruthy()
  })

  test('isDisabled should get truthy value if selected cells less than 2', () => {
    const mergeCellsMenu = new MergeCells()
    const editor = createEditor()
    setEditorSelection(editor, {
      anchor: { path: [0, 0, 0], offset: 0 },
      focus: { path: [0, 0, 0], offset: 0 },
    })

    jest.spyOn(slate.Range, 'isCollapsed').mockImplementation(() => false)
    jest
      .spyOn(core.DomEditor, 'getSelectedNodeByType')
      .mockImplementation(() => ({ type: 'table' } as any))

    const mockNodes = [
      [{ type: 'table-cell', children: [{ text: 'A' }] }, [0, 0, 0]] as [any, number[]],
    ]
    jest.spyOn(slate.Editor, 'nodes').mockImplementation(() => mockNodes[Symbol.iterator]())

    expect(mergeCellsMenu.isDisabled(editor)).toBeTruthy()
  })

  test('isDisabled should get falsy value if selected cells >= 2 and in same row', () => {
    const mergeCellsMenu = new MergeCells()
    const editor = createEditor()
    setEditorSelection(editor, {
      anchor: { path: [0, 0, 0], offset: 0 },
      focus: { path: [0, 0, 1], offset: 0 },
    })

    jest.spyOn(slate.Range, 'isCollapsed').mockImplementation(() => false)
    jest
      .spyOn(core.DomEditor, 'getSelectedNodeByType')
      .mockImplementation(() => ({ type: 'table' } as any))

    const mockCells = [
      [{ type: 'table-cell', children: [{ text: 'A' }] }, [0, 0, 0]] as [any, number[]],
      [{ type: 'table-cell', children: [{ text: 'B' }] }, [0, 0, 1]] as [any, number[]],
    ]
    jest.spyOn(slate.Editor, 'nodes').mockImplementation(() => mockCells[Symbol.iterator]())

    const rowNode = { type: 'table-row', children: [] } as any
    jest.spyOn(core.DomEditor, 'getParentNode').mockImplementation(() => rowNode)
    jest.spyOn(core.DomEditor, 'findPath').mockImplementation((editor: any, node: any) => {
      if (node.type === 'table-row') return [0, 0]
      return [0, 0, 0]
    })

    expect(mergeCellsMenu.isDisabled(editor)).toBeFalsy()
  })
})

describe('Table Module SplitCells Menu', () => {
  test('it should create SplitCells object', () => {
    const splitCellsMenu = new SplitCells()
    expect(typeof splitCellsMenu).toBe('object')
    expect(splitCellsMenu.tag).toBe('button')
    expect(splitCellsMenu.iconSvg).toBe(SPLIT_CELLS_SVG)
    expect(splitCellsMenu.title).toBe(locale.tableModule.splitCells)
  })

  test('it should get empty string if invoke getValue method', () => {
    const splitCellsMenu = new SplitCells()
    const editor = createEditor()
    expect(splitCellsMenu.getValue(editor)).toBe('')
  })

  test('it should get falsy value if invoke isActive method', () => {
    const splitCellsMenu = new SplitCells()
    const editor = createEditor()
    expect(splitCellsMenu.isActive(editor)).toBeFalsy()
  })

  test('isDisabled should get truthy value if editor selection is null', () => {
    const splitCellsMenu = new SplitCells()
    const editor = createEditor()
    editor.selection = null
    expect(splitCellsMenu.isDisabled(editor)).toBeTruthy()
  })

  test('isDisabled should get truthy value if editor selection is not collapsed', () => {
    const splitCellsMenu = new SplitCells()
    const editor = createEditor()
    setEditorSelection(editor, {
      anchor: { path: [0, 0, 0], offset: 0 },
      focus: { path: [0, 0, 1], offset: 0 },
    })

    jest.spyOn(slate.Range, 'isCollapsed').mockImplementation(() => false)

    expect(splitCellsMenu.isDisabled(editor)).toBeTruthy()
  })

  test('isDisabled should get truthy value if no table selected', () => {
    const splitCellsMenu = new SplitCells()
    const editor = createEditor()
    setEditorSelection(editor)

    jest.spyOn(slate.Range, 'isCollapsed').mockImplementation(() => true)
    jest.spyOn(core.DomEditor, 'getSelectedNodeByType').mockImplementation(() => null)

    expect(splitCellsMenu.isDisabled(editor)).toBeTruthy()
  })

  test('isDisabled should get truthy value if no cell selected', () => {
    const splitCellsMenu = new SplitCells()
    const editor = createEditor()
    setEditorSelection(editor)

    jest.spyOn(slate.Range, 'isCollapsed').mockImplementation(() => true)
    jest
      .spyOn(core.DomEditor, 'getSelectedNodeByType')
      .mockImplementation(() => ({ type: 'table' } as any))

    const mockNodes: any[] = []
    jest.spyOn(slate.Editor, 'nodes').mockImplementation(() => mockNodes[Symbol.iterator]())

    expect(splitCellsMenu.isDisabled(editor)).toBeTruthy()
  })

  test('isDisabled should get truthy value if selected cell colSpan is 1', () => {
    const splitCellsMenu = new SplitCells()
    const editor = createEditor()
    setEditorSelection(editor)

    jest.spyOn(slate.Range, 'isCollapsed').mockImplementation(() => true)
    jest
      .spyOn(core.DomEditor, 'getSelectedNodeByType')
      .mockImplementation(() => ({ type: 'table' } as any))

    const mockCells = [
      [{ type: 'table-cell', colSpan: 1, children: [{ text: 'A' }] }, [0, 0, 0]] as [any, number[]],
    ]
    jest.spyOn(slate.Editor, 'nodes').mockImplementation(() => mockCells[Symbol.iterator]())

    expect(splitCellsMenu.isDisabled(editor)).toBeTruthy()
  })

  test('isDisabled should get falsy value if selected cell colSpan > 1', () => {
    const splitCellsMenu = new SplitCells()
    const editor = createEditor()
    setEditorSelection(editor)

    jest.spyOn(slate.Range, 'isCollapsed').mockImplementation(() => true)
    jest
      .spyOn(core.DomEditor, 'getSelectedNodeByType')
      .mockImplementation(() => ({ type: 'table' } as any))

    const mockCells = [
      [{ type: 'table-cell', colSpan: 2, children: [{ text: 'A' }] }, [0, 0, 0]] as [any, number[]],
    ]
    jest.spyOn(slate.Editor, 'nodes').mockImplementation(() => mockCells[Symbol.iterator]())

    expect(splitCellsMenu.isDisabled(editor)).toBeFalsy()
  })
})
