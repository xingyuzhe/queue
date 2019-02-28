import { Queue } from '../src/index'

function abortableTask(delay: number) {
  let active = 0
  let counter = { scheduled: 0, aborted: 0 }

  function task(callback: any) {
    let index = counter.scheduled++
    ++active
    let timeout = setTimeout(function() {
      timeout = null
      try {
        callback(null, { active, index })
      } finally {
        --active
      }
    }, delay)

    return {
      abort() {
        if (timeout) {
          clearTimeout(timeout)
          timeout = null
          ++counter.aborted
        }
      },
    }
  }

  task.aborted = function() {
    return counter.aborted
  }

  return task
}
test('aborts a queue of partially-completed asynchronous tasks', () => {
  const shortTask = abortableTask(50)
  const longTask = abortableTask(5000)
  const queue = Queue.create()
  queue
    .defer(shortTask)
    .defer(longTask)
    .defer(shortTask)
    .defer(longTask)
    .defer(shortTask)
    .defer(longTask)
    .defer(shortTask)
    .defer(longTask)
    .defer(shortTask)
    .defer(longTask)
    .await(callback1)

  setTimeout(function() {
    queue.abort()
  }, 250)

  function callback1(error: Error | null, results?: any) {
    expect(error.message).toBe('abort')
    expect(results).toBe(undefined)
    expect(shortTask.aborted()).toBe(0)
    expect(longTask.aborted()).toBe(5)
  }
})

test('aborts an entire queue of asynchronous tasks', () => {
  const longTask = abortableTask(5000)
  const queue = Queue.create()
  queue
    .defer(longTask)
    .defer(longTask)
    .defer(longTask)
    .defer(longTask)
    .defer(longTask)
    .await(callback1)

  setTimeout(function() {
    queue.abort()
  }, 250)

  function callback1(error: Error | null, results?: any) {
    expect(error.message).toBe('abort')
    expect(results).toBe(undefined)
    expect(longTask.aborted()).toBe(5)
  }
})

test('does not abort tasks that have not yet started', () => {
  const shortTask = abortableTask(50)
  const longTask = abortableTask(5000)
  const queue = Queue.create(2)
  queue
    .defer(shortTask)
    .defer(longTask)
    .defer(shortTask)
    .defer(longTask)
    .defer(shortTask)
    .defer(longTask)
    .defer(shortTask)
    .defer(longTask)
    .defer(shortTask)
    .defer(longTask)
    .await(callback1)

  setTimeout(function() {
    queue.abort()
  }, 250)

  function callback1(error: Error | null, results?: any) {
    expect(error.message).toBe('abort')
    expect(results).toBe(undefined)
    expect(shortTask.aborted()).toBe(0)
    expect(longTask.aborted()).toBe(2)
  }
})
