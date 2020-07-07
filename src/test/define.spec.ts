import { Token } from 'odata-v4-parser/lib/lexer';
import { createFilter } from 'odata-v4-inmemory';
import { ODataController, ODataServer, ODataProcessor, ODataMethodType, ODataResult, Edm, odata, ODataHttpContext, ODataStream, ODataEntity } from '../lib/index';
import { DefTest } from './test.model';

describe('OData ES6 .define()', () => {
  class DefTestController extends ODataController {
    all() {
    }
    one(key) {
    }
  }

  it('should throw decorator error', () => {
    try {
      DefTestController.define(odata.type(DefTest), {
        all: odata.GET,
        one: [odata.GET, {
          key: odata.key
        }]
      }, 'ex');
    } catch (err) {
      expect(err.message).toEqual('Unsupported decorator on DefTestController using ex');
    }
  });

  it('should throw member decorator error', () => {
    try {
      DefTestController.define(odata.type(DefTest), {
        all: odata.GET,
        one: [odata.GET, {
          key: odata.key
        }],
        ex: 'ex'
      });
    } catch (err) {
      expect(err.message).toEqual('Unsupported member decorator on DefTestController at ex using ex');
    }
  });

  it('should throw parameter decorator error', () => {
    try {
      DefTestController.define(odata.type(DefTest), {
        all: odata.GET,
        one: [odata.GET, {
          key: odata.key,
          ex: 'ex'
        }]
      });
    } catch (err) {
      expect(err.message).toEqual('Unsupported parameter decorator on DefTestController at one.ex using ex');
    }
  });
});
