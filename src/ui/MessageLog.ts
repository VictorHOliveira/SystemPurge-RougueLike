export class MessageLog {
  messages: string[] = [];
  private maxLines: number = 100;

  add(msg: string): void {
    this.messages.push(msg);
    if (this.messages.length > this.maxLines) {
      this.messages = this.messages.slice(-this.maxLines);
    }
  }

  getLast(n: number): string[] {
    return this.messages.slice(-n);
  }

  clear(): void {
    this.messages = [];
  }
}
