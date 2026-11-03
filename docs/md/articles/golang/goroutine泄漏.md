# goroutine 泄漏：原因、排查与退出设计

> 知识点：Go 并发、channel、context、pprof。

**goroutine 泄漏，是任务已经结束或不再需要，但对应 goroutine 因为阻塞或缺少退出条件，一直没有退出。**

排查时要回答三个问题：谁创建了它、它正在等什么、谁负责让它结束。

## 1. 为什么值得关注

泄漏的 goroutine 可能阻塞在 channel、锁或外部调用上，所以 CPU 不一定明显升高。但它仍然占用运行时资源，栈中保留的引用还可能使其他对象无法回收。Go 官方的 [Pipeline 与取消示例](https://go.dev/blog/pipelines) 解释了消费者提前退出后，上游发送者无法结束的情况。

长期存活不一定等于泄漏。消息消费者和后台维护任务可以与服务具有相同生命周期；问题在于它们是否仍有用途，以及停止服务或任务时能否退出。

| 现象 | 可能含义 |
| --- | --- |
| 流量增加，goroutine 增加；流量回落后数量也回落 | 可能是正常并发 |
| 每处理一批请求，数量就多一批，空闲后仍不回落 | 需要怀疑泄漏 |
| goroutine 长期存在，但数量稳定、职责明确 | 可能是正常后台任务 |
| 数量增加且请求变慢 | 也可能是下游变慢造成积压，不能只凭数量定性 |

GC 不会自动结束仍然存活的 goroutine；应由程序安排它的退出路径。

## 2. 典型原因：没有人再接收结果

下面是一个错误示例，函数本身可以返回，但它启动的 goroutine 无法结束：

```go
func start() {
    ch := make(chan int)

    go func() {
        result := 123
        ch <- result // 无缓冲 channel 没有接收方，永久阻塞。
    }()

    // 没有接收结果，也没有通知后台退出。
}
```

在长时间运行的服务中，反复调用会持续留下 goroutine。独立小程序退出后，进程中的 goroutine 也会结束，因此只观察一次程序退出，不能说明不存在泄漏。

反过来，接收方也可能一直等待：

```go
func waitResult(ch <-chan int) {
    result := <-ch // 如果永远没有发送、没有关闭，就一直等下去。
    handle(result)
}
```

### 常见场景

| 场景 | 容易遗漏的退出条件 |
| --- | --- |
| 请求超时，后台计算或请求仍继续 | 请求取消没有向下传递，或任务不响应取消 |
| 向 channel 发送 | 接收方可能提前返回 |
| 从 channel 接收或 `range` 遍历 | 发送方停止，但没有结束通知 |
| 后台循环 | 没有停止信号，或只在部分位置检查 |
| HTTP、数据库等外部调用 | 缺少超时，或操作不支持当前取消机制 |
| 等待锁或 WaitGroup | 锁未释放、遗漏 `Done()` 或出现相互等待 |

锁等待、I/O 等待本身只是线索；需要结合生命周期，判断是否已经没有继续推进的可能。

## 3. 修复思路：让阻塞点能够退出

对于可能被放弃的发送，在发送和取消之间选择：

```go
select {
case out <- result:
    // 结果成功交给接收方。
case <-ctx.Done():
    // 接收方或任务所有者不再需要结果。
    return
}
```

接收时也可以使用同样的机制，并处理 channel 关闭：

```go
select {
case value, ok := <-in:
    if !ok {
        return
    }
    handle(value)
case <-ctx.Done():
    return
}
```

### 一个可运行的完整示例

这里故意不接收 `out` 的结果，模拟调用方不再消费；超时后，worker 会响应取消并退出。

```go
package main

import (
    "context"
    "fmt"
    "sync"
    "time"
)

func worker(ctx context.Context, out chan<- int) {
    result := 123 // 示例中没有耗时计算。

    select {
    case out <- result:
        fmt.Println("result delivered")
    case <-ctx.Done():
        fmt.Println("worker stopped:", ctx.Err())
        return
    }
}

func main() {
    ctx, cancel := context.WithTimeout(context.Background(), 50*time.Millisecond)
    defer cancel()

    out := make(chan int)
    var wg sync.WaitGroup
    wg.Add(1)

    go func() {
        defer wg.Done()
        worker(ctx, out)
    }()

    // 没有人读取 out。等待 worker 通过取消路径退出。
    wg.Wait()
    fmt.Println("all workers exited")
}
```

保存为 `main.go`，执行 `go run main.go`，会看到：

```text
worker stopped: context deadline exceeded
all workers exited
```

这里 `context` 负责传递取消信号，`WaitGroup` 负责等待 worker 真正结束，两者职责不同。

### cancel() 不会强制杀掉 goroutine

如果代码先执行一个不响应取消的操作：

```go
result := slowOperation() // 假设内部一直阻塞。

select {
case out <- result:
case <-ctx.Done():
    return
}
```

那么后面的 `select` 还没有机会执行。需要让 `slowOperation` 本身支持取消或合适的超时，例如向 HTTP 请求传递 context，或使用数据库的 context 接口；具体效果取决于调用链和驱动实现。

另外，调用 `cancel()` 不会等待所有工作结束，需要等待时应另做同步。这个约定见 [context.CancelFunc 文档](https://pkg.go.dev/context#CancelFunc)。

如果发送与取消同时就绪，`select` 不保证取消优先。如果业务要求取消后不得再交付结果，还需要结合业务状态和同步机制设计，不能只依赖这个示例。

## 4. 排查流程：趋势、堆栈、生命周期

### 第一步：确认数量趋势

可以通过已有监控观察 goroutine 数量，或使用：

```go
runtime.NumGoroutine()
```

结合请求量、任务量、下游耗时和内存一起看。没有统一的“超过多少个就是泄漏”阈值，关键是当前负载下是否持续积累，以及工作结束后能否恢复。

### 第二步：获取 goroutine 堆栈

服务已配置 pprof 时，可以获取文本堆栈：

```bash
curl -o goroutines.txt \
  'http://127.0.0.1:6060/debug/pprof/goroutine?debug=2'
```

关注大量重复的业务调用栈：

```text
goroutine 123 [chan send]:
example.com/app.start.func1()
    /app/main.go:12
```

这说明它停在 channel 发送处，还需要回到代码确认：谁应该接收、接收方为何退出、发送方是否有取消路径。

`chan receive`、锁等待或 `IO wait` 也可以作为定位线索。建议在相近负载条件下对比多次快照，观察哪类业务堆栈持续增长；单次快照只是当时状态，不能独立证明泄漏。

也可以保存可由 pprof 分析的 profile：

```bash
curl -o goroutine.pprof \
  'http://127.0.0.1:6060/debug/pprof/goroutine'

go tool pprof -http=127.0.0.1:8081 goroutine.pprof
```

### 如何接入 HTTP pprof

以下函数使用独立的 mux，只注册 goroutine profile 路径，避免混入业务路由：

```go
func serveGoroutineProfile() error {
    mux := http.NewServeMux()
    mux.Handle("/debug/pprof/goroutine", pprof.Handler("goroutine"))

    server := &http.Server{
        Addr:              "127.0.0.1:6060",
        Handler:           mux,
        ReadHeaderTimeout: 5 * time.Second,
    }
    return server.ListenAndServe()
}
```

对应导入：`net/http`、`net/http/pprof` 和 `time`。在服务启动逻辑中运行并处理返回的错误；生产服务还应将这个诊断 server 纳入关闭流程。示例只监听本机，需要远程排查时通过受控通道访问。

接口与 profile 用法可参考 [net/http/pprof 文档](https://pkg.go.dev/net/http/pprof) 和 [runtime/pprof 文档](https://pkg.go.dev/runtime/pprof)。

### 第三步：检查生命周期

沿着可疑 goroutine 的创建点检查：

- 谁负责它，预期何时结束？
- 正常完成、超时、取消和下游异常时，分别走哪条退出路径？
- 是否在所有可能长期阻塞的位置提供取消或超时？
- 循环退出后，连接等资源是否释放？
- 是否需要等待子任务退出？

### 第四步：验证修复

覆盖正常完成、接收方提前退出、请求取消、下游故障等路径。验证 worker 能在约定时间内结束，而不只验证接口返回。

不宜仅断言全进程 goroutine 数量完全相等：运行时、网络库或监控组件可能有正常后台任务。优先观察目标任务的退出通知、等待机制和重复执行后的趋势。

## 5. 几个容易误判的地方

### 增加 channel 缓冲区，不一定解决问题

如果明确只发送一个结果，容量为 1 的缓冲区可能允许发送者交付后结束。但如果发送数量会增长，或循环不会停止，缓冲区满后仍然阻塞。缓冲区容量不能代替生命周期设计。

### 关闭 channel 不是通用修复方式

如果发送方仍在发送，接收方贸然关闭 channel 会造成 panic。通常由发送方或明确的所有者，在确认不会再发送时关闭；多发送者需要协调。也可以使用独立的取消信号通知退出。

### 有 context 参数，不等于已经支持取消

`ctx` 必须真正传入底层调用，或在循环、channel 收发等位置被检查。把阻塞函数再包进一个 goroutine、外层超时返回，也不代表内部工作已经结束。

### WaitGroup 只等待，不负责停止

`Wait()` 不能替代取消；如果 worker 没有退出路径，它也可能一直等下去。启动 goroutine 前先 `Add()`，确保所有退出路径调用 `Done()`。

## 6. 一段简洁的面试回答

> goroutine 泄漏是任务结束或失去用途后，相关 goroutine 因阻塞或缺少退出机制而一直存活。常见于 channel 收发、未取消的后台任务和缺少超时的外部调用。我会先看数量趋势，再通过 goroutine profile 找持续增长的业务堆栈，检查创建者和退出路径。修复时让阻塞点响应取消或超时，并验证任务真正退出。context 只传递取消信号，不会强制终止，也不会等待任务结束。
