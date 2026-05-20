export class MessageLog {
  messages: string[] = [];
  private maxLines: number = 100;

  add(msg: string): void {
    const MAX_LINE = 55;
    if (msg.length > MAX_LINE) {
      const words = msg.split(' ');
      let line = '';
      for (const word of words) {
        if ((line + word).length > MAX_LINE) {
          this.messages.push(line.trim());
          line = word + ' ';
        } else {
          line += word + ' ';
        }
      }
      if (line.trim().length > 0) this.messages.push(line.trim());
    } else {
      this.messages.push(msg);
    }
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
