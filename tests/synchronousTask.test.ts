import { Queue } from '../src/index'
import { pushMutipleTasks } from './fixtures/helper'

function synchronousTask(counter = { scheduled: 0 }) {
  let active = 0

  return function(callback: any) {
    try {
      callback(null, { active: ++active, index: counter.scheduled++ })
    } finally {
      --active
    }
  }
}

test('a partly-concurrent queue of ten synchronous tasks executes all tasks in series', () => {
  const task = synchronousTask()

  const queue = Queue.create(3)
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

test('a serialized queue of ten synchronous tasks executes all tasks in series', () => {
  const task = synchronousTask()

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
