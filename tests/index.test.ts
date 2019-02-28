import * as fs from 'fs'
import { Queue } from '../src/index'

test('example queue of fs.stat', () => {
  Queue.create()
    .defer(fs.stat, __dirname + '/../src/index.ts')
    .defer(fs.stat, __dirname + '/../README.md')
    .defer(fs.stat, __dirname + '/../package.json')
    .await(callback)

  function callback(error: Error | null, one: any, two: any, three: any) {
    expect(error === null)
    expect(one.size > 0)
    expect(two.size > 0)
    expect(three.size > 0)
  }
})

test('in a queue of a single synchronous task that errors, the error is returned', () => {
  Queue.create()
    .defer(function(callback1) {
      callback1(new Error('1'))
    })
    .await(callback)

  function callback(error: Error | null, result?: any) {
    expect(error && error.message === '1')
    expect(result === undefined)
  }
})

test('in a queue of a single asynchronous task that errors, the error is returned', () => {
  Queue.create()
    .defer(function(callback1) {
      process.nextTick(() => {
        callback1(new Error('1'))
      })
    })
    .await(callback)

  function callback(error: Error | null, result?: any) {
    expect(error && error.message === '1')
    expect(result === undefined)
  }
})

test('in a queue with multiple tasks that error, the first error is returned', () => {
  Queue.create()
    .defer(function(callback) {
      setTimeout(() => {
        callback(-2)
      }, 100)
    })
    .defer(function(callback) {
      process.nextTick(() => {
        callback(new Error('1'))
      })
    })
    .defer(function(callback) {
      setTimeout(() => {
        callback(-3)
      }, 200)
    })
    .await(callback1)

  function callback1(error: Error | null, one?: any, two?: any, three?: any) {
    expect(error && error.message === '1')
    expect(one === undefined)
    expect(two === undefined)
    expect(three === undefined)
  }
})

test('in a queue with multiple tasks where one errors, the first error is returned', () => {
  Queue.create()
    .defer(function(callback) {
      process.nextTick(() => {
        callback(new Error('1'))
      })
    })
    .defer(function(callback) {
      process.nextTick(() => {
        callback(null, 'ok')
      })
    })
    .await(callback1)

  function callback1(error: Error | null, one?: any, two?: any) {
    expect(error && error.message === '1')
    expect(one === undefined)
    expect(two === undefined)
  }
})

test('in a queue with multiple synchronous tasks that error, the first error prevents the other tasks from running', () => {
  Queue.create()
    .defer(function(callback) {
      callback(new Error('1'))
    })
    .defer(function(callback) {
      callback(new Error('2'))
    })
    .defer(function(callback) {
      throw new Error('3')
    })
    .await(callback1)

  function callback1(error: Error | null, one?: any, two?: any, three?: any) {
    expect(error && error.message === '1')
    expect(one === undefined)
    expect(two === undefined)
    expect(three === undefined)
  }
})

test('in a queue with a task that throws an error synchronously, the error is reported to the await callback', () => {
  Queue.create()
    .defer(function() {
      throw new Error('foo')
    })
    .await(callback1)

  function callback1(error: Error | null) {
    expect(error && error.message === 'foo')
  }
})

test('in a queue with a task that throws an error after calling back, the error is ignored', () => {
  Queue.create()
    .defer(function(callback) {
      setTimeout(() => {
        callback(null, 1)
      }, 100)
    })
    .defer(function(callback) {
      callback(null, 2)
      process.nextTick(() => {
        callback(new Error('foo'))
      })
    })
    .await(callback1)

  function callback1(error: Error | null) {
    expect(error === null)
  }
})

test('in a queue with a task that doesn’t terminate and another that errors synchronously, the error is still reported', () => {
  Queue.create()
    .defer(function(callback) {
      /* Run forever! */
    })
    .defer(function(callback) {
      callback(new Error('foo'))
    })
    .await(callback1)

  function callback1(error: Error | null) {
    expect(error.message === 'foo')
  }
})

test('if a task calls back successfully more than once, subsequent calls are ignored', () => {
  Queue.create()
    .defer(function(callback) {
      setTimeout(() => {
        callback(null, 1)
      }, 100)
    })
    .defer(function(callback) {
      callback(null, 2)
      process.nextTick(function() {
        callback(null, -1)
      })
    })
    .defer(function(callback) {
      callback(null, 3)
      process.nextTick(function() {
        callback(new Error('foo'))
      })
    })
    .defer(function(callback) {
      process.nextTick(function() {
        callback(null, 4)
      })
      setTimeout(() => {
        callback(new Error('bar'))
      }, 100)
    })
    .await(callback1)

  function callback1(error: Error | null, one?: any, two?: any, three?: any, four?: any) {
    expect(error === null)
    expect(one === 1)
    expect(two === 2)
    expect(three === 3)
    expect(four === 4)
  }
})

test('if a task calls back with an error more than once, subsequent calls are ignored', () => {
  Queue.create()
    .defer(function(callback) {
      setTimeout(() => {
        callback(null, 1)
      }, 100)
    })
    .defer(function(callback) {
      callback(new Error('foo'))
      process.nextTick(function() {
        callback(new Error('bar'))
      })
    })
    .defer(function(callback) {
      process.nextTick(function() {
        callback(new Error('bar'))
      })
      setTimeout(() => {
        callback(new Error('baz'))
      }, 100)
    })
    .await(callback1)

  function callback1(error: Error | null) {
    expect(error.message === 'foo')
  }
})

test('if a task throws an error aftering calling back synchronously, the error is ignored', () => {
  Queue.create()
    .defer(function(callback) {
      callback(null, 1)
      throw new Error()
    })
    .await(callback1)

  function callback1(error: Error | null, one?: any) {
    expect(error === null)
    expect(one === 1)
  }
})

// test('if the await callback throws an error aftering calling back synchronously, the error is thrown', () => {
//   Queue.create(1)
//     .defer(function(callback) {
//       process.nextTick(callback)
//     })
//     .defer(function(callback) {
//       callback(null, 1)
//     })
//     .await(() => {
//       throw new Error('foo')
//     })

//   process.once('uncaughtException', function(error) {
//     expect(error.message === 'foo')
//   })
// })

test('if a task errors, another task can still complete successfully, and is ignored', () => {
  Queue.create()
    .defer(function(callback) {
      setTimeout(function() {
        callback(null, 1)
      }, 10)
    })
    .defer(function(callback) {
      callback(new Error('foo'))
    })
    .await(callback1)

  function callback1(error: Error | null) {
    expect(error.message === 'foo')
  }
})

test('if a task errors, it is not subsequently aborted', () => {
  let aborted = false

  Queue.create()
    .defer(function(callback) {
      process.nextTick(() => {
        callback(new Error('foo'))
      })

      return {
        abort: () => {
          aborted = true
        },
      }
    })
    .await(callback1)

  function callback1(error: Error | null) {
    expect(error.message === 'foo')
    expect(aborted === false)
  }
})

test('a task that defers another task is allowed', () => {
  let queue = Queue.create()
  queue.defer(function(callback) {
    callback(null)
    queue.defer(() => {
      expect(true)
    })
  })
})

// test('a falsely error is still considered an error', () => {
//   Queue.create()
//   .defer((callback) => {
//     callback(0)
//   })
//   .defer(() => { throw new Error })
//   .await(error => {
//     expect(error).toBe(0)
//   })
// })

test('if the await callback is set during abort, it only gets called once', () => {
  const queue = Queue.create()
  queue
    .defer(() => {
      return {
        abort: () => {
          queue.await(callback)
        },
      }
    })
    .defer(() => {
      throw new Error('foo')
    })

  function callback(error: Error | null) {
    expect(error.message).toBe('foo')
  }
})
