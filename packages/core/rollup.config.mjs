import { createRollupConfig, IS_PRD } from '../../build/create-rollup-config.mjs'
import pkg from './package.json' assert { type: 'json' }

const name = 'WangEditorCore'

const configList = []

// esm
const esmConf = createRollupConfig({
  output: {
    file: pkg.module,
    format: 'esm',
    name,
  },
})
configList.push(esmConf)

// umd
const umdConf = createRollupConfig({
  output: {
    file: pkg.main,
    format: 'umd',
    name,
  },
})
configList.push(umdConf)

export default configList
