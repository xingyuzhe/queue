const call = Symbol('Queue:call')
const error = Symbol('Queue:error')
const tasks = Symbol('Queue:tasks')
const waiting = Symbol('Queue:waiting')
const active = Symbol('Queue:active')
const ended = Symbol('Queue:ended')
const started = Symbol('Queue:started')
const data = Symbol('Queue:data')
const poke = Symbol('Queue:data')
const start = Symbol('Queue:start')
const end = Symbol('Queue:end')
const abort = Symbol('Queue:abort')
const done = Symbol('Queue:done')

type Callback = (error: Error | null, results?: any[]) => void
type CallbackWithIsolatedAugements = (error: Error | null, ...results: any[]) => void
type Task = (...args: any[]) => void

export class Queue {
  static create(concurrency?: number) {
    return new Queue(concurrency)
  }

  // 等待任务数
  private [waiting] = 0
  // 活动任务数
  private [active] = 0
  // 已结束任务数
  private [ended] = 0
  // 一轮循环是否开始
  private [started] = false
  // 任务集合
  private [tasks]: any[] = []
  // 任务运行结果集合
  private [data]: any[]
  // 错误对象
  private [error]: Error
  // await回调函数
  private [call]: Callback

  constructor(readonly concurrency: number = Infinity) {
    if (typeof concurrency !== 'number' || concurrency < 1) {
      throw new Error('invalid concurrency')
    }
  }

  defer(taskHandler: Task, ...args: any[]): this {
    if (typeof taskHandler !== 'function') {
      throw new Error('invalid task')
    }

    if (this[call]) {
      throw new Error('can not defer after await')
    }

    if (this[error]) {
      return this
    }

    args.push(taskHandler)
    this[waiting]++
    this[tasks].push(args)

    this[poke]()
    return this
  }

  /**
   * 1 中断所有激活态的任务, 并调用该任务的abort函数(如果定义了的话)
   * 2 所有新任务start时将被拦截, 并立即调用awaitAll函数(传入一个表示queue被中断的error)
   */
  abort(): this {
    if (!this[error]) {
      this[abort](new Error('abort'))
    }

    return this
  }

  await(callback: CallbackWithIsolatedAugements): this {
    if (typeof callback !== 'function') {
      throw new Error('invalid callback')
    }

    if (this[call]) {
      throw new Error('multiple await not allowed')
    }

    this[call] = (err, results: any[]) => {
      callback.apply(null, [err].concat(results))
    }

    this[done]()
    return this
  }

  awaitAll(callback: Callback): this {
    if (typeof callback !== 'function') {
      throw new Error('invalid callback')
    }

    if (this[call]) {
      throw new Error('multiple await not allowed')
    }

    this[call] = callback
    this[done]()
    return this
  }

  private [start]() {
    this[started] = !!this[waiting] && this[active] < this.concurrency
    while (this[started]) {
      // 最新一个尚未开始执行的任务索引
      const currentWatingIndex = this[ended] + this[active]
      // 当前任务对象存的是声明defer时的所有参数和任务处理函数
      let curentWatingTask = this[tasks][currentWatingIndex]
      // 任务函数在最后一位
      const currentTaskHandlerIndex = curentWatingTask.length - 1
      const currentTaskHandler = curentWatingTask[currentTaskHandlerIndex]

      // 将最后一位替换成自定义回调函数
      curentWatingTask[currentTaskHandlerIndex] = this[end](currentWatingIndex)

      this[waiting]--
      this[active]++

      // 执行原始任务函数, 更新任务对象
      curentWatingTask = currentTaskHandler.apply(null, curentWatingTask)

      this[started] = !!this[waiting] && this[active] < this.concurrency

      // 如果是同步任务执行完毕
      if (!this[tasks][currentWatingIndex]) {
        continue
      }

      this[tasks][currentWatingIndex] = curentWatingTask || {}
    }
  }

  private [poke]() {
    // 当一轮循环结束时才重新激活任务队列
    if (!this[started]) {
      try {
        this[start]()
      } catch (e) {
        if (this[tasks][this[ended] + this[active] - 1]) {
          this[abort](e) // task errored synchronously
        } else if (!this[data]) {
          throw e // await callback errored synchronously
        }
      }
    }
  }

  private [end](i: number) {
    return (err: Error | null, results: any) => {
      if (!this[tasks][i]) {
        return // ignore multiple callbacks
      }

      this[active]--
      this[ended]++

      this[tasks][i] = null

      if (this[error]) {
        return // ignore secondary errors
      }

      if (err) {
        this[abort](err)
      } else {
        // 存储回调结果
        this[data] = this[data] || []
        this[data][i] = results

        if (this[waiting]) {
          this[poke]()
        } else {
          this[done]()
        }
      }
    }
  }

  private [abort](err: Error) {
    if (!err) {
      throw new Error(`expected error`)
    }

    this[error] = err // ignore active callbacks
    this[data] = undefined // allow gc
    this[waiting] = NaN // prevent starting

    let i = this[tasks].length

    while (i >= 0) {
      const t = this[tasks][i]
      if (t) {
        this[tasks][i] = null
        if (t.abort) {
          try {
            t.abort()
          } catch (e) {
            /* ignore */
          }
        }
      }

      i--
    }

    this[active] = NaN // allow notification
    this[done]()
  }

  private [done]() {
    if (!this[active] && this[call]) {
      const cacheData = this[data]
      this[data] = undefined // allow gc
      this[call](this[error] || null, cacheData)
    }
  }
}
