# Formatters

Output formatting for responses.

## BaseFormatter

```typescript
import { BaseFormatter } from 'nomo/formatters';

export class DateFormatter extends BaseFormatter<Date> {
  format(): string {
    return (this.data as Date).toISOString();
  }
}

export class CurrencyFormatter extends BaseFormatter<number> {
  format(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(this.data as number);
  }
}
```