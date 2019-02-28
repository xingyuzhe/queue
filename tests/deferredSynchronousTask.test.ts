import { Queue } from '../src/index'
import { pushMutipleTasks } from './fixtures/helper'

function deferredSynchronousTask(counter = { scheduled: 0 }) {
  let active = 0
  let deferrals: any[] = []

  function task(callback: any) {
    if (deferrals) {
      return deferrals.push({ callback, index: counter.scheduled++ })
    }

    try {
      callback(null, { active: ++active, index: counter.scheduled++ })
    } finally {
      --active
    }
  }

  task.finish = function() {
    let deferrals_ = deferrals.slice()
    deferrals = null
    deferrals_.forEach(function(deferral) {
      try {
        deferral.callback(null, { active: ++active, index: deferral.index })
      } finally {
        --active
      }
    })
  }

  return task
}

test('a serialized queue of ten deferred synchronous tasks executes all tasks in series, within the callback of the first task', () => {
  const task = deferredSynchronousTask()

  const queue = Queue.create(1)
  pushMutipleTasks(task, queue).awaitAll(callback1)

  task.finish()

  function callback1(error: Error | null, results?: any) {
    expect(error).toBe(null)
    expect(results).toEqual([
      { active: 1, index: 0 },
      { active: 2, index: 1 },
      { active: 2, index: 2 },
      { active: 2, index: 3 },
      { active: 2, index: 4 },
      { active: 2, index: 5 },
      { active: 2, index: 6 },
      { active: 2, index: 7 },
      { active: 2, index: 8 },
      { active: 2, index: 9 },
    ])
  }
})

test('a huge queue of deferred synchronous tasks does not throw a RangeError', () => {
  const task = deferredSynchronousTask()
  const n = 200000
  const queue = Queue.create(1)
  pushMutipleTasks(task, queue, n).awaitAll(callback1)

  task.finish()

  function callback1(error: Error | null, results?: any) {
    expect(error).toBe(null)
    expect(results.length).toEqual(n)
  }
})
