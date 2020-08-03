import { toInteger } from '@newdash/newdash/toInteger';
import { toNumber } from '@newdash/newdash/toNumber';
import { trimPrefix } from '@newdash/newdash/trimPrefix';
import { trimSuffix } from '@newdash/newdash/trimSuffix';


function integer(value: string): number {
  return toInteger(value);
}

function float(value: string): number {
  switch (value) {
    case 'INF': return Infinity;
    case '-INF': return -Infinity;
    default: return toNumber(value);
  }
}

export class Literal {
  constructor(type: string, value: string) {
    const result = (this[type] || ((_) => _))(value);
    this.valueOf = () => result;
  }
  static convert(type: string, value: string): any {
    return (new Literal(type, value)).valueOf();
  }
  'Edm.String'(value: string) {
    if (typeof value == 'string') {
      return trimSuffix(trimPrefix(decodeURIComponent(value), "'"), "'").replace(/''/g, "'");
    }
    return value;
  }
  'Edm.Byte'(value: string) {
    return integer(value);
  }
  'Edm.SByte'(value: string) {
    return integer(value);
  }
  'Edm.Int16'(value: string) {
    return integer(value);
  }
  'Edm.Int32'(value: string) {
    return integer(value);
  }
  'Edm.Int64'(value: string) {
    return integer(value);
  }
  'Edm.Decimal'(value: string) {
    return float(value);
  }
  'Edm.Double'(value: string) {
    return float(value);
  }
  'Edm.Single'(value: string) {
    return float(value);
  }
  'Edm.Boolean'(value: string) {
    switch (typeof value) {
      case 'string':
        value = value || '';
        switch (value.toLowerCase()) {
          case 'true': return true;
          case 'false': return false;
          default: return undefined;
        }
      case 'boolean':
        return value;
      default:
        return undefined;
    }

  }
  'Edm.Guid'(value: string) {
    return decodeURIComponent(value);
  }
  'Edm.Date'(value: string) {
    return value;
  }
  'Edm.DateTimeOffset'(value: string) {
    return new Date(value);
  }
  'null'(value: string) {
    return null;
  }
  'Edm.TimeOfDay'(value: string) {
    return new Date(`1970-01-01T${value}Z`);
  }
  'Edm.Duration'(value: string) {
    const m = value.match(/P([0-9]*D)?T?([0-9]{1,2}H)?([0-9]{1,2}M)?([\.0-9]*S)?/);
    if (m) {
      const d = new Date(0);
      for (let i = 1; i < m.length; i++) {
        switch (m[i].slice(-1)) {
          case 'D': d.setDate(parseInt(m[i])); continue;
          case 'H': d.setHours(parseInt(m[i])); continue;
          case 'M': d.setMinutes(parseInt(m[i])); continue;
          case 'S': d.setSeconds(parseFloat(m[i])); continue;
        }
      }

      return d.getTime();
    }
    throw new Error('Invalid Duration');
  }
}
