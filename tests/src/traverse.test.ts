import { NodePath, traverse, builders as b } from '<project>'
import { getNodeValidationEnabled, setNodeValidationEnabled } from '<project>/builders'

test('basic traversal', () => {
  const ast = {
    type: 'Program',
    sourceType: 'module',
    body: [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'AssignmentExpression',
          left: {
            type: 'Identifier',
            name: 'a'
          },
          operator: '=',
          right: {
            type: 'ArrayExpression',
            elements: [
              {
                type: 'Identifier',
                name: 'b'
              },
              {
                type: 'Identifier',
                name: 'c'
              }
            ]
          }
        }
      }
    ]
  } as const
  const state = {}

  const mockFn = jest.fn<void, [NodePath, any]>()
  traverse(ast, {
    ArrayExpression: mockFn,
    AssignmentExpression: mockFn,
    ExpressionStatement: mockFn,
    Identifier: mockFn,
    Program: mockFn,
  }, state)

  const visitStack = [
    ast,
    ast.body[0],
    ast.body[0].expression,
    ast.body[0].expression.left,
    ast.body[0].expression.right,
    ast.body[0].expression.right.elements[0],
    ast.body[0].expression.right.elements[1]
  ]
  for (let i = 0; i < mockFn.mock.calls.length; i++) {
    const callArgs = mockFn.mock.calls[i]
    expect(callArgs[0].node).toBe(visitStack[i])
    expect(callArgs[1]).toBe(state)
  }
})

describe('visitor expansion', () => {
  test('pipe separated visitors', () => {
    const ast = {
      type: 'Program',
      sourceType: 'module',
      body: [
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'ArrayExpression',
            elements: [
              {
                type: 'Identifier',
                name: 'a'
              },
              {
                type: 'Identifier',
                name: 'b'
              }
            ]
          }
        }
      ]
    } as const
    const state = {}

    const mockFn1 = jest.fn<void, [NodePath, any]>()
    const mockFn2 = jest.fn<void, [NodePath, any]>()
    traverse(ast, {
      ['Program|Identifier' as any]: mockFn1,
      comp: {
        'Program|Identifier': mockFn2
      }
    }, state)

    const toMatch = [
      ast,
      ast.body[0].expression.elements[0],
      ast.body[0].expression.elements[1]
    ]
    for (let i = 0; i < mockFn1.mock.calls.length; i++) {
      const callArgs = mockFn1.mock.calls[i]
      expect(callArgs[0].node).toBe(toMatch[i])
      expect(callArgs[1]).toBe(state)
    }
    for (let i = 0; i < mockFn2.mock.calls.length; i++) {
      const callArgs = mockFn2.mock.calls[i]
      expect(callArgs[0].node).toBe(toMatch[i])
      expect(callArgs[1]).toBe(state)
    }
  })

  test('aliases', () => {
    const ast = {
      type: 'Program',
      sourceType: 'module',
      body: [
        {
          type: 'ClassDeclaration',
          id: {
            type: 'Identifier',
            name: 'x'
          },
          superClass: null,
          decorators: [],
          body: {
            type: 'ClassBody',
            body: []
          }
        },
        {
          type: 'ExpressionStatement',
          expression: {
            type: 'ClassExpression',
            id: null,
            superClass: null,
            decorators: [],
            body: {
              type: 'ClassBody',
              body: []
            }
          }
        }
      ]
    } as const
    const state = {}

    const mockFn = jest.fn<void, [NodePath, any]>()
    traverse(ast, {
      Class: mockFn,
    }, state)

    for (let i = 0; i < mockFn.mock.calls.length; i++) {
      const callArgs = mockFn.mock.calls[i]
      expect(callArgs[0].type).toMatch(/Class(Expression|Declaration)/)
      expect(callArgs[1]).toBe(state)
    }
  })

  test('overwrite visitor', () => {
    const ast = {
      type: 'Program',
      sourceType: 'module',
      body: []
    }

    const mockFn1 = jest.fn<void, [NodePath]>()
    const mockFn2 = jest.fn<void, [NodePath]>()
    const mockFn3 = jest.fn<void, [NodePath]>()
    traverse(ast, {
      Program: mockFn1,
      ['Program|1' as any]: mockFn2,
      ['Program|2' as any]: mockFn3,
    })

    expect(mockFn3).toHaveBeenCalledTimes(1)
    expect(mockFn1).toHaveBeenCalledTimes(0)
    expect(mockFn2).toHaveBeenCalledTimes(0)
  })

  test('`comp` should have less priority', () => {
    const ast = {
      type: 'Program',
      sourceType: 'module',
      body: []
    }

    const mockFn1 = jest.fn<void, [NodePath]>()
    const mockFn2 = jest.fn<void, [NodePath]>()

    traverse(ast, {
      Program: mockFn1,
      comp: {
        'Program|Identifier': mockFn2
      }
    })

    expect(mockFn1).toHaveBeenCalledTimes(1)
    expect(mockFn2).toHaveBeenCalledTimes(0)
  })
})

test('enter/leave object', () => {
  const ast = {
    type: 'Program',
    sourceType: 'module',
    body: []
  }
  const state = {}

  const enterFn = jest.fn<void, [NodePath, any]>()
  const leaveFn = jest.fn<void, [NodePath, any]>()
  traverse(ast, {
    Program: {
      enter: enterFn,
      leave: leaveFn
    }
  }, state)

  expect(enterFn).toHaveBeenCalledTimes(1)
  expect(leaveFn).toHaveBeenCalledTimes(1)
  expect(enterFn.mock.calls[0][0].node).toBe(ast)
  expect(enterFn.mock.calls[0][1]).toBe(state)
  expect(leaveFn.mock.calls[0][0].node).toBe(ast)
  expect(leaveFn.mock.calls[0][1]).toBe(state)
})

test('does not visit removed paths', () => {
  const ast = {
    type: 'IfStatement',
    test: {
      type: 'Literal',
      value: 0
    },
    consequent: {
      type: 'ExpressionStatement',
      expression: {
        type: 'Literal',
        value: 1
      }
    },
    alternate: {
      type: 'ExpressionStatement',
      expression: {
        type: 'Identifier',
        name: 'y'
      }
    }
  }
  const mockFn = jest.fn()

  traverse(ast, {
    IfStatement(path) {
      path.get('alternate').remove()
    },
    Identifier: mockFn
  })

  expect(mockFn).toHaveBeenCalledTimes(0)
})

describe('stopping traversal does not traverse', () => {
  test('keyed children', () => {
    const ast = {
      type: 'ArrayExpression',
      elements: [
        {
          type: 'Literal',
          value: 1
        },
        {
          type: 'Literal',
          value: 2
        }
      ]
    }
    const mockFn = jest.fn()

    traverse(ast, {
      ArrayExpression() {
        this.stop()
      },
      Literal: mockFn
    })

    expect(mockFn).toHaveBeenCalledTimes(0)
  })

  test('siblings', () => {
    const ast = {
      type: 'ArrayExpression',
      elements: [
        {
          type: 'Literal',
          value: 1
        },
        {
          type: 'Identifier',
          name: 'x'
        }
      ]
    }
    const mockFn = jest.fn()

    traverse(ast, {
      Literal() {
        this.stop()
      },
      Identifier: mockFn
    })

    expect(mockFn).toHaveBeenCalledTimes(0)
  })

  test('keyed siblings', () => {
    const ast = {
      type: 'ConditionalExpression',
      test: {
        type: 'Literal',
        value: true
      },
      consequent: {
        type: 'Literal',
        value: 0
      },
      alternate: {
        type: 'Identifier',
        name: 'x'
      }
    }
    const mockFn = jest.fn()

    traverse(ast, {
      Literal() {
        this.stop()
      },
      Identifier: mockFn
    })

    expect(mockFn).toHaveBeenCalledTimes(0)
  })

  test('on leave fn', () => {
    const ast = {
      type: 'ConditionalExpression',
      test: {
        type: 'Literal',
        value: true
      },
      consequent: {
        type: 'Literal',
        value: 0
      },
      alternate: {
        type: 'Identifier',
        name: 'x'
      }
    }
    const mockFn = jest.fn()

    traverse(ast, {
      Literal: {
        leave() {
          this.stop()
        }
      },
      Identifier: mockFn
    })

    expect(mockFn).toHaveBeenCalledTimes(0)
  })

  test('newly added nodes', () => {
    const ast = {
      type: 'ArrayExpression',
      elements: [
        {
          type: 'Literal',
          value: 1
        },
      ]
    }
    const mockFn = jest.fn()

    traverse(ast, {
      Literal(path) {
        if (path.node.value === 1) {
          path.insertAfter([
            {
              type: 'Literal',
              value: 2
            },
            {
              type: 'Identifier',
              name: 'x'
            }
          ])
        }

        if (path.node.value === 2) this.stop()
      },
      Identifier: mockFn
    })

    expect(mockFn).toHaveBeenCalledTimes(0)
  })

  test('unSkipped nodes', () => {
    const ast = {
      type: 'ArrayExpression',
      elements: [
        {
          type: 'Literal',
          value: 1
        },
        {
          type: 'Identifier',
          name: 'x'
        },
        {
          type: 'Literal',
          value: 2
        },
      ]
    }
    const mockFn = jest.fn()

    traverse(ast, {
      ArrayExpression(path) {
        const elements = path.get('elements')
        elements[0].skip()
        elements[1].skip()
      },
      Literal(path) {
        if (path.node.value === 2) {
          path.getSibling(0).unSkip()
          path.getSibling(1).unSkip()
        }

        if (path.node.value === 1) this.stop()
      },
      Identifier: mockFn
    })

    expect(mockFn).toHaveBeenCalledTimes(0)
  })
})

test('enabling/disabling node validation and restoring node validation state', () => {
  const ast = {
    type: 'Program',
    sourceType: 'module',
    body: []
  }

  const wasValidationEnabled = getNodeValidationEnabled()

  traverse(ast, {
    $: { validateNodes: false },
    Program(p) {
      expect(() => b.identifier(null)).not.toThrow()

      traverse(p.node, {
        $: { validateNodes: true },
        Program() {
          expect(() => b.identifier(null)).toThrow()
        }
      })

      expect(() => b.identifier(null)).not.toThrow()
    }
  })

  expect(getNodeValidationEnabled()).toBe(wasValidationEnabled)
})

describe('restoring node validation state', () => {
  const programNode = () => ({
    type: 'Program',
    sourceType: 'module',
    body: [
      {
        type: 'ExpressionStatement',
        expression: {
          type: 'Identifier',
          name: 'a'
        }
      }
    ]
  })

  test('restores the previous state when a visitor throws, without wrapping the error', () => {
    setNodeValidationEnabled(true)
    const visitorError = new Error('boom')

    expect(() => traverse(programNode(), {
      $: { validateNodes: false },
      Identifier() {
        expect(getNodeValidationEnabled()).toBe(false)
        throw visitorError
      }
    })).toThrow(visitorError)

    // An unrelated builder after the failed traverse keeps validating nodes
    expect(() => b.identifier(null)).toThrow()
    expect(getNodeValidationEnabled()).toBe(true)

    expect(() => traverse(programNode(), {
      $: { validateNodes: false },
      Identifier() {
        throw visitorError
      }
    })).toThrow(visitorError)

    // Rethrowing must reuse the same error object (stack is not rebuilt)
    let caughtError: unknown
    try {
      traverse(programNode(), {
        $: { validateNodes: false },
        Identifier() {
          throw visitorError
        }
      })
    } catch (error) {
      caughtError = error
    }
    expect(caughtError).toBe(visitorError)
    expect((caughtError as Error).stack).toBe(visitorError.stack)
  })

  test('restores the outer state when a nested traverse throws', () => {
    setNodeValidationEnabled(true)
    const innerError = new Error('inner boom')

    expect(() => traverse(programNode(), {
      $: { validateNodes: false },
      Program(path) {
        expect(() => b.identifier(null)).not.toThrow()

        expect(() => traverse(path.node, {
          $: { validateNodes: true },
          Identifier() {
            expect(getNodeValidationEnabled()).toBe(true)
            throw innerError
          }
        })).toThrow(innerError)

        // Inner traverse failure must not leak its setting into the outer one
        expect(() => b.identifier(null)).not.toThrow()
        expect(getNodeValidationEnabled()).toBe(false)
      }
    })).not.toThrow()

    expect(() => b.identifier(null)).toThrow()
    expect(getNodeValidationEnabled()).toBe(true)
  })

  test('propagates a nested traverse error without swallowing it', () => {
    setNodeValidationEnabled(true)
    const innerError = new Error('uncaught inner boom')

    let codeAfterInnerTraverse = false
    expect(() => traverse(programNode(), {
      $: { validateNodes: false },
      ExpressionStatement(path) {
        path.traverse({
          Identifier() {
            throw innerError
          }
        })
        codeAfterInnerTraverse = true
      }
    })).toThrow(innerError)

    expect(codeAfterInnerTraverse).toBe(false)

    let caughtError: unknown
    try {
      traverse(programNode(), {
        $: { validateNodes: false },
        ExpressionStatement(path) {
          path.traverse({
            Identifier() {
              throw innerError
            }
          })
        }
      })
    } catch (error) {
      caughtError = error
    }
    expect(caughtError).toBe(innerError)
    expect((caughtError as Error).stack).toBe(innerError.stack)
    expect(() => b.identifier(null)).toThrow()
    expect(getNodeValidationEnabled()).toBe(true)
  })

  test('restores the previous state when a nested traverse on a path throws', () => {
    setNodeValidationEnabled(true)
    const innerError = new Error('path boom')

    expect(() => traverse(programNode(), {
      $: { validateNodes: false },
      ExpressionStatement(path) {
        expect(() => path.traverse({
          Identifier() {
            throw innerError
          }
        })).toThrow(innerError)

        // The nested path traverse shares the outer context setting
        expect(getNodeValidationEnabled()).toBe(false)
        expect(() => b.identifier(null)).not.toThrow()
      }
    })).not.toThrow()

    expect(getNodeValidationEnabled()).toBe(true)
  })

  test('restores the previous state after traversal is stopped early', () => {
    setNodeValidationEnabled(true)

    traverse(programNode(), {
      $: { validateNodes: false },
      Identifier() {
        this.stop()
      }
    })

    expect(() => b.identifier(null)).toThrow()
    expect(getNodeValidationEnabled()).toBe(true)

    setNodeValidationEnabled(false)
    traverse(programNode(), {
      $: { validateNodes: true },
      Identifier() {
        this.stop()
      }
    })
    expect(getNodeValidationEnabled()).toBe(false)
    setNodeValidationEnabled(true)
  })
})
