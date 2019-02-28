import { Queue } from '../src/index'
import { pushMutipleTasks } from './fixtures/helper'

function asynchronousTask(counter = { scheduled: 0 }) {
  let active = 0

  return function(callback: any) {
    let index = counter.scheduled++
    ++active
    process.nextTick(function() {
      try {
        callback(null, { active, index })
      } finally {
        --active
      }
    })
  }
}

test('a serialized queue of asynchronous tasks processes tasks serially', () => {
  const task = asynchronousTask()
  const queue = Queue.create(1)
  pushMutipleTasks(task, queue).awaitAll(callback1)

  function callback1(error: Error | null, results?: any) {
    expect(error).toBe(null)
    expect(results).toEqual([
      { active: 1, index: 0 },
      { active: 1, index: 1 },
      { active: 1, index: 2 },
      { active: 1, index: 3 },
      { active: 1, index: 4 },
      { active: 1, index: 5 },
      { active: 1, index: 6 },
      { active: 1, index: 7 },
      { active: 1, index: 8 },
      { active: 1, index: 9 },
    ])
  }
})

test('a fully-concurrent queue of ten asynchronous tasks executes all tasks concurrently', () => {
  const task = asynchronousTask()
  const queue = Queue.create()
  pushMutipleTasks(task, queue).awaitAll(callback1)

  function callback1(error: Error | null, results?: any) {
    expect(error).toBe(null)
    expect(results).toEqual([
      { active: 10, index: 0 },
      { active: 9, index: 1 },
      { active: 8, index: 2 },
      { active: 7, index: 3 },
      { active: 6, index: 4 },
      { active: 5, index: 5 },
      { active: 4, index: 6 },
      { active: 3, index: 7 },
      { active: 2, index: 8 },
      { active: 1, index: 9 },
    ])
  }
})

test('a partly-concurrent queue of ten asynchronous tasks executes at most three tasks concurrently', () => {
  const task = asynchronousTask()
  const queue = Queue.create(3)
  pushMutipleTasks(task, queue).awaitAll(callback1)

  function callback1(error: Error | null, results?: any) {
    expect(error).toBe(null)
    expect(results).toEqual([
      { active: 3, index: 0 },
      { active: 3, index: 1 },
      { active: 3, index: 2 },
      { active: 3, index: 3 },
      { active: 3, index: 4 },
      { active: 3, index: 5 },
      { active: 3, index: 6 },
      { active: 3, index: 7 },
      { active: 2, index: 8 },
      { active: 1, index: 9 },
    ])
  }
})
