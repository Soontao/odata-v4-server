

export enum HttpHeaderConstants {

  HttpHeaderAccept = 'accept',
  HttpHeaderODataVersion = 'OData-Version',
  HttpHeaderAcceptCharset = 'accept-charset',
  ODataValueMaxVersion = 'odata-maxversion',

  HttpContentTypeJson = 'application/json',
  HttpContentTypeTextXml = 'text/xml',
  HttpContentTypeXml = 'xml',
  HttpContentTypeAny = '*/*',

  HttpCharsetUTF8 = 'utf-8',
  ODataValueMetadata = 'odata.metadata',
  ODataValueVersion40 = '4.0',

}

/**
 * the key which support to injection
 */
export enum InjectKey {
  ServerType = 'global:server_type',
  Configuration = 'global:configuration',

  ProcessorOption = 'request:processor_option',

  Request = 'request:request',
  Response = 'request:response',
  RequestContext = 'odata:contextparameter',
  RequestTxId = 'request:transaction:uuid',
  RequestTransaction = 'odata:tx_contextparameter',
  RequestMethod = 'request:method',
  RequestEntityType = 'odata:typeparameter',
  RequestEntityKey = 'odata:keyparameters',
  RequestEntityQuery = 'odata:queryparameter',
  RequestBody = 'odata:bodyparameter',

  HookContext = 'request:hook:context',

  DatabaseHelper = 'global:db_helper',

  GlobalConnection = 'global:connection',
  TransactionConnection = 'request:tx_connection',
  TransactionQueryRunner = 'request:tx_queryRunner',


  // copy from odata
  ODataEntitySets = 'odata:entitysets',
  ODataMethod = 'odata:method',
  ODataKeyParameters = 'odata:keyparameters',
  ODataLinkParameters = 'odata:linkparameters',
  ODataQueryParameter = 'odata:queryparameter',
  ODataFilterParameter = 'odata:filterparameter',
  ODataBodyParameter = 'odata:bodyparameter',
  ODataContextParameter = 'odata:contextparameter',
  ODataStreamParameter = 'odata:streamparameter',
  ODataResultParameter = 'odata:resultparameter',
  ODataIdParameter = 'odata:idparameter',
  ODataTypeParameter = 'odata:typeparameter',
  ODataNamespace = 'odata:namespace',
  ODataTxContextParameter = 'odata:tx_contextparameter',
  ODataInjectContainer = 'odata:inject_container',
  ODataTypedService = 'odata:service',


  InjectODataService = 'odata:service_instance',

}


export enum ServerType {
  base = 'base',
  typed = 'typed'
}


/**
 * default top/limit value
 */
export const DEFAULT_TOP_VALUE = 1000 * 1000;
