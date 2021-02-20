# OData(V4) Server

[![npm (scoped)](https://img.shields.io/npm/v/@odata/server?label=@odata/server)](https://www.npmjs.com/package/@odata/server)
[![npm (scoped)](https://img.shields.io/npm/v/@odata/client?label=@odata/client)](https://www.npmjs.com/package/@odata/client)
[![npm (scoped)](https://img.shields.io/npm/v/@odata/parser?label=@odata/parser)](https://www.npmjs.com/package/@odata/parser)
[![npm (scoped)](https://img.shields.io/npm/v/@odata/metadata?label=@odata/metadata)](https://www.npmjs.com/package/@odata/metadata)

[![Unit Test Status](https://img.shields.io/github/workflow/status/Soontao/odata-v4-server/unittest?label=nodejs/sqljs)](https://github.com/Soontao/odata-v4-server/actions?query=workflow%3Aunittest)
[![MySQL Integration Status](https://img.shields.io/github/workflow/status/Soontao/odata-v4-server/unittest-with-mysql?label=mysql)](https://github.com/Soontao/odata-v4-server/actions?query=workflow%3Aunittest-with-mysql)
[![PostgreSQL Integration Status](https://img.shields.io/github/workflow/status/Soontao/odata-v4-server/unittest-with-pg?label=postgres)](https://github.com/Soontao/odata-v4-server/actions?query=workflow%3Aunittest-with-pg)
[![SAP HANA Integration Status](https://img.shields.io/github/workflow/status/Soontao/odata-v4-server/unittest-with-hana?label=hana)](https://github.com/Soontao/odata-v4-server/actions?query=workflow%3Aunittest-with-hana)
[![Codecov](https://codecov.io/gh/Soontao/odata-v4-server/branch/master/graph/badge.svg)](https://codecov.io/gh/Soontao/odata-v4-server)

[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Soontao_odata-v4-server&metric=security_rating)](https://sonarcloud.io/dashboard?id=Soontao_odata-v4-server)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Soontao_odata-v4-server&metric=reliability_rating)](https://sonarcloud.io/dashboard?id=Soontao_odata-v4-server)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Soontao_odata-v4-server&metric=sqale_index)](https://sonarcloud.io/dashboard?id=Soontao_odata-v4-server)

NodeJS OData(V4) Server Implementation.

**This project is under heavy development, if you are looking forward an OData Framework for production usage, please try the [SAP CAP Framework](https://cap.cloud.sap/docs/get-started/)**

**Just check the [demo project](https://github.com/Soontao/odata-v4-server-demo) for features preview.**

## Features

* OASIS Standard `OData` Version **4.0** server
* usable as a standalone server, or as an `Express` router
* expose service document and service metadata - `$metadata`
* setup metadata using decorators or [@odata/metadata](https://github.com/Soontao/odata-v4-metadata)
* supported data types are `Edm primitives`, `complex types`, `navigation properties`
* support `create`, `read`, `update`, and `delete` the `EntitySets`, 
* support `action imports`, `function imports`, `bounded actions` and `bounded functions` on `EntitySets`
* support for full OData query language using [@odata/parser](https://github.com/Soontao/odata-v4-parser)
  * filtering entities - `$filter`
  * sorting - `$orderby`
  * paging - `$skip` and `$top`
  * projection of entities - `$select`
  * expanding entities - `$expand`
  * count records - `$count`
* support async controller functions using `Promise`, `async/await`
* support `OData` V4.01 JSON format `$batch` operation
* support dependency inject
* support `deep insert`

## Concepts

### Domain Model

Define domain `model` class, it will be transformed to database schema.

### Action & Function

Define `Action/Function` on the `Domain Models`.

Using the `actions` implement the partially focused business logics, and use the `functions` implement complex queries.

### Hook

Hook is general business logic for specify `Domain Model`, like `beforeCreate`/`beforeUpdate`, and it's mapped from `OData`/`HTTP Method`.

Define `Hooks` to implement the general business logics for entity.

### Service

Using `services` in `hook`/`action`/`function`, keep the business consistence for single domain model.

Each model will have its own standard `CRUD` service which enhanced with `hooks` logic.

### Transaction

Each `TransactionContext` will use single database transaction (connection).

## [CHANGELOG](./CHANGELOG.md)

## [LICENSE](./LICENSE)