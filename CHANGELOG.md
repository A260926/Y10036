## Unreleased
- Fix global node validation toggle (`builders` `shouldValidateNodes`) leaking
  out of `traverse` when a visitor threw, an inner traverse threw, or the
  traversal was stopped early. The entering state is now always restored via
  `try/finally` in `Traverser.traverseNode` (`src/traverse.ts`).

### 修复记录：traverse 抛错后全局节点校验开关泄漏

- **结构选择（落点）**：所有遍历入口——顶层 `traverse`、`NodePath.traverse`
  以及 `Scope` 内部的 scope crawler——最终都汇聚到静态方法
  `Traverser.traverseNode`（`src/traverse.ts`）。该方法原本已经读取
  `prevNodeValidationEnabled = getNodeValidationEnabled()` 并切换为
  `ctx.shouldValidateNodes`，但只在“走完全程”时才自然结束，且从未写回旧值。
  修复不新增平行实现，而是在这个唯一汇聚点把 `visitPath(...)` 包进
  `try { ... } finally { setNodeValidationEnabled(prevNodeValidationEnabled) }`：
  `finally` 不重抛、不新建错误，因此正常返回、visitor 异常、内层遍历异常、
  `this.stop()` 提前结束四条路径都会恢复“进入本层时”的状态；嵌套遍历各自
  保存/恢复自己的上一层值，天然成对。
- **原覆盖空白**：旧用例
  `enabling/disabling node validation and restoring node validation state`
  只覆盖正常返回路径，且它本身在修复前就是失败的——内层
  `{ validateNodes: true }` 的遍历正常结束后把全局值留在 `true`，导致外层
  `validateNodes:false` 区域内的 `b.identifier(null)` 开始抛错。没有任何用例
  覆盖 visitor 抛错、内层遍历抛错或提前 `stop()` 之后的全局状态，也没有用例
  断言抛出的异常对象身份与 `stack`。
- **最危险的反例**：一次 `{ validateNodes: false }` 的遍历中 visitor 抛错后，
  全局开关永久停留在 `false`，此后任何无关代码调用 builders（如
  `b.identifier(null)`）都静默接受非法节点，污染所有后续构建结果且难以定位。
  嵌套情形同样危险：内层 `{ validateNodes: true }` 抛错后会把 `true` 泄漏进
  外层 `false` 区域，破坏外层 visitor 正在依赖的“暂不校验”前提。
- **用例到分支/不变量的映射**（均在 `tests/src/traverse.test.ts`
  `describe('restoring node validation state')`）：
  - 正常返回（含嵌套恢复）：旧用例
    `enabling/disabling node validation and restoring node validation state`
    ——外层 false、内层 true、内层返回后外层仍 false、整体返回后恢复 true。
  - visitor 异常：`restores the previous state when a visitor throws, without
    wrapping the error`——抛错后 `getNodeValidationEnabled() === true`、后续
    无关 `b.identifier(null)` 重新抛错；`caughtError === visitorError` 且
    `caughtError.stack === visitorError.stack`，证明异常未被包装、stack 未重建。
  - 内层遍历异常（被外层捕获）：`restores the outer state when a nested
    traverse throws`——内层 true 抛错并被捕获后，外层观测到状态恢复为 false，
    外层正常结束后恢复 true。
  - 共享 ctx 的 `path.traverse` 内层异常：
    `restores the previous state when a nested traverse on a path throws`
    ——内层抛错被捕获后外层区域保持 false，外层结束后恢复 true。
  - 内层异常向外传播（不被吞掉）：`propagates a nested traverse error without
    swallowing it`——内层 throw 之后外层代码不执行、同一错误对象与原 stack
    原样传到最外层，之后全局状态仍恢复 true。
  - 提前 stop（两个方向）：`restores the previous state after traversal is
    stopped early`——进入值 true / 本层 false 时 stop 后恢复 true；进入值
    false / 本层 true 时 stop 后恢复 false。
- **刻意保持的公开行为**：
  - visitor 抛出的原始错误对象与 `stack` 原样传播，不包装、不替换、不吞掉。
  - `this.stop()` / `visitorCtx.stopped` 的提前终止语义不变（仅增加清理）。
  - `TraverseOptions.validateNodes` 缺省时仍取进入时的全局值
    （`Context.shouldValidateNodes` 默认 `getNodeValidationEnabled()`），
    全局默认仍为开启校验。
  - 嵌套遍历恢复的是“进入该层时的值”而非固定常量，因此
    `path.traverse` 共享外层 ctx、scope crawler 内部遍历等既有行为不变。
  - 未改动任何旧断言、builder 校验逻辑与错误消息文本。

## 1.7.14
- New binding kind added - `using` and `await using`
- Updated dependencies

## 1.7.13
- Fix incorrect renaming in `AssignmentPattern` inside `ObjectPattern`

## 1.7.12
- Add default type for generic `CompT` of `traverse` function

## 1.7.10
- Enforce `@types/estree` version

## 1.7.9
- Better type support when sharing a visitor between different node types using the new `comp` field
- Fix `undefined` being marked as a reserved keyword
- Updated dependencies

## 1.7.8
- Add `isReference` utility function
- Fix reference collection issue with computed `PropertyDefinition`

## 1.7.7
- More fix to JSX related builders

## 1.7.6
- Fix JSX related builder names

## 1.7.5
- Remove unused dependencies

## 1.7.4
- Add `CatchClause` to `hasBinding`
- Updated dependencies

## 1.7.3
- Handle cases where `CatchClause` parameter is null

## 1.7.2
- Fix crash when one of the children was `null` when calling `skipChildren`

## 1.7.1
- Enabled `"moduleResolution": "bundler"` support for typescript

## 1.7.0
- New method for NodePath - `cloneNode`, `skipChildren`, `unSkipChildren`

## 1.6.2
- Updated dependencies
- Added support for ES Modules

## 1.6.1
- More bug fixes

## 1.6.0
- New methods for Scope - `generateUid`, `generateUidIdentifier`,
  `generateDeclaredUidIdentifier`
- Bug fixes related to scope

## 1.5.0
- New methods [`NodePath.getAncestry`](https://estree-toolkit.netlify.app/nodepath/#getancestry)
  and [`Scope.renameBinding`](https://estree-toolkit.netlify.app/scope/#renamebindingoldname-newname)
- New utility [`getCommonAncestor`](https://estree-toolkit.netlify.app/utilities/#getcommonancestorpaths)
- Fixed many bugs

## 1.4.0
- Updated all dependencies

## 1.3.1
- Added `ObjectExpression` and `ArrayExpression` evaluators
- Improved code

## 1.3.0
- Added support for JSX

## 1.2.7
- Fixed issue in `Scope` where parent scope were not being assigned

## 1.2.6
- Fixed infinite loop in `NodePath`

## 1.2.4
- Improved validators.
- Fixed issue with `Identifier` validator [(#1)](https://github.com/sarsamurmu/estree-toolkit/issues/1)

## 1.2.3
- Disable validation in builders temporarily

## 1.2.2
- Added node validator to all builders

## 1.2.0
- Updated to latest `@types/estree`
- Improved compatibility with latest TypeScript

## 1.1.0
- More fixes

## 1.0.9
- Fix `NodePath`'s synchronization

## 1.0.8
- Export more types

## 1.0.7
- Add `hasBinding` method to `Scope`

## 1.0.6
- Improve typings

## 1.0.5
- Fix TypeScript types

## 1.0.4
- Add support for `ExportDeclaration` alias.

## 1.0.3
- Add support for evaluating `UnaryExpression`

## 1.0.2
- Update `@types/estree` dependency

## 1.0.1
- Remove useless files
