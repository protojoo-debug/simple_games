export class Pool<T> {
  private readonly available: T[] = [];

  public constructor(
    size: number,
    private readonly create: () => T,
  ) {
    for (let i = 0; i < size; i += 1) this.available.push(this.create());
  }

  public acquire(): T {
    return this.available.pop() ?? this.create();
  }

  public release(item: T): void {
    this.available.push(item);
  }
}
